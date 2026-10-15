import type { AffectedAreaSummary } from "@jalsetu/shared";

/**
 * The one-way mailbox between modules: dispatch WRITES aggregated, k-anonymous summaries; relief READS them.
 * Relief can never write here, and nothing in dispatch ever reads relief state.
 */
const g = globalThis as unknown as { __jalsetu_contract?: { summaries: AffectedAreaSummary[]; at: string | null } };
g.__jalsetu_contract ??= { summaries: [], at: null };

export function publishSummaries(s: AffectedAreaSummary[]) {
  g.__jalsetu_contract!.summaries = s;
  g.__jalsetu_contract!.at = new Date().toISOString();
}

export function readSummaries(): { summaries: AffectedAreaSummary[]; at: string | null } {
  return g.__jalsetu_contract!;
}
