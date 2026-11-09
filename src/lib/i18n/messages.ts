import type en from "@/messages/en.json";
import type { LangCode } from "./languages";

export type Messages = typeof en;
export type MessageKey = keyof Messages;

/** Catalogs are code-split: only the active language is downloaded; switching fetches the new file. */
const LOADERS: Record<LangCode, () => Promise<{ default: Messages }>> = {
  "en-IN": () => import("@/messages/en.json"),
  "hi-IN": () => import("@/messages/hi.json"),
  "mr-IN": () => import("@/messages/mr.json"),
  "kn-IN": () => import("@/messages/kn.json"),
  "ta-IN": () => import("@/messages/ta.json"),
  "te-IN": () => import("@/messages/te.json"),
  "ml-IN": () => import("@/messages/ml.json"),
  "bn-IN": () => import("@/messages/bn.json"),
  "gu-IN": () => import("@/messages/gu.json"),
  "pa-IN": () => import("@/messages/pa.json"),
};

export async function loadMessages(lang: LangCode): Promise<Messages> {
  const [base, local] = await Promise.all([LOADERS["en-IN"](), LOADERS[lang]()]);
  // Safety net: a key missing from a catalog falls back to English instead of rendering its id.
  return { ...base.default, ...local.default };
}
