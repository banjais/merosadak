// frontend/src/i18n/useTranslation.tsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from './translations/en.json';
import ne from './translations/ne.json';
import hi from './translations/hi.json';
import bho from './translations/bho.json';
import mai from './translations/mai.json';
import newari from './translations/new.json';

type Language = 'en' | 'ne' | 'hi' | 'bho' | 'mai' | 'new';

const translations: Record<Language, Record<string, any>> = { en, ne, hi, bho, mai, new: newari };

// Helper to get nested value from dot notation key
function getNestedValue(obj: Record<string, any>, key: string): string {
  return key.split('.').reduce((acc, part) => acc?.[part], obj) as string || key;
}

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  toggleLanguage: () => void;
  i18n: { language: Language };
}

const TranslationContext = createContext<TranslationContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
  toggleLanguage: () => {},
  i18n: { language: 'en' },
});

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('merosadak-language');
    const validLanguages: Language[] = ['en', 'ne', 'hi', 'bho', 'mai', 'new'];
    return validLanguages.includes(saved as Language) ? saved as Language : 'en';
  });

  useEffect(() => {
    localStorage.setItem('merosadak-language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ne' ? 'ltr' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState(prev => prev === 'en' ? 'ne' : 'en');
  }, []);

  const t = useCallback((key: string): string => {
    const value = getNestedValue(translations[language], key);
    return value || getNestedValue(translations.en, key) || key;
  }, [language]);

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, toggleLanguage, i18n: { language } }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
}