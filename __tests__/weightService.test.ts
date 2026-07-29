// Module « Objectif poids » — formules (Mifflin-St Jeor → TDEE → objectif),
// garde-fous de sécurité (planchers, IMC cible bas) et calcul kcal depuis les
// nutriments Open Food Facts.
import {
  ACTIVITY_FACTORS,
  bmr,
  tdee,
  dailyCalorieDelta,
  goalFromWeights,
  bmi,
  calorieTarget,
  estimatedWeeks,
  kcalFromNutriments,
  macrosFromNutriments,
  sumTotals,
  movingAverage,
  todayISO,
  type BodyProfile,
  type FoodEntry
} from '../src/services/weightService';

describe('BMR — Mifflin-St Jeor', () => {
  test('homme 80 kg / 180 cm / 30 ans', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });
  test('femme 60 kg / 165 cm / 30 ans', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 → 1320
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBe(1320);
  });
});

describe('TDEE', () => {
  test('sédentaire = BMR × 1.2', () => {
    expect(tdee(1780, 'sedentary')).toBe(Math.round(1780 * ACTIVITY_FACTORS.sedentary));
  });
});

describe('déficit / objectif', () => {
  test('0.5 kg/sem ≈ 550 kcal/j', () => {
    expect(dailyCalorieDelta(0.5)).toBe(Math.round((0.5 * 7700) / 7)); // 550
  });

  test('objectif de perte = TDEE − déficit', () => {
    const profile: BodyProfile = {
      sex: 'male',
      birthYear: new Date().getFullYear() - 30,
      heightCm: 180,
      startWeightKg: 90,
      targetWeightKg: 80,
      activity: 'sedentary',
      goal: 'lose',
      paceKgPerWeek: 0.5,
      createdAt: 0
    };
    const r = calorieTarget(profile, 90);
    expect(r.tdee).toBeGreaterThan(r.calorieTarget);
    expect(r.calorieTarget).toBe(r.tdee - dailyCalorieDelta(0.5));
    expect(r.floored).toBe(false);
  });

  test('plancher de sécurité relève un objectif trop bas (femme < 1200)', () => {
    const profile: BodyProfile = {
      sex: 'female',
      birthYear: new Date().getFullYear() - 25,
      heightCm: 150,
      startWeightKg: 50,
      targetWeightKg: 45,
      activity: 'sedentary',
      goal: 'lose',
      paceKgPerWeek: 0.75,
      createdAt: 0
    };
    const r = calorieTarget(profile, 50);
    expect(r.calorieTarget).toBeGreaterThanOrEqual(1200);
    expect(r.floored).toBe(true);
    expect(r.warnings).toContain('weight.warnFloor');
  });

  test('IMC cible < 18.5 déclenche un avertissement', () => {
    const profile: BodyProfile = {
      sex: 'female',
      birthYear: new Date().getFullYear() - 30,
      heightCm: 170,
      startWeightKg: 60,
      targetWeightKg: 50, // IMC ≈ 17.3
      activity: 'moderate',
      goal: 'lose',
      paceKgPerWeek: 0.5,
      createdAt: 0
    };
    const r = calorieTarget(profile, 60);
    expect(r.warnings).toContain('weight.warnLowBmi');
  });
});

describe('goalFromWeights / bmi / estimatedWeeks', () => {
  test('déduction de l’objectif', () => {
    expect(goalFromWeights(90, 80)).toBe('lose');
    expect(goalFromWeights(70, 75)).toBe('gain');
    expect(goalFromWeights(70, 70)).toBe('maintain');
  });
  test('IMC', () => {
    expect(Math.round(bmi(80, 180))).toBe(25); // 80 / 1.8² = 24.69
  });
  test('semaines estimées', () => {
    expect(estimatedWeeks(90, 80, 0.5)).toBe(20);
    expect(estimatedWeeks(80, 80, 0.5)).toBe(0);
  });
});

describe('kcal depuis Open Food Facts', () => {
  test('energy-kcal_100g × portion', () => {
    expect(kcalFromNutriments({ 'energy-kcal_100g': 250 }, 200)).toBe(500);
  });
  test('repli kJ → kcal', () => {
    // 1046 kJ / 4.184 = 250 kcal /100g → 200g = 500
    expect(kcalFromNutriments({ 'energy_100g': 1046 }, 200)).toBe(500);
  });
  test('aucune donnée → null', () => {
    expect(kcalFromNutriments({}, 200)).toBeNull();
    expect(kcalFromNutriments({ 'energy-kcal_100g': 250 }, 0)).toBeNull();
  });
  test('macros mises à l’échelle', () => {
    const m = macrosFromNutriments(
      { proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 },
      50
    );
    expect(m).toEqual({ protein_g: 5, carbs_g: 10, fat_g: 3 });
  });
});

describe('agrégats journal', () => {
  const mk = (kcal: number, p = 0): FoodEntry => ({
    id: String(kcal),
    date: '2026-07-29',
    meal: 'lunch',
    name: 'x',
    quantityG: 100,
    kcal,
    protein_g: p,
    createdAt: 0
  });
  test('somme des totaux', () => {
    const total = sumTotals([mk(200, 10), mk(300, 20)]);
    expect(total.kcal).toBe(500);
    expect(total.protein_g).toBe(30);
  });
  test('moyenne mobile lisse la série', () => {
    const avg = movingAverage([80, 82, 78, 80], 3);
    expect(avg[0]).toBe(80);
    expect(avg[3]).toBeCloseTo((82 + 78 + 80) / 3, 5);
  });
});

describe('dates', () => {
  test('todayISO format', () => {
    expect(todayISO(new Date(2026, 6, 5))).toBe('2026-07-05');
  });
});
