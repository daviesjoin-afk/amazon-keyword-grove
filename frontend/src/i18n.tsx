import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppLanguage = 'zh-CN' | 'en-US'

const LANGUAGE_STORAGE_KEY = 'keyword-grove:language'

interface I18nContextValue {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
  text: (zh: string, en: string) => string
  numberLocale: AppLanguage
}

const defaultContext: I18nContextValue = {
  language: 'zh-CN',
  setLanguage: () => undefined,
  toggleLanguage: () => undefined,
  text: (zh) => zh,
  numberLocale: 'zh-CN',
}

const I18nContext = createContext<I18nContextValue>(defaultContext)

function readStoredLanguage(): AppLanguage {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === 'zh-CN' || stored === 'en-US') return stored
  } catch {
    // Restricted storage must not block the app. Keep Chinese as the stable default.
  }
  return 'zh-CN'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => readStoredLanguage())

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    } catch {
      // Language switching should still work for the current session.
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')
  }, [language, setLanguage])

  const text = useCallback((zh: string, en: string) => language === 'zh-CN' ? zh : en, [language])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    toggleLanguage,
    text,
    numberLocale: language,
  }), [language, setLanguage, text, toggleLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
