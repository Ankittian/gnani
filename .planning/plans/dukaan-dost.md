# Implementation Plan: Dukaan Dost

**Spec**: .planning/specs/dukaan-dost.md
**Epic**: none
**Created**: 2026-11-08
**Status**: approved (Gate 2 passed)
**Stack**: Next.js (App Router) + TypeScript + Tailwind v4 · Dexie (IndexedDB) · Gnani Prisma v3.0 / Timbre v3.0 / Voice Clone · Gemini `gemini-3.8-flash` · Vitest + Testing Library · Python `.venv` for API scripts
**Mode**: frontend-heavy full-stack (Next.js route handlers = thin BFF; all state on device)
**Tracker**: `PROGRESS.md` (update after every task)

---

## 1. Architecture

```
┌──────────────── Browser (PWA) ────────────────┐        ┌────── Next.js route handlers (server) ──────┐
│ UI (App Router pages, components)             │        │ /api/stt ──► lib/gnani/stt ──► Prisma v3.0   │
│   │  useVoiceCommand: record→stt→understand   │ fetch  │ /api/tts ──► lib/gnani/tts ──► Timbre v3.0   │
│   │     →confirm→commit→speak                 │◄──────►│ /api/clone, /api/tts-clone ──► Voice clone   │
│   ▼                                           │        │ /api/understand, /api/compose ─► lib/llm     │
│ lib/domain (pure reducers, matching, summary) │        │      (Gemini structured output + zod)        │
│   ▼                                           │        │ lib/server: caps (per-IP), queue (1 in-flight│
│ lib/db (Dexie / IndexedDB)  ttsCache (Cache   │        │   Gnani req), mock fixtures, error mapping   │
│   Storage)  audio (Worklet → PCM16k → WAV)    │        └──────────────────────────────────────────────┘
└───────────────────────────────────────────────┘
```

Layering rule: **pages → components → hooks → lib/domain + lib/db + lib/api(client)**. `lib/domain` is pure (no I/O) and fully unit-tested. Server code lives only in `src/app/api/**` and `src/lib/{gnani,llm,server}/**` (import `server-only`).

### Components table
| Component | Type | Purpose |
|---|---|---|
| `wav`, `resample`, `chunk` | lib (pure) | PCM → 16 kHz → WAV; split long audio ≤ 25 s on silence |
| `recorder` + `pcm-recorder.js` worklet | lib (browser) | mic capture, RMS level callback, 25 s auto-stop |
| `gnani/client` | server lib | STT/TTS/clone HTTP calls, snake_case mapping, error mapping |
| `gnani/queue` | server lib | serialize Gnani calls (concurrency 1) + backoff on 429 |
| `llm/gemini`, `llm/prompts`, `llm/schema` | server lib | Gemini structured output, prompts per task, zod + JSON Schema for Action/Compose |
| `server/caps`, `server/mock` | server lib | per-IP daily caps; fixture responses when `MOCK_MODE=1` or 402 |
| `domain/money`, `numwords` | lib (pure) | paise math, ₹ formatting (Indian grouping), number→words hi/en |
| `domain/match`, `keyterms` | lib (pure) | transliteration-aware fuzzy customer/product match; STT keyterms list |
| `domain/ledger`, `stock`, `orders`, `summary` | lib (pure) | apply Action → DB mutations; reorder calc; daily aggregates |
| `db/schema`, `db/repo`, `db/seed` | lib (browser) | Dexie tables, transactional commit/undo, synthetic demo shop |
| `api/client`, `ttsCache`, `usage` | lib (browser) | typed fetch wrappers, Cache Storage TTS cache, credit meter |
| `useRecorder`, `useVoiceCommand`, `useSpeak`, `useShop` | hooks | orchestration + state machines |
| `DostOrb` | component | 5-state animated assistant character |
| `VoiceSheet`, `MicButton`, `ActionCard`, `ClarifyOptions`, `TranscriptView` | components | the voice loop UI |
| `AppShell`, `BottomNav`, `StatChip`, `ModuleTile`, `ActivityFeed`, `EmptyState` | components | shell & home |
| Khata / Stock / Orders / Hisaab / Onboarding / Settings components | components | per module (see file table) |

### File locations
| File | Location | Purpose |
|---|---|---|
| `layout.tsx`, `globals.css`, `manifest.ts`, `page.tsx` | `src/app/` | root layout (fonts, theme tokens, Toaster), PWA manifest, Home |
| `onboarding/page.tsx` | `src/app/` | S1 |
| `khata/page.tsx`, `khata/[id]/page.tsx` | `src/app/` | S4, S5 |
| `stock/page.tsx`, `stock/reorder/page.tsx` | `src/app/` | S7, S8 |
| `orders/page.tsx`, `orders/[id]/page.tsx` | `src/app/` | S9 |
| `hisaab/page.tsx` | `src/app/` | S10 |
| `settings/page.tsx` | `src/app/` | S11 |
| `health/`, `stt/`, `understand/`, `compose/`, `tts/`, `clone/`, `tts-clone/` `route.ts` | `src/app/api/` | BFF routes |
| `wav.ts`, `resample.ts`, `chunk.ts`, `recorder.ts` | `src/lib/audio/` | audio |
| `pcm-recorder.js` | `public/worklets/` | AudioWorklet processor |
| `client.ts`, `queue.ts`, `errors.ts`, `types.ts` | `src/lib/gnani/` | Gnani integration |
| `gemini.ts`, `prompts.ts`, `schema.ts` | `src/lib/llm/` | Gemini integration + Action schema |
| `caps.ts`, `mock.ts`, `http.ts` | `src/lib/server/` | caps, fixtures, JSON error helpers |
| `money.ts`, `numwords.ts`, `match.ts`, `keyterms.ts`, `ledger.ts`, `stock.ts`, `orders.ts`, `summary.ts` | `src/lib/domain/` | pure business logic |
| `schema.ts`, `repo.ts`, `seed.ts` | `src/lib/db/` | Dexie |
| `client.ts`, `ttsCache.ts`, `usage.ts` | `src/lib/api/` | browser API layer |
| `languages.ts`, `strings.ts` | `src/lib/i18n/` | 10 languages meta (code, native name, font, Timbre code), UI strings en+hi (+ labels for 8) |
| `use*.ts` | `src/hooks/` | hooks |
| components | `src/components/{orb,voice,layout,khata,stock,orders,hisaab,onboarding,common}/` | UI |
| `*.test.ts(x)` | next to source | Vitest |
| `mock/*.json`, `samples/*.mp3` | `public/fixtures/` | mock responses, noisy sample orders |
| `smoke_gnani.py`, `make_fixtures.py`, `eval_pipeline.py`, `requirements.txt` | `scripts/` | run with `.venv` |
| `vitest.config.ts`, `vitest.setup.ts` | repo root | test config (jsdom, fake-indexeddb) |

### Files to change (existing)
| File | What changes | Why |
|---|---|---|
| `.gitignore` | done — node/.next/.venv/.env.local | repo hygiene |
| `.env.example` | done | config contract |

---

## 2. Tasks

Conventions: each task = one commit (`feat:`/`test:`/`chore:`), ≤ 3 source files + their tests, TDD for everything in `lib/`. Run `npx vitest run` after each `lib` task and `npm run build` before each commit touching `.ts/.tsx`. Tick the task in `PROGRESS.md` immediately.

### Phase 0 — Setup & API truth (≈ 1 h)  ⟶ blocks everything
| # | Task | Files | Verify |
|---|---|---|---|
| 0.1 | Scaffold Next.js (TS, App Router, Tailwind, ESLint, `src/`, alias `@/*`) into repo root; add deps (§10 of spec); `vitest.config.ts` + setup (jsdom, fake-indexeddb, RTL) | `package.json`, `vitest.config.ts`, `vitest.setup.ts` | `npm run build`, `npx vitest run` (0 tests ok) |
| 0.2 | `scripts/smoke_gnani.py`: STT (Timbre-generated wav round-trip), TTS (v3.0 Lakshmi hi-IN + kn-IN), clone embedding + cloned TTS in hi/kn/ta → saves to `scripts/out/`, prints latency & response codes | `scripts/smoke_gnani.py` | user adds keys to `.env.local`; run `.venv\Scripts\python scripts\smoke_gnani.py`; **record credit delta from dashboard in PROGRESS.md** |
| 0.3 | Gemini smoke: structured-output call with the Action schema on 3 utterances (confirm SDK field names for JSON schema in `@google/genai`) | `scripts/smoke_gemini.mjs` | outputs valid JSON |

### Phase 1 — Pure foundations, TDD (≈ 1.5 h)  ⟶ parallel within phase
| # | Task | Files | Tests |
|---|---|---|---|
| 1.1 | WAV encoder + linear resampler | `lib/audio/wav.ts`, `lib/audio/resample.ts` (+tests) | header bytes, length, 48k→16k |
| 1.2 | Silence-aware chunker (≤25 s, RMS window) | `lib/audio/chunk.ts` (+test) | 70 s → 3 chunks, split near silence |
| 1.3 | Money (paise, `formatINR` with lakh grouping) + numwords hi/en | `lib/domain/money.ts`, `lib/domain/numwords.ts` (+tests) | 340, 1250, 125000, 0, negatives |
| 1.4 | Languages meta + i18n strings (en, hi full; 8 label sets) | `lib/i18n/languages.ts`, `lib/i18n/strings.ts` | 10 entries, each has native name, Timbre code, font var |
| 1.5 | Fuzzy matcher (normalize: lowercase, strip honorifics ji/bhai/didi/anna/akka/sir, Indic→Latin rough transliteration map, Levenshtein ratio) + keyterms builder | `lib/domain/match.ts`, `lib/domain/keyterms.ts` (+tests) | E1 ambiguity, Devanagari/Kannada/Latin same, ≤200 dedupe |
| 1.6 | Action + Compose schema (zod) and exported JSON Schema for Gemini | `lib/llm/schema.ts` (+test) | valid samples for all 10 intents, rejects bad |
| 1.7 | Dexie schema + repo (transactional `commitAction`, `undo`) | `lib/db/schema.ts`, `lib/db/repo.ts` (+test w/ fake-indexeddb) | credit/payment/undo, concurrent double commit (E16) |
| 1.8 | Domain reducers: ledger, stock (clamp, low-stock, reorder qty), orders (status, toLedger), summary (local-day aggregation, 7-day series) | `lib/domain/ledger.ts`, `stock.ts`, `summary.ts` (+tests) (orders in 1.8b) | E4, E18, E19 |
| 1.9 | Synthetic demo seed: shop, 12 customers (mixed-language names), 30 products w/ aliases, 4 suppliers (kn, ta, hi, te), 2 weeks of history | `lib/db/seed.ts` | seed then summary returns non-zero |

### Phase 2 — Server routes (≈ 1 h)  ⟶ depends on 1.6; parallel with Phase 3
| # | Task | Files | Tests |
|---|---|---|---|
| 2.1 | Gnani client (stt, tts, clone, ttsClone), snake_case mapping, error mapping (400/401/402/403/429/500 → internal codes), extension normalization (.opus→.ogg) | `lib/gnani/client.ts`, `errors.ts`, `types.ts` (+test, fetch mocked) | headers, multipart fields, codes |
| 2.2 | Serial queue with backoff (0.5/1/2 s, 3 tries on 429) | `lib/gnani/queue.ts` (+test, fake timers) | ordering, retry, give-up |
| 2.3 | Gemini client (model + fallback, thinking low, JSON schema, zod validate, 1 retry) + prompts (understand-command, understand-order, compose-reminder, compose-supplierOrder, compose-dailySummary; all instruct `speakText` numbers-in-words in target script) | `lib/llm/gemini.ts`, `prompts.ts` (+test, SDK mocked) | retry/fallback, invalid → unknown |
| 2.4 | Server helpers: caps (per-IP daily, in-memory Map), mock fixtures, JSON error responses | `lib/server/caps.ts`, `mock.ts`, `http.ts` (+test) | cap → 429 CAP_EXCEEDED |
| 2.5 | Routes: `health`, `stt` (validate ext & ≤30 s via WAV header/size), `understand`, `compose` | `app/api/{health,stt,understand,compose}/route.ts` (+route tests) | rejects .webm, mock mode no fetch |
| 2.6 | Routes: `tts` (server LRU cache), `clone`, `tts-clone` (fallback signal header `x-voice-fallback`) | `app/api/{tts,clone,tts-clone}/route.ts` (+tests) | cache hit, 402 → OUT_OF_CREDITS |

### Phase 3 — Design system & shell (≈ 1 h)  ⟶ parallel with Phase 2
| # | Task | Files | Tests |
|---|---|---|---|
| 3.1 | Theme tokens (light/dark, §6.2), Baloo font family per script via `next/font/google`, base styles, `prefers-reduced-motion` | `app/globals.css`, `app/layout.tsx` | build; visual check |
| 3.2 | `DostOrb` (idle/listening/thinking/speaking/happy, level prop) | `components/orb/DostOrb.tsx` (+test state classes) | renders each state |
| 3.3 | `AppShell`, `BottomNav` (center Mic FAB slot), `StatChip`, `ModuleTile`, `EmptyState` | `components/layout/*` | nav renders 4 tabs + FAB |
| 3.4 | PWA manifest + icons (marigold orb), theme color, Toaster (sonner) | `app/manifest.ts`, `public/icons/*` | Lighthouse installable |

### Phase 4 — Voice loop + M1 Khata (≈ 2 h)  ⟶ depends on 1.x, 2.x, 3.x — **demo-critical, polish first**
| # | Task | Files | Tests |
|---|---|---|---|
| 4.1 | Recorder: worklet + `recorder.ts` + `useRecorder` (level, 25 s auto-stop, permission errors) | `public/worklets/pcm-recorder.js`, `lib/audio/recorder.ts`, `hooks/useRecorder.ts` | manual (mic), unit for timer logic |
| 4.2 | Browser API client + TTS cache + usage meter | `lib/api/client.ts`, `ttsCache.ts`, `usage.ts` (+tests) | error shape mapping, cache key |
| 4.3 | `useSpeak` (play audio, AnalyserNode level → orb), `useVoiceCommand` state machine: idle→recording→transcribing→understanding→confirming→committing→speaking→done/error/clarify | `hooks/useSpeak.ts`, `hooks/useVoiceCommand.ts` (+test w/ mocked client) | transitions, empty transcript skips LLM (E6) |
| 4.4 | `VoiceSheet`, `MicButton`, `TranscriptView` (typewriter, language badge), text-input fallback (E14) | `components/voice/*` | opens/closes, Esc, focus trap |
| 4.5 | `ActionCard` (editable chips, new-customer toggle, 3 s auto-confirm countdown when conf ≥ .85), `ClarifyOptions`, Undo snackbar (E17) | `components/voice/ActionCard.tsx`, `ClarifyOptions.tsx` (+tests) | edit amount, single commit, clarify select |
| 4.6 | Home page: greeting, orb, stat chips (live via `useLiveQuery`), module tiles, activity feed, rotating "Try saying…" hints | `app/page.tsx`, `components/layout/ActivityFeed.tsx` | renders with seed |
| 4.7 | Khata list + customer detail (timeline, balance, celebration on zero) | `app/khata/page.tsx`, `app/khata/[id]/page.tsx`, `components/khata/*` | list sorted by balance |
| 4.8 | **Live check M1** on phone: 5 utterances in hi/Hinglish/kn/ta/en; log results in PROGRESS.md | — | ≥ 4/5 correct |

### Phase 5 — M2 Reminders + voice clone (≈ 1 h)  ⟶ depends on 4
| # | Task | Files | Tests |
|---|---|---|---|
| 5.1 | `CloneRecorder` (prompt line per language, 20 s, level meter) → `/api/clone` → store embedding | `components/onboarding/CloneRecorder.tsx` | manual |
| 5.2 | `ReminderSheet`: compose in customer language, gloss, voice toggle (mine/assistant), preview, fallback badge | `components/khata/ReminderSheet.tsx` | renders, fallback badge on header |
| 5.3 | `ShareButton` (Web Share files → fallback download + `wa.me/?text=`), `AudioPlayer` | `components/common/ShareButton.tsx`, `AudioPlayer.tsx` | share fallback path |

### Phase 6 — M3 Stock & reorder (≈ 1 h)  ⟶ depends on 4 (parallel with 5 if two builders)
| # | Task | Files | Tests |
|---|---|---|---|
| 6.1 | Stock page: filter chips, `ProductCard` (bar, ± stepper, badge) | `app/stock/page.tsx`, `components/stock/ProductCard.tsx` | filter low |
| 6.2 | Reorder page: grouped by supplier, qty steppers, `SupplierOrderCard` → compose in supplier language → TTS → share | `app/stock/reorder/page.tsx`, `components/stock/SupplierOrderCard.tsx` | grouping |
| 6.3 | Wire `stock_update`, `query_stock`, `cash_sale` intents into `commitAction` + replies | `lib/db/repo.ts`, `lib/domain/stock.ts` | reducer tests extended |

### Phase 7 — M4 Voice orders (≈ 1 h)  ⟶ depends on 1.2, 4
| # | Task | Files | Tests |
|---|---|---|---|
| 7.1 | `UploadOrder`: file picker (.opus/.ogg/.m4a/.mp3/.wav), record, "Try a sample"; decode→resample→chunk→sequential STT with `previousText`; progress UI per chunk | `components/orders/UploadOrder.tsx`, `hooks/useLongTranscribe.ts` | chunk flow with mocked client |
| 7.2 | Orders list + detail: `OrderCard`, `PackingChecklist` (tick animation), status pill, "Add to khata" | `app/orders/page.tsx`, `app/orders/[id]/page.tsx`, `components/orders/*` | status transitions |
| 7.3 | Noisy sample fixtures: `scripts/make_fixtures.py` — Timbre-generated customer orders in 5 languages + mixed shop noise at SNR 5/10 dB → `public/fixtures/samples/` | `scripts/make_fixtures.py` | files play; STT transcript sane |

### Phase 8 — M5 Aaj ka Hisaab (≈ 45 min)
| # | Task | Files | Tests |
|---|---|---|---|
| 8.1 | Hisaab page: `CountUp` cards, top owing, `WeekBars` (SVG, no chart lib), "▶ Suno" (compose dailySummary → TTS, orb speaking) | `app/hisaab/page.tsx`, `components/hisaab/CountUp.tsx`, `WeekBars.tsx` | renders with seed |

### Phase 9 — Onboarding & settings (≈ 45 min)
| # | Task | Files | Tests |
|---|---|---|---|
| 9.1 | Onboarding 4 steps; redirect to `/onboarding` when no shop row | `app/onboarding/page.tsx`, `components/onboarding/LanguagePicker.tsx` | 10 native tiles |
| 9.2 | Settings: language, voice gallery with ▶ samples (cached), any-language toggle, clone manage, sounds/haptics, credit meter, reset/demo | `app/settings/page.tsx` | toggles persist |

### Phase 10 — QA, eval, ship (≈ 1 h)
| # | Task | Files / Tool | Verify |
|---|---|---|---|
| 10.1 | `scripts/eval_pipeline.py` over 30 fixtures (clean + noisy) → accuracy table into PROGRESS.md | `scripts/eval_pipeline.py` | ≥ 90 % intent |
| 10.2 | Full `npx vitest run` + `npm run build` + lint clean | — | all green |
| 10.3 | Browser QA via `browser-qa` / `/spartan:qa` skill: each module happy path + E6/E12/E14 at 390×844 and desktop | Playwright | report in PROGRESS.md |
| 10.4 | `vercel-react-best-practices` pass + `js-security-audit` (keys server-only, deps) | skills | no criticals |
| 10.5 | Deploy to Vercel (user logs in), set env vars, smoke test public URL on phone | — | URL in PROGRESS.md |
| 10.6 | README (setup, architecture, Gnani models used, team contribution) → reused for hackathon write-up | `README.md` | — |

### Parallel vs sequential
| Parallel group | Tasks | Why |
|---|---|---|
| A | 1.1–1.9 | independent pure modules |
| B | Phase 2 ∥ Phase 3 | server vs UI shell, no shared files |
| C | Phase 5 ∥ Phase 6 | different modules (both need Phase 4) |
| D | 7.3 fixtures ∥ anything after 0.2 | script only |

| Sequential | Depends on | Why |
|---|---|---|
| Phase 1+ | 0.1 | scaffold |
| 2.5/2.6 | 1.6, 2.1–2.4 | routes use clients + schema |
| Phase 4 | 1, 2, 3 | voice loop needs all foundations |
| 5, 6, 7, 8 | 4 | reuse VoiceSheet/useVoiceCommand/ActionCard |
| 10.x | all | final QA |

**Cut line if behind schedule (in order):** drop 9.2 voice gallery → drop 8.1 WeekBars → M4 "record" input (keep upload + samples) → 5.1 clone (use assistant voice) → never cut Phase 4.

---

## 3. Testing plan (traceability)
| Layer | Tests | Spec refs |
|---|---|---|
| Data (Dexie) | `repo.test.ts`: commit credit/payment/stock/order, undo, double-commit guard | R-K1, E16, E17 |
| Business logic | ledger/stock/summary/match/keyterms/numwords/money/chunk/wav tests | R-V2, R-V3, R-V8, R-S3, R-H1, E1, E4, E8, E18, E19 |
| API / integration | route tests with mocked Gnani/Gemini: format/length rejection, caps, mock mode, 402/429 mapping, invalid LLM JSON retry | R-P3–P5, E5, E10–E13 |
| UI | ActionCard, ClarifyOptions, VoiceSheet, DostOrb, LanguagePicker, BottomNav | R-V5, R-U1, E14 |
| Live / eval | smoke scripts, 30-fixture eval (clean + noisy), per-module manual run, browser QA | Goal metrics, E6, E12, E20 |

---

## Gate 2 checklist
**Architecture** — [x] follows App Router conventions & repo frontend rules · [x] pages → components → hooks → lib; server code isolated with `server-only` · [x] directories defined
**Task breakdown** — [x] all changed files listed · [x] all new files listed with locations · [x] tasks small (≤3 files) · [x] dependencies explicit · [x] parallel/sequential marked · [x] cut line defined
**Testing** — [x] data layer · [x] business logic · [x] API/integration · [x] UI · [x] edge cases mapped

**Gate 2: PASSED**
