import { test, expect, type Page } from "@playwright/test";

async function idle(page: Page, ms = 900) {
  await page.waitForTimeout(ms);
}

test.describe("M5 supervisor cockpit smoke", () => {
  test("email 2: provisional credit → adjudication → L1 sign-off through real resume", async ({ page }) => {
    await page.goto("/#/customer");
    await page.waitForSelector("[data-id='dev.load.email2']");
    await page.click("[data-id='dev.load.email2']");
    await idle(page);
    await page.click("[data-id='dev.inject.EM-2-IN-1']");
    await idle(page);
    await page.click("[data-id='dev.inject.EM-2-IN-1B']");
    await idle(page);
    await page.click("[data-id='s1.phone.push']");
    await page.fill("[data-id='s1.phone.otp']", "111111");
    await page.click("[data-id='s1.phone.verify']");
    await idle(page);
    await page.click("[data-id='dev.inject.EM-2-IN-2']");
    await idle(page);
    await page.click("[data-id='dev.clock.bd10']");
    await idle(page);

    // Supervisor approves provisional credit (single-item, never batch).
    await page.goto("/#/supervisor");
    await idle(page, 500);
    await expect(page.locator("[data-id='s3.queue']")).toContainText("Post provisional credit");
    await page.click("[data-id='s3.approve']");
    await idle(page);
    await expect(page.locator("[data-id='s3.queue']")).toContainText("queue is clear");

    // Day 40 merchant evidence → R4 human adjudication.
    await page.click("[data-id='dev.clock.day40']");
    await idle(page);
    await expect(page.locator("[data-id='s3.queue']")).toContainText("Human adjudication");
    await page.click("[data-id='s3.approve']"); // uphold error outcome default
    await idle(page);
    // Chains into L1 result-letter sign-off in the same run.
    await expect(page.locator("[data-id='s3.queue']")).toContainText("Sign and send investigation result letter");
    await page.click("[data-id='s3.approve']");
    await idle(page);
    await expect(page.locator("[data-id='s3.queue']")).toContainText("queue is clear");

    // Customer received the result letter; Day 45 closes the case.
    await page.goto("/#/customer");
    await idle(page, 500);
    await page.click("[data-id='dev.clock.day45']");
    await idle(page);
    const trace = page.locator("[data-id='s1.tracerail']");
    await page.click("[data-id='s1.viewtoggle'] >> text=audit view");
    await expect(trace).toContainText("Investigation result (error found)");
  });

  test("screen 3: PRD §04 metrics render as numbers", async ({ page }) => {
    await page.goto("/#/supervisor");
    await page.waitForSelector("[data-id='s3.metrics.summary']");
    // Headline numbers are visible without opening a tab (case doc: the
    // supervisor owns KPIs), and the guardrail tab carries the full table.
    await expect(page.locator("[data-id='s3.metrics.summary.varr']")).toContainText("14.2%");
    await expect(page.locator("[data-id='s3.metrics.summary.ttr']")).toContainText("12");
    await expect(page.locator("[data-id='s3.metrics.summary.trust']")).toContainText("0");
    await page.click("[data-id='s3.tab.metrics']");
    await expect(page.locator("[data-id='s3.metrics']")).toBeVisible();
    await expect(page.locator("[data-id='s3.metrics.varr']")).toContainText("14.2%");
    await expect(page.locator("[data-id='s3.metrics.guardrails']")).toContainText("PSI");
    // PRD §4.2 guardrails: the original eight plus the four v0.3 rows the
    // design-time layer added (cohort parity, preventable rate, canary hit
    // rate, bulk remediation error rate).
    await expect(page.locator("[data-id='s3.metrics.guardrails'] tbody tr")).toHaveCount(12);
  });

  test("email 3: fraud quarantine confirm → on-file SMS + SAR locked template", async ({ page }) => {
    await page.goto("/#/supervisor");
    await page.waitForSelector("[data-id='dev.load.email3']");
    await idle(page, 1200); // let the screen's auto-load of email2 settle
    await page.click("[data-id='dev.load.email3']");
    await page.waitForSelector("[data-id='dev.inject.EM-3-IN-1']:not([disabled])");
    await page.click("[data-id='dev.inject.EM-3-IN-1']");
    await idle(page);
    await page.click("[data-id='s3.tab.fraud']");
    await expect(page.locator("[data-id='s3.quarantine']")).toContainText("jane.d0e@");
    // Requested R3 actions are disabled.
    await expect(page.locator("button:has-text('change phone number')")).toBeDisabled();
    await page.click("[data-id='s3.fraud.confirm']");
    await idle(page);
    await expect(page.locator("[data-id='s3.quarantine']")).toContainText("on-file");
    await expect(page.locator("[data-id='s3.sar']")).toContainText("facts only");
  });
});
