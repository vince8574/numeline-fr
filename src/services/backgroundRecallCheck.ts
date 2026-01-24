import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkAllProductsForRecalls, RecallCheckResult } from './recallCheckService';
import type { ScannedProduct, CountryCode } from '../types';

const BACKGROUND_RECALL_CHECK_TASK = 'background-recall-check';
const LAST_CHECK_KEY = 'last-recall-check';
const NEW_RECALLS_KEY = 'new-recalls-found';

// Définir la tâche en arrière-plan
TaskManager.defineTask(BACKGROUND_RECALL_CHECK_TASK, async () => {
  console.log('[BackgroundRecallCheck] Running background recall check...');

  try {
    // Récupérer les produits et le pays depuis AsyncStorage
    const productsJson = await AsyncStorage.getItem('scanned-products');
    const country = (await AsyncStorage.getItem('country')) as CountryCode | null;

    if (!productsJson || !country) {
      console.log('[BackgroundRecallCheck] No products or country found');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const products: ScannedProduct[] = JSON.parse(productsJson);

    if (products.length === 0) {
      console.log('[BackgroundRecallCheck] No products to check');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Vérifier les rappels
    const results = await checkAllProductsForRecalls(products, country);

    if (results.length > 0) {
      console.log(`[BackgroundRecallCheck] Found ${results.length} products with new recalls`);

      // Sauvegarder les nouveaux rappels pour les afficher à l'ouverture de l'app
      await AsyncStorage.setItem(NEW_RECALLS_KEY, JSON.stringify(results));

      // Envoyer une notification pour chaque nouveau rappel
      for (const result of results) {
        if (result.newRecalls.length > 0) {
          const product = products.find((p) => p.id === result.productId);
          if (product) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🚨 ALERTE PRODUIT RAPPELÉ',
                body: `⚠️ ${product.brand} - Lot ${product.lotNumber}\n\n🚫 NE PAS CONSOMMER\nOuvrez l'application pour plus de détails.`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 250, 250, 250],
                data: {
                  productId: product.id,
                  type: 'recall-alert'
                }
              },
              trigger: null
            });
          }
        }
      }

      // Mettre à jour la date de dernière vérification
      await AsyncStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());

      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    console.log('[BackgroundRecallCheck] No new recalls found');
    await AsyncStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundRecallCheck] Error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Enregistrer la tâche de vérification en arrière-plan (toutes les heures)
 */
export async function registerBackgroundRecallCheck() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_RECALL_CHECK_TASK);

    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_RECALL_CHECK_TASK, {
        minimumInterval: 60 * 60, // 1 heure en secondes
        stopOnTerminate: false, // Continue après redémarrage
        startOnBoot: true // Démarre au boot
      });
      console.log('[BackgroundRecallCheck] Task registered successfully');
    } else {
      console.log('[BackgroundRecallCheck] Task already registered');
    }
  } catch (error) {
    console.error('[BackgroundRecallCheck] Failed to register task:', error);
  }
}

/**
 * Désactiver la tâche de vérification en arrière-plan
 */
export async function unregisterBackgroundRecallCheck() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_RECALL_CHECK_TASK);
    console.log('[BackgroundRecallCheck] Task unregistered');
  } catch (error) {
    console.error('[BackgroundRecallCheck] Failed to unregister task:', error);
  }
}

/**
 * Vérifier s'il y a de nouveaux rappels détectés en arrière-plan
 * Retourne les résultats et les efface du stockage
 */
export async function getAndClearNewRecalls(): Promise<RecallCheckResult[]> {
  try {
    const newRecallsJson = await AsyncStorage.getItem(NEW_RECALLS_KEY);
    if (newRecallsJson) {
      const results: RecallCheckResult[] = JSON.parse(newRecallsJson);
      await AsyncStorage.removeItem(NEW_RECALLS_KEY);
      return results;
    }
    return [];
  } catch (error) {
    console.error('[BackgroundRecallCheck] Failed to get new recalls:', error);
    return [];
  }
}

/**
 * Obtenir la date de la dernière vérification
 */
export async function getLastCheckTime(): Promise<Date | null> {
  try {
    const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
    return lastCheck ? new Date(lastCheck) : null;
  } catch (error) {
    console.error('[BackgroundRecallCheck] Failed to get last check time:', error);
    return null;
  }
}
