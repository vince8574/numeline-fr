import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../i18n/i18n';
import {
  emptyDietaryProfile,
  makePerson,
  normalizeProfile,
  type AllergenKey,
  type AvoidIngredient,
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
  // Personne ACTIVE : sans abonnement, seul son résultat est affiché au scan
  // (les autres profils sont verrouillés). Choix local à l'appareil → non
  // synchronisé sur Firestore. Les abonnés voient tout le monde.
  activePersonId: string | null;

  // Remplace tout le profil (ex. données Firestore au login). Migre l'ancien
  // format (profil unique) vers une personne.
  setProfile: (p: DietaryProfile | null) => void;
  setActivePerson: (id: string) => void;
  getActivePerson: () => DietaryPerson | undefined;
  addPerson: (name: string) => string; // renvoie l'id créé
  removePerson: (id: string) => void;
  renamePerson: (id: string, name: string) => void;
  toggleAllergen: (personId: string, k: AllergenKey) => void;
  toggleAvoidFood: (personId: string, k: string) => void;
  setVegetarian: (personId: string, v: boolean) => void;
  setVegan: (personId: string, v: boolean) => void;
  setPregnant: (personId: string, v: boolean) => void;
  setCeliac: (personId: string, v: boolean) => void;
  addCustomAvoidFood: (personId: string, food: string) => void;
  removeCustomAvoidFood: (personId: string, food: string) => void;
  addAvoidIngredient: (personId: string, item: AvoidIngredient) => void;
  removeAvoidIngredient: (personId: string, id: string) => void;
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
        activePersonId: null,

        setProfile: (p) =>
          set((s) => {
            const people = normalizeProfile(p, defaultPersonName()).people;
            // Conserve l'actif s'il existe toujours, sinon retombe sur le 1er.
            const stillThere = people.some((x) => x.id === s.activePersonId);
            return { people, activePersonId: stillThere ? s.activePersonId : (people[0]?.id ?? null) };
          }),

        setActivePerson: (id) => set({ activePersonId: id }),

        getActivePerson: () => {
          const s = get();
          return s.people.find((p) => p.id === s.activePersonId) ?? s.people[0];
        },

        addPerson: (name) => {
          const person = makePerson(name.trim() || defaultPersonName());
          set((s) => ({
            people: [...s.people, person],
            // 1re personne créée → elle devient l'active par défaut.
            activePersonId: s.activePersonId ?? person.id
          }));
          return person.id;
        },

        removePerson: (id) =>
          set((s) => {
            const people = s.people.filter((p) => p.id !== id);
            // On supprime l'actif → bascule sur le 1er restant (ou aucun).
            const activePersonId = s.activePersonId === id ? (people[0]?.id ?? null) : s.activePersonId;
            return { people, activePersonId };
          }),

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
        setPregnant: (personId, pregnant) => updatePerson(personId, (p) => ({ ...p, pregnant })),
        setCeliac: (personId, celiac) => updatePerson(personId, (p) => ({ ...p, celiac })),

        addCustomAvoidFood: (personId, food) =>
          updatePerson(personId, (p) => {
            const v = food.trim();
            if (!v || p.customAvoidFoods.some((x) => x.toLowerCase() === v.toLowerCase())) return p;
            return { ...p, customAvoidFoods: [...p.customAvoidFoods, v] };
          }),

        removeCustomAvoidFood: (personId, food) =>
          updatePerson(personId, (p) => ({
            ...p,
            customAvoidFoods: p.customAvoidFoods.filter((x) => x !== food)
          })),

        addAvoidIngredient: (personId, item) =>
          updatePerson(personId, (p) =>
            p.avoidIngredients.some((x) => x.id === item.id)
              ? p
              : { ...p, avoidIngredients: [...p.avoidIngredients, item] }
          ),

        removeAvoidIngredient: (personId, id) =>
          updatePerson(personId, (p) => ({
            ...p,
            avoidIngredients: p.avoidIngredients.filter((x) => x.id !== id)
          })),

        setThreshold: (personId, k, threshold) =>
          updatePerson(personId, (p) => {
            const next = { ...p.thresholds };
            if (threshold) next[k] = threshold;
            else delete next[k];
            return { ...p, thresholds: next };
          }),

        reset: () => set({ people: [], activePersonId: null }),

        getPerson: (id) => get().people.find((p) => p.id === id),

        getProfile: () => ({ people: get().people, updatedAt: Date.now() } satisfies DietaryProfile)
      };
    },
    {
      name: 'dietary-profile',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      // v<2 : ancien état persisté (profil unique {allergens, …}) → {people}.
      // v<3 : ajout de la personne active → 1re personne active par défaut.
      migrate: (persisted: any, version: number) => {
        const people: DietaryPerson[] =
          version >= 2 && persisted?.people
            ? persisted.people
            : normalizeProfile(persisted, defaultPersonName()).people;
        return {
          people,
          activePersonId: persisted?.activePersonId ?? people[0]?.id ?? null
        };
      },
      partialize: (s) => ({ people: s.people, activePersonId: s.activePersonId })
    }
  )
);

export { emptyDietaryProfile };
