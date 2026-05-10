import { RecallRecord, CountryCode, ApiError } from '../types';

type RecallResponse = {
  results: RecallRecord[];
};

// data.economie.gouv.fr migrated from the legacy /api/records/1.0/ endpoint
// (now returning HTTP 403) to the Opendatasoft v2.1 explore API. The dataset
// id also changed: rappelconso0 -> rappelconso-v2-gtin-espaces. We refine on
// "alimentation" because the new dataset mixes food + non-food recalls.
const FRANCE_ENDPOINT =
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records' +
  '?limit=50&order_by=date_publication%20desc&where=categorie_produit%3D%22alimentation%22';

const USA_ENDPOINT = 'https://api.fda.gov/food/enforcement.json?limit=50';

// Pulls every plausible lot token out of one or more RappelConso
// identification strings. We keep the full text (for fuzzy substring matching)
// AND extract canonical lot values, because the API often wraps the real lot
// inside human prose like "lot : 091k - ddm : 10/2027" or "n° lot 180421".
// Without the canonical extraction, an OCR result of just "091K" would never
// match a recall whose lotNumbers entry is "lot : 091k - ddm : 10/2027".
function extractLotNumbers(identification: string | string[] | undefined): string[] {
  if (!identification) return [];

  // v2.1 API returns identification_produits as an array of strings; the legacy
  // API returned a single string. Support both shapes.
  const rawTexts = Array.isArray(identification) ? identification : [identification];
  const lotNumbers = new Set<string>();

  // "lot ...", "n° lot ...", "lot numéro ...", etc. → capture the value after
  // the prefix. Allow alphanumerics plus / - _ . and stop at whitespace.
  const lotPrefixRegex = /\b(?:lot(?:s)?(?:\s+num[ée]ro)?|n[°o]\s*lot|num[ée]ro\s+de\s+lot)\s*[:#]?\s*([A-Z0-9][A-Z0-9/_.-]{2,22})/gi;
  // Bare "L" + 3-15 digits (with optional trailing letters) — common on packaging.
  const standaloneLRegex = /\bL(\d{3,15}[A-Z0-9]{0,10})\b/gi;

  for (const text of rawTexts) {
    if (!text) continue;

    // Keep the raw text so the existing fuzzy substring matching still works.
    lotNumbers.add(text);

    // Split on \n , ; to keep each chunk addressable.
    text.split(/[\n,;]/).forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        lotNumbers.add(trimmed);
      }
    });

    // Canonical lot after a "lot ..." prefix.
    let m: RegExpExecArray | null;
    lotPrefixRegex.lastIndex = 0;
    while ((m = lotPrefixRegex.exec(text)) !== null) {
      if (m[1]) lotNumbers.add(m[1]);
    }

    // Bare L+digits → push both the "L1234" form and the digits-only form.
    standaloneLRegex.lastIndex = 0;
    while ((m = standaloneLRegex.exec(text)) !== null) {
      lotNumbers.add(m[0]);
      if (m[1]) lotNumbers.add(m[1]);
    }
  }

  return Array.from(lotNumbers);
}

const RECALL_FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, timeoutMs = RECALL_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFranceRecalls(): Promise<RecallRecord[]> {
  const response = await fetchWithTimeout(FRANCE_ENDPOINT);

  if (!response.ok) {
    const err: ApiError = {
      status: response.status,
      message: 'Impossible de récupérer les rappels RappelConso.'
    };
    throw err;
  }

  const data = await response.json();

  // v2.1 returns { total_count, results: [...] } with flat fields per record.
  return (data.results ?? []).map((record: any) => ({
    id: record.numero_fiche || String(record.id),
    title: record.modeles_ou_references || record.libelle || 'Produit rappelé',
    description: record.motif_rappel,
    lotNumbers: extractLotNumbers(record.identification_produits),
    brand: record.marque_produit,
    productCategory: record.categorie_produit,
    country: 'FR' as const,
    publishedAt: record.date_publication,
    link: record.lien_vers_la_fiche_rappel,
    imageUrl: Array.isArray(record.liens_vers_les_images)
      ? record.liens_vers_les_images[0]
      : record.liens_vers_les_images || undefined
  }));
}

export async function fetchUsRecalls(): Promise<RecallRecord[]> {
  const response = await fetchWithTimeout(USA_ENDPOINT);

  if (!response.ok) {
    const err: ApiError = {
      status: response.status,
      message: "Impossible de récupérer les rappels alimentaires américains."
    };
    throw err;
  }

  const data = await response.json();

  return (data.results ?? []).map((item: any) => ({
    id: item.recall_number,
    title: item.product_description,
    description: item.reason_for_recall,
    lotNumbers: item.code_info ? item.code_info.split(',').map((lot: string) => lot.trim()) : [],
    brand: item.recalling_firm,
    productCategory: item.product_description,
    country: 'US' as const,
    publishedAt: item.report_date,
    link: item.more_details,
    imageUrl: undefined
  }));
}

type RecallCacheEntry = { data: RecallRecord[]; at: number };
const recallCache = new Map<CountryCode, RecallCacheEntry>();
const inflightFetches = new Map<CountryCode, Promise<RecallRecord[]>>();
const RECALL_CACHE_TTL_MS = 5 * 60 * 1000;

export function clearRecallCache(country?: CountryCode) {
  if (country) {
    recallCache.delete(country);
  } else {
    recallCache.clear();
  }
}

export async function fetchRecallsByCountry(country: CountryCode): Promise<RecallRecord[]> {
  const now = Date.now();
  const cached = recallCache.get(country);
  if (cached && now - cached.at < RECALL_CACHE_TTL_MS) {
    return cached.data;
  }

  // Coalesce concurrent fetches pour le même pays
  const existing = inflightFetches.get(country);
  if (existing) {
    return existing;
  }

  const fetchPromise = (async () => {
    let data: RecallRecord[];
    switch (country) {
      case 'FR':
        data = await fetchFranceRecalls();
        break;
      case 'US':
        data = await fetchUsRecalls();
        break;
      case 'CH':
        data = [];
        break;
      default:
        data = [];
    }
    recallCache.set(country, { data, at: Date.now() });
    return data;
  })().finally(() => {
    inflightFetches.delete(country);
  });

  inflightFetches.set(country, fetchPromise);
  return fetchPromise;
}

export async function fetchAllRecalls(): Promise<RecallRecord[]> {
  const [fr, us] = await Promise.allSettled([fetchFranceRecalls(), fetchUsRecalls()]);

  const results: RecallRecord[] = [];

  if (fr.status === 'fulfilled') {
    results.push(...fr.value);
  }

  if (us.status === 'fulfilled') {
    results.push(...us.value);
  }

  return results;
}
