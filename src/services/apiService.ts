import { RecallRecord, CountryCode, ApiError } from '../types';

type RecallResponse = {
  results: RecallRecord[];
};

const FRANCE_ENDPOINT =
  'https://data.economie.gouv.fr/api/records/1.0/search/?dataset=rappelconso0&rows=50&sort=date_de_publication';

const USA_ENDPOINT = 'https://api.fda.gov/food/enforcement.json?limit=50';

function extractLotNumbers(identificationText: string | undefined): string[] {
  if (!identificationText) return [];

  // Split by common separators and extract potential lot numbers
  const parts = identificationText.split(/[\n,;]/);
  const lotNumbers: string[] = [];

  // Add the full identification text as one potential lot match
  lotNumbers.push(identificationText);

  // Also add individual parts
  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      lotNumbers.push(trimmed);
    }
  });

  return lotNumbers;
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

  return (data.records ?? []).map((record: any) => ({
    id: record.recordid,
    title: record.fields?.noms_des_modeles_ou_references || record.fields?.libelle || 'Produit rappelé',
    description: record.fields?.motif_du_rappel,
    lotNumbers: extractLotNumbers(record.fields?.identification_des_produits),
    brand: record.fields?.nom_de_la_marque_du_produit,
    productCategory: record.fields?.categorie_de_produit,
    country: 'FR' as const,
    publishedAt: record.fields?.date_de_publication,
    link: record.fields?.lien_vers_la_fiche_rappel,
    imageUrl: record.fields?.liens_vers_les_images?.[0] || undefined
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
