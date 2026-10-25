import { PLANS, TRIAL_DAYS } from "@fauve/agent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signMediaUrls, type Db } from "@/lib/studio";
import { PlanChoice } from "./plan-choice";

// Her first publication is made in full; she sees it blurred, behind « Débloquer »:
// Stripe Checkout with 3 days of trial (the card is asked, charged after the trial).

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

export async function Paywall({ db, studioId, postId, next }: { db: Db; studioId: string; postId: string | null; next: string }) {
  const preview = await previewOf(db, studioId, postId);
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
          <span className="font-serif text-[30px] italic leading-none">Simone</span>
          <span className="px-6 text-[13px] font-semibold opacity-90">Ta création est prête</span>
        </div>
      </div>
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">
            Ta première publication est <span className="font-serif font-normal italic text-violet">prête</span>
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Pour la voir en entier, la publier et en faire d’autres, démarre ton essai : {TRIAL_DAYS} jours offerts, puis l’offre choisie chaque mois. Sans engagement, tu arrêtes
            en un clic avant la fin de l’essai et tu ne paies rien.
          </p>
        </div>
        <PlanChoice next={next} />
        <p className="text-[12px] leading-snug text-muted">
          Ta carte est demandée pour l’essai et débitée seulement après {TRIAL_DAYS} jours ({PLANS.essentiel.priceEur} € ou {PLANS.pro.priceEur} € TTC par mois). Paiement sécurisé par
          Stripe.
        </p>
      </div>
    </main>
  );
}
