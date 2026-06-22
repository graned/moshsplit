import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import authEn from './locales/en/auth.json';
import mobileEn from './locales/en/mobile.json';
import componentsEn from './locales/en/components.json';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        ...en,
        auth: authEn,
        mobile: mobileEn,
        components: componentsEn,
      },
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
