"use client";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Icon, Panel } from "@/components/ui";

const csrf = () => document.cookie.match(/(?:^|; )js_csrf=([^;]+)/)?.[1] ?? "";

interface AdminState {
  audit: { verify: { ok: boolean; checked: number; head: string; brokenAt?: number; reason?: string }; entries: { seq: number; at: string; type: string; actor: string; data: Record<string, unknown>; hash: string }[] };
  otpFlags: { at: number; kind: string; key: string; detail: string }[];
  sosFlags: { id: string; risk: { score: number; reasons: string[] }; status: string; handle: string }[];
  reliefFlags: { kind: string; severity: string; detail: string; ref: string }[];
  users: { uid: string; fullUid: string; phone: string; role: string; unit?: string; createdAt: string }[];
  orgs: { id: string; name: string; kind: string; verified: boolean; badge?: { authority: string; at: string; grantedBy: string } }[];
  counts: Record<string, number>;
}

/** Admin console: hash-chained audit log, fraud/abuse flags (review only), verified badges, role management. */
export default function Admin() {
  const [st, setSt] = useState<AdminState | null>(null);
  const [denied, setDenied] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/state");
    if (r.status === 401 || r.status === 403) return setDenied(true);
    setDenied(false);
    setSt(await r.json());
  }, []);
  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [load]);
  const post = async (url: string, body: unknown) => {
    await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-csrf": csrf() }, body: JSON.stringify(body) });
    load();
  };
  if (denied)
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="panel max-w-[420px] p-6 text-center">
          <Icon name="lock" size={28} className="mx-auto text-mute" />
          <h1 className="mt-3 text-[20px] font-semibold text-hi">Admin only</h1>
          <p className="mt-1 text-[13px] text-mute">Every API route checks the role in your session (least privilege).</p>
          <div className="mt-4 flex justify-center gap-2">
            <a href="/login?next=/admin"><Button variant="primary">Sign in with OTP</Button></a>
            <Button onClick={async () => { await fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "admin" }) }); load(); }}>Demo admin</Button>
          </div>
        </div>
      </main>
    );
  if (!st) return <main className="p-6"><div className="skeleton h-40" /></main>;
  return (
    <main className="mx-auto max-w-[1280px] space-y-4 p-5">
      <header className="flex items-center justify-between">
        <div>
          <a href="/control" className="text-[12px] text-mute hover:text-hi">← Control room</a>
          <h1 className="text-[24px] font-semibold text-hi">Admin console</h1>
        </div>
        <div className="mono flex gap-3 text-[11px] text-mute">{Object.entries(st.counts).map(([k, v]) => <span key={k}>{k} {v}</span>)}</div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Hash-chained audit log" right={<Badge tone={st.audit.verify.ok ? "safe" : "sos"} icon={st.audit.verify.ok ? "shield" : "alert"}>{st.audit.verify.ok ? `chain intact · ${st.audit.verify.checked} entries` : `broken at #${st.audit.verify.brokenAt}`}</Badge>} bodyClass="max-h-[560px] overflow-auto scroll-thin">
          <table className="w-full text-[12px]">
            <thead className="label sticky top-0 bg-panel"><tr><th className="py-2 pl-3 text-left">#</th><th className="text-left">Type</th><th className="text-left">Actor</th><th className="text-left">Data</th><th className="text-left">Hash</th></tr></thead>
            <tbody>
              {st.audit.entries.map((e) => (
                <tr key={e.seq} className="border-t border-line align-top">
                  <td className="mono py-1.5 pl-3 text-dim">{e.seq}</td>
                  <td><Badge tone={e.type === "FLAG" ? "warn" : e.type === "OVERRIDE" ? "warn" : e.type.startsWith("BADGE") ? "verify" : "mute"}>{e.type}</Badge></td>
                  <td className="mono text-hi">{e.actor.slice(0, 14)}</td>
                  <td className="max-w-[360px] truncate text-text" title={JSON.stringify(e.data)}>{JSON.stringify(e.data)}</td>
                  <td className="mono text-dim">{e.hash.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <div className="space-y-4">
          <Panel title="Fraud & abuse flags → review (never auto-reject)" bodyClass="p-3 space-y-2 max-h-[300px] overflow-auto scroll-thin">
            {st.sosFlags.map((f) => <div key={f.id} className="rounded-[8px] bg-raised p-2 text-[12px]"><Badge tone="warn" icon="eye">SOS {f.id} · risk {f.risk.score}</Badge> <span className="text-[10px] text-verify">OUR ADDITION</span><div className="mt-1 text-text">{f.risk.reasons.join("; ")}</div></div>)}
            {st.otpFlags.map((f, i) => <div key={i} className="rounded-[8px] bg-raised p-2 text-[12px]"><Badge tone="warn" icon="phone">{f.kind}</Badge> <span className="text-[10px] text-mute">OTP rate limits: AAROGYA SETU LINEAGE + our backoff</span><div className="mt-1 text-text">{f.key} — {f.detail}</div></div>)}
            {st.reliefFlags.map((f, i) => <div key={`r${i}`} className="rounded-[8px] bg-raised p-2 text-[12px]"><Badge tone={f.severity === "critical" ? "sos" : "warn"} icon="ledger">{f.kind.replace("_", " ")}</Badge> <span className="text-[10px] text-verify">OUR ADDITION</span><div className="mt-1 text-text">{f.detail}</div></div>)}
            {!st.sosFlags.length && !st.otpFlags.length && !st.reliefFlags.length ? <p className="text-[12px] text-mute">No flags.</p> : null}
          </Panel>
          <Panel title="Verified badges (authorised organisations only)" bodyClass="p-3 space-y-2">
            {st.orgs.map((o) => (
              <div key={o.id} className="flex items-center gap-2 rounded-[8px] bg-raised p-2 text-[12px]">
                <Icon name={o.verified ? "shield" : "alert"} size={15} className={o.verified ? "text-safe" : "text-warn"} />
                <div className="min-w-0 flex-1"><div className="truncate text-hi">{o.name}</div><div className="text-[11px] text-mute">{o.verified ? `verified · ${o.badge?.authority}` : "unverified — campaigns hidden from public"}</div></div>
                <Button size="sm" variant={o.verified ? "danger" : "primary"} onClick={() => post("/api/admin/badge", { orgId: o.id, grant: !o.verified, authority: o.verified ? "revoked by admin" : "Authority letter checked (synthetic)" })}>{o.verified ? "Revoke" : "Grant"}</Button>
              </div>
            ))}
          </Panel>
          <Panel title="Users & roles" bodyClass="p-3 space-y-1.5 max-h-[260px] overflow-auto scroll-thin">
            {st.users.length === 0 ? <p className="text-[12px] text-mute">No OTP users yet. Raw phone numbers are never stored — only masked display + salted hash.</p> : null}
            {st.users.map((u) => (
              <div key={u.fullUid} className="flex items-center gap-2 text-[12px]">
                <span className="mono text-hi">{u.phone}</span>
                <span className="mono text-dim">{u.uid}</span>
                <select value={u.role} onChange={(e) => post("/api/admin/role", { uid: u.fullUid, role: e.target.value, unit: u.unit })} className="ml-auto h-7 rounded-[6px] bg-raised px-2 text-[11px] text-hi">
                  {["citizen", "rescuer", "operator", "shelter", "relief_partner", "admin"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </main>
  );
}
