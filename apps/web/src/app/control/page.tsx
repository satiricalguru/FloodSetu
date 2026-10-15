import type { Metadata } from "next";
import ControlRoomClient from "./client";

export const metadata: Metadata = { title: "Control Room · JalSetu" };

export default function Page() {
  return <ControlRoomClient />;
}
