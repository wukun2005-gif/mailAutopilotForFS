#!/usr/bin/env node
/**
 * page-views — who opened the deck, from where, how often.
 *
 * Reads the deck_page_views log (service role only — nothing else in the
 * project can see it, which is the point of keeping addresses out of the
 * public API) and prints four blocks:
 *
 *   1  summary          loads, distinct addresses, distinct browsers, span
 *   2  by country       days → loads → addresses
 *   3  by day           the daily curve, with the country breakdown
 *   4  by address       every IP, how many times, first and last seen
 *
 * Usage:
 *   node scripts/page-views.mjs                     # everything, newest first
 *   node scripts/page-views.mjs --since 2026-10-08  # rows on or after that date
 *   node scripts/page-views.mjs --top 10            # only the 10 busiest addresses
 *   node scripts/page-views.mjs --json              # raw rows for piping
 *
 * Requires SUPABASE_PAT in the environment or in .env (never committed).
 * No network beyond the Supabase Management API; no writes.
 */

import { readFileSync } from 'node:fs';

const REF = 'ifiqhyzcklwueqsijtnq';
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

/* PAT comes from the environment first, then .env — .env keys are written
   with spaces around the =, so it is split by hand rather than parsed. */
const patFromDotEnv = (() => {
  try {
    const line = readFileSync('.env', 'utf8').split('\n').find((l) => /^\s*SUPABASE_PAT\s*=/.test(l));
    return line ? line.replace(/^\s*SUPABASE_PAT\s*=\s*/, '').trim() : '';
  } catch { return ''; }
})();
const PAT = process.env.SUPABASE_PAT || patFromDotEnv;
if (!PAT) {
  console.error('SUPABASE_PAT is not set (environment or .env).');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : fallback;
};
const since = flag('--since', null);
const top = Number(flag('--top', 0)) || 0;
const asJson = args.includes('--json');

/* Timestamps come back as UTC; the owner reads them in CST (+08), so every
   rendered time is shifted here rather than in SQL — one place, and the raw
   values stay unambiguous in --json. */
const TZ_OFFSET = 8 * 60 * 60 * 1000;
const cst = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return new Date(d.getTime() + TZ_OFFSET).toISOString().replace('T', ' ').slice(0, 19);
};
const day = (iso) => cst(iso).slice(0, 10);

async function sql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok || body.message) {
    console.error('query failed:', body.message ?? res.status);
    process.exit(1);
  }
  return body;
}

const where = since ? `where created_at >= '${since} 00:00:00+08'::timestamptz` : '';

const [rows, stats] = await Promise.all([
  sql(`select path, ip, country_code, country, client_id, user_agent, hdr, created_at
       from deck_page_views ${where} order by created_at desc limit 5000`),
  sql(`select count(*) as loads, count(distinct ip) as ips, count(distinct client_id) as browsers,
              min(created_at) as first_seen, max(created_at) as last_seen
       from deck_page_views ${where}`),
]);

const data = rows.map((r) => ({
  when: cst(r.created_at),
  day: day(r.created_at),
  ip: r.ip ?? '',
  country: r.country || r.country_code || '??',
  path: r.path ?? '',
  browser: r.client_id ? r.client_id.slice(0, 8) : '',
}));

if (asJson) {
  console.log(JSON.stringify({ summary: stats[0], rows: data }, null, 2));
  process.exit(0);
}

const s = stats[0] ?? {};
console.log('══ page views ═══════════════════════════════════════════════');
console.log(`  loads        ${s.loads ?? 0}`);
console.log(`  addresses    ${s.ips ?? 0}`);
console.log(`  browsers     ${s.browsers ?? 0}`);
console.log(`  first seen   ${cst(s.first_seen)}`);
console.log(`  last seen    ${cst(s.last_seen)}`);
if (since) console.log(`  window       since ${since} (CST)`);

const group = (keyFn, label) => {
  const m = new Map();
  for (const r of data) {
    const k = keyFn(r);
    const cur = m.get(k) ?? { key: k, loads: 0, ips: new Set(), browsers: new Set(), first: null, last: null };
    cur.loads++;
    if (r.ip) cur.ips.add(r.ip);
    if (r.browser) cur.browsers.add(r.browser);
    if (!cur.first || r.when < cur.first) cur.first = r.when;
    if (!cur.last || r.when > cur.last) cur.last = r.when;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.loads - a.loads || String(a.key).localeCompare(String(b.key)));
};

const block = (title, items, cols) => {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
  for (const it of items) {
    console.log('  ' + cols(it));
  }
};

block('by country', group((r) => r.country, 'country'), (g) =>
  `${g.key.padEnd(22)} ${String(g.loads).padStart(5)} loads  ${String(g.ips.size).padStart(4)} addr  ${g.first} → ${g.last}`);

block('by day', group((r) => r.day, 'day').sort((a, b) => String(b.key).localeCompare(String(a.key))), (g) =>
  `${String(g.key).padEnd(12)} ${String(g.loads).padStart(5)} loads  ${String(g.ips.size).padStart(4)} addr`);

const addresses = group((r) => r.ip || '(unknown)', 'ip');
block(`by address${top ? ` — top ${top}` : ''}`, top ? addresses.slice(0, top) : addresses, (g) =>
  `${g.key.padEnd(40)} ${String(g.loads).padStart(4)} ×  ${String(g.browsers.size).padStart(2)} browsers  ${g.first} → ${g.last}`);

const unknown = data.filter((r) => !r.ip).length;
if (unknown) console.log(`\n  note: ${unknown} row(s) have no address — check row.hdr to see which header was missing.`);
