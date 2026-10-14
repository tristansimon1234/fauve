import { alignSlides, platformSchema, postKindSchema, postStatusSchema, type PostKind, type PostStatus } from "@fauve/agent";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { ArrowLeftIcon, CheckIcon, ClockIcon, InstagramIcon, TikTokIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { DeleteButton } from "@/components/delete-button";
import { AskFauveButton } from "@/components/fauve-drawer";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime, formatSeconds, kindLabels, platformLabels } from "@/lib/format";
import { loadEditorData } from "@/lib/montage-editor-data";
import { loadMontageInputs } from "@/lib/render/render-post";
import { postSlides } from "@/lib/render/slides";
import { getStudioContext, rows, signMediaUrls, type Db } from "@/lib/studio";
import { listElements } from "@/lib/elements";
import { layoutsForEditor } from "@/lib/text-layers";
import { loadTextLooks } from "@/lib/text-looks";
import { versionKey } from "@/lib/version-key";
import { deletePost } from "./actions";
import { MontageEditor } from "./montage-editor";
import { PostEditor } from "./post-editor";
import { CarouselEditor } from "./carousel-editor";

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
const POST_FORM = "post-form";

export default function PostPage({ params }: PageProps<"/publications/[id]">) {
  return (
    <main className="flex min-w-0 flex-col gap-5 px-4 pt-5 pb-14 sm:px-8 sm:pt-6">
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
    .select("id, kind, title, status, scheduled_at, platforms, caption, hashtags, edit_plan_id, render_id, media_ids, slides")
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
    plan ? loadClipLabels(db, [...plan.view.segments.map((s) => s.clip_id), ...post.media_ids]) : Promise.resolve(new Map<string, string>()),
  ]);
  const videoUrl = render?.storage_path ? videoUrls.get(render.storage_path) : undefined;
  // Photo post, carousel or story without a montage: the post's own photos and videos, in order.
  const media = videoUrl ? [] : await loadPostMedia(db, studioId, post.media_ids);

  const canEdit = !LOCKED.includes(post.status);
  const editor = canEdit && plan ? await loadEditorData(studioId, plan.id, post.media_ids).catch(() => null) : null;
  const isVideo = post.kind === "reel" || post.kind === "story";
  // The studio's text looks (copied by Fauve from examples, or kept by hand), offered on every text.
  const looks = canEdit ? await loadTextLooks(studioId).catch(() => []) : [];
  // Text over the photos of a carousel or photo post, editable by hand.
  const photos = Object.fromEntries(media.filter((m) => !m.video).map((m) => [m.id, m.url]));
  const slides =
    canEdit && (post.kind === "carousel" || post.kind === "post") && Object.keys(photos).length
      ? {
          plan: postSlides({ slides: post.slides, media_ids: post.media_ids }) ?? alignSlides({ template: "doux", slides: [] }, post.media_ids),
          brand: await loadMontageInputs(studioId, { segments: [] }).then((i) => ({ name: i.studioName, accent: i.accent, logoUrl: i.logoUrl, fonts: i.fonts, colors: i.colors, customFonts: i.customFonts })),
          layouts: await layoutsForEditor(studioId),
          bank: (await listElements(studioId)).map(({ id, name, role, slots, js, fonts, base, box, sample, kitId, kitName }) => ({ id, name, role, slots, js, fonts, base, box, sample, kitId, kitName })),
        }
      : null;

  // The publication itself: caption, platforms, date, Fauve's note.
  const details = (
    <>
      <div className="flex flex-col gap-2">
        <PostEditor
          key={versionKey(post.caption, post.status)}
          postId={post.id}
          caption={post.caption ?? ""}
          canEdit={canEdit}
          canValidate={post.status === "draft"}
          formId={POST_FORM}
          compact
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

      {/* Where and when, in two quiet lines. */}
      <dl className="flex flex-col gap-2 rounded-[16px] bg-soft px-4 py-3 text-[14px]">
        <div className="flex items-center gap-2.5">
          <dt className="sr-only">Publier sur</dt>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {post.platforms.length ? (
              post.platforms.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 font-semibold">
                  {p === "tiktok" ? <TikTokIcon size={16} className="text-violet" /> : <InstagramIcon size={16} className="text-violet" />}
                  {platformLabels[p]}
                </span>
              ))
            ) : (
              <span className="text-muted">Aucune plateforme choisie</span>
            )}
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <dt className="sr-only">Quand</dt>
          <dd className="inline-flex items-center gap-1.5">
            <ClockIcon size={16} className="text-violet" />
            {post.scheduled_at ? formatDateTime(post.scheduled_at, tz) : "Date à définir avec Brigitte"}
          </dd>
        </div>
      </dl>
      {(post.status === "draft" || post.status === "validated") && (
        <p className="-mt-2 text-[12px] leading-snug text-muted">
          {post.status === "validated" ? "Validée : " : "Une fois validée, "}Brigitte la publie sur Instagram à l’horaire prévu, si ton compte est connecté.
        </p>
      )}

      {plan && !editor && <PlanSection plan={plan.view} clipLabels={clipLabels} />}

    </>
  );

  return (
    <>
      {/* One bar: back, what it is, and the actions (validating first). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link
          href="/calendrier"
          aria-label="Retour au calendrier"
          title="Calendrier"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink hover:bg-soft"
        >
          <ArrowLeftIcon size={18} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-[24px] leading-tight font-extrabold tracking-[-0.02em]">{post.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <StatusPill status={post.status} />
            {kindLabels[post.kind]} · {post.scheduled_at ? `prévu ${formatDateTime(post.scheduled_at, tz)}` : "date à définir"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AskFauveButton topic={{ postId: post.id, title: post.title }} label="Demander une modif" />
          {canEdit && post.status === "draft" && (
            // Submits the caption form, so a caption being edited is saved with the validation.
            <button type="submit" form={POST_FORM} name="intent" value="validate" className="btn btn-primary">
              <CheckIcon size={18} />
              Valider
            </button>
          )}
          <DeleteButton
            action={deletePost.bind(null, post.id)}
            redirectTo="/calendrier"
            compact
            confirmText={
              LOCKED.includes(post.status)
                ? "Supprimer cette publication de Brigitte ? Elle reste en ligne sur Instagram."
                : "Supprimer cette publication, son montage et ses versions ?"
            }
          />
        </div>
      </div>

      {slides ? (
        // Text over the photos, laid out like the montage editor: the publication, the photo, the selected photo's texts.
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(250px,290px)_minmax(0,1fr)_minmax(300px,360px)]">
          <div className="order-3 flex min-w-0 flex-col gap-4 xl:order-none">
            {details}
          </div>
          <CarouselEditor key={versionKey(slides.plan)} postId={post.id} postTitle={post.title} initialPlan={slides.plan} photos={photos} brand={slides.brand} looks={looks} layouts={slides.layouts} bank={slides.bank} />
        </div>
      ) : editor ? (
        // A video editor: the publication on the left, the montage in the middle, the selected scene on the right.
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(250px,290px)_minmax(0,1fr)_minmax(300px,340px)]">
          <div className="order-3 flex min-w-0 flex-col gap-4 xl:order-none">
            {details}
          </div>
          <MontageEditor
            key={versionKey(editor.plan)}
            postId={post.id}
            postTitle={post.title}
            initialPlan={editor.plan}
            inputs={editor.inputs}
            clipDurations={editor.clipDurations}
            clipLabels={Object.fromEntries(clipLabels)}
            looks={looks}
          />
        </div>
      ) : (
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
            {details}
          </div>
        </div>
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

/** Short labels for the clips (the plan's and the post's), from Fauve's video analysis. */
async function loadClipLabels(db: Db, clipIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(clipIds)].filter((id) => z.uuid().safeParse(id).success);
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
  if (render?.status === "failed") return "Le montage n’a pas abouti. Demande à Brigitte de le relancer sur WhatsApp.";
  if (render?.status === "done") return "La vidéo montée n’est pas disponible pour le moment.";
  if (hasPlan) return "Le plan de montage est prêt. La vidéo montée apparaîtra ici.";
  if (status === "planned" || status === "content_requested") {
    return "J’attends encore les vidéos pour cette publication. Envoie-les à Brigitte sur WhatsApp.";
  }
  if (status === "media_received") return "Vidéos bien reçues : Brigitte prépare le brouillon.";
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
