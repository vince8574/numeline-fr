// Profil alimentaire de l'utilisateur : MULTI-PERSONNES (famille). Chaque personne
// a un prénom et son propre régime (allergènes, aliments à éviter, végé/végan,
// seuils nutritionnels). Stocké côté serveur (Firestore, users/{uid}.dietaryProfile)
// → synchronisé multi-appareils. La DÉTECTION (comparer un produit au profil) vit
// dans dietaryCheckService.ts ; ce fichier ne contient que le modèle + référentiels.

import { nanoid } from 'nanoid/non-secure';

// --- Allergènes (14 UE + noix de coco) -------------------------------------
// Les clés correspondent aux tags Open Food Facts `allergens_tags` SANS le
// préfixe "en:" (ex. "en:milk" -> "milk"). La noix de coco n'étant pas toujours
// taguée par OFF, elle a un repli par mots-clés (ALLERGEN_INGREDIENT_KEYWORDS).
export const ALLERGEN_KEYS = [
  'gluten',
  'milk',
  'eggs',
  'nuts', // fruits à coque
  'peanuts', // arachides
  'coconut', // noix de coco
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

// Repli par mots-clés pour les allergènes mal/non tagués par OFF (ex. noix de
// coco). NB : on évite « coco » seul (matcherait « cocoa »/« cacao »).
export const ALLERGEN_INGREDIENT_KEYWORDS: Partial<Record<AllergenKey, string[]>> = {
  coconut: [
    'noix de coco',
    'coconut',
    'coprah',
    'lait de coco',
    'creme de coco',
    'huile de coco',
    'sucre de coco',
    'farine de coco',
    'eau de coco'
  ]
};

// --- Aliments à éviter (détection par ingrédients) -------------------------
// Chaque aliment a une liste de mots-clés (FR + EN) recherchés dans les
// ingrédients du produit (tags OFF `ingredients_tags` + texte `ingredients_text`).
// `ambiguous: true` = présence non certaine (ex. gélatine porcine OU bovine) →
// on affiche "à vérifier" plutôt qu'un blocage ferme.
export type AvoidFoodDef = {
  key: string;
  keywords: string[];
  ambiguous?: boolean;
  // Mots-clés dont l'origine par rapport à cet aliment est INCERTAINE : détectés,
  // ils déclenchent une alerte "à vérifier" (warn) plutôt qu'un blocage ferme.
  // Ex. la gélatine est souvent porcine mais peut être bovine/poisson → pour qui
  // évite le porc, on signale « peut contenir du porc (à vérifier) ».
  ambiguousKeywords?: string[];
};

export const AVOID_FOODS: AvoidFoodDef[] = [
  {
    key: 'pork',
    keywords: [
      'porc', 'porcine', 'cochon', 'jambon', 'lard', 'lardon', 'bacon',
      'saindoux', 'couenne', 'charcuterie', 'chorizo', 'saucisson',
      'pork', 'ham', 'pancetta'
    ],
    // Souvent d'origine porcine, mais pas toujours → « à vérifier ».
    ambiguousKeywords: ['gelatine', 'gélatine', 'gelatin', 'e441', 'presure', 'présure']
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

// --- Une personne (membre de la famille) et son régime ---------------------
export type DietaryCriteria = {
  allergens: AllergenKey[];
  avoidFoods: string[];
  vegetarian: boolean;
  vegan: boolean;
  thresholds: Partial<Record<NutrientKey, NutrientThreshold>>;
};

export type DietaryPerson = DietaryCriteria & {
  id: string;
  name: string;
};

// --- Le profil complet = la liste des personnes ----------------------------
export type DietaryProfile = {
  people: DietaryPerson[];
  updatedAt: number;
};

// Valeurs par défaut (repères indicatifs pour les seuils, désactivés par défaut).
export const DEFAULT_THRESHOLDS: Record<NutrientKey, number> = {
  sugars: 10, // g/100 g (repère "élevé")
  fat: 17.5,
  'saturated-fat': 5,
  salt: 1.5
};

export function emptyCriteria(): DietaryCriteria {
  return { allergens: [], avoidFoods: [], vegetarian: false, vegan: false, thresholds: {} };
}

export function makePerson(name: string): DietaryPerson {
  return { id: nanoid(), name, ...emptyCriteria() };
}

export function emptyDietaryProfile(): DietaryProfile {
  return { people: [], updatedAt: 0 };
}

// Normalise n'importe quelle forme stockée vers le modèle multi-personnes.
// Rétro-compat : un ANCIEN profil unique ({allergens, avoidFoods, …} à la racine)
// est converti en une seule personne (nommée `defaultName`).
export function normalizeProfile(raw: any, defaultName: string): DietaryProfile {
  if (!raw || typeof raw !== 'object') return emptyDietaryProfile();

  if (Array.isArray(raw.people)) {
    return {
      people: raw.people.map((p: any) => ({
        id: typeof p?.id === 'string' ? p.id : nanoid(),
        name: typeof p?.name === 'string' ? p.name : defaultName,
        allergens: Array.isArray(p?.allergens) ? p.allergens : [],
        avoidFoods: Array.isArray(p?.avoidFoods) ? p.avoidFoods : [],
        vegetarian: !!p?.vegetarian,
        vegan: !!p?.vegan,
        thresholds: p?.thresholds && typeof p.thresholds === 'object' ? p.thresholds : {}
      })),
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  // Ancien format (profil unique) → une personne.
  const hasLegacy =
    Array.isArray(raw.allergens) ||
    Array.isArray(raw.avoidFoods) ||
    raw.vegetarian ||
    raw.vegan ||
    (raw.thresholds && typeof raw.thresholds === 'object');
  if (hasLegacy) {
    return {
      people: [
        {
          id: nanoid(),
          name: defaultName,
          allergens: Array.isArray(raw.allergens) ? raw.allergens : [],
          avoidFoods: Array.isArray(raw.avoidFoods) ? raw.avoidFoods : [],
          vegetarian: !!raw.vegetarian,
          vegan: !!raw.vegan,
          thresholds: raw.thresholds && typeof raw.thresholds === 'object' ? raw.thresholds : {}
        }
      ],
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  return emptyDietaryProfile();
}
