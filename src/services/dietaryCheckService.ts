// Détection : compare un produit (données Open Food Facts) au profil alimentaire
// de l'utilisateur et renvoie la liste des alertes. Fonction PURE (aucun réseau,
// aucun coût IA) → testable et rapide, appelée à l'affichage d'une fiche produit.

import { AVOID_FOODS, type DietaryProfile, type NutrientKey } from './dietaryProfile';

// Données produit nécessaires à la détection (peuplées par openFoodFactsService).
export type ProductDietaryData = {
  allergensTags?: string[]; // ex. ["en:milk","en:nuts"]
  tracesTags?: string[]; // "peut contenir"
  ingredientsText?: string; // texte brut (FR de préférence)
  ingredientsTags?: string[]; // ex. ["en:pork"] (parfois localisé)
  ingredientsAnalysisTags?: string[]; // ex. ["en:non-vegetarian","en:vegan"]
  nutriments?: Record<string, number | undefined>; // sugars_100g, fat_100g, salt_100g...
};

export type DietaryWarningLevel = 'danger' | 'warn' | 'info';

export type DietaryWarning = {
  level: DietaryWarningLevel;
  // 'allergen' = allergène présent ; 'trace' = "peut contenir" ; 'avoidFood' =
  // aliment à éviter ; 'diet' = régime (végé/végan) ; 'nutrient' = seuil dépassé.
  type: 'allergen' | 'trace' | 'avoidFood' | 'diet' | 'nutrient';
  key: string; // clé allergène / aliment / nutriment, ou 'vegetarian'/'vegan'
  value?: number; // pour 'nutrient' : la valeur /100 g
  threshold?: number; // pour 'nutrient' : le seuil configuré
};

export type DietaryCheckStatus = 'danger' | 'warn' | 'ok' | 'unknown';

export type DietaryCheckResult = {
  status: DietaryCheckStatus;
  warnings: DietaryWarning[];
  // true si le profil a des critères mais que la donnée produit manque pour
  // les vérifier → on ne rassure PAS à tort ("information indisponible").
  dataMissing: boolean;
};

// Minuscule + sans accents, pour une recherche de mots-clés robuste.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function stripEn(tag: string): string {
  return tag.replace(/^[a-z]{2}:/, '');
}

export function checkProductAgainstProfile(
  product: ProductDietaryData,
  profile: DietaryProfile
): DietaryCheckResult {
  const warnings: DietaryWarning[] = [];

  const allergensTags = (product.allergensTags ?? []).map(stripEn);
  const tracesTags = (product.tracesTags ?? []).map(stripEn);
  const analysis = product.ingredientsAnalysisTags ?? [];
  const nutriments = product.nutriments ?? {};

  // Foin d'ingrédients normalisé (texte + tags) pour la détection d'aliments.
  const ingredientsHaystack = normalize(
    [product.ingredientsText ?? '', ...(product.ingredientsTags ?? [])].join(' ')
  );

  // 1) Allergènes -----------------------------------------------------------
  for (const a of profile.allergens) {
    if (allergensTags.includes(a)) {
      warnings.push({ level: 'danger', type: 'allergen', key: a });
    } else if (tracesTags.includes(a)) {
      warnings.push({ level: 'warn', type: 'trace', key: a });
    }
  }

  // 2) Aliments à éviter ----------------------------------------------------
  for (const key of profile.avoidFoods) {
    const def = AVOID_FOODS.find((f) => f.key === key);
    if (!def) continue;
    const found = def.keywords.some((kw) => ingredientsHaystack.includes(normalize(kw)));
    if (found) {
      warnings.push({ level: def.ambiguous ? 'warn' : 'danger', type: 'avoidFood', key });
    }
  }

  // 3) Régime (végétarien / végan) ------------------------------------------
  if (profile.vegetarian) {
    if (analysis.includes('en:non-vegetarian')) {
      warnings.push({ level: 'danger', type: 'diet', key: 'vegetarian' });
    } else if (analysis.includes('en:maybe-vegetarian')) {
      warnings.push({ level: 'warn', type: 'diet', key: 'vegetarian' });
    }
  }
  if (profile.vegan) {
    if (analysis.includes('en:non-vegan')) {
      warnings.push({ level: 'danger', type: 'diet', key: 'vegan' });
    } else if (analysis.includes('en:maybe-vegan')) {
      warnings.push({ level: 'warn', type: 'diet', key: 'vegan' });
    }
  }

  // 4) Seuils nutritionnels /100 g ------------------------------------------
  let couldCheckNutrients = false;
  (Object.keys(profile.thresholds) as NutrientKey[]).forEach((key) => {
    const t = profile.thresholds[key];
    if (!t?.enabled) return;
    const value = nutriments[`${key}_100g`];
    if (typeof value === 'number') {
      couldCheckNutrients = true;
      if (value > t.maxPer100g) {
        warnings.push({ level: 'warn', type: 'nutrient', key, value, threshold: t.maxPer100g });
      }
    }
  });

  // --- Couverture des données ----------------------------------------------
  const hasIngredientCriteria =
    profile.allergens.length > 0 ||
    profile.avoidFoods.length > 0 ||
    profile.vegetarian ||
    profile.vegan;
  const couldCheckIngredients =
    allergensTags.length > 0 ||
    tracesTags.length > 0 ||
    analysis.length > 0 ||
    ingredientsHaystack.trim().length > 0;

  const hasNutrientCriteria = Object.values(profile.thresholds).some((t) => t?.enabled);

  const dataMissing =
    (hasIngredientCriteria && !couldCheckIngredients) ||
    (hasNutrientCriteria && !couldCheckNutrients);

  // --- Statut global -------------------------------------------------------
  let status: DietaryCheckStatus;
  if (warnings.some((w) => w.level === 'danger')) {
    status = 'danger';
  } else if (warnings.some((w) => w.level === 'warn')) {
    status = 'warn';
  } else if (dataMissing) {
    status = 'unknown';
  } else if (hasIngredientCriteria || hasNutrientCriteria) {
    status = 'ok';
  } else {
    status = 'unknown'; // profil vide : rien à vérifier
  }

  return { status, warnings, dataMissing };
}
