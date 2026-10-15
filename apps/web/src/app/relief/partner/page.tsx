"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

const csrf = () => document.cookie.match(/(?:^|; )js_csrf=([^;]+)/)?.[1] ?? "";

/** Relief partner panel: record inventory flow (in → allocated → dispatched → distributed). Verified orgs only. */
export default function Partner() {
  const [me, setMe] = useState<{ role: string | null } | null>(null);
  const [form, setForm] = useState({ type: "IN_KIND_RECEIVED", item: "water_l", qty: 100, area: "GHT", point: "CP-1", beneficiaries: 0 });
  const [log, setLog] = useState<string[]>([]);
  const load = () => fetch("/api/auth/me").then((r) => r.json()).then(setMe);
  useEffect(() => void load(), []);
  if (!me) return null;
  if (me.role !== "relief_partner" && me.role !== "admin")
    return (
      <main data-surface="ledger" className="grid min-h-dvh place-items-center bg-[var(--bg)] p-6 text-[var(--text)]">
        <div className="max-w-[420px] text-center">
          <h1 className="font-serif text-[28px] font-semibold text-[var(--text-hi)]">Relief partner sign-in</h1>
          <p className="mt-2 text-[14px]">Only organisations verified by an authority (badge granted by an admin) can record distributions.</p>
          <a href="/login?next=/relief/partner" className="mt-4 inline-block rounded-[12px] bg-[var(--navy)] px-5 py-3 font-semibold text-white">Sign in with OTP</a>
          <button onClick={async () => { await fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "relief_partner" }) }); load(); }} className="mt-3 block w-full text-[13px] underline">Demo: continue as Riverbank Relief Collective</button>
        </div>
      </main>
    );
  return (
    <main data-surface="ledger" className="min-h-dvh bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="mx-auto max-w-[640px]">
        <a href="/relief" className="flex items-center gap-2 text-[13px]"><Icon name="chevronR" size={14} className="rotate-180" /> Public ledger</a>
        <h1 className="mt-4 font-serif text-[30px] font-semibold text-[var(--text-hi)]">Record a relief movement</h1>
        <p className="mt-1 text-[14px]">Every entry is timestamped, attributed to your organisation and hash-chained. Distribution totals exceeding receipts are flagged automatically.</p>
        <form
          className="mt-6 grid gap-3 rounded-[12px] bg-[var(--panel)] p-5 shadow-[var(--panel-edge)] sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await fetch("/api/relief/partner", { method: "POST", headers: { "content-type": "application/json", "x-csrf": csrf() }, body: JSON.stringify(form) });
            const d = await r.json();
            setLog((l) => [r.ok ? `#${d.entry.seq} ${form.type} ${form.qty} ${form.item} · ${d.entry.hash.slice(0, 12)}…` : `Error: ${d.error}`, ...l]);
          }}
        >
          {[
            ["type", ["IN_KIND_RECEIVED", "ALLOCATED", "DISPATCHED", "DISTRIBUTED"]],
            ["item", ["water_l", "food_kits", "medical_kits", "shelter_kits"]],
            ["area", ["GHT", "PRB", "MCH", "RLC", "SHN", "UCH"]],
            ["point", ["CP-1", "CP-2", "CP-3", "CP-4"]],
          ].map(([k, opts]) => (
            <label key={k as string} className="text-[12px]">
              {k as string}
              <select value={(form as Record<string, string | number>)[k as string]} onChange={(e) => setForm({ ...form, [k as string]: e.target.value })} className="mt-1 h-10 w-full rounded-[12px] px-2 text-[14px] shadow-[inset_0_0_0_1px_var(--hairline)]">
                {(opts as string[]).map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          ))}
          <label className="text-[12px]">qty<input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-[12px] px-2 text-[14px] shadow-[inset_0_0_0_1px_var(--hairline)]" /></label>
          <label className="text-[12px]">beneficiaries<input type="number" value={form.beneficiaries} onChange={(e) => setForm({ ...form, beneficiaries: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-[12px] px-2 text-[14px] shadow-[inset_0_0_0_1px_var(--hairline)]" /></label>
          <button className="h-11 rounded-[12px] bg-[var(--navy)] font-semibold text-white sm:col-span-2">Append to ledger</button>
        </form>
        <ul className="mt-4 space-y-1 font-mono text-[12px]">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
    </main>
  );
}
