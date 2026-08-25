import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { PLAN_IDS, PACK_IDS } from '../constants/subscriptionPlans';

const productSkus: string[] = [
  PLAN_IDS.INDIVIDUAL, PLAN_IDS.INDIVIDUAL_YEARLY,
  PLAN_IDS.ENTERPRISE, PLAN_IDS.ENTERPRISE_YEARLY,
];
const packSkus: string[] = [PACK_IDS.PACK_10, PACK_IDS.PACK_50, PACK_IDS.PACK_100, PACK_IDS.PACK_210];

export async function initializeIAP() {
  try {
    await initConnection();
    const [subs, packs] = await Promise.all([
      fetchProducts({ skus: productSkus, type: 'subs' }),
      fetchProducts({ skus: packSkus, type: 'in-app' }),
    ]);
    return { subs, packs };
  } catch (error) {
    console.warn('[IAP] Init failed:', error);
    return { subs: [], packs: [] };
  }
}

export async function purchaseScanPack(packId: string) {
  await requestPurchase({
    request: Platform.select({
      ios: { apple: { sku: packId } },
      android: { google: { skus: [packId] } },
    }) ?? { apple: { sku: packId } },
    type: 'in-app',
  });
}

export async function purchasePlan(planId: string) {
  await requestPurchase({
    request: Platform.select({
      ios: { apple: { sku: planId } },
      android: { google: { skus: [planId] } },
    }) ?? { apple: { sku: planId } },
    type: 'subs',
  });
}

export async function purchasePremium() {
  return purchasePlan(PLAN_IDS.INDIVIDUAL);
}

export async function restorePurchases() {
  const purchases = await getAvailablePurchases();
  const activeSub = purchases.find((p: Purchase) => productSkus.includes(p.productId));
  return activeSub ?? null;
}

export function setupPurchaseListeners(
  onSuccess: (purchase: Purchase) => void,
  onError: (error: PurchaseError) => void
) {
  const updateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
    // 1) Créditer AVANT de clore : si l'application est tuée entre les deux, une
    //    transaction non close est rejouée au prochain lancement, donc rien n'est
    //    perdu. Dans l'ordre inverse, l'achat serait payé et jamais crédité.
    onSuccess(purchase);

    // 2) `isConsumable` DOIT refléter la nature du produit. Il valait `false`
    //    pour TOUT, packs compris : sur Android un consommable clos ainsi n'est
    //    jamais consommé, donc Google le considère toujours possédé — le client
    //    ne peut plus racheter le même pack (« vous possédez déjà cet article »).
    await finishTransaction({ purchase, isConsumable: packSkus.includes(purchase.productId) });
  });

  const errorSub = purchaseErrorListener((error: PurchaseError) => {
    console.warn('[IAP] Purchase error:', error);
    onError(error);
  });

  return () => {
    updateSub.remove();
    errorSub.remove();
  };
}

export async function teardownIAP() {
  try {
    await endConnection();
  } catch (error) {
    console.warn('[IAP] Teardown failed:', error);
  }
}
