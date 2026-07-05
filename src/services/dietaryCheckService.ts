// Détection : compare un produit (données Open Food Facts) au profil alimentaire
// MULTI-PERSONNES et renvoie les alertes en indiquant QUI est concerné (une ou
// plusieurs personnes, ou toute la famille). Fonction PURE (aucun réseau, aucun
// coût IA) → testable et rapide, appelée à l'affichage d'une fiche produit.

import {
  AVOID_FOODS,
  ALLERGEN_INGREDIENT_KEYWORDS,
  type AllergenKey,
  type DietaryProfile,
  type DietaryPerson,
  type NutrientKey
} from './dietaryProfile';

// Données produit nécessaires à la détection (peuplées par le service produit OFF).
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
  threshold?: number; // pour 'nutrient' : le seuil (si commun à toutes les personnes concernées)
  ambiguous?: boolean; // présence probable mais non certaine (ex. gélatine) → "à vérifier"
  persons: string[]; // prénoms des personnes concernées
  everyone: boolean; // true si TOUTE la famille (>1 personne) est concernée
};

export type DietaryCheckStatus = 'danger' | 'warn' | 'ok' | 'unknown';

export type DietaryCheckResult = {
  status: DietaryCheckStatus;
  warnings: DietaryWarning[];
  // true si le profil a des critères mais que la donnée produit manque pour
  // les vérifier → on ne rassure PAS à tort ("information indisponible").
  dataMissing: boolean;
  // true s'il y a plusieurs personnes → le bandeau affiche QUI est concerné.
  multiPerson: boolean;
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
  const people: DietaryPerson[] = profile.people ?? [];
  const total = people.length;
  const nameOf = (p: DietaryPerson) => p.name;
  const everyoneOf = (persons: DietaryPerson[]) => total > 1 && persons.length === total;

  const allergensTags = (product.allergensTags ?? []).map(stripEn);
  const tracesTags = (product.tracesTags ?? []).map(stripEn);
  const analysis = product.ingredientsAnalysisTags ?? [];
  const nutriments = product.nutriments ?? {};

  // Foin d'ingrédients normalisé (texte + tags) pour la détection.
  const ingredientsHaystack = normalize(
    [product.ingredientsText ?? '', ...(product.ingredientsTags ?? [])].join(' ')
  );

  // --- Faits produit (indépendants des personnes) --------------------------
  const productHasAllergen = (a: AllergenKey): boolean => {
    if (allergensTags.includes(a)) return true;
    const kws = ALLERGEN_INGREDIENT_KEYWORDS[a];
    return kws ? kws.some((kw) => ingredientsHaystack.includes(normalize(kw))) : false;
  };
  const productTraceAllergen = (a: AllergenKey): boolean => tracesTags.includes(a);

  // Aliment à éviter : 'hard' (mot-clé direct), 'ambiguous' (mot-clé incertain), ou null.
  const foodMatch = (key: string): 'hard' | 'ambiguous' | null => {
    const def = AVOID_FOODS.find((f) => f.key === key);
    if (!def) return null;
    if (def.keywords.some((kw) => ingredientsHaystack.includes(normalize(kw)))) return 'hard';
    if (def.ambiguousKeywords?.some((kw) => ingredientsHaystack.includes(normalize(kw))))
      return 'ambiguous';
    return null;
  };

  const warnings: DietaryWarning[] = [];

  // 1) Allergènes (par clé, agrégé sur les personnes) -----------------------
  const allAllergenKeys = new Set<AllergenKey>();
  people.forEach((p) => p.allergens.forEach((a) => allAllergenKeys.add(a)));
  for (const a of allAllergenKeys) {
    const concerned = people.filter((p) => p.allergens.includes(a));
    if (concerned.length === 0) continue;
    if (productHasAllergen(a)) {
      warnings.push({
        level: 'danger',
        type: 'allergen',
        key: a,
        persons: concerned.map(nameOf),
        everyone: everyoneOf(concerned)
      });
    } else if (productTraceAllergen(a)) {
      warnings.push({
        level: 'warn',
        type: 'trace',
        key: a,
        persons: concerned.map(nameOf),
        everyone: everyoneOf(concerned)
      });
    }
  }

  // 2) Aliments à éviter ----------------------------------------------------
  const allFoodKeys = new Set<string>();
  people.forEach((p) => p.avoidFoods.forEach((k) => allFoodKeys.add(k)));
  for (const key of allFoodKeys) {
    const concerned = people.filter((p) => p.avoidFoods.includes(key));
    if (concerned.length === 0) continue;
    const def = AVOID_FOODS.find((f) => f.key === key);
    const m = foodMatch(key);
    if (!m) continue;
    const ambiguous = m === 'ambiguous' || !!def?.ambiguous;
    warnings.push({
      level: ambiguous ? 'warn' : 'danger',
      type: 'avoidFood',
      key,
      ambiguous,
      persons: concerned.map(nameOf),
      everyone: everyoneOf(concerned)
    });
  }

  // 3) Régime (végétarien / végan) ------------------------------------------
  const vegetarians = people.filter((p) => p.vegetarian);
  if (vegetarians.length > 0) {
    if (analysis.includes('en:non-vegetarian')) {
      warnings.push({ level: 'danger', type: 'diet', key: 'vegetarian', persons: vegetarians.map(nameOf), everyone: everyoneOf(vegetarians) });
    } else if (analysis.includes('en:maybe-vegetarian')) {
      warnings.push({ level: 'warn', type: 'diet', key: 'vegetarian', persons: vegetarians.map(nameOf), everyone: everyoneOf(vegetarians) });
    }
  }
  const vegans = people.filter((p) => p.vegan);
  if (vegans.length > 0) {
    if (analysis.includes('en:non-vegan')) {
      warnings.push({ level: 'danger', type: 'diet', key: 'vegan', persons: vegans.map(nameOf), everyone: everyoneOf(vegans) });
    } else if (analysis.includes('en:maybe-vegan')) {
      warnings.push({ level: 'warn', type: 'diet', key: 'vegan', persons: vegans.map(nameOf), everyone: everyoneOf(vegans) });
    }
  }

  // 4) Seuils nutritionnels /100 g (seuil propre à chaque personne) ---------
  let couldCheckNutrients = false;
  for (const key of Object.keys({ sugars: 0, fat: 0, 'saturated-fat': 0, salt: 0 }) as NutrientKey[]) {
    const value = nutriments[`${key}_100g`];
    const interested = people.filter((p) => p.thresholds[key]?.enabled);
    if (interested.length === 0) continue;
    if (typeof value !== 'number') continue;
    couldCheckNutrients = true;
    const concerned = interested.filter((p) => value > (p.thresholds[key] as { maxPer100g: number }).maxPer100g);
    if (concerned.length === 0) continue;
    // Seuil affiché uniquement si commun à toutes les personnes concernées.
    const thresholds = concerned.map((p) => (p.thresholds[key] as { maxPer100g: number }).maxPer100g);
    const commonThreshold = thresholds.every((t) => t === thresholds[0]) ? thresholds[0] : undefined;
    warnings.push({
      level: 'warn',
      type: 'nutrient',
      key,
      value,
      threshold: commonThreshold,
      persons: concerned.map(nameOf),
      everyone: everyoneOf(concerned)
    });
  }

  // --- Couverture des données ----------------------------------------------
  const hasIngredientCriteria = people.some(
    (p) => p.allergens.length > 0 || p.avoidFoods.length > 0 || p.vegetarian || p.vegan
  );
  const couldCheckIngredients =
    allergensTags.length > 0 ||
    tracesTags.length > 0 ||
    analysis.length > 0 ||
    ingredientsHaystack.trim().length > 0;

  const hasNutrientCriteria = people.some((p) =>
    Object.values(p.thresholds).some((t) => t?.enabled)
  );

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

  return { status, warnings, dataMissing, multiPerson: total > 1 };
}
