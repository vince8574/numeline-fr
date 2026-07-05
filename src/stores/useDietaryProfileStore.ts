import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../i18n/i18n';
import {
  emptyDietaryProfile,
  makePerson,
  normalizeProfile,
  type AllergenKey,
  type DietaryPerson,
  type DietaryProfile,
  type NutrientKey,
  type NutrientThreshold
} from '../services/dietaryProfile';

// Profil alimentaire MULTI-PERSONNES (famille). Persisté localement (AsyncStorage)
// pour l'offline ; la synchro Firestore (chargement à l'auth + sauvegarde à chaque
// changement) est gérée par le hook useDietaryProfile + AppInitializer.

type DietaryProfileState = {
  people: DietaryPerson[];

  // Remplace tout le profil (ex. données Firestore au login). Migre l'ancien
  // format (profil unique) vers une personne.
  setProfile: (p: DietaryProfile | null) => void;
  addPerson: (name: string) => string; // renvoie l'id créé
  removePerson: (id: string) => void;
  renamePerson: (id: string, name: string) => void;
  toggleAllergen: (personId: string, k: AllergenKey) => void;
  toggleAvoidFood: (personId: string, k: string) => void;
  setVegetarian: (personId: string, v: boolean) => void;
  setVegan: (personId: string, v: boolean) => void;
  setThreshold: (personId: string, k: NutrientKey, t: NutrientThreshold | undefined) => void;
  reset: () => void;
  getPerson: (id: string) => DietaryPerson | undefined;
  // Snapshot au format DietaryProfile (pour Firestore / la détection).
  getProfile: () => DietaryProfile;
};

function defaultPersonName(): string {
  const name = t('dietary.defaultPersonName');
  return name && name !== 'dietary.defaultPersonName' ? name : 'Moi';
}

export const useDietaryProfileStore = create<DietaryProfileState>()(
  persist(
    (set, get) => {
      const updatePerson = (id: string, updater: (p: DietaryPerson) => DietaryPerson) =>
        set((s) => ({ people: s.people.map((p) => (p.id === id ? updater(p) : p)) }));

      return {
        people: [],

        setProfile: (p) => set({ people: normalizeProfile(p, defaultPersonName()).people }),

        addPerson: (name) => {
          const person = makePerson(name.trim() || defaultPersonName());
          set((s) => ({ people: [...s.people, person] }));
          return person.id;
        },

        removePerson: (id) => set((s) => ({ people: s.people.filter((p) => p.id !== id) })),

        renamePerson: (id, name) => updatePerson(id, (p) => ({ ...p, name })),

        toggleAllergen: (personId, k) =>
          updatePerson(personId, (p) => ({
            ...p,
            allergens: p.allergens.includes(k)
              ? p.allergens.filter((x) => x !== k)
              : [...p.allergens, k]
          })),

        toggleAvoidFood: (personId, k) =>
          updatePerson(personId, (p) => ({
            ...p,
            avoidFoods: p.avoidFoods.includes(k)
              ? p.avoidFoods.filter((x) => x !== k)
              : [...p.avoidFoods, k]
          })),

        setVegetarian: (personId, vegetarian) => updatePerson(personId, (p) => ({ ...p, vegetarian })),
        setVegan: (personId, vegan) => updatePerson(personId, (p) => ({ ...p, vegan })),

        setThreshold: (personId, k, threshold) =>
          updatePerson(personId, (p) => {
            const next = { ...p.thresholds };
            if (threshold) next[k] = threshold;
            else delete next[k];
            return { ...p, thresholds: next };
          }),

        reset: () => set({ people: [] }),

        getPerson: (id) => get().people.find((p) => p.id === id),

        getProfile: () => ({ people: get().people, updatedAt: Date.now() } satisfies DietaryProfile)
      };
    },
    {
      name: 'dietary-profile',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // Migre l'ancien état persisté (profil unique {allergens, …}) → {people}.
      migrate: (persisted: any, version: number) => {
        if (version >= 2 && persisted?.people) return persisted;
        const profile = normalizeProfile(persisted, defaultPersonName());
        return { people: profile.people };
      },
      partialize: (s) => ({ people: s.people })
    }
  )
);

export { emptyDietaryProfile };
