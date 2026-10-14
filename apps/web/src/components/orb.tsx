import { Mascot } from "./mascot";
import type { CSSProperties } from "react";

/**
 * Fauve's identity mark: a gradient sphere that slowly breathes into organic
 * shapes, with three orbits turning around it in 3D, each carrying a small
 * moon. Pure CSS (see .fauve-orb in globals.css); motion stops when the device
 * asks for reduced motion. `still` renders the frozen mark (favicons, tiny sizes).
 */
export function Orb({ size = 36, className, still = false }: { size?: number; className?: string; still?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`fauve-orb${still ? " fauve-orb-still" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--orb": `${size}px` } as CSSProperties}
    >
      <span className="fauve-orb-sphere" />
      <span className="fauve-orb-ring fauve-orb-ring-a">
        <span className="fauve-orb-moon" />
      </span>
      <span className="fauve-orb-ring fauve-orb-ring-b">
        <span className="fauve-orb-moon" />
      </span>
      <span className="fauve-orb-ring fauve-orb-ring-c" />
    </span>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Mascot size={Math.round(size * 1.25)} />
      <span className="text-xl font-extrabold tracking-[-0.02em]">Brigitte</span>
    </span>
  );
}
