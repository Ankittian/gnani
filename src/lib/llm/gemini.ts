import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { ZodType } from "zod";
import type { ComposeRequest, UnderstandRequest } from "@/lib/api/contracts";
import { ApiError } from "@/lib/gnani/errors";
import type { LangCode } from "@/lib/i18n/languages";
import {
  ComposeResultZ,
  LlmActionZ,
  composeJsonSchema,
  llmActionJsonSchema,
  toAction,
  type Action,
  type ComposeResult,
} from "./schema";
import { composePrompt, understandPrompt } from "./prompts";

const fastModel = () => process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite";
const qualityModel = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";

let cached: { key: string; ai: GoogleGenAI } | null = null;

function client(): GoogleGenAI {
  const key = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!key) throw new ApiError("NOT_CONFIGURED", "GEMINI_API_KEY is not set", 500);
  if (!cached || cached.key !== key) cached = { key, ai: new GoogleGenAI({ apiKey: key }) };
  return cached.ai;
}

/** Remove JSON-Schema keys Gemini's responseJsonSchema doesn't need/accept. Returns a copy. */
export function sanitizeSchema(schema: object): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  delete copy.$schema;
  return copy;
}

function stripFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1] : t;
}

interface GenerateJsonArgs<T> {
  prompt: string;
  system?: string;
  schema: object;
  zod: ZodType<T>;
  models: string[];
}

/** Structured JSON generation with zod validation and model fallback (each model tried once). */
export async function generateJson<T>({ prompt, system, schema, zod, models }: GenerateJsonArgs<T>): Promise<T> {
  const ai = client();
  const responseJsonSchema = sanitizeSchema(schema);
  let lastKind: "invalid" | "failed" = "failed";
  let lastMessage = "No model attempted";

  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...(system ? { systemInstruction: system } : {}),
          responseMimeType: "application/json",
          responseJsonSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const text = res.text ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripFences(text));
      } catch {
        lastKind = "invalid";
        lastMessage = `${model} returned non-JSON output`;
        continue;
      }
      const v = zod.safeParse(parsed);
      if (v.success) return v.data;
      lastKind = "invalid";
      lastMessage = `${model} output failed validation: ${v.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`;
    } catch (e) {
      lastKind = "failed";
      lastMessage = `${model} error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
    }
  }
  throw new ApiError(lastKind === "invalid" ? "LLM_INVALID_OUTPUT" : "LLM_FAILED", lastMessage, 502);
}

const SORRY: Record<LangCode, string> = {
  "hi-IN": "माफ़ कीजिए, मैं ठीक से समझ नहीं पाया। एक बार फिर बोलिए।",
  "en-IN": "Sorry, I didn't quite get that. Please say it once more.",
  "kn-IN": "ಕ್ಷಮಿಸಿ, ನನಗೆ ಸರಿಯಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.",
  "ta-IN": "மன்னிக்கவும், எனக்கு சரியாகப் புரியவில்லை. தயவுசெய்து மீண்டும் சொல்லுங்கள்.",
  "te-IN": "క్షమించండి, నాకు సరిగ్గా అర్థం కాలేదు. దయచేసి మళ్ళీ చెప్పండి.",
  "ml-IN": "ക്ഷമിക്കണം, എനിക്ക് ശരിക്ക് മനസ്സിലായില്ല. ദയവായി ഒന്നുകൂടി പറയൂ.",
  "mr-IN": "माफ करा, मला नीट समजलं नाही. कृपया पुन्हा एकदा सांगा.",
  "bn-IN": "দুঃখিত, আমি ঠিক বুঝতে পারিনি। আর একবার বলুন।",
  "gu-IN": "માફ કરશો, મને બરાબર સમજાયું નહીં. ફરી એકવાર બોલો.",
  "pa-IN": "ਮਾਫ਼ ਕਰਨਾ, ਮੈਨੂੰ ਠੀਕ ਤਰ੍ਹਾਂ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਇੱਕ ਵਾਰ ਫਿਰ ਬੋਲੋ।",
};

export function fallbackAction(language: LangCode): Action {
  const msg = SORRY[language] ?? SORRY["en-IN"];
  return {
    intent: "unknown",
    confidence: 0,
    customer: null,
    amountPaise: null,
    items: [],
    stockOps: [],
    notes: null,
    replyLanguage: language,
    replyText: msg,
    speakText: msg,
    clarify: null,
  };
}

export async function understand(req: UnderstandRequest): Promise<Action> {
  const { system, prompt } = understandPrompt(req);
  try {
    const llm = await generateJson({ prompt, system, schema: llmActionJsonSchema, zod: LlmActionZ, models: [fastModel(), qualityModel()] });
    return toAction(llm);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_CONFIGURED") throw e;
    return fallbackAction(req.language);
  }
}

export function compose(req: ComposeRequest): Promise<ComposeResult> {
  const { system, prompt } = composePrompt(req);
  return generateJson({ prompt, system, schema: composeJsonSchema, zod: ComposeResultZ, models: [qualityModel(), fastModel()] });
}
