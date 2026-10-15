import { deviceHash } from "@jalsetu/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { session } from "@/server/auth";
import { dispatchDb } from "@/server/dispatch/store";
import { ENV } from "@/server/env";

const Body = z.object({ text: z.string().min(1).max(500), deviceId: z.string().optional(), public: z.boolean().optional() });

/** Per-request thread: team ↔ control room ↔ verified authority; citizen sees the public (filtered) view. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await session();
  const db = dispatchDb.get();
  const staff = s && ["operator", "admin", "rescuer"].includes(s.role);
  const msgs = db.threads[id] ?? [];
  void req;
  return NextResponse.json({ messages: staff ? msgs : msgs.filter((m) => m.public) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = dispatchDb.get();
  const r = db.sos.find((x) => x.id === id);
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  const s = await session();
  const isOwner = (p.data.deviceId && deviceHash(ENV.pepper, p.data.deviceId) === r.deviceHash) || (s && s.sub === r.uid);
  const staff = s && ["operator", "admin", "rescuer"].includes(s.role);
  if (!isOwner && !staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  (db.threads[id] ??= []).push({ at: new Date().toISOString(), from: staff ? (s!.unit ?? s!.role) : r.handle, role: staff ? s!.role : "citizen", text: p.data.text, public: staff ? (p.data.public ?? true) : true });
  dispatchDb.save();
  return NextResponse.json({ ok: true });
}
