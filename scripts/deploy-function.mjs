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
 * The Management API prepends a BOM to the body it hands back, so the readback
 * comparison strips one before comparing. That is the only accepted difference.
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
const STRIP_BOM = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

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

/* What is live right now, so the deploy has a baseline to be judged against. */
const liveBody = await (await fetch(api(`/${slug}/body`), { headers: auth })).text();
const live = STRIP_BOM(liveBody);
if (live === source) {
  console.log('  → the working tree already matches what is deployed; nothing to do.');
  process.exit(0);
}
console.log(`  live source ${live.length} bytes — differs from the working tree`);

if (DRY) {
  const a = live.split('\n');
  const b = source.split('\n');
  let shown = 0, n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    n++;
    if (shown++ < 12) {
      console.log(`\n  line ${i + 1}`);
      console.log(`    live  ${JSON.stringify(a[i] ?? '<none>')}`);
      console.log(`    local ${JSON.stringify(b[i] ?? '<none>')}`);
    }
  }
  console.log(`\n  ${n} differing line(s). --dry: nothing deployed.`);
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
   we sent, and the BOM makes a naive comparison look like a failure. */
const readback = STRIP_BOM(await (await fetch(api(`/${slug}/body`), { headers: auth })).text());
const same = readback === source;
console.log(same
  ? `  verified   the live source is byte-for-byte the file we sent (${source.length} bytes, sha256:${hash})`
  : `  ✗ MISMATCH live is ${readback.length} bytes, we sent ${source.length} — investigate before trusting it`);
process.exit(same ? 0 : 1);
