'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  reload: () => void;
}

const TranslationContext = createContext<TranslationContextType>({
  lang: 'en',
  t: (_key: string, fallback?: string) => fallback || _key,
  loading: true,
  reload: () => {},
});

export function useTranslation() {
  return useContext(TranslationContext);
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const prevLang = useRef<string>('');

  const loadTranslations = useCallback(async (language: string) => {
    const supabase = createClient();
    setLoading(true);

    try {
      // Step 1: Load ALL keys with their English source_text
      const { data: allKeys, error: keysError } = await supabase
        .from('translation_keys')
        .select('key, source_text');

      const map: TranslationMap = {};

      if (keysError) {
        console.error('[TranslationProvider] Failed to load keys:', keysError);
      } else if (allKeys) {
        allKeys.forEach((k: { key: string; source_text: string }) => {
          map[k.key] = { translated: k.source_text, source: k.source_text };
        });
      }

      // Step 2: If a non-English language, overlay its winning translations
      if (language && language !== 'en') {
        setLang(language);
        const { data: winners, error: winnersError } = await supabase
          .from('translation_winners')
          .select('key, translated_text, source_text')
          .eq('language', language);

        if (winnersError) {
          console.error('[TranslationProvider] Failed to load winners:', winnersError);
        } else if (winners) {
          winners.forEach((w: { key: string; translated_text: string; source_text: string }) => {
            map[w.key] = { translated: w.translated_text, source: w.source_text };
          });
        }
      } else {
        setLang('en');
      }

      setTranslations(map);
    } catch (err) {
      console.error('[TranslationProvider] Error loading translations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const preferred = user?.preferred_language || 'en';
    if (preferred !== prevLang.current) {
      prevLang.current = preferred;
      loadTranslations(preferred);
    }
  }, [user?.preferred_language, loadTranslations]);

  const reload = useCallback(() => {
    const preferred = user?.preferred_language || 'en';
    prevLang.current = '';
    loadTranslations(preferred);
  }, [user?.preferred_language, loadTranslations]);

  const t = useCallback((key: string, fallback?: string): string => {
    const entry = translations[key];
    if (entry) return entry.translated;
    return fallback || key;
  }, [translations]);

  return (
    <TranslationContext.Provider value={{ lang, t, loading, reload }}>
      {children}
    </TranslationContext.Provider>
  );
}
