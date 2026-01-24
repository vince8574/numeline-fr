import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserStore = {
  firstName: string | null;
  setFirstName: (name: string) => void;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      firstName: null,
      setFirstName: (name) => set({ firstName: name }),
      hasCompletedOnboarding: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true })
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
