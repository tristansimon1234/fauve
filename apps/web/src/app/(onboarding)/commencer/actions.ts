"use server";

import { cookies } from "next/headers";
import { createPairing, PAIR_COOKIE, pairingMessage, pairingState } from "@/lib/auth/pairing";

/** A new code for this browser (its secret stays in an http-only cookie). */
export async function startPairing(): Promise<{ code: string; text: string }> {
  const { code, cookie } = await createPairing();
  (await cookies()).set(PAIR_COOKIE, cookie, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 15 * 60 });
  return { code, text: pairingMessage(code) };
}

export async function checkPairing(): Promise<"waiting" | "ready" | "expired"> {
  return pairingState((await cookies()).get(PAIR_COOKIE)?.value);
}
