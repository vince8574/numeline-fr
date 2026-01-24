import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { OCRResult } from '../types';

type VisionConfig = {
  endpoint?: string;
  apiKey?: string;
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

function getVisionConfig(): VisionConfig {
  const extra = (Constants.expoConfig?.extra as any) ?? {};
  const visionExtra = (extra.vision as VisionConfig) ?? {};
  const env = (globalThis as any)?.process?.env;

  return {
    endpoint: env?.EXPO_PUBLIC_VISION_ENDPOINT || visionExtra.endpoint,
    apiKey: env?.EXPO_PUBLIC_VISION_API_KEY || visionExtra.apiKey
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
  const { endpoint, apiKey } = getVisionConfig();

  if (!endpoint || !apiKey) {
    throw new Error('Google Cloud Vision API non configurée');
  }

  console.log('[VisionFallback] Reading image as base64...');
  const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

  // Format correct pour Google Cloud Vision API
  const apiUrl = `${endpoint}?key=${apiKey}`;
  const requestBody = {
    requests: [
      {
        image: {
          content: base64Image
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION'
          }
        ],
        imageContext: {
          languageHints: ['fr', 'en']
        }
      }
    ]
  };

  console.log('[VisionFallback] Calling Google Cloud Vision API...');
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[VisionFallback] API Error:', response.status, errorText);
    throw new Error(`Google Vision API failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('[VisionFallback] API Response received');

  // Parser la réponse de Google Cloud Vision API
  const visionResponse = data.responses?.[0];
  if (!visionResponse || visionResponse.error) {
    const errorMsg = visionResponse?.error?.message || 'Unknown error';
    throw new Error(`Vision API error: ${errorMsg}`);
  }

  // Extraire le texte complet
  const fullText = visionResponse.fullTextAnnotation?.text || '';

  // Extraire les lignes de texte
  const textAnnotations = visionResponse.textAnnotations || [];
  const lines: Array<{ content: string; confidence?: number }> = [];

  // La première annotation contient tout le texte, les suivantes sont les mots individuels
  // On extrait les lignes en regroupant par position Y
  if (fullText) {
    const textLines = fullText.split('\n').filter(Boolean);
    textLines.forEach((lineText: string) => {
      lines.push({
        content: lineText,
        confidence: textAnnotations[0]?.confidence
      });
    });
  }

  const confidence = textAnnotations[0]?.confidence;

  console.log('[VisionFallback] Extracted text length:', fullText.length);
  console.log('[VisionFallback] Lines count:', lines.length);

  return {
    text: fullText,
    lines,
    confidence,
    source: 'vision-fallback'
  };
}

export async function tryVisionFallback(uri: string, result: OCRResult, context: 'brand' | 'lot'): Promise<OCRResult | null> {
  // Si source est 'none', c'est un appel forcé - utiliser Vision directement
  if (result.source === 'none') {
    if (!isVisionAvailable()) {
      return null;
    }

    console.log(`[VisionFallback] Forced call for ${context} - using Google Vision directly`);

    try {
      const fallbackResult = await runVisionFallback(uri);
      console.log('[VisionFallback] Success - using vision result');
      return fallbackResult;
    } catch (error) {
      console.warn('[VisionFallback] Vision call failed', error);
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
