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

// Clé « AAAA-MM » du mois courant. Sert à savoir si l'utilisateur est encore dans
// son 1er mois (saisie manuelle limitée à 9 au lieu de 10).
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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
  // Compteurs MENSUELS (gratuit ET payant) : remis à zéro le 1er du mois.
  barcodeUsedThisMonth: number;
  manualLotUsedThisMonth: number;
  monthlyResetDate: number;
  // Mois d'installation, figé au 1er lancement (règle des 9 lots manuels le 1er mois).
  installMonthKey: string;

  setPremium: (isPremium: boolean, productId?: string, expiresAt?: number) => void;
  setPurchaseToken: (token: string) => void;
  incrementScans: () => void;
  setScanUsage: (scansUsedThisMonth: number) => void;
  consumeBonusScan: () => void;
  addBonusScans: (quantity: number) => void;
  // Fixe le solde exact (restauration depuis le serveur, qui fait autorité).
  setBonusScans: (bonusScans: number) => void;
  incrementBarcode: () => void;
  incrementManualLot: () => void;
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
      barcodeUsedThisMonth: 0,
      manualLotUsedThisMonth: 0,
      monthlyResetDate: getNextResetDate(),
      installMonthKey: currentMonthKey(),

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

      setBonusScans: (bonusScans) => set({ bonusScans: Math.max(0, bonusScans) }),

      incrementBarcode: () =>
        set((state) => ({ barcodeUsedThisMonth: (state.barcodeUsedThisMonth ?? 0) + 1 })),

      incrementManualLot: () =>
        set((state) => ({ manualLotUsedThisMonth: (state.manualLotUsedThisMonth ?? 0) + 1 })),

      resetQuotaIfNeeded: () => {
        const { quotaResetDate, monthlyResetDate, isPremium } = get();
        const now = Date.now();

        // Code-barres + lot manuel : quotas MENSUELS pour TOUT LE MONDE.
        if (now >= (monthlyResetDate ?? 0)) {
          set({
            barcodeUsedThisMonth: 0,
            manualLotUsedThisMonth: 0,
            monthlyResetDate: getNextResetDate(),
          });
        }

        // Scan IA : le quota gratuit est à usage unique (1 scan à vie) → jamais
        // réinitialisé. Seuls les abonnés payants ont un quota IA mensuel.
        if (!isPremium) return;
        if (now >= quotaResetDate) {
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
