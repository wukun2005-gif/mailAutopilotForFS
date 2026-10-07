#!/usr/bin/env bash
# Rebuild one-click-present voice assets from tts/deck-voiceover.en.md:
#   deck-html/assets/voice/pNNbM.mp3  narration clips (VOICE/VOICE_RATE below)
#   deck-html/assets/voice/present.json + present.js  step config for the player
# Voice is a build-time setting: voiceover text stays voice-agnostic.
# Usage: bash scripts/build-present-voice.sh
#   PV_VOICE / PV_RATE env overrides work too, without editing this file.
VOICE="en-US-EricNeural"
VOICE_RATE="-5%"
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
VENV=tts/.venv
if [ "${1:-}" = "--conf-only" ]; then
  echo "conf-only: skipping TTS (clips unchanged)"
else
if [ ! -x "$VENV/bin/python" ]; then python3 -m venv "$VENV"; fi
"$VENV/bin/pip" install -q --disable-pip-version-check edge-tts
PV_VOICE="$VOICE" PV_RATE="$VOICE_RATE" "$VENV/bin/python" - <<'PY'
import asyncio, edge_tts, os, pathlib
PV_VOICE = os.environ.get("PV_VOICE", "en-US-EricNeural")
PV_RATE = os.environ.get("PV_RATE", "-15%")
async def one(p):
    out = f"deck-html/assets/voice/{p.name[:-4]}"
    for _ in range(3):
        try:
            await edge_tts.Communicate(p.read_text().strip(), PV_VOICE, rate=PV_RATE, pitch="+0Hz").save(out)
            print("ok", out)
            return
        except Exception as e:
            print("retry", p.name, e)
            await asyncio.sleep(2)
    raise SystemExit(f"FAIL {p.name}")
async def run():
    sem = asyncio.Semaphore(4)
    async def w(p):
        async with sem:
            await one(p)
    await asyncio.gather(*[w(p) for p in sorted(pathlib.Path('/tmp/voice_src').glob('*.txt'))])
asyncio.run(run())
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
