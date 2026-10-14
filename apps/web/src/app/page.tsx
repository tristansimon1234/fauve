import { PLANS } from "@fauve/agent";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  EyeIcon,
  PenIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { LandingDemo } from "@/components/landing/landing-demo";
import { PHOTOS, ReelMock, ReportMock, RetouchMock, unsplash, WeekMock } from "@/components/landing/mocks";
import { CarouselShowcase, ReelsShowcase, SHOWCASE_SLIDES } from "@/components/landing/showcase";
import { Mascot } from "@/components/mascot";
import { Logo } from "@/components/orb";
import { whatsappLink } from "@/lib/public-env";

const steps: [string, string][] = [
  ["Ton site", "Donne-lui l’adresse : elle comprend ton commerce, ton offre et ton ton."],
  ["Ton style", "Elle prend tes couleurs, ta police et tes plus belles photos pour ton moodboard."],
  ["Ton rythme", "Combien de posts et de stories par semaine : elle prépare ta semaine avec."],
  ["Un premier essai", "Une première publication ensemble, ajustée jusqu’à ce qu’elle te ressemble."],
  ["Ton Instagram", "En dernier, quand ta publication est prête : elle part à l’heure prévue."],
];

/** The two offers (the same work; Pro has room for more publications and more care). */
const offers = [
  {
    id: "essentiel",
    label: PLANS.essentiel.label,
    price: PLANS.essentiel.priceEur,
    pitch: "Pour être présent chaque semaine, sans y penser.",
    points: [`${PLANS.essentiel.postsPerWeek} publications par semaine, plus les stories`, `${PLANS.essentiel.credits} crédits par mois`, "Brigitte sur WhatsApp et dans l’app"],
    dark: false,
  },
  {
    id: "pro",
    label: PLANS.pro.label,
    price: PLANS.pro.priceEur,
    pitch: "Pour un compte qui bouge : plus de Reels, plus d’animations sur mesure.",
    points: [`${PLANS.pro.postsPerWeek} publications ou plus par semaine, plus les stories`, `${PLANS.pro.credits} crédits par mois`, "Assez de crédits pour des montages Max : deux versions, la meilleure gardée"],
    dark: true,
  },
] as const;

const faq: [string, string][] = [
  ["Brigitte, c’est une vraie personne ?", "Non, c’est une IA, et elle le dit. Elle écrit, monte et programme comme une community manager, et tu gardes toujours la main."],
  ["Est-ce qu’elle publie sans me demander ?", "Jamais. Chaque publication attend ta validation, sur WhatsApp ou dans l’app. Tu peux corriger un texte, déplacer une date ou demander une autre version."],
  ["Je n’ai pas de vidéo, ça marche quand même ?", "Oui. Elle part des photos de ton site, de celles que tu lui envoies, ou fait un Reel tout en animation à tes couleurs. Quand tu filmes, elle te dit quoi et comment."],
  ["Pour quel commerce ?", "Studios de sport ou de yoga, salons de coiffure et de beauté, restaurants, cafés, boutiques : elle parle ta langue et adapte ses idées à ton activité."],
  ["Et la musique ?", "Instagram ne laisse pas ajouter un son tendance automatiquement : Brigitte te le suggère, tu l’ajoutes en un geste au moment de publier."],
  ["Où vont mes photos et mes données ?", "Elles sont hébergées en Europe. Tes fichiers sont supprimés peu après la publication, et tout disparaît si tu pars."],
];

export default function LandingPage() {
  const waUrl = whatsappLink();

  return (
    <div className="min-h-dvh overflow-x-clip bg-soft">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <Logo />
        <nav className="flex items-center gap-6">
          <a href="#ce-qu-elle-fait" className="hidden text-[15px] font-semibold lg:inline">
            Ce qu’elle fait
          </a>
          <a href="#comment" className="hidden text-[15px] font-semibold lg:inline">
            Comment ça marche
          </a>
          <a href="#tarif" className="hidden text-[15px] font-semibold lg:inline">
            Tarif
          </a>
          <Link href="/commencer?connexion" className="hidden text-[15px] font-semibold md:inline">
            Se connecter
          </Link>
          <Start waUrl={waUrl} size="sm" />
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pt-6 pb-20 sm:px-8 sm:pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="self-start rounded-full bg-peach px-3 py-1.5 text-[13px] font-bold text-peach-ink">Pour les studios, salons, restaurants et boutiques</span>
          <h1 className="text-[clamp(40px,5.4vw,72px)] leading-[1.02] font-extrabold tracking-[-0.035em]">
            Des réseaux qui te rapportent <span className="accent">des clients.</span>
          </h1>
          <p className="max-w-[540px] text-[18px] leading-[1.55] text-muted sm:text-[19px]">
            Brigitte est ta community manager. Elle lit ton site, apprend ton style, monte tes Reels, écrit tes posts et les programme sur Instagram. Toi, tu valides d’un mot, sur WhatsApp ou ici.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Start waUrl={waUrl} size="lg" />
            <a href="#ce-qu-elle-fait" className="btn btn-secondary h-14 px-6 text-base">
              Voir ce qu’elle fait
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold text-muted">
            {["Rien ne part sans ta validation", "En place en 5 minutes", "Sans engagement"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckIcon size={16} className="text-violet" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 lg:pl-4">
          <LandingDemo />
        </div>
      </section>

      {/* For whom */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-8">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              [PHOTOS.studioClass, "Studios de sport et de yoga"],
              [PHOTOS.salon, "Salons de coiffure et de beauté"],
              [PHOTOS.dish, "Restaurants et cafés"],
              [PHOTOS.shop, "Boutiques"],
            ] as const
          ).map(([id, label]) => (
            <li key={id} className="relative h-[180px] overflow-hidden rounded-[22px] sm:h-[220px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={unsplash(id, 400, 300)} alt={label} loading="lazy" className="size-full object-cover" />
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(28,21,48,0)_45%,rgba(28,21,48,.7)_100%)]" />
              <span className="absolute inset-x-4 bottom-3.5 text-[15px] leading-snug font-bold text-white">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Her real work */}
      <section id="ce-qu-elle-fait" className="mx-auto flex max-w-[1200px] scroll-mt-6 flex-col gap-8 px-4 pb-16 sm:px-8">
        <SectionTitle kicker="Fait par Brigitte">
          De vraies publications, <span className="accent">faites par l’app.</span>
        </SectionTitle>
        <p className="-mt-4 max-w-[640px] text-[16px] leading-relaxed text-muted">
          Ces Reels et ce carrousel sortent tels quels de Brigitte, pour trois commerces d’exemple : elle a choisi les plans, écrit les textes, créé les animations à leurs couleurs, puis regardé chaque vidéo et corrigé ce qui n’allait pas.
        </p>
        <div className={`grid items-center gap-10 rounded-[28px] border border-line bg-[radial-gradient(ellipse_at_top,#fff_0%,#FBF7F4_70%)] px-4 py-8 sm:px-8 ${SHOWCASE_SLIDES.length ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
          <ReelsShowcase />
          {SHOWCASE_SLIDES.length > 0 && (
            <div className="flex flex-col items-center gap-3">
              <CarouselShowcase />
              <span className="text-center text-[13px] font-semibold text-muted">Carrousel · Salon de coiffure · Paris</span>
            </div>
          )}
        </div>
      </section>

      {/* What else she does */}
      <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-24 sm:px-8">
        <SectionTitle kicker="Ce qu’elle fait aussi">
          Tout ce qu’une community manager fait, <span className="accent">à tes couleurs.</span>
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card icon={PenIcon} title="Les légendes et les hashtags">
            Écrits avec ton ton, ton offre et ton lien de réservation.
            <span className="mt-4 block rounded-[14px] border border-line bg-soft p-3.5 text-[13.5px] leading-relaxed text-ink">
              Le cours de 7 h, c’est notre moment préféré ☀️ Lumière douce, 8 personnes max, et la journée qui commence bien. Réserve ta place, lien en bio.
              <span className="mt-1.5 block font-semibold text-violet">#pilateslyon #studiolune #coursdumatin</span>
            </span>
          </Card>
          <Card icon={CalendarIcon} title="Publié à la bonne heure">
            Elle tient ton calendrier et publie sur Instagram quand tu as validé.
            <span className="mt-4 block">
              <WeekMock />
            </span>
          </Card>
          <Card icon={ChartIcon} title="Ce qui marche, chaque dimanche">
            Elle compare tes posts et en tire des leçons pour les suivants.
            <span className="mt-4 block">
              <ReportMock />
            </span>
          </Card>
          <Card icon={EyeIcon} title="Des photos plus belles">
            Lumière, couleurs, horizon, et les visages floutés quand il le faut. L’original ne bouge pas.
            <span className="mt-4 block">
              <RetouchMock />
            </span>
          </Card>
        </div>
      </section>

      {/* Her style */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-8">
        <div className="grid items-center gap-10 overflow-hidden rounded-[28px] border border-line bg-white p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="flex flex-col gap-4">
            <SectionTitle kicker="Ton style">
              Elle apprend ton style, <span className="accent">pas un modèle.</span>
            </SectionTitle>
            <p className="max-w-[480px] text-[16px] leading-relaxed text-muted">
              Pas de gabarit tout fait. Brigitte part de ton site et de ce que tu aimes, te montre un premier essai, et chaque retour affine ta direction artistique pour toutes les publications suivantes.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            <StyleStep n={1} title="Ton site">
              <span className="flex -space-x-1.5">
                {["#2F3B2E", "#E9DFCF", "#C7835B", "#8C9A7E"].map((c) => (
                  <span key={c} className="size-7 rounded-full border-2 border-white shadow-sm" style={{ background: c }} />
                ))}
              </span>
              <span className="text-[12.5px] text-muted">Couleurs, police, photos</span>
            </StyleStep>
            <StyleStep n={2} title="Un premier essai">
              <ReelMock width={70} still />
            </StyleStep>
            <StyleStep n={3} title="Tes retours">
              <span className="flex flex-col gap-1.5">
                {["Plus chaleureux", "Plus sobre", "Plus pêchu"].map((l) => (
                  <span key={l} className="rounded-full border border-line bg-white px-2.5 py-1 text-center text-[12px] font-bold text-violet">
                    {l}
                  </span>
                ))}
              </span>
            </StyleStep>
          </ol>
        </div>
      </section>

      {/* How it works */}
      <section id="comment" className="mx-auto flex max-w-[1200px] scroll-mt-6 flex-col gap-8 px-4 pb-24 sm:px-8">
        <SectionTitle kicker="Comment ça marche">
          En place en <span className="accent">5 minutes</span>, sans rien installer.
        </SectionTitle>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-2.5 rounded-[22px] border border-line bg-white p-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-soft text-[15px] font-extrabold text-violet">{i + 1}</span>
              <h3 className="text-[17px] font-bold">{title}</h3>
              <p className="text-[14px] leading-[1.55] text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-3 md:grid-cols-2">
          <Channel icon={WhatsAppIcon} title="Sur WhatsApp">
            Envoie tes photos et tes vidéos, réponds d’un mot, valide d’un bouton. Brigitte t’écrit quand ta publication est prête.
          </Channel>
          <Channel icon={CalendarIcon} title="Dans l’app">
            Ton calendrier, ta grille Instagram, et l’éditeur pour retoucher un texte ou une scène, sur ordinateur comme sur téléphone.
          </Channel>
        </div>
      </section>

      {/* Price */}
      <section id="tarif" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 pb-24 sm:px-8">
        <div className="mb-8">
          <SectionTitle kicker="Tarif">
            Deux offres, <span className="accent">sans engagement.</span>
          </SectionTitle>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {offers.map((o) => (
            <div
              key={o.id}
              className={`flex flex-col gap-4 rounded-[28px] p-7 sm:p-9 ${o.dark ? "bg-ink text-white" : "border border-line bg-white text-ink"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm font-bold tracking-[0.06em] ${o.dark ? "text-lilac-ink" : "text-violet"}`}>{o.label.toUpperCase()}</span>
                {o.dark && <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold">Le plus complet</span>}
              </div>
              <span className="text-[52px] leading-none font-extrabold tracking-[-0.03em]">
                {o.price} € <span className={`text-xl font-semibold ${o.dark ? "text-lilac-ink" : "text-muted"}`}>/ mois</span>
              </span>
              <p className={`text-[15px] ${o.dark ? "text-[#E4DFF2]" : "text-muted"}`}>{o.pitch}</p>
              <ul className={`grid gap-2 text-[15px] ${o.dark ? "text-[#E4DFF2]" : "text-ink/85"}`}>
                {o.points.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckIcon size={16} className={`shrink-0 ${o.dark ? "text-lilac-ink" : "text-violet"}`} />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <Start waUrl={waUrl} size="lg" light={o.dark} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-[14px] text-muted">
          Les deux font tout : Reels montés et corrigés, carrousels, stories, légendes, publication sur Instagram, bilan chaque semaine. Tu arrêtes quand tu veux.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto grid max-w-[1200px] gap-8 px-4 pb-24 sm:px-8 lg:grid-cols-[1fr_1.6fr]">
        <SectionTitle kicker="Questions">
          Ce qu’on nous <span className="accent">demande.</span>
        </SectionTitle>
        <div className="flex flex-col gap-2.5">
          {faq.map(([q, a]) => (
            <details key={q} className="group rounded-[18px] border border-line bg-white px-5 py-4 open:pb-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-lg leading-none text-violet transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Last call */}
      <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-8">
        <div className="flex flex-col items-center gap-5 rounded-[28px] bg-[radial-gradient(ellipse_at_top,#efebff_0%,#fbf7f4_70%)] px-6 py-12 text-center">
          <Mascot size={96} mood="happy" />
          <h2 className="text-[clamp(30px,4vw,44px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
            Brigitte <span className="accent">t’attend.</span>
          </h2>
          <p className="max-w-[460px] text-[16px] text-muted">Donne-lui ton site : dans cinq minutes, elle te montre ce qu’elle ferait pour toi.</p>
          <Start waUrl={waUrl} size="lg" />
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-10 text-sm font-semibold text-muted sm:px-8">
        <span>© Brigitte</span>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/conditions">Conditions d’utilisation</Link>
        <Link href="/suppression-des-donnees">Suppression des données</Link>
        <Link href="/connexion">Se connecter</Link>
        <span className="font-normal">Photos : Unsplash</span>
      </footer>
    </div>
  );
}

/** Getting started: in the app on a computer (a code sent from the phone), on WhatsApp on a phone. */
function Start({ waUrl, size, light = false }: { waUrl: string; size: "sm" | "lg"; light?: boolean }) {
  const look = `${size === "lg" ? "h-14 px-7 text-base" : "h-11 px-5"} ${light ? "bg-white text-ink hover:bg-soft" : "btn-primary"}`;
  return (
    <>
      <Link href="/commencer" className={`btn hidden md:inline-flex ${look}`}>
        Commencer
      </Link>
      <a href={waUrl} className={`btn md:hidden ${look}`}>
        <WhatsAppIcon size={size === "lg" ? 20 : 18} />
        {size === "lg" ? "Commencer sur WhatsApp" : "Essayer"}
      </a>
    </>
  );
}

function SectionTitle({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold tracking-[0.06em] text-violet uppercase">{kicker}</span>
      <h2 className="max-w-[720px] text-[clamp(30px,3.6vw,44px)] leading-[1.08] font-extrabold tracking-[-0.025em]">{children}</h2>
    </div>
  );
}

function Card({ icon: Icon, title, className = "", children }: { icon: ComponentType<{ size?: number }>; title: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col rounded-[22px] border border-line bg-white p-6 ${className}`}>
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-violet-soft text-violet">
        <Icon size={20} />
      </span>
      <h3 className="text-[19px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[15px] leading-[1.55] text-muted">{children}</p>
    </div>
  );
}

function StyleStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col items-center gap-3 rounded-[18px] bg-soft p-4 text-center">
      <span className="flex items-center gap-2 text-[14px] font-bold">
        <span className="flex size-6 items-center justify-center rounded-full bg-violet text-[12px] text-white">{n}</span>
        {title}
      </span>
      <span className="flex min-h-[124px] flex-col items-center justify-center gap-2">{children}</span>
    </li>
  );
}

function Channel({ icon: Icon, title, children }: { icon: ComponentType<{ size?: number }>; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-[22px] border border-line bg-white p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
        <Icon size={20} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[16px] font-bold">{title}</span>
        <span className="text-[14.5px] leading-relaxed text-muted">{children}</span>
      </span>
    </div>
  );
}
