"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useShop } from "@/hooks/useShop";
import { isLangCode, type LangCode } from "@/lib/i18n/languages";
import { loadMessages, type Messages } from "@/lib/i18n/messages";

const DEFAULT_LANG: LangCode = "hi-IN";
const Preview = createContext<(lang: LangCode | null) => void>(() => {});

/** Lets onboarding preview a language before the shop (and its saved language) exists. */
export function usePreviewLocale() {
  return useContext(Preview);
}

/**
 * The single place that decides the UI language: saved shop language → onboarding preview → default.
 * Catalogs are lazy-loaded; while a new language loads the previous one stays on screen (no flash of ids).
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { shop } = useShop();
  const [preview, setPreview] = useState<LangCode | null>(null);
  const wanted: LangCode = shop?.language && isLangCode(shop.language) ? shop.language : (preview ?? DEFAULT_LANG);
  const [active, setActive] = useState<{ lang: LangCode; messages: Messages } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMessages(wanted)
      .then((messages) => !cancelled && setActive({ lang: wanted, messages }))
      .catch(() => {
        // Offline with an uncached chunk: fall back to whatever is already on screen.
      });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  useEffect(() => {
    if (active) document.documentElement.lang = active.lang.split("-")[0];
  }, [active]);

  const setPreviewStable = useCallback((l: LangCode | null) => setPreview(l), []);
  const ctx = useMemo(() => setPreviewStable, [setPreviewStable]);

  if (!active) return <div className="min-h-dvh" aria-busy="true" />;

  return (
    <Preview.Provider value={ctx}>
      <NextIntlClientProvider
        locale={active.lang}
        messages={active.messages}
        onError={(e) => {
          if (process.env.NODE_ENV !== "production") console.warn("[i18n]", e.message);
        }}
        getMessageFallback={({ key }) => key}
      >
        {children}
      </NextIntlClientProvider>
    </Preview.Provider>
  );
}
