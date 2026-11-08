import { describe, expect, it } from "vitest";
import { LANG_CODES, LANGUAGE_LIST } from "./languages";
import { t, tPair } from "./strings";

describe("i18n", () => {
  it("has 10 languages with native names", () => {
    expect(LANGUAGE_LIST).toHaveLength(10);
    for (const l of LANGUAGE_LIST) expect(l.nativeName.length).toBeGreaterThan(0);
  });

  it("every language has a localized tap-to-speak label", () => {
    for (const code of LANG_CODES) expect(t(code, "tapToSpeak")).toBeTruthy();
    expect(t("kn-IN", "tapToSpeak")).not.toBe(t("en-IN", "tapToSpeak"));
  });

  it("falls back to English for missing keys", () => {
    expect(t("ta-IN", "heardNothing")).toBe(t("en-IN", "heardNothing"));
  });

  it("tPair returns English secondary only when different", () => {
    expect(tPair("hi-IN", "modKhata").secondary).toBe("Khata");
    expect(tPair("en-IN", "modKhata").secondary).toBeNull();
  });
});
