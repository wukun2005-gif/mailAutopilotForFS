#!/usr/bin/env python3
"""Audition English voices for the deck against the deck's own narration text.

Writes tts/candidates/<engine>-<tag>-<voice>.wav + .mp3, and prints a median-F0
estimate per voice. F0 is a cheap male/female tell used to shortlist candidates
before a human listens — it is not a quality judgement.

Engines:
  kokoro  Kokoro-82M (Apache-2.0), already in tts/.local/models/, the engine the
          demo narration uses. Voice names come from voices-v1.0.bin.
  melo    MeloTTS (MIT). Needs a model dir with config.json + checkpoint.pth.
          NOTE: every released MeloTTS English checkpoint is female-voiced
          (myshell-ai/MeloTTS#84 — "speaker_id 0..255, no male voice"). Kept
          here for the Chinese voice and for the record.

Usage:
  tts/.local/venv/bin/python tts/voice-candidates.py kokoro
  tts/.local/venv/bin/python tts/voice-candidates.py melo <model-dir> --tag EN-v3
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "tts" / "candidates"
MODELS = ROOT / "tts" / ".local" / "models"

# g2p_en POS-tags its input with nltk, which looks for its data at import time.
# Point it at the project-local copy before anything pulls nltk in.
os.environ.setdefault("NLTK_DATA", str(ROOT / "tts" / ".local" / "nltk_data"))

# Page 02/15 of the deck, verbatim. Real material, and it is dense with the
# numbers ("8,445", "50,000") where a mumbly voice shows.
DEFAULT_TEXT = (
    "Where we land first: of 8,445 insured US institutions, only the "
    "5-to-150-billion band could buy rather than build, 262 banks, on paper for "
    "now. Our worked example is Larkspur Bank: 18 billion, fictional, 1.1 million "
    "customers, a 420-seat contact center, 50,000 emails a month."
)

# Kokoro v1.0 American/British male voices. Grade in brackets is the quality
# grade from the Kokoro VOICES doc — a guide, not a verdict.
KOKORO_MALE = [
    "am_michael",   # B-
    "am_fenrir",    # C+
    "am_puck",      # C+
    "am_onyx",      # C
    "am_adam",      # C
    "am_eric",      # D
    "am_liam",      # D
    "am_echo",      # D
    "am_santa",     # D
    "bm_george",    # C
    "bm_fable",     # C
    "bm_lewis",     # D
    "bm_daniel",    # D
]


def stub_japanese_if_needed() -> bool:
    """Let `import melo.api` survive a missing unidic_lite. True if stubbed.

    melo/text/cleaner.py imports every language frontend eagerly and
    melo/text/english.py does `from .japanese import distribute_phone`, while
    japanese.py builds a MeCab tokenizer at module import. English never calls
    into it, so a stub carrying the one pure function is enough.
    """
    try:
        import unidic_lite  # noqa: F401
        return False
    except ModuleNotFoundError:
        pass

    jp = types.ModuleType("melo.text.japanese")

    def distribute_phone(n_phone: int, n_word: int):
        phones_per_word = [0] * n_word
        for _ in range(n_phone):
            fewest = min(phones_per_word)
            phones_per_word[phones_per_word.index(fewest)] += 1
        return phones_per_word

    def _disabled(*_a, **_k):
        raise RuntimeError("Japanese frontend disabled: unidic_lite is not installed")

    jp.distribute_phone = distribute_phone
    jp.text_normalize = _disabled
    jp.g2p = _disabled
    jp.get_bert_feature = _disabled
    sys.modules["melo.text.japanese"] = jp
    return True


def to_mp3(wav: Path, mp3: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found")
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav),
         "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", str(mp3)],
        check=True,
    )


def median_f0(wav: Path) -> float | None:
    """Median voiced F0 in Hz — ~85-155 male, ~165-255 female, roughly."""
    try:
        import librosa
        import numpy as np
    except ImportError:
        return None
    y, sr = librosa.load(str(wav), sr=None, mono=True)
    f0 = librosa.yin(y, fmin=60, fmax=450, sr=sr)
    voiced = f0[(f0 > 60) & (f0 < 450)]
    return float(np.median(voiced)) if voiced.size else None


def report(name: str, mp3: Path, wav: Path) -> None:
    f0 = median_f0(wav)
    f0_s = f"{f0:.0f} Hz" if f0 else "n/a"
    print(f"  {name:14s} -> {mp3.name:36s} {mp3.stat().st_size/1024:5.0f} KB  F0 {f0_s}")


def run_kokoro(text: str, speed: float, voices: list[str]) -> None:
    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro

    k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    for voice in voices:
        wav = OUT_DIR / f"kokoro-{voice}.wav"
        mp3 = wav.with_suffix(".mp3")
        samples, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
        sf.write(str(wav), samples.astype(np.float32), sr)
        to_mp3(wav, mp3)
        report(voice, mp3, wav)


def run_melo(text: str, speed: float, model_dir: Path, tag: str) -> None:
    if not (model_dir / "checkpoint.pth").exists():
        sys.exit(f"no checkpoint.pth in {model_dir}")
    print(f"unidic_lite: {'stubbed (absent)' if stub_japanese_if_needed() else 'present'}")

    from melo.api import TTS

    model = TTS(language="EN",
                config_path=str(model_dir / "config.json"),
                ckpt_path=str(model_dir / "checkpoint.pth"),
                device="cpu")
    print("speakers:", model.hps.data.spk2id)
    for name, sid in model.hps.data.spk2id.items():
        safe = name.replace("/", "_")
        wav = OUT_DIR / f"melotts-{tag}-{safe}.wav"
        mp3 = wav.with_suffix(".mp3")
        model.tts_to_file(text, sid, str(wav), speed=speed, quiet=True)
        to_mp3(wav, mp3)
        report(name, mp3, wav)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("engine", choices=["kokoro", "melo"])
    ap.add_argument("model_dir", nargs="?", help="melo only: dir with config.json + checkpoint.pth")
    ap.add_argument("--text", default=DEFAULT_TEXT)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--tag", default=None, help="melo only: output name tag")
    ap.add_argument("--voices", nargs="*", help="kokoro only: subset of voice names")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if args.engine == "kokoro":
        run_kokoro(args.text, args.speed, args.voices or KOKORO_MALE)
    else:
        if not args.model_dir:
            sys.exit("melo needs a model dir")
        model_dir = Path(args.model_dir).resolve()
        run_melo(args.text, args.speed, model_dir, args.tag or model_dir.name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
