import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import authEn from './locales/en/auth.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, auth: authEn } },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };