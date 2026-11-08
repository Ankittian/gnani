"""Phase 7.3 — generate synthetic customer voice orders (Timbre v3.0) + shop-noise variants.

Output (committed, small): public/fixtures/samples/*.mp3 — all synthetic, no real people/data.
Noise is synthesized (traffic rumble + chatter-like modulated noise + occasional clatter) at a target SNR.

Run:  .venv\\Scripts\\python scripts\\make_fixtures.py
Needs ffmpeg? No — we mix in numpy on 16 kHz WAV and re-request MP3 only for clean takes;
noisy files are written as WAV-in-mp3-extension? No: noisy takes are written as .wav and the
sample list points at the right extension (see SAMPLES below).
"""

from __future__ import annotations

import io
import os
import sys
import time
import wave
from pathlib import Path

import numpy as np
import requests
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fixtures" / "samples"
OUT.mkdir(parents=True, exist_ok=True)
load_dotenv(ROOT / ".env")
KEY = os.environ["GNANI_API_KEY"]
BASE = os.environ.get("GNANI_BASE_URL", "https://api.vachana.ai").rstrip("/")
H = {"X-API-Key-ID": KEY, "Content-Type": "application/json"}
SR = 16000
rng = np.random.default_rng(7)

ORDERS = {
    "hi": ("hi-IN", "Devansh", "नमस्ते भैया, मैं मीना बोल रही हूँ। दो किलो चावल, एक किलो चीनी, एक पैकेट मैगी और दो पारले जी भेज देना। शाम छह बजे के बाद घर पर पहुँचा देना।"),
    "kn": ("kn-IN", "Lakshmi", "ನಮಸ್ಕಾರ ಅಣ್ಣ, ನಾನು ಸುಮಾ ಮಾತಾಡ್ತಿದ್ದೀನಿ. ಐದು ಕೆಜಿ ಅಕ್ಕಿ, ಎರಡು ಪ್ಯಾಕೆಟ್ ಹಾಲು, ಒಂದು ಕೆಜಿ ಸಕ್ಕರೆ ಕಳಿಸಿ."),
    "ta": ("ta-IN", "Lakshmi", "வணக்கம் அண்ணா, நான் கவிதா பேசுகிறேன். இரண்டு கிலோ சர்க்கரை, ஒரு எண்ணெய் பாக்கெட் மற்றும் மூன்று பிரட் அனுப்புங்கள்."),
    "hinglish-long": ("hi-en", "Shubham", "Hello bhaiya, main Meena bol rahi hoon. Mujhe do kilo chawal, ek kilo sugar, teen packet Maggi, do Parle-G, ek Surf Excel, ek Tata namak aur ek litre Fortune tel chahiye. Aur haan, agar Amul doodh ke do packet ho toh woh bhi bhej dena. Shaam ko chhe baje ke baad ghar pe de dena, main ghar pe rahungi. Paise main kal de dungi, khate mein likh lena."),
}


def tts_wav(text: str, lang: str, voice: str) -> np.ndarray:
    body = {
        "text": text, "model": "timbre-v3.0", "voice": voice, "language": lang, "speed": 1.0,
        "audio_config": {"sample_rate": SR, "num_channels": 1, "sample_width": 2, "encoding": "linear_pcm", "container": "wav"}}
    for attempt in range(4):
        try:
            r = requests.post(f"{BASE}/api/v1/tts/inference", headers=H, timeout=90, json=body)
            break
        except requests.exceptions.ConnectionError:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    r.raise_for_status()
    b = r.content
    pcm = b[b.find(b"data") + 8:]  # Gnani WAV headers have a streaming length
    return np.frombuffer(pcm[: len(pcm) // 2 * 2], dtype="<i2").astype(np.float32) / 32768.0


def shop_noise(n: int) -> np.ndarray:
    t = np.arange(n) / SR
    white = rng.standard_normal(n).astype(np.float32)
    # traffic rumble: low-passed noise (cheap moving-average filter)
    k = 200
    rumble = np.convolve(white, np.ones(k) / k, mode="same") * 18
    # chatter: band-ish noise amplitude-modulated at syllable rate
    k2 = 12
    band = white - np.convolve(white, np.ones(k2) / k2, mode="same")
    chatter = band * (0.5 + 0.5 * np.sin(2 * np.pi * 3.7 * t + rng.uniform(0, 6))) ** 2
    # clatter: random short bursts
    clat = np.zeros(n, dtype=np.float32)
    for _ in range(max(1, n // (SR * 2))):
        i = int(rng.integers(0, max(1, n - 800)))
        clat[i:i + 800] += rng.standard_normal(min(800, n - i)).astype(np.float32) * np.hanning(min(800, n - i)) * 2
    return rumble + chatter * 0.8 + clat


def mix(speech: np.ndarray, snr_db: float) -> np.ndarray:
    noise = shop_noise(len(speech))
    ps, pn = np.mean(speech ** 2) + 1e-9, np.mean(noise ** 2) + 1e-9
    noise *= np.sqrt(ps / (pn * 10 ** (snr_db / 10)))
    out = speech + noise
    return out / max(1.0, np.max(np.abs(out)) / 0.95)


def write_wav(path: Path, x: np.ndarray) -> None:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
    path.write_bytes(buf.getvalue())


def main() -> None:
    manifest = []
    for key, (lang, voice, text) in ORDERS.items():
        print(f"TTS {key} ({lang}, {voice}) …")
        speech = tts_wav(text, lang, voice)
        clean = OUT / f"order-{key}.wav"
        write_wav(clean, speech)
        manifest.append((clean.name, len(speech) / SR, "clean"))
        if key in ("hi", "kn"):
            noisy = OUT / f"order-{key}-noisy.wav"
            write_wav(noisy, mix(speech, 5.0))
            manifest.append((noisy.name, len(speech) / SR, "snr5dB"))
    for name, dur, kind in manifest:
        print(f"  {name:<28} {dur:5.1f}s  {kind}  {(OUT / name).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
