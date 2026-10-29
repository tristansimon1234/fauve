import { isClipSegment, isMotionSegment, segmentSeconds, type EditPlan } from "./schemas.ts";
import { EFFECT_LABELS } from "./looks.ts";

// Her own Reels as models (Tristan : « ça serait bien de pouvoir enregistrer des modèles pour
// le user aussi ? »): a Reel of hers she likes is kept as a model, and a new Reel made « comme
// mon Reel » redoes its rhythm, its texts and its way of doing with her new images. It goes the
// way of a Reel she copies (« Steal »: its video read once, its look over her charter for that
// Reel), never one shot: a model stays until she removes it. Its plan is known, so the editor
// also gets its structure, exactly: how many shots and how long, which texts when, its animations.

/** The longest structure kept on a model. */
export const OUTLINE_CHARS = 600;

const seconds = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const TEXT_ROLES: Record<EditPlan["texts"][number]["style"], string> = { hook: "accroche", band: "bandeau", caption: "légende" };

/**
 * A plan's structure in one line, for the editor redoing it with other images: its length,
 * its shots (how many, the first, the average), its texts (role, when, how many words; a
 * list is a key message), its animations, its voice, its effect, its end card. Never its words.
 */
export function planOutline(plan: EditPlan): string {
  const lengths = plan.segments.map(segmentSeconds);
  const first = lengths[0] ?? 0;
  const average = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const photos = plan.segments.filter((s) => isClipSegment(s) && s.photo).length;
  const animations = plan.segments.filter(isMotionSegment).length + (plan.layers ?? []).filter((l) => !l.compose).length;
  const composed = (plan.layers ?? []).some((l) => l.compose) || plan.template === "collage";
  const texts = [...plan.texts]
    .sort((a, b) => a.from - b.from)
    .map((t) => `${t.items?.length ? "message clé" : TEXT_ROLES[t.style]} de ${seconds(t.from)} à ${seconds(t.to)} s (${words(t.text)} mots${t.items?.length ? `, ${t.items.length} lignes de détail` : ""})`);
  const parts = [
    `${seconds(plan.duration)} s, ${plan.segments.length} plan${plan.segments.length > 1 ? "s" : ""}${photos ? ` dont ${photos} photo${photos > 1 ? "s" : ""}` : ""}, le premier de ${seconds(first)} s, ${seconds(average)} s en moyenne${plan.tempo ? `, à ${Math.round(plan.tempo)} BPM` : ""}`,
    texts.length ? `textes : ${texts.join(", ")}` : "aucun texte posé",
    ...(composed ? ["tout le Reel en collage"] : []),
    ...(animations ? [`${animations} animation${animations > 1 ? "s" : ""}`] : []),
    ...(plan.voice ? [`une voix sur tout le Reel${plan.subtitles ? ", sous-titrée" : ""}`] : []),
    ...(plan.effect === "dust" ? ["une poussière de pellicule"] : plan.effect ? [`le look ${EFFECT_LABELS[plan.effect].label.toLowerCase()}`] : []),
    ...(plan.end_card ? ["un écran de fin"] : []),
  ];
  const line = parts.join(" ; ");
  return line.length <= OUTLINE_CHARS ? line : `${line.slice(0, OUTLINE_CHARS - 1).replace(/[\s,;]+\S*$/, "")}…`;
}
