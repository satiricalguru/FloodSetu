import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["Pixel 7"] });

test("guest SOS: no login, request id issued, status stepper shown", async ({ page }) => {
  await page.goto("/sos");
  await page.getByRole("button", { name: /SOS — Tap for emergency help/ }).click();
  await page.getByRole("button", { name: /Critical/ }).click();
  await page.getByRole("button", { name: "More people" }).click();
  await page.getByRole("button", { name: /Elderly/ }).click();
  await page.getByRole("button", { name: "Send SOS" }).click();
  await expect(page.getByText(/FS-[0-9A-Z]{4}/).first()).toBeVisible();
  await expect(page.getByText("Received by control room")).toBeVisible();
  await expect(page.getByLabel("Request progress")).toContainText("Team assigned");
});

test("drowning: one tap 'I'm in the water' sends a critical SOS without a form", async ({ page }) => {
  await page.goto("/sos");
  await page.getByRole("button", { name: /I am in the water/ }).click();
  await expect(page.getByText(/FS-[0-9A-Z]{4}/).first()).toBeVisible();
  await expect(page.getByText(/Critical/).first()).toBeVisible();
  await expect(page.getByText(/your request stays active at your last location/)).toBeVisible();
});

test("guest SOS is idempotent by clientId (offline outbox retries are safe)", async ({ request }) => {
  const body = { clientId: `e2e-${Date.now()}`, people: 3, urgency: "urgent", needs: [], deviceId: "e2e-device-1", nbhd: "MCH", lang: "en" };
  const a = await (await request.post("/api/dispatch/sos", { data: body })).json();
  const b = await (await request.post("/api/dispatch/sos", { data: body })).json();
  expect(a.request.id).toBe(b.request.id);
  expect(a.created).toBe(true);
  expect(b.created).toBe(false);
});
