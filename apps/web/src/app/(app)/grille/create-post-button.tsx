"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { NewPostSheet } from "@/components/new-post-sheet";

/** « Créer une publication » from the grid: the same steps as everywhere else. */
export function CreatePostButton({ timezone }: { timezone: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary h-12 px-6">
        <PlusIcon size={18} />
        Créer une publication
      </button>
      {open && <NewPostSheet timezone={timezone} onClose={() => setOpen(false)} />}
    </>
  );
}
