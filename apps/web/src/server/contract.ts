import type { AffectedAreaSummary } from "@floodsetu/shared";

/**
 * The one-way mailbox between modules: dispatch WRITES aggregated, k-anonymous summaries; relief READS them.
 * Relief can never write here, and nothing in dispatch ever reads relief state.
 */
const g = globalThis as unknown as { __floodsetu_contract?: { summaries: AffectedAreaSummary[]; at: string | null } };
g.__floodsetu_contract ??= { summaries: [], at: null };

export function publishSummaries(s: AffectedAreaSummary[]) {
  g.__floodsetu_contract!.summaries = s;
  g.__floodsetu_contract!.at = new Date().toISOString();
}

export function readSummaries(): { summaries: AffectedAreaSummary[]; at: string | null } {
  return g.__floodsetu_contract!;
}
