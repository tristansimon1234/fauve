import "server-only";
import {
  BEAT_STEP,
  beatGrid,
  coarser,
  GROOVE_STEP,
  grooveGaps,
  isClipSegment,
  isMotionSegment,
  musicCostUsd,
  musicTail,
  planBeat,
  planBpm,
  sfxLevelSchema,
  usdToEur,
  type EditPlan,
  type PostKind,
  type SfxLevel,
  type SoundInMix,
} from "@fauve/agent";
import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { alignMusicInSandbox, bassLevelsInSandbox, loopedReelInSandbox, muxAudioInSandbox } from "./sandbox";
import { postStyle } from "@/lib/steal";
import { costMeta } from "@/lib/cost-scope";
import { withSlot } from "@/lib/work-slots";

// Edith's music on a Reel (ElevenLabs Music): composed from its brief alone, in
// the mood of the Reel and the business, as the looping track of a creator's Reel
// at the Reel's tempo, longer than the Reel so the ending it writes falls after
// the cut. Composed watching the video, it stopped its beat before a cut to make it
// hit, heard as the sound cutting out; that composer only steps in when the brief
// alone fails. Its beats are then set on the cuts (beatGrid, alignMusicInSandbox),
// and a piece whose beat still falls away inside the Reel is composed once more
// (grooveGaps). The piece is
// kept on the post and reused while the cut stays the same (a text changed, a
// style…), so a small retouch does not pay for a new one; « Une autre » asks for
// a new one. Without ELEVENLABS_API_KEY, or turned off, the Reel stays silent.

export const postMusicSchema = z.object({
  /**
   * On by default; off = a silent Reel (she adds a sound in Instagram, or none); model = silent too, for the sound of the
   * Instagram Reel it copies, added by her with « Utiliser l'audio » (lib/model-sound.ts).
   */
  mode: z.enum(["on", "off", "model"]).default("on"),
  /** Her own publishing was set for the model's sound (given back with Edith's music). */
  hand: z.boolean().optional(),
  /**
   * The sound she follows, given by a link (a Reel or a TikTok that uses it; mode model): the Reel comes out silent, cut
   * on its beats, and she adds it with « Utiliser l'audio » on that Reel (lib/sound-follow.ts). Its tempo and its first
   * beat (s) are measured on the link before the montage; null when it has no steady beat; miss when it could not be read.
   */
  sound: z
    .object({
      link: z.string().url().max(600),
      bpm: z.number().min(30).max(300).nullable().optional(),
      offset: z.number().min(0).max(4).nullable().optional(),
      miss: z.string().max(40).optional(),
    })
    .optional(),
  /** What she asked for the music of this Reel (her contract's, in English): the composer's brief, over every default. */
  wish: z.string().max(300).optional(),
  /** How present this Reel's sound effects are (light, more, off); absent: her default, else light (sfx.ts). */
  sfx: sfxLevelSchema.optional(),
  /** The piece made for this post, and the cut it was made for. */
  track: z
    .object({
      path: z.string(),
      signature: z.string(),
      song_id: z.string().nullable().optional(),
      created_at: z.string(),
      /** The request it was composed for: another one composes again. */
      wish: z.string().max(300).optional(),
    })
    .nullable()
    .optional(),
});
export type PostMusic = z.infer<typeof postMusicSchema>;

export const readPostMusic = (value: unknown): PostMusic => postMusicSchema.catch({ mode: "on" }).parse(value ?? {});

/**
 * How present a Reel's sound effects are: this Reel's choice, else her default (for all her Reels),
 * else light. None on a Reel that keeps the sound of the Reel it copies: Instagram puts that sound
 * in place of the video's own (« Utiliser l'audio »), effects included.
 */
export async function soundLevel(studioId: string, postId: string): Promise<SfxLevel> {
  const db = supabaseAdmin();
  const [{ data: post }, { data: profile }] = await Promise.all([
    db.from("posts").select("music").eq("id", postId).eq("studio_id", studioId).maybeSingle(),
    db.from("brand_profiles").select("profile").eq("studio_id", studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const music = readPostMusic(post?.music);
  if (music.mode === "model") return "off";
  if (music.sfx) return music.sfx;
  const own = sfxLevelSchema.safeParse((profile?.profile as { sfx?: unknown } | null)?.sfx);
  return own.success ? own.data : "light";
}

/** The cut of a montage: what the music follows (the clips, scenes and their lengths), not the texts. */
export function cutSignature(plan: Pick<EditPlan, "segments" | "template" | "transitions"> & { voice?: EditPlan["voice"]; tempo?: number; baked?: EditPlan["baked"] }): string {
  // An effect's video is known by the session that drew it: drawn again with her words by its kit, it is a new
  // video with the same cut, and keeps its music (by its video's id, changing a word composed a new piece).
  const cut = plan.segments.map((s) =>
    isClipSegment(s) ? ["c", plan.baked?.session ?? s.clip_id, s.in, s.out] : isMotionSegment(s) ? ["m", s.duration] : ["s", s.duration],
  );
  // A Reel's own tempo counts (the music is composed at it); a plan without one keeps the signature it had.
  return createHash("sha1")
    .update(JSON.stringify([plan.template, ...(plan.tempo ? [plan.tempo] : []), plan.transitions, cut, ...(plan.voice ? [plan.voice.media_id] : [])]))
    .digest("hex")
    .slice(0, 16);
}

// A genre with a character, like the track a creator picks for a Reel: adjectives
// (« warm, elegant ») gave corporate stock music that sounded like an ad.
const MOODS: Record<string, { words: string; tags: string[] }> = {
  doux: { words: "a warm chillhop groove (lo-fi hip hop): mellow Rhodes chords, soft vinyl texture, a round bass, a laid-back beat, one simple melodic hook", tags: ["chillhop", "lo-fi hip hop", "groovy"] },
  dynamique: { words: "a funky nu-disco groove: punchy four-on-the-floor kick, slap bass, bright clean guitar licks, a catchy hook from the first bar", tags: ["nu-disco", "funk", "groovy"] },
  chic: { words: "a jazzy downtempo groove: upright bass, brushed drums, smoky Rhodes chords, a touch of trip-hop, sleek and confident", tags: ["downtempo", "jazzy", "trip-hop"] },
  collage: { words: "a playful indie pop groove: handclaps, ukulele and glockenspiel, a bouncy bass, a whistled hook, quirky and fun", tags: ["indie pop", "playful", "lo-fi"] },
  vivant: { words: "a feel-good indie funk groove: tight drums, a warm electric bass, clean rhythm guitar, a catchy hook from the first bar", tags: ["indie funk", "groovy", "feel-good"] },
};

/**
 * The genre of a Reel without a sound of its business: by its energy (its tempo; a Reel
 * has no ambiance any more), else its ambiance's (a Reel made before).
 */
function moodOf(plan: EditPlan): { words: string; tags: string[] } {
  if (plan.template !== "libre") return MOODS[plan.template] ?? MOODS.doux!;
  const bpm = planBpm(plan) ?? 100;
  return bpm < 82 ? MOODS.chic! : bpm < 100 ? MOODS.doux! : bpm < 113 ? MOODS.vivant! : MOODS.dynamique!;
}

/** Under a voice: its own sound stays (the groove, the bass, the drums), only the melody steps back. */
const underVoice = (sound: string) =>
  `${sound}, arranged to sit under a spoken voice-over: the drums, the bass and the groove carry the track with the same energy, the lead melody steps back (sparse, no solo, nothing competing with the voice)`;

/**
 * What the composer is asked for: what she asked for this Reel's music, as she asked it (Tristan: « il faut juste
 * qu'on écoute ma demande »: a « piano only » had come out as lounge with drums and bass, under our defaults); else
 * the business, its own sound (else a groove for the Reel's energy), and the art direction adjustments.
 */
function brief(plan: EditPlan, business: string | null, adjustments: string[], sound?: string, wish?: string): { description: string; tags: string[] } {
  if (wish) {
    // Only what makes it hold on the video: one piece from the first second to the end.
    const bpm = planBpm(plan);
    return {
      description: `Music for an Instagram Reel of ${business ? `a ${business}` : "a neighbourhood business"}: ${wish}.${bpm && !plan.voice ? ` Around ${bpm} BPM.` : ""} One piece from the very first second to the end, without a silence.`.slice(0, 2000),
      tags: [wish.slice(0, 40)],
    };
  }
  const ambiance = moodOf(plan);
  // The sound read in its art direction (« deep house légère », « funk de quartier ») wins over the energy's genre.
  const mood = sound ? { words: `${sound}: the sound of this business, played like a track a creator would pick, with one simple hook`, tags: [sound.slice(0, 40)] } : ambiance;
  const where = business ? `a ${business}` : "a neighbourhood business";
  const notes = adjustments.length ? ` Notes from the owner: ${adjustments.join("; ").slice(0, 300)}.` : "";
  // The cuts sit on this tempo's beats (snapToTempo), and the piece is set on them after (beatGrid):
  // it keeps the tempo exactly, its first beat at the start. Over a voice the cuts follow its
  // phrases, the tempo only keeps the energy of the Reel.
  const bpm = planBpm(plan);
  const tempo = !bpm ? "" : plan.voice ? ` Around ${bpm} BPM.` : ` ${bpm} BPM exactly, four beats to the bar, the first beat right at 0:00.`;
  return {
    description:
      // A voice never brings a sound of its own: the business's genre (else the energy's) stays under it.
      `Instrumental track for an Instagram Reel of ${where}, the kind of track a content creator picks, not advertising music: ${plan.voice ? underVoice(sound ? `${sound}: the sound of this business` : ambiance.words) : mood.words}. No vocals.${tempo} ` +
      // A creator's Reel sits on one track that loops: the cuts fall on its beats, it never stops for them.
      // Composed watching the video, the music stopped before a cut to make it hit, or on a calm shot: heard as the sound cutting out.
      `One continuous loop: the full groove (drums and bass) from the very first beat to the very end, with the same energy all along. ` +
      `No intro, no build-up, no break, no breakdown, no drop, no stop, no fill that stops the beat, no silence, no ending, no fade-out. ` +
      `Not corporate, not stock music, no inspirational build-up, no cinematic swells, no jingle, no cliché of the place.${notes}`.slice(0, 2000),
    tags: [...mood.tags, "instrumental", "modern"],
  };
}

/** A piece whose beat still falls away inside the Reel is composed once more; the more continuous one is kept. */
const MUSIC_TAKES = 2;

/** A piece set on the cuts is cut this long (s) before its first attack: the attack stays whole and lands on the cut. */
const ATTACK_LEAD = 0.005;

type Composed = { mp3: Uint8Array; songId: string | null; ms: number; engine: "text" | "video" };

/**
 * ElevenLabs composes 2 pieces at once on its plan: a third one waits for its place here (work_slots)
 * instead of being refused and giving up after a minute (a Reel then went out without music when
 * several were rendered together).
 */
const MUSIC_SLOT = { kind: "elevenlabs_music", slots: 1, perSlot: 2, leaseMs: 4 * 60_000, waitMs: 5 * 60_000 };

/** A call to ElevenLabs Music, once one of its places is free; still refused (another app on the key): it waits and tries again. */
const musicCall = (path: string, init: () => RequestInit, engine: Composed["engine"]) => withSlot(MUSIC_SLOT, () => musicCallNow(path, init, engine));

async function musicCallNow(path: string, init: () => RequestInit, engine: Composed["engine"]): Promise<Composed> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    const request = init();
    const res = await fetch(`https://api.elevenlabs.io${path}`, { ...request, method: "POST", headers: { ...request.headers, "xi-api-key": key } });
    if (res.ok) return { mp3: new Uint8Array(await res.arrayBuffer()), songId: res.headers.get("song-id"), ms: Date.now() - started, engine };
    const body = await res.text().catch(() => "");
    if (res.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 6000 * (attempt + 1)));
      continue;
    }
    throw new Error(`ElevenLabs music ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** The piece composed from its brief alone, `seconds` long: one loop that never reacts to a cut. */
const composeFromText = (ask: { description: string; tags: string[] }, seconds: number) =>
  musicCall(
    "/v1/music?output_format=mp3_44100_128",
    () => ({
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: `${ask.description} Style: ${ask.tags.join(", ")}.`,
        music_length_ms: Math.round(seconds * 1000),
        model_id: env("ELEVENLABS_MUSIC_MODEL"),
        force_instrumental: true,
      }),
    }),
    "text",
  );

/** The piece composed watching the video: kept for when the brief alone fails. */
const composeFromVideo = (mp4: Buffer, ask: { description: string; tags: string[] }) =>
  musicCall(
    "/v1/music/video-to-music?output_format=mp3_44100_128",
    () => {
      const form = new FormData();
      form.append("videos", new Blob([new Uint8Array(mp4)], { type: "video/mp4" }), "reel.mp4");
      form.append("description", ask.description);
      for (const tag of ask.tags) form.append("tags", tag);
      form.append("model_id", env("ELEVENLABS_MUSIC_MODEL"));
      return { body: form };
    },
    "video",
  );

/**
 * The rendered video with Edith's music, when the post wants some: the piece
 * kept for this cut, else a new one composed from the video (`fresh` asks for a
 * new one anyway). Returns the video unchanged when music is off or unavailable.
 */
export async function withMusic(params: {
  studioId: string;
  postId: string;
  kind: PostKind;
  plan: EditPlan;
  mp4: Buffer;
  renderId: string;
  fresh?: boolean;
  /** Its sound effects, placed and levelled (sfx.ts) with their files: mixed with the music, or alone over its own sound. */
  sounds?: (SoundInMix & { mp3: Uint8Array })[];
  /** The sound of her videos kept all along, nobody speaking: mixed as an ambience under the music. */
  ambient?: boolean;
}): Promise<{ mp4: Buffer; music: "kept" | "new" | "none" }> {
  if (!env("ELEVENLABS_API_KEY") || (params.kind !== "reel" && params.kind !== "story")) return { mp4: params.mp4, music: "none" };
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("music").eq("id", params.postId).single();
  const music = readPostMusic(post?.music);
  const sounds = music.mode === "model" ? [] : (params.sounds ?? []);
  if (music.mode !== "on") {
    // No music of hers: the effects alone over its own sound (none on a Reel that takes the copied Reel's sound).
    if (!sounds.length) return { mp4: params.mp4, music: "none" };
    return { mp4: await muxAudioInSandbox(params.renderId, params.mp4, null, { sounds }), music: "none" };
  }

  const signature = cutSignature(params.plan);
  let mp3: Uint8Array | null = null;
  let made: "kept" | "new" = "kept";
  // The same cut and the same request: the piece made for them serves again.
  if (!params.fresh && music.track?.signature === signature && (music.track.wish ?? "") === (music.wish ?? "")) {
    const { data } = await db.storage.from("media").download(music.track.path);
    if (data) mp3 = new Uint8Array(await data.arrayBuffer());
  }
  if (!mp3) {
    const [studio, profile] = await Promise.all([
      db.from("studios").select("business_type").eq("id", params.studioId).single(),
      db.from("brand_profiles").select("profile").eq("studio_id", params.studioId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const stored = profile.data?.profile as { art_direction?: string; signature?: { music?: string } } | null;
    const direction = (stored?.art_direction ?? "").split("\n").filter((l) => l.startsWith("Ajustement"));
    // The music of the Reel this one copies (« Steal »), else her charter's.
    const followed = (await postStyle(params.studioId, params.postId).catch(() => undefined))?.look.music.trim();
    const sound = followed || (typeof stored?.signature?.music === "string" ? stored.signature.music.trim().slice(0, 80) : undefined);
    const ask = brief(params.plan, (studio.data?.business_type as string | null) ?? null, direction, sound || undefined, music.wish);
    const duration = params.plan.duration;
    // A piece is written with its ending (the beat stops over its last seconds): it is composed longer
    // than the Reel, so that ending falls after it and the mix cuts it off.
    const seconds = duration + musicTail(duration);
    // The grid the cuts sit on (snapToTempo); none over a voice, whose phrases place the cuts.
    const beat = params.plan.voice ? null : planBeat(params.plan);
    let best: (Composed & { lost: number; grid: ReturnType<typeof beatGrid> }) | null = null;
    for (let take = 1; take <= MUSIC_TAKES && (!best || best.lost > 0); take++) {
      const composed = await composeFromText(ask, seconds)
        .catch(async (error: unknown) => {
          // The composer that watches the Reel, followed by its first seconds as Instagram loops it.
          console.warn("music: from the brief failed, from the video", params.renderId, error);
          const looped = await loopedReelInSandbox(params.renderId, params.mp4, duration, seconds - duration).catch(() => params.mp4);
          return composeFromVideo(looped, ask);
        })
        .catch((error: unknown) => {
          if (!best) throw error;
          console.warn("music: another take failed, the first one stays", params.renderId, error);
          return null;
        });
      if (!composed) break;
      // Billed by the length of the track: the Reel and the seconds composed after it.
      const usd = musicCostUsd(seconds);
      await db.from("cost_events").insert({
        studio_id: params.studioId,
        kind: "music",
        provider: "elevenlabs",
        units: 1,
        cost_eur: usdToEur(usd, env("USD_TO_EUR")),
        meta: costMeta({ post_id: params.postId, render_id: params.renderId, song_id: composed.songId, model: env("ELEVENLABS_MUSIC_MODEL"), engine: composed.engine, signature, ms: composed.ms, seconds, take, cost_usd: usd }),
      });
      // Its bass every 10 ms: where its beats land, and where its beat falls away inside the Reel
      // (a break, a stop, an ending too early): heard as the sound cutting out.
      const levels = await bassLevelsInSandbox(params.renderId, composed.mp3, seconds, BEAT_STEP).catch((error: unknown) => {
        console.warn("music: beat not measured", params.renderId, error);
        return null;
      });
      const reel = levels?.slice(0, Math.round(duration / BEAT_STEP));
      const gaps = reel ? grooveGaps(coarser(reel, Math.round(GROOVE_STEP / BEAT_STEP)), duration) : [];
      const grid = levels && beat ? beatGrid(levels, beat) : null;
      const lost = gaps.reduce((sum, g) => sum + g.to - g.from, 0);
      console.info("music", params.renderId, { take, engine: composed.engine, seconds, gaps, grid });
      if (!best || lost < best.lost) best = { ...composed, lost, grid };
    }
    mp3 = best!.mp3;
    // Its beats set on the cuts: the piece trimmed to its first beat and held to the grid's tempo (a hair).
    if (best!.grid && beat) {
      const { offset, period } = best!.grid;
      mp3 = await alignMusicInSandbox(params.renderId, mp3, Math.max(0, offset - ATTACK_LEAD), period / beat).catch((error: unknown) => {
        console.warn("music: not set on the beat", params.renderId, error);
        return best!.mp3;
      });
    }
    made = "new";
    const path = `${params.studioId}/music/${params.postId}-${Date.now()}.mp3`;
    const { error } = await db.storage.from("media").upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (error) throw new Error(error.message);
    if (music.track?.path) await db.storage.from("media").remove([music.track.path]).catch(() => {});
    await db
      .from("posts")
      .update({ music: { mode: "on", ...(music.wish ? { wish: music.wish } : {}), track: { path, signature, song_id: best!.songId, created_at: new Date().toISOString(), ...(music.wish ? { wish: music.wish } : {}) } } })
      .eq("id", params.postId);
  }
  return { mp4: await muxAudioInSandbox(params.renderId, params.mp4, mp3, { voiceOver: Boolean(params.plan.voice), sounds, ambient: params.ambient }), music: made };
}

/** Keeps what she asked for this Reel's music (her contract's): the composer's brief from now on, and a new piece. */
export async function setMusicWish(studioId: string, postId: string, wish: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("music").eq("id", postId).eq("studio_id", studioId).maybeSingle();
  const music = readPostMusic(post?.music);
  if (music.wish === wish) return;
  const { error } = await db.from("posts").update({ music: { ...music, wish: wish.slice(0, 300) } }).eq("id", postId).eq("studio_id", studioId);
  if (error) console.warn("music wish not kept", postId, error.message);
}
