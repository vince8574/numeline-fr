// src/services/ocrService.ts
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { OCRResult } from '../types';
import { searchBrands } from './firestoreBrandsService';
import { DEFAULT_BRAND_NAME } from '../constants/defaults';
import { tryVisionFallback, runVisionFallback, isVisionAvailable, assessOcrQuality } from './visionFallbackService';
import { tryClaudeFallback, isClaudeAvailable, stripNonLotMarkings } from './claudeOcrFallback';

const preprocessConfig = {
  resize: { width: 1800 }, // Résolution optimale pour ML Kit (trop élevé peut dégrader la précision)
  format: SaveFormat.PNG,
  compress: 1 // Pas de compression pour garder la qualité maximale
} as const;

const visionPreprocessConfig = {
  // Format imposé pour l'IA (Vision ET Claude) : une SEULE image JPEG, calculée
  // une fois puis réutilisée. 3000px (au lieu de 2000) car la bande lot est
  // désormais recadrée À PLEINE RÉSOLUTION puis réduite à cette cible — on garde
  // donc ~2x plus de pixels par caractère sur les codes point-matrice pâles.
  resize: { width: 3000 },
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

// Facteurs de la bande centrale (mode lot). Élargi à 0.34 (vs 0.26) car sur iOS
// la capture sort en ~carré (3024x3114, recadrage centré du capteur — pictureSize
// est un quasi no-op sur iOS, bug expo #2874) : on perd ~23 % de champ haut/bas,
// donc un lot un peu décentré sortait de l'ancienne bande de 26 %. Une bande plus
// haute le rattrape ; le bruit ajouté est filtré par looksLikeNonLot + le scoring
// (et locateLotZone repositionne déjà la bande sur la ligne du lot).
const BAND_HEIGHT_FACTOR = 0.34;
// Pleine largeur (1.0) : ne JAMAIS rogner horizontalement. Les logs montraient des
// lectures tronquées à gauche ("3A2110R05" au lieu de "L693A2110R05") ; même un
// rognage symétrique de 3% pouvait amputer le 1er caractère pâle d'un code calé au
// bord. On garde 100% de la largeur et on laisse l'OCR isoler le code.
const BAND_WIDTH_FACTOR = 1.0;

// Dernières dimensions natives mesurées par preprocessImage (mode lot). Remontées
// à ocrVision ET ocrClaude pour diagnostiquer un éventuel décalage/recadrage de la
// CAPTURE (visible dans les logs cloud, sans dépendre des logs appareil).
let lastPreprocessNative: { w: number; h: number } | null = null;
export const getLastPreprocessNative = () => lastPreprocessNative;

// Diagnostic capture : tailles `pictureSize` offertes par la caméra + celle
// choisie (posée par Scanner.handleCameraReady). Remontée aux logs cloud d'OCR
// pour confirmer, sans logs appareil, qu'on capture bien en format large (4:3/16:9)
// et pas en carré.
let captureDiag: string | null = null;
export const setCaptureDiag = (diag: string | null) => {
  captureDiag = diag;
};

export async function preprocessImage(uri: string, options?: PreprocessOptions) {
  const config = options?.useVisionConfig ? visionPreprocessConfig : preprocessConfig;

  // BANDE LOT : on CROP À PLEINE RÉSOLUTION D'ABORD, puis on réduit. Resizer
  // l'image AVANT de cropper (l'ancien ordre) jetait la moitié des pixels du
  // code → Vision ne lisait qu'un fragment du milieu ("8R 49A" au lieu de
  // "MG26148R49A"). En croppant la photo native (~4032px) puis en réduisant à la
  // cible, on garde ~2x plus de pixels par caractère.
  if (options?.cropForLot) {
    try {
      // Dimensions FIABLES : manipulateAsync décode l'image et renvoie les vraies
      // dimensions pixel. (Image.getSize renvoyait des dimensions échelle/points sur
      // iOS → un crop minuscule : ~1015px envoyés à Vision au lieu de ~3000px, donc
      // le préfixe pâle du lot illisible.)
      const probe = await manipulateAsync(uri, []);
      const nativeW = probe.width;
      const nativeH = probe.height;
      if (nativeW > 0 && nativeH > 0) {
        const bandHeightFactor = options?.narrowBand ? BAND_HEIGHT_FACTOR : 0.5;
        const bandWidthFactor = options?.narrowBand ? BAND_WIDTH_FACTOR : 0.96;
        const bandHeight = Math.floor(nativeH * bandHeightFactor);
        const originY = Math.max(0, Math.floor(nativeH * 0.5 - bandHeight / 2));
        const cropWidth = Math.floor(nativeW * bandWidthFactor);
        const originX = Math.floor((nativeW - cropWidth) / 2);

        // Diagnostic : dimensions natives réelles de la photo. Si nativeW≈nativeH
        // (quasi carré), la capture coupe déjà les extrémités du code en amont →
        // le souci est la capture (FOV/aspect), pas cette bande. Mémorisé pour être
        // remonté jusqu'aux logs cloud d'ocrVision (cf. lastPreprocessNative).
        lastPreprocessNative = { w: nativeW, h: nativeH };
        console.log(
          `[preprocess] native ${nativeW}x${nativeH} -> crop ${cropWidth}x${bandHeight} @ ${originX},${originY}`
        );

        const actions: Parameters<typeof manipulateAsync>[1] = [
          { crop: { originX, originY, width: cropWidth, height: bandHeight } }
        ];
        // Réduire UNIQUEMENT si la bande native dépasse la cible (jamais d'upscale,
        // qui ne fait qu'ajouter du flou). Vision vise 3000px, ML Kit 1800px.
        const targetWidth = config.resize.width;
        if (cropWidth > targetWidth) {
          actions.push({ resize: { width: targetWidth } });
        }

        const out = await manipulateAsync(uri, actions, {
          compress: config.compress,
          format: config.format
        });
        return out.uri;
      }
    } catch (error) {
      console.warn('[preprocessImage] getSize/crop natif échoué, repli resize→crop', error);
    }
  }

  // Chemin sans crop (ou repli si les dimensions natives sont indisponibles).
  const resized = await manipulateAsync(uri, [{ resize: config.resize }], {
    compress: config.compress,
    format: config.format
  });

  if (options?.cropForLot && resized.width && resized.height) {
    const bandHeightFactor = options?.narrowBand ? BAND_HEIGHT_FACTOR : 0.5;
    const bandWidthFactor = options?.narrowBand ? BAND_WIDTH_FACTOR : 0.96;
    const bandHeight = Math.floor(resized.height * bandHeightFactor);
    const originY = Math.max(0, Math.floor(resized.height * 0.5 - bandHeight / 2));
    const cropWidth = Math.floor(resized.width * bandWidthFactor);
    const originX = Math.floor((resized.width - cropWidth) / 2);
    const cropped = await manipulateAsync(
      resized.uri,
      [{ crop: { originX, originY, width: cropWidth, height: bandHeight } }],
      { compress: config.compress, format: config.format }
    );
    return cropped.uri;
  }

  return resized.uri;
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
    // numelineFR est l'app France : la correspondance lot se fait sur les
    // rappels RappelConso. Le pays est toujours 'FR' dans ce projet.
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
 * Détecte les tokens qui ne sont JAMAIS un numéro de lot : poids/volumes
 * (250G, 500ML), prix, pourcentages, dates délimitées (15/03/2026) et heures
 * (12:34). Sert à n'afficher à l'utilisateur qu'un vrai numéro de lot. Le
 * matching de rappel, lui, conserve tous les candidats — un token parasite ne
 * matchera de toute façon aucun lot de rappel réel.
 */
// Vrai si a et b sont identiques ou à une seule édition près (insertion,
// suppression ou substitution). Sert à reconnaître un mois mal lu par l'OCR.
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1); // substitution
  if (la > lb) return a.slice(i + 1) === b.slice(i); // suppression dans a
  return a.slice(i) === b.slice(i + 1); // insertion dans a
}

const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Normalized lot key for comparison (strip spaces + separators incl. "/").
const normLot = (s: string) => (s || '').replace(/\s+/g, '').replace(/[-_.\/]/g, '').toUpperCase();

// Do 8 digits form a plausible date (DDMMYYYY or YYYYMMDD)?
function isEightDigitDate(d: string): boolean {
  if (!/^\d{8}$/.test(d)) return false;
  const dd = +d.slice(0, 2), mm = +d.slice(2, 4), yyyy = +d.slice(4, 8);
  if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 2000 && yyyy <= 2099) return true;
  const y2 = +d.slice(0, 4), m2 = +d.slice(4, 6), d2 = +d.slice(6, 8);
  return y2 >= 2000 && y2 <= 2099 && m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31;
}

// Catches dates that looksLikeNonLot misses: collapsed 8-digit dates (15052024)
// and OCR-misread dates (e.g. "1S052024" → "18052024"/"15052024"). EN markers.
function isDateLike(candidate: string): boolean {
  const c = candidate.toUpperCase();
  if (/(DDM|DLC|DLUO|\bEXP\b|BBE|BEST\s*BEFORE|USE\s*BY|SELL\s*BY|EXPIRES?)/.test(c)) return true;
  if (/^\d{1,2}[:/]\d{2}/.test(c)) return true;
  if (/^\d{1,2}[\/.\-]\d{1,2}$/.test(c)) return true;
  if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(c)) return true;
  if (/^\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}$/.test(c)) return true;
  if (isEightDigitDate(c.replace(/\D/g, ''))) return true;
  const tok = c.replace(/[^A-Z0-9]/g, '');
  if (tok.length === 8 && /[A-Z]/.test(tok)) {
    const d8 = tok
      .replace(/[OD]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2')
      .replace(/[SB]/g, '8').replace(/G/g, '6').replace(/T/g, '7');
    const d8s5 = tok
      .replace(/S/g, '5').replace(/[OD]/g, '0').replace(/[IL]/g, '1')
      .replace(/Z/g, '2').replace(/B/g, '8').replace(/G/g, '6').replace(/T/g, '7');
    if (isEightDigitDate(d8) || isEightDigitDate(d8s5)) return true;
  }
  return false;
}

export function looksLikeNonLot(raw: string): boolean {
  const t = (raw || '').trim().toUpperCase();
  if (!t) return true;
  // Poids / volumes : 1-4 chiffres (+ décimale) suivis d'une unité, et rien
  // d'autre. Le garde-fou 1-4 chiffres évite d'exclure un vrai lot long
  // terminé par une lettre (ex. un code à 5+ chiffres).
  if (/^\d{1,4}(?:[.,]\d+)?\s?(?:MG|KG|G|GR|ML|CL|DL|L|OZ|LB|LBS)$/.test(t)) return true;
  // Prix / devises / pourcentages.
  if (/[€$£]/.test(t) || /\b(?:EUR|USD)\b/.test(t)) return true;
  if (/^\d+(?:[.,]\d+)?\s?%$/.test(t)) return true;
  // Dates délimitées : JJ/MM/AAAA et AAAA-MM-JJ (séparateurs / . -).
  if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(t)) return true;
  if (/^\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}$/.test(t)) return true;
  // Heures HH:MM(:SS).
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(t)) return true;
  // Année de DLC, éventuellement précédée de 0-3 lettres (souvent un mois mal
  // lu par l'OCR) : "2026", "APR2026", mais aussi "FR2026"/"PR2026" (= "APR2026"
  // mal reconnu). Ce n'est jamais un lot. (Le matching de rappel garde tout ;
  // on l'écarte seulement de l'AFFICHAGE.)
  if (/^[A-Z]{0,3}(?:19|20)\d{2}$/.test(t)) return true;
  // Mois (mal lu par l'OCR) + chiffres : "APR2026" → "AFR202", "APR226"…
  // 2-4 lettres proches (≤1 faute) d'un mois abrégé, suivies de 2-4 chiffres
  // = une date, jamais un lot. (Un vrai batch code a plus de chiffres ou un
  // suffixe lettre, ex. WN012117E, et n'est pas proche d'un mois.)
  const monthish = t.match(/^([A-Z]{2,4})(\d{2,4})$/);
  if (monthish && MONTHS_EN.some((mo) => withinOneEdit(monthish[1], mo))) return true;
  // Dates "mois abrégé + année/jour" : c'est une DLC/DDM, pas un lot.
  //   APR22, DEC2024, MAY24  → mois + 2-4 chiffres
  //   22APR, 15MAR24         → jour + mois (+ année)
  // EN + abréviations FR distinctes (AVR, JANV, FEV, AOUT, SEPT, OCT...).
  const MONTHS =
    'JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANV|FEV|AVR|MAI|JUIN|JUIL|AOUT|SEPT';
  if (new RegExp(`^(?:${MONTHS})\\d{2,4}$`).test(t)) return true;
  if (new RegExp(`^\\d{1,2}(?:${MONTHS})\\d{0,4}$`).test(t)) return true;
  return false;
}

// Score qualité d'un candidat lot (format-agnostique, valable FDA/USDA comme
// FR) : favorise les codes mêlant lettres ET chiffres, de longueur plausible,
// et les "batch codes" (1-4 lettres + chiffres : WN012117E, SE102922A, L693…).
// Pénalise fortement les fragments de date/heure. Sert à choisir LE meilleur
// candidat au lieu du premier rencontré.
function scoreLotCandidate(candidate: string): number {
  const c = candidate.toUpperCase();
  // Fragments de date/heure (16/02, 23:52) → éliminés d'office.
  if (/^\d{1,2}[:/]\d{2}/.test(c)) return -1000;

  let score = 0;
  const hasLetters = /[A-Z]/.test(c);
  const hasDigits = /\d/.test(c);
  const len = c.length;

  if (hasLetters && hasDigits) score += 40; // mixte = signature typique d'un lot
  else if (hasDigits && !hasLetters) score += 10; // lot purement numérique (FDA "58041")
  else score -= 50; // que des lettres → peu probable

  if (len >= 6 && len <= 16) score += 25;
  else if (len >= 4 && len <= 5) score += 5;
  else if (len > 16) score -= 10;
  else score -= 20; // < 4 caractères

  // Bonus "batch code" : 1-4 lettres puis des chiffres (WN012117E, AB1234, L693…).
  if (/^[A-Z]{1,4}\d{3,}/.test(c)) score += 25;
  // Bonus code numérique à séparateur slash (ex. 4100/01473) — format de lot fréquent.
  if (/^\d{3,}\/\d{3,}$/.test(c)) score += 35;

  return score;
}

/**
 * Parmi une liste de candidats, renvoie LE meilleur lot à afficher : on écarte
 * les parasites (poids/dates/heures via looksLikeNonLot) puis on prend le mieux
 * scoré (scoreLotCandidate favorise les codes longs/mixtes). Évite d'afficher un
 * fragment court ("2493") quand le vrai lot complet ("249334315") est présent.
 */
export function bestDisplayLot(candidates: string[]): string {
  const plausible = (candidates || []).filter((c) => c && !looksLikeNonLot(c));
  if (plausible.length === 0) return '';
  return plausible
    .map((c) => ({ value: c, score: scoreLotCandidate(c) }))
    .sort((a, b) => b.score - a.score)[0].value;
}

/**
 * Is this a "confident" lot — a real code, not arbitrary text (weight, price,
 * date, word/paragraph)? Used in ACCESSIBILITY mode so we never confirm a wrong
 * value to a blind user. Reuses looksLikeNonLot (weights/prices/year-dates) +
 * isDateLike (collapsed/OCR-misread dates).
 */
export function isConfidentLot(candidate: string): boolean {
  const raw = (candidate || '').toUpperCase().trim();
  if (!raw || /\s/.test(raw)) return false; // text/paragraph (multiple words)
  if (isDateLike(raw) || looksLikeNonLot(raw)) return false;
  const compact = raw.replace(/[\/\-_.]/g, '');
  const hasLetters = /[A-Z]/.test(compact);
  const hasDigits = /\d/.test(compact);
  const digitCount = (compact.match(/\d/g) || []).length;
  if (!hasDigits) return false;
  if (/^\d{13,14}$/.test(compact)) return false; // EAN/GTIN
  // Slash-separated numeric code (e.g. 4100/01473).
  if (/^\d{3,}\/\d{3,}$/.test(raw) && compact.length >= 6 && compact.length <= 18) return true;
  // Letter+digit batch codes (L693, AB12, WN012117E): need >=2 digits, len 4-20.
  // Dates / weights / prices / month-words are already excluded above; a plain
  // word-with-one-digit (OMEGA3) has a single digit → still rejected here.
  if (hasLetters && hasDigits && compact.length >= 4 && compact.length <= 20) {
    return digitCount >= 2;
  }
  // Purely numeric code, 5-13 digits, not a date/year (FDA lots are often 5 digits).
  if (!hasLetters && hasDigits && compact.length >= 5 && compact.length <= 13) return true;
  return false;
}
export function isReliableLot(candidate: string): boolean {
  return isConfidentLot(candidate);
}

export async function extractLotNumber(rawTextInput: string, brand?: string): Promise<string> {
  const rawText = stripNonLotMarkings(rawTextInput);
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

  // Liste de mots-clés à exclure (codes-barres, dates, vocabulaire d'étiquette).
  // Les mots nutrition/étiquette collés à des chiffres font de faux lots : cas
  // réel "ABOUT25" extrait de "About 2.5 servings per container" (Lay's).
  const excludeKeywords = [
    'GTIN', 'EAN', 'UPC', 'DDL', 'DDM', 'DLC', 'DLUO', 'BEST', 'BEFORE', 'EXP',
    'USE BY', 'BBF', 'SELL BY', 'À CONSOMMER',
    'ABOUT', 'SERVING', 'CALORIE', 'TOTAL', 'DAILY', 'VALUE', 'PROTEIN',
    'SODIUM', 'VITAMIN', 'POTASSIUM', 'CALCIUM', 'CHOLESTEROL', 'NUTRITION'
  ];

  // Fonction pour vérifier si un texte contient des mots-clés à exclure.
  // Rejette aussi les tokens "lettres + année" type "TAFR2020" : presque toujours
  // une DATE mal lue ("26APR2026" garblé), jamais un lot.
  const containsExcludedKeyword = (text: string): boolean => {
    const upperText = text.toUpperCase();
    if (excludeKeywords.some(keyword => upperText.includes(keyword))) return true;
    return /^[A-Z]{2,8}(?:19|20)\d{2}$/.test(upperText.replace(/\s+/g, ''));
  };

  const isPhoneNumber = (text: string): boolean => {
    const cleaned = text.replace(/[\s\-\.]/g, '');
    return /^0\d{9}$/.test(cleaned);
  };

  // UPC codes (exactly 12 digits) are not lot numbers
  const isUpc = (text: string): boolean => /^\d{12}$/.test(text.replace(/[\s\-\.]/g, ''));

  // Stop keywords — if these appear after the LOT prefix, truncate before them
  const stopKeywords = ['DLC', 'DLUO', 'DDM', 'EXP', 'BEST', 'USE BY', 'BBF', 'BBD', 'BB', 'BEFORE', 'À CONSOMMER', 'CONSUME', 'DATE', 'GTIN', 'EAN', 'UPC'];

  // Extract the tight alphanumeric code right after a keyword — stops at spaces/stop-words/dates
  const extractTightCode = (afterKeyword: string): string => {
    // Take only first token (stop at first space or line break)
    let code = afterKeyword.trim().split(/\s+/)[0] ?? '';
    // Remove trailing punctuation
    code = code.replace(/[.,;:]+$/, '');
    // Remove date-like suffixes (e.g. /01/2026)
    code = code.replace(/[\/\-]\d{2}[\/\-]\d{2,4}.*$/, '');
    return code.toUpperCase();
  };

  // Patterns pour différents formats de numéros de lot (ordre de priorité)
  const patterns = [
    // 0. Slash-separated numeric code (e.g. 4100/01473): a common lot format,
    // distinct from dates (which use dashes / two separators). Captured whole
    // so the other patterns don't split it at the slash.
    {
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
    // 1. FDA/USDA formats: "LOT:", "LOT #", "LOT CODE:", "LOT NUMBER:", "BATCH:", "BATCH NO:", "LOT NO:"
    // Captures tight code right after keyword — stops at space
    {
      name: 'LOT/BATCH keyword (FDA/USDA)',
      priority: 1,
      extract: (text: string): string[] => {
        const results: string[] = [];
        // Match all LOT/BATCH keyword variants
        const regex = /\b(?:LOT\s*(?:CODE|NUMBER|NO|#)?|BATCH\s*(?:NO|NUMBER|CODE)?|LOTE)\s*[:\s#.-]*([A-Z0-9][A-Z0-9\-\/\.]{1,24})/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const raw = match[1];
          // Layout FR fréquent : un SEUL en-tête "À consommer avant le : / N° de
          // lot :" partagé par la DATE puis le vrai lot ("01/02/2027 21:44
          // 16127040"). Le token juste après "lot" est alors la DATE → on la saute,
          // ainsi que l'heure, et on prend le 1er vrai code derrière (16127040).
          if (isDateLike(raw)) {
            const tail = text.slice(match.index + match[0].length, match.index + match[0].length + 64);
            for (const tok of tail.split(/\s+/).filter(Boolean)) {
              const t = tok.replace(/[.,;]+$/, '');
              if (isDateLike(t) || /^\d{1,2}[:H]\d{2}$/.test(t) || /^(?:19|20)\d{2}$/.test(t) || !/\d/.test(t)) continue;
              const c = t.replace(/[^A-Z0-9\-]/gi, '').toUpperCase();
              if (c.length >= 4 && c.length <= 16 && !isPhoneNumber(c) && !isUpc(c) && !containsExcludedKeyword(c)) {
                results.push(c);
                break;
              }
            }
            continue;
          }
          const code = extractTightCode(raw);
          if (code.length >= 2 && /\d/.test(code) && !isPhoneNumber(code) && !isUpc(code) && !containsExcludedKeyword(code)) {
            results.push(code);
          }
        }
        // Also try single "L:" or "L " prefix (common on French packaging)
        const lRegex = /(?:^|[\s\n])L[:\s][:\s]*([A-Z0-9]{3,20})/gi;
        while ((match = lRegex.exec(text)) !== null) {
          const code = extractTightCode(match[1]);
          if (code.length >= 3 && /\d/.test(code) && !isPhoneNumber(code)) {
            results.push(code);
          }
        }
        // "L" COLLÉ aux chiffres ("L26008") : LE format de lot le plus courant en
        // Europe. Sans cette branche prioritaire, il retombait dans les patterns
        // génériques au même rang que du charabia OCR (cas réel : "9780LLE",
        // fragment de "JUILLET" lu tête-bêche, gagnait contre "L26008").
        // Couvre aussi les lots COMPOSÉS à tiret ("L331-4003263405", Haribo) — dès
        // 3 chiffres après le L quand un suffixe -chiffres suit (sinon le code
        // artwork "M517062" du bord d'étiquette gagnait).
        const gluedLRegex = /(?:^|[\s\n])(L\d{3,15}(?:-\s?\d{2,15})?)\b/gi;
        while ((match = gluedLRegex.exec(text)) !== null) {
          const code = match[1].toUpperCase().replace(/\s+/g, '');
          // "L" + 3 chiffres SEUL ("L331") est trop court/ambigu : on exige soit
          // ≥4 chiffres collés, soit le suffixe composé à tiret.
          const digitsOnly = code.slice(1).replace(/-/g, '');
          if ((/^L\d{4,}/.test(code) || code.includes('-')) && !isPhoneNumber(digitsOnly)) {
            results.push(code);
          }
        }
        return results;
      }
    },

    // 2. Pure numeric lot codes (FDA uses these: "Lot: 58041")
    {
      name: 'Numeric-only lot (FDA)',
      priority: 2,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\b(?:LOT|BATCH|LOT\s*CODE|LOT\s*NUMBER|LOT\s*NO)\s*[:\s#.-]*(\d{4,10})\b/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const code = match[1].trim();
          if (!isPhoneNumber(code)) results.push(code);
        }
        return results;
      }
    },

    // 3. Format "N°" ou "NO" suivi du numéro
    {
      name: 'NO prefix',
      priority: 3,
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

    // 4. Format "lettres+chiffres" (ex: AB1234, L1234)
    {
      name: 'Letters+digits',
      priority: 4,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\b([A-Z]{1,3}\d{3,})\b/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lotNum = match[1];
          if (lotNum.length <= 12 && !containsExcludedKeyword(match[0]) && !isPhoneNumber(lotNum)) {
            results.push(lotNum);
          }
        }
        return results;
      }
    },

    // 4b. FDA date-embedded format: letters + 4-8 digits + letter suffix (ex: WN012117E, SE102922A, MS040421J)
    {
      name: 'Letters+digits+letter suffix (FDA)',
      priority: 4,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\b([A-Z]{1,3}\d{4,8}[A-Z]{1,2})\b/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lotNum = match[1];
          if (!containsExcludedKeyword(match[0]) && !isPhoneNumber(lotNum)) {
            results.push(lotNum);
          }
        }
        return results;
      }
    },

    // 5. Format "chiffres+lettres" (ex: 1234AB)
    {
      name: 'Digits+letters',
      priority: 5,
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /\b(\d{3,}[A-Z]{1,4})\b/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const lotNum = match[1];
          if (lotNum.length <= 12 && !containsExcludedKeyword(match[0]) && !isPhoneNumber(lotNum)) {
            results.push(lotNum);
          }
        }
        return results;
      }
    },

    // 6. Séquences alphanumériques denses (fallback)
    {
      name: 'Dense alphanumerics',
      priority: 6,
      extract: (text: string): string[] => {
        const tokens = text
          .replace(/[^A-Z0-9]/gi, ' ')
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean);
        return tokens.filter((token) => token.length >= 6 && token.length <= 20 && /\d/.test(token) && /[A-Z]/.test(token));
      }
    },

    // 6b. Concaténation pleine ligne : pour les codes inkjet multi-segments
    // ("P21 20:56 R 297") où chaque token est trop court pour matcher seul.
    // Strips tout sauf alphanum, colle tous les tokens de la ligne, valide longueur+mixte.
    {
      name: 'Full-line token concat',
      priority: 6,
      extract: (text: string): string[] => {
        const results: string[] = [];
        for (const line of text.split('\n')) {
          const toks = line.replace(/[^A-Z0-9]/gi, ' ').split(/\s+/).filter(Boolean);
          if (toks.length < 3) continue;
          const full = toks.join('').toUpperCase();
          if (
            full.length >= 8 && full.length <= 24 &&
            /\d/.test(full) && /[A-Z]/.test(full) &&
            !isDateLike(full) && !looksLikeNonLot(full)
          ) {
            results.push(full);
          }
        }
        return results;
      }
    }
  ];

  // Collecter TOUS les candidats. Les patterns à préfixe explicite (LOT/BATCH,
  // "Numeric-only lot" qui exige le mot LOT, N°) reçoivent un gros bonus :
  // quand l'étiquette dit "LOT xxx", c'est la vérité (priorité <= 3 ici).
  const allCandidates: Array<{ value: string; bonus: number }> = [];

  for (const pattern of patterns) {
    const matches = pattern.extract(cleaned);
    if (matches.length > 0) {
      console.log(`✅ Found ${matches.length} candidate(s) with pattern "${pattern.name}": ${matches.join(', ')}`);
      const bonus = pattern.priority <= 3 ? 1000 : 0;
      for (const m of matches) allCandidates.push({ value: m.toUpperCase(), bonus });
    }
  }

  // Ne garder, pour l'affichage, que les candidats qui ressemblent vraiment à
  // un lot : on écarte poids, prix, dates et heures (looksLikeNonLot). Puis on
  // sélectionne LE MEILLEUR par score qualité (au lieu du premier trouvé), pour
  // éviter qu'un fragment l'emporte sur un vrai code de lot. Si tous les
  // candidats sont des parasites, on n'affiche RIEN plutôt qu'une valeur
  // trompeuse. (Le matching de rappel garde la liste complète via extractAllLotCandidates.)
  const ranked = allCandidates
    .filter((c) => !looksLikeNonLot(c.value))
    .map((c) => ({ value: c.value, score: c.bonus + scoreLotCandidate(c.value) }))
    .sort((a, b) => b.score - a.score);

  // Préférer les sur-ensembles : si A est une sous-chaîne stricte de B (et B est
  // nettement plus long), A est probablement un fragment tronqué — on le retire.
  // Ex. "P212056" ⊂ "P212056R297" → "P212056" éliminé.
  const deduped = ranked.filter(({ value: a }) =>
    !ranked.some(({ value: b }) => b !== a && b.length > a.length + 2 && b.includes(a))
  );

  if (deduped.length > 0) {
    const lotNumber = deduped[0].value;
    console.log(`✅ Best lot number: ${lotNumber} (score ${deduped[0].score}, ${allCandidates.length} candidats)`);
    return lotNumber;
  }

  console.log('[extractLotNumber] No pattern matched (ou tous les candidats ressemblaient à un poids/date/heure)');
  console.log('❌ No lot number found');
  return '';
}

/**
 * Extrait TOUS les candidats de numéros de lot possibles
 */
export async function extractAllLotCandidates(rawTextInput: string, brand?: string): Promise<string[]> {
  // Même filtre que extractLotNumber : EMB / marques sanitaires ovales ≠ lots.
  const rawText = stripNonLotMarkings(rawTextInput);
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

  const excludeKeywords = [
    'GTIN', 'EAN', 'UPC', 'DDL', 'DDM', 'DLC', 'DLUO', 'BEST', 'BEFORE', 'EXP',
    'USE BY', 'BBF', 'SELL BY', '? CONSOMMER',
    'ABOUT', 'SERVING', 'CALORIE', 'TOTAL', 'DAILY', 'VALUE', 'PROTEIN',
    'SODIUM', 'VITAMIN', 'POTASSIUM', 'CALCIUM', 'CHOLESTEROL', 'NUTRITION'
  ];
  const containsExcludedKeyword = (text: string): boolean => {
    const upperText = text.toUpperCase();
    if (excludeKeywords.some(keyword => upperText.includes(keyword))) return true;
    // Tokens "lettres + année" ("TAFR2020") = date mal lue, jamais un lot.
    return /^[A-Z]{2,8}(?:19|20)\d{2}$/.test(upperText.replace(/\s+/g, ''));
  };

  // Patterns (copie des patterns existants)
  const patterns = [
    {
      regex: /(?:^|[^A-Z])(?:LOT[:\s\-.]*|L[:\s\-.]+)([A-Z0-9]{3,}[A-Z0-9\s\-/.]*)/gi,
      name: 'LOT/L prefix',
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /(?:^|[^A-Z])(?:LOT[:\s\-.]*|L[:\s\-.]+)([A-Z0-9]{3,}[A-Z0-9\s\-/.]*)/gi;
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
      regex: /(?:^|\s)(L?\d+[A-Z0-9\s]*)/gi,
      name: 'L at line start',
      extract: (text: string): string[] => {
        const results: string[] = [];
        const regex = /(?:^|\s)(L?\d+[A-Z0-9\s]*)/gi;
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
    // Ligne faite UNIQUEMENT de groupes de chiffres (ex. "2 493 34315"), sans
    // lettre ni heure (":") : un lot numérique est souvent imprimé ainsi avec
    // des espaces. On ajoute la concaténation complète des chiffres ("249334315")
    // pour ne pas n'afficher qu'un fragment ("2493" / "34315").
    if (/^[\d\s]+$/.test(line)) {
      const joined = line.replace(/\D/g, '');
      if (joined.length >= 5 && joined.length <= 16) {
        addCandidate(joined);
      }
    }
    for (let i = 0; i < tokens.length; i++) {
      for (let size = 2; size <= 5; size++) {
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
  // Anti-truncation: # of multi-frame frames that read the SAME reliable lot.
  // A truncated fragment varies frame-to-frame (curved can); a full lot stabilises.
  intraFrameAgreement?: number;
}

// Étapes du pipeline OCR, remontées au fur et à mesure pour le feedback UI.
export type OcrStage = 'mlkit' | 'vision' | 'claude';

// En-deçà de cette longueur (hors espaces), un lot lu est jugé probablement
// TRONQUÉ (ex. "148R" extrait de "MG26148R49A") : on déclenche alors Claude pour
// tenter un code complet, même si Vision/ML Kit avaient déjà sorti ce partiel.
// Crucial en mode malvoyant, où l'utilisateur ne peut pas corriger à la main.
const MIN_CONFIDENT_LOT_LENGTH = 6;
const lotCharLen = (lot?: string | null): number => (lot ? lot.replace(/\s/g, '').length : 0);
const isLotTooShort = (lot?: string | null): boolean => {
  const len = lotCharLen(lot);
  return len > 0 && len < MIN_CONFIDENT_LOT_LENGTH;
};

// In accessibility mode the continuous scan caps paid OCR calls; when false, only
// the free on-device ML Kit runs.
export interface PerformOcrOptions {
  allowPaidFallback?: boolean;
}

// Localisation PLEIN CADRE du lot, pour le mode mains-libres/malvoyant : la bande
// centrale suppose que l'utilisateur centre le code, ce qu'un utilisateur aveugle
// ne peut pas faire (cas réel : paquet de bacon tenu entier devant la caméra, la
// ligne "Lot 26135030" tout en haut → hors bande → charabia "OUT50"). ML Kit (local,
// gratuit) lit la frame ENTIÈRE et donne la POSITION des blocs ; on choisit le bloc
// au texte le plus "lot-like" et on renvoie un crop natif recadré dessus, que le
// pipeline normal (ML Kit → Vision → Claude) relit en gros plan.
async function locateLotZone(uri: string): Promise<string | null> {
  try {
    const probe = await manipulateAsync(uri, []);
    const imgW = probe.width ?? 0;
    const imgH = probe.height ?? 0;
    if (!imgW || !imgH) return null;

    const recognition: any = await TextRecognition.recognize(uri);
    const blocks: any[] = Array.isArray(recognition?.blocks) ? recognition.blocks : [];
    let best: { score: number; frame: { left: number; top: number; width: number; height: number } } | null = null;

    for (const block of blocks) {
      const rawText = String(block?.text ?? '');
      const text = stripNonLotMarkings(rawText).toUpperCase();
      const frame = block?.frame;
      if (!text.trim() || !frame || !frame.width || !frame.height) continue;

      let score = 0;
      // Mot-clé LOT explicite = signal le plus fort.
      if (/\bLOT\b/.test(text)) score += 100;
      // L collé aux chiffres (L26008, et composés "L331-4003263405") = format
      // européen dominant.
      if (/(?:^|[\s\n])L\d{3,}(?:[\s-]?\d+)?/.test(text)) score += 80;
      // Tokens denses lettres+chiffres ou numériques longs.
      const tokens = text.match(/[A-Z0-9]{6,22}/g) || [];
      if (tokens.some((t) => /\d/.test(t) && /[A-Z]/.test(t) && !/^(?:19|20)\d{2}/.test(t))) score += 40;
      if (tokens.some((t) => /^\d{6,12}$/.test(t))) score += 30;
      // Codes de production inkjet FR sur couvercles : usine P+chiffres + run R+chiffres.
      // Aucun LOT ni token long — sans cette règle le bloc score 0 et est ignoré.
      if (/\bP\d{1,3}\b/.test(text) && /\bR\s?\d{2,4}\b/.test(text)) score += 60;
      // ≥2 tokens courts lettres+chiffres (P21, 56R…) = cluster inkjet de production.
      const shortMixed = text.match(/\b[A-Z]\d{1,3}\b/g) || [];
      if (shortMixed.length >= 2) score += 30;

      // Seuil : un simple nombre 6-12 chiffres seul (+30) ou un cluster shortMixed
      // seul (+30) = prix / code produit / fragment, PAS un lot fiable (cas réels :
      // "2103000" prix, bandes 417x850 / 264x1054 de charabia). On exige au moins
      // un signal dense lettre+chiffre (+40), inkjet P+R (+60), L-code (+80) ou le
      // mot LOT (+100) — sinon on laisse la bande centrale pleine largeur.
      if (score >= 40 && (!best || score > best.score)) {
        best = { score, frame };
      }
    }
    if (!best) return null;

    // Lot = code HORIZONTAL : on recadre une BANDE PLEINE LARGEUR centrée sur la
    // hauteur du bloc, JAMAIS une boîte étroite. Un crop de 230-420px de large
    // (l'ancienne marge) tronquait le code → "rien de cohérent" même renvoyé à
    // Claude. Pleine largeur + ~22% de hauteur = même forme que la bande centrale
    // qui fonctionne, mais REPOSITIONNÉE sur la ligne où est réellement le lot.
    const bandH = Math.min(imgH, Math.max(Math.ceil(best.frame.height * 4), Math.floor(imgH * 0.22)));
    const centerY = best.frame.top + best.frame.height / 2;
    const originX = 0;
    const originY = Math.max(0, Math.min(imgH - bandH, Math.floor(centerY - bandH / 2)));
    const width = imgW;
    const height = bandH;
    if (height < 24) return null;

    const out = await manipulateAsync(
      uri,
      [{ crop: { originX, originY, width, height } }],
      { compress: 0.9, format: SaveFormat.JPEG }
    );
    console.log(`[LocateLot] zone lot trouvée (score=${best.score}) crop ${width}x${height} @${originX},${originY}`);
    return out.uri;
  } catch (error) {
    console.warn('[LocateLot] localisation plein-cadre échouée', error);
    return null;
  }
}

export async function performOcr(
  uri: string,
  brand?: string,
  onStage?: (stage: OcrStage) => void,
  options?: PerformOcrOptions
): Promise<LotExtractionResult> {
  ensureMlkitAvailable();
  const allowPaid = options?.allowPaidFallback !== false;

  try {
    // ML Kit en premier (local, instantané), Google Vision en fallback si lot non détecté
    let result: OCRResult;

    console.log('[Lot OCR] Trying ML Kit first (local, fast)...');
    onStage?.('mlkit');

    // Recadrage en bande étroite (approche FR) pour ML Kit comme pour l'IA, dans
    // TOUS les modes : un lot occupe une fine bande ; OCR-er la frame entière noie
    // le code (trop petit) → lectures incohérentes (c'était le bug du mode malvoyant).
    const processedForMlkit = await preprocessImage(uri, { cropForLot: true, narrowBand: true });
    result = await runMlkit(processedForMlkit);

    try {
      await FileSystem.deleteAsync(processedForMlkit, { idempotent: true });
    } catch (error) {
      console.warn('Failed to delete mlkit processed image', error);
    }

    // Si ML Kit n'a trouvé aucun lot — OU un lot trop court (probablement tronqué)
    // — basculer sur les fallbacks distants pour viser un code complet.
    const mlkitLot = await extractLotNumber(result.text, brand);
    if ((!mlkitLot || isLotTooShort(mlkitLot)) && allowPaid) {
      // Image IA UNIQUE : 2000px JPEG 0.85 (visionPreprocessConfig), calculée
      // une seule fois ici puis réutilisée pour Vision PUIS Claude. Évite de
      // re-préprocesser et garantit que Claude (tier le plus lent) ne lit plus
      // l'image brute pleine résolution mais la même image légère que Vision.
      let aiImageUri: string | null = null;
      if (isVisionAvailable() || isClaudeAvailable()) {
        try {
          aiImageUri = await preprocessImage(uri, { cropForLot: true, narrowBand: true, useVisionConfig: true });
        } catch (error) {
          console.warn('[Lot OCR] Failed to build AI image (2000px JPEG)', error);
        }
      }

      try {
        if (isVisionAvailable() && aiImageUri) {
          console.log('[Lot OCR] ML Kit found no lot number, forcing Google Vision fallback...');
          onStage?.('vision');
          try {
            const visionResult = await runVisionFallback(aiImageUri, {
              nativeWidth: lastPreprocessNative?.w,
              nativeHeight: lastPreprocessNative?.h,
              captureDiag: captureDiag ?? undefined
            });
            // Garder ML Kit si Vision renvoie un texte vide (frame floue) OU un lot
            // MOINS complet que celui déjà lu (on n'adopte Vision que s'il fait au
            // moins aussi bien, sinon on régresserait sur un partiel pire).
            const visionLot = await extractLotNumber(visionResult.text, brand);
            if (
              visionResult.text &&
              visionResult.text.trim().length > 0 &&
              lotCharLen(visionLot) >= lotCharLen(mlkitLot)
            ) {
              result = visionResult;
              console.log('[Lot OCR] Using Google Vision fallback result');
            }
          } catch (error) {
            console.warn('[Lot OCR] Vision fallback failed, keeping ML Kit result', error);
          }
        } else if (!isVisionAvailable()) {
          console.log('[Lot OCR] Vision not configured, cannot fallback');
        }

        // Niveau 3 — Claude Sonnet via Cloud Function. Déclenché uniquement si
        // ni ML Kit ni Vision n'ont produit un texte d'où on peut extraire un
        // numéro de lot. Le check `hasPlausibleLotPattern` interne à
        // tryClaudeFallback fait un second gate qui couvre les cas où Vision a
        // produit du texte exploitable mais que notre extracteur n'a pas su
        // l'isoler. Réutilise la MÊME image 2000px JPEG que Vision.
        const postVisionLot = await extractLotNumber(result.text, brand);
        const postVisionTooShort = isLotTooShort(postVisionLot);
        if ((!postVisionLot || postVisionTooShort) && isClaudeAvailable() && aiImageUri) {
          console.log(
            postVisionTooShort
              ? `[Lot OCR] Lot trop court ("${postVisionLot}"), essai Claude (Opus) pour un code complet...`
              : '[Lot OCR] Vision also produced no extractable lot, trying Claude...'
          );
          onStage?.('claude');
          const claudeResult = await tryClaudeFallback(aiImageUri, result, 'lot', {
            force: postVisionTooShort,
            nativeWidth: lastPreprocessNative?.w,
            nativeHeight: lastPreprocessNative?.h,
            captureDiag: captureDiag ?? undefined
          });
          if (claudeResult) {
            const claudeLot = await extractLotNumber(claudeResult.text, brand);
            // N'adopter Claude que s'il lit un lot AU MOINS aussi complet (longueur)
            // que l'actuel. Si on n'avait aucun lot, tout résultat Claude passe.
            if (lotCharLen(claudeLot) >= lotCharLen(postVisionLot) && (claudeLot || !postVisionLot)) {
              console.log('[Lot OCR] Using Claude fallback result');
              result = claudeResult;
            } else {
              console.log(
                `[Lot OCR] Claude ("${claudeLot || 'rien'}") pas plus complet que ("${postVisionLot}"), conservé`
              );
            }
          }
        } else if (!postVisionLot && !isClaudeAvailable()) {
          console.log('[Lot OCR] Claude not configured, no further fallback available');
        }
      } finally {
        // Supprimer l'image IA une seule fois, après Vision ET Claude.
        if (aiImageUri) {
          try {
            await FileSystem.deleteAsync(aiImageUri, { idempotent: true });
          } catch (error) {
            console.warn('Failed to delete AI processed image', error);
          }
        }
      }
    } else {
      console.log('[Lot OCR] ML Kit found lot number, skipping Vision API');
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
      candidates,
      // Single-frame: no cross-frame comparison → 1 vote if a reliable lot is present.
      intraFrameAgreement: lot && isConfidentLot(lot) ? 1 : 0
    };
  } catch (error) {
    console.error('[Lot OCR] Error:', error);
    throw error;
  }
}

/**
 * Note un résultat OCR pour choisir la MEILLEURE frame parmi plusieurs.
 * Plus le score est élevé, plus la frame est exploitable (confiance, densité,
 * faible bruit, présence d'un motif de lot type LOT/L+chiffres). Format-agnostique.
 */
function scoreOcrResult(result: OCRResult): number {
  const text = result.text || '';
  if (!text.trim()) return 0;

  const quality = assessOcrQuality(result);
  let score = 0;

  if (quality.averageConfidence !== null) {
    score += quality.averageConfidence * 100;
  } else {
    score += 50;
  }

  score += Math.min(40, text.trim().length / 2);
  score += Math.min(20, quality.lineCount * 4);
  score -= quality.noiseRatio * 50;

  const upper = text.toUpperCase();
  if (/(?:^|[^A-Z])LOT[:\s\-.]*[A-Z0-9]{3,}/.test(upper)) {
    score += 50; // motif "LOT xxx" explicite
  } else if (/(?:^|[^A-Z])L\d{3,}/.test(upper)) {
    score += 30; // motif L+chiffres
  } else if (/\b\d{5,12}\b/.test(upper)) {
    score += 15; // série de chiffres
  }

  return score;
}

/**
 * Capture multi-frames : ML Kit sur N images en parallèle, on garde la
 * meilleure (scoreOcrResult), puis Vision → Claude UNIQUEMENT si la meilleure
 * frame ne donne pas de lot. Plus robuste sur photo floue/bougée que la frame
 * unique. Conserve les patterns FDA/USDA (extractLotNumber) et le feedback
 * d'étape `onStage`. Porté de l'app sœur FR.
 */
export async function performOcrMultiFrame(
  uris: string[],
  brand?: string,
  onStage?: (stage: OcrStage) => void,
  options?: PerformOcrOptions
): Promise<LotExtractionResult> {
  ensureMlkitAvailable();
  const allowPaid = options?.allowPaidFallback !== false;

  if (!uris || uris.length === 0) {
    throw new Error('No frames provided to performOcrMultiFrame');
  }
  if (uris.length === 1) {
    return performOcr(uris[0], brand, onStage, options);
  }

  console.log(`[Multi-frame OCR] Processing ${uris.length} frames with ML Kit...`);
  onStage?.('mlkit');

  // 1) ML Kit sur chaque frame en parallèle.
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

  // 2) Meilleure frame.
  frameResults.sort((a, b) => b.score - a.score);
  const best = frameResults[0];
  console.log(`[Multi-frame OCR] Best frame score=${best.score.toFixed(1)}`);

  // 3) Vision puis Claude seulement si la meilleure frame ne donne pas de lot.
  let result: OCRResult = best.result;
  const bestLot = await extractLotNumber(best.result.text, brand);

  // Stabilité inter-frames (gratuit, ~0 ms) : ML Kit a déjà lu chaque frame en
  // local. Un lot correct se relit À L'IDENTIQUE sur ≥2 frames ; une lecture qui
  // varie d'une frame à l'autre (point-matrice pâle mal lu, ex. paquet Francine)
  // est suspecte → on la fait VÉRIFIER par Vision/Claude au lieu de l'accepter en
  // silence. Les scans stables (la grande majorité) restent instantanés.
  const perFrameLots = await Promise.all(
    frameResults.map((f) => extractLotNumber(f.result.text, brand).catch(() => ''))
  );
  const bestKey = normLot(bestLot || '');
  const frameAgreement = bestKey
    ? perFrameLots.filter((l) => l && normLot(l) === bestKey).length
    : 0;
  let unstableLot = !!bestLot && frameResults.length >= 2 && frameAgreement < 2;
  if (unstableLot) {
    console.log(
      `[Multi-frame OCR] Lot "${bestLot}" instable (${frameAgreement}/${frameResults.length} frames concordent) → vérification IA`
    );
  }

  // Lot "FORT" = ancré par un marqueur explicite (L+chiffres ou mot-clé LOT dans
  // le texte). Un lot "faible" (token générique type "M517062", code artwork
  // pré-imprimé du bord d'étiquette Haribo) ne doit PAS bloquer la localisation
  // plein-cadre : le vrai lot ("L331-4003263405") est peut-être ailleurs.
  const isStrongLot = (s: string | null | undefined) => !!s && /^L\d{3,}/i.test(s.replace(/[\s-]/g, ''));
  const textHasLotKeyword = /\bLOT\b/i.test(best.result.text);

  // Localisation PLEIN CADRE (mode mains-libres/malvoyant) : si la bande centrale
  // n'a donné AUCUN lot — ou seulement un lot FAIBLE — le vrai code est peut-être
  // ailleurs dans l'image (l'utilisateur aveugle ne peut pas le centrer). On le
  // localise via les positions de blocs ML Kit (gratuit) et on re-OCR la zone.
  let zoneUri: string | null = null;
  let effectiveLot = bestLot;
  if (!bestLot || (!isStrongLot(bestLot) && !textHasLotKeyword)) {
    zoneUri = await locateLotZone(best.uri);
    if (zoneUri) {
      try {
        const zoneRead = await runMlkit(zoneUri);
        const zoneLot = await extractLotNumber(zoneRead.text, brand);
        const zoneIsStrong = isStrongLot(zoneLot) || /\bLOT\b/i.test(zoneRead.text);
        // Adoption : si on n'avait RIEN, tout lot de zone suffisant passe ; si on
        // avait un lot FAIBLE, seule une zone FORTE (ancrée L/LOT) le remplace.
        if (zoneLot && !isLotTooShort(zoneLot) && (!bestLot || zoneIsStrong)) {
          console.log(
            `[Multi-frame OCR] Lot localisé plein-cadre : "${zoneLot}"${bestLot ? ` (remplace le lot faible "${bestLot}")` : ''}`
          );
          result = zoneRead;
          effectiveLot = zoneLot;
          // Un lot ancré par un marqueur explicite est digne de confiance : pas
          // d'arbitrage IA superflu déclenché par l'instabilité de l'ANCIEN lot.
          if (zoneIsStrong) unstableLot = false;
        }
      } catch (error) {
        console.warn('[Multi-frame OCR] re-OCR de la zone localisée échoué', error);
      }
    }
  }

  // Aucun lot — OU lot trop court (tronqué) — OU lot instable → fallbacks distants.
  if ((!effectiveLot || isLotTooShort(effectiveLot) || unstableLot) && allowPaid) {
    let aiImageUri: string | null = null;
    if (isVisionAvailable() || isClaudeAvailable()) {
      try {
        // Si une zone lot a été localisée plein-cadre, l'IA lit CETTE zone (gros
        // plan) plutôt que la bande centrale aveugle.
        aiImageUri = zoneUri ?? (await preprocessImage(best.uri, { cropForLot: true, narrowBand: true, useVisionConfig: true }));
      } catch (error) {
        console.warn('[Multi-frame OCR] Failed to build AI image', error);
      }
    }
    try {
      if (isVisionAvailable() && aiImageUri) {
        onStage?.('vision');
        try {
          const visionResult = await runVisionFallback(aiImageUri, {
            nativeWidth: lastPreprocessNative?.w,
            nativeHeight: lastPreprocessNative?.h,
            captureDiag: captureDiag ?? undefined
          });
          // Ne remplacer la meilleure frame ML Kit que si Vision a du texte ET un
          // lot au moins aussi complet (sinon on régresserait sur un partiel pire).
          const visionLot = await extractLotNumber(visionResult.text, brand);
          if (
            visionResult.text &&
            visionResult.text.trim().length > 0 &&
            lotCharLen(visionLot) >= lotCharLen(effectiveLot)
          ) {
            result = visionResult;
          }
          console.log('[Multi-frame OCR] Vision fallback used');
        } catch (error) {
          console.warn('[Multi-frame OCR] Vision fallback failed, keeping ML Kit result', error);
        }
      }
      const postVisionLot = await extractLotNumber(result.text, brand);
      const postVisionTooShort = isLotTooShort(postVisionLot);
      if ((!postVisionLot || postVisionTooShort || unstableLot) && isClaudeAvailable() && aiImageUri) {
        console.log(
          unstableLot
            ? `[Multi-frame OCR] Lot instable ("${postVisionLot}"), arbitrage Claude...`
            : postVisionTooShort
              ? `[Multi-frame OCR] Lot trop court ("${postVisionLot}"), essai Claude (Opus)...`
              : '[Multi-frame OCR] No extractable lot, trying Claude...'
        );
        onStage?.('claude');
        const claudeResult = await tryClaudeFallback(aiImageUri, result, 'lot', {
          force: postVisionTooShort || unstableLot,
          nativeWidth: lastPreprocessNative?.w,
          nativeHeight: lastPreprocessNative?.h,
          captureDiag: captureDiag ?? undefined
        });
        if (claudeResult) {
          const claudeLot = await extractLotNumber(claudeResult.text, brand);
          // Adopter Claude s'il est au moins aussi complet — OU si la lecture
          // locale est INSTABLE : Claude fait alors foi même s'il lit plus court
          // (la lecture instable insère souvent des caractères fantômes).
          const adoptClaude = claudeLot
            ? lotCharLen(claudeLot) >= lotCharLen(postVisionLot) ||
              (unstableLot && !isLotTooShort(claudeLot))
            : !postVisionLot && Boolean(claudeResult.text);
          if (adoptClaude) {
            console.log('[Multi-frame OCR] Claude fallback used');
            result = claudeResult;
          } else {
            console.log(
              `[Multi-frame OCR] Claude ("${claudeLot || 'rien'}") pas retenu face à ("${postVisionLot}"), conservé`
            );
          }
        }
      }
    } finally {
      if (aiImageUri) {
        try {
          await FileSystem.deleteAsync(aiImageUri, { idempotent: true });
        } catch {
          /* noop */
        }
      }
    }
  }

  // Nettoyer la zone localisée (idempotent : déjà supprimée si servie d'image IA).
  if (zoneUri) {
    try {
      await FileSystem.deleteAsync(zoneUri, { idempotent: true });
    } catch {
      /* noop */
    }
  }

  // 4) Nettoyer toutes les frames capturées.
  for (const frame of frameResults) {
    try {
      await FileSystem.deleteAsync(frame.uri, { idempotent: true });
    } catch {
      /* noop */
    }
  }

  // 5) Filtrer la marque (comme performOcr) puis extraire lot + candidats.
  let filteredText = result.text;
  if (brand) {
    const brandUpper = brand.toUpperCase();
    filteredText = result.text
      .split('\n')
      .filter((line) => !line.trim().toUpperCase().includes(brandUpper))
      .join('\n');
  }

  const lot = await extractLotNumber(filteredText, brand);
  const candidates = await extractAllLotCandidates(filteredText, brand);

  // Anti-truncation (free): ML Kit already ran on each frame. Count how many frames
  // read the SAME reliable lot as the final one. A truncated fragment (curved can)
  // varies frame-to-frame → low agreement; a full lot stabilises.
  // (perFrameLots déjà calculé plus haut pour la porte de stabilité.)
  const lotKey = normLot(lot);
  const intraFrameAgreement = lotKey
    ? perFrameLots.filter((l) => l && isConfidentLot(l) && normLot(l) === lotKey).length
    : 0;

  return { lot, result, candidates, intraFrameAgreement };
}
