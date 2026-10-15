import { NextResponse } from "next/server";
import { reliefDb } from "@/server/relief/store";

/** Full hash-chained ledger: anyone can download and re-verify it. Contains pseudonymous hashes only. */
export async function GET() {
  return NextResponse.json({ ledger: reliefDb.get().ledger });
}
