import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
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
  title: { default: "Brigitte · ton community manager dans WhatsApp", template: "%s · Brigitte" },
  description:
    "Brigitte monte tes vidéos, écrit les légendes et programme tes posts Instagram et TikTok. Pour les studios, salons, restaurants et boutiques de quartier.",
  applicationName: "Brigitte",
  appleWebApp: { capable: true, title: "Brigitte", statusBarStyle: "default" },
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
