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
      accessibilityMode: true,
      setCountry: (country) => set({ country }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setDarkMode: (darkMode) => set({ darkMode }),
      setFirstName: (firstName) => set({ firstName }),
      setHasSeenWelcome: (hasSeenWelcome) => set({ hasSeenWelcome }),
      setAccessibilityMode: (accessibilityMode) => set({ accessibilityMode })
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
