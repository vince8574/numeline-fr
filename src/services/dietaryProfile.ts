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
  // Phrases dans lesquelles le mot-clé NE compte PAS (retirées du texte avant le
  // matching). Ex. « vinaigre d'alcool » contient « alcool » mais aucun alcool
  // (entièrement fermenté en acide acétique) → pas d'alerte alcool.
  excludePhrases?: string[];
};

export const AVOID_FOODS: AvoidFoodDef[] = [
  {
    key: 'pork',
    keywords: [
      'porc', 'porcine', 'cochon', 'jambon', 'lard', 'lardon', 'bacon',
      'saindoux', 'couenne', 'charcuterie', 'chorizo', 'saucisson',
      'pork', 'ham', 'pancetta'
    ],
    // Gélatine / E441 : souvent porcine, pas toujours → « à vérifier ». La présure
    // (rennet) est du veau ou microbienne, JAMAIS du porc → retirée d'ici (faux
    // positif « porc possible » sur les fromages, ex. gorgonzola « présure »).
    ambiguousKeywords: ['gelatine', 'gélatine', 'gelatin', 'e441'],
    // Charcuteries de volaille : PAS du porc.
    excludePhrases: [
      'jambon de dinde', 'jambon de volaille', 'jambon de poulet',
      'turkey ham', 'chicken ham', 'bacon de dinde', 'turkey bacon',
      'charcuterie de volaille', 'saucisson de volaille', 'saucisson de dinde',
      'chorizo de volaille', 'chorizo de dinde', 'chorizo de poulet'
    ]
  },
  {
    key: 'seafood',
    // « coquillage »/« saint-jacques » remplacent « coquille » : « morceaux de
    // coquille » (avertissement coquilles d'ŒUF) et « moulé à la louche »
    // (fromage, accents retirés → « moule ») déclenchaient à tort.
    keywords: [
      'fruits de mer', 'crevette', 'crabe', 'homard', 'langoustine', 'ecrevisse',
      'moule', 'huitre', 'huître', 'palourde', 'coquillage', 'saint-jacques',
      'saint jacques', 'calamar', 'calmar',
      'poulpe', 'seiche', 'crustace', 'crustacé', 'mollusque',
      'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'oyster', 'clam',
      'squid', 'octopus', 'seafood', 'shellfish'
    ],
    excludePhrases: ['moule a la louche', 'moules a la louche', 'moulee a la louche']
  },
  {
    key: 'alcohol',
    // Le matching est en MOTS ENTIERS (voir dietaryCheckService) : « vin » ne
    // matche plus « vinaigre », « rum » ne matche plus « crumble », et « ethyl »
    // (retiré) ne matche plus « méthylcellulose » — « alcool éthylique » reste
    // couvert par « alcool »/« ethanol ».
    keywords: [
      'alcool', 'ethanol', 'éthanol', 'vin', 'biere', 'bière', 'rhum', 'kirsch',
      'liqueur', 'cognac', 'armagnac', 'whisky', 'vodka',
      'alcohol', 'wine', 'beer', 'rum'
    ],
    // Cas réel (Tradilége Délices de Volaille) : « vinaigre d'alcool » + tag OFF
    // en:alcohol-vinegar déclenchaient une fausse alerte alcool.
    excludePhrases: [
      "vinaigre d'alcool", 'vinaigre d alcool', 'alcohol-vinegar', 'alcohol vinegar',
      'spirit vinegar', 'sans alcool', 'alcohol-free', 'alcohol free', 'non-alcoholic',
      // Vinaigre de vin / levure de bière : l'alcool est entièrement transformé.
      'vinaigre de vin', 'wine vinegar', 'wine-vinegar', 'levure de biere', 'beer yeast'
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

// --- Grossesse : aliments à risque (listériose / toxoplasmose) -------------
// Activé par la case "grossesse" d'une personne. Détecté par mots-clés dans les
// ingrédients. Mots-clés SPÉCIFIQUES pour éviter les faux positifs (ex. pas de
// « pâté » seul → matcherait « pâtes »).
// `level` : 'danger' = à ÉVITER, 'warn' = à LIMITER (défaut 'danger').
export type PregnancyRiskDef = {
  key: string;
  keywords: string[];
  excludePhrases?: string[];
  level?: 'danger' | 'warn';
};
export const PREGNANCY_RISKS: PregnancyRiskDef[] = [
  // NB : la ligature « œ » n'est PAS décomposée par la normalisation NFD → on
  // liste les deux graphies (« oeuf » et « œuf »).
  // --- À ÉVITER (danger) ---------------------------------------------------
  {
    key: 'raw-milk',
    keywords: [
      'lait cru', 'au lait cru', 'raw milk',
      'lait non pasteurise', 'non pasteurise', 'unpasteurised', 'unpasteurized'
    ]
  },
  {
    key: 'deli-meat',
    keywords: [
      'charcuterie', 'rillettes', 'foie gras', 'jambon cru', 'saucisson', 'salami',
      'chorizo', 'mortadelle', 'coppa', 'bresaola', 'pancetta', 'speck',
      'pate de foie', 'pate en croute'
    ],
    // Charcuteries de volaille : moindre risque, on ne les traite pas comme du cru.
    excludePhrases: [
      'jambon de dinde', 'jambon de volaille', 'jambon de poulet',
      'saucisson de volaille', 'saucisson de dinde', 'chorizo de volaille', 'chorizo de dinde'
    ]
  },
  {
    key: 'raw-fish',
    keywords: [
      'poisson cru', 'sushi', 'sashimi', 'saumon fume', 'poisson fume',
      'truite fumee', 'tarama', 'surimi cru',
      'oeufs de saumon', 'œufs de saumon', 'oeufs de poisson', 'œufs de poisson',
      'oeufs de lump', 'œufs de lump', 'poutargue'
    ]
  },
  {
    key: 'raw-meat',
    keywords: ['viande crue', 'tartare', 'carpaccio', 'viande hachee crue'],
    // « sauce tartare » : aucune viande crue.
    excludePhrases: ['sauce tartare', 'tartare sauce']
  },
  { key: 'raw-egg', keywords: ['oeuf cru', 'oeufs crus', 'œuf cru', 'œufs crus', 'raw egg'] },
  {
    key: 'raw-shellfish',
    keywords: ['coquillages crus', 'coquillage cru', 'huitre crue', 'huitres crues', 'fruits de mer crus']
  },
  {
    key: 'sprouts',
    keywords: ['graines germees', 'germes crus', 'pousses crues', 'luzerne', 'alfalfa']
  },
  // --- À LIMITER (warn) ----------------------------------------------------
  {
    key: 'mercury-fish',
    level: 'warn',
    keywords: ['espadon', 'requin', 'marlin', 'thon', 'lamproie', 'siki', 'swordfish', 'shark', 'tuna']
  },
  {
    key: 'liver',
    level: 'warn',
    keywords: ['foie', 'abats', 'boudin', 'ris de veau', 'rognons', 'liver']
  },
  {
    key: 'caffeine',
    level: 'warn',
    keywords: ['cafeine', 'caffeine', 'guarana', 'boisson energisante', 'energy drink'],
    excludePhrases: ['sans cafeine', 'sans caffeine', 'decafeine', 'caffeine-free', 'decaffeinated']
  },
  { key: 'licorice', level: 'warn', keywords: ['reglisse', 'liquorice', 'licorice'] }
];
export const PREGNANCY_RISK_KEYS = PREGNANCY_RISKS.map((r) => r.key);

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
  // Ingrédients personnalisés : mots-clés libres saisis par l'utilisateur (hors liste).
  customAvoidFoods: string[];
  vegetarian: boolean;
  vegan: boolean;
  pregnant: boolean; // grossesse : alerte sur les aliments à risque (PREGNANCY_RISKS)
  celiac: boolean; // maladie cœliaque : évitement STRICT du gluten (traces incluses)
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
  return { allergens: [], avoidFoods: [], customAvoidFoods: [], vegetarian: false, vegan: false, pregnant: false, celiac: false, thresholds: {} };
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
        customAvoidFoods: Array.isArray(p?.customAvoidFoods) ? p.customAvoidFoods : [],
        vegetarian: !!p?.vegetarian,
        vegan: !!p?.vegan,
        pregnant: !!p?.pregnant,
        celiac: !!p?.celiac,
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
          customAvoidFoods: Array.isArray(raw.customAvoidFoods) ? raw.customAvoidFoods : [],
          vegetarian: !!raw.vegetarian,
          vegan: !!raw.vegan,
          pregnant: !!raw.pregnant,
          celiac: !!raw.celiac,
          thresholds: raw.thresholds && typeof raw.thresholds === 'object' ? raw.thresholds : {}
        }
      ],
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now()
    };
  }

  return emptyDietaryProfile();
}
