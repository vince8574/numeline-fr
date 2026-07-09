// Détection : compare un produit (données Open Food Facts) au profil alimentaire
// MULTI-PERSONNES et renvoie un résultat PAR PERSONNE (compatible ✅ ou problème
// ❌ avec la raison), en plus des alertes agrégées. Fonction PURE (aucun réseau,
// aucun coût IA) → testable et rapide, appelée à l'affichage d'une fiche produit.

import {
  AVOID_FOODS,
  ALLERGEN_INGREDIENT_KEYWORDS,
  PREGNANCY_RISKS,
  type AllergenKey,
  type DietaryProfile,
  type DietaryPerson,
  type NutrientKey
} from './dietaryProfile';

// Données produit nécessaires à la détection (peuplées par le service produit OFF).
export type ProductDietaryData = {
  productName?: string; // nom/titre du produit (ex. "Carpaccio de bœuf")
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
  // aliment à éviter ; 'diet' = régime (végé/végan) ; 'nutrient' = seuil dépassé ;
  // 'pregnancy' = aliment à risque grossesse.
  type: 'allergen' | 'trace' | 'avoidFood' | 'diet' | 'nutrient' | 'pregnancy';
  key: string; // clé allergène / aliment / nutriment / risque, ou 'vegetarian'/'vegan'
  value?: number; // pour 'nutrient' : la valeur /100 g
  threshold?: number; // pour 'nutrient' : le seuil (si commun à toutes les personnes concernées)
  ambiguous?: boolean; // présence probable mais non certaine (ex. gélatine) → "à vérifier"
  personIds: string[]; // ids des personnes concernées (mapping robuste)
  persons: string[]; // prénoms des personnes concernées (affichage)
  everyone: boolean; // true si TOUTE la famille (>1 personne) est concernée
};

export type DietaryCheckStatus = 'danger' | 'warn' | 'ok' | 'unknown';

// Résultat pour UNE personne (pour l'affichage « Maman : ❌ … / Papa : ✅ »).
export type PersonResult = {
  id: string;
  name: string;
  status: DietaryCheckStatus;
  warnings: DietaryWarning[];
};

export type DietaryCheckResult = {
  status: DietaryCheckStatus;
  warnings: DietaryWarning[];
  perPerson: PersonResult[];
  // true si le profil a des critères mais que la donnée produit manque pour vérifier.
  dataMissing: boolean;
  // true s'il y a plusieurs personnes → l'affichage détaille QUI est concerné.
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

const isWordChar = (c: string) => /[a-z0-9]/.test(c);

// Matching en MOT ENTIER (le haystack et le mot-clé sont déjà normalisés) :
// - début de mot strict : « ham » ne matche plus « cHAMpignon », « ethyl » ne
//   matcherait plus « mETHYLcellulose », « rum » ne matche plus « cRUMble » ;
// - fin de mot avec pluriel toléré (s/x) : « jambon » matche « jambons »,
//   « vin » matche « vins » mais plus « VINaigre ».
// Les mots-clés multi-mots (« fruits de mer », « lait cru ») marchent tels quels.
function hasWholeKeyword(haystack: string, keyword: string): boolean {
  const needle = normalize(keyword).trim();
  if (!needle) return false;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    const before = i > 0 ? haystack[i - 1] : '';
    let end = i + needle.length;
    if (haystack[end] === 's' || haystack[end] === 'x') end += 1; // pluriel
    const after = end < haystack.length ? haystack[end] : '';
    if ((!before || !isWordChar(before)) && (!after || !isWordChar(after))) return true;
    i = haystack.indexOf(needle, i + 1);
  }
  return false;
}

// Retire les phrases d'exclusion du texte avant matching (ex. « vinaigre
// d'alcool » ne doit pas compter comme de l'alcool).
function stripPhrases(haystack: string, phrases?: string[]): string {
  if (!phrases || phrases.length === 0) return haystack;
  let out = haystack;
  for (const p of phrases) out = out.split(normalize(p)).join(' ');
  return out;
}

export function checkProductAgainstProfile(
  product: ProductDietaryData,
  profile: DietaryProfile
): DietaryCheckResult {
  const people: DietaryPerson[] = profile.people ?? [];
  const total = people.length;

  const allergensTags = (product.allergensTags ?? []).map(stripEn);
  const tracesTags = (product.tracesTags ?? []).map(stripEn);
  const analysis = product.ingredientsAnalysisTags ?? [];
  const nutriments = product.nutriments ?? {};
  const ingredientsHaystack = normalize(
    [product.ingredientsText ?? '', ...(product.ingredientsTags ?? [])].join(' ')
  );
  // Pour la GROSSESSE uniquement, on inclut le NOM du produit : les plats à risque
  // (carpaccio, tartare, sushi, saumon fumé…) sont nommés dans le TITRE, pas dans la
  // liste d'ingrédients (« viande de bœuf » sans « cru »). On ne l'ajoute PAS aux
  // vérifs allergènes/aliments (faux positifs type « chips saveur bacon »).
  const pregnancyHaystack = product.productName
    ? normalize([product.productName, product.ingredientsText ?? '', ...(product.ingredientsTags ?? [])].join(' '))
    : ingredientsHaystack;

  // Fabrique la partie « qui est concerné » d'une alerte.
  const who = (concerned: DietaryPerson[]) => ({
    personIds: concerned.map((p) => p.id),
    persons: concerned.map((p) => p.name),
    everyone: total > 1 && concerned.length === total
  });

  const productHasAllergen = (a: AllergenKey): boolean => {
    if (allergensTags.includes(a)) return true;
    const kws = ALLERGEN_INGREDIENT_KEYWORDS[a];
    return kws ? kws.some((kw) => hasWholeKeyword(ingredientsHaystack, kw)) : false;
  };
  const foodMatch = (key: string): 'hard' | 'ambiguous' | null => {
    const def = AVOID_FOODS.find((f) => f.key === key);
    if (!def) return null;
    // Les phrases d'exclusion (ex. « vinaigre d'alcool ») sont retirées AVANT le
    // matching pour ne pas déclencher à tort.
    const hay = stripPhrases(ingredientsHaystack, def.excludePhrases);
    if (def.keywords.some((kw) => hasWholeKeyword(hay, kw))) return 'hard';
    if (def.ambiguousKeywords?.some((kw) => hasWholeKeyword(hay, kw))) return 'ambiguous';
    return null;
  };

  const warnings: DietaryWarning[] = [];

  // 1) Allergènes -----------------------------------------------------------
  const allAllergenKeys = new Set<AllergenKey>();
  people.forEach((p) => p.allergens.forEach((a) => allAllergenKeys.add(a)));
  for (const a of allAllergenKeys) {
    const concerned = people.filter((p) => p.allergens.includes(a));
    if (concerned.length === 0) continue;
    if (productHasAllergen(a)) {
      warnings.push({ level: 'danger', type: 'allergen', key: a, ...who(concerned) });
    } else if (tracesTags.includes(a)) {
      warnings.push({ level: 'warn', type: 'trace', key: a, ...who(concerned) });
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
    warnings.push({ level: ambiguous ? 'warn' : 'danger', type: 'avoidFood', key, ambiguous, ...who(concerned) });
  }

  // 3) Régime (végétarien / végan) ------------------------------------------
  const vegetarians = people.filter((p) => p.vegetarian);
  if (vegetarians.length > 0) {
    if (analysis.includes('en:non-vegetarian'))
      warnings.push({ level: 'danger', type: 'diet', key: 'vegetarian', ...who(vegetarians) });
    else if (analysis.includes('en:maybe-vegetarian'))
      warnings.push({ level: 'warn', type: 'diet', key: 'vegetarian', ...who(vegetarians) });
  }
  const vegans = people.filter((p) => p.vegan);
  if (vegans.length > 0) {
    if (analysis.includes('en:non-vegan'))
      warnings.push({ level: 'danger', type: 'diet', key: 'vegan', ...who(vegans) });
    else if (analysis.includes('en:maybe-vegan'))
      warnings.push({ level: 'warn', type: 'diet', key: 'vegan', ...who(vegans) });
  }

  // 4) Grossesse : aliments à risque ----------------------------------------
  const pregnant = people.filter((p) => p.pregnant);
  if (pregnant.length > 0) {
    for (const risk of PREGNANCY_RISKS) {
      // Exclusions (ex. « sauce tartare » ≠ tartare de viande crue). Haystack incluant
      // le nom du produit (carpaccio/tartare/sushi sont nommés, pas dans les ingrédients).
      const hay = stripPhrases(pregnancyHaystack, risk.excludePhrases);
      if (risk.keywords.some((kw) => hasWholeKeyword(hay, kw))) {
        warnings.push({ level: risk.level ?? 'danger', type: 'pregnancy', key: risk.key, ...who(pregnant) });
      }
    }
    // Alcool : automatiquement à éviter pour les femmes enceintes, sans avoir à
    // cocher « alcool » à part. Réutilise la définition alcool (+ ses exclusions
    // « vinaigre d'alcool », « levure de bière »… → pas de faux positif).
    if (foodMatch('alcohol') === 'hard') {
      warnings.push({ level: 'danger', type: 'pregnancy', key: 'alcohol', ...who(pregnant) });
    }
  }

  // 5) Seuils nutritionnels /100 g (seuil propre à chaque personne) ---------
  let couldCheckNutrients = false;
  for (const key of ['sugars', 'fat', 'saturated-fat', 'salt'] as NutrientKey[]) {
    const value = nutriments[`${key}_100g`];
    const interested = people.filter((p) => p.thresholds[key]?.enabled);
    if (interested.length === 0) continue;
    if (typeof value !== 'number') continue;
    couldCheckNutrients = true;
    const concerned = interested.filter((p) => value > (p.thresholds[key] as { maxPer100g: number }).maxPer100g);
    if (concerned.length === 0) continue;
    const ths = concerned.map((p) => (p.thresholds[key] as { maxPer100g: number }).maxPer100g);
    const commonThreshold = ths.every((x) => x === ths[0]) ? ths[0] : undefined;
    warnings.push({ level: 'warn', type: 'nutrient', key, value, threshold: commonThreshold, ...who(concerned) });
  }

  // --- Couverture des données ----------------------------------------------
  const personHasIngredientCriteria = (p: DietaryPerson) =>
    p.allergens.length > 0 || p.avoidFoods.length > 0 || p.vegetarian || p.vegan || p.pregnant;
  const personHasNutrientCriteria = (p: DietaryPerson) =>
    Object.values(p.thresholds).some((t) => t?.enabled);
  const personHasCriteria = (p: DietaryPerson) =>
    personHasIngredientCriteria(p) || personHasNutrientCriteria(p);

  const hasIngredientCriteria = people.some(personHasIngredientCriteria);
  const couldCheckIngredients =
    allergensTags.length > 0 ||
    tracesTags.length > 0 ||
    analysis.length > 0 ||
    ingredientsHaystack.trim().length > 0;
  const hasNutrientCriteria = people.some(personHasNutrientCriteria);
  const dataMissing =
    (hasIngredientCriteria && !couldCheckIngredients) ||
    (hasNutrientCriteria && !couldCheckNutrients);

  // --- Résultat par personne -----------------------------------------------
  const perPerson: PersonResult[] = people.map((person) => {
    const mine = warnings.filter((w) => w.personIds.includes(person.id));
    let st: DietaryCheckStatus;
    if (mine.some((w) => w.level === 'danger')) st = 'danger';
    else if (mine.some((w) => w.level === 'warn')) st = 'warn';
    else if (dataMissing && personHasCriteria(person)) st = 'unknown';
    else st = 'ok';
    return { id: person.id, name: person.name, status: st, warnings: mine };
  });

  // --- Statut global -------------------------------------------------------
  let status: DietaryCheckStatus;
  if (warnings.some((w) => w.level === 'danger')) status = 'danger';
  else if (warnings.some((w) => w.level === 'warn')) status = 'warn';
  else if (dataMissing) status = 'unknown';
  else if (hasIngredientCriteria || hasNutrientCriteria) status = 'ok';
  else status = 'unknown';

  return { status, warnings, perPerson, dataMissing, multiPerson: total > 1 };
}
