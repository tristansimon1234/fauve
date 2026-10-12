import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { CalendarIcon, CheckIcon, FilmIcon, WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { StatusPill } from "@/components/status-pill";
import { localDateOf, weekOf } from "@/lib/dates";
import { formatShortDate, formatShortDateTime, kindLabels, plural } from "@/lib/format";
import { whatsappLink } from "@/lib/public-env";
import { loadChat } from "./chat-actions";
import { FauveChat } from "./fauve-chat";
import { getStudioContext, POST_COLUMNS, postRowSchema, rows, SHOT_COLUMNS, shotRowSchema, type PostRow } from "@/lib/studio";

export const metadata: Metadata = { title: "Fauve" };
// The chat runs Fauve (and may queue a montage) inside a server action.
export const maxDuration = 300;

const UPCOMING = ["planned", "content_requested", "media_received", "validated", "scheduled"] as const;

export default function FauvePage() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-soft">
      <div className="flex justify-end px-4 py-4 sm:px-7 sm:py-5">
        <a
          href={whatsappLink()}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] font-bold"
        >
          <WhatsAppIcon size={16} />
          Continuer sur WhatsApp
        </a>
      </div>
      <div className="flex flex-1 flex-col items-center px-4 pb-10 sm:px-7">
        <div className="flex w-full max-w-[920px] flex-col gap-8">
          <Suspense fallback={<PageLoading title="Bonjour" />}>
            <Home />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Home() {
  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const now = new Date();
  const week = weekOf(localDateOf(now, tz), tz);

  const [drafts, upcoming, shots, weekPosts, messages] = await Promise.all([
    db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("studio_id", studioId)
      .eq("status", "draft")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(5),
    db
      .from("posts")
      .select(POST_COLUMNS)
      .eq("studio_id", studioId)
      .in("status", [...UPCOMING])
      .gte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    db
      .from("shot_requests")
      .select(SHOT_COLUMNS)
      .eq("studio_id", studioId)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    db
      .from("posts")
      .select("status")
      .eq("studio_id", studioId)
      .neq("status", "skipped")
      .gte("scheduled_at", week.start.toISOString())
      .lt("scheduled_at", week.end.toISOString()),
    loadChat(),
  ]);

  const toValidate = rows(postRowSchema, drafts, "posts");
  const next = rows(postRowSchema, upcoming, "posts");
  const toFilm = rows(shotRowSchema, shots, "shot_requests");
  const thisWeek = rows(z.object({ status: z.string() }), weekPosts, "posts");
  const published = thisWeek.filter((p) => p.status === "published" || p.status === "measured").length;

  const summary = [
    thisWeek.length
      ? `Cette semaine : ${plural(thisWeek.length, "publication prévue", "publications prévues")}, ${plural(published, "publiée", "publiées")}.`
      : "Rien n’est encore prévu cette semaine.",
    toValidate.length ? `${plural(toValidate.length, "brouillon attend", "brouillons attendent")} ta validation.` : "",
    toFilm.length ? `${plural(toFilm.length, "plan", "plans")} à filmer.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <Mascot size={110} />
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] sm:text-[48px]">
          Bonjour{member.first_name ? " " : ""}
          {member.first_name && <span className="accent">{member.first_name}</span>}
        </h1>
        <p className="max-w-[560px] text-[17px] text-muted">{summary}</p>
      </div>

      <section aria-labelledby="attente" className="flex flex-col gap-3">
        <h2 id="attente" className="text-lg font-bold">
          Ce qui t’attend
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
          <Card title="À valider" icon={<CheckIcon size={18} />} empty="Aucun brouillon à valider.">
            {toValidate.map((p) => (
              <PostLine key={p.id} post={p} tz={tz} />
            ))}
          </Card>
          <Card
            title="À filmer"
            icon={<FilmIcon size={18} />}
            empty="Rien à filmer pour l’instant."
            footer={
              toFilm.length > 0 && (
                <Link href="/calendrier" className="text-[13px] font-bold text-violet">
                  Voir la liste de tournage
                </Link>
              )
            }
          >
            {toFilm.map((s) => (
              <div key={s.id} className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{s.label}</span>
                {(s.hint || s.due_date) && (
                  <span className="text-xs text-muted">
                    {[s.due_date && `Pour le ${formatShortDate(`${s.due_date}T12:00:00Z`, "UTC")}`, s.hint]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
            ))}
          </Card>
          <Card
            title="Prochaines publications"
            icon={<CalendarIcon size={18} />}
            empty="Aucune publication programmée."
            footer={
              <Link href="/calendrier" className="text-[13px] font-bold text-violet">
                Ouvrir le calendrier
              </Link>
            }
          >
            {next.map((p) => (
              <PostLine key={p.id} post={p} tz={tz} />
            ))}
          </Card>
        </div>
      </section>

      <section aria-labelledby="conversation" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="conversation" className="text-lg font-bold">
            Parle à Fauve
          </h2>
          <p className="text-[13px] text-muted">
            La même conversation que sur WhatsApp : demande un montage, un planning, un bilan. Les vidéos s’affichent ici.
          </p>
        </div>
        <FauveChat initial={messages} timezone={tz} />
      </section>

      <div className="flex flex-col items-center gap-2.5 text-center">
        <a href={whatsappLink()} className="btn btn-primary h-[52px] px-6.5">
          <WhatsAppIcon />
          Continuer sur WhatsApp
        </a>
        <p className="max-w-[460px] text-[13px] leading-normal text-muted">
          Envoie tes vidéos à Fauve sur WhatsApp, de préférence en tant que document pour garder toute leur qualité.
        </p>
      </div>
    </>
  );
}

function Card({
  title,
  icon,
  empty,
  footer,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  footer?: React.ReactNode;
  children: React.ReactNode[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <span className="text-violet">{icon}</span>
        {title}
      </h3>
      {children.length ? children : <p className="text-sm text-muted">{empty}</p>}
      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  );
}

function PostLine({ post, tz }: { post: PostRow; tz: string }) {
  return (
    <Link href={`/publications/${post.id}`} className="flex items-start justify-between gap-3 hover:text-violet">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{post.title}</span>
        <span className="text-xs text-muted">
          {kindLabels[post.kind]}
          {post.scheduled_at ? ` · ${formatShortDateTime(post.scheduled_at, tz)}` : " · date à définir"}
        </span>
      </span>
      <StatusPill status={post.status} className="shrink-0" />
    </Link>
  );
}
