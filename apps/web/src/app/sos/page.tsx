import type { Metadata } from "next";
import SosApp from "./SosApp";

export const metadata: Metadata = { title: "SOS · JalSetu", description: "Request flood rescue — no login needed, works offline." };

export default function Page() {
  return <SosApp />;
}
