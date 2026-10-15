import { describe, expect, it } from "vitest";
import { EN_KEYS, LANGS, stateFromCoords } from "../apps/web/src/lib/i18n";
import { REGIONAL } from "../apps/web/src/lib/i18n-regional";
import { SOS_LANGS } from "../packages/dispatch/src/sos";

describe("i18n: location → suggested language", () => {
  it.each([
    [22.57, 88.36, "bn"], // Kolkata
    [13.08, 80.27, "ta"], // Chennai
    [19.08, 72.88, "mr"], // Mumbai
    [17.39, 78.49, "te"], // Hyderabad
    [9.93, 76.27, "ml"], // Kochi
    [26.14, 91.74, "as"], // Guwahati
    [20.3, 85.82, "or"], // Bhubaneswar
    [28.61, 77.21, "hi"], // Delhi
    [25.6, 85.1, "hi"], // Patna
    [13.35, 74.79, "kn"], // Manipal
  ])("%f,%f → %s", (lat, lng, want) => expect(stateFromCoords(lat, lng)?.lang).toBe(want));
  it("outside India → no suggestion (English stays)", () => expect(stateFromCoords(51.5, -0.12)).toBeNull());
});

describe("i18n: dictionaries", () => {
  it("English is first and default", () => expect(LANGS[0]!.code).toBe("en"));
  it("every regional key exists in English (no silent typos)", () => {
    for (const [lang, dict] of Object.entries(REGIONAL)) for (const k of Object.keys(dict)) if (!k.startsWith("tip")) expect(EN_KEYS, `${lang}.${k}`).toContain(k);
  });
  it("every UI language is accepted by the SOS schema", () => expect([...SOS_LANGS].sort()).toEqual(LANGS.map((l) => l.code).sort()));
  it("life-critical SOS keys are translated in every regional language", () => {
    for (const dict of Object.values(REGIONAL)) for (const k of ["sosHint", "critical", "send", "inWater", "call112", "phoneDies"]) expect(dict[k]).toBeTruthy();
  });
});

describe("i18n: SOS never blocked by language", async () => {
  const { SosInput } = await import("../packages/dispatch/src/sos");
  const base = { clientId: "lang-test-001", people: 1, urgency: "critical", needs: [], deviceId: "dev-lang-1" };
  it("unknown or missing lang → accepted as English", () => {
    expect(SosInput.parse({ ...base, lang: "xx" }).lang).toBe("en");
    expect(SosInput.parse(base).lang).toBe("en");
  });
  it("regional lang kept", () => expect(SosInput.parse({ ...base, lang: "ta" }).lang).toBe("ta"));
});
