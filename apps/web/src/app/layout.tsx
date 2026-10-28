import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
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
    "Edith monte tes vidéos en Reels, écrit tes légendes et publie sur Instagram et TikTok. Pour les commerces de quartier et les indépendants.",
  applicationName: "Edith",
  appleWebApp: { capable: true, title: "Edith", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Edith", locale: "fr_FR" },
  twitter: { card: "summary_large_image" },
  // Only the pages that ask for it are indexed (the landing): the app, its links and its sign-in pages are not.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#5B3FD9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${jakarta.variable} ${instrument.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
