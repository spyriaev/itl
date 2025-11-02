import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '../locales/en.json'
import ru from '../locales/ru.json'
import zh from '../locales/zh.json'
import hi from '../locales/hi.json'
import es from '../locales/es.json'

const resources = {
  en: {
    translation: en
  },
  ru: {
    translation: ru
  },
  zh: {
    translation: zh
  },
  hi: {
    translation: hi
  },
  es: {
    translation: es
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  })

export default i18n
