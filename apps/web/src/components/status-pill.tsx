import { statusLabels, type PostStatus } from "@fauve/agent";

const toneClasses = {
  done: "bg-success-soft text-success",
  ok: "bg-violet-soft text-violet",
  todo: "bg-peach text-peach-ink",
  wait: "border border-danger/40 text-danger",
  plan: "bg-chip text-muted",
  error: "bg-peach text-danger",
} as const;

export function StatusPill({ status, className = "" }: { status: PostStatus; className?: string }) {
  const { label, tone } = statusLabels[status];
  return (
    <span className={`inline-flex self-start px-2 py-1 font-mono text-[10.5px] font-medium tracking-[0.06em] uppercase ${toneClasses[tone]} ${className}`}>
      {label}
    </span>
  );
}
