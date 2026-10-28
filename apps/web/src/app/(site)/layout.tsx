import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/landing/site";
import { whatsappLink } from "@/lib/public-env";
import "../landing.css";

// The pages around the landing, made to be found: trades, guides, comparisons. Same paper, header
// and footer as the landing; indexed, unlike the rest of the app.
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="land-paper min-h-dvh overflow-x-clip bg-soft">
      <SiteHeader waUrl={whatsappLink()} />
      {children}
      <SiteFooter />
    </div>
  );
}
