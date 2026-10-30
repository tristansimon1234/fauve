import Link from "next/link";
import { HandlesForm } from "@/components/handles-form";
import { CheckIcon, InstagramIcon, TikTokIcon } from "@/components/icons";
import { currentMember } from "@/lib/social/current-member";
import { instagramAccount } from "@/lib/social/publish";
import { tiktokEnabled } from "@/lib/social/tiktok";
import { supabaseAdmin } from "@/lib/supabase/admin";

const errors: Record<string, string> = {
  refus: "La connexion a été annulée. Tu peux réessayer quand tu veux.",
  "lien-expire": "Le lien a expiré. Recommence la connexion.",
  "compte-perso": "Ce compte Instagram est personnel. Passe-le en compte professionnel (gratuit), puis réessaie.",
  instagram: "Instagram n’a pas répondu comme prévu. Réessaie dans un instant.",
  tiktok: "TikTok n’a pas répondu comme prévu. Réessaie dans un instant.",
  "tiktok-indisponible": "La connexion TikTok n’est pas encore ouverte.",
};

// Server component: reads the session and the studio's Instagram status.
export async function ConnectActions({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, member] = await Promise.all([searchParams, currentMember()]);
  const error = typeof params.erreur === "string" ? errors[params.erreur] : undefined;
  const [account, tiktok] = member
    ? await Promise.all([
        instagramAccount(member.studio_id),
        supabaseAdmin().from("social_accounts").select("handle, status").eq("studio_id", member.studio_id).eq("platform", "tiktok").maybeSingle().then((r) => r.data),
      ])
    : [null, null];
  const tiktokOn = tiktokEnabled();

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

      <div className={`flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5 ${tiktokOn ? "" : "opacity-70"}`}>
        <TikTokIcon className="shrink-0" />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">TikTok</span>
          <span className="text-[13px] text-muted">
            {!tiktokOn
              ? "Bientôt disponible"
              : tiktok?.status === "connected"
                ? `Connecté${tiktok.handle ? ` · @${tiktok.handle}` : ""}`
                : tiktok?.status === "expired"
                  ? "Connexion expirée"
                  : "Facultatif : tes Reels partent aussi sur TikTok"}
          </span>
        </span>
        {tiktokOn && member && tiktok?.status !== "connected" && (
          // Plain link: the OAuth start is a route handler.
          <a href="/api/tiktok/connect" className="btn btn-secondary shrink-0">
            {tiktok?.status === "expired" ? "Reconnecter" : "Connecter"}
          </a>
        )}
        {tiktok?.status === "connected" && <CheckIcon size={18} className="shrink-0 text-violet" />}
      </div>

      <p className="text-[13px] leading-normal text-muted">
        Il faut un compte Instagram professionnel ou créateur (gratuit).{" "}
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
          <a
            href="/api/instagram/connect"
            className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-white"
          >
            <InstagramIcon />
            Connecter Instagram
          </a>
        )}
        {account && (
          <a href="/api/instagram/connect" className="mt-3 block text-center text-sm font-bold text-violet">
            Connecter un autre compte
          </a>
        )}
      </div>
    </>
  );
}

/** Connecting not offered (lib/social/connect.ts): her @ instead, then on to the end of the onboarding. */
export async function HandlesActions() {
  const member = await currentMember();
  const studio = member
    ? (await supabaseAdmin().from("studios").select("instagram_handle, tiktok_handle").eq("id", member.studio_id).maybeSingle()).data
    : null;
  return (
    <>
      {member ? (
        <HandlesForm instagram={(studio?.instagram_handle as string | null) ?? null} tiktok={(studio?.tiktok_handle as string | null) ?? null} />
      ) : null}
      <div className="mt-auto -mx-6 border-t border-line px-6 pt-3.5 pb-7.5">
        <Link
          href={member ? "/pret" : "/connexion?next=/connect"}
          className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-white"
        >
          {member ? "Continuer" : "Se connecter pour continuer"}
        </Link>
      </div>
    </>
  );
}

export function ConnectActionsFallback() {
  return <div className="mt-auto h-[54px] animate-pulse rounded-full bg-soft motion-reduce:animate-none" aria-hidden="true" />;
}
