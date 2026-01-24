import { RecallRecord } from '../types';
import { fetchRecallsByCountry } from './apiService';

function normalizeLot(lot: string) {
  return lot
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '')
    .replace(/\./g, '')
    .toUpperCase();
}

/**
 * Vérifie si un candidat de numéro de lot matche avec un lot de rappel
 */
function matchCandidate(candidate: string, recallLot: string): boolean {
  const normalized = normalizeLot(candidate);
  const recallNormalized = normalizeLot(recallLot);

  // Match exact
  if (normalized === recallNormalized) {
    return true;
  }

  // Match partiel (le candidat contient le lot de rappel ou vice versa)
  if (normalized.includes(recallNormalized) || recallNormalized.includes(normalized)) {
    return true;
  }

  return false;
}

export interface CandidateMatchResult {
  hasRecall: boolean;
  matchedCandidate?: string;
  matchedRecall?: RecallRecord;
}

/**
 * Vérifie tous les candidats de numéros de lot contre les rappels d'une marque
 */
export async function checkAllCandidates(
  candidates: string[],
  brand: string,
  country: string
): Promise<CandidateMatchResult> {
  console.log('[checkAllCandidates] Checking candidates:', candidates);
  console.log('[checkAllCandidates] Brand:', brand);

  try {
    // Récupérer les rappels du pays
    const allRecalls = await fetchRecallsByCountry(country as any);

    // Filtrer par marque
    const brandRecalls = allRecalls.filter(recall =>
      recall.brand?.toLowerCase() === brand.toLowerCase()
    );

    console.log(`[checkAllCandidates] Found ${brandRecalls.length} recalls for brand ${brand}`);

    // Vérifier chaque candidat contre chaque rappel
    for (const candidate of candidates) {
      for (const recall of brandRecalls) {
        // Vérifier si ce candidat matche avec un des numéros de lot du rappel
        for (const recallLot of recall.lotNumbers) {
          if (matchCandidate(candidate, recallLot)) {
            console.log(`[checkAllCandidates] ✅ MATCH FOUND! Candidate "${candidate}" matches recall lot "${recallLot}"`);
            return {
              hasRecall: true,
              matchedCandidate: candidate,
              matchedRecall: recall
            };
          }
        }
      }
    }

    console.log('[checkAllCandidates] No matches found - product is safe');
    return {
      hasRecall: false
    };
  } catch (error) {
    console.error('[checkAllCandidates] Error checking recalls:', error);
    throw error;
  }
}
