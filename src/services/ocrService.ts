// src/services/ocrService.ts
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { OCRResult } from '../types';
import { searchBrands } from './firestoreBrandsService';
import { DEFAULT_BRAND_NAME } from '../constants/defaults';
import { tryVisionFallback, assessOcrQuality } from './visionFallbackService';
import { tryClaudeFallback, hasPlausibleLotPattern } from './claudeOcrFallback';

const preprocessConfig = {
  resize: { width: 1800 }, // Résolution optimale pour ML Kit (trop élevé peut dégrader la précision)
  format: SaveFormat.PNG,
  compress: 1 // Pas de compression pour garder la qualité maximale
} as const;

const visionPreprocessConfig = {
  // 2000 px suffit largement pour l'OCR du lot ; 3000 px alourdit l'upload pour rien.
  // JPEG (au lieu de PNG sans compression) = image ~5-10× plus légère → upload réseau
  // bien plus rapide vers les Cloud Functions Vision/Claude (le vrai goulot de temps).
  resize: { width: 2000 },
  format: SaveFormat.JPEG,
  compress: 0.85
} as const;

const MLKIT_UNAVAILABLE_MESSAGE =
  'OCR necessita une build native (development ou production). Installez numelineFR via EAS Build pour activer la reconnaissance.';

function ensureMlkitAvailable() {
  if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
    throw new Error(MLKIT_UNAVAILABLE_MESSAGE);
  }
}

type PreprocessOptions = {
  cropForLot?: boolean;
  narrowBand?: boolean;
  useVisionConfig?: boolean; // Utiliser la config haute résolution pour Google Vision
};

export async function preprocessImage(uri: string, options?: PreprocessOptions) {
  // Étape 1 : upscale pour améliorer le détail
  const config = options?.useVisionConfig ? visionPreprocessConfig : preprocessConfig;
  const resized = await manipulateAsync(
    uri,
    [{ resize: config.resize }],
    {
      compress: config.compress,
      format: config.format
    }
  );

  let processedUri = resized.uri;

  // Étape 2 : recadrer une bande centrale pour les numéros de lot (réduit le bruit de fond)
  if (options?.cropForLot && resized.width && resized.height) {
    // Utiliser les mêmes dimensions que le cadre visible dans l'UI (Scanner mode "band")
    // 22% de hauteur, 90% de largeur pour correspondre exactement au cadre
    const bandHeightFactor = options?.narrowBand ? 0.22 : 0.5;
    const bandWidthFactor = options?.narrowBand ? 0.90 : 0.96;
    const bandHeight = Math.floor(resized.height * bandHeightFactor);
    const originY = Math.max(0, Math.floor(resized.height * 0.5 - bandHeight / 2));
    const cropWidth = Math.floor(resized.width * bandWidthFactor);
    const originX = Math.floor((resized.width - cropWidth) / 2);

    const cropped = await manipulateAsync(
      resized.uri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropWidth,
            height: bandHeight
          }
        }
      ],
      {
        // Respecter la config choisie : JPEG léger pour Vision/Claude, PNG pour ML Kit.
        compress: config.compress,
        format: config.format
      }
    );

    processedUri = cropped.uri;
  }

  return processedUri;
}

export async function runMlkit(uri: string): Promise<OCRResult> {
  ensureMlkitAvailable();

  console.log('[OCR] Starting TextRecognition.recognize for:', uri);
  const result = await TextRecognition.recognize(uri);
  console.log('[OCR] Recognition complete. Result:', JSON.stringify(result, null, 2).substring(0, 500));

  const text = result.text;
  console.log('[OCR] ===== TEXT RECOGNIZED =====');
  console.log('[OCR] Full text:', text);
  console.log('[OCR] ============================');

  // Ensure blocks is an array
  const blocks = Array.isArray(result.blocks) ? result.blocks : [];
  console.log('[OCR] Blocks count:', blocks.length);

  const lines = blocks.flatMap((block) =>
    Array.isArray(block.lines) ? block.lines.map((line) => ({
      content: line.text,
      confidence: typeof (line as any).confidence === 'number' ? (line as any).confidence : undefined
    })) : []
  );

  const averageConfidence =
    lines.length > 0
      ? lines.reduce((sum, line) => sum + (line.confidence ?? 1), 0) / lines.length
      : undefined;

  return {
    text,
    lines,
    confidence: averageConfidence,
    source: 'mlkit'
  };
}

export async function extractBrand(rawText: string): Promise<string> {
  console.log('[extractBrand] Extracting brand from OCR text');

  // 1. Extract brand candidates from OCR text
  console.log('[extractBrand] Splitting text into lines');
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  console.log('[extractBrand] Lines count:', lines.length);

  console.log('[extractBrand] Filtering brand candidates');

  // Liste des marques de distributeur à éviter (ce ne sont pas les vraies marques de fabricant)
  const supermarketBrands = [
    'selection', 'sélection',
    'carrefour', 'auchan', 'leclerc', 'intermarché', 'intermarche',
    'casino', 'monoprix', 'franprix', 'leader price', 'lidl', 'aldi',
    'u', 'système u', 'systeme u', 'marque repère', 'marque repere',
    'eco+', 'premier prix', 'top budget', 'no name', 'essence',
    'bio', 'organic', 'nature', 'qualité', 'qualite'
  ];

  // Liste des noms de produits génériques (type de produit, pas la marque)
  const genericProductNames = [
    // Pâtes
    'spaghetti', 'tagliatelle', 'fusilli', 'penne', 'rigatoni', 'farfalle',
    'tortellini', 'ravioli', 'lasagne', 'lasagnes', 'cannelloni', 'gnocchi',
    'macaroni', 'linguine', 'fettuccine', 'vermicelli', 'capellini',
    // Riz
    'riz', 'rice', 'basmati', 'jasmine',
    // Pain et viennoiserie
    'pain', 'bread', 'baguette', 'croissant', 'brioche',
    // Produits laitiers
    'lait', 'milk', 'yaourt', 'yogurt', 'fromage', 'cheese', 'beurre', 'butter',
    // Viandes
    'jambon', 'ham', 'saucisse', 'saucisson', 'poulet', 'chicken', 'boeuf', 'beef',
    // Autres
    'chocolat', 'chocolate', 'biscuit', 'cookie', 'gateau', 'cake',
    'cereal', 'cereales', 'muesli', 'granola'
  ];

  const brandCandidates = lines
    // Accept longer brand names (up to 40 characters) and single chars for logos
    .filter(line => line.length >= 1 && line.length <= 40)
    // IMPORTANT: Filter out non-Latin scripts (Arabic, Chinese, etc.)
    // Only keep lines with Latin characters (A-Z, a-z, accents, numbers)
    .filter(line => {
      // Check if line contains at least some Latin letters
      const latinLetters = (line.match(/[A-ZÀ-ÿa-z]/g) || []).length;
      // Check for Arabic script (U+0600 to U+06FF)
      const arabicChars = (line.match(/[\u0600-\u06FF]/g) || []).length;
      // Check for other non-Latin scripts
      const cyrillicChars = (line.match(/[\u0400-\u04FF]/g) || []).length;
      const chineseChars = (line.match(/[\u4E00-\u9FFF]/g) || []).length;
      const japaneseChars = (line.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;

      // Reject if contains Arabic, Cyrillic, Chinese or Japanese
      if (arabicChars > 0 || cyrillicChars > 0 || chineseChars > 0 || japaneseChars > 0) {
        return false;
      }

      // Must have at least 1 Latin letter
      return latinLetters > 0;
    })
    // Accept both uppercase and lowercase start, or numbers (for brands like "1664")
    .filter(line => /^[A-ZÀ-ÿa-z0-9]/.test(line))
    // Exclude lines that are mostly numbers (but allow some digits for brands like "Lu" or "Kellogg's")
    .filter(line => {
      const digitCount = (line.match(/\d/g) || []).length;
      return digitCount < line.length * 0.7; // Allow up to 70% digits
    })
    // Exclude common OCR noise patterns
    .filter(line => !(/^[^a-zA-Z]*$/.test(line) && line.length < 3)) // Skip pure symbols/numbers < 3 chars
    .filter(line => !/^(lot|n°|no|l|gtin|ean|upc|best|before|exp)/i.test(line)) // Skip lot-related terms
    // IMPORTANT: Filter out supermarket/distributor brands (not manufacturer brands)
    .filter(line => {
      const lowerLine = line.toLowerCase();
      return !supermarketBrands.some(supermarket => lowerLine === supermarket || lowerLine.includes(supermarket));
    })
    // IMPORTANT: Filter out generic product names (not brand names)
    .filter(line => {
      const lowerLine = line.toLowerCase();
      return !genericProductNames.some(product => lowerLine === product || lowerLine.includes(product));
    });

  console.log('[extractBrand] Brand candidates:', brandCandidates.slice(0, 10));
  console.log('[extractBrand] Brand candidates count:', brandCandidates.length);

  if (brandCandidates.length === 0) {
    console.log('[extractBrand] No candidates found, returning empty');
    return '';
  }

  // 2. Try to match ALL candidates with Firestore brands (prioritize known brands)
  // First pass: check for exact or very close matches in ALL candidates
  const firestoreMatches: Array<{ candidate: string; match: string; index: number }> = [];

  for (let i = 0; i < brandCandidates.length && i < 15; i++) {
    const candidate = brandCandidates[i];
    console.log(`[extractBrand] Searching Firestore for: "${candidate}"`);
    try {
      const matches = await searchBrands(candidate, 1);
      if (matches.length > 0) {
        console.log(`✅ Brand matched from Firestore: ${matches[0]} (position ${i})`);
        firestoreMatches.push({ candidate, match: matches[0], index: i });
      }
    } catch (error) {
      console.warn('[extractBrand] Firestore search failed for candidate:', candidate, error);
    }
  }

  // If we found any Firestore matches, return the one closest to the top
  if (firestoreMatches.length > 0) {
    // Prioritize matches that appear earlier in the text
    firestoreMatches.sort((a, b) => a.index - b.index);
    const bestMatch = firestoreMatches[0];
    console.log(`✅ Using Firestore match: ${bestMatch.match} (from "${bestMatch.candidate}" at position ${bestMatch.index})`);
    return bestMatch.match;
  }

  // 3. Fallback: return first candidate (prioritize longer, alphabetic names)
  const sortedCandidates = [...brandCandidates].sort((a, b) => {
    // Prioritize candidates with more letters
    const aLetters = (a.match(/[a-zA-Z]/g) || []).length;
    const bLetters = (b.match(/[a-zA-Z]/g) || []).length;
    if (aLetters !== bLetters) return bLetters - aLetters;

    // Then by length
    return b.length - a.length;
  });

  const bestCandidate = sortedCandidates[0];
  console.log(`⚠️ No Firestore match found, using raw candidate: ${bestCandidate}`);
  return bestCandidate;
}

/**
 * Essaie d'extraire le numéro de lot en cherchant un GTIN suivi d'un lot dans le texte OCR
 *
 * LOGIQUE COMPLÈTE :
 * 1. Récupère TOUT le texte OCR brut (sans filtrage)
 * 2. Cherche dans Rappel Conso les rappels pour cette marque
 * 3. Pour chaque rappel, extrait tous les GTIN possibles (13-14 chiffres)
 * 4. Cherche ces GTIN dans le texte OCR
 * 5. Si trouvé, extrait le numéro de lot qui suit immédiatement le GTIN
 * 6. Filtre automatiquement les "déchets" (dates, heures, etc.)
 */
async function extractLotFromGTIN(rawText: string, brand: string): Promise<string> {
  console.log('[extractLotFromGTIN] === GTIN-BASED EXTRACTION ===');
  console.log('[extractLotFromGTIN] Brand:', brand);
  console.log('[extractLotFromGTIN] Full OCR text:', rawText);

  try {
    // Récupérer TOUS les rappels pour cette marque
    const { fetchRecallsByCountry } = await import('./apiService');
    const recalls = await fetchRecallsByCountry('FR');

    const brandRecalls = recalls.filter(recall =>
      recall.brand?.toLowerCase() === brand.toLowerCase()
    );

    if (brandRecalls.length === 0) {
      console.log('[extractLotFromGTIN] ❌ No recalls found for this brand');
      return '';
    }

    console.log(`[extractLotFromGTIN] ✓ Found ${brandRecalls.length} recall(s)`);

    // Nettoyer le texte OCR : enlever SEULEMENT les espaces
    const cleanedText = rawText.replace(/\s+/g, '').toUpperCase();
    console.log('[extractLotFromGTIN] Cleaned text:', cleanedText);

    // Pour chaque rappel
    for (const recall of brandRecalls) {
      console.log('[extractLotFromGTIN] --- Checking recall:', recall.id);

      // Chercher dans TOUTES les informations d'identification
      for (const lotInfo of recall.lotNumbers) {
        console.log('[extractLotFromGTIN]   Recall identification:', lotInfo);

        // Extraire TOUS les GTIN (13-14 chiffres consécutifs)
        const gtinRegex = /\d{13,14}/g;
        let match;

        while ((match = gtinRegex.exec(lotInfo)) !== null) {
          const gtin = match[0];
          console.log(`[extractLotFromGTIN]   🔍 GTIN found in recall: ${gtin}`);

          // Chercher ce GTIN dans le texte OCR
          const gtinIndex = cleanedText.indexOf(gtin);

          if (gtinIndex !== -1) {
            console.log(`[extractLotFromGTIN]   ✓ GTIN FOUND in OCR at position ${gtinIndex}!`);

            // Extraire ce qui suit immédiatement le GTIN
            const afterGTIN = cleanedText.substring(gtinIndex + gtin.length);
            console.log('[extractLotFromGTIN]   Text after GTIN:', afterGTIN);

            // Pattern pour extraire le lot :
            // - Peut commencer par L
            // - Contient des lettres ET des chiffres
            // - S'arrête avant : ou / (dates/heures) ou FH
            const lotMatch = afterGTIN.match(/^L?([0-9]+[A-Z][A-Z0-9]*|[A-Z]+[0-9][A-Z0-9]*)/i);

            if (lotMatch) {
              let lot = lotMatch[1].toUpperCase();
              console.log('[extractLotFromGTIN]   Raw lot match:', lot);

              // Limiter à 15 caractères
              if (lot.length > 15) {
                lot = lot.substring(0, 15);
              }

              console.log(`[extractLotFromGTIN]   ✅ SUCCESS! Final lot: ${lot}`);
              return lot;
            } else {
              console.log('[extractLotFromGTIN]   ⚠️ No valid lot pattern after GTIN');
            }
          }
        }
      }
    }

    console.log('[extractLotFromGTIN] ❌ No GTIN match in OCR');
    return '';
  } catch (error) {
    console.error('[extractLotFromGTIN] ❌ Error:', error);
    return '';
  }
}

/**
 * Détecte si un candidat est en réalité une DATE (de péremption, fabrication…)
 * ou un marqueur de date, et donc PAS un numéro de lot. Couvre :
 * - marqueurs FR/EN : DDM, DLC, DLUO, EXP, BBE, "best before", "à consommer"
 * - jj/mm/aaaa, jj-mm-aaaa, jj.mm.aaaa, aaaa-mm-jj
 * - jjmmaaaa / aaaammjj collés (ex. 18052024 = 18/05/2024)
 * - fragments jj/mm, heures hh:mm
 */
function isDateLike(candidate: string): boolean {
  const c = candidate.toUpperCase();
  if (/(DDM|DLC|DLUO|\bEXP\b|BBE|BEST\s*BEFORE|USE\s*BY|CONSOMMER)/.test(c)) return true;
  if (/^\d{1,2}[:/]\d{2}/.test(c)) return true;                       // heure / jj:mm
  if (/^\d{1,2}[\/.\-]\d{1,2}$/.test(c)) return true;                 // jj/mm fragment
  if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(c)) return true;   // jj/mm/aaaa
  if (/^\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}$/.test(c)) return true;     // aaaa-mm-jj
  const d = c.replace(/\D/g, '');
  if (d.length === 8) {
    const dd = +d.slice(0, 2), mm = +d.slice(2, 4), yyyy = +d.slice(4, 8);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 2000 && yyyy <= 2099) return true;
    const y2 = +d.slice(0, 4), m2 = +d.slice(4, 6), d2 = +d.slice(6, 8);
    if (y2 >= 2000 && y2 <= 2099 && m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31) return true;
  }
  return false;
}

/**
 * Score intrinsèque d'un candidat de numéro de lot. Plus c'est haut, plus ça
 * ressemble à un vrai code de lot (et non à un fragment de date/heure ou de bruit).
 */
function scoreLotCandidate(candidate: string): number {
  const c = candidate.toUpperCase();
  // Dates / marqueurs de date → on les écarte fortement (ce ne sont pas des lots)
  if (isDateLike(c)) return -1000;

  let score = 0;
  const compact = c.replace(/[\/\-_.]/g, '');
  const hasLetters = /[A-Z]/.test(compact);
  const hasDigits = /\d/.test(compact);
  const len = compact.length;

  if (hasLetters && hasDigits) score += 40; // mixte = signature typique d'un lot
  else if (hasDigits && !hasLetters) score += 10; // lot purement numérique possible
  else score -= 50; // que des lettres → peu probable

  if (len >= 6 && len <= 16) score += 25;
  else if (len >= 4 && len <= 5) score += 5;
  else if (len > 16) score -= 10;
  else score -= 20; // < 4 caractères

  // Bonus "batch code" : 1-4 lettres en tête puis des chiffres (HG101166383, AB1234, L693…)
  if (/^[A-Z]{1,4}\d{3,}/.test(c)) score += 25;
  // Bonus code numérique à séparateur slash (ex. 4100/01473) — format de lot fréquent
  if (/^\d{3,}\/\d{3,}$/.test(c)) score += 35;

  return score;
}

/**
 * Un candidat est un "lot confiant" si on est raisonnablement sûr que c'est un
 * vrai numéro de lot et pas un texte quelconque (poids, prix, date, mot+chiffre).
 * Sans ce garde-fou, n'importe quel token alphanumérique était renvoyé comme lot.
 */
function isConfidentLot(candidate: string): boolean {
  const raw = candidate.toUpperCase();
  // Dates / marqueurs de date → jamais un lot
  if (isDateLike(raw)) return false;
  const compact = raw.replace(/[\s\/\-_.]/g, '');
  const hasLetters = /[A-Z]/.test(compact);
  const hasDigits = /\d/.test(compact);
  // EAN/GTIN (13-14 chiffres purs) → refus
  if (/^\d{13,14}$/.test(compact)) return false;
  // Code numérique à séparateur slash (ex. 4100/01473) → vrai lot fréquent
  if (/^\d{3,}\/\d{3,}$/.test(raw.trim()) && compact.length >= 6 && compact.length <= 18) return true;
  // Sinon, signature d'un vrai lot : mélange lettres + chiffres, longueur 5-20.
  return hasLetters && hasDigits && compact.length >= 5 && compact.length <= 20;
}

export async function extractLotNumber(rawText: string, brand?: string): Promise<string> {
  console.log('[extractLotNumber] Extracting lot number from OCR text');
  console.log('[extractLotNumber] Raw text:', rawText);

  // Si on a la marque, essayer d'abord la méthode GTIN
  if (brand) {
    const gtinLot = await extractLotFromGTIN(rawText, brand);
    if (gtinLot) {
      console.log(`✅ [extractLotNumber] Using GTIN-based extraction: ${gtinLot}`);
      return gtinLot;
    }
    console.log('[extractLotNumber] GTIN-based extraction failed, falling back to pattern matching');
  }

  // Nettoyer le texte mais préserver les séparateurs importants
  const cleaned = rawText.replace(/[^\w\s/:.-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  console.log('[extractLotNumber] Cleaned text:', cleaned);

  // Liste de mots-clés à exclure (codes-barres, dates, etc.). DDM = Date de
  // Durabilité Minimale (best-before FR) → le code adjacent est une date.
  const excludeKeywords = ['GTIN', 'EAN', 'UPC', 'DDL', 'DDM', 'DLC', 'DLUO', 'BEST', 'BEFORE', 'EXP', 'USE BY', 'À CONSOMMER'];

  // Fonction pour vérifier si un texte contient des mots-clés à exclure
  const containsExcludedKeyword = (text: string): boolean => {
    const upperText = text.toUpperCase();
    return excludeKeywords.some(keyword => upperText.includes(keyword));
  };

  // Fonction pour vérifier si c'est un numéro de téléphone (format français: 0 XXX XXX XXX ou 0XXXXXXXXX)
  const isPhoneNumber = (text: string): boolean => {
    // Nettoyer le texte (enlever espaces, tirets, points)
    const cleaned = text.replace(/[\s\-\.]/g, '');
    // Vérifier si c'est un numéro français (10 chiffres commençant par 0)
    return /^0\d{9}$/.test(cleaned);
  };

  // Patterns pour différents formats de numéros de lot (ordre de priorité)
  const patterns = [
    // 0. Code numérique à séparateur slash (ex. 4100/01473) — format de lot fréquent,
    //    distinct d'une date (qui utilise des tirets ou 2 séparateurs). Capturé en
    //    entier (slash conservé) au lieu d'être coupé en deux par les autres patterns.
    {
      regex: /\b\d{3,}\/\d{3,}\b/g,
      name: 'Slash numeric code',
      priority: 0,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\b\d{3,}\/\d{3,}\b/g;
        let m;
        while ((m = regex.exec(text)) !== null) {
          if (!isDateLike(m[0])) results.push(m[0]);
        }
        return results;
      }
    },
    // 1. Format "LOT" ou "L" suivi du numéro (PRIORITÉ ABSOLUE)
    // Chercher "L" ou "LOT" même sans word boundary strict
    {
      regex: /(?:^|[^A-Z])(?:LOT|L)[:\s\-\.]*([A-Z0-9]{3,}[A-Z0-9\s\-\/\.]*)/gi,
      name: 'LOT/L prefix',
      priority: 1,
      extract: (text: string): string[] => {
        const results: string[] = [];
        // Chercher tous les patterns qui commencent par L ou LOT
        const regex = /(?:^|[^A-Z])(?:LOT|L)[:\s\-\.]*([A-Z0-9]{3,}[A-Z0-9\s\-\/\.]*)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          let lotNum = match[1].trim();

          // Arrêter avant les chiffres qui ressemblent à une heure (HH:MM) ou une date (DD/YYYY)
          // Exemple: "693 R2102R 13:31" -> on garde "693 R2102R"
          lotNum = lotNum.replace(/\s*\d{1,2}[:\/]\d{2,4}.*$/gi, '');

          // Arrêter si on trouve "FH" (souvent suivi de date)
          lotNum = lotNum.replace(/\s*FH.*$/gi, '');

          // Nettoyer le numéro de lot en enlevant les espaces internes
          lotNum = lotNum.replace(/\s+/g, '');

          // Filtrer les matches trop courts ou qui sont juste des lettres
          if (lotNum.length >= 3 && /\d/.test(lotNum) && !isPhoneNumber(lotNum)) {
            // Tronquer à une longueur raisonnable (enlever le surplus)
            if (lotNum.length > 22) {
              lotNum = lotNum.substring(0, 22);
            }

            results.push(lotNum);
          }
        }
        return results;
      }
    },

    // 2. Format "N°" ou "NO" suivi du numéro
    {
      regex: /\bN[O0°][:\s\-\.]*([A-Z0-9]{3,}[A-Z0-9\-\/\.]*)\b/gi,
      name: 'NO prefix',
      priority: 2,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\bN[O0°][:\s\-\.]*([A-Z0-9]{3,}[A-Z0-9\-\/\.]*)\b/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lotNum = match[1].trim();
          if (lotNum.length >= 3 && /\d/.test(lotNum) && !containsExcludedKeyword(match[0]) && !isPhoneNumber(lotNum)) {
            results.push(lotNum);
          }
        }
        return results;
      }
    },

    // 3. Format ligne complète commençant par "L" + chiffres (pattern de secours pour OCR imparfait)
    // Ex: "L693 A 2102R" -> "L693A2102R" ou "693 A 2102R" -> "L693A2102R"
    {
      regex: /(?:^|\s)L?(\d+[A-Z0-9\s]*)/gi,
      name: 'L at line start',
      priority: 3,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /(?:^|\s)L?(\d+[A-Z0-9\s]*)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          let lotNum = match[1].trim();

          // Nettoyer les espaces
          lotNum = lotNum.replace(/\s+/g, '');

          // Vérifier qu'on a au moins 3 chiffres/lettres et qu'il y a des lettres (pas que des chiffres)
          if (lotNum.length >= 3 && /\d/.test(lotNum) && /[A-Z]/i.test(lotNum) && !isPhoneNumber(lotNum)) {
            // Tronquer à une longueur raisonnable
            if (lotNum.length > 22) {
              lotNum = lotNum.substring(0, 22);
            }
            results.push(lotNum);
          }
        }
        return results;
      }
    },

    // 4. Format "lettres+chiffres" (ex: AB1234, LOT1234, L1234)
    {
      regex: /\b([A-Z]{1,3}\d{3,})\b/gi,
      name: 'Letters+digits',
      priority: 4,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\b([A-Z]{1,3}\d{3,})\b/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lotNum = match[1];
          // Exclure les codes-barres EAN/GTIN qui sont purement numériques après 1-2 lettres.
          // Cap à 16 : certains lots/batch codes font 11-15 caractères (ex. HG101166383).
          if (lotNum.length <= 16 && !containsExcludedKeyword(match[0]) && !isPhoneNumber(lotNum)) {
            results.push(lotNum);
          }
        }
        return results;
      }
    },

    // 5. Format "chiffres+lettres" (ex: 1234AB, 123456A)
    {
      regex: /\b(\d{3,}[A-Z]{1,3})\b/gi,
      name: 'Digits+letters',
      priority: 5,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\b(\d{3,}[A-Z]{1,3})\b/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lotNum = match[1];
          if (lotNum.length <= 16 && !containsExcludedKeyword(match[0]) && !isPhoneNumber(lotNum)) {
            results.push(lotNum);
          }
        }
        return results;
      }
    },
    // 6. Séquences alphanumériques denses (tokens OCR)
    {
      regex: /[A-Z0-9]{6,24}/gi,
      name: 'Dense alphanumerics',
      priority: 6,
      extract: (text: string): string[] => {
        const tokens = text
          .replace(/[^A-Z0-9]/gi, ' ')
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean);
        return tokens.filter((token) => token.length >= 6 && token.length <= 24 && /\d/.test(token));
      }
    }
  ];

  // Collecter TOUS les candidats. Les patterns à préfixe explicite (LOT/L, N°)
  // reçoivent un gros bonus : quand l'étiquette dit "LOT xxx", c'est la vérité.
  const allCandidates: Array<{ value: string; bonus: number }> = [];

  for (const pattern of patterns) {
    const matches = pattern.extract(cleaned);
    if (matches.length > 0) {
      console.log(`✅ Found ${matches.length} candidate(s) with pattern "${pattern.name}": ${matches.join(', ')}`);
      const bonus = pattern.name === 'LOT/L prefix' || pattern.name === 'NO prefix' ? 1000 : 0;
      for (const m of matches) allCandidates.push({ value: m.toUpperCase(), bonus });
    }
  }

  if (allCandidates.length === 0) {
    console.log('[extractLotNumber] No pattern matched with strict rules');
    console.log('❌ No lot number found');
    return '';
  }

  // Sélectionner le meilleur candidat par score qualité (au lieu du premier trouvé),
  // pour éviter qu'un fragment (ex. "047N" issu de "047N:10468") l'emporte sur un
  // vrai code de lot (ex. "HG101166383").
  const ranked = allCandidates
    .map((c) => ({ value: c.value, score: c.bonus + scoreLotCandidate(c.value), bonus: c.bonus }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const lotNumber = best.value;
  console.log(`✅ Best lot number: ${lotNumber} (score ${best.score}, ${allCandidates.length} candidates)`);
  return lotNumber;
}

/**
 * Indique si un numéro de lot est "fiable" (vrai code et pas un texte quelconque).
 * Utilisé en MODE MALVOYANT pour décider si on s'arrête ou si on continue à
 * scanner (l'utilisateur ne voit pas l'écran, donc on évite les faux positifs).
 */
export function isReliableLot(candidate: string): boolean {
  return isConfidentLot(candidate);
}

/**
 * Extrait TOUS les candidats de numéros de lot possibles
 */
export async function extractAllLotCandidates(rawText: string, brand?: string): Promise<string[]> {
  console.log('[extractAllLotCandidates] Extracting all lot candidates from OCR text');

  const allCandidates: string[] = [];
  const addCandidate = (value: string | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    allCandidates.push(trimmed.toUpperCase());
  };

  // Si on a la marque, essayer d'abord la m?thode GTIN
  if (brand) {
    const gtinLot = await extractLotFromGTIN(rawText, brand);
    if (gtinLot) {
      console.log(`? GTIN-based candidate: ${gtinLot}`);
      addCandidate(gtinLot);
    }
  }

  // Nettoyer le texte mais pr?server les s?parateurs importants
  const cleaned = rawText.replace(/[^\w\s/:.-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

  // Fonction pour v?rifier si c'est un num?ro de t?l?phone
  const isPhoneNumber = (text: string): boolean => {
    const cleanedNum = text.replace(/[\s\-.]/g, '');
    return /^0\d{9}$/.test(cleanedNum);
  };

  const excludeKeywords = ['GTIN', 'EAN', 'UPC', 'DDL', 'DLC', 'DLUO', 'BEST', 'BEFORE', 'EXP', 'USE BY', '? CONSOMMER'];
  const containsExcludedKeyword = (text: string): boolean => {
    const upperText = text.toUpperCase();
    return excludeKeywords.some(keyword => upperText.includes(keyword));
  };

  // Patterns (copie des patterns existants)
  const patterns = [
    {
      regex: /(?:^|[^A-Z])(?:LOT|L)[:\s\-.]*([A-Z0-9]{3,}[A-Z0-9\s\-/.]*)/gi,
      name: 'LOT/L prefix',
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /(?:^|[^A-Z])(?:LOT|L)[:\s\-.]*([A-Z0-9]{3,}[A-Z0-9\s\-/.]*)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          let lotNum = match[1].trim();
          lotNum = lotNum.replace(/\s*\d{1,2}[:\/]\d{2,4}.*$/gi, '');
          lotNum = lotNum.replace(/\s*FH.*$/gi, '');
          lotNum = lotNum.replace(/\s+/g, '');
          if (lotNum.length >= 3 && /\d/.test(lotNum) && !isPhoneNumber(lotNum)) {
            if (lotNum.length > 22) {
              lotNum = lotNum.substring(0, 22);
            }
            results.push(lotNum);
          }
        }
        return results;
      }
    },
    {
      regex: /N[O0??][:\s\-.]*([A-Z0-9]{3,}[A-Z0-9\-/\.]*)/gi,
      name: 'NO prefix',
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /N[O0??][:\s\-.]*([A-Z0-9]{3,}[A-Z0-9\-/\.]*)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lotNum = match[1].trim();
          if (lotNum.length >= 3 && /\d/.test(lotNum) && !containsExcludedKeyword(match[0]) && !isPhoneNumber(lotNum)) {
            results.push(lotNum.length > 22 ? lotNum.substring(0, 22) : lotNum);
          }
        }
        return results;
      }
    },
    {
      regex: /(?:^|\s)L?(\d+[A-Z0-9\s]*)/gi,
      name: 'L at line start',
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /(?:^|\s)L?(\d+[A-Z0-9\s]*)/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          let lotNum = match[1].trim();
          lotNum = lotNum.replace(/\s+/g, '');
          if (lotNum.length >= 3 && /\d/.test(lotNum) && /[A-Z]/i.test(lotNum) && !isPhoneNumber(lotNum)) {
            if (lotNum.length > 22) {
              lotNum = lotNum.substring(0, 22);
            }
            results.push(lotNum);
          }
        }
        return results;
      }
    },
    // Denses alphanum?riques (tokens)
    {
      regex: /[A-Z0-9]{6,24}/gi,
      name: 'Dense alphanumerics',
      extract: (text: string): string[] => {
        const tokens = text
          .replace(/[^A-Z0-9]/gi, ' ')
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean);
        return tokens.filter((token) => token.length >= 6 && token.length <= 24 && /\d/.test(token));
      }
    }
  ];

  // Collecter tous les candidats
  for (const pattern of patterns) {
    const matches = pattern.extract(cleaned);
    if (matches.length > 0) {
      console.log(`? Pattern "${pattern.name}" found ${matches.length} candidate(s): ${matches.join(', ')}`);
      matches.forEach(addCandidate);
    }
  }

  // Ajouter les tokens alphanum?riques de chaque ligne (combinaison et fusion)
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const tokens = line
      .replace(/[^A-Z0-9]/gi, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const token of tokens) {
      if (token.length >= 4 && token.length <= 24 && /\d/.test(token)) {
        addCandidate(token);
      }
    }
    for (let i = 0; i < tokens.length; i++) {
      for (let size = 2; size <= 3; size++) {
        const slice = tokens.slice(i, i + size);
        if (slice.length < size) continue;
        const merged = slice.join('');
        if (merged.length >= 6 && merged.length <= 24 && /\d/.test(merged)) {
          addCandidate(merged);
        }
      }
    }
  }

  // D?dupliquer les candidats
  const uniqueCandidates = [...new Set(allCandidates)];
  console.log(`? Total unique candidates: ${uniqueCandidates.length}`);

  return uniqueCandidates;
}
export interface BrandExtractionResult {
  brand: string;
  confidence: number;
  isKnownBrand: boolean;
  suggestions?: string[];
  result: OCRResult;
}

export async function performOcrForBrand(uri: string): Promise<BrandExtractionResult> {
  ensureMlkitAvailable();
  console.log('[Brand OCR] Step 1: Starting preprocessing');
  const processed = await preprocessImage(uri);
  console.log('[Brand OCR] Step 2: Preprocessing complete');

  try {
    console.log('[Brand OCR] Step 3: Starting runMlkit');
    let result = await runMlkit(processed);
    console.log('[Brand OCR] Step 4: runMlkit complete, checking quality');

    const visionFallback = await tryVisionFallback(processed, result, 'brand');
    if (visionFallback) {
      result = visionFallback;
    }
    console.log('[Brand OCR] Step 5: OCR source:', result.source);

    const brand = await extractBrand(result.text);
    console.log('[Brand OCR] Step 6: Brand extracted:', brand);

    // Check if brand is in Firestore and get suggestions
    console.log('[Brand OCR] Step 7: Searching Firestore for exact match');
    let isKnownBrand = false;
    let confidence = 0;
    let suggestions: string[] | undefined;

    try {
      const matches = await searchBrands(brand, 3);
      console.log('[Brand OCR] Step 8: Firestore matches:', matches);

      if (matches.length > 0 && matches[0].toLowerCase() === brand.toLowerCase()) {
        // Exact match found
        isKnownBrand = true;
        confidence = 1.0;
        console.log('[Brand OCR] Exact brand match in Firestore:', matches[0]);
      } else if (matches.length > 0) {
        // Similar matches found - use as suggestions
        suggestions = matches;
        confidence = 0.7;
        console.log('[Brand OCR] Similar brands found:', matches.join(', '));
      } else {
        // No match - search for suggestions
        console.log('[Brand OCR] Step 9: No exact match, getting suggestions');
        suggestions = await searchBrands(brand, 3);
        confidence = 0.3;
      }
    } catch (error) {
      console.warn('[Brand OCR] Firestore search failed:', error);
      confidence = 0;
    }

    console.log('[Brand OCR] Step 10: Building result object');
    const finalResult = {
      brand: brand || DEFAULT_BRAND_NAME,
      confidence,
      isKnownBrand,
      suggestions: suggestions && suggestions.length > 0 ? suggestions : undefined,
      result
    };
    console.log('[Brand OCR] Step 11: Returning result');
    return finalResult;
  } finally {
    try {
      await FileSystem.deleteAsync(processed, { idempotent: true });
    } catch (error) {
      console.warn('Failed to delete processed image', error);
    }
  }
}

export interface LotExtractionResult {
  lot: string;
  result: OCRResult;
  candidates?: string[]; // Tous les candidats de numéros de lot détectés
}

export interface PerformOcrOptions {
  // En mode malvoyant (scan continu), on plafonne les appels Vision/Claude
  // (payants). Quand false, on n'utilise QUE ML Kit (gratuit, on-device).
  allowPaidFallback?: boolean;
}

export async function performOcr(
  uri: string,
  brand?: string,
  options?: PerformOcrOptions
): Promise<LotExtractionResult> {
  ensureMlkitAvailable();
  const allowPaid = options?.allowPaidFallback !== false;

  try {
    // Stratégie : ML Kit en premier (gratuit, on-device), Vision uniquement
    // si la qualité ML Kit est insuffisante (économie ~80-90% des appels Vision).
    let result: OCRResult;

    console.log('[Lot OCR] Running ML Kit first...');
    const processedForMlkit = await preprocessImage(uri, { cropForLot: true, narrowBand: true });
    let mlkitResult: OCRResult;
    try {
      mlkitResult = await runMlkit(processedForMlkit);
    } finally {
      try {
        await FileSystem.deleteAsync(processedForMlkit, { idempotent: true });
      } catch (error) {
        console.warn('Failed to delete mlkit processed image', error);
      }
    }

    // Si ML Kit a déjà détecté un pattern de lot plausible, on court-circuite
    // Vision et Claude (évite 2 appels réseau inutiles).
    if (hasPlausibleLotPattern(mlkitResult.text)) {
      console.log('[Lot OCR] ML Kit found plausible lot → skipping Vision + Claude');
      result = mlkitResult;
    } else if (!allowPaid) {
      // Plafond d'appels payants atteint (mode malvoyant continu) : on reste sur
      // ML Kit gratuit. Le scan continuera tant qu'aucun lot fiable n'est lu.
      console.log('[Lot OCR] Paid fallback disabled → ML Kit only');
      result = mlkitResult;
    } else {
      // ML Kit n'a pas trouvé de lot plausible → on prépare UNE SEULE image
      // compacte (JPEG ~2000px) et on la réutilise pour Vision PUIS Claude.
      // Un seul upload léger au lieu de 2-3 gros (pleine résolution + 3000px PNG) :
      // c'est ce qui divise le temps de traitement.
      result = mlkitResult;
      const aiImage = await preprocessImage(uri, { cropForLot: true, narrowBand: true, useVisionConfig: true });
      try {
        const visionResult = await tryVisionFallback(aiImage, { text: '', lines: [], source: 'none' }, 'lot');
        if (visionResult) {
          console.log('[Lot OCR] Vision fallback used');
          result = visionResult;
        }
        // Claude en dernier recours, sur la MÊME image compacte, si toujours pas
        // de lot plausible (tryClaudeFallback se court-circuite sinon).
        const claudeResult = await tryClaudeFallback(aiImage, result, 'lot');
        if (claudeResult) {
          console.log('[Lot OCR] Claude fallback used');
          result = claudeResult;
        }
      } finally {
        try {
          await FileSystem.deleteAsync(aiImage, { idempotent: true });
        } catch {
          /* noop */
        }
      }
    }

    console.log('[Lot OCR] OCR source:', result.source);

    // Filtrer le texte OCR pour enlever les lignes contenant la marque
    // (car la marque est déjà détectée par le code-barres et pollue la détection du lot)
    let filteredText = result.text;
    if (brand) {
      console.log(`[Lot OCR] Filtering brand "${brand}" from OCR text`);
      const lines = result.text.split('\n');
      const brandUpper = brand.toUpperCase();

      // Garder seulement les lignes qui ne contiennent pas la marque
      const filteredLines = lines.filter(line => {
        const lineUpper = line.trim().toUpperCase();
        // Exclure les lignes qui contiennent la marque
        const containsBrand = lineUpper.includes(brandUpper);
        if (containsBrand) {
          console.log(`[Lot OCR] Filtering out line: "${line}"`);
        }
        return !containsBrand;
      });

      filteredText = filteredLines.join('\n');
      console.log(`[Lot OCR] Original text length: ${result.text.length}, Filtered text length: ${filteredText.length}`);
      console.log(`[Lot OCR] Filtered text: "${filteredText}"`);
    }

    const lot = await extractLotNumber(filteredText, brand);
    const candidates = await extractAllLotCandidates(filteredText, brand);

    return {
      lot,
      result,
      candidates
    };
  } catch (error) {
    console.error('[Lot OCR] Error:', error);
    throw error;
  }
}

/**
 * Score un résultat OCR pour déterminer la "meilleure" frame parmi plusieurs.
 * Plus le score est élevé, plus la frame est exploitable.
 */
function scoreOcrResult(result: OCRResult): number {
  const text = result.text || '';
  if (!text.trim()) return 0;

  const quality = assessOcrQuality(result);
  let score = 0;

  // Confiance ML Kit (0-100 points)
  if (quality.averageConfidence !== null) {
    score += quality.averageConfidence * 100;
  } else {
    score += 50; // valeur neutre si pas de confidence dispo
  }

  // Longueur du texte (10-40 points selon densité)
  score += Math.min(40, text.trim().length / 2);

  // Nombre de lignes (signal de richesse, max 20 points)
  score += Math.min(20, quality.lineCount * 4);

  // Pénalité pour bruit élevé
  score -= quality.noiseRatio * 50;

  // Bonus si on détecte un pattern de lot plausible (LOT/L+digits ou séquence de digits)
  const upper = text.toUpperCase();
  if (/(?:^|[^A-Z])LOT[:\s\-.]*[A-Z0-9]{3,}/.test(upper)) {
    score += 50; // pattern LOT explicite = très haute confiance
  } else if (/(?:^|[^A-Z])L\d{3,}/.test(upper)) {
    score += 30; // pattern L+digits
  } else if (/\b\d{5,12}\b/.test(upper)) {
    score += 15; // série de chiffres pure
  }

  return score;
}

/**
 * Multi-frame capture : OCR sur N images, sélection de la meilleure,
 * fallback Vision API uniquement si la meilleure est encore insuffisante.
 */
export async function performOcrMultiFrame(
  uris: string[],
  brand?: string,
  options?: PerformOcrOptions
): Promise<LotExtractionResult> {
  ensureMlkitAvailable();
  const allowPaid = options?.allowPaidFallback !== false;

  if (!uris || uris.length === 0) {
    throw new Error('No frames provided to performOcrMultiFrame');
  }

  if (uris.length === 1) {
    // Cas dégénéré : une seule frame, on retombe sur performOcr
    return performOcr(uris[0], brand, options);
  }

  console.log(`[Multi-frame OCR] Processing ${uris.length} frames with ML Kit...`);

  // 1) ML Kit sur chaque frame en parallèle
  const frameResults = await Promise.all(
    uris.map(async (uri, index) => {
      try {
        const processed = await preprocessImage(uri, { cropForLot: true, narrowBand: true });
        let mlkitResult: OCRResult;
        try {
          mlkitResult = await runMlkit(processed);
        } finally {
          try {
            await FileSystem.deleteAsync(processed, { idempotent: true });
          } catch {
            /* noop */
          }
        }
        const score = scoreOcrResult(mlkitResult);
        console.log(`[Multi-frame OCR] Frame ${index + 1}/${uris.length} score=${score.toFixed(1)}, len=${mlkitResult.text.length}`);
        return { uri, result: mlkitResult, score };
      } catch (error) {
        console.warn(`[Multi-frame OCR] Frame ${index + 1} failed`, error);
        return { uri, result: { text: '', lines: [], source: 'mlkit' as const }, score: 0 };
      }
    })
  );

  // 2) Sélection de la meilleure frame
  frameResults.sort((a, b) => b.score - a.score);
  const best = frameResults[0];
  console.log(`[Multi-frame OCR] Best frame score=${best.score.toFixed(1)}`);

  // 3) Si la meilleure frame contient déjà un lot plausible → court-circuit Vision + Claude
  let result: OCRResult = best.result;
  if (hasPlausibleLotPattern(best.result.text)) {
    console.log('[Multi-frame OCR] Best frame already has plausible lot → skipping Vision + Claude');
  } else if (!allowPaid) {
    console.log('[Multi-frame OCR] Paid fallback disabled → ML Kit only');
  } else {
    // Une seule image compacte (JPEG ~2000px) réutilisée pour Vision PUIS Claude :
    // un seul upload léger au lieu de 2-3 gros → temps de traitement bien réduit.
    const aiImage = await preprocessImage(best.uri, { cropForLot: true, narrowBand: true, useVisionConfig: true });
    try {
      const visionResult = await tryVisionFallback(aiImage, { text: '', lines: [], source: 'none' }, 'lot');
      if (visionResult) {
        console.log('[Multi-frame OCR] Vision fallback used');
        result = visionResult;
      }
      const claudeResult = await tryClaudeFallback(aiImage, result, 'lot');
      if (claudeResult) {
        console.log('[Multi-frame OCR] Claude fallback used');
        result = claudeResult;
      }
    } finally {
      try {
        await FileSystem.deleteAsync(aiImage, { idempotent: true });
      } catch {
        /* noop */
      }
    }
  }

  // 4) Nettoyer les frames non retenues
  for (const frame of frameResults) {
    try {
      await FileSystem.deleteAsync(frame.uri, { idempotent: true });
    } catch {
      /* noop */
    }
  }

  // 5) Filtrer la marque (comme performOcr)
  let filteredText = result.text;
  if (brand) {
    const lines = result.text.split('\n');
    const brandUpper = brand.toUpperCase();
    filteredText = lines.filter((line) => !line.trim().toUpperCase().includes(brandUpper)).join('\n');
  }

  const lot = await extractLotNumber(filteredText, brand);
  const candidates = await extractAllLotCandidates(filteredText, brand);

  return { lot, result, candidates };
}
