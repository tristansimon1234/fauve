"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "@/components/icons";
import { updatePost, type PostFormState } from "./actions";

const initial: PostFormState = { status: "idle" };

/** Caption editing and validation. The server re-checks everything. */
export function PostEditor({
  postId,
  caption: savedCaption,
  canEdit,
  canValidate,
}: {
  postId: string;
  caption: string;
  canEdit: boolean;
  canValidate: boolean;
}) {
  const [state, action, pending] = useActionState(updatePost.bind(null, postId), initial);
  const [caption, setCaption] = useState(savedCaption);
  const dirty = caption.trim() !== savedCaption.trim();

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="legende" className="text-[13px] font-bold">
        Légende
      </label>
      <textarea
        id="legende"
        name="caption"
        rows={5}
        maxLength={2200}
        value={caption}
        readOnly={!canEdit}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={canEdit ? "Fauve n’a pas encore écrit de légende. Tu peux en écrire une ici." : undefined}
        className="w-full resize-y rounded-[14px] border-[1.5px] border-line bg-white px-4 py-3.5 text-[15px] leading-normal read-only:bg-soft"
      />
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2.5">
          {canValidate && (
            <button type="submit" name="intent" value="validate" disabled={pending} className="btn btn-primary">
              <CheckIcon size={18} />
              {dirty ? "Enregistrer et valider" : "Valider"}
            </button>
          )}
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending || !dirty}
            className="btn btn-secondary disabled:opacity-50"
          >
            Enregistrer la légende
          </button>
          {pending && <span className="text-[13px] text-muted">Enregistrement…</span>}
        </div>
      )}
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-sm font-semibold ${state.status === "error" ? "text-danger" : "text-success"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
