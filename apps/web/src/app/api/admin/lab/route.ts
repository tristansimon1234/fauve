import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { after } from "next/server";
import { z } from "zod";
import {
  CHAT_MODEL,
  editPlanSchema,
  imaginedBrief,
  intentionTitle,
  isMotionSegment,
  MAX_MONTAGE_FILES,
  motionTemplateSchema,
  reelLink,
  type MotionTemplate,
} from "@fauve/agent";
import { anthropic, logClaudeCost } from "@/lib/agent/run";
import { readWebsite } from "@/lib/agent/website";
import { cronAuthorized } from "@/lib/cron-auth";
import { usableFonts } from "@/lib/fonts";
import { queueJob } from "@/lib/jobs";
import { readSiteLook } from "@/lib/site-look";
import { missMessage, stealNow, stealStyle } from "@/lib/steal";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { speak, writeVoiceScript } from "@/lib/voice-over";
import { ensureTranscript } from "@/lib/voice";
import { renderPost } from "@/lib/render/render-post";
import { voiceNoteInSandbox } from "@/lib/render/sandbox";
import { photoRegions } from "@/lib/video/regions";

// A test bench for the whole montage chain in production: what Simone makes alone, on
// the same media as hand-made references. Each case is a lab studio of its own (its
// business, brand and facts; website_url lab://<case>), so its Reel is a first Reel, as
// at onboarding. POST with CRON_SECRET, from the database (call_app):
//   ?case=…[&reset=1]    sets up the studio and its media if needed (free stock clips by
//                        URL, or the photos of a demo studio), has them all read (Gemini),
//                        then starts the same montage job as a manager's Reel at the default
//                        care (editor, motion designer, render with music, critic, corrections),
//                        without a quote. Answers at once and works after the response.
//                        reset=1 first removes the case's posts and scenes, for a new first Reel;
//                        stock=<id>,… other free stock clips (Mixkit ids) for this run, to try a
//                        clip without a new deploy;
//                        idea=<her words> is what she writes in « Ce que tu imagines » (else the
//                        case's idea), sent as the Créer screen sends it: the post's title, and
//                        « Ce que la gérante imagine : … » for the editor and the voice;
//                        voice=1 (or voice=<ElevenLabs voice id>) is her « Voix off » choice on that
//                        screen (else the studio's setting): the montage job writes and records it;
//                        own_voice=1 (or own_voice=<her words>) a voice note of hers instead, as one
//                        comes from WhatsApp: words for the images (or hers) read by a voice of the
//                        gallery, made a phone's OGG Opus note (16 kHz mono, quieter, band-limited),
//                        kept as a WhatsApp audio and read by Scribe, then put on the Reel;
//                        steal=<url> (« Steal ») first has the style of a Reel read, from its link
//                        (Instagram, TikTok, a Short) or a video file's URL, and the lab Reel copies it
//                        (one shot, as when she sends Simone a Reel to copy); steal=lab:<file> a video
//                        uploaded to the lab studio, read as a video she sent in the chat (it leaves
//                        the library once read); with steal_only=1, nothing more (no montage):
//                        step=result shows what was read;
//                        own=<file>,… videos of hers uploaded to the lab studio, instead of the stock clips.
//   ?case=…&step=upload&file=<name>.mp4|mov  a signed upload URL (2 h) for a file of hers into the
//                        lab studio ({studio}/lab/<name>), for own= and steal=lab:.
//   ?case=…&step=result  every version: its render (signed link, 24 h), the plan kept
//                        (without the scenes' code), the delivered message, what this Reel cost
//                        (costs) and what the lab studio has spent over all its runs (studio_costs).
//   ?case=…&step=music   the version kept rendered again with a newly composed piece, the
//                        montage untouched: to hear a change to the music without a new montage.
//   ?site=<url>[&kind=coiffeur|restaurant|pilates][&clips=1][&reset=1][&idea=…][&voice=…|&own_voice=…]
//                        a real business from its website, as at onboarding: its site read
//                        (facts and activity, colours and fonts of its code, logo), then its look
//                        (its page read in the sandbox's browser: fonts and colours measured, captures;
//                        Sonnet writes its art direction and signature, gives its fonts their free
//                        twins and keeps the photos that show the business), then its first Reel
//                        from those photos (clips=1 adds the stock clips of the kind's trade; the
//                        kind only sets the idea). Never published. step=result adds its brand.
// Lab studios go with /api/admin/delete-studio.
// A render with its music (step=music) runs after the answer, as long as a montage job's step.
export const maxDuration = 800;

/** The files of one montage, as in the app (MAX_FILES) and the montage job. */
const MAX_MEDIA = MAX_MONTAGE_FILES;

type LabCase = {
  name: string;
  business: string;
  facts: string[];
  brand: { colors: string[]; fonts: [string, string]; tone: string };
  /** A form she asks for (« collage »); none: the editor chooses the rhythm and the form, as for her. */
  template?: MotionTemplate;
  title: string;
  /** What she asks for: the post's idea and the editor's request. */
  idea: string;
  /** Free stock clips (Mixkit licence), in 720p. */
  clips?: number[];
  /** Videos of hers uploaded to the lab studio (step=upload), by file name. */
  own?: string[];
  /** The vertical photos of a demo studio. */
  photosOf?: { studio: string; max: number };
};

const CASES: Record<string, LabCase> = {
  pizzeria: {
    name: "Pizzeria Nonna",
    business: "pizzeria",
    facts: ["Pizzeria napolitaine au feu de bois, Paris 11e", "Pâte maturée 48 h, pétrie chaque matin", "Ouvert tous les soirs, terrasse aux beaux jours"],
    brand: { colors: ["#C8102E", "#F4EDE1", "#1E5631"], fonts: ["Anton", "Space Mono"], tone: "chaleureux, tutoiement, une pointe d'humour" },
    title: "Dîner ce soir",
    idea: "Un Reel qui donne envie de venir dîner ce soir.",
    clips: [42484, 42465, 42469, 42481, 42480, 44007, 2597],
  },
  pilates: {
    name: "Studio Ciel",
    business: "studio de Pilates Reformer",
    facts: ["Studio de Pilates Reformer à Lyon", "6 reformers, cours de 50 minutes, 8 personnes au plus", "Premier cours d'essai offert"],
    brand: { colors: ["#B4532A", "#EFE6DA", "#2F3B2F"], fonts: ["Instrument Serif", "Inter Tight"], tone: "doux, motivant, tutoiement" },
    title: "Cours d'essai",
    idea: "Un Reel qui donne envie de réserver un cours d'essai.",
    clips: [48562, 48547, 48553, 48558, 48548, 48560, 48552],
  },
  barbier: {
    name: "Le Comptoir",
    business: "barbier",
    facts: ["Barbier à Bordeaux, coupe et barbe à l'ancienne", "Serviette chaude à chaque rasage", "Barbe et coupe en 45 minutes"],
    brand: { colors: ["#B08D57", "#F3EEE6", "#1B1B1B"], fonts: ["Playfair Display", "Inter Tight"], tone: "posé, précis, tutoiement" },
    title: "Coupe et barbe",
    idea: "Un Reel qui montre le soin d'une coupe et barbe.",
    clips: [43233, 43240, 43232, 43241, 43279, 43226],
  },
  coiffure: {
    name: "Atelier Mila",
    business: "salon de coiffure",
    facts: ["Salon de coiffure à Nantes, coupes et couleurs naturelles", "Balayage sur mesure, diagnostic offert"],
    brand: { colors: ["#C9898F", "#F7EFEA", "#3A2E2C"], fonts: ["Fraunces", "Inter Tight"], tone: "doux, chaleureux, tutoiement" },
    title: "L'ambiance du salon",
    idea: "Un Reel avec mes photos du salon, pour faire découvrir l'ambiance.",
    photosOf: { studio: "Maison Maya", max: 8 },
  },
  boutique: {
    name: "Maison Lou",
    business: "boutique de mode femme",
    facts: ["Concept store de mode femme à Lille, pièces choisies une à une", "Nouvelle sélection chaque mois", "-20 % sur toute la boutique ce week-end"],
    brand: { colors: ["#E4572E", "#FFF4EC", "#1F1A3A"], fonts: ["Syne", "Inter Tight"], tone: "pétillant, complice, tutoiement" },
    title: "Ce week-end",
    idea: "Un Reel où je parle à la caméra, pour faire venir à la boutique ce week-end.",
    // She films herself, talking and moving her hands (vertical clips).
    clips: [42323, 42283, 42308],
  },
  trattoria: {
    name: "Trattoria Sole",
    business: "restaurant italien",
    facts: ["Restaurant italien à Marseille, pâtes fraîches et pizzas au feu de bois", "Grande terrasse face au port"],
    brand: { colors: ["#E07A1F", "#FBF3E4", "#23402E"], fonts: ["Bricolage Grotesque", "Inter Tight"], tone: "gourmand, joyeux, tutoiement" },
    title: "La terrasse ce week-end",
    idea: "Un Reel avec mes photos et mes vidéos pour remplir la terrasse ce week-end.",
    clips: [42469, 42481, 42480, 42484],
    photosOf: { studio: "Chez Lino", max: 5 },
  },
};

const labUrl = (name: string) => `lab://${name}`;

/** A real business tested from its site: what it is, what it asks for, and stock clips of the same trade. */
const KINDS: Record<string, { business: string; title: string; idea: string; clipsOf?: string }> = {
  coiffeur: {
    business: "salon de coiffure",
    title: "Le salon",
    idea: "Un Reel avec les photos de mon site, qui fait découvrir le salon et donne envie de prendre rendez-vous.",
  },
  restaurant: {
    business: "restaurant",
    title: "Ce soir",
    idea: "Un Reel avec les photos de mon site, qui donne envie de venir manger ce soir.",
    clipsOf: "pizzeria",
  },
  pilates: {
    business: "studio de Pilates",
    title: "Cours d'essai",
    idea: "Un Reel avec les photos de mon site, qui donne envie de réserver un cours d'essai.",
    clipsOf: "pilates",
  },
};

const siteKey = (url: string) => `lab://site/${new URL(url).hostname.replace(/^www\./, "")}`;

const factsSchema = z.object({
  name: z.string().describe("Le nom du commerce, tel qu'il l'écrit"),
  business: z.string().describe("Son activité en quelques mots, comme il la décrit (« coffee shop et salon de coiffure », « sandwicherie », « studio de Pilates Reformer »)"),
  facts: z.array(z.string()).describe("3 à 5 faits courts et vrais, tirés du site : ville ou quartier, spécialités, ce qui le rend unique, offre ou façon de réserver"),
});

/** What its site says, in a few true facts (what the editor writes its texts from). */
async function siteFacts(studioId: string, site: Awaited<ReturnType<typeof readWebsite>>) {
  const response = await anthropic().beta.messages.parse({
    model: CHAT_MODEL,
    max_tokens: 1000,
    output_config: { effort: "low", format: betaZodOutputFormat(factsSchema) },
    system: "Tu lis le site d'un commerce de quartier. Réponds en français. Uniquement ce que le site dit, rien d'inventé.",
    messages: [{ role: "user", content: JSON.stringify({ titre: site.title, nom: site.siteName, description: site.description, texte: site.text.slice(0, 5000) }) }],
  });
  await logClaudeCost(studioId, response.usage, "lab_site", CHAT_MODEL);
  return response.parsed_output;
}

/** The lab studio of a real business: created from its site once, then its look read (photos, capture). */
async function siteStudio(url: string, kind: { business: string }): Promise<string> {
  const db = supabaseAdmin();
  const key = siteKey(url);
  const found = await db.from("studios").select("id").eq("website_url", key).maybeSingle();
  if (found.data) return found.data.id as string;
  const site = await readWebsite(url);
  const host = new URL(site.url).hostname.replace(/^www\./, "");
  const at = new Date().toISOString();
  const studio = await db
    .from("studios")
    .insert({ name: site.siteName ?? site.title?.split(/[|–—-]/)[0]?.trim() ?? host, business_type: kind.business, website_url: key, onboarding_step: "style", booking_url: site.bookingLinks[0] ?? null })
    .select("id")
    .single();
  if (studio.error) throw new Error(studio.error.message);
  const studioId = studio.data.id as string;
  const read = await siteFacts(studioId, site).catch((error: unknown) => {
    console.warn("lab: site facts failed", error);
    return null;
  });
  await db
    .from("studios")
    .update({
      ...(read?.name ? { name: read.name.slice(0, 80) } : {}),
      // Its activity as its site says it (« coffee shop et salon de coiffure »), like Simone saves it at onboarding.
      ...(read?.business ? { business_type: read.business.slice(0, 80) } : {}),
      memory: [...(read?.facts ?? []).slice(0, 5), `Site : ${site.url}`].map((fact) => ({ fact, at })),
    })
    .eq("id", studioId);
  // As Simone saves it after reading the site: the colours and fonts of its code, its logo (its tone comes from the reading of its look).
  const profile = {
    colors: site.style.colors.slice(0, 6),
    fonts: site.style.fonts.slice(0, 2),
    ...(site.logo ? { logo_url: site.logo } : {}),
    dos: [],
    donts: [],
  };
  const brand = await db.from("brand_profiles").insert({ studio_id: studioId, version: 1, profile });
  if (brand.error) throw new Error(brand.error.message);
  // Its look: the photos into its moodboard and library, then the reading of a capture.
  const look = await readSiteLook(studioId, site.url, site.logo ? site.images.filter((i) => i.split("?")[0] !== site.logo!.split("?")[0]) : site.images);
  console.log("lab: site look", host, look);
  return studioId;
}

async function labStudio(name: string, c: LabCase): Promise<string> {
  const db = supabaseAdmin();
  const found = await db.from("studios").select("id").eq("website_url", labUrl(name)).maybeSingle();
  if (found.data) return found.data.id as string;
  const at = new Date().toISOString();
  const studio = await db
    .from("studios")
    .insert({ name: c.name, business_type: c.business, website_url: labUrl(name), onboarding_step: "first_post", memory: c.facts.map((fact) => ({ fact, at })) })
    .select("id")
    .single();
  if (studio.error) throw new Error(studio.error.message);
  const profile = { tone: c.brand.tone, colors: c.brand.colors, fonts: c.brand.fonts, dos: [], donts: [] };
  const brand = await db.from("brand_profiles").insert({ studio_id: studio.data.id, version: 1, profile });
  if (brand.error) throw new Error(brand.error.message);
  return studio.data.id as string;
}

/** The case's media in the lab studio (copied once), videos then photos. */
async function labMedia(studioId: string, c: LabCase): Promise<{ videos: string[]; photos: string[] }> {
  const db = supabaseAdmin();
  const have = new Map(((await db.from("media_assets").select("id, storage_path").eq("studio_id", studioId)).data ?? []).map((m) => [m.storage_path as string, m.id as string]));
  const add = async (path: string, row: Record<string, unknown>, bytes: () => Promise<{ error: { message: string } | null }>) => {
    const known = have.get(path);
    if (known) return known;
    const { error } = await bytes();
    if (error) throw new Error(`${path}: ${error.message}`);
    const inserted = await db.from("media_assets").insert({ studio_id: studioId, storage_path: path, source: "library", consent_ok: true, ...row }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    return inserted.data.id as string;
  };

  // Her own videos, uploaded with step=upload.
  const own = await Promise.all(
    (c.own ?? []).map((file) =>
      add(`${studioId}/lab/${file}`, { kind: "video", mime_type: videoMime(file) }, async () => {
        const found = await db.storage.from("media").createSignedUrl(`${studioId}/lab/${file}`, 60);
        return { error: found.error ? { message: `not uploaded (step=upload&file=${file})` } : null };
      }),
    ),
  );
  const stock = await Promise.all(
    (c.clips ?? []).map((clip) =>
      add(`${studioId}/lab/${clip}.mp4`, { kind: "video", mime_type: "video/mp4" }, async () => {
        const res = await fetch(`https://assets.mixkit.co/videos/${clip}/${clip}-720.mp4`, { headers: { "user-agent": "Mozilla/5.0 (compatible; SimoneLab/1.0)" } });
        if (!res.ok) return { error: { message: `stock clip ${clip}: ${res.status}` } };
        const body = Buffer.from(await res.arrayBuffer());
        return db.storage.from("media").upload(`${studioId}/lab/${clip}.mp4`, body, { contentType: "video/mp4", upsert: true });
      }),
    ),
  );
  const videos = [...own, ...stock];

  let photos: string[] = [];
  if (c.photosOf) {
    const demo = await db.from("studios").select("id").eq("name", c.photosOf.studio).is("website_url", null).limit(1).single();
    if (demo.error) throw new Error(`demo studio ${c.photosOf.studio}: ${demo.error.message}`);
    const source = await db
      .from("media_assets")
      .select("storage_path, width, height, mime_type")
      .eq("studio_id", demo.data.id)
      .eq("kind", "image")
      .gt("height", 1600)
      .order("created_at")
      .limit(c.photosOf.max);
    photos = await Promise.all(
      (source.data ?? []).map((p) => {
        const file = (p.storage_path as string).split("/").pop()!;
        return add(`${studioId}/lab/${file}`, { kind: "image", mime_type: p.mime_type ?? "image/jpeg", width: p.width, height: p.height }, () =>
          db.storage.from("media").copy(p.storage_path as string, `${studioId}/lab/${file}`),
        );
      }),
    );
  }
  return { videos, photos };
}

/** The voice over a lab Reel: Simone's (voice=), or a voice note of hers (own_voice=). */
type LabVoice = { simone: string | null; hers: string | null };

async function start(name: string, c: LabCase, reset: boolean, voice: LabVoice, idea: string | null, steal: { url: string | null; only: boolean }) {
  const studioId = await labStudio(name, c);
  if (reset) await clearPosts(studioId);
  const copy = steal.url ? await labSteal(studioId, steal.url) : null;
  if (steal.only) return;
  const { videos, photos } = await labMedia(studioId, c);
  await montage(name, studioId, { ...c, idea: idea ?? c.idea }, videos, photos, voice, copy);
}

/** A new first Reel: the studio's posts and scenes go (its media and brand stay). */
async function clearPosts(studioId: string) {
  const db = supabaseAdmin();
  await db.from("posts").delete().eq("studio_id", studioId);
  await db.from("motion_templates").delete().eq("studio_id", studioId);
}

/** « Steal » in the lab: a Reel's style read (from its link, a video file's URL, or a video uploaded to the lab studio), for the lab Reel to copy. */
async function labSteal(studioId: string, url: string): Promise<string> {
  let outcome: Awaited<ReturnType<typeof stealStyle>>;
  if (url.startsWith("lab:")) {
    // As a video she sends Simone in the chat: in her library first, then read (and out of it once read).
    const file = url.slice(4);
    const path = `${studioId}/lab/${file}`;
    const db = supabaseAdmin();
    const { data: known } = await db.from("media_assets").select("id").eq("studio_id", studioId).eq("storage_path", path).maybeSingle();
    const media =
      known ??
      (await db.from("media_assets").insert({ studio_id: studioId, storage_path: path, kind: "video", source: "web_upload", mime_type: videoMime(file) }).select("id").single()).data;
    if (!media) throw new Error(`lab: ${file} not kept`);
    outcome = await stealNow(studioId, { mediaId: media.id as string });
  } else if (reelLink(url)) outcome = await stealNow(studioId, { link: url });
  else {
    const { data: row, error } = await supabaseAdmin().from("inspirations").insert({ studio_id: studioId, source: "link", kind: "reel", url }).select("id").single();
    if (error || !row) throw new Error(`lab: inspiration not kept: ${error?.message ?? "no row"}`);
    outcome = await stealStyle(studioId, row.id as string);
  }
  if (!outcome.ok) throw new Error(`lab: style not read (${outcome.miss}): ${await missMessage(outcome.miss)}`);
  console.log("lab: style read", outcome.style.look.name, JSON.stringify({ lines: outcome.lines, measures: { ...outcome.style.measures, cuts: outcome.style.measures.cuts.length } }));
  return outcome.inspirationId;
}

/** The styles read for the lab studio (« Steal »), the latest first. */
async function stolenStyles(studioId: string) {
  const { data } = await supabaseAdmin()
    .from("inspirations")
    .select("id, url, title, style, created_at")
    .eq("studio_id", studioId)
    .not("style", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);
  return { read: (data ?? []).map((i) => ({ id: i.id, url: i.url, title: i.title, at: i.created_at, style: i.style })) };
}

/** A real business from its site: its site's photos (and the stock clips of its trade, if asked), then its first Reel. */
/** Without a kind: what any business would ask for its first Reel from its site. */
const ANY_KIND: (typeof KINDS)[string] = { business: "commerce", title: "Premier Reel", idea: "Un Reel avec les photos de mon site, qui donne envie de venir." };

async function startSite(url: string, kindName: string, withClips: boolean, reset: boolean, voice: LabVoice, idea: string | null, template?: MotionTemplate) {
  const kind = KINDS[kindName] ?? ANY_KIND;
  const studioId = await siteStudio(url, kind);
  if (reset) await clearPosts(studioId);
  const db = supabaseAdmin();
  const { data: site } = await db.from("media_assets").select("id").eq("studio_id", studioId).eq("source", "website").eq("kind", "image").order("created_at").limit(8);
  const stock = withClips && kind.clipsOf ? CASES[kind.clipsOf] : undefined;
  const { videos } = stock ? await labMedia(studioId, { ...stock, photosOf: undefined }) : { videos: [] as string[] };
  const photos = (site ?? []).map((m) => m.id as string);
  if (!photos.length && !videos.length) throw new Error("lab: no photo on the site, try clips=1");
  await montage(siteKey(url), studioId, { title: kind.title, idea: idea ?? kind.idea, template }, videos, photos, voice);
}

async function montage(name: string, studioId: string, c: Pick<LabCase, "title" | "idea" | "template">, videos: string[], photos: string[], voice: LabVoice, copy: string | null = null) {
  const db = supabaseAdmin();
  // Everything read first, as when she sends them: Gemini watches each video, each photo is framed.
  const [analyses] = await Promise.all([
    Promise.all(videos.map((id) => ensureClipAnalysis(studioId, id, { waitMs: 240_000 }))),
    Promise.all(photos.map((id) => photoRegions(studioId, id).catch((error: unknown) => console.warn("lab: photo not read", id, error)))),
  ]);
  const unread = analyses.filter((a) => !("analysis" in a));
  if (unread.length) console.warn("lab: videos not read", JSON.stringify(unread));
  // A montage takes 20 files at most, as in the app: the videos first, then the photos.
  const mediaIds = [...videos, ...photos].slice(0, MAX_MEDIA);
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setUTCHours(17, 0, 0, 0);
  // As the Créer screen makes it: titled from what she imagines, with her « Voix off » choice.
  const brief = imaginedBrief(c.idea);
  const spoken = voice.simone && !voice.hers ? { mode: "on" as const, ...(voice.simone === "1" ? {} : { voice_id: voice.simone }) } : null;
  const post = await db
    .from("posts")
    .insert({
      studio_id: studioId,
      kind: "reel",
      title: intentionTitle(c.idea) || c.title,
      status: "media_received",
      platforms: ["instagram"],
      scheduled_at: tomorrow.toISOString(),
      template: c.template ?? null,
      media_ids: mediaIds,
      // The Reel it copies (« Steal »), as when she sends Simone a Reel to copy.
      inspiration_id: copy,
      ...(spoken ? { voice_over: spoken } : {}),
    })
    .select("id")
    .single();
  if (post.error) throw new Error(post.error.message);
  if (voice.hers) {
    const note = await labVoiceNote(studioId, post.data.id, voice.hers === "1" ? undefined : voice.hers, brief);
    console.log("lab: her voice note", name, note.seconds, note.text);
  }
  // The same chain as her first Reel at the default care, without a quote: two scenes of her own.
  await queueJob("montage", { step: "design", studioId, postId: post.data.id, mediaIds, brief, maxNewScenes: 2, effort: "soigne" });
  console.log("lab: montage started", name, post.data.id);
}

/**
 * A voice note of hers as WhatsApp brings one: her words (or words written for the images)
 * read by a voice of the gallery, then made what a phone records (OGG Opus, 16 kHz mono,
 * quieter than a voice in a Reel, band-limited), kept as a WhatsApp audio, read by Scribe
 * as hers would be, and put on the Reel. The montage then cuts on it as on hers.
 */
async function labVoiceNote(studioId: string, postId: string, words?: string, brief?: string): Promise<{ mediaId: string; text: string; seconds: number }> {
  const db = supabaseAdmin();
  const text = words?.trim() || (await writeVoiceScript(studioId, postId, { brief })).script;
  const spoken = await speak(text);
  const ogg = await voiceNoteInSandbox(`lab-note-${postId}`, spoken.mp3);
  const path = `${studioId}/whatsapp/lab-${postId}-${Date.now()}.ogg`;
  const upload = await db.storage.from("media").upload(path, ogg, { contentType: "audio/ogg; codecs=opus", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const asset = await db
    .from("media_assets")
    .insert({ studio_id: studioId, storage_path: path, kind: "audio", source: "whatsapp", mime_type: "audio/ogg; codecs=opus", size_bytes: ogg.length, consent_ok: true })
    .select("id")
    .single();
  if (asset.error) throw new Error(asset.error.message);
  const transcript = await ensureTranscript(studioId, asset.data.id as string);
  if (!transcript) throw new Error("lab: her voice note was not read");
  await db.from("posts").update({ voice_media_id: asset.data.id }).eq("id", postId);
  return { mediaId: asset.data.id as string, text: transcript.text, seconds: transcript.duration };
}

const voiceOf = (params: URLSearchParams): LabVoice => ({ simone: params.get("voice"), hers: params.get("own_voice") });

/** A file of hers uploaded to the lab studio: a plain name, a video. */
const LAB_FILE = /^[\w-][\w.-]{0,79}\.(mp4|mov|m4v|webm)$/i;
const videoMime = (file: string) => (/\.mov$/i.test(file) ? "video/quicktime" : /\.webm$/i.test(file) ? "video/webm" : "video/mp4");

/** What she writes in « Ce que tu imagines » (500 characters at most, as on the screen). */
const ideaOf = (params: URLSearchParams) => params.get("idea")?.trim().slice(0, 500) || null;

async function result(key: string) {
  const db = supabaseAdmin();
  const studio = await db.from("studios").select("id, name, business_type, memory").eq("website_url", key).maybeSingle();
  if (!studio.data) return { error: "case not set up" };
  const studioId = studio.data.id as string;
  const post = await db.from("posts").select("id, title, status, agent_note, edit_plan_id, render_id, voice_media_id, inspiration_id, created_at").eq("studio_id", studioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!post.data) {
    return { studioId, error: "no post", steal: await stolenStyles(studioId) };
  }
  const [plans, message, costs, voice, brand] = await Promise.all([
    db.from("edit_plans").select("id, version, plan, created_at").eq("post_id", post.data.id).order("version"),
    db.from("whatsapp_messages").select("body, created_at").eq("studio_id", studioId).eq("direction", "outbound").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("cost_events").select("kind, cost_eur, created_at").eq("studio_id", studioId),
    post.data.voice_media_id ? db.from("media_assets").select("transcript").eq("id", post.data.voice_media_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("brand_profiles").select("version, profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Its charter as the Reel used it: colours, fonts (and the ones swapped for a free twin), art direction.
  const profile = (brand.data?.profile ?? {}) as {
    colors?: string[];
    fonts?: string[];
    font_twins?: Record<string, string>;
    art_direction?: string;
    logo_url?: string;
    tone?: string;
    signature?: unknown;
    moodboard?: { reading?: string };
  };
  const fonts = await usableFonts(profile.fonts, [], "doux", profile.font_twins).catch(() => ({ fonts: profile.fonts, swaps: [] }));
  const planIds = (plans.data ?? []).map((p) => p.id as string);
  const renders = planIds.length
    ? ((await db.from("renders").select("id, edit_plan_id, status, storage_path, duration_ms, error, created_at").in("edit_plan_id", planIds).order("created_at")).data ?? [])
    : [];
  const paths = renders.flatMap((r) => (r.storage_path ? [r.storage_path as string] : []));
  const signed = paths.length ? ((await db.storage.from("media").createSignedUrls(paths, 86_400)).data ?? []) : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const kept = (plans.data ?? []).find((p) => p.id === post.data!.edit_plan_id);
  const plan = editPlanSchema.safeParse(kept?.plan);
  // What this Reel cost (from its post's creation: montage, animations, review, renders, music), and what
  // the lab studio has spent over all its runs (with the one-time reading of its media).
  const byKind = (since?: string) => {
    const sums: Record<string, number> = {};
    for (const c of costs.data ?? []) {
      if (since && new Date(c.created_at as string) < new Date(since)) continue;
      sums[c.kind as string] = Math.round(((sums[c.kind as string] ?? 0) + Number(c.cost_eur)) * 1000) / 1000;
    }
    return sums;
  };
  return {
    studioId,
    studio: { name: studio.data.name, business: studio.data.business_type, facts: studio.data.memory },
    brand: {
      version: brand.data?.version ?? null,
      colors: profile.colors ?? [],
      fonts: profile.fonts ?? [],
      fonts_used: fonts.fonts ?? [],
      font_swaps: fonts.swaps,
      logo: profile.logo_url ?? null,
      font_twins: profile.font_twins ?? {},
      art_direction: profile.art_direction ?? null,
      tone: profile.tone ?? null,
      signature: profile.signature ?? null,
      reading: profile.moodboard?.reading?.slice(0, 1200) ?? null,
    },
    post: post.data,
    plans: (plans.data ?? []).map((p) => ({ id: p.id, version: p.version, at: p.created_at })),
    renders: renders.map((r) => ({ plan: r.edit_plan_id, status: r.status, seconds: r.duration_ms ? Math.round((r.duration_ms as number) / 100) / 10 : null, error: r.error, url: r.storage_path ? url.get(r.storage_path as string) : null })),
    message: message.data?.body ?? null,
    voice: (voice.data?.transcript as { text?: string; duration?: number } | null) ?? null,
    costs: byKind(post.data.created_at as string),
    studio_costs: byKind(),
    steal: await stolenStyles(studioId),
    // The plan kept, readable: the scenes' code left out.
    plan: plan.success
      ? {
          ...plan.data,
          segments: plan.data.segments.map((s) =>
            isMotionSegment(s)
              ? { motion: { brief: s.motion.brief, template_id: s.motion.template_id, coded: Boolean(s.motion.js), photos: s.motion.photos }, duration: s.duration, over: s.over }
              : s,
          ),
          layers: plan.data.layers?.map((l) => ({ brief: l.motion.brief, from: l.from, to: l.to, coded: Boolean(l.motion.js), photos: l.motion.photos })),
        }
      : null,
  };
}

/** The version kept of the case's latest post, rendered again with a newly composed piece. */
async function newMusic(key: string) {
  const db = supabaseAdmin();
  const studio = await db.from("studios").select("id").eq("website_url", key).maybeSingle();
  if (!studio.data) throw new Error("case not set up");
  const post = await db.from("posts").select("id").eq("studio_id", studio.data.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!post.data) throw new Error("no post");
  const rendered = await renderPost(studio.data.id as string, post.data.id as string, { freshMusic: true });
  console.log("lab: new music", key, rendered.renderId);
}

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return new Response("unauthorized", { status: 401 });
  const params = new URL(request.url).searchParams;
  // A real business, from its website.
  const site = params.get("site");
  if (site) {
    const kind = params.get("kind") ?? "";
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
    } catch {
      return Response.json({ error: "site" }, { status: 400 });
    }
    if (params.get("step") === "result") return Response.json(await result(siteKey(url.href)));
    if (params.get("step") === "music") {
      after(() => newMusic(siteKey(url.href)).catch((error: unknown) => console.error("lab: new music failed", url.href, error)));
      return Response.json({ ok: true, site: url.href, music: true });
    }
    if (kind && !KINDS[kind]) return Response.json({ error: `kind=${Object.keys(KINDS).join("|")}` }, { status: 400 });
    // An ambiance chosen for the post (as she would pick « Façon collage »), else the editor's choice.
    const template = params.get("template") ? motionTemplateSchema.safeParse(params.get("template")) : null;
    if (template && !template.success) return Response.json({ error: "template" }, { status: 400 });
    after(() =>
      startSite(url.href, kind, params.get("clips") === "1", params.get("reset") === "1", voiceOf(params), ideaOf(params), template?.data).catch((error: unknown) =>
        console.error("lab: site failed", url.href, error),
      ),
    );
    return Response.json({ ok: true, site: url.href, kind, started: true });
  }
  const name = params.get("case") ?? "";
  const c = CASES[name];
  if (!c) return Response.json({ error: `case=${Object.keys(CASES).join("|")}` }, { status: 400 });
  if (c.template && !motionTemplateSchema.safeParse(c.template).success) return Response.json({ error: "template" }, { status: 400 });
  if (params.get("step") === "result") return Response.json(await result(labUrl(name)));
  if (params.get("step") === "music") {
    after(() => newMusic(labUrl(name)).catch((error: unknown) => console.error("lab: new music failed", name, error)));
    return Response.json({ ok: true, case: name, music: true });
  }
  // A file of hers (a video she filmed, a Reel to copy) uploaded straight to the lab studio's storage.
  if (params.get("step") === "upload") {
    const file = params.get("file") ?? "";
    if (!LAB_FILE.test(file)) return Response.json({ error: "file=<name>.mp4|mov" }, { status: 400 });
    const studioId = await labStudio(name, c);
    const signed = await supabaseAdmin().storage.from("media").createSignedUploadUrl(`${studioId}/lab/${file}`, { upsert: true });
    if (signed.error) return Response.json({ error: signed.error.message }, { status: 500 });
    return Response.json({ path: signed.data.path, url: signed.data.signedUrl });
  }
  // Other free stock clips for this run, as many as a montage takes; or her own uploaded videos instead.
  const stock = params.get("stock");
  if (stock && !new RegExp(`^\\d{1,7}(,\\d{1,7}){0,${MAX_MEDIA - 1}}$`).test(stock)) return Response.json({ error: "stock=<mixkit id>,…" }, { status: 400 });
  const own = params.get("own")?.split(",");
  if (own && (own.length > MAX_MEDIA || !own.every((f) => LAB_FILE.test(f)))) return Response.json({ error: "own=<file>,…" }, { status: 400 });
  const run = own ? { ...c, clips: [], own } : stock ? { ...c, clips: stock.split(",").map(Number) } : c;
  // « Steal »: a Reel's link, a video file's URL (https), or a video uploaded to the lab studio (lab:<file>).
  const steal = params.get("steal");
  if (steal && !/^https:\/\/\S{8,500}$/.test(steal) && !(steal.startsWith("lab:") && LAB_FILE.test(steal.slice(4)))) {
    return Response.json({ error: "steal=<https url>|lab:<file>" }, { status: 400 });
  }
  const stealing = { url: steal, only: params.get("steal_only") === "1" };
  // call_app gives up after a few seconds: the work goes on after the answer.
  after(() => start(name, run, params.get("reset") === "1", voiceOf(params), ideaOf(params), stealing).catch((error: unknown) => console.error("lab: case failed", name, error)));
  return Response.json({ ok: true, case: name, started: true, ...(steal ? { steal } : {}) });
}
