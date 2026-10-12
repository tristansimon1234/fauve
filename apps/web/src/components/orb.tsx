import { useId } from "react";

/** Mila's gradient orb, the product's identity mark. */
export function Orb({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 120 120" className={className}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFD6C8" />
          <stop offset="55%" stopColor="#F2694E" />
          <stop offset="100%" stopColor="#5B3FD9" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill={`url(#${id})`} />
      <ellipse cx="60" cy="60" rx="54" ry="20" fill="none" stroke="#FFFFFF" strokeOpacity=".45" strokeWidth="1.5" />
      <ellipse cx="60" cy="60" rx="22" ry="54" fill="none" stroke="#FFFFFF" strokeOpacity=".45" strokeWidth="1.5" />
      <ellipse
        cx="60"
        cy="60"
        rx="54"
        ry="38"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity=".25"
        strokeWidth="1.5"
        transform="rotate(30 60 60)"
      />
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Orb size={size} />
      <span className="text-xl font-extrabold tracking-[-0.02em]">Mila</span>
    </span>
  );
}
