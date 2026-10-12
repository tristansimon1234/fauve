import { statusLabels, type PostStatus } from "@mila/agent";

const toneClasses = {
  done: "bg-success-soft text-success",
  ok: "bg-violet-soft text-violet",
  todo: "bg-peach text-peach-ink",
  wait: "bg-white text-danger",
  plan: "bg-chip text-muted",
  error: "bg-peach text-danger",
} as const;

export function StatusPill({ status, className = "" }: { status: PostStatus; className?: string }) {
  const { label, tone } = statusLabels[status];
  return (
    <span className={`inline-flex self-start rounded-full px-2 py-1 text-[11px] font-bold ${toneClasses[tone]} ${className}`}>
      {label}
    </span>
  );
}
