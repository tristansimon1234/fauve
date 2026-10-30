import { type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { env, type EnvKey } from "@/lib/env";
import { adminKeyAuthorized } from "@/lib/test-studio";
import { graph, WhatsAppError } from "@/lib/whatsapp/client";

// Admin helper for the WhatsApp setup, protected by FAUVE_TEST_KEY (Authorization: Bearer …, never in the address):
//   ?action=status              phone number + subscription diagnostics
//   ?action=register&pin=123456 register the number on the Cloud API (2-step PIN)
//   ?action=subscribe           subscribe this app to the WABA's webhooks
//   ?action=templates           list message templates and their review status
//   ?action=create_templates    submit Fauve's templates (see whatsappTemplates) for review (&only=a,b: just these)
// POST with CRON_SECRET (select public.call_app('/api/admin/whatsapp?action=…')): templates and create_templates only.

// Must match whatsappTemplates (packages/agent) and the senders in lib/whatsapp/client.ts.
const TEMPLATE_DEFINITIONS = [
  {
    name: "login_code",
    language: "fr",
    category: "AUTHENTICATION",
    components: [
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 10 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copier le code" }] },
    ],
  },
  {
    name: "content_request",
    language: "fr",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "J’ai besoin de {{1}} pour le post de {{2}}. Tu peux me l’envoyer ?",
        example: { body_text: [["3 vidéos du cours de reformer", "jeudi"]] },
      },
    ],
  },
  {
    // The Reel she asked for, ready: its button opens its page, signed in (deliver.ts). Replaces draft_ready,
    // whose « Je le programme ? » Meta moved to Marketing.
    name: "reel_ready",
    language: "fr",
    category: "UTILITY",
    components: [
      { type: "BODY", text: "Ton Reel est prêt ! Touche le bouton pour le voir, le publier ou demander un changement." },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Voir mon Reel", url: "{APP_URL}/l/{{1}}", example: ["{APP_URL}/l/Xc3vR8kQ2mZp7LwT9aB4eF"] }],
      },
    ],
  },
  {
    // Its buttons are the publish offer's (publishOfferAnswer): « oui » publishes it, « d'abord » sends its page.
    name: "post_reminder",
    language: "fr",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Rappel : ton {{1}} « {{2}} » est prévu pour maintenant. Tu veux que je le publie ?",
        example: { body_text: [["Reel", "Lancement de la rentrée"]] },
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Oui, publie-le" },
          { type: "QUICK_REPLY", text: "Je regarde d’abord" },
        ],
      },
    ],
  },
  {
    // Its button opens the post's page, signed in: APP_URL/l/{one-time token} (hand-off.ts). Replaces ready_to_post.
    name: "post_to_share",
    language: "fr",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "C’est l’heure de publier « {{1}} » ! Ta publication est prête : touche le bouton pour la voir, ou réponds-moi et je te l’envoie ici.",
        example: { body_text: [["Le service du soir"]] },
      },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Voir ma publication", url: "{APP_URL}/l/{{1}}", example: ["{APP_URL}/l/Xc3vR8kQ2mZp7LwT9aB4eF"] }],
      },
    ],
  },
  {
    name: "nudge",
    language: "fr",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Ça fait {{1}} jours sans publication. Envoie-moi les photos ou vidéos que tu as sous la main, je m’occupe du reste.",
        example: { body_text: [["6"]] },
      },
    ],
  },
  {
    // Its numbers make it a statement about her account, so Meta keeps it Utility (weekly_report went to Marketing).
    name: "weekly_summary",
    language: "fr",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Ton bilan de la semaine : {{1}}, {{2}} et {{3}}. Le détail est dans l’app, page Résultats.",
        example: { body_text: [["3 publications", "42 visites de ton profil", "5 clics sur ton lien"]] },
      },
    ],
  },
  // Neutral versions of the three Meta moved to Marketing (« non-promotional », « specific to or requested by the
  // user »): no « ! », no invitation to do more, her own Reel, post or account named.
  {
    name: "reel_done",
    language: "fr",
    category: "UTILITY",
    components: [
      { type: "BODY", text: "Ton Reel « {{1}} » est terminé. Touche le bouton pour le voir.", example: { body_text: [["Le service du soir"]] } },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Voir mon Reel", url: "{APP_URL}/l/{{1}}", example: ["{APP_URL}/l/Xc3vR8kQ2mZp7LwT9aB4eF"] }],
      },
    ],
  },
  {
    name: "weekly_statement",
    language: "fr",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Le relevé hebdomadaire de ton compte Edith : {{1}}, {{2}} et {{3}}. Tu reçois ce relevé chaque semaine avec ton abonnement.",
        example: { body_text: [["3 vidéos publiées (2 la semaine d’avant)", "4 300 vues (+39 % sur la semaine d’avant)", "12 nouveaux abonnés (+5 la semaine d’avant)"]] },
      },
    ],
  },
  {
    name: "post_due",
    language: "fr",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Rappel : ta publication « {{1}} » est prévue pour maintenant. Touche le bouton pour l’ouvrir, ou réponds à ce message pour la recevoir ici.",
        example: { body_text: [["Le service du soir"]] },
      },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Voir ma publication", url: "{APP_URL}/l/{{1}}", example: ["{APP_URL}/l/Xc3vR8kQ2mZp7LwT9aB4eF"] }],
      },
    ],
  },
];

const REQUIRED: EnvKey[] = [
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_ID",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_WABA_ID",
  "ANTHROPIC_API_KEY",
  "SUPABASE_SECRET_KEY",
];

function configured() {
  return Object.fromEntries(
    REQUIRED.map((key) => {
      try {
        env(key);
        return [key, true];
      } catch {
        return [key, false];
      }
    }),
  );
}

async function attempt<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (error) {
    if (error instanceof WhatsAppError) return { ok: false as const, status: error.status, error: error.body };
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!adminKeyAuthorized(request)) return new Response("Forbidden", { status: 403 });
  return run(params);
}

/** The same with CRON_SECRET (pg_net, call_app): to list or submit the templates from the database. */
export async function POST(request: NextRequest) {
  if (!cronAuthorized(request)) return new Response("Forbidden", { status: 403 });
  const params = request.nextUrl.searchParams;
  if (!["templates", "create_templates"].includes(params.get("action") ?? "")) return Response.json({ error: "templates or create_templates only" }, { status: 400 });
  return run(params);
}

async function run(params: URLSearchParams) {
  const action = params.get("action") ?? "status";

  if (action === "register") {
    const pin = params.get("pin") ?? "";
    if (!/^\d{6}$/.test(pin)) return Response.json({ error: "pin must be 6 digits" }, { status: 400 });
    const result = await attempt(() =>
      graph(`${env("WHATSAPP_PHONE_ID")}/register`, {
        method: "POST",
        body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      }),
    );
    return Response.json({ action, result });
  }

  if (action === "subscribe") {
    const result = await attempt(() => graph(`${env("WHATSAPP_WABA_ID")}/subscribed_apps`, { method: "POST" }));
    return Response.json({ action, result });
  }

  if (action === "templates") {
    const result = await attempt(() =>
      graph(`${env("WHATSAPP_WABA_ID")}/message_templates?fields=name,language,category,status,rejected_reason&limit=50`),
    );
    return Response.json({ action, result });
  }

  if (action === "create_templates") {
    // &only=a,b: just these (the others are already registered and would only answer « already exists »).
    const only = params.get("only")?.split(",").filter(Boolean);
    const results = await Promise.all(
      TEMPLATE_DEFINITIONS.filter((template) => !only || only.includes(template.name)).map(async (template) => ({
        name: template.name,
        result: await attempt(() =>
          graph(`${env("WHATSAPP_WABA_ID")}/message_templates`, {
            method: "POST",
            body: JSON.stringify(template).replaceAll("{APP_URL}", env("APP_URL")),
          }),
        ),
      })),
    );
    return Response.json({ action, results });
  }

  const [phone, subscriptions] = await Promise.all([
    attempt(() =>
      graph(
        `${env("WHATSAPP_PHONE_ID")}?fields=display_phone_number,verified_name,name_status,status,quality_rating,code_verification_status,platform_type,messaging_limit_tier`,
      ),
    ),
    attempt(() => graph(`${env("WHATSAPP_WABA_ID")}/subscribed_apps`)),
  ]);
  return Response.json({ action: "status", configured: configured(), phone, subscriptions });
}
