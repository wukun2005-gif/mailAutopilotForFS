#!/usr/bin/env bash
# Ensure the local offline TTS env, then generate narration transcripts + audio.
# Usage: bash tts/generate.sh [--force] [--transcript-only] [--lang en|zh]
set -euo pipefail
cd "$(dirname "$0")/.."
VENV=tts/.local/venv
if [ ! -x "$VENV/bin/python" ]; then
  bash scripts/setup-local-tts.sh
fi
exec "$VENV/bin/python" tts/generate.py "$@"
