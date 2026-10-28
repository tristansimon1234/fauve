import type { Block } from "@/content/guides";
import { fr } from "./fr";

/** A guide's body, in the landing's editorial type: numbered steps, tips and before / after examples. */
export function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-6 text-[17.5px] leading-[1.7] text-ink/85">
      {blocks.map((block, i) => {
        if ("h2" in block)
          return (
            <h2 key={i} className="mt-8 text-[clamp(26px,3vw,34px)] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
              {fr(block.h2)}
            </h2>
          );
        if ("p" in block) return <p key={i}>{fr(block.p)}</p>;
        if ("ul" in block)
          return (
            <ul key={i} className="flex flex-col gap-2.5 border-l border-ink/15 pl-5">
              {block.ul.map((item) => (
                <li key={item}>{fr(item)}</li>
              ))}
            </ul>
          );
        if ("ol" in block)
          return (
            <ol key={i} start={block.start} className="flex flex-col divide-y divide-ink/10 border-y border-ink/10">
              {block.ol.map(([title, text], k) => (
                <li key={title} className="grid grid-cols-[44px_1fr] gap-x-3 py-5">
                  <span className="font-[family-name:var(--font-serif)] text-[26px] leading-none text-violet italic">{(block.start ?? 1) + k}</span>
                  <span>
                    <strong className="font-bold text-ink">{fr(title)}</strong> {fr(text)}
                  </span>
                </li>
              ))}
            </ol>
          );
        if ("tip" in block)
          return (
            <p key={i} className="rounded-[18px] bg-violet-soft px-6 py-5 font-[family-name:var(--font-serif)] text-[22px] leading-[1.35] text-violet italic">
              {fr(block.tip)}
            </p>
          );
        return (
          <figure key={i} className="rounded-[18px] border border-ink/10 bg-white px-6 py-5">
            <figcaption className="mb-2 text-[12px] font-bold tracking-[0.14em] text-muted uppercase">{fr(block.example.label)}</figcaption>
            <p className="text-[16px] leading-[1.6] whitespace-pre-line text-ink">{fr(block.example.text)}</p>
          </figure>
        );
      })}
    </div>
  );
}
