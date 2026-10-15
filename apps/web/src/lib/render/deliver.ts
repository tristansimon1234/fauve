import "server-only";
import { CREDIT_PRICES, STYLE_CHECK_OPTIONS } from "@fauve/agent";
import { createLoginLink } from "@/lib/auth/login-link";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isFirstReel } from "@/lib/onboarding";
import { sendImage, sendReply, sendText } from "@/lib/whatsapp/client";
import { renderPost } from "./render-post";
import { renderSlides } from "./slides";

export type DeliveryTarget = {
  studioId: string;
  postId: string;
  /** WhatsApp id of the manager; absent for the web test chat. */
  waId?: string;
  /** Inbound message this answers (keeps the conversation history in order). */
  replyTo?: string;
  /** The editor's one-line explanation, shown with the video. */
  rationale?: string;
  /** What the review did (Soigné, Max): its own paragraph under the explanation. */
  care?: string;
  /** What Fauve says about this version, kept on the post for the Publication page and /v. */
  note?: string;
  /** Offers a variant at the end (not after Max, which already compared two versions). */
  offerVariant?: boolean;
  /** A new piece of music rather than the one kept for this cut. */
  freshMusic?: boolean;
};

function store(target: DeliveryTarget, fields: { wa_message_id?: string; type: string; body: string; payload?: Record<string, unknown>; media_id?: string }) {
  return supabaseAdmin()
    .from("whatsapp_messages")
    .insert({
      studio_id: target.studioId,
      channel: target.waId ? "whatsapp" : "web",
      direction: "outbound",
      phone_e164: target.waId ? `+${target.waId}` : null,
      ...fields,
      payload: { reply_to: target.replyTo, ...fields.payload },
    });
}

/** Tells the manager something went wrong, on the channel she uses. */
export async function notifyFailure(target: DeliveryTarget, text: string, detail: unknown) {
  const id = target.waId ? await sendText(target.waId, text).catch(() => undefined) : undefined;
  await store(target, { wa_message_id: id, type: "text", body: text, payload: { error: String(detail).slice(0, 500) } });
}

/** A message to the manager on the channel she uses, with a link to a page of the app (signed in, on WhatsApp). */
export async function notifyStudio(target: Pick<DeliveryTarget, "studioId" | "waId" | "replyTo">, text: string, link?: { path: string; label: string }) {
  const full = { ...target, postId: "" };
  if (target.waId) {
    const url = link ? await createLoginLink(`+${target.waId}`, link.path, "open_post") : null;
    const id = await sendText(target.waId, url ? `${text}\n\n${link!.label} : ${url}` : text);
    await store(full, { wa_message_id: id, type: "text", body: text, payload: link ? { open_path: link.path } : {} });
  } else {
    await store(full, { type: "text", body: link ? `${text}\n\n${link.label} : ${env("APP_URL")}${link.path}` : text, payload: link ? { open_path: link.path } : {} });
  }
}

/**
 * Renders the post and points the manager to it, to watch the video, read the
 * caption and validate. On WhatsApp: a sign-in link to the mobile page `/v/{id}`;
 * in the app: the post's card (and the app opens the publication page).
 * Returns what was delivered, or null if it failed (the manager is told).
 */
export async function renderAndDeliver(target: DeliveryTarget): Promise<{ title: string } | null> {
  try {
    const r = await renderPost(target.studioId, target.postId, { freshMusic: target.freshMusic });
    await deliverMontage(target, r);
    return { title: r.title };
  } catch (error) {
    console.error("render failed", target.postId, error);
    await notifyFailure(target, "Le montage n’a pas abouti cette fois, je regarde ce qui coince. Tu veux que je réessaie ? Aucun crédit n’a été débité.", error);
    return null;
  }
}

/** Points the manager to a rendered montage: a sign-in link to its page on WhatsApp, its card in the app. */
export async function deliverMontage(target: DeliveryTarget, r: { title: string; durationMs: number }): Promise<void> {
  // Reels last 7 to 30 s: whole seconds, and nothing when the render did not say.
  const seconds = Math.round(r.durationMs / 1000);
  // On a phone: the one-action page (watch, validate, move a text).
  const page = `/v/${target.postId}`;
  // Her first Reel: « Ça te ressemble ? », her style is tuned on her own video (restyle_reel).
  const styleCheck = await isFirstReel(target.studioId, target.postId);
  // Short paragraphs, the link right under the first line: it is the one action.
  const intro = `Ton montage « ${r.title} » est prêt 🎬${seconds ? ` (${seconds} s)` : ""}.`;
  const notes = [target.rationale, target.care].filter(Boolean).join("\n\n");
  const after = [
    styleCheck ? "Ça te ressemble ? Dis-moi si tu le veux plus chaleureux, plus sobre, plus pêchu ou autrement : je retiens ton style pour tous les prochains." : "Valide-le sur sa page, ou dis-moi ce que tu veux changer.",
    target.offerVariant === false || styleCheck
      ? ""
      : `Je peux aussi te faire une variante (autre style, autre accroche) pour ${CREDIT_PRICES.variant} crédit${CREDIT_PRICES.variant > 1 ? "s" : ""}.`,
  ]
    .filter(Boolean)
    .join(" ");
  const payload = { posts: [target.postId], open_post: target.postId, ...(styleCheck ? { options: STYLE_CHECK_OPTIONS } : {}) };
  if (target.note) {
    const { error } = await supabaseAdmin().from("posts").update({ agent_note: target.note.slice(0, 600) }).eq("id", target.postId).eq("studio_id", target.studioId);
    if (error) console.warn("delivery: note not kept", error.message);
  }
  // Stored without the one-time link (Fauve's history must not reuse it).
  const stored = [intro, notes, after].filter(Boolean).join("\n\n");
  if (target.waId) {
    const link = await createLoginLink(`+${target.waId}`, page, "open_post");
    const message = [`${intro}\nRegarde-le ici : ${link}`, notes, after].filter(Boolean).join("\n\n");
    const id = styleCheck ? await sendReply(target.waId, message, STYLE_CHECK_OPTIONS) : await sendText(target.waId, message);
    await store(target, { wa_message_id: id, type: "text", body: stored, payload });
  } else {
    await store(target, { type: "text", body: stored, payload });
  }
}

/**
 * Shows images Simone made (improved photo, ambiance images): each one in the
 * conversation (an image on WhatsApp), the text on the first; with a post, its
 * card (and on WhatsApp, a link to its page) after them.
 */
export async function deliverImages(
  target: Pick<DeliveryTarget, "studioId" | "waId" | "replyTo"> & { postId?: string },
  images: { mediaId: string; path: string }[],
  text: string,
): Promise<void> {
  const db = supabaseAdmin();
  const full = { ...target, postId: target.postId ?? "" };
  for (const [i, image] of images.entries()) {
    const body = i === 0 ? text : "";
    let id: string | undefined;
    if (target.waId) {
      const signed = await db.storage.from("media").createSignedUrl(image.path, 3600);
      if (signed.data) id = await sendImage(target.waId, signed.data.signedUrl, body || undefined).catch(() => undefined);
    }
    // The image itself shows in the app's conversation (media_id).
    await store(full, { wa_message_id: id, type: "image", body, media_id: image.mediaId });
  }
  if (!target.postId) return;
  const after =
    images.length > 1
      ? "Elles sont sur ta publication : regarde, et dis-moi si tu en veux d’autres ou quel texte poser dessus."
      : "Elle est sur ta publication : regarde, et dis-moi si tu veux autre chose.";
  const payload = { posts: [target.postId], open_post: target.postId };
  if (target.waId) {
    const link = await createLoginLink(`+${target.waId}`, `/v/${target.postId}`, "open_post");
    const id = await sendText(target.waId, `${after}\n\nRegarde ici : ${link}`);
    await store(full, { wa_message_id: id, type: "text", body: after, payload });
  } else {
    await store(full, { type: "text", body: after, payload });
  }
}

/** Renders the text over a carousel's photos, then points the manager to the post, like a montage. */
export async function renderSlidesAndDeliver(target: DeliveryTarget): Promise<boolean> {
  try {
    await renderSlides(target.studioId, target.postId);
    const { data: post } = await supabaseAdmin().from("posts").select("title, kind").eq("id", target.postId).single();
    const what = post?.kind === "carousel" ? "ton carrousel" : "ta photo";
    const intro = `Le texte est posé sur ${what} « ${(post?.title as string | null) ?? ""} » ✨`;
    const after = "Fais défiler pour tout voir. Tu peux déplacer ou corriger chaque texte du doigt, puis valider.";
    const payload = { posts: [target.postId], open_post: target.postId };
    if (target.waId) {
      const link = await createLoginLink(`+${target.waId}`, `/v/${target.postId}`, "open_post");
      const id = await sendText(target.waId, `${intro}\n\nRegarde ici : ${link}\n\n${after}`);
      await store(target, { wa_message_id: id, type: "text", body: `${intro}\n\n${after}`, payload });
    } else {
      await store(target, { type: "text", body: `${intro}\n\n${after}`, payload });
    }
    return true;
  } catch (error) {
    console.error("slides render failed", target.postId, error);
    await notifyFailure(target, "Le texte sur tes photos n’a pas pu être posé cette fois. Tu veux que je réessaie ?", error);
    return false;
  }
}
