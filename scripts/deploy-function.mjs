#!/usr/bin/env node
/**
 * Deploys an Edge Function through the Management API, and prints enough before
 * and after to tell what actually landed.
 *
 * Why a script: the deploy is the one step in this repo that is irreversible and
 * customer-visible, and doing it by hand each time means nobody can say afterwards
 * which source is live. This prints the version before, the version after, and a
 * hash of the bytes it sent — so "the deployed code is the code in the working
 * tree" is checkable rather than assumed.
 *
 * The Management API hands the body back with the first line rewritten: its
 * "// " comes back as the bytes 95 90 and one ═ is dropped, so the readback is
 * always 4 bytes shorter than what was sent. Measured 2026-10-11 on all four
 * functions in this project, identically — it is the readback, not the
 * deployed code, which the live function proved by returning fields only the
 * new source can produce. So the check compares lines 2+ exactly and reports
 * line 1 rather than asserting it; see the readback block below.
 *
 * Usage:
 *   SUPABASE_PAT=... node scripts/deploy-function.mjs answer-comment
 *   SUPABASE_PAT=... node scripts/deploy-function.mjs answer-comment --dry   # show the diff, deploy nothing
 *
 * The PAT is never embedded: pass it in the environment, or keep it in .env
 * (gitignored) — this reads .env as a fallback for convenience only.
 */

import './net-proxy.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const REF = 'ifiqhyzcklwueqsijtnq';
/* What the API's rewritten first line starts with — see the header. */
const MANGLED_HEAD = Buffer.from([0x95, 0x90]);

function readEnvPat() {
  for (const p of ['.env', '../.env']) {
    if (!existsSync(p)) continue;
    const line = readFileSync(p, 'utf8').split('\n').find((l) => /^\s*SUPABASE_PAT\s*=/.test(l));
    if (line) return line.replace(/^\s*SUPABASE_PAT\s*=\s*/, '').trim();
  }
  return null;
}

const PAT = process.env.SUPABASE_PAT || readEnvPat();
if (!PAT) {
  console.error('no SUPABASE_PAT — pass it in the env (or put it in .env)');
  process.exit(2);
}

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const DRY = args.includes('--dry');
if (!slug) {
  console.error('usage: node scripts/deploy-function.mjs <slug> [--dry]');
  process.exit(2);
}

const SRC = `supabase/functions/${slug}/index.ts`;
if (!existsSync(SRC)) {
  console.error(`no such function source: ${SRC}`);
  process.exit(2);
}
const source = readFileSync(SRC, 'utf8');
const hash = createHash('sha256').update(source).digest('hex').slice(0, 16);

const api = (path) => `https://api.supabase.com/v1/projects/${REF}/functions${path}`;
const auth = { Authorization: `Bearer ${PAT}` };

const before = await (await fetch(api(`/${slug}`), { headers: auth })).json();
if (!before.slug) {
  console.error(`could not read function '${slug}': ${JSON.stringify(before).slice(0, 300)}`);
  process.exit(1);
}

console.log(`═══ ${slug} ═══`);
console.log(`  source     ${SRC}  ${source.length} bytes  sha256:${hash}`);
console.log(`  live now   version ${before.version}  status ${before.status}`);

/* What is live right now, so the deploy has a baseline to be judged against.
   Line 1 is dropped for the same reason the readback check drops it: the API
   rewrites it, so it can never be equal and would make this redeploy every run. */
const liveBuf = Buffer.from(await (await fetch(api(`/${slug}/body`), { headers: auth })).arrayBuffer());
const belowFirstLine = (b) => Buffer.from(b.toString('latin1').split('\n').slice(1).join('\n'), 'latin1');
const sentBuf = Buffer.from(source, 'utf8');
if (belowFirstLine(liveBuf).equals(belowFirstLine(sentBuf))) {
  console.log('  → the working tree already matches what is deployed; nothing to do.');
  process.exit(0);
}
console.log(`  live source ${liveBuf.length} bytes — differs from the working tree`);

if (DRY) {
  /* Split as bytes so lines line up, then decode each line as UTF-8 for
     display — latin1 would print every em dash and ═ as mojibake. Line 1 is
     skipped: the API rewrites it, so it always shows up and always means
     nothing. */
  const a = liveBuf.toString('latin1').split('\n').map((l) => Buffer.from(l, 'latin1').toString('utf8'));
  const b = source.split('\n');
  let shown = 0, n = 0;
  for (let i = 1; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    n++;
    if (shown++ < 12) {
      console.log(`\n  line ${i + 1}`);
      console.log(`    live  ${JSON.stringify(a[i] ?? '<none>')}`);
      console.log(`    local ${JSON.stringify(b[i] ?? '<none>')}`);
    }
  }
  if (n > shown) console.log(`\n  …and ${n - shown} more differing line(s).`);
  console.log(`  line 1 not shown — the API rewrites it on readback (see the header).`);
  console.log(`\n  ${n} differing line(s) from line 2 on. --dry: nothing deployed.`);
  process.exit(0);
}

const res = await fetch(api(`/${slug}`), {
  method: 'PATCH',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug, name: before.name || slug, body: source, verify_jwt: before.verify_jwt ?? true }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`\n✗ deploy failed: HTTP ${res.status}\n${text.slice(0, 800)}`);
  process.exit(1);
}

const after = JSON.parse(text);
console.log(`\n  deployed   version ${after.version ?? '?'}  status ${after.status ?? '?'}`);

/* Read it back: a 200 is not evidence that the source that landed is the source
   we sent, and the readback mangles the first line (see the header), so a
   whole-body comparison reports a failure that is not one.

   Compared as bytes, not as text: the readback's 95 90 is not valid UTF-8, so
   decoding to a string turns it into U+FFFD and there is no way back to the
   original bytes to repair.

   Lines 2+ are compared exactly. Line 1 is reported, not asserted: the API
   rewrites it the same way for every function in this project (measured on all
   four, 2026-10-11), and a rule that has to be re-derived each time it fires is
   not a check. */
const readBuf = Buffer.from(await (await fetch(api(`/${slug}/body`), { headers: auth })).arrayBuffer());
const same = belowFirstLine(readBuf).equals(belowFirstLine(sentBuf));
console.log(same
  ? `  verified   lines 2+ match the file we sent byte-for-byte (${source.length} bytes, sha256:${hash})` +
    `\n             ${readBuf.subarray(0, 2).equals(MANGLED_HEAD)
        ? 'line 1 came back rewritten — known API behaviour, not a deploy failure'
        : 'note: line 1 also differs, check it by hand'}`
  : `  ✗ MISMATCH live is ${readBuf.length} bytes, we sent ${Buffer.byteLength(source)} — investigate before trusting it`);
process.exit(same ? 0 : 1);
