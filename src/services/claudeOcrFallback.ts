import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import type { OCRResult } from '../types';
import { getAppCheckToken } from './appCheckService';

const CLAUDE_TIMEOUT_MS = 20000;

type ClaudeConfig = {
  endpoint?: string;
};

function getClaudeConfig(): ClaudeConfig {
  const extra = (Constants.expoConfig?.extra as any) ?? {};
  const claudeExtra = (extra.claude as ClaudeConfig) ?? {};
  const env = (globalThis as any)?.process?.env;
  return {
    endpoint: env?.EXPO_PUBLIC_CLAUDE_ENDPOINT || claudeExtra.endpoint
  };
}

export function isClaudeAvailable(): boolean {
  return Boolean(getClaudeConfig().endpoint);
}

/**
 * Retire du texte OCR les marquages réglementaires qui RESSEMBLENT à des lots
 * mais n'en sont jamais (faux positifs réels observés) :
 * - "EMB 44014B"        → code EMBALLEUR français (établissement d'emballage).
 * - "FR 44.014.001 CE"  → marque sanitaire ovale UE (agrément vétérinaire).
 * - "GB WD028" / "UK ... EC" → marque d'identification ovale UK (usine Kraft),
 *   pré-imprimée IDENTIQUE sur tous les paquets → fausse alerte de rappel.
 * - "EST. 38" / "P-123" → ovale d'inspection USDA (établissement US), idem.
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
    // uniquement avec tiret (forme volaille standard) pour ne pas amputer un
    // vrai lot type "P123".
    .replace(/\bEST[\s.:#]*\d{1,5}[A-Z]?\b/gi, ' ')
    .replace(/\bP-\d{1,5}\b/gi, ' ');
}

/**
 * Returns true when the OCR text already contains something that looks like a
 * plausible lot number. Used as a gate before calling the Cloud Function so we
 * skip the paid 3rd-tier fallback when ML Kit or Vision has already produced
 * something usable. The patterns match the same families as detectLotLike() in
 * ScanLotScreen — "LOT XXX", "L" + digits, or 4-22 char alphanumerics that are
 * not pure EAN/GTIN.
 */
function hasPlausibleLotPattern(text: string): boolean {
  if (!text) return false;
  // Un marquage réglementaire (EMB/ovale sanitaire) ne doit pas faire croire
  // qu'un lot est déjà lu — sinon Claude est court-circuité à tort.
  const cleaned = stripNonLotMarkings(text).replace(/\s+/g, ' ').toUpperCase();

  // Signal fort : préfixe "LOT" suivi d'un code.
  if (/(?:^|[^A-Z])LOT[:\s\-.]*[A-Z0-9]{3,22}/.test(cleaned)) return true;
  // Signal fort : "L" + 3-15 chiffres (format FR très fréquent).
  if (/(?:^|[^A-Z])L\d{3,15}/.test(cleaned)) return true;

  // Sinon, n'accepter QU'UN token mêlant lettres ET chiffres (vrai motif de
  // lot type "AB1234", "7H234K"). On REJETTE désormais les tokens purement
  // numériques (dates jj/mm/aaaa dé-espacées, poids, prix, n° de téléphone,
  // EAN/GTIN) qui déclenchaient des faux positifs et faisaient sauter à tort
  // le fallback Claude alors qu'aucun vrai lot n'avait été extrait.
  const tokens = cleaned.match(/[A-Z0-9]{4,22}/g) || [];
  return tokens.some((t) => {
    const digits = (t.match(/\d/g) || []).length;
    const letters = (t.match(/[A-Z]/g) || []).length;
    return digits >= 1 && letters >= 1;
  });
}

type ClaudeUsage = {
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
};

type ClaudeApiResponse = {
  text?: string;
  lines?: Array<{ content: string; confidence?: number }>;
  confidence?: number;
  source?: string;
  usage?: ClaudeUsage;
};

async function runClaudeFallback(
  uri: string,
  meta?: { nativeWidth?: number; nativeHeight?: number; captureDiag?: string }
): Promise<OCRResult> {
  const { endpoint } = getClaudeConfig();
  if (!endpoint) throw new Error('ocrClaude Cloud Function endpoint not configured');

  const base64Image = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });

  const lower = uri.toLowerCase();
  const mediaType: 'image/png' | 'image/jpeg' | 'image/webp' = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;

  // Timeout réseau : Claude est le tier le plus lent ; on abandonne après 20s
  // pour ne pas laisser le scan bloqué indéfiniment sur un réseau capricieux.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        imageBase64: base64Image,
        mediaType,
        nativeWidth: meta?.nativeWidth,
        nativeHeight: meta?.nativeHeight,
        captureDiag: meta?.captureDiag
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ocrClaude failed: ${response.status} ${errText}`);
  }

  const data = (await response.json()) as ClaudeApiResponse;

  if (data.usage) {
    console.log(
      `[ClaudeFallback] tokens: in=${data.usage.inputTokens}, out=${data.usage.outputTokens}, ` +
        `cache_read=${data.usage.cacheReadTokens}, cache_creation=${data.usage.cacheCreationTokens}`
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
 * Third-tier OCR fallback: invoke the ocrClaude Cloud Function when ML Kit and
 * Google Vision have both failed to produce a plausible lot pattern. Returns
 * null when the call is skipped (Claude not configured, or previous OCR
 * already has a usable result) or when the call fails — the caller should
 * keep the previous result in that case.
 */
export async function tryClaudeFallback(
  uri: string,
  previousOcr: OCRResult,
  context: 'lot',
  options?: { force?: boolean; nativeWidth?: number; nativeHeight?: number; captureDiag?: string }
): Promise<OCRResult | null> {
  if (!isClaudeAvailable()) {
    console.log('[ClaudeFallback] skipped: endpoint not configured');
    return null;
  }
  // `force` : le caller route déjà explicitement vers Claude (ex. lot lu trop
  // court / probablement tronqué). On bypasse alors le gate "motif plausible" —
  // sinon un partiel type "48R49A" (lettres+chiffres) bloque Claude à tort.
  if (!options?.force && hasPlausibleLotPattern(previousOcr.text)) {
    console.log('[ClaudeFallback] skipped: previous OCR already has a lot pattern');
    return null;
  }
  try {
    console.log(`[ClaudeFallback] invoking Cloud Function for ${context}${options?.force ? ' (forced)' : ''}`);
    const result = await runClaudeFallback(uri, {
      nativeWidth: options?.nativeWidth,
      nativeHeight: options?.nativeHeight,
      captureDiag: options?.captureDiag
    });
    return result.text ? result : null;
  } catch (e) {
    console.warn('[ClaudeFallback] call failed, keeping previous result', e);
    return null;
  }
}
