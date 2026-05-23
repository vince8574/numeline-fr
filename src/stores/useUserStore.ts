import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type UserStore = {
  // Auth state — set by onAuthStateChanged listener, not persisted
  authReady: boolean;
  isAuthenticated: boolean;
  uid: string | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;

  // Local preferences — persisted
  firstName: string | null;
  hasCompletedOnboarding: boolean;

  // Actions
  setAuthUser: (user: AuthUser | null) => void;
  setFirstName: (name: string) => void;
  completeOnboarding: () => void;
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      authReady: false,
      isAuthenticated: false,
      uid: null,
      email: null,
      displayName: null,
      photoURL: null,
      firstName: null,
      hasCompletedOnboarding: false,

      setAuthUser: (user) =>
        set(
          user
            ? {
                authReady: true,
                isAuthenticated: true,
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
              }
            : {
                authReady: true,
                isAuthenticated: false,
                uid: null,
                email: null,
                displayName: null,
                photoURL: null,
              }
        ),

      setFirstName: (name) => set({ firstName: name }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        firstName: state.firstName,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
