import Link from "next/link";
import { InstagramIcon, TikTokIcon } from "@/components/icons";
import { creditBalance } from "@/lib/credits";
import { initials } from "@/lib/format";
import { socialConnect } from "@/lib/social/connect";
import { tiktokEnabled } from "@/lib/social/tiktok";
import { getSocialAccounts, getStudioContext } from "@/lib/studio";
import { StudioLive } from "./studio-live";
import { WorkPill } from "./work-pill";

// Sidebar and header pieces of the app shell that depend on the signed-in member.

export async function SidebarAccount() {
  const { db, member } = await getStudioContext();
  if (!member) return null;

  // Connecting not offered (lib/social/connect.ts): her @ instead, given in Réglages.
  if (!socialConnect()) {
    const { data: studio } = await db.from("studios").select("instagram_handle, tiktok_handle").eq("id", member.studio.id).maybeSingle();
    const handles = [
      ["instagram", studio?.instagram_handle as string | null],
      ["tiktok", studio?.tiktok_handle as string | null],
    ].filter((h): h is [string, string] => Boolean(h[1]));
    return (
      <>
        <Credits studioId={member.studio.id} wide />
        <div className="flex flex-col gap-2 rounded-[14px] bg-soft p-3.5">
          <span className="text-xs font-bold tracking-[.06em] text-muted">TES COMPTES</span>
          {handles.map(([platform, handle]) => (
            <span key={platform} className="flex items-center gap-2 text-sm font-semibold">
              {platform === "tiktok" ? <TikTokIcon size={18} className="text-violet" /> : <InstagramIcon size={18} className="text-violet" />}@{handle}
            </span>
          ))}
          <Link href="/reglages#reseaux" className="text-[13px] font-bold text-violet">
            {handles.length ? "Changer" : "Donner ton @ Instagram"}
          </Link>
        </div>
        <StudioLink name={member.studio.name ?? "Mon studio"} firstName={member.first_name} role={member.role} />
      </>
    );
  }
  const accounts = (await getSocialAccounts(db, member.studio.id)).filter((a) => a.status === "connected");
  const studioName = member.studio.name ?? "Mon studio";
  // Each network not yet linked gets its own link (TikTok only when the app offers it).
  const missing = (["instagram", ...(tiktokEnabled() ? ["tiktok" as const] : [])] as const).filter(
    (platform) => !accounts.some((a) => a.platform === platform),
  );

  return (
    <>
      <Credits studioId={member.studio.id} wide />
      <div className="flex flex-col gap-2 rounded-[14px] bg-soft p-3.5">
        <span className="text-xs font-bold tracking-[.06em] text-muted">COMPTES CONNECTÉS</span>
        {accounts.map((a) => (
          <span key={a.platform} className="flex items-center gap-2 text-sm font-semibold">
            {a.platform === "tiktok" ? (
              <TikTokIcon size={18} className="text-violet" />
            ) : (
              <InstagramIcon size={18} className="text-violet" />
            )}
            {a.handle ? `@${a.handle}` : a.platform === "tiktok" ? "TikTok" : "Instagram"}
          </span>
        ))}
        {accounts.length ? null : <span className="text-[13px] leading-snug text-muted">Aucun pour l’instant.</span>}
        {missing.map((platform) => (
          <a
            key={platform}
            href={platform === "tiktok" ? "/api/tiktok/connect" : "/connect"}
            className="flex items-center gap-2 text-[13px] font-bold text-violet"
          >
            {platform === "tiktok" ? <TikTokIcon size={16} /> : <InstagramIcon size={16} />}
            {platform === "tiktok" ? "Connecter TikTok" : "Connecter Instagram"}
          </a>
        ))}
      </div>
      <StudioLink name={studioName} firstName={member.first_name} role={member.role} />
    </>
  );
}

function StudioLink({ name, firstName, role }: { name: string; firstName: string | null; role: string }) {
  return (
    <Link href="/reglages" className="flex items-center gap-3 rounded-xl px-1.5 py-1 hover:bg-soft">
      <Avatar name={name} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-bold">{name}</span>
        <span className="truncate text-[13px] text-muted">{[firstName, role === "owner" ? "Responsable" : "Équipe"].filter(Boolean).join(" · ")}</span>
      </span>
    </Link>
  );
}

export async function HeaderAvatar() {
  const { member } = await getStudioContext();
  return (
    <span className="flex items-center gap-2">
      {member && <Credits studioId={member.studio.id} />}
      <Link href="/reglages" aria-label="Réglages">
        <Avatar name={member?.studio.name} small />
      </Link>
    </span>
  );
}

/**
 * Her credits, always in sight (Tristan: « le nombre de crédits dispo doit être visible tout le temps »):
 * in the side menu and the phone's header, to Réglages › Abonnement et crédits. Refreshed with the page (StudioLive).
 */
async function Credits({ studioId, wide = false }: { studioId: string; wide?: boolean }) {
  const balance = await creditBalance(studioId).catch(() => null);
  if (balance === null) return null;
  const low = balance < 20;
  return (
    <Link
      href="/reglages#credits"
      aria-label={`${balance} crédits disponibles`}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tabular-nums ${low ? "bg-peach text-peach-ink" : "bg-violet-tint text-violet"} ${wide ? "justify-between" : ""}`}
    >
      {wide ? <span className="font-semibold">Crédits</span> : null}
      <span>
        {balance}
        {wide ? "" : " crédits"}
      </span>
    </Link>
  );
}

function Avatar({ name, small = false }: { name: string | null | undefined; small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-peach font-extrabold text-peach-ink ${
        small ? "size-9 text-xs" : "size-10 text-sm"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarPlaceholder() {
  return <span className="size-9 shrink-0 rounded-full bg-soft" />;
}

/** Live updates for the signed-in studio (see StudioLive). */
export async function LiveUpdates() {
  const { member } = await getStudioContext();
  if (!member) return null;
  return (
    <>
      <StudioLive studioId={member.studio.id} />
      <WorkPill studioId={member.studio.id} />
    </>
  );
}
