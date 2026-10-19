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
- The tour's scope is written in **two places that must move together**: the voiceover
  md's page headings, and the player's last-voiced-page constant plus the
  `outside 02–xx` comments (`pvStepGo`, `pvStartPage`, `pvBegin`). A colophon whose
  key is missing from `present.json` goes silent with no error, so a renumbered deck
  fails quietly — check both sides whenever pages move.

## 2026-10-18 · pages 07/08 swapped; demo page now 07/09 "User experience", onboarding 08/09
- User experience (with the inline demo-1 film) and onboarding changed places.
  Eyebrows, colophons and the md headings were renumbered; player keys follow the
  colophons, so no scope change was needed on the player side.
- Clips moved with their pages, no re-synthesis: `p08b1–3` (user experience) are now
  `p07b1–3`; the onboarding clips came back from HEAD as `p08b1–4`; the unused
  `p07b4.mp3` was deleted. Only the 07/08 clips differ from HEAD.
- Film steps now carry the clip name: the md marker `[fullscreen demo-1, ...]` is
  parsed into `"film": "demo-1"` and `pvPlayFilm` looks that name up (`st.film`),
  falling back to demo-2 when absent. Before this, demo-2 was hardcoded, so the
  simplified demo page had no film an auto-present could play.

## 2026-10-19 · About me cover, page 01 unvoiced

- The deck opens on **01 / 10 · About me**, a personal page with two ski photos.
  It carries no narration.
- The title is now **02** and is also unvoiced; the tour opens on it for 2.4 s
  and then advances to the first voiced page.
- Voiced colophons are **03/10–10/10**. `present.json` keys moved 02→03 … 09→10;
  clip filenames still read `p02…p09` because they keep their original audio.
- Source headings in `tts/deck-voiceover.en.md` follow the same numbering, so a
  future rebuild will emit `p03…p10` clips.

## 2026-10-15 (third pass) · all nine mainline pages voiced — scope is 02/09–09/09
- 07/09 Onboarding and 09/09 How we would know now carry narration: 4 clips each
  (`p07b1–4`, `p09b1–4`), written against the current slide text. The 02/09 and
  06/09 headings in the md follow the rewritten h2s (`Mid-size banks are the
  beachhead.`, `The Policy RIL Matrix governs autonomy.`).
- `bash scripts/build-present-voice.sh` re-synthesised the full set; the clips for
  02–06 and 08 were then restored byte-for-byte from the pre-run copy, so the diff
  carries only the new pages. Kokoro on this CPU is byte-nondeterministic run to
  run (same text and voice, tiny float differences — equal sizes do not mean
  equal bytes).
- Player comments in `deck-html/index.html` now read `02/09–09/09` and
  `outside the voiced pages (02–09)`. The silent-page step-over in `pvStepGo`
  stays: no mainline page is silent today, but a reorder can still create one.

## 2026-10-15 (later) · nine numbered pages — scope is 02/09–06/09 · 08/09
- Onboarding joins the mainline as **07/09** and How we would know as **09/09**,
  both still unvoiced (the tour steps over silent pages); Key experiences moves
  07/09 → 08/09, so its heading in `tts/deck-voiceover.en.md` is now `## 08/09`.
- `present.json` / `present.js`: key `07` → `08`; clips renamed `p07b*.mp3` →
  `p08b*.mp3` (no re-synthesis — the narration text did not change).
- The scope comments in `deck-html/index.html` now read
  `02/09–06/09 · 08/09` and `outside the voiced pages (02–06, 08)`.
- When 07/09 and 09/09 get narration: add their pages to the md and run
  `bash scripts/build-present-voice.sh`.

## 2026-10-15 · scope follows the mainline to 02/09–07/09
- The mainline is now title + colophon pages **02/09 through 07/09** (six voiced pages);
  the old 02/15–14/15 set pointed at pages that moved into the backup block, so the
  tour played the wrong clip on 04–07.
- Rewrote `tts/deck-voiceover.en.md` against the current slide text (L0 is gone,
  the pipeline is five steps, the demo page has four films) and rebuilt all clips:
  **20 clips across 6 pages**, Kokoro `am_michael` @ 1.15.
- Clips for pages 08–14 were deleted from `deck-html/assets/voice/` — nothing
  references them any more.

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
