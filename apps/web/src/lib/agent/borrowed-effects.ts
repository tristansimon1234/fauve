import "server-only";
import { borrowedEffects, HOUSE_MODELS, houseEffectLine, houseEffectsForEditor, isMotionSegment, type EditPlan, type FollowedStyle } from "@fauve/agent";
import { HOUSE_EXAMPLES } from "@fauve/agent/house-examples";
import { skillFor } from "@fauve/agent/skills";
import type { skillGate } from "@/lib/skill-reviews";
import type { SceneRequest } from "./motion-designer";

// The signature effects of Edith's models lent to a Reel made in none of them (packages/agent/src/house-effects.ts;
// Tristan: « il faut capitaliser sur ce qu'on sait faire au lieu de réinventer »): the editor gets their lines and
// borrows one or two (« [borrow: <key>] » in an animation's brief), and the motion designer that model's code as its
// base. A test for now, as the director is: on the lab's studios and the team's only, until Tristan has judged its bench.

/** A model lent: its key and name, its effect's line, and the code the motion designer starts from. */
export type LentEffect = NonNullable<SceneRequest["borrowed"]>[number];

/** What a Reel in none of Edith's models may borrow: the editor's input, and each model lent with its code. */
export type Lending = { input: { rule: string; effets: string[] }; lent: Map<string, LentEffect> };

/**
 * The effects lent to this Reel, or null: a Reel in none of Edith's models (made freely, the lab's free=1 or a pick that
 * found none; or one she copies, a Reel she sent or one of hers kept, that no model plays), on a studio of the lab or the
 * team's; never when the job says no (the lab's effects=0: the chain as before, to compare on the same videos), nor in
 * the director's look at the Reel it made. Each model lends the code this studio plays: its montage skill (skillGate),
 * else its reference composition (house-examples.ts), as a model she chose gives its own.
 */
export function lendingFor(input: {
  studio: { team?: unknown; website_url?: unknown } | null | undefined;
  followed: Pick<FollowedStyle, "house"> | undefined;
  gate: Awaited<ReturnType<typeof skillGate>>;
  effects?: boolean;
  director?: boolean;
}): Lending | null {
  const trial = Boolean(input.studio?.team) || String(input.studio?.website_url ?? "").startsWith("lab://");
  if (!trial || input.effects === false || input.director || input.followed?.house) return null;
  const lent = new Map(
    HOUSE_MODELS.flatMap((m): [string, LentEffect][] => {
      const code = input.gate(skillFor(m.key))?.code ?? (m.example ? HOUSE_EXAMPLES[m.example]?.code : undefined);
      const effect = houseEffectLine(m.key);
      return code && effect ? [[m.key, { key: m.key, name: m.name, effect, code }]] : [];
    }),
  );
  const offered = houseEffectsForEditor(lent.keys(), { copy: Boolean(input.followed) });
  return offered ? { input: offered, lent } : null;
}

/**
 * Each animation to write whose brief borrows a model lent gets that model's code as its base (SceneRequest.borrowed):
 * two models at most over the Reel, counted on all its animations in order (one kept by a correction included).
 */
export function lendEffects(requests: SceneRequest[], plan: Pick<EditPlan, "segments" | "layers">, lending: Lending | null): void {
  if (!lending || !requests.length) return;
  const briefs = [...plan.segments.flatMap((s) => (isMotionSegment(s) ? [s.motion.brief] : [])), ...(plan.layers ?? []).map((l) => l.motion.brief)];
  const borrowed = borrowedEffects(briefs, lending.lent.keys());
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
