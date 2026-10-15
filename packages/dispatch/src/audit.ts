import { appendEntry, verifyChain, type ChainEntry } from "@floodsetu/shared";

/** Append-only, hash-chained audit log of verification, dispatch, override and role-change decisions. */
export type AuditType = "VERIFY" | "DISPATCH" | "OVERRIDE" | "ROLE_CHANGE" | "BADGE_GRANT" | "BADGE_REVOKE" | "MERGE" | "UNMERGE" | "ACCOUNT_DELETE" | "FLAG" | "LOGIN";

export function audit(chain: ChainEntry[], type: AuditType, actor: string, data: Record<string, unknown>, at?: string) {
  return appendEntry(chain, type, actor, data, at);
}

export const verifyAudit = verifyChain;
