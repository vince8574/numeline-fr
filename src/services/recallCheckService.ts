import { fetchRecallsByCountry } from './apiService';
import type { CountryCode, RecallRecord } from '../types';

export interface RecallCheckResult {
  productId: string;
  wasUpdated: boolean;
  newRecalls: RecallRecord[];
}

/**
 * Vérifie tous les produits scannés contre les rappels actuels
 * Retourne la liste des produits qui ont un nouveau statut de rappel
 */
export async function checkAllProductsForRecalls(
  products: Array<{
    id: string;
    brand: string;
    lotNumber: string;
    recallStatus: 'unknown' | 'safe' | 'recalled' | 'warning';
  }>,
  country: CountryCode
): Promise<RecallCheckResult[]> {
  console.log(`[RecallCheck] Checking ${products.length} products for recalls in ${country}`);

  try {
    const recalls = await fetchRecallsByCountry(country);
    console.log(`[RecallCheck] Found ${recalls.length} total recalls`);

    const results: RecallCheckResult[] = [];

    for (const product of products) {
      const matchingRecalls = recalls.filter((recall) => {
        const brandMatch = !recall.brand || recall.brand.toLowerCase() === product.brand.toLowerCase();
        const lotMatch =
          !recall.lotNumbers || recall.lotNumbers.length === 0 ||
          recall.lotNumbers.some((lot) => lot.toLowerCase() === product.lotNumber.toLowerCase());
        return brandMatch && lotMatch;
      });

      if (matchingRecalls.length > 0 && (product.recallStatus === 'safe' || product.recallStatus === 'unknown')) {
        console.log(`[RecallCheck] ⚠️ Product ${product.id} (${product.brand} ${product.lotNumber}) has new recalls!`);
        results.push({ productId: product.id, wasUpdated: true, newRecalls: matchingRecalls });
      } else if (matchingRecalls.length === 0 && product.recallStatus !== 'safe') {
        results.push({ productId: product.id, wasUpdated: true, newRecalls: [] });
      }
    }

    console.log(`[RecallCheck] Found ${results.length} products with status changes`);
    return results;
  } catch (error) {
    console.error('[RecallCheck] Error checking products:', error);
    throw error;
  }
}

/**
 * Vérifie un seul produit contre les rappels actuels
 */
export async function checkProductForRecalls(
  brand: string,
  lotNumber: string,
  country: CountryCode
): Promise<RecallRecord[]> {
  console.log(`[RecallCheck] Checking single product: ${brand} ${lotNumber}`);

  try {
    const recalls = await fetchRecallsByCountry(country);

    const matchingRecalls = recalls.filter((recall) => {
      const brandMatch = !recall.brand || recall.brand.toLowerCase() === brand.toLowerCase();
      const lotMatch =
        !recall.lotNumbers || recall.lotNumbers.length === 0 ||
        recall.lotNumbers.some((lot) => lot.toLowerCase() === lotNumber.toLowerCase());
      return brandMatch && lotMatch;
    });

    console.log(`[RecallCheck] Found ${matchingRecalls.length} matching recalls`);
    return matchingRecalls;
  } catch (error) {
    console.error('[RecallCheck] Error checking product:', error);
    throw error;
  }
}
