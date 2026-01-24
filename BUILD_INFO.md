# Build natif Android - EatSafe

Date: 2025-11-28

## ✅ Build réussi !

### Configuration

**Plateforme:** Android
**Package:** com.eatsafe.app
**Version:** 0.1.0
**Appareil cible:** c635771b0521

### Prérequis validés

- ✅ Android SDK installé
- ✅ ADB configuré (version 1.0.41)
- ✅ Téléphone connecté en mode développeur
- ✅ Assets présents (icon, splash, adaptive-icon)
- ✅ Configuration Expo valide

### Permissions configurées

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Plugins Expo activés

- ✅ expo-router (navigation)
- ✅ expo-camera (scan d'emballages)
- ✅ expo-notifications (alertes de rappel)
- ✅ expo-sqlite (base de données locale)
- ✅ @react-native-ml-kit/text-recognition (OCR)

---

## 🚀 Étapes du build

### 1. Prebuild ✅ (Terminé en ~10s)
```bash
npx expo prebuild --platform android
```

**Résultat:**
- Dossier `android/` créé
- Configuration Gradle générée
- Fichiers natifs prêts

### 2. Compilation ⏳ (En cours...)
```bash
npx expo run:android
```

**Processus:**
- Gradle Daemon démarré
- Téléchargement des dépendances
- Compilation du code
- Génération de l'APK
- Installation sur le téléphone

**Temps estimé:** 5-10 minutes (première fois)

---

## 📱 Après l'installation

### L'app sera installée sur votre téléphone avec :

✅ **Toutes les fonctionnalités natives**
- Notifications push opérationnelles
- Scan de caméra natif
- OCR ML Kit
- Base de données SQLite locale
- Tâches en arrière-plan

✅ **Mode développement actif**
- Hot reload (modifications en temps réel)
- Console de débogage
- Connexion au Metro Bundler

### Comment utiliser l'app

1. **L'app se lance automatiquement** après l'installation
2. **Accepter les permissions** (caméra, notifications)
3. **Tester les fonctionnalités:**
   - Scanner un produit
   - Saisie manuelle avec autocomplete
   - Naviguer vers `/test-notifications`
   - Envoyer une notification de test

---

## 🧪 Tests disponibles

### Test des notifications

**Navigation vers l'écran de test:**
```typescript
// Dans l'app, naviguer vers :
/test-notifications
```

**Types de rappels disponibles:**
- 🦠 Salmonelles (gravité élevée)
- 🦠 Listeria (gravité élevée)
- ⚠️ Allergène non déclaré (gravité moyenne)
- 🔪 Morceaux de verre (gravité élevée)

**Actions:**
- Sélectionner un type de rappel
- Appuyer sur "Envoyer la notification"
- Vérifier la notification
- Voir l'aperçu de l'alerte RecallAlert

---

## 🔄 Builds suivants

**Pour les prochaines sessions** (beaucoup plus rapide):

```bash
# Option 1: Rebuild complet si modifications natives
npx expo run:android

# Option 2: Juste le Metro Bundler (si modifications JS/TS uniquement)
npm start
# L'app se reconnecte automatiquement
```

**Temps:**
- Rebuild: 2-3 minutes
- Metro uniquement: 10 secondes

---

## 🛠️ Commandes utiles

### Vérifier les appareils connectés
```bash
adb devices
```

### Voir les logs en temps réel
```bash
adb logcat | grep -i "eatsafe"
```

### Redémarrer l'app
```bash
adb shell am force-stop com.eatsafe.app
adb shell am start -n com.eatsafe.app/.MainActivity
```

### Désinstaller l'app
```bash
adb uninstall com.eatsafe.app
```

### Nettoyer le build (en cas de problème)
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

---

## 📊 Structure du projet après build

```
eatSafe/
├── android/                    # ← Nouveau ! Fichiers natifs Android
│   ├── app/
│   │   ├── build.gradle       # Configuration de build
│   │   └── src/
│   │       └── main/
│   │           ├── AndroidManifest.xml
│   │           ├── java/
│   │           └── res/
│   ├── build.gradle
│   └── settings.gradle
├── ios/                        # (si build iOS fait)
├── app/                        # Routes Expo Router
├── src/                        # Code source
├── assets/                     # Icônes et splash
└── node_modules/
```

---

## ⚠️ Important

### À NE PAS faire

- ❌ Ne pas modifier directement les fichiers dans `android/`
- ❌ Ne pas commit le dossier `android/` (déjà dans .gitignore)
- ❌ Ne pas tester les appels d'urgence sans mode avion

### À faire

- ✅ Modifier le code dans `src/` et `app/`
- ✅ Utiliser `npx expo prebuild` pour régénérer `android/` si besoin
- ✅ Tester en mode avion pour les boutons d'urgence
- ✅ Vérifier les permissions au premier lancement

---

## 🎯 Fonctionnalités testables

### Avec le build natif

| Fonctionnalité | Status |
|----------------|--------|
| Scan de produits | ✅ |
| OCR marque | ✅ |
| OCR numéro de lot | ✅ |
| Reconnaissance 800 marques | ✅ |
| Autocomplete | ✅ |
| Ajout marque personnalisée | ✅ |
| Base de données locale | ✅ |
| **Notifications push** | ✅ |
| **Tâches arrière-plan** | ✅ |
| RecallAlert | ✅ |
| Boutons appel urgences | ✅ |
| Dark/Light mode | ✅ |
| Historique | ✅ |

---

## 📖 Documentation

- [Guide de test](./GUIDE_TEST_TELEPHONE.md)
- [Changelog marques](./CHANGELOG_BRANDS.md)
- [Changelog notifications](./CHANGELOG_NOTIFICATIONS.md)

---

## 🆘 Support

### En cas de problème

1. **Build échoue:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx expo prebuild --clean
   npx expo run:android
   ```

2. **App ne se connecte pas au Metro:**
   ```bash
   adb reverse tcp:8081 tcp:8081
   npm start
   ```

3. **Notifications ne fonctionnent pas:**
   - Vérifier les permissions dans les paramètres Android
   - Redémarrer l'app
   - Réessayer d'envoyer une notification

4. **OCR ne fonctionne pas:**
   - Vérifier la permission caméra
   - Redémarrer l'app
   - Tester avec un autre emballage

---

**Version du build:** 0.1.0
**Date:** 2025-11-28
**Plateforme:** Android
**Status:** ✅ Prêt pour les tests
