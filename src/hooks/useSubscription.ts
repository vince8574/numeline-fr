import { useSubscriptionStore } from '../stores/useSubscriptionStore';
import { useUserStore } from '../stores/useUserStore';
import { saveScanUsageToFirestore } from '../services/firestoreSubscriptionService';
import { scanLimitForPlan } from '../constants/subscriptionPlans';

export function useSubscription() {
  const store = useSubscriptionStore();

  store.resetQuotaIfNeeded();

  // planType may be absent in stores persisted before this field was added
  const planType = store.planType ?? (store.isPremium ? 'individual' : 'free');
  const planLimit = scanLimitForPlan(planType);
  const bonusScans = store.bonusScans ?? 0;

  const planScansRemaining = Math.max(0, planLimit - store.scansUsedThisMonth);
  const scansRemaining = planScansRemaining + bonusScans;
  const canScan = scansRemaining > 0;
  const isEnterprise = planType === 'enterprise';

  // Consumes plan scans first, then bonus scans
  const incrementScans = () => {
    if (store.scansUsedThisMonth < planLimit) {
      store.incrementScans();
    } else if (bonusScans > 0) {
      store.consumeBonusScan();
    }
    // Persiste la conso côté serveur (anti-abus réinstallation pour le palier gratuit).
    const uid = useUserStore.getState().uid;
    if (uid) {
      void saveScanUsageToFirestore(uid, useSubscriptionStore.getState().scansUsedThisMonth);
    }
  };

  return {
    canScan,
    scansRemaining,
    planScansRemaining,
    bonusScans,
    scansUsed: store.scansUsedThisMonth,
    scanLimit: planLimit,
    isPremium: store.isPremium,
    planType,
    isEnterprise,
    canExport: isEnterprise,
    incrementScans,
  };
}
