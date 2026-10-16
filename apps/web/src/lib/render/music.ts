import "server-only";
import { isClipSegment, isMotionSegment, musicCostUsd, TEMPLATE_BPM, usdToEur, type EditPlan, type MotionTemplate, type PostKind } from "@fauve/agent";
import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { muxAudioInSandbox } from "./sandbox";

// Simone's music on a Reel (ElevenLabs Music, « video to music »): the rendered
// video is sent as it is, the model watches it and composes an instrumental piece
// that follows its cuts, in the mood of the Reel and the business. The piece is
// kept on the post and reused while the cut stays the same (a text changed, a
// style…), so a small retouch does not pay for a new one; « Une autre » asks for
// a new one. Without ELEVENLABS_API_KEY, or turned off, the Reel stays silent.

export const postMusicSchema = z.object({
  /** On by default; off = a silent Reel (she adds a sound in Instagram, or none). */
  mode: z.enum(["on", "off"]).default("on"),
  /** The piece made for this post, and the cut it was made for. */
  track: z
    .object({
      path: z.string(),
      signature: z.string(),
      song_id: z.string().nullable().optional(),
      created_at: z.string(),
    })
    .nullable()
    .optional(),
});
export type PostMusic = z.infer<typeof postMusicSchema>;

export const readPostMusic = (value: unknown): PostMusic => postMusicSchema.catch({ mode: "on" }).parse(value ?? {});

/** The cut of a montage: what the music follows (the clips, scenes and their lengths), not the texts. */
export function cutSignature(plan: Pick<EditPlan, "segments" | "template" | "transitions"> & { voice?: EditPlan["voice"] }): string {
  const cut = plan.segments.map((s) =>
    isClipSegment(s) ? ["c", s.clip_id, s.in, s.out] : isMotionSegment(s) ? ["m", s.duration] : ["s", s.duration],
  );
  return createHash("sha1").update(JSON.stringify([plan.template, plan.transitions, cut, ...(plan.voice ? [plan.voice.media_id] : [])])).digest("hex").slice(0, 16);
}

// A genre with a character, like the track a creator picks for a Reel: adjectives
// (« warm, elegant ») gave corporate stock music that sounded like an ad.
const MOODS: Record<string, { words: string; tags: string[] }> = {
  doux: { words: "a warm chillhop groove (lo-fi hip hop): mellow Rhodes chords, soft vinyl texture, a round bass, a laid-back beat, one simple melodic hook", tags: ["chillhop", "lo-fi hip hop", "groovy"] },
  dynamique: { words: "a funky nu-disco groove: punchy four-on-the-floor kick, slap bass, bright clean guitar licks, a catchy hook from the first bar", tags: ["nu-disco", "funk", "groovy"] },
  chic: { words: "a jazzy downtempo groove: upright bass, brushed drums, smoky Rhodes chords, a touch of trip-hop, sleek and confident", tags: ["downtempo", "jazzy", "trip-hop"] },
  collage: { words: "a playful indie pop groove: handclaps, ukulele and glockenspiel, a bouncy bass, a whistled hook, quirky and fun", tags: ["indie pop", "playful", "lo-fi"] },
};

/** Under a voice: its own sound stays (the groove, the bass, the drums), only the melody steps back. */
const underVoice = (sound: string) =>
  `${sound}, arranged to sit under a spoken voice-over: the drums, the bass and the groove carry the track with the same energy, the lead melody steps back (sparse, no solo, nothing competing with the voice)`;

/** What the composer is asked for: the business, its own sound (else the template's groove), and the art direction adjustments. */
function brief(plan: EditPlan, business: string | null, adjustments: string[], sound?: string): { description: string; tags: string[] } {
  const ambiance = MOODS[plan.template] ?? MOODS.doux!;
  // The sound read in its art direction (« deep house légère », « funk de quartier ») wins over the ambiance's genre.
  const mood = sound ? { words: `${sound}: the sound of this business, played like a track a creator would pick, with one simple hook`, tags: [sound.slice(0, 40)] } : ambiance;
  const where = business ? `a ${business}` : "a neighbourhood business";
  const notes = adjustments.length ? ` Notes from the owner: ${adjustments.join("; ").slice(0, 300)}.` : "";
  // The cuts sit on this tempo's beats (snapToTempo): the music keeps it, so they land on the beat.
  // Over a voice the cuts follow its phrases, the tempo only keeps the energy of the ambiance.
  const bpm = TEMPLATE_BPM[plan.template as MotionTemplate];
  const tempo = !bpm ? "" : plan.voice ? ` Around ${bpm} BPM.` : ` Steady tempo of ${bpm} BPM, the video's cuts fall on the beats.`;
  return {
    description:
      // A voice never brings a sound of its own: the business's genre (else the ambiance's) stays under it.
      `Instrumental track for an Instagram Reel of ${where}, the kind of track a content creator picks, not advertising music: ${plan.voice ? underVoice(sound ? `${sound}: the sound of this business` : ambiance.words) : mood.words}. No vocals.${tempo} ` +
      `On the groove from the very first second (no intro, no fade-in), it holds the groove and ends cleanly on the last shot. ` +
      `Not corporate, not stock music, no inspirational build-up, no cinematic swells, no jingle, no cliché of the place.${notes}`.slice(0, 1000),
    tags: [...mood.tags, "instrumental", "modern"],
  };
}

async function compose(mp4: Buffer, ask: { description: string; tags: string[] }): Promise<{ mp3: Uint8Array; songId: string | null; ms: number }> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  const started = Date.now();
  // The plan allows 2 compositions at once: a third one waits and tries again.
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    form.append("videos", new Blob([new Uint8Array(mp4)], { type: "video/mp4" }), "reel.mp4");
    form.append("description", ask.description);
    for (const tag of ask.tags) form.append("tags", tag);
    form.append("model_id", env("ELEVENLABS_MUSIC_MODEL"));
    const res = await fetch("https://api.elevenlabs.io/v1/music/video-to-music?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
    if (res.ok) return { mp3: new Uint8Array(await res.arrayBuffer()), songId: res.headers.get("song-id"), ms: Date.now() - started };
    const body = await res.text().catch(() => "");
    if (res.status === 429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 6000 * (attempt + 1)));
      continue;
    }
    throw new Error(`ElevenLabs music ${res.status}: ${body.slice(0, 300)}`);
  }
}

/**
 * The rendered video with Simone's music, when the post wants some: the piece
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
}): Promise<{ mp4: Buffer; music: "kept" | "new" | "none" }> {
  if (!env("ELEVENLABS_API_KEY") || (params.kind !== "reel" && params.kind !== "story")) return { mp4: params.mp4, music: "none" };
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("music").eq("id", params.postId).single();
  const music = readPostMusic(post?.music);
  if (music.mode === "off") return { mp4: params.mp4, music: "none" };

  const signature = cutSignature(params.plan);
  let mp3: Uint8Array | null = null;
  let made: "kept" | "new" = "kept";
  if (!params.fresh && music.track?.signature === signature) {
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
    const sound = typeof stored?.signature?.music === "string" ? stored.signature.music.trim().slice(0, 80) : undefined;
    const composed = await compose(params.mp4, brief(params.plan, (studio.data?.business_type as string | null) ?? null, direction, sound || undefined));
    mp3 = composed.mp3;
    made = "new";
    const path = `${params.studioId}/music/${params.postId}-${Date.now()}.mp3`;
    const { error } = await db.storage.from("media").upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (error) throw new Error(error.message);
    if (music.track?.path) await db.storage.from("media").remove([music.track.path]).catch(() => {});
    await db
      .from("posts")
      .update({ music: { mode: "on", track: { path, signature, song_id: composed.songId, created_at: new Date().toISOString() } } })
      .eq("id", params.postId);
    // Billed by the length of the track, which is the Reel's.
    const usd = musicCostUsd(params.plan.duration);
    await db.from("cost_events").insert({
      studio_id: params.studioId,
      kind: "music",
      provider: "elevenlabs",
      units: 1,
      cost_eur: usdToEur(usd, env("USD_TO_EUR")),
      meta: { post_id: params.postId, render_id: params.renderId, song_id: composed.songId, model: env("ELEVENLABS_MUSIC_MODEL"), signature, ms: composed.ms, seconds: params.plan.duration, cost_usd: usd },
    });
  }
  return { mp4: await muxAudioInSandbox(params.renderId, params.mp4, mp3, { voiceOver: Boolean(params.plan.voice) }), music: made };
}
