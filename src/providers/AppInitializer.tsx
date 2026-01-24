import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { registerBackgroundTask } from '../services/backgroundService';
import { requestNotificationPermissions } from '../services/notificationService';
import { useDatabaseWarmup } from '../services/dbService';
import { purgeExpiredScans } from '../utils/dataCleanup';
import { registerBackgroundRecallCheck, getAndClearNewRecalls } from '../services/backgroundRecallCheck';
import { RecallAlertModal } from '../components/RecallAlertModal';
import { useScannedProducts } from '../hooks/useScannedProducts';
import type { ScannedProduct } from '../types';

export function AppInitializer() {
  useDatabaseWarmup();
  const { products, updateRecall } = useScannedProducts();
  const [alertProducts, setAlertProducts] = useState<ScannedProduct[]>([]);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
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

    return () => subscription.remove();
  }, []);

  return (
    <RecallAlertModal
      visible={showAlert}
      onClose={() => setShowAlert(false)}
      products={alertProducts}
    />
  );
}
