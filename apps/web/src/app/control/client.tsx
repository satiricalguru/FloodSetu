"use client";
import dynamic from "next/dynamic";

const ControlRoom = dynamic(() => import("@/components/control/ControlRoom"), { ssr: false, loading: () => <div className="grid h-dvh place-items-center bg-bg font-mono text-[12px] text-mute">Loading control room…</div> });

export default function ControlRoomClient() {
  return <ControlRoom />;
}
