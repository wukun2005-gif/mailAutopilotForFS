#!/bin/sh
# Check the browser-playable deck: index.html + only the assets it references.
# No build step, no server, no software — open index.html in any browser.
#
# deck-html/ is the source of truth now (there is no separate _html-source
# folder to copy from), so this verifies the package instead of rebuilding it.
# Exits non-zero if an asset the deck references is missing.
#
# This is the static half of the deck check. Its sibling
# scripts/check-html-deck.mjs drives the deck in a real browser instead
# (thumbnail rail, navigation, lightbox) — run both after a deck change.
# Renamed from build-html-deck.sh: the old name promised a build it never did.
#
# The referenced set has two sources, and both are needed:
#   1. complete quoted paths in index.html — e.g. src="assets/shots/x.jpg" or
#      data-src="assets/clips/y.mp4" (the player sets img/video .src from
#      dataset at runtime, so those live in attributes, not in a fetch call).
#   2. the clip names in assets/voice/present.json. The narration player builds
#      those URLs as 'assets/voice/' + st.clip, so no clip path is ever written
#      out literally in the HTML.
#
# Two earlier bugs this guards against, both of which made the check useless:
#   - an unanchored `grep -o 'assets/[a-z]*/[^"]*'` matched JS fragments and
#     prose ("assets/voice/'+c;", "assets/voice/present.json,", "built", "from")
#     and reported them as missing assets — a dozen false MISSes that buried any
#     real one;
#   - because clips are built at runtime, all 41 narration mp3s were reported as
#     "shipped but unreferenced" — 41 more false positives.
set -e
ROOT=/Users/wukun/Documents/tmp/mailAutopilotForFS
SRC=${1:-$ROOT/deck-html}

if [ ! -f "$SRC/index.html" ]; then
  echo "!! $SRC/index.html not found"
  exit 1
fi

python3 - "$SRC" <<'PY'
import json, pathlib, re, sys

src = pathlib.Path(sys.argv[1])
html = (src / "index.html").read_text(encoding="utf-8")

# Only complete quoted literals count. An asset path is a whole string, so
# require the closing quote immediately after a known extension — that is what
# rejects "assets/voice/'+c" and "assets/voice/present.json," style fragments.
EXT = r"png|jpe?g|gif|svg|webp|mp3|wav|mp4|json|js|css"
static = set(re.findall(rf"""["'](assets/[^"']+\.(?:{EXT}))["']""", html))

# Narration clips, resolved through the player's own config.
clips = set()
pj = src / "assets" / "voice" / "present.json"
if pj.is_file():
    conf = json.loads(pj.read_text(encoding="utf-8"))
    clips = {f"assets/voice/{s['clip']}" for v in conf.values() for s in v}

referenced = static | clips
missing = sorted(p for p in referenced if not (src / p).is_file())
on_disk = {p.relative_to(src).as_posix()
           for p in (src / "assets").rglob("*") if p.is_file()}
unused = sorted(on_disk - referenced)

print("=== referenced assets ===")
for p in sorted(static):
    print(f"  {'ok  ' if (src / p).is_file() else 'MISS'} {p}")

print("=== narration clips (via present.json) ===")
if clips:
    bad = [p for p in sorted(clips) if not (src / p).is_file()]
    print(f"  ok   {len(clips) - len(bad)}/{len(clips)} present")
    for p in bad:
        print(f"  MISS {p}")
else:
    print("  none configured")

if unused:
    print()
    print("=== shipped but unreferenced ===")
    for p in unused:
        print(f"  unused {p}")

print()
if missing:
    print(f"!! deck-html is incomplete — {len(missing)} referenced asset(s) missing:")
    for p in missing:
        print(f"     {p}")
    sys.exit(1)

print("=== deck-html package complete ===")
for p in sorted(on_disk):
    print(p)
print(f"\n{len(on_disk)} files under assets/")
PY

echo
du -sh "$SRC"
