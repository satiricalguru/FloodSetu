"use client";
import { forwardRef } from "react";
import { Icon, type IconName } from "./Icon";

export { Icon };
export type Tone = "sos" | "water" | "warn" | "safe" | "verify" | "info" | "mute";

const TONE_TEXT: Record<Tone, string> = {
  sos: "text-sos",
  water: "text-water",
  warn: "text-warn",
  safe: "text-safe",
  verify: "text-verify",
  info: "text-info",
  mute: "text-mute",
};
const TONE_BG: Record<Tone, string> = {
  sos: "bg-[var(--sos-dim)]",
  water: "bg-[var(--water-dim)]",
  warn: "bg-[var(--warn-dim)]",
  safe: "bg-[var(--safe-dim)]",
  verify: "bg-[var(--verify-dim)]",
  info: "bg-[rgba(127,178,255,0.14)]",
  mute: "bg-[rgba(255,255,255,0.05)]",
};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Sharp 4px data badge: icon + label (never colour alone). */
export function Badge({ tone = "mute", icon, children, className }: { tone?: Tone; icon?: IconName | string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-[4px] px-1.5 py-[2px] font-mono text-[10.5px] uppercase tracking-[0.06em] leading-none", TONE_TEXT[tone], TONE_BG[tone], className)}>
      {icon ? <Icon name={icon} size={11} stroke={2} /> : null}
      {children}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "sos" | "quiet" | "danger"; size?: "sm" | "md" | "lg"; icon?: IconName | string };

/** Pill buttons. Primary is achromatic (bone); SOS is red because it means SOS. */
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "ghost", size = "md", icon, className, children, ...rest }, ref) {
  const v = {
    primary: "bg-cta text-cta-text hover:opacity-90",
    ghost: "text-hi shadow-[inset_0_0_0_1px_var(--hairline-strong)] hover:bg-hover",
    sos: "bg-sos text-white hover:brightness-110",
    quiet: "text-text hover:text-hi hover:bg-hover",
    danger: "text-sos shadow-[inset_0_0_0_1px_rgba(255,90,54,0.45)] hover:bg-[var(--sos-dim)]",
  }[variant];
  const s = { sm: "h-7 px-3 text-[12px] gap-1.5", md: "h-9 px-4 text-[13px] gap-2", lg: "h-12 px-6 text-[15px] gap-2" }[size];
  return (
    <button ref={ref} className={cx("inline-flex select-none items-center justify-center rounded-full font-medium transition-[background,opacity,filter] duration-150 disabled:cursor-not-allowed disabled:opacity-40", v, s, className)} {...rest}>
      {icon ? <Icon name={icon} size={size === "lg" ? 18 : 14} /> : null}
      {children}
    </button>
  );
});

export function Panel({ title, right, children, className, bodyClass }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx("panel flex min-h-0 flex-col", className)}>
      {title ? (
        <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <h2 className="label !text-[10.5px] !text-text">{title}</h2>
          {right}
        </header>
      ) : null}
      <div className={cx("min-h-0 flex-1", bodyClass)}>{children}</div>
    </section>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-[4px] bg-raised px-1.5 py-[1px] font-mono text-[10px] text-mute shadow-[inset_0_0_0_1px_var(--hairline-strong)]">{children}</kbd>;
}

export function Sparkline({ data, width = 72, height = 20, tone = "info", invert = false }: { data: number[]; width?: number; height?: number; tone?: Tone; invert?: boolean }) {
  if (data.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 2 - ((invert ? max - v : v - min) / span) * (height - 4)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const color = `var(--${tone === "mute" ? "text-mute" : tone})`;
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={`${d}L${width},${height}L0,${height}Z`} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.25} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={1.8} fill={color} />
    </svg>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, size = "sm" }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-full bg-raised p-0.5 shadow-[inset_0_0_0_1px_var(--hairline)]" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx("rounded-full font-mono transition-colors", size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-8 px-3.5 text-[12px]", o.value === value ? "bg-cta text-cta-text" : "text-mute hover:text-hi")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-[12px] text-text hover:text-hi">
      <span className="flex items-center gap-2">{label}</span>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx("relative h-4 w-7 rounded-full transition-colors", checked ? "bg-cta" : "bg-n-4 bg-[var(--n-4)]")}>
        <span className={cx("absolute top-0.5 h-3 w-3 rounded-full transition-all", checked ? "left-3.5 bg-[var(--cta-text)]" : "left-0.5 bg-[var(--n-7)]")} />
      </button>
    </label>
  );
}

export function Empty({ icon = "info", title, children }: { icon?: IconName | string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-raised text-mute shadow-[inset_0_0_0_1px_var(--hairline)]">
        <Icon name={icon} size={18} />
      </div>
      <p className="text-[13px] text-hi">{title}</p>
      {children ? <p className="max-w-[260px] text-[12px] text-mute">{children}</p> : null}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={cx("num mono mt-0.5 text-[18px] leading-none text-hi", tone && TONE_TEXT[tone])}>{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-mute">{sub}</div> : null}
    </div>
  );
}

export const URGENCY_META = {
  critical: { tone: "sos" as Tone, icon: "siren", label: "Critical", labelHi: "गंभीर" },
  urgent: { tone: "warn" as Tone, icon: "alert", label: "Urgent", labelHi: "अत्यावश्यक" },
  needs_help: { tone: "info" as Tone, icon: "hand", label: "Needs help", labelHi: "मदद चाहिए" },
};

export const AREA_META = {
  normal: { tone: "safe" as Tone, icon: "check", label: "Normal" },
  at_risk: { tone: "warn" as Tone, icon: "alert", label: "At risk" },
  flooded: { tone: "water" as Tone, icon: "waves", label: "Flooded" },
  verification_pending: { tone: "verify" as Tone, icon: "hourglass", label: "Verifying" },
};

export const VERIFY_META = {
  pending: { tone: "verify" as Tone, icon: "hourglass", label: "Pending" },
  under_review: { tone: "warn" as Tone, icon: "eye", label: "Under review" },
  verified: { tone: "safe" as Tone, icon: "shield", label: "Verified" },
  needs_attention: { tone: "sos" as Tone, icon: "alert", label: "Needs attention" },
};

export const AGENT_STATUS_META: Record<string, { tone: Tone; label: string; icon: string }> = {
  idle: { tone: "mute", label: "Idle", icon: "clock" },
  en_route: { tone: "info", label: "En route", icon: "route" },
  rescuing: { tone: "warn", label: "Rescuing", icon: "users" },
  working: { tone: "warn", label: "On task", icon: "hand" },
  transporting: { tone: "safe", label: "Transporting", icon: "shelter" },
  returning: { tone: "mute", label: "Returning", icon: "fuel" },
  refuelling: { tone: "mute", label: "Refuelling", icon: "fuel" },
  holding: { tone: "warn", label: "Holding", icon: "hourglass" },
  failed: { tone: "sos", label: "Failed", icon: "x" },
};
