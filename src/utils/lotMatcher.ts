import { ScannedProduct, RecallRecord } from '../types';

function normalizeLot(lot: string) {
  return lot
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '')
    .toUpperCase();
}

function normalizeBrand(brand: string) {
  return brand
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
}

// Valeurs "marque non fournie" (OpenFoodFacts n'a pas la marque) à traiter comme
// INCONNUE → on ne filtre alors PAS sur la marque et on s'appuie sur le numéro de
// lot seul (sécurité : ne pas rater un rappel faute de marque). Si la marque est
// fiable, on garde le filtrage marque + lot.
export function isKnownBrand(brand?: string | null): boolean {
  if (!brand) return false;
  const b = brand.trim().toLowerCase();
  if (!b) return false;
  const UNKNOWN = ['marque inconnue', 'unknown brand', 'unknown', 'produit inconnu', 'unknown product'];
  return !UNKNOWN.includes(b);
}

export function levenshteinDistance(a: string, b: string) {
  const matrix: number[][] = [];

  const aLen = a.length;
  const bLen = b.length;

  for (let i = 0; i <= bLen; i += 1) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= aLen; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLen; i += 1) {
    for (let j = 1; j <= aLen; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[bLen][aLen];
}

function matchBrands(productBrand: string, recallBrand: string | undefined) {
  if (!recallBrand || !productBrand) {
    return true;
  }

  const normalizedProduct = normalizeBrand(productBrand);
  const normalizedRecall = normalizeBrand(recallBrand);

  if (normalizedProduct === normalizedRecall) {
    return true;
  }

  if (normalizedProduct.includes(normalizedRecall) || normalizedRecall.includes(normalizedProduct)) {
    return true;
  }

  const maxLength = Math.max(normalizedProduct.length, normalizedRecall.length);
  const distance = levenshteinDistance(normalizedProduct, normalizedRecall);
  const threshold = Math.ceil(maxLength * 0.3);

  return distance <= threshold;
}

export function matchLots(product: ScannedProduct, recall: RecallRecord) {
  const normalized = normalizeLot(product.lotNumber);

  const matches = recall.lotNumbers.some((lot) => {
    const candidate = normalizeLot(lot);

    if (candidate === normalized) {
      return true;
    }

    if (candidate.includes(normalized) || normalized.includes(candidate)) {
      return true;
    }

    if (Math.abs(candidate.length - normalized.length) > 2) {
      return false;
    }

    const distance = levenshteinDistance(candidate, normalized);
    return distance <= 2;
  });

  return matches;
}

// Longueur minimale d'un lot pour autoriser un match SANS marque (anti faux positif).
const MIN_UNKNOWN_BRAND_LOT_LEN = 6;

// Normalisation stricte : retire espaces et TOUS les séparateurs ("4100/01473" → "410001473").
function normalizeLotStrict(lot: string) {
  return (lot || '').replace(/\s+/g, '').replace(/[-_./]/g, '').toUpperCase();
}

// Match EXACT du lot (ni sous-chaîne ni flou) avec longueur minimale. Utilisé quand la
// marque est INCONNUE : sans corroboration par la marque, un match permissif (sous-chaîne
// /Levenshtein) déclencherait de fausses alertes "rappel" sur la masse des rappels.
export function lotMatchesStrict(candidates: string[], recallLots: string[] | undefined): boolean {
  const recalls = (recallLots ?? [])
    .map(normalizeLotStrict)
    .filter((r) => r.length >= MIN_UNKNOWN_BRAND_LOT_LEN);
  if (recalls.length === 0) return false;
  return candidates
    .map(normalizeLotStrict)
    .filter((c) => c.length >= MIN_UNKNOWN_BRAND_LOT_LEN)
    .some((c) => recalls.includes(c));
}

export function getRecallStatus(product: ScannedProduct, recalls: RecallRecord[]) {
  const brandKnown = isKnownBrand(product.brand);
  const relevant = recalls.filter((recall) => {
    if (!brandKnown) {
      // Marque inconnue → match de lot EXACT et assez long (anti faux positif).
      return lotMatchesStrict([product.lotNumber], recall.lotNumbers);
    }
    const brandMatches = matchBrands(product.brand, recall.brand);
    const lotMatches = matchLots(product, recall);
    return brandMatches && lotMatches;
  });

  if (relevant.length === 0) {
    // Marque inconnue : "aucun rappel trouvé par le lot" ne GARANTIT PAS la sécurité
    // (aucune corroboration par la marque) → statut INCONNU, l'utilisateur doit saisir
    // la marque pour une vérification fiable. Marque connue → réellement sûr.
    return {
      status: brandKnown ? ('safe' as const) : ('unknown' as const),
      recallReference: undefined
    };
  }

  return {
    status: 'recalled' as const,
    recallReference: relevant[0].id
  };
}
