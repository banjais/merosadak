// frontend/src/i18n/useTranslation.ts
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from './translations/en.json';
import ne from './translations/ne.json';

type Language = 'en' | 'ne';

const translations: Record<Language, Record<string, any>> = { en, ne };

// Helper to get nested value from dot notation key
function getNestedValue(obj: Record<string, any>, key: string): string {
  return key.split('.').reduce((acc, part) => acc?.[part], obj) as string || key;
}

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  toggleLanguage: () => void;
}

const TranslationContext = createContext<TranslationContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
  toggleLanguage: () => {},
});

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('merosadak-language');
    return (saved === 'ne' || saved === 'en') ? saved : 'en';
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
    <TranslationContext.Provider value={{ language, setLanguage, t, toggleLanguage }}>
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