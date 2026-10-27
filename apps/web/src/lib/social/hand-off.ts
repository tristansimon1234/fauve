import "server-only";
import { captionForInstagram, captionMatch, isInSessionWindow } from "@fauve/agent";
import { createLoginLink } from "@/lib/auth/login-link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendImage, sendLinkButton, sendTemplate, sendText, sendVideo } from "@/lib/whatsapp/client";
import { recentMedia, recentStories, InstagramError } from "./instagram";

// « Je publie moi-même » : at the post's time, Edith hands the post over on
// WhatsApp instead of publishing it. A Reel: the video, then the caption alone to
// copy, so the manager adds Instagram's music. A story: the picture or video, then
// her booking link alone to copy, so she shares it to her story from WhatsApp and
// adds the link sticker (no app may add a sticker: Instagram's API refuses them).
// Outside the 24 h window a template asks her to answer; the post follows her next
// message. Then what she publishes is found on her account and linked to the post.

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
  return captionForInstagram(post.caption, post.hashtags);
}

async function store(studioId: string, phone: string | null, id: string | undefined, body: string, payload: Record<string, unknown> = {}) {
  await supabaseAdmin()
    .from("whatsapp_messages")
    .insert({ studio_id: studioId, channel: phone ? "whatsapp" : "web", wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body, payload });
}

type HandOffPost = { id: string; studio_id: string; kind: string; title: string; caption: string | null; hashtags: string[] | null; render_id: string | null; media_ids: string[] | null };
const HANDOFF_COLUMNS = "id, studio_id, kind, title, caption, hashtags, render_id, media_ids";

/** A story with a link: the picture or video to share from WhatsApp, then her booking link alone. */
async function sendStoryOnWhatsApp(post: HandOffPost, phone: string) {
  const db = supabaseAdmin();
  const waId = phone.slice(1);
  const { storyItem } = await import("./publish");
  const studio = (await db.from("studios").select("booking_url").eq("id", post.studio_id).single()).data;
  const link = (studio?.booking_url as string | null) ?? null;
  const intro = `C’est l’heure de ta story « ${post.title} » ! Ouvre-la, appuie sur Partager › Instagram › Story, puis ajoute le sticker Lien et colle ${link ? "ton lien (juste en dessous)" : "le lien de ta page de réservation"}. Je la retrouve ensuite toute seule pour ses résultats.`;
  const item = await storyItem(post.studio_id, post.render_id, post.media_ids ?? []);
  const send = item.type === "video" ? sendVideo : sendImage;
  const id = await send(waId, item.url, intro).catch((error) => {
    console.warn("story hand-off refused", error);
    return undefined;
  });
  if (id) await store(post.studio_id, phone, id, intro, { open_post: post.id });
  else {
    const url = await createLoginLink(phone, `/v/${post.id}`, "open_post");
    await store(post.studio_id, phone, await sendLinkButton(waId, intro, { url, label: "Voir ma story" }), intro, { open_post: post.id });
  }
  if (link) await store(post.studio_id, phone, await sendText(waId, link), link);
}

/** Sends the post on WhatsApp (inside the 24 h window): a story with its link, a Reel with its caption. */
async function sendOnWhatsApp(post: HandOffPost, phone: string) {
  if (post.kind === "story") return sendStoryOnWhatsApp(post, phone);
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
    const url = await createLoginLink(phone, `/v/${post.id}`, "open_post");
    await store(post.studio_id, phone, await sendLinkButton(waId, intro, { url, label: "Voir la vidéo" }), intro, { open_post: post.id });
  }
  const caption = fullCaption(post);
  if (caption) await store(post.studio_id, phone, await sendText(waId, caption.slice(0, 4000)), caption);
}

/** Hands a due « publish by hand » post over to its manager. */
export async function handOff(postId: string): Promise<{ postId: string; ok: boolean; via: string }> {
  const db = supabaseAdmin();
  const post = check(await db.from("posts").select(HANDOFF_COLUMNS).eq("id", postId).single()).data as HandOffPost;
  const studioId = post.studio_id as string;
  const phone = await ownerPhone(studioId);
  let via: "whatsapp" | "template" | "app" = "app";
  try {
    if (phone && (await inWindow(phone))) {
      await sendOnWhatsApp(post, phone);
      via = "whatsapp";
    } else if (phone) {
      // Outside the window: a template; her answer brings the video (deliverPendingHandOffs).
      const id = await sendTemplate(phone.slice(1), "ready_to_post", [post.title as string]).catch((error) => {
        console.error("ready_to_post template refused", error);
        return undefined;
      });
      if (id) {
        await store(studioId, phone, id, `C’est l’heure de publier « ${post.title} » ! Réponds-moi et je t’envoie ${post.kind === "story" ? "ta story et ton lien" : "la vidéo et la légende"}.`);
        via = "template";
      }
    }
  } catch (error) {
    console.error("hand-off failed", postId, error);
  }
  if (via === "app") {
    const text =
      post.kind === "story"
        ? `C’est l’heure de ta story « ${post.title} » ! Ouvre sa page sur ton téléphone, enregistre-la, puis publie-la en story dans Instagram avec le sticker Lien vers ta réservation.`
        : `C’est l’heure de publier « ${post.title} » ! Télécharge la vidéo et copie la légende depuis sa page, puis publie-la dans Instagram avec ta musique.`;
    await store(studioId, null, undefined, text, { open_post: post.id });
  }
  check(await db.from("posts").update({ handoff_at: new Date().toISOString(), handoff_via: via, publish_error: null }).eq("id", postId));
  return { postId, ok: true, via };
}

/** Her answer after a template opens the window: send the Reels waiting for it. */
export async function deliverPendingHandOffs(studioId: string, phone: string): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("posts")
    .select(HANDOFF_COLUMNS)
    .eq("studio_id", studioId)
    .eq("status", "scheduled")
    .eq("handoff_via", "template");
  for (const post of data ?? []) {
    try {
      await sendOnWhatsApp(post as HandOffPost, phone);
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
    .select("id, studio_id, kind, title, caption, external_ids, handoff_at")
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
    const stories = posts.filter((p) => p.kind === "story");
    if (stories.length) matched += await matchStories(studioId, stories, account);
    const reels = posts.filter((p) => p.kind !== "story");
    if (!reels.length) continue;
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
    for (const post of reels) {
      // A little before the hand-off too: she may have published from the app's page.
      const after = new Date(post.handoff_at as string).getTime() - 2 * 3600_000;
      const candidates = media
        .filter((m) => m.media_product_type === "REELS" && !taken.has(m.id) && m.timestamp && new Date(m.timestamp).getTime() >= after)
        .map((m) => ({ m, score: captionMatch(post.caption as string | null, m.caption) }))
        // The closest caption, then the earliest.
        .sort((x, y) => y.score - x.score || new Date(x.m.timestamp!).getTime() - new Date(y.m.timestamp!).getTime());
      const best = candidates[0];
      // Several Reels waiting in this studio: only a caption that matches decides.
      if (!best || (reels.length > 1 && best.score < 0.5)) continue;
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

/**
 * Stories have no caption to match: each story waiting gets the first story
 * published after its hand-off that no post has yet, oldest hand-off first.
 * Stories stay online 24 h, so they are looked for while they are there.
 */
async function matchStories(
  studioId: string,
  posts: { id: string; title: unknown; external_ids: unknown; handoff_at: unknown }[],
  account: { userId: string; accessToken: string },
): Promise<number> {
  const db = supabaseAdmin();
  let stories;
  try {
    stories = await recentStories(account.userId, account.accessToken);
  } catch (error) {
    console.error("hand-off match: stories read failed", studioId, error instanceof InstagramError ? error.body : error);
    return 0;
  }
  const { data: linked } = await db
    .from("posts")
    .select("external_ids")
    .eq("studio_id", studioId)
    .eq("kind", "story")
    .not("external_ids->instagram->>media_id", "is", null);
  const taken = new Set((linked ?? []).map((p) => (p.external_ids as { instagram?: { media_id?: string } }).instagram?.media_id));
  let matched = 0;
  for (const post of posts) {
    const after = new Date(post.handoff_at as string).getTime() - 2 * 3600_000;
    const story = stories
      .filter((s) => !taken.has(s.id) && s.timestamp && new Date(s.timestamp).getTime() >= after)
      .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())[0];
    if (!story) continue;
    taken.add(story.id);
    check(
      await db
        .from("posts")
        .update({
          status: "published",
          external_ids: { ...(post.external_ids as object), instagram: { media_id: story.id, permalink: story.permalink ?? null, published_at: story.timestamp, by_hand: true } },
        })
        .eq("id", post.id),
    );
    matched++;
  }
  return matched;
}
