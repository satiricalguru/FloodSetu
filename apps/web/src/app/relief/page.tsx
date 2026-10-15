import type { Metadata } from "next";
import ReliefPage from "./ReliefPage";

export const metadata: Metadata = { title: "Relief ledger · JalSetu", description: "Public transparency dashboard: donations → distribution, hash-chained and verifiable." };

export default function Page() {
  return <ReliefPage />;
}
