'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TranslationEntry {
  translated: string;
  source: string;
}

interface TranslationMap {
  [key: string]: TranslationEntry;
}

interface TranslationContextType {
  lang: string;
  t: (key: string, fallback?: string) => string;
  loading: boolean;
}

const TranslationContext = createContext<TranslationContextType>({
  lang: 'en',
  t: (_key: string, fallback?: string) => fallback || _key,
  loading: true,
});

export function useTranslation() {
  return useContext(TranslationContext);
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(true);

  const loadTranslations = useCallback(async (language: string) => {
    if (!language || language === 'en') {
      setTranslations({});
      setLang('en');
      setLoading(false);
      return;
    }

    setLang(language);
    const supabase = createClient();

    const { data: winners } = await supabase
      .from('translation_winners')
      .select('key, translated_text, source_text')
      .eq('language', language);

    if (winners) {
      const map: TranslationMap = {};
      winners.forEach((w: { key: string; translated_text: string; source_text: string }) => {
        map[w.key] = { translated: w.translated_text, source: w.source_text };
      });
      setTranslations(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const preferred = user?.preferred_language || 'en';
    loadTranslations(preferred);
  }, [user?.preferred_language, loadTranslations]);

  const t = useCallback((key: string, fallback?: string): string => {
    const entry = translations[key];
    if (entry) return entry.translated;
    return fallback || key;
  }, [translations]);

  return (
    <TranslationContext.Provider value={{ lang, t, loading }}>
      {children}
    </TranslationContext.Provider>
  );
}
