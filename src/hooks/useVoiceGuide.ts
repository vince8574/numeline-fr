import { useCallback, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useI18n } from '../i18n/I18nContext';
import { getSpeechLocale } from './voiceLocales';

type SpeakOptions = {
  /** Coupe ce qui est en cours et lance immédiatement le nouveau message. */
  priority?: boolean;
  /** Ignore le message si le dernier identique a été dit il y a moins de N ms (défaut 4000). */
  dedupeMs?: number;
};

// Cache module-level : la liste des voix ne change pas pendant la vie de l'app.
// On la fetch une seule fois et on la partage entre tous les useVoiceGuide.
let cachedVoices: Speech.Voice[] | null = null;
let cachedVoicesPromise: Promise<Speech.Voice[]> | null = null;
const voiceIdByLocale = new Map<string, string | null>();

// Flag pour le pré-warming du moteur TTS au premier speak (évite la latence cold-start
// sur les usages suivants). Le premier "vrai" speak fera office de warm-up,
// mais on peut aussi déclencher un warm-up explicite via warmUpVoiceEngine().
let hasWarmedUp = false;

function getVoicesAsync(): Promise<Speech.Voice[]> {
  if (cachedVoices) return Promise.resolve(cachedVoices);
  if (cachedVoicesPromise) return cachedVoicesPromise;

  cachedVoicesPromise = Speech.getAvailableVoicesAsync()
    .then((list) => {
      cachedVoices = list || [];
      console.log(`[VoiceGuide] ${cachedVoices.length} voices cached`);
      return cachedVoices;
    })
    .catch((error) => {
      console.warn('[VoiceGuide] Failed to fetch available voices', error);
      cachedVoices = [];
      return cachedVoices;
    });

  return cachedVoicesPromise;
}

/**
 * Sélectionne le meilleur voice ID installé sur le device pour une locale BCP-47 donnée.
 * On préfère un match exact (ex: en-US), puis un match sur la langue (ex: en-*),
 * et on retombe sur null si rien ne correspond (le moteur TTS utilisera son défaut).
 * Résultat mis en cache par locale pour éviter le scan à chaque speak.
 */
function pickBestVoice(voices: Speech.Voice[], speechLocale: string): string | null {
  if (voiceIdByLocale.has(speechLocale)) {
    return voiceIdByLocale.get(speechLocale) ?? null;
  }
  if (!voices || voices.length === 0) {
    voiceIdByLocale.set(speechLocale, null);
    return null;
  }
  const targetLang = speechLocale.toLowerCase();
  const targetPrefix = targetLang.split('-')[0];

  const exact = voices.find((v) => v.language?.toLowerCase() === targetLang);
  if (exact) {
    voiceIdByLocale.set(speechLocale, exact.identifier);
    return exact.identifier;
  }
  const sameLang = voices.find((v) => v.language?.toLowerCase().startsWith(`${targetPrefix}-`));
  if (sameLang) {
    voiceIdByLocale.set(speechLocale, sameLang.identifier);
    return sameLang.identifier;
  }
  const prefixOnly = voices.find((v) => v.language?.toLowerCase() === targetPrefix);
  if (prefixOnly) {
    voiceIdByLocale.set(speechLocale, prefixOnly.identifier);
    return prefixOnly.identifier;
  }

  voiceIdByLocale.set(speechLocale, null);
  return null;
}

/**
 * Pré-chauffe le moteur TTS pour réduire la latence du premier vrai speak.
 * À appeler dès que possible après l'activation du mode malvoyant
 * (par exemple via le bouton "Tester la voix" ou au focus initial du Scanner).
 */
export function warmUpVoiceEngine(speechLocale?: string) {
  if (hasWarmedUp) return;
  hasWarmedUp = true;
  // Un point parlé est très court et init le moteur. Sur la plupart des TTS
  // c'est imperceptible. À défaut, on tombera sur un cold-start au premier vrai speak.
  try {
    Speech.speak('.', {
      language: speechLocale,
      rate: 1.5,
      pitch: 1.0,
      volume: 0.01 // quasi inaudible (paramètre supporté sur Android, ignoré sur iOS)
    } as any);
  } catch {
    /* noop */
  }
}

/**
 * Hook de guidage vocal pour les utilisateurs malvoyants.
 * - Désactivé par défaut, activé via `accessibilityMode` dans les préférences.
 * - Anti-spam : un même message n'est répété que toutes les `dedupeMs`.
 * - Sélectionne explicitement une voix correspondant à la locale courante de l'app
 *   (sinon le moteur TTS retombe sur la voix système, souvent dans la langue de l'OS).
 */
export function useVoiceGuide() {
  const accessibilityMode = usePreferencesStore((s) => s.accessibilityMode);
  const { locale } = useI18n();
  const lastMessageRef = useRef<{ text: string; at: number } | null>(null);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  // Pré-charge la liste des voix (cache module-level partagé) et pré-chauffe le moteur
  // dès que le mode malvoyant est actif. Évite la latence cold-start au premier vrai speak.
  useEffect(() => {
    void getVoicesAsync();
    if (accessibilityMode) {
      warmUpVoiceEngine(getSpeechLocale(localeRef.current));
    }
    return () => {
      Speech.stop();
    };
  }, [accessibilityMode]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!accessibilityMode || !text) return;

      const now = Date.now();
      const dedupeMs = options.dedupeMs ?? 4000;
      const last = lastMessageRef.current;

      if (!options.priority && last && last.text === text && now - last.at < dedupeMs) {
        return;
      }

      lastMessageRef.current = { text, at: now };

      if (options.priority) {
        Speech.stop();
      }

      const speechLocale = getSpeechLocale(localeRef.current);
      const voices = cachedVoices ?? [];
      const voiceId = pickBestVoice(voices, speechLocale);

      if (!voiceId && voices.length > 0 && !voiceIdByLocale.has(speechLocale)) {
        console.warn(
          `[VoiceGuide] No installed voice for ${speechLocale}. Using system default. ` +
            `Install the language pack on the device to enable native voice.`
        );
      }

      hasWarmedUp = true; // tout speak réel sert aussi de warm-up
      Speech.speak(text, {
        language: speechLocale,
        ...(voiceId ? { voice: voiceId } : {}),
        pitch: 1.0,
        rate: 1.0
      });
    },
    [accessibilityMode]
  );

  const stop = useCallback(() => {
    Speech.stop();
    lastMessageRef.current = null;
  }, []);

  return { speak, stop, enabled: accessibilityMode };
}
