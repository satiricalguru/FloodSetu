import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Invariant 8 / Section 3 firewall — donation data can NEVER influence dispatch.
 * The rescue side (engine, dispatch, rescue UI + API) must not import the relief module, and the relief
 * module must not reach into rescue internals (only the shared AffectedAreaSummary contract).
 */
const ROOT = resolve(__dirname, "..");
const walk = (dir: string): string[] => {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? (f === "node_modules" || f === ".next" ? [] : walk(p)) : /\.(ts|tsx|js|mjs)$/.test(f) ? [p] : [];
    });
  } catch {
    return [];
  }
};
const RELIEF_IMPORT = /from\s+["'](@jalsetu\/relief|[./]*.*\/relief(\/|["']))|import\(\s*["']@jalsetu\/relief/;
const RESCUE_IMPORT = /from\s+["'](@jalsetu\/(engine|dispatch))["']/;

const rescueSide = [
  ...walk(join(ROOT, "packages/engine/src")),
  ...walk(join(ROOT, "packages/dispatch/src")),
  ...walk(join(ROOT, "apps/web/src/app/control")),
  ...walk(join(ROOT, "apps/web/src/app/rescuer")),
  ...walk(join(ROOT, "apps/web/src/app/sos")),
  ...walk(join(ROOT, "apps/web/src/app/api/dispatch")),
  ...walk(join(ROOT, "apps/web/src/components/control")),
  ...walk(join(ROOT, "apps/web/src/workers")),
  ...walk(join(ROOT, "apps/web/src/server/dispatch")),
];

describe("architecture firewall: rescue ↛ donations", () => {
  it("scans a non-trivial number of rescue-side files", () => {
    expect(rescueSide.length).toBeGreaterThan(15);
  });
  it("no rescue-side source file imports the relief module", () => {
    const offenders = rescueSide.filter((f) => RELIEF_IMPORT.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("engine and dispatch package.json do not depend on relief", () => {
    for (const p of ["engine", "dispatch"]) {
      const pkg = JSON.parse(readFileSync(join(ROOT, `packages/${p}/package.json`), "utf8"));
      expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain("@jalsetu/relief");
    }
  });
  it("relief imports only the shared contract (never engine/dispatch)", () => {
    const relief = [...walk(join(ROOT, "packages/relief/src")), ...walk(join(ROOT, "apps/web/src/server/relief"))];
    expect(relief.filter((f) => RESCUE_IMPORT.test(readFileSync(f, "utf8")))).toEqual([]);
  });
  it("the dispatch priority input type contains no money/donation fields", () => {
    const src = readFileSync(join(ROOT, "packages/engine/src/priority.ts"), "utf8");
    const iface = src.slice(src.indexOf("export interface PriorityInput"), src.indexOf("}", src.indexOf("export interface PriorityInput")));
    expect(iface).not.toMatch(/donat|amount|inr|campaign|money|media|popular/i);
  });
  it("detects a planted violation (self-test of the rule)", () => {
    expect(RELIEF_IMPORT.test(`import { totals } from "@jalsetu/relief";`)).toBe(true);
    expect(RELIEF_IMPORT.test(`import x from "../../server/relief/store";`)).toBe(true);
    expect(RELIEF_IMPORT.test(`import { sha256 } from "@jalsetu/shared";`)).toBe(false);
  });
});
