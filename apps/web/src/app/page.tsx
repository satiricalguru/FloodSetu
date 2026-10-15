import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "FloodSetu — When the water rises, every second negotiates",
  description: "Multi-agent flood rescue dispatch: decentralised negotiation vs a centralised baseline, explicit safety invariants, after-action replay, and a firewalled public relief ledger.",
};

export default function Page() {
  return <LandingClient />;
}
