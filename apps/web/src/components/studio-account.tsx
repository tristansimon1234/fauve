import Link from "next/link";
import { InstagramIcon, TikTokIcon } from "@/components/icons";
import { initials } from "@/lib/format";
import { tiktokEnabled } from "@/lib/social/tiktok";
import { getSocialAccounts, getStudioContext } from "@/lib/studio";
import { StudioLive } from "./studio-live";
import { WorkPill } from "./work-pill";

// Sidebar and header pieces of the app shell that depend on the signed-in member.

export async function SidebarAccount() {
  const { db, member } = await getStudioContext();
  if (!member) return null;

  const accounts = (await getSocialAccounts(db, member.studio.id)).filter((a) => a.status === "connected");
  const studioName = member.studio.name ?? "Mon studio";
  // Each network not yet linked gets its own link (TikTok only when the app offers it).
  const missing = (["instagram", ...(tiktokEnabled() ? ["tiktok" as const] : [])] as const).filter(
    (platform) => !accounts.some((a) => a.platform === platform),
  );

  return (
    <>
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
      <Link href="/reglages" className="flex items-center gap-3 rounded-xl px-1.5 py-1 hover:bg-soft">
        <Avatar name={studioName} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold">{studioName}</span>
          <span className="truncate text-[13px] text-muted">
            {[member.first_name, member.role === "owner" ? "Gérante" : "Équipe"].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
    </>
  );
}

export async function HeaderAvatar() {
  const { member } = await getStudioContext();
  return (
    <Link href="/reglages" aria-label="Réglages">
      <Avatar name={member?.studio.name} small />
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
