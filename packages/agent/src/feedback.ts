// What people say of Edith and the app (Tristan: « les feedbacks des users doivent être rangés quelque
// part »): its kinds, and the team's short morning message. Pure, for the tool, the admin page and the cron.

export const FEEDBACK_KINDS = ["bug", "decu", "idee", "compliment", "frustration", "plan"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** The kinds Edith keeps herself (log_feedback); the others come without a turn. */
export const EDITH_FEEDBACK_KINDS = ["bug", "decu", "idee", "compliment"] as const;

export const FEEDBACK_LABELS: Record<FeedbackKind, { one: string; many: string }> = {
  bug: { one: "bug", many: "bugs" },
  decu: { one: "déception", many: "déceptions" },
  idee: { one: "idée", many: "idées" },
  compliment: { one: "compliment", many: "compliments" },
  frustration: { one: "message énervé", many: "messages énervés" },
  plan: { one: "plan à changer", many: "plans à changer" },
};

/** Shown in the morning message, at most. */
const DIGEST_LINES = 3;

/**
 * The team's morning message: how many came yesterday, by kind, then the first few in their words
 * (short: on his phone, the admin page does not open). Null when there were none.
 */
export function feedbackDigest(rows: { kind: FeedbackKind; words: string; studio: string }[]): string | null {
  if (!rows.length) return null;
  const counts = FEEDBACK_KINDS.flatMap((kind) => {
    const n = rows.filter((r) => r.kind === kind).length;
    return n ? [`${n} ${n > 1 ? FEEDBACK_LABELS[kind].many : FEEDBACK_LABELS[kind].one}`] : [];
  });
  const list = counts.length > 1 ? `${counts.slice(0, -1).join(", ")} et ${counts.at(-1)}` : counts[0]!;
  const lines = rows.slice(0, DIGEST_LINES).map((r) => {
    const words = r.words.replace(/\s+/g, " ").trim();
    return `• ${r.studio} : « ${words.length > 90 ? `${words.slice(0, 89).trimEnd()}…` : words} »`;
  });
  const more = rows.length > DIGEST_LINES ? ["Le reste dans Admin, sur ordinateur."] : [];
  return [`${rows.length} retour${rows.length > 1 ? "s" : ""} hier : ${list}.`, ...lines, ...more].join("\n");
}
