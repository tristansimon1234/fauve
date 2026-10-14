"use server";

import { clampBox, elementBoxSchema, elementRoleSchema } from "@fauve/agent";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { DeleteResult } from "@/components/delete-button";
import { loadElement, refreshElementOnPosts, restoreElementVersion, saveKit } from "@/lib/elements";
import { startElements } from "@/lib/elements-start";
import { renderSlides } from "@/lib/render/slides";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The bank of components (its pages): create from an inspiration, ask for a
// change, rename, edit the sample texts, go back to a version, put the new
// version on the upcoming posts, duplicate, remove.

export type BankResult = { ok: true; message?: string } | { ok: false; error: string };

const NO_STUDIO = { ok: false as const, error: "Ton numéro n’est relié à aucun studio." };

async function studioId(): Promise<string | null> {
  const { member } = await getStudioContext();
  return member?.studio.id ?? null;
}

const examplePathOf = (studio: string, path: string | undefined) => (path && path.startsWith(`${studio}/elements/`) ? path : undefined);

/** New components from an inspiration (an image uploaded to `{studio}/elements/`) and/or a description. */
export async function createComponents(input: { request: string; examplePath?: string }): Promise<BankResult> {
  const parsed = z.object({ request: z.string().max(2000), examplePath: z.string().max(400).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande illisible." };
  const studio = await studioId();
  if (!studio) return NO_STUDIO;
  const examplePath = examplePathOf(studio, parsed.data.examplePath);
  const wish = parsed.data.request.trim();
  if (!wish && !examplePath) return { ok: false, error: "Décris ce que tu veux, ou ajoute une inspiration." };
  const request = wish || "Décompose cette inspiration en composants réutilisables, fidèles à l’exemple, avec des textes d’exemple adaptés à mon commerce.";
  const started = await startElements({ studioId: studio, mode: "create", request, examplePath, origin: "app" });
  if (started.status === "error") return { ok: false, error: started.error };
  if (started.status === "already_running") return { ok: true, message: "Brigitte y travaille déjà." };
  return { ok: true, message: `Brigitte s’y met : 2 à 4 minutes, ${started.credits} crédits une fois prêts.` };
}

/** A change to one component: a new version, the current one kept. */
export async function changeComponent(id: string, input: { change: string; examplePath?: string }): Promise<BankResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Composant introuvable." };
  const change = z.string().trim().min(2).max(2000).safeParse(input.change);
  if (!change.success) return { ok: false, error: "Dis à Brigitte ce que tu veux changer." };
  const studio = await studioId();
  if (!studio) return NO_STUDIO;
  const started = await startElements({ studioId: studio, mode: "edit", elementId: id, request: change.data, examplePath: examplePathOf(studio, input.examplePath), origin: "app" });
  if (started.status === "error") return { ok: false, error: started.error };
  if (started.status === "already_running") return { ok: true, message: "Ce composant est déjà en cours de modification." };
  revalidatePath(`/composants/${id}`);
  return { ok: true, message: `Brigitte prépare la nouvelle version (une à deux minutes, ${started.credits} crédit).` };
}

async function patchElement(id: string, patch: Record<string, unknown>): Promise<BankResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Composant introuvable." };
  const studio = await studioId();
  if (!studio) return NO_STUDIO;
  const { error } = await supabaseAdmin().from("motion_templates").update(patch).eq("id", id).eq("studio_id", studio).eq("kind", "element");
  if (error) return { ok: false, error: "L’enregistrement a échoué. Réessaie." };
  revalidatePath(`/composants/${id}`);
  revalidatePath("/composants");
  return { ok: true };
}

export async function renameComponent(id: string, name: string): Promise<BankResult> {
  const clean = name.trim().slice(0, 80);
  if (!clean) return { ok: false, error: "Donne-lui un nom." };
  return patchElement(id, { name: clean });
}

export async function setComponentRole(id: string, role: string): Promise<BankResult> {
  const parsed = elementRoleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "Type inconnu." };
  return patchElement(id, { role: parsed.data });
}

/** Its sample texts (what it shows in the bank, and on a photo until other words are given). */
export async function saveComponentSample(id: string, sample: Record<string, string>): Promise<BankResult> {
  const parsed = z.record(z.string().max(24), z.string().max(400)).safeParse(sample);
  if (!parsed.success) return { ok: false, error: "Textes illisibles." };
  return patchElement(id, { sample: parsed.data });
}

/** Where it goes on a photo when nothing else is said (moved by hand on its page). */
export async function saveComponentBox(id: string, box: unknown): Promise<BankResult> {
  const parsed = elementBoxSchema.safeParse(box);
  if (!parsed.success) return { ok: false, error: "Place illisible." };
  const res = await patchElement(id, { box: clampBox(parsed.data) });
  return res.ok ? { ok: true, message: "C’est sa place par défaut sur tes photos." } : res;
}

export async function restoreComponent(id: string, index: number): Promise<BankResult> {
  if (!z.uuid().safeParse(id).success || !Number.isInteger(index) || index < 0) return { ok: false, error: "Version introuvable." };
  const studio = await studioId();
  if (!studio) return NO_STUDIO;
  const ok = await restoreElementVersion(studio, id, index).catch(() => false);
  if (!ok) return { ok: false, error: "Le retour à cette version a échoué." };
  revalidatePath(`/composants/${id}`);
  return { ok: true, message: "C’est la version actuelle. L’autre reste dans l’historique." };
}

/** Puts the current version on every upcoming post that uses the component, then renders them. */
export async function updateComponentPosts(id: string): Promise<BankResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Composant introuvable." };
  const studio = await studioId();
  if (!studio) return NO_STUDIO;
  const changed = await refreshElementOnPosts(studio, id).catch(() => []);
  if (!changed.length) return { ok: true, message: "Aucune publication à venir ne l’utilise." };
  after(async () => {
    for (const postId of changed) await renderSlides(studio, postId).catch((e) => console.error("updateComponentPosts: render failed", postId, e));
  });
  revalidatePath(`/composants/${id}`);
  return { ok: true, message: `${changed.length} publication${changed.length > 1 ? "s" : ""} mise${changed.length > 1 ? "s" : ""} à jour · images refaites dans une minute.` };
}

export async function duplicateComponent(id: string): Promise<BankResult & { id?: string }> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Composant introuvable." };
  const studio = await studioId();
  if (!studio) return NO_STUDIO;
  const element = await loadElement(studio, id);
  if (!element) return { ok: false, error: "Composant introuvable." };
  const [copy] = await saveKit(studio, {
    name: element.kitName ?? element.name,
    description: element.description,
    examplePath: element.examplePath,
    elements: [{ name: `${element.name} (copie)`.slice(0, 80), role: element.role, code: element.code, js: element.js, slots: element.slots, fonts: element.fonts, base: element.base, box: element.box, sample: element.sample }],
  });
  revalidatePath("/composants");
  return { ok: true, id: copy };
}

export async function archiveComponent(id: string): Promise<DeleteResult> {
  const res = await patchElement(id, { archived_at: new Date().toISOString() });
  return res.ok ? { ok: true } : res;
}
