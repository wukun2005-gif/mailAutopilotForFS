# One-click present — cross-AI notes (2026-10-05, local only, do not push)

## Voice (locked by user)
- Piper `en_US-ryan-high` (MIT, offline, no network at build time) — standard American male.
- Set in `scripts/build-present-voice.sh`: `VOICE_MODEL=` / `VOICE_SPEED=` (env `PV_MODEL`/`PV_SPEED` also works).
- `VOICE_SPEED` is Piper's length_scale: 1.05 reads ~5% slower.
- Engine/models installed once by `bash scripts/setup-local-tts.sh` into `tts/.local/` (gitignored).

## Voiceover text stays voice-agnostic
- Do NOT hand-spell numbers in `tts/deck-voiceover.en.md` (no "Day zero", no "six hundred thousand").
- The build's `speak()` converts every digit run to English words for TTS input only.
  Captions keep digits (they are display text).
- Rules the build asserts: bullets == captions count per page; every caption is one line.

## After editing the voiceover md, run
`bash scripts/build-present-voice.sh`
regenerates `deck-html/assets/voice/*.mp3` + `present.json`/`present.js`.
(`--conf-only` rebuilds config without TTS.)

## Player ownership
- The `pv*` block (CSS `#pbar`, bar HTML, JS player) in `deck-html/index.html` belongs
  to the present feature — do not reformat/remove; slide keys come from colophons.
- Do not commit or push anything: user wants local-only until review is done.
