import { Section } from "./ui";

export type Inspiration = { id: string; title: string | null; url: string | null; analysis: string | null; at: string };

/** Reels the manager shared with Fauve on Instagram, and what Fauve took from them. */
export function InspirationsSection({ items, fauveHandle }: { items: Inspiration[]; fauveHandle: string | null }) {
  if (!items.length && !fauveHandle) return null;
  return (
    <Section
      id="style-inspirations"
      title="Partagées sur Instagram"
      hint={
        fauveHandle
          ? `Les Reels que tu partages à @${fauveHandle} sur Instagram. Fauve s’en inspire pour tes montages (le rythme, l’accroche, les textes), sans jamais les copier.`
          : "Les Reels que tu partages à Fauve sur Instagram."
      }
    >
      {items.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <span className="text-sm font-semibold">{item.title || "Reel partagé"}</span>
              {item.analysis && <span className="text-[13px] leading-relaxed text-muted">{item.analysis}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Rien de partagé pour l’instant.</p>
      )}
    </Section>
  );
}
