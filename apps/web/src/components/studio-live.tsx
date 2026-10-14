"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

// Keeps every open screen up to date: when a publication or a photo/video of
// the studio changes (Fauve in the chat or on WhatsApp, a montage delivered, a
// render done, a post gone online, another tab), the page asks the server for
// its data again. Bursts are grouped; a hidden tab catches up when it comes back.

const DEBOUNCE_MS = 600;

export function StudioLive({ studioId }: { studioId: string }) {
  const router = useRouter();

  useEffect(() => {
    const db = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let missed = false;
    const refresh = () => {
      if (document.hidden) {
        missed = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };
    const onVisible = () => {
      if (!document.hidden && missed) {
        missed = false;
        router.refresh();
      }
    };
    const channel = db
      .channel(`studio-${studioId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `studio_id=eq.${studioId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "media_assets", filter: `studio_id=eq.${studioId}` }, refresh)
      // Work that ends (new components, a new version) shows up on the page that waits for it.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "studio_jobs", filter: `studio_id=eq.${studioId}` }, (payload) => {
        if ((payload.new as { finished_at?: string | null }).finished_at) refresh();
      })
      .subscribe();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void db.removeChannel(channel);
    };
  }, [studioId, router]);

  return null;
}
