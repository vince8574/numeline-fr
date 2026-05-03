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

## Déployer

```bash
cd firebase/functions
npm run build
cd ../..
firebase deploy --only functions:ocrVision
```

L'URL publique affichée à la fin du déploiement doit correspondre à celle dans `app.json` :
```
https://europe-west1-<PROJECT_ID>.cloudfunctions.net/ocrVision
```

Si le `PROJECT_ID` diffère, mettre à jour `expo.extra.vision.endpoint` dans [app.json](../../app.json) et rebuild l'app.

## Tester

```bash
# Test local (émulateur)
cd firebase/functions
npm run serve

# Test prod
curl -X POST https://europe-west1-<PROJECT_ID>.cloudfunctions.net/ocrVision \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"<BASE64_DUNE_IMAGE>","languageHints":["fr"]}'
```

Réponse attendue :
```json
{
  "text": "...",
  "lines": [{ "content": "...", "confidence": 0.97 }],
  "confidence": 0.97,
  "source": "vision-fallback"
}
```

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
