#!/usr/bin/env node
/**
 * Unit checks for the prompt answer-comment builds.
 *
 * Why it exists: the language rule was a generic "answer in the comment's
 * language" sentence and the model still drifted — over 52 questions on
 * 2026-10-08, three English questions got Chinese answers, every one of them
 * grounded in the Chinese research report. The fix states the language outright,
 * computed from the comment in code (commentScript). That computation and the
 * sentence it produces are what this file pins down.
 *
 * How: the real index.ts is transpiled with esbuild and imported with a Deno
 * stub, so the assertions run against the shipped source, not a copy of it.
 * Nothing here calls the network.
 *
 * Usage:  node scripts/check-answer-prompt.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const SRC = 'supabase/functions/answer-comment/index.ts';

let failed = 0;
const check = (name, ok, extra = '') => {
  ok ? process.stdout.write(`  PASS  ${name}\n`)
     : (failed++, process.stdout.write(`  FAIL  ${name}${extra ? '\n        ' + extra : ''}\n`));
};

/* ── load the shipped module ──────────────────────────────────────────── */
const ts = readFileSync(SRC, 'utf8') + '\nexport { commentScript, buildMessages };\n';
const js = (await esbuild.transform(ts, { loader: 'ts', format: 'esm', target: 'esnext' })).code;

globalThis.Deno = {
  serve: () => {},
  env: { get: () => undefined, set: () => {}, delete: () => {} },
};

const dir = join(tmpdir(), 'answer-prompt-check');
mkdirSync(dir, { recursive: true });
const file = join(dir, 'index.mjs');
writeFileSync(file, js);

let mod;
try {
  mod = await import(pathToFileURL(file).href);
} catch (e) {
  console.error('could not import the transpiled function: ' + e.message);
  process.exit(1);
}
const { commentScript, buildMessages } = mod;
if (typeof commentScript !== 'function' || typeof buildMessages !== 'function') {
  console.error('commentScript / buildMessages are not exported from ' + SRC);
  process.exit(1);
}

/* ── 1. which script is the comment in ────────────────────────────────── */
console.log('── 1 · commentScript ──');
const scriptCases = [
  ['a plain English question', 'Where does the receipt timestamp come from?', 'English'],
  ['English with a clause reference', 'Does Reg E 1005.11(b)(1) apply to the 45-day clock?', 'English'],
  ['a plain Chinese question', '退费窗口按工作日还是日历日计算？', 'Chinese'],
  ['Chinese with Latin product terms', 'R×I×L 三维放权矩阵如何决定自主度？', 'Chinese'],
  ['Chinese with an English slug', 'four-groups 这页讲的四个群体分别是谁？', 'Chinese'],
  /* the case a ratio threshold gets wrong: the English product names outweigh
     the Han characters, but the question is plainly Chinese */
  ['Chinese whose product names are English', 'Talkdesk 的 core-bank execution 是什么意思？', 'Chinese'],
  ['a short Chinese question', '几点？', 'Chinese'],
  ['English that quotes one Chinese word', 'What does the 术语表 section actually define?', 'English'],
  ['English that names a Chinese character', 'Is the word 表 used anywhere in the PRD reference material?', 'English'],
  ['digits and punctuation only', '1005.11 — 45 ?', null],
  ['emoji only', '🎉 🚀', null],
  ['empty', '', null],
  ['whitespace only', '   \n  ', null],
];
for (const [label, input, want] of scriptCases) {
  const got = commentScript(input);
  check(label, got === want, `want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
}
/* the floor is what keeps Chinese questions with English product names working —
   guard it so a later tweak cannot quietly raise it back into ratio-only */
check('three Han characters alone are enough',
  commentScript('术语表？') === 'Chinese', JSON.stringify(commentScript('术语表？')));
check('three Han characters inside a long English sentence are not',
  commentScript('Could you point me at the 术语表 section of the research report please?') === 'English',
  JSON.stringify(commentScript('Could you point me at the 术语表 section of the research report please?')));

/* ── 2. the sentence that actually reaches the model ──────────────────── */
console.log('\n── 2 · buildMessages ──');
const hits = [
  { label: 'Research Report', section: '01 零基础概念扫盲 · 术语表', page_key: null, body: '退费窗口按工作日计算。' },
  { label: 'Case Study Deck', section: 'The clock starts at the inbox.', page_key: 'the-clock-starts-at-the-inbox', body: 'The clock starts when the bank receives the mail.' },
];
const sys = (comment) => buildMessages({
  comment, author: 'Reviewer', pageTitle: 'The clock starts at the inbox.', quote: null, hits,
})[0].content;

const en = sys('Where does that receipt timestamp come from, and how would we prove it to an examiner?');
const zh = sys('退费窗口按工作日还是日历日计算？');
const noLetters = sys('1005.11?');

check('an English question is told to answer in English',
  en.includes('The comment is written in English. Write the whole answer in English.'), en.split('\n').slice(-3).join(' | '));
check('a Chinese question is told to answer in Chinese',
  zh.includes('The comment is written in Chinese. Write the whole answer in Chinese.'), zh.split('\n').slice(-3).join(' | '));
check('and it names the failure mode: the material is mixed',
  en.includes('part English and part Chinese') && zh.includes('part English and part Chinese'));
check('and it says which one wins',
  /answer in the comment's language, never in the material's/.test(en));
check('a comment with no letters falls back to the generic rule',
  noLetters.includes('Answer in the same language the comment is written in.') &&
  !noLetters.includes('is written in English') && !noLetters.includes('is written in Chinese'),
  noLetters.split('\n').slice(-3).join(' | '));
check('product terms stay in English in every case',
  [en, zh, noLetters].every((s) => s.includes('Keep product terms, clause references and slide titles in their original English form.')));

/* the rest of the prompt must survive the edit */
check('the reference material is still inlined', en.includes('Research Report — 01 零基础概念扫盲 · 术语表'));
check('with the deck page attached', en.includes('(deck page: the-clock-starts-at-the-inbox)'));
check('the citation rules are intact',
  en.includes('Cite the sources you use inline as [1], [2]') && en.includes('only cite a number that really supports the claim'));
check('the honesty rule is intact', en.includes('If it does not cover the question, say so plainly'));
check('the language section still exists once', (en.match(/## Language/g) || []).length === 1);

const msgs = buildMessages({
  comment: 'Where does the clock start?', author: 'Dana', pageTitle: 'The clock starts at the inbox.',
  quote: 'the clock starts at the inbox', hits,
});
check('two messages: system then user', msgs.length === 2 && msgs[0].role === 'system' && msgs[1].role === 'user');
check('the user turn carries the slide, the quote and the comment',
  msgs[1].content.includes('Slide: The clock starts at the inbox.') &&
  msgs[1].content.includes('Phrase the comment is attached to: "the clock starts at the inbox"') &&
  msgs[1].content.includes('Reviewer (Dana) wrote: Where does the clock start?'));
check('no reference material is announced as missing',
  !msgs[0].content.includes('no matching material was retrieved'));

const empty = buildMessages({ comment: 'hi', author: 'x', pageTitle: 'p', quote: null, hits: [] })[0].content;
check('with no hits it says so instead of inventing',
  empty.includes('(no matching material was retrieved'));

console.log(failed ? `\n${failed} FAILED\n` : '\nall good\n');
process.exit(failed ? 1 : 0);
