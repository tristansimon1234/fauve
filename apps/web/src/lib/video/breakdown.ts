import "server-only";
import { FileState, GoogleGenAI, PartMediaResolutionLevel } from "@google/genai";
import { HOUSE_PASSAGES, houseOriginalPath } from "@fauve/agent";
import { env } from "@/lib/env";
import { logGeminiCost, type GeminiUsage } from "@/lib/gemini-cost";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The breakdown of one of Edith's originals before its model is written (Tristan: « ton analyse préalable des reels
// manque réellement », « il faut écouter la musique aussi », « Gemini doit regarder aussi la vidéo »): Gemini watches the
// video itself, with its sound, fast enough for its every cut (15 images a second) and in high resolution, and writes
// down everything a motion designer needs to remake it: its format, each shot, each text (its words, place, size, font,
// colour, how it enters and leaves, letter by letter), each graphic and effect, each transition and match cut, its
// grade, its music (genre, tempo, its hits and how the cuts fall on them, its sound effects) and its ending. Kept in
// house/breakdowns/<key>.json, read with the local frame-by-frame measures when the model is written.

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));

/** Where a model's breakdown is kept. */
export const houseBreakdownPath = (key: string) => `house/breakdowns/${key}.json`;

const BREAKDOWN_PROMPT = `You are a senior motion designer and video editor. Watch this Instagram Reel frame by frame and listen to its sound: you will remake it exactly, as a template other businesses fill with their own footage and words. Write down everything needed to remake it, with times in seconds (to the hundredth) and positions and sizes in % of the frame (x and y from the top left, w and h), as precisely as you can measure them; never round to a "nice" number, never guess what you cannot see (say "unclear").

Describe:
- format: the video's own shape (16:9, 4:3, 9:16, 1:1), and whether it is a horizontal video shown as is.
- shots: every shot in order (from, to), what it shows, its framing (wide, medium, close, detail), how the camera moves (fixed, slow push, pan, handheld drift, whip), its speed (normal, slow motion, sped up, freeze, reverse), and any effect laid on it (a flicker or flash of its lights, a glow, a zoom punch, a speed ramp…) with the frames it lasts.
- texts: every text on screen, in order: its exact words; from and to; its place and size (the box of its letters, and the cap height in % of the frame's height); its font (family if you recognise it, else: serif, sans, rounded, condensed, script, mono, display), weight, case and letter spacing; its colour (hex) and any outline, shadow, glow or 3D edge (with their colours); how it enters (typed letter by letter, word by word, slides from where, fades, pops; how long each letter or word takes) and how it leaves; whether it is anchored to something in the image (the sky beside a building, a person, a sign) and moves with it.
- graphics: every drawn element (a logo drawn stroke by stroke, lines, frames, bars, shapes, stickers, cut-outs): what, from, to, where, colour, how it moves or draws itself.
- transitions: every change of shot that is not a plain cut (whip, flash, fade, zoom, match cut on a shape or a sign, a text that becomes the next shot's sign…), when and how long.
- grade: contrast, saturation, warmth, tint, grain, vignette, any colour cast, and whether it changes between sections.
- music: genre and instruments, tempo (BPM) and how sure you are, its structure over time (intro, build, drop, break, ending), every hit or accent you hear (at, what), whether the cuts and the texts fall on its beats or its hits (say which ones), its sound effects (whooshes, clicks, typing sounds, risers) and any voice.
- sections: the Reel's sections in order (from, to, name, what happens), and its signature: the one idea that makes it worth remaking.
- remake: what a motion designer must get exactly right for the copy to feel the same (timings, the match cut, the typing rhythm, the font, the placement in the image), and what depends on the footage itself (what must be filmed for it to work).

Answer in JSON only, with these keys: format, shots, texts, graphics, transitions, grade, music, sections, signature, remake. Write the descriptions in French.`;

/** Gemini's breakdown of one original (its passage only when the model is made of part of it), kept and returned. */
export async function breakdownOriginal(key: string): Promise<{ breakdown: unknown; path: string }> {
  const db = supabaseAdmin();
  const { data: team } = await db.from("studios").select("id").eq("team", true).limit(1).maybeSingle();
  if (!team) throw new Error("no team studio to count the cost on");
  const { data: video, error } = await db.storage.from("media").download(houseOriginalPath(key));
  if (error || !video) throw new Error(`original not found: ${error?.message ?? key}`);
  const ai = gemini();
  const uploaded = await ai.files.upload({ file: new Blob([new Uint8Array(await video.arrayBuffer())], { type: "video/mp4" }), config: { mimeType: "video/mp4", displayName: `original-${key}` } });
  try {
    let file = uploaded;
    for (let i = 0; i < 40 && file.state !== FileState.ACTIVE; i++) {
      if (file.state === FileState.FAILED) throw new Error("Gemini could not read the video");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      file = await ai.files.get({ name: file.name! });
    }
    if (file.state !== FileState.ACTIVE || !file.uri) throw new Error("Gemini did not get the video ready");
    const passage = HOUSE_PASSAGES[key];
    const model = env("GEMINI_MODEL");
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: { fileUri: file.uri, mimeType: "video/mp4" },
              // Its every cut and letter seen (15 images a second), in high resolution, its sound heard with it.
              videoMetadata: { fps: 15, ...(passage?.to ? { endOffset: `${passage.to}s` } : {}) },
              mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
            },
            { text: BREAKDOWN_PROMPT },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    await logGeminiCost({ studioId: team.id as string, kind: "video_analysis", model, usage: response.usageMetadata as GeminiUsage, meta: { purpose: "house_breakdown", key } });
    const breakdown = JSON.parse(response.text ?? "null") as unknown;
    const path = houseBreakdownPath(key);
    const kept = await db.storage
      .from("media")
      .upload(path, new Blob([JSON.stringify({ key, model, at: new Date().toISOString(), breakdown }, null, 1)], { type: "application/json" }), { upsert: true, contentType: "application/json" });
    if (kept.error) throw new Error(kept.error.message);
    return { breakdown, path };
  } finally {
    await ai.files.delete({ name: uploaded.name! }).catch(() => undefined);
  }
}
