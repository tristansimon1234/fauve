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

const counted = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** The weekly_summary parameters: the week's posts, profile visits and link taps, each with its word. */
export function weeklySummaryParams(week: { posts: number; profileVisits: number | null; linkTaps: number | null }): string[] {
  return [
    counted(week.posts, "publication", "publications"),
    counted(week.profileVisits ?? 0, "visite de ton profil", "visites de ton profil"),
    counted(week.linkTaps ?? 0, "clic sur ton lien", "clics sur ton lien"),
  ];
}

export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Free-form replies are only allowed within 24 h of the manager's last message. */
export function isInSessionWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < WHATSAPP_SESSION_WINDOW_MS;
}
