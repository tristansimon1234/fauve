import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { forgetInstagramAccount, signedUserId } from "@/lib/social/meta-signed-request";
import { SITE_URL } from "@/lib/site";

// Meta calls this when someone asks for the data Edith holds from their Instagram account to be
// deleted (Business login settings → « Data deletion request URL »). Its token and handle are deleted
// at once; Meta expects back a page about the request and a confirmation code.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const userId = signedUserId(form?.get("signed_request") ?? null);
  if (!userId) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });
  await forgetInstagramAccount(userId);
  const code = randomBytes(8).toString("hex");
  return NextResponse.json({ url: `${SITE_URL}/suppression-des-donnees?code=${code}`, confirmation_code: code });
}
