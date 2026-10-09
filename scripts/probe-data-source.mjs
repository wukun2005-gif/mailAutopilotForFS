#!/usr/bin/env node
/**
 * Captures the comment data requests a deck page actually makes, so "where do
 * these comments come from" is answered by the network log rather than by
 * reading the config and reasoning about it.
 *
 * Usage: node scripts/_netsniff.mjs <url> [url2 ...]
 */

import { chromium } from 'playwright';

const urls = process.argv.slice(2).filter((a) => a.startsWith('http'));
if (!urls.length) { console.error('pass one or more urls'); process.exit(2); }

const browser = await chromium.launch({ headless: true, channel: 'chrome' });

for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const seen = [];
  const errors = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/supabase\.co/.test(u)) seen.push({ m: r.method(), u });
  });
  page.on('requestfailed', (r) => { if (/supabase\.co/.test(r.url())) errors.push(r.url()); });

  let cfg = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForTimeout(4000);
    cfg = await page.evaluate(() => {
      const c = window.DECK_COMMENT_CONFIG || {};
      return { supabaseUrl: c.supabaseUrl || null, deckId: c.deckId || null };
    });
  } catch (e) {
    console.log(`\n${url}\n  ! load failed: ${e.message.split('\n')[0]}`);
    await page.close();
    continue;
  }

  console.log(`\n${url}`);
  console.log(`  页面里的 config:  supabaseUrl = ${cfg.supabaseUrl}`);
  console.log(`                    deckId      = ${cfg.deckId}`);
  const rest = seen.filter((s) => /rest\/v1/.test(s.u));
  console.log(`  浏览器实际发出的数据请求（${rest.length} 条）:`);
  for (const r of rest.slice(0, 4)) console.log(`    ${r.m} ${r.u}`);
  if (errors.length) console.log(`  ! 失败的请求: ${errors.length}`);
  const uniqHost = [...new Set(seen.map((s) => new URL(s.u).host))];
  console.log(`  涉及的主机:      ${uniqHost.join(', ') || '(none)'}`);
  await page.close();
}

await browser.close();
