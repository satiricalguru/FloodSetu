import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("landing works without WebGL motion: content + CTAs reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /When the water rises/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Request help/i }).first()).toHaveAttribute("href", "/sos");
  await expect(page.getByRole("link", { name: /Open control room/i })).toHaveAttribute("href", "/control");
  await expect(page.getByRole("heading", { name: "What if the phone drowns?" })).toBeAttached();
  await expect(page.getByText(/EOS-04 \(RISAT-1A\)/).first()).toBeAttached();
  await expect(page.getByText("Coming soon to your phone.")).toBeAttached();
});

test("relief ledger verifies in the browser and detects tampering", async ({ page }) => {
  await page.goto("/relief");
  await page.getByRole("button", { name: "Verify ledger" }).click();
  await expect(page.getByText(/entries link correctly/)).toBeVisible();
  await page.getByRole("button", { name: "Simulate tampering" }).click();
  await expect(page.getByText(/Chain broken at entry/)).toBeVisible();
});
