// Meta-approved templates, required outside the 24 h customer-service window.
// Names and parameter order must match what is registered in WhatsApp Manager.
export const whatsappTemplates = {
  content_request: { category: "utility", params: ["what", "day"] },
  // A Reel started from « Créer », ready while she is away: « Ton Reel est prêt ! Touche le bouton pour le voir, le
  // publier ou demander un changement. » with « Voir mon Reel » to APP_URL/l/{token}. Replaces draft_ready
  // (« Ton {{1}} pour {{2}} est prêt. Je le programme ? »), which Meta moved to Marketing.
  reel_ready: { category: "utility", params: [] },
  // The reminder at the moment she chose (lib/reminders.ts), worded as a reminder of her own post so Meta
  // keeps it Utility (draft_ready, « Je le programme ? », was moved to Marketing and capped):
  // « Rappel : ton {{1}} « {{2}} » est prévu pour maintenant. Tu veux que je le publie ? »
  post_reminder: { category: "utility", params: ["kind", "title"] },
  // The Sunday report with its numbers, so Meta keeps it Utility (weekly_report, « Ton bilan de la semaine est prêt. »
  // with « Voir le bilan », was moved to Marketing): « Ton bilan de la semaine : {{1}}, {{2}} et {{3}}. Le détail
  // est dans l’app, page Résultats. » (weeklySummaryParams)
  weekly_summary: { category: "utility", params: ["posts", "profile_visits", "link_taps"] },
  // « C’est l’heure de publier « {{1}} » ! Ta publication est prête : touche le bouton pour la voir, ou réponds-moi et
  // je te l’envoie ici. » with a « Voir ma publication » button to APP_URL/l/{token} (replaces ready_to_post, no button).
  post_to_share: { category: "utility", params: ["title"] },
  // « Ça fait {{1}} jours sans publication. Envoie-moi les photos ou vidéos que tu as sous la main, je m’occupe du reste. »
  nudge: { category: "utility", params: ["days"] },
  login_code: { category: "authentication", params: ["code"] },
} as const;

export type WhatsAppTemplateName = keyof typeof whatsappTemplates;

const fr = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const counted = (n: number, one: string, many: string) => `${fr(n)} ${n > 1 ? many : one}`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fr(Math.abs(n))}`;

/** The weekly_summary parameters: the week's posts, profile visits and link taps, each with its word. */
export function weeklySummaryParams(week: { posts: number; profileVisits: number | null; linkTaps: number | null }): string[] {
  return [
    counted(week.posts, "publication", "publications"),
    counted(week.profileVisits ?? 0, "visite de ton profil", "visites de ton profil"),
    counted(week.linkTaps ?? 0, "clic sur ton lien", "clics sur ton lien"),
  ];
}

/** Her week from her @ (no connected account) and the week before, as publicWeeks counts them. */
type WeekFigures = { videos: number; views: number | null; net: number | null; followers: number | null };

/**
 * The weekly_summary parameters from her @: the videos she put online, the views her videos gained,
 * her followers gained or lost, each with the week before when it is known (« 3 vidéos publiées (2 la
 * semaine d’avant) »). `fresh` is what this week's videos have so far, while the views history is
 * too short to compare.
 */
export function weeklyPublicParams(week: WeekFigures & { fresh?: number | null }, before: WeekFigures | null): string[] {
  const then = (text: string) => ` (${text} la semaine d’avant)`;
  const videos = (week.videos ? counted(week.videos, "vidéo publiée", "vidéos publiées") : "pas de nouvelle vidéo") + (before ? then(fr(before.videos)) : "");
  let views: string;
  if (week.views !== null) {
    const change = before?.views ? Math.round((week.views / before.views - 1) * 100) : null;
    views =
      counted(week.views, "vue", "vues") +
      (change === null ? (before?.views === 0 ? then("0") : "") : change === 0 ? " (autant que la semaine d’avant)" : ` (${signed(change)}\u202f% sur la semaine d’avant)`);
  } else if (week.videos && week.fresh != null) views = `${counted(week.fresh, "vue", "vues")} sur ${week.videos > 1 ? "ces vidéos" : "cette vidéo"}`;
  else views = "tes vues comparées dès la semaine prochaine";
  const followers =
    week.net === null
      ? week.followers !== null
        ? counted(week.followers, "abonné", "abonnés")
        : "tes abonnés suivis dès cette semaine"
      : (week.net > 0 ? counted(week.net, "nouvel abonné", "nouveaux abonnés") : week.net < 0 ? counted(-week.net, "abonné en moins", "abonnés en moins") : "autant d’abonnés") +
        (before?.net != null ? then(signed(before.net)) : "");
  return [videos, views, followers];
}

const sentence = (text: string) => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** Her answers to the week's idea, under the Sunday report. */
export const WEEKLY_IDEA_OPTIONS = ["Oui, prépare-la", "Pas cette semaine"];

/**
 * The Sunday report as Edith writes it on WhatsApp (and in the app): the week's figures, the
 * analyst's warm summary, the lesson that matters most and one idea she can say yes to. No
 * « see the app »: on her phone, WhatsApp is the app.
 */
export function weeklyReportText(report: { figures: string[]; summary: string; lesson?: string; idea?: string }): string {
  const [a, b, c] = report.figures;
  return [
    `Ton bilan de la semaine : ${a}, ${b} et ${c}.`,
    sentence(report.summary),
    ...(report.lesson ? [`Ce que je retiens : ${sentence(report.lesson)}`] : []),
    ...(report.idea ? [`Mon idée pour cette semaine : ${sentence(report.idea)} Je te la prépare ?`] : []),
  ].join("\n\n");
}

export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Free-form replies are only allowed within 24 h of the manager's last message. */
export function isInSessionWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < WHATSAPP_SESSION_WINDOW_MS;
}
