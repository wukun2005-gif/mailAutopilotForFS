/* ══════════════════════════════════════════════════════════════════════════
   Comments backend — fill in the two blanks below and the comments panel
   switches from local-only (this browser) to shared (everyone).

   Where to find them: Supabase dashboard → Project Settings → API
     · Project URL          → supabaseUrl
     · Project API keys     → anon / public  → supabaseAnonKey

   The anon key is meant to be public: row-level security in schema.sql is
   what decides what a visitor may do, not the key. Never put the
   service_role key in this file.
   ══════════════════════════════════════════════════════════════════════════ */
window.DECK_COMMENT_CONFIG = {
  supabaseUrl: 'https://ifiqhyzcklwueqsijtnq.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmaXFoeXpja2x3dWVxc2lqdG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjUzNTIsImV4cCI6MjEwNzAwMTM1Mn0.bScn3NqBHTIPG3JFEtFAoG1EPEf4hkqavpVAysTa2FM',

  /* separates this deck's comments from any other deck on the same project */
  deckId: 'mail-autopilot-fs',

  /* used in the reply-notification email so the reader lands back on the deck */
  deckUrl: 'https://wukun2005-gif.github.io/mailAutopilotForFS/deck-html/',

  /* how often to re-fetch when the realtime socket is unavailable (ms) */
  pollMs: 8000,

  /* ── legal notice ──
     Shown before anybody can post: once as a panel-wide notice they must
     acknowledge, then as a one-line reminder above the composer (Terms
     re-opens the full text).

     contactEmail is the address a reader writes to for deletion.
     disclaimer: null keeps the built-in English wording below; set it to an
     array of strings to replace it wholesale (one string = one line). */
  contactEmail: 'wukun2005@gmail.com',
  disclaimer: null
  /* example override:
  disclaimer: [
    'Comments are visible to everyone who has this link.',
    'The author may remove any comment at any time.',
    'Comments are collected only for this case study.',
    'This is a personal case study; it represents no company position.'
  ] */
};
