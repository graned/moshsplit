import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import authEn from './locales/en/auth.json';
import mobileEn from './locales/en/mobile.json';
import componentsEn from './locales/en/components.json';
import pt from './locales/pt.json';
import authPt from './locales/pt/auth.json';
import mobilePt from './locales/pt/mobile.json';
import componentsPt from './locales/pt/components.json';
import es from './locales/es.json';
import authEs from './locales/es/auth.json';
import mobileEs from './locales/es/mobile.json';
import componentsEs from './locales/es/components.json';

const savedLanguage = localStorage.getItem('moshsplit_language') || 'en';

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
    pt: {
      translation: {
        ...pt,
        auth: authPt,
        mobile: mobilePt,
        components: componentsPt,
      },
    },
    es: {
      translation: {
        ...es,
        auth: authEs,
        mobile: mobileEs,
        components: componentsEs,
      },
    },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
