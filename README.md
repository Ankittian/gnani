# Dukaan Dost 🛒🎙️

A voice-first assistant for kirana stores. The shopkeeper speaks in any of 10 Indian languages (or code-mixed Hinglish), and Dukaan Dost keeps the udhaar khata, tracks stock, sends reminders and distributor orders as voice notes, turns noisy customer voice orders into packing lists, and reads out the day's hisaab.

Built for the **Gnani Great Indian AI Internship Challenge** on:
- **Gnani Prisma v3.0** — speech-to-text (auto language detection, code-mixing, per-shop `keyterms` biasing)
- **Gnani Timbre v3.0** — text-to-speech (one assistant voice across all 10 languages)
- **Gnani Voice Clone** — reminders in the shopkeeper's own voice
- **Google Gemini** — understanding commands and composing messages

## Docs
- PRD / spec: [.planning/specs/dukaan-dost.md](.planning/specs/dukaan-dost.md)
- Implementation plan: [.planning/plans/dukaan-dost.md](.planning/plans/dukaan-dost.md)
- Progress tracker: [PROGRESS.md](PROGRESS.md)

## Setup
```powershell
cp .env.example .env.local      # add GNANI_API_KEY and GEMINI_API_KEY
npm install
npm run dev

# Python scripts (API smoke tests, fixture generation, eval)
python -m venv .venv
.venv\Scripts\python -m pip install -r scripts\requirements.txt
.venv\Scripts\python scripts\smoke_gnani.py
```

Data rule: synthetic data only (no real phone numbers, Aadhaar, PAN or recorded calls).
