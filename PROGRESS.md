# Dukaan Dost — Progress Tracker

> Single source of truth for build status. Update after **every** task (tick box, add commit hash, note surprises).
> Spec: `.planning/specs/dukaan-dost.md` · Plan: `.planning/plans/dukaan-dost.md`

**Build day:** 2026-11-08 · **Submission deadline:** 2026-11-10 23:59 IST · **Target code-complete:** 2026-11-08 ~23:00 IST

## Status at a glance
| Phase | Tasks | Done | Status |
|---|---|---|---|
| 0 Setup & API truth | 3 | 0 | ⏳ next |
| 1 Pure foundations (TDD) | 9 | 0 | ⬜ |
| 2 Server routes | 6 | 0 | ⬜ |
| 3 Design system & shell | 4 | 0 | ⬜ |
| 4 Voice loop + M1 Khata ⭐ | 8 | 0 | ⬜ |
| 5 M2 Reminders + clone | 3 | 0 | ⬜ |
| 6 M3 Stock & reorder | 3 | 0 | ⬜ |
| 7 M4 Voice orders | 3 | 0 | ⬜ |
| 8 M5 Aaj ka Hisaab | 1 | 0 | ⬜ |
| 9 Onboarding & settings | 2 | 0 | ⬜ |
| 10 QA, eval, ship | 6 | 0 | ⬜ |
| **Total** | **48** | **0** | |

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

## Phase 0 — Setup & API truth
- [ ] 0.1 Scaffold Next.js + deps + Vitest config
- [ ] 0.2 `scripts/smoke_gnani.py` (STT, TTS v3.0, clone in hi/kn/ta) + record credit cost
- [ ] 0.3 Gemini structured-output smoke

## Phase 1 — Pure foundations (TDD)
- [ ] 1.1 WAV encoder + resampler
- [ ] 1.2 Silence-aware chunker
- [ ] 1.3 Money + numwords (hi/en)
- [ ] 1.4 Languages meta + i18n strings
- [ ] 1.5 Fuzzy matcher + keyterms
- [ ] 1.6 Action/Compose zod schema + JSON Schema
- [ ] 1.7 Dexie schema + repo (commit/undo)
- [ ] 1.8 Domain reducers (ledger, stock, orders, summary)
- [ ] 1.9 Synthetic demo seed

## Phase 2 — Server routes
- [ ] 2.1 Gnani client + error mapping
- [ ] 2.2 Serial queue + backoff
- [ ] 2.3 Gemini client + prompts
- [ ] 2.4 Caps, mock fixtures, http helpers
- [ ] 2.5 Routes: health, stt, understand, compose
- [ ] 2.6 Routes: tts, clone, tts-clone

## Phase 3 — Design system & shell
- [ ] 3.1 Theme tokens + Baloo fonts
- [ ] 3.2 DostOrb (5 states)
- [ ] 3.3 AppShell, BottomNav, StatChip, ModuleTile, EmptyState
- [ ] 3.4 PWA manifest + icons + Toaster

## Phase 4 — Voice loop + M1 Khata ⭐ (demo-critical)
- [ ] 4.1 Recorder (worklet, level, 25 s auto-stop)
- [ ] 4.2 Browser API client + TTS cache + usage meter
- [ ] 4.3 useSpeak + useVoiceCommand state machine
- [ ] 4.4 VoiceSheet, MicButton, TranscriptView, text fallback
- [ ] 4.5 ActionCard, ClarifyOptions, Undo
- [ ] 4.6 Home page
- [ ] 4.7 Khata list + customer detail
- [ ] 4.8 Live check M1 (5 utterances, 5 languages)

## Phase 5 — M2 Reminders + voice clone
- [ ] 5.1 CloneRecorder → /api/clone
- [ ] 5.2 ReminderSheet (customer language, my voice / assistant)
- [ ] 5.3 ShareButton + AudioPlayer

## Phase 6 — M3 Stock & reorder
- [ ] 6.1 Stock page + ProductCard
- [ ] 6.2 Reorder page + SupplierOrderCard (supplier-language voice note)
- [ ] 6.3 Wire stock_update / query_stock / cash_sale

## Phase 7 — M4 Voice orders
- [ ] 7.1 UploadOrder + long-audio chunked transcription
- [ ] 7.2 Orders list/detail + PackingChecklist
- [ ] 7.3 Noisy sample fixtures (make_fixtures.py)

## Phase 8 — M5 Aaj ka Hisaab
- [ ] 8.1 Hisaab page (CountUp, WeekBars, Suno)

## Phase 9 — Onboarding & settings
- [ ] 9.1 Onboarding (4 steps)
- [ ] 9.2 Settings

## Phase 10 — QA, eval, ship
- [ ] 10.1 Eval over 30 fixtures (clean + noisy)
- [ ] 10.2 Vitest + build + lint green
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
| STT | ≤ 1.0 s | |
| Gemini understand | ≤ 2.0 s | |
| TTS first byte | ≤ 1.0 s | |
| End-to-end voice → confirm card | ≤ 4.0 s | |

### Accuracy (Phase 10.1)
| Set | Intent acc. | Amount/customer acc. |
|---|---|---|
| Clean (30) | | |
| Noisy SNR 5 dB (30) | | |

### Cloned-voice language support (from 0.2)
| Language | Works? | Notes |
|---|---|---|
| hi-IN | | |
| kn-IN | | |
| ta-IN | | |

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

## Session log
| Time (IST) | What happened | Commit |
|---|---|---|
| 2026-11-08 | Planning complete; repo + .venv initialized | (initial) |
