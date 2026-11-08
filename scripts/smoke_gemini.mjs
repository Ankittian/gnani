// Phase 0.3 — Gemini structured-output smoke test.
// Run: node --env-file=.env scripts/smoke_gemini.mjs
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const models = [process.env.GEMINI_MODEL || "gemini-3.8-flash", process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite"];

const schema = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["add_credit", "record_payment", "query_balance", "stock_update", "unknown"] },
    customerName: { type: ["string", "null"] },
    amountRupees: { type: ["number", "null"] },
    items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, qty: { type: "number" }, unit: { type: "string" } }, required: ["name", "qty", "unit"] } },
    speakText: { type: "string", description: "Reply in the user's language and script; numbers written as words" },
  },
  required: ["intent", "customerName", "amountRupees", "items", "speakText"],
};

const utterances = [
  ["hi-IN", "Sharma ji ने 2 किलो chawal और एक surf लिया, 340 रुपये उधार लिख दो।"],
  ["kn-IN", "ರಮೇಶ್ ಐನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು"],
  ["ta-IN", "மேகி தீர்ந்துவிட்டது, பார்லே ஜி இரண்டு பாக்கெட் மட்டும் உள்ளது"],
];

for (const model of models) {
  for (const [lang, text] of utterances) {
    const t0 = performance.now();
    try {
      const res = await ai.models.generateContent({
        model,
        contents: `Kirana shop assistant. Language: ${lang}. Shopkeeper said: "${text}". Extract the action.`,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      console.log(`[OK ] ${model} ${lang} ${Math.round(performance.now() - t0)} ms`, JSON.stringify(JSON.parse(res.text)));
    } catch (e) {
      console.log(`[ERR] ${model} ${lang} ${Math.round(performance.now() - t0)} ms`, String(e?.message ?? e).slice(0, 300));
    }
  }
}
