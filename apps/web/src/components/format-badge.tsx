import { LayersIcon, PlayIcon } from "./icons";

/** On a grid tile: what the post is (Reel or carousel), readable at a glance, in the top right corner. */
export function FormatBadge({ format, small = false }: { format: "reel" | "carousel" | string | null; small?: boolean }) {
  if (format !== "reel" && format !== "carousel") return null;
  return (
    <span
      className={`pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/60 font-bold text-white backdrop-blur-sm ${
        small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {format === "reel" ? <PlayIcon size={small ? 10 : 11} /> : <LayersIcon size={small ? 10 : 11} />}
      {format === "reel" ? "Reel" : "Carrousel"}
    </span>
  );
}
