import { expect, test } from "@playwright/test";

test("live bridge: control room assigns a unit; the rescuer phone accepts; control room sees the ack", async ({ browser }) => {
  const ops = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const crew = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const control = await ops.newPage();
  await control.goto("/control?scenario=baseline-monsoon");
  await expect(control.getByText("Phones linked")).toBeVisible({ timeout: 60_000 });
  // speed up so boats pick up work quickly
  await control.getByRole("radio", { name: "60×" }).click();
  await control.waitForTimeout(4000);
  await control.getByRole("radio", { name: "1×" }).click();

  const phone = await crew.newPage();
  await phone.goto("/rescuer");
  // choose a boat that currently holds a commitment (read from the bridge)
  await phone.getByRole("button", { name: "B-1", exact: true }).click();
  let accept = phone.getByRole("button", { name: "Accept" });
  for (const unit of ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6", "B-7", "B-8"]) {
    if (await accept.isVisible({ timeout: 6000 }).catch(() => false)) break;
    await phone.request.post("/api/auth/demo", { data: { role: "rescuer", unit } });
    await phone.reload();
    accept = phone.getByRole("button", { name: "Accept" });
  }
  await expect(accept).toBeVisible();
  await accept.click();
  await expect(phone.getByText("Sent from this phone")).toBeVisible();
  await expect(control.getByText(/crew acknowledged/)).toBeVisible({ timeout: 20_000 });
  await ops.close();
  await crew.close();
});
