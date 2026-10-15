/** Status vocabulary shared by every surface: colour token + icon name + label key. Never colour alone. */
export type StatusTone = "sos" | "water" | "warn" | "safe" | "verify" | "info" | "mute";

export const AREA_STATUS = {
  normal: { tone: "safe", icon: "check", label: "Normal" },
  at_risk: { tone: "warn", icon: "alert", label: "At risk" },
  flooded: { tone: "water", icon: "waves", label: "Flooded" },
  verification_pending: { tone: "verify", icon: "hourglass", label: "Verifying" },
} as const satisfies Record<string, { tone: StatusTone; icon: string; label: string }>;

export const URGENCY = {
  critical: { tone: "sos", icon: "siren", label: "Critical" },
  urgent: { tone: "warn", icon: "alert", label: "Urgent" },
  needs_help: { tone: "info", icon: "hand", label: "Needs help" },
} as const;

export const SIGNAL_HEX = {
  sos: "#ff5a36",
  water: "#2ec5d3",
  warn: "#f2b33d",
  safe: "#3ccf8e",
  verify: "#a48bff",
  info: "#7fb2ff",
  mute: "#6b7788",
} as const;
