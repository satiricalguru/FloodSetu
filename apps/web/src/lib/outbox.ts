"use client";
import { createStore, del, entries, get, set } from "idb-keyval";

/**
 * Offline-first outbox (RESEARCH §4.9). Every SOS / field event is written to IndexedDB FIRST, then sent.
 * Server endpoints are idempotent (clientId / deviceId+lamport), so retries are always safe.
 * States: queued → sent (HTTP accepted) → received (server returned a request id/status).
 */
export type OutboxState = "queued" | "sent" | "received" | "failed";
export interface OutboxItem<T = unknown> {
  id: string;
  url: string;
  body: T;
  state: OutboxState;
  createdAt: number;
  tries: number;
  response?: unknown;
  error?: string;
}

const store = typeof indexedDB !== "undefined" ? createStore("jalsetu-outbox", "items") : undefined;
const listeners = new Set<() => void>();
const memory = new Map<string, OutboxItem>(); // fallback when IndexedDB is unavailable (private mode)

async function put(item: OutboxItem) {
  memory.set(item.id, item);
  try {
    if (store) await set(item.id, item, store);
  } catch {}
  listeners.forEach((l) => l());
}

export async function list<T = unknown>(): Promise<OutboxItem<T>[]> {
  try {
    if (store) return ((await entries(store)) as [string, OutboxItem<T>][]).map(([, v]) => v).sort((a, b) => b.createdAt - a.createdAt);
  } catch {}
  return [...memory.values()].sort((a, b) => b.createdAt - a.createdAt) as OutboxItem<T>[];
}

export async function getItem<T = unknown>(id: string): Promise<OutboxItem<T> | undefined> {
  try {
    if (store) return (await get(id, store)) as OutboxItem<T> | undefined;
  } catch {}
  return memory.get(id) as OutboxItem<T> | undefined;
}

export async function remove(id: string) {
  memory.delete(id);
  try {
    if (store) await del(id, store);
  } catch {}
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function enqueue<T>(id: string, url: string, body: T, headers?: Record<string, string>): Promise<OutboxItem<T>> {
  const item: OutboxItem<T> = { id, url, body, state: "queued", createdAt: Date.now(), tries: 0 };
  await put(item as OutboxItem);
  void flush(headers);
  try {
    const reg = await navigator.serviceWorker?.ready;
    // Background Sync where supported (Chromium); otherwise online/visibility events flush the queue
    await (reg as unknown as { sync?: { register: (t: string) => Promise<void> } })?.sync?.register("jalsetu-outbox");
  } catch {}
  return item;
}

let flushing = false;
export async function flush(headers?: Record<string, string>) {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  flushing = true;
  try {
    for (const item of await list()) {
      if (item.state === "received") continue;
      try {
        const res = await fetch(item.url, { method: "POST", headers: { "content-type": "application/json", ...(headers ?? {}) }, body: JSON.stringify(item.body) });
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        await put({ ...item, state: res.ok ? "received" : "failed", tries: item.tries + 1, response: data, error: res.ok ? undefined : (data as { error?: string }).error });
      } catch (e) {
        await put({ ...item, state: "queued", tries: item.tries + 1, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally {
    flushing = false;
  }
}

export function autoFlush(headers?: () => Record<string, string>) {
  const f = () => void flush(headers?.());
  window.addEventListener("online", f);
  document.addEventListener("visibilitychange", f);
  const i = setInterval(f, 8000);
  f();
  return () => {
    window.removeEventListener("online", f);
    document.removeEventListener("visibilitychange", f);
    clearInterval(i);
  };
}

export function deviceId(): string {
  try {
    let d = localStorage.getItem("jalsetu.device");
    if (!d) {
      d = crypto.randomUUID();
      localStorage.setItem("jalsetu.device", d);
    }
    return d;
  } catch {
    return "anon-device";
  }
}
