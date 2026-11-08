# PRD / Spec: Dukaan Dost — voice-first assistant for kirana stores

**Created**: 2026-11-08
**Status**: approved (Gate 1 passed)
**Author**: team (km.disha@forceintellect.com)
**Epic**: none — single hackathon product, built in one day
**Event**: Gnani "Great Indian AI Internship Challenge" — submission closes **2026-11-10 23:59 IST**
**Build window**: 2026-11-08 (today). 2026-11-09/10 reserved for demo video, posts, submission.

---

## 1. Problem

A kirana owner runs the entire shop alone, by memory and by hand: credit (udhaar) in a paper bahi-khata, stock by eyeballing shelves, distributor orders over calls, customer orders as WhatsApp voice notes, and the day's hisaab at closing time. Existing apps (Khatabook, OkCredit, billing apps) assume typing in English or one language, which many owners do not do comfortably, and none of them handle *speech* — the way the shop actually runs. The result: forgotten udhaar (real money lost), stock-outs of fast movers, mis-heard orders, and no daily picture of the business.

## 2. Goal

A shopkeeper can run the five core loops of the shop by **speaking naturally in their own language (any of 10 Indian languages or code-mixed Hinglish/Tanglish/etc.)** and hear the result spoken back — no typing, no reading required.

**Measurable success (for the demo build):**
| Metric | Target |
|---|---|
| Voice command → confirmed ledger/stock change | ≤ 4 s median (STT ≤ 1 s + LLM ≤ 2 s + UI) |
| Intent + entity accuracy on the 30-utterance synthetic test set | ≥ 90 % correct intent, ≥ 85 % correct amount/customer |
| Languages working end-to-end (speak → act → spoken reply) | all 10: hi, en, kn, ta, te, ml, mr, bn, gu, pa + Hinglish |
| Taps to record an udhaar entry | 2 (mic, confirm) |
| Gnani credits consumed by build + demo | ≤ 3,500 of 5,000 |

**Hackathon success:** working public demo URL, 60-second video, project write-up, LinkedIn + X posts live before submission. Targets tracks *Real Deal* (kirana is the named example), *Mixed Vibes*, *Main Character*, *Noise Canceller*, *Jugaad Genius*.

## 3. Users & User Stories

**Primary persona — Ramesh, 42, kirana owner, Bengaluru.** Hindi-speaking migrant, speaks Hinglish with customers, deals with a Kannada-speaking distributor. Uses WhatsApp daily, Android phone, reads Hindi slowly, does not type English. Shop is noisy (traffic, pressure cooker next door, customers).

**Secondary — the customer** (receives reminder voice notes in *their* language) and **the distributor** (receives order voice notes in *their* language).

| ID | Story | Module |
|---|---|---|
| US-1 | As a shopkeeper, I want to say "Sharma ji ne do kilo chawal aur ek Surf liya, 340 udhaar likh do" and have it recorded in Sharma ji's khata, so I don't need the paper bahi. | M1 Khata |
| US-2 | As a shopkeeper, I want to say "Sharma ji ne 500 diye" and have the balance reduced and read back to me, so I trust the ledger. | M1 Khata |
| US-3 | As a shopkeeper, I want to ask "Sharma ji ka kitna baaki hai?" and hear the answer. | M1 Khata |
| US-4 | As a shopkeeper, I want to send a polite payment reminder voice note to a customer in *their* language, in *my own voice*, so it feels personal and not like a bank robot. | M2 Reminders |
| US-5 | As a shopkeeper, I want to say "Maggi khatam, Parle-G sirf do packet bacha" and have stock updated. | M3 Stock |
| US-6 | As a shopkeeper, I want a reorder list grouped by distributor and a voice note in the distributor's language I can forward on WhatsApp. | M3 Stock |
| US-7 | As a shopkeeper, I want to drop in a customer's WhatsApp voice order (noisy, long, any language) and get a clean packing checklist. | M4 Orders |
| US-8 | As a shopkeeper, at closing I want to tap "Aaj ka hisaab" and *hear* today's sales, udhaar given, money collected and what to reorder. | M5 Hisaab |
| US-9 | As a first-time user, I want to pick my language by its native-script name and start in under a minute, with demo data if I just want to try it. | Onboarding |

## 4. Gnani + Gemini capabilities this relies on (verified 2026-11-08 from docs.gnani.ai)

| Capability | API | Facts that shape the design |
|---|---|---|
| **STT — Prisma v3.0** | `POST https://api.vachana.ai/stt/v3` multipart, header `X-API-Key-ID`, form `model=prisma-v3.0` | **Max 30 s per request.** Accepts wav/mp3/ogg/flac/aac/m4a — **format detected from filename extension**; WebM not accepted. `language_code=indic-auto` or up to 4 comma-separated hints. `format`: `verbatim` / `transcribe` (digits) / `codemix` / `transliterate`. `keyterms` ≤ 200 terms (contextual biasing). `previous_text` (last 600 chars) for continuity. Returns `transcript`, `detected_language_code`, `processing_time`. No diarization, no word timestamps. |
| **TTS — Timbre v3.0** | `POST https://api.vachana.ai/api/v1/tts/inference` JSON | 13 voices, **each speaks all 10 languages** (Avinash, Chetana, Devansh, Kalpana, Lakshmi, Prakash, Riyaa, Shivani, Shubham, Tarika, Vasudha, Yashraj, Harshad) + `hi-en` Hinglish. Speed 0.85–1.15. Containers wav/mp3/ogg/mulaw. Supports `<laugh>`, `<pauses>` tags. **Numbers/currency must be written as words.** Error 402 = out of credit, 429 = rate limited (example: one active request at a time; no Retry-After). |
| **Voice clone** | `POST /api/v1/tts/voice-clone/embeddings` (multipart `audio_file`, 5–30 s clean) → `voice_clone_embedding {embedding, shape, dtype}`; synth via same TTS endpoint with `speaker_embedding` (model `vachana-vc-v1`) | One-time embedding per voice; cache it. Language support for cloned TTS not documented → must test; fallback to Timbre voice. |
| **LLM — Gemini** | `@google/genai`, model `gemini-3.8-flash` (thinking `low`), fallback `gemini-3.5-flash-lite` | Structured JSON output with a JSON Schema; we also validate with zod. Used for: intent+entity extraction, and composing messages in a target language with numbers spelled out. |

## 5. Requirements

### 5.1 Must-have (built today)

**Platform**
- R-P1 Mobile-first **PWA** (installable, works in Chrome Android; desktop usable for judges). Next.js App Router + TypeScript + Tailwind.
- R-P2 All shop data stored **on-device in IndexedDB** (Dexie). No user accounts, no server DB. "Works even if the shop's internet drops" for viewing data; voice features need network.
- R-P3 All Gnani and Gemini keys **server-side only** (Next.js route handlers). Browser never sees a key.
- R-P4 **Mock mode** (`MOCK_MODE=1`): API routes return fixtures so UI work costs zero credits.
- R-P5 Per-IP daily caps on `/api/stt` and `/api/tts*` to protect credits on the public URL.
- R-P6 In-app **credit usage meter** (count of STT seconds, TTS characters, clone calls — local estimate).

**Voice pipeline (shared by all modules)**
- R-V1 Push-to-talk mic: tap to start, tap to stop, auto-stop at **25 s**; live mic-level visual.
- R-V2 Audio captured as **16 kHz mono 16-bit PCM → WAV** in the browser (AudioWorklet / ScriptProcessor fallback), uploaded as `speech.wav`.
- R-V3 STT call uses `prisma-v3.0`, `language_code` = shop language + `en-IN` (or `indic-auto` if user enabled "any language"), `format=transcribe` for hi/en (digits for amounts), `keyterms` = top customer names + product names + aliases (≤ 200), `previous_text` = last turn transcript.
- R-V4 `/api/understand` turns transcript + shop context into exactly one **Action** (schema §7.3) via Gemini structured output, validated with zod. Invalid → one retry → `unknown` action with a clarifying question.
- R-V5 Every Action is shown as an **editable confirmation card** (customer, items, amount as chips). Confirm commits; Cancel discards. Actions with confidence ≥ 0.85 and no ambiguity may auto-confirm after a 3-s visible countdown (can tap to cancel).
- R-V6 After commit, the app **speaks the reply** in the detected language via Timbre v3.0 (`speakText` with numbers in words). Text also shown.
- R-V7 TTS responses cached (client: Cache Storage keyed by SHA-256 of `voice|lang|speed|text`; server: in-memory LRU 200 items).
- R-V8 Long audio (>25 s, M4 uploads) is decoded in browser, resampled to 16 kHz, split into ≤ 25 s chunks on silence where possible, transcribed sequentially with `previous_text` chaining, then joined.

**M1 — Voice Khata (credit ledger)**
- R-K1 Intents: `add_credit`, `record_payment`, `query_balance`. Unknown customer name → offer "Add new customer 'X'?" inside the confirm card. Fuzzy match on existing names (transliteration-aware: "Sharma", "शर्मा", "ಶರ್ಮಾ" are the same).
- R-K2 Customer list sorted by outstanding balance; colored balance pill (red = owes, green = clear). Search by voice or text.
- R-K3 Customer detail: running balance, timeline of entries (items, amount, time, original transcript on tap), "Remind" button.
- R-K4 Balance cleared to 0 → celebration (confetti + "Hisaab barabar!").

**M2 — Payment reminders in the shopkeeper's voice**
- R-R1 Onboarding/settings: optional **voice clone** — record 10–20 s reading a provided line in shop language → `/api/clone` → embedding stored in IndexedDB.
- R-R2 "Remind" composes a short, polite reminder (Gemini) **in the customer's language** with name, amount in words, shop name. Shown in that script + English gloss.
- R-R3 Synthesize with cloned voice if available, else selected Timbre voice. Preview play.
- R-R4 Share via Web Share API (file `reminder.mp3` + text) → WhatsApp; fallback: download + `wa.me/?text=` link (no phone number stored — synthetic data rule).

**M3 — Stock & reorder**
- R-S1 Intents: `stock_update` (set / add / remove / out-of-stock), `query_stock`. Units: kg, g, l, ml, packet, piece, dabba/box, bori/sack, dozen.
- R-S2 Product grid with stock bar and low-stock badge (stock ≤ reorderLevel). Each product has aliases (e.g. "Parle-G", "parle ji", "पारले जी").
- R-S3 "Reorder list": low/out-of-stock products grouped by supplier, suggested qty = 2 × reorderLevel − stock (editable).
- R-S4 "Send to distributor": compose order message **in the supplier's language** → TTS → share (same as R-R4). Shopkeeper's language and supplier's language can differ.

**M4 — Customer voice orders (noisy voice notes)**
- R-O1 Input: (a) upload an audio file (WhatsApp `.opus/.ogg/.m4a/.mp3/.wav` — `.opus` renamed to `.ogg` before sending), (b) record in-app, (c) "Try a sample" noisy fixtures.
- R-O2 Long/noisy audio handled via R-V8; language auto-detected (`indic-auto`).
- R-O3 Gemini `create_order` extracts customer name (if said), items with qty/unit, notes (e.g. "deliver after 6"). Items matched to catalog where possible; unmatched kept as free text.
- R-O4 Order card as a **packing checklist** (tap items to tick), status New → Packed → Delivered. Option "Add to khata as udhaar" when delivered (creates M1 entry with order total if prices known).

**M5 — Aaj ka Hisaab (daily summary)**
- R-H1 Today = local calendar day in the browser's timezone; all stored timestamps are UTC ISO strings.
- R-H2 Cards: cash sales total, udhaar given, payments collected, net cash in, top 3 customers owing, low-stock count, orders delivered. Animated count-up.
- R-H3 "Suno" composes a ≤ 45-second spoken summary in shop language (Gemini → Timbre, voice Lakshmi by default).
- R-H4 7-day mini bar chart of udhaar given vs collected.
- R-H5 Cash sales can be recorded by voice too: intent `cash_sale` ("ek Maggi aur do Parle-G, 40 rupaye cash").

**Onboarding & settings**
- R-U1 First run: (1) language picker — 10 large tiles labelled in native script (हिन्दी, English, ಕನ್ನಡ, தமிழ், తెలుగు, മലയാളം, मराठी, বাংলা, ગુજરાતી, ਪੰਜਾਬੀ); (2) shop name + owner name (speak or type); (3) optional voice clone; (4) "Load demo shop" (seeded synthetic customers/products/suppliers) or start empty.
- R-U2 Settings: shop language, assistant voice (13 Timbre v3 voices with preview), "understand any language" toggle (`indic-auto`), re-record clone, delete clone, reset/demo data, credit meter, mock-mode badge.
- R-U3 UI chrome strings available in **English + Hindi** fully; other 8 languages get native-script labels for language names, module names and the main CTA (dictionary in `src/i18n/`). Voice works in all 10.

### 5.2 Nice-to-have (only if ahead of schedule)
- N-1 Streaming STT via WebSocket for live transcript while speaking.
- N-2 Full UI translation for all 10 languages (Gemini-generated dictionary, reviewed).
- N-3 Voice "haan / nahi" to confirm the action card hands-free.
- N-4 Evon v3.3 (self-hosted) as alternate LLM behind the same `LlmClient` interface.
- N-5 Playwright E2E for the M1 happy path.
- N-6 Export khata as PDF/CSV.

### 5.3 Out of scope
- Real WhatsApp Business API sending, SMS, phone calls, telephony integration.
- User accounts, login, cloud sync, multi-device, multi-shop.
- Payments/UPI collection, GST invoicing, barcode scanning, printing.
- Gnani Agent Builder (explicitly out of scope per hackathon rules).
- Storing real phone numbers, Aadhaar, PAN, or real customer recordings (hackathon synthetic-data rule).
- Offline speech recognition.
- Native Android/iOS app.

## 6. UX & UI design

### 6.1 Design principles
1. **Voice first, eyes second, fingers last.** Every primary action reachable from the mic. Text is a backup.
2. **Icons + numbers over words.** Low-literacy friendly: big emoji/icons, ₹ amounts large, labels short and in the shop language.
3. **Always speak back.** The shopkeeper should never need to read to know what happened.
4. **Feels like a dost, not a bank.** Warm colors, playful motion, Hinglish micro-copy, celebrations for good moments.
5. **One-thumb, noisy-shop ergonomics.** Mic in the thumb zone, touch targets ≥ 56 px, high contrast, works in sunlight.

### 6.2 Visual language ("Galla" theme)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` (marigold) | `#F59E0B` | `#FBBF24` | mic button, primary CTA, highlights |
| `--brand-ink` | `#7C2D12` | `#FDE68A` | text on brand surfaces |
| `--leaf` (paid/healthy) | `#16A34A` | `#4ADE80` | payments, cleared balances, in-stock |
| `--chili` (owes/alert) | `#DC2626` | `#F87171` | udhaar balance, out-of-stock |
| `--turmeric-bg` | `#FFFBEB` | `#1C1917` | app background |
| `--card` | `#FFFFFF` | `#292524` | cards |
| `--ink` | `#1C1917` | `#FAFAF9` | body text |
| `--muted` | `#78716C` | `#A8A29E` | secondary text |
| `--indigo` | `#4338CA` | `#A5B4FC` | links, the assistant's "voice" accents |

- **Typography:** the **Baloo 2 family** via `next/font/google` — one friendly rounded look across scripts: Baloo 2 (Latin+Devanagari), Baloo Tamma 2 (Kannada), Baloo Thambi 2 (Tamil), Baloo Tammudu 2 (Telugu), Baloo Chettan 2 (Malayalam), Baloo Da 2 (Bengali), Baloo Bhai 2 (Gujarati), Baloo Paaji 2 (Gurmukhi). Fallback Noto Sans. Amounts in tabular numerals, 28–40 px.
- **Shape:** radius 20 px cards, 999 px pills, soft shadow `0 4px 0 rgba(124,45,18,.08)` (slightly "sticker"-like).
- **Motion:** Framer Motion (`motion`); spring transitions ≤ 300 ms; respect `prefers-reduced-motion`.
- **Sound & haptics:** soft "ting" on commit, `navigator.vibrate(30)` on confirm; both toggleable.

### 6.3 The "Dost" orb (signature element)
A round marigold character at the top of Home and in the voice sheet, with 5 states:
| State | Visual |
|---|---|
| idle | slow breathing scale 1.0↔1.04, blinking eyes |
| listening | pulsing rings whose size follows live mic RMS |
| thinking | shimmer sweep + three bouncing dots |
| speaking | mouth/bars animate with audio output level (AnalyserNode) |
| happy | bounce + sparkle (after commit), confetti on "hisaab barabar" |

### 6.4 Screens
| # | Screen | Key contents |
|---|---|---|
| S1 | **Onboarding** (4 steps, progress dots) | language tiles in native script → shop/owner name (mic or type) → voice clone (prompt line in chosen language, 20 s recorder with level meter, "skip") → demo data vs empty |
| S2 | **Home — "Aaj ki Dukaan"** | greeting with owner name + Dost orb; 4 stat chips (Bikri ₹, Udhaar diya ₹, Wapas aaya ₹, Kam stock #); 4 big module tiles (Khata 📒, Stock 📦, Orders 🛵, Hisaab 📊); recent activity feed; **giant mic FAB** centered above bottom nav; "Try saying…" rotating hint chips in shop language |
| S3 | **Voice sheet** (bottom sheet over any screen) | orb (listening→thinking→speaking) · live timer (25 s ring) · transcript appears with typewriter effect + detected-language badge · **Action card** with editable chips (customer, items, ₹ amount, type) · ✓ Confirm / ✕ Cancel / 🎤 Retry · error/clarify state ("Kaun se Sharma ji? Ramesh ya Suresh?" as tappable options) |
| S4 | **Khata list** | search (mic+text), total outstanding banner, customer rows: avatar initials (color hashed), name, last activity, balance pill |
| S5 | **Customer detail** | big balance, "Remind 🔔" and "Payment aaya 💰" buttons, timeline grouped by day, each entry expandable to show transcript + play original reply |
| S6 | **Reminder composer** (sheet) | language selector (defaults to customer's), message in native script + English gloss, voice toggle (My voice / Assistant), ▶ preview, Share to WhatsApp |
| S7 | **Stock** | filter chips (All / Kam / Khatam), product cards with stock bar + unit, tap to adjust ±, "Reorder list" CTA with count badge |
| S8 | **Reorder list** | grouped by supplier, editable qty steppers, supplier language badge, "Voice note bhejo" per supplier → compose + preview + share |
| S9 | **Orders** | "New voice order" (upload / record / sample), order cards with status pill; detail = packing checklist with tick animations, original transcript, detected language, "Add to khata" |
| S10 | **Aaj ka Hisaab** | count-up stat cards, top owing customers, 7-day bars, big "▶ Suno" button with orb speaking |
| S11 | **Settings** | language, assistant voice gallery (13 voices, ▶ sample), any-language toggle, voice clone manage, sounds/haptics, credit meter, reset/demo data, about/hackathon credits |

Bottom nav: Home · Khata · [Mic FAB] · Stock · More (Orders, Hisaab, Settings).

### 6.5 Empty, loading, error states
- Empty khata: illustration (emoji collage) + "Bolke shuru karein: 'Sharma ji ne 200 udhaar liya'" with ▶ example.
- Loading: orb "thinking"; skeleton rows for lists.
- Mic denied: friendly card with steps to enable mic; text input fallback is always available in the voice sheet (keyboard icon).
- Network/API errors: orb looks sad, message in shop language + "Dobara bolein" button; never raw error strings (map `error_code` → friendly copy).
- 402 out of credits: banner "Demo credits khatam — mock mode mein chal raha hai" and auto-switch to mock fixtures.

### 6.6 Accessibility
Touch targets ≥ 56 px; contrast ≥ 4.5:1; every icon button has `aria-label`; voice sheet traps focus and is closable with Esc; all spoken replies also shown as text; `lang` attribute set on native-script text for correct screen-reader voice.

## 7. Data & API design

### 7.1 Local data model (IndexedDB via Dexie, camelCase, timestamps UTC ISO-8601)
| Table | Fields | Indexes |
|---|---|---|
| `shop` (single row) | `id`, `name`, `ownerName`, `language` (BCP-47), `assistantVoice`, `anyLanguage` (bool), `cloneEmbedding?` ({embedding, shape, dtype}), `createdAt`, `updatedAt` | `id` |
| `customers` | `id` (uuid), `name`, `nameAliases[]`, `language`, `balance` (paise, integer, denormalized), `createdAt`, `updatedAt`, `deletedAt?` | `name`, `balance`, `updatedAt` |
| `ledgerEntries` | `id`, `customerId`, `type` (`credit`\|`payment`), `amount` (paise), `items[]` ({name, qty, unit, productId?, pricePaise?}), `transcript`, `language`, `createdAt`, `deletedAt?` | `customerId`, `createdAt` |
| `products` | `id`, `name`, `aliases[]`, `unit`, `stockQty`, `reorderLevel`, `pricePaise?`, `supplierId?`, `createdAt`, `updatedAt` | `name`, `supplierId` |
| `suppliers` | `id`, `name`, `language`, `createdAt` | `name` |
| `stockEvents` | `id`, `productId`, `delta`, `op` (`set`\|`add`\|`remove`\|`out`), `transcript?`, `createdAt` | `productId`, `createdAt` |
| `sales` | `id`, `items[]`, `amount` (paise), `transcript`, `createdAt` | `createdAt` |
| `orders` | `id`, `customerName?`, `customerId?`, `items[]` ({name, qty, unit, productId?, packed}), `notes?`, `status` (`new`\|`packed`\|`delivered`), `transcript`, `language`, `audioDurationSec`, `createdAt`, `updatedAt` | `status`, `createdAt` |
| `usage` | `id` (date `YYYY-MM-DD` UTC), `sttSeconds`, `ttsChars`, `cloneCalls`, `llmCalls` | `id` |

Money is stored as **integer paise** to avoid float errors. Soft delete via `deletedAt` (undo for 10 s after a mistaken commit).

### 7.2 Internal API (Next.js route handlers, `src/app/api/**/route.ts`)
JSON bodies are **camelCase** (TS client ↔ TS server). Conversion to Gnani's snake_case happens only inside `src/lib/gnani/*`. (Deviation from `FRONTEND.md` keysToSnake rule is intentional: that rule targets a snake_case Kotlin backend; this app's backend is the Next.js BFF.)

| Route | Request | Response |
|---|---|---|
| `GET /api/health` | — | `{ gnani: boolean, gemini: boolean, mock: boolean }` |
| `POST /api/stt` | multipart: `audio` (wav/ogg/mp3/m4a), `languageHints` (csv, ≤4, or `indic-auto`), `keyterms` (JSON array ≤200), `previousText?`, `format?` | `{ transcript, detectedLanguageCode, durationSec, latencyMs }` |
| `POST /api/understand` | `{ transcript, language, mode: 'command'\|'order', context: { customers: [{id,name,aliases}], products: [{id,name,aliases,unit}], suppliers: [{id,name}] } }` | `Action` (§7.3) |
| `POST /api/compose` | `{ kind: 'reminder'\|'supplierOrder'\|'dailySummary', targetLanguage, data: {...} }` | `{ displayText, glossEn, speakText }` |
| `POST /api/tts` | `{ text, language, voice?, speed? }` | `audio/mpeg` bytes, `Cache-Control: private, max-age=86400` |
| `POST /api/clone` | multipart `audio` (5–30 s) | `{ embedding: {embedding, shape, dtype} }` |
| `POST /api/tts-clone` | `{ text, embedding }` | `audio/mpeg` bytes |

Errors: `{ error: { code, message, status } }` with codes `STT_FAILED`, `AUDIO_TOO_LONG`, `UNSUPPORTED_FORMAT`, `RATE_LIMITED`, `OUT_OF_CREDITS`, `LLM_INVALID_OUTPUT`, `CAP_EXCEEDED`, `BAD_REQUEST`.

**Example — `/api/understand`**
```json
// request
{ "transcript": "Sharma ji ne 2 kilo chawal aur ek Surf liya, 340 udhaar likh do",
  "language": "hi-IN", "mode": "command",
  "context": { "customers": [{"id":"c1","name":"Ramesh Sharma","aliases":["Sharma ji"]}],
               "products": [{"id":"p1","name":"Chawal","aliases":["rice"],"unit":"kg"},
                            {"id":"p7","name":"Surf Excel","aliases":["surf"],"unit":"packet"}],
               "suppliers": [] } }
// response
{ "intent": "add_credit", "confidence": 0.94,
  "customer": { "id": "c1", "name": "Ramesh Sharma", "isNew": false },
  "items": [ {"name":"Chawal","qty":2,"unit":"kg","productId":"p1"},
             {"name":"Surf Excel","qty":1,"unit":"packet","productId":"p7"} ],
  "amountPaise": 34000,
  "replyLanguage": "hi-IN",
  "replyText": "Sharma ji ke khate mein ₹340 jod diye.",
  "speakText": "शर्मा जी के खाते में तीन सौ चालीस रुपये जोड़ दिए।",
  "clarify": null }
```

### 7.3 Action schema (discriminated union on `intent`)
`add_credit` · `record_payment` · `query_balance` · `cash_sale` · `stock_update` · `query_stock` · `create_order` · `send_reminder` · `daily_summary` · `unknown`.
Common fields: `confidence` (0–1), `replyLanguage`, `replyText`, `speakText` (numbers/currency in words, in `replyLanguage` script), `clarify` (`{question, options[]}` | null).
Intent fields: `customer {id?, name, isNew}`, `amountPaise`, `items[] {name, qty, unit, productId?}`, `stockOps[] {productId?, name, op, qty?, unit?}`, `notes?`.
Balance numbers in `speakText` for `add_credit`/`record_payment` are **filled client-side after commit** via a second, tiny template pass (`{{balance}}` placeholder → number-to-words in the reply language, `src/lib/numwords.ts` for hi/en; Gemini compose for other languages), so the spoken balance is always the true DB value, never an LLM guess.

## 8. Edge cases
| # | Case | Expected behaviour |
|---|---|---|
| E1 | Two customers match ("Sharma ji" → Ramesh & Suresh Sharma) | `clarify` with both as tappable options; nothing committed until chosen |
| E2 | New customer name not in khata | confirm card shows "New customer: X" toggle, default on |
| E3 | Amount missing ("Sharma ji ne Surf liya, udhaar") | if price known, compute; else clarify "Kitne rupaye?" with keypad |
| E4 | Payment larger than balance | allow, balance goes negative = advance; show "₹X advance" in green |
| E5 | Speech > 25 s in push-to-talk | auto-stop at 25 s with toast; transcript still processed |
| E6 | Silence / empty transcript | orb shrugs, "Kuch sunai nahi diya, dobara bolein" — no LLM call |
| E7 | Non-shop chatter ("aaj garmi bahut hai") | `unknown` with friendly reply, nothing written |
| E8 | Code-mixed speech, English numbers inside Hindi | `format=transcribe` gives digits; LLM normalizes "teen sau chalis"/"340"/"three forty" |
| E9 | Unsupported language spoken (e.g., Odia, Assamese) | best-effort `indic-auto`; if detection fails show "Yeh bhasha abhi supported nahi" |
| E10 | WhatsApp `.opus` upload | renamed to `.ogg` before STT; >25 s chunked; >10 min rejected with message |
| E11 | Gnani 429 | client queue, exponential backoff 0.5→1→2 s, max 3 tries; then friendly error |
| E12 | Gnani 402 (credits exhausted) | auto mock-mode banner; demo keeps working with fixtures |
| E13 | Gemini returns invalid JSON / schema mismatch | one retry with fallback model; then `unknown` + clarify |
| E14 | Mic permission denied / no mic (desktop judge) | text input fallback + "Try a sample" audio buttons |
| E15 | Cloned TTS fails for a language | silently fall back to selected Timbre v3 voice; badge "assistant voice used" |
| E16 | Double tap / concurrent commits | commit button disabled while saving; Dexie transaction per action |
| E17 | Mistaken commit | 10-s "Undo" snackbar (soft delete + balance revert) |
| E18 | Stock goes negative | clamp at 0, mark "khatam" |
| E19 | Timezone / day boundary | "today" computed in browser local tz from UTC timestamps |
| E20 | Very noisy audio, low confidence | show transcript prominently and require manual confirm (no auto-confirm) |

## 9. Testing criteria

**Unit (Vitest, TDD — written before implementation)**
- WAV encoder: 16 kHz mono header bytes correct; duration math; resampler 48k→16k length.
- Audio chunker: 70 s buffer → 3 chunks ≤ 25 s; silence-aware split point chosen within ±3 s.
- Keyterms builder: dedupes, ≤ 200, prioritizes recent/high-balance customers.
- Fuzzy matcher: "Sharma ji" / "शर्मा जी" / "sharmaji" → same customer; ambiguity returns 2 candidates.
- Action schema (zod): accepts valid samples for all 10 intents; rejects missing amount on `record_payment`.
- Ledger reducer `applyAction`: credit adds, payment subtracts, undo restores; paise integer math; negative = advance.
- Stock reducer: set/add/remove/out; clamp at 0; low-stock detection; reorder qty formula.
- Daily summary aggregator: entries straddling local midnight assigned correctly (fixed TZ in test).
- numwords: 340 → "तीन सौ चालीस" (hi), "three hundred forty" (en); 1,25,000 → lakh form.
- Gnani client: builds multipart with snake_case fields, `X-API-Key-ID` header, maps 402/429/400 to internal codes (fetch mocked).
- Gemini client: parses structured output, retries once on invalid JSON, falls back to model 2.

**API route tests** (route handlers invoked directly with mocked clients): `/api/stt` rejects >30 s and `.webm`; `/api/understand` returns schema-valid Action; caps return 429 `CAP_EXCEEDED`; mock mode returns fixtures with no outbound fetch.

**Component tests** (Testing Library): ActionCard renders chips and edits amount; Confirm calls commit once (E16); clarify options render and select; Orb state classes; LanguagePicker shows 10 native-script tiles.

**Manual / live verification (with credits, logged in PROGRESS.md)**
- 30-utterance synthetic test set (3 per language, mixed intents) generated with Timbre via `scripts/make_fixtures.py`, + noisy variants (SNR 5 dB shop noise) → run `scripts/eval_pipeline.py` → record intent/amount accuracy.
- Happy path per module on Android Chrome + desktop Chrome.
- Edge cases E1, E3, E6, E10, E12, E14 exercised manually.

## 10. Dependencies
- Gnani API key with 5,000 credits (app.gnani.ai/voice); Gemini API key (user to provide).
- Node 24 / npm 11 (present), Python 3.13 `.venv` for scripts (present).
- npm: `next`, `react`, `typescript`, `tailwindcss`, `motion`, `dexie`, `dexie-react-hooks`, `zod`, `@google/genai`, `lucide-react`, `canvas-confetti`, `sonner`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `fake-indexeddb`.
- Python (.venv): `requests`, `python-dotenv`, `numpy`.
- Deploy: Vercel account (user) with env vars set; Vercel request body limit 4.5 MB → 25 s 16 kHz WAV ≈ 0.8 MB, fine.

## 11. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Credit cost per call unknown | Smoke test first, read dashboard, write numbers into PROGRESS.md; mock mode for UI work; TTS caching; per-IP caps |
| Gnani concurrency = 1 request | server-side serial queue per key in `src/lib/gnani/queue.ts` |
| Cloned voice may not support all languages | test early (Phase 0); fallback voice |
| Gemini SDK structured-output field names changed | wrap in `src/lib/llm/gemini.ts`; verify against docs at build; zod validation regardless |
| One-day scope (5 modules) | strict phase order; M1 must be demo-perfect first; M4/M5 can ship with reduced polish |
| Judges on desktop without mic | text input + sample audio buttons everywhere |

---

## Gate 1 checklist
**Completeness** — [x] problem specific · [x] measurable goal · [x] 9 user stories · [x] must/nice/out split · [x] out-of-scope section
**Data model** — [x] standard id + timestamps · [x] types defined (paise ints, UTC ISO) · [x] soft delete via `deletedAt`
**API design** — [x] endpoints listed · [x] request/response example · [x] naming convention stated (camelCase internal, snake_case at Gnani boundary, deviation justified)
**Quality** — [x] 20 edge cases · [x] happy-path tests · [x] edge-case tests · [x] dependencies listed

**Gate 1: PASSED**
