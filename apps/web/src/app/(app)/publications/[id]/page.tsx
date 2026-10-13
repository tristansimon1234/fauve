import { alignSlides, platformSchema, postKindSchema, postStatusSchema, type PostKind, type PostStatus } from "@fauve/agent";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { ArrowLeftIcon, ChatIcon, ClockIcon, InstagramIcon, TikTokIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { DeleteButton } from "@/components/delete-button";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatSeconds, kindLabels, platformLabels } from "@/lib/format";
import { whatsappLink } from "@/lib/public-env";
import { loadEditorData } from "@/lib/montage-editor-data";
import { loadMontageInputs } from "@/lib/render/render-post";
import { postSlides } from "@/lib/render/slides";
import { getStudioContext, rows, signMediaUrls, type Db } from "@/lib/studio";
import { deletePost } from "./actions";
import { MontageEditor } from "./montage-editor";
import { PostEditor } from "./post-editor";
import { SlidesSection } from "./slides-section";

export const metadata: Metadata = { title: "Publication" };

const postSchema = z.object({
  id: z.uuid(),
  kind: postKindSchema,
  title: z.string(),
  status: postStatusSchema,
  scheduled_at: z.string().nullable(),
  platforms: z.array(platformSchema),
  caption: z.string().nullable(),
  hashtags: z.array(z.string()),
  agent_note: z.string().nullable(),
  edit_plan_id: z.uuid().nullable(),
  render_id: z.uuid().nullable(),
  media_ids: z.array(z.uuid()).catch([]),
  slides: z.unknown(),
});

// Read leniently: an older or partial plan still shows what it can.
const planViewSchema = z.object({
  duration: z.number().optional(),
  segments: z
    .array(z.object({ clip_id: z.string(), in: z.number(), out: z.number(), zoom: z.string().optional() }))
    .catch([]),
  texts: z.array(z.object({ text: z.string(), from: z.number(), to: z.number(), style: z.string() })).catch([]),
  subtitles: z.boolean().optional(),
});
type PlanView = z.infer<typeof planViewSchema>;

const renderSchema = z.object({
  id: z.uuid(),
  status: z.enum(["queued", "rendering", "done", "failed"]),
  storage_path: z.string().nullable(),
});
type Render = z.infer<typeof renderSchema>;

const textStyleLabels: Record<string, string> = { hook: "Accroche", band: "Bandeau", caption: "Sous-titre" };
const segmentColors = ["bg-violet", "bg-coral", "bg-lilac", "bg-peach-ink", "bg-violet-hover"];
const LOCKED: readonly PostStatus[] = ["published", "measured"];

export default function PostPage({ params }: PageProps<"/publications/[id]">) {
  return (
    <main className="flex min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-10 sm:pt-8">
      <Link href="/calendrier" className="inline-flex items-center gap-2 self-start text-sm font-bold text-violet">
        <ArrowLeftIcon size={18} />
        Calendrier
      </Link>
      <Suspense fallback={<PageLoading title="Publication" />}>
        <PostDetail params={params} />
      </Suspense>
    </main>
  );
}

async function PostDetail({ params }: { params: PageProps<"/publications/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { db, member } = await getStudioContext();
  if (!member) return <NoStudio />;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;

  const { data, error } = await db
    .from("posts")
    .select("id, kind, title, status, scheduled_at, platforms, caption, hashtags, agent_note, edit_plan_id, render_id, media_ids, slides")
    .eq("id", id)
    .eq("studio_id", studioId)
    .maybeSingle();
  if (error) throw new Error(`posts: ${error.message}`);
  if (!data) notFound();
  const post = postSchema.parse(data);

  const plan = await loadPlan(db, post);
  const render = await loadRender(db, plan?.id ?? null, post.render_id);
  const [videoUrls, clipLabels] = await Promise.all([
    render?.status === "done" && render.storage_path
      ? signMediaUrls(db, studioId, [render.storage_path])
      : Promise.resolve(new Map<string, string>()),
    plan ? loadClipLabels(db, plan.view) : Promise.resolve(new Map<string, string>()),
  ]);
  const videoUrl = render?.storage_path ? videoUrls.get(render.storage_path) : undefined;
  // Photo post, carousel or story without a montage: the post's own photos and videos, in order.
  const media = videoUrl ? [] : await loadPostMedia(db, studioId, post.media_ids);

  const canEdit = !LOCKED.includes(post.status);
  const editor = canEdit && plan ? await loadEditorData(studioId, plan.id).catch(() => null) : null;
  const isVideo = post.kind === "reel" || post.kind === "story";
  // Text over the photos of a carousel or photo post, editable by hand.
  const photos = Object.fromEntries(media.filter((m) => !m.video).map((m) => [m.id, m.url]));
  const slides =
    canEdit && (post.kind === "carousel" || post.kind === "post") && Object.keys(photos).length
      ? {
          plan: postSlides({ slides: post.slides, media_ids: post.media_ids }) ?? alignSlides({ template: "doux", slides: [] }, post.media_ids),
          brand: await loadMontageInputs(studioId, { segments: [] }).then((i) => ({ name: i.studioName, accent: i.accent, logoUrl: i.logoUrl, fonts: i.fonts })),
        }
      : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <StatusPill status={post.status} className="px-2.5 text-xs" />
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">{post.title}</h1>
          <p className="text-[15px] text-muted">
            {kindLabels[post.kind]} ·{" "}
            {post.scheduled_at ? `prévu ${formatDateTime(post.scheduled_at, tz)}` : "date à définir"}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <a href={whatsappLink(`Pour « ${post.title} » : `)} className="btn btn-secondary">
            <ChatIcon size={18} />
            Demander une modif
          </a>
          <DeleteButton
            action={deletePost.bind(null, post.id)}
            redirectTo="/calendrier"
            confirmText={
              LOCKED.includes(post.status)
                ? "Supprimer cette publication de Fauve ? Elle reste en ligne sur Instagram."
                : "Supprimer cette publication, son montage et ses versions ?"
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[0_1_340px] flex-col items-center gap-3.5">
          {!videoUrl && media.length > 0 ? (
            <MediaPreview media={media} kind={post.kind} />
          ) : videoUrl ? (
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full max-w-[320px] rounded-[22px] bg-ink object-contain shadow-[0_18px_40px_rgba(28,21,48,.18)]"
            />
          ) : (
            <div className="flex aspect-[9/16] w-full max-w-[320px] flex-col items-center justify-center gap-4 rounded-[22px] bg-soft px-6 text-center">
              <Orb size={56} />
              <p className="text-sm leading-relaxed text-muted">{previewMessage(post.status, plan !== null, render)}</p>
            </div>
          )}
          {isVideo && (
            <p className="text-center text-[13px] text-muted">Ajoute le son tendance dans l’appli au moment de publier.</p>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5.5">
          <div className="flex flex-col gap-2">
            <PostEditor
              postId={post.id}
              caption={post.caption ?? ""}
              canEdit={canEdit}
              canValidate={post.status === "draft"}
            />
            {post.hashtags.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {post.hashtags.map((h) => (
                  <span key={h} className="rounded-full bg-soft px-2.5 py-1.5 text-[13px] font-semibold">
                    #{h.replace(/^#/, "")}
                  </span>
                ))}
              </span>
            )}
          </div>

          {(post.status === "draft" || post.status === "validated") && (
            <p className="rounded-2xl bg-violet-tint px-4 py-3.5 text-sm leading-normal">
              {post.status === "validated" ? <strong>Validée. </strong> : null}
              Une fois validée, Fauve la publie sur Instagram à l’horaire prévu, si ton compte est connecté. TikTok
              arrive bientôt.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold">Publier sur</span>
              <div className="flex flex-wrap gap-2">
                {post.platforms.length ? (
                  post.platforms.map((p) => (
                    <span
                      key={p}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border-[1.5px] border-violet bg-violet-soft px-3.5 text-sm font-bold text-violet"
                    >
                      {p === "tiktok" ? <TikTokIcon size={16} /> : <InstagramIcon size={16} />}
                      {platformLabels[p]}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">Aucune plateforme choisie</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold">Quand</span>
              <span className="inline-flex h-10 items-center gap-2 text-sm">
                <ClockIcon size={16} className="text-violet" />
                {post.scheduled_at ? formatDateTime(post.scheduled_at, tz) : "Date à définir avec Fauve"}
              </span>
            </div>
          </div>

          {plan && !editor && <PlanSection plan={plan.view} clipLabels={clipLabels} />}

          {post.agent_note && (
            <div className="flex items-start gap-3 rounded-[18px] bg-soft p-4">
              <Orb size={28} className="shrink-0" />
              <p className="text-sm leading-normal">{post.agent_note}</p>
            </div>
          )}
        </div>
      </div>

      {slides && (
        <section aria-labelledby="slides-editor" className="flex flex-col gap-4 border-t border-line pt-8">
          <div className="flex flex-col gap-1">
            <h2 id="slides-editor" className="text-[24px] font-extrabold tracking-[-0.02em]">
              Texte sur les photos
            </h2>
            <p className="text-[15px] text-muted">
              Une accroche, un message par photo : glisse chaque texte où tu veux, change ses mots, sa taille, son fond. Gratuit.
            </p>
          </div>
          <SlidesSection postId={post.id} initialPlan={slides.plan} photos={photos} brand={slides.brand} />
        </section>
      )}

      {editor && (
        <section aria-labelledby="montage-editor" className="flex flex-col gap-4 border-t border-line pt-8">
          <div className="flex flex-col gap-1">
            <h2 id="montage-editor" className="text-[24px] font-extrabold tracking-[-0.02em]">
              Modifier le montage
            </h2>
            <p className="text-[15px] text-muted">Change les textes, l’ordre et la durée des scènes, coupe tes vidéos. Gratuit.</p>
          </div>
          <MontageEditor
            postId={post.id}
            initialPlan={editor.plan}
            inputs={editor.inputs}
            clipDurations={editor.clipDurations}
            clipLabels={Object.fromEntries(clipLabels)}
          />
        </section>
      )}
    </>
  );
}

async function loadPlan(db: Db, post: z.infer<typeof postSchema>): Promise<{ id: string; view: PlanView } | null> {
  const base = () => db.from("edit_plans").select("id, plan").eq("post_id", post.id);
  const { data, error } = post.edit_plan_id
    ? await base().eq("id", post.edit_plan_id).maybeSingle()
    : await base().order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`edit_plans: ${error.message}`);
  if (!data) return null;
  const view = planViewSchema.safeParse(data.plan);
  return view.success ? { id: String(data.id), view: view.data } : null;
}

async function loadRender(db: Db, editPlanId: string | null, preferredId: string | null): Promise<Render | null> {
  // The post's own render first, otherwise the latest render of the plan shown.
  const filters = [preferredId && `id.eq.${preferredId}`, editPlanId && `edit_plan_id.eq.${editPlanId}`].filter(Boolean);
  if (!filters.length) return null;
  const list = rows(
    renderSchema,
    await db
      .from("renders")
      .select("id, status, storage_path")
      .or(filters.join(","))
      .order("created_at", { ascending: false })
      .limit(10),
    "renders",
  );
  return (
    list.find((r) => r.id === preferredId && r.status === "done") ??
    list.find((r) => r.status === "done" && r.storage_path) ??
    list[0] ??
    null
  );
}

/** Short labels for the clips used by the plan, from Fauve's video analysis. */
async function loadClipLabels(db: Db, plan: PlanView): Promise<Map<string, string>> {
  const ids = [...new Set(plan.segments.map((s) => s.clip_id))].filter((id) => z.uuid().safeParse(id).success);
  const labels = new Map<string, string>();
  if (!ids.length) return labels;
  const { data } = await db
    .from("clip_analyses")
    .select("media_id, analysis, created_at")
    .in("media_id", ids)
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    const summary = z.object({ summary: z.string() }).safeParse(row.analysis);
    if (summary.success && !labels.has(row.media_id)) labels.set(row.media_id, summary.data.summary);
  }
  return labels;
}

function previewMessage(status: PostStatus, hasPlan: boolean, render: Render | null): string {
  if (render?.status === "queued" || render?.status === "rendering") return "Le montage est en cours de fabrication.";
  if (render?.status === "failed") return "Le montage n’a pas abouti. Demande à Fauve de le relancer sur WhatsApp.";
  if (render?.status === "done") return "La vidéo montée n’est pas disponible pour le moment.";
  if (hasPlan) return "Le plan de montage est prêt. La vidéo montée apparaîtra ici.";
  if (status === "planned" || status === "content_requested") {
    return "J’attends encore les vidéos pour cette publication. Envoie-les à Fauve sur WhatsApp.";
  }
  if (status === "media_received") return "Vidéos bien reçues : Fauve prépare le brouillon.";
  return "Pas d’aperçu pour cette publication.";
}

function PlanSection({ plan, clipLabels }: { plan: PlanView; clipLabels: Map<string, string> }) {
  const total = plan.duration ?? plan.segments.reduce((sum, s) => sum + Math.max(0, s.out - s.in), 0);
  return (
    <section className="flex flex-col gap-3.5 rounded-[18px] border border-line p-4.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">Montage · {formatSeconds(total)}</h2>
        <span className="text-[13px] text-muted">
          {plan.segments.length} {plan.segments.length > 1 ? "plans" : "plan"}
          {plan.subtitles ? " · sous-titres" : ""}
        </span>
      </div>
      {plan.segments.length > 0 && (
        <>
          <div className="flex h-12 gap-1">
            {plan.segments.map((s, i) => (
              <span
                key={i}
                className={`flex items-end rounded-[10px] px-2 py-1.5 text-[11px] font-bold text-white ${
                  segmentColors[i % segmentColors.length]
                }`}
                style={{ flex: Math.max(0.5, s.out - s.in) }}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <ol className="flex flex-col gap-2 text-sm">
            {plan.segments.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-16 shrink-0 font-semibold text-muted">Plan {i + 1}</span>
                <span className="min-w-0">
                  {formatSeconds(Math.max(0, s.out - s.in))}
                  {s.zoom === "light" ? " · léger zoom" : ""}
                  {clipLabels.get(s.clip_id) ? ` · ${clipLabels.get(s.clip_id)}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {plan.texts.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
          {plan.texts.map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="w-24 shrink-0 font-semibold text-muted">
                {formatSeconds(t.from).replace(" s", "")}–{formatSeconds(t.to)}
              </span>
              <span className="min-w-0">
                {textStyleLabels[t.style] ?? "Texte"} « {t.text} »
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type PostMedia = { id: string; url: string; video: boolean };

async function loadPostMedia(db: Db, studioId: string, ids: string[]): Promise<PostMedia[]> {
  if (!ids.length) return [];
  const { data } = await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", ids);
  const byId = new Map((data ?? []).map((m) => [m.id as string, m]));
  const urls = await signMediaUrls(db, studioId, (data ?? []).map((m) => m.storage_path as string));
  return ids.flatMap((id) => {
    const m = byId.get(id);
    const url = m ? urls.get(m.storage_path as string) : undefined;
    if (!m || !url) return [];
    return [{ id, url, video: m.kind === "video" || String(m.mime_type ?? "").startsWith("video/") }];
  });
}

/** Photos as they will appear: 4:5 in the feed (a carousel swipes), 9:16 for a story. */
function MediaPreview({ media, kind }: { media: PostMedia[]; kind: PostKind }) {
  const ratio = kind === "story" ? "aspect-[9/16]" : "aspect-[4/5]";
  const shown = kind === "carousel" ? media.slice(0, 10) : media.slice(0, 1);
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2">
      <ul
        className={`flex snap-x snap-mandatory overflow-x-auto rounded-[22px] bg-ink shadow-[0_18px_40px_rgba(28,21,48,.18)] ${ratio}`}
        aria-label={kind === "carousel" ? `Carrousel de ${shown.length} éléments` : "Aperçu"}
      >
        {shown.map((m) => (
          <li key={m.id} className="h-full w-full shrink-0 snap-center">
            {m.video ? (
              <video src={m.url} controls playsInline preload="metadata" className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className="size-full object-cover" />
            )}
          </li>
        ))}
      </ul>
      {kind === "carousel" && <p className="text-center text-[13px] text-muted">{shown.length} éléments · fais défiler</p>}
    </div>
  );
}
