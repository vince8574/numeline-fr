import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { OCRResult } from '../types';
import { getAppCheckToken } from './appCheckService';

type ClaudeConfig = {
  endpoint?: string;
};

/**
 * Renvoie l'URL de la Cloud Function `ocrClaude`. La clé API Anthropic est
 * stockée comme secret Firebase et lue uniquement côté serveur.
 *
 * Override possible via :
 *   - app.json → expo.extra.claude.endpoint
 *   - variable d'env  EXPO_PUBLIC_CLAUDE_ENDPOINT
 */
function getClaudeConfig(): ClaudeConfig {
  const extra = (Constants.expoConfig?.extra as any) ?? {};
  const claudeExtra = (extra.claude as ClaudeConfig) ?? {};
  const env = (globalThis as any)?.process?.env;

  return {
    endpoint: env?.EXPO_PUBLIC_CLAUDE_ENDPOINT || claudeExtra.endpoint
  };
}

export function isClaudeAvailable(): boolean {
  const { endpoint } = getClaudeConfig();
  return Boolean(endpoint);
}

/**
 * Retire du texte OCR les marquages réglementaires qui RESSEMBLENT à des lots
 * mais n'en sont jamais (faux positifs réels observés côté US) :
 * - "EMB 44014B"        → code EMBALLEUR français (établissement d'emballage).
 * - "FR 44.014.001 CE"  → marque sanitaire ovale UE (agrément vétérinaire).
 * - "GB WD028" / "UK ... EC" → marque d'identification ovale UK (ex. Kraft),
 *   pré-imprimée IDENTIQUE sur tous les paquets → fausse alerte de rappel.
 * - "EST. 38" / "P-123" → ovale d'inspection USDA (établissement US).
 * Les retirer AVANT le pattern-matching laisse le vrai lot (ex. "148 660 T1",
 * "6085S53") gagner au lieu du marquage réglementaire.
 */
export function stripNonLotMarkings(text: string): string {
  // Lignes d'ADRESSE (service consommateurs) : "F 53089 Laval cedex 9",
  // "CS 90123", "BP 35"… Un "F+5 chiffres" (pays+code postal) passe pour un
  // lot. Toute ligne contenant CEDEX est une adresse, jamais un lot.
  let cleaned = text
    .split('\n')
    .filter((line) => !/CEDEX/i.test(line) && !/SERVICE\s+CONSO/i.test(line))
    .join('\n')
    .replace(/\b(?:CS|BP)[\s.]?\d{2,6}\b/gi, ' ');
  // Si une mention CEDEX existe quelque part (l'OCR coupe parfois la ligne),
  // retirer aussi les "F + code postal" isolés.
  if (/CEDEX/i.test(text)) {
    cleaned = cleaned.replace(/\bF[\s.\-]?\d{5}\b/gi, ' ');
  }
  return cleaned
    .replace(/\bEMB[\s.:]*[A-Z0-9][A-Z0-9.\-]{1,14}/gi, ' ')
    .replace(/\bFR[\s.]*\d{2}[\s.]+\d{3}[\s.]+\d{3}[\s.]*(?:CE|EC)?\b/gi, ' ')
    .replace(/\b(?:GB|UK)[\s.:]*[A-Z]{1,3}[\s.]?\d{2,4}[A-Z]?\b[\s.]*(?:CE|EC)?\b/gi, ' ')
    // USDA : "EST. 38", "EST 7155A" (le \b évite de toucher "BEST") ; "P-123"
    // uniquement avec tiret pour ne pas amputer un vrai lot type "P123".
    .replace(/\bEST[\s.:#]*\d{1,5}[A-Z]?\b/gi, ' ')
    .replace(/\bP-\d{1,5}\b/gi, ' ');
}

/**
 * Vérifie si un texte OCR contient un pattern de lot plausible.
 * Utilisé pour décider si on appelle Vision ou Claude en recours.
 */
export function hasPlausibleLotPattern(text: string): boolean {
  if (!text) return false;
  // Un marquage réglementaire (EMB/ovale sanitaire) ne doit pas faire croire
  // qu'un lot est déjà lu — sinon Claude est court-circuité à tort.
  const cleaned = stripNonLotMarkings(text).replace(/\s+/g, ' ').toUpperCase();
  // Préfixe LOT explicite
  if (/(?:^|[^A-Z])LOT[:\s\-.]*[A-Z0-9]{3,22}/.test(cleaned)) return true;
  // Préfixe L + chiffres
  if (/(?:^|[^A-Z])L\d{3,15}/.test(cleaned)) return true;
  // Tokens alphanumériques denses (≥4 caractères dont au moins 2 chiffres et pas un EAN)
  const tokens = cleaned.match(/[A-Z0-9]{4,22}/g) || [];
  const hasGoodToken = tokens.some((token) => {
    const digitCount = (token.match(/\d/g) || []).length;
    // Un EAN/GTIN fait 13-14 chiffres purs : on exclut
    if (token.length >= 13 && digitCount === token.length) return false;
    return digitCount >= 2;
  });
  return hasGoodToken;
}

export async function runClaudeFallback(uri: string): Promise<OCRResult> {
  const { endpoint } = getClaudeConfig();
  if (!endpoint) {
    throw new Error('Cloud Function ocrClaude non configurée');
  }

  console.log('[ClaudeFallback] Reading image as base64...');
  const base64Image = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });

  // Détecter le media type d'après l'extension (heuristique simple)
  const lowerUri = uri.toLowerCase();
  let mediaType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/jpeg';
  if (lowerUri.endsWith('.png')) mediaType = 'image/png';
  else if (lowerUri.endsWith('.webp')) mediaType = 'image/webp';

  const appCheckToken = await getAppCheckToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  console.log('[ClaudeFallback] Calling ocrClaude Cloud Function...');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageBase64: base64Image,
      mediaType
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[ClaudeFallback] ocrClaude error', response.status, errorText);
    throw new Error(`ocrClaude failed: ${response.status} ${errorText}`);
  }

  const data: {
    text?: string;
    lines?: Array<{ content: string; confidence?: number }>;
    confidence?: number;
    usage?: {
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
    };
  } = await response.json();

  if (data.usage) {
    console.log(
      `[ClaudeFallback] tokens: input=${data.usage.inputTokens}, ` +
        `output=${data.usage.outputTokens}, cache_read=${data.usage.cacheReadTokens}, ` +
        `cache_creation=${data.usage.cacheCreationTokens}`
    );
  }

  return {
    text: data.text || '',
    lines: data.lines || [],
    confidence: data.confidence,
    source: 'claude-fallback'
  };
}

/**
 * Décide d'appeler Claude en dernier recours :
 * - Si Claude n'est pas configuré → null
 * - Si le résultat OCR (ML Kit ou Vision) contient déjà un lot plausible → null
 * - Sinon → appel Claude
 */
export async function tryClaudeFallback(
  uri: string,
  ocrResult: OCRResult,
  context: 'lot'
): Promise<OCRResult | null> {
  if (!isClaudeAvailable()) {
    return null;
  }

  // Si le résultat précédent contient déjà un lot plausible, inutile de payer Claude
  if (hasPlausibleLotPattern(ocrResult.text)) {
    console.log('[ClaudeFallback] Skipped: previous result has a plausible lot pattern');
    return null;
  }

  console.log(`[ClaudeFallback] Triggered for ${context} (no plausible lot in previous OCR result)`);

  try {
    const result = await runClaudeFallback(uri);
    if (result.text) {
      console.log('[ClaudeFallback] Success - lot extracted:', result.text);
      return result;
    }
    console.log('[ClaudeFallback] Claude returned NONE — no lot detected');
    return null;
  } catch (error) {
    console.warn('[ClaudeFallback] Claude call failed, keeping previous result', error);
    return null;
  }
}
