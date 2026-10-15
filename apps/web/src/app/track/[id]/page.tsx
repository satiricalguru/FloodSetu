import type { Metadata } from "next";
import TrackClient from "./TrackClient";

export const metadata: Metadata = { title: "Track an SOS · FloodSetu", robots: { index: false } };

export default async function Track({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackClient id={id.toUpperCase()} />;
}
