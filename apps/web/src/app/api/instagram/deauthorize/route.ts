import { NextResponse, type NextRequest } from "next/server";
import { forgetInstagramAccount, signedUserId } from "@/lib/social/meta-signed-request";

// Meta calls this when someone removes Edith from their Instagram account (Business login settings →
// « Deauthorize callback URL »): the account is shown as disconnected and its token deleted.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const userId = signedUserId(form?.get("signed_request") ?? null);
  if (!userId) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });
  await forgetInstagramAccount(userId);
  return NextResponse.json({ ok: true });
}
