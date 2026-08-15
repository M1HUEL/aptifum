import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es';
import en from './locales/en';

export const LANGUAGE_STORAGE_KEY = 'aptifum.language';

function getInitialLanguage(): 'es' | 'en' {
  if (typeof window === 'undefined') {
    return 'es';
  }
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'es' || stored === 'en' ? stored : 'es';
}

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
});

export const t = i18n.t.bind(i18n);

export default i18n;
