import type { Metadata } from "next";
import RescuerApp from "./RescuerApp";

export const metadata: Metadata = { title: "Rescuer · FloodSetu" };

export default function Page() {
  return <RescuerApp />;
}
