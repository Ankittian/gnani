/** The 10 languages Prisma v3.0 (STT) and Timbre v3.0 (TTS) both support, plus Hinglish for TTS. */

export const LANG_CODES = [
  "hi-IN",
  "en-IN",
  "kn-IN",
  "ta-IN",
  "te-IN",
  "ml-IN",
  "mr-IN",
  "bn-IN",
  "gu-IN",
  "pa-IN",
] as const;

export type LangCode = (typeof LANG_CODES)[number];

/** Script family → which Baloo font CSS variable renders it. */
export type FontKey = "deva" | "kannada" | "tamil" | "telugu" | "malayalam" | "bengali" | "gujarati" | "gurmukhi";

export interface LanguageMeta {
  code: LangCode;
  /** Name in its own script, shown on picker tiles. */
  nativeName: string;
  englishName: string;
  font: FontKey;
  /** A friendly greeting in that language. */
  greeting: string;
  /** Example command the shopkeeper can try (shown as hint chip). */
  sampleCommand: string;
  /** Line the user reads aloud when recording their voice clone (~10-15 s). */
  clonePrompt: string;
}

export const LANGUAGES: Record<LangCode, LanguageMeta> = {
  "hi-IN": {
    code: "hi-IN",
    nativeName: "हिन्दी",
    englishName: "Hindi",
    font: "deva",
    greeting: "नमस्ते",
    sampleCommand: "शर्मा जी ने 340 रुपये का सामान उधार लिया",
    clonePrompt: "नमस्ते, मैं अपनी दुकान से बोल रहा हूँ। आपका हिसाब बाकी है, जब समय मिले तो दुकान पर आ जाइए। धन्यवाद!",
  },
  "en-IN": {
    code: "en-IN",
    nativeName: "English",
    englishName: "English",
    font: "deva",
    greeting: "Hello",
    sampleCommand: "Sharma ji took groceries worth 340 rupees on credit",
    clonePrompt: "Hello, this is your neighbourhood shop calling. You have a small pending balance with us. Please drop by whenever you can. Thank you!",
  },
  "kn-IN": {
    code: "kn-IN",
    nativeName: "ಕನ್ನಡ",
    englishName: "Kannada",
    font: "kannada",
    greeting: "ನಮಸ್ಕಾರ",
    sampleCommand: "ರಮೇಶ್ ಮುನ್ನೂರ ನಲವತ್ತು ರೂಪಾಯಿ ಸಾಲ ತಗೊಂಡರು",
    clonePrompt: "ನಮಸ್ಕಾರ, ನಾನು ನಿಮ್ಮ ಅಂಗಡಿಯಿಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ನಿಮ್ಮ ಬಾಕಿ ಹಣ ಉಳಿದಿದೆ, ಸಮಯ ಸಿಕ್ಕಾಗ ಅಂಗಡಿಗೆ ಬನ್ನಿ. ಧನ್ಯವಾದಗಳು!",
  },
  "ta-IN": {
    code: "ta-IN",
    nativeName: "தமிழ்",
    englishName: "Tamil",
    font: "tamil",
    greeting: "வணக்கம்",
    sampleCommand: "முருகன் முன்னூற்று நாற்பது ரூபாய் கடன் வாங்கினார்",
    clonePrompt: "வணக்கம், நான் உங்கள் கடையிலிருந்து பேசுகிறேன். உங்கள் நிலுவைத் தொகை உள்ளது, நேரம் கிடைக்கும்போது கடைக்கு வாருங்கள். நன்றி!",
  },
  "te-IN": {
    code: "te-IN",
    nativeName: "తెలుగు",
    englishName: "Telugu",
    font: "telugu",
    greeting: "నమస్కారం",
    sampleCommand: "రాము మూడు వందల నలభై రూపాయలు అప్పు తీసుకున్నాడు",
    clonePrompt: "నమస్కారం, నేను మీ కిరాణా షాప్ నుండి మాట్లాడుతున్నాను. మీ బాకీ ఉంది, సమయం దొరికినప్పుడు షాప్‌కి రండి. ధన్యవాదాలు!",
  },
  "ml-IN": {
    code: "ml-IN",
    nativeName: "മലയാളം",
    englishName: "Malayalam",
    font: "malayalam",
    greeting: "നമസ്കാരം",
    sampleCommand: "ജോസ് മുന്നൂറ്റി നാല്പത് രൂപയുടെ സാധനം കടം വാങ്ങി",
    clonePrompt: "നമസ്കാരം, ഞാൻ നിങ്ങളുടെ കടയിൽ നിന്നാണ് സംസാരിക്കുന്നത്. നിങ്ങളുടെ ബാക്കി തുക ഉണ്ട്, സമയം കിട്ടുമ്പോൾ കടയിൽ വരൂ. നന്ദി!",
  },
  "mr-IN": {
    code: "mr-IN",
    nativeName: "मराठी",
    englishName: "Marathi",
    font: "deva",
    greeting: "नमस्कार",
    sampleCommand: "पाटील साहेबांनी तीनशे चाळीस रुपयांचं सामान उधार घेतलं",
    clonePrompt: "नमस्कार, मी तुमच्या दुकानातून बोलतोय. तुमची थोडी उधारी बाकी आहे, वेळ मिळाल्यावर दुकानात या. धन्यवाद!",
  },
  "bn-IN": {
    code: "bn-IN",
    nativeName: "বাংলা",
    englishName: "Bengali",
    font: "bengali",
    greeting: "নমস্কার",
    sampleCommand: "দাস বাবু তিনশো চল্লিশ টাকার জিনিস ধারে নিলেন",
    clonePrompt: "নমস্কার, আমি আপনার দোকান থেকে বলছি। আপনার কিছু টাকা বাকি আছে, সময় পেলে দোকানে আসবেন। ধন্যবাদ!",
  },
  "gu-IN": {
    code: "gu-IN",
    nativeName: "ગુજરાતી",
    englishName: "Gujarati",
    font: "gujarati",
    greeting: "નમસ્તે",
    sampleCommand: "પટેલ ભાઈએ ત્રણસો ચાલીસ રૂપિયાનો સામાન ઉધાર લીધો",
    clonePrompt: "નમસ્તે, હું તમારી દુકાનેથી બોલું છું. તમારું થોડું ઉધાર બાકી છે, સમય મળે ત્યારે દુકાને આવજો. આભાર!",
  },
  "pa-IN": {
    code: "pa-IN",
    nativeName: "ਪੰਜਾਬੀ",
    englishName: "Punjabi",
    font: "gurmukhi",
    greeting: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
    sampleCommand: "ਸਿੰਘ ਜੀ ਨੇ ਤਿੰਨ ਸੌ ਚਾਲੀ ਰੁਪਏ ਦਾ ਸਮਾਨ ਉਧਾਰ ਲਿਆ",
    clonePrompt: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਤੁਹਾਡੀ ਦੁਕਾਨ ਤੋਂ ਬੋਲ ਰਿਹਾ ਹਾਂ। ਤੁਹਾਡਾ ਕੁਝ ਹਿਸਾਬ ਬਾਕੀ ਹੈ, ਸਮਾਂ ਮਿਲੇ ਤਾਂ ਦੁਕਾਨ ਤੇ ਆਉਣਾ। ਧੰਨਵਾਦ!",
  },
};

export const LANGUAGE_LIST: LanguageMeta[] = LANG_CODES.map((c) => LANGUAGES[c]);

export function isLangCode(v: unknown): v is LangCode {
  return typeof v === "string" && (LANG_CODES as readonly string[]).includes(v);
}

/** Timbre v3.0 voices — every voice speaks all 10 languages. */
export const TIMBRE_V3_VOICES = [
  { id: "Lakshmi", gender: "F", vibe: "Warm & expressive" },
  { id: "Shivani", gender: "F", vibe: "Patient & caring" },
  { id: "Riyaa", gender: "F", vibe: "Lively & confident" },
  { id: "Tarika", gender: "F", vibe: "Warm & reassuring" },
  { id: "Kalpana", gender: "F", vibe: "Calm & composed" },
  { id: "Chetana", gender: "F", vibe: "Gentle" },
  { id: "Vasudha", gender: "F", vibe: "Storyteller" },
  { id: "Yashraj", gender: "M", vibe: "Warm narrator" },
  { id: "Devansh", gender: "M", vibe: "Young & energetic" },
  { id: "Shubham", gender: "M", vibe: "Confident" },
  { id: "Prakash", gender: "M", vibe: "Steady" },
  { id: "Avinash", gender: "M", vibe: "Firm & professional" },
  { id: "Harshad", gender: "M", vibe: "Firm" },
] as const;

export type TimbreVoice = (typeof TIMBRE_V3_VOICES)[number]["id"];
export const DEFAULT_VOICE: TimbreVoice = "Lakshmi";
