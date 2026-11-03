import { Anton, Archivo_Black, Bodoni_Moda, Bricolage_Grotesque, Caveat, Dela_Gothic_One, Fraunces, Permanent_Marker, Pixelify_Sans, Space_Mono, Syne, Unbounded } from "next/font/google";

// The typefaces of the Reels, for the site that shows them (lot 6 bis, Tristan: « des typos qui changent, ça doit
// exprimer la créativité qui ressort dans les Reels »): the same families the Reels on the page are set in, loaded on
// the landing only, never preloaded (the page's own type comes first), each behind a CSS variable that the kinetic
// words (MorphWord) and the scroll sentence switch between.

const anton = Anton({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--lf-anton" });
const archivo = Archivo_Black({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--lf-archivo" });
const bodoni = Bodoni_Moda({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--lf-bodoni" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", preload: false, variable: "--lf-bricolage" });
const caveat = Caveat({ subsets: ["latin"], display: "swap", preload: false, variable: "--lf-caveat" });
const dela = Dela_Gothic_One({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--lf-dela" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--lf-fraunces" });
const marker = Permanent_Marker({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--lf-marker" });
const pixel = Pixelify_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--lf-pixel" });
const spaceMono = Space_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"], variable: "--lf-spacemono" });
const syne = Syne({ subsets: ["latin"], display: "swap", preload: false, variable: "--lf-syne" });
const unbounded = Unbounded({ subsets: ["latin"], display: "swap", preload: false, variable: "--lf-unbounded" });

/** Every Reel face's variable, on the landing's root. */
export const landingFonts = [anton, archivo, bodoni, bricolage, caveat, dela, fraunces, marker, pixel, spaceMono, syne, unbounded].map((f) => f.variable).join(" ");
