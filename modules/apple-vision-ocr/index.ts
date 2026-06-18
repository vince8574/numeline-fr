import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// requireOptionalNativeModule returns null when the native module isn't present
// (Android / web / Expo Go), so this import never throws on those platforms.
const AppleVisionOcr = requireOptionalNativeModule('AppleVisionOcr');

/**
 * True only on iOS when the native Apple Vision module is linked into the build.
 * Use this to decide whether to route preview OCR to Apple Vision (vs ML Kit).
 */
export function isAppleVisionAvailable(): boolean {
  return Platform.OS === 'ios' && AppleVisionOcr != null;
}

/**
 * Runs Apple's on-device Vision text recognition (VNRecognizeTextRequest) on the
 * image at `uri` and returns the recognized text (lines joined by "\n").
 * Returns '' on any failure so callers can treat it like an empty OCR result.
 */
export async function recognizeTextApple(uri: string): Promise<string> {
  if (!AppleVisionOcr) return '';
  try {
    const text: string = await AppleVisionOcr.recognizeText(uri);
    return text ?? '';
  } catch {
    return '';
  }
}
