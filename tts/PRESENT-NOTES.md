# One-click present — cross-AI notes (2026-10-05, local only, do not push)

## Voice (locked by user)
- `en-US-EricNeural`, rate `-5%` — standard American, no announcer tone.
- Set in `scripts/build-present-voice.sh`: `VOICE=` / `VOICE_RATE=` (env `PV_VOICE`/`PV_RATE` also works).
- `-15%` was tried and sounds aged on Eric; keep `-5%` unless the user says otherwise.

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
