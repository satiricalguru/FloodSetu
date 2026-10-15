import type { Metadata } from "next";
import LandingClient from "./LandingClient";

export const metadata: Metadata = {
  title: "FloodSetu — A signal in the flood. A lifeline in motion.",
  description: "Multi-agent flood rescue dispatch: decentralised negotiation vs a centralised baseline, explicit safety invariants, after-action replay, and a firewalled public relief ledger.",
};

export default function Page() {
  return <LandingClient />;
}
