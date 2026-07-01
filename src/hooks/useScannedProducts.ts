import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllProducts as getFirestoreProducts,
  addProduct as addFirestoreProduct,
  updateProduct as updateFirestoreProduct,
  removeProduct as removeFirestoreProduct,
  subscribeToProducts
} from '../services/firebaseProductsService';
import { ScannedProduct, RecallRecord } from '../types';
import { getRecallStatus } from '../utils/lotMatcher';

const QUERY_KEY = ['scanned-products'];
const ASYNC_STORAGE_KEY = 'scanned-products';

async function loadProducts() {
  return getFirestoreProducts();
}

// Miroir Firestore -> AsyncStorage : la tâche de fond (backgroundRecallCheck) lit
// l'historique depuis AsyncStorage (elle n'a pas accès au cache react-query).
export async function syncProductsToAsyncStorage() {
  try {
    const products = await getFirestoreProducts();
    await AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify(products));
  } catch (error) {
    console.error('[useScannedProducts] Failed to sync to AsyncStorage:', error);
  }
}

export function useScannedProducts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadProducts
  });

  // Synchro temps réel depuis Firestore (multi-appareils + rafraîchissement live).
  useEffect(() => {
    const unsubscribe = subscribeToProducts((products) => {
      queryClient.setQueryData(QUERY_KEY, products);
      void syncProductsToAsyncStorage();
    });
    return () => unsubscribe();
  }, [queryClient]);

  const addMutation = useMutation({
    mutationFn: async (payload: Omit<ScannedProduct, 'id' | 'scannedAt' | 'recallStatus'>) => {
      return addFirestoreProduct(payload);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      await syncProductsToAsyncStorage();
    }
  });

  const updateRecallMutation = useMutation({
    mutationFn: async ({
      product,
      recalls
    }: {
      product: ScannedProduct;
      recalls: RecallRecord[];
    }) => {
      const recallStatus = getRecallStatus(product, recalls);
      await updateFirestoreProduct(product.id, {
        recallStatus: recallStatus.status,
        recallReference: recallStatus.recallReference,
        lastCheckedAt: Date.now()
      });
      return recallStatus;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      await syncProductsToAsyncStorage();
    }
  });

  // Met à jour des champs du produit (ex. la marque saisie) PUIS recalcule le statut
  // rappel avec les nouvelles valeurs. Saisir la vraie marque améliore le matching.
  const updateProductMutation = useMutation({
    mutationFn: async ({
      product,
      changes,
      recalls
    }: {
      product: ScannedProduct;
      changes: Partial<ScannedProduct>;
      recalls: RecallRecord[];
    }) => {
      const merged = { ...product, ...changes } as ScannedProduct;
      const recallStatus = getRecallStatus(merged, recalls);
      await updateFirestoreProduct(product.id, {
        ...changes,
        recallStatus: recallStatus.status,
        recallReference: recallStatus.recallReference,
        lastCheckedAt: Date.now()
      });
      return { ...merged, recallStatus: recallStatus.status, recallReference: recallStatus.recallReference };
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      await syncProductsToAsyncStorage();
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await removeFirestoreProduct(id);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      await syncProductsToAsyncStorage();
    }
  });

  const addProduct = useCallback(
    (payload: Omit<ScannedProduct, 'id' | 'scannedAt' | 'recallStatus'>) => addMutation.mutateAsync(payload),
    [addMutation]
  );

  const updateRecall = useCallback(
    (product: ScannedProduct, recalls: RecallRecord[]) =>
      updateRecallMutation.mutateAsync({ product, recalls }),
    [updateRecallMutation]
  );

  const updateProduct = useCallback(
    (product: ScannedProduct, changes: Partial<ScannedProduct>, recalls: RecallRecord[]) =>
      updateProductMutation.mutateAsync({ product, changes, recalls }),
    [updateProductMutation]
  );

  const removeProduct = useCallback((id: string) => removeMutation.mutateAsync(id), [removeMutation]);

  return {
    products: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addProduct,
    updateRecall,
    updateProduct,
    removeProduct
  };
}
