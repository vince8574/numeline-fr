import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nanoid } from 'nanoid/non-secure';
import { useCallback } from 'react';
import { db } from '../services/dbService';
import { ScannedProduct, RecallRecord } from '../types';
import { getRecallStatus } from '../utils/lotMatcher';

const QUERY_KEY = ['scanned-products'];

async function loadProducts() {
  return db.getAll();
}

export function useScannedProducts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadProducts
  });

  const addMutation = useMutation({
    mutationFn: async (payload: Omit<ScannedProduct, 'id' | 'scannedAt' | 'recallStatus'>) => {
      const product: ScannedProduct = {
        ...payload,
        id: nanoid(),
        scannedAt: Date.now(),
        recallStatus: 'unknown'
      };
      await db.insert(product);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
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
      await db.update(product.id, {
        recallStatus: recallStatus.status,
        recallReference: recallStatus.recallReference,
        lastCheckedAt: Date.now()
      });
      return recallStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await db.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
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

  const removeProduct = useCallback((id: string) => removeMutation.mutateAsync(id), [removeMutation]);

  return {
    products: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addProduct,
    updateRecall,
    removeProduct
  };
}
