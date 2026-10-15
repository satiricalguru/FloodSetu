import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("landing works without WebGL motion: content + CTAs reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The water is rising." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Request help/ })).toHaveAttribute("href", "/sos");
  await expect(page.getByRole("link", { name: /Open Control Room/ })).toHaveAttribute("href", "/control");
  await expect(page.getByText("Coming soon to your phone.")).toBeAttached();
});

test("relief ledger verifies in the browser and detects tampering", async ({ page }) => {
  await page.goto("/relief");
  await page.getByRole("button", { name: "Verify ledger" }).click();
  await expect(page.getByText(/entries link correctly/)).toBeVisible();
  await page.getByRole("button", { name: "Simulate tampering" }).click();
  await expect(page.getByText(/Chain broken at entry/)).toBeVisible();
});
