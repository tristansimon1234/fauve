import Link from "next/link";
import { WhatsAppIcon } from "@/components/icons";
import { Logo, Orb } from "@/components/orb";
import { whatsappLink } from "@/lib/public-env";

// Illustrative video thumbnails in the example conversation (marketing, not data).
const exampleClips = [
  "linear-gradient(160deg,#F6C9B8,#C86B5A)",
  "linear-gradient(160deg,#D9CCF5,#7A5FD6)",
  "linear-gradient(160deg,#F7DEC4,#D9905A)",
  "linear-gradient(160deg,#E9C6D6,#A0577A)",
];

const steps = [
  ["Présente ton commerce", "Ton site, ton style, ton rythme : Fauve apprend qui tu es, sur ton ordinateur ou sur WhatsApp."],
  ["Connecte ton Instagram", "Un lien sécurisé, une autorisation. Rien ne part sans ta validation."],
  ["Montre-lui ce que tu aimes", "Un post ou un Reel qui te plaît, tes photos et vidéos : Fauve monte, écrit et programme."],
];

export default function LandingPage() {
  const waUrl = whatsappLink();

  return (
    <div className="min-h-dvh bg-soft">
      <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-8">
        <Logo />
        <nav className="flex flex-wrap items-center gap-6">
          <a href="#comment" className="hidden text-[15px] font-semibold sm:inline">
            Comment ça marche
          </a>
          <a href="#tarif" className="hidden text-[15px] font-semibold sm:inline">
            Tarif
          </a>
          <Link href="/commencer?connexion" className="hidden text-[15px] font-semibold md:inline">
            Se connecter
          </Link>
          {/* On a computer, getting started happens in the app (a code to send from the phone); on a phone, on WhatsApp. */}
          <Link href="/commencer" className="btn btn-primary hidden h-11 md:inline-flex">
            Commencer
          </Link>
          <a href={waUrl} className="btn btn-primary h-11 md:hidden">
            <WhatsAppIcon size={18} />
            Essayer sur WhatsApp
          </a>
        </nav>
      </header>

      <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 px-4 pt-8 pb-18 sm:px-8 sm:pt-12">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-5.5">
          <span className="self-start rounded-full bg-peach px-3 py-1.5 text-[13px] font-bold text-peach-ink">
            Pour les studios, salons, restaurants et boutiques
          </span>
          <h1 className="text-[clamp(40px,5vw,68px)] leading-[1.02] font-extrabold tracking-[-0.035em]">
            Ton community manager vit dans <span className="accent">WhatsApp.</span>
          </h1>
          <p className="max-w-[520px] text-[19px] leading-[1.55] text-muted">
            Envoie tes vidéos. Fauve les monte, écrit les légendes et programme tes posts. Et quand il manque
            quelque chose, c’est elle qui te relance.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/commencer" className="btn btn-primary hidden h-14 px-7 text-base md:inline-flex">
              Commencer
            </Link>
            <a href={waUrl} className="btn btn-primary h-14 px-7 text-base md:hidden">
              <WhatsAppIcon />
              Commencer sur WhatsApp
            </a>
            <a href="#exemple" className="btn btn-secondary h-14">
              Voir un exemple
            </a>
          </div>
          <span className="text-sm text-muted">Sans application à installer</span>
        </div>

        <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
          <div
            id="exemple"
            className="flex flex-col gap-2.5 rounded-[28px] bg-chat p-5.5 shadow-[0_24px_60px_rgba(28,21,48,.10)]"
          >
            <div className="flex items-center gap-2.5 border-b border-line pb-2">
              <Orb size={32} />
              <span className="flex flex-col">
                <span className="text-[15px] font-bold">Fauve</span>
                <span className="text-xs text-muted">en ligne</span>
              </span>
            </div>
            <Bubble from="fauve">
              Salut Camille ! Le Reel de jeudi est prévu. Tu peux m’envoyer 3 à 5 vidéos de ce matin ?
            </Bubble>
            <div className="grid grid-cols-[repeat(4,44px)] gap-1.5 self-end">
              {exampleClips.map((bg) => (
                <span key={bg} className="h-[72px] rounded-[10px]" style={{ background: bg }} />
              ))}
            </div>
            <Bubble from="fauve">
              Parfait. J’ai gardé 3 plans, ajouté les sous-titres et ton logo. Je le programme jeudi à 18 h ?
            </Bubble>
            <div className="flex gap-2 self-start">
              {["Oui, vas-y", "Je veux le voir"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-line bg-white px-3.5 py-2 text-[13px] font-bold text-violet"
                >
                  {label}
                </span>
              ))}
            </div>
            <Bubble from="me">Oui vas-y</Bubble>
          </div>

          <div className="hidden items-center gap-4.5 rounded-[22px] border border-line bg-white px-5 py-4 md:flex">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
              <WhatsAppIcon size={22} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-base font-bold">Sur ordinateur ?</span>
              <span className="text-sm leading-normal text-muted">
                On fait connaissance ici, et Fauve reste joignable sur WhatsApp.{" "}
                <Link href="/commencer" className="font-semibold text-violet hover:underline">
                  Commencer
                </Link>
              </span>
            </span>
          </div>
        </div>
      </section>

      <section id="comment" className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pb-18 sm:px-8">
        <h2 className="text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
          Prête en <span className="accent">5 minutes</span>, sans rien installer.
        </h2>
        <div className="flex flex-wrap gap-4">
          {steps.map(([title, text], i) => (
            <div
              key={title}
              className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 rounded-[22px] border border-line bg-white p-6"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-violet-soft font-extrabold text-violet">
                {i + 1}
              </span>
              <h3 className="text-[19px] font-bold">{title}</h3>
              <p className="text-[15px] leading-[1.55] text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tarif" className="mx-auto max-w-[1200px] px-4 pb-22 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-8 rounded-[28px] bg-ink p-8 text-white sm:p-10">
          <div className="flex flex-[1_1_360px] flex-col gap-2.5">
            <span className="text-sm font-bold text-lilac-ink">UN SEUL TARIF</span>
            <span className="text-[56px] font-extrabold tracking-[-0.03em]">
              49 € <span className="text-xl font-semibold text-lilac-ink">/ mois</span>
            </span>
            <span className="text-base text-[#E4DFF2]">
              Posts, Reels, stories, relances et bilan chaque semaine. Sans engagement.
            </span>
          </div>
          <a href={waUrl} className="btn h-14 bg-white px-7 text-base text-ink hover:bg-soft">
            <WhatsAppIcon />
            Commencer sur WhatsApp
          </a>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1200px] flex-wrap gap-5 px-4 pb-10 text-sm font-semibold text-muted sm:px-8">
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/conditions">Conditions d’utilisation</Link>
        <Link href="/suppression-des-donnees">Suppression des données</Link>
        <Link href="/connexion">Se connecter</Link>
      </footer>
    </div>
  );
}

function Bubble({ from, children }: { from: "fauve" | "me"; children: React.ReactNode }) {
  return from === "fauve" ? (
    <div className="max-w-[78%] self-start rounded-[16px_16px_16px_4px] border border-line bg-white px-3.5 py-2.5 text-sm leading-[1.45]">
      {children}
    </div>
  ) : (
    <div className="max-w-[78%] self-end rounded-[16px_16px_4px_16px] bg-violet px-3.5 py-2.5 text-sm leading-[1.45] text-white">
      {children}
    </div>
  );
}
