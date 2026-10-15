import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENV } from "./env";

/** Tiny file-backed store (DECISIONS D7). One file per module — the separation is physical. */
export function fileStore<T>(name: string, init: () => T): { get: () => T; save: () => void } {
  const g = globalThis as unknown as Record<string, { data: T; timer: ReturnType<typeof setTimeout> | null }>;
  const key = `__jalsetu_${name}`;
  if (!g[key]) {
    let data: T;
    try {
      data = { ...init(), ...JSON.parse(readFileSync(join(ENV.dataDir, `${name}.json`), "utf8")) } as T;
    } catch {
      data = init();
    }
    g[key] = { data, timer: null };
  }
  const slot = g[key];
  return {
    get: () => slot.data,
    save: () => {
      if (slot.timer) return;
      slot.timer = setTimeout(() => {
        slot.timer = null;
        try {
          mkdirSync(ENV.dataDir, { recursive: true });
          const p = join(ENV.dataDir, `${name}.json`);
          writeFileSync(`${p}.tmp`, JSON.stringify(slot.data));
          renameSync(`${p}.tmp`, p);
        } catch (e) {
          console.error("persist failed", e);
        }
      }, 250);
    },
  };
}
