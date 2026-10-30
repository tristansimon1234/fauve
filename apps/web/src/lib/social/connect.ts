import "server-only";
import { env } from "@/lib/env";

// Connecting Instagram and TikTok to the app, and publishing through their APIs, are put aside
// (Tristan: « garde le code de côté mais l'interface doit refléter la réalité, même sur mon
// compte »): Meta's review and TikTok's audit are not done, so she posts herself from her phone
// (Partager, Télécharger) and her numbers come from her @ (public-stats.ts). Off unless
// SOCIAL_CONNECT=on: no connect button anywhere, no account read (instagramAccount, tiktokEnabled),
// even for an account connected before (the team's tester account).
export const socialConnect = () => env("SOCIAL_CONNECT") === "on";
