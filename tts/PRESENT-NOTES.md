# One-click present — cross-AI notes (started 2026-10-05)

## Voice (locked by user)
- Kokoro `am_michael` (Apache-2.0 model, MIT inference lib — no licence strings attached).
- Set in `scripts/build-present-voice.sh`: `VOICE_NAME=` / `VOICE_SPEED=` (env `PV_VOICE`/`PV_SPEED` also works).
- `VOICE_SPEED` is Kokoro's speed multiplier, and it is **not** a linear time-stretch
  (0.95 → 1.13 bought only 10.9%). 1.15 was picked by ear off `tts/candidates/`;
  0.95 ran ~19% longer than the old Piper pace, 1.15 lands ~5% over it.
- Swapped 2026-10-08 from Piper `en_US-joe-medium`, which sat at ~95 Hz and read as old.
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

## Voice re-audition (2026-10-08)
- **MeloTTS is a dead end for an English male voice.** Every released English
  checkpoint is female-voiced. Measured median F0: v1 EN-US 239 / EN-BR 236 /
  EN_INDIA 297 / EN-AU 188 / EN-Default 178 Hz; v2 EN-US 259 / EN-BR 236 Hz;
  v3 `EN-Newest` 206 Hz (v3 has exactly one speaker). Upstream confirms it —
  myshell-ai/MeloTTS#84: "speaker_id 0..255, no male voice".
  Same estimator, for scale: `us-C-Eric.mp3` 104 Hz, Piper joe 84 Hz,
  Kokoro `zf_xiaoxiao` 224 Hz.
- MeloTTS v1/v2/v3 English checkpoints are under `tts/.local/models/melo-en-*`
  (208 MB each, MIT). Only worth keeping if the Chinese voice is needed.
- MeloTTS licence: MIT on code *and* weights (HF `license: mit`), commercial use
  OK. Caveat: the voice-source data is undisclosed, so it is MyShell's
  declaration, not an auditable chain — same class of claim as Kokoro.
- Two MeloTTS traps, both verified: (1) its number normaliser turns
  `5-to-150-billion` into "five-tominus one hundred fifty-billion" — pre-expanding
  digits (what `speak()` already does) avoids it; (2) `melo/text/japanese.py:570`
  builds a MeCab tokenizer at import time and `english.py` borrows
  `distribute_phone` from that module, so deleting `unidic_lite` breaks
  `import melo.api` for EN *and* ZH.
- Male candidate set: `tts/voice-candidates.py` (`kokoro` | `melo`) writes
  `tts/candidates/kokoro-*.{wav,mp3}`. Kokoro male F0 — am_michael 113,
  am_puck 110, am_adam 118, am_echo 108, am_onyx 87, am_liam 127, am_fenrir 133,
  am_eric 153, am_santa 151, bm_lewis 100, bm_fable 119, bm_daniel 122,
  bm_george 135 Hz. Closest to the Eric reference (104 Hz) *and* best Kokoro
  grade: **am_michael**.
- `g2p_en` needs nltk POS data; it is project-local in `tts/.local/nltk_data`
  (`NLTK_DATA` is set inside the script, `~/nltk_data` is left alone).
- 2026-10-08: deck voice swapped Piper → `am_michael` and all 41 clips rebuilt; these
  changes are uncommitted at time of writing.
