import "server-only";
import {
  BRIEF_MAX,
  CHAT_MODEL,
  contractLines,
  isClipSegment,
  layerShots,
  memoryLines,
  PIECE_FILL_PROMPT,
  pieceFillInput,
  pieceFillSchemaFor,
  pieceMotion,
  saidUnder,
  pieceWordsOf,
  readPieceFill,
  unplayedPiece,
  type EditPlan,
  type EffectPiece,
  type MediaFacts,
  type PieceFacts,
  type PieceFillAnswer,
  type PieceUnder,
  type ReelContract,
} from "@fauve/agent";
import { studioPlace } from "@/lib/geo";
import { outputFormat, readAnswer } from "@fauve/agent/answer";
import { designMotionScenes, type OfferedPhoto, type SceneBrand, type SceneContext, type SceneRequest } from "./motion-designer";
import { anthropic, logClaudeCost } from "./run";

// An effect of the bank played on her Reel (packages/agent/src/pieces.ts): the editor laid it over some of her shots
// (« [borrow: <key>] » in a layer's brief); one small call (Sonnet) writes its words and names what it lights up in her
// shots; its code is played as it is, checked like any animation (the scene check, with its words), never written again.
// Refused by the check (her words too long for their place, most often), it is filled once more with what the check
// said, for a cent; when it still cannot play, the motion designer writes the animation from its brief, the piece's code
// as its base (borrowed-effects.ts). Its cost: about a cent for its words, the check's sandbox time.

/** What became of each layer that names a piece: played as it is, or left to the motion designer (with why). */
export type PiecesPlayed = { played: { index: number; key: string }[]; unplayed: { index: number; key: string; why: string }[] };

/** A span this much shorter than the piece's shortest still plays it (it holds a little faster); shorter, the motion designer writes it. */
const SHORT_ENOUGH = 0.8;

/** One of the shots under it as its filler reads it: what Gemini saw in that passage of her video, or what her photo shows. */
function underOf(plan: EditPlan, facts: MediaFacts, k: number): PieceUnder {
  const segment = plan.segments.filter(isClipSegment)[k]!;
  const photo = facts.photos[segment.clip_id];
  if (photo) return { id: segment.clip_id, photo: true, shows: (photo.detection.notes ?? "").slice(0, 200) };
  const clip = facts.clips[segment.clip_id];
  const shot = clip?.shots.find((s) => segment.in >= s.start - 0.05 && segment.in < s.end) ?? clip?.shots[0];
  return {
    id: segment.clip_id,
    photo: false,
    shows: (shot?.description ?? clip?.summary ?? "").slice(0, 200),
    ...(shot?.framing ? { framing: shot.framing } : {}),
    ...(shot?.camera ? { camera: shot.camera } : {}),
  };
}

/**
 * Plays the pieces its layers name (`layers`: their index in plan.layers and the piece's key): each one filled, its layer's
 * motion set (`plan` is changed in place), checked; the ones that cannot play are left with their brief alone, for the
 * motion designer. `requestFor` builds the check's request for a layer as the editor's step builds any (the shots under
 * it, its cuts, what moves there).
 */
export async function playPieces(input: {
  studioId: string;
  postId: string;
  plan: EditPlan;
  layers: { index: number; key: string }[];
  pieces: Map<string, EffectPiece>;
  facts: MediaFacts;
  /** Her request for this Reel (her words, then Edith's brief). */
  request?: string;
  contract?: ReelContract;
  studio: { name?: string | null; business?: string | null; memory?: unknown };
  /** The version corrected: its pieces' words are kept but what her request changes. */
  previous?: EditPlan | null;
  requestFor: (index: number) => SceneRequest;
  brand: SceneBrand;
  context: SceneContext;
  /** Her photos in this Reel (an effect that lays some chooses among them): each one's id and what it shows. */
  photos?: { id: string; shows: string }[];
  /** Her photos as an animation gets them (links, cut-outs), for the check of an effect that lays some. */
  photoOffers?: (ids: string[]) => Promise<OfferedPhoto[]>;
}): Promise<PiecesPlayed> {
  const result: PiecesPlayed = { played: [], unplayed: [] };
  const layers = input.plan.layers ?? [];
  // What the engine writes itself in an effect's slots: her place's coordinates (her address geocoded once, kept on the studio).
  const wantsPlace = input.layers.some(({ key }) => input.pieces.get(key)?.texts.some((t) => t.fact === "coordinates"));
  const facts: PieceFacts | undefined = wantsPlace
    ? await studioPlace(input.studioId)
        .then((place) => (place ? { coordinates: place.label } : undefined))
        .catch((error: unknown) => {
          console.warn("geo: no coordinates for this effect", input.studioId, error instanceof Error ? error.message : error);
          return undefined;
        })
    : undefined;
  for (const { index, key } of input.layers) {
    const piece = input.pieces.get(key);
    const layer = layers[index];
    if (!piece || !layer) continue;
    const leave = (why: string) => {
      console.log("piece: not played, the motion designer writes it", input.postId, key, why);
      layers[index] = { ...layer, motion: unplayedPiece(layer.motion) };
      result.unplayed.push({ index, key, why });
    };
    // Its length within its own: a span a little short still plays, a long one ends at its longest (the montage goes on).
    const span = layer.to - layer.from;
    if (span < piece.seconds[0] * SHORT_ENOUGH) {
      leave(`${span.toFixed(1)} s, plus court que ses ${piece.seconds[0]} s`);
      continue;
    }
    const laid = span > piece.seconds[1] ? { ...layer, to: Math.round((layer.from + piece.seconds[1]) * 100) / 100 } : layer;
    const under = layerShots(input.plan, laid);
    if (under.length < piece.shots[0]) {
      leave(`${under.length} plan(s) dessous, il lui en faut ${piece.shots[0]}`);
      continue;
    }
    const earlier = input.previous?.layers?.find((l) => l.motion.piece?.key === key);
    const fillInput = pieceFillInput({
      piece,
      under: under.map((k) => underOf(input.plan, input.facts, k)),
      brief: layer.motion.brief,
      request: input.request?.slice(0, BRIEF_MAX) || "Un Reel avec ses fichiers.",
      business: { name: input.studio.name, activity: input.studio.business, facts: memoryLines(input.studio.memory) },
      contract: contractLines(input.contract),
      ...(earlier ? { current: pieceWordsOf(piece, earlier.motion) } : {}),
      // Timed on her voice: what she says under it; laying her photos: those of this Reel; what the engine writes itself.
      ...(piece.spoken ? { said: saidUnder(input.plan, input.facts.clips, laid) } : {}),
      ...(piece.photos && input.photos?.length ? { photos: input.photos } : {}),
      ...(facts ? { facts } : {}),
    });
    const schema = pieceFillSchemaFor(piece);
    const fill = async (again?: { answer: PieceFillAnswer; note: string }): Promise<PieceFillAnswer | null> => {
      try {
        const response = await anthropic().beta.messages.parse({
          model: CHAT_MODEL,
          max_tokens: 3000,
          output_config: { effort: "low", format: outputFormat(schema) },
          system: PIECE_FILL_PROMPT,
          messages: [
            { role: "user", content: JSON.stringify(fillInput) },
            ...(again ? [{ role: "assistant" as const, content: JSON.stringify(again.answer) }, { role: "user" as const, content: again.note }] : []),
          ],
        });
        await logClaudeCost(input.studioId, response.usage, "piece_fill", CHAT_MODEL);
        return response.parsed_output ? (readAnswer(schema, response.parsed_output) as PieceFillAnswer) : null;
      } catch (error) {
        console.warn("piece: its filling failed", input.postId, key, error);
        return null;
      }
    };
    // Its layer from an answer, then its check (its words and marks as they will play): its js, or what the check refused.
    const tried = async (answer: PieceFillAnswer): Promise<{ js: string; fonts: string[] } | { error: string } | null> => {
      const read = readPieceFill(piece, answer, { photos: (input.photos ?? []).map((p) => p.id), ...(facts ? { facts } : {}) });
      if (!read) return null;
      layers[index] = { ...laid, motion: pieceMotion({ piece, fill: read, plan: input.plan, layer: laid, bpm: input.plan.tempo ?? 100 }) };
      const motion = layers[index]!.motion;
      // Her photos it lays, as its code gets them (links, cut-outs) in the check too.
      const offered = motion.photos?.length && input.photoOffers ? await input.photoOffers(motion.photos).catch(() => []) : [];
      const asked = input.requestFor(index);
      const request: SceneRequest = {
        ...asked,
        draft: { code: motion.code!, name: piece.name, ...(motion.fonts?.length ? { fonts: motion.fonts } : {}), ...(motion.photos?.length ? { photos: motion.photos } : {}) },
        keep: true,
        texts: motion.texts ?? {},
        ...(offered.length ? { photos: [...(asked.photos ?? []).filter((p) => !offered.some((o) => o.id === p.id)), ...offered] } : {}),
      };
      const [checked] = await designMotionScenes(input.studioId, [request], undefined, input.brand, [], input.context).catch((error: unknown) => [
        { id: request.id, code: null, js: null, error: `le contrôle n'a pas pu tourner : ${error instanceof Error ? error.message : String(error)}` },
      ]);
      return checked?.js ? { js: checked.js, fonts: checked.fonts ?? [] } : { error: checked?.error ?? "le contrôle n'a rien rendu" };
    };
    let answer = await fill();
    if (!answer) {
      leave("son remplissage a échoué");
      continue;
    }
    let outcome = await tried(answer);
    // Refused by the check (her words too long for their place, most often): filled once more with what it said.
    if (outcome && "error" in outcome) {
      console.warn("piece: the check refused it, filled again", input.postId, key, outcome.error.slice(0, 300));
      const again = await fill({
        answer,
        note: `Le contrôle des scènes a refusé cet effet : ${outcome.error.slice(0, 600)} Raccourcis les mots qui débordent (moins de lettres, un mot plus court), sans changer leur sens. Réponds de nouveau en entier.`,
      });
      if (again) {
        answer = again;
        outcome = await tried(again);
      }
    }
    if (!outcome) {
      leave(answer.missing.trim() || "ses plans ne le portent pas");
      continue;
    }
    if ("error" in outcome) {
      leave(`refusé par le contrôle : ${outcome.error.slice(0, 200)}`);
      continue;
    }
    const motion = layers[index]!.motion;
    layers[index] = { ...layers[index]!, motion: { ...motion, js: outcome.js, ...(outcome.fonts.length ? { fonts: outcome.fonts } : {}) } };
    console.log("piece: played", input.postId, key, JSON.stringify(motion.texts));
    result.played.push({ index, key });
  }
  return result;
}
