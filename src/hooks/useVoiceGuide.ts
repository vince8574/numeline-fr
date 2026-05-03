import { useCallback, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { usePreferencesStore } from '../stores/usePreferencesStore';

type SpeakOptions = {
  /** Coupe ce qui est en cours et lance immédiatement le nouveau message. */
  priority?: boolean;
  /** Ignore le message si le dernier identique a été dit il y a moins de N ms (défaut 4000). */
  dedupeMs?: number;
};

/**
 * Hook de guidage vocal pour les utilisateurs malvoyants.
 * - Désactivé par défaut, activé via `accessibilityMode` dans les préférences.
 * - Anti-spam : un même message n'est répété que toutes les `dedupeMs`.
 */
export function useVoiceGuide() {
  const accessibilityMode = usePreferencesStore((s) => s.accessibilityMode);
  const lastMessageRef = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

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

      Speech.speak(text, {
        language: 'fr-FR',
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
