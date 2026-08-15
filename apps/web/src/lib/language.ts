import { useCallback, useState } from 'react';
import i18n, { LANGUAGE_STORAGE_KEY } from '../i18n';

export type Language = 'es' | 'en';

export function useLanguage(): {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
} {
  const [language, setLanguageState] = useState<Language>(
    i18n.language.startsWith('es') ? 'es' : 'en',
  );

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    void i18n.changeLanguage(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === 'es' ? 'en' : 'es'));
    void i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      i18n.language.startsWith('es') ? 'en' : 'es',
    );
  }, []);

  return { language, setLanguage, toggleLanguage };
}
