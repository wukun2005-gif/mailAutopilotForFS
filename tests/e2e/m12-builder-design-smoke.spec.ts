import { test, expect, type Page } from "@playwright/test";

async function openView(page: Page, view: string) {
  await page.goto("/#/builder");
  await page.waitForSelector("[data-id='s4.views']");
  await page.click(`[data-id='s4.view.${view}']`);
}

test.describe("M12-3 Builder design-time views", () => {
  test("nominations: card A fixes the template (never lowers the bar), card B dual-signs to granted, R3/R4 greyed", async ({ page }) => {
    await openView(page, "nominations");
    // Card A starts blocked on consistency.
    await expect(page.locator("[data-id='s4.nom.state.NOM-A']")).toContainText(/fix|修/i);
    await page.click("[data-id='s4.nom.fix.NOM-A']");
    await page.waitForSelector("[data-id='s4.nom.submit.NOM-A']");
    await page.click("[data-id='s4.nom.submit.NOM-A']");
    await expect(page.locator("[data-id='s4.nom.sign.compliance.NOM-A']")).toBeVisible();

    // Card B arrives awaiting dual sign; grant only after both signatures.
    const applyB = page.locator("[data-id='s4.nom.apply.NOM-B']");
    await expect(applyB).toBeDisabled();
    await page.click("[data-id='s4.nom.sign.compliance.NOM-B']");
    await page.click("[data-id='s4.nom.sign.business.NOM-B']");
    await page.click("[data-id='s4.nom.apply.NOM-B']");
    await expect(page.locator("[data-id='s4.nom.granted.NOM-B']")).toBeVisible();

    // R3/R4 rows are greyed with no action buttons.
    await expect(page.locator("[data-id='s4.nom.NOM-R3']")).toContainText(/never|不提名/);
    expect(await page.locator("[data-id='s4.nom.NOM-R4'] button").count()).toBe(0);
  });

  test("policy compiler: closed-world refusal, and dual-signed $35→$25 diff grants V13", async ({ page }) => {
    await openView(page, "policies");
    // Default selection is COMP-1: dual sign to grant.
    await page.click("[data-id='s4.pol.sign.compliance.COMP-1']");
    await page.click("[data-id='s4.pol.sign.business.COMP-1']");
    await page.click("[data-id='s4.pol.apply.COMP-1']");
    await expect(page.locator("[data-id='s4.pol.granted.COMP-1']")).toContainText("V13");

    // COMP-2 cannot compile: missing data source, no diff, no sign buttons.
    await page.click("[data-id='s4.pol.example.COMP-2']");
    await expect(page.locator("[data-id='s4.pol.closedworld.COMP-2']")).toBeVisible();
    expect(await page.locator("[data-id='s4.pol.sign.compliance.COMP-2']").count()).toBe(0);

    // COMP-3 yields a checklist only.
    await page.click("[data-id='s4.pol.example.COMP-3']");
    await expect(page.locator("[data-id='s4.pol.checklist.COMP-3']")).toBeVisible();
  });

  test("intent discovery: candidate accepted into shadow at human-set levels; bereavement is report-only", async ({ page }) => {
    await openView(page, "intents");
    await page.click("[data-id='s4.cand.accept.CAND-1']");
    await expect(page.locator("[data-id='s4.cand.accepted.CAND-1']")).toContainText(/shadow/);
    await expect(page.locator("[data-id='s4.cand.report.CAND-2']")).toBeVisible();
    expect(await page.locator("[data-id='s4.cand.CAND-2'] button").count()).toBe(0);
  });
});
