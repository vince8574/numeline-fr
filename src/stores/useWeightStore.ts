import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid/non-secure';
import {
  calorieTarget,
  goalFromWeights,
  sumTotals,
  todayISO,
  type BodyProfile,
  type DailyTotals,
  type FoodEntry,
  type Meal,
  type TargetResult,
  type WeightEntry
} from '../services/weightService';

// Module « Objectif poids » — état local (AsyncStorage), sur le modèle de
// useDietaryProfileStore. Persistance locale d'abord (offline) ; une synchro
// Firestore (foodLog/{uid}, weightLog/{uid}) pourra se greffer plus tard sans
// changer cette API. Un seul suivi = la personne active (MVP, cf. spec §11).
//
// 100 % calcul local, AUCUNE IA : toutes les valeurs sont dérivées par
// weightService (arithmétique) à partir des saisies et des nutriments OFF.
//
// L'essai gratuit (trialStartedAt) vit ICI pour survivre au redémarrage et
// pousser la reconversion : le hook useWeightAccess en dérive l'accès premium.

type WeightState = {
  body: BodyProfile | null;
  weights: WeightEntry[]; // triées par date croissante
  foods: FoodEntry[];
  // Horodatage de démarrage de l'essai gratuit du module (null = jamais lancé).
  trialStartedAt: number | null;

  // --- Profil corporel ---
  setBody: (patch: Partial<BodyProfile>) => void;
  resetBody: () => void;

  // --- Pesées (une par jour, idempotent sur la date) ---
  addWeight: (weightKg: number, date?: string) => void;
  removeWeight: (date: string) => void;

  // --- Journal alimentaire ---
  addFood: (entry: Omit<FoodEntry, 'id' | 'createdAt'>) => void;
  removeFood: (id: string) => void;

  // --- Essai gratuit ---
  startTrial: () => void;

  // --- Sélecteurs ---
  latestWeightKg: () => number | null;
  currentWeightKg: () => number | null; // dernière pesée, sinon poids de départ
  target: () => TargetResult | null;
  foodsForDate: (date?: string) => FoodEntry[];
  totalsForDate: (date?: string) => DailyTotals;
  weightSeries: () => WeightEntry[];

  reset: () => void;
};

export const useWeightStore = create<WeightState>()(
  persist(
    (set, get) => ({
      body: null,
      weights: [],
      foods: [],
      trialStartedAt: null,

      setBody: (patch) =>
        set((s) => {
          const base: BodyProfile =
            s.body ?? {
              sex: 'female',
              birthYear: new Date().getFullYear() - 30,
              heightCm: 170,
              startWeightKg: 70,
              targetWeightKg: 65,
              activity: 'sedentary',
              goal: 'lose',
              paceKgPerWeek: 0.5,
              createdAt: Date.now()
            };
          const next: BodyProfile = { ...base, ...patch };
          // L'objectif (perte/maintien/prise) découle toujours des poids saisis,
          // sauf si explicitement forcé dans le patch.
          if (patch.goal === undefined) {
            next.goal = goalFromWeights(next.startWeightKg, next.targetWeightKg);
          }
          return { body: next };
        }),

      resetBody: () => set({ body: null }),

      addWeight: (weightKg, date) =>
        set((s) => {
          const day = date ?? todayISO();
          const others = s.weights.filter((w) => w.date !== day);
          const next = [...others, { date: day, weightKg, createdAt: Date.now() }];
          next.sort((a, b) => a.date.localeCompare(b.date));
          return { weights: next };
        }),

      removeWeight: (date) => set((s) => ({ weights: s.weights.filter((w) => w.date !== date) })),

      addFood: (entry) =>
        set((s) => ({
          foods: [...s.foods, { ...entry, id: nanoid(), createdAt: Date.now() }]
        })),

      removeFood: (id) => set((s) => ({ foods: s.foods.filter((f) => f.id !== id) })),

      startTrial: () => set((s) => (s.trialStartedAt ? s : { trialStartedAt: Date.now() })),

      latestWeightKg: () => {
        const w = get().weights;
        return w.length ? w[w.length - 1].weightKg : null;
      },

      currentWeightKg: () => {
        const s = get();
        const latest = s.weights.length ? s.weights[s.weights.length - 1].weightKg : null;
        return latest ?? s.body?.startWeightKg ?? null;
      },

      target: () => {
        const s = get();
        if (!s.body) return null;
        const current = s.currentWeightKg() ?? s.body.startWeightKg;
        return calorieTarget(s.body, current);
      },

      foodsForDate: (date) => {
        const day = date ?? todayISO();
        return get().foods.filter((f) => f.date === day);
      },

      totalsForDate: (date) => sumTotals(get().foodsForDate(date)),

      weightSeries: () => get().weights,

      reset: () => set({ body: null, weights: [], foods: [], trialStartedAt: null })
    }),
    {
      name: 'weight-tracker',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        body: s.body,
        weights: s.weights,
        foods: s.foods,
        trialStartedAt: s.trialStartedAt
      })
    }
  )
);

export type { BodyProfile, FoodEntry, WeightEntry, Meal };
