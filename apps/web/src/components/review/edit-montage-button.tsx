"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFauveDrawer } from "@/components/fauve-drawer";
import { PenIcon } from "@/components/icons";

// « Modifier » for a montage shown outside « Ta publication » (a story with its own
// montage): the same editor, opened from a button.

const ReelEditor = dynamic(() => import("./reel-editor").then((m) => m.ReelEditor), { ssr: false });

export function EditMontageButton({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const openDrawer = useFauveDrawer();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary self-start">
        <PenIcon size={17} />
        Modifier les textes et les scènes
      </button>
      {saved && (
        <p role="status" className="-mt-2 text-[13px] font-semibold text-success">
          {saved}
        </p>
      )}
      {open && (
        <ReelEditor
          postId={postId}
          scenes={null}
          start={{}}
          onClose={(message) => {
            setOpen(false);
            if (!message) return;
            setSaved(message);
            router.refresh();
          }}
          onAsk={(scene, label) => {
            setOpen(false);
            openDrawer({ postId, title, scene, sceneLabel: label });
          }}
        />
      )}
    </>
  );
}
