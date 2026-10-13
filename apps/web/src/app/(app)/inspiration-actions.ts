"use server";

import { after } from "next/server";
import { z } from "zod";
import { ensureInspirationRead, listInspirations, type InspirationItem } from "@/lib/inspirations";
import { getStudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The manager's inspirations, from anywhere in the app (new post sheet, Style).

async function studio() {
  const { member } = await getStudioContext();
  return member?.studio.id ?? null;
}

export async function getInspirations(): Promise<{ studioId: string; items: InspirationItem[] } | null> {
  const studioId = await studio();
  return studioId ? { studioId, items: await listInspirations(studioId, 12) } : null;
}

const addSchema = z.object({ path: z.string().max(300), mime: z.string().max(100), title: z.string().max(80) });

/** A video or a screenshot uploaded to {studio}/inspirations/: kept as an inspiration, read in the background. */
export async function addInspiration(input: z.input<typeof addSchema>): Promise<InspirationItem | null> {
  const studioId = await studio();
  const parsed = addSchema.safeParse(input);
  if (!studioId || !parsed.success) return null;
  const { path, mime, title } = parsed.data;
  if (!path.startsWith(`${studioId}/inspirations/`) || path.includes("..") || !/^(video|image)\//.test(mime)) return null;
  const { data, error } = await supabaseAdmin()
    .from("inspirations")
    .insert({ studio_id: studioId, source: "web_upload", kind: mime.startsWith("video/") ? "video" : "image", title: title.trim() || null, storage_path: path })
    .select("id")
    .single();
  if (error) return null;
  const id = data.id as string;
  after(() => ensureInspirationRead(studioId, id).catch((e) => console.error("inspiration reading failed", e)));
  return { id, title: title.trim() || "Ton inspiration", summary: null, reading: true, source: "web_upload" };
}

/** Where the inspirations being read are (polled while « Fauve la regarde »). */
export async function inspirationsRead(ids: string[]): Promise<InspirationItem[]> {
  const studioId = await studio();
  if (!studioId) return [];
  const wanted = new Set(ids);
  return (await listInspirations(studioId, 20)).filter((i) => wanted.has(i.id));
}

export async function removeInspiration(id: string): Promise<boolean> {
  const studioId = await studio();
  if (!studioId || !z.uuid().safeParse(id).success) return false;
  const db = supabaseAdmin();
  const { data } = await db.from("inspirations").delete().eq("id", id).eq("studio_id", studioId).select("storage_path").maybeSingle();
  if (data?.storage_path) await db.storage.from("media").remove([data.storage_path as string]);
  return Boolean(data);
}
