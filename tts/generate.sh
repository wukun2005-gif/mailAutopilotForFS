#!/usr/bin/env bash
# Ensure a local venv with edge-tts, then generate narration transcripts + audio.
# Usage: bash tts/generate.sh [--force] [--transcript-only]
set -euo pipefail
cd "$(dirname "$0")/.."
VENV=tts/.venv
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q --disable-pip-version-check edge-tts
exec "$VENV/bin/python" tts/generate.py "$@"
