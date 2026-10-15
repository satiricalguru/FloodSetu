import { describe, expect, it } from "vitest";
import { verifyChain } from "@floodsetu/shared";
import { audit, emptyOtpState, handleFor, issueRefresh, noteRegistration, parseSms, requestOtp, rotateRefresh, signAccess, summariseAffectedAreas, uidFor, verifyAccess, verifyOtp, type RefreshStore } from "../src";

describe("OTP", () => {
  it("issues and verifies a 6-digit code once", () => {
    const st = emptyOtpState();
    const r = requestOtp(st, "pep", "9876543210", "dev1", "1.1.1.1", 0);
    expect(r.ok && r.devCode).toMatch(/^\d{6}$/);
    const wrong = r.devCode === "000000" ? "111111" : "000000";
    expect(verifyOtp(st, "pep", "9876543210", wrong, 10).ok).toBe(false);
    expect(verifyOtp(st, "pep", "9876543210", r.devCode!, 20).ok).toBe(true);
    expect(verifyOtp(st, "pep", "9876543210", r.devCode!, 30).ok).toBe(false);
  });
  it("expires after 5 minutes", () => {
    const st = emptyOtpState();
    const r = requestOtp(st, "pep", "9876543210", "d", "ip", 0);
    expect(verifyOtp(st, "pep", "9876543210", r.devCode!, 5 * 60_000 + 1).reason).toMatch(/expired/);
  });
  it("rate-limits per phone with exponential backoff and raises an abuse flag", () => {
    const st = emptyOtpState();
    for (let i = 0; i < 3; i++) expect(requestOtp(st, "pep", "9000000000", `d${i}`, `ip${i}`, i * 1000).ok).toBe(true);
    const blocked = requestOtp(st, "pep", "9000000000", "d9", "ip9", 4000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(st.flags.some((f) => f.kind === "otp_abuse")).toBe(true);
  });
  it("flags repeated registrations from one device", () => {
    const st = emptyOtpState();
    noteRegistration(st, "devX", "p1", 0);
    noteRegistration(st, "devX", "p2", 0);
    expect(noteRegistration(st, "devX", "p3", 0)).toMatch(/3 different phones/);
  });
});

describe("pseudonymous identity", () => {
  it("rotating handles: same user, different requests → unlinkable handles", () => {
    const uid = uidFor("pep", "9876543210");
    expect(handleFor(uid, "FS-AAAA")).not.toBe(handleFor(uid, "FS-BBBB"));
    expect(uid).not.toContain("9876543210");
  });
});

describe("sessions", () => {
  it("signs/verifies access tokens and rejects tampering/expiry", () => {
    const t = signAccess("s", { sub: "u1", role: "operator", exp: 1000, fam: "f" });
    expect(verifyAccess("s", t, 500)?.role).toBe("operator");
    expect(verifyAccess("s", t, 1500)).toBeNull();
    expect(verifyAccess("s", t.slice(0, -1) + (t.endsWith("0") ? "1" : "0"), 500)).toBeNull();
  });
  it("refresh rotation detects reuse and revokes the family", () => {
    const st: RefreshStore = { tokens: {}, revokedFamilies: [] };
    const r1 = issueRefresh(st, "u", "citizen", 0);
    const r2 = rotateRefresh(st, r1, 1);
    expect("refresh" in r2).toBe(true);
    const reuse = rotateRefresh(st, r1, 2);
    expect("error" in reuse && reuse.error).toMatch(/reuse/);
    expect("error" in rotateRefresh(st, (r2 as { refresh: string }).refresh, 3)).toBe(true);
  });
});

describe("audit chain", () => {
  it("is tamper-evident", () => {
    const chain: Parameters<typeof audit>[0] = [];
    audit(chain, "DISPATCH", "op1", { unit: "B-1", incident: "I-001" });
    audit(chain, "OVERRIDE", "op1", { unit: "B-2", reason: "closer" });
    expect(verifyChain(chain).ok).toBe(true);
    (chain[0].data as Record<string, unknown>).unit = "B-9";
    const v = verifyChain(chain);
    expect(v.ok).toBe(false);
    expect(v.brokenAt).toBe(0);
  });
});

describe("rescue → relief summary is anonymised and k-anonymous", () => {
  it("suppresses small counts and carries no identifiers", () => {
    const [s] = summariseAffectedAreas([{ id: "GHT", name: "Ghat Tola", status: "flooded", incidents: [{ verified: true, people: 3, rescued: 1, needs: [] }] }]);
    expect(s.peopleAffected).toBe("<5");
    expect(JSON.stringify(s)).not.toMatch(/FS-|ph_|h_|lat|lng/);
  });
});

describe("SMS fallback", () => {
  it("parses SOS 4 C landmark", () => {
    expect(parseSms("SOS 4 C near ghat 2")).toEqual({ people: 4, urgency: "critical", landmark: "near ghat 2" });
    expect(parseSms("hello")).toBeNull();
  });
});
