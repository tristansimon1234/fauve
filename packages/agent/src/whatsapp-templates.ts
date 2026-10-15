// Meta-approved templates, required outside the 24 h customer-service window.
// Names and parameter order must match what is registered in WhatsApp Manager.
export const whatsappTemplates = {
  content_request: { category: "utility", params: ["what", "day"] },
  draft_ready: { category: "utility", params: ["kind", "day"] },
  weekly_report: { category: "utility", params: [] },
  // « C’est l’heure de publier « {{1}} » ! Réponds-moi et je t’envoie la vidéo et la légende. »
  ready_to_post: { category: "utility", params: ["title"] },
  // « Ta semaine est prête : {{1}} publications prévues. On la regarde ensemble ? »
  week_ready: { category: "utility", params: ["count"] },
  login_code: { category: "authentication", params: ["code"] },
} as const;

export type WhatsAppTemplateName = keyof typeof whatsappTemplates;

export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Free-form replies are only allowed within 24 h of the manager's last message. */
export function isInSessionWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < WHATSAPP_SESSION_WINDOW_MS;
}
