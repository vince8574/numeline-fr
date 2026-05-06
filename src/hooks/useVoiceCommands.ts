import { useCallback, useEffect, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from 'expo-speech-recognition';
import { useI18n } from '../i18n/I18nContext';
import { getVoiceLocaleConfig } from './voiceLocales';

export type VoiceCommand = 'photo' | 'flash_on' | 'flash_off';

type Callbacks = {
  onCommand?: (command: VoiceCommand, transcript: string) => void;
  onError?: (error: string) => void;
};

export function useVoiceCommands(enabled: boolean, callbacks: Callbacks = {}) {
  const { locale } = useI18n();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const localeRef = useRef(locale);
  localeRef.current = locale;

  const listeningRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matchCommand = useCallback((transcript: string): VoiceCommand | null => {
    const text = transcript.trim();
    if (!text) return null;
    const config = getVoiceLocaleConfig(localeRef.current);
    if (config.patterns.photo.test(text)) return 'photo';
    if (config.patterns.flashWord.test(text)) {
      return config.patterns.flashOff.test(text) ? 'flash_off' : 'flash_on';
    }
    return null;
  }, []);

  const startListening = useCallback(async () => {
    if (!enabledRef.current || listeningRef.current) return;

    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        callbacksRef.current.onError?.('mic-permission-denied');
        return;
      }

      const config = getVoiceLocaleConfig(localeRef.current);
      ExpoSpeechRecognitionModule.start({
        lang: config.speechLocale,
        interimResults: false,
        continuous: true,
        requiresOnDeviceRecognition: false,
        contextualStrings: config.contextualStrings,
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

  // Redémarrer la reconnaissance vocale si la locale change pendant qu'elle est active
  useEffect(() => {
    if (!enabledRef.current) return;
    stopListening();
    scheduleRestart(200);
  }, [locale, scheduleRestart, stopListening]);

  return {
    start: startListening,
    stop: stopListening
  };
}
