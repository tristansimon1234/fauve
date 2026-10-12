import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Opens a Supabase session (cookies) for a phone number the server has already
 * authenticated (one-time WhatsApp link, QR code). It runs the normal phone OTP
 * flow, but the Send SMS hook stores the code in pending_server_logins instead
 * of sending it, and we verify it immediately.
 */
export async function openSessionForPhone(phoneE164: string): Promise<boolean> {
  const db = supabaseAdmin();
  const supabase = await supabaseServer();

  await db.from("pending_server_logins").upsert({
    phone_e164: phoneE164,
    otp: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });

  try {
    const sent = await supabase.auth.signInWithOtp({ phone: phoneE164 });
    if (sent.error) {
      console.error("server login: signInWithOtp failed", sent.error.message);
      return false;
    }
    const { data } = await db
      .from("pending_server_logins")
      .select("otp")
      .eq("phone_e164", phoneE164)
      .single();
    if (!data?.otp) return false;
    const verified = await supabase.auth.verifyOtp({ phone: phoneE164, token: data.otp, type: "sms" });
    if (verified.error) console.error("server login: verifyOtp failed", verified.error.message);
    return !verified.error;
  } finally {
    await db.from("pending_server_logins").delete().eq("phone_e164", phoneE164);
  }
}
