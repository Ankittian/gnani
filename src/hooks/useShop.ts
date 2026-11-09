"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/schema";
import type { LangCode } from "@/lib/i18n/languages";
import type { Shop } from "@/lib/types";

/** `shop` is undefined while loading, null when onboarding hasn't happened. Strings: use next-intl's useTranslations(). */
export function useShop() {
  const shop = useLiveQuery<Shop | null, undefined>(async () => (await getDb().shop.get("shop")) ?? null, [], undefined);
  const lang: LangCode = shop?.language ?? "hi-IN";
  return { shop, loading: shop === undefined, lang };
}
