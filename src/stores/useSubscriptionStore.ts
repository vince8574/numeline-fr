import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlanType, planTypeFromProductId } from '../constants/subscriptionPlans';

function getNextResetDate(): number {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

type SubscriptionStore = {
  isPremium: boolean;
  planType: PlanType;
  productId: string | null;
  purchaseToken: string | null;
  expiresAt: number | null;
  scansUsedThisMonth: number;
  quotaResetDate: number;
  // Scans achetés en pack one-time — persistent, jamais réinitialisés
  bonusScans: number;

  setPremium: (isPremium: boolean, productId?: string, expiresAt?: number) => void;
  setPurchaseToken: (token: string) => void;
  incrementScans: () => void;
  setScanUsage: (scansUsedThisMonth: number) => void;
  consumeBonusScan: () => void;
  addBonusScans: (quantity: number) => void;
  resetQuotaIfNeeded: () => void;
  resetSubscription: () => void;
};

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      isPremium: false,
      planType: 'free' as PlanType,
      productId: null,
      purchaseToken: null,
      expiresAt: null,
      scansUsedThisMonth: 0,
      quotaResetDate: getNextResetDate(),
      bonusScans: 0,

      setPremium: (isPremium, productId, expiresAt) =>
        set({
          isPremium,
          planType: isPremium ? planTypeFromProductId(productId ?? null) : 'free',
          ...(productId !== undefined && { productId }),
          ...(expiresAt !== undefined && { expiresAt }),
        }),

      setPurchaseToken: (token) => set({ purchaseToken: token }),

      incrementScans: () =>
        set((state) => ({ scansUsedThisMonth: state.scansUsedThisMonth + 1 })),

      setScanUsage: (scansUsedThisMonth) => set({ scansUsedThisMonth }),

      consumeBonusScan: () =>
        set((state) => ({ bonusScans: Math.max(0, state.bonusScans - 1) })),

      addBonusScans: (quantity) =>
        set((state) => ({ bonusScans: state.bonusScans + quantity })),

      resetQuotaIfNeeded: () => {
        const { quotaResetDate, isPremium } = get();
        // Le quota gratuit est à usage unique (5 scans à vie) : pas de
        // réinitialisation. Seuls les abonnés payants ont un quota mensuel
        // qui se réinitialise.
        if (!isPremium) return;
        if (Date.now() >= quotaResetDate) {
          set({
            scansUsedThisMonth: 0,
            quotaResetDate: getNextResetDate(),
          });
        }
      },

      // bonusScans intentionnellement exclu : les scans achetés persistent
      resetSubscription: () =>
        set({
          isPremium: false,
          planType: 'free',
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
