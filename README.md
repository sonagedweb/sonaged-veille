# SONAGED S.A — Veille Stratégique v2.0
## Données en temps réel : Google News + GDELT + Reddit

---

## 📁 Structure du projet

```
sonaged-veille/
├── api/
│   └── news.js          ← Serverless function (agrège toutes les sources)
├── public/
│   └── index.html       ← Interface frontend
├── vercel.json          ← Config déploiement
├── package.json
└── README.md
```

---

## 🚀 Déploiement GitHub → Vercel

### Étape 1 — Uploader sur GitHub
Dans votre repo `sonagedweb/sonaged-veille` :
1. Supprimez l'ancien `index (5).html`
2. Uploadez **tous ces fichiers** en conservant la structure de dossiers :
   - `api/news.js`
   - `public/index.html`
   - `vercel.json`
   - `package.json`

### Étape 2 — Déployer sur Vercel
1. Allez sur [vercel.com/new](https://vercel.com/new)
2. Importez `sonagedweb/sonaged-veille`
3. Cliquez **Deploy** ✅

---

## 📡 Sources de données (100% gratuites, sans clé)

| Source | Type | Fréquence |
|--------|------|-----------|
| **Google News RSS** | Presse mondiale | Temps réel |
| **GDELT Project** | Presse africaine | 15 min |
| **Reddit** | Forums & discussions | Temps réel |

## 🔑 Booster avec NewsAPI (optionnel, gratuit)

1. Créez un compte sur [newsapi.org](https://newsapi.org) → gratuit
2. Copiez votre clé API
3. Dans Vercel → Settings → Environment Variables
4. Ajoutez : `NEWSAPI_KEY` = votre clé
5. Redéployez → +50% de sources !

---

## ⚙️ Mots-clés surveillés

- SONAGED
- SONAGED Sénégal  
- gestion déchets Dakar
- déchets Sénégal
- collecte ordures Dakar
- Mbeubeuss

---

*SONAGED S.A — Société Nationale de Gestion des Déchets*
