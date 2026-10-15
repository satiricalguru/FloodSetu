import { NextResponse } from "next/server";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

/** Mock SMS inbox — dev/demo only. */
export async function GET() {
  if (!ENV.demo) return NextResponse.json({ error: "disabled" }, { status: 404 });
  return NextResponse.json({ messages: [...dispatchDb.get().devInbox].reverse() });
}
