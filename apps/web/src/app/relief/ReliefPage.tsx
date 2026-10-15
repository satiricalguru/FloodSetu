"use client";
import { verifyChain, type ChainEntry } from "@jalsetu/shared";
import { sankey as d3sankey, sankeyLinkHorizontal } from "d3-sankey";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui";

type State = {
  totals: { money: number; received: Record<string, number>; allocated: Record<string, number>; dispatched: Record<string, number>; distributed: Record<string, number>; byCampaign: Record<string, number> };
  items: { id: string; label: string; unit: string }[];
  sankey: { nodes: { name: string }[]; links: { source: number; target: number; value: number; item: string }[] };
  areas: { areaId: string; areaName: string; status: string; need: Record<string, number>; fulfilled: Record<string, number>; beneficiaries: number | "<5"; verifiedIncidents: number | "<5" }[];
  summariesSource: string;
  campaigns: { id: string; title: string; areaIds: string[]; items: string[]; targetInr: number; raised: number; createdAt: string; org?: { name: string; badge?: { authority: string } } }[];
  hiddenCampaigns: number;
  points: { id: string; name: string; area: string; org?: string }[];
  orgs: { id: string; name: string; kind: string; badge?: { authority: string; at: string } }[];
  feed: { seq: number; at: string; type: string; actor: string; data: Record<string, unknown>; hash: string }[];
  donations: { seq: number; at: string; data: Record<string, unknown>; hash: string }[];
  ledger: { length: number; head: string | null; verify: { ok: boolean } };
  flagsPublic: number;
};

const ITEM_COLOR: Record<string, string> = { water_l: "var(--cat-2)", food_kits: "var(--cat-3)", medical_kits: "var(--cat-4)", shelter_kits: "var(--cat-1)" };
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function ReliefPage() {
  const [st, setSt] = useState<State | null>(null);
  const [verify, setVerify] = useState<{ ok: boolean; checked: number; head: string; reason?: string; ms: number } | null>(null);
  const [donating, setDonating] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ seq: number; hash: string } | null>(null);
  const load = () => fetch("/api/relief/state").then((r) => r.json()).then(setSt);
  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, []);
  const runVerify = async (tamper = false) => {
    const t0 = performance.now();
    const { ledger } = (await fetch("/api/relief/ledger").then((r) => r.json())) as { ledger: ChainEntry[] };
    if (tamper && ledger.length > 10) (ledger[10].data as Record<string, unknown>).qty = 99999;
    const v = verifyChain(ledger);
    setVerify({ ...v, ms: Math.round(performance.now() - t0) });
  };
  return (
    <div data-surface="ledger" className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5">
        <a href="/" className="flex items-center gap-2 text-[var(--text-hi)]"><Icon name="ledger" size={20} /><span className="font-semibold">JalSetu · Relief ledger</span></a>
        <nav className="flex items-center gap-4 text-[13px]"><a href="/awareness" className="hover:text-[var(--text-hi)]">Safety</a><a href="/relief/partner" className="hover:text-[var(--text-hi)]">Partners</a><a href="/sos" className="rounded-full bg-[#d4381c] px-4 py-2 font-medium text-white">Need rescue? SOS</a></nav>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 pb-20">
        <section className="grid gap-8 py-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-mute)]">Public transparency dashboard · simulated money · no personal data</p>
            <h1 className="mt-3 font-serif text-[44px] font-semibold leading-[1.05] tracking-tight text-[var(--navy)] md:text-[56px]">Every rupee, every kit — traced.</h1>
            <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed">Donations flow to <b className="text-[var(--text-hi)]">verified needs</b> in <b className="text-[var(--text-hi)]">verified areas</b>. Each event is appended to a hash-chained ledger that anyone can re-verify in their own browser.</p>
          </div>
          <div className="rounded-[12px] bg-[var(--raised)] p-6 shadow-[var(--panel-edge)]">
            <div className="grid grid-cols-2 gap-5">
              <Big label="Donated (simulated)" value={st ? inr(st.totals.money) : "—"} />
              <Big label="Food kits distributed" value={st ? st.totals.distributed.food_kits.toLocaleString("en-IN") : "—"} />
              <Big label="Litres of water distributed" value={st ? st.totals.distributed.water_l.toLocaleString("en-IN") : "—"} />
              <Big label="Ledger entries" value={st ? st.ledger.length : "—"} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => runVerify()} className="flex h-10 items-center gap-2 rounded-[12px] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white"><Icon name="shield" size={16} />Verify ledger</button>
              <button onClick={() => runVerify(true)} className="h-10 rounded-[12px] px-3 text-[13px] text-[var(--text-mute)] shadow-[inset_0_0_0_1px_var(--hairline)] hover:text-[var(--text-hi)]" title="Modifies one entry in your browser's copy to show the chain catching it">Simulate tampering</button>
            </div>
            {verify ? (
              <p className={`mt-3 rounded-[10px] p-3 text-[13px] ${verify.ok ? "bg-[#e7f7ef] text-[#0f6b45]" : "bg-[#fde8e3] text-[#9b2a13]"}`} role="status">
                {verify.ok ? `✓ All ${verify.checked} entries link correctly (recomputed SHA-256 in ${verify.ms} ms). Head ${verify.head.slice(0, 16)}…` : `✕ Chain broken at entry #${(verify as { brokenAt?: number }).brokenAt}: ${verify.reason}`}
              </p>
            ) : null}
          </div>
        </section>

        <section className="my-6 grid gap-6 rounded-[12px] bg-[var(--navy)] p-6 text-white md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.12em] opacity-70">Rescue dispatch</p>
            <p className="mt-1 text-[15px]">Decides who is rescued first using urgency, vulnerability, wait time and fairness — <b>nothing else</b>.</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <svg width="150" height="40" viewBox="0 0 150 40" aria-hidden><path d="M5 20 H65" stroke="white" strokeWidth="2" /><path d="M85 20 H145" stroke="white" strokeWidth="2" strokeDasharray="4 4" opacity=".5" /><path d="M65 8 L85 20 L65 32 Z" fill="white" /><text x="75" y="38" fontSize="7" fill="white" textAnchor="middle" opacity=".8">ONE-WAY</text></svg>
            <span className="mono text-[10px] opacity-80">aggregated · k ≥ 5 · no ids</span>
          </div>
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.12em] opacity-70">Relief & donations</p>
            <p className="mt-1 text-[15px]"><b>Donations can never buy priority.</b> This firewall is enforced by an automated architecture test, not just a promise.</p>
          </div>
        </section>

        <section className="py-6">
          <H2 k="Flow">Donated → received → allocated → dispatched → distributed</H2>
          {st ? <SankeyChart data={st.sankey} /> : <div className="h-[280px] animate-pulse rounded-[12px] bg-[var(--raised)]" />}
          <div className="mt-3 flex flex-wrap gap-4 text-[12px]">{st?.items.map((i) => <span key={i.id} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ITEM_COLOR[i.id] }} />{i.label}</span>)}</div>
        </section>

        <section className="py-6">
          <H2 k="Need vs fulfilled">Verified needs by area <span className="text-[13px] font-normal text-[var(--text-mute)]">({st?.summariesSource})</span></H2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {st?.areas.map((a) => (
              <article key={a.areaId} className="rounded-[12px] bg-[var(--panel)] p-5 shadow-[var(--panel-edge)]">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-[var(--text-hi)]">{a.areaName}</h3><span className="mono rounded-[4px] bg-[var(--raised)] px-1.5 py-0.5 text-[10.5px] uppercase">{a.status.replace("_", " ")}</span></div>
                <p className="mt-1 text-[12px] text-[var(--text-mute)]">{a.verifiedIncidents} verified incidents · beneficiaries {a.beneficiaries}</p>
                <div className="mt-3 space-y-2">
                  {(["water_l", "food_kits", "medical_kits", "shelter_kits"] as const).map((k) => {
                    const need = a.need[k] ?? 0;
                    const got = a.fulfilled[k] ?? 0;
                    const pct = need ? Math.min(100, (got / need) * 100) : got ? 100 : 0;
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-[11.5px]"><span>{st.items.find((i) => i.id === k)?.label}</span><span className="mono">{got.toLocaleString("en-IN")} / {need.toLocaleString("en-IN")}</span></div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--raised)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: ITEM_COLOR[k] }} /></div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-mute)]">Areas with fewer than 5 beneficiaries are shown as “&lt;5” (k-anonymity). Only neighbourhood-level aggregates ever leave the rescue system.</p>
        </section>

        <section className="py-6">
          <H2 k="Campaigns">Verified campaigns {st?.hiddenCampaigns ? <span className="ml-2 rounded-[4px] bg-[#fdf0dc] px-2 py-0.5 text-[12px] font-normal text-[#8a5a12]">{st.hiddenCampaigns} hidden — organiser not verified</span> : null}</H2>
          <div className="grid gap-3 md:grid-cols-3">
            {st?.campaigns.map((c) => (
              <article key={c.id} className="flex flex-col rounded-[12px] bg-[var(--panel)] p-5 shadow-[var(--panel-edge)]">
                <p className="flex items-center gap-1 text-[12px] text-[#0f6b45]"><Icon name="shield" size={13} /> {c.org?.name}</p>
                <h3 className="mt-1 flex-1 font-semibold text-[var(--text-hi)]">{c.title}</h3>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--raised)]"><div className="h-full bg-[var(--navy)]" style={{ width: `${Math.min(100, (c.raised / c.targetInr) * 100)}%` }} /></div>
                <p className="mono mt-1 text-[12px]">{inr(c.raised)} of {inr(c.targetInr)}</p>
                {donating === c.id ? (
                  <DonateForm campaignId={c.id} onDone={(r) => { setReceipt(r); setDonating(null); load(); }} />
                ) : (
                  <button onClick={() => setDonating(c.id)} className="mt-3 h-10 rounded-[12px] bg-[var(--navy)] text-[14px] font-semibold text-white">Donate (simulated)</button>
                )}
              </article>
            ))}
          </div>
          {receipt ? <p className="mt-3 rounded-[10px] bg-[#e7f7ef] p-3 text-[13px] text-[#0f6b45]">Receipt: ledger entry #{receipt.seq} · hash <span className="mono">{receipt.hash.slice(0, 24)}…</span> — re-verify the chain anytime above.</p> : null}
        </section>

        <section className="grid gap-6 py-6 md:grid-cols-2">
          <div>
            <H2 k="Distribution">Recent ledger events</H2>
            <ol className="divide-y divide-[var(--hairline)] rounded-[12px] bg-[var(--panel)] shadow-[var(--panel-edge)]">
              {st?.feed.slice(0, 14).map((e) => (
                <li key={e.seq} className="flex gap-3 px-4 py-2.5 text-[13px]">
                  <span className="mono w-10 text-[11px] text-[var(--text-mute)]">#{e.seq}</span>
                  <span className="flex-1"><b className="font-semibold text-[var(--text-hi)]">{e.type.replace(/_/g, " ").toLowerCase()}</b> · {String(e.data.qty ?? "")} {String(e.data.item ?? "").replace("_", " ")} {e.data.area ? `→ ${e.data.area}` : ""} {e.data.title ? `“${e.data.title}”` : ""}</span>
                  <span className="mono text-[11px] text-[var(--text-mute)]">{e.hash}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-6">
            <div>
              <H2 k="Collection points">Drop off supplies</H2>
              <ul className="grid gap-2">{st?.points.map((p) => <li key={p.id} className="rounded-[12px] bg-[var(--panel)] px-4 py-3 text-[13px] shadow-[var(--panel-edge)]"><b className="text-[var(--text-hi)]">{p.name}</b> · {p.area} · <span className="text-[var(--text-mute)]">{p.org}</span></li>)}</ul>
            </div>
            <div>
              <H2 k="Verified organisations">Badges granted by an authority</H2>
              <ul className="grid gap-2">{st?.orgs.map((o) => <li key={o.id} className="flex items-center gap-2 rounded-[12px] bg-[var(--panel)] px-4 py-3 text-[13px] shadow-[var(--panel-edge)]"><Icon name="shield" size={15} className="text-[#0f6b45]" /><b className="text-[var(--text-hi)]">{o.name}</b><span className="ml-auto text-[11.5px] text-[var(--text-mute)]">{o.badge?.authority}</span></li>)}</ul>
            </div>
          </div>
        </section>
        <footer className="mt-10 border-t border-[var(--hairline)] pt-6 text-[12px] text-[var(--text-mute)]">Simulation with synthetic data. No real payments are processed. Hackathon prototype — Code-E-Manipal 2.0.</footer>
      </main>
    </div>
  );
}

function Big({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] text-[var(--text-mute)]">{label}</div>
      <div className="num mt-1 text-[26px] font-bold tracking-tight text-[var(--text-hi)]">{value}</div>
    </div>
  );
}

function H2({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-mute)]">{k}</p>
      <h2 className="font-serif text-[26px] font-semibold text-[var(--text-hi)]">{children}</h2>
    </div>
  );
}

function SankeyChart({ data }: { data: State["sankey"] }) {
  const W = 1100;
  const H = 300;
  const layout = useMemo(() => {
    if (!data.links.length) return null;
    const used = new Set(data.links.flatMap((l) => [l.source, l.target]));
    const idx = new Map([...used].sort((a, b) => a - b).map((n, i) => [n, i]));
    const g = d3sankey<{ name: string }, { item: string }>().nodeWidth(12).nodePadding(26).extent([[1, 10], [W - 1, H - 10]]);
    return g({ nodes: [...idx.keys()].map((n) => ({ ...data.nodes[n] })), links: data.links.map((l) => ({ source: idx.get(l.source)!, target: idx.get(l.target)!, value: l.value, item: l.item })) });
  }, [data]);
  if (!layout) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[12px] bg-[var(--panel)] shadow-[var(--panel-edge)]" role="img" aria-label="Sankey of relief flows">
      {layout.links.map((l, i) => <path key={i} d={sankeyLinkHorizontal()(l as never) ?? ""} fill="none" stroke={ITEM_COLOR[(l as unknown as { item: string }).item]} strokeOpacity={0.35} strokeWidth={Math.max(1, l.width ?? 1)} />)}
      {layout.nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0))} fill="var(--navy)" rx={2} />
          <text x={(n.x0 ?? 0) < W / 2 ? (n.x1 ?? 0) + 6 : (n.x0 ?? 0) - 6} y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2} dy="0.35em" textAnchor={(n.x0 ?? 0) < W / 2 ? "start" : "end"} fontSize="12" fill="var(--text-hi)">{n.name}</text>
        </g>
      ))}
    </svg>
  );
}

function DonateForm({ campaignId, onDone }: { campaignId: string; onDone: (r: { seq: number; hash: string }) => void }) {
  const [amt, setAmt] = useState(500);
  const [contact, setContact] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/relief/donate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, amountInr: amt, contact }) });
        const d = await r.json();
        if (!r.ok) return setErr(d.error);
        onDone(d.receipt);
      }}
    >
      <div className="flex gap-1">{[200, 500, 2000].map((v) => <button type="button" key={v} onClick={() => setAmt(v)} className={`h-9 flex-1 rounded-[12px] text-[13px] ${amt === v ? "bg-[var(--navy)] text-white" : "shadow-[inset_0_0_0_1px_var(--hairline)]"}`}>₹{v}</button>)}</div>
      <input required value={contact} onChange={(e) => setContact(e.target.value)} placeholder="email (stored as a salted hash)" className="h-10 w-full rounded-[12px] px-3 text-[13px] shadow-[inset_0_0_0_1px_var(--hairline)] outline-none" />
      <button className="h-10 w-full rounded-[12px] bg-[var(--navy)] text-[14px] font-semibold text-white">Confirm simulated ₹{amt}</button>
      {err ? <p className="text-[12px] text-[#9b2a13]">{err}</p> : null}
    </form>
  );
}
