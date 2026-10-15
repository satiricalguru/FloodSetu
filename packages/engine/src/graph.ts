import type { World } from "./types";

/** Edge cost in minutes; Infinity = impassable under this view. */
export type CostFn = (edgeId: string, from: number, to: number) => number;

export interface Tree {
  from: number;
  dist: Float64Array;
  prev: Int32Array;
  prevEdge: (string | null)[];
}

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k;
    const v = this.v;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const k = this.k;
    const v = this.v;
    const top: [number, number] = [k[0], v[0]];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/** One-to-all Dijkstra. Graph is small (~300 nodes) so we re-run instead of D* Lite (see DECISIONS). */
export function dijkstra(world: World, from: number | number[], cost: CostFn): Tree {
  const n = world.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevEdge: (string | null)[] = new Array(n).fill(null);
  const h = new MinHeap();
  const sources = Array.isArray(from) ? from : [from];
  for (const s of sources) {
    dist[s] = 0;
    h.push(0, s);
  }
  while (h.size) {
    const [d, u] = h.pop();
    if (d > dist[u]) continue;
    for (const { edge, to } of world.adj[u]) {
      const c = cost(edge, u, to);
      if (!Number.isFinite(c)) continue;
      const nd = d + c;
      if (nd < dist[to]) {
        dist[to] = nd;
        prev[to] = u;
        prevEdge[to] = edge;
        h.push(nd, to);
      }
    }
  }
  return { from: sources[0], dist, prev, prevEdge };
}

export function pathTo(tree: Tree, to: number): number[] | null {
  if (!Number.isFinite(tree.dist[to])) return null;
  const out: number[] = [];
  let c = to;
  while (c !== -1) {
    out.push(c);
    if (c === tree.from) break;
    c = tree.prev[c];
  }
  out.reverse();
  return out[0] === tree.from ? out : null;
}

export function edgeBetween(world: World, a: number, b: number): string | null {
  for (const { edge, to } of world.adj[a]) if (to === b) return edge;
  return null;
}
