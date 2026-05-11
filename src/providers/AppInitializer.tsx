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
import { initializeIAP, setupPurchaseListeners, restorePurchases, teardownIAP } from '../services/iapService';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { prewarmVoices, warmUpVoiceEngine } from '../hooks/useVoiceGuide';
import { getSpeechLocale } from '../hooks/voiceLocales';
import { useI18n } from '../i18n/I18nContext';
import type { ScannedProduct } from '../types';

export function AppInitializer() {
  useDatabaseWarmup();
  const { products, updateRecall } = useScannedProducts();
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

  useEffect(() => {
    // Reset quota mensuel
    useSubscriptionStore.getState().resetQuotaIfNeeded();

    // IAP initialization
    const initIAP = async () => {
      try {
        await initializeIAP();
        const activeSub = await restorePurchases();
        if (activeSub) {
          useSubscriptionStore.getState().setPremium(true, activeSub.productId);
        } else {
          useSubscriptionStore.getState().resetSubscription();
        }
      } catch (error) {
        console.warn('[AppInitializer] IAP init failed:', error);
      }
    };

    void initIAP();

    const cleanupListeners = setupPurchaseListeners(
      (purchase) => {
        useSubscriptionStore.getState().setPremium(true, purchase.productId);
      },
      (error) => {
        console.warn('[AppInitializer] Purchase error:', error);
      }
    );

    void registerBackgroundTask();
    void requestNotificationPermissions();
    void registerBackgroundRecallCheck();

    // Vérifier s'il y a de nouveaux rappels au démarrage
    const checkNewRecalls = async () => {
      const newRecalls = await getAndClearNewRecalls();
      if (newRecalls.length > 0) {
        console.log(`[AppInitializer] Found ${newRecalls.length} new recalls to display`);

        // Mettre à jour les produits avec les nouveaux rappels
        const recalledProducts: ScannedProduct[] = [];
        for (const result of newRecalls) {
          if (result.newRecalls.length > 0) {
            // Mettre à jour le produit
            for (const recall of result.newRecalls) {
              updateRecall(result.productId, recall);
            }

            // Ajouter à la liste des produits à afficher
            const product = products.find((p) => p.id === result.productId);
            if (product) {
              recalledProducts.push(product);
            }
          }
        }

        if (recalledProducts.length > 0) {
          setAlertProducts(recalledProducts);
          setShowAlert(true);
        }
      }
    };

    void checkNewRecalls();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void purgeExpiredScans();
        void checkNewRecalls();
      }
    });

    void purgeExpiredScans();

    return () => {
      subscription.remove();
      cleanupListeners();
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
