import "server-only";
import { z } from "zod";

// Server-side configuration, validated per variable when first used, so a route
// only fails on the secrets it actually needs (and `next build` needs none).
const schema = {
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_ID: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_GRAPH_VERSION: z.string().default("v26.0"),
  // Supabase Auth → Send SMS hook secret ("v1,whsec_…"); several may be joined with "|".
  SEND_SMS_HOOK_SECRET: z.string().min(1),
  APP_URL: z.url().default("http://localhost:3000"),
  // Secret for the browser test chat (/essai?cle=…). Unset = test chat disabled.
  FAUVE_TEST_KEY: z.string().min(16),
  USD_TO_EUR: z.coerce.number().positive().optional(),
} as const;

type Schema = typeof schema;
export type EnvKey = keyof Schema;

function raw(key: EnvKey): string | undefined {
  switch (key) {
    // The Vercel ⇄ Supabase integration may expose either the new or the legacy key name.
    case "SUPABASE_SECRET_KEY":
      return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    case "APP_URL":
      return (
        process.env.APP_URL ??
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
      );
    default:
      return process.env[key] || undefined;
  }
}

const cache = new Map<EnvKey, unknown>();

export function env<K extends EnvKey>(key: K): z.infer<Schema[K]> {
  if (!cache.has(key)) {
    const parsed = schema[key].safeParse(raw(key));
    if (!parsed.success) throw new Error(`Missing or invalid environment variable ${key}`);
    cache.set(key, parsed.data);
  }
  return cache.get(key) as z.infer<Schema[K]>;
}
