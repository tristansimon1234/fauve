import "server-only";
import type { Sandbox } from "@vercel/sandbox";
import { SANDBOX_REGION, sandboxMemoryCostUsd, usdToEur } from "@fauve/agent";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { idleTailSeconds, type LastBusy } from "./sandbox-life";

// The memory a sandbox is paid for after its last command, until it stops (its idle tail): logged once per session,
// when the sandbox resumes, as a cost event of its own (kind sandbox_idle, no studio), so that cost_events add up
// to what Vercel bills (12.9 € logged in October for a sandbox bill of $33.82, $24.95 of it memory).

const lastBusyKey = (name: string) => `sandbox_busy:${name}`;

/** Notes when the last command running in a sandbox's session ended (in the background: never in the way of a job). */
export function noteBusyEnd(sandbox: Sandbox): void {
  try {
    const at = new Date().toISOString();
    const value: LastBusy = { session: sandbox.currentSession().sessionId, at };
    void supabaseAdmin()
      .from("app_settings")
      .upsert({ key: lastBusyKey(sandbox.name), value, updated_at: at })
      .then(
        ({ error }) => {
          if (error) console.warn("sandbox: last command not noted", sandbox.name, error.message);
        },
        () => {},
      );
  } catch {
    // No session on the handle, or no database: its idle tail goes unlogged, the job never fails for it.
  }
}

/**
 * When a sandbox resumes (onResume, before its first command runs): the idle tail of the session it had before, from
 * its last command to its stop, logged once as the memory it was paid for (`memoryGb`). Its last command is read here,
 * before a command of the new session notes its own; the rest goes on in the background. Never throws.
 */
export async function logIdleTail(sandbox: Sandbox, memoryGb: number): Promise<void> {
  let db: ReturnType<typeof supabaseAdmin>;
  let last: Partial<LastBusy> | null = null;
  try {
    db = supabaseAdmin();
    // The resume waits for this read: two seconds at most.
    const { data } = await db.from("app_settings").select("value").eq("key", lastBusyKey(sandbox.name)).abortSignal(AbortSignal.timeout(2_000)).maybeSingle();
    last = (data?.value ?? null) as Partial<LastBusy> | null;
  } catch {
    return;
  }
  if (!last?.session || !last.at) return;
  const noted = { session: last.session, at: last.at };
  void (async () => {
    const page = await sandbox.listSessions({ limit: 5, sortOrder: "desc" });
    const session = page.sessions.find((s) => s.id === noted.session);
    const seconds = session ? idleTailSeconds(noted, session) : null;
    if (seconds === null || seconds < 1 || !session?.stoppedAt) return;
    // Once per session, whichever instance resumed it.
    const { data: logged } = await db.from("cost_events").select("id").eq("kind", "sandbox_idle").eq("meta->>session", noted.session).limit(1);
    if (logged?.length) return;
    const { error } = await db.from("cost_events").insert({
      studio_id: null,
      kind: "sandbox_idle",
      provider: "vercel_sandbox",
      units: seconds,
      cost_eur: usdToEur(sandboxMemoryCostUsd(seconds, memoryGb, SANDBOX_REGION), env("USD_TO_EUR")),
      meta: { sandbox: sandbox.name, session: noted.session, memory_gb: memoryGb, last_command_at: noted.at, stopped_at: new Date(session.stoppedAt).toISOString() },
    });
    if (error) console.warn("sandbox: idle tail not logged", sandbox.name, error.message);
  })().catch((error: unknown) => console.warn("sandbox: idle tail not read", sandbox.name, error instanceof Error ? error.message : error));
}
