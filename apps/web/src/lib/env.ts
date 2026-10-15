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
  // WhatsApp Business Account that owns Fauve's number (for setup/diagnostics).
  WHATSAPP_WABA_ID: z.string().regex(/^\d+$/),
  // Supabase Auth → Send SMS hook secret ("v1,whsec_…"); several may be joined with "|".
  SEND_SMS_HOOK_SECRET: z.string().min(1),
  APP_URL: z.url().default("http://localhost:3000"),
  // Secret for the browser test chat (/essai?cle=…). Unset = test chat disabled.
  FAUVE_TEST_KEY: z.string().min(16),
  USD_TO_EUR: z.coerce.number().positive().optional(),
  // ElevenLabs Music: each Reel's soundtrack, composed from the rendered video. Unset = silent Reels.
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_MUSIC_MODEL: z.string().default("music_v2_5"),
  // Instagram API with Instagram Login (Meta app → Instagram product).
  INSTAGRAM_APP_ID: z.string().regex(/^\d+$/),
  INSTAGRAM_APP_SECRET: z.string().min(1),
  INSTAGRAM_GRAPH_VERSION: z.string().default("v26.0"),
  // The Meta app's ID and secret (not the Instagram app's): renew the tokens of
  // accounts connected earlier through Facebook Login.
  FACEBOOK_APP_ID: z.string().regex(/^\d+$/),
  FACEBOOK_APP_SECRET: z.string().min(1),
  // Instagram webhooks (DMs to Fauve's account): the "verify token" entered in the Meta dashboard.
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
  // TikTok for Developers app (Login Kit + Content Posting API). Unset = TikTok not offered.
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
  // Once TikTok has audited the app: posts go straight to the account (her privacy
  // choice). Before that, videos go to her TikTok drafts and she posts them herself.
  TIKTOK_DIRECT_POST: z.stringbool().default(false),
  // Bearer secret for /api/cron/* (pg_cron sends it from Supabase Vault).
  CRON_SECRET: z.string().min(32),
  // Google AI Studio key and model for video analysis.
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.7-flash"),
  // Image model: real photos improved and ambiance images (lib/ai-images.ts), and its price per 2K image in USD.
  GEMINI_IMAGE_MODEL: z.string().default("gemini-nano-banana-2.1"),
  GEMINI_IMAGE_USD: z.coerce.number().nonnegative().default(0.05),
  // Optional prices (USD per million tokens) to log Gemini costs; tokens are logged regardless.
  GEMINI_INPUT_USD_PER_MTOK: z.coerce.number().nonnegative().optional(),
  GEMINI_OUTPUT_USD_PER_MTOK: z.coerce.number().nonnegative().optional(),
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

// Keys and IDs never contain whitespace: drop line breaks pasted into the dashboard.
function clean(value: string | undefined): string | undefined {
  const stripped = value?.replace(/\s+/g, "");
  return stripped || undefined;
}

const cache = new Map<EnvKey, unknown>();

export function env<K extends EnvKey>(key: K): z.infer<Schema[K]> {
  if (!cache.has(key)) {
    const parsed = schema[key].safeParse(clean(raw(key)));
    if (!parsed.success) throw new Error(`Missing or invalid environment variable ${key}`);
    cache.set(key, parsed.data);
  }
  return cache.get(key) as z.infer<Schema[K]>;
}
