import { NextResponse } from "next/server";
import { session } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";

export async function GET() {
  const s = await session();
  if (!s) return NextResponse.json({ role: null });
  const u = dispatchDb.get().users.find((x) => x.uid === s.sub);
  return NextResponse.json({ role: s.role, unit: s.unit, phone: u?.phoneMasked ?? null, uid: s.sub.startsWith("demo_") ? s.sub : `${s.sub.slice(0, 8)}…` });
}
