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

## App Check (protection anti-abus)

Les fonctions `ocrVision` et `ocrClaude` vérifient le header `X-Firebase-AppCheck` à chaque requête via le helper [`appCheck.ts`](src/appCheck.ts). Côté app, le token est joint automatiquement par [`appCheckService.ts`](../../src/services/appCheckService.ts).

### Mode monitor vs enforce

Variable d'env `APP_CHECK_ENFORCE` sur la fonction :
- **non définie / `false`** → mode **monitor** : log un warning si le token est absent/invalide mais sert quand même la requête. C'est le mode par défaut au premier déploiement.
- **`true`** → mode **enforce** : rejette avec HTTP 401 si le token est absent ou invalide.

**Procédure recommandée** : déployer en monitor pendant 1-2 semaines pour vérifier que les utilisateurs réels envoient bien des tokens valides (regarder les logs Cloud Functions pour les warnings `[AppCheck] MONITOR`), puis basculer en enforce.

```bash
# Activer enforce
firebase functions:config:set --project eatsok-6d19f appcheck.enforce=true   # méthode legacy
# ou via la CLI v2 / params (préférable) — éditer index.ts pour utiliser defineString

# Méthode simple : redéployer en passant l'env var
APP_CHECK_ENFORCE=true firebase deploy --only functions:ocrVision,functions:ocrClaude
```

### Activer App Check dans la console Firebase

1. https://console.firebase.google.com/project/eatsok-6d19f/appcheck
2. Onglet **Apps** → enregistrer l'app Android `com.numeline.app`
3. Provider : **Play Integrity** (gratuit, illimité)
4. Onglet **APIs** → laisser `ocrClaude` et `ocrVision` en **Unenforced** au début

### Debug token pour le dev (Expo dev client)

Le provider Play Integrity ne fonctionne **que** sur un APK signé prod. En dev (Expo dev client, build debug), l'app utilise un **debug provider** qui génère un token aléatoire au premier lancement.

1. Lancer l'app en dev (`npx expo start` puis ouvrir sur appareil)
2. Dans les logs de l'appareil (`adb logcat | grep -i appcheck` ou Metro), repérer une ligne du type :
   ```
   [Firebase/AppCheck][I-FAA001001] Provided debug token to use for testing
   ```
3. Copier le token (UUID format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
4. Console Firebase → App Check → Apps → menu `⋮` → **Manage debug tokens** → coller le token

Une fois enregistré, le dev client passe les vérifications App Check normalement.

## Quotas et limites complémentaires

1. **Plafond budgétaire Anthropic** : https://console.anthropic.com/ → Settings → Limits → Monthly spend limit (recommandé : 20 USD/mois). Filet de sécurité indépendant d'App Check.

2. **Quotas Google Cloud Vision** : Limiter le quota de la clé Vision à un nombre raisonnable de requêtes par minute/jour dans Google Cloud Console → APIs & Services → Quotas.

3. **Limite de taille image** : déjà en place dans le code — 10 MB max base64 (~7.5 MB image).
