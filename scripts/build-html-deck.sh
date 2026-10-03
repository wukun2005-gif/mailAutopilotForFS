#!/bin/zsh
# Package the browser-playable deck: index.html + only the assets it references.
# No build step, no server, no software — open index.html in any browser.
#
# NON-DESTRUCTIVE: never rm -rf the output. If the existing index.html differs
# from the source it is backed up first, so a hand-edit in the output folder can
# always be recovered.
set -e
ROOT=/Users/wukun/Documents/tmp/mailAutopilotForFS
SRC=$ROOT/deck/_html-source
OUT=$ROOT/deck-html
BAK=$ROOT/.backups

mkdir -p "$OUT/assets/shots" "$OUT/assets/clips" "$BAK"

# back up a hand-edited copy before we touch it
if [ -f "$OUT/index.html" ] && ! cmp -s "$OUT/index.html" "$SRC/index.html"; then
  STAMP=$(date +%Y%m%d-%H%M%S)
  cp -p "$OUT/index.html" "$BAK/deck-html-index.$STAMP.html"
  echo "!! deck-html/index.html differed from source — backed up to .backups/deck-html-index.$STAMP.html"
fi

cp "$SRC/index.html" "$OUT/index.html"

# copy only what the HTML actually references
for f in $(grep -o 'assets/shots/[^"]*' "$SRC/index.html" | sort -u); do
  cp "$SRC/$f" "$OUT/$f"
done
for f in $(grep -o 'assets/clips/[^"]*' "$SRC/index.html" | sort -u); do
  cp "$SRC/$f" "$OUT/$f"
done

echo "=== deck-html built ==="
find "$OUT" -type f | sed "s|$OUT/||" | sort
echo
du -sh "$OUT"
