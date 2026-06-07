import { RecallRecord } from '../types';
import { fetchRecallsByCountry } from './apiService';
import { levenshteinDistance, isKnownBrand } from '../utils/lotMatcher';

function normalizeLot(lot: string) {
  return lot
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '')
    .replace(/\./g, '')
    .replace(/\//g, '') // "4100/01473" → "410001473" pour matcher les rappels
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

  // Tolérance OCR : 1 caractère d'écart (un chiffre en trop/en moins, une lettre
  // confondue). On se limite aux codes assez longs et de longueur comparable pour
  // éviter les faux positifs sur des fragments courts. Côté sécurité alimentaire,
  // mieux vaut sur-alerter que rater un rappel à cause d'une coquille OCR.
  if (
    recallNormalized.length >= 6 &&
    Math.abs(normalized.length - recallNormalized.length) <= 1 &&
    levenshteinDistance(normalized, recallNormalized) <= 1
  ) {
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

    // Marque fiable → filtrer par marque (marque + lot). Marque inconnue (OFF ne
    // l'a pas fournie) → NE PAS filtrer sur la marque : on cherche le numéro de lot
    // sur TOUS les rappels du pays (sécurité : ne pas rater un rappel faute de marque).
    const brandKnown = isKnownBrand(brand);
    const brandRecalls = brandKnown
      ? allRecalls.filter(recall => recall.brand?.toLowerCase() === brand.toLowerCase())
      : allRecalls;

    console.log(`[checkAllCandidates] Brand "${brand}" known=${brandKnown} → checking ${brandRecalls.length} recalls`);

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
