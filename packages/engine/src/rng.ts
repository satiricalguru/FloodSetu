/** Deterministic PRNG (mulberry32) + order-independent hashing. The engine never calls Math.random or Date.now. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit over a string. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Uniform [0,1) from a key — independent of call order (used for message loss so strategies see identical channel noise). */
export function hashUnit(...parts: (string | number)[]): number {
  return hashStr(parts.join("|")) / 4294967296;
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Short readable request id, e.g. JS-7K3Q. */
export function requestId(rng: Rng): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CROCKFORD[Math.floor(rng() * 32)];
  return `JS-${s}`;
}
