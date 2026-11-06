// Facultatif : utilise Claude (API Anthropic) pour écrire le « Brief du matin »
// en français et un quiz de compréhension basé sur les vraies actus du jour.
// Nécessite la variable d'environnement ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const PER_CAT = 22; // nombre d'articles envoyés à Claude par rubrique

const CAT_ENUM = ["ia", "finance", "monde"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "intro", "sections", "concept", "quiz"],
  properties: {
    headline: { type: "string", description: "Titre accrocheur qui résume la matinée (max 90 caractères)" },
    intro: { type: "string", description: "2 à 3 phrases simples pour planter le décor du jour" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "points"],
        properties: {
          category: { type: "string", enum: CAT_ENUM },
          title: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "why", "article"],
              properties: {
                text: { type: "string", description: "Le fait, en une ou deux phrases claires" },
                why: { type: "string", description: "Pourquoi c'est important / ce que ça peut changer" },
                article: { type: "integer", description: "Numéro de l'article source" },
              },
            },
          },
        },
      },
    },
    concept: {
      type: "object",
      additionalProperties: false,
      required: ["term", "explanation"],
      properties: {
        term: { type: "string" },
        explanation: { type: "string" },
      },
    },
    quiz: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "question", "options", "answer", "explanation", "article"],
        properties: {
          category: { type: "string", enum: CAT_ENUM },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, description: "Exactement 4 réponses possibles" },
          answer: { type: "integer", description: "Index (0 à 3) de la bonne réponse" },
          explanation: { type: "string" },
          article: { type: "integer", description: "Numéro de l'article qui contient la réponse" },
        },
      },
    },
  },
};

const SYSTEM = `Tu es le rédacteur en chef d'une matinale d'information pour un lecteur francophone curieux,
qui veut être très au point sur l'intelligence artificielle, la finance de marché et l'actualité américaine/mondiale.

Règles :
- Écris en français simple et clair, phrases courtes, sans jargon non expliqué.
- Utilise UNIQUEMENT les faits présents dans les articles fournis. N'invente aucun chiffre, nom ou date.
- Chaque point et chaque question cite le numéro de l'article d'où vient l'information.
- Sections : une par rubrique (ia, finance, monde), dans cet ordre, avec 4 à 5 points chacune — les infos les plus importantes, pas les plus anecdotiques.
- Dans "why", explique concrètement l'impact possible (marchés, entreprises, géopolitique, vie quotidienne).
- "concept" : un terme technique de l'IA ou de la finance qui apparaît dans les actus du jour, expliqué comme à un ami.
- Quiz : 10 questions (environ 4 IA, 3 finance, 3 monde) qui vérifient qu'on a bien lu et compris les actus du jour.
  4 options plausibles par question, une seule juste, réponses justes réparties au hasard entre les positions 0 à 3.
  L'explication rappelle le fait et pourquoi il compte.`;

export async function generateBrief(byCat, today) {
  const client = new Anthropic();
  const list = [];
  for (const cat of CAT_ENUM) for (const a of (byCat[cat] || []).slice(0, PER_CAT)) list.push(a);

  const lines = list.map((a, i) => `[${i}] (${a.cat}) ${a.source} — ${a.title}${a.summary ? `\n    ${a.summary.slice(0, 300)}` : ""}`);
  const prompt = `Nous sommes le ${today}. Voici les articles de la matinée :\n\n${lines.join("\n")}\n\nRédige le brief du matin et le quiz.`;

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // si le modèle refuse, l'API relance automatiquement sur un modèle de repli
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") throw new Error(`refus du modèle (${msg.stop_details?.category ?? "inconnu"})`);
  if (msg.stop_reason === "max_tokens") throw new Error("réponse tronquée (max_tokens)");

  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const out = JSON.parse(text);

  // On remplace les numéros d'articles par leurs identifiants (et on nettoie).
  const ref = (i) => list[i]?.id ?? null;
  return {
    date: today,
    model: msg.model,
    headline: out.headline,
    intro: out.intro,
    concept: out.concept,
    sections: out.sections.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p, article: ref(p.article) })) })),
    quiz: out.quiz
      .filter((q) => q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length)
      .map((q) => ({ ...q, article: ref(q.article) })),
  };
}
