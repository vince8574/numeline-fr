# 🔥 Guide de Configuration Firestore pour EatSafe

## Vue d'ensemble

L'application utilise maintenant Firebase Firestore pour stocker et interroger dynamiquement **286,044+ marques** au lieu de les embarquer dans l'APK. Cela réduit considérablement la taille de l'application et permet une collaboration entre utilisateurs.

### Avantages de cette architecture :
✅ **App légère** : Pas de fichiers JSON volumineux dans l'APK
✅ **Recherche dynamique** : Les marques sont interrogées à la demande
✅ **Cache local** : Groupes de lettres mis en cache pendant 7 jours
✅ **Collaborative** : Les utilisateurs peuvent ajouter de nouvelles marques
✅ **Évolutif** : Intégration avec l'API Rappel Conso

---

## Étape 1 : Configuration Firebase Admin

### 1.1 Télécharger la clé de service

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet **eatsok**
3. Allez dans **⚙️ Paramètres du projet** → **Comptes de service**
4. Cliquez sur **Générer une nouvelle clé privée**
5. Enregistrez le fichier JSON téléchargé comme `firebase-admin-key.json` à la racine du projet

### 1.2 Vérifier le fichier .gitignore

Le fichier `.gitignore` doit déjà contenir :
```
firebase-admin-key.json
```

⚠️ **IMPORTANT** : Ne commitez JAMAIS ce fichier sur Git !

---

## Étape 2 : Installer Firebase Admin SDK

Si ce n'est pas déjà fait :

```bash
npm install firebase-admin --save-dev
```

---

## Étape 3 : Peupler Firestore avec les marques

### 3.1 Exécuter le script de population

```bash
node scripts/populateFirestoreBrands.js
```

### 3.2 Ce que fait le script :

1. ✅ Charge **286,044 marques** depuis `android/app/src/main/assets/brands.json`
2. ✅ Récupère des marques supplémentaires depuis **l'API Rappel Conso**
3. ✅ Groupe les marques par première lettre (a-z, 0)
4. ✅ Upload vers Firestore en batches
5. ✅ Crée un document `_metadata` avec les statistiques

### 3.3 Structure Firestore créée :

```
Collection: brands/
├── a: { brands: [...], count: X, lastUpdated: timestamp }
├── b: { brands: [...], count: X, lastUpdated: timestamp }
├── c: { brands: [...], count: X, lastUpdated: timestamp }
├── ...
├── z: { brands: [...], count: X, lastUpdated: timestamp }
├── 0: { brands: [...], count: X, lastUpdated: timestamp }
└── _metadata: {
    totalBrands: 286044+,
    totalDocuments: 27,
    categories: 27,
    sources: {
      openFoodFacts: 286044,
      rappelConso: X
    }
  }
```

### 3.4 Résultat attendu :

```
🚀 Starting Firestore brands population...

📂 Loading brands from brands.json...
✓ Loaded 286044 brands from local file

📡 Fetching brands from Rappel Conso API...
✓ Found 100 unique brands from Rappel Conso

📊 Total unique brands: 286144

📝 Grouped into 27 categories

  ✓ Letter "a": 12345 brands
  ✓ Letter "b": 8765 brands
  ...
  💾 Committed batch of 27 documents

✅ Successfully populated Firestore with 286144 brands!
📦 Created 27 documents in 'brands' collection
```

---

## Étape 4 : Vérifier dans Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet
3. Allez dans **Firestore Database**
4. Vous devriez voir la collection `brands` avec ~27 documents

---

## Étape 5 : Rebuild et test de l'application

### 5.1 Rebuild JavaScript bundle

```bash
npx expo export:embed --platform android --entry-file index.js --bundle-output android/app/build/generated/assets/react/release/index.android.bundle --assets-dest android/app/build/generated/res/react/release
```

### 5.2 Build APK

```bash
cd android
./gradlew assembleRelease --no-build-cache
cd ..
```

### 5.3 Installer sur le téléphone

```bash
adb -s c635771b0521 install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## Comment ça fonctionne

### Architecture de recherche

```
User types "Danone" →
  ↓
searchBrands("Danone") →
  ↓
1. Normalise: "danone" → première lettre: "d"
  ↓
2. Vérifie cache local pour lettre "d"
  ↓
3. Si pas en cache → Fetch Firestore brands/d
  ↓
4. Cache localement pendant 7 jours
  ↓
5. Filtre & score les correspondances
  ↓
6. Retourne top 10 résultats
```

### Cache local

- **Emplacement** : `FileSystem.documentDirectory/brand-cache/`
- **Structure** : Un fichier JSON par lettre (ex: `d.json`)
- **Expiration** : 7 jours
- **Taille** : ~10-50 KB par lettre

### Contributions utilisateurs

Quand un utilisateur ajoute une nouvelle marque via `BrandAutocomplete` :

1. ✅ Sauvegarde locale dans `customBrandsService`
2. ✅ Upload vers Firestore via `addBrandToFirestore()`
3. ✅ Disponible immédiatement pour tous les utilisateurs
4. ✅ Cache local invalidé pour cette lettre

---

## Dépannage

### Erreur : "firebase-admin-key.json not found"

**Solution** : Téléchargez la clé de service depuis Firebase Console (voir Étape 1)

### Erreur : "Permission denied" sur Firestore

**Solution** :
1. Vérifiez les règles Firestore dans Firebase Console
2. Règles recommandées pour développement :
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /brands/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Les marques ne se chargent pas dans l'app

**Diagnostics** :
1. Vérifiez les logs : `adb logcat -s ReactNativeJS`
2. Recherchez `[FirestoreBrands]` dans les logs
3. Vérifiez que Firestore est bien peuplé (Firebase Console)
4. Vérifiez la connexion internet du téléphone

### Cache corrompu

**Solution** :
```bash
# Sur le téléphone, effacez les données de l'app
# Ou supprimez le cache programmatiquement
```

---

## Mise à jour des marques

Pour ajouter de nouvelles marques ou mettre à jour la base :

### Option 1 : Regénérer depuis Open Food Facts

```bash
node scripts/generateAllBrands.js
node scripts/populateFirestoreBrands.js
```

### Option 2 : Ajouter manuellement via Firestore Console

1. Allez dans Firestore Database
2. Sélectionnez `brands` → lettre appropriée
3. Modifiez le tableau `brands`
4. Mettez à jour `count` et `lastUpdated`

### Option 3 : Script personnalisé

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addBrand(brandName) {
  const letter = brandName.toLowerCase().charAt(0);
  const docRef = db.collection('brands').doc(letter);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const brands = doc.data().brands;

    if (!brands.includes(brandName)) {
      brands.push(brandName);
      brands.sort();

      transaction.update(docRef, {
        brands: brands,
        count: brands.length,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });
}

addBrand('Nouvelle Marque').then(() => process.exit(0));
```

---

## Fichiers modifiés

### Services créés/modifiés :
- ✅ `src/services/firestoreBrandsService.ts` - Nouveau service Firestore
- ✅ `src/services/ocrService.ts` - Mis à jour pour Firestore
- ✅ `src/components/BrandAutocomplete.tsx` - Utilise Firestore
- ✅ `scripts/populateFirestoreBrands.js` - Script de population

### Fichiers obsolètes (peuvent être supprimés) :
- ❌ `assets/data/brands-*.json` - Fichiers split (non utilisés)
- ❌ `scripts/splitBrands.js` - Script de split (non utilisé)
- ❌ `scripts/uploadBrandsToFirebase.js` - Firebase Storage (remplacé par Firestore)

---

## Statistiques

- **Marques totales** : 286,044+ (Open Food Facts) + API Rappel Conso
- **Documents Firestore** : 27 (a-z, 0, _metadata)
- **Taille cache local** : ~500 KB - 1 MB (après utilisation)
- **Taille APK réduite de** : ~5.2 MB (brands.json non embarqué)
- **Requêtes Firestore par recherche** : 1 (avec cache)
- **Temps de recherche** : <100ms (avec cache), ~500ms (sans cache)

---

## Support

Pour toute question ou problème :
1. Vérifiez les logs : `adb logcat -s ReactNativeJS`
2. Vérifiez Firebase Console
3. Consultez la documentation Firebase Firestore

---

## Prochaines étapes recommandées

1. ✅ **Authentification** : Implémenter Firebase Auth pour sécuriser les writes
2. ✅ **Indexation** : Créer des indexes Firestore pour des recherches plus rapides
3. ✅ **Monitoring** : Configurer Firebase Analytics pour suivre l'usage
4. ✅ **Offline** : Activer la persistence Firestore offline
5. ✅ **API Rappel Conso** : Automatiser la mise à jour périodique des marques
