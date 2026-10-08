#!/usr/bin/env bash
# Rebuild one-click-present voice assets from tts/deck-voiceover.en.md:
#   deck-html/assets/voice/pNNbM.mp3  narration clips (VOICE_NAME/VOICE_SPEED below)
#   deck-html/assets/voice/present.json + present.js  step config for the player
# Voice is a build-time setting: voiceover text stays voice-agnostic.
# Engine: Kokoro-82M (Apache-2.0) — synthesised offline, no network call at build
# time. One-time setup: bash scripts/setup-local-tts.sh
# Usage: bash scripts/build-present-voice.sh
#   PV_VOICE / PV_SPEED env overrides work too, without editing this file.
# Was Piper en_US-joe-medium; swapped 2026-10-08 for am_michael — Piper sat at
# ~95 Hz, which read as old, and Kokoro is the engine the demo narration already
# uses. MeloTTS was ruled out first: every released English checkpoint is
# female-voiced (myshell-ai/MeloTTS#84).
VOICE_NAME="am_michael"     # Kokoro voice id (voices-v1.0.bin)
VOICE_SPEED="1.15"          # Kokoro speed, picked by ear off tts/candidates/ ladder.
                            # NB Kokoro's speed is NOT a linear time-stretch (0.95 -> 1.13
                            # only bought 10.9%), so never extrapolate a target from it.
KOKORO_MODEL="tts/.local/models/kokoro-v1.0.onnx"
KOKORO_VOICES="tts/.local/models/voices-v1.0.bin"
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p deck-html/assets/voice /tmp/voice_src
python3 - <<'PY'
import re, json, pathlib
ONES = ("zero one two three four five six seven eight nine ten eleven twelve "
        "thirteen fourteen fifteen sixteen seventeen eighteen nineteen").split()
TENS = {20: "twenty", 30: "thirty", 40: "forty", 50: "fifty",
        60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety"}
def int_words(n):
    assert 0 <= n < 1000000000
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10 * 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + int_words(n % 100))
    if n < 1000000:
        return int_words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + int_words(n % 1000))
    return int_words(n // 1000000) + " million" + ("" if n % 1000000 == 0 else " " + int_words(n % 1000000))
def num_words(tok):
    tok = tok.replace(",", "")
    if "." in tok:
        ip, fp = tok.split(".")
        return int_words(int(ip)) + " point " + " ".join(ONES[int(d)] for d in fp)
    return int_words(int(tok))
def say_year(tok):
    y = int(tok)
    hi, lo = y // 100, y % 100
    return int_words(hi) + (" hundred" if lo == 0 else " " + (ONES[lo] if lo < 20 else int_words(lo)))
def speak(t):
    # "CCaaS" gets letter-spelled C-C-A-A-S; user locked the reading /siːˈæs/
    t = re.sub(r'\bCCaaS\b', 'see ass', t)
    # dollars: $1.50 -> one point five zero dollars; 268k -> ... thousand
    def money(m):
        n, suf = m.group(1), (m.group(2) or "").lower()
        w = num_words(n)
        return w + (" thousand dollars" if suf == "k" else " million dollars" if suf == "m" else " dollars")
    t = re.sub(r'\$([0-9,]+(?:\.[0-9]+)?)([kKmM])?\b', money, t)
    t = re.sub(r'([0-9,]+(?:\.[0-9]+)?)%', lambda m: num_words(m.group(1)) + " percent", t)
    t = re.sub(r'\b([0-9][0-9,]*(?:\.[0-9]+)?)[kK]\b', lambda m: num_words(m.group(1)) + " thousand", t)
    t = re.sub(r'\b([RBIWLQ])(\d{1,3})\b', lambda m: m.group(1) + " " + int_words(int(m.group(2))), t)
    t = re.sub(r'\b(20\d{2})\b', lambda m: say_year(m.group(1)), t)
    t = re.sub(r'\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b', lambda m: num_words(m.group(0)), t)
    # Yunyang (zh voice) reads a lone "0" as Chinese "ling" — spell it out
    t = re.sub(r'\b[Dd]ay 0\b', 'Day zero', t)
    return t
text = open('tts/deck-voiceover.en.md').read()
# Page count is read from the heading, not hardcoded: the deck grew a page and
# the old "/14" literal silently produced zero pages.
pages = re.split(r'^## (\d+)/\d+ · (.+?)$', text, flags=re.M)
conf = {}
for k in range(1, len(pages), 3):
    num, body = pages[k], pages[k + 2]
    script = body.split('Script:')[1].split('Captions:')[0]
    bullets = re.findall(r'^- (.+)$', script, flags=re.M)
    caps = re.findall(r'^- (.+)$', body.split('Captions:')[1].split('Actions:')[0], flags=re.M)
    assert len(bullets) == len(caps), f"page {num}: {len(bullets)} bullets vs {len(caps)} captions"
    steps = []
    for bi, (b, c) in enumerate(zip(bullets, caps)):
        shots = re.findall(r'\[open ([^\]]+)\]', b)
        video = bool(re.search(r'\[fullscreen ([^\]]+)\]', b))
        clean = re.sub(r'\s+', ' ', re.sub(r'\[[^\]]+\]', '', b)).strip()
        say = speak(clean)
        fn = f"p{num}b{bi + 1}.mp3"
        open(f"/tmp/voice_src/{fn}.txt", 'w').write(say)
        # on-screen caption = this bullet's narration text verbatim (markers
        # stripped), so caption and voice never drift; the short Captions list
        # in the md stays as the one-line summary
        steps.append({"clip": fn, "caption": clean, "shots": shots, "video": video})
    conf[num] = steps
json.dump(conf, open('/tmp/voice_conf.json', 'w'), ensure_ascii=False, indent=1)
print("pages:", len(conf), "clips:", sum(len(v) for v in conf.values()))
PY
PYBIN=tts/.local/venv/bin/python
if [ "${1:-}" = "--conf-only" ]; then
  echo "conf-only: skipping TTS (clips unchanged)"
else
if [ ! -x "$PYBIN" ] || [ ! -f "$KOKORO_MODEL" ] || [ ! -f "$KOKORO_VOICES" ]; then
  echo "local TTS not set up — run: bash scripts/setup-local-tts.sh" >&2
  exit 1
fi
PV_VOICE="$VOICE_NAME" PV_SPEED="$VOICE_SPEED" \
PV_KOKORO_MODEL="$KOKORO_MODEL" PV_KOKORO_VOICES="$KOKORO_VOICES" "$PYBIN" - <<'PY'
import io, os, pathlib, shutil, subprocess
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    raise SystemExit("ffmpeg not found — it writes the mp3 clips")
# One session covers every clip: this Mac has no GPU and parallel sessions only
# thrash the cores.
kokoro = Kokoro(os.environ["PV_KOKORO_MODEL"], os.environ["PV_KOKORO_VOICES"])
voice = os.environ["PV_VOICE"]
speed = float(os.environ.get("PV_SPEED", "1.15"))
out_dir = pathlib.Path("deck-html/assets/voice")
for p in sorted(pathlib.Path("/tmp/voice_src").glob("*.txt")):
    stem = p.name[:-len(".txt")]            # "p02b1.mp3.txt" -> "p02b1.mp3"
    samples, sr = kokoro.create(p.read_text().strip(), voice=voice, speed=speed,
                                lang="en-us")
    # Pipe the wav to ffmpeg rather than dropping a temp file next to the
    # published clips: a crash part-way used to leave a stray .wav in assets/voice.
    buf = io.BytesIO()
    sf.write(buf, samples.astype(np.float32), sr, format="WAV")
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", "pipe:0",
                    "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1",
                    str(out_dir / stem)], input=buf.getvalue(), check=True)
    print("ok", out_dir / stem)
PY
fi
python3 - <<'PY'
import json
conf = json.load(open('/tmp/voice_conf.json'))
for num, steps in conf.items():
    for s in steps:
        assert s["caption"].count("\n") == 0, f"caption must be one line: {s['clip']}"
json.dump(conf, open('deck-html/assets/voice/present.json', 'w'), ensure_ascii=False, indent=1)
open('deck-html/assets/voice/present.js', 'w').write('var pvPresentData = ' + json.dumps(conf, ensure_ascii=False) + ';\n')
print("wrote present.json + present.js")
PY
