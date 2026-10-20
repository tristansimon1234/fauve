import type { PostStatus } from "./schemas.ts";

// planned → content_requested → media_received → draft → validated → scheduled → published → measured
// (+ skipped, failed). The status drives reminders.
const transitions: Record<PostStatus, readonly PostStatus[]> = {
  planned: ["content_requested", "media_received", "draft", "skipped"],
  content_requested: ["media_received", "draft", "skipped"],
  media_received: ["draft", "skipped", "failed"],
  draft: ["draft", "validated", "media_received", "skipped", "failed"],
  validated: ["scheduled", "draft", "skipped"],
  scheduled: ["published", "validated", "draft", "failed"],
  published: ["measured"],
  measured: ["measured"],
  skipped: ["planned"],
  failed: ["draft", "scheduled", "skipped"],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: PostStatus, to: PostStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid post status transition: ${from} → ${to}`);
  }
}

/** A post is missing content when it is due soon and has no media yet. */
export function needsContent(status: PostStatus): boolean {
  return status === "planned" || status === "content_requested";
}

/** UI label + tone used by the calendar pills. */
export const statusLabels: Record<PostStatus, { label: string; tone: "done" | "ok" | "todo" | "wait" | "plan" | "error" }> = {
  planned: { label: "Prévu", tone: "plan" },
  content_requested: { label: "Média attendu", tone: "wait" },
  media_received: { label: "Média reçu", tone: "plan" },
  draft: { label: "À valider", tone: "todo" },
  validated: { label: "Validé", tone: "ok" },
  scheduled: { label: "En train de partir", tone: "ok" },
  published: { label: "Publié", tone: "done" },
  measured: { label: "Publié", tone: "done" },
  skipped: { label: "Annulé", tone: "plan" },
  failed: { label: "Échec", tone: "error" },
};

/** What a post's format still lacks before it can go out (null: ready). One check for Simone's schedule_post and the « Valider » of its page. */
export type MissingContent = "montage" | "photo" | "photos" | "media";
export function missingContent(kind: "reel" | "post" | "carousel" | "story", hasRender: boolean, media: number): MissingContent | null {
  if (kind === "reel" && !hasRender) return "montage";
  if (kind === "post" && media < 1) return "photo";
  if (kind === "carousel" && media < 2) return "photos";
  if (kind === "story" && !hasRender && media < 1) return "media";
  return null;
}
