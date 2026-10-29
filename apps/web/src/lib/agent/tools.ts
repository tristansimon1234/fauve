import "server-only";
import {
  APP_GUIDES,
  cleanCaption,
  periodTotals,
  weeklyGrowth,
  type CarouselDesign,
  type DailyRow,
  assertTransition,
  postStatusSchema,
  type PostKind,
  type ReplyExtras,
  type ToolHandlers,
  slidesPlanSchema,
  textLookSchema,
  CREDIT_PRICES,
  DEFAULT_EFFORT,
  EFFORTS,
  MAX_FREE_SCENES,
  missingContent,
  type MissingContent,
  effortSchema,
  editPlanSchema,
  type TextLook,
  addFacts,
  onboardingStepOf,
  readMemory,
  removeFacts,
  brandProfileSchema,
  RESTYLE,
  customRestyle,
  withAdjustment,
  VOICE_MAX_SECONDS,
  accessMessage,
  voiceIn,
  readPostVoice,
  readVoiceSetting,
  SIMONE_VOICES,
  reelLink,
  EFFECT_MINUTES,
  EFFECT_VOICE_OUT,
  EFFECT_WORDS_MINUTES,
  effectBlurBrief,
  effectWords,
  type ToolName,
  keptPlan,
  planMessage,
  PLAN_BUTTONS,
  exchangeLines,
  type ExchangeRow,
} from "@fauve/agent";
import { createLoginLink } from "@/lib/auth/login-link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { acceptQuote, createMontageQuote } from "@/lib/credits";
import { correctionQuote, startMontage } from "@/lib/montage-start";
import { bakedReel } from "@/lib/edit-plans";
import { effectRoute } from "@/lib/agent/effects-agent";
import { startEffectWords } from "@/lib/effect-words";
import { montageStatus } from "@/lib/montage-status";
import { analyzePerformance, latestReport } from "@/lib/performance";
import { setReaction } from "@/lib/reactions";
import { sendReaction } from "@/lib/whatsapp/client";
import { AiImageError, canAffordImages, improvePhoto, makeAmbiance, placeOnPost } from "@/lib/ai-images";
import { deliverImages, notifyFailure, renderAndDeliver, renderSlidesAndDeliver } from "@/lib/render/deliver";
import { queueJob } from "@/lib/jobs";
import { missMessage, startSteal } from "@/lib/steal";
import { readPostMusic } from "@/lib/render/music";
import { removeVoice } from "@/lib/voice-over";
import { ownVoiceOf } from "@/lib/voice-clone";
import { renderSlides, saveSlides } from "@/lib/render/slides";
import { mediaComments, mediaInsights, recentMedia, replyToComment } from "@/lib/social/instagram";
import { instagramAccount, publishIfDue } from "@/lib/social/publish";
import { defaultPlatforms, tiktokAccount } from "@/lib/social/tiktok-account";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { ensureTranscript } from "@/lib/voice";
import { blockFor, keepTextLooks, loadTextLooks, lookDefaults, readTextExample, restyleTexts } from "@/lib/text-looks";
import { startCarousel } from "@/lib/carousels";
import { charterFromImages, rereadBrand } from "@/lib/brand-read";
import { addToMoodboard } from "@/lib/moodboard-add";
import { completeFirstPost, isFirstReel } from "@/lib/onboarding";
import { listInspirations } from "@/lib/inspirations";
import { freeSlots } from "@/lib/slots";
import { studioAccess } from "@/lib/billing/access";
import { blurMontage, retouchPostPhotos } from "@/lib/retouch";
import { readSiteLook, sitePage } from "@/lib/site-look";
import { insertProfileVersion } from "@/app/(app)/style/profile";
import { usableFonts } from "@/lib/fonts";
import { readWebsite, WebsiteError } from "./website";

/** A new site, or hers redone: what Edith is told, and its look read again (lib/site-look.ts). */
const SITE_AGAIN = "Je relis son style après ta réponse (photos, couleurs, polices, direction artistique) ; ce qu'elle a réglé à la main reste.";
const SITE_CHANGED =
  "Compare tout avec ce que tu savais (nom, activité, offre et prix, lien de réservation, Instagram, ton, logo) et mets à jour dans ce même tour tout ce qui a changé : le nom et le reste avec update_onboarding ; dans ta Mémoire, retire (remember remove, avec leurs numéros) chaque note que son site contredit ou qui parle de l'ancien, et ajoute la nouvelle : ce que dit son site maintenant passe avant tes notes. Puis dis en deux ou trois phrases ce qui a changé, seulement ce que tes outils ont fait.";
const rereadSite = (studioId: string, url: string, photos: string[]) =>
  readSiteLook(studioId, url, photos, { again: true }).then(
    (r) => console.info("site look again", studioId, r),
    (e: unknown) => console.warn("site look failed", e),
  );


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
  /** Filled by reply_with: her plan before a new publication, written under Edith's words. */
  plan?: string;
  /**
   * Ids made during this turn (quote, post), stored with the reply and shown to the
   * model on the next turns: the history keeps only text, not tool results.
   */
  notes: string[];
  /** The studio's time zone, for the local dates in tool results. */
  timezone?: string;
  /** The app's conversation being answered: work started from it is delivered in it. */
  conversationId?: string;
  /** The conversation this turn answers (oldest first): a montage launched now keeps its exchange, word for word, for every agent. */
  exchange?: ExchangeRow[];
  /** Set by the tool loop: whether her answer has any words yet this turn (buttons laid before them answer nothing). */
  wrote?: boolean;
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
/** What a post still needs before it can go out, per format, said to Edith (null when ready). */
const MISSING_FOR_SIMONE: Record<MissingContent, string> = {
  montage: "Pas encore de vidéo montée : fais d'abord le montage.",
  photo: "Il faut une photo pour ce post : ajoute son media_id (update_post media_ids).",
  photos: "Un carrousel demande 2 à 10 photos ou vidéos (update_post media_ids, dans l'ordre).",
  media: "Il faut une photo, une vidéo ou un montage pour cette story.",
};

/** A composed carousel as Edith reads it: what each slide says, and its words slot by slot. */
function composedLines(design: CarouselDesign) {
  const words = (slide: number) => design.slots.filter((s) => s.slide === slide).map((s) => ({ slot: s.name, texte: design.texts[s.name] ?? "", max: s.max_chars }));
  return {
    nom: design.name,
    diapositives: Array.from({ length: design.count }, (_, i) => ({ diapositive: i + 1, dit: design.outline[i], textes: words(i + 1) })),
    ...(words(0).length ? { sur_toutes: words(0) } : {}),
    note: "Ses mots : carousel_texts (gratuit). Sa mise en page, l'ordre, une diapositive de plus : design_carousel (une correction).",
  };
}

/** Tools that spend (models, renders, images): refused without a subscription or credits. */
const COSTLY_TOOLS = [
  "analyze_clips",
  "montage",
  "restyle_reel",
  "render",
  "design_carousel",
  "carousel_texts",
  "effect_words",
  "write_on_photos",
  "retouch_photos",
  "make_image",
  "blur_video",
  "copy_text_style",
  "style_texts",
  "analyze_performance",
  "steal_style",
] as const satisfies readonly ToolName[];

export function createToolHandlers(ctx: ToolContext): ToolHandlers {
  const db = supabaseAdmin();
  const json = jsonIn(ctx.timezone ?? "Europe/Paris");
  const { studioId } = ctx;
  // A quote made during this turn cannot be started in it: the manager must see the price first.
  const turnStartedAt = new Date();
  /** Posts whose render already waits for the end of this turn. */
  const rendering = new Set<string>();
  /** A montage launched in this turn keeps the exchange that led to it, word for word, for every agent. */
  const chatRequest = (postId: string) => ({ via: "chat" as const, lines: exchangeLines(ctx.exchange ?? [], postId) });

  /** Media ids given by the model must be this studio's. */
  async function assertOwnMedia(ids: string[]) {
    const { data } = await db.from("media_assets").select("id").eq("studio_id", studioId).in("id", ids);
    if ((data?.length ?? 0) !== new Set(ids).size) throw new Error("Un des media_id n'appartient pas à ce studio.");
  }

  /** A carousel composed by the carousel designer: its words and its layout change their own way. */
  const DESIGNED =
    "Ce carrousel est composé par Edith (design_carousel) : ses mots se changent avec carousel_texts (gratuit), sa mise en page ou son style avec design_carousel (une correction, avec le changement demandé et l'exemple s'il y en a un).";

  /**
   * A change to a Reel the effects agent drew (its voice, its blur): the agent makes the effect again
   * from the version she saw, started after the reply (her request is her yes), charged on delivery.
   */
  async function effectCorrection(postId: string, brief: string, doing: string) {
    const accepted = await correctionQuote(studioId, postId, brief);
    if ("error" in accepted) return json({ error: accepted.error });
    ctx.afterReply.push(() => startMontage(studioId, accepted, { waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId, request: chatRequest(postId) }));
    ctx.extras.quote = accepted.id;
    ctx.notes.push(`correction de l'effet lancée job=${accepted.id} post_id=${postId}`);
    return json({
      status: "started",
      note: `${doing} : son effet est dessiné image par image, il se refait en entier (${EFFECT_MINUTES} min) ; débité à la livraison sur ce qu'il a coûté. Dis-le en une phrase, sans prix.`,
    });
  }

  const handlers: ToolHandlers = {
    async app_guide({ topic }) {
      return APP_GUIDES[topic];
    },

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
      // Her site's address changes (a new site): its look is read again after the reply (her first site is read by read_website).
      let newSite: string | null = null;
      if (input.website_url) {
        const { data: before } = await db.from("studios").select("website_url, onboarding_step").eq("id", studioId).single();
        const known = before?.website_url as string | null;
        const firstRead = !known && ["website", "style"].includes(onboardingStepOf(before?.onboarding_step));
        if (!firstRead && (!known || sitePage(known) !== sitePage(input.website_url))) newSite = input.website_url;
      }
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
      if (newSite) {
        const url = newSite;
        ctx.afterReply.push(() =>
          readWebsite(url)
            .then(({ images, ...site }) => rereadSite(studioId, site.url, site.logo ? images.filter((i) => i.split("?")[0] !== site.logo!.split("?")[0]) : images))
            .catch((e: unknown) => console.warn("new site unreadable", url, e)),
        );
        return json({ ok: true, nouveau_site: SITE_AGAIN, note: SITE_CHANGED });
      }
      return "ok";
    },

    async read_website({ url, refresh }) {
      try {
        const { images, ...site } = await readWebsite(url);
        const { data: studio } = await db.from("studios").select("onboarding_step").eq("id", studioId).single();
        const step = onboardingStepOf(studio?.onboarding_step);
        const photos = site.logo ? images.filter((i) => i.split("?")[0] !== site.logo!.split("?")[0]) : images;
        // Her site redone (she says so): its look is read again, at any step (a new address is read again by update_onboarding).
        if (refresh && (images.length || site.url)) {
          ctx.afterReply.push(() => rereadSite(studioId, site.url, photos));
          return json({ ...site, nouveau_site: SITE_AGAIN, note: SITE_CHANGED, ...(site.logo ? {} : { logo: "aucun logo trouvé sur le site : demande-le-lui" }) });
        }
        // Getting started: the site's photos and look become her moodboard (after the reply, never over hers).
        if ((step === "website" || step === "style") && (images.length || site.url)) {
          ctx.afterReply.push(() =>
            // Its logo is not one of its photos.
            readSiteLook(studioId, site.url, photos).then(
              (r) => console.info("site look", studioId, r),
              (e: unknown) => console.warn("site look failed", e),
            ),
          );
          return json({ ...site, photos_du_site: `${images.length} trouvées : je les mets dans son moodboard et dans sa médiathèque juste après ta réponse (elles apparaissent dans quelques secondes à l'étape Style), puis je lis le style de son site. Elles serviront pour sa première publication (list_media).`, ...(site.logo ? {} : { logo: "aucun logo trouvé sur le site : demande-le-lui" }) });
        }
        return json(site);
      } catch (error) {
        if (error instanceof WebsiteError) {
          console.warn("read_website failed", url, error.message);
          return json({ error: error.message });
        }
        throw error;
      }
    },

    async get_connect_link() {
      // On WhatsApp, a button under her message (the one-time link is made when it is sent).
      if (ctx.waId) {
        ctx.extras.link = { path: "/connect", label: "Relier mes comptes", purpose: "connect_social" };
        return json({ bouton: "« Relier mes comptes » sous ton message", note: "N'écris aucun lien : le bouton l'ouvre." });
      }
      const { data: member } = await db.from("members").select("phone_e164").eq("id", ctx.memberId).single();
      const url = await createLoginLink(member?.phone_e164 as string, "/connect", "connect_social");
      return json({ url, expires_in_minutes: 15 });
    },

    async get_page_link({ page }) {
      // WhatsApp is her interface on her phone: what needs a screen is a page made for it, behind a button.
      // The offers bring her back to /merci, which sends her back to WhatsApp with her message ready.
      const pages = {
        voix: { path: "/voix", label: "Choisir ma voix", purpose: "voice" as const, app: "Style › Voix et ton (/style#voix)" },
        abonnement: { path: "/abonnement?next=/merci", label: "Voir les offres", purpose: "billing" as const, app: "la page des offres (/abonnement)" },
      };
      const target = pages[page];
      if (ctx.waId) {
        ctx.extras.link = { path: target.path, label: target.label, purpose: target.purpose };
        return json({ bouton: `« ${target.label} » sous ton message`, note: "N'écris aucun lien : le bouton ouvre la page." });
      }
      return json({ ou: target.app, note: "Elle est dans l'application : dis-lui où aller en quelques mots." });
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
      // On WhatsApp, a button under her message (the one-time link is made when it is sent).
      ctx.extras.link = { path: `/v/${post_id}`, label: "Voir la publication", purpose: "open_post" };
      return json({ bouton: "« Voir la publication » sous ton message", note: "N'écris aucun lien : le bouton ouvre sa page." });
    },

    async list_media({ kind, days, limit, bank }) {
      let query = db
        .from("media_assets")
        .select("id, kind, source, mime_type, duration, width, height, created_at, regions, ai, bank, sorted_post_id")
        .eq("studio_id", studioId)
        .neq("source", "render")
        .order("created_at", { ascending: false })
        .limit(limit);
      query = bank ? query.eq("bank", true) : query.gt("created_at", new Date(Date.now() - days * 24 * 3600_000).toISOString());
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
      const sources: Record<string, string> = { whatsapp: "WhatsApp", web_upload: "app", library: "médiathèque", website: "son site", ai: "Edith (image IA)" };
      return json({
        medias: rows.map((r) => {
          const w = r.width as number | null;
          const h = r.height as number | null;
          const ai = r.ai as { mode: string; instruction: string } | null;
          return {
            media_id: r.id,
            type: r.kind === "video" ? "vidéo" : "photo",
            recue: when.format(new Date(r.created_at as string)),
            par: sources[r.source as string] ?? r.source,
            ...(w && h ? { format: w > h ? "paysage" : w < h ? "portrait" : "carré" } : {}),
            ...(r.duration ? { duree_s: Number(r.duration) } : {}),
            ...(summaries.get(r.id as string) ? { contenu: summaries.get(r.id as string) } : {}),
            ...((r.regions as { notes?: string } | null)?.notes ? { contenu: (r.regions as { notes: string }).notes } : {}),
            ...(r.bank ? { banque: true } : {}),
            ...(r.sorted_post_id ? { rangee_dans_post_id: r.sorted_post_id } : {}),
            ...(ai ? { ia: ai.mode === "improve" ? `photo améliorée (${ai.instruction.slice(0, 80)})` : `image d'ambiance : ${ai.instruction.slice(0, 80)}` } : {}),
          };
        }),
        note: rows.length
          ? "Prends celles dont elle parle (souvent les plus récentes, envoyées ensemble), sans lui redemander ses fichiers ; si elle n'a pas dit ce qu'elle imagine, demande-le-lui (ou une ref), puis create_post avec ces media_ids et le texte (write_on_photos) ou le montage."
          : bank
            ? "Sa banque de plans est vide : rien de vivant de côté pour l'instant."
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
          .insert({ studio_id: studioId, status: "planned", ...input, platforms: input.platforms ?? (await defaultPlatforms(studioId, input.kind)) })
          .select("id, kind, title, scheduled_at, status")
          .single(),
      );
      ctx.notes.push(`publication créée « ${post.title as string} » post_id=${post.id as string}`);
      await completeFirstPost(studioId);
      return json({ post });
    },

    async update_post({ post_id, status, ...fields }) {
      if (fields.media_ids?.length) await assertOwnMedia(fields.media_ids);
      // Her voice note: one of hers, read once (her words with their timings) before the montage uses it.
      if (fields.voice_media_id) {
        const { data: note } = await db.from("media_assets").select("kind").eq("id", fields.voice_media_id).eq("studio_id", studioId).maybeSingle();
        if (note?.kind !== "audio") throw new Error("Ce media_id n'est pas un message vocal de ce studio.");
        const transcript = await ensureTranscript(studioId, fields.voice_media_id);
        if (!transcript?.words.length) throw new Error("Je n'arrive pas à lire ce vocal : demande-lui de le renvoyer.");
        if (transcript.duration > VOICE_MAX_SECONDS) throw new Error(`Ce vocal dure ${Math.round(transcript.duration)} s : ${VOICE_MAX_SECONDS} s au plus pour un Reel. Demande-lui une version plus courte.`);
      }
      const current = unwrap(
        await db.from("posts").select("status").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (status) assertTransition(postStatusSchema.parse(current.status), status);
      // Her caption without the marks of machine writing (long dashes, invisible characters).
      if (fields.caption !== undefined) fields.caption = cleanCaption(fields.caption);
      const post = unwrap(
        await db
          .from("posts")
          .update({ ...fields, ...(status ? { status } : {}) })
          .eq("id", post_id)
          .eq("studio_id", studioId)
          .select("id, title, status, scheduled_at")
          .single(),
      );
      // Her material arrived: the filming missions of this publication are done.
      if (fields.media_ids?.length) {
        await db.from("shot_requests").update({ done: true }).eq("post_id", post_id).eq("studio_id", studioId).eq("done", false);
        if (!status && (current.status === "planned" || current.status === "content_requested")) {
          await db.from("posts").update({ status: "media_received" }).eq("id", post_id).eq("studio_id", studioId);
        }
      }
      return json({ post });
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

    async montage({ post_id, media_ids, brief, correction, max_new_scenes, variant, plan, effort, inspiration_id }) {
      const post = unwrap(await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single());
      if (inspiration_id) {
        const known = await db.from("inspirations").select("id").eq("id", inspiration_id).eq("studio_id", studioId).maybeSingle();
        if (!known.data) return "Inspiration introuvable : reprends un inspiration_id de list_inspirations.";
        check(await db.from("posts").update({ inspiration_id }).eq("id", post_id).eq("studio_id", studioId));
      }
      if ((correction || variant) && !post.edit_plan_id) return "Pas encore de montage pour cette publication : lance d'abord un montage (correction: false).";
      // A variant of a Reel the effects agent drew: the agent makes another version of its effect (a correction).
      if (variant && (await bakedReel(studioId, post_id))) {
        brief = [variant.hook ? `Une variante de ce Reel, avec une autre accroche : « ${variant.hook} ».` : "Une variante de ce Reel.", brief].filter(Boolean).join(" ");
        correction = true;
        variant = undefined;
      }
      // The level asked for, else the studio's default (Réglages).
      const studio = await db.from("studios").select("montage_effort").eq("id", studioId).single();
      const wanted = effort ?? effortSchema.catch(DEFAULT_EFFORT).parse(studio.data?.montage_effort);
      // Her first Reel is her first impression: it always gets its made-to-measure animations.
      const firstReel = !correction && !variant && (await isFirstReel(studioId, post_id));
      // Made-to-measure animations: as many as asked in the plan (charged only if made: her library
      // goes first). Without a plan, one on a new montage and none on a correction. Her first Reel gets at least two.
      const animations = plan?.scenes.filter((s) => s.kind === "animation").length ?? 0;
      const planned = plan ? animations : correction || variant ? 0 : 1;
      const scenes = Math.min(MAX_FREE_SCENES, max_new_scenes ?? (firstReel ? Math.max(2, planned) : planned));
      // No quote to show: the work is priced, started at once (her request is the go) and charged on delivery for what was made.
      const job = await createMontageQuote({ studioId, postId: post_id, mediaIds: media_ids ?? [], brief, correction, maxNewScenes: scenes, variant, plan, effort: wanted });
      if ("error" in job) {
        return json({
          possible: false,
          solde: job.balance,
          credits_necessaires: job.needed,
          // credits_necessaires is already the simplest version's price: a lighter one offered instead would not start either.
          note: "Pas assez de crédits pour ce montage, même dans sa version la plus simple (credits_necessaires). Dis-le simplement, sans rien lancer et sans proposer une version plus simple ou plus courte, qui ne passerait pas non plus : ses crédits reviennent à son renouvellement, ou elle prend « 1 Reel de plus » (12 crédits pour 5 €) ou l'offre au-dessus sur la page des offres (get_page_link abonnement).",
        });
      }
      const accepted = await acceptQuote(studioId, job.id, turnStartedAt, { immediate: true });
      if ("error" in accepted) return json({ error: accepted.error });
      // Who makes it, decided now so she hears the right time (the job keeps it): an effect drawn image by image takes longer.
      const route = accepted.kind === "variant" ? "chain" : await effectRoute(studioId, { postId: post_id, correction: accepted.kind === "correction", brief: accepted.brief, mediaIds: accepted.mediaIds }).catch(() => undefined);
      ctx.afterReply.push(() => startMontage(studioId, accepted, { waId: ctx.waId, replyTo: ctx.replyToMessageId, route, conversationId: ctx.conversationId, request: chatRequest(post_id) }));
      // In the app, the card follows the montage step by step; on WhatsApp, cards become links, so the post's link stays.
      ctx.extras.quote = job.id;
      if (ctx.waId) ctx.extras.posts = [post_id];
      const level = job.effort ? EFFORTS[job.effort] : null;
      const minutes = route === "agent" ? EFFECT_MINUTES : (level?.minutes ?? EFFORTS.rapide.minutes);
      ctx.notes.push(`montage lancé job=${job.id} pour « ${post.title as string} » post_id=${post_id}${route === "agent" ? " (effet image par image)" : level ? ` (${level.label})` : ""}`);
      return json({
        status: "started",
        publication: post.title,
        ...(route === "agent" ? { atelier: "effet dessiné image par image, sur ce qui bouge dans sa vidéo", duree: `${minutes} min` } : level ? { niveau: level.label, duree: `${minutes} min` } : {}),
        ...(job.effort && job.effort !== wanted && route !== "agent" ? { attention: `Le solde ne permettait pas le niveau ${EFFORTS[wanted].label} : lancé en ${level?.label}.` } : {}),
        note: `C'est lancé. Dis en une ou deux phrases ce que tu vas faire et quand la vidéo arrive (${minutes} min). Ne parle pas de prix ni de devis : le message de livraison dira combien de crédits ont servi. Ne demande pas « je lance ? ».`,
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
        note: "En montage, en rendu, en relecture ou en correction : tout va bien, il tourne et la vidéo arrive toute seule, même après 15 ou 20 minutes ; ne propose jamais de le relancer. late (seulement) : il s'est arrêté ; dis-le-lui simplement et propose de le refaire (montage).",
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

    async restyle_reel({ post_id, style, wish }) {
      if (style === "custom" && !wish) return json({ error: "Avec style custom, donne wish : ce qu'elle veut changer, avec ses mots. Demande-le-lui d'abord si elle ne l'a pas dit." });
      const post = unwrap(await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single());
      if (!post.edit_plan_id) return json({ error: "Cette publication n'a pas encore de montage." });
      const change = style === "custom" ? { ...customRestyle(wish!), button: "à sa façon" } : RESTYLE[style];
      // The adjustment stays in her art direction: every next montage follows it.
      const latest = await db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1);
      const current = brandProfileSchema.partial().catch({}).parse(latest.data?.[0]?.profile ?? {});
      const profile = { dos: [], donts: [], ...current, art_direction: withAdjustment(current.art_direction, style === "custom" ? { wish: wish! } : style) };
      const version = await nextVersion("brand_profiles", "studio_id", studioId);
      check(await db.from("brand_profiles").insert({ studio_id: studioId, version, profile }));
      // Her click is her yes: the corrected version starts at once, at the studio's level.
      const studio = await db.from("studios").select("montage_effort").eq("id", studioId).single();
      const effort = effortSchema.catch(DEFAULT_EFFORT).parse(studio.data?.montage_effort);
      // A change of style may deserve one new animation, never two.
      const quote = await createMontageQuote({ studioId, postId: post_id, mediaIds: [], brief: change.brief, correction: true, maxNewScenes: 1, effort });
      if ("error" in quote) {
        return json({ possible: false, style_garde: true, solde: quote.balance, credits_necessaires: quote.needed, note: "Le style est gardé pour les prochains montages, mais le solde ne suffit pas pour refaire la vidéo : dis-le simplement." });
      }
      const accepted = await acceptQuote(studioId, quote.id, turnStartedAt, { immediate: true });
      if ("error" in accepted) return json({ error: accepted.error });
      ctx.afterReply.push(() => startMontage(studioId, accepted, { waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId, request: chatRequest(post_id) }));
      ctx.extras.quote = quote.id;
      if (ctx.waId) ctx.extras.posts = [post_id];
      ctx.notes.push(`version ${change.button.toLowerCase()} lancée quote_id=${quote.id} pour « ${post.title as string} » post_id=${post_id}`);
      return json({
        status: "started",
        style: style === "custom" ? wish : change.button,
        note: `Le style est retenu pour tous ses prochains montages, et la nouvelle version de ce Reel est en route (${quote.effort ? EFFORTS[quote.effort].minutes : EFFORTS.rapide.minutes} min). Dis-le en une ou deux phrases chaleureuses, sans parler de prix : la livraison dira combien de crédits ont servi.`,
      });
    },

    async update_brand_profile({ titles, ...changes }) {
      // Only what changed: the moodboard, logo, fonts and saved text looks stay as they are; its titles' settings merge into its charter.
      let ambiance: string | null = null;
      const { version } = await insertProfileVersion(studioId, (profile) => {
        const signature = profile.signature as { titles?: Record<string, unknown> } | undefined;
        // A new ambiance while her charter is still her images' (no site): her charter is drawn from it.
        const notes = changes.visual_notes?.trim();
        ambiance = notes && notes !== (profile.visual_notes as string | undefined)?.trim() && charterFromImages(profile) ? notes : null;
        return {
          ...profile,
          ...changes,
          // Colours or fonts set on her word are hers: no reading of her site or images rewrites them.
          ...(changes.colors || changes.fonts ? { charter_from: "hand" } : {}),
          ...(titles && signature ? { signature: { ...signature, titles: { ...signature.titles, ...titles } } } : {}),
        };
      });
      if (ambiance) {
        const { data: studio } = await db.from("studios").select("onboarding_step").eq("id", studioId).single();
        const chosen: string = ambiance;
        if (onboardingStepOf(studio?.onboarding_step) !== "done") ctx.afterReply.push(() => rereadBrand(studioId, chosen).then(() => undefined));
      }
      // A font Google does not serve (a site's Adobe font): the Reels use its closest free twin; she can add her file.
      const fonts = Array.isArray(changes.fonts) ? changes.fonts.filter((f): f is string => typeof f === "string") : [];
      const { swaps } = fonts.length ? await usableFonts(fonts, [], "doux").catch(() => ({ swaps: [] })) : { swaps: [] };
      if (!swaps.length) return json({ version });
      return json({
        version,
        polices: swaps.map((s) => `« ${s.from} » n'est pas une police libre : ses Reels et ses photos utiliseront « ${s.to} », la plus proche`).join(" ; "),
        note: "Dis-le-lui en une phrase, sans jargon, et propose : si elle a le fichier de sa police, elle peut l'ajouter dans Style › Polices › « Tes polices » pour que ce soit exactement la sienne.",
      });
    },

    async render({ post_id }) {
      // Ownership check now, so the model gets an immediate error for a wrong id.
      const post = unwrap(
        await db.from("posts").select("id, title, edit_plan_id").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (!post.edit_plan_id) return json({ error: "Cette publication n'a pas encore de montage : lance montage." });
      // A re-render of an unchanged plan: free (no AI work).
      ctx.afterReply.push(async () => {
        await renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId });
      });
      return json({
        status: "started",
        note: "Le montage démarre après ta réponse et la vidéo sera envoyée automatiquement (environ une minute). Annonce-le en une phrase, sans décrire la vidéo comme si elle était déjà prête.",
      });
    },

    async set_music({ post_id, mode }) {
      const post = unwrap(await db.from("posts").select("id, kind, status, edit_plan_id, music").eq("id", post_id).eq("studio_id", studioId).single());
      if (post.kind !== "reel") return json({ error: "La musique se met sur un Reel." });
      if (["published", "measured"].includes(post.status as string)) return json({ error: "Ce Reel est déjà en ligne." });
      check(await db.from("posts").update({ music: { ...readPostMusic(post.music), mode: mode === "off" ? "off" : "on" } }).eq("id", post_id));
      // Not montaged yet: the choice is kept for the montage.
      if (!post.edit_plan_id) return json({ ok: true, note: "C'est noté pour son montage. Continue sans le redire longuement." });
      ctx.afterReply.push(async () => {
        await renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, freshMusic: mode === "another", conversationId: ctx.conversationId });
      });
      return json({ status: "started", note: "La vidéo se refait (1 à 2 min) et le lien part tout seul. Dis-le en une phrase." });
    },

    async set_voice({ post_id, mode, wish, voice, use }) {
      // One of Edith's voices, or her own clone (« sa voix », made in Style › Voix off).
      const own = voice ? await ownVoiceOf(studioId) : null;
      const chosen = voice ? voiceIn(voice, own) : undefined;
      if (voice && !chosen) {
        return json({
          error: `Voix inconnue. Voix possibles : ${[...(own ? ["sa voix (clonée)"] : []), ...SIMONE_VOICES.map((v) => v.name)].join(", ")}.${own ? "" : " Pour sa propre voix, elle la clone d'abord dans Style › Voix off (une minute à lire)."}`,
        });
      }
      // The studio's setting, for its next Reels.
      if (!post_id) {
        if (!use && !chosen) return json({ error: "Dis ce qui change : use (auto, always, never) et/ou voice." });
        await insertProfileVersion(studioId, (profile) => ({
          ...profile,
          voice: { ...readVoiceSetting(profile.voice), ...(use ? { use } : {}), ...(chosen ? { voice_id: chosen.id } : {}) },
        }));
        return json({ ok: true, note: "Gardé pour ses prochains Reels (elle le retrouve dans Style). Dis-le en une phrase." });
      }
      const post = unwrap(
        await db.from("posts").select("id, kind, status, edit_plan_id, voice_media_id, voice_over").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (post.kind !== "reel") return json({ error: "La voix off se met sur un Reel." });
      if (["published", "measured"].includes(post.status as string)) return json({ error: "Ce Reel est déjà en ligne." });
      if (mode === "off") {
        const rerender = await removeVoice(studioId, post_id);
        if (!rerender) return json({ ok: true, note: "C'est noté : pas de voix sur ce Reel." });
        // The voice is mixed into the video the effects agent drew: it makes the effect again without it.
        if (rerender === "agent") return effectCorrection(post_id, EFFECT_VOICE_OUT, "Edith refait l'effet sans la voix");
        ctx.afterReply.push(async () => {
          await renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId });
        });
        return json({ status: "started", note: "La vidéo se refait sans voix (1 à 2 min) et le lien part tout seul. Dis-le en une phrase." });
      }
      const onReel = post.voice_media_id
        ? (await db.from("media_assets").select("source").eq("id", post.voice_media_id as string).maybeSingle()).data
        : null;
      if (onReel && onReel.source !== "ai") {
        return json({
          error: "Ce Reel porte sa propre voix (son vocal). Elle reste : pour mettre ta voix à la place, demande-lui d'abord si elle veut retirer la sienne (set_voice off), puis remets-en une (on).",
        });
      }
      const current = readPostVoice(post.voice_over);
      const voiceId = chosen?.id ?? current?.voice_id;
      // Another text or another voice: the voice Edith made goes at the next montage, once.
      const remake = Boolean(onReel) && (mode === "redo" || Boolean(chosen));
      check(
        await db
          .from("posts")
          .update({ voice_over: { mode: "on", ...(voiceId ? { voice_id: voiceId } : {}), ...(wish ? { wish } : {}), ...(remake ? { remake: true } : {}) } })
          .eq("id", post_id),
      );
      return json({
        ok: true,
        note: post.edit_plan_id
          ? "C'est noté. Ce Reel est déjà monté : la voix arrive avec un nouveau montage (une correction). Propose-le-lui (montage avec correction: true), et lance-le quand elle est d'accord."
          : "C'est noté : la voix sera posée à son montage.",
      });
    },

    async design_carousel({ post_id, request, media_ids, fresh, example_media_ids }) {
      const post = unwrap(await db.from("posts").select("id, kind, status, media_ids").eq("id", post_id).eq("studio_id", studioId).single());
      if (post.kind !== "carousel" && post.kind !== "post") return json({ error: "Un carrousel composé est pour un carrousel ou un post photo (create_post kind carousel). Pour un Reel, c'est un montage." });
      if (post.status === "published" || post.status === "measured") return json({ error: "Cette publication est déjà en ligne." });
      if (media_ids?.length) await assertOwnMedia(media_ids);
      if (example_media_ids?.length) {
        const { data: examples } = await db.from("media_assets").select("id, kind").eq("studio_id", studioId).in("id", example_media_ids);
        if ((examples ?? []).filter((e) => e.kind === "image").length !== new Set(example_media_ids).size) return json({ error: "Un exemple doit être une image de sa médiathèque (photo ou capture d'écran)." });
      }
      const started = await startCarousel({ studioId, postId: post_id, request, mediaIds: media_ids, fresh, examples: example_media_ids, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId });
      if (started.status === "already_running") {
        return json({ status: "already_running", etape: started.stage, depuis_minutes: started.minutes, note: "Ce carrousel est déjà en cours : ne relance rien. Dis où il en est ; le message arrive tout seul." });
      }
      if (started.status === "error") return json({ error: started.error });
      ctx.notes.push(`carrousel en cours pour la publication ${post_id}`);
      return json({
        status: "started",
        credits: started.credits,
        note: "Edith compose le carrousel, en fait un rendu d'essai, le relit et le corrige : 3 à 6 minutes. Les crédits sont débités une fois livré et le lien part tout seul. Annonce-le en une phrase (délai et coût), sans lien.",
      });
    },

    async carousel_texts({ post_id, texts }) {
      const post = unwrap(await db.from("posts").select("id, status, slides").eq("id", post_id).eq("studio_id", studioId).single());
      if (post.status === "published" || post.status === "measured") return json({ error: "Cette publication est déjà en ligne." });
      const plan = slidesPlanSchema.safeParse(post.slides);
      const design = plan.success ? plan.data.design : undefined;
      if (!plan.success || !design) return json({ error: "Ce n'est pas un carrousel composé : pour ses textes, write_on_photos ; pour le composer, design_carousel." });
      const known = new Set(design.slots.map((s) => s.name));
      const unknown = texts.filter((t) => !known.has(t.slot)).map((t) => t.slot);
      if (unknown.length) return json({ error: `Slots inconnus : ${unknown.join(", ")}. Ceux de ce carrousel : ${[...known].join(", ")} (read_post).` });
      const next = { ...design, texts: { ...design.texts, ...Object.fromEntries(texts.map((t) => [t.slot, t.text])) } };
      await saveSlides(studioId, post_id, plan.data, { design: next });
      ctx.afterReply.push(async () => {
        await renderSlidesAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId });
      });
      return json({ status: "started", note: "Les nouveaux mots sont posés après ta réponse (environ une minute) et le lien part tout seul. Annonce-le en une phrase." });
    },

    async effect_words({ post_id, words }) {
      // Started now, free for her: its own script draws the effect again, then the video is delivered here.
      const started = await startEffectWords(studioId, post_id, words, { conversationId: ctx.conversationId, waId: ctx.waId, replyTo: ctx.replyToMessageId, tell: true });
      if (!started.ok) return json({ error: started.error });
      ctx.notes.push(`mots de l'effet en cours post_id=${post_id}`);
      return json({
        status: "started",
        note: `Ses mots se posent sur l'effet (${EFFECT_WORDS_MINUTES} min, gratuit) et la vidéo part toute seule une fois prête. Dis-le en une phrase.`,
      });
    },

    async write_on_photos({ post_id, template, slides }) {
      const post = unwrap(
        await db.from("posts").select("id, kind, status, media_ids, slides").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      if (slidesPlanSchema.safeParse(post.slides).data?.design) return json({ error: DESIGNED });
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
        await renderSlidesAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId });
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
          await renderSlidesAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId });
        } catch (error) {
          await notifyFailure({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId }, "Je n’ai pas réussi à retoucher tes photos cette fois. Tu veux que je réessaie ?", error);
        }
      });
      return json({
        status: "started",
        note: "Edith regarde les photos puis les retouche (une à deux minutes) ; le lien est envoyé tout seul. Annonce-le en une phrase, en disant ce que tu fais (lumière, flou des visages…).",
      });
    },

    async make_image({ mode, media_id, instruction, format, count, post_id }) {
      if (mode === "improve" && !media_id) return json({ error: "Donne le media_id de la photo à améliorer (list_media)." });
      if (media_id) await assertOwnMedia([media_id]);
      const n = mode === "ambiance" ? count : 1;
      const affordable = await canAffordImages(studioId, n);
      if (!affordable.ok) return json({ error: `Solde insuffisant : ${affordable.error}` });
      if (post_id) {
        const post = unwrap(await db.from("posts").select("status").eq("id", post_id).eq("studio_id", studioId).single());
        if (post.status === "published" || post.status === "measured") return json({ error: "Cette publication est déjà en ligne." });
      }
      const target = { studioId, waId: ctx.waId, replyTo: ctx.replyToMessageId, postId: post_id };
      // The model takes 10 to 30 s per image: after the reply, then they are shown in the conversation.
      ctx.afterReply.push(async () => {
        try {
          const made = mode === "improve" ? [await improvePhoto(studioId, media_id!, instruction, format)] : await makeAmbiance(studioId, instruction, format, n);
          if (post_id) {
            const { render } = await placeOnPost(studioId, post_id, made, mode === "improve" ? media_id : undefined);
            if (render) await renderSlides(studioId, post_id);
          }
          const text =
            mode === "improve"
              ? "Voilà ta photo améliorée ✨ L’originale reste dans ta médiathèque."
              : made.length > 1
                ? `Voilà ${made.length} images d’ambiance ✨ Elles sont dans ta médiathèque.`
                : "Voilà ton image d’ambiance ✨ Elle est dans ta médiathèque.";
          await deliverImages(target, made, text);
        } catch (error) {
          const why = error instanceof AiImageError ? error.message : "Je n’ai pas réussi à faire cette image cette fois. Tu veux que je réessaie ?";
          await notifyFailure({ ...target, postId: post_id ?? "" }, `${why} Aucun crédit n’a été débité.`, error);
        }
      });
      return json({
        status: "started",
        prix: `${n * CREDIT_PRICES.image} crédit${n > 1 ? "s" : ""}, débité${n > 1 ? "s" : ""} une fois l'image faite`,
        note: "L'image arrive dans la conversation dans moins d'une minute. Annonce-le en une phrase avec le prix, sans rien promettre de plus.",
      });
    },

    async blur_video({ post_id, what }) {
      // Drawn image by image by the effects agent: it blurs its own video.
      if (await bakedReel(studioId, post_id)) return effectCorrection(post_id, effectBlurBrief(what), what.length ? "Edith floute la vidéo de l'effet" : "Edith retire le flou de l'effet");
      ctx.afterReply.push(async () => {
        try {
          await blurMontage(studioId, post_id, what);
          await renderAndDeliver({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId });
        } catch (error) {
          await notifyFailure({ studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId }, "Je n’ai pas réussi à flouter la vidéo cette fois. Tu veux que je réessaie ?", error);
        }
      });
      return json({
        status: "started",
        note: what.length
          ? "Edith repère les zones dans chaque vidéo puis refait le rendu avec le flou (deux à trois minutes) ; le lien est envoyé tout seul. Annonce-le en une phrase."
          : "Le flou est retiré et le rendu refait ; le lien est envoyé tout seul.",
      });
    },

    async remember({ add, avoid, remove }) {
      const { data } = await db.from("studios").select("memory").eq("id", studioId).single();
      let memory = readMemory(data?.memory);
      // What was really there: Edith tells her what she forgot, or that it was never kept (never « retiré » for nothing).
      const forgotten = (remove ?? []).flatMap((n) => (memory[n - 1] ? [memory[n - 1]!.fact] : []));
      const missing = (remove ?? []).filter((n) => !memory[n - 1]);
      if (remove?.length) memory = removeFacts(memory, remove);
      const at = new Date().toISOString();
      if (add?.length) memory = addFacts(memory, add, at);
      if (avoid?.length) memory = addFacts(memory, avoid, at, "avoid");
      check(await db.from("studios").update({ memory }).eq("id", studioId));
      return json({
        ok: `${memory.length} info${memory.length > 1 ? "s" : ""} en mémoire`,
        // What is there now: what she sees in Réglages, so Edith never describes a memory she did not make.
        memoire: memory.map((m, i) => `${i + 1}. ${m.kind === "avoid" ? "À éviter : " : ""}${m.fact}`),
        ...(forgotten.length ? { oublie: forgotten } : {}),
        ...(missing.length ? { pas_en_memoire: missing } : {}),
        note: missing.length
          ? "Ces numéros n'étaient pas dans ta Mémoire : ne dis jamais que tu les as retirés."
          : forgotten.length || avoid?.length
            ? "Dis-lui en une phrase ce qui est oublié ou noté à éviter, avec ses mots."
            : "Tu n'as rien retiré : ne dis jamais que tu as retiré, supprimé ou fusionné une note (pour le faire, remove avec ses numéros). Ne l'annonce pas, continue la conversation.",
      });
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
        note: items.length ? "Propose-en 2 au plus, par leur titre." : "Aucune inspiration : elle peut partager un Reel à Edith sur Instagram ou en ajouter un dans l'app.",
      });
    },

    async steal_style({ link, media_id, inspiration_id }) {
      const source = link ? { link } : media_id ? { mediaId: media_id } : inspiration_id ? { inspirationId: inspiration_id } : null;
      if (!source) return json({ error: "Donne le lien du Reel, le media_id de la vidéo ou l'inspiration_id." });
      if (link && !reelLink(link)) return json({ error: "Ce n'est pas le lien d'un Reel, d'un TikTok ou d'un Short : demande-lui ce lien, ou la vidéo elle-même." });
      if (media_id) await assertOwnMedia([media_id]);
      // The model of one Reel of hers: an inspiration at once (its id for that Reel's montage),
      // taken, measured and read in its own job after the reply, which then tells her what her Reel takes from it.
      const started = await startSteal(studioId, source);
      if ("miss" in started) {
        return json({ error: started.miss === "not_found" ? "Cette vidéo ou cette inspiration est introuvable : demande-lui le lien du Reel, ou la vidéo elle-même." : await missMessage(started.miss) });
      }
      const job = { studioId, inspirationId: started.inspirationId, example: started.example, waId: ctx.waId, replyTo: ctx.replyToMessageId };
      ctx.afterReply.push(() =>
        queueJob("steal", job).catch((error: unknown) =>
          notifyFailure({ studioId, postId: "", waId: ctx.waId, replyTo: ctx.replyToMessageId }, "Je n’ai pas réussi à regarder ce Reel cette fois. Tu veux que je réessaie ?", error),
        ),
      );
      ctx.notes.push(`Reel à recopier pour son prochain Reel : inspiration_id=${started.inspirationId}`);
      return json({
        status: "started",
        inspiration_id: started.inspirationId,
        note: "Tu le regardes après ta réponse (environ une minute), puis tu lui envoies tout seul ce que son Reel en reprend. C'est le modèle d'un seul Reel, le prochain : si elle t'a déjà donné ses vidéos ou ses photos pour ce Reel (ou dit lesquelles prendre), crée la publication et lance montage tout de suite avec cet inspiration_id (le monteur attend la lecture) ; sinon ne les lui demande pas, ton message qui suit le fait. Annonce-le en une phrase, sans rien décrire de ce Reel avant de l'avoir vu.",
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

    async set_logo({ media_id }) {
      const { data: asset } = await db.from("media_assets").select("storage_path, kind, mime_type").eq("studio_id", studioId).eq("id", media_id).maybeSingle();
      if (!asset || asset.kind !== "image") return json({ error: "Ce fichier n'est pas une image : demande-lui son logo en image (PNG de préférence)." });
      const ext = ({ "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp", "image/jpeg": "jpg" } as Record<string, string>)[String(asset.mime_type)] ?? "jpg";
      // Copied to brand/: the chat's files expire, the logo stays.
      const path = `${studioId}/brand/logo-${Date.now()}.${ext}`;
      const { error } = await db.storage.from("media").copy(asset.storage_path as string, path);
      if (error) return json({ error: "Le logo n'a pas pu être enregistré." });
      let fromImages = false;
      await insertProfileVersion(studioId, (profile) => ((fromImages = charterFromImages(profile)), { ...profile, logo_path: path }));
      // With no charter of her site's (no site), her colours and fonts are drawn from her logo, free while she gets started.
      const { data: studio } = await db.from("studios").select("onboarding_step").eq("id", studioId).single();
      if (fromImages && onboardingStepOf(studio?.onboarding_step) !== "done") {
        ctx.afterReply.push(() => rereadBrand(studioId).then(() => undefined));
        return json({ ok: true, note: "Son logo est enregistré, et je tire de lui ses couleurs et sa police juste après ta réponse (avec ses images s'il y en a). Dis-le en une phrase." });
      }
      return json({ ok: true, note: "Son logo est enregistré : il finira ses Reels et peut se poser sur ses photos." });
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
            const target = { studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId };
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
            ...(plan.data.baked
              ? {
                  atelier_effets: effectWords(plan.data).length
                    ? "effet dessiné image par image : ses mots (mots_de_l_effet) se changent avec effect_words (gratuit) ; tout autre changement passe par montage avec correction: true"
                    : "effet dessiné image par image : ses textes et son effet sont dans l'image ; un changement passe par montage avec correction: true",
                  ...(effectWords(plan.data).length ? { mots_de_l_effet: effectWords(plan.data).map((w) => ({ id: w.id, place: w.label, texte: w.text, max: w.max })) } : {}),
                }
              : {}),
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
        ...(slides.success && slides.data.design ? { carrousel_compose: composedLines(slides.data.design) } : {}),
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
      if (slidesTemplate.data?.design) return json({ error: DESIGNED });
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
        // A new look is always kept in her styles (the editors show them as tiles), with its name or a plain one.
        const role = target === "all" ? "hook" : target;
        const keptAs = last && (save_as ?? (look && !named && !reset ? `${{ hook: "Titre", band: "Bandeau", caption: "Petite ligne" }[role]} ${last.font}` : undefined));
        if (keptAs && last) await keepTextLooks(studioId, [{ name: keptAs.slice(0, 40), role, look: last }]);
        // One render per post and turn, after every change (a style per photo is several calls).
        if (!rendering.has(post_id)) {
          rendering.add(post_id);
          ctx.afterReply.push(async () => {
            const to = { studioId, postId: post_id, waId: ctx.waId, replyTo: ctx.replyToMessageId, conversationId: ctx.conversationId };
            await (result.kind === "slides" ? renderSlidesAndDeliver(to) : renderAndDeliver(to));
          });
        }
        return json({
          status: "started",
          texts: result.changed,
          on: result.kind === "slides" ? "photos" : "montage",
          saved_as: keptAs || undefined,
          note: "Le rendu part après ta réponse et le lien est envoyé tout seul. Annonce le changement en une phrase.",
        });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Style non appliqué" });
      }
    },

    async schedule_post({ post_id }) {
      const post = unwrap(
        await db.from("posts").select("id, kind, status, render_id, media_ids, scheduled_at, platforms").eq("id", post_id).eq("studio_id", studioId).single(),
      );
      const missing = missingContent(post.kind as PostKind, Boolean(post.render_id), ((post.media_ids as string[] | null) ?? []).length);
      if (missing) return json({ error: MISSING_FOR_SIMONE[missing] });
      const platforms = (post.platforms as string[] | null) ?? ["instagram"];
      if (platforms.includes("instagram") && !(await instagramAccount(studioId))) {
        return json({ error: "Instagram n'est pas connecté pour ce studio. Envoie le lien de connexion (get_connect_link)." });
      }
      if (platforms.includes("tiktok") && !(await tiktokAccount(studioId).catch(() => null))) {
        return json({ error: "TikTok n'est pas connecté (ou la connexion a expiré). Envoie le lien de connexion (get_connect_link), ou retire TikTok de la publication (update_post platforms)." });
      }
      const current = postStatusSchema.parse(post.status);
      if (current !== "validated" && current !== "failed" && current !== "scheduled") {
        return json({ error: `La publication est au statut « ${current} » : elle doit d'abord être validée par la gérante (update_post status validated).` });
      }
      // Nothing waits for a set time any more: it goes out now (its moment was only for her reminder).
      check(
        await db
          .from("posts")
          .update({ status: "scheduled", scheduled_at: new Date().toISOString(), publish_started_at: null, publish_error: null, handoff_at: null, handoff_via: null })
          .eq("id", post_id),
      );
      ctx.afterReply.push(async () => void (await publishIfDue(post_id)));
      return json({ status: "publishing", note: "Publication immédiate après ta réponse ; elle verra le Reel en ligne dans quelques minutes." });
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
      // The account itself, week by week (relevé chaque jour par le cron).
      const days = unwrap(
        await db
          .from("account_daily")
          .select("platform, day, followers, new_followers, unfollows, views, reach, profile_views, link_taps, interactions")
          .eq("studio_id", studioId)
          .gte("day", new Date(new Date(from).getTime() - 7 * 86_400_000).toISOString().slice(0, 10))
          .lte("day", to.slice(0, 10))
          .order("day"),
      ) as (DailyRow & { platform: string })[];
      const weeksCount = Math.min(26, Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (7 * 86_400_000)) + 1));
      const account = Object.fromEntries(
        ["instagram", "tiktok"].flatMap((platform) => {
          const list = days.filter((d) => d.platform === platform);
          return list.length
            ? [[platform, { weeks: weeklyGrowth(list, weeksCount, new Date(to)).filter((w) => w.days > 0), period: periodTotals(list, from.slice(0, 10)) }]]
            : [];
        }),
      );
      return json({ metrics: [...latest.values()], account });
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

    async reply_with({ options, posts, grid, upload, pick_media, step_card, plan }) {
      const kept = plan ? keptPlan(plan) : null;
      if (plan && !kept) return "Plan trop court : un titre, 4 à 6 points « Rubrique : ce qu'on fait », et pourquoi. Rappelle reply_with avec le plan entier.";
      let own: string[] = [];
      if (posts?.length) {
        const { data } = await db.from("posts").select("id").eq("studio_id", studioId).in("id", posts);
        const found = new Set((data ?? []).map((p) => p.id as string));
        own = posts.filter((id) => found.has(id));
        if (own.length < posts.length) return "Publication introuvable : vérifie les id avec get_calendar.";
      }
      // In the app, a step with its own card (site, style, rhythm) is answered on the card:
      // never answer buttons beside it, which would show the same choice twice.
      let card = ctx.waId ? undefined : step_card;
      let answers = options ?? (kept ? [...PLAN_BUTTONS] : undefined);
      if (!ctx.waId && (answers?.length || card)) {
        const { data: studio } = await db.from("studios").select("onboarding_step").eq("id", studioId).single();
        const step = onboardingStepOf(studio?.onboarding_step);
        if (step === "website" || step === "style" || step === "rhythm") {
          card = step;
          answers = undefined;
        }
      }
      ctx.extras.step_card = card;
      ctx.extras.options = answers;
      ctx.plan = kept ? planMessage(kept) : undefined;
      ctx.extras.posts = own.length ? own : undefined;
      ctx.extras.grid = grid || undefined;
      // The drop zone is the app's; on WhatsApp, files asked for become her upload link under the message (full quality).
      ctx.extras.upload = ctx.waId ? (upload ?? pick_media) : upload;
      ctx.extras.pick_media = ctx.waId ? undefined : pick_media;
      if (kept) return "ok : ton plan est écrit sous ta phrase, avec ses boutons ; ne le réécris pas.";
      const shown = ctx.waId && (upload ?? pick_media) ? "ok : son lien de dépôt (pleine qualité) est ajouté sous ton message ; n'écris aucun lien." : "ok : affiché sous ton message.";
      // Called before a word was written, the model was asked again and wrote « Voilà, j'attends ton choix. » or
      // « Voilà, j'ai mis les boutons juste en dessous. » as if its question had been sent: only what it writes
      // reaches her, never its thoughts. The loop knows whether anything was written: when nothing was, it says so plainly.
      if (!ctx.wrote) {
        return `${shown} Mais ta réponse n'a encore aucun mot : elle n'a rien reçu de toi, ni ta question ni ta proposition (tes réflexions ne lui parviennent jamais). Écris maintenant ton message entier, comme si c'était le premier mot que tu lui envoies : ce que tu proposes et la question à laquelle ces boutons répondent. Jamais une phrase sur les boutons ou sur un message absent (« Voilà le plan », « j'ai mis les boutons », « j'attends ton choix »).`;
      }
      return `${shown} Si ce que tu as écrit ne contient pas encore la question à laquelle ces boutons répondent, écris-la maintenant : elle ne voit que ce que tu écris, jamais tes réflexions. Jamais une phrase qui renvoie à un message absent (« Voilà le plan », « j'attends ton choix »).`;
    },
  };

  // Nothing costly starts without a subscription (past her first publication) or
  // without credits: the tool answers what to tell her instead (lib/billing/access.ts).
  for (const name of COSTLY_TOOLS) {
    const run = handlers[name] as (input: unknown) => Promise<string>;
    (handlers as Record<string, (input: unknown) => Promise<string>>)[name] = async (input) => {
      const access = await studioAccess(studioId);
      if (!access.create) return json({ refused: true, message: accessMessage(access.reason) });
      return run(input);
    };
  }
  return handlers;
}
