// Liste des sources d'actualités (flux RSS / Atom).
// Pour ajouter une source : copie une ligne et change le nom + l'URL.
// lang : "fr" ou "en" (les articles en anglais ont un bouton « Traduire »).

const gnews = (q, lang = "fr") =>
  lang === "fr"
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

export const CATEGORIES = {
  ia: { label: "Intelligence artificielle", short: "IA" },
  finance: { label: "Finance de marché", short: "Marchés" },
  monde: { label: "USA & Monde", short: "USA & Monde" },
};

export const FEEDS = [
  // ---------- Intelligence artificielle ----------
  { cat: "ia", name: "Le Monde", lang: "fr", url: "https://www.lemonde.fr/intelligence-artificielle/rss_full.xml" },
  { cat: "ia", name: "ActuIA", lang: "fr", url: "https://www.actuia.com/feed/" },
  { cat: "ia", name: "Google Actualités", lang: "fr", url: gnews("intelligence artificielle when:2d") },
  { cat: "ia", name: "TechCrunch", lang: "en", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { cat: "ia", name: "The Verge", lang: "en", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { cat: "ia", name: "MIT Technology Review", lang: "en", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { cat: "ia", name: "OpenAI", lang: "en", url: "https://openai.com/news/rss.xml" },
  { cat: "ia", name: "Google News (EN)", lang: "en", url: gnews("artificial intelligence OR OpenAI OR Anthropic OR Nvidia AI when:2d", "en") },

  // ---------- Finance de marché ----------
  { cat: "finance", name: "Le Monde", lang: "fr", url: "https://www.lemonde.fr/marches-financiers/rss_full.xml" },
  { cat: "finance", name: "Les Echos", lang: "fr", url: "https://www.lesechos.fr/rss/rss_finance-marches.xml" },
  { cat: "finance", name: "Google Actualités", lang: "fr", url: gnews("bourse OR CAC 40 OR marchés financiers OR BCE when:2d") },
  { cat: "finance", name: "MarketWatch", lang: "en", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { cat: "finance", name: "CNBC", lang: "en", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { cat: "finance", name: "BBC Business", lang: "en", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { cat: "finance", name: "Google News (EN)", lang: "en", url: gnews("Wall Street stocks OR Fed OR Treasury yields when:2d", "en") },

  // ---------- USA & Monde ----------
  { cat: "monde", name: "Le Monde", lang: "fr", url: "https://www.lemonde.fr/ameriques/rss_full.xml" },
  { cat: "monde", name: "Le Monde International", lang: "fr", url: "https://www.lemonde.fr/international/rss_full.xml" },
  { cat: "monde", name: "Google Actualités", lang: "fr", url: gnews("États-Unis OR Maison-Blanche OR Washington when:2d") },
  { cat: "monde", name: "BBC US & Canada", lang: "en", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
  { cat: "monde", name: "New York Times", lang: "en", url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml" },
  { cat: "monde", name: "NYT Politics", lang: "en", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml" },
];
