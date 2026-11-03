import "server-only";
import { googleFont } from "@/lib/fonts";
import {
  BRIEF_MAX,
  CHAT_MODEL,
  contractLines,
  COPY_WORDS_PROMPT,
  castInput,
  copyable,
  copyCast,
  copyPlan,
  copyShots,
  faceInSubject,
  FEW_SUBJECTS,
  subjectLikely,
  copyWordsSchema,
  cutoutSchema,
  finishPlan,
  followedLook,
  laysCutouts,
  memoryLines,
  shotScore,
  type ClipAnalysis,
  type CopyFile,
  type CopyWords,
  type EditPlan,
  type FollowedStyle,
  type MediaFacts,
  type ReelContract,
} from "@fauve/agent";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { insertPlanVersion } from "@/lib/edit-plans";
import { ensureCutouts } from "@/lib/render/cutout";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { noteGap } from "@/lib/toolkit";
import { postStyle } from "@/lib/steal";
import { anthropic, logClaudeCost } from "./run";

// A simple copied Reel remade by code (packages/agent/src/copy.ts): one small call writes its words and says whether
// her request is served by it; the plan is code. Anything else goes to the editor, as before.

/** How long the cut-outs of her photos are waited for (their own sandbox, 10 to 30 s a photo). */
const CUTOUTS_WAIT_MS = 4 * 60_000;
/** The most photos cut out for a copy, the likeliest subjects first, a few at a time (what is ready in time is laid). */
const MAX_CUT = 20;
const CUT_BATCH = 4;

export type CopyDesign = { plan: EditPlan; editPlanId: string; version: number; rationale: string };

/** Whether a Reel she copies can be remade by code at all, before anything is asked (its form, her request's fixed points, her voice). */
export function copyCandidate(followed: FollowedStyle | undefined, contract: ReelContract | undefined, voice: boolean): followed is FollowedStyle & { measured: NonNullable<FollowedStyle["measured"]> } {
  return Boolean(
    followed &&
      !followed.own &&
      // A model Edith picked as this Reel's form is directed (its composition written, then looked at), never copied by code.
      !followed.dressed &&
      followed.measured &&
      copyable(followed.look, followed.measured) &&
      !voice &&
      !contract?.layout &&
      !contract?.voice_text &&
      !contract?.voice_text_rest,
  );
}

/**
 * Remakes the Reel she copies by code, or returns null when her request needs more than the code does (the editor
 * then makes it) or its words could not be written.
 */
export async function designCopy(params: {
  studioId: string;
  postId: string;
  followed: FollowedStyle & { measured: NonNullable<FollowedStyle["measured"]> };
  /** Her files, in her order. */
  mediaIds: string[];
  clips: { media_id: string; analysis: ClipAnalysis }[];
  photos: MediaFacts["photos"];
  brief?: string;
  contract?: ReelContract;
  /** The version corrected, when it is a copy: its words are kept but what her request changes. */
  previous?: EditPlan | null;
  studio: { name?: string | null; business?: string | null; memory?: unknown; booking?: boolean; tone?: string; fonts?: string[] };
}): Promise<CopyDesign | null> {
  const { followed } = params;
  const look = followed.look;
  const photoIds = params.mediaIds.filter((id) => params.photos[id]);
  // Her photos' subjects, cut out once (laid over the other shots when the model lays some): the photos whose reading
  // says an object, someone or a close-up first, a few at a time, so what is ready in time is laid. In her order, the
  // first ten (streets and façades) had been cut and the woman with her dog, the barista and the shoes never tried.
  if (laysCutouts(look) && photoIds.length) {
    const ranked = photoIds
      .map((id, i) => ({ id, i, score: subjectLikely(params.photos[id]!.detection.notes) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, MAX_CUT)
      .map((p) => p.id);
    const began = Date.now();
    for (let k = 0; k < ranked.length; k += CUT_BATCH) {
      const left = CUTOUTS_WAIT_MS - (Date.now() - began);
      if (left <= 0) break;
      await Promise.race([
        ensureCutouts(params.studioId, ranked.slice(k, k + CUT_BATCH)).catch((e: unknown) => console.warn("copy: cut-outs not ready", e)),
        new Promise((resolve) => setTimeout(resolve, left)),
      ]);
    }
  }
  const cutouts = photoIds.length
    ? new Map(
        ((await supabaseAdmin().from("media_assets").select("id, cutout").eq("studio_id", params.studioId).in("id", photoIds)).data ?? []).flatMap((a) => {
          const cut = cutoutSchema.safeParse(a.cutout);
          // Only a clean subject (a sticker's rule): a cut-out with a ragged edge is not laid.
          return cut.success && cut.data.sticker && cut.data.path.startsWith(`${params.studioId}/`) ? [[a.id as string, cut.data] as const] : [];
        }),
      )
    : new Map();

  const files: CopyFile[] = params.mediaIds.flatMap((id): CopyFile[] => {
    if (params.photos[id]) {
      const cut = cutouts.get(id);
      // Someone stands on the bottom edge (a face read inside the subject cut out); an object sits big in the middle.
      // A face anywhere on the photo had stood a row of terrace chairs up like a person.
      const person = cut ? faceInSubject(params.photos[id]!.detection.regions, cut.box) : false;
      return [{ id, photo: true, seconds: 0, ...(cut ? { cutout: { tall: (cut.box.h * cut.h) / Math.max(1, cut.box.w * cut.w), person } } : {}) }];
    }
    const clip = params.clips.find((c) => c.media_id === id);
    if (!clip) return [];
    const a = clip.analysis;
    // Its best moments, then its clean shots, best first: a blurry or dark passage comes last.
    const shots = [...a.shots].filter((s) => !s.quality.blurry && !s.quality.dark).sort((x, y) => shotScore(y, a) - shotScore(x, a));
    return [{ id, photo: false, seconds: a.duration, moments: [...a.best_moments, ...shots].map((m) => ({ start: m.start, end: m.end })) }];
  });
  if (!files.length) return null;

  // One small call writes its words and casts her files on its shots, as an editor would: for each shot, her ground most
  // like the model's and the subject that makes sense on it (« il n'y a pas de logique concrète sur ces choix »).
  const shots = copyShots({ cuts: followed.measured.cuts, duration: followed.measured.duration, look });
  const cast = castInput(shots.spans, look.shots, copyCast(files, look, shots.spans.length), {
    ...Object.fromEntries(Object.entries(params.photos).map(([id, read]) => [id, read.detection.notes])),
    ...Object.fromEntries(params.clips.map((c) => [c.media_id, c.analysis.summary])),
  });
  const words = await copyWords(params, cast.input);
  if (!words) return null;
  if (!words.fits) {
    console.log("copy: her request needs the editor", params.postId, words.missing);
    // What the code could not do, noted: a gap that comes back becomes a tool (toolkit).
    await noteGap({ studioId: params.studioId, postId: params.postId, source: "copy", label: words.missing || "une demande hors de la recopie", request: params.brief });
    return null;
  }
  const plan = copyPlan({ cuts: followed.measured.cuts, duration: followed.measured.duration, bpm: followed.bpm, files, look, words, assignment: cast.read(words.shots) });
  Object.assign(plan, followedLook(plan, followed));
  // Each shot framed on its subject and its light corrected, as any montage.
  const durations = Object.fromEntries(files.map((f) => [f.id, f.photo ? plan.duration : f.seconds]));
  const facts: MediaFacts = { clips: Object.fromEntries(params.clips.map((c) => [c.media_id, c.analysis])), photos: params.photos, tracks: {} };
  Object.assign(plan, finishPlan(plan, facts, durations));

  const row = await insertPlanVersion(params.studioId, params.postId, plan);
  await supabaseAdmin().from("posts").update({ edit_plan_id: row.id }).eq("id", params.postId);
  const laid = plan.copy?.cutouts.length ?? 0;
  // Too few clean subjects for a model that lays one on most shots: more shots stay bare, and she is told what to send.
  const subjects = files.filter((f) => f.cutout).length;
  const few = laysCutouts(look) && subjects < FEW_SUBJECTS;
  return {
    plan,
    editPlanId: row.id,
    version: row.version,
    rationale: [
      `Je l'ai refait sur les coupes exactes du Reel que tu m'as envoyé${laid ? ", avec les sujets de tes photos détourés par-dessus" : ""}${plan.copy?.title ? ", et son titre dans sa police" : ""}.`,
      words.why,
      few
        ? `Je n'ai trouvé ${subjects ? `que ${subjects} sujet${subjects > 1 ? "s" : ""} net${subjects > 1 ? "s" : ""}` : "aucun sujet net"} à détourer dans tes photos, alors plus de plans restent sans détourage que dans le modèle : envoie-moi 4 ou 5 photos d'objets ou de personnes sur un fond simple et je le refais plus varié.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** Its words and whether her request fits, in one small call (Sonnet). Null when it fails: the editor makes the Reel. */
async function copyWords(
  params: Parameters<typeof designCopy>[0],
  casting: ReturnType<typeof castInput>["input"],
): Promise<(CopyWords & { fits: boolean; missing: string; shots: { ground: string; subjects: string[] }[]; why: string }) | null> {
  const look = params.followed.look;
  const current = params.previous?.copy;
  const input = {
    commerce: {
      nom: params.studio.name ?? undefined,
      activite: params.studio.business ?? undefined,
      ce_qu_on_sait: memoryLines(params.studio.memory),
      lien_de_reservation: params.studio.booking ? "oui, dans sa bio" : "non",
      ton: params.studio.tone,
    },
    demande: params.brief?.slice(0, BRIEF_MAX) || "Refaire le Reel envoyé, avec ses fichiers.",
    ...(contractLines(params.contract).length ? { contrat: contractLines(params.contract) } : {}),
    ...(params.studio.fonts?.length ? { charte: { polices: params.studio.fonts.slice(0, 2) } } : {}),
    reel_modele: {
      texte: look.text.amount,
      composition_du_titre: look.text.composition,
      casse: look.text.case === "upper" ? "capitales" : "normale",
      lignes: look.text.lines === "staggered" ? "décalées" : "alignées",
      fin: look.ending,
    },
    ...(current ? { version_actuelle: { titre: current.title?.lines ?? [], fin: current.end?.cards.map((c) => c.lines) ?? [] } } : {}),
    ...casting,
  };
  try {
    const response = await anthropic().beta.messages.parse({
      model: CHAT_MODEL,
      max_tokens: 6000,
      output_config: { effort: "medium", format: outputFormat(copyWordsSchema) },
      system: COPY_WORDS_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    await logClaudeCost(params.studioId, response.usage, "copy_words", CHAT_MODEL);
    if (!response.parsed_output) return null;
    const answer = readAnswer(copyWordsSchema, response.parsed_output);
    const line = (l: string) => l.trim().slice(0, 48);
    // A font she asked for, as Google Fonts serves it (else the model's stays).
    const font = answer.font.trim() ? await googleFont(answer.font).catch(() => null) : null;
    return {
      ...(font ? { font } : {}),
      fits: answer.fits,
      missing: answer.missing.trim().slice(0, 200),
      title: answer.title.map(line).filter(Boolean).slice(0, 4),
      end: answer.end.map((card) => card.map(line).filter(Boolean).slice(0, 3)).filter((card) => card.length).slice(0, 3),
      shots: answer.shots.slice(0, 80),
      why: answer.why.trim().slice(0, 300),
    };
  } catch (error) {
    console.warn("copy: its words could not be written, the editor makes it", error);
    return null;
  }
}

/**
 * At launch: the Reel she copies lays a subject on most shots, and her photos hold fewer than FEW_SUBJECTS likely ones
 * (from their readings, before anything is cut out). Their count, else null: Edith says it in a sentence, the Reel goes.
 */
export async function fewSubjects(studioId: string, postId: string, mediaIds: string[]): Promise<number | null> {
  const followed = await postStyle(studioId, postId).catch(() => undefined);
  if (!copyCandidate(followed, undefined, false) || !laysCutouts(followed.look) || !mediaIds.length) return null;
  const { data } = await supabaseAdmin().from("media_assets").select("kind, regions").eq("studio_id", studioId).in("id", mediaIds);
  const likely = (data ?? []).filter((m) => m.kind === "image" && subjectLikely(((m.regions as { detection?: { notes?: string } } | null)?.detection?.notes) ?? "") > 0).length;
  return likely < FEW_SUBJECTS ? likely : null;
}
