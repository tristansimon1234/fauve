import "server-only";
import { z } from "zod";

// Server-side configuration. Read lazily so `next build` works without secrets.
const serverEnvSchema = z.object({
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
  USD_TO_EUR: z.coerce.number().positive().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverEnvSchema.parse({
    ...process.env,
    // The Vercel ⇄ Supabase integration may expose either the new or the legacy key names.
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_URL:
      process.env.APP_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined),
  });
  return cached;
}
