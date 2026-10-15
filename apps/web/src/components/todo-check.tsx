"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setShotDone } from "@/app/(app)/calendrier/actions";

/** Ticks a filming mission off, from the sidebar's to-do list. */
export function TodoCheck({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Filmé : ${label}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setShotDone(id, true);
          router.refresh();
        })
      }
      className={`mt-0.5 size-4 shrink-0 rounded-[5px] border-[1.5px] border-muted/50 transition-colors hover:border-violet ${pending ? "bg-violet-soft" : "bg-white"}`}
    />
  );
}
