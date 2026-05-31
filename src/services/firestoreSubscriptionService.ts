import firestore from '@react-native-firebase/firestore';
import type { PlanType } from '../constants/subscriptionPlans';

export type SubscriptionDoc = {
  isPremium: boolean;
  planType: PlanType;
  productId: string | null;
  purchaseToken: string | null;
  expiresAt: number | null;
  bonusScans: number;
  // Conso de scans gratuits suivie côté serveur (anti-abus réinstallation).
  scansUsedThisMonth?: number;
  // Accès "reviewer" (compte démo store) : premium forcé, non écrasé par l'IAP.
  overridePremium?: boolean;
  updatedAt: number;
};

function userDoc(uid: string) {
  return firestore().collection('users').doc(uid);
}

export async function fetchSubscriptionFromFirestore(uid: string): Promise<SubscriptionDoc | null> {
  try {
    const snap = await userDoc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data?.subscription) return null;
    return data.subscription as SubscriptionDoc;
  } catch (error) {
    console.warn('[Firestore] fetchSubscription failed:', error);
    return null;
  }
}

export async function saveSubscriptionToFirestore(uid: string, sub: Omit<SubscriptionDoc, 'updatedAt'>): Promise<void> {
  try {
    await userDoc(uid).set(
      { subscription: { ...sub, updatedAt: Date.now() } },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Firestore] saveSubscription failed:', error);
  }
}

/** Persiste uniquement la conso de scans gratuits (merge, sans toucher au reste). */
export async function saveScanUsageToFirestore(uid: string, scansUsedThisMonth: number): Promise<void> {
  try {
    await userDoc(uid).set(
      { subscription: { scansUsedThisMonth, updatedAt: Date.now() } },
      { merge: true }
    );
  } catch (error) {
    console.warn('[Firestore] saveScanUsage failed:', error);
  }
}

export function listenToSubscription(
  uid: string,
  onChange: (sub: SubscriptionDoc | null) => void
): () => void {
  return userDoc(uid).onSnapshot(
    (snap) => {
      if (!snap.exists) {
        onChange(null);
        return;
      }
      const data = snap.data();
      onChange(data?.subscription ?? null);
    },
    (error) => {
      console.warn('[Firestore] subscription listener error:', error);
    }
  );
}
