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

test("cooldown: a second SOS from the same phone within 60 s updates the open request instead of duplicating it", async ({ request }) => {
  const deviceId = `e2e-cool-${Date.now()}`;
  const a = await (await request.post("/api/dispatch/sos", { data: { clientId: `c1-${deviceId}`, people: 2, urgency: "urgent", needs: [], nbhd: "GHT", deviceId } })).json();
  const b = await (await request.post("/api/dispatch/sos", { data: { clientId: `c2-${deviceId}`, people: 3, urgency: "critical", needs: ["in_water"], nbhd: "GHT", deviceId } })).json();
  expect(b.cooldown).toBe(true);
  expect(b.request.id).toBe(a.request.id);
  expect(b.request.urgency).toBe("critical");
  expect(b.request.needs).toContain("in_water");
});

test("live GPS: only the phone that sent the SOS can move its location", async ({ request }) => {
  const deviceId = `e2e-gps-${Date.now()}`;
  const { request: r } = await (await request.post("/api/dispatch/sos", { data: { clientId: `g-${deviceId}`, people: 1, urgency: "critical", needs: [], nbhd: "GHT", deviceId, lat: 25.41, lng: 85.03 } })).json();
  const ok = await request.post(`/api/dispatch/sos/${r.id}/location`, { data: { device: deviceId, lat: 25.4115, lng: 85.0312, accuracy: 8 } });
  expect((await ok.json()).moved).toBeGreaterThan(100);
  const other = await request.post(`/api/dispatch/sos/${r.id}/location`, { data: { device: "someone-else", lat: 25, lng: 85 } });
  expect(other.status()).toBe(403);
});

test("family tracking page shows status only", async ({ page, request }) => {
  const deviceId = `e2e-fam-${Date.now()}`;
  const { request: r } = await (await request.post("/api/dispatch/sos", { data: { clientId: `f-${deviceId}`, people: 1, urgency: "urgent", needs: [], nbhd: "GHT", deviceId, altPhone: "9876501234" } })).json();
  await page.goto(`/track/${r.id}`);
  await expect(page.getByRole("heading", { name: r.id })).toBeVisible();
  await expect(page.getByText("Received")).toBeVisible();
  await expect(page.getByText(/status only/i)).toBeVisible();
});
