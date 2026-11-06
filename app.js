/* La Matinale — application (aucune dépendance) */
(() => {
  "use strict";

  // ---------- Réglages ----------
  const CATS = {
    ia: { label: "Intelligence artificielle", short: "IA", icon: "🤖", tagline: "Modèles, entreprises, régulation : tout ce qui bouge dans l'IA." },
    finance: { label: "Finance de marché", short: "Marchés", icon: "📈", tagline: "Bourses, taux, banques centrales, devises et matières premières." },
    monde: { label: "USA & Monde", short: "USA & Monde", icon: "🌎", tagline: "Ce qui se dit aux États-Unis et ce qui peut changer dans le monde." },
  };
  const QUIZ_LEN = 10;

  // ---------- Stockage local (protégé si indisponible) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("matinale." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("matinale." + k, JSON.stringify(v)); } catch {} },
  };

  const state = {
    data: null,
    read: new Set(store.get("read", [])),
    saved: store.get("saved", {}), // id -> article
    filters: { q: "", source: "", unread: false },
    quiz: null,
  };

  // ---------- Outils ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const todayKey = () => new Date().toLocaleDateString("fr-CA");

  function ago(iso) {
    if (!iso) return "";
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? "hier" : `il y a ${d} j`;
  }
  const isNew = (a) => a.date && Date.now() - Date.parse(a.date) < 6 * 3600e3;
  const translateUrl = (u) => `https://translate.google.com/translate?sl=auto&tl=fr&u=${encodeURIComponent(u)}`;
  const byId = (id) => state.data?.articles.find((a) => a.id === id) || state.saved[id];

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- Thème ----------
  const applyTheme = (t) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
  applyTheme(store.get("theme", null));
  $("#btn-theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const t = dark ? "light" : "dark";
    applyTheme(t);
    store.set("theme", t);
  });

  // ---------- Données ----------
  async function load(force) {
    const btn = $("#btn-refresh");
    btn.classList.add("spin");
    try {
      const res = await fetch(`data/news.json?t=${force ? Date.now() : Math.floor(Date.now() / 300000)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      state.data = await res.json();
      const d = new Date(state.data.updated);
      $("#updated").textContent = `Mis à jour ${ago(state.data.updated)} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      if (force) toast("Actualités à jour ✓");
    } catch (e) {
      if (!state.data) {
        $("#view").innerHTML = `<div class="empty"><div class="big">📡</div><p>Impossible de charger les actus.<br>Vérifie ta connexion puis réessaie.</p><button class="btn" onclick="location.reload()">Réessayer</button></div>`;
        $("#updated").textContent = "Hors ligne";
      } else toast("Pas de connexion : affichage des dernières actus");
    } finally {
      btn.classList.remove("spin");
    }
    if (state.data) render();
  }
  $("#btn-refresh").addEventListener("click", () => load(true));
  $("#btn-saved").addEventListener("click", () => (location.hash = "#saves"));

  const articlesOf = (cat) => (state.data?.articles || []).filter((a) => a.cat === cat);

  function markRead(id) {
    if (state.read.has(id)) return;
    state.read.add(id);
    store.set("read", [...state.read].slice(-1500));
  }
  function toggleSave(id) {
    if (state.saved[id]) { delete state.saved[id]; toast("Retiré des sauvegardes"); }
    else { const a = byId(id); if (a) state.saved[id] = a; toast("Sauvegardé ★"); }
    store.set("saved", state.saved);
    updateSavedBadge();
  }
  function updateSavedBadge() {
    const n = Object.keys(state.saved).length;
    const b = $("#saved-count");
    b.hidden = !n;
    b.textContent = n;
  }

  // ---------- Rendu : carte d'article ----------
  function card(a, { image = true } = {}) {
    const read = state.read.has(a.id);
    const saved = !!state.saved[a.id];
    return `
    <article class="card c-${a.cat} ${read ? "read" : ""} fade-in" data-id="${a.id}">
      ${image && a.image ? `<img class="thumb" src="${esc(a.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
      <div class="body">
        <div class="meta">
          <span class="source">${esc(a.source)}</span><span>·</span><span>${ago(a.date)}</span>
          ${a.lang === "en" ? `<span class="lang">EN</span>` : ""}
          ${isNew(a) && !read ? `<span class="new">NOUVEAU</span>` : ""}
        </div>
        <h3><a href="${esc(a.link)}" target="_blank" rel="noopener" data-read="${a.id}">${esc(a.title)}</a></h3>
        ${a.summary ? `<p class="sum">${esc(a.summary)}</p>` : ""}
        <div class="actions">
          <a class="act primary" href="${esc(a.link)}" target="_blank" rel="noopener" data-read="${a.id}">Lire ↗</a>
          ${a.lang === "en" ? `<a class="act" href="${translateUrl(a.link)}" target="_blank" rel="noopener" data-read="${a.id}">🇫🇷 Traduire</a>` : ""}
          <button class="act ${saved ? "on" : ""}" data-save="${a.id}">${saved ? "★ Sauvé" : "☆ Sauver"}</button>
          ${read ? "" : `<button class="act" data-mark="${a.id}">✓ Lu</button>`}
        </div>
      </div>
    </article>`;
  }

  // ---------- Onglet : Brief du matin ----------
  function topOf(cat, n) {
    const list = articlesOf(cat).slice(0, 18);
    const score = (a) => (a.summary ? 2 : 0) + (a.lang === "fr" ? 1 : 0) + (a.image ? 1 : 0);
    return list.map((a, i) => ({ a, s: score(a) - i * 0.12 })).sort((x, y) => y.s - x.s).slice(0, n).map((x) => x.a);
  }

  function progressBlock() {
    return `<div class="progress-row">${Object.entries(CATS).map(([k, c]) => {
      const list = articlesOf(k);
      const r = list.filter((a) => state.read.has(a.id)).length;
      const pct = list.length ? Math.round((r / list.length) * 100) : 0;
      return `<a class="prog c-${k}" href="#${k}"><div class="t"><span>${c.icon} ${c.short}</span><span class="n">${r}/${list.length}</span></div><div class="bar"><i style="width:${pct}%"></i></div></a>`;
    }).join("")}</div>`;
  }

  function renderBrief() {
    const d = state.data;
    const ai = d.ai; // dernier brief disponible
    const dateTxt = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const h = new Date().getHours();
    const hello = h < 12 ? "Bonjour ☀️" : h < 18 ? "Bon après-midi 👋" : "Bonsoir 🌙";
    const total = d.articles.length;
    const unread = d.articles.filter((a) => !state.read.has(a.id)).length;

    let html = `
      <section class="hero fade-in">
        <div class="kicker">${hello} · ${dateTxt}</div>
        <h1>${esc(ai?.headline || "Ton brief du matin est prêt")}</h1>
        <p>${esc(ai?.intro || "L'essentiel de l'IA, des marchés et de l'actualité américaine et mondiale, en quelques minutes. Lis, puis teste-toi avec le quiz.")}</p>
        <div class="hero-stats">
          <span class="pill">📰 ${total} articles</span>
          <span class="pill">👀 ${unread} non lus</span>
          ${ai ? `<span class="pill">✨ Résumé par Claude</span>` : ""}
        </div>
        <a class="btn light" href="#quiz">🧠 Faire le quiz du jour</a>
      </section>
      ${progressBlock()}`;

    if (ai && ai.sections?.length) {
      html += `<div class="section-title"><h2>L'essentiel à retenir</h2></div>`;
      for (const s of ai.sections) {
        const c = CATS[s.category];
        if (!c) continue;
        html += `<div class="brief-card c-${s.category} fade-in">
          <div class="brief-head"><span class="cat-dot"></span><h3>${c.icon} ${esc(s.title || c.label)}</h3></div>
          ${s.points.map((p, i) => {
            const a = byId(p.article);
            return `<div class="point"><span class="num">${i + 1}</span><div>
              <p>${esc(p.text)}</p>
              ${p.why ? `<div class="why"><b>Pourquoi c'est important :</b> ${esc(p.why)}</div>` : ""}
              ${a ? `<a class="src" href="${esc(a.link)}" target="_blank" rel="noopener" data-read="${a.id}">${esc(a.source)} — lire l'article ↗</a>` : ""}
            </div></div>`;
          }).join("")}
        </div>`;
      }
      if (ai.concept?.term) {
        html += `<div class="concept fade-in"><div class="label">💡 Le concept du jour</div><h3>${esc(ai.concept.term)}</h3><p>${esc(ai.concept.explanation)}</p></div>`;
      }
    }

    for (const [k, c] of Object.entries(CATS)) {
      const list = topOf(k, ai ? 2 : 4);
      if (!list.length) continue;
      html += `<div class="section-title"><h2><span class="cat-dot c-${k}"></span>${ai ? "À lire aussi · " : "À la une · "}${c.short}</h2><a href="#${k}">Tout voir →</a></div>
        <div class="grid">${list.map((a) => card(a)).join("")}</div>`;
    }
    if (!ai) html += `<p class="note">Astuce : ajoute une clé API Claude (voir le README) pour obtenir chaque matin un vrai résumé rédigé + un quiz de compréhension.</p>`;
    return html;
  }

  // ---------- Onglets : rubriques ----------
  function renderCategory(cat) {
    const c = CATS[cat];
    const all = articlesOf(cat);
    const f = state.filters;
    const sources = [...new Set(all.map((a) => a.source))].sort((a, b) => all.filter((x) => x.source === b).length - all.filter((x) => x.source === a).length).slice(0, 12);
    const q = f.q.trim().toLowerCase();
    const list = all.filter((a) =>
      (!f.source || a.source === f.source) &&
      (!f.unread || !state.read.has(a.id)) &&
      (!q || (a.title + " " + a.summary + " " + a.source).toLowerCase().includes(q)));

    return `
      <div class="cat-header c-${cat}"><div class="ico">${c.icon}</div><div><h1>${c.label}</h1><p>${c.tagline}</p></div></div>
      <div class="toolbar">
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="q" type="search" placeholder="Rechercher (ex : Nvidia, Fed, Trump…)" value="${esc(f.q)}" autocomplete="off"></label>
        <button class="chip ${f.unread ? "on" : ""}" data-unread>👀 Non lus</button>
        <div class="chips">
          <button class="chip ${!f.source ? "on" : ""}" data-source="">Toutes les sources</button>
          ${sources.map((s) => `<button class="chip ${f.source === s ? "on" : ""}" data-source="${esc(s)}">${esc(s)}</button>`).join("")}
        </div>
      </div>
      ${list.length ? `<div class="grid" id="list">${list.map((a) => card(a)).join("")}</div>`
        : `<div class="empty"><div class="big">🔎</div><p>Aucun article ne correspond.</p></div>`}
      <p class="note">${all.length} articles · ${all.filter((a) => state.read.has(a.id)).length} lus</p>`;
  }

  // ---------- Onglet : sauvegardés ----------
  function renderSaved() {
    const list = Object.values(state.saved).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    return `<div class="cat-header" style="--c:var(--accent)"><div class="ico">★</div><div><h1>Sauvegardés</h1><p>Tes articles mis de côté pour plus tard.</p></div></div>
      ${list.length ? `<div class="grid">${list.map((a) => card(a)).join("")}</div>`
        : `<div class="empty"><div class="big">☆</div><p>Rien pour l'instant.<br>Appuie sur « Sauver » sous un article pour le retrouver ici.</p></div>`}`;
  }

  // ---------- Quiz : génération automatique ----------
  const STOP = new Set(("les des une pour dans avec sans sous sur par plus moins mais comme cette ces son ses leur leurs elle elles ils nous vous être avoir fait faire après avant entre vers chez tout tous toute toutes très encore aussi alors quand dont même selon face contre depuis pendant jusqu deux trois quoi comment pourquoi the and for with from that this into over after about their they have will would could than what when where which while your just more most been were also amid says said why how new year years week").split(" "));

  function keyWords(title) {
    return title.split(/\s+/).map((w, i) => ({ w: w.replace(/^[«"“‘'(\[]+|[»"”’'),.:;!?\]]+$/g, ""), i }))
      .filter(({ w }) => w.length >= 4 && /\p{L}|\d/u.test(w) && !STOP.has(w.toLowerCase()) && !w.includes("’") && !w.includes("'"))
      .map(({ w, i }) => ({ w, i, s: (/\d/.test(w) ? 3 : 0) + (i > 0 && /^\p{Lu}/u.test(w) ? 3 : 0) + Math.min(w.length, 10) / 3 }));
  }

  function qMissing(a, pool) {
    const kws = keyWords(a.title).sort((x, y) => y.s - x.s);
    if (!kws.length) return null;
    const target = kws[Math.floor(Math.random() * Math.min(2, kws.length))].w;
    const kind = /\d/.test(target) ? "num" : /^\p{Lu}/u.test(target) ? "cap" : "low";
    const lowerTitle = a.title.toLowerCase();
    const cands = new Set();
    for (const o of shuffle(pool)) {
      if (o.id === a.id) continue;
      for (const k of keyWords(o.title)) {
        const kk = /\d/.test(k.w) ? "num" : /^\p{Lu}/u.test(k.w) ? "cap" : "low";
        if (kk === kind && k.w.toLowerCase() !== target.toLowerCase() && !lowerTitle.includes(k.w.toLowerCase())) cands.add(k.w);
      }
      if (cands.size > 12) break;
    }
    if (cands.size < 3) return null;
    const distract = shuffle([...cands]).slice(0, 3);
    const options = shuffle([target, ...distract]);
    const masked = esc(a.title).replace(esc(target), "<b>_____</b>");
    return {
      kind: "missing", category: a.cat, article: a.id,
      question: "Complète le titre lu ce matin :",
      quoteHtml: masked, options, answer: options.indexOf(target),
      explanation: `Le titre exact : « ${a.title} » (${a.source}).`,
    };
  }

  function qSummary(a, pool) {
    if (!a.summary || a.summary.length < 60) return null;
    const others = shuffle(pool.filter((o) => o.id !== a.id && o.cat === a.cat)).slice(0, 3);
    if (others.length < 3) return null;
    const options = shuffle([a.title, ...others.map((o) => o.title)]);
    return {
      kind: "summary", category: a.cat, article: a.id,
      question: "Quel article correspond à ce résumé ?",
      quoteHtml: esc(a.summary.length > 260 ? a.summary.slice(0, 250) + "…" : a.summary),
      options, answer: options.indexOf(a.title),
      explanation: `C'était « ${a.title} » (${a.source}).`,
    };
  }

  function qSource(a, pool) {
    const srcs = [...new Set(pool.map((o) => o.source))].filter((s) => s !== a.source);
    if (srcs.length < 3) return null;
    const options = shuffle([a.source, ...shuffle(srcs).slice(0, 3)]);
    return {
      kind: "source", category: a.cat, article: a.id,
      question: "Quel média a publié cette info ?",
      quoteHtml: esc(a.title), options, answer: options.indexOf(a.source),
      explanation: `C'est ${a.source} qui a publié cet article.`,
    };
  }

  function buildAutoQuiz(pool) {
    const out = [];
    const used = new Set();
    for (const a of shuffle(pool)) {
      if (out.length >= QUIZ_LEN) break;
      if (used.has(a.id)) continue;
      const r = Math.random();
      const order = a.summary && r < 0.45 ? [qSummary, qMissing, qSource] : r < 0.85 ? [qMissing, qSummary, qSource] : [qSource, qMissing, qSummary];
      for (const fn of order) {
        const q = fn(a, state.data.articles);
        if (q) { out.push(q); used.add(a.id); break; }
      }
    }
    return out;
  }

  // ---------- Quiz : écrans ----------
  const quizHistory = () => store.get("scores", []);
  function streak() {
    const days = new Set(quizHistory().map((s) => s.day));
    let n = 0;
    const d = new Date();
    if (!days.has(d.toLocaleDateString("fr-CA"))) d.setDate(d.getDate() - 1);
    while (days.has(d.toLocaleDateString("fr-CA"))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function renderQuizHome() {
    const ai = state.data.ai;
    const hist = quizHistory();
    const best = hist.length ? Math.max(...hist.map((s) => Math.round((s.score / s.total) * 100))) : 0;
    const readCount = state.data.articles.filter((a) => state.read.has(a.id)).length;
    const mode = (id, icon, title, desc, cls = "", disabled = false) =>
      `<button class="mode ${cls}" data-quiz="${id}" ${disabled ? "disabled" : ""}><div class="ico">${icon}</div><div><h3>${title}</h3><p>${desc}</p></div></button>`;

    return `
      <div class="cat-header" style="--c:var(--accent)"><div class="ico">🧠</div><div><h1>Quiz</h1><p>Vérifie que tu as bien retenu les actus du jour.</p></div></div>
      <div class="stats">
        <div class="stat"><b>${streak()} 🔥</b><span>jours d'affilée</span></div>
        <div class="stat"><b>${hist.length}</b><span>quiz faits</span></div>
        <div class="stat"><b>${best}%</b><span>meilleur score</span></div>
      </div>
      <div class="quiz-modes">
        ${ai?.quiz?.length ? mode("ai", "✨", "Le quiz du jour", `${ai.quiz.length} questions de compréhension écrites par Claude à partir des actus${ai.date !== todayKey() ? ` du ${new Date(ai.date).toLocaleDateString("fr-FR")}` : " de ce matin"}.`, "featured") : ""}
        ${mode("read", "📖", "Sur mes lectures", readCount >= 4 ? `Questions uniquement sur les ${readCount} articles que tu as lus.` : "Lis au moins 4 articles pour débloquer ce quiz.", "", readCount < 4)}
        ${mode("mix", "🎲", "Quiz express", "10 questions piochées dans toutes les rubriques.")}
        ${Object.entries(CATS).map(([k, c]) => mode(k, c.icon, `Spécial ${c.short}`, `10 questions sur ${c.label.toLowerCase()}.`, `c-${k}`)).join("")}
      </div>
      ${hist.length ? `<div class="section-title"><h2>Derniers scores</h2></div>
        <div class="review">${hist.slice(-6).reverse().map((s) => `<div>${new Date(s.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${esc(s.label)} — <b>${s.score}/${s.total}</b></div>`).join("")}</div>` : ""}`;
  }

  function startQuiz(mode) {
    let questions, label;
    const arts = state.data.articles;
    if (mode === "ai") {
      questions = shuffle(state.data.ai.quiz).map((q) => ({ ...q, kind: "ai" }));
      label = "Quiz du jour";
    } else {
      const pool = mode === "read" ? arts.filter((a) => state.read.has(a.id)) : CATS[mode] ? articlesOf(mode) : arts;
      questions = buildAutoQuiz(pool);
      label = mode === "read" ? "Sur mes lectures" : CATS[mode] ? `Spécial ${CATS[mode].short}` : "Quiz express";
    }
    if (!questions.length) return toast("Pas assez d'articles pour ce quiz");
    state.quiz = { questions, i: 0, score: 0, answers: [], label, mode };
    render();
  }

  function renderQuestion() {
    const z = state.quiz;
    if (z.i >= z.questions.length) return renderResult();
    const q = z.questions[z.i];
    const c = CATS[q.category] || {};
    const answered = z.answers[z.i];
    const a = byId(q.article);
    return `<div class="q-wrap fade-in">
      <div class="q-top"><button class="btn ghost small" data-quit>✕ Quitter</button><span>${esc(z.label)} · ${z.i + 1}/${z.questions.length}</span><span>⭐ ${z.score}</span></div>
      <div class="q-progress"><i style="width:${(z.i / z.questions.length) * 100}%"></i></div>
      <div class="q-card c-${q.category}">
        <div class="q-kicker">${c.icon || ""} ${c.short || ""}</div>
        <h2>${esc(q.question)}</h2>
        ${q.quoteHtml ? `<div class="q-quote">${q.quoteHtml}</div>` : ""}
        <div class="options">${q.options.map((o, i) => {
          let cls = "";
          if (answered != null) { if (i === q.answer) cls = "good"; else if (i === answered) cls = "bad"; }
          return `<button class="opt ${cls}" data-opt="${i}" ${answered != null ? "disabled" : ""}><span class="l">${"ABCD"[i] || i + 1}</span><span>${esc(o)}</span></button>`;
        }).join("")}</div>
        ${answered != null ? `<div class="feedback">
          <div class="res ${answered === q.answer ? "ok" : "ko"}">${answered === q.answer ? pick(["Bravo ! 🎉", "Exact ! ✅", "Bien vu ! 💪"]) : "Raté… 😅"}</div>
          ${esc(q.explanation || "")}
          ${a ? `<div style="margin-top:8px"><a href="${esc(a.link)}" target="_blank" rel="noopener" data-read="${a.id}">Relire l'article (${esc(a.source)}) ↗</a></div>` : ""}
        </div>
        <div class="q-next"><button class="btn" data-next>${z.i + 1 < z.questions.length ? "Question suivante →" : "Voir mon score 🏁"}</button></div>` : ""}
      </div>
    </div>`;
  }

  function renderResult() {
    const z = state.quiz;
    if (!z.saved) {
      const hist = quizHistory();
      hist.push({ at: Date.now(), day: todayKey(), label: z.label, score: z.score, total: z.questions.length });
      store.set("scores", hist.slice(-100));
      z.saved = true;
    }
    const pct = Math.round((z.score / z.questions.length) * 100);
    const msg = pct === 100 ? "Parfait. Tu es au point, rien ne t'échappe 🏆" : pct >= 70 ? "Très bien ! Tu maîtrises l'actu du jour 💪" : pct >= 40 ? "Pas mal ! Relis les articles ratés pour être au top 📚" : "Un petit tour dans les actus et tu reviens plus fort 😉";
    return `<div class="q-wrap fade-in"><div class="q-card result">
      <div class="q-kicker">${esc(z.label)}</div>
      <div class="score">${z.score}/${z.questions.length}</div>
      <p>${msg}</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn" data-again>🔁 Rejouer</button><button class="btn ghost" data-quit>Autres quiz</button>
      </div>
      <div class="review">${z.questions.map((q, i) => {
        const a = byId(q.article);
        return `<div class="${z.answers[i] === q.answer ? "ok" : "ko"}">${esc(q.question)} — <b>${esc(q.options[q.answer])}</b>${a && z.answers[i] !== q.answer ? ` · <a href="${esc(a.link)}" target="_blank" rel="noopener" data-read="${a.id}">relire ↗</a>` : ""}</div>`;
      }).join("")}</div>
    </div></div>`;
  }

  // ---------- Navigation ----------
  const TABS = ["brief", "ia", "finance", "monde", "quiz", "saves"];
  let lastTab = null;

  function currentTab() {
    const t = location.hash.slice(1);
    return TABS.includes(t) ? t : "brief";
  }

  function render() {
    if (!state.data) return;
    const tab = currentTab();
    if (tab !== lastTab) {
      if (CATS[lastTab] && !CATS[tab]) state.filters = { q: "", source: "", unread: false };
      if (CATS[tab] && CATS[lastTab]) state.filters.source = "";
      window.scrollTo(0, 0);
    }
    lastTab = tab;
    document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    const v = $("#view");
    if (tab === "brief") v.innerHTML = renderBrief();
    else if (CATS[tab]) v.innerHTML = renderCategory(tab);
    else if (tab === "quiz") v.innerHTML = state.quiz ? renderQuestion() : renderQuizHome();
    else if (tab === "saves") v.innerHTML = renderSaved();
    updateSavedBadge();
  }

  window.addEventListener("hashchange", render);

  // Clics (délégation)
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-read],[data-save],[data-mark],[data-source],[data-unread],[data-quiz],[data-opt],[data-next],[data-quit],[data-again]");
    if (!t) return;
    const d = t.dataset;
    if (d.read) {
      markRead(d.read);
      setTimeout(render, 300); // laisse le lien s'ouvrir
      return;
    }
    if (d.save) return toggleSave(d.save), render();
    if (d.mark) return markRead(d.mark), render();
    if (d.source !== undefined) return (state.filters.source = d.source), render();
    if (d.unread !== undefined) return (state.filters.unread = !state.filters.unread), render();
    if (d.quiz) return startQuiz(d.quiz);
    if (d.opt !== undefined && state.quiz) {
      const z = state.quiz;
      if (z.answers[z.i] != null) return;
      const i = +d.opt;
      z.answers[z.i] = i;
      if (i === z.questions[z.i].answer) z.score++;
      return render();
    }
    if (d.next !== undefined) { state.quiz.i++; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (d.again !== undefined) return startQuiz(state.quiz.mode);
    if (d.quit !== undefined) { state.quiz = null; return render(); }
  });

  // Recherche (sans perdre le focus)
  document.addEventListener("input", (e) => {
    if (e.target.id !== "q") return;
    state.filters.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const inp = $("#q");
    if (inp) { inp.focus(); inp.setSelectionRange(pos, pos); }
  });

  // ---------- Démarrage ----------
  load(false);
  setInterval(() => document.visibilityState === "visible" && load(false), 15 * 60 * 1000);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
