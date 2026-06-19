import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PreferencesState = {
  country: 'FR' | 'US' | 'CH';
  notificationsEnabled: boolean;
  darkMode: 'system' | 'light' | 'dark';
  firstName: string;
  hasSeenWelcome: boolean;
  accessibilityMode: boolean;
  setCountry: (country: 'FR' | 'US' | 'CH') => void;
  setNotificationsEnabled: (value: boolean) => void;
  setDarkMode: (mode: 'system' | 'light' | 'dark') => void;
  setFirstName: (name: string) => void;
  setHasSeenWelcome: (value: boolean) => void;
  setAccessibilityMode: (value: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      country: 'FR',
      notificationsEnabled: true,
      darkMode: 'system',
      firstName: '',
      hasSeenWelcome: false,
      // Mode malvoyant DÉSACTIVÉ par défaut (le scan mains-libres voyant est
      // l'expérience par défaut). Réactivable dans Réglages. Les installs
      // existantes (ancien défaut `true`) sont basculées par la migration v1.
      accessibilityMode: false,
      setCountry: (country) => set({ country }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setFirstName: (firstName) => set({ firstName }),
      setHasSeenWelcome: (hasSeenWelcome) => set({ hasSeenWelcome }),
      setAccessibilityMode: (accessibilityMode) => set({ accessibilityMode })
    }),
    {
      name: 'preferences',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // v0 → v1 : bascule les installs existantes (défaut `true`) à `false` une
      // fois, sinon un utilisateur voyant reste coincé dans la boucle de re-scan
      // du mode voix. Un malvoyant le réactive dans Réglages.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as any;
        if (version < 1) {
          state.accessibilityMode = false;
        }
        return state;
      }
    }
  )
);
