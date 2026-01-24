# Changelog - Système de gestion des marques

Date: 2025-11-28

## Résumé des modifications

Implémentation complète d'un système de gestion des marques pour l'application EatSafe, incluant :
- Base de données de 800 marques alimentaires françaises
- Système d'ajout dynamique de nouvelles marques par l'utilisateur
- Interface d'autocomplete pour la saisie manuelle
- Standardisation des noms par défaut dans tout le code

---

## 🎯 Fonctionnalités ajoutées

### 1. Base de données de marques (800 marques)

**Fichiers créés/modifiés:**
- `scripts/filterBrands.js` - Script intelligent pour extraire les marques pertinentes
- `src/data/brands.json` - 800 marques alimentaires françaises sélectionnées

**Critères de sélection:**
- Marques françaises prioritaires (Danone, Président, Fleury Michon, etc.)
- Marques de distributeurs (Carrefour, Auchan, Lidl, Aldi, etc.)
- Marques internationales majeures (Coca-Cola, Nestlé, Barilla, etc.)
- Filtrage des marques invalides (symboles, codes, caractères non-latins)
- Scoring par pertinence avec algorithme de pondération

**Statistiques:**
- Source: 395 085 marques dans brands.txt
- Sélectionnées: 800 marques (0.20%)
- Top marques: Barilla, Coca-Cola, Heinz, Kellogg's, Lavazza, etc.

### 2. Système de marques personnalisées

**Nouveau service:** `src/services/customBrandsService.ts`

**Fonctionnalités:**
- Table SQLite `custom_brands` pour stocker les marques personnalisées
- Ajout de nouvelles marques par l'utilisateur
- Compteur d'utilisation pour trier par popularité
- Recherche par préfixe pour l'autocomplete
- Nettoyage automatique des marques inutilisées (90 jours)
- Export/Import pour backup et synchronisation

**API du service:**
```typescript
- getAllCustomBrands(): Promise<CustomBrand[]>
- getCustomBrandByName(name: string): Promise<CustomBrand | null>
- customBrandExists(name: string): Promise<boolean>
- addCustomBrand(name: string): Promise<boolean>
- incrementBrandUsage(name: string): Promise<void>
- removeCustomBrand(id: string): Promise<void>
- searchCustomBrands(prefix: string, limit?: number): Promise<CustomBrand[]>
- cleanupUnusedBrands(olderThanDays?: number): Promise<number>
- exportCustomBrands(): Promise<string[]>
- importCustomBrands(brandNames: string[]): Promise<number>
```

**Schéma de la table:**
```sql
CREATE TABLE custom_brands (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  addedAt INTEGER NOT NULL,
  usageCount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_custom_brands_name ON custom_brands(name COLLATE NOCASE);
```

### 3. BrandMatcher amélioré

**Modifications:** `src/services/brandMatcher.ts`

**Changements:**
- `getBrandMatcher()` devient asynchrone pour charger les marques personnalisées
- Nouvelle fonction `reloadBrandMatcher()` pour rafraîchir après ajout de marque
- Chargement automatique des marques de base + marques personnalisées
- Logging amélioré pour debugging

**Intégration:**
```typescript
// Ancien (synchrone)
const matcher = getBrandMatcher();

// Nouveau (asynchrone)
const matcher = await getBrandMatcher();
```

### 4. Composant d'autocomplete

**Nouveau composant:** `src/components/BrandAutocomplete.tsx`

**Fonctionnalités:**
- Suggestions en temps réel avec debounce (300ms)
- Recherche dans marques de base + marques personnalisées
- Badge "Perso" pour identifier les marques personnalisées
- Bouton "+ Ajouter comme nouvelle marque"
- Interface intuitive avec confirmation
- Indicateur de chargement
- Support du dark/light mode

**Props:**
```typescript
interface BrandAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}
```

### 5. ManualEntryScreen amélioré

**Modifications:** `src/screens/ManualEntryScreen.tsx`

**Changements:**
- Remplacement du TextInput simple par BrandAutocomplete
- Incrémentation du compteur d'utilisation lors de la sauvegarde
- Meilleure UX pour la saisie de marques
- Validation et suggestions automatiques

**Workflow utilisateur:**
1. L'utilisateur tape les premières lettres d'une marque
2. L'autocomplete affiche des suggestions
3. L'utilisateur peut sélectionner une suggestion ou continuer à taper
4. Si la marque n'existe pas, possibilité de l'ajouter
5. Les marques personnalisées sont sauvegardées et réutilisables

---

## 🔧 Corrections et améliorations

### 6. Standardisation des noms par défaut

**Nouveau fichier:** `src/constants/defaults.ts`

**Constantes:**
```typescript
export const DEFAULT_BRAND_NAME = 'Marque inconnue';
export const DEFAULT_RECALL_STATUS = 'unknown';
export const DEFAULT_CLEANUP_AGE_MONTHS = 6;
```

**Fichiers modifiés:**
- `src/services/dbService.ts` - Utilise DEFAULT_BRAND_NAME
- `src/services/ocrService.ts` - Utilise DEFAULT_BRAND_NAME
- `src/screens/ScanScreen.tsx` - Utilise DEFAULT_BRAND_NAME
- `src/screens/ManualEntryScreen.tsx` - Utilise DEFAULT_BRAND_NAME

**Avant:** 3 valeurs différentes
- "Produit scanne" (dbService)
- "Marque inconnue" (ocrService)
- "Produit scanné" (ScanScreen)

**Après:** 1 valeur unique
- "Marque inconnue" partout

### 7. Corrections des tests

**Fichier modifié:** `__tests__/lotMatcher.test.ts`

**Correction:**
- Suppression du champ `country` qui n'existe plus dans ScannedProduct
- Tous les tests passent ✅

### 8. Améliorations du thème

**Fichiers modifiés:**
- `src/theme/themeContext.tsx`
- `src/theme/colors.ts`

**Ajouts:**
- Couleur `success` (vert) pour les états de succès
- Couleur `border` pour les bordures dans l'autocomplete

**Palette Dark:**
```typescript
success: '#10B981'  // Vert émeraude
border: '#1E4948'   // Vert foncé
```

**Palette Light:**
```typescript
success: '#059669'  // Vert émeraude foncé
border: '#D1E3E0'   // Gris-vert clair
```

---

## 📁 Structure des fichiers

### Nouveaux fichiers
```
scripts/
  └── filterBrands.js              # Script de filtrage des marques

src/
  ├── components/
  │   └── BrandAutocomplete.tsx    # Composant d'autocomplete
  ├── constants/
  │   └── defaults.ts              # Constantes par défaut
  ├── data/
  │   └── brands.json              # 800 marques (remplace [])
  └── services/
      └── customBrandsService.ts   # Service de marques personnalisées
```

### Fichiers modifiés
```
src/
  ├── services/
  │   ├── brandMatcher.ts          # Async + intégration custom brands
  │   ├── dbService.ts             # Utilise DEFAULT_BRAND_NAME
  │   └── ocrService.ts            # Utilise DEFAULT_BRAND_NAME + async
  ├── screens/
  │   ├── ManualEntryScreen.tsx    # Utilise BrandAutocomplete
  │   └── ScanScreen.tsx           # Utilise DEFAULT_BRAND_NAME
  └── theme/
      ├── colors.ts                # +success, +border
      └── themeContext.tsx         # +success, +border

__tests__/
  └── lotMatcher.test.ts           # Correction schéma
```

---

## 🧪 Tests et validation

### Tests unitaires
```bash
npm test
```
**Résultat:** ✅ 3/3 tests passés

### Vérification TypeScript
```bash
npx tsc --noEmit
```
**Résultat:** ✅ Aucune erreur

### Génération des marques
```bash
node scripts/filterBrands.js
```
**Résultat:** ✅ 800 marques exportées

---

## 🚀 Utilisation

### Pour régénérer la liste de marques

```bash
cd scripts
node filterBrands.js
```

Le script va:
1. Lire brands.txt (395k marques)
2. Appliquer les critères de filtrage
3. Calculer les scores de pertinence
4. Exporter les 800 meilleures dans src/data/brands.json

### Pour ajouter une marque via code

```typescript
import { addCustomBrand, reloadBrandMatcher } from '../services/customBrandsService';
import { reloadBrandMatcher } from '../services/brandMatcher';

// Ajouter une nouvelle marque
const success = await addCustomBrand('Ma Nouvelle Marque');

if (success) {
  // Recharger le matcher pour inclure la nouvelle marque
  await reloadBrandMatcher();
}
```

### Pour rechercher des marques

```typescript
import { searchCustomBrands } from '../services/customBrandsService';

// Rechercher des marques commençant par "Dan"
const results = await searchCustomBrands('Dan', 10);
// Résultat: ['Danone', 'Danonino', 'Danette', ...]
```

---

## 📊 Métriques

### Base de données
- **Marques de base:** 800 (fichier JSON)
- **Marques personnalisées:** Illimitées (SQLite)
- **Stockage marques custom:** ~50 bytes/marque
- **Index:** Recherche optimisée par nom (COLLATE NOCASE)

### Performance
- **Autocomplete:** Debounce 300ms
- **Recherche:** Index SQLite + distance de Levenshtein
- **Cache:** BrandMatcher singleton en mémoire

### UX
- **Suggestions:** Max 8 résultats
- **Seuil de confiance:** 0.85 pour validation automatique
- **Seuil de matching:** 0.6 pour suggestions

---

## 🔄 Migration des données

### Anciennes données
Les scans existants avec `brand: "Produit scanne"` sont automatiquement migrés vers `"Marque inconnue"` lors de la lecture depuis la base de données (fonction `normalizeProduct`).

Aucune migration SQL nécessaire - la transformation est faite à la volée.

---

## 📝 Notes techniques

### Algorithme de scoring des marques

Le script `filterBrands.js` utilise un système de scoring multi-critères:

| Critère | Points | Description |
|---------|--------|-------------|
| Marque prioritaire | +100 | Dans la liste FRENCH_PRIORITY_BRANDS |
| Mot-clé français | +50 | Contient "France", "Paris", etc. |
| Marque internationale | +40 | Dans INTERNATIONAL_MAJOR_BRANDS |
| Longueur 3-30 chars | +20 | Taille raisonnable |
| Commence par majuscule | +10 | Convention standard |
| Pas de caractères spéciaux | +15 | Nom propre |
| Trop de chiffres | -15 | Probablement un code |
| Trop long (>30) | -10 | Nom anormalement long |

### Distance de Levenshtein

Le matching utilise 3 stratégies:
1. **Exacte** (confidence: 1.0) - Match normalisé parfait
2. **Partielle** (confidence: 0.95) - Substring match
3. **Fuzzy** (confidence: variable) - Distance de Levenshtein

### Architecture de la donnée

```
┌─────────────────────────────────────────┐
│         Utilisateur scan/saisie         │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────▼─────────┐
         │  BrandAutocomplete │
         │   (si saisie)      │
         └─────────┬──────────┘
                   │
         ┌─────────▼─────────────────────┐
         │      BrandMatcher             │
         │  (brands.json + custom DB)    │
         └─────────┬───────────────────┬─┘
                   │                   │
      ┌────────────▼──────┐   ┌───────▼──────────┐
      │  Base Brands      │   │  Custom Brands   │
      │  (800 marques)    │   │  (user-added)    │
      │  brands.json      │   │  SQLite DB       │
      └───────────────────┘   └──────────────────┘
```

---

## 🐛 Problèmes résolus

1. ✅ Base de données de marques vide (brands.json = [])
2. ✅ Script de téléchargement vide (downloadBrands.js)
3. ✅ Incohérence des noms par défaut
4. ✅ Tests avec schéma obsolète
5. ✅ Pas d'interface pour ajouter de nouvelles marques
6. ✅ Pas d'autocomplete dans la saisie manuelle
7. ✅ getBrandMatcher synchrone ne chargeait pas les marques custom
8. ✅ Thème incomplet (manque success et border)

---

## 🔮 Améliorations futures possibles

1. **Synchronisation cloud** des marques personnalisées via Firebase
2. **Vote communautaire** pour valider/rejeter les nouvelles marques
3. **OCR amélioré** avec ML Kit pour mieux détecter les marques
4. **Logo recognition** pour identifier les marques visuellement
5. **Import CSV** pour ajouter des marques en masse
6. **Statistiques** des marques les plus utilisées
7. **Backup automatique** des marques personnalisées
8. **Suggestions intelligentes** basées sur l'historique utilisateur

---

## 👥 Impact utilisateur

### Avant
- ❌ Reconnaissance des marques impossible (brands.json vide)
- ❌ Pas de moyen d'ajouter une nouvelle marque
- ❌ Saisie manuelle sans aide
- ❌ Nom par défaut incohérent

### Après
- ✅ 800 marques reconnues automatiquement
- ✅ Possibilité d'ajouter des marques personnalisées
- ✅ Autocomplete intelligent dans la saisie manuelle
- ✅ Nom par défaut standardisé ("Marque inconnue")
- ✅ Expérience utilisateur fluide et cohérente

---

## 📞 Support

En cas de problème:

1. **Régénérer les marques:**
   ```bash
   node scripts/filterBrands.js
   ```

2. **Nettoyer les marques inutilisées:**
   ```typescript
   import { cleanupUnusedBrands } from '../services/customBrandsService';
   await cleanupUnusedBrands(90); // Supprime marques non utilisées depuis 90 jours
   ```

3. **Vérifier le nombre de marques:**
   ```typescript
   import { getBrandMatcher } from '../services/brandMatcher';
   const matcher = await getBrandMatcher();
   console.log('Marques chargées:', matcher.getBrandCount());
   ```

---

**Version:** 1.0.0
**Date:** 2025-11-28
**Développeur:** Claude (Anthropic)
**Statut:** ✅ Production Ready
