import { CREDIT_PACK, nextPlan, PLAN_BUTTONS, PLANS, type PlanId } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signMediaUrls, type Db } from "@/lib/studio";
import { PackButton } from "./pack-button";
import { PlanChoice } from "./plan-choice";

// Before her first Reel: Edith has prepared everything up to its plan; to make it she picks one of
// the 3 offers (Stripe Checkout, no trial), and what she launched from « Créer » starts on her
// return. Her credits run out (`upgradeFrom`): « 1 Reel de plus » (a pack paid once, Pro included)
// and the offers above hers, her extra credits at once either way.
// A publication made before shows blurred behind it. « Ton premier Reel t'attend » only when one
// does (Tristan, on « Ton plan est prêt » shown to everyone: « ça veut dire quoi ? »); otherwise the
// offers, with no promise.

async function previewOf(db: Db, studioId: string, postId: string | null): Promise<{ url: string; video: boolean } | null> {
  const admin = supabaseAdmin();
  const query = admin.from("posts").select("render_id, media_ids, slides_render").eq("studio_id", studioId);
  const { data: post } = postId
    ? await query.eq("id", postId).maybeSingle()
    : await query.or("render_id.not.is.null,slides_render.not.is.null").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!post) return null;
  let path: string | null = null;
  let video = false;
  if (post.render_id) {
    const { data: render } = await admin.from("renders").select("storage_path").eq("id", post.render_id).maybeSingle();
    path = (render?.storage_path as string | null) ?? null;
    video = Boolean(path);
  }
  if (!path) path = ((post.slides_render as { paths?: string[] } | null)?.paths ?? [])[0] ?? null;
  if (!path) return null;
  const url = (await signMediaUrls(db, studioId, [path])).get(path);
  return url ? { url, video } : null;
}

/** A Reel of hers waits for her subscription: launched from « Créer », or its plan written by Edith in the chat (its « C'est parti »). */
async function reelWaiting(studioId: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
  const [{ data: studio }, { count }] = await Promise.all([
    admin.from("studios").select("pending_creation").eq("id", studioId).maybeSingle(),
    admin
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .eq("direction", "outbound")
      .contains("payload", { options: [PLAN_BUTTONS[0]] })
      .gte("created_at", since),
  ]);
  return Boolean(studio?.pending_creation) || Boolean(count);
}

export async function Paywall({ db, studioId, postId, next, upgradeFrom }: { db: Db; studioId: string; postId: string | null; next: string; upgradeFrom?: PlanId }) {
  const waiting = !upgradeFrom && (postId !== null || (await reelWaiting(studioId)));
  const preview = upgradeFrom || waiting ? await previewOf(db, studioId, postId) : null;
  const above = upgradeFrom ? nextPlan(upgradeFrom) : null;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-soft px-4 py-10 md:flex-row md:gap-14">
      <div className="relative aspect-[9/16] w-[230px] shrink-0 overflow-hidden rounded-[22px] bg-ink shadow-lg md:w-[280px]">
        {preview ? (
          preview.video ? (
            <video src={preview.url} autoPlay muted loop playsInline className="size-full scale-110 object-cover blur-xl" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt="" className="size-full scale-110 object-cover blur-xl" />
          )
        ) : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/30 text-center text-white">
          <span className="font-serif text-[30px] italic leading-none">Edith</span>
          <span className="px-6 text-[13px] font-semibold opacity-90">{upgradeFrom ? "Plus de crédits pour l’instant" : waiting ? "Ton premier Reel t’attend" : "Ton community manager IA"}</span>
        </div>
      </div>
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">
            {upgradeFrom ? (
              <>
                Encore <span className="font-serif font-normal italic text-violet">plus</span> de Reels
              </>
            ) : waiting ? (
              <>
                Ton premier Reel est <span className="font-serif font-normal italic text-violet">prêt à partir</span>
              </>
            ) : (
              <>
                Choisis ton <span className="font-serif font-normal italic text-violet">offre</span>
              </>
            )}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            {upgradeFrom
              ? `Tu as utilisé les crédits de ton offre ${PLANS[upgradeFrom].label}. Prends « ${CREDIT_PACK.label} » (${CREDIT_PACK.credits} crédits en paiement unique)${above ? ` ou passe à ${PLANS[above].label}, en payant seulement la différence pour le reste du mois` : ""} : tes crédits sont là tout de suite. Sinon, ils reviennent à ton renouvellement.`
              : waiting
                ? "Choisis ton abonnement et je le fabrique aussitôt. Sans engagement, tu arrêtes en un clic."
                : "Sans engagement, tu arrêtes en un clic."}
          </p>
        </div>
        {upgradeFrom ? <PackButton next={next} primary={!above} /> : null}
        {!upgradeFrom || above ? <PlanChoice next={next} upgradeFrom={upgradeFrom} /> : null}
        <p className="text-[12px] leading-snug text-muted">
          {upgradeFrom ? "Prix TTC. Paiement sécurisé par Stripe." : "Prix TTC, chaque mois. Paiement sécurisé par Stripe."}
        </p>
      </div>
    </main>
  );
}
