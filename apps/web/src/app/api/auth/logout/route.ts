import { NextResponse } from "next/server";
import { clearSession } from "@/server/auth";

export async function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}
