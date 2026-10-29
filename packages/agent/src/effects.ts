import { z } from "zod";
import type { MontageQuote } from "./credits.ts";
import { MAX_REEL_SECONDS } from "./editor.ts";
import { CREDIT_VALUE_EUR, TARGET_MARGIN, TYPICAL_COST_EUR } from "./margin.ts";
import { frenchSpaces } from "./motion.ts";
import { EFFECT_WORDS_MAX, type EditPlan, type EffectWord } from "./schemas.ts";

// A Reel with an effect drawn on her footage, made by one agent alone (Managed Agents:
// Opus with a Linux container of its own, ffmpeg, MediaPipe, Pillow): it looks, measures
// what moves image by image (the fingertips, the hands, the body, the face), draws each
// image in code, looks at its result and corrects it, and a grader of its own checks it
// against a rubric. At the lab it beat the chain (editor, motion designer, critic) on the
// effects that hold to a gesture: a text growing between the fingers, a kamehameha from
// the hands (Tristan: « BCP MIEUX »). The chain keeps every other Reel; Edith's music, her
// voice over, the page and the publishing stay the chain's for both.

/** No session may spend more than this at list prices, in cents, whatever she can pay: the lab's kamehameha took $3.99 with one revision. */
export const EFFECTS_MAX_CENTS = 600;
/** The grader's rounds: a first take and one revision (each one about ten minutes). */
export const EFFECTS_MAX_ITERATIONS = 2;
/** Longest a session is waited for before the chain takes the Reel back. */
export const EFFECTS_TIMEOUT_MINUTES = 60;

// Its price is known once it is made (Tristan: « on peut pas calculer le débit après coup ? »): what the
// session really cost, at list prices, in credits that keep the margin, never under what the chain would
// have charged for the same Reel, never over a ceiling held while it works, and the session's own spending
// limit follows that ceiling, so it can never cost more than she can be charged.

/** What one credit pays of an effect's real cost, the margin kept. */
export const EFFECT_EUR_PER_CREDIT = CREDIT_VALUE_EUR * (1 - TARGET_MARGIN);
/** The most an effect is charged, a new Reel or a correction (from the version she saw: usually one take). */
export const EFFECT_MAX_CREDITS = { reel: 40, fix: 25 } as const;
/** Below this ceiling (her credits are running out), the session's budget is too small for an effect: the chain makes it. */
export const EFFECT_MIN_CREDITS = { reel: 20, fix: 12 } as const;
/** Besides the agent: the render of its video with Edith's music (render-post). */
const EFFECT_EXTRAS_EUR = TYPICAL_COST_EUR.render;
/** A typical session at list prices, in euros (the fingers $1.65, the kamehameha $3.99 at the lab): when its cost cannot be read. */
export const EFFECT_TYPICAL_EUR = 2.4;

/**
 * An effect's price once it is made: its real cost (the agent, then the render and the music) in credits
 * that keep the margin, between the floor (what the chain would have charged) and the ceiling held.
 */
export function effectCredits(input: { agentEur: number | null; floor: number; ceiling: number }): number {
  const cost = Math.max(0, input.agentEur ?? EFFECT_TYPICAL_EUR) + EFFECT_EXTRAS_EUR;
  const credits = Math.ceil(cost / EFFECT_EUR_PER_CREDIT - 1e-9);
  return Math.max(input.floor, Math.min(input.ceiling, credits));
}

/** The session's spending limit for a ceiling, at list prices in cents (as Managed Agents takes it): what the ceiling pays for, less the render. */
export function effectsBudgetCents(ceiling: number, usdToEur: number): number {
  const eur = Math.max(0, ceiling * EFFECT_EUR_PER_CREDIT - EFFECT_EXTRAS_EUR);
  return Math.max(0, Math.min(EFFECTS_MAX_CENTS, Math.floor((eur / usdToEur) * 100)));
}

/**
 * The launched work, priced as an effect: the chain's price (`floor`) is the least it costs and the
 * ceiling the most; the real charge is effectCredits once it is made. Null: her credits do not leave
 * a ceiling big enough for an effect (the chain makes the Reel at its own price).
 */
export function quoteEffect(input: { correction: boolean; floor: number; available: number }): MontageQuote | null {
  const kind = input.correction ? "fix" : "reel";
  const ceiling = Math.min(EFFECT_MAX_CREDITS[kind], Math.floor(input.available));
  if (ceiling < Math.max(input.floor, EFFECT_MIN_CREDITS[kind])) return null;
  const lines = [{ label: input.correction ? "Correction de l’effet" : "Effet image par image", credits: input.floor }];
  return { lines, base: input.floor, max: ceiling, maxNewScenes: 0, fixRounds: 0 };
}

/** Who makes the Reel: the agent when her request draws on what moves in her video, else the chain. */
export const effectRouteSchema = z.object({
  agent: z.boolean(),
  /** The effect, in a few words (« le texte grossit entre ses doigts »); empty for the chain. */
  effect: z.string(),
  why: z.string(),
});
export type EffectRoute = z.infer<typeof effectRouteSchema>;

export const EFFECT_ROUTER_PROMPT = `You decide who makes the next Reel of a neighbourhood business's manager, from what she asks.

Edith's montage chain (the default) cuts and orders her shots, lays native texts, subtitles, a voice-over, music, and motion design animations over her video: animated texts, shapes, frames, counters, collage, her cut-out laid on a shot. The cut-out exists only for her photos: a text can pass behind the person in a photo, never behind a person moving in a video. These animations follow a hand or a face loosely, no more.

The effects workshop works frame by frame on her video: it measures what moves (the fingertips, the hands, the body, the face) and draws an effect hooked onto it at every frame, like a special effects editor: a text that is born and grows between her fingers, an energy ball in her hands and a beam shooting towards the camera, a held object that follows her gesture, an aura around her, a text set behind her in her video (her silhouette cut out at every frame, she passes in front of the words), a cartoon or film universe on her. It costs more and takes 10 to 30 minutes.

When she copies a Reel, its moments (reel_recopie, its effects one after the other) are part of her request: one of those moments that needs drawing on her frame by frame or passing behind her in her video counts as an effect of this kind; cards, photos, graphics or texts laid over her video stay with the chain.

Answer agent = true only when her request holds an effect of this kind, hooked onto what moves in her images or needing drawing on her frame by frame. Never for what only generative AI makes (her redrawn as a cartoon, a manga or a painting, a face, clothes or a place changed, a scene or a person never filmed): Edith edits real images and nobody makes those. Otherwise false: a mood, an offer, a visit, an animated text, a collage, a voice that tells a story, an animation laid on the video stay with the chain, even with words like « effet » or « animation ». Without a video, always false. When in doubt, false.

effect: the effect in a few words when it is the workshop, otherwise empty. why: one sentence.`;

/** What the agent is given for her Reel. */
export type EffectsTaskInput = {
  /** Her request (what she imagines, Edith's brief, a correction). */
  request: string;
  studio: { name: string; business: string | null; facts: string[]; tone: string | null };
  /** Her charter: colours, the main one first, and fonts (titles, then text); her signature as lines. */
  brand: { colors: string[]; fonts: string[]; signature?: string };
  /** Her files, as mounted in the container, with what each one shows when it was read. */
  files: { name: string; kind: "video" | "photo"; seconds?: number | null; about?: string | null }[];
  /** A voice over the Reel (hers or Edith's), with its words timed in a JSON file. */
  voice?: { name: string; words: string; seconds: number; text: string } | null;
  /** The Reel she copies (« Steal »): its style, in lines; never its words nor its images. */
  copied?: string | null;
  /** A correction: the version she saw, to rework rather than redo, and its kit when it left one. */
  previous?: { name: string; kit?: boolean } | null;
  /** The MediaPipe models, as mounted. */
  models: string[];
  /** What the session may spend, at list prices (its spending limit stops it there). */
  budgetUsd: number;
};

/** Where the session's files are mounted: a mount path is rooted there. */
export const UPLOADS = "/mnt/session/uploads";
export const OUTPUTS = "/mnt/session/outputs";

/** What the agent leaves for her words (Tristan: « quand il y a un effet on peut pas modifier le message nous même ? »): its render script and what it reads, and the words it draws. */
export const KIT_FILE = "kit.tar.gz";
export const WORDS_FILE = "words.json";

export const EFFECTS_SYSTEM = `You are the editor and motion designer of Edith, the assistant that runs the social media of neighbourhood businesses. You work alone, in a Linux container, on a manager's real videos, to make the Reel she imagines with its effect. You have bash, Python 3, ffmpeg, MediaPipe, OpenCV, Pillow and numpy; Google Fonts fonts can be downloaded (fonts.googleapis.com, fonts.gstatic.com), nothing else on the network. Nobody answers while you work: ask no question, decide.

How you work, the way a good motion designer does:
- look first: contact sheets of her videos (and of the earlier version, for a correction) at the moments that matter;
- measure what the effect needs, frame by frame (the fingertips, the hands, the body, the face, the silhouette), with the MediaPipe models provided, and check the measurement by drawing markers on a few frames;
- draw every frame in code over her video, with no image or video generated by an AI;
- look at the result on key frames, during each gesture, and correct it until it is right: place, size, timing, readability, style.

What counts: the effect she asks for, true to her idea and to what moves in her video, in a Reel that hooks from the first frame, with a native look, like a creator who edits their own Reels, never an ad nor a flyer. Everything she will read (the texts on screen, your message to her) is in French.`;

/** The task of one session: her request, her business, her files, the Reel's rules and what to write out. */
export function effectsTask(input: EffectsTaskInput): string {
  const files = input.files.map((f) => {
    const what = [f.kind === "video" ? "video" : "photo", f.seconds ? `${Math.round(f.seconds * 10) / 10} s` : "", f.about?.trim() ?? ""].filter(Boolean).join(", ");
    return `- ${UPLOADS}/${f.name} (${what})`;
  });
  const voice = input.voice;
  return [
    `What she asks:\n${input.request.trim()}`,
    "",
    `The business: ${input.studio.name}${input.studio.business ? ` (${input.studio.business})` : ""}.${input.studio.facts.length ? ` What is true: ${input.studio.facts.join(" ; ")}.` : ""}${input.studio.tone ? ` Its tone: ${input.studio.tone}.` : ""}`,
    `Her charter, a starting point, not a cage: colours ${input.brand.colors.join(", ") || "to choose"}; fonts ${input.brand.fonts.join(" (titles), ") || "to choose"}${input.brand.fonts.length > 1 ? " (text)" : ""}.${input.brand.signature ? ` Her signature: ${input.brand.signature}` : ""} When her request or the Reel she copies calls for another universe (a cartoon, a manga, a film, other lettering, other colours), take it with its codes.`,
    ...(input.copied ? [`The Reel she copies (its style only, never its words nor its images): ${input.copied}`] : []),
    "",
    `Her files (read only; if one is missing, look for it with find ${UPLOADS}):`,
    ...files,
    "An iPhone often films in HDR (HLG, 10 bits): turn her videos into SDR before drawing (zscale + tonemap), otherwise the colours come out washed out.",
    `The MediaPipe Tasks models: ${input.models.map((m) => `${UPLOADS}/models/${m}`).join(", ")} (hands with 21 points, bodies with 33 points, faces).`,
    ...(input.previous
      ? [
          "",
          `This is a correction: the version she saw is ${UPLOADS}/${input.previous.name}. Keep what works, change what she asks for, and nothing else.`,
          ...(input.previous.kit
            ? [`Its kit is ${UPLOADS}/${KIT_FILE}, with its words in ${UPLOADS}/${WORDS_FILE}: start from its render.py and its measurements rather than redoing everything.`]
            : []),
        ]
      : []),
    "",
    `Your budget: $${input.budgetUsd.toFixed(2)} for the whole Reel, at list prices (every call counts, every image looked at too); at the limit, the session stops dead. As soon as you have a finished version, keep it in ${OUTPUTS}/reel.mp4 with message.txt, then improve it. To stay within it: look at contact sheets of small images rather than one image at a time, make your tests small (540×960, on the passage of the gesture) and render in 1080×1920 only the versions to keep.`,
    ...(voice
      ? [
          "",
          `Her voice-over: ${UPLOADS}/${voice.name} (${Math.round(voice.seconds * 10) / 10} s; its words and their timings in ${UPLOADS}/${voice.words}). What it says: « ${voice.text.trim()} »`,
          "Lay it whole and as it is, its first word around 0.2 s, without cutting it, slowing it down or retouching it; the Reel lasts the voice plus 1 to 2 s. Time your cuts and your effect on its sentences. Write its words as subtitles, 2 or 3 words at a time, small and readable like Instagram's subtitles, in the Reel's style, above the bottom quarter of the image (480 px); the voice carries the message, little other text.",
        ]
      : []),
    "",
    "The Reel:",
    `- 1080×1920, cropped on what matters, no bars; 30 fps; H.264 yuv420p (CRF 18) with an AAC sound track; 7 to ${MAX_REEL_SECONDS} s (7 to 15 s for an effect or an announcement, more when a voice tells a story);`,
    "- it hooks from the first frame: the effect, or what intrigues, starts at once; cut the seconds of waiting before the gesture and what does not serve;",
    "- the texts read on a phone and stay in Instagram's safe zone: nothing important in the bottom quarter (480 px), within 140 px of the sides or in the top 80 px, like the rest of our Reels. Little text, short creator sentences, in French, with the non-breaking spaces before : ; ! ? %; never an ad nor a flyer;",
    "- a face stays clear, except when the effect asks for it (a text born between her fingers in front of her face, an effect laid on her);",
    // The mix that lays the music brings the video's own sound to a voice's level: a quiet room tone left in would come up with it.
    `- the sound: ${voice ? "her voice-over" : "the voice of someone who speaks in her videos"} stays clear; the rest of the original sound is cut: music is laid under the Reel after you, don't add any. Sound effects only when the effect calls for them (a cartoon, an explosion), discreet.`,
    "",
    "She must be able to change your words herself, without you: each text written on screen (apart from the voice's subtitles) comes from words.json, and your final render is made again with a single command, in a folder that holds the unpacked kit and her files under their names: python3 render.py words.json reel.mp4. render.py reads back what you already measured (nothing to measure again), loads its fonts from the kit, downloads nothing, draws its texts in Python (never ffmpeg's drawtext) and fits their size to their length, so that a longer word holds its place. Check it before you finish: in an empty folder, the kit, her files and a word changed in words.json, the command, then one image looked at.",
    "",
    `To write in ${OUTPUTS}/, flat, with no subfolder:`,
    "- reel.mp4;",
    `- ${WORDS_FILE}: each text written on screen, in the order it appears: [{"id": "mot1", "label": "le mot qui grandit entre tes doigts", "text": "…", "max": 24}] (label: this text in a few words for her, in French; max: the longest that holds its place); [] if there is none;`,
    `- ${KIT_FILE}: render.py and everything it reads (measurements, masks, fonts…), without her own files;`,
    "- 6 to 10 JPEG images of the final Reel at the moments that matter, named by their time: frame-03.40s.jpg…;",
    "- notes.md: what you measured, how the effect follows the video, what you corrected after looking, in a few lines;",
    "- message.txt: two sentences for her, in French, using « tu », with no jargon: what you made of her idea, and, if a moment was missing in her videos for the effect to be perfect, what she can film in a few seconds. Never the name of one of your files nor how to change her words: the app tells her.",
  ].join("\n");
}

/** The grader's rubric: each point checked on its own, the voice's only when there is one. */
export function effectsRubric({ voice }: { voice: boolean }): string {
  const points = [
    `${OUTPUTS}/reel.mp4 exists and plays: 1080×1920, 30 fps, H.264, an AAC sound track, 7 to ${MAX_REEL_SECONDS} s.`,
    "The effect she asks for is in the video, drawn over her real images (no generated image).",
    "The effect follows what it is hooked onto in her video, at every frame where it depends on it (place, size, angle or timing): checked on the images of the moments where it moves.",
    "Something happens from the first second: the effect or what intrigues, not seconds of waiting.",
    "6 to 10 images frame-<time>.jpg of the final Reel, covering every moment of the effect.",
    "On these images, every text is whole in the frame, readable at a phone's size, out of the bottom quarter (480 px) and at least 140 px from the sides.",
    "The style goes with her request, or with the Reel she copies: nothing that looks like an ad or a flyer (promo starburst, sale badge), unless she asked for it or the universe she names does it itself (speed lines in a manga, an explosion in a cartoon).",
    ...(voice ? ["Her voice-over is whole and untouched, its first word around 0.2 s, and its words are subtitled, readable, out of the bottom quarter (480 px)."] : []),
    `${WORDS_FILE} lists each text written on screen (apart from subtitles) with a label for her, its text and its maximum length; ${KIT_FILE} holds render.py, which remakes reel.mp4 from ${WORDS_FILE} and her files, downloading nothing.`,
    "notes.md says what was measured, how the effect follows the video and what was corrected after looking; message.txt talks to her in two sentences, in French.",
  ];
  return ["# Criteria, each graded on its own", ...points.map((p, i) => `${i + 1}. ${p}`)].join("\n");
}

/** A text as she sees it: spaces cleaned (the non-breaking ones of French typography kept), its lines kept. */
const cleanWord = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

/**
 * words.json as the agent wrote it: each text kept within its bounds (an id to find it by, a label in
 * her words, its text, how long it may get: never under its own length); a text it cannot read is
 * left out, and a file it cannot read gives none (her texts then change by asking Edith).
 */
export function readEffectWords(json: string | null | undefined): EffectWord[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json ?? "");
  } catch {
    return null;
  }
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { words?: unknown }).words) ? (raw as { words: unknown[] }).words : null;
  if (!list) return null;
  const words: EffectWord[] = [];
  for (const item of list) {
    if (words.length >= EFFECT_WORDS_MAX || !item || typeof item !== "object") continue;
    const w = item as Record<string, unknown>;
    const id = typeof w.id === "string" ? w.id.trim() : "";
    const text = typeof w.text === "string" ? cleanWord(w.text).slice(0, 200) : "";
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !text || words.some((x) => x.id === id)) continue;
    const label = typeof w.label === "string" && w.label.trim() ? w.label.replace(/\s+/g, " ").trim().slice(0, 80) : `Texte ${words.length + 1}`;
    const max = Math.min(200, Math.max(text.length, Math.round(Number(w.max)) || text.length));
    words.push({ id, label, text, max });
  }
  return words;
}

/**
 * Her new words for the effect's texts (the others stay): each one a text of its kit, never empty nor
 * longer than its place allows. What to tell her otherwise.
 */
export function editEffectWords(current: EffectWord[], changes: { id: string; text: string }[]): EffectWord[] | { error: string } {
  // Her words set like the agent's: the narrow space before « : ; ! ? % € », a number held to its word.
  const wanted = new Map(changes.map((c) => [c.id, frenchSpaces(cleanWord(c.text))]));
  const unknown = [...wanted.keys()].find((id) => !current.some((w) => w.id === id));
  if (unknown) return { error: `Ce texte n’est pas dans ce Reel (${unknown}).` };
  const next = current.map((w) => (wanted.has(w.id) ? { ...w, text: wanted.get(w.id)! } : w));
  const empty = next.find((w) => !w.text);
  if (empty) return { error: `« ${empty.label} » ne peut pas être vide.` };
  const long = next.find((w) => w.text.length > w.max);
  if (long) return { error: `« ${long.label} » : ${long.max} caractères au plus, pour tenir à sa place.` };
  if (next.every((w, i) => w.text === current[i]!.text)) return { error: "Tes mots n’ont pas changé." };
  return next;
}

/** How long her new words take: the effect's script draws the video again (in the app, to her). */
export const EFFECT_WORDS_MINUTES = "2 à 5";

/** What one replay may spend at list prices, in cents: a few calls and the time its script draws. */
export const EFFECTS_REPLAY_CENTS = 150;

/**
 * The replay: her words on the effect, drawn again by the agent's own script in the same environment
 * (her files only ever in a container of their own, never on a shared machine), by a lighter model
 * that only runs it. Nothing is designed again.
 */
export const EFFECTS_REPLAY_SYSTEM = `You redo the video of a Reel already edited, with other words, by running its own render script again. You work alone in a Linux container (bash, Python 3, ffmpeg, OpenCV, Pillow); nobody answers while you work: ask no question. You change nothing in the Reel, only what stops the script from running or a word from fitting in its place.`;

/** The replay's task: unpack, run the script with her words, check, write the video out. */
export function effectsReplayTask(files: string[]): string {
  return [
    `The Reel's kit: ${UPLOADS}/${KIT_FILE} (render.py and what it reads). Its files: ${files.map((f) => `${UPLOADS}/${f}`).join(", ") || "none"}. The new words: ${UPLOADS}/${WORDS_FILE}.`,
    "1. In an empty working folder, unpack the kit, then copy its files into it under the same names, and the new words.json (in place of the kit's).",
    "2. Run: python3 render.py words.json reel.mp4. If a Python package is missing, install it with pip; if it crashes on anything else, fix as little as possible, changing nothing in the render.",
    "3. Check that reel.mp4 plays (ffprobe: 1080×1920, a sound track) and look at 2 or 3 images where the words are on screen: each word whole and readable. A word that overflows or gets cut: only reduce its size in render.py and run it again.",
    `4. Copy reel.mp4 into ${OUTPUTS}/; if you fixed render.py, also write the fixed kit to ${OUTPUTS}/${KIT_FILE}.`,
    `If you can't do it, write why in one sentence in ${OUTPUTS}/erreur.txt and stop.`,
  ].join("\n");
}

/** One of the agent's files (words.json, render.py, kit.tar.gz…): never named to her. */
const AGENT_FILE = /\b[\w-]+\.(?:json|py|txt|md|tar|gz|zip|mp4|mov|png|jpe?g|webp)\b/i;

/**
 * Her two sentences from message.txt, cleaned and bounded (null when the agent wrote none). A clause that
 * names one of its files goes, from its colon, semicolon, dash or bracket (else its sentence): the agent
 * once told her « tu peux changer ces mots toi-même dans words.json »; the delivery says where she does it.
 */
export function effectsMessage(text: string | null | undefined): string | null {
  const clean = (text ?? "")
    .replace(/[#*_`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => {
      const at = sentence.search(AGENT_FILE);
      if (at < 0) return sentence;
      const cut = Math.max(...[" : ", " ; ", " — ", " – ", " ("].map((mark) => sentence.lastIndexOf(mark, at)));
      return cut > 0 ? `${sentence.slice(0, cut).replace(/[\s,]+$/, "")}.` : "";
    })
    .filter(Boolean)
    .join(" ");
  if (!clean) return null;
  if (clean.length <= 500) return clean;
  const cut = clean.slice(0, 500);
  const end = cut.lastIndexOf(". ");
  return end > 200 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

/** The length of an MP4 (s), read in its movie header (moov › mvhd); null when it is not found. */
export function mp4Duration(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) => String.fromCharCode(bytes[at + 4]!, bytes[at + 5]!, bytes[at + 6]!, bytes[at + 7]!);
  /** The boxes between start and end: offset of each box, its type and where it ends. */
  const boxes = function* (start: number, end: number) {
    let at = start;
    while (at + 8 <= end) {
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) return;
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) return;
      yield { at, kind: type(at), body: at + header, end: at + size };
      at += size;
    }
  };
  for (const box of boxes(0, bytes.length)) {
    if (box.kind !== "moov") continue;
    for (const child of boxes(box.body, box.end)) {
      if (child.kind !== "mvhd" || child.body + 32 > child.end) continue;
      const v1 = bytes[child.body] === 1;
      const timescale = view.getUint32(child.body + (v1 ? 20 : 12));
      const duration = v1 ? Number(view.getBigUint64(child.body + 24)) : view.getUint32(child.body + 16);
      return timescale ? Math.round((duration / timescale) * 1000) / 1000 : null;
    }
  }
  return null;
}

/** A correction of her effect that takes its voice out (the voice is mixed into the agent's video). */
export const EFFECT_VOICE_OUT = "Retire la voix off et ses sous-titres de ce Reel ; garde l'effet, les plans, les textes et le rythme tels quels.";

const BLUR_WORDS: Record<string, string> = { face: "les visages", plate: "les plaques d'immatriculation", screen: "les écrans", document: "les papiers et documents", other: "ce qu'il faut cacher" };

/** A correction of her effect that blurs what she asked for (her blur is drawn by the agent, the engine's would not reach its video). */
export function effectBlurBrief(kinds: string[]): string {
  if (!kinds.length) return "Retire le flou de ce Reel ; garde l'effet et tout le reste tels quels.";
  const what = [...new Set(kinds.map((k) => BLUR_WORDS[k] ?? BLUR_WORDS.other))].join(", ");
  return `Floute ${what} dans ce Reel, partout où on les voit (un flou qui suit chaque image), sans toucher à l'effet ; garde tout le reste tel quel.`;
}

/** A Reel the agent made: kept as a plan of one shot (its video), marked as made outside the engine, with its kit when it left one. */
export function effectPlan(input: {
  mediaId: string;
  seconds: number;
  session: string;
  voice?: EditPlan["voice"];
  kit?: { path: string; words: EffectWord[]; files: { name: string; media_id: string }[] } | null;
}): EditPlan {
  const seconds = Math.max(3, Math.min(90, Math.round(input.seconds * 1000) / 1000));
  return {
    format: "9:16",
    duration: seconds,
    template: "libre",
    segments: [{ clip_id: input.mediaId, in: 0, out: seconds, zoom: "none" }],
    texts: [],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    baked: { by: "agent", session: input.session, ...(input.kit ? { kit: input.kit.path, words: input.kit.words, files: input.kit.files } : {}) },
    ...(input.voice ? { voice: input.voice } : {}),
  };
}

/** A plan whose video was made by the effects agent: played as it is, its texts are in the image. */
export const isBaked = (plan: Pick<EditPlan, "baked"> | null | undefined): boolean => Boolean(plan?.baked);

/** The texts she can change herself on an effect's video: its kit's (none without a kit, or without her files to give it back). */
export const effectWords = (plan: Pick<EditPlan, "baked"> | null | undefined): EffectWord[] =>
  plan?.baked?.kit && plan.baked.files?.length ? (plan.baked.words ?? []) : [];
