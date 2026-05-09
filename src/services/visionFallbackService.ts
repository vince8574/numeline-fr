import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { OCRResult } from '../types';
import { getAppCheckToken } from './appCheckService';

type VisionConfig = {
  endpoint?: string;
};

type OcrQualityAssessment = {
  averageConfidence: number | null;
  textLength: number;
  lineCount: number;
  noiseRatio: number;
  hasSparseText: boolean;
  hasLowConfidence: boolean;
  hasHighNoise: boolean;
  reasons: string[];
};

/**
 * Renvoie l'URL de la Cloud Function `ocrVision` qui fait office de proxy
 * vers Google Vision côté serveur. La clé API Vision n'est plus embarquée
 * dans l'app : elle est stockée comme secret Firebase et lue uniquement
 * dans la Cloud Function.
 *
 * Override possible via :
 *   - app.json → expo.extra.vision.endpoint
 *   - variable d'env  EXPO_PUBLIC_VISION_ENDPOINT
 */
function getVisionConfig(): VisionConfig {
  const extra = (Constants.expoConfig?.extra as any) ?? {};
  const visionExtra = (extra.vision as VisionConfig) ?? {};
  const env = (globalThis as any)?.process?.env;

  return {
    endpoint: env?.EXPO_PUBLIC_VISION_ENDPOINT || visionExtra.endpoint
  };
}

export function isVisionAvailable(): boolean {
  const { endpoint } = getVisionConfig();
  return Boolean(endpoint);
}

export function assessOcrQuality(result: OCRResult): OcrQualityAssessment {
  const text = result.text || '';
  const compact = text.replace(/\s+/g, '');
  const alnumCount = (compact.match(/[A-Z0-9]/gi) || []).length;
  const noiseCount = Math.max(0, compact.length - alnumCount);
  const noiseRatio = compact.length === 0 ? 1 : noiseCount / compact.length;

  const lineCount = Array.isArray(result.lines) ? result.lines.length : 0;
  const averageConfidence =
    lineCount > 0
      ? result.lines.reduce((sum, line) => sum + (line.confidence ?? 1), 0) / lineCount
      : null;

  const reasons: string[] = [];

  if (averageConfidence !== null && averageConfidence < 0.65) {
    reasons.push('confiance faible (texte flou)');
  }

  if (text.trim().length < 30 || lineCount <= 2) {
    reasons.push('texte trop court ou épars (mauvais éclairage)');
  }

  if (noiseRatio > 0.3) {
    reasons.push('taux de bruit élevé (impression difficile à lire)');
  }

  return {
    averageConfidence,
    textLength: text.length,
    lineCount,
    noiseRatio,
    hasSparseText: text.trim().length < 20 || lineCount <= 1,
    hasLowConfidence: averageConfidence !== null && averageConfidence < 0.55,
    hasHighNoise: noiseRatio > 0.35,
    reasons
  };
}

export function shouldUseVisionFallback(result: OCRResult) {
  if (!isVisionAvailable()) {
    return { shouldFallback: false, reasons: ['vision non configurée'], quality: assessOcrQuality(result) };
  }

  const quality = assessOcrQuality(result);
  const triggers = quality.reasons;

  return {
    shouldFallback: triggers.length > 0,
    reasons: triggers,
    quality
  };
}

export async function runVisionFallback(uri: string): Promise<OCRResult> {
  const { endpoint } = getVisionConfig();

  if (!endpoint) {
    throw new Error('Cloud Function ocrVision non configurée');
  }

  console.log('[VisionFallback] Reading image as base64...');
  const base64Image = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });

  const appCheckToken = await getAppCheckToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  console.log('[VisionFallback] Calling ocrVision Cloud Function...');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageBase64: base64Image,
      languageHints: ['fr', 'en']
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[VisionFallback] ocrVision error', response.status, errorText);
    throw new Error(`ocrVision failed: ${response.status} ${errorText}`);
  }

  const data: {
    text?: string;
    lines?: Array<{ content: string; confidence?: number }>;
    confidence?: number;
  } = await response.json();

  console.log('[VisionFallback] Response received - text length:', data.text?.length || 0);

  return {
    text: data.text || '',
    lines: data.lines || [],
    confidence: data.confidence,
    source: 'vision-fallback'
  };
}

export async function tryVisionFallback(uri: string, result: OCRResult, context: 'brand' | 'lot'): Promise<OCRResult | null> {
  // Si source est 'none', c'est un appel forcé - utiliser Vision directement
  if (result.source === 'none') {
    if (!isVisionAvailable()) {
      return null;
    }

    console.log(`[VisionFallback] Forced call for ${context} - using Cloud Function directly`);

    try {
      const fallbackResult = await runVisionFallback(uri);
      console.log('[VisionFallback] Success - using vision result');
      return fallbackResult;
    } catch (error) {
      console.warn('[VisionFallback] Cloud Function call failed', error);
      return null;
    }
  }

  // Sinon, vérifier la qualité avant de déclencher le fallback
  const decision = shouldUseVisionFallback(result);

  if (!decision.shouldFallback) {
    return null;
  }

  console.log(
    `[VisionFallback] Triggered for ${context} because: ${decision.reasons.join(', ')} | quality=`,
    decision.quality
  );

  try {
    const fallbackResult = await runVisionFallback(uri);
    console.log('[VisionFallback] Success - using vision fallback result');
    return fallbackResult;
  } catch (error) {
    console.warn('[VisionFallback] Vision fallback failed, keeping ML Kit result', error);
    return null;
  }
}
