"""Phase 0.2 — Gnani API smoke test.

Verifies TTS (timbre-v3.0), STT (prisma-v3.0) and voice cloning end to end with
synthetic text only. Writes audio to scripts/out/ and prints status + latency.

Run:  .venv\\Scripts\\python scripts\\smoke_gnani.py
"""

from __future__ import annotations

import io
import json
import os
import sys
import time
import wave
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")  # Windows console + Indic text
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts" / "out"
OUT.mkdir(parents=True, exist_ok=True)
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local", override=True)

KEY = os.environ.get("GNANI_API_KEY", "").strip()
BASE = os.environ.get("GNANI_BASE_URL", "https://api.vachana.ai").rstrip("/")
if not KEY:
    sys.exit("GNANI_API_KEY missing in .env / .env.local")

H = {"X-API-Key-ID": KEY}
results: list[dict] = []


def log(name: str, resp: requests.Response, t0: float, extra: str = "") -> None:
    ms = int((time.perf_counter() - t0) * 1000)
    ok = resp.status_code == 200
    body = "" if ok else resp.text[:300]
    results.append({"step": name, "status": resp.status_code, "ms": ms, "extra": extra, "error": body})
    print(f"[{'OK ' if ok else 'ERR'}] {name:<34} {resp.status_code}  {ms:>5} ms  {extra} {body}")


def tts(text: str, lang: str, voice: str = "Lakshmi", container: str = "wav", sr: int = 16000) -> bytes | None:
    t0 = time.perf_counter()
    r = requests.post(
        f"{BASE}/api/v1/tts/inference",
        headers={**H, "Content-Type": "application/json"},
        json={
            "text": text,
            "model": "timbre-v3.0",
            "voice": voice,
            "language": lang,
            "speed": 1.0,
            "audio_config": {"sample_rate": sr, "num_channels": 1, "sample_width": 2,
                             "encoding": "linear_pcm", "container": container},
        },
        timeout=60,
    )
    log(f"TTS {lang} {voice} {container}", r, t0, f"{len(r.content)} bytes ct={r.headers.get('content-type')}")
    return r.content if r.status_code == 200 else None


def stt(audio: bytes, filename: str, language_code: str, fmt: str = "transcribe", keyterms: list[str] | None = None) -> dict | None:
    t0 = time.perf_counter()
    data = {"model": "prisma-v3.0", "language_code": language_code, "format": fmt}
    if keyterms:
        data["keyterms"] = json.dumps(keyterms, ensure_ascii=False)
    r = requests.post(f"{BASE}/stt/v3", headers=H, files={"audio_file": (filename, audio)}, data=data, timeout=60)
    j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    log(f"STT {language_code} {fmt}", r, t0, json.dumps({k: j.get(k) for k in ("transcript", "detected_language_code", "processing_time")}, ensure_ascii=False))
    return j if r.status_code == 200 else None


def wav_pcm(b: bytes) -> tuple[bytes, int]:
    """Gnani WAVs carry a streaming header (data size 0xFFFFFFFF) — read PCM after the 'data' tag."""
    sr = int.from_bytes(b[24:28], "little")
    i = b.find(b"data")
    return b[i + 8:], sr


def wav_duration(b: bytes) -> float:
    pcm, sr = wav_pcm(b)
    return len(pcm) / (sr * 2)


def concat_wavs(parts: list[bytes]) -> bytes:
    pcm = b""
    sr = 16000
    for p in parts:
        chunk, sr = wav_pcm(p)
        pcm += chunk
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm)
    return buf.getvalue()


def main() -> None:
    print(f"Base URL: {BASE}\n")

    # 1. TTS in several languages (synthetic kirana sentences)
    samples = {
        "hi-IN": "शर्मा जी ने दो किलो चावल और एक सर्फ लिया, तीन सौ चालीस रुपये उधार लिख दो।",
        "kn-IN": "ನಮಸ್ಕಾರ, ಐದು ಕೆಜಿ ಅಕ್ಕಿ ಮತ್ತು ಎರಡು ಪ್ಯಾಕೆಟ್ ಹಾಲು ಬೇಕು.",
        "ta-IN": "வணக்கம், இரண்டு கிலோ சர்க்கரை மற்றும் ஒரு எண்ணெய் பாக்கெட் வேண்டும்.",
        "hi-en": "Sharma ji ka total balance twelve hundred forty rupees hai.",
    }
    audio: dict[str, bytes] = {}
    for lang, text in samples.items():
        cached = OUT / f"tts_{lang}.wav"
        b = cached.read_bytes() if cached.exists() else tts(text, lang)
        if b:
            cached.write_bytes(b)
            audio[lang] = b
            print(f"      {lang} duration {wav_duration(b):.1f}s, chars {len(text)}")

    mp3_path = OUT / "tts_hi-IN.mp3"
    mp3 = mp3_path.read_bytes() if mp3_path.exists() else tts(samples["hi-IN"], "hi-IN", container="mp3", sr=22050)
    if mp3:
        mp3_path.write_bytes(mp3)

    # 2. STT round-trip
    if "--clone-only" in sys.argv:
        audio_for_stt = {}
    else:
        audio_for_stt = audio
    if "hi-IN" in audio_for_stt:
        stt(audio["hi-IN"], "speech.wav", "indic-auto", keyterms=["Sharma ji", "Surf", "chawal"])
        stt(audio["hi-IN"], "speech.wav", "hi-IN,en-IN", fmt="transcribe")
        stt(audio["hi-IN"], "speech.wav", "hi-IN", fmt="codemix")
    if "kn-IN" in audio_for_stt:
        stt(audio["kn-IN"], "speech.wav", "indic-auto", fmt="verbatim")
    if "ta-IN" in audio_for_stt:
        stt(audio["ta-IN"], "speech.wav", "indic-auto", fmt="verbatim")
    if mp3 and audio_for_stt:
        stt(mp3, "speech.mp3", "indic-auto")
    # .webm should be rejected (confirms extension-based detection)
    if "hi-IN" in audio_for_stt:
        stt(audio["hi-IN"], "speech.webm", "hi-IN")

    # 3. Voice clone: build a >=8 s reference from synthetic TTS (no real person's voice)
    if len(audio) >= 2:
        ref = concat_wavs([audio["hi-IN"], audio.get("hi-en", audio["hi-IN"])])
        print(f"      clone reference duration {wav_duration(ref):.1f}s")
        t0 = time.perf_counter()
        r = requests.post(f"{BASE}/api/v1/tts/voice-clone/embeddings", headers=H,
                          files={"audio_file": ("ref.wav", ref, "audio/wav")}, timeout=60)
        log("CLONE embeddings", r, t0, f"keys={list(r.json().keys()) if r.ok else ''}")
        if r.ok:
            j = r.json()
            emb = (j.get("data") or {}).get("voice_clone_embedding") or j.get("voice_clone_embedding") or {}
            (OUT / "clone_embedding.json").write_text(json.dumps(j))
            print(f"      embedding shape={emb.get('shape')} dtype={emb.get('dtype')} len={len(str(emb.get('embedding', '')))} keys={list(emb.keys())}")
            texts = [("hi-IN", "शर्मा जी, आपके बारह सौ चालीस रुपये बाकी हैं।"),
                     ("kn-IN", "ಶರ್ಮಾ ಅವರೇ, ನಿಮ್ಮ ಸಾವಿರದ ಇನ್ನೂರು ರೂಪಾಯಿ ಬಾಕಿ ಇದೆ."),
                     ("ta-IN", "சர்மா அவர்களே, உங்கள் ஆயிரத்து இருநூறு ரூபாய் நிலுவையில் உள்ளது.")]
            for model in ("vachana-vc-v1",):
                for lang, text in texts:
                    body = {"text": text, "model": model, "language": lang, "speaker_embedding": emb,
                            "audio_config": {"sample_rate": 22050, "num_channels": 1, "sample_width": 2,
                                             "encoding": "linear_pcm", "container": "mp3"}}
                    t0 = time.perf_counter()
                    rr = requests.post(f"{BASE}/api/v1/tts/inference", headers={**H, "Content-Type": "application/json"}, json=body, timeout=60)
                    log(f"CLONE-TTS {model} {lang}", rr, t0, f"{len(rr.content)} bytes")
                    if rr.ok:
                        (OUT / f"clone_{model}_{lang}.mp3").write_bytes(rr.content)
                    if not rr.ok and lang == "hi-IN":
                        break  # model not usable with embeddings; skip remaining langs

    (OUT / "smoke_results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved results → {OUT / 'smoke_results.json'}")


if __name__ == "__main__":
    main()
