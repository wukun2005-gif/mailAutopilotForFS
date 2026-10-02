// TTS narration must actually come out of the speakers: every clip in
// public/tts/manifest.json has to (1) be served, (2) decode with a real
// duration in the browser, and (3) play during a real demo run without the
// stale-caption fallback (`[demo] ... does not match the current caption` —
// the symptom of the earlier hash bug).
import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { readFileSync } from "node:fs";

test.setTimeout(240_000);
// Headless Chrome blocks play() without a gesture; the demo has no gesture.
test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

const manifest = JSON.parse(
  readFileSync(new URL("../../public/tts/manifest.json", import.meta.url), "utf8"),
) as Record<string, Record<string, string>>;

test("every clip is served and decodes with a real duration", async ({ page }) => {
  await page.goto("/");
  for (const lang of ["zh", "en"] as const) {
    const keys = Object.keys(manifest[lang] ?? {});
    expect(keys.length, `${lang} manifest is empty`).toBeGreaterThan(0);
    const results = await page.evaluate(async ({ lang, keys }) => {
      const out: { key: string; ok: boolean; why: string; dur: number; bytes: number }[] = [];
      const decode = async (key: string) => {
        const src = `/tts/${lang}/${key}.mp3`;
        try {
          const r = await fetch(src);
          if (!r.ok) return { key, ok: false, why: `http ${r.status}`, dur: 0, bytes: 0 };
          const bytes = (await r.arrayBuffer()).byteLength;
          if (!bytes) return { key, ok: false, why: "empty body", dur: 0, bytes };
          const dur = await new Promise<number>((resolve) => {
            const a = new Audio();
            const done = (v: number): void => resolve(v);
            a.addEventListener("loadedmetadata", () => done(a.duration), { once: true });
            a.addEventListener("error", () => done(NaN), { once: true });
            window.setTimeout(() => done(NaN), 5000);
            a.src = src;
          });
          return {
            key,
            ok: Number.isFinite(dur) && dur > 0,
            why: Number.isFinite(dur) && dur > 0 ? "" : "metadata never resolved",
            dur: Number.isFinite(dur) ? dur : 0,
            bytes,
          };
        } catch (err) {
          return { key, ok: false, why: String(err), dur: 0, bytes: 0 };
        }
      };
      // 8 at a time — 66 sequential round trips would dominate the test time.
      for (let i = 0; i < keys.length; i += 8) {
        out.push(...(await Promise.all(keys.slice(i, i + 8).map(decode))));
      }
      return out;
    }, { lang, keys });
    const bad = results.filter((r) => !r.ok);
    expect(
      bad,
      `${lang}: ${bad.length}/${results.length} clip(s) do not play: ` +
        bad.map((b) => `${b.key} (${b.why})`).join(", "),
    ).toEqual([]);
    expect(results.every((r) => r.dur > 0.2)).toBe(true);
  }
});

/** Wrap Audio so the run can prove clips fired `playing`, not just existed. */
function instrumentAudio(page: Page): void {
  void page.addInitScript(() => {
    const Native = window.Audio;
    const w = window as unknown as {
      __tts: { made: { src: string; played: boolean; error: boolean; dur: number }[] };
    };
    w.__tts = { made: [] };
    window.Audio = class extends Native {
      constructor(...args: ConstructorParameters<typeof Audio>) {
        super(...args);
        const rec = { src: "", played: false, error: false, dur: 0 };
        w.__tts.made.push(rec);
        this.addEventListener("loadedmetadata", () => (rec.dur = this.duration));
        this.addEventListener("playing", () => (rec.played = true));
        this.addEventListener("error", () => {
          // stop() drops src before load(); only real clip failures count.
          if (this.src.includes("/tts/")) rec.error = true;
        });
        new MutationObserver(() => {
          // stop() clears src on teardown — keep the last real value so the
          // post-run audit can still tell which clip this element was.
          const v = this.src;
          if (v) rec.src = v;
        }).observe(this, { attributes: true, attributeFilter: ["src"] });
      }
    };
  });
}

async function startScript(page: Page, id: string, lang: "zh" | "en") {
  const errors: string[] = [];
  const staleWarnings: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    const text = m.text();
    if (m.type() === "error") errors.push(text);
    if (text.includes("does not match the current caption")) staleWarnings.push(text);
  });
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  if (lang === "en") {
    await page.click("[data-id='top.lang']");
    await page.waitForTimeout(300);
  }
  await page.click("[data-id='top.demo']");
  await page.click(`[data-id='demo.script.${id}']`);
  await page.waitForSelector("[data-id='demo.bar']");
  await page.click("[data-id='demo.speed']");
  await page.click("[data-id='demo.speed']");
  expect(await page.locator("[data-id='demo.speed']").textContent()).toContain("4×");
  return { errors, staleWarnings };
}

async function runToDone(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector("[data-id='demo.bar']")?.getAttribute("data-status") === "done",
    { timeout: 200_000 },
  );
}

async function audioState(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __tts: { made: { src: string; played: boolean; error: boolean; dur: number }[] };
    };
    const clips = w.__tts.made.filter((m) => m.src.includes("/tts/"));
    const bgm = w.__tts.made.filter((m) => m.src.includes("bgm-trailer"));
    return {
      total: clips.length,
      played: clips.filter((c) => c.played).length,
      errors: clips.filter((c) => c.error).map((c) => c.src),
      silent: clips.filter((c) => !c.played && !c.error).map((c) => c.src),
      bgm: bgm.length,
      bgmPlayed: bgm.filter((c) => c.played).length,
    };
  });
}

for (const lang of ["zh", "en"] as const) {
  test(`${lang}: email3 demo voices every clip (no stale-caption fallback)`, async ({ page }) => {
    instrumentAudio(page);
    const { errors, staleWarnings } = await startScript(page, "email3", lang);
    await runToDone(page);
    const state = await audioState(page);
    expect(
      staleWarnings,
      "caption changed after generation — app falls back to caption-only",
    ).toEqual([]);
    expect(state.errors, "clip failed to load/play").toEqual([]);
    expect(state.silent, "clip created but never started playing").toEqual([]);
    expect(state.total, "no narration clips were even created").toBeGreaterThan(0);
    expect(state.played).toBe(state.total);
    // The background track must be heard, not just referenced: the file is
    // served from public/ and playback is not blocked in this run.
    expect(state.bgm, "bgm-trailer.mp3 element never created").toBeGreaterThan(0);
    expect(state.bgmPlayed, "BGM created but never started playing").toBe(state.bgm);
    expect(errors.filter((e) => !/Failed to load resource|msw/i.test(e))).toEqual([]);
  });
}

/**
 * The table caption must actually SHOW the table (2026-10-02 recording: beat
 * 18/35 said "下方这张表" while the chart filled the frame and the table sat
 * below the fold). The second beat now owns that line and scrolls to it.
 */
test("email2: the dispute-table caption scrolls the table into view", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.click("[data-id='demo.script.email2']");
  await page.waitForSelector("[data-id='demo.bar']");
  await page.evaluate(() =>
    (window as unknown as { __demoSeek: (a: string, b: number) => Promise<void> }).__demoSeek(
      "email2",
      19, // 2-18b — the new "下方这张表" beat (0-based index)
    ),
  );
  await expect(page.locator("[data-id='demo.bar']")).toHaveAttribute("data-beat", "19");
  // Language persists across tests in one worker — accept either locale.
  await expect(page.locator("div[class*='9998']")).toContainText(
    /下方这张表|table below lists every open dispute/i,
    { timeout: 8000 },
  );
  const box = await page.locator("[data-id='s3.clockboard.all']").boundingBox();
  expect(box, "disputes table is not rendered").not.toBeNull();
  const h = (await page.viewportSize())!.height;
  expect(box!.y, "table starts below the fold").toBeLessThan(h);
  expect(box!.y + box!.height, "table top is not even on screen").toBeGreaterThan(0);
});
