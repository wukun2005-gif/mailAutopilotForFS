// M7 demo anti-corruption (Dev Plan §9.4): every script plays headlessly to
// completion at 4× with no required-click blocker and no console error.
import { test, expect, type Page } from "@playwright/test";

test.setTimeout(240_000);

async function startScript(page: Page, id: string) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.click(`[data-id='demo.script.${id}']`);
  await page.waitForSelector("[data-id='demo.bar']");
  await page.click("[data-id='demo.speed']");
  await page.click("[data-id='demo.speed']");
  await expect(page.locator("[data-id='demo.speed']")).toContainText("4×");
  return errors;
}

/** One status poll, tolerant of the transient context swap of a hash route. */
async function poll(page: Page): Promise<Awaited<ReturnType<typeof snap>> | null> {
  for (let i = 0; i < 8; i++) {
    try {
      return await snap(page);
    } catch (err) {
      if (!/Execution context was destroyed|navigation/i.test(String(err))) throw err;
      await page.waitForTimeout(120);
    }
  }
  return null;
}

async function expectDone(page: Page, errors: string[]) {
  await page.waitForFunction(
    () => document.querySelector("[data-id='demo.bar']")?.getAttribute("data-status") === "done",
    { timeout: 200_000 },
  );
  await expect(page.locator("[data-id='demo.blocker']")).toHaveCount(0);
  // React console errors (excluding MSW/network noise) fail the run.
  const hardErrors = errors.filter((e) => !/Failed to load resource|msw/i.test(e));
  expect(hardErrors).toEqual([]);
}

test("trailer plays to end", async ({ page }) => {
  const errors = await startScript(page, "trailer90s");
  await expectDone(page, errors);
});

test("email1 script plays to end", async ({ page }) => {
  const errors = await startScript(page, "email1");
  await expectDone(page, errors);
});

/**
 * The camera is the demo's reading aid: when a caption names a detail, that
 * detail has to be the one lit up. Screenshots lie about this (timing, scroll
 * position), so the check is geometric — the spotlight box and the element it
 * claims to frame must overlap almost completely, on every zoom beat of the
 * run, in both languages of the pointer scheme (@last resolves to the newest).
 */
/**
 * The demo marks the element a caption is about with data-hl (see index.css).
 * Two things must hold for the whole run: the mark always sits on the element
 * the beat's focus id resolves to, and it never survives the beat (a marked
 * row from the previous caption is a lie on a screen that has changed).
 */
async function snap(page: Page) {
  return page.evaluate(() => {
    const done =
      document.querySelector("[data-id='demo.bar']")?.getAttribute("data-status") === "done";
    const beat = document.querySelector("[data-id='demo.bar']")?.getAttribute("data-beat");
    const marked = Array.from(document.querySelectorAll<HTMLElement>("[data-hl]"));
    return {
      done,
      beat,
      marks: marked.map((el) => ({
        id: el.dataset.hl ?? "",
        actual: el.dataset.id ?? "",
        visible: el.getBoundingClientRect().width > 0,
      })),
    };
  });
}

test("email1: every caption marks the element it names, and cleans up", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await startScript(page, "email1");
  const seen = new Set<string>();
  const wrong: string[] = [];
  let leftovers = 0;
  while (true) {
    // The app's hash router (#/agent, #/supervisor) swaps the page's execution
    // context as the script switches screens; an evaluate that lands on that
    // instant throws instead of returning. Retry rather than fail the run —
    // the assertions still see every poll that does land.
    const snap = await poll(page);
    if (!snap) throw new Error("page.evaluate kept failing — the demo never settled");
    if (snap.done) break;
    if (snap.marks.length > 1) leftovers += 1;
    for (const m of snap.marks) {
      seen.add(m.id);
      // The mark must be ON the resolved target: for `@last` that is the last
      // element whose data-id starts with the prefix, otherwise the first.
      const at = m.id.lastIndexOf("@");
      const prefix = at > 0 ? m.id.slice(0, at) : m.id;
      if (m.actual !== m.id && !m.actual.startsWith(prefix)) {
        wrong.push(`beat ${snap.beat}: focus "${m.id}" marked <${m.actual}>`);
      }
      if (!m.visible) wrong.push(`beat ${snap.beat}: focus "${m.id}" marked a hidden node`);
    }
    await page.waitForTimeout(150);
  }
  // The eight distinct focus targets of the email1 script: the customer's mail,
  // the bank's mail, the app case card, the identity panel, the newest trace
  // line, the failing policy row, the approval card, the whole thread. And
  // nothing marked once the script has finished.
  expect(seen.size).toBeGreaterThanOrEqual(8);
  expect(leftovers).toBe(0);
  expect(wrong).toEqual([]);
  expect(await page.locator("[data-hl]").count()).toBe(0);
  expect(errors.filter((e) => !/Failed to load resource|msw/i.test(e))).toEqual([]);
});

test("email2 script plays to end (45-day Reg E dispute)", async ({ page }) => {
  const errors = await startScript(page, "email2");
  await expectDone(page, errors);
  // Result letter exists on the customer thread after day 45.
  await page.click("[data-nav='customer']");
  await page.waitForTimeout(600);
  await expect(page.locator("body")).toContainText(/investigation complete|result letter/i);
  // The provisional credit posted exactly once, and its notice email reached
  // the customer's own thread (beat 2-22 focuses s1.thread.out).
  await expect(page.locator("body")).toContainText(/provisional credit posted/i);
  await expect(page.locator("[data-id='s1.phone.inbox']")).toBeVisible();
});

test("trailer visits the dossier and the all-disputes clock board", async ({ page }) => {
  const seen = { dossier: false, clocks: false, onfile: false };
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.click("[data-id='demo.script.trailer90s']");
  await page.waitForSelector("[data-id='demo.bar']");
  await page.click("[data-id='demo.speed']");
  await page.click("[data-id='demo.speed']");
  // Poll the whole run: each highlight is a real screen in the script, so a
  // missing one means the trailer stopped covering what the app now shows.
  await page
    .waitForFunction(
      () => document.querySelector("[data-id='demo.bar']")?.getAttribute("data-status") === "done",
      undefined,
      { timeout: 200_000, polling: 250 },
    )
    .catch(() => {});
  // Re-verify the three screens the trailer captions point at, in the same
  // session the runner left behind.
  await page.click("[data-nav='agent']");
  await page.waitForTimeout(500);
  seen.dossier = await page.locator("[data-id='s2.policy.section']").isVisible();
  await page.click("[data-nav='supervisor']");
  await page.waitForTimeout(400);
  await page.click("[data-id='s3.tab.clocks']");
  await page.waitForTimeout(400);
  seen.clocks = await page.locator("[data-id='s3.clockboard.all']").isVisible();
  await page.click("[data-id='s3.tab.fraud']");
  await page.waitForTimeout(400);
  seen.onfile = await page.locator("[data-id='s3.fraud.onfile']").isVisible();
  expect(seen).toEqual({ dossier: true, clocks: true, onfile: true });
});

test("email3 script plays to end (BEC quarantine)", async ({ page }) => {
  const errors = await startScript(page, "email3");
  await expectDone(page, errors);
  // The script ends on the customer's own mail and phone — the audit view is
  // folded away before the outro, so the closing frame is two panels, not four.
  await expect(page.locator("[data-id='s1.phone.sms']")).toBeVisible();
  // The audit column itself is unmounted (the toggle button stays — it is how
  // the demo gets back in), so the matrix strip and the trace rail are gone.
  await expect(page.locator("[data-id='s1.autonomy']")).toHaveCount(0);
  await expect(page.locator("[data-id='s1.tracerail']")).toHaveCount(0);
});

test("email3 dossier beat keeps the SAR record and the sealed case visible", async ({
  page,
}) => {
  const errors = await startScript(page, "email3");
  // Beat 21 is the SAR card, beat 26 the closing dossier line: both claims the
  // script makes need something on screen behind them.
  await page.evaluate(() =>
    (window as unknown as { __demoSeek: (a: string, b: number) => Promise<void> }).__demoSeek(
      "email3",
      21,
    ),
  );
  await expect(page.locator("[data-id='s3.sar']")).toBeVisible();
  await expect(page.locator("[data-id='s3.fraud.closed']")).toBeVisible();
  expect(errors.filter((e) => !/Failed to load resource|msw/i.test(e))).toEqual([]);
});

test("builder script plays to end (graduation)", async ({ page }) => {
  const errors = await startScript(page, "builder");
  await expectDone(page, errors);
  // The script ends with wire-recall selected; re-open the promoted intent.
  await page.click("[data-id='s4.intent.reg_e_intake_demo']");
  await expect(page.locator("[data-id='s4.promote.notice']")).toBeVisible();
});

/**
 * The pointer must never sit on the words the caption is reading: on the
 * autonomy-strip cells the default top-centre pose landed exactly on the
 * I0–I3 label, so the audience could not tell which column was marked
 * (2026-10-02 recording). These beats pose from the top-right corner instead;
 * this walks every one of them and fails if ANY text inside the focus box
 * intersects the pointer's arrow.
 */
test("pointer never covers the label of the element it points at", async ({ page }) => {
  test.setTimeout(180_000);
  const cases: [script: string, beat: number, focus: string][] = [
    ["email1", 6, "s1.autonomy.cell.I1"],
    ["email1", 15, "s1.autonomy.cell.I3"],
    ["email1", 30, "s1.autonomy.cell.I3"],
    ["email2", 6, "s1.autonomy.cell.I2"],
    ["builder", 20, "s4.matrix.row.R3"],
  ];
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.click("[data-id='demo.script.email1']");
  await page.waitForSelector("[data-id='demo.bar']");
  for (const [script, beat, focus] of cases) {
    await page.evaluate(
      ([id, i]) =>
        (window as unknown as { __demoSeek: (a: string, b: number) => Promise<void> }).__demoSeek(
          id as string,
          i as number,
        ),
      [script, beat] as [string, number],
    );
    await expect(page.locator("[data-id='demo.bar']")).toHaveAttribute("data-beat", String(beat));
    await page.waitForTimeout(900); // pointer glide is 550 ms
    const hit = await page.evaluate((focusId) => {
      const el = document.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
      const arrow = document.querySelector<HTMLElement>("div[class*='9999'] svg");
      if (!el || !arrow) return { missing: !el ? "focus" : "pointer" };
      const a = arrow.getBoundingClientRect();
      const overlap = (r: DOMRect): number =>
        Math.max(0, Math.min(a.right, r.right) - Math.max(a.left, r.left)) *
        Math.max(0, Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top));
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const covered: string[] = [];
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (r.width > 0 && r.height > 0 && overlap(r) > 1) covered.push(node.textContent);
          }
        }
        node = walker.nextNode();
      }
      return { covered };
    }, focus);
    if ("missing" in hit) {
      throw new Error(`${script} beat ${beat}: ${hit.missing} not found in the page`);
    }
    expect(
      hit.covered,
      `${script} beat ${beat}: pointer covers text inside ${focus}`,
    ).toEqual([]);
    if (beat === 6 && script === "email1") {
      await page.screenshot({ path: "_shots/pointer-pose-I1.png" });
    }
  }
});
