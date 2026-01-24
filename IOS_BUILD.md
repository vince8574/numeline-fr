# Build iOS pour Eats OK

## Configuration complétée ✅

Les modifications suivantes ont été effectuées pour supporter iOS avec les 286 044 marques :

### 1. Assets iOS
- Script `scripts/eas-build-pre-install.sh` créé
- Copie automatiquement `brands.json` (5.2 MB) dans les ressources iOS lors du build EAS

### 2. Configuration EAS
- `eas.json` mis à jour avec hook `postinstall` pour iOS
- Resource class `m-medium` configurée pour gérer le build avec assets volumineux

### 3. Chargement des marques
- `brandMatcher.ts` supporte déjà le chargement depuis `FileSystem.bundleDirectory`
- Fonctionne automatiquement sur iOS et Android

## Comment builder pour iOS

### Option 1 : EAS Build (Recommandé - depuis Windows)

1. **Installer EAS CLI** (si pas déjà fait) :
```bash
npm install -g eas-cli
```

2. **Se connecter à Expo** :
```bash
eas login
```

3. **Configurer le projet** (première fois seulement) :
```bash
eas build:configure
```

4. **Lancer le build iOS** :

Pour un build de développement (pour tester) :
```bash
eas build --platform ios --profile development
```

Pour un build de production :
```bash
eas build --platform ios --profile production
```

5. **Récupérer l'app** :
- Le build se fait sur les serveurs Expo (cloud)
- Tu recevras un lien pour télécharger le fichier `.ipa`
- Installer sur iPhone via TestFlight ou directement

### Option 2 : Build local (Nécessite un Mac)

1. **Générer les fichiers natifs iOS** (sur Mac) :
```bash
npx expo prebuild --platform ios
```

2. **Ouvrir dans Xcode** :
```bash
open ios/eatsok.xcworkspace
```

3. **Builder depuis Xcode** :
- Sélectionner un device/simulateur
- Product → Archive
- Distribuer l'app

## Structure des assets

### Android
```
android/app/src/main/assets/brands.json (5.2 MB)
```

### iOS (généré lors du build)
```
ios/eatsok/Resources/brands.json (5.2 MB)
```

## Notes importantes

- ✅ Les 286 044 marques sont incluses dans l'app (pas de téléchargement)
- ✅ Chargement asynchrone au démarrage (pas de ralentissement)
- ✅ Cache en mémoire après premier chargement
- ✅ Même code pour Android et iOS

## Taille de l'app

- **Android APK** : ~45-50 MB (avec les 286k marques)
- **iOS IPA** : ~50-55 MB (estimation)

Les marques représentent seulement 5.2 MB, le reste est le code React Native et les dépendances natives.
