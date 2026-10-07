#!/usr/bin/env bash
# Rebuild one-click-present voice assets from tts/deck-voiceover.en.md:
#   deck-html/assets/voice/pNNbM.mp3  narration clips (VOICE_MODEL/VOICE_SPEED below)
#   deck-html/assets/voice/present.json + present.js  step config for the player
# Voice is a build-time setting: voiceover text stays voice-agnostic.
# Engine: Piper (MIT licence, en_US-ryan-high model, MIT) — synthesised offline,
# no network call at build time. One-time setup: bash scripts/setup-local-tts.sh
# Usage: bash scripts/build-present-voice.sh
#   PV_MODEL / PV_SPEED env overrides work too, without editing this file.
VOICE_MODEL="tts/.local/models/en_US-joe-medium.onnx"
VOICE_SPEED="1.05"   # Piper length_scale: 1.05 reads ~5% slower, the old -5% rate
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
if [ ! -x "$PYBIN" ] || [ ! -f "$VOICE_MODEL" ]; then
  echo "local TTS not set up — run: bash scripts/setup-local-tts.sh" >&2
  exit 1
fi
PV_MODEL="$VOICE_MODEL" PV_SPEED="$VOICE_SPEED" "$PYBIN" - <<'PY'
import os, pathlib, shutil, subprocess, wave
from piper import PiperVoice
from piper.config import SynthesisConfig
ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    raise SystemExit("ffmpeg not found — it writes the mp3 clips")
voice = PiperVoice.load(os.environ["PV_MODEL"])   # one load covers every clip
cfg = SynthesisConfig(length_scale=float(os.environ.get("PV_SPEED", "1.05")))
out_dir = pathlib.Path("deck-html/assets/voice")
for p in sorted(pathlib.Path("/tmp/voice_src").glob("*.txt")):
    stem = p.name[:-len(".txt")]            # "p02b1.mp3.txt" -> "p02b1.mp3"
    wav = out_dir / (stem[:-len(".mp3")] + ".wav")
    with wave.open(str(wav), "wb") as w:
        voice.synthesize_wav(p.read_text().strip(), w, syn_config=cfg)
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav),
                    "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1",
                    str(out_dir / stem)], check=True)
    wav.unlink()
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
