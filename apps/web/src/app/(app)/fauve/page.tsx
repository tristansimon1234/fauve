import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { CalendarIcon, CheckIcon, FilmIcon, WhatsAppIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { StatusPill } from "@/components/status-pill";
import { localDateOf, weekOf } from "@/lib/dates";
import { formatShortDate, formatShortDateTime, kindLabels, plural } from "@/lib/format";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext, POST_COLUMNS, postRowSchema, rows, SHOT_COLUMNS, shotRowSchema, type PostRow } from "@/lib/studio";

export const metadata: Metadata = { title: "Fauve" };

const UPCOMING = ["planned", "content_requested", "media_received", "validated", "scheduled"] as const;

const messageSchema = z.object({
  id: z.uuid(),
  direction: z.enum(["inbound", "outbound"]),
  type: z.string(),
  body: z.string().nullable(),
  created_at: z.string(),
});

const mediaLabels: Record<string, string> = {
  video: "Vidéo",
  image: "Photo",
  audio: "Message vocal",
  document: "Document",
  sticker: "Sticker",
};

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
    db
      .from("whatsapp_messages")
      .select("id, direction, type, body, created_at")
      .eq("studio_id", studioId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const toValidate = rows(postRowSchema, drafts, "posts");
  const next = rows(postRowSchema, upcoming, "posts");
  const toFilm = rows(shotRowSchema, shots, "shot_requests");
  const thisWeek = rows(z.object({ status: z.string() }), weekPosts, "posts");
  const conversation = rows(messageSchema, messages, "whatsapp_messages").reverse();
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
        <Orb size={88} />
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
            Conversation récente
          </h2>
          <p className="text-[13px] text-muted">Tes derniers échanges avec Fauve sur WhatsApp, pour retrouver une demande.</p>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[22px] border border-line bg-white p-4 sm:p-5">
          {conversation.length ? (
            conversation.map((m) => <Bubble key={m.id} message={m} tz={tz} />)
          ) : (
            <p className="py-6 text-center text-sm text-muted">
              Pas encore de message. Écris à Fauve sur WhatsApp pour commencer.
            </p>
          )}
        </div>
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

function Bubble({ message, tz }: { message: z.infer<typeof messageSchema>; tz: string }) {
  const media = mediaLabels[message.type];
  if (!message.body && !media) return null;
  const mine = message.direction === "inbound";
  return (
    <div className={`flex max-w-[85%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start self-start"}`}>
      <div
        className={`px-3.5 py-2.5 text-[15px] leading-[1.45] whitespace-pre-wrap ${
          mine
            ? "rounded-[16px_16px_4px_16px] bg-violet text-white"
            : "rounded-[16px_16px_16px_4px] border border-line bg-soft"
        }`}
      >
        {media && (
          <span className={`block text-[13px] font-bold ${mine ? "text-white/85" : "text-muted"}`}>
            {media} envoyé{media === "Vidéo" || media === "Photo" ? "e" : ""}
          </span>
        )}
        {message.body}
      </div>
      <span className="px-1 text-[11px] text-muted">
        {mine ? "Toi" : "Fauve"} · {formatShortDateTime(message.created_at, tz)}
      </span>
    </div>
  );
}
