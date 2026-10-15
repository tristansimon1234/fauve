import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// A studio that leaves (RGPD: complete deletion): every file it has in Storage
// ({studio}/… in the media bucket, through the Storage API), then the studio row
// (everything else cascades: posts, media, messages, plans, renders, accounts,
// credits…), then the login accounts of its members.

async function filesUnder(prefix: string): Promise<string[]> {
  const storage = supabaseAdmin().storage.from("media");
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`storage list ${prefix}: ${error.message}`);
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      // A folder has no id: look inside it.
      if (entry.id === null) paths.push(...(await filesUnder(path)));
      else paths.push(path);
    }
    if (!data || data.length < 1000) break;
  }
  return paths;
}

export async function deleteStudio(studioId: string): Promise<{ files: number; users: number }> {
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("id").eq("id", studioId).maybeSingle();
  if (!studio) throw new Error("Studio introuvable");
  const { data: members } = await db.from("members").select("user_id").eq("studio_id", studioId);

  const files = await filesUnder(studioId);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await db.storage.from("media").remove(files.slice(i, i + 100));
    if (error) throw new Error(`storage remove: ${error.message}`);
  }

  const { error } = await db.from("studios").delete().eq("id", studioId);
  if (error) throw new Error(`studio delete: ${error.message}`);

  // Their login accounts, unless they still belong to another studio.
  let users = 0;
  for (const userId of new Set((members ?? []).map((m) => m.user_id as string | null).filter((id): id is string => Boolean(id)))) {
    const { count } = await db.from("members").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (count) continue;
    const removed = await db.auth.admin.deleteUser(userId);
    if (removed.error) throw new Error(`auth delete: ${removed.error.message}`);
    users++;
  }
  return { files: files.length, users };
}
