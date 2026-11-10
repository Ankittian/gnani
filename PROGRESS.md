# Dukaan Dost — Progress Tracker

> Single source of truth for build status. Update after **every** task (tick box, add commit hash, note surprises).
> Spec: `.planning/specs/dukaan-dost.md` · Plan: `.planning/plans/dukaan-dost.md`

**Build day:** 2026-11-08 · **Submission deadline:** 2026-11-10 23:59 IST · **Target code-complete:** 2026-11-08 ~23:00 IST

## Status at a glance
| Phase | Tasks | Done | Status |
|---|---|---|---|
| 0 Setup & API truth | 3 | 3 | ✅ |
| 1 Pure foundations (TDD) | 9 | 9 | ✅ |
| 2 Server routes | 6 | 6 | ✅ |
| 3 Design system & shell | 4 | 4 | ✅ |
| 4 Voice loop + M1 Khata ⭐ | 8 | 7 | ⏳ live check on phone |
| 5 M2 Reminders + clone | 3 | 3 | ✅ |
| 6 M3 Stock & reorder | 3 | 3 | ✅ |
| 7 M4 Voice orders | 3 | 3 | ✅ |
| 8 M5 Aaj ka Hisaab | 1 | 1 | ✅ |
| 9 Onboarding & settings | 2 | 2 | ✅ |
| 10 QA, eval, ship | 6 | 3 | ⏳ |
| **Total** | **48** | **44** | |

Legend: ⬜ not started · ⏳ in progress · ✅ done · ⚠️ blocked · ✂️ cut

## Planning (done)
- [x] Research Gnani models & hackathon rules
- [x] PRD / spec written — Gate 1 passed
- [x] Implementation plan — Gate 2 passed
- [x] Git repo initialized (`main`), `.gitignore`, `.env.example`
- [x] Python `.venv` created (requests, python-dotenv, numpy) — `scripts/requirements.txt`

## Blockers / inputs needed from user
- [ ] **Gnani API key** → `.env.local` `GNANI_API_KEY`
- [ ] **Gemini API key** → `.env.local` `GEMINI_API_KEY`
- [ ] Vercel login (Phase 10.5)
- [ ] 10–20 s voice sample of a team member for clone (consent) (Phase 5)

## Phase 0 — Setup & API truth ✅
- [x] 0.1 Scaffold Next.js 16.4.5 + React 19.3 + Tailwind 4 + deps + Vitest 5 config (cacheComponents off)
- [x] 0.2 `scripts/smoke_gnani.py` — STT ✅ (hi/kn/ta, ~0.7 s), TTS v3.0 ✅ (hi/kn/ta/hi-en, 1–2 s), clone ✅ (hi/kn/ta verified by STT round-trip). Credit cost: **user to read dashboard**
- [x] 0.3 Gemini structured-output smoke — both models correct on hi/kn/ta

### API facts learned in Phase 0 (differ from docs — code must follow these)
- Gnani TTS WAV has a **streaming header (data size 0xFFFFFFFF)** → never trust WAV header length; use mp3 for browser playback.
- Clone embeddings response is `{success, message, data: {voice_clone_embedding: {embedding, shape:[1,768], dtype}}}`.
- Cloned TTS **requires `model: "vachana-vc-v1"`** explicitly (timbre models reject `speaker_embedding`); works in hi/kn/ta.
- STT `.webm` → 400 `UNSUPPORTED_AUDIO_FORMAT` (confirmed). `indic-auto` + `format=transcribe` gives Latin English words + digits ("Sharma ji ने 2 किलो chawal … 340 रुपये").
- STT error body shape: `{success:false, error:{type, message}}`; TTS error body: `{success:false, message, status_code}`.
- Gemini `@google/genai` v3: `generateContent({config:{responseMimeType:'application/json', responseJsonSchema, thinkingConfig:{thinkingLevel: ThinkingLevel.LOW}}})`.

## Phase 1 — Pure foundations (TDD)
- [x] 1.1 WAV encoder + resampler
- [x] 1.2 Silence-aware chunker
- [x] 1.3 Money + numwords (hi/en)
- [x] 1.4 Languages meta + i18n strings
- [x] 1.5 Fuzzy matcher + keyterms
- [x] 1.6 Action/Compose zod schema + JSON Schema
- [x] 1.7 Dexie schema + repo (commit/undo)
- [x] 1.8 Domain reducers (ledger, stock, orders, summary)
- [x] 1.9 Synthetic demo seed

## Phase 2 — Server routes
- [x] 2.1 Gnani client + error mapping
- [x] 2.2 Serial queue + backoff
- [x] 2.3 Gemini client + prompts
- [x] 2.4 Caps, mock fixtures, http helpers
- [x] 2.5 Routes: health, stt, understand, compose
- [x] 2.6 Routes: tts, clone, tts-clone

## Phase 3 — Design system & shell
- [x] 3.1 Theme tokens + Baloo fonts
- [x] 3.2 DostOrb (5 states)
- [x] 3.3 AppShell, BottomNav, StatChip, ModuleTile, EmptyState
- [x] 3.4 PWA manifest + icons + Toaster

## Phase 4 — Voice loop + M1 Khata ⭐ (demo-critical)
- [x] 4.1 Recorder (worklet, level, 25 s auto-stop)
- [x] 4.2 Browser API client + TTS cache + usage meter
- [x] 4.3 useSpeak + useVoiceCommand state machine
- [x] 4.4 VoiceSheet, MicButton, TranscriptView, text fallback
- [x] 4.5 ActionCard, ClarifyOptions, Undo
- [x] 4.6 Home page
- [x] 4.7 Khata list + customer detail
- [ ] 4.8 Live check M1 (5 utterances, 5 languages)

## Phase 5 — M2 Reminders + voice clone
- [x] 5.1 CloneRecorder → /api/clone
- [x] 5.2 ReminderSheet (customer language, my voice / assistant)
- [x] 5.3 ShareButton + AudioPlayer

## Phase 6 — M3 Stock & reorder
- [x] 6.1 Stock page + ProductCard
- [x] 6.2 Reorder page + SupplierOrderCard (supplier-language voice note)
- [x] 6.3 Wire stock_update / query_stock / cash_sale

## Phase 7 — M4 Voice orders
- [x] 7.1 UploadOrder + long-audio chunked transcription
- [x] 7.2 Orders list/detail + PackingChecklist
- [x] 7.3 Noisy sample fixtures (make_fixtures.py)

## Phase 8 — M5 Aaj ka Hisaab
- [x] 8.1 Hisaab page (CountUp, WeekBars, Suno)

## Phase 9 — Onboarding & settings
- [x] 9.1 Onboarding (4 steps)
- [x] 9.2 Settings

## Phase 10 — QA, eval, ship
- [ ] 10.1 Eval over 30 fixtures (clean + noisy)
- [x] 10.2 Vitest + build + lint green
- [ ] 10.3 Browser QA (mobile + desktop)
- [ ] 10.4 React best-practices + JS security audit
- [ ] 10.5 Deploy to Vercel
- [ ] 10.6 README / write-up

## Post-build (Nov 9–10, not code)
- [ ] 60-second demo video (real shop, background noise, Hinglish → Kannada → cloned-voice reminder)
- [ ] Project write-up (problem, users, Gnani models used, contributions)
- [ ] LinkedIn post (#GnaniAI #GreatIndianAIInternshipChallenge) — live before submission
- [ ] X post (same tags) — live before submission
- [ ] Submit by 2026-11-10 20:00 IST (4 h buffer)

---

## Measurements
### Gnani credit cost (fill from app.gnani.ai/voice after 0.2)
| Call | Units | Credits used | Credits per unit |
|---|---|---|---|
| STT REST (prisma-v3.0) | _ s audio | | |
| TTS REST (timbre-v3.0) | _ chars | | |
| Voice clone embedding | 1 | | |
| Cloned TTS | _ chars | | |
| **Remaining balance** | | | |

### Latency (median)
| Step | Target | Measured |
|---|---|---|
| STT | ≤ 1.0 s | 0.67–0.90 s (smoke, 4–5 s clips) |
| Gemini understand | ≤ 2.0 s | flash-lite 1.3–1.7 s · 3.8-flash 2.1–3.7 s |
| TTS first byte | ≤ 1.0 s | REST full audio 1.1–1.9 s (clone 1.8–2.4 s) |
| End-to-end voice → confirm card | ≤ 4.0 s | |

### Accuracy (Phase 10.1)
| Set | Intent acc. | Amount/customer acc. |
|---|---|---|
| Clean (30) | | |
| Noisy SNR 5 dB (30) | | |

### Cloned-voice language support (from 0.2)
| Language | Works? | Notes |
|---|---|---|
| hi-IN | ✅ | STT round-trip exact |
| kn-IN | ✅ | STT round-trip exact |
| ta-IN | ✅ | STT round-trip near-exact |

## Decisions log
| Date | Decision | Why |
|---|---|---|
| 2026-11-08 | Next.js full-stack TS, data on-device (IndexedDB) | one deploy, no DB setup, offline-friendly, fits one-day build |
| 2026-11-08 | Gemini `gemini-3.8-flash` (fallback `gemini-3.5-flash-lite`) for understanding/compose | user provides Gemini key; Evon not on Gnani API |
| 2026-11-08 | Prisma v3.0 + `keyterms` from shop catalog/customers | per-shop speech biasing; `detected_language_code` drives reply language |
| 2026-11-08 | Timbre v3.0 as assistant voice | every voice speaks all 10 languages → one consistent persona |
| 2026-11-08 | WAV 16 kHz via AudioWorklet, not MediaRecorder | Prisma REST rejects WebM; format detected by file extension |
| 2026-11-08 | Money as integer paise; timestamps UTC ISO | no float errors; repo TIMEZONE rule |
| 2026-11-08 | Internal API camelCase, snake_case only at Gnani boundary | TS↔TS BFF; FRONTEND.md keysToSnake rule targets Kotlin backends |
| 2026-11-08 | All 5 modules in scope, cut line defined in plan | user choice; protects M1 quality |
| 2026-11-08 | Understand = `gemini-3.5-flash-lite` (fast), compose + fallback = `gemini-3.8-flash` | smoke: flash-lite ~2× faster with identical extraction |
| 2026-11-08 | Keys live in `.env` (user choice) — gitignored, Next.js loads it | — |
| 2026-11-08 | `cacheComponents` disabled in next.config | client-state app; avoids Activity/PPR surprises |

## Session log
| Time (IST) | What happened | Commit |
|---|---|---|
| 2026-11-08 | Planning complete; repo + .venv initialized | 5ed03b9 |
| 2026-11-08 | Phase 0 done: Gnani STT/TTS/clone + Gemini verified live | deb210d |
| 2026-11-08 | Phases 1-9 built: 170 tests green, `next build` green. Live API chain verified via dev server: noisy hi/kn/long Hinglish STT correct; Gemini order + udhaar extraction correct; /api/tts + /api/tts-clone OK | a5cbe44 |

## Live verification log (2026-11-08, through the Next.js API)
| Check | Result |
|---|---|
| STT noisy Hindi order (SNR 5 dB), keyterms Meena/Maggi/Parle-G | exact, 0.70 s |
| STT noisy Kannada order (SNR 5 dB) | exact, 0.44 s |
| STT 22 s Hinglish long order | exact, 0.60 s |
| understand(order) → items matched to catalog ids, note captured | ✅ conf 1.0 |
| understand(command) "Sharma ji ne 2 kilo chawal aur Maggi, udhaar" | add_credit, alias→Ramesh, ₹134 computed from prices, `{balance}` token present |
| /api/tts hi-IN Lakshmi with ₹ digits | 200 audio/mpeg |
| /api/tts-clone kn-IN | 200 audio/mpeg, no fallback |

## Remaining
- [ ] 4.8 / manual: test mic flow on a real phone (Chrome Android) — needs HTTPS (Vercel) for mic
- [ ] 10.1 eval over 30 utterances (clean + noisy)
- [x] 10.3 browser QA (Playwright, 390x844): onboarding → every screen → typed command → action card; 0 console errors, 0 overflow (`scripts/qa.mjs`)
- [x] 10.4 (partial) keys absent from client bundle + not tracked by git; ESLint 0 problems. Full js-security-audit still to run before deploy
- [ ] 10.5 deploy to Vercel (needs user login)
- [ ] 10.6 README write-up

## 2026-11-10 — Connected flows + shop memory (uncommitted on `feature/i18n-and-animations`)
- [x] Udhaar / cash-sale items reduce stock automatically (`drawsForItems`, unit-aware g↔kg, ml↔l, dozen↔piece); undo restores; every movement stores `source` + `refId`
- [x] Delivered order reduces stock exactly once (`stockDeducted`); "Add to khata" is idempotent (`ledgerEntryId`)
- [x] Stock CSV import (sample download, "try with sample", preview new/update, per-line errors) + CSV export; sample at `public/samples/stock-sample.csv`
- [x] Shop memory (`src/lib/domain/memory.ts`): customer habits, product velocity/days-left/top buyers, unified timeline, insights
- [x] LLM context carries memory (recent events, usual/last basket, live stock) → "usne", "same as last time", "kitna bacha" work; `/api/understand` schema accepts it (it was silently stripping stockQty before)
- [x] UI: Home "Dost remembers" + linked activity, `/memory` timeline with search, `/stock/[id]` product memory, customer habits + "Same as last time", confirm card previews khata & stock after
- [x] 200 tests, lint, build green; `node scripts/qa-connected.mjs` (QA_BASE=prod server) all checks pass
- Note: `next dev` on this machine loops Fast Refresh with no file changes — QA against `next build && next start`
