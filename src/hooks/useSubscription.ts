import { useSubscriptionStore } from '../stores/useSubscriptionStore';

const FREE_LIMIT = 10;
const PREMIUM_LIMIT = 500;

export function useSubscription() {
  const store = useSubscriptionStore();

  store.resetQuotaIfNeeded();

  const limit = store.isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
  const scansRemaining = Math.max(0, limit - store.scansUsedThisMonth);
  const canScan = scansRemaining > 0;

  return {
    canScan,
    scansRemaining,
    scansUsed: store.scansUsedThisMonth,
    scanLimit: limit,
    isPremium: store.isPremium,
    incrementScans: store.incrementScans,
  };
}
