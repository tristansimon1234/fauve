import Link from "next/link";
import { CheckIcon, InstagramIcon, TikTokIcon } from "@/components/icons";
import { currentMember } from "@/lib/social/current-member";
import { instagramAccount } from "@/lib/social/publish";

const errors: Record<string, string> = {
  refus: "La connexion a été annulée. Tu peux réessayer quand tu veux.",
  "lien-expire": "Le lien a expiré. Recommence la connexion.",
  "compte-perso": "Ce compte Instagram est personnel. Passe-le en compte professionnel (gratuit), puis réessaie.",
  instagram: "Instagram n’a pas répondu comme prévu. Réessaie dans un instant.",
  "sans-page":
    "Aucune de tes Pages Facebook n’est reliée à un compte Instagram professionnel. Relie ton Instagram à une Page (Instagram › Modifier le profil › Page), ou connecte-toi sans Facebook, sans la musique.",
};

// Server component: reads the session and the studio's Instagram status.
export async function ConnectActions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, member] = await Promise.all([searchParams, currentMember()]);
  const error = typeof params.erreur === "string" ? errors[params.erreur] : undefined;
  const account = member ? await instagramAccount(member.studio_id) : null;

  return (
    <>
      {error && (
        <p role="alert" className="rounded-2xl bg-peach px-4 py-3 text-sm font-semibold text-peach-ink">
          {error}
        </p>
      )}

      {account && (
        <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-violet-soft text-violet">
            <CheckIcon size={18} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-bold">Instagram connecté</span>
            <span className="text-[13px] text-muted">@{account.handle}</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5 opacity-70">
        <TikTokIcon className="shrink-0" />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">TikTok</span>
          <span className="text-[13px] text-muted">Bientôt disponible</span>
        </span>
      </div>

      <p className="text-[13px] leading-normal text-muted">
        Il faut un compte Instagram professionnel, relié à une Page Facebook pour avoir la musique d’Instagram dans tes Reels.{" "}
        <a
          href="https://help.instagram.com/502981923235522"
          className="font-bold text-violet"
          target="_blank"
          rel="noreferrer"
        >
          Comment passer en compte pro ?
        </a>
      </p>

      <div className="mt-auto -mx-6 border-t border-line px-6 pt-3.5 pb-7.5">
        {!member ? (
          <Link
            href="/connexion?next=/connect"
            className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-white"
          >
            Se connecter pour continuer
          </Link>
        ) : account ? (
          <Link
            href="/pret"
            className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-white"
          >
            Continuer
          </Link>
        ) : (
          // Plain link: the OAuth start is a route handler, not a page.
          <>
            {/* Through Facebook: everything, and Instagram's music on the Reels. */}
            <a
              href="/api/facebook/connect"
              className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-white"
            >
              <InstagramIcon />
              Connecter Instagram
            </a>
            <a href="/api/instagram/connect" className="mt-3 block text-center text-[13px] font-semibold text-muted hover:text-ink">
              Sans Facebook (sans la musique d’Instagram)
            </a>
          </>
        )}
        {account && (
          <a href="/api/facebook/connect" className="mt-3 block text-center text-sm font-bold text-violet">
            Connecter un autre compte
          </a>
        )}
      </div>
    </>
  );
}

export function ConnectActionsFallback() {
  return <div className="mt-auto h-[54px] animate-pulse rounded-full bg-soft motion-reduce:animate-none" aria-hidden="true" />;
}
