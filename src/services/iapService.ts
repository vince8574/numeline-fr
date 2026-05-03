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

const PRODUCT_ID = 'com.numelinefr.app.premium_monthly';
const productSkus = [PRODUCT_ID];

export async function initializeIAP() {
  try {
    await initConnection();
    const products = await fetchProducts({ skus: productSkus, type: 'subs' });
    return products;
  } catch (error) {
    console.warn('[IAP] Init failed:', error);
    return [];
  }
}

export async function purchasePremium() {
  await requestPurchase({
    request: Platform.select({
      ios: { apple: { sku: PRODUCT_ID } },
      android: { google: { skus: [PRODUCT_ID] } },
    }) ?? { apple: { sku: PRODUCT_ID } },
    type: 'subs',
  });
}

export async function restorePurchases() {
  const purchases = await getAvailablePurchases();
  const activeSub = purchases.find((p: Purchase) => p.productId === PRODUCT_ID);
  return activeSub ?? null;
}

export function setupPurchaseListeners(
  onSuccess: (purchase: Purchase) => void,
  onError: (error: PurchaseError) => void
) {
  const updateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
    await finishTransaction({ purchase, isConsumable: false });
    onSuccess(purchase);
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
