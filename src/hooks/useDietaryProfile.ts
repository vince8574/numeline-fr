import { useEffect, useRef } from 'react';
import { useDietaryProfileStore } from '../stores/useDietaryProfileStore';
import { useUserStore } from '../stores/useUserStore';
import { saveDietaryProfileToFirestore } from '../services/firestoreDietaryProfileService';
import {
  checkProductAgainstProfile,
  type DietaryCheckResult
} from '../services/dietaryCheckService';
import type { ProductInfo } from '../services/openFoodFactsService';

// Hook du profil alimentaire : expose l'état + les actions du store, sauvegarde
// automatiquement dans Firestore (debounce) à chaque changement pour l'utilisateur
// connecté, et fournit `checkProduct` (détection produit vs profil, coût IA nul).

// Sérialise l'état surveillé pour détecter un changement réel. Inclut la preuve
// de consentement : accepter le consentement (sans toucher aux profils) doit AUSSI
// déclencher une sauvegarde Firestore (accountability côté serveur).
function serialize(s: ReturnType<typeof useDietaryProfileStore.getState>): string {
  return JSON.stringify({
    people: s.people,
    healthConsentAt: s.healthConsentAt,
    healthConsentVersion: s.healthConsentVersion
  });
}

export function useDietaryProfile() {
  const store = useDietaryProfileStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const signature = serialize(store);

  useEffect(() => {
    const uid = useUserStore.getState().uid;
    if (!uid) return; // pas connecté → uniquement local (AsyncStorage)
    // Ignore la 1re passe (hydratation) : ne sauve que sur un vrai changement.
    if (lastSavedRef.current === null) {
      lastSavedRef.current = signature;
      return;
    }
    if (lastSavedRef.current === signature) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = signature;
      void saveDietaryProfileToFirestore(uid, useDietaryProfileStore.getState().getProfile());
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [signature]);

  return store;
}

/**
 * Détection produit vs profil courant. Pure (aucun réseau) — utilisable partout
 * (bandeau de scan, fiche produit). Renvoie null si le profil est vide.
 */
export function checkProductForCurrentProfile(product: ProductInfo): DietaryCheckResult {
  const s = useDietaryProfileStore.getState();
  return checkProductAgainstProfile(
    {
      productName: product.productName,
      allergensTags: product.allergensTags,
      tracesTags: product.tracesTags,
      ingredientsText: product.ingredientsText,
      ingredientsTags: product.ingredientsTags,
      ingredientsAnalysisTags: product.ingredientsAnalysisTags,
      nutriments: product.nutriments
    },
    s.getProfile()
  );
}
