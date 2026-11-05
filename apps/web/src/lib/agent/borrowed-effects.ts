import "server-only";
import {
  borrowedEffects,
  HOUSE_MODELS,
  houseEffectLine,
  houseEffectsForEditor,
  isMotionSegment,
  MAX_BORROWED,
  MAX_PIECES,
  pieceLine,
  piecesForEditor,
  piecesOffered,
  type EditPlan,
  type EffectPiece,
  type FollowedStyle,
  type PieceShot,
} from "@fauve/agent";
import { HOUSE_EXAMPLES } from "@fauve/agent/house-examples";
import { EFFECT_PIECES } from "@fauve/agent/pieces";
import { skillFor } from "@fauve/agent/skills";
import type { skillGate } from "@/lib/skill-reviews";
import type { SceneRequest } from "./motion-designer";

// The signature effects of Edith's models lent to a Reel made in none of them (packages/agent/src/house-effects.ts;
// Tristan: « il faut capitaliser sur ce qu'on sait faire au lieu de réinventer »). Made freely, the Reel is offered the
// ready-to-play effects of the bank its files can carry (pieces.ts, 5 at most): the editor lays one, its words are
// written by a small call and the engine plays its code as it is (lib/agent/pieces.ts), no motion designer. A Reel she
// copies is offered every model's line, and the motion designer gets the code of the one its brief names as its base
// (« [borrow: <key>] »). A test for now, as the director is: on the lab's studios and the team's only, until Tristan has
// judged its bench.

/** A model lent: its key and name, its effect's line, and the code the motion designer starts from. */
export type LentEffect = NonNullable<SceneRequest["borrowed"]>[number];

/**
 * What a Reel in none of Edith's models may borrow: the editor's input, each model lent with its code, and, made freely,
 * the bank's effects offered (played as they are; the motion designer starts from a piece's code only when it cannot play).
 */
export type Lending = { input: { rule: string; effets: string[] }; lent: Map<string, LentEffect>; pieces?: Map<string, EffectPiece>; most: number };

/**
 * The effects lent to this Reel, or null: a Reel in none of Edith's models (made freely, the lab's free=1 or a pick that
 * found none; or one she copies, a Reel she sent or one of hers kept, that no model plays), on a studio of the lab or the
 * team's; never when the job says no (the lab's effects=0: the chain as before, to compare on the same videos), nor in
 * the director's look at the Reel it made. Made freely: the bank's effects her files can carry (`shots`, `files`), one
 * per Reel; none that fits, nothing lent. A copy: each model's code this studio plays (its montage skill, skillGate, else
 * its reference composition, house-examples.ts), two at most.
 */
export function lendingFor(input: {
  studio: { team?: unknown; website_url?: unknown } | null | undefined;
  followed: Pick<FollowedStyle, "house"> | undefined;
  gate: Awaited<ReturnType<typeof skillGate>>;
  effects?: boolean;
  director?: boolean;
  /** Her shots as the bank weighs them (pieceShots), and her distinct files: what the bank's effects need. */
  shots?: PieceShot[];
  files?: number;
}): Lending | null {
  const trial = Boolean(input.studio?.team) || String(input.studio?.website_url ?? "").startsWith("lab://");
  if (!trial || input.effects === false || input.director || input.followed?.house) return null;
  if (!input.followed) {
    const offered = piecesOffered(Object.values(EFFECT_PIECES), input.shots ?? [], input.files ?? 0);
    const given = piecesForEditor(offered);
    if (!given) return null;
    const lent = new Map(offered.map((p): [string, LentEffect] => [p.key, { key: p.key, name: p.name, effect: pieceLine(p), code: p.code }]));
    return { input: given, lent, pieces: new Map(offered.map((p) => [p.key, p])), most: MAX_PIECES };
  }
  const lent = new Map(
    HOUSE_MODELS.flatMap((m): [string, LentEffect][] => {
      const code = input.gate(skillFor(m.key))?.code ?? (m.example ? HOUSE_EXAMPLES[m.example]?.code : undefined);
      const effect = houseEffectLine(m.key);
      return code && effect ? [[m.key, { key: m.key, name: m.name, effect, code }]] : [];
    }),
  );
  const offered = houseEffectsForEditor(lent.keys(), { copy: true });
  return offered ? { input: offered, lent, most: MAX_BORROWED } : null;
}

/**
 * Each animation to write whose brief borrows a model lent gets that model's code as its base (SceneRequest.borrowed):
 * `lending.most` models at most over the Reel, counted on all its animations in order (one kept by a correction included).
 */
export function lendEffects(requests: SceneRequest[], plan: Pick<EditPlan, "segments" | "layers">, lending: Lending | null): void {
  if (!lending || !requests.length) return;
  const briefs = [...plan.segments.flatMap((s) => (isMotionSegment(s) ? [s.motion.brief] : [])), ...(plan.layers ?? []).map((l) => l.motion.brief)];
  const borrowed = borrowedEffects(briefs, lending.lent.keys(), lending.most);
  const byBrief = new Map(briefs.map((brief, i) => [brief, borrowed[i] ?? []] as const));
  for (const request of requests) {
    const keys = byBrief.get(request.brief) ?? [];
    const lent = keys.flatMap((k) => (lending.lent.has(k) ? [lending.lent.get(k)!] : []));
    if (lent.length) {
      request.borrowed = lent;
      console.log("effects: borrowed", request.id, keys.join(", "));
    }
  }
}
