import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon, InstagramIcon, PenIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { demoStudio } from "@/lib/demo";
import { whatsappLink } from "@/lib/public-env";

export const metadata: Metadata = { title: "C’est prêt" };

const summary = [
  { icon: InstagramIcon, label: `@${demoStudio.instagram}`, detail: "Instagram connecté", warm: false },
  { icon: TikTokIcon, label: `@${demoStudio.tiktok}`, detail: "TikTok connecté", warm: false },
  { icon: CalendarIcon, label: "3 posts + 4 stories", detail: "par semaine", warm: false },
  { icon: PenIcon, label: "Ton style", detail: "appris à partir de 3 exemples", warm: true },
];

export default function ReadyPage() {
  return (
    <>
      <div className="flex flex-1 flex-col gap-5.5 px-6 pt-14 pb-6">
        <Orb size={88} className="self-center" />
        <div className="flex flex-col gap-2.5 text-center">
          <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">
            C’est prêt, <span className="accent">{demoStudio.manager}.</span>
          </h1>
          <p className="text-[15px] leading-[1.55] text-muted">
            Mila t’envoie ton premier plan de la semaine sur WhatsApp lundi à 9 h.
          </p>
        </div>
        <div className="card px-4 py-1.5">
          {summary.map(({ icon: Icon, label, detail, warm }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 py-3 ${i < summary.length - 1 ? "border-b border-line" : ""}`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                  warm ? "bg-peach text-peach-ink" : "bg-violet-soft text-violet"
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold">{label}</span>
                <span className="text-[13px] text-muted">{detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line px-6 pt-3.5 pb-7.5">
        <a
          href={whatsappLink()}
          className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-violet text-base font-bold text-white"
        >
          <WhatsAppIcon />
          Retourner sur WhatsApp
        </a>
        <Link
          href="/calendrier"
          className="flex h-12 items-center justify-center rounded-full border-[1.5px] border-line text-[15px] font-semibold"
        >
          Voir mon calendrier
        </Link>
      </div>
    </>
  );
}
