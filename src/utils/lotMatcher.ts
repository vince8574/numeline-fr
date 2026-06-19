import { ScannedProduct, RecallRecord } from '../types';

function normalizeLot(lot: string) {
  return lot
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '')
    .toUpperCase();
}

// Un lot est DISTINCTIF s'il porte assez d'entropie pour identifier un rappel
// SANS corroboration de marque. Un code court purement numérique (ex. "25041")
// entre en collision avec des rappels sans rapport (codes date courts, séquences
// courtes) → fausse alerte "RAPPELÉ" sur un produit étranger. Règle :
// alphanumérique (présence d'une lettre) → 4+ ; purement numérique → 6+ chiffres.
export function isDistinctiveLot(lot: string): boolean {
  const n = normalizeLot(lot);
  if (/[A-Z]/.test(n)) return n.length >= 4;
  return n.length >= 6;
}

function normalizeBrand(brand: string) {
  return brand
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
}

function isUnknownBrand(brand: string) {
  const normalized = normalizeBrand(brand);

  // Empty, N/A or translated "unknown" placeholders should not block matches
  if (!normalized) {
    return true;
  }

  // Placeholders LONGS : startsWith pour attraper "Unknown Brand" / "Unknown
  // Product" (normalisés "UNKNOWNBRAND"...) et "Inconnue", etc.
  // "MARQUEINCONNUE"/"PRODUITINCONNU" : placeholders FR (DEFAULT_BRAND_NAME).
  const longPlaceholders = [
    'UNKNOWN',
    'INCONNU',
    'MARQUEINCONNUE',
    'PRODUITINCONNU',
    'DESCONOCIDO',
    'DESCONHECIDO',
    'SCONOSCIUTO',
    'UNBEKANNT',
    'ONBEKEND'
  ];
  if (longPlaceholders.some((tok) => normalized.startsWith(tok))) {
    return true;
  }

  // Codes COURTS : match EXACT uniquement. Avant, startsWith avec "NA"/"UNK"/"NONE"
  // classait des MARQUES RÉELLES comme inconnues ("NAVITAS", "NATURE", "UNILEVER",
  // "NABISCO"…). Une marque "inconnue" fait que matchBrands renvoie vrai pour TOUS
  // les produits → un rappel sans numéro de lot matchait alors TOUTE la base
  // (fausses alertes "DO NOT CONSUME" massives, ex. rappel FDA H-0533-2026/Navitas).
  return ['UNK', 'NA', 'NAN', 'NONE', 'NULL'].includes(normalized);
}

// Variante publique utilisée par les écrans FR (DetailScreen, ScanScreen…) :
// marque exploitable = non vide et pas un placeholder "inconnue".
export function isKnownBrand(brand?: string | null): boolean {
  if (!brand || !brand.trim()) return false;
  return !isUnknownBrand(brand);
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
  if (!recallBrand || !productBrand || isUnknownBrand(productBrand) || isUnknownBrand(recallBrand)) {
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

  // Lots trop courts → trop de faux positifs.
  if (normalized.length < 4) {
    return false;
  }

  return (recall.lotNumbers ?? []).some((lot) => {
    const candidate = normalizeLot(lot);

    if (!candidate || candidate.length < 4) {
      return false;
    }

    // Match exact (après normalisation).
    if (candidate === normalized) {
      return true;
    }

    // Sous-chaîne SÛRE uniquement : le lot SCANNÉ (≥8 car.) entièrement contenu
    // dans le lot du rappel (cas légitime où la base liste le lot noyé dans un
    // texte plus long). On NE matche PLUS le sens inverse (un fragment court de
    // rappel contenu dans un lot scanné/mal lu), source de fausses alertes sur
    // les lots OCR imparfaits.
    if (normalized.length >= 8 && candidate.includes(normalized)) {
      return true;
    }

    // PAS de matching flou (Levenshtein) sur les lots : source majeure de fausses
    // alertes.
    return false;
  });
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

/**
 * Single source of truth: does a recall record match a scanned product?
 * Combines fuzzy brand matching, fuzzy + substring lot matching, and the
 * "global product line recall" fallback (recall with no specific lots).
 */
export function recallMatchesProduct(
  product: { brand: string; lotNumber: string },
  recall: { brand?: string; lotNumbers?: string[] }
): boolean {
  // Marque INCONNUE : aucune corroboration possible par la marque, donc on
  // exige un match de lot EXACT (ni sous-chaîne ni flou) et assez long. Sinon
  // un lot-poubelle ("GRFG", "APR2026"…) matche n'importe quel rappel de la
  // base → fausses notifications "NE CONSOMMEZ PAS".
  if (isUnknownBrand(product.brand)) {
    // Marque produit inconnue → aucune corroboration : le lot doit être DISTINCTIF.
    if (!isDistinctiveLot(product.lotNumber)) {
      return false;
    }
    const normalized = normalizeLot(product.lotNumber);
    return (recall.lotNumbers ?? []).some((lot) => normalizeLot(lot) === normalized);
  }

  const lotMatches = matchLots(product as ScannedProduct, recall as RecallRecord);
  if (!lotMatches) {
    // Rappel SANS numéro de lot : PAS de match sur la seule marque (sinon un rappel
    // "toutes séries" mal parsé flague toute une gamme). Mieux vaut un faux négatif
    // silencieux qu'une fausse alerte "NE CONSOMMEZ PAS".
    return false;
  }

  const recallHasUsableBrand =
    !!recall.brand && recall.brand.trim() !== '' && !isUnknownBrand(recall.brand);

  // Rappel SANS marque exploitable : le lot doit suffire À LUI SEUL → DISTINCTIF.
  // Un lot court purement numérique ("25041") ne peut pas asserter un rappel seul.
  if (!recallHasUsableBrand) {
    return isDistinctiveLot(product.lotNumber);
  }

  // Rappel AVEC marque exploitable : exiger marque ET lot.
  if (matchBrands(product.brand, recall.brand)) {
    return true;
  }

  // Lot identique mais marque du rappel différente du produit → pas ce produit.
  return false;
}

export function getRecallStatus(product: ScannedProduct, recalls: RecallRecord[]) {
  const relevant = recalls.filter((recall) => recallMatchesProduct(product, recall));

  if (relevant.length === 0) {
    // Marque inconnue : "aucun rappel trouvé par le lot" ne GARANTIT PAS la sécurité
    // (aucune corroboration par la marque) → statut INCONNU, l'utilisateur doit saisir
    // la marque pour une vérification fiable. Marque connue → réellement sûr.
    return {
      status: isKnownBrand(product.brand) ? ('safe' as const) : ('unknown' as const),
      recallReference: undefined
    };
  }

  return {
    status: 'recalled' as const,
    recallReference: relevant[0].id
  };
}
