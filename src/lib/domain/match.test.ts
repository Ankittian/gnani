import { describe, expect, it } from "vitest";
import { levenshteinRatio, matchCustomer, matchProduct, nameKey, normalizeName, transliterate } from "./match";

const customers = [
  { id: "c1", name: "Ramesh Sharma", aliases: ["Sharma ji", "शर्मा जी"] },
  { id: "c2", name: "Suresh Sharma", aliases: [] },
  { id: "c3", name: "Lakshmi Amma", aliases: ["ಲಕ್ಷ್ಮಿ"] },
  { id: "c4", name: "Murugan", aliases: ["முருகன்"] },
  { id: "c5", name: "Fatima Begum", aliases: [] },
];

describe("transliterate", () => {
  it("Devanagari and Kannada Sharma map to the same key as Latin", () => {
    expect(nameKey("शर्मा")).toBe(nameKey("Sharma"));
    expect(nameKey("ಶರ್ಮಾ")).toBe(nameKey("Sharma"));
  });
  it("Tamil Murugan ≈ Latin Murugan", () => {
    expect(nameKey("முருகன்")).toBe(nameKey("Murugan"));
  });
  it("Telugu/Bengali/Gujarati/Gurmukhi/Malayalam produce latin", () => {
    for (const s of ["రాము", "দাস", "પટેલ", "ਸਿੰਘ", "ജോസ്"]) {
      expect(transliterate(s)).toMatch(/^[a-z]+$/);
    }
  });
});

describe("normalizeName", () => {
  it("strips honorifics and punctuation", () => {
    expect(normalizeName("Sharma ji!")).toBe("sharma");
    expect(normalizeName("  Mehul   Bhai ")).toBe("mehul");
    expect(normalizeName("Sharmaji")).toBe("sharma");
    expect(nameKey("शर्मा जी")).toBe(nameKey("sharma"));
    expect(nameKey("ಲಕ್ಷ್ಮಿ ಅವರೇ")).toBe(nameKey("lakshmi"));
    expect(nameKey("முருகன் அவர்கள்")).toBe(nameKey("murugan"));
    expect(nameKey("రాము గారు")).toBe(nameKey("ramu"));
  });
  it("keeps the name if it is only an honorific", () => {
    expect(normalizeName("Bhai")).toBe("bhai");
  });
});

describe("levenshteinRatio", () => {
  it("1 for equal, 0 for disjoint", () => {
    expect(levenshteinRatio("abc", "abc")).toBe(1);
    expect(levenshteinRatio("abc", "xyz")).toBe(0);
    expect(levenshteinRatio("", "")).toBe(1);
  });
});

describe("matchCustomer", () => {
  it("exact full name wins", () => {
    expect(matchCustomer("Suresh Sharma", customers).best?.id).toBe("c2");
  });
  it("first name alone finds the customer", () => {
    expect(matchCustomer("Suresh", customers).best?.id).toBe("c2");
  });
  it("native-script alias matches", () => {
    expect(matchCustomer("ಲಕ್ಷ್ಮಿ ಅವರೇ", customers).best?.id).toBe("c3");
    expect(matchCustomer("முருகன்", customers).best?.id).toBe("c4");
  });
  it("small misspelling still matches", () => {
    expect(matchCustomer("Fatma Begam", customers).best?.id).toBe("c5");
  });
  it("ambiguous 'Sharma' returns candidates, no best", () => {
    const r = matchCustomer("Sharma", customers);
    expect(r.best).toBeNull();
    expect(r.candidates.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });
  it("unknown name → no best, no candidates", () => {
    const r = matchCustomer("Gurpreet Singh", customers);
    expect(r.best).toBeNull();
    expect(r.candidates).toHaveLength(0);
  });
});

describe("matchProduct", () => {
  const products = [
    { id: "p1", name: "Parle-G", aliases: ["पारले जी", "parle ji"] },
    { id: "p2", name: "Maggi", aliases: ["मैगी"] },
    { id: "p3", name: "Surf Excel", aliases: ["सर्फ", "surf"] },
  ];
  it("matches aliases across scripts", () => {
    expect(matchProduct("मैगी", products).best?.id).toBe("p2");
    expect(matchProduct("parle g", products).best?.id).toBe("p1");
    expect(matchProduct("surf", products).best?.id).toBe("p3");
  });
  it("no match for unrelated product", () => {
    expect(matchProduct("Dettol", products).best).toBeNull();
  });
});
