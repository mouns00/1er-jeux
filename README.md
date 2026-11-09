# Le Jumeau de décision

Avant un grand choix de vie (déménager, changer de job, ouvrir un business), décris ta décision et deux scénarios : l'IA simule tes 5 prochaines années (2027 → 2031) dans chacun, avec une ligne du temps, des notes sur 10, une journée type en 2031, les risques, le meilleur et le pire cas, un verdict et « la vraie question à se poser ».

> Une simulation, pas une prédiction, ni un conseil financier, juridique ou en immigration.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **API Claude** via le SDK officiel `@anthropic-ai/sdk`, appelé uniquement côté serveur (`src/app/api/simuler/route.ts`)
- **Zod** pour valider le formulaire et la réponse de l'IA
- Résultat affiché **en streaming** (la progression s'affiche année par année)
- **PWA** : installable sur l'écran d'accueil, avec icône et écran de démarrage
- **Carte verdict** 1080×1920 (format story), générée dans le navigateur
- **Historique** dans le `localStorage` du téléphone

## Lancer l'app en local

Prérequis : [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install
cp .env.example .env.local
```

Ouvre `.env.local` et colle ta clé API Anthropic (à créer sur https://platform.claude.com/settings/keys) :

```
ANTHROPIC_API_KEY=sk-ant-...
```

Puis :

```bash
npm run dev
```

Ouvre http://localhost:3000.

**Tester sans clé et sans frais** : mets `SIMULATION_FACTICE=1` dans `.env.local`. L'app renvoie alors une simulation d'exemple (Paris ou Montréal ?), en streaming, sans appeler l'IA.

**Tester sur ton téléphone** : lance `npm run dev -- -H 0.0.0.0`, puis ouvre `http://<IP-de-ton-ordi>:3000` sur le téléphone (même Wi-Fi).

## Mettre en ligne sur Vercel

1. Pousse le code sur GitHub (c'est déjà fait si tu lis ceci sur GitHub).
2. Va sur https://vercel.com, connecte-toi avec GitHub, clique **Add New → Project** et choisis ce dépôt.
3. Dans **Environment Variables**, ajoute `ANTHROPIC_API_KEY` avec ta clé.
4. Clique **Deploy**. Une minute plus tard, tu as une adresse en `https://….vercel.app`.

Sur le téléphone, ouvre cette adresse, puis :
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮ → « Installer l'application ».

Chaque nouveau `git push` redéploie automatiquement.

## Variables d'environnement

| Variable | Rôle | Par défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé API, côté serveur uniquement | (obligatoire) |
| `ANTHROPIC_MODEL` | Modèle Claude utilisé | `claude-opus-5-5` |
| `LIMITE_PAR_HEURE` | Simulations max par utilisateur et par heure | `5` |
| `LIMITE_PAR_JOUR` | Simulations max par utilisateur et par jour | `15` |
| `SIMULATION_FACTICE` | `1` = réponse d'exemple, sans appel à l'IA | (désactivé) |

## Sécurité et éthique

- **Clé API** : lue uniquement par la route serveur, jamais envoyée au navigateur. `.env.local` est ignoré par git.
- **Limite de requêtes** : par adresse IP (5/heure et 15/jour par défaut), message clair en cas de dépassement. ⚠️ Le compteur est en mémoire : sur Vercel, chaque instance a le sien. Pour une limite stricte en production, branche un stockage partagé (Upstash Redis / Vercel KV) dans `src/lib/rate-limit.ts`. Pense aussi à fixer un plafond de dépenses dans la console Anthropic.
- **Détresse** : double filet.
  1. Un filtre de mots-clés (`src/lib/safety.ts`) bloque les cas évidents **avant** d'appeler l'IA.
  2. Le prompt demande à l'IA de ne pas simuler et de renvoyer `situation_de_detresse: true` si elle détecte une situation de danger.
  Dans les deux cas, l'app affiche un écran « Toi d'abord. » avec les numéros d'aide (3114, 15, 112, 3919, 119, 114).
- **Mention** « Une simulation, pas une prédiction… » affichée sous le formulaire et sous chaque résultat.
- **Refus de l'IA** : le repli automatique (`fallbacks: "default"`) relance sur un autre modèle si le modèle principal refuse par excès de prudence.

## Où modifier quoi

| Fichier | Contenu |
|---|---|
| `src/lib/prompt.ts` | Le prompt (`SYSTEM_PROMPT` + `buildPrompt()`) |
| `src/lib/schema.ts` | Formulaire et format JSON de réponse (Zod) |
| `src/app/api/simuler/route.ts` | Route API : validation, limite, appel à Claude en streaming |
| `src/lib/share-card.ts` | Dessin de la carte story 1080×1920 |
| `src/lib/history.ts` | Historique (localStorage) |
| `src/app/globals.css` | Couleurs (clair / sombre) |
| `public/icons/icon.svg` | Icône ; `node scripts/generate-icons.mjs` régénère les PNG et les écrans de démarrage (nécessite Playwright) |

## Prochaines étapes possibles

- Historique en base de données (Supabase, Vercel Postgres…) avec un compte utilisateur.
- Limite de requêtes partagée (Upstash Redis).
- Page de partage publique avec image Open Graph.
