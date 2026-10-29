// Edith's introduction video (30 s), sent with the welcome on WhatsApp and shown at the start of
// the getting started in the app. Not part of the render workers (render:pack packs src/ only):
// rendered once, by hand, into apps/web/public/onboarding (see Intro.tsx for the command).
import { registerRoot } from "remotion";
import { IntroRoot } from "./Intro";

registerRoot(IntroRoot);
