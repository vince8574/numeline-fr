// src/services/brandMatcher.ts
import { getAllCustomBrands } from './customBrandsService';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

// Empty array initially - brands will be loaded from assets
const brandsData: string[] = [];

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

function similarityScore(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLength;
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Retire les accents
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

export interface BrandMatch {
  brand: string;
  confidence: number;
  isExactMatch: boolean;
}

export class BrandMatcher {
  private brands: Set<string>;
  private normalizedBrands: Map<string, string>;

  constructor(brandList: string[]) {
    this.brands = new Set(brandList);
    this.normalizedBrands = new Map();
    
    brandList.forEach(brand => {
      const normalized = normalizeString(brand);
      this.normalizedBrands.set(normalized, brand);
    });
  }

  findBestMatch(ocrText: string, threshold: number = 0.7): BrandMatch | null {
    if (!ocrText || ocrText.trim().length < 2) {
      return null;
    }

    const normalized = normalizeString(ocrText);
    
    // 1. Correspondance exacte
    if (this.normalizedBrands.has(normalized)) {
      return {
        brand: this.normalizedBrands.get(normalized)!,
        confidence: 1.0,
        isExactMatch: true
      };
    }

    // 2. Correspondance partielle
    for (const [normalizedBrand, originalBrand] of this.normalizedBrands.entries()) {
      if (normalized.includes(normalizedBrand) || normalizedBrand.includes(normalized)) {
        const score = Math.min(normalized.length, normalizedBrand.length) / 
                     Math.max(normalized.length, normalizedBrand.length);
        if (score >= 0.7) {
          return {
            brand: originalBrand,
            confidence: 0.95,
            isExactMatch: false
          };
        }
      }
    }

    // 3. Distance de Levenshtein
    let bestMatch: BrandMatch | null = null;
    let bestScore = 0;

    for (const brand of this.brands) {
      const score = similarityScore(ocrText, brand);
      
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = {
          brand,
          confidence: score,
          isExactMatch: false
        };
      }
    }

    return bestMatch;
  }

  findTopMatches(ocrText: string, limit: number = 3, threshold: number = 0.6): BrandMatch[] {
    if (!ocrText || ocrText.trim().length < 2) {
      return [];
    }

    const matches: BrandMatch[] = [];

    for (const brand of this.brands) {
      const score = similarityScore(ocrText, brand);
      
      if (score >= threshold) {
        matches.push({
          brand,
          confidence: score,
          isExactMatch: score === 1.0
        });
      }
    }

    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  extractBrandsFromText(ocrText: string, threshold: number = 0.75): BrandMatch[] {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
    const foundBrands: BrandMatch[] = [];
    const seenBrands = new Set<string>();

    for (const line of lines) {
      const match = this.findBestMatch(line, threshold);
      
      if (match && !seenBrands.has(match.brand)) {
        foundBrands.push(match);
        seenBrands.add(match.brand);
      }
    }

    return foundBrands.sort((a, b) => b.confidence - a.confidence);
  }

  brandExists(brand: string): boolean {
    return this.brands.has(brand) || 
           this.normalizedBrands.has(normalizeString(brand));
  }

  getAllBrands(): string[] {
    return Array.from(this.brands);
  }

  getBrandCount(): number {
    return this.brands.size;
  }
}

// Instance singleton
let brandMatcherInstance: BrandMatcher | null = null;
let baseBrandsCache: string[] | null = null;

// URL where brands.json is hosted (Firebase Storage or CDN)
const BRANDS_URL = 'https://storage.googleapis.com/YOUR_BUCKET/brands/brands.json';
const LOCAL_BRANDS_PATH = `${FileSystem.documentDirectory}brands.json`;

/**
 * Charge les marques depuis Firebase Storage ou cache local
 */
async function loadBrandsFromAssets(): Promise<string[]> {
  // Firestore est désormais la source des marques : on ne tente plus de lire les split/apk.
  // On renvoie un tableau vide pour éviter les accès fichiers réseau superflus.
  if (baseBrandsCache) {
    return baseBrandsCache;
  }
  baseBrandsCache = [];
  console.log('[BrandMatcher] Skipping local/asset brand load (using Firestore suggestions)');
  return baseBrandsCache;
}

/**
 * Récupère l'instance du BrandMatcher
 * Charge automatiquement les marques de base + marques personnalisées
 */
export async function getBrandMatcher(): Promise<BrandMatcher> {
  if (!brandMatcherInstance) {
    await reloadBrandMatcher();
  }
  return brandMatcherInstance!;
}

/**
 * Recharge le BrandMatcher avec les marques de base + marques personnalisées
 * À appeler après l'ajout d'une nouvelle marque personnalisée
 */
export async function reloadBrandMatcher(): Promise<void> {
  const customBrands = await getAllCustomBrands();
  const customBrandNames = customBrands.map(cb => cb.name);

  // Charger les marques de base depuis les assets
  const baseBrands = await loadBrandsFromAssets();
  const allBrands = baseBrands.concat(customBrandNames);

  brandMatcherInstance = new BrandMatcher(allBrands);

  console.log(`✓ BrandMatcher initialized with ${baseBrands.length} base brands + ${customBrandNames.length} custom brands`);
}

/**
 * @deprecated Utiliser reloadBrandMatcher() à la place
 */
export function initializeBrandMatcher(customBrands: string[]): void {
  const baseBrands = Array.isArray(brandsData) ? brandsData : [];
  const allBrands = baseBrands.concat(customBrands);
  brandMatcherInstance = new BrandMatcher(allBrands);
}
