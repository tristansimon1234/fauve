import { tradeDetail, type FilmHabit } from "./shooting.ts";

// Her files judged on their form before a Reel is designed (Tristan: « Dans quelle mesure Edith peut conseiller avant
// la conception d'un Reel », « oui »). Nothing is asked of a model: what was already measured on each file (the clip
// analysis's shots, light, orientation and correction; a photo's reading; its picture and length) gives a short verdict
// of the set, and the ten seconds to film that would fix its main weakness. Edith reads it as a context line and gives
// it once with her plan, as advice: she never discards a file and launches with what there is when asked.

type Quality = { blurry?: boolean; dark?: boolean; shaky?: boolean };
type AnalysedShot = { start?: number; end?: number; quality?: Quality; hook_score?: number; energy?: number; faces_visible?: boolean };

/** One of her files as measured: a video's analysis, a photo's reading (its light correction), its picture. */
export type CheckedFile = {
  kind: "video" | "image";
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  /** The clip analysis (Gemini), when the video was read. */
  analysis?: {
    duration?: number;
    orientation?: "portrait" | "landscape" | "square";
    lighting?: "good" | "ok" | "poor";
    shots?: AnalysedShot[];
    issues?: string[];
    actions?: unknown[];
    transcript?: string;
    words?: unknown[];
    correction?: { exposure?: number; warmth?: number };
  } | null;
  /** A photo's light correction, as its reading gave it (regions.detection.adjust). */
  adjust?: { exposure?: number; warmth?: number } | null;
};

export type FileProblem =
  | "no_hook"
  | "photos_only"
  | "one_shot"
  | "landscape"
  | "dark"
  | "burnt"
  | "backlit"
  | "mixed_light"
  | "blurry"
  | "shaky"
  | "too_short"
  | "little"
  | "low_res";

/** Most important first: what the first second shows, then the picture, then the rest. */
const ORDER: FileProblem[] = ["no_hook", "photos_only", "landscape", "one_shot", "dark", "backlit", "burnt", "mixed_light", "blurry", "shaky", "little", "too_short", "low_res"];

export type FilesVerdict = {
  /** What was measured, most important first, each in a few French words. */
  problems: { key: FileProblem; words: string }[];
  /** Ten seconds to film that would fix the main one; null when nothing to film would. */
  fix: string | null;
  /** How many files were measured. */
  measured: number;
};

/** A correction this strong means the file is far from right (Gemini's are ±0.05 to ±0.15 on most files). */
const DARK_EXPOSURE = 0.25;
const BURNT_EXPOSURE = -0.15;
/** Its picture needs this much warming: it is cold (blue); this much cooling: it is warm (yellow, orange). */
const COLD_WARMTH = 0.15;
const WARM_WARMTH = -0.1;
/** Under this a video can't give a shot. */
const TOO_SHORT_S = 1.5;
/** A short side under this is a small picture (the engine upscales it, but a phone films 1080). */
const LOW_RES = 720;

const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);
const plural = (word: string) => (/[sx]$/.test(word) ? word : `${word}s`);

function orientationOf(f: CheckedFile): "portrait" | "landscape" | "square" | null {
  if (f.kind === "video" && f.analysis?.orientation) return f.analysis.orientation;
  if (!f.width || !f.height) return null;
  return f.width > f.height * 1.1 ? "landscape" : f.height > f.width * 1.1 ? "portrait" : "square";
}

/** The share of a video's length whose shots have this flaw. */
function share(f: CheckedFile, flaw: keyof Quality): number {
  const shots = f.analysis?.shots ?? [];
  if (!shots.length) return 0;
  const total = shots.reduce((s, x) => s + Math.max(0, (x.end ?? 0) - (x.start ?? 0)), 0);
  if (total <= 0) return shots.filter((s) => s.quality?.[flaw]).length / shots.length;
  return shots.reduce((s, x) => s + (x.quality?.[flaw] ? Math.max(0, (x.end ?? 0) - (x.start ?? 0)) : 0), 0) / total;
}

const exposureOf = (f: CheckedFile) => (f.kind === "video" ? f.analysis?.correction?.exposure : f.adjust?.exposure) ?? 0;
const warmthOf = (f: CheckedFile) => (f.kind === "video" ? f.analysis?.correction?.warmth : f.adjust?.warmth) ?? 0;
/** A problem the analysis named plainly (not « léger », « un peu »). */
const named = (f: CheckedFile, re: RegExp) => (f.analysis?.issues ?? []).some((i) => re.test(i) && !/l[ée]g[eè]re?(ment)?|un peu|ponctuel/i.test(i));

const isDark = (f: CheckedFile) => (f.kind === "video" ? f.analysis?.lighting === "poor" || share(f, "dark") >= 0.5 : false) || exposureOf(f) >= DARK_EXPOSURE;
const isBurnt = (f: CheckedFile) => exposureOf(f) <= BURNT_EXPOSURE || named(f, /surexpos|br[ûu]l|blanch|cram/i);
const isBacklit = (f: CheckedFile) => named(f, /contre-jour/i);
const isCold = (f: CheckedFile) => warmthOf(f) >= COLD_WARMTH;
const isWarm = (f: CheckedFile) => warmthOf(f) <= WARM_WARMTH;
const durationOf = (f: CheckedFile) => f.analysis?.duration ?? f.duration ?? null;

/** Her files named as she sent them: « ta vidéo », « ta 3e vidéo », « tes 2 photos », « ta 1re vidéo et ta 2e photo ». */
function nameOf(files: CheckedFile[], picked: CheckedFile[]): { words: string; many: boolean } {
  const label = (f: CheckedFile) => {
    const same = files.filter((x) => x.kind === f.kind);
    const noun = f.kind === "video" ? "vidéo" : "photo";
    return same.length === 1 ? `ta ${noun}` : `ta ${ordinal(same.indexOf(f) + 1)} ${noun}`;
  };
  const kinds = new Set(picked.map((f) => f.kind));
  if (picked.length > 1 && kinds.size === 1) {
    const kind = picked[0]!.kind;
    const noun = kind === "video" ? "vidéos" : "photos";
    if (picked.length === files.filter((f) => f.kind === kind).length) return { words: picked.length === 2 ? `tes deux ${noun}` : `tes ${picked.length} ${noun}`, many: true };
  }
  if (picked.length === files.length && picked.length > 2) return { words: "tous tes fichiers", many: true };
  const names = picked.map(label);
  return { words: names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`, many: names.length > 1 };
}

/** The verdict on the form of the files she sent for a Reel, from what was measured on them. */
export function filesVerdict(files: CheckedFile[], businessType?: string | null): FilesVerdict {
  // Only what was measured counts: a video not read yet says nothing of its light or shots.
  const known = files.filter((f) => f.kind === "image" || f.analysis);
  const problems: { key: FileProblem; words: string }[] = [];
  const add = (key: FileProblem, words: string) => problems.push({ key, words });
  const about = (picked: CheckedFile[], one: string, many: string) => {
    if (!picked.length) return null;
    const n = nameOf(known, picked);
    return `${n.words} ${n.many ? many : one}`;
  };
  const flagged = (key: FileProblem, test: (f: CheckedFile) => boolean, one: string, many: string) => {
    const words = about(known.filter(test), one, many);
    if (words) add(key, words);
  };

  const videos = known.filter((f) => f.kind === "video");
  const photos = known.filter((f) => f.kind === "image");
  if (known.length) {
    // The first second: something alive to open on (a strong shot, a face, a gesture).
    const shots = videos.flatMap((v) => v.analysis?.shots ?? []);
    const opener = shots.some((s) => (s.hook_score ?? 0) >= 3 || s.faces_visible || (s.energy ?? 0) >= 3) || videos.some((v) => (v.analysis?.actions?.length ?? 0) > 0);
    if (!videos.length) add("photos_only", photos.length === 1 ? "une seule photo, rien ne bouge dans la 1re seconde" : "que des photos, rien ne bouge dans la 1re seconde");
    else if (shots.length && !opener) add("no_hook", "rien ne bouge assez pour la 1re seconde (aucun plan n'accroche)");
    // One shot for a whole Reel: the same image comes back.
    const seconds = videos.reduce((s, v) => s + (durationOf(v) ?? 0), 0);
    const count = shots.length + photos.length;
    // Someone who speaks, or a gesture after another, says something else in each passage (alikeClip in editor.ts).
    const telling = videos.some((v) => v.analysis?.transcript?.trim() || v.analysis?.words?.length || (v.analysis?.actions?.length ?? 0) > 1);
    if (videos.length && !telling && photos.length <= 1 && count <= 2 && seconds >= 5) add("one_shot", count === 1 ? "tout est dans le même plan" : "seulement 2 plans en tout");
    flagged("landscape", (f) => orientationOf(f) === "landscape", "est à l'horizontale", "sont à l'horizontale");
    flagged("dark", isDark, "est très sombre", "sont très sombres");
    flagged("backlit", isBacklit, "est à contre-jour", "sont à contre-jour");
    flagged("burnt", (f) => !isBacklit(f) && isBurnt(f), "est surexposée (des blancs brûlés)", "sont surexposées (des blancs brûlés)");
    const cold = known.filter(isCold);
    const warm = known.filter(isWarm);
    if (cold.length && warm.length) {
      const c = nameOf(known, cold);
      const w = nameOf(known, warm);
      add("mixed_light", `des lumières qui ne vont pas ensemble (${c.words} ${c.many ? plural("froide") : "froide"}, ${w.words} ${w.many ? plural("jaune") : "jaune"})`);
    }
    flagged("blurry", (f) => share(f, "blurry") >= 0.5, "est floue", "sont floues");
    flagged("shaky", (f) => share(f, "shaky") >= 0.5, "bouge beaucoup", "bougent beaucoup");
    if (videos.length && photos.length < 3 && seconds > 0 && seconds < 5) add("little", `à peine ${Math.round(seconds)} s de vidéo en tout`);
    else flagged("too_short", (f) => f.kind === "video" && (durationOf(f) ?? Infinity) < TOO_SHORT_S, "dure moins de 2 s", "durent moins de 2 s");
    flagged("low_res", (f) => Boolean(f.width && f.height && Math.min(f.width, f.height) < LOW_RES), "est en petite qualité", "sont en petite qualité");
  }
  problems.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
  return { problems, fix: problems.length ? fixFor(problems[0]!.key, businessType) : null, measured: known.length };
}

/** Ten seconds to film that would fix it, in the words of her trade. */
function fixFor(key: FileProblem, businessType?: string | null): string | null {
  switch (key) {
    case "no_hook":
    case "photos_only":
    case "one_shot":
    case "little":
      return `3 plans de 3 s qui bougent, pour ouvrir sur ${tradeDetail(businessType)}, de très près`;
    case "landscape":
      return "les mêmes plans, le téléphone à la verticale";
    case "dark":
      return "les mêmes plans face à une fenêtre, ou toutes les lumières allumées";
    case "backlit":
    case "burnt":
      return "les mêmes plans, la fenêtre dans ton dos plutôt que derrière le sujet";
    case "mixed_light":
      return "les mêmes plans sous une seule lumière, le jour ou les lampes, pas les deux";
    case "blurry":
    case "shaky":
      return "les mêmes plans, téléphone posé ou à deux mains, en touchant l'écran sur le sujet";
    case "too_short":
      return "5 s par plan, sans couper";
    case "low_res":
      return null;
  }
}

/** The verdict as Edith reads it in her context, for the files of this exchange: null when none was measured. */
export function filesVerdictLine(files: CheckedFile[], businessType?: string | null): string | null {
  const v = filesVerdict(files, businessType);
  if (!v.measured) return null;
  const head = `Ses fichiers depuis le dernier lancement (${v.measured}, mesurés)`;
  if (!v.problems.length) return `${head} : rien à redire sur leur forme.`;
  const words = v.problems.slice(0, 3).map((p) => p.words).join(" ; ");
  return `${head} : ${words}.${v.fix ? ` 10 s à filmer qui arrangeraient ça : ${v.fix}.` : ""} Un avis pour un Reel, une fois ; rien n'est écarté et elle peut lancer avec ce qu'il y a.`;
}

/** Her habit on her latest files, when half of them share it: the point of a shot list it changes (filmGuide). */
export function fileHabit(files: CheckedFile[]): FilmHabit | null {
  const videos = files.filter((f) => f.kind === "video" && f.analysis);
  if (videos.length < 2) return null;
  const half = (test: (f: CheckedFile) => boolean) => videos.filter(test).length * 2 >= videos.length;
  if (half((f) => orientationOf(f) === "landscape")) return "landscape";
  if (half(isDark)) return "dark";
  if (half((f) => share(f, "shaky") >= 0.5 || share(f, "blurry") >= 0.5)) return "shaky";
  if (videos.some(isCold) && videos.some(isWarm)) return "mixed";
  return null;
}
