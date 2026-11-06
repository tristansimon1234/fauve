import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter_Tight } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// The interface and the big titles: a tight grotesque (Tristan: « ligne et très fin, contraste avec des grosses polices »).
const grotesk = Inter_Tight({
  variable: "--font-grotesk",
  subsets: ["latin", "latin-ext"],
});

// Small labels in capitals (« N° 01 », a status, a count).
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Edith · ton community manager IA, sur WhatsApp", template: "%s · Edith" },
  description:
    "En 5 minutes, sans app, directement sur WhatsApp : Edith monte tes vidéos en Reels, écrit tes légendes et te fait signe pour poster. Pour les commerces qui soignent leur image et les créateurs.",
  applicationName: "Edith",
  appleWebApp: { capable: true, title: "Edith", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Edith", locale: "fr_FR" },
  twitter: { card: "summary_large_image" },
  // Only the pages that ask for it are indexed (the landing): the app, its links and its sign-in pages are not.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F5F2EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${grotesk.variable} ${instrument.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
