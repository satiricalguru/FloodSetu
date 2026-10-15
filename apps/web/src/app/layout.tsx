import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "FloodSetu — Flood Rescue Dispatch",
  description: "A signal in the flood. A lifeline in motion. Multi-agent flood rescue dispatch: decentralised negotiation vs centralised baseline, with explicit safety invariants. Synthetic simulation.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#080b0f", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
