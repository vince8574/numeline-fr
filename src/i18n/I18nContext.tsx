import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { changeLanguage, getCurrentLanguage, initializeI18n, SupportedLanguage, t as i18nT } from './i18n';

interface I18nContextType {
  locale: string;
  setLocale: (language: SupportedLanguage) => Promise<void>;
  t: (key: string, options?: Record<string, any>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Initialise l'état depuis la locale DÉJÀ posée synchroniquement au chargement
  // du module i18n (langue de l'appareil) → le 1er rendu est dans la bonne langue,
  // et un changement par la préférence restaurée déclenche bien un re-rendu.
  const [locale, setLocaleState] = useState<string>(() => getCurrentLanguage());

  useEffect(() => {
    const init = async () => {
      const initialLocale = await initializeI18n();
      setLocaleState(initialLocale);
    };
    void init();
  }, []);

  const setLocale = useCallback(async (language: SupportedLanguage) => {
    await changeLanguage(language);
    setLocaleState(language);
  }, []);

  const t = useCallback((key: string, options?: Record<string, any>) => {
    return i18nT(key, options);
  }, [locale]); // Re-create when locale changes to force re-render

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
