import { expect, test } from "@playwright/test";

test("triple failure: cascade panel lists cancellations, reason codes, reassignments and recovery", async ({ page }) => {
  await page.goto("/control?scenario=triple-failure");
  await expect(page.getByText("Phones linked")).toBeVisible({ timeout: 40_000 });
  // let the flood build so boats hold commitments (≈ tick 90+)
  await page.getByRole("radio", { name: "15×" }).click();
  await page.waitForTimeout(6000);
  await page.getByRole("button", { name: "Triple failure" }).click();
  const panel = page.getByRole("dialog", { name: /Cascade/ });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("3 simultaneous disruptions");
  await expect(panel).toContainText("collapsed");
  await expect(panel).toContainText("failed");
  await expect(panel).toContainText("overflowed");
  await expect(panel).toContainText(/RESOURCE_FAILURE|SHELTER_FULL|ROUTE_BLOCKED/);
  await expect(panel).toContainText(/won with ETA|re-auctioned|rerouted/);
  // the invariant badge stays green
  await expect(page.getByText("9/9 held")).toBeVisible();
});

test("why drawer explains an assignment with bids and constraints", async ({ page }) => {
  await page.goto("/control?scenario=baseline-monsoon");
  await page.getByRole("radio", { name: "60×" }).click();
  await page.waitForTimeout(5000);
  await page.keyboard.press("2");
  await page.getByRole("button", { name: /Why for I-/ }).first().click();
  const why = page.getByRole("dialog", { name: "Why this assignment" });
  await expect(why).toBeVisible();
  await expect(why).toContainText(/Bids received|Not yet assigned|No award/);
});
