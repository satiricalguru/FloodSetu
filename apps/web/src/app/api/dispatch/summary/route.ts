import { NextResponse } from "next/server";
import { readSummaries } from "@/server/contract";

/** Public, aggregated, k-anonymous affected-area summary (the only rescue → relief data flow). */
export async function GET() {
  return NextResponse.json(readSummaries());
}
