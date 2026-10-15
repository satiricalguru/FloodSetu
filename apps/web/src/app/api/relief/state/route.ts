import { NextResponse } from "next/server";
import { publicState } from "@/server/relief/public";
import { reliefDb } from "@/server/relief/store";

export async function GET() {
  return NextResponse.json(publicState(reliefDb.get()));
}
