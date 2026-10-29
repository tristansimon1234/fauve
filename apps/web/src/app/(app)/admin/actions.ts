"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { teamMember } from "@/lib/admin";
import { brakeSettingsSchema, saveBrakeSettings } from "@/lib/brake-settings";
import { startWaitingMontages } from "@/lib/montage-queue";
import { admitNow, dropFromWaitlist } from "@/lib/waitlist";

// The admin page's actions: the team's studio only (lib/admin.ts), checked again on each one.

const phoneSchema = z.string().regex(/^\+\d{6,15}$/);

async function guard() {
  if (!(await teamMember())) throw new Error("admin: not the team");
}

export async function saveBrakes(form: FormData): Promise<void> {
  await guard();
  const settings = brakeSettingsSchema.safeParse({
    dailySignups: form.get("dailySignups"),
    montagesAtOnce: form.get("montagesAtOnce"),
    freeSpendEurPerDay: form.get("freeSpendEurPerDay"),
  });
  if (!settings.success) return;
  await saveBrakeSettings(settings.data);
  // More room for montages: the waiting ones start now.
  await startWaitingMontages().catch((e: unknown) => console.warn("montage queue: not moved", e));
  revalidatePath("/admin");
}

export async function letIn(form: FormData): Promise<void> {
  await guard();
  const phone = phoneSchema.safeParse(form.get("phone"));
  if (!phone.success) return;
  await admitNow(phone.data);
  revalidatePath("/admin");
}

export async function dropWaiting(form: FormData): Promise<void> {
  await guard();
  const phone = phoneSchema.safeParse(form.get("phone"));
  if (!phone.success) return;
  await dropFromWaitlist(phone.data);
  revalidatePath("/admin");
}
