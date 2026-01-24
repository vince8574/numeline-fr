// Service pour gérer les marques depuis Firestore
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseSync } from 'expo-sqlite';
import localBrands from '../data/brands.json';

const CACHE_EXPIRY_DAYS = 7; // Cache expires after 7 days
const SYNC_FLAG_KEY = 'brandsSynced_v1';
const DB_NAME = 'numelinefr.db';
const TABLE = 'brands_cache';

// Build an in-memory map of bundled brands for instant, offline lookup
const localBrandsByLetter: Record<string, string[]> = {};
if (Array.isArray(localBrands)) {
  localBrands.forEach((brand: string) => {
    const normalized = brand
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    const firstChar = normalized.charAt(0);
    const letter = /[a-z]/.test(firstChar) ? firstChar : '0';
    if (!localBrandsByLetter[letter]) {
      localBrandsByLetter[letter] = [];
    }
    localBrandsByLetter[letter].push(brand);
  });
}

// Normalize brand name for search
function normalizeBrand(brand: string): string {
  return brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Get first letter for Firestore document lookup
function getFirstLetter(searchText: string): string {
  const normalized = normalizeBrand(searchText);
  const firstChar = normalized.charAt(0);
  return /[a-z]/.test(firstChar) ? firstChar : '0';
}

// Local cache management (SQLite-backed)
const brandDb = openDatabaseSync(DB_NAME);

function ensureBrandCacheSchema() {
  try {
    brandDb.execSync(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        letter TEXT PRIMARY KEY NOT NULL,
        brands TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );`
    );
  } catch (error) {
    console.warn('[BrandCache] Failed to ensure schema:', error);
  }
}
ensureBrandCacheSchema();

class BrandCache {
  private cache: Map<string, { brands: string[]; timestamp: number }> = new Map();
  private loaded = false;

  async load() {
    if (this.loaded) return;
    try {
      const rows = brandDb.getAllSync<{ letter: string; brands: string; timestamp: number }>(
        `SELECT letter, brands, timestamp FROM ${TABLE}`
      );
      rows.forEach((row) => {
        const data = {
          brands: JSON.parse(row.brands) as string[],
          timestamp: row.timestamp
        };
        this.cache.set(row.letter, data);
      });
      this.loaded = true;
      console.log(`[BrandCache] Loaded ${this.cache.size} cached letter groups (SQLite)`);
    } catch (error) {
      console.warn('[BrandCache] Failed to load cache:', error);
    }
  }

  get(letter: string): string[] | null {
    const cached = this.cache.get(letter);
    if (!cached) return null;

    const ageInDays = (Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24);
    if (ageInDays > CACHE_EXPIRY_DAYS) {
      this.cache.delete(letter);
      this.delete(letter);
      return null;
    }

    return cached.brands;
  }

  async set(letter: string, brands: string[]) {
    const data = { brands, timestamp: Date.now() };
    this.cache.set(letter, data);
    try {
      brandDb.runSync(
        `INSERT OR REPLACE INTO ${TABLE} (letter, brands, timestamp) VALUES (?, ?, ?)`,
        [letter, JSON.stringify(brands), data.timestamp]
      );
    } catch (error) {
      console.warn(`[BrandCache] Failed to cache letter ${letter}:`, error);
    }
  }

  delete(letter: string) {
    try {
      brandDb.runSync(`DELETE FROM ${TABLE} WHERE letter = ?`, [letter]);
      this.cache.delete(letter);
    } catch (error) {
      console.warn(`[BrandCache] Failed to delete cache for letter ${letter}:`, error);
    }
  }
}

const brandCache = new BrandCache();
let cacheLoaded = false;
let initialSyncCompleted = false;

/**
 * Search brands from Firestore with local caching
 */
export async function searchBrands(searchText: string, limit: number = 10): Promise<string[]> {
  if (!searchText || searchText.length < 2) {
    return [];
  }

  // First-run bootstrap: download all Firestore brands once to local cache
  await ensureInitialSync();

  // Load cache on first use
  if (!cacheLoaded) {
    await brandCache.load();
    cacheLoaded = true;
  }

  const letter = getFirstLetter(searchText);
  const normalized = normalizeBrand(searchText);

  console.log(`[FirestoreBrands] Searching for "${searchText}" (letter: ${letter})`);

  const synced = initialSyncCompleted || (await AsyncStorage.getItem(SYNC_FLAG_KEY)) === 'true';

  // Try cache first
  let brands = brandCache.get(letter);

  // If no cached data, use bundled brands immediately for reactivity
  if (!brands || brands.length === 0) {
    const local = localBrandsByLetter[letter] || [];
    if (local.length > 0) {
      brands = local;
    }
  }

  // If still nothing and not yet synced, fetch from Firestore synchronously
  if ((!brands || brands.length === 0) && !synced) {
    brands = await fetchAndCacheBrands(letter);
  }

  if (!brands || brands.length === 0) {
    return [];
  }

  // Filter and score matches
  const matches: { brand: string; score: number }[] = [];

  brands.forEach(brand => {
    const brandNormalized = normalizeBrand(brand);

    if (brandNormalized.startsWith(normalized)) {
      // Exact prefix match - highest priority
      matches.push({ brand, score: 100 });
    } else if (brandNormalized.includes(normalized)) {
      // Contains match - lower priority
      matches.push({ brand, score: 50 });
    } else {
      // Fuzzy match (Levenshtein distance could be added here)
      const similarity = calculateSimilarity(normalized, brandNormalized);
      if (similarity > 0.7) {
        matches.push({ brand, score: similarity * 40 });
      }
    }
  });

  // Sort by score and return top results
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(m => m.brand);
}

/**
 * Fetch a letter group from Firestore (supports chunked docs) and cache it
 */
async function fetchAndCacheBrands(letter: string): Promise<string[]> {
  try {
    console.log(`[FirestoreBrands] Fetching letter "${letter}" from Firestore...`);

    const singleDoc = await firestore().collection("brands").doc(letter).get();
    const singleDocData = singleDoc.exists ? singleDoc.data() || {} : null;
    const totalChunks = singleDocData?.totalChunks ?? 1;

    let brands: string[] = [];

    if (singleDoc.exists) {
      brands = singleDocData?.brands || [];
      console.log(`[FirestoreBrands] Fetched ${brands.length} brands for letter "${letter}" (single doc, totalChunks=${totalChunks})`);
    }

    if (totalChunks > 1 || !singleDoc.exists) {
      console.log(`[FirestoreBrands] Checking for chunked documents for letter "${letter}"...`);

      const snapshot = await firestore().collection('brands').get();
      const chunkedDocs = snapshot.docs.filter((doc) => doc.id === letter || doc.id.startsWith(`${letter}_`));

      brands = [];
      chunkedDocs.forEach((doc) => {
        const chunkBrands = doc.data()?.brands || [];
        brands = brands.concat(chunkBrands);
      });

      console.log(`[FirestoreBrands] Fetched ${brands.length} brands from ${chunkedDocs.length} chunks for letter "${letter}"`);
    }

    if (brands.length > 0) {
      await brandCache.set(letter, brands);
    } else {
      console.warn(`[FirestoreBrands] No brands found for letter "${letter}"`);
    }

    return brands;
  } catch (error) {
    console.error("[FirestoreBrands] Firestore fetch error:", error);
    return [];
  }
}

/**
 * Simple similarity score (can be improved with Levenshtein)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
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

  return matrix[str2.length][str1.length];
}

/**
 * Ensure that all Firestore brands are downloaded once on first launch
 * and cached locally per letter.
 */
async function ensureInitialSync() {
  try {
    const alreadySynced = await AsyncStorage.getItem(SYNC_FLAG_KEY);
    if (alreadySynced === 'true') {
      initialSyncCompleted = true;
      return;
    }

    console.log('[FirestoreBrands] Initial sync started (one-time full download)...');
    const success = await downloadAllBrandsToCache();
    if (success) {
      await AsyncStorage.setItem(SYNC_FLAG_KEY, 'true');
      initialSyncCompleted = true;
      console.log('[FirestoreBrands] Initial sync completed and cached.');
    } else {
      console.warn('[FirestoreBrands] Initial sync failed; will retry on next launch.');
    }
  } catch (error) {
    console.warn('[FirestoreBrands] Initial sync check failed:', error);
  }
}

/**
 * Download all brand documents from Firestore and cache them locally per letter.
 */
async function downloadAllBrandsToCache(): Promise<boolean> {
  try {
    const snapshot = await firestore().collection('brands').get();
    const grouped: Record<string, string[]> = {};

    snapshot.docs.forEach((doc) => {
      const id = doc.id;
      if (id === '_metadata') return;
      const data = doc.data() || {};
      const docBrands: string[] = Array.isArray(data.brands) ? data.brands : [];
      const explicitLetter: string | undefined = data.letter;
      const inferredLetter = id.split('_')[0] || '0';
      const letter = /[a-z]/.test((explicitLetter || inferredLetter || '0')[0].toLowerCase())
        ? (explicitLetter || inferredLetter).toLowerCase()
        : '0';

      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(...docBrands);
    });

    const letters = Object.keys(grouped);
    if (letters.length === 0) {
      console.warn('[FirestoreBrands] No documents found during full download.');
      return false;
    }

    for (const letter of letters) {
      const unique = Array.from(new Set(grouped[letter]));
      await brandCache.set(letter, unique);
    }

    console.log(`[FirestoreBrands] Cached full dataset for ${letters.length} letters.`);
    return true;
  } catch (error) {
    console.error('[FirestoreBrands] Failed to download all brands:', error);
    return false;
  }
}

/**
 * Add a new brand to Firestore (user contribution)
 */
export async function addBrandToFirestore(brandName: string): Promise<boolean> {
  try {
    const letter = getFirstLetter(brandName);
    const docRef = firestore().collection('brands').doc(letter);

    await firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (doc.exists) {
        const currentBrands = doc.data()?.brands || [];

        // Check if brand already exists
        if (!currentBrands.includes(brandName)) {
          currentBrands.push(brandName);
          currentBrands.sort();

          transaction.update(docRef, {
            brands: currentBrands,
            count: currentBrands.length,
            lastUpdated: firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // Create new document
        transaction.set(docRef, {
          brands: [brandName],
          count: 1,
          lastUpdated: firestore.FieldValue.serverTimestamp()
        });
      }
    });

    // Invalidate cache for this letter
    brandCache.delete(letter);

    console.log(`✓ Added brand "${brandName}" to Firestore`);
    return true;
  } catch (error) {
    console.error('[FirestoreBrands] Failed to add brand:', error);
    return false;
  }
}
