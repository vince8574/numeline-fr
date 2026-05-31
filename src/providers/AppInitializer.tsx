import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { registerBackgroundTask } from '../services/backgroundService';
import { requestNotificationPermissions } from '../services/notificationService';
import { useDatabaseWarmup } from '../services/dbService';
import { purgeExpiredScans } from '../utils/dataCleanup';
import { registerBackgroundRecallCheck, getAndClearNewRecalls } from '../services/backgroundRecallCheck';
import { RecallAlertModal } from '../components/RecallAlertModal';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { useSubscriptionStore } from '../stores/useSubscriptionStore';
import { useUserStore } from '../stores/useUserStore';
import { initializeIAP, setupPurchaseListeners, restorePurchases, teardownIAP } from '../services/iapService';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { prewarmVoices, warmUpVoiceEngine } from '../hooks/useVoiceGuide';
import { getSpeechLocale } from '../hooks/voiceLocales';
import { useI18n } from '../i18n/I18nContext';
import { initGoogleSignIn, onAuthStateChanged } from '../services/authService';
import {
  fetchSubscriptionFromFirestore,
  saveSubscriptionToFirestore,
} from '../services/firestoreSubscriptionService';
import type { ScannedProduct } from '../types';

async function initSubscription(uid: string | null) {
  const subStore = useSubscriptionStore.getState();

  // Restore from Firestore first (cross-device state: bonusScans, last known plan)
  let overrideGranted = false;
  if (uid) {
    const firestoreData = await fetchSubscriptionFromFirestore(uid);
    if (firestoreData) {
      // Accès "reviewer" (compte démo store) : premium forcé, non écrasé par l'IAP.
      overrideGranted = !!firestoreData.overridePremium;
      const willBePremium = firestoreData.isPremium || overrideGranted;
      subStore.setPremium(willBePremium, firestoreData.productId ?? undefined);

      // Anti-abus réinstallation : la conso de scans gratuits est autoritaire
      // côté serveur. On prend le max(local, serveur) pour qu'une réinstallation
      // (qui vide le stockage local) ne réinitialise pas le quota gratuit.
      // Les abonnés payants gardent un quota mensuel géré localement (non restauré).
      if (!willBePremium) {
        subStore.setScanUsage(
          Math.max(subStore.scansUsedThisMonth, firestoreData.scansUsedThisMonth ?? 0)
        );
      }

      if (firestoreData.bonusScans > subStore.bonusScans) {
        subStore.addBonusScans(firestoreData.bonusScans - subStore.bonusScans);
      }
    }
  }

  subStore.resetQuotaIfNeeded();

  // IAP restore is the authoritative source for active subscriptions
  try {
    await initializeIAP();
    const activeSub = await restorePurchases();
    if (activeSub) {
      subStore.setPremium(true, activeSub.productId);
      if (uid) {
        void saveSubscriptionToFirestore(uid, {
          isPremium: true,
          planType: useSubscriptionStore.getState().planType,
          productId: activeSub.productId,
          purchaseToken: activeSub.transactionId ?? null,
          expiresAt: null,
          bonusScans: subStore.bonusScans,
        });
      }
    } else if (!overrideGranted) {
      // Ne pas réinitialiser un compte reviewer (premium forcé sans achat réel).
      subStore.resetSubscription();
    }
  } catch (error) {
    console.warn('[AppInitializer] IAP init failed:', error);
  }
}

export function AppInitializer() {
  useDatabaseWarmup();
  const { products } = useScannedProducts();
  const [alertProducts, setAlertProducts] = useState<ScannedProduct[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const accessibilityMode = usePreferencesStore((s) => s.accessibilityMode);
  const { locale } = useI18n();

  useEffect(() => {
    prewarmVoices();
    if (accessibilityMode) {
      warmUpVoiceEngine(getSpeechLocale(locale));
    }
  }, []);

  // Auth listener + subscription init
  useEffect(() => {
    initGoogleSignIn();

    const unsubscribeAuth = onAuthStateChanged((user) => {
      const uid = user?.uid ?? null;
      useUserStore.getState().setAuthUser(
        user
          ? { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL }
          : null
      );
      // Restaurer le prénom depuis le profil du compte s'il est absent localement.
      // Évite de redemander le prénom (onboarding) après une réinstallation ou sur
      // un nouvel appareil : le displayName est enregistré sur le compte à l'inscription.
      if (user?.displayName) {
        const prefs = usePreferencesStore.getState();
        if (!prefs.firstName.trim()) {
          prefs.setFirstName(user.displayName.trim().split(/\s+/)[0]);
        }
      }
      void initSubscription(uid);
    });

    return () => unsubscribeAuth();
  }, []);

  // Purchase listeners
  useEffect(() => {
    const cleanupListeners = setupPurchaseListeners(
      (purchase) => {
        const subStore = useSubscriptionStore.getState();
        subStore.setPremium(true, purchase.productId);
        const uid = useUserStore.getState().uid;
        if (uid) {
          void saveSubscriptionToFirestore(uid, {
            isPremium: true,
            planType: subStore.planType,
            productId: purchase.productId,
            purchaseToken: purchase.transactionId ?? null,
            expiresAt: null,
            bonusScans: subStore.bonusScans,
          });
        }
      },
      (error) => {
        console.warn('[AppInitializer] Purchase error:', error);
      }
    );

    return () => cleanupListeners();
  }, []);

  // Background tasks + recall checks
  useEffect(() => {
    void registerBackgroundTask();
    void requestNotificationPermissions();
    void registerBackgroundRecallCheck();

    const checkNewRecalls = async () => {
      const newRecalls = await getAndClearNewRecalls();
      if (newRecalls.length === 0) return;

      const recalledProducts: ScannedProduct[] = [];
      for (const result of newRecalls) {
        if (result.newRecalls.length > 0) {
          const product = products.find((p) => p.id === result.productId);
          if (product) recalledProducts.push(product);
        }
      }

      if (recalledProducts.length > 0) {
        setAlertProducts(recalledProducts);
        setShowAlert(true);
      }
    };

    void checkNewRecalls();
    void purgeExpiredScans();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void purgeExpiredScans();
        void checkNewRecalls();
      }
    });

    return () => {
      appStateSub.remove();
      void teardownIAP();
    };
  }, []);

  return (
    <RecallAlertModal
      visible={showAlert}
      onClose={() => setShowAlert(false)}
      products={alertProducts}
    />
  );
}
