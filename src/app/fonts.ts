import {
  Inter,
  Baloo_2,
  Baloo_Bhai_2,
  Baloo_Chettan_2,
  Baloo_Da_2,
  Baloo_Paaji_2,
  Baloo_Tamma_2,
  Baloo_Tammudu_2,
  Baloo_Thambi_2,
} from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Indic scripts: Baloo cuts are fallbacks only (Inter has no Indic glyphs). Latin + Devanagari is preloaded; regional cuts load on demand when their glyphs appear.
export const baloo = Baloo_2({ subsets: ["latin", "devanagari"], variable: "--font-baloo", display: "swap" });
export const balooKannada = Baloo_Tamma_2({ subsets: ["kannada"], variable: "--font-baloo-kannada", display: "swap", preload: false });
export const balooTamil = Baloo_Thambi_2({ subsets: ["tamil"], variable: "--font-baloo-tamil", display: "swap", preload: false });
export const balooTelugu = Baloo_Tammudu_2({ subsets: ["telugu"], variable: "--font-baloo-telugu", display: "swap", preload: false });
export const balooMalayalam = Baloo_Chettan_2({ subsets: ["malayalam"], variable: "--font-baloo-malayalam", display: "swap", preload: false });
export const balooBengali = Baloo_Da_2({ subsets: ["bengali"], variable: "--font-baloo-bengali", display: "swap", preload: false });
export const balooGujarati = Baloo_Bhai_2({ subsets: ["gujarati"], variable: "--font-baloo-gujarati", display: "swap", preload: false });
export const balooGurmukhi = Baloo_Paaji_2({ subsets: ["gurmukhi"], variable: "--font-baloo-gurmukhi", display: "swap", preload: false });

export const fontVariables = [
  inter,
  baloo,
  balooKannada,
  balooTamil,
  balooTelugu,
  balooMalayalam,
  balooBengali,
  balooGujarati,
  balooGurmukhi,
]
  .map((f) => f.variable)
  .join(" ");
