import { Mascot } from "./mascot";

/**
 * Edith at work, for a busy state (a step running, a file sent, an empty page): the line mascot, thinking.
 * It replaced the gradient orb of the first identity; `still` draws it frozen (tiny sizes, lists).
 */
export function Orb({ size = 36, className, still = false }: { size?: number; className?: string; still?: boolean }) {
  return <Mascot size={size} mood="thinking" still={still} className={className} />;
}

/** The logo: Edith's head in thin lines and the name in a big tight grotesque, in the current text color. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Mascot size={Math.round(size * 1.2)} />
      <span className="text-[22px] leading-none font-semibold tracking-[-0.045em]">Edith</span>
    </span>
  );
}
