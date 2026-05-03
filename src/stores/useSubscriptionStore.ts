import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getNextResetDate(): number {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

type SubscriptionStore = {
  isPremium: boolean;
  productId: string | null;
  purchaseToken: string | null;
  expiresAt: number | null;
  scansUsedThisMonth: number;
  quotaResetDate: number;

  setPremium: (isPremium: boolean, productId?: string, expiresAt?: number) => void;
  setPurchaseToken: (token: string) => void;
  incrementScans: () => void;
  resetQuotaIfNeeded: () => void;
  resetSubscription: () => void;
};

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      isPremium: false,
      productId: null,
      purchaseToken: null,
      expiresAt: null,
      scansUsedThisMonth: 0,
      quotaResetDate: getNextResetDate(),

      setPremium: (isPremium, productId, expiresAt) =>
        set({
          isPremium,
          ...(productId !== undefined && { productId }),
          ...(expiresAt !== undefined && { expiresAt }),
        }),

      setPurchaseToken: (token) => set({ purchaseToken: token }),

      incrementScans: () =>
        set((state) => ({ scansUsedThisMonth: state.scansUsedThisMonth + 1 })),

      resetQuotaIfNeeded: () => {
        const { quotaResetDate } = get();
        if (Date.now() >= quotaResetDate) {
          set({
            scansUsedThisMonth: 0,
            quotaResetDate: getNextResetDate(),
          });
        }
      },

      resetSubscription: () =>
        set({
          isPremium: false,
          productId: null,
          purchaseToken: null,
          expiresAt: null,
        }),
    }),
    {
      name: 'subscription-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
