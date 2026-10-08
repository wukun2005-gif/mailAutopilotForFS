#!/bin/zsh
# Check the browser-playable deck: index.html + only the assets it references.
# No build step, no server, no software — open index.html in any browser.
#
# deck-html/ is the source of truth now (there is no separate _html-source
# folder to copy from), so this verifies the package instead of rebuilding it.
# Exits non-zero if an asset the HTML references is missing.
set -e
ROOT=/Users/wukun/Documents/tmp/mailAutopilotForFS
SRC=$ROOT/deck-html

if [ ! -f "$SRC/index.html" ]; then
  echo "!! $SRC/index.html not found"
  exit 1
fi

MISSING=0
echo "=== referenced assets ==="
for f in $(grep -o 'assets/[a-z]*/[^"]*' "$SRC/index.html" | sort -u); do
  if [ -f "$SRC/$f" ]; then
    printf '  ok     %s\n' "$f"
  else
    printf '  MISS   %s\n' "$f"
    MISSING=1
  fi
done

echo
echo "=== shipped but unreferenced ==="
for f in $(cd "$SRC" && find assets -type f | sort); do
  grep -q "$f" "$SRC/index.html" || printf '  unused %s\n' "$f"
done

echo
if [ "$MISSING" -ne 0 ]; then
  echo "!! deck-html is incomplete — index.html references a missing asset"
  exit 1
fi

echo "=== deck-html package complete ==="
(cd "$SRC" && find . -type f | sed 's|^\./||' | sort)
echo
du -sh "$SRC"
