// Profil alimentaire de l'utilisateur : allergènes, aliments à éviter, régime et
// seuils nutritionnels. Stocké côté serveur (Firestore, sous users/{uid}.dietaryProfile,
// comme la souscription) → synchronisé multi-appareils et disponible côté serveur
// pour un futur matching/notification. La DÉTECTION (comparer un produit au profil)
// vit dans dietaryCheckService.ts ; ce fichier ne contient que le modèle + les
// référentiels (listes d'allergènes, mots-clés d'aliments, nutriments).

// --- Allergènes réglementaires (UE 14) ------------------------------------
// Les clés correspondent aux tags Open Food Facts `allergens_tags` SANS le
// préfixe "en:" (ex. "en:milk" -> "milk"). Le libellé i18n se fait via la clé.
export const ALLERGEN_KEYS = [
  'gluten',
  'milk',
  'eggs',
  'nuts', // fruits à coque
  'peanuts', // arachides
  'soybeans',
  'fish',
  'crustaceans',
  'molluscs',
  'celery',
  'mustard',
  'sesame-seeds',
  'sulphur-dioxide-and-sulphites',
  'lupin'
] as const;
export type AllergenKey = (typeof ALLERGEN_KEYS)[number];

// --- Aliments à éviter (détection par ingrédients) -------------------------
// Chaque aliment a une liste de mots-clés (FR + EN) recherchés dans les
// ingrédients du produit (tags OFF `ingredients_tags` + texte `ingredients_text`).
// `ambiguous: true` = la présence n'est pas certaine (ex. gélatine porcine OU
// bovine) → on affiche "à vérifier" plutôt qu'un blocage ferme.
export type AvoidFoodDef = {
  key: string;
  keywords: string[];
  ambiguous?: boolean;
};

export const AVOID_FOODS: AvoidFoodDef[] = [
  {
    key: 'pork',
    keywords: [
      'porc', 'porcine', 'cochon', 'jambon', 'lard', 'lardon', 'bacon',
      'saindoux', 'couenne', 'charcuterie', 'chorizo', 'saucisson',
      'pork', 'ham', 'pancetta'
    ]
  },
  {
    key: 'seafood',
    keywords: [
      'fruits de mer', 'crevette', 'crabe', 'homard', 'langoustine', 'ecrevisse',
      'moule', 'huitre', 'huître', 'palourde', 'coquille', 'calamar', 'calmar',
      'poulpe', 'seiche', 'crustace', 'crustacé', 'mollusque',
      'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'oyster', 'clam',
      'squid', 'octopus', 'seafood', 'shellfish'
    ]
  },
  {
    key: 'alcohol',
    keywords: [
      'alcool', 'ethanol', 'éthanol', 'vin ', 'biere', 'bière', 'rhum', 'kirsch',
      'liqueur', 'cognac', 'armagnac', 'whisky', 'vodka',
      'alcohol', 'wine', 'beer', 'rum', 'ethyl'
    ]
  },
  {
    key: 'beef',
    keywords: ['boeuf', 'bœuf', 'veau', 'bovine', 'bovin', 'beef', 'veal']
  },
  {
    // Gélatine : origine (porcine/bovine/poisson) rarement précisée → ambigu.
    key: 'gelatin',
    keywords: ['gelatine', 'gélatine', 'gelatin', 'e441'],
    ambiguous: true
  }
];
export const AVOID_FOOD_KEYS = AVOID_FOODS.map((f) => f.key);

// --- Seuils nutritionnels /100 g -------------------------------------------
// Clés = champ OFF `nutriments.<key>_100g` (en grammes).
export const NUTRIENT_KEYS = ['sugars', 'fat', 'saturated-fat', 'salt'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export type NutrientThreshold = {
  enabled: boolean;
  // Seuil max en grammes pour 100 g. Au-delà → alerte.
  maxPer100g: number;
};

// --- Le profil complet -----------------------------------------------------
export type DietaryProfile = {
  allergens: AllergenKey[];
  avoidFoods: string[];
  vegetarian: boolean;
  vegan: boolean;
  thresholds: Partial<Record<NutrientKey, NutrientThreshold>>;
  updatedAt: number;
};

// Valeurs par défaut (repères indicatifs pour les seuils, désactivés par défaut :
// l'utilisateur active et ajuste ce qu'il veut).
export const DEFAULT_THRESHOLDS: Record<NutrientKey, number> = {
  sugars: 10, // g/100 g (repère "élevé")
  fat: 17.5,
  'saturated-fat': 5,
  salt: 1.5
};

export function emptyDietaryProfile(): DietaryProfile {
  return {
    allergens: [],
    avoidFoods: [],
    vegetarian: false,
    vegan: false,
    thresholds: {},
    updatedAt: 0
  };
}
