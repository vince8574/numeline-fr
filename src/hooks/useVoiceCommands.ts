import { useCallback, useEffect, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from 'expo-speech-recognition';

export type VoiceCommand = 'photo' | 'flash';

type Callbacks = {
  onCommand?: (command: VoiceCommand, transcript: string) => void;
  onError?: (error: string) => void;
};

const PHOTO_PATTERN = /\b(photo|prends?\s+(?:en\s+)?(?:la\s+)?photo|prendre\s+(?:en\s+)?(?:la\s+)?photo|captur(?:e|er)|cliché|prends|capt[ue]re)\b/i;
const FLASH_PATTERN = /\b(flash|lampe|torche|lumi[èe]re|allume(?:r)?|éclair(?:e|er|age))\b/i;

function matchCommand(transcript: string): VoiceCommand | null {
  const text = transcript.trim();
  if (!text) return null;
  if (PHOTO_PATTERN.test(text)) return 'photo';
  if (FLASH_PATTERN.test(text)) return 'flash';
  return null;
}

export function useVoiceCommands(enabled: boolean, callbacks: Callbacks = {}) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const listeningRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startListening = useCallback(async () => {
    if (!enabledRef.current || listeningRef.current) return;

    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        callbacksRef.current.onError?.('mic-permission-denied');
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: 'fr-FR',
        interimResults: false,
        continuous: true,
        requiresOnDeviceRecognition: false,
        contextualStrings: ['photo', 'flash', 'prends en photo', 'prendre en photo', 'capture', 'lampe', 'torche'],
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form'
        }
      });
    } catch (error) {
      console.warn('[useVoiceCommands] start error', error);
      callbacksRef.current.onError?.(String(error));
    }
  }, []);

  const stopListening = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (listeningRef.current) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.warn('[useVoiceCommands] stop error', error);
      }
    }
  }, []);

  const scheduleRestart = useCallback(
    (delayMs: number) => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (enabledRef.current && !listeningRef.current) {
          startListening();
        }
      }, delayMs);
    },
    [startListening]
  );

  useSpeechRecognitionEvent('start', () => {
    listeningRef.current = true;
  });

  useSpeechRecognitionEvent('end', () => {
    listeningRef.current = false;
    if (enabledRef.current) {
      scheduleRestart(150);
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    const command = matchCommand(transcript);
    if (command) {
      callbacksRef.current.onCommand?.(command, transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    listeningRef.current = false;
    const code = (event as any).error || 'unknown';
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      callbacksRef.current.onError?.(code);
      return;
    }
    if (enabledRef.current) {
      scheduleRestart(500);
    }
  });

  useEffect(() => {
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled, startListening, stopListening]);

  return {
    start: startListening,
    stop: stopListening
  };
}
