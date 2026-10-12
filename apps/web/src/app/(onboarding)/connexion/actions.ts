"use server";

import { normalizePhone } from "@fauve/agent";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState =
  | { step: "phone"; error?: string }
  | { step: "code"; phone: string; error?: string };

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/fauve";
}

export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { step: "phone", error: "Ce numéro ne semble pas valide." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    console.warn("sendCode failed", error.status, error.message);
    return {
      step: "phone",
      error:
        error.status === 429
          ? "Un code vient d’être envoyé. Attends une minute avant d’en redemander un."
          : "Impossible d’envoyer le code. Ce numéro est-il bien celui qui écrit à Fauve sur WhatsApp ?",
    };
  }
  return { step: "code", phone };
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { step: "phone", error: "Ce numéro ne semble pas valide." };
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 4) return { step: "code", phone, error: "Entre le code reçu sur WhatsApp." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { step: "code", phone, error: "Ce code ne fonctionne pas ou a expiré." };
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/connexion");
}
