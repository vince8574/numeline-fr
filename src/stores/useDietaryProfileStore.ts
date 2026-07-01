import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emptyDietaryProfile,
  type AllergenKey,
  type DietaryProfile,
  type NutrientKey,
  type NutrientThreshold
} from '../services/dietaryProfile';

// Profil alimentaire de l'utilisateur (allergènes, aliments à éviter, régime,
// seuils nutritionnels). Persisté localement (AsyncStorage) pour l'offline ; la
// SYNCHRO Firestore (chargement à l'auth + sauvegarde à chaque changement) est
// gérée par le hook useDietaryProfile + AppInitializer, comme la souscription.

type DietaryProfileState = {
  allergens: AllergenKey[];
  avoidFoods: string[];
  vegetarian: boolean;
  vegan: boolean;
  thresholds: Partial<Record<NutrientKey, NutrientThreshold>>;

  // Remplace tout le profil (ex. données Firestore au login).
  setProfile: (p: DietaryProfile | null) => void;
  toggleAllergen: (k: AllergenKey) => void;
  toggleAvoidFood: (k: string) => void;
  setVegetarian: (v: boolean) => void;
  setVegan: (v: boolean) => void;
  setThreshold: (k: NutrientKey, t: NutrientThreshold | undefined) => void;
  reset: () => void;
  // Snapshot au format DietaryProfile (pour Firestore / la détection).
  getProfile: () => DietaryProfile;
};

export const useDietaryProfileStore = create<DietaryProfileState>()(
  persist(
    (set, get) => ({
      allergens: [],
      avoidFoods: [],
      vegetarian: false,
      vegan: false,
      thresholds: {},

      setProfile: (p) =>
        set({
          allergens: p?.allergens ?? [],
          avoidFoods: p?.avoidFoods ?? [],
          vegetarian: p?.vegetarian ?? false,
          vegan: p?.vegan ?? false,
          thresholds: p?.thresholds ?? {}
        }),

      toggleAllergen: (k) =>
        set((s) => ({
          allergens: s.allergens.includes(k)
            ? s.allergens.filter((x) => x !== k)
            : [...s.allergens, k]
        })),

      toggleAvoidFood: (k) =>
        set((s) => ({
          avoidFoods: s.avoidFoods.includes(k)
            ? s.avoidFoods.filter((x) => x !== k)
            : [...s.avoidFoods, k]
        })),

      setVegetarian: (vegetarian) => set({ vegetarian }),
      setVegan: (vegan) => set({ vegan }),

      setThreshold: (k, t) =>
        set((s) => {
          const next = { ...s.thresholds };
          if (t) next[k] = t;
          else delete next[k];
          return { thresholds: next };
        }),

      reset: () => set({ allergens: [], avoidFoods: [], vegetarian: false, vegan: false, thresholds: {} }),

      getProfile: () => {
        const s = get();
        return {
          allergens: s.allergens,
          avoidFoods: s.avoidFoods,
          vegetarian: s.vegetarian,
          vegan: s.vegan,
          thresholds: s.thresholds,
          updatedAt: Date.now()
        } satisfies DietaryProfile;
      }
    }),
    {
      name: 'dietary-profile',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

export { emptyDietaryProfile };
