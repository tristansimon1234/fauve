"use server";

import { ANALYST_MODEL, filmIdeas, keptProposals, postIdeas, postKindSchema, PROPOSAL_PROMPT, proposalSchema, publishWhen, readMemory, readVoiceSetting, reelLink, stolenStyleLines, stolenStyleSchema, TRIAL_DAYS, type PostIdea } from "@fauve/agent";
import { outputFormat } from "@fauve/agent/answer";
import { z } from "zod";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { studioAccess } from "@/lib/billing/access";
import { localInstant, localDateOf, localTimeOf, parseIsoDate, toIsoDate } from "@/lib/dates";
import { queueJob } from "@/lib/jobs";
import { freeSlots, type Slot } from "@/lib/slots";
import { studioModels, type ReelModel } from "@/lib/reel-models";
import { missMessage, pendingSteal, READING_MS, startSteal, type StealMissReason, type StealSource } from "@/lib/steal";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// What the « Nouvelle publication » screen offers: the studio's photos and videos to
// pick from, free days to post on, ideas in a tap and things easy to film.

export type { Slot } from "@/lib/slots";
export type LibraryItem = { id: string; url: string; video: boolean; at: string; /** A video's length, once watched. */ duration?: number | null };
/** A free day to post on, with when it is in her words (« vendredi à 18 h »). */
export type SlotOption = Slot & { iso: string; full: string; short: string };
export type NewPostOptions = {
  studioId: string;
  timezone: string;
  slots: SlotOption[];
  /** The studio's local date and time now (YYYY-MM-DDTHH:MM): another date she types is read against it. */
  nowLocal: string;
  /** Things easy to film this week, when she has nothing at hand. */
  film: { idea: string; how: string }[];
  media: LibraryItem[];
  /** One-tap ideas by format, for this kind of business: a label, and the request it fills in. */
  ideas: Record<"reel" | "carousel" | "post" | "story", PostIdea[]>;
  /** Her voice-over setting (Style), the first choice for a Reel. */
  voice: { use: "auto" | "always" | "never"; voiceId: string | null };
  /** TikTok connected: a Reel goes there too, unless she says otherwise. */
  tiktok: boolean;
  /** The Reel she sent Simone to copy (« Steal »): her next Reel follows it, unless she says otherwise. */
  copy: { id: string; name: string | null; lines: string[] } | null;
  /** Her Reels kept as models (« Garder comme modèle »): a new Reel made like one of them. */
  models: ReelModel[];
};

export async function newPostOptions(): Promise<NewPostOptions | null> {
  const { db, member } = await getStudioContext();
  if (!member) return null;
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const now = new Date();

  const [slots, assets] = await Promise.all([
    freeSlots(studioId, tz, 4, now),
    db.from("media_assets").select("id, storage_path, kind, created_at, duration").eq("studio_id", studioId).in("kind", ["image", "video"]).neq("source", "render").order("created_at", { ascending: false }).limit(40),
  ]);
  const [{ data: studio }, { data: brand }, { data: tiktok }, copy, models] = await Promise.all([
    db.from("studios").select("business_type").eq("id", studioId).maybeSingle(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("social_accounts").select("status").eq("studio_id", studioId).eq("platform", "tiktok").maybeSingle(),
    pendingSteal(studioId).catch(() => null),
    studioModels(studioId).catch(() => []),
  ]);
  const voice = readVoiceSetting((brand?.profile as { voice?: unknown } | null)?.voice);

  const media = (assets.data ?? []).map((a) => ({
    id: a.id as string,
    path: a.storage_path as string,
    video: a.kind === "video",
    at: a.created_at as string,
    duration: (a.duration as number | null) ?? null,
  }));
  const urls = await signMediaUrls(db, studioId, media.map((m) => m.path));
  const today = localDateOf(now, tz);
  const clock = localTimeOf(now, tz);
  return {
    studioId,
    timezone: tz,
    slots: slots.flatMap((s) => {
      const day = parseIsoDate(s.date);
      const [h, m] = s.time.split(":").map(Number);
      if (!day || h === undefined || m === undefined) return [];
      const iso = localInstant(day, h, m, tz).toISOString();
      const when = publishWhen(iso, tz, now);
      return [{ ...s, iso, full: when.full, short: when.short }];
    }),
    nowLocal: `${toIsoDate(today)}T${String(clock.hours).padStart(2, "0")}:${String(clock.minutes).padStart(2, "0")}`,
    film: filmIdeas(studio?.business_type as string | null),
    media: media.flatMap((m) => {
      const url = urls.get(m.path);
      return url ? [{ id: m.id, url, video: m.video, at: m.at, duration: m.duration }] : [];
    }),
    ideas: postIdeas(studio?.business_type as string | null),
    voice: { use: voice.use, voiceId: voice.voice_id ?? null },
    tiktok: tiktok?.status === "connected",
    copy: copy ? { id: copy.id, name: copy.name, lines: copy.lines } : null,
    models,
  };
}

export type CopyStart = { ok: true; id: string } | { ok: false; error: string };
/** Where a Reel to copy is: being read, read (what her Reel takes from it), or not readable (what to do instead). */
export type CopyState = { state: "reading" } | { state: "read"; name: string | null; lines: string[] } | { state: "missed"; message: string };

const copyFromSchema = z.union([
  z.object({ link: z.string().max(500) }),
  z.object({ upload: z.object({ path: z.string().max(300), mime: z.string().max(100), size: z.number().int().positive() }) }),
]);

/**
 * « Comme un Reel que tu aimes » on the Créer screen: the Reel she gives there (its link, or its
 * video) becomes the model of this Reel (« Steal »), read at once in its own job, as when she
 * sends it to Simone in the chat. Her Reel can start before the reading ends: it waits for it.
 */
export async function copyReel(input: z.input<typeof copyFromSchema>): Promise<CopyStart> {
  const from = copyFromSchema.safeParse(input);
  if (!from.success) return { ok: false, error: "Colle le lien d’un Reel, ou choisis sa vidéo." };
  const { member } = await getStudioContext();
  if (!member) return { ok: false, error: "Ton numéro n’est relié à aucun studio." };
  const studioId = member.studio.id;
  const access = await studioAccess(studioId);
  if (!access.create) {
    return {
      ok: false,
      error: access.reason === "credits" ? "Tu n’as plus de crédits ce mois-ci : ils reviennent le 1er du mois." : `Démarre ton essai pour copier le style d’un Reel : ${TRIAL_DAYS} jours offerts.`,
    };
  }
  let source: StealSource;
  if ("link" in from.data) {
    const link = from.data.link.trim();
    if (!reelLink(link)) return { ok: false, error: "Ce n’est pas le lien d’un Reel, d’un TikTok ou d’un Short. Copie-le avec le bouton Partager, puis colle-le ici." };
    source = { link };
  } else {
    const file = from.data.upload;
    if (!file.path.startsWith(`${studioId}/chat/`) || file.path.includes("..") || !file.mime.startsWith("video/")) return { ok: false, error: "Choisis une vidéo." };
    // Someone else's Reel, never one of her shots: it leaves her library once read (dropExample).
    const asset = await supabaseAdmin()
      .from("media_assets")
      .insert({ studio_id: studioId, storage_path: file.path, kind: "video", source: "web_upload", mime_type: file.mime, size_bytes: file.size })
      .select("id")
      .single();
    if (asset.error) return { ok: false, error: "La vidéo n’a pas pu être ajoutée. Réessaie." };
    source = { mediaId: asset.data.id as string };
  }
  const started = await startSteal(studioId, source);
  if ("miss" in started) return { ok: false, error: await missMessage(started.miss) };
  try {
    await queueJob("steal", { studioId, inspirationId: started.inspirationId, example: started.example, fromCreate: true });
  } catch (error) {
    console.warn("create: steal not queued", error);
    return { ok: false, error: "Je n’arrive pas à regarder ce Reel pour l’instant. Réessaie dans un instant." };
  }
  return { ok: true, id: started.inspirationId };
}

/** The reading of a Reel to copy, for the Créer screen while it waits. */
export async function copyState(id: string): Promise<CopyState | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { member } = await getStudioContext();
  if (!member) return null;
  const { data } = await supabaseAdmin().from("inspirations").select("style, analysis, created_at").eq("id", id).eq("studio_id", member.studio.id).maybeSingle();
  if (!data) return null;
  const style = stolenStyleSchema.safeParse(data.style);
  if (style.success) return { state: "read", name: style.data.look.name, lines: stolenStyleLines(style.data) };
  const miss = (data.style as { miss?: StealMissReason } | null)?.miss;
  if (miss) return { state: "missed", message: await missMessage(miss) };
  if (!data.analysis && Date.now() - Date.parse(data.created_at as string) < READING_MS) return { state: "reading" };
  return { state: "missed", message: await missMessage("unreadable") };
}

/** The studio's recent photos and/or videos, for the picker Fauve shows in the chat (reply_with pick_media). */
export async function libraryForPicker(kind: "photo" | "video" | "any"): Promise<LibraryItem[]> {
  const { db, member } = await getStudioContext();
  if (!member) return [];
  const studioId = member.studio.id;
  const kinds = kind === "photo" ? ["image"] : kind === "video" ? ["video"] : ["image", "video"];
  const { data } = await db.from("media_assets").select("id, storage_path, kind, created_at").eq("studio_id", studioId).in("kind", kinds).neq("source", "render").order("created_at", { ascending: false }).limit(24);
  const media = (data ?? []).map((a) => ({ id: a.id as string, path: a.storage_path as string, video: a.kind === "video", at: a.created_at as string }));
  const urls = await signMediaUrls(db, studioId, media.map((m) => m.path));
  return media.flatMap((m) => {
    const url = urls.get(m.path);
    return url ? [{ id: m.id, url, video: m.video, at: m.at }] : [];
  });
}

const proposalInput = z.object({
  kind: postKindSchema,
  /** Her picks, in order: from her library (« media »), or just sent from her phone (« upload »). */
  files: z
    .array(z.union([z.object({ media: z.uuid() }), z.object({ upload: z.object({ path: z.string().max(300), mime: z.string().max(100), video: z.boolean() }) })]))
    .min(1)
    .max(20),
  /** For a Reel: « off » just the music, a voice id, « auto » Simone chooses. */
  voice: z.string().max(60).optional(),
  /** She follows a Reel she likes: its form, not her own. */
  copying: z.boolean().optional(),
});

/** Images Claude reads from a link. */
const READABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_LOOKS = 6;

/**
 * The last step of « Créer »: what Simone would make of the files she picked, three ideas in a
 * tap, from what is in them (what Gemini read of her library, or the photos themselves when they
 * were just sent). On any failure, the usual ideas for her kind of business.
 */
export async function proposeIdeas(input: z.input<typeof proposalInput>): Promise<{ ideas: PostIdea[]; fromFiles: boolean }> {
  const parsed = proposalInput.safeParse(input);
  const { db, member } = await getStudioContext();
  if (!member || !parsed.success) return { ideas: [], fromFiles: false };
  const studioId = member.studio.id;
  const { kind, files, voice, copying } = parsed.data;
  const { data: studio } = await db.from("studios").select("name, business_type, memory").eq("id", studioId).maybeSingle();
  const fallback = { ideas: postIdeas(studio?.business_type as string | null)[kind].slice(0, 3), fromFiles: false };
  try {
    const admin = supabaseAdmin();
    const ids = files.flatMap((f) => ("media" in f ? [f.media] : []));
    const [{ data: assets }, { data: analyses }] = await Promise.all([
      ids.length ? admin.from("media_assets").select("id, kind, mime_type, storage_path, duration, regions").eq("studio_id", studioId).in("id", ids) : Promise.resolve({ data: [] }),
      ids.length ? admin.from("clip_analyses").select("media_id, analysis").in("media_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
    const summaries = new Map<string, string>();
    for (const a of analyses ?? []) {
      const summary = (a.analysis as { summary?: string } | null)?.summary;
      if (summary && !summaries.has(a.media_id as string)) summaries.set(a.media_id as string, summary);
    }
    // Each file, in her order: what is known of it, or the photo itself for Claude to look at.
    const lines: string[] = [];
    const looks: { n: number; path: string }[] = [];
    files.forEach((f, i) => {
      const n = i + 1;
      if ("upload" in f) {
        if (!f.upload.path.startsWith(`${studioId}/`)) return;
        if (f.upload.video) lines.push(`${n}. une vidéo qu'elle vient d'envoyer (pas encore regardée)`);
        else if (READABLE.has(f.upload.mime) && looks.length < MAX_LOOKS) {
          looks.push({ n, path: f.upload.path });
          lines.push(`${n}. une photo (image ${n} ci-dessous)`);
        } else lines.push(`${n}. une photo qu'elle vient d'envoyer`);
        return;
      }
      const a = byId.get(f.media);
      if (!a) return;
      const video = a.kind === "video";
      const known = video ? summaries.get(f.media) : (a.regions as { notes?: string } | null)?.notes;
      if (known) lines.push(`${n}. ${video ? `vidéo${a.duration ? ` de ${Math.round(Number(a.duration))} s` : ""}` : "photo"} : ${known.slice(0, 300)}`);
      else if (!video && READABLE.has(String(a.mime_type)) && looks.length < MAX_LOOKS) {
        looks.push({ n, path: a.storage_path as string });
        lines.push(`${n}. une photo (image ${n} ci-dessous)`);
      } else lines.push(`${n}. ${video ? "une vidéo (pas encore regardée)" : "une photo"}`);
    });
    // Nothing known of any of them: her kind of business is all there is, the usual ideas say it as well.
    if (!looks.length && !lines.some((l) => l.includes(" : "))) return fallback;
    const signed = looks.length ? ((await admin.storage.from("media").createSignedUrls(looks.map((l) => l.path), 300)).data ?? []) : [];
    const images = looks.flatMap((l, i) => {
      const url = signed[i]?.signedUrl;
      return url ? [{ type: "text" as const, text: `Image ${l.n}` }, { type: "image" as const, source: { type: "url" as const, url } }] : [];
    });
    const format = { reel: "un Reel", carousel: "un carrousel", post: "un post photo", story: "une story" }[kind];
    const spoken = kind !== "reel" || !voice ? undefined : voice === "off" ? "juste la musique, sans voix" : voice === "auto" ? "elle laisse Simone choisir" : "avec une voix off qui raconte";
    const response = await anthropic().beta.messages.parse({
      model: ANALYST_MODEL,
      max_tokens: 900,
      output_config: { effort: "low", format: outputFormat(proposalSchema) },
      system: PROPOSAL_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                commerce: { nom: studio?.name ?? undefined, activite: studio?.business_type ?? undefined, ce_qu_on_sait: readMemory(studio?.memory).map((m) => m.fact).slice(0, 12) },
                publication: { format, ...(spoken ? { voix: spoken } : {}), ...(copying ? { forme: "elle recopie un Reel qu'elle aime : propose le fond, la forme viendra de ce Reel" } : {}) },
                fichiers_dans_l_ordre: lines,
              }),
            },
            ...images,
          ],
        },
      ],
    });
    await logClaudeCost(studioId, response.usage, "ideas", ANALYST_MODEL);
    const ideas = keptProposals(response.parsed_output);
    return ideas.length >= 2 ? { ideas, fromFiles: true } : fallback;
  } catch (error) {
    console.warn("proposeIdeas failed", error instanceof Error ? error.message : error);
    return fallback;
  }
}
