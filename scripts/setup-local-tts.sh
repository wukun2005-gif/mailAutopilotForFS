#!/usr/bin/env bash
# One-time setup for the local, offline TTS stack (edge-tts is gone: its
# Microsoft voices carry no licence for a published deck).
#   tts/.local/venv      python 3.11 + piper (MIT) + kokoro-onnx (MIT)
#   tts/.local/models/   Piper voices (MIT), Kokoro models (Apache-2.0)
# After this, both build scripts run with no network at all.
# Usage: bash scripts/setup-local-tts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
LOCAL=tts/.local
VENV="$LOCAL/venv"
MODELS="$LOCAL/models"
mkdir -p "$MODELS"

if [ ! -x "$VENV/bin/python" ]; then
  if command -v uv >/dev/null 2>&1; then
    uv venv --python 3.11 "$VENV"
    uv pip install --python "$VENV/bin/python" \
      piper-tts "onnxruntime==1.19.2" "numpy==2.0.2" colorlog espeakng-loader \
      "phonemizer-fork==3.3.1" "numba==0.60.0" "llvmlite==0.43.0" librosa \
      soundfile
    uv pip install --python "$VENV/bin/python" --no-deps kokoro-onnx==0.3.9
  elif command -v python3.11 >/dev/null 2>&1; then
    python3.11 -m venv "$VENV"
    "$VENV/bin/pip" install -q piper-tts "onnxruntime==1.19.2" "numpy==2.0.2" \
      colorlog espeakng-loader "phonemizer-fork==3.3.1" "numba==0.60.0" \
      "llvmlite==0.43.0" librosa soundfile
    "$VENV/bin/pip" install -q --no-deps kokoro-onnx==0.3.9
  else
    echo "need uv or python3.11 to build the local TTS venv" >&2
    exit 1
  fi
  # kokoro-onnx feeds the input named "tokens"; the published models call it
  # "input_ids", so the one line that builds the feed dict is rewritten here.
  sed -i '' 's/tokens=tokens, style=voice/input_ids=tokens, style=voice/' \
    "$VENV"/lib/python*/site-packages/kokoro_onnx/__init__.py
fi

fetch() { # <url> <dest>
  if [ ! -s "$2" ]; then
    echo "fetch $(basename "$2")"
    curl -fL --retry 3 --max-time 900 -o "$2" "$1"
  fi
}
PIPER=https://huggingface.co/rhasspy/piper-voices/resolve/main
KOKORO=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1
fetch "$PIPER/en/en_US/ryan/high/en_US-ryan-high.onnx"       "$MODELS/en_US-ryan-high.onnx"
fetch "$PIPER/en/en_US/ryan/high/en_US-ryan-high.onnx.json"  "$MODELS/en_US-ryan-high.onnx.json"
fetch "$PIPER/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx"      "$MODELS/zh_CN-huayan-medium.onnx"
fetch "$PIPER/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json" "$MODELS/zh_CN-huayan-medium.onnx.json"
fetch "$KOKORO/kokoro-v1.0.onnx"       "$MODELS/kokoro-v1.0.onnx"
fetch "$KOKORO/voices-v1.0.bin"        "$MODELS/voices-v1.0.bin"

"$VENV/bin/python" - <<'PY'
from piper import PiperVoice
from kokoro_onnx import Kokoro
PiperVoice.load("tts/.local/models/en_US-ryan-high.onnx")
PiperVoice.load("tts/.local/models/zh_CN-huayan-medium.onnx")
Kokoro("tts/.local/models/kokoro-v1.0.onnx", "tts/.local/models/voices-v1.0.bin")
print("local TTS ready: Piper (MIT) + Kokoro (Apache-2.0), offline")
PY
