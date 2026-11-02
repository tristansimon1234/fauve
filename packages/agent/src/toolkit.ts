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
