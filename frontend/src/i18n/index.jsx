import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './en';
import { fr } from './fr';

const DICTIONARIES = { en, fr };
const STORAGE_KEY = 'care.lang';

// Saved choice first, then the browser's language, then English.
function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved in DICTIONARIES) return saved;
  } catch {
    // storage blocked: fall through
  }
  return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice just lasts for this visit
    }
  }, []);

  // t('key', { name: 'value' }) replaces {name} in the text. A missing French key falls
  // back to English, so a gap never shows up as a blank.
  const t = useCallback(
    (key, vars) => {
      let text = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

// The display name of an incident type. The value sent to the server never changes.
export function typeName(t, type) {
  const key = `incident.${type}`;
  const name = t(key);
  return name === key ? type : name;
}
