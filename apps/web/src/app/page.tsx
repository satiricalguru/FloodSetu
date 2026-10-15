import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-semibold text-hi">JalSetu</h1>
        <div className="flex gap-3">
          <Link className="rounded-full bg-cta px-5 py-2 text-cta-text" href="/control">Control Room</Link>
          <Link className="rounded-full bg-sos px-5 py-2 text-white" href="/sos">SOS</Link>
        </div>
      </div>
    </main>
  );
}
