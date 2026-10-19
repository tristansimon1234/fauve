"use client";

import { useRef, useState } from "react";
import { useFauveDrawer } from "@/components/fauve-drawer";
import { ImageIcon, XIcon } from "@/components/icons";
import { Orb } from "@/components/orb";

// « Que veux-tu sur cette photo ? »: Fauve, photo by photo. The manager says it
// in her words (a checklist of what to bring, the week's hours…), can join a
// picture she likes as an example, and Fauve does it in her panel. On a carousel
// Simone composed, the same for one of its images (a bigger title, another photo).

const IDEAS = ["Une checklist", "Un titre accrocheur", "Les horaires", "Une offre", "Un avis client"];
/** What she may want changed on an image of a composed carousel. */
export const IMAGE_IDEAS = ["Un titre plus gros", "Une autre photo", "Moins de texte", "Une autre mise en page"];

export function PhotoAsk({
  postId,
  postTitle,
  photo,
  total,
  noun = "Photo",
  heading = "Que veux-tu sur cette photo ?",
  ideas = IDEAS,
  placeholder = "Ex. une checklist de ce qu’il faut prendre pour venir au cours",
}: {
  postId: string;
  postTitle: string;
  photo: number;
  total: number;
  /** What one slide is called: « Photo », or « Image » on a composed carousel. */
  noun?: string;
  heading?: string;
  ideas?: string[];
  placeholder?: string;
}) {
  const openFauve = useFauveDrawer();
  const [text, setText] = useState("");
  const [example, setExample] = useState<{ file: File; preview: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = () => {
    const wish = text.trim();
    if (!wish && !example) return;
    const message = [
      `${noun} ${photo} sur ${total} du carrousel : ${wish || "fais la même mise en page que mon exemple"}.`,
      example ? `L’image jointe est un exemple de mise en page que j’aime (pas une photo à publier) : reprends-la sur cette ${noun.toLowerCase()}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    openFauve({ postId, title: postTitle, sceneLabel: `${noun} ${photo}`, start: { text: message, files: example ? [example.file] : [] } });
    setText("");
    if (example) URL.revokeObjectURL(example.preview);
    setExample(null);
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-[16px] bg-violet-tint p-3">
      <span className="flex items-center gap-2 text-[13px] font-bold text-violet">
        <Orb size={18} still />
        {heading}
      </span>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={2}
        maxLength={400}
        placeholder={placeholder}
        className="resize-none rounded-[12px] border border-lilac bg-white px-3 py-2 text-[14px] leading-snug outline-none focus:border-violet"
      />
      {!text && (
        <div className="flex flex-wrap gap-1.5">
          {ideas.map((idea) => (
            <button key={idea} type="button" onClick={() => setText(idea)} className="h-7 rounded-full bg-white px-2.5 text-[12px] font-semibold text-ink hover:text-violet">
              {idea}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {example ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={example.preview} alt="" className="size-9 rounded-lg object-cover" />
            <span className="truncate text-[12px] text-muted">Exemple joint</span>
            <button
              type="button"
              aria-label="Retirer l’exemple"
              onClick={() => {
                URL.revokeObjectURL(example.preview);
                setExample(null);
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white"
            >
              <XIcon size={13} />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-bold text-violet hover:underline">
            <ImageIcon size={15} />
            Joindre un exemple qui te plaît
          </button>
        )}
        <button type="button" disabled={!text.trim() && !example} onClick={send} className="btn btn-primary h-9 shrink-0 px-3.5 text-[13px] disabled:opacity-40">
          Demander à Simone
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && file.type.startsWith("image/")) setExample({ file, preview: URL.createObjectURL(file) });
        }}
      />
    </div>
  );
}
