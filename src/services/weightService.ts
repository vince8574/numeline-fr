/**
 * weightService — moteur de calcul du module « Objectif poids » (Phase 1).
 *
 * 100 % pur (aucune dépendance React / réseau) → testable et réutilisable tel
 * quel par les deux apps (Numeline US et NumelineFR).
 *
 * Formules standard et éprouvées :
 *  - Métabolisme de base : Mifflin-St Jeor.
 *  - Dépense totale (TDEE) : BMR × facteur d'activité.
 *  - Objectif calorique : TDEE ∓ (rythme kg/sem × 7700 / 7).
 *
 * Rappel produit : ces valeurs sont des ESTIMATIONS à titre indicatif, elles ne
 * remplacent pas l'avis d'un professionnel de santé (cf. garde-fous plus bas).
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WeightGoal = 'lose' | 'maintain' | 'gain';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active'
];

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

export const PACE_OPTIONS = [0.25, 0.5, 0.75] as const;
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// 1 kg de masse grasse ≈ 7700 kcal.
const KCAL_PER_KG = 7700;
// Planchers caloriques de sécurité (adultes en bonne santé). Sous ces seuils, on
// n'affiche jamais d'objectif plus bas : garde-fou troubles alimentaires.
const FEMALE_FLOOR_KCAL = 1200;
const MALE_FLOOR_KCAL = 1500;
// En-deçà de cet IMC cible, on refuse l'objectif et on renvoie vers un pro.
const MIN_SAFE_BMI = 18.5;
// Rythme maximal raisonnable.
export const MAX_PACE_KG_PER_WEEK = 1;

// --- Profil corporel & entrées journal -------------------------------------

export type BodyProfile = {
  sex: 'male' | 'female';
  // Année de naissance : on dérive l'âge (pas de stockage d'âge figé qui vieillit mal).
  birthYear: number;
  heightCm: number;
  startWeightKg: number;
  targetWeightKg: number;
  activity: ActivityLevel;
  goal: WeightGoal;
  paceKgPerWeek: number; // 0.25 | 0.5 | 0.75
  createdAt: number;
};

export type WeightEntry = {
  date: string; // 'YYYY-MM-DD' (jour local) — une pesée par jour (idempotent)
  weightKg: number;
  createdAt: number;
};

export type FoodEntry = {
  id: string;
  date: string; // 'YYYY-MM-DD'
  meal: Meal;
  name: string;
  brand?: string;
  barcode?: string;
  quantityG: number;
  kcal: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  nutriscore?: string; // repris d'OFF (affichage)
  nova?: number;
  createdAt: number;
};

export type Macros = { protein_g: number; carbs_g: number; fat_g: number };

export type TargetResult = {
  /** Objectif calorique quotidien retenu (après planchers). */
  calorieTarget: number;
  /** Objectif brut avant application du plancher. */
  rawTarget: number;
  tdee: number;
  bmr: number;
  /** true si le plancher de sécurité a relevé l'objectif. */
  floored: boolean;
  /** Clés i18n d'avertissements à afficher (ex. IMC cible trop bas). */
  warnings: string[];
};

// --- Dates ------------------------------------------------------------------

/** Jour local au format ISO 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Âge courant dérivé de l'année de naissance. */
export function currentAge(birthYear: number, now: Date = new Date()): number {
  return Math.max(0, now.getFullYear() - birthYear);
}

// --- Métabolisme ------------------------------------------------------------

/** Métabolisme de base (kcal/j) — Mifflin-St Jeor. */
export function bmr(input: {
  sex: 'male' | 'female';
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round(base + (input.sex === 'male' ? 5 : -161));
}

/** Dépense énergétique totale (kcal/j) = BMR × facteur d'activité. */
export function tdee(bmrValue: number, activity: ActivityLevel): number {
  return Math.round(bmrValue * ACTIVITY_FACTORS[activity]);
}

/** Déficit (ou surplus) calorique quotidien pour un rythme donné (kcal/j). */
export function dailyCalorieDelta(paceKgPerWeek: number): number {
  return Math.round((paceKgPerWeek * KCAL_PER_KG) / 7);
}

/** Déduit l'objectif (perte / maintien / prise) du poids de départ vs cible. */
export function goalFromWeights(startWeightKg: number, targetWeightKg: number): WeightGoal {
  if (targetWeightKg < startWeightKg - 0.5) return 'lose';
  if (targetWeightKg > startWeightKg + 0.5) return 'gain';
  return 'maintain';
}

/** Indice de masse corporelle. */
export function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * Objectif calorique quotidien + garde-fous.
 * @param currentWeightKg poids courant (dernière pesée, sinon poids de départ).
 */
export function calorieTarget(profile: BodyProfile, currentWeightKg: number): TargetResult {
  const age = currentAge(profile.birthYear);
  const bmrValue = bmr({
    sex: profile.sex,
    weightKg: currentWeightKg,
    heightCm: profile.heightCm,
    age
  });
  const tdeeValue = tdee(bmrValue, profile.activity);
  const delta = dailyCalorieDelta(profile.paceKgPerWeek);

  let rawTarget = tdeeValue;
  if (profile.goal === 'lose') rawTarget = tdeeValue - delta;
  else if (profile.goal === 'gain') rawTarget = tdeeValue + delta;

  const floor = profile.sex === 'male' ? MALE_FLOOR_KCAL : FEMALE_FLOOR_KCAL;
  const warnings: string[] = [];

  let calorie = Math.round(rawTarget);
  let floored = false;
  if (profile.goal === 'lose' && calorie < floor) {
    calorie = floor;
    floored = true;
    warnings.push('weight.warnFloor');
  }

  // IMC cible dangereusement bas → on avertit (l'UI peut bloquer la validation).
  const targetBmi = bmi(profile.targetWeightKg, profile.heightCm);
  if (targetBmi > 0 && targetBmi < MIN_SAFE_BMI) {
    warnings.push('weight.warnLowBmi');
  }

  if (profile.paceKgPerWeek > MAX_PACE_KG_PER_WEEK) {
    warnings.push('weight.warnPace');
  }

  return {
    calorieTarget: calorie,
    rawTarget: Math.round(rawTarget),
    tdee: tdeeValue,
    bmr: bmrValue,
    floored,
    warnings
  };
}

/** Nombre de semaines estimé pour atteindre la cible au rythme choisi. */
export function estimatedWeeks(
  currentWeightKg: number,
  targetWeightKg: number,
  paceKgPerWeek: number
): number {
  if (paceKgPerWeek <= 0) return 0;
  const diff = Math.abs(currentWeightKg - targetWeightKg);
  return Math.ceil(diff / paceKgPerWeek);
}

/** Date d'atteinte estimée (ISO 'YYYY-MM-DD'), ou null si maintien. */
export function estimatedTargetDate(
  currentWeightKg: number,
  targetWeightKg: number,
  paceKgPerWeek: number,
  from: Date = new Date()
): string | null {
  const weeks = estimatedWeeks(currentWeightKg, targetWeightKg, paceKgPerWeek);
  if (weeks <= 0) return null;
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + weeks * 7);
  return todayISO(d);
}

// --- Calcul kcal depuis Open Food Facts -------------------------------------

type Nutriments = Record<string, number | undefined> | undefined;

function per100(nutriments: Nutriments, key: string): number | undefined {
  const v = nutriments?.[key];
  return typeof v === 'number' && isFinite(v) ? v : undefined;
}

/**
 * kcal d'une portion à partir des nutriments OFF (/100 g).
 * Repli kJ → kcal si `energy-kcal_100g` absent. Renvoie null si aucune donnée.
 */
export function kcalFromNutriments(nutriments: Nutriments, quantityG: number): number | null {
  if (!(quantityG > 0)) return null;
  const kcal100 = per100(nutriments, 'energy-kcal_100g');
  if (kcal100 !== undefined) return Math.round((kcal100 * quantityG) / 100);
  const kj100 = per100(nutriments, 'energy_100g') ?? per100(nutriments, 'energy-kj_100g');
  if (kj100 !== undefined) return Math.round((kj100 / 4.184) * (quantityG / 100));
  return null;
}

/** Macros d'une portion à partir des nutriments OFF (/100 g). */
export function macrosFromNutriments(nutriments: Nutriments, quantityG: number): Partial<Macros> {
  const scale = quantityG / 100;
  const out: Partial<Macros> = {};
  const p = per100(nutriments, 'proteins_100g');
  const c = per100(nutriments, 'carbohydrates_100g');
  const f = per100(nutriments, 'fat_100g');
  if (p !== undefined) out.protein_g = Math.round(p * scale);
  if (c !== undefined) out.carbs_g = Math.round(c * scale);
  if (f !== undefined) out.fat_g = Math.round(f * scale);
  return out;
}

// --- Agrégats journal -------------------------------------------------------

export type DailyTotals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export function sumTotals(entries: FoodEntry[]): DailyTotals {
  return entries.reduce<DailyTotals>(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0)
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

/**
 * Moyenne mobile (fenêtre glissante) — lisse le bruit hydrique des pesées.
 * Renvoie une valeur par point d'entrée (moyenne des ≤window points précédents).
 */
export function movingAverage(values: number[], window = 7): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}
