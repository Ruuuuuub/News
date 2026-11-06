# ☀️ La Matinale

Ton appli d'actus du matin : **Intelligence artificielle**, **Finance de marché** et **USA & Monde**, plus un **quiz** pour vérifier que tu as bien tout retenu.

## Ce que fait l'appli

| Onglet | Contenu |
|---|---|
| ☀️ **Brief** | Le résumé du matin : les infos importantes de chaque rubrique, *pourquoi c'est important*, le concept du jour, et ta progression de lecture. |
| 🤖 **IA** | Toutes les actus IA (Le Monde, ActuIA, TechCrunch, The Verge, MIT Tech Review, OpenAI, Google Actualités…). |
| 📈 **Marchés** | Bourse, taux, Fed/BCE, entreprises (Le Monde, Les Echos, MarketWatch, CNBC, BBC, Google Actualités…). |
| 🌎 **USA & Monde** | Ce qui se dit aux États-Unis et ce qui peut changer dans le monde (Le Monde, NYT, BBC, Google Actualités…). |
| 🧠 **Quiz** | Quiz du jour, quiz « sur mes lectures » (uniquement les articles que tu as ouverts), quiz par rubrique, scores et série de jours 🔥. |

Autres petits plus : recherche, filtre par source, filtre « non lus », bouton **🇫🇷 Traduire** sur les articles en anglais, articles **sauvegardés** (icône marque-page), mode clair/sombre, installable sur l'écran d'accueil du téléphone.

Les actus se mettent à jour **toutes seules** chaque matin vers 5h–6h, puis plusieurs fois dans la journée.

## Mettre l'appli en ligne (une seule fois, ~5 minutes)

1. Sur GitHub, fusionne cette branche dans `main` (bouton *Pull request* → *Merge*).
2. Va dans **Settings → Pages**, et dans *Source* choisis **GitHub Actions**.
3. Va dans l'onglet **Actions** → *Actus du matin* → **Run workflow**.
4. Après 1–2 minutes, ton appli est en ligne à l'adresse :
   `https://<ton-pseudo>.github.io/<nom-du-dépôt>/`
5. Sur ton téléphone, ouvre ce lien puis *Partager → Sur l'écran d'accueil* (iPhone) ou *Installer l'application* (Android).

> ℹ️ Avec un compte GitHub gratuit, GitHub Pages ne fonctionne que si le dépôt est **public**.

## (Optionnel) Le brief et le quiz rédigés par Claude

Sans rien faire, l'appli fonctionne déjà : le Brief affiche les articles « à la une » et le quiz est fabriqué automatiquement à partir des titres et résumés (compléter un titre, retrouver l'article d'un résumé, deviner le média…).

Pour avoir un **vrai résumé rédigé en français** (« ce qu'il faut retenir » + « pourquoi c'est important »), le **concept du jour** et un **quiz de compréhension** de 10 questions :

1. Crée une clé API sur <https://console.anthropic.com> (payant à l'usage : quelques centimes par jour, le brief n'est généré qu'une fois par matin).
2. Sur GitHub : **Settings → Secrets and variables → Actions → New repository secret**
   - Nom : `ANTHROPIC_API_KEY`
   - Valeur : ta clé
3. Relance *Actus du matin* dans l'onglet **Actions**.

## Utiliser l'appli sur ton ordinateur (facultatif)

```bash
npm install
npm run news     # récupère les actus (ajoute ANTHROPIC_API_KEY=... devant pour le brief Claude)
npm start        # puis ouvre http://localhost:8080
```

## Ajouter ou retirer une source

Tout est dans [`scripts/feeds.mjs`](scripts/feeds.mjs) : une ligne = une source (rubrique, nom, langue, adresse du flux RSS).

## Comment c'est construit

- `index.html`, `styles.css`, `app.js` : l'appli (aucune librairie, très léger).
- `scripts/fetch-news.mjs` : lit les flux RSS, enlève les doublons, garde les 3 derniers jours → `data/news.json`.
- `scripts/ai-brief.mjs` : (optionnel) demande à Claude le brief + le quiz, en n'utilisant que les faits des articles.
- `.github/workflows/update-news.yml` : lance tout ça automatiquement et publie le site.
- Ta progression (articles lus, scores, sauvegardes) reste **sur ton appareil** (stockage du navigateur).
