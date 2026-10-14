import "server-only";
import { captionMatch, isInSessionWindow } from "@fauve/agent";
import { createLoginLink } from "@/lib/auth/login-link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate, sendText, sendVideo } from "@/lib/whatsapp/client";
import { recentMedia, InstagramError } from "./instagram";

// « Je publie moi-même » : at the post's time, Brigitte hands the Reel over on
// WhatsApp (the video, then the caption alone to copy) instead of publishing it,
// so the manager adds Instagram's music and picks its passage in the app. Outside
// the 24 h window a template asks her to answer; the video follows her next
// message. Then the Reel she publishes is found on her account and linked to the
// post, which is measured like the others.

const MATCH_FOR_MS = 7 * 24 * 3600_000;

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

async function ownerPhone(studioId: string): Promise<string | null> {
  const owner = await supabaseAdmin().from("members").select("phone_e164").eq("studio_id", studioId).eq("role", "owner").limit(1).maybeSingle();
  return (owner.data?.phone_e164 as string | undefined) ?? null;
}

async function inWindow(phone: string): Promise<boolean> {
  const last = await supabaseAdmin()
    .from("whatsapp_messages")
    .select("created_at")
    .eq("phone_e164", phone)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return isInSessionWindow(last.data ? new Date(last.data.created_at as string) : null);
}

function fullCaption(post: { caption: string | null; hashtags: string[] | null }): string {
  const hashtags = (post.hashtags ?? []).map((h) => `#${h}`).join(" ");
  return [post.caption ?? "", hashtags].filter(Boolean).join("\n\n");
}

async function store(studioId: string, phone: string | null, id: string | undefined, body: string, payload: Record<string, unknown> = {}) {
  await supabaseAdmin()
    .from("whatsapp_messages")
    .insert({ studio_id: studioId, channel: phone ? "whatsapp" : "web", wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body, payload });
}

/** Sends the video and its caption on WhatsApp (inside the 24 h window). */
async function sendOnWhatsApp(post: { id: string; studio_id: string; title: string; caption: string | null; hashtags: string[] | null; render_id: string | null }, phone: string) {
  const db = supabaseAdmin();
  const waId = phone.slice(1);
  const intro = `C’est l’heure de « ${post.title} » ! Voici ton Reel : enregistre-le (appui long › Enregistrer), puis dans Instagram + › Reel, ajoute ta musique, colle la légende (juste en dessous) et publie. Je le retrouverai tout seul sur ton compte pour suivre ses résultats.`;
  let sent = false;
  if (post.render_id) {
    const render = check(await db.from("renders").select("storage_path, status").eq("id", post.render_id).single()).data!;
    if (render.status === "done" && render.storage_path) {
      const url = check(await db.storage.from("media").createSignedUrl(render.storage_path as string, 3600)).data!.signedUrl;
      const id = await sendVideo(waId, url, intro).catch((error) => {
        console.warn("hand-off video refused", error);
        return undefined;
      });
      if (id) {
        await store(post.studio_id, phone, id, intro, { open_post: post.id });
        sent = true;
      }
    }
  }
  if (!sent) {
    // Too big for WhatsApp (16 MB) or not sent: the page of the post, where it downloads.
    const link = await createLoginLink(phone, `/v/${post.id}`, "open_post");
    const text = `${intro}\n\nLa vidéo est ici : ${link}`;
    await store(post.studio_id, phone, await sendText(waId, text), text, { open_post: post.id });
  }
  const caption = fullCaption(post);
  if (caption) await store(post.studio_id, phone, await sendText(waId, caption.slice(0, 4000)), caption);
}

/** Hands a due « publish by hand » post over to its manager. */
export async function handOff(postId: string): Promise<{ postId: string; ok: boolean; via: string }> {
  const db = supabaseAdmin();
  const post = check(await db.from("posts").select("id, studio_id, title, caption, hashtags, render_id").eq("id", postId).single()).data!;
  const studioId = post.studio_id as string;
  const phone = await ownerPhone(studioId);
  let via: "whatsapp" | "template" | "app" = "app";
  try {
    if (phone && (await inWindow(phone))) {
      await sendOnWhatsApp(post as Parameters<typeof sendOnWhatsApp>[0], phone);
      via = "whatsapp";
    } else if (phone) {
      // Outside the window: a template; her answer brings the video (deliverPendingHandOffs).
      const id = await sendTemplate(phone.slice(1), "ready_to_post", [post.title as string]).catch((error) => {
        console.error("ready_to_post template refused", error);
        return undefined;
      });
      if (id) {
        await store(studioId, phone, id, `C’est l’heure de publier « ${post.title} » ! Réponds-moi et je t’envoie la vidéo et la légende.`);
        via = "template";
      }
    }
  } catch (error) {
    console.error("hand-off failed", postId, error);
  }
  if (via === "app") {
    await store(studioId, null, undefined, `C’est l’heure de publier « ${post.title} » ! Télécharge la vidéo et copie la légende depuis sa page, puis publie-la dans Instagram avec ta musique.`, { open_post: post.id });
  }
  check(await db.from("posts").update({ handoff_at: new Date().toISOString(), handoff_via: via, publish_error: null }).eq("id", postId));
  return { postId, ok: true, via };
}

/** Her answer after a template opens the window: send the Reels waiting for it. */
export async function deliverPendingHandOffs(studioId: string, phone: string): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("posts")
    .select("id, studio_id, title, caption, hashtags, render_id")
    .eq("studio_id", studioId)
    .eq("status", "scheduled")
    .eq("handoff_via", "template");
  for (const post of data ?? []) {
    try {
      await sendOnWhatsApp(post as Parameters<typeof sendOnWhatsApp>[0], phone);
      await db.from("posts").update({ handoff_via: "whatsapp" }).eq("id", post.id);
    } catch (error) {
      console.error("pending hand-off failed", post.id, error);
    }
  }
}

/**
 * Finds the Reels the managers published themselves and links them to their post
 * (published, then measured). The first Reel on the account after the hand-off,
 * the closest caption first.
 */
export async function matchHandPublished(): Promise<number> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - MATCH_FOR_MS).toISOString();
  const { data: waiting } = await db
    .from("posts")
    .select("id, studio_id, title, caption, external_ids, handoff_at")
    .eq("publish_by_hand", true)
    .eq("status", "scheduled")
    .gte("handoff_at", since)
    .order("handoff_at");
  if (!waiting?.length) return 0;
  const { instagramAccount } = await import("./publish");
  let matched = 0;
  const byStudio = Map.groupBy(waiting, (p) => p.studio_id as string);
  for (const [studioId, posts] of byStudio) {
    const account = await instagramAccount(studioId);
    if (!account) continue;
    let media;
    try {
      media = await recentMedia(account.userId, account.accessToken, 15);
    } catch (error) {
      console.error("hand-off match: media read failed", studioId, error instanceof InstagramError ? error.body : error);
      continue;
    }
    // Reels already linked to a post are not candidates.
    const { data: linked } = await db
      .from("posts")
      .select("external_ids")
      .eq("studio_id", studioId)
      .not("external_ids->instagram->>media_id", "is", null);
    const taken = new Set((linked ?? []).map((p) => (p.external_ids as { instagram?: { media_id?: string } }).instagram?.media_id));
    for (const post of posts) {
      // A little before the hand-off too: she may have published from the app's page.
      const after = new Date(post.handoff_at as string).getTime() - 2 * 3600_000;
      const candidates = media
        .filter((m) => m.media_product_type === "REELS" && !taken.has(m.id) && m.timestamp && new Date(m.timestamp).getTime() >= after)
        .map((m) => ({ m, score: captionMatch(post.caption as string | null, m.caption) }))
        // The closest caption, then the earliest.
        .sort((x, y) => y.score - x.score || new Date(x.m.timestamp!).getTime() - new Date(y.m.timestamp!).getTime());
      const best = candidates[0];
      // Several Reels waiting in this studio: only a caption that matches decides.
      if (!best || (posts.length > 1 && best.score < 0.5)) continue;
      taken.add(best.m.id);
      check(
        await db
          .from("posts")
          .update({
            status: "published",
            external_ids: {
              ...(post.external_ids as object),
              instagram: { media_id: best.m.id, permalink: best.m.permalink ?? null, published_at: best.m.timestamp, by_hand: true },
            },
          })
          .eq("id", post.id),
      );
      matched++;
      const phone = await ownerPhone(studioId);
      if (phone && (await inWindow(phone))) {
        const text = `Bien vu, « ${post.title} » est en ligne ✅ Je suis ses résultats.`;
        await store(studioId, phone, await sendText(phone.slice(1), text).catch(() => undefined), text);
      }
    }
  }
  return matched;
}
