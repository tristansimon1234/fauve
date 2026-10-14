import "server-only";
import {
  assertTransition,
  canTransition,
  postStatusSchema,
  type PostKind,
  type ReplyExtras,
  type ToolHandlers,
  slidesPlanSchema,
  textLookSchema,
  AUTO_START_MAX_CREDITS,
  DEFAULT_EFFORT,
  EFFORTS,
  MAX_FREE_SCENES,
  effortSchema,
  editPlanSchema,
  effortPitch,
  otherEffort,
  type Effort,
  type TextLook,
  addFacts,
  onboardingStepOf,
  readMemory,
  removeFacts,
  brandProfileSchema,
  RESTYLE,
  withAdjustment,
} from "@fauve/agent";
import { createLoginLink } from "@/lib/auth/login-link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { acceptQuote, createMontageQuote, lastPresentedQuote } from "@/lib/credits";
import { startMontage } from "@/lib/montage-start";
import { montageStatus } from "@/lib/montage-status";
import { analyzePerformance, latestReport } from "@/lib/performance";
import { setReaction } from "@/lib/reactions";
import { sendReaction } from "@/lib/whatsapp/client";
import { notifyFailure, renderAndDeliver, renderSlidesAndDeliver } from "@/lib/render/deliver";
import { saveSlides } from "@/lib/render/slides";
import { mediaComments, mediaInsights, recentMedia, replyToComment } from "@/lib/social/instagram";
import { instagramAccount, publishIfDue } from "@/lib/social/publish";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { blockFor, keepTextLooks, loadTextLooks, lookDefaults, readTextExample, restyleTexts } from "@/lib/text-looks";
import { elementInstance, listElements, loadElement, markElementsUsed, placeElements } from "@/lib/elements";
import { startElements } from "@/lib/elements-start";
import { addToMoodboard } from "@/lib/moodboard-add";
import { completeFirstPost, isFirstReel } from "@/lib/onboarding";
import { listInspirations } from "@/lib/inspirations";
import { freeSlots } from "@/lib/slots";
import { blurMontage, retouchPostPhotos } from "@/lib/retouch";
import { readWebsite, WebsiteError } from "./website";

export type ToolContext = {
  studioId: string;
  memberId: string;
  /** WhatsApp id of the manager, and the inbound message to react to (WhatsApp channel only). */
  waId?: string;
  replyToMessageId?: string;
  /** Web chat: the stored message Fauve can react to. */
  reactToRowId?: string;
  /** Filled by react_to_message so the caller knows an emoji was sent. */
  reactions: string[];
  /** Jobs the caller runs after sending the reply (render, then deliver the video). */
  afterReply: (() => Promise<void>)[];
  /** Filled by reply_with: buttons and cards the caller shows under the reply. */
  extras: ReplyExtras;
  /**
   * Ids made during this turn (quote, post), stored with the reply and shown to the
   * model on the next turns: the history keeps only text, not tool results.
   */
  notes: string[];
  /** The studio's time zone, for the local dates in tool results. */
  timezone?: string;
};

/**
 * Tool results as JSON. Every object with a scheduled_at also gets « quand », the
 * local day and time (« mardi 13 octobre à 18:00 »): the model must never work
 * out a weekday or a time zone itself.
 */
function jsonIn(timeZone: string) {
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" });
  return (value: unknown) =>
    JSON.stringify(value, (_key, v: unknown) => {
      if (v && typeof v === "object" && !Array.isArray(v) && "scheduled_at" in v && typeof v.scheduled_at === "string") {
        const at = new Date(v.scheduled_at);
        if (!Number.isNaN(at.getTime())) return { ...v, quand: `${day.format(at)} à ${time.format(at)}` };
      }
      return v;
    });
}

type DbResult = { data: unknown; error: { message: string } | null };

/** For writes: fail loudly, the model gets the error as a tool result. */
function check(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message);
}

/** For reads: the row(s) must exist. */
function unwrap<R extends DbResult>(result: R): NonNullable<R["data"]> {
  check(result);
  if (result.data === null || result.data === undefined) throw new Error("Not found");
  return result.data as NonNullable<R["data"]>;
}

async function nextVersion(table: "brand_profiles" | "edit_plans", column: "studio_id" | "post_id", id: string) {
  const db = supabaseAdmin();
  const { data } = await db.from(table).select("version").eq(column, id).order("version", { ascending: false }).limit(1);
  return ((data?.[0]?.version as number | undefined) ?? 0) + 1;
}

/** Database-backed implementations of Fauve's tools, scoped to one studio. */
/** What a post still needs before it can go out, per format (null when ready). */
function missingContent(kind: PostKind, hasRender: boolean, media: number): string | null {
  if (kind === "reel" && !hasRender) return "Pas encore de vidéo montée : fais d'abord le montage.";
  if (kind === "post" && media < 1) return "Il faut une photo pour ce post : ajoute son media_id (update_post media_ids).";
  if (kind === "carousel" && media < 2) return "Un carrousel demande 2 à 10 photos ou vidéos (update_post media_ids, dans l'ordre).";
  if (kind === "story" && !hasRender && media < 1) return "Il faut une photo, une vidéo ou un montage pour cette story.";
  return null;
}

export function createToolHandlers(ctx: ToolContext): ToolHandlers {
  const db = supabaseAdmin();
  const json = jsonIn(ctx.timezone ?? "Europe/Paris");
  const { studioId } = ctx;
  // A quote made during this turn cannot be started in it: the manager must see the price first.
  const turnStartedAt = new Date();
  /** Posts whose render already waits for the end of this turn. */
  const rendering = new Set<string>();

  /** Media ids given by the model must be this studio's. */
  async function assertOwnMedia(ids: string[]) {
    const { data } = await db.from("media_assets").select("id").eq("studio_id", studioId).in("id", ids);
    if ((data?.length ?? 0) !== new Set(ids).size) throw new Error("Un des media_id n'appartient pas à ce studio.");
  }

  return {
    async get_studio_context() {
      const [studio, member, plan, accounts, brand] = await Promise.all([
        db.from("studios").select("name, timezone, onboarding_step, website_url, booking_url").eq("id", studioId).single(),
        db.from("members").select("first_name, role").eq("id", ctx.memberId).single(),
        db.from("content_plans").select("posts_per_week, stories_per_week, platforms, themes").eq("studio_id", studioId).maybeSingle(),
        db.from("social_accounts").select("platform, handle, status").eq("studio_id", studioId),
        db.from("brand_profiles").select("version, profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1),
      ]);
      return json({
        studio: unwrap(studio),
        manager: unwrap(member),
        content_plan: plan.data,
        social_accounts: unwrap(accounts),
        brand_profile: unwrap(brand)[0] ?? null,
      });
    },

    async update_onboarding(input) {
      const studioUpdate: Record<string, unknown> = {};
      if (input.studio_name) studioUpdate.name = input.studio_name;
      if (input.business_type) studioUpdate.business_type = input.business_type;
      if (input.step) studioUpdate.onboarding_step = input.step;
      if (input.website_url) studioUpdate.website_url = input.website_url;
      if (input.booking_url) studioUpdate.booking_url = input.booking_url;
      if (Object.keys(studioUpdate).length) check(await db.from("studios").update(studioUpdate).eq("id", studioId));
      if (input.first_name) check(await db.from("members").update({ first_name: input.first_name }).eq("id", ctx.memberId));
      if (input.posts_per_week !== undefined || input.stories_per_week !== undefined || input.platforms) {
        const planUpdate: Record<string, unknown> = { studio_id: studioId };
        if (input.posts_per_week !== undefined) planUpdate.posts_per_week = input.posts_per_week;
        if (input.stories_per_week !== undefined) planUpdate.stories_per_week = input.stories_per_week;
        if (input.platforms) planUpdate.platforms = input.platforms;
        check(await db.from("content_plans").upsert(planUpdate, { onConflict: "studio_id" }));
      }
      return "ok";
    },

    async read_website({ url }) {
      try {
        return json(await readWebsite(url));
      } catch (error) {
        if (error instanceof WebsiteError) {
          console.warn("read_website failed", url, error.message);
          return json({ error: error.message });
        }
        throw error;
      }
    },

    async get_connect_link() {
      const { data: member } = await db.from("members").select("phone_e164").eq("id", ctx.memberId).single();
      const url = await createLoginLink(member?.phone_e164 as string, "/connect", "connect_social");
      return json({ url, expires_in_minutes: 15 });
    },

    async get_post_link({ post_id }) {
      const { data: post } = await db.from("posts").select("id").eq("id", post_id).eq("studio_id", studioId).maybeSingle();
      if (!post) return json({ error: "Publication introuvable dans ce studio." });
      // In the app she is already signed in: the post's card opens its page, no link to paste.
      if (!ctx.waId) {
        ctx.extras.posts = [post_id];
        return json({
          carte: "affichée sous ton message",
          note: "Elle est dans l'application : la carte de la publication s'affiche sous ton message et ouvre sa page en un clic. N'écris aucun lien.",
        });
      }
      const { data: member } = await db.from("members").select("phone_e164").eq("id", ctx.memberId).single();
      const url = await createLoginLink(member?.phone_e164 as string, `/v/${post_id}`, "open_post");
      return json({ url, expires_in_minutes: 15 });
    },

    async list_media({ kind, days, limit }) {
      let query = db
        .from("media_assets")
        .select("id, kind, source, mime_type, duration, width, height, created_at, regions")
        .eq("studio_id", studioId)
        .neq("source", "render")
        .gt("created_at", new Date(Date.now() - days * 24 * 3600_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(limit);
      if (kind !== "all") query = query.eq("kind", kind);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      // What is in a video, as Gemini watched it (when it did).
      const videos = rows.filter((r) => r.kind === "video").map((r) => r.id as string);
      const { data: analyses } = videos.length
        ? await db.from("clip_analyses").select("media_id, analysis").in("media_id", videos).order("created_at", { ascending: false })
        : { data: [] };
      const summaries = new Map<string, string>();
      for (const a of analyses ?? []) {
        const summary = (a.analysis as { summary?: string } | null)?.summary;
        if (summary && !summaries.has(a.media_id as string)) summaries.set(a.media_id as string, summary);
      }
      const when = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: ctx.timezone ?? "Europe/Paris" });
      const sources: Record<string, string> = { whatsapp: "WhatsApp", web_upload: "app", library: "médiathèque" };
      return json({
        medias: rows.map((r) => {
          const w = r.width as number | null;
          const h = r.height as number | null;
          return {
            media_id: r.id,
            type: r.kind === "video" ? "vidéo" : "photo",
            recue: when.format(new Date(r.created_at as string)),
            par: sources[r.source as string] ?? r.source,
            ...(w && h ? { format: w > h ? "paysage" : w < h ? "portrait" : "carré" } : {}),
            ...(r.duration ? { duree_s: Number(r.duration) } : {}),
            ...(summaries.get(r.id as string) ? { contenu: summaries.get(r.id as string) } : {}),
            ...((r.regions as { notes?: string } | null)?.notes ? { contenu: (r.regions as { notes: string }).notes } : {}),
          };
        }),
        note: rows.length
          ? "Prends celles dont elle parle (souvent les plus récentes, envoyées ensemble) et enchaîne sans lui redemander : create_post avec ces media_ids, puis le texte (write_on_photos) ou le montage."
          : "Rien dans la médiathèque sur cette période : dis-le simplement et propose de les glisser ici.",
      });
    },

    async get_calendar({ from, to }) {
      const posts = unwrap(
        await db
          .from("posts")
          .select("id, kind, title, scheduled_at, status, platforms, caption, hashtags")
          .eq("studio_id", studioId)
          .gte("scheduled_at", from)
          .lte("scheduled_at", to)
          .order("scheduled_at"),
      );
      return json({ posts });
    },

    async create_post(input) {
      if (input.media_ids?.length) await assertOwnMedia(input.media_ids);
      const post = unwrap(
        await db
          .from("posts")
          .insert({ studio_id: studioId, status: "planned", ...input })
          .select("id, kind, title, scheduled_at, status")
          .single(),
      );
      ctx.notes.push(`publication créée « ${post.title as string} » post_id=${post.id as string}`);
      await completeFirstPost(studioId);
      return json({ post });
    },

    async update_post({ post_id, status, ...fields }) {
      if (fields.media_ids?.length) await assertOwnMedia(fields.media_ids);
      const current = unwrap(
        await db.from("posts").select("status").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (status) assertTransition(postStatusSchema.parse(current.status), status);
      const post = unwrap(
        await db
          .from("posts")
          .update({ ...fields, ...(status ? { status } : {}) })
          .eq("id", post_id)
          .eq("studio_id", studioId)
          .select("id, title, status, scheduled_at")
          .single(),
      );
      return json({ post });
    },

    async request_content({ post_id, label, hint, due_date }) {
      check(await db.from("shot_requests").insert({ studio_id: studioId, post_id, label, hint, due_date }));
      if (post_id) {
        const current = unwrap(
          await db.from("posts").select("status").eq("id", post_id).eq("studio_id", studioId).single(),
        );
        if (canTransition(postStatusSchema.parse(current.status), "content_requested")) {
          check(await db.from("posts").update({ status: "content_requested" }).eq("id", post_id));
        }
      }
      return "ok";
    },

    async analyze_clips({ media_ids }) {
      const results = await Promise.all(
        media_ids.map((id) =>
          ensureClipAnalysis(studioId, id).catch((error: unknown) => ({
            media_id: id,
            status: "failed" as const,
            error: error instanceof Error ? error.message : String(error),
          })),
        ),
      );
      // The chat only needs the gist; the editor reads the full analyses itself.
      return json({
        clips: results.map((r) =>
          "analysis" in r
            ? {
                media_id: r.media_id,
                duration: r.analysis.duration,
                summary: r.analysis.summary,
                best_moments: r.analysis.best_moments,
                faces_visible: r.analysis.shots.some((s) => s.faces_visible),
                issues: r.analysis.issues,
              }
            : r,
        ),
      });
    },

    async quote_montage({ post_id, media_ids, brief, correction, max_new_scenes, variant, plan, effort, inspiration_id, go }) {
      const post = unwrap(await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single());
      if (inspiration_id) {
        const known = await db.from("inspirations").select("id").eq("id", inspiration_id).eq("studio_id", studioId).maybeSingle();
        if (!known.data) return "Inspiration introuvable : reprends un inspiration_id de list_inspirations.";
        check(await db.from("posts").update({ inspiration_id }).eq("id", post_id).eq("studio_id", studioId));
      }
      if ((correction || variant) && !post.edit_plan_id) return "Pas encore de montage pour cette publication : fais un devis de montage (correction: false).";
      // The level asked for, else the studio's default (Réglages).
      const studio = await db.from("studios").select("montage_effort").eq("id", studioId).single();
      const studioDefault = effortSchema.catch(DEFAULT_EFFORT).parse(studio.data?.montage_effort);
      const wanted = effort ?? studioDefault;
      // Her first Reel is her first impression: it always gets its made-to-measure animations.
      const firstReel = !correction && !variant && (await isFirstReel(studioId, post_id));
      const scenes = firstReel ? MAX_FREE_SCENES : max_new_scenes;
      const quote = await createMontageQuote({ studioId, postId: post_id, mediaIds: media_ids ?? [], brief, correction, maxNewScenes: scenes, variant, plan, effort: wanted });
      if ("error" in quote) {
        return json({ possible: false, solde: quote.balance, credits_necessaires: quote.needed, note: "Solde insuffisant : dis-le simplement à la gérante, sans lancer." });
      }
      const level = quote.effort ? EFFORTS[quote.effort] : null;
      const pitch = quote.effort ? effortPitch(quote.effort, correction) : "";
      // What Fauve says about the level.
      const soin = level
        ? {
            niveau: level.label,
            ce_que_ca_fait: pitch,
            duree: `${level.minutes} min`,
            ...(quote.effort !== wanted ? { attention: `Niveau ${EFFORTS[wanted].label} impossible avec le solde : devis en ${level.label}.` } : {}),
          }
        : {};
      // The price of the other levels, for a quote she has not said yes to yet.
      const autres = (Object.keys(quote.efforts) as Effort[])
        .filter((e) => e !== quote.effort)
        .map((e) => ({ niveau: EFFORTS[e].label, effort: e, ce_que_ca_fait: effortPitch(e, correction), credits: quote.efforts[e]!.base, credits_max: quote.efforts[e]!.max }));
      // A small montage starts at once (Fauve tells the plan and the price, no yes needed), but never
      // above the studio's default level: a higher one is the manager's choice, on a quote.
      const order = ["rapide", "soigne", "max"] as const;
      const aboveDefault = quote.effort !== null && order.indexOf(quote.effort) > order.indexOf(studioDefault);
      // Only once she said so: answering a question is not a yes. A correction or a variant never
      // starts on its own: a criticism (« c'est plat ») is not a yes, she sees the plan and the price first.
      if (go && !correction && !variant && !aboveDefault && quote.max <= AUTO_START_MAX_CREDITS && quote.balance >= quote.max) {
        const accepted = await acceptQuote(studioId, quote.id, turnStartedAt, { immediate: true });
        if (!("error" in accepted)) {
          ctx.afterReply.push(() => startMontage(studioId, accepted, { waId: ctx.waId, replyTo: ctx.replyToMessageId }));
          // In the app, the quote card follows the montage step by step (already launched, no button);
          // on WhatsApp, cards become links, so the post's link stays.
          ctx.extras.quote = quote.id;
          if (ctx.waId) ctx.extras.posts = [post_id];
          ctx.notes.push(`montage lancé directement quote_id=${quote.id} pour « ${post.title as string} » post_id=${post_id} (${quote.base} à ${quote.max} crédits${level ? `, ${level.label}` : ""})`);
          return json({
            status: "started",
            publication: post.title,
            credits: quote.base,
            credits_max: quote.max,
            solde: quote.balance,
            ...soin,
            note: `Petit montage : il est déjà lancé, sans attendre d'accord, et son niveau ne change plus (un autre niveau serait un nouveau montage, après la livraison). Décris le plan en 2 ou 3 phrases (durée, scènes) avec son coût (credits, jusqu'à credits_max s'il crée des animations ou si tu le fais corriger après l'avoir regardé)${level ? `, le niveau (${level.label} : ${pitch.toLowerCase()})` : ""}, et dis que la vidéo arrive dans ${level?.minutes ?? "2 à 4"} minutes ; elle pourra demander une correction ensuite. Ne demande pas « je lance ? » et ne propose pas d'autre niveau.`,
          });
        }
      }
      // Shown as a card with a « Lancer » button under the reply (WhatsApp: yes / no buttons).
      ctx.extras.quote = quote.id;
      ctx.notes.push(`devis présenté quote_id=${quote.id} pour « ${post.title as string} » post_id=${post_id} (${quote.base} à ${quote.max} crédits${level ? `, ${level.label}` : ""})`);
      return json({
        quote_id: quote.id,
        publication: post.title,
        lignes: quote.lines,
        credits: quote.base,
        credits_max: quote.max,
        nouvelles_scenes_max: quote.maxNewScenes,
        solde: quote.balance,
        ...soin,
        ...(autres.length ? { autres_niveaux: autres } : {}),
        note: `Présente le plan, le niveau et le coût (credits, ou jusqu'à credits_max s'il crée de nouvelles scènes ou si tu le fais corriger), puis attends son accord avant montage. Si elle choisit un autre niveau, lance montage avec ce quote_id et effort.${
          ctx.waId && quote.effort && otherEffort(quote.effort, Object.keys(quote.efforts) as Effort[])
            ? ` Sur WhatsApp, un bouton « Version ${EFFORTS[otherEffort(quote.effort, Object.keys(quote.efforts) as Effort[])!].label} » est proposé sous ton message : donne son prix (autres_niveaux) en une phrase.`
            : ""
        } Les boutons du devis sont ajoutés tout seuls : n'appelle pas reply_with avec des options pour ce message.`,
      });
    },

    async analyze_performance({ refresh }) {
      const latest = await latestReport(studioId);
      const fresh = latest && Date.now() - new Date(latest.createdAt).getTime() < 3 * 24 * 3600_000;
      const report = fresh && !refresh ? latest : await analyzePerformance(studioId);
      if ("error" in report) return json({ error: report.error });
      return json({
        bilan: report.summary,
        lecons: report.lessons,
        idees: report.ideas,
        posts_analyses: report.posts,
        date: report.createdAt,
        note: "Partage le bilan en 2-3 phrases (la tendance et la leçon la plus utile) ; le détail est dans l'app, page Résultats.",
      });
    },

    async montage_status({ post_id }) {
      const montages = await montageStatus(studioId, post_id);
      if (!montages.length) return json({ montages: [], note: "Aucun montage lancé récemment." });
      return json({
        montages: montages.map((m) => ({ post_id: m.postId, publication: m.title, etape: m.step, depuis_minutes: m.minutes, late: m.late })),
        note: "En montage, en rendu, en relecture ou en correction : tout va bien, la vidéo arrive toute seule. late : propose de relancer (quote_montage puis montage).",
      });
    },

    async choose_version({ post_id, version }) {
      unwrap(await db.from("posts").select("id").eq("id", post_id).eq("studio_id", studioId).single());
      const plan = (await db.from("edit_plans").select("id").eq("post_id", post_id).eq("version", version).maybeSingle()).data;
      if (!plan) return json({ error: `Pas de version ${version} pour cette publication.` });
      const render = (
        await db
          .from("renders")
          .select("id")
          .eq("edit_plan_id", plan.id)
          .eq("status", "done")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
      check(await db.from("posts").update({ edit_plan_id: plan.id, ...(render ? { render_id: render.id } : {}) }).eq("id", post_id));
      return json({
        version,
        video: render ? "prête" : "pas encore rendue : lance render",
        note: "C'est cette version qui sera publiée. Confirme-le en une phrase.",
      });
    },

    async montage({ quote_id, effort }) {
      const quote = await acceptQuote(studioId, quote_id, turnStartedAt, { effort });
      if ("error" in quote) {
        // The model lost the id of the quote the manager said yes to: point it back to it. A quote
        // already launched is not a lost id: never send it to another (perhaps another post's) quote.
        const lost = quote.error.startsWith("Devis introuvable");
        const shown = lost ? await lastPresentedQuote(studioId, turnStartedAt) : null;
        return shown && shown.id !== quote_id
          ? `${quote.error} Le devis présenté à la gérante est quote_id=${shown.id} (« ${shown.title} ») : lance montage avec celui-ci, sans refaire de devis ni de publication.`
          : quote.error;
      }
      const post = unwrap(await db.from("posts").select("id, title").eq("id", quote.postId).eq("studio_id", studioId).single());
      // The montage outlives this reply: it runs as a background job and sends the video itself.
      ctx.afterReply.push(() => startMontage(studioId, quote, { waId: ctx.waId, replyTo: ctx.replyToMessageId }));
      ctx.notes.push(`montage lancé (quote_id=${quote.id})`);
      return json({
        status: "started",
        post: post.title,
        niveau: quote.effort ? EFFORTS[quote.effort].label : "Rapide",
        note: `Le monteur prépare la vidéo (plans, scènes de motion design, textes)${quote.effort && EFFORTS[quote.effort].review ? ", tu la regardes et la fais corriger si besoin," : ""} puis elle part automatiquement avec la légende, en ${quote.effort ? EFFORTS[quote.effort].minutes : "2 à 4"} minutes. Annonce-le en une phrase courte.`,
      });
    },

    async create_edit_plan({ post_id, plan }) {
      // Ownership check before writing.
      unwrap(await db.from("posts").select("id").eq("id", post_id).eq("studio_id", studioId).single());
      const version = await nextVersion("edit_plans", "post_id", post_id);
      const row = unwrap(
        await db
          .from("edit_plans")
          .insert({ studio_id: studioId, post_id, version, plan })
          .select("id, version")
          .single(),
      );
      check(await db.from("posts").update({ edit_plan_id: row.id }).eq("id", post_id));
      return json({ edit_plan_id: row.id, version: row.version });
    },

    async restyle_reel({ post_id, style }) {
      const post = unwrap(await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single());
      if (!post.edit_plan_id) return json({ error: "Cette publication n'a pas encore de montage." });
      // The adjustment stays in her art direction: every next montage follows it.
      const latest = await db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1);
      const current = brandProfileSchema.partial().catch({}).parse(latest.data?.[0]?.profile ?? {});
      const profile = { dos: [], donts: [], ...current, art_direction: withAdjustment(current.art_direction, style) };
      const version = await nextVersion("brand_profiles", "studio_id", studioId);
      check(await db.from("brand_profiles").insert({ studio_id: studioId, version, profile }));
      // Her click is her yes: the corrected version starts at once, at the studio's level.
      const studio = await db.from("studios").select("montage_effort").eq("id", studioId).single();
      const effort = effortSchema.catch(DEFAULT_EFFORT).parse(studio.data?.montage_effort);
      const quote = await createMontageQuote({ studioId, postId: post_id, mediaIds: [], brief: RESTYLE[style].brief, correction: true, effort });
      if ("error" in quote) {
        return json({ possible: false, style_garde: true, solde: quote.balance, credits_necessaires: quote.needed, note: "Le style est gardé pour les prochains montages, mais le solde ne suffit pas pour refaire la vidéo : dis-le simplement." });
      }
      const accepted = await acceptQuote(studioId, quote.id, turnStartedAt, { immediate: true });
      if ("error" in accepted) return json({ error: accepted.error });
      ctx.afterReply.push(() => startMontage(studioId, accepted, { waId: ctx.waId, replyTo: ctx.replyToMessageId }));
      ctx.extras.quote = quote.id;
      if (ctx.waId) ctx.extras.posts = [post_id];
      ctx.notes.push(`version ${RESTYLE[style].button.toLowerCase()} lancée quote_id=${quote.id} pour « ${post.title as string} » post_id=${post_id}`);
      return json({
        status: "started",
        style: RESTYLE[style].button,
        credits: quote.base,
        credits_max: quote.max,
        note: `Le style est retenu pour tous ses prochains montages, et la nouvelle version de ce Reel est en route (${quote.effort ? EFFORTS[quote.effort].minutes : "2 à 4"} min). Dis-le en une ou deux phrases chaleureuses, avec le coût (credits, jusqu'à credits_max).`,
      });
    },

    async update_brand_profile({ profile }) {
      const version = await nextVersion("brand_profiles", "studio_id", studioId);
      check(await db.from("brand_profiles").insert({ studio_id: studioId, version, profile }));
      return json({ version });
    },

    async render({ post_id }) {
      // Ownership check now, so the model gets an immediate error for a wrong id.
      const post = unwrap(
        await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (!post.edit_plan_id) return json({ error: "Cette publication n'a pas encore de plan de montage (create_edit_plan)." });
      // A re-render of an unchanged plan: free (no AI work).
      ctx.afterReply.push(async () => {
        await renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId });
      });
      return json({
        status: "started",
        note: "Le montage démarre après ta réponse et la vidéo sera envoyée automatiquement (environ une minute). Annonce-le en une phrase, sans décrire la vidéo comme si elle était déjà prête.",
      });
    },

    async write_on_photos({ post_id, template, slides }) {
      const post = unwrap(
        await db.from("posts").select("id, kind, status, media_ids, slides").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (post.kind !== "carousel" && post.kind !== "post") {
        return json({ error: "Le texte sur photos est pour un carrousel ou un post photo. Pour un Reel, les textes font partie du montage." });
      }
      if (post.status === "published" || post.status === "measured") return json({ error: "Cette publication est déjà en ligne." });
      const mediaIds = (post.media_ids as string[] | null) ?? [];
      if (!mediaIds.length) return json({ error: "Cette publication n'a pas encore de photos : ajoute-les d'abord (update_post media_ids)." });
      const previous = slidesPlanSchema.safeParse(post.slides);
      // A saved look by name (the studio's text styles), else the template's style.
      const wanted = slides.some((s) => s.texts.some((t) => t.look_name));
      const looks = wanted ? await loadTextLooks(studioId) : [];
      const unknownLooks = new Set<string>();
      const lookNamed = (name?: string) => {
        if (!name) return undefined;
        const found = looks.find((l) => l.name.toLowerCase() === name.toLowerCase());
        if (!found) unknownLooks.add(name);
        return found;
      };
      const plan = {
        template: template ?? (previous.success ? previous.data.template : "doux"),
        slides: mediaIds.slice(0, 10).map((media_id, i) => ({
          media_id,
          ...(slides[i]?.logo ? { logo: slides[i].logo } : {}),
          texts: (slides[i]?.texts ?? []).map(({ look_name, ...t }) => {
            const saved = lookNamed(look_name);
            if (!saved) return t;
            // A saved look brings its place, and for a list its detail lines and bullets.
            const list = t.items ? { detail_look: saved.list?.detail_look, bullet: saved.list?.bullet } : {};
            return { ...t, look: saved.look, ...list, ...(saved.y !== undefined ? { y: saved.y } : {}), ...(saved.x !== undefined ? { x: saved.x } : {}) };
          }),
        })),
      };
      try {
        await saveSlides(studioId, post_id, plan);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Texte non enregistré" });
      }
      ctx.afterReply.push(async () => {
        await renderSlidesAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId });
      });
      return json({
        status: "started",
        photos: mediaIds.length,
        ignored: slides.length > mediaIds.length ? `${slides.length - mediaIds.length} entrée(s) en trop ignorée(s)` : undefined,
        unknown_looks: unknownLooks.size ? `Styles inconnus, remplacés par celui du gabarit : ${[...unknownLooks].join(", ")}` : undefined,
        note: "Le texte est posé après ta réponse (environ une minute) et le lien part automatiquement. Annonce-le en une phrase, sans envoyer de lien toi-même.",
      });
    },

    async retouch_photos({ post_id, photos, light, blur, only_recognizable }) {
      const post = unwrap(await db.from("posts").select("kind, status").eq("id", post_id).eq("studio_id", studioId).single());
      if (post.kind !== "carousel" && post.kind !== "post") {
        return json({ error: "La retouche photo est pour un carrousel ou un post photo. Pour flouter un Reel : blur_video." });
      }
      if (post.status === "published" || post.status === "measured") return json({ error: "Cette publication est déjà en ligne." });
      // Gemini reads each photo (a few seconds each), then the photos are rendered: after the reply.
      ctx.afterReply.push(async () => {
        try {
          await retouchPostPhotos(studioId, post_id, { photos, light, blur, onlyRecognizable: only_recognizable });
          await renderSlidesAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId });
        } catch (error) {
          await notifyFailure({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId }, "Je n’ai pas réussi à retoucher tes photos cette fois. Tu veux que je réessaie ?", error);
        }
      });
      return json({
        status: "started",
        note: "Brigitte regarde les photos puis les retouche (une à deux minutes) ; le lien est envoyé tout seul. Annonce-le en une phrase, en disant ce que tu fais (lumière, flou des visages…).",
      });
    },

    async blur_video({ post_id, what }) {
      ctx.afterReply.push(async () => {
        try {
          await blurMontage(studioId, post_id, what);
          await renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId });
        } catch (error) {
          await notifyFailure({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId }, "Je n’ai pas réussi à flouter la vidéo cette fois. Tu veux que je réessaie ?", error);
        }
      });
      return json({
        status: "started",
        note: what.length
          ? "Brigitte repère les zones dans chaque vidéo puis refait le rendu avec le flou (deux à trois minutes) ; le lien est envoyé tout seul. Annonce-le en une phrase."
          : "Le flou est retiré et le rendu refait ; le lien est envoyé tout seul.",
      });
    },

    async remember({ add, remove }) {
      const { data } = await db.from("studios").select("memory").eq("id", studioId).single();
      let memory = readMemory(data?.memory);
      if (remove?.length) memory = removeFacts(memory, remove);
      if (add?.length) memory = addFacts(memory, add, new Date().toISOString());
      check(await db.from("studios").update({ memory }).eq("id", studioId));
      return `ok : ${memory.length} info${memory.length > 1 ? "s" : ""} en mémoire. Ne l'annonce pas, continue la conversation.`;
    },

    async suggest_dates({ count }) {
      const { data } = await db.from("studios").select("timezone").eq("id", studioId).single();
      const slots = await freeSlots(studioId, (data?.timezone as string | undefined) ?? "Europe/Paris", count);
      return json({
        jours_libres: slots.map((s) => ({ date: s.date, heure: s.time, libelle: `${s.label} à ${s.time.replace(":", " h ").replace(/ 00$/, "")}` })),
        note: slots.length ? "Propose-les en boutons (reply_with options, le libellé), plus « Autre date »." : "Aucun jour libre dans les deux semaines : demande-lui une date.",
      });
    },

    async list_inspirations() {
      const items = await listInspirations(studioId, 10);
      return json({
        inspirations: items.map((i) => ({ inspiration_id: i.id, titre: i.title, a_reprendre: i.summary ?? (i.reading ? "en cours de lecture" : undefined), source: i.source })),
        note: items.length ? "Propose-en 2 au plus, par leur titre." : "Aucune inspiration : elle peut partager un Reel à Brigitte sur Instagram ou en ajouter un dans l'app.",
      });
    },

    async add_to_moodboard({ media_ids }) {
      const { data: studio } = await db.from("studios").select("onboarding_step").eq("id", studioId).single();
      const result = await addToMoodboard(studioId, media_ids, { free: onboardingStepOf(studio?.onboarding_step) !== "done" });
      if ("error" in result) return json({ error: result.error });
      return json({
        ajoutees: result.added,
        lecture: result.reading ?? undefined,
        note: "Dis en une phrase ce que tu retiens de son moodboard (la lecture), sans la recopier.",
      });
    },

    async list_elements() {
      const elements = await listElements(studioId, 60);
      return json({
        composants: elements.map((e) => ({
          element_id: e.id,
          nom: e.name,
          type: e.role,
          kit: e.kitName ?? undefined,
          slots: e.slots.map((sl) => ({ slot: sl.name, role: sl.role, max: sl.max_chars, multiline: sl.multiline || undefined })),
          exemple: e.sample,
          place_sur_son_kit: e.box ?? undefined,
        })),
        note: elements.length
          ? "Les poser est gratuit (place_elements). Pour un kit entier, pose tous les composants du même kit à leur place."
          : "Banque vide : design_elements en crée à partir d'une inspiration (la capture d'un post qu'elle aime).",
      });
    },

    async place_elements({ post_id, photos, mode }) {
      const bank = new Map((await listElements(studioId)).map((e) => [e.id, e]));
      const missing = new Set<string>();
      const unknownSlots = new Set<string>();
      const perPhoto = new Map(
        photos.map((p) => [
          p.photo,
          p.elements.flatMap((pl) => {
            const element = bank.get(pl.element_id);
            if (!element) {
              missing.add(pl.element_id);
              return [];
            }
            const known = new Set(element.slots.map((sl) => sl.name));
            for (const t of pl.texts) if (!known.has(t.slot)) unknownSlots.add(`${element.name} : ${t.slot}`);
            const texts = Object.fromEntries(pl.texts.filter((t) => known.has(t.slot)).map((t) => [t.slot, t.text]));
            const box = { ...(pl.x !== undefined ? { x: pl.x } : {}), ...(pl.y !== undefined ? { y: pl.y } : {}), ...(pl.w !== undefined ? { w: pl.w } : {}), ...(pl.rotate !== undefined ? { rotate: pl.rotate } : {}) };
            return [elementInstance(element, { box, texts })];
          }),
        ] as const),
      );
      if (missing.size) return json({ error: `Composants introuvables dans la banque : ${[...missing].join(", ")} (list_elements).` });
      try {
        await placeElements(studioId, post_id, perPhoto, mode);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Composants non posés" });
      }
      await markElementsUsed([...new Set(photos.flatMap((p) => p.elements.map((e) => e.element_id)))]);
      ctx.afterReply.push(async () => {
        await renderSlidesAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId });
      });
      return json({
        status: "started",
        photos: photos.map((p) => p.photo),
        slots_inconnus: unknownSlots.size ? `Ignorés : ${[...unknownSlots].join(", ")}` : undefined,
        note: "Le rendu part après ta réponse (environ une minute) et le lien est envoyé tout seul. Annonce-le en une phrase.",
      });
    },

    async design_elements({ request, example_media_id, post_id, photos }) {
      if (post_id) {
        const post = unwrap(await db.from("posts").select("kind, status, media_ids").eq("id", post_id).eq("studio_id", studioId).single());
        if (post.kind !== "carousel" && post.kind !== "post") return json({ error: "Les composants se posent sur les photos d'un carrousel ou d'un post photo. Pour un Reel, les textes font partie du montage." });
        if (post.status === "published" || post.status === "measured") return json({ error: "Cette publication est déjà en ligne." });
        if (!((post.media_ids as string[] | null) ?? []).length) return json({ error: "Cette publication n'a pas encore de photos : ajoute-les d'abord (update_post media_ids)." });
      }
      if (example_media_id) {
        const example = await db.from("media_assets").select("kind").eq("id", example_media_id).eq("studio_id", studioId).maybeSingle();
        if (example.data?.kind !== "image") return json({ error: "L'inspiration doit être une image (photo ou capture d'écran)." });
      }
      const started = await startElements({ studioId, mode: "create", postId: post_id, request, exampleMediaId: example_media_id, photos, origin: "chat", waId: ctx.waId, replyTo: ctx.replyToMessageId });
      if (started.status === "already_running") {
        return json({ status: "already_running", etape: started.stage, depuis_minutes: started.minutes, note: "C'est déjà en cours : ne relance rien. Dis où ça en est ; le message arrive tout seul (pastille « Brigitte travaille » dans l'app)." });
      }
      if (started.status === "error") return json({ error: `${started.error} Propose plutôt des composants de sa banque (gratuit).` });
      ctx.notes.push(`composants en cours${post_id ? ` pour la publication ${post_id}` : ""}`);
      return json({ status: "started", credits: started.credits, note: "Brigitte décompose l'inspiration en composants, les teste et les relit : 2 à 4 minutes. Les crédits sont débités une fois livré et un message part tout seul. Annonce-le en une phrase (délai et coût), sans lien." });
    },

    async edit_element({ element_id, change, example_media_id, post_id }) {
      const element = await loadElement(studioId, element_id);
      if (!element) return json({ error: "Composant introuvable dans la banque (list_elements)." });
      const started = await startElements({ studioId, mode: "edit", elementId: element_id, postId: post_id, request: change, exampleMediaId: example_media_id, origin: "chat", waId: ctx.waId, replyTo: ctx.replyToMessageId });
      if (started.status === "already_running") {
        return json({ status: "already_running", etape: started.stage, depuis_minutes: started.minutes, note: "Ce composant est déjà en cours de modification : ne relance rien." });
      }
      if (started.status === "error") return json({ error: started.error });
      ctx.notes.push(`modification du composant ${element_id} en cours`);
      return json({ status: "started", credits: started.credits, note: `Nouvelle version de « ${element.name} » en préparation (une à deux minutes, ${started.credits} crédit). L'ancienne reste dans son historique. Un message part tout seul. Annonce-le en une phrase.` });
    },

    async copy_text_style({ media_id, post_id, note, copy_places }) {
      const asset = unwrap(await db.from("media_assets").select("id, kind, storage_path").eq("id", media_id).eq("studio_id", studioId).single());
      if (asset.kind !== "image") {
        return json({ error: "L'exemple doit être une image (photo ou capture d'écran du post). Pour un Reel, une capture du moment où le texte est à l'écran suffit." });
      }
      const signed = await db.storage.from("media").createSignedUrl(asset.storage_path as string, 600);
      if (!signed.data) return json({ error: "Image d'exemple introuvable" });
      let example;
      try {
        example = await readTextExample(studioId, signed.data.signedUrl, note);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Lecture de l'exemple impossible" });
      }
      await keepTextLooks(
        studioId,
        example.blocks.map((b) => ({
          name: b.name,
          role: b.role,
          look: b.look,
          ...(b.list ? { list: { detail_look: b.list.detail_look, bullet: b.list.bullet } } : {}),
          y: b.y,
          x: b.x,
        })),
      );
      let applied: Record<string, unknown> | undefined;
      if (post_id) {
        try {
          const result = await restyleTexts(studioId, post_id, (t) => {
            const block = blockFor(example, t.style);
            return { look: block.look, ...(copy_places ? { y: block.y, x: block.x } : {}) };
          });
          ctx.afterReply.push(async () => {
            const target = { studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId };
            await (result.kind === "slides" ? renderSlidesAndDeliver(target) : renderAndDeliver(target));
          });
          applied = { post_id, texts: result.changed, on: result.kind === "slides" ? "photos" : "montage" };
        } catch (error) {
          applied = { error: error instanceof Error ? error.message : "Style non appliqué" };
        }
      }
      return json({
        summary: example.summary,
        // The example's layout, block by block: what to write again with the studio's own words.
        layout: example.blocks.map((b) => ({
          look_name: b.name,
          role: b.role,
          example_text: b.text,
          list: b.list ? { items: b.list.items.length, bullet: b.list.bullet?.kind, example: b.list.items.slice(0, 2) } : undefined,
          font: b.look.font,
        })),
        logo: example.logo,
        applied,
        note:
          (applied && !("error" in applied)
            ? "Les styles sont enregistrés et appliqués aux textes existants ; le rendu part après ta réponse et le lien est envoyé tout seul. "
            : "Les styles sont enregistrés dans le style du studio. ") +
          "Pour refaire la même chose (même mise en page : titre, liste à puces, logo…), appelle write_on_photos sur la publication avec un texte par bloc de layout, son look_name, les mots du commerce (pour une liste : items avec title et detail), et logo si l'exemple en a un. Dis en une phrase ce que tu as repris de l'exemple.",
      });
    },

    async read_post({ post_id }) {
      const post = unwrap(
        await db
          .from("posts")
          .select("id, title, kind, status, scheduled_at, caption, hashtags, media_ids, slides, edit_plan_id, render_id")
          .eq("id", post_id)
          .eq("studio_id", studioId)
          .single(),
      );
      const lookOf = (l: TextLook | undefined) =>
        l ? { police: l.font, couleur: l.color, ...(l.fill ? { fond: `${l.fill.kind} ${l.fill.color}` } : {}), ...(l.stroke ? { contour: l.stroke.color } : {}) } : { style: "gabarit" };
      const slides = slidesPlanSchema.safeParse(post.slides);
      let montage: unknown;
      if (post.edit_plan_id) {
        const { data: row } = await db.from("edit_plans").select("version, plan").eq("id", post.edit_plan_id as string).maybeSingle();
        const plan = editPlanSchema.safeParse(row?.plan);
        if (plan.success) {
          montage = {
            version: row?.version,
            gabarit: plan.data.template,
            duree_s: plan.data.duration,
            scenes: plan.data.segments.length,
            textes: plan.data.texts.map((t) => ({ texte: t.text, de: t.from, a: t.to, role: t.style, ...lookOf(t.look) })),
            video: post.render_id ? "rendue" : "pas encore rendue",
          };
        }
      }
      return json({
        post_id: post.id,
        titre: post.title,
        format: post.kind,
        statut: post.status,
        scheduled_at: post.scheduled_at,
        legende: post.caption,
        hashtags: post.hashtags,
        media_ids: post.media_ids,
        ...(slides.success
          ? {
              photos: slides.data.slides.map((s, i) => ({
                photo: i + 1,
                media_id: s.media_id,
                ...(s.layer ? { calque: s.layer.name, textes_du_calque: s.layer.texts } : {}),
                ...(s.elements?.length ? { composants: s.elements.map((e) => ({ element_id: e.element_id, nom: e.name, textes: e.texts, place: e.box })) } : {}),
                textes: s.texts.map((t) => ({ texte: t.text, role: t.style, ...(t.items?.length ? { liste: t.items.map((it) => it.title) } : {}), ...lookOf(t.look) })),
              })),
              gabarit_photos: slides.data.template,
            }
          : {}),
        ...(montage ? { montage } : {}),
      });
    },

    async style_texts({ post_id, target, photos, look_name, look, reset, save_as }) {
      const saved = look_name ? await loadTextLooks(studioId) : [];
      const named = look_name ? saved.find((l) => l.name.toLowerCase() === look_name.toLowerCase()) : undefined;
      if (look_name && !named) return json({ error: `Aucun style enregistré « ${look_name} ». Styles du studio : ${saved.map((l) => l.name).join(", ") || "aucun"}` });
      if (!reset && !named && !look) return json({ error: "Donne un style enregistré (look_name), des changements (look) ou reset." });

      const { data: post } = await db.from("posts").select("slides").eq("id", post_id).eq("studio_id", studioId).maybeSingle();
      const slidesTemplate = slidesPlanSchema.safeParse(post?.slides);
      const starts = new Map<string, TextLook>();
      const startFor = async (role: "hook" | "band" | "caption") => {
        if (!starts.has(role)) starts.set(role, await lookDefaults(studioId, slidesTemplate.success ? slidesTemplate.data.template : undefined, role));
        return starts.get(role)!;
      };
      // Starting looks are needed inside a synchronous change: load them first.
      for (const role of ["hook", "band", "caption"] as const) await startFor(role);

      let invalid: string | undefined;
      let last: TextLook | undefined;
      try {
        const result = await restyleTexts(studioId, post_id, (t, photo) => {
          if (target !== "all" && t.style !== target) return undefined;
          if (photos?.length && (photo === undefined || !photos.includes(photo))) return undefined;
          if (reset) return { look: null };
          const base = named?.look ?? t.look ?? starts.get(t.style)!;
          const merged: Record<string, unknown> = { ...base, ...(look ?? {}) };
          for (const key of ["fill", "stroke", "emphasis"]) if (merged[key] === null) delete merged[key];
          const parsed = textLookSchema.safeParse(merged);
          if (!parsed.success) {
            invalid = parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ");
            return undefined;
          }
          last = parsed.data;
          return { look: parsed.data };
        });
        if (invalid && !last) return json({ error: `Style invalide : ${invalid}` });
        if (save_as && last && target !== "all") await keepTextLooks(studioId, [{ name: save_as, role: target, look: last }]);
        else if (save_as && last) await keepTextLooks(studioId, [{ name: save_as, role: "hook", look: last }]);
        // One render per post and turn, after every change (a style per photo is several calls).
        if (!rendering.has(post_id)) {
          rendering.add(post_id);
          ctx.afterReply.push(async () => {
            const to = { studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId };
            await (result.kind === "slides" ? renderSlidesAndDeliver(to) : renderAndDeliver(to));
          });
        }
        return json({
          status: "started",
          texts: result.changed,
          on: result.kind === "slides" ? "photos" : "montage",
          saved_as: save_as && last ? save_as : undefined,
          note: "Le rendu part après ta réponse et le lien est envoyé tout seul. Annonce le changement en une phrase.",
        });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Style non appliqué" });
      }
    },

    async schedule_post({ post_id, scheduled_at }) {
      const post = unwrap(
        await db.from("posts").select("id, kind, status, render_id, media_ids, scheduled_at").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      const missing = missingContent(post.kind as PostKind, Boolean(post.render_id), ((post.media_ids as string[] | null) ?? []).length);
      if (missing) return json({ error: missing });
      if (!(await instagramAccount(studioId))) {
        return json({ error: "Instagram n'est pas connecté pour ce studio. Envoie le lien de connexion (get_connect_link)." });
      }
      const current = postStatusSchema.parse(post.status);
      if (current !== "validated" && current !== "failed" && current !== "scheduled") {
        return json({ error: `La publication est au statut « ${current} » : elle doit d'abord être validée par la gérante (update_post status validated).` });
      }
      const when = new Date(scheduled_at ?? (post.scheduled_at as string | null) ?? Date.now());
      const at = when.getTime() < Date.now() + 60_000 ? new Date() : when;
      check(
        await db
          .from("posts")
          .update({ status: "scheduled", scheduled_at: at.toISOString(), publish_started_at: null, publish_error: null })
          .eq("id", post_id),
      );
      const now = at.getTime() <= Date.now() + 1000;
      if (now) ctx.afterReply.push(async () => void (await publishIfDue(post_id)));
      return json({
        status: "scheduled",
        scheduled_at: at.toISOString(),
        note: now
          ? "Publication immédiate après ta réponse ; la gérante recevra le lien du Reel."
          : "Brigitte publiera automatiquement à l'horaire prévu et préviendra la gérante.",
      });
    },

    async get_instagram_activity({ media_limit, comments_per_post }) {
      const account = await instagramAccount(studioId);
      if (!account) return json({ error: "Instagram n'est pas connecté. Envoie le lien de connexion (get_connect_link)." });
      try {
        const media = await recentMedia(account.userId, account.accessToken, media_limit);
        const detailed = await Promise.all(
          media.map(async (m, i) => ({
            id: m.id,
            date: m.timestamp,
            type: m.media_product_type ?? m.media_type,
            caption: m.caption?.slice(0, 160),
            permalink: m.permalink,
            likes: m.like_count,
            comments_count: m.comments_count,
            // Insights cost one call each: the most recent posts are what the analysis needs.
            insights: i < 6 ? await mediaInsights(m.id, account.accessToken).catch(() => null) : undefined,
            comments:
              comments_per_post && m.comments_count
                ? (await mediaComments(m.id, account.accessToken, comments_per_post).catch(() => [])).map((c) => ({
                    id: c.id,
                    from: c.username,
                    text: c.text?.slice(0, 200),
                    date: c.timestamp,
                    likes: c.like_count,
                    replies: c.replies?.data?.map((r) => ({ from: r.username, text: r.text })) ?? [],
                    answered_by_studio: c.replies?.data?.some((r) => r.username === account.handle) ?? false,
                  }))
                : [],
          })),
        );
        return json({ account: `@${account.handle}`, media: detailed });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) });
      }
    },

    async reply_to_comment({ comment_id, message }) {
      const account = await instagramAccount(studioId);
      if (!account) return json({ error: "Instagram n'est pas connecté." });
      try {
        const id = await replyToComment(comment_id, account.accessToken, message);
        return json({ status: "posted", reply_id: id });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) });
      }
    },

    async get_metrics({ from, to }) {
      const rows = unwrap(
        await db
          .from("metrics")
          .select("post_id, platform, captured_at, views, reach, likes, saves, shares, comments, profile_visits, posts(title, kind, scheduled_at)")
          .eq("studio_id", studioId)
          .gte("captured_at", from)
          .lte("captured_at", to)
          .order("captured_at", { ascending: false })
          .limit(200),
      );
      const latest = new Map<string, (typeof rows)[number]>();
      for (const row of rows) if (!latest.has(`${row.post_id}:${row.platform}`)) latest.set(`${row.post_id}:${row.platform}`, row);
      return json({ metrics: [...latest.values()] });
    },

    async react_to_message({ emoji }) {
      if (ctx.waId && ctx.replyToMessageId) {
        await sendReaction(ctx.waId, ctx.replyToMessageId, emoji);
        await setReaction({ waMessageId: ctx.replyToMessageId }, "fauve", emoji);
      } else if (ctx.reactToRowId) {
        await setReaction({ id: ctx.reactToRowId }, "fauve", emoji);
      } else {
        return "Pas de message auquel réagir.";
      }
      ctx.reactions.push(emoji);
      return "ok";
    },

    async reply_with({ options, posts, grid, upload, pick_media }) {
      let own: string[] = [];
      if (posts?.length) {
        const { data } = await db.from("posts").select("id").eq("studio_id", studioId).in("id", posts);
        const found = new Set((data ?? []).map((p) => p.id as string));
        own = posts.filter((id) => found.has(id));
        if (own.length < posts.length) return "Publication introuvable : vérifie les id avec get_calendar.";
      }
      ctx.extras.options = options;
      ctx.extras.posts = own.length ? own : undefined;
      ctx.extras.grid = grid || undefined;
      // The drop zone is the app's: WhatsApp has its own paperclip.
      ctx.extras.upload = ctx.waId ? undefined : upload;
      ctx.extras.pick_media = ctx.waId ? undefined : pick_media;
      return "ok : affiché sous ton message.";
    },
  };
}
