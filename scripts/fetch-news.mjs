// Récupère toutes les actus (flux RSS), les trie, et écrit data/news.json.
// Si une clé ANTHROPIC_API_KEY est présente, Claude rédige en plus
// le « Brief du matin » et un quiz de compréhension (voir ai-brief.mjs).
//
// Lancer :  node scripts/fetch-news.mjs
// Options :  NO_AI=1 (désactive Claude)   FORCE_AI=1 (régénère le brief même s'il existe déjà)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FEEDS, CATEGORIES } from "./feeds.mjs";
import { generateBrief } from "./ai-brief.mjs";

const OUT = new URL("../data/news.json", import.meta.url);
const MAX_PER_FEED = 15;
const MAX_PER_CAT = 60;
const MAX_AGE_H = 72; // on ignore les articles de plus de 3 jours

// ---------- Petit lecteur RSS/Atom sans dépendance ----------
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", mdash: "—", ndash: "–", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", laquo: "«", raquo: "»" };

function decode(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function stripHtml(s = "") {
  return decode(decode(s)) // certains flux encodent deux fois
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}

function attr(xml, name, attribute) {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*${attribute}=["']([^"']+)["'][^>]*>`, "i"));
  return m ? decode(m[1]) : "";
}

function findImage(block) {
  const candidates = [
    attr(block, "media:content", "url"),
    attr(block, "media:thumbnail", "url"),
    block.match(/<enclosure[^>]*type=["']image[^>]*>/i) ? attr(block, "enclosure", "url") : "",
    (decode(block).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "",
  ];
  const url = candidates.find((u) => /^https?:\/\//.test(u));
  return url || "";
}

function parseFeed(xml, feed) {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, MAX_PER_FEED).map((b) => {
    let title = stripHtml(tag(b, "title"));
    let link = isAtom
      ? attr(b, 'link[^>]*rel=["\']alternate["\']', "href") || attr(b, "link", "href")
      : stripHtml(tag(b, "link")) || stripHtml(tag(b, "guid"));
    const date = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    let summary = stripHtml(tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content"));
    let source = feed.name;

    // Google Actualités : « Titre - Média » et la vraie source dans <source>
    if (feed.url.includes("news.google.com")) {
      const src = stripHtml(tag(b, "source"));
      if (src) {
        source = src;
        title = title.replace(new RegExp(`\\s+[-–—]\\s+${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
      }
      summary = ""; // la description Google n'est qu'une liste de liens
    }
    if (summary.length > 420) summary = summary.slice(0, 400).replace(/\s+\S*$/, "") + "…";
    if (summary === title) summary = "";

    return {
      id: createHash("sha1").update(link || title).digest("hex").slice(0, 12),
      cat: feed.cat,
      title,
      summary,
      link,
      source,
      lang: feed.lang,
      image: findImage(b),
      date: date ? new Date(stripHtml(date)).toISOString() : null,
    };
  });
}

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LaMatinaleBot/1.0; lecteur RSS personnel)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed(await res.text(), feed).filter((a) => a.title && a.link);
    console.log(`  ✓ ${feed.cat.padEnd(7)} ${feed.name.padEnd(24)} ${items.length} articles`);
    return items;
  } catch (e) {
    console.log(`  ✗ ${feed.cat.padEnd(7)} ${feed.name.padEnd(24)} ${e.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim().slice(0, 70);

async function main() {
  console.log("📰 Récupération des actualités…");
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const now = Date.now();
  const seen = new Set();
  const articles = [];

  for (const a of results.flat()) {
    const t = a.date ? Date.parse(a.date) : NaN;
    if (!Number.isNaN(t) && now - t > MAX_AGE_H * 3600e3) continue;
    if (!Number.isNaN(t) && t - now > 3600e3) a.date = new Date(now).toISOString(); // date dans le futur
    const key = norm(a.title);
    if (seen.has(key) || seen.has(a.id)) continue;
    seen.add(key);
    seen.add(a.id);
    articles.push(a);
  }

  articles.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const byCat = {};
  for (const c of Object.keys(CATEGORIES)) byCat[c] = articles.filter((a) => a.cat === c).slice(0, MAX_PER_CAT);
  const kept = Object.values(byCat).flat();

  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT, "utf8"));
  } catch {}

  const today = new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
  let ai = previous?.ai?.date === today && !process.env.FORCE_AI ? previous.ai : null;

  if (!ai && !process.env.NO_AI && process.env.ANTHROPIC_API_KEY) {
    try {
      console.log("🤖 Claude rédige le brief du matin et le quiz…");
      ai = await generateBrief(byCat, today);
      console.log(`  ✓ brief : ${ai.sections.length} rubriques, quiz : ${ai.quiz.length} questions`);
    } catch (e) {
      console.log(`  ✗ brief IA non généré : ${e.message}`);
      ai = previous?.ai ?? null; // on garde l'ancien plutôt que rien
    }
  } else if (ai) {
    console.log("🤖 Brief du jour déjà présent, conservé.");
  } else {
    console.log("ℹ️  Pas de clé ANTHROPIC_API_KEY : brief et quiz automatiques (sans Claude).");
  }

  const data = {
    updated: new Date().toISOString(),
    categories: CATEGORIES,
    counts: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.length])),
    articles: kept,
    ai,
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 1));
  console.log(`✅ ${kept.length} articles écrits dans data/news.json`);
  if (kept.length === 0) process.exitCode = 1;
}

main();
