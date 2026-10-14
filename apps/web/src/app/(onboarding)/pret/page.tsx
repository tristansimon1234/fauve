import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { CalendarIcon, InstagramIcon, PenIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { plural } from "@/lib/format";
import { whatsappLink } from "@/lib/public-env";
import { getContentPlan, getOptionalStudioContext, getSocialAccounts } from "@/lib/studio";

export const metadata: Metadata = { title: "C’est prêt" };

type Item = { icon: typeof InstagramIcon; label: string; detail: string; warm?: boolean };

export default function ReadyPage() {
  return (
    <>
      <div className="flex flex-1 flex-col gap-5.5 px-6 pt-14 pb-6">
        <Mascot size={96} className="self-center" />
        <Suspense fallback={<Ready firstName={null} items={null} />}>
          <ReadyForMember />
        </Suspense>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line px-6 pt-3.5 pb-7.5">
        {/* On a computer the app goes on (the next step waits on the Fauve page); on a phone, WhatsApp. */}
        <Link
          href="/fauve"
          className="hidden h-[54px] items-center justify-center rounded-full bg-violet text-base font-bold text-white md:flex"
        >
          Continuer dans l’app
        </Link>
        <a
          href={whatsappLink()}
          className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-violet text-base font-bold text-white md:h-12 md:border-[1.5px] md:border-line md:bg-transparent md:text-[15px] md:font-semibold md:text-ink"
        >
          <WhatsAppIcon />
          <span className="md:hidden">Retourner sur WhatsApp</span>
          <span className="hidden md:inline">Continuer sur WhatsApp</span>
        </a>
        <Link
          href="/fauve"
          className="flex h-12 items-center justify-center rounded-full border-[1.5px] border-line text-[15px] font-semibold md:hidden"
        >
          Créer ma première publication
        </Link>
      </div>
    </>
  );
}

async function ReadyForMember() {
  const { db, member } = await getOptionalStudioContext();
  if (!member) return <Ready firstName={null} items={null} />;
  const studioId = member.studio.id;

  const [accounts, plan, brand] = await Promise.all([
    getSocialAccounts(db, studioId),
    getContentPlan(db, studioId),
    db.from("brand_profiles").select("examples").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
  ]);
  const examples = z.array(z.unknown()).catch([]).parse(brand.data?.[0]?.examples).length;
  const account = (platform: "instagram" | "tiktok") => accounts.find((a) => a.platform === platform && a.status === "connected");
  const instagram = account("instagram");
  const tiktok = account("tiktok");

  const items: Item[] = [
    instagram
      ? { icon: InstagramIcon, label: instagram.handle ? `@${instagram.handle}` : "Instagram", detail: "Instagram connecté" }
      : { icon: InstagramIcon, label: "Instagram", detail: "Pas encore connecté : demande le lien à Brigitte" },
    ...(tiktok
      ? [{ icon: TikTokIcon, label: tiktok.handle ? `@${tiktok.handle}` : "TikTok", detail: "TikTok connecté" }]
      : []),
    plan
      ? {
          icon: CalendarIcon,
          label: `${plural(plan.posts_per_week, "post", "posts")} + ${plural(plan.stories_per_week, "story", "stories")}`,
          detail: "par semaine",
        }
      : { icon: CalendarIcon, label: "Ton rythme", detail: "à choisir avec Brigitte" },
    {
      icon: PenIcon,
      label: "Ton style",
      detail: examples ? `appris à partir de ${plural(examples, "exemple", "exemples")}` : "Brigitte l’apprend au fil de vos échanges",
      warm: true,
    },
  ];
  return <Ready firstName={member.first_name} items={items} />;
}

function Ready({ firstName, items }: { firstName: string | null; items: Item[] | null }) {
  return (
    <>
      <div className="flex flex-col gap-2.5 text-center">
        <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">
          C’est prêt{firstName ? ", " : "."}
          {firstName && <span className="accent">{firstName}.</span>}
        </h1>
        <p className="text-[15px] leading-[1.55] text-muted">
          <span className="md:hidden">La suite se passe sur WhatsApp : envoie tes vidéos à Brigitte, elle prépare tes publications avec toi.</span>
          <span className="hidden md:inline">Dernière étape dans l’app : ta première publication, avec Brigitte.</span>
        </p>
      </div>
      {items && (
        <div className="card px-4 py-1.5">
          {items.map(({ icon: Icon, label, detail, warm }, i) => (
            <div
              key={label}
              className={`flex items-center gap-3 py-3 ${i < items.length - 1 ? "border-b border-line" : ""}`}
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
      )}
    </>
  );
}
