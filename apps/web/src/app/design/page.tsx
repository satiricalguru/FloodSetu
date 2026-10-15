"use client";
import { AGENT_STATUS_META, AREA_META, Badge, Button, Icon, Kbd, Panel, Segmented, Sparkline, Stat, URGENCY_META, VERIFY_META } from "@/components/ui";
import { useState } from "react";

const SWATCHES: [string, string, string][] = [
  ["--n-0", "#080b0f", "canvas"], ["--n-1", "#0d1117", "panel"], ["--n-2", "#121821", "raised"], ["--n-3", "#18202b", "hover"], ["--n-4", "#222c3a", "track"], ["--n-6", "#4a5566", "dim"], ["--n-8", "#9aa6b8", "body"], ["--n-10", "#eef2f7", "headings"],
];
const SIGNALS: [string, string, string][] = [["--sos", "#ff5a36", "SOS / critical"], ["--water", "#2ec5d3", "water / flood"], ["--warn", "#f2b33d", "at risk / urgent"], ["--safe", "#3ccf8e", "safe / resolved"], ["--verify", "#a48bff", "verification pending"], ["--info", "#7fb2ff", "routes / info"], ["--cta", "#eceae3", "achromatic CTA"]];

/** /design — every token and component in one place (packages/ui/tokens.css). */
export default function Design() {
  const [seg, setSeg] = useState("a");
  return (
    <main className="mx-auto max-w-[1180px] space-y-8 p-6">
      <header>
        <div className="label">packages/ui/tokens.css · Tailwind v4 @theme</div>
        <h1 className="text-[32px] font-semibold tracking-tight text-hi">FloodSetu design system</h1>
        <p className="mt-1 max-w-[720px] text-[14px]">“Monsoon night control room” for operations; “Sunlit ledger” for public pages. Signal colours carry meaning only — every status is icon + label, never colour alone. Primary CTA is achromatic; only SOS is red.</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <Panel title="Neutral ramp (blue-tinted)" bodyClass="grid grid-cols-4 gap-2 p-3">{SWATCHES.map(([v, h, l]) => <div key={v}><div className="h-12 rounded-[6px] shadow-[inset_0_0_0_1px_var(--hairline)]" style={{ background: `var(${v})` }} /><div className="mono mt-1 text-[10px] text-hi">{v}</div><div className="mono text-[10px] text-mute">{h} · {l}</div></div>)}</Panel>
        <Panel title="Signal lights (meaning only)" bodyClass="grid grid-cols-4 gap-2 p-3">{SIGNALS.map(([v, h, l]) => <div key={v}><div className="h-12 rounded-[6px]" style={{ background: `var(${v})` }} /><div className="mono mt-1 text-[10px] text-hi">{v}</div><div className="mono text-[10px] text-mute">{h} · {l}</div></div>)}</Panel>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Panel title="Type" bodyClass="space-y-2 p-4"><div className="text-[28px] font-semibold tracking-tight text-hi">Geist — UI</div><div className="mono text-[16px] text-hi">Geist Mono — 06:42 · T+042 · FS-7K3Q</div><div className="font-serif text-[20px] text-hi">Source Serif 4 — reports</div><div className="text-[18px] text-hi">नोटो देवनागरी — हिंदी</div></Panel>
        <Panel title="Buttons (pill) & badges (4px)" bodyClass="flex flex-wrap items-center gap-2 p-4"><Button variant="primary" icon="play">Primary</Button><Button icon="step">Ghost</Button><Button variant="sos" icon="siren">SOS</Button><Button variant="danger" icon="x">Danger</Button><Button variant="quiet">Quiet</Button><Kbd>⌘K</Kbd><Segmented value={seg} onChange={setSeg} options={[{ value: "a", label: "1×" }, { value: "b", label: "5×" }, { value: "c", label: "60×" }]} /></Panel>
        <Panel title="KPI + sparkline" bodyClass="flex items-end gap-6 p-4"><Stat label="P90 wait" value="34 min" /><Sparkline data={[3, 5, 4, 8, 7, 10, 9, 12, 11, 9, 7]} tone="warn" width={120} height={34} /></Panel>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {[["Urgency", URGENCY_META], ["Area status", AREA_META], ["Verification", VERIFY_META], ["Agent status", AGENT_STATUS_META]].map(([t, m]) => (
          <Panel key={t as string} title={t as string} bodyClass="flex flex-wrap gap-1.5 p-3">{Object.entries(m as Record<string, { tone: never; icon: string; label: string }>).map(([k, v]) => <Badge key={k} tone={v.tone} icon={v.icon}>{v.label}</Badge>)}</Panel>
        ))}
      </section>
      <Panel title="Iconography (inline SVG, no dependency)" bodyClass="flex flex-wrap gap-3 p-4 text-hi">{["siren", "alert", "waves", "check", "hourglass", "hand", "boat", "users", "shield", "map", "bridge", "shelter", "route", "wifi", "wifiOff", "ledger", "bolt", "medical", "elderly", "baby", "wheelchair", "pregnant", "injured", "pet"].map((n) => <span key={n} className="flex w-16 flex-col items-center gap-1"><Icon name={n} size={20} /><span className="mono text-[9px] text-mute">{n}</span></span>)}</Panel>
      <section data-surface="ledger" className="rounded-[12px] bg-[var(--bg)] p-6 text-[var(--text)]">
        <div className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-mute)]">Sunlit ledger surface</div>
        <h2 className="mt-2 font-serif text-[28px] font-semibold text-[var(--navy)]">Every rupee, every kit — traced.</h2>
        <div className="mt-3 flex gap-2">{["--cat-1", "--cat-2", "--cat-3", "--cat-4"].map((c) => <span key={c} className="h-6 w-16 rounded-[4px]" style={{ background: `var(${c})` }} />)}</div>
      </section>
    </main>
  );
}
