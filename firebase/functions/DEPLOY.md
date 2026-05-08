# Déploiement des Cloud Functions

## Prérequis (une seule fois)

1. **CLI Firebase**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Lier le projet Firebase**
   Depuis la racine du repo (où sera créé `firebase.json`) :
   ```bash
   firebase use --add
   # choisir le projet : eatsok-6d19f (ou un nouveau projet dédié à NumelineFR)
   ```

3. **Installer les dépendances des fonctions**
   ```bash
   cd firebase/functions
   npm install
   ```

## Configurer la clé Google Cloud Vision

La clé n'est **jamais** dans le code ni dans `app.json`. Elle est stockée comme secret Firebase et lue uniquement par la Cloud Function.

```bash
# Depuis le repo
firebase functions:secrets:set GOOGLE_VISION_API_KEY
# Coller la clé Google Cloud Vision quand demandé
```

Pour vérifier :
```bash
firebase functions:secrets:access GOOGLE_VISION_API_KEY
```

## Configurer la clé Anthropic (Claude — fallback de 3ᵉ niveau)

Claude Sonnet 4.6 est appelé en dernier recours quand ni ML Kit ni Google Vision ne détectent un numéro de lot plausible. Coût estimé ~0,004 €/appel (avec prompt caching activé), soit ~3 % des scans en pratique.

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
# Coller la clé API Anthropic (commence par sk-ant-...) quand demandé
```

La clé se génère sur https://console.anthropic.com/ → Settings → API Keys.

Pour vérifier :
```bash
firebase functions:secrets:access ANTHROPIC_API_KEY
```

## Déployer

```bash
cd firebase/functions
npm install   # première fois ou après ajout de @anthropic-ai/sdk
npm run build
cd ../..
firebase deploy --only functions:ocrVision,functions:ocrClaude
```

Les URLs publiques affichées à la fin du déploiement doivent correspondre à celles dans `app.json` :
```
https://europe-west1-<PROJECT_ID>.cloudfunctions.net/ocrVision
https://europe-west1-<PROJECT_ID>.cloudfunctions.net/ocrClaude
```

Mettre à jour `expo.extra.vision.endpoint` et `expo.extra.claude.endpoint` dans [app.json](../../app.json) si le `PROJECT_ID` diffère, puis rebuild l'app.

## Tester

```bash
# Test local (émulateur)
cd firebase/functions
npm run serve

# Test prod ocrVision
curl -X POST https://europe-west1-<PROJECT_ID>.cloudfunctions.net/ocrVision \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"<BASE64_DUNE_IMAGE>","languageHints":["fr"]}'

# Test prod ocrClaude
curl -X POST https://europe-west1-<PROJECT_ID>.cloudfunctions.net/ocrClaude \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"<BASE64_DUNE_IMAGE>","mediaType":"image/jpeg"}'
```

Réponse attendue (Vision) :
```json
{
  "text": "...",
  "lines": [{ "content": "...", "confidence": 0.97 }],
  "confidence": 0.97,
  "source": "vision-fallback"
}
```

Réponse attendue (Claude) :
```json
{
  "text": "L693A2102R",
  "lines": [{ "content": "L693A2102R", "confidence": 0.95 }],
  "confidence": 0.95,
  "source": "claude-fallback",
  "usage": {
    "cacheReadTokens": 480,
    "cacheCreationTokens": 0,
    "inputTokens": 1240,
    "outputTokens": 12
  }
}
```

`cacheReadTokens > 0` indique que le prompt caching fonctionne (économie ~30-40 % vs. premier appel).

## À durcir avant publication grand public

La fonction est actuellement publique (pas d'auth). Pour éviter l'abus :

1. **App Check** (recommandé)
   - Activer App Check dans la console Firebase pour le projet
   - Ajouter `@react-native-firebase/app-check` côté mobile
   - Dans `index.ts`, vérifier le header `X-Firebase-AppCheck` et rejeter les requêtes sans token valide

2. **Quotas Google Cloud**
   - Limiter le quota de la clé Vision à un nombre raisonnable de requêtes par minute/jour dans Google Cloud Console → APIs & Services → Quotas

3. **Limite de taille image**
   - Déjà en place : 10 MB max base64 (~7.5 MB image)
