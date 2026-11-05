"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { teamMember } from "@/lib/admin";
import { proposeReel, reviewModelCandidate } from "@/lib/model-scout";

// « Modèles repérés » on /admin (lib/model-scout.ts): the team's studio only, checked again on each action.

async function guard() {
  if (!(await teamMember())) throw new Error("admin: not the team");
}

/** A Reel's link Tristan proposes (his « veille »): read and judged like a Reel a business sends to copy. */
export async function proposeCandidate(form: FormData): Promise<void> {
  await guard();
  const proposed = await proposeReel(String(form.get("link") ?? ""));
  if ("error" in proposed) console.warn("scout: link not proposed", proposed.error);
  revalidatePath("/admin");
}

const reviewSchema = z.object({
  id: z.uuid(),
  action: z.enum(["keep", "drop", "restore", "drafted", "reread"]),
  note: z.string().trim().max(2000).optional(),
  model: z.string().trim().max(40).optional(),
});

/** Tristan's word on a candidate: « En faire un modèle », « Écarter » with a note, « Remettre », « Marquer écrit », « Relancer ». */
export async function reviewCandidate(form: FormData): Promise<void> {
  await guard();
  const parsed = reviewSchema.safeParse({
    id: form.get("id"),
    action: form.get("action"),
    note: String(form.get("note") ?? "").trim() || undefined,
    model: String(form.get("model") ?? "").trim() || undefined,
  });
  if (!parsed.success) return;
  const { id, action, note, model } = parsed.data;
  await reviewModelCandidate(id, action, { note, modelKey: model });
  revalidatePath("/admin");
}
