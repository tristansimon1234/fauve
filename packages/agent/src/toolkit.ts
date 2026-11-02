import { z } from "zod";
import { motionSlotSchema } from "./motion-scene.ts";

// Edith's own tools (Tristan: « est-ce que notre système peut créer ses propres outils au fur et à mesure des
// demandes ? », « j'aimerais un système plus autonome », « est-ce possible qu'il mette à jour un outil ? »).
// The code does what it knows; what it does not is noted (a gap). A gap that comes back becomes a tool: made
// generic by an agent, proven on several charters, tried on real requests, promoted, updated or retired on what
// happens to them, without anyone's click; the team is told each week and keeps a switch. Pure parts here; the
// tables (capability_gaps, tools, tool_versions, tool_uses, tool_settings) are read in apps/web/src/lib/toolkit.ts.

/** Where a gap was seen: the copy remade by code, the effects workshop it needed, the editor, the chat. */
export const GAP_SOURCES = ["copy", "effects", "editor", "chat"] as const;
export type GapSource = (typeof GAP_SOURCES)[number];

export const TOOL_KINDS = ["scene", "layer", "carousel", "effect"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const TOOL_STATUSES = ["trial", "active", "retired"] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

/** A gap's words, kept short and plain (grouped by them). */
export function gapLabel(raw: string): string {
  const label = raw.replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");
  return label.length > 120 ? `${label.slice(0, 119).replace(/\s+\S*$/, "")}…` : label;
}

/** The same gap in other words: case, accents, punctuation and small words aside. */
export function gapKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .filter((w) => w && !SMALL_WORDS.has(w))
    .join(" ");
}
const SMALL_WORDS = new Set(["un", "une", "le", "la", "les", "des", "de", "du", "d", "l", "a", "au", "aux", "en", "et", "sur", "avec", "pour", "the", "an", "of", "on", "with"]);

/** The gaps grouped by what was missing, the most frequent first (its first words kept, its sources). */
export function groupGaps(gaps: { label: string; source: GapSource }[]): { label: string; count: number; sources: GapSource[] }[] {
  const groups = new Map<string, { label: string; count: number; sources: Set<GapSource> }>();
  for (const gap of gaps) {
    const key = gapKey(gap.label);
    if (!key) continue;
    const group = groups.get(key) ?? { label: gapLabel(gap.label), count: 0, sources: new Set<GapSource>() };
    group.count++;
    group.sources.add(gap.source);
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({ label: g.label, count: g.count, sources: [...g.sources] })).sort((a, b) => b.count - a.count);
}

const SOURCE_WORDS: Record<GapSource, string> = { copy: "recopie", effects: "atelier", editor: "monteur", chat: "chat" };
/** The most gaps the weekly message lists. */
const DIGEST_GAPS = 6;

/** What the week's message says of the tools: counts, and how their making stands. */
export type ToolsWeek = {
  gaps: { label: string; source: GapSource }[];
  /** Tools by status now, and what happened to them these 7 days. */
  tools: { trial: number; active: number; made: number; promoted: number; updated: number; retired: number };
  autonomy: boolean;
  budgetEur: number;
  /** What making and proving tools cost these 7 days. */
  spentEur: number;
};

/** The team's weekly message on the tools (French, short lines for WhatsApp), or null when there is nothing to say. */
export function toolsDigest(week: ToolsWeek): string | null {
  const { tools } = week;
  const moved = tools.made + tools.promoted + tools.updated + tools.retired;
  if (!week.gaps.length && !moved && !tools.trial && !tools.active) return null;
  const euros = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n)} €`;
  const lines = ["Les outils d'Edith, ces 7 jours"];
  if (week.gaps.length) {
    const groups = groupGaps(week.gaps);
    lines.push("", `Ce que le code ne savait pas faire (${week.gaps.length} demande${week.gaps.length > 1 ? "s" : ""}) :`);
    for (const g of groups.slice(0, DIGEST_GAPS)) lines.push(`• ${g.label}${g.count > 1 ? ` ×${g.count}` : ""} (${g.sources.map((s) => SOURCE_WORDS[s]).join(", ")})`);
    if (groups.length > DIGEST_GAPS) lines.push(`• et ${groups.length - DIGEST_GAPS} autre${groups.length - DIGEST_GAPS > 1 ? "s" : ""}`);
  }
  lines.push(
    "",
    tools.trial || tools.active || moved
      ? `Outils : ${tools.active} actif${tools.active > 1 ? "s" : ""}, ${tools.trial} à l'essai. Cette semaine : ${tools.made} fabriqué${tools.made > 1 ? "s" : ""}, ${tools.promoted} promu${tools.promoted > 1 ? "s" : ""}, ${tools.updated} mis à jour, ${tools.retired} retiré${tools.retired > 1 ? "s" : ""}.`
      : "Aucun outil encore : ces manques serviront à fabriquer les premiers.",
    week.autonomy
      ? `Fabrication automatique : en marche, ${euros(week.spentEur)} dépensés sur ${euros(week.budgetEur)} par semaine.`
      : "Fabrication automatique : coupée.",
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------------------------
// Step 2: an animation the motion designer wrote and she kept becomes a tool. An agent makes it generic, it is
// proven on several charters and text lengths, then tried on real Reels (the editor reuses it from the shared
// library like any scene), and promoted or retired on what happens to it, without anyone's click.
// ---------------------------------------------------------------------------------------------------------------

/** A tool on trial is judged after this many good uses. */
export const TRIAL_USES = 5;
/** Corrected in more than this share of its settled uses (3 at least): retired. */
export const MAX_CORRECTED = 0.4;
/** A use is settled this long after its Reel (kept if still in it, corrected if gone), or as soon as it is published. */
export const SETTLE_HOURS = 48;
/** An active tool is judged on its latest uses. */
export const ACTIVE_WINDOW = 10;

export type ToolOutcome = "kept" | "published" | "corrected" | "failed";
export type ToolStats = Record<ToolOutcome, number>;

/** What becomes of a tool: promoted (trial to active), retired, or it stays as it is. */
export function toolVerdict(status: "trial" | "active", stats: ToolStats): "promote" | "retire" | "stay" {
  const good = stats.kept + stats.published;
  const settled = good + stats.corrected + stats.failed;
  if (status === "trial" && stats.failed > 0) return "retire";
  if (settled >= 3 && (stats.corrected + stats.failed) / settled > MAX_CORRECTED) return "retire";
  if (status === "trial" && good >= TRIAL_USES && stats.corrected / settled <= 0.2) return "promote";
  return "stay";
}

/** What a use came to: published, still in its Reel after SETTLE_HOURS (kept), or gone from it (corrected); null while it waits. */
export function settledOutcome(use: { ageHours: number; published: boolean; stillUsed: boolean }): Exclude<ToolOutcome, "failed"> | null {
  if (use.published) return "published";
  if (use.ageHours < SETTLE_HOURS) return null;
  return use.stillUsed ? "kept" : "corrected";
}

/** The charters a tool is proven on: three businesses unlike each other (a serif and warm, a grotesque and cold, a script and pale). */
export const PROOF_CHARTERS = [
  { name: "Maison Lune", accent: "#c2410c", accentInk: "#ffffff", displayFont: "Fraunces", bodyFont: "Inter Tight", logoUrl: null },
  { name: "Atelier Nord", accent: "#1d4ed8", accentInk: "#ffffff", displayFont: "Bricolage Grotesque", bodyFont: "Inter Tight", logoUrl: null },
  { name: "Café Rosa", accent: "#f9a8d4", accentInk: "#1c1530", displayFont: "Instrument Serif", bodyFont: "Space Mono", logoUrl: null },
] as const;

/** Its proof: one test per charter, the short texts on one and the long ones on the others (the longest is where it breaks). */
export function proofVariants(samples: { slot: string; short: string; long: string }[]): { charter: (typeof PROOF_CHARTERS)[number]; texts: Record<string, string>; label: string }[] {
  return PROOF_CHARTERS.map((charter, i) => ({
    charter,
    label: `${charter.name}, textes ${i === 0 ? "courts" : "longs"}`,
    texts: Object.fromEntries(samples.map((s) => [s.slot, i === 0 ? s.short : s.long])),
  }));
}

export const toolMakerSchema = z.object({
  generic: z.boolean().describe("true when the idea serves other businesses dressed in their own charter; false when it only makes sense for this business or this Reel"),
  why: z.string().describe("One sentence: why it is generic or not"),
  key: z.string().describe("A snake_case English name for the tool, e.g. word_search_reveal"),
  name: z.string().describe("A short French name she reads, e.g. « Mots entourés dans une grille »"),
  what: z.string().describe("One French sentence: what it shows"),
  when: z.string().describe("One English sentence for the editor: the moment of a Reel this animation serves"),
  code: z.string().describe("The generic TSX of function Scene, as the motion designer writes it"),
  slots: z.array(motionSlotSchema),
  samples: z.array(z.object({ slot: z.string(), short: z.string(), long: z.string() })).describe("For each slot, a short and a long French text (at its max_chars), realistic for a café, a salon, a shop"),
  fonts: z.array(z.string()).describe("Google Fonts families its code brings besides the brand's two (usually empty)"),
});
export type ToolMade = z.infer<typeof toolMakerSchema>;

/** The tool maker's own instructions, after the motion designer's base (the code contract stays the same). */
export const TOOL_MAKER_PROMPT = `You now turn one animation you wrote for a business's Reel, which she kept or published, into a tool any business can use: the same idea, motion, timing and quality, made generic.
- Every word it shows comes from a slot (texts.<slot>), never written in the code; each slot says its role and the most characters it holds. It must stay right from the shortest to the longest text: fit, wrap or scale, never cut, never overflow, never too small to read on a phone.
- Its colours come from brand (brand.accent, brand.accentInk, brand.palette when present) and its type from brand.displayFont and brand.bodyFont, never this business's colour codes or font names, unless a colour is the idea itself (white on a dark veil). A font the idea needs (a hand-written one for a hand-drawn idea) stays, named in fonts.
- Keep the idea and what made it good; remove what belonged to this business: its name, its logo as the idea, its photos, its facts.
- generic is false when the idea only makes sense for this business or this Reel (its own story, its interface): then answer the rest empty.
- samples: for each slot, a short French text and a long one at its max_chars, realistic for a café, a hair salon, a shop.
- name in French for her, what in French, when in English for the editor who chooses it (the moment of a Reel it serves, never its look).
When you are told its test renders failed, fix exactly that and keep the idea.`;
