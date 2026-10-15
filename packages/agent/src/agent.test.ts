import assert from "node:assert/strict";
import { test } from "node:test";
import { addFacts, readMemory, removeFacts } from "./memory.ts";
import { editPlanObjectSchema, editPlanSchema, segmentSeconds } from "./schemas.ts";
import { canTransition } from "./status.ts";
import { claudeCostUsd, supportsServerFallback, usdToEur } from "./pricing.ts";
import { isInSessionWindow } from "./whatsapp-templates.ts";
import { CREDIT_PRICES } from "./credits.ts";
import { businessFamily, postIdeas } from "./post-ideas.ts";
import { jobMargin, studioMonth, TARGET_MARGIN } from "./margin.ts";
import { logoOnDark } from "./logo.ts";

const validPlan = {
  format: "9:16",
  duration: 12,
  template: "class_of_the_day",
  segments: [{ clip_id: "a", in: 1.2, out: 3, zoom: "none" }],
  texts: [{ text: "6 h 45. Le studio se réveille.", from: 0, to: 2.5, style: "hook" }],
  images: [{ asset_id: "logo", position: "bottom_left", from: 9, to: 12 }],
  transitions: "cut",
  subtitles: true,
  music: null,
};

test("edit plan: accepts the reference plan", () => {
  assert.equal(editPlanSchema.safeParse(validPlan).success, true);
});

test("edit plan: rejects segments that end before they start", () => {
  const plan = { ...validPlan, segments: [{ clip_id: "a", in: 3, out: 1 }] };
  assert.equal(editPlanSchema.safeParse(plan).success, false);
});

test("edit plan: rejects texts past the end of the video", () => {
  const plan = { ...validPlan, texts: [{ text: "x", from: 10, to: 20, style: "caption" }] };
  assert.equal(editPlanSchema.safeParse(plan).success, false);
});

test("edit plan: no embedded music", () => {
  assert.equal(editPlanSchema.safeParse({ ...validPlan, music: "trend.mp3" }).success, false);
});

test("status: nothing is scheduled without validation", () => {
  assert.equal(canTransition("draft", "scheduled"), false);
  assert.equal(canTransition("draft", "validated"), true);
  assert.equal(canTransition("validated", "scheduled"), true);
  assert.equal(canTransition("published", "draft"), false);
});

test("pricing: opus input + output", () => {
  const usd = claudeCostUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 });
  assert.equal(usd, 6);
  assert.equal(usdToEur(1, 0.9), 0.9);
  // A typical chat turn on Haiku: mostly cache reads.
  const turn = claudeCostUsd("claude-haiku-5-5", {
    input_tokens: 0,
    output_tokens: 600,
    cache_read_input_tokens: 33_000,
    cache_creation_input_tokens: 4_600,
  });
  assert.ok(Math.abs(turn - 0.001205) < 1e-9);
  assert.equal(supportsServerFallback("claude-haiku-5-5"), false);
  assert.equal(supportsServerFallback("claude-opus-5-5"), true);
});

test("whatsapp: 24 h window", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  assert.equal(isInSessionWindow(new Date("2026-10-12T00:00:00Z"), now), true);
  assert.equal(isInSessionWindow(new Date("2026-10-11T11:59:00Z"), now), false);
  assert.equal(isInSessionWindow(null, now), false);
});

test("phone: normalizes French and international numbers", async () => {
  const { normalizePhone, formatPhone } = await import("./phone.ts");
  assert.equal(normalizePhone("06 12 34 56 78"), "+33612345678");
  assert.equal(normalizePhone("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizePhone("0033612345678"), "+33612345678");
  assert.equal(normalizePhone("+32 470 12 34 56"), "+32470123456");
  assert.equal(normalizePhone("12"), null);
  assert.equal(formatPhone("+33612345678"), "+33 6 12 34 56 78");
});

test("website: extracts what onboarding needs", async () => {
  const { extractSiteInfo } = await import("./website.ts");
  const html = `<html><head><title>Studio Lune &ndash; Pilates Paris 11</title>
    <meta name="description" content="Pilates machine et barre au c&oelig;ur du 11e.">
    <meta property="og:site_name" content="Studio Lune"></head>
    <body><script>var x = "<a href='https://evil.test'>";</script>
    <img class="logo" src="/img/logo.png">
    <h1>Bienvenue chez Lune</h1><p>Cours collectifs d&#39;une heure, 8 personnes max.</p>
    <a href="https://www.instagram.com/studiolune/">Instagram</a>
    <a href="https://backoffice.bsport.io/m/Studio-Lune/123/">Réserver</a>
    <a href="/tarifs">Nos tarifs</a><a href="mailto:hello@lune.fr">Mail</a></body></html>`;
  const info = extractSiteInfo(html, "https://www.studiolune.fr/");
  assert.equal(info.title, "Studio Lune – Pilates Paris 11");
  assert.equal(info.siteName, "Studio Lune");
  assert.equal(info.logo, "https://www.studiolune.fr/img/logo.png");
  assert.deepEqual(info.socials.instagram, ["https://www.instagram.com/studiolune/"]);
  assert.deepEqual(info.bookingLinks, ["https://backoffice.bsport.io/m/Studio-Lune/123/"]);
  assert.deepEqual(info.pages, [{ url: "https://www.studiolune.fr/tarifs", label: "Nos tarifs" }]);
  assert.match(info.text, /Cours collectifs d'une heure/);
  assert.doesNotMatch(info.text, /evil/);
});

test("website: the logo is the image in the link back home, lazy-loaded or not", async () => {
  const { extractSiteInfo } = await import("./website.ts");
  const page = (header: string) => `<html><body><header>${header}<a href="/cours"><img src="/cours.jpg"></a></header></body></html>`;
  assert.equal(extractSiteInfo(page(`<a href="/"><img data-src="/brume-noir.png" alt="Brume"></a>`), "https://www.brume.fr/").logo, "https://www.brume.fr/brume-noir.png");
  assert.equal(extractSiteInfo(page(`<a href="https://www.brume.fr"><img src="/b.svg"></a>`), "https://www.brume.fr/").logo, "https://www.brume.fr/b.svg");
  assert.equal(extractSiteInfo(page(""), "https://www.brume.fr/").logo, null);
});

test("website: extracts brand colours and fonts", async () => {
  const { extractBrandStyle, stylesheetLinks } = await import("./website.ts");
  const html = `<head><meta name="theme-color" content="#5B3FD9">
    <link rel="stylesheet" href="/css/site.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700&amp;family=Instrument+Serif:ital@1">
    <style>:root{--brand-accent:#f2694e} body{background:#fff;color:#1c1530;font-family:"Plus Jakarta Sans",sans-serif}</style></head>
    <body><div style="background-color: rgb(255, 233, 225)"></div></body>`;
  assert.deepEqual(stylesheetLinks(html, "https://lune.fr/"), ["https://lune.fr/css/site.css"]);
  const style = extractBrandStyle(html, [".btn{background:#5b3fd9} .wix{--color_11: 242,105,78}"]);
  assert.deepEqual(style.colors.slice(0, 2), ["#5b3fd9", "#f2694e"]);
  assert.ok(style.colors.includes("#ffe9e1"));
  assert.ok(style.neutrals.includes("#ffffff"));
  assert.deepEqual(style.fonts.slice(0, 2), ["Plus Jakarta Sans", "Instrument Serif"]);
});

test("history: a reply goes right after the message it answers", async () => {
  const { orderReplies } = await import("./history.ts");
  const row = (direction: "inbound" | "outbound", id: string, reply_to?: string) => ({ direction, wa_message_id: id, reply_to });
  // "Alors pour les postes" (B) arrived while Fauve was answering A.
  const raced = [row("inbound", "A"), row("inbound", "B"), row("outbound", "R", "A")];
  assert.deepEqual(orderReplies(raced).map((r) => r.wa_message_id), ["A", "R", "B"]);
  // Normal back-and-forth is untouched, and replies without reply_to keep their place.
  const normal = [row("inbound", "A"), row("outbound", "R", "A"), row("inbound", "B"), row("outbound", "S")];
  assert.deepEqual(orderReplies(normal).map((r) => r.wa_message_id), ["A", "R", "B", "S"]);
});

test("network: only public addresses are fetched", async () => {
  const { isPublicAddress } = await import("./network.ts");
  for (const ip of ["8.8.8.8", "185.230.63.107", "2a00:1450:4007:80e::2004"]) assert.equal(isPublicAddress(ip), true, ip);
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "nope"]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test("clip analysis: schema converts to JSON Schema and validates a Gemini answer", async () => {
  const { z } = await import("zod");
  const { clipAnalysisSchema } = await import("./schemas.ts");
  const json = z.toJSONSchema(clipAnalysisSchema) as { properties: Record<string, unknown> };
  assert.ok(json.properties.best_moments);
  const answer = {
    duration: 12.4,
    orientation: "portrait",
    summary: "Une élève fait une planche sur le reformer.",
    setting: "studio, reformer",
    lighting: "good",
    shots: [
      { start: 0, end: 4.2, description: "Planche", subject: "élève", energy: 4, hook_score: 5,
        quality: { blurry: false, dark: false, shaky: false }, faces_visible: false },
    ],
    best_moments: [{ start: 1, end: 3.5, why: "Effort visible, gros plan sur les bras qui tremblent" }],
    transcript: "",
    issues: [],
  };
  assert.equal(clipAnalysisSchema.safeParse(answer).success, true);
  assert.equal(clipAnalysisSchema.safeParse({ ...answer, lighting: "great" }).success, false);
});

test("render: plan becomes ffmpeg args and a styled ASS file", async () => {
  const { buildAss, buildFfmpegArgs, renderDuration } = await import("./render.ts");
  const plan = editPlanSchema.parse({
    ...validPlan,
    segments: [
      { clip_id: "a", in: 1.2, out: 3, zoom: "light" },
      { clip_id: "b", in: 0, out: 4 },
    ],
    texts: [{ text: "6 h 45. {Le} studio\\se réveille.", from: 0, to: 2.5, style: "hook" }],
  });
  assert.equal(renderDuration(plan), 5.8);
  const args = buildFfmpegArgs(plan, { clipFiles: { a: "clip0.mp4", b: "clip1.mov" } });
  assert.deepEqual(args.slice(args.indexOf("-ss"), args.indexOf("-ss") + 6), ["-ss", "1.2", "-t", "1.8", "-i", "clip0.mp4"]);
  const graph = args[args.indexOf("-filter_complex") + 1]!;
  assert.match(graph, /\[0:v\]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920.*scale=w='trunc\(1080\*\(1\+0\.08\*t\/1\.8\)\/2\)\*2':h=-2:eval=frame/); // slow push-in
  assert.doesNotMatch(graph.split(";")[1]!, /eval=frame/); // zoom "none"
  assert.match(graph, /concat=n=2:v=1:a=0\[vc\];\[vc\]ass=filename=texts\.ass:fontsdir=fonts\[vout\]/);
  assert.throws(() => buildFfmpegArgs(plan, { clipFiles: { a: "clip0.mp4" } }), /No file for clip b/);
  const ass = buildAss(plan, "#F2694E");
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, /Style: band,Poppins ExtraBold,76,&H00FFFFFF,&H00FFFFFF,&H004E69F2/);
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:02\.50,hook,,0,0,0,,\{\\fad\(180,180\)\\fscx88\\fscy88\\t\(0,260,\\fscx100\\fscy100\)\}6 h 45\. Le studio\/se réveille\./);

  // Crossfades shorten the timeline and chain xfade filters at the right offsets.
  const faded = editPlanSchema.parse({ ...plan, transitions: "fade", segments: [...plan.segments, { clip_id: "a", in: 5, out: 7 }] });
  assert.equal(renderDuration(faded), 7.1); // 1.8 + 4 + 2 - 2 × 0.35
  const fadedGraph = buildFfmpegArgs(faded, { clipFiles: { a: "clip0.mp4", b: "clip1.mov" } }).find((a) => a.includes("xfade"))!;
  assert.match(fadedGraph, /\[v0\]\[v1\]xfade=transition=fade:duration=0\.35:offset=1\.45\[x1\];\[x1\]\[v2\]xfade=transition=fade:duration=0\.35:offset=5\.1\[vc\]/);
});

test("motion: plan becomes a frame-accurate Remotion timeline", async () => {
  const { buildReelProps } = await import("./motion.ts");
  const plan = editPlanSchema.parse({
    ...validPlan,
    template: "doux",
    transitions: "fade",
    subtitles: true,
    segments: [
      { clip_id: "a", in: 1, out: 4, zoom: "light" },
      { clip_id: "b", in: 0, out: 3 },
    ],
    texts: [{ text: "Le Reformer à ton rythme", from: 0, to: 2.5, style: "hook", emphasis: ["rythme"] }],
    images: [],
    end_card: { title: "Indar", subtitle: "Réserve ton cours" },
  });
  const props = buildReelProps(plan, {
    template: "doux",
    clipUrls: { a: "https://x/a.mp4", b: "https://x/b.mp4" },
    words: { a: [{ w: "respire", start: 1.5, end: 2 }, { w: "hors", start: 4.5, end: 5 }] },
    brand: { name: "Indar", accent: "#FFE9E1" },
  });
  assert.equal(props.fadeFrames, 11);
  assert.deepEqual(
    props.segments.map((s) => (s.type === "clip" ? [s.startAt, s.startFrom, s.durationInFrames, s.zoom] : s.type)),
    [[0, 30, 90, true], [79, 0, 90, false]],
  );
  assert.equal(props.durationInFrames, 169);
  assert.deepEqual(props.words, [{ w: "respire", from: 15, to: 30 }]); // the word outside the kept range is dropped
  assert.equal(props.brand.accentInk, "#1C1530"); // light accent gets dark text
  assert.equal(props.endCard?.from, 169 - 48);
  assert.throws(() => buildReelProps(plan, { template: "doux", clipUrls: { a: "x" }, brand: { name: "" } }), /No URL for clip b/);
});

test("editor: model plans are clamped to the clips and the timeline", async () => {
  const { normalizeEditPlan } = await import("./editor.ts");
  const plan = normalizeEditPlan(
    editPlanObjectSchema.parse({
      ...validPlan,
      template: "dynamique",
      duration: 30,
      segments: [
        { clip_id: "a", in: 2, out: 9, zoom: "none" }, // clip a is only 6 s long
        { clip_id: "ghost", in: 0, out: 2, zoom: "none" }, // unknown clip
        { clip_id: "b", in: 1, out: 1.2, zoom: "none" }, // too short
        { clip_id: "b", in: 0, out: 3, zoom: "light" },
      ],
      texts: [
        { text: "Ça brûle", from: 0, to: 2, style: "hook", emphasis: ["brûle", "absent"] },
        { text: "Trop tard", from: 6, to: 9, style: "caption" },
        { text: "Flash", from: 6.8, to: 9, style: "band" }, // 0.2 s once clamped: dropped
      ],
      transitions: "cut",
    }),
    { a: 6, b: 10 },
  );
  assert.deepEqual(plan.segments.map((s) => ("clip_id" in s ? [s.clip_id, s.in, s.out] : "other")), [["a", 2, 6], ["b", 0, 3]]);
  assert.equal(plan.duration, 7);
  assert.deepEqual(plan.texts.map((t) => [t.text, t.to, t.emphasis]), [["Ça brûle", 2, ["brûle"]], ["Trop tard", 7, undefined]]);
  const lonely = editPlanSchema.parse({ ...validPlan, segments: [{ clip_id: "x", in: 0, out: 2 }] });
  assert.throws(() => normalizeEditPlan(lonely, {}), /aucun plan/);
});

test("editor: a plan longer than MAX_REEL_SECONDS loses plans before the end", async () => {
  const { normalizeEditPlan, MAX_REEL_SECONDS } = await import("./editor.ts");
  const segments = Array.from({ length: 12 }, (_, i) => ({ clip_id: "a", in: 0, out: i === 11 ? 2 : 4, zoom: "none" }));
  const plan = normalizeEditPlan(editPlanObjectSchema.parse({ ...validPlan, template: "dynamique", duration: 46, segments, transitions: "cut" }), { a: 10 });
  assert.ok(plan.duration <= MAX_REEL_SECONDS);
  assert.equal(plan.duration, 30);
  const last = plan.segments.at(-1)!;
  assert.ok("clip_id" in last && last.out === 2, "the closing plan stays");
});

test("editor: free motion scenes past the cap play their fixed fallback", async () => {
  const { normalizeEditPlan, MAX_FREE_SCENES } = await import("./editor.ts");
  const motion = (n: number) => ({
    motion: { brief: `Scène ${n}`, fallback: { kind: "title" as const, title: `Titre ${n}`, background: "accent" as const } },
    duration: 7,
  });
  const plan = normalizeEditPlan(
    editPlanObjectSchema.parse({ ...validPlan, segments: [motion(1), motion(2), motion(3), motion(4)], texts: [] }),
    {},
    2,
  );
  const kinds = plan.segments.map((s) => ("motion" in s ? "motion" : "scene" in s ? `scene:${s.scene.title}` : "clip"));
  // The quote decides how many (2 here); 8 is only the ceiling.
  assert.equal(MAX_FREE_SCENES, 8);
  assert.deepEqual(kinds, ["motion", "motion", "scene:Titre 3", "scene:Titre 4"]);
  assert.equal(segmentSeconds(plan.segments[2]!), 6); // fixed scenes last 6 s at most
});

test("editor: library scenes keep their id and get their texts as a record", async () => {
  const { fromEditorPlan, normalizeEditPlan } = await import("./editor.ts");
  const fallback = { kind: "title" as const, title: "Atelier", background: "accent" as const };
  const id = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  const plan = fromEditorPlan({
    ...editPlanObjectSchema.parse({ ...validPlan, segments: [{ clip_id: "a", in: 0, out: 2, zoom: "none" }], texts: [] }),
    template: "doux",
    segments: [
      { motion: { brief: "Titre qui se dessine", fallback, template_id: id, template_texts: [{ slot: "title", text: "Atelier respiration" }, { slot: "Bad Slot", text: "x" }] }, duration: 3 },
      { motion: { brief: "Nouvelle scène", fallback }, duration: 3 },
      { motion: { brief: "Nouvelle scène 2", fallback }, duration: 3 },
      { motion: { brief: "Nouvelle scène 3", fallback }, duration: 3 },
    ],
  });
  const first = plan.segments[0]!;
  assert.ok("motion" in first);
  assert.equal(first.motion.template_id, id);
  assert.deepEqual(first.motion.texts, { title: "Atelier respiration" }); // invalid slot names are dropped
  // Reused scenes do not count toward the cap: the two new ones stay free scenes, the third falls back.
  const kinds = normalizeEditPlan(plan, {}, 2).segments.map((s) => ("motion" in s ? "motion" : "scene"));
  assert.deepEqual(kinds, ["motion", "motion", "motion", "scene"]);
  // With a bigger quote, every new scene stays.
  assert.deepEqual(normalizeEditPlan(plan, {}, 3).segments.map((s) => ("motion" in s ? "motion" : "scene")), ["motion", "motion", "motion", "motion"]);
});

test("credits: a montage is quoted before it runs and never charged above the quote", async () => {
  const { quoteMontage, montageCharge, CREDIT_PRICES } = await import("./credits.ts");
  const quote = quoteMontage({ clips: 4, correction: false });
  // The new animated scenes allowed are in the price shown, not hidden behind a maximum.
  assert.deepEqual(quote.lines.map((l) => l.credits), [CREDIT_PRICES.montage, 4, 2 * CREDIT_PRICES.newScene, CREDIT_PRICES.render]);
  assert.equal(quote.base, 13);
  assert.equal(quote.max, 13); // Rapide: no correction to add
  assert.equal(montageCharge(quote, 0), 7); // library scenes only: the quoted ones not made come off
  assert.equal(montageCharge(quote, 1), 10);
  assert.equal(montageCharge(quote, 5), 13); // capped at the quote
  // An older quote counted no scene in its price.
  assert.equal(montageCharge({ base: 7, max: 13, lines: [{ label: "Montage", credits: 7 }] }, 1), 10);
  const simple = quoteMontage({ clips: 2, correction: true, maxNewScenes: 0 });
  assert.equal(simple.base, 3); // a correction does not re-watch the clips
  assert.equal(simple.max, 3);
});

test("variants: same cut, next template and a new hook, priced as a render", async () => {
  const { variantPlan } = await import("./editor.ts");
  const { quoteVariant, CREDIT_PRICES } = await import("./credits.ts");
  const plan = editPlanSchema.parse({ ...validPlan, template: "doux" });
  const variant = variantPlan(plan, { hook: "Respire. Tout part de là." });
  assert.equal(variant.template, "dynamique"); // next template by default
  assert.deepEqual(variant.segments, plan.segments); // same cut
  assert.equal(variant.texts[0]!.text, "Respire. Tout part de là.");
  assert.equal(variantPlan(plan, { template: "chic" }).texts[0]!.text, plan.texts[0]!.text); // hook kept when not given
  assert.equal(variantPlan(editPlanSchema.parse({ ...validPlan, template: "chic" }), {}).template, "collage");
  assert.equal(variantPlan(editPlanSchema.parse({ ...validPlan, template: "collage" }), {}).template, "doux"); // wraps around
  assert.equal(quoteVariant().max, CREDIT_PRICES.variant);
});

test("motion scenes: generated code is checked before it runs", async () => {
  const { checkMotionCode } = await import("./motion-scene.ts");
  const good = `function Scene({ width, brand }) {
    const frame = useCurrentFrame();
    const o = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
    return <AbsoluteFill style={{ background: brand.accent, opacity: o }}><svg width={width}><circle r={random("a") * 40} /></svg></AbsoluteFill>;
  }`;
  assert.deepEqual(checkMotionCode(good), []);
  assert.deepEqual(checkMotionCode(`function Scene() { fetch("https://evil.test"); return null; }`), ["accès réseau"]);
  assert.deepEqual(checkMotionCode(`import x from "y";\nfunction Scene() { return null; }`), ["import/export"]);
  assert.deepEqual(checkMotionCode(`function Scene() { const r = Math.random(); return null; }`), ["non déterministe"]);
  assert.deepEqual(checkMotionCode(`function Scene() { document.title = "x"; return null; }`), ["accès au navigateur"]);
  assert.deepEqual(checkMotionCode(`function Scene() { return <img src="https://x.test/a.png" />; }`), ["ressource externe"]);
  assert.deepEqual(checkMotionCode(`const Other = () => null;`), ["il faut une fonction Scene"]);
});

test("motion scenes: the renderer, the smoke test and the prompt share one scope", async () => {
  const { readFileSync } = await import("node:fs");
  const { MOTION_SCOPE } = await import("./motion-scene.ts");
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const renderer = /export const SCOPE = \{([^}]*)\}/.exec(read("../../../apps/render/src/MotionScene.tsx"))![1]!;
  const smoke = /const scope = \{([\s\S]*?)\n\};/.exec(read("../../../apps/render/smoke.mjs"))![1]!;
  for (const name of MOTION_SCOPE.filter((n) => n !== "React")) {
    assert.match(renderer, new RegExp(`\\b${name}\\b`), `${name} missing from MotionScene.tsx`);
    assert.match(smoke, new RegExp(`\\b${name}\\b`), `${name} missing from smoke.mjs`);
  }
});

test("pricing: the chat model is priced", async () => {
  const { CHAT_MODEL, claudeCostUsd } = await import("./pricing.ts");
  assert.ok(claudeCostUsd(CHAT_MODEL, { input_tokens: 1_000_000, output_tokens: 100_000 }) > 0);
});

test("reply_with: answer buttons and cards", async () => {
  const { replyExtrasSchema } = await import("./schemas.ts");
  const { toolSpecs } = await import("./tools.ts");
  assert.ok(toolSpecs.reply_with);
  assert.equal(replyExtrasSchema.safeParse({ options: ["Oui, lance", "Non"], grid: true }).success, true);
  assert.equal(replyExtrasSchema.safeParse({ options: ["Oui"] }).success, false, "a single button is not a choice");
  assert.equal(replyExtrasSchema.safeParse({ options: ["Une option beaucoup trop longue pour un bouton", "Non"] }).success, false);
  assert.equal(replyExtrasSchema.safeParse({ posts: ["pas-un-id"] }).success, false);
});

test("montage plan: shown on the quote and read by the editor", async () => {
  const { montagePlanSchema, planBrief } = await import("./schemas.ts");
  const plan = montagePlanSchema.parse({
    duration: 15,
    style: "dynamique",
    scenes: [
      { kind: "animation", what: "Ouverture : RENTRÉE en grand" },
      { kind: "clip", what: "La planche, en gros plan" },
      { kind: "end", what: "Logo et « Réserve ton cours »" },
    ],
  });
  const brief = planBrief(plan);
  assert.match(brief, /~15 s, gabarit dynamique/);
  assert.match(brief, /1\. animation : Ouverture/);
  assert.match(brief, /3\. fin : Logo/);
  assert.equal(montagePlanSchema.safeParse({ duration: 15, scenes: [] }).success, false);
});

test("plan edit: texts follow their scene when scenes move, change or go", async () => {
  const { insertSegment, moveSegment, removeSegment, updateSegment, timeline } = await import("./plan-edit.ts");
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 9,
    segments: [
      { scene: { kind: "title", title: "A", background: "accent" }, duration: 3 },
      { clip_id: "c", in: 1, out: 4 },
      { scene: { kind: "title", title: "C", background: "ink" }, duration: 3 },
    ],
    texts: [
      { text: "sur A", from: 0.5, to: 2.5, style: "hook" },
      { text: "sur B", from: 3.5, to: 5.5, style: "band" },
    ],
    images: [],
  });
  const moved = moveSegment(plan, 0, 2);
  assert.deepEqual(timeline(moved).map((s) => s.start), [0, 3, 6]);
  assert.deepEqual(moved.texts.map((t) => [t.text, t.from, t.to]), [["sur A", 6.5, 8.5], ["sur B", 0.5, 2.5]]);

  const removed = removeSegment(plan, 1);
  assert.deepEqual(removed.texts.map((t) => t.text), ["sur A"]);
  assert.equal(removed.duration, 6);

  const trimmed = updateSegment(plan, 0, { scene: { kind: "title", title: "A", background: "accent" }, duration: 2 });
  assert.deepEqual(trimmed.texts.map((t) => [t.from, t.to]), [[0.5, 2], [2.5, 4.5]]);
  assert.equal(editPlanSchema.safeParse(moved).success, true);

  const inserted = insertSegment(plan, 1, { scene: { kind: "title", title: "Nouveau", background: "cream" }, duration: 2 });
  assert.deepEqual(timeline(inserted).map((s) => s.start), [0, 3, 5, 8]);
  assert.deepEqual(inserted.texts.map((t) => [t.text, t.from, t.to]), [["sur A", 0.5, 2.5], ["sur B", 5.5, 7.5]]);
  assert.equal(inserted.duration, 11);
  assert.equal(editPlanSchema.safeParse(inserted).success, true);
});

test("carousel slides: aligned with the photos, built as a 4:5 still of the Reel", async () => {
  const { alignSlides, buildSlideProps, slidesPlanSchema, SLIDE_FRAME } = await import("./slides.ts");
  const [a, b, c] = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b", "00000000-0000-4000-8000-00000000000c"];
  const plan = slidesPlanSchema.parse({
    template: "doux",
    slides: [
      { media_id: b, texts: [{ text: "Sur B", style: "band" }] },
      { media_id: a, texts: [{ text: "Accroche", style: "hook", y: 0.8 }] },
    ],
  });
  // Follows the post's order, drops removed photos, adds new ones without text.
  const aligned = alignSlides(plan, [a, c]);
  assert.deepEqual(aligned.slides.map((s) => [s.media_id, s.texts.map((t) => t.text)]), [[a, ["Accroche"]], [c, []]]);

  const props = buildSlideProps(aligned.slides[0]!, { template: "doux", imageUrl: "https://example.com/a.jpg", brand: { name: "Studio" } });
  assert.deepEqual([props.width, props.height], [1080, 1350]);
  assert.equal(props.segments[0]?.type, "image");
  // Captured once every text is in, before any leaves.
  assert.ok(props.texts.every((t) => t.from <= SLIDE_FRAME && t.from + t.durationInFrames > SLIDE_FRAME + 20));
  assert.equal(props.texts[0]?.y, 0.8);
  // A text may sit lower on a slide than on a Reel, but not off the photo.
  assert.equal(slidesPlanSchema.safeParse({ template: "doux", slides: [{ media_id: a, texts: [{ text: "x", style: "caption", y: 0.95 }] }] }).success, false);
});

test("text looks: defaults are valid, travel to the render props, and tools accept partial changes", async () => {
  const { defaultLook, textLookSchema, textExampleSchema, lookFonts } = await import("./text-look.ts");
  const { buildReelProps } = await import("./motion.ts");
  const { buildSlideProps, slidesPlanSchema } = await import("./slides.ts");
  const { toolSpecs } = await import("./tools.ts");
  for (const role of ["hook", "band", "caption"] as const) {
    assert.equal(textLookSchema.safeParse(defaultLook(role, { display: "Anton", body: "Inter" })).success, true);
  }
  const look = { ...defaultLook("hook", { display: "Anton", body: "Inter" }), color: "#FFD400", stroke: { color: "#000000", width: 4 }, emphasis: { font: "Caveat" } };
  assert.deepEqual(lookFonts([look, undefined]), ["Anton", "Caveat"]);
  assert.equal(textLookSchema.safeParse({ ...look, color: "jaune" }).success, false);

  const plan = editPlanSchema.parse({ ...validPlan, texts: [{ text: "Hello", from: 0, to: 2, style: "hook", look }] });
  const props = buildReelProps(plan, { template: "doux", clipUrls: { a: "https://example.com/a.mp4" }, brand: { name: "Studio" } });
  assert.equal(props.texts[0]?.look?.color, "#FFD400");

  const slides = slidesPlanSchema.parse({ template: "chic", slides: [{ media_id: "00000000-0000-4000-8000-00000000000a", texts: [{ text: "Hi", style: "band", look }] }] });
  const still = buildSlideProps(slides.slides[0]!, { template: "chic", imageUrl: "https://example.com/a.jpg", brand: { name: "Studio" } });
  assert.equal(still.texts[0]?.look?.font, "Anton");

  // style_texts: only what changes, and null removes a fill.
  assert.equal(toolSpecs.style_texts.input.safeParse({ post_id: "00000000-0000-4000-8000-00000000000a", look: { color: "#000000", fill: null } }).success, true);
  assert.equal(toolSpecs.copy_text_style.input.parse({ media_id: "00000000-0000-4000-8000-00000000000a" }).copy_places, true);
  assert.equal(textExampleSchema.safeParse({ summary: "Gros titre jaune", blocks: [{ name: "Titre", role: "hook", text: "SOLDES", y: 0.1, x: 0.5, look }], logo: "none" }).success, true);
});

test("lists: a checklist text with items, details and bullets reaches the render props; saved looks keep them", async () => {
  const { buildSlideProps, slidesPlanSchema } = await import("./slides.ts");
  const { defaultLook, savedLookSchema } = await import("./text-look.ts");
  const look = defaultLook("band", { display: "Playfair Display", body: "Inter" });
  const plan = slidesPlanSchema.parse({
    template: "chic",
    slides: [
      {
        media_id: "00000000-0000-4000-8000-00000000000a",
        logo: "bottom",
        texts: [
          { text: "Checklist", style: "hook" },
          { text: "Liste", style: "band", look, bullet: { kind: "check", color: "#ffffff" }, items: [{ title: "Arriver 10 minutes avant", detail: "Pour s'installer." }, { title: "Une gourde" }] },
        ],
      },
    ],
  });
  const props = buildSlideProps(plan.slides[0]!, { template: "chic", imageUrl: "https://example.com/a.jpg", brand: { name: "Studio" } });
  assert.equal(props.logo, "bottom");
  assert.deepEqual(props.texts[1]?.items?.map((i) => i.title), ["Arriver 10 minutes avant", "Une gourde"]);
  assert.equal(props.texts[1]?.bullet?.kind, "check");
  assert.equal(savedLookSchema.safeParse({ name: "Checklist", role: "band", look, list: { bullet: { kind: "check", color: "#ffffff" } }, y: 0.3 }).success, true);
});

test("text layers: code checks, slot texts, and a layer replaces the slide's own texts", async () => {
  const { checkLayerCode, slotTexts, layerDesignOutputSchema } = await import("./text-layer.ts");
  const { buildSlideProps, slidesPlanSchema } = await import("./slides.ts");
  assert.deepEqual(checkLayerCode("function Layer({ texts }) { return null; }"), []);
  assert.ok(checkLayerCode("function Scene() { return null; }").includes("il faut une fonction Layer"));
  assert.ok(checkLayerCode("function Layer() { fetch('https://x'); return null; }").includes("accès réseau"));
  assert.deepEqual(slotTexts([{ slot: "title", text: "Bonjour" }, { slot: "Bad Slot", text: "x" }]), { title: "Bonjour" });
  assert.equal(
    layerDesignOutputSchema.safeParse({ code: "function Layer() {}", name: "Test", notes: "", slots: [{ name: "title", role: "titre", max_chars: 40, multiline: false }], fonts: ["Anton"], slides: [{ photo: 1, texts: [{ slot: "title", text: "Hi" }] }] }).success,
    true,
  );

  const layer = { name: "Test", js: "function Layer(){return null}", slots: [{ name: "title", role: "titre", max_chars: 40, multiline: false }], texts: { title: "Hi" }, fonts: ["Anton"] };
  const plan = slidesPlanSchema.parse({ template: "doux", slides: [{ media_id: "00000000-0000-4000-8000-00000000000a", texts: [{ text: "Ignoré", style: "hook" }], layer }] });
  const props = buildSlideProps(plan.slides[0]!, { template: "doux", imageUrl: "https://example.com/a.jpg", brand: { name: "Studio" } });
  assert.equal(props.texts.length, 0);
  assert.deepEqual(props.layer, { js: layer.js, texts: { title: "Hi" }, fonts: ["Anton"] });
});

test("components: code checks, kit output, placement and slide props", async () => {
  const { checkElementCode, clampBox, elementTexts, kitDesignOutputSchema, placeElement, slideElementSchema } = await import("./elements.ts");
  const { buildSlideProps, slidesPlanSchema } = await import("./slides.ts");
  assert.deepEqual(checkElementCode("function Element({ width, texts }) { return null; }"), []);
  assert.ok(checkElementCode("function Layer() { return null; }").includes("il faut une fonction Element"));
  assert.ok(checkElementCode("function Element() { fetch('https://x'); return null; }").includes("accès réseau"));

  // The model's placements are kept inside what the editor allows.
  assert.deepEqual(clampBox({ x: -3, y: 0.5, w: 4, rotate: 90 }), { x: -0.2, y: 0.5, w: 1.2, rotate: 45 });
  assert.deepEqual(clampBox({ x: 0.1, y: 0.2, w: 0.5, rotate: 0 }), { x: 0.1, y: 0.2, w: 0.5 });
  const slots = [{ name: "titre", role: "titre", max_chars: 5, multiline: false }];
  assert.deepEqual(elementTexts([{ slot: "titre", text: "Bonjour" }, { slot: "autre", text: "x" }], slots), { titre: "Bonj" + "o" });

  const kit = {
    kit_name: "Checklist",
    notes: "",
    elements: [{ ref: "e1", name: "Étiquette", role: "etiquette", code: "function Element(){return null}", slots, fonts: ["Anton"], base_width: 400 }],
    slides: [{ photo: 1, placements: [{ ref: "e1", x: 0.1, y: 0.1, w: 0.4, rotate: -4, texts: [{ slot: "titre", text: "Hey" }] }] }],
  };
  assert.equal(kitDesignOutputSchema.safeParse(kit).success, true);
  assert.equal(kitDesignOutputSchema.safeParse({ ...kit, elements: [{ ...kit.elements[0], ref: "x1" }] }).success, false);

  // A bank component placed with no box takes its kit's place, and its sample for the missing words.
  const source = { id: "00000000-0000-4000-8000-0000000000e1", name: "Étiquette", role: "etiquette" as const, slots, js: "function Element(){return null}", fonts: [], base: 400, box: { x: 0.6, y: 0.05, w: 0.3 }, sample: { titre: "Neuf" } };
  const placed = placeElement(source);
  assert.deepEqual(placed.box, { x: 0.6, y: 0.05, w: 0.3 });
  assert.deepEqual(placed.texts, { titre: "Neuf" });
  assert.deepEqual(placeElement(source, { box: { y: 0.8 }, texts: { titre: "Promo" } }).box, { x: 0.6, y: 0.8, w: 0.3 });
  slideElementSchema.parse(placed);

  // Components ride along with the slide's own texts (unlike a layer).
  const plan = slidesPlanSchema.parse({ template: "doux", slides: [{ media_id: "00000000-0000-4000-8000-00000000000a", texts: [{ text: "Gardé", style: "hook" }], elements: [placed] }] });
  const props = buildSlideProps(plan.slides[0]!, { template: "doux", imageUrl: "https://example.com/a.jpg", brand: { name: "Studio" } });
  assert.equal(props.texts.length, 1);
  assert.deepEqual(props.elements, [{ js: placed.js, texts: { titre: "Neuf" }, fonts: [], base: 400, box: { x: 0.6, y: 0.05, w: 0.3 } }]);
});

test("onboarding: steps in order, old values read as their new step", async () => {
  const { nextOnboardingStep, onboardingStepOf, ONBOARDING_STEPS } = await import("./onboarding.ts");
  // Instagram last: once there is a first publication to put out.
  assert.deepEqual([...ONBOARDING_STEPS], ["website", "style", "rhythm", "first_post", "connect", "done"]);
  assert.equal(nextOnboardingStep("website"), "style");
  assert.equal(nextOnboardingStep("rhythm"), "first_post");
  assert.equal(nextOnboardingStep("first_post"), "connect");
  assert.equal(nextOnboardingStep("connect"), "done");
  assert.equal(nextOnboardingStep("done"), "done");
  assert.equal(onboardingStepOf("studio_name"), "website");
  assert.equal(onboardingStepOf("examples"), "style");
  assert.equal(onboardingStepOf("connect"), "connect");
  assert.equal(onboardingStepOf(null), "website");
});

test("funny messages make Simone laugh", async () => {
  const { isFunny } = await import("./emoji.ts");
  for (const t of ["haha trop bien", "Ahahah", "mdr", "ptdr ok", "lol", "😂", "c’est top 🤣"]) assert.equal(isFunny(t), true, t);
  for (const t of ["Bonjour", "le programme de la semaine", "", null, "chaha"]) assert.equal(isFunny(t), false, String(t));
});

test("an upset manager makes Simone sad, or cry when it is strong", async () => {
  const { upsetLevel } = await import("./emoji.ts");
  assert.equal(upsetLevel("franchement c'est nul"), "sad");
  assert.equal(upsetLevel("je suis déçue 😞"), "sad");
  assert.equal(upsetLevel("j'en ai marre !!"), "angry");
  assert.equal(upsetLevel("ça ne marche toujours pas !!!"), "angry");
  assert.equal(upsetLevel("😡"), "angry");
  assert.equal(upsetLevel("C'EST PAS CE QUE JE VEUX"), "angry");
  assert.equal(upsetLevel("t'es nulle franchement"), "cry");
  assert.equal(upsetLevel("je n'en peux plus 😭"), "cry");
  assert.equal(upsetLevel("super, merci !"), null);
  assert.equal(upsetLevel("OK"), null);
  const { isSweet } = await import("./emoji.ts");
  assert.equal(isSweet("merci, t'es la meilleure"), true);
  assert.equal(isSweet("je t'adore Simone 😘"), true);
  assert.equal(isSweet("merci"), false);
});

test("house text layers pass the same checks as generated ones", async () => {
  const { readFileSync } = await import("node:fs");
  const { checkLayerCode, layerSlotSchema } = await import("./text-layer.ts");
  const layers = JSON.parse(readFileSync(new URL("../../../supabase/seed/text-layers.json", import.meta.url), "utf8")) as { name: string; code: string; js: string; slots: unknown[] }[];
  assert.ok(layers.length >= 9);
  for (const l of layers) {
    assert.deepEqual(checkLayerCode(l.code), [], l.name);
    for (const slot of l.slots) layerSlotSchema.parse(slot);
    assert.match(l.js, /function Layer\(/);
  }
});

test("retouch: boxes, tracking, cover layout without empty corners, edits from Gemini, blur kept across versions", async () => {
  const { boxFrom2d, boxAt, coverLayout, photoEditFrom, clipBlurFrom, cssFilter } = await import("./retouch.ts");
  const { carryRetouch, editorOutputSchema } = await import("./editor.ts");

  // A Gemini box [ymin, xmin, ymax, xmax] on 0–1000 becomes shares of the image, with a margin.
  const b = boxFrom2d([200, 400, 400, 600], 0);
  assert.deepEqual([b.x, b.y, b.w, b.h].map((v) => Math.round(v * 100) / 100), [0.4, 0.2, 0.2, 0.2]);
  assert.ok(boxFrom2d([0, 0, 100, 100]).x === 0);

  // Tracking: interpolated between keys, gone well after the last one.
  const keys = [
    { t: 0, x: 0, y: 0, w: 0.2, h: 0.2 },
    { t: 1, x: 0.4, y: 0, w: 0.2, h: 0.2 },
  ];
  assert.equal(Math.round(boxAt(keys, 0.5)!.x * 100) / 100, 0.2);
  assert.equal(boxAt(keys, 3), null);

  // Straightened and pushed to a side, the picture still covers the whole frame.
  const frame = { width: 1080, height: 1350 };
  const l = coverLayout(frame, { width: 1200, height: 1600 }, { straighten: 5, focus: { x: 0.5, y: 0.1 } });
  const angle = (5 * Math.PI) / 180;
  const needW = frame.width * Math.cos(angle) + frame.height * Math.sin(angle);
  const needH = frame.width * Math.sin(angle) + frame.height * Math.cos(angle);
  assert.ok(l.left <= (frame.width - needW) / 2 + 0.01 && l.left + l.width >= (frame.width + needW) / 2 - 0.01);
  assert.ok(l.top <= (frame.height - needH) / 2 + 0.01 && l.top + l.height >= (frame.height + needH) / 2 - 0.01);
  assert.equal(cssFilter({}), undefined);

  const detection = {
    regions: [
      { kind: "face" as const, label: "cliente", box_2d: [100, 100, 300, 300], recognizable: true },
      { kind: "face" as const, label: "de dos", box_2d: [500, 500, 600, 600], recognizable: false },
      { kind: "plate" as const, label: "plaque", box_2d: [800, 100, 850, 400], recognizable: false },
    ],
    adjust: { exposure: 0.2, contrast: 0.1, saturation: 0, warmth: 0.1, straighten: -2 },
    subject: { x: 500, y: 300 },
    notes: "un peu sombre",
  };
  const edit = photoEditFrom(detection, { width: 1200, height: 1600 }, { retouch: true, blur: ["face"], onlyRecognizable: true });
  assert.equal(edit.blur?.length, 1);
  assert.equal(edit.adjust?.focus?.y, 0.3);
  assert.equal(photoEditFrom(detection, { width: 1200, height: 1600 }, { retouch: false, blur: ["plate"] }).adjust, undefined);

  const blur = clipBlurFrom({ tracks: [{ kind: "face", label: "x", recognizable: true, keys: [{ t: 1, box_2d: [0, 0, 100, 100] }, { t: 0, box_2d: [0, 0, 100, 100] }] }] }, 9 / 16, ["face"]);
  assert.deepEqual(blur?.tracks[0]?.keys.map((k) => k.t), [0, 1]);

  // The editor never writes a blur; the previous version's blur stays on its clip.
  assert.equal("blur" in (editorOutputSchema.shape.plan.shape.segments.element.options[0] as { shape: object }).shape, false);
  const previous = editPlanSchema.parse({ ...validPlan, segments: [{ clip_id: "a", in: 1, out: 3, zoom: "none", blur }] });
  const next = carryRetouch(editPlanSchema.parse({ ...validPlan, segments: [{ clip_id: "a", in: 0, out: 2 }] }), previous);
  assert.equal(next.segments[0] && "blur" in next.segments[0] ? next.segments[0].blur?.tracks.length : 0, 1);
});

test("effort: each level adds its review, second version and corrections to the quote", async () => {
  const { quoteMontage, montageCharge, effortVersions, CREDIT_PRICES, AUTO_START_MAX_CREDITS } = await import("./credits.ts");
  const { otherEffort } = await import("./effort.ts");
  const rapide = quoteMontage({ clips: 3, correction: false });
  assert.deepEqual(quoteMontage({ clips: 3, correction: false, effort: "rapide" }), rapide); // no level = Rapide, as before
  assert.equal(rapide.fixRounds, 0);

  const soigne = quoteMontage({ clips: 3, correction: false, effort: "soigne" });
  assert.equal(soigne.base, rapide.base + CREDIT_PRICES.review);
  assert.equal(soigne.max, soigne.base + CREDIT_PRICES.fixRound); // the new scenes are already in the price
  assert.ok(soigne.max <= AUTO_START_MAX_CREDITS); // the usual montage still starts at once

  const max = quoteMontage({ clips: 3, correction: false, effort: "max" });
  assert.equal(max.base, rapide.base + CREDIT_PRICES.alternative + CREDIT_PRICES.review);
  assert.equal(max.fixRounds, 2);
  assert.ok(max.max > AUTO_START_MAX_CREDITS); // Max waits for a yes

  // Charged: the work, the scenes and corrections really made, never above the quote.
  assert.equal(montageCharge(soigne, 2, 0), soigne.base);
  assert.equal(montageCharge(soigne, 0, 0), soigne.base - 2 * CREDIT_PRICES.newScene);
  assert.equal(montageCharge(soigne, 1, 1), soigne.base - CREDIT_PRICES.newScene + CREDIT_PRICES.fixRound);
  assert.equal(montageCharge(soigne, 5, 5), soigne.max);

  // A correction is one version, even at Max.
  assert.equal(effortVersions("max", true), 1);
  assert.equal(effortVersions("max", false), 2);
  assert.equal(quoteMontage({ clips: 0, correction: true, effort: "max" }).lines.some((l) => l.credits === CREDIT_PRICES.alternative), false);

  // The level offered next to the quoted one: up when allowed, else down.
  assert.equal(otherEffort("soigne", ["rapide", "soigne", "max"]), "max");
  assert.equal(otherEffort("soigne", ["rapide", "soigne"]), "rapide");
  assert.equal(otherEffort("max", ["rapide", "soigne", "max"]), "soigne");
  assert.equal(otherEffort("rapide", ["rapide"]), null);
});

test("critic: key frames at the hook, every scene and the end, with the texts on screen", async () => {
  const { reviewMoments, fixBrief, alternativeBrief, planDigest } = await import("./critic.ts");
  const { planTimeline } = await import("./motion.ts");
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 10,
    template: "doux",
    segments: [
      { clip_id: "a", in: 0, out: 3 },
      { motion: { brief: "Titre animé RENTRÉE", texts: { title: "RENTRÉE" } }, duration: 3 },
      { clip_id: "b", in: 1, out: 5 },
    ],
    texts: [{ text: "Le cours du matin", from: 0, to: 2, style: "hook" }],
    images: [],
  });
  const timeline = planTimeline(plan);
  assert.deepEqual(timeline.segments.map((s) => s.start), [0, 3, 6]);
  assert.equal(timeline.duration, 10);
  // Fades overlap the scenes.
  assert.ok(planTimeline({ ...plan, transitions: "fade" }).duration < 10);

  const moments = reviewMoments(plan);
  assert.equal(moments[0]!.t, 1);
  assert.deepEqual(moments[0]!.texts, ["Le cours du matin"]);
  assert.equal(moments.at(-1)!.t, 9.5);
  assert.ok(moments.some((m) => m.scene === 2 && m.texts.includes("RENTRÉE"))); // the animation's slot text
  assert.ok(moments.every((m, i) => i === 0 || m.t > moments[i - 1]!.t));

  // Many scenes: at most `max` frames, hook and end kept.
  const long = editPlanSchema.parse({
    ...plan,
    duration: 30,
    segments: Array.from({ length: 15 }, (_, i) => ({ clip_id: `c${i}`, in: 0, out: 2 })),
  });
  const few = reviewMoments(long, 6);
  assert.equal(few.length, 6);
  assert.equal(few[0]!.t, 1);
  assert.equal(few.at(-1)!.t, 29.5);

  const brief = fixBrief({ score: 6, issues: [{ scene: 1, problem: "accroche trop longue", fix: "la réduire à 3 mots" }] }, "Ouverture dynamique");
  assert.match(brief, /6\/10/);
  assert.match(brief, /Scène 1 : accroche trop longue → la réduire à 3 mots/);
  assert.match(brief, /Ouverture dynamique/);
  assert.match(alternativeBrief(plan, null), /Deuxième version/);
  assert.match(planDigest(plan), /Accroche : « Le cours du matin »/);
});

test("critic: an overlong answer is clamped, not thrown away; lateness is measured from the last step", async () => {
  const { normalizeReview } = await import("./critic.ts");
  const { effortPitch, montageLate } = await import("./effort.ts");
  const long = "x".repeat(500);
  const review = normalizeReview(
    { best: 5, why: long, score: 14, ok: false, summary: long, issues: Array.from({ length: 6 }, () => ({ scene: 99, problem: long, fix: long })) },
    2,
  );
  assert.equal(review.best, 2); // within the versions shown
  assert.equal(review.score, 10);
  assert.equal(review.issues.length, 4);
  assert.equal(review.issues[0]!.scene, 30);
  assert.equal(review.issues[0]!.problem.length, 200);
  assert.equal(review.summary.length, 240);

  const t0 = 0;
  const min = 60_000;
  // A Max montage running for 30 min whose last step moved 2 min ago is not late; one stuck for 9 min is.
  assert.equal(montageLate({ startedAt: t0, stageAt: 28 * min, effort: "max", now: 30 * min }), false);
  assert.equal(montageLate({ startedAt: t0, stageAt: 21 * min, effort: "max", now: 30 * min }), true);
  // Older quotes without steps: from the launch.
  assert.equal(montageLate({ startedAt: t0, stageAt: null, effort: null, now: 11 * min }), true);

  // A Max correction makes one version: it is not sold as two.
  assert.doesNotMatch(effortPitch("max", true), /Deux versions/);
  assert.match(effortPitch("max", false), /Deux versions/);
});

test("emoji: only emojis get an instant reaction, unless they may answer a question", async () => {
  const { emojiOnly, echoFor, awaitsAnswer } = await import("./emoji.ts");
  for (const t of ["👍", "👍🏽", "❤️❤️", "🔥 🔥", "🇫🇷", "🙏✨"]) assert.equal(emojiOnly(t), true, t);
  for (const t of ["1", "ok 👍", "top", "", "  ", "#"]) assert.equal(emojiOnly(t), false, t);
  assert.equal(emojiOnly("🔥🔥🔥🔥🔥🔥🔥"), false); // a burst is a message, not a reaction
  assert.equal(echoFor("❤️"), "❤️");
  assert.equal(echoFor("😍😍"), "❤️");
  assert.equal(echoFor("👍🏽"), "😊");
  assert.equal(echoFor("🔥"), "🔥");
  assert.equal(echoFor("🤔"), null); // a doubt needs a real answer
  assert.equal(awaitsAnswer({ body: "Je lance ?" }), true);
  assert.equal(awaitsAnswer({ body: "Je lance ? 🎬" }), true);
  assert.equal(awaitsAnswer({ body: "C'est parti !", options: ["Oui", "Non"] }), true);
  assert.equal(awaitsAnswer({ body: "Ta vidéo est prête 🎬", quote: false }), false);
  assert.equal(awaitsAnswer(null), false);
});

test("memory keeps each fact once, drops removed ones and ignores junk", async () => {
  const { awaitsAnswer } = await import("./emoji.ts");
  const at = "2026-10-13T00:00:00Z";
  let memory = addFacts([], ["Studio de Pilates Reformer à Lyon", "studio de pilates reformer à Lyon !", "Cours de 12 personnes max"], at);
  assert.deepEqual(memory.map((f) => f.fact), ["Studio de Pilates Reformer à Lyon", "Cours de 12 personnes max"]);
  memory = removeFacts(memory, [1]);
  assert.deepEqual(memory.map((f) => f.fact), ["Cours de 12 personnes max"]);
  assert.equal(readMemory([{ fact: "ok", at }, { nope: 1 }, "x"]).length, 1);
  assert.equal(readMemory(null).length, 0);
  assert.equal(awaitsAnswer({ body: "Dépose-les ici", upload: "video" }), true);
});

test("Simone's instant reaction reads Jev's answers safely", async () => {
  const { moodOf, emojiOf } = await import("./mood.ts");
  assert.equal(moodOf({ choice: "laugh", confidence: 0.9 }), "laugh");
  assert.equal(moodOf({ choice: "laugh", confidence: 0.3 }), "neutral");
  assert.equal(moodOf({ choice: "angry", confidence: 0.99 }), "angry");
  assert.equal(moodOf({ choice: "furious", confidence: 0.99 }), "neutral");
  assert.equal(emojiOf({ choice: "👍", confidence: 0.9 }, "angry"), null);
  assert.equal(moodOf(null), "neutral");
  assert.equal(emojiOf({ choice: "🔥", confidence: 0.8 }, "happy"), "🔥");
  assert.equal(emojiOf({ choice: "none", confidence: 0.9 }, "happy"), null);
  assert.equal(emojiOf({ choice: "❤️", confidence: 0.4 }, "happy"), null);
  // No emoji on a manager who is upset, whatever the second answer says.
  assert.equal(emojiOf({ choice: "👍", confidence: 0.9 }, "cry"), null);
  assert.equal(emojiOf({ choice: "💩", confidence: 0.9 }, "happy"), null);
});

test("style buttons add one adjustment per kind to the art direction", async () => {
  const { withAdjustment } = await import("./restyle.ts");
  const once = withAdjustment("Tons clairs, serif fin.", "warmer");
  assert.match(once, /^Tons clairs, serif fin\.\nAjustement demandé — Plus chaleureux/);
  // The same button again does not pile up.
  assert.equal(withAdjustment(once, "warmer"), once);
  const three = withAdjustment(withAdjustment(withAdjustment(once, "sober"), "punchier"), "warmer");
  assert.equal(three.split("\n").length, 4);
  assert.ok(three.endsWith("rythme posé."), "the latest click comes last");
  // Her own text is never cut for an adjustment.
  const long = "x".repeat(1400);
  const kept = withAdjustment(long, "punchier", 1500);
  assert.ok(kept.startsWith(long) && kept.length <= 1500);
  assert.equal(withAdjustment(undefined, "sober").startsWith("Ajustement"), true);
  // « Autre chose »: her own words, as one more adjustment.
  const custom = withAdjustment(once, { wish: "  plus de couleurs   de ma charte " });
  assert.ok(custom.endsWith("Ajustement demandé — plus de couleurs de ma charte."));
});

test("the site's photos: share image first, big images, no logos or icons", async () => {
  const { extractSiteImages } = await import("./website.ts");
  const html = `<html><head><meta property="og:image" content="/og.jpg"></head><body>
    <img src="/logo.png" alt="logo"><img class="site-logo" src="/brand.png">
    <img src="/icons/arrow.svg"><img src="/tiny.jpg" width="40" height="40">
    <img srcset="/hero-480.jpg 480w, /hero-1600.jpg 1600w" src="/hero-480.jpg">
    <img data-src="/salle.webp" src="data:image/gif;base64,R0lGOD">
    <div style="background-image: url('https://cdn.example.com/banner.jpg')"></div>
    <img src="/og.jpg"></body></html>`;
  assert.deepEqual(extractSiteImages(html, "https://studio.fr/fr"), [
    "https://studio.fr/og.jpg",
    "https://studio.fr/hero-1600.jpg",
    "https://studio.fr/salle.webp",
    "https://cdn.example.com/banner.jpg",
  ]);
});

test("brand colours from the site's look: signature first, neutrals after", async () => {
  const { brandColorsFromLook } = await import("./website.ts");
  assert.deepEqual(brandColorsFromLook(["#0A0A0A", "#ff3b1f", "#f4a6c0", "#f5f0ea", "#c9c9c9"]), ["#ff3b1f", "#f4a6c0", "#0a0a0a", "#f5f0ea", "#c9c9c9"]);
  assert.deepEqual(brandColorsFromLook(["#fff", "nope", "#111111"]), ["#111111"]);
});

test("every priced job keeps at least the target margin on what its credits are worth", () => {
  for (const item of Object.keys(CREDIT_PRICES) as (keyof typeof CREDIT_PRICES)[]) {
    const margin = jobMargin(item);
    if (margin === null) continue;
    assert.ok(margin >= TARGET_MARGIN, `${item}: ${Math.round(margin * 100)} % de marge`);
  }
});

test("a studio's month splits the chat from the work and says what is left", () => {
  const month = studioMonth([
    { purpose: "conversation", eur: 10 },
    { purpose: "editor", eur: 2 },
    { purpose: "editor", eur: 1.5 },
  ]);
  assert.equal(month.chat, 10);
  assert.equal(month.work, 3.5);
  assert.equal(month.byPurpose.editor, 3.5);
  assert.equal(month.budgetLeft, 24.5 - 13.5);
  assert.equal(month.margin, Math.round((1 - 13.5 / 49) * 1000) / 1000);
});

test("post ideas follow the kind of business", () => {
  assert.equal(businessFamily("studio de Pilates"), "sport");
  assert.equal(businessFamily("Salon de coiffure"), "beauty");
  assert.equal(businessFamily("brasserie"), "food");
  assert.equal(businessFamily("fleuriste"), "shop");
  assert.equal(businessFamily(null), "other");
  assert.ok(postIdeas("restaurant").reel.includes("Le plat du jour"));
});

test("site colours: Squarespace theme HSL variables count, its generic sheets do not", async () => {
  const { extractBrandStyle, stylesheetLinks } = await import("./website.ts");
  const style = extractBrandStyle("<html></html>", [":root{--accent-hsl:189.68,62%,80.39%;--darkAccent-hsl:108,68.18%,34.51%;--white-hsl:52.5,44.44%,92.94%}"]);
  assert.deepEqual(style.colors.slice(0, 2), ["#aee2ec", "#34941c"]);
  const links = stylesheetLinks(
    '<link rel="stylesheet" href="//assets.squarespace.com/universal/styles-compressed/commerce.css"><link rel="stylesheet" href="https://static1.squarespace.com/static/versioned-site-css/x/site.css">',
    "https://www.example.com/",
  );
  assert.deepEqual(links, ["https://static1.squarespace.com/static/versioned-site-css/x/site.css"]);
});

test("a dark one-colour logo turns white on the end card, a dark coloured one gets a plate", () => {
  // 10×10 RGBA: a block of logo pixels on a transparent background.
  const logo = (rgb: [number, number, number], filled = 30) => {
    const px = new Uint8Array(400);
    for (let i = 0; i < 100; i++) if (i < filled) px.set([...rgb, 255], i * 4);
    return px;
  };
  assert.equal(logoOnDark(logo([10, 10, 10])), "white");
  assert.equal(logoOnDark(logo([120, 20, 30])), "plate");
  assert.equal(logoOnDark(logo([250, 250, 250])), "as_is");
  // A square logo with its own background stays as it is.
  assert.equal(logoOnDark(logo([10, 10, 10], 100)), "as_is");
});

test("editor: a library scene plays once per Reel, a repeat becomes a new scene or a fixed one", async () => {
  const { fromEditorPlan, normalizeEditPlan } = await import("./editor.ts");
  const id = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  const reuse = (words: string) => ({
    motion: { brief: "La même affiche", fallback: { kind: "title" as const, title: words, background: "accent" as const }, template_id: id, template_texts: [{ slot: "title", text: words }] },
    duration: 3,
  });
  const plan = fromEditorPlan({
    ...editPlanObjectSchema.parse({ ...validPlan, segments: [{ clip_id: "a", in: 0, out: 2, zoom: "none" }], texts: [] }),
    template: "doux",
    segments: [reuse("PIGALLE"), reuse("LA CHEFFE"), reuse("SURPRISE GARANTIE")],
  });
  const kinds = (max: number) =>
    normalizeEditPlan(plan, {}, max).segments.map((s) => ("motion" in s ? (s.motion.template_id ? "library" : "new") : "scene" in s ? `scene:${s.scene.title}` : "clip"));
  assert.deepEqual(kinds(1), ["library", "new", "scene:SURPRISE GARANTIE"]);
  assert.deepEqual(kinds(0), ["library", "scene:LA CHEFFE", "scene:SURPRISE GARANTIE"]);
});

test("history: the window's start stays put for several turns, then jumps ahead", async () => {
  const { stableWindow } = await import("./history.ts");
  // Ids are checkpoints (step 4) when their first 8 hex digits are a multiple of 4.
  const msg = (n: number) => ({ id: `${n.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000` });
  const all = Array.from({ length: 60 }, (_, n) => msg(n + 1));
  const starts = [30, 31, 32, 33, 34, 35].map((len) => stableWindow(all.slice(0, len), 10, 4)[0]!.id.slice(0, 8));
  // 30 messages: latest checkpoint at least 10 from the end is message 20; it stays until 24 qualifies.
  assert.deepEqual(starts.map((s) => parseInt(s, 16)), [20, 20, 20, 24, 24, 24]);
  assert.ok(stableWindow(all.slice(0, 33), 10, 4).length >= 10);
  assert.equal(stableWindow(all.slice(0, 5), 10, 4).length, 5); // fewer than the limit: all of them
});

test("plans: Essentiel and Pro, a credit worth about the same, each month under half its price", async () => {
  const { PLANS, planOf } = await import("./plans.ts");
  const { creditValue, monthlyCostBudget } = await import("./margin.ts");
  assert.equal(planOf("trial"), "pro");
  assert.equal(planOf("essentiel"), "essentiel");
  assert.equal(PLANS.essentiel.priceEur, 29);
  // Essentiel's credit is not cheaper than Pro's: no job loses its margin there.
  assert.ok(creditValue("essentiel") >= creditValue("pro"));
  assert.equal(monthlyCostBudget("essentiel"), 14.5);
  const month = studioMonth([{ purpose: "editor", eur: 7.25 }], "essentiel");
  assert.equal(month.margin, 0.75);
});

test("caption match: the Reel she published by hand, words changed or not", async () => {
  const { captionMatch } = await import("./caption-match.ts");
  const ours = "Nouvelle coupe d’automne ✂️ Réserve ton créneau cette semaine !";
  assert.equal(captionMatch(ours, "nouvelle coupe d'automne ✂️🍂 réserve ton créneau cette semaine ! #coiffure"), 1);
  assert.ok(captionMatch(ours, "Nouvelle coupe d’automne, réserve vite") >= 0.5);
  assert.ok(captionMatch(ours, "Le menu du jour est arrivé") < 0.2);
  assert.equal(captionMatch(null, "anything"), 0);
});

test("captions: 5 hashtags at most, marks of machine writing taken out", async () => {
  const { captionForInstagram, cleanCaption, MAX_HASHTAGS } = await import("./caption.ts");
  assert.equal(MAX_HASHTAGS, 5);
  // Long dashes, invisible characters and non-breaking spaces go; French quotes, apostrophes and emojis stay.
  assert.equal(cleanCaption("Nouveau cours — le mardi​ à 18 h !"), "Nouveau cours, le mardi à 18 h !");
  assert.equal(cleanCaption("De 10–12 h, « venez » c’est ✨"), "De 10-12 h, « venez » c’est ✨");
  assert.equal(cleanCaption("— Une ligne\nfin —."), "Une ligne\nfin.");
  // The caption's own hashtags count first, duplicates once, the post's tags fill the rest.
  assert.equal(captionForInstagram("Viens #pilates #Lyon", ["pilates", "#yoga", "bienetre", "sport", "matin", "trop"]), "Viens #pilates #Lyon\n\n#yoga #bienetre #sport");
  const many = captionForInstagram("#a #b #c #d #e #f #g fin", ["h"]);
  assert.equal(many, "#a #b #c #d #e fin");
  assert.equal(captionForInstagram(null, []), "");
});

test("ai images: real photos kept truthful, ambiance never her place, frames and price", async () => {
  const { ambiancePrompt, closestFormat, cropsMuch, improvePrompt, PHOTO_IMPROVEMENTS } = await import("./ai-image.ts");
  const { toolSpecs } = await import("./tools.ts");
  const improve = improvePrompt(PHOTO_IMPROVEMENTS.background.instruction, "4:5", "salon de coiffure");
  assert.match(improve, /salon de coiffure/);
  assert.match(improve, /Keep everything real exactly as it is/);
  assert.match(improve, /portrait 4:5/);
  const ambiance = ambiancePrompt("des serviettes roulées sur du bois clair", "9:16", { colors: ["#7A1F2B", "not a colour"], mood: "chaleureux" });
  assert.match(ambiance, /No people and no faces/);
  assert.match(ambiance, /No text/);
  assert.match(ambiance, /#7A1F2B/);
  assert.doesNotMatch(ambiance, /not a colour/);
  assert.equal(closestFormat(1080, 1350), "4:5");
  assert.equal(closestFormat(1080, 1920), "9:16");
  assert.equal(closestFormat(1200, 1150), "1:1");
  // A landscape photo loses much of itself in 4:5 (worth extending), a 3:4 one does not.
  assert.equal(cropsMuch(1600, 900, "4:5"), true);
  assert.equal(cropsMuch(1200, 1600, "4:5"), false);
  assert.equal(CREDIT_PRICES.image, 1);
  assert.equal(toolSpecs.make_image.input.parse({ mode: "ambiance", instruction: "un fond de lin" }).format, "4:5");
  assert.equal(toolSpecs.make_image.input.safeParse({ mode: "ambiance", instruction: "x", count: 9 }).success, false);
});

test("TikTok: caption with every hashtag, settings and states", async () => {
  const { captionForTikTok, TIKTOK_CAPTION_MAX } = await import("./caption.ts");
  const { readTikTokSettings, readTikTokExternal, tiktokStateLine } = await import("./tiktok.ts");
  // No cap of 5 on TikTok; hashtags already written are not repeated.
  assert.equal(captionForTikTok("Viens — vite #pilates", ["pilates", "a", "b", "c", "d", "e"]), "Viens, vite #pilates\n\n#a #b #c #d #e");
  assert.ok(captionForTikTok("x".repeat(3000)).length <= TIKTOK_CAPTION_MAX);
  // Nothing preselected for who sees it (TikTok's rule).
  assert.deepEqual(readTikTokSettings(null), { privacy_level: null, allow_comment: true, allow_duet: true, allow_stitch: true });
  assert.equal(readTikTokSettings({ privacy_level: 3 }).privacy_level, null);
  const sent = readTikTokExternal({ tiktok: { publish_id: "v_inbox_file~1", mode: "draft", status: "SEND_TO_USER_INBOX", sent_at: "2026-10-15T10:00:00Z" } });
  assert.ok(sent);
  assert.match(tiktokStateLine(sent), /brouillons/);
  assert.match(tiktokStateLine({ ...sent, post_id: "7" }), /En ligne/);
  assert.equal(readTikTokExternal({ instagram: {} }), null);
});

test("growth: weeks of new followers, net from counts, formats and moments", async () => {
  const { weeklyGrowth, weekStart, periodTotals, byFormat, bestMoments, suggestedMoment } = await import("./growth.ts");
  assert.equal(weekStart("2026-10-15"), "2026-10-12"); // a Thursday → its Monday
  assert.equal(weekStart("2026-10-12"), "2026-10-12");
  const row = (day: string, o: Partial<Record<string, number | null>> = {}) => ({
    day, followers: null, new_followers: null, unfollows: null, views: null, reach: null, profile_views: null, link_taps: null, interactions: null, ...o,
  });
  const rows = [
    row("2026-10-05", { followers: 100 }),
    row("2026-10-06", { new_followers: 5, unfollows: 1, views: 300 }),
    row("2026-10-08", { new_followers: 3, unfollows: 0, views: 200, followers: 107 }),
    row("2026-10-13", { followers: 110 }), // counts only (e.g. TikTok)
  ];
  const weeks = weeklyGrowth(rows, 3, new Date("2026-10-15T10:00:00Z"));
  assert.deepEqual(weeks.map((w) => w.start), ["2026-09-28", "2026-10-05", "2026-10-12"]);
  assert.equal(weeks[1]!.newFollowers, 8);
  assert.equal(weeks[1]!.net, 7);
  assert.equal(weeks[1]!.views, 500);
  assert.equal(weeks[2]!.net, 3); // 110 − 107, from the follower counts
  assert.equal(weeks[0]!.days, 0);
  const total = periodTotals(rows, "2026-10-06");
  assert.equal(total.newFollowers, 8);
  assert.equal(total.followers, 110);
  const posts = [
    { kind: "reel", publishedAt: "2026-10-06T16:00:00Z", views: 1000, reach: 800, likes: 50, comments: 5, saves: 20, shares: 5 },
    { kind: "reel", publishedAt: "2026-10-07T07:00:00Z", views: 600, reach: 400, likes: 20, comments: 0, saves: 10, shares: 10 },
    { kind: "carousel", publishedAt: "2026-10-06T17:00:00Z", views: 300, reach: 250, likes: 30, comments: 2, saves: 15, shares: 3 },
  ];
  const formats = byFormat(posts);
  // Interest (saves and shares over reach here) ranks the carousel first, despite fewer views.
  assert.equal(formats[0]!.kind, "carousel");
  const reel = formats.find((f) => f.kind === "reel")!;
  assert.equal(reel.views, 800);
  assert.ok(Math.abs(reel.engagement! - (80 / 800 + 40 / 400) / 2) < 1e-9);
  assert.ok(Math.abs(reel.interest! - (25 / 800 + 20 / 400) / 2) < 1e-9);
  const moments = bestMoments(posts, "Europe/Paris");
  assert.equal(moments.by, "views");
  assert.equal(moments.days[0]!.label, "mardi"); // 7 Oct 9:00 in Paris
  assert.equal(moments.slots[0]!.label, "le soir"); // 650 on average (18 h, 19 h) against 600 at 9 h
  // With profile visits, the moments follow visits, not views.
  const visited = posts.map((p, i) => ({ ...p, profileVisits: [4, 30, 6][i]! }));
  const byVisits = bestMoments(visited, "Europe/Paris");
  assert.equal(byVisits.by, "visits");
  assert.equal(byVisits.slots[0]!.label, "le matin");
  assert.equal(suggestedMoment(byVisits), null); // 3 posts: too few to advise
  // Tuesday mornings bring the visits, week after week: that is her moment.
  const at = (publishedAt: string, profileVisits: number) => ({ ...posts[0]!, publishedAt, profileVisits });
  const regular = [
    at("2026-09-29T07:00:00Z", 30), at("2026-10-06T07:00:00Z", 28), // Tuesdays, 9 h
    at("2026-10-01T16:00:00Z", 5), at("2026-10-08T16:00:00Z", 6), // Thursdays, 18 h
    at("2026-10-03T10:00:00Z", 8), at("2026-10-10T10:00:00Z", 7), // Saturdays, noon
  ];
  assert.equal(suggestedMoment(bestMoments(regular, "Europe/Paris")), "le mardi, le matin");
});

test("art direction: filled from a reading only when empty", async () => {
  const { withArtDirection } = await import("./moodboard.ts");
  assert.equal(withArtDirection({} as { art_direction?: string }, "Chaleureux et naturel.").art_direction, "Chaleureux et naturel.");
  assert.equal(withArtDirection({ art_direction: "  " }, "Chaleureux.").art_direction, "Chaleureux.");
  assert.equal(withArtDirection({ art_direction: "Le mien." }, "Chaleureux.").art_direction, "Le mien.");
  assert.deepEqual(withArtDirection({ tone: "x" } as { tone: string; art_direction?: string }, null), { tone: "x" });
});

test("followers: counts kept, earlier days worked back from gains and losses", async () => {
  const { followerSeries } = await import("./growth.ts");
  const row = (day: string, o: Partial<Record<string, number | null>> = {}) => ({
    day, followers: null, new_followers: null, unfollows: null, views: null, reach: null, profile_views: null, link_taps: null, interactions: null, ...o,
  });
  const rows = [
    row("2026-10-11", { new_followers: 4, unfollows: 1 }),
    row("2026-10-12", { new_followers: 5, unfollows: 2 }),
    row("2026-10-13", { new_followers: 2, unfollows: 0 }),
    row("2026-10-14", { followers: 110, new_followers: 6, unfollows: 1 }),
  ];
  const series = followerSeries(rows, 5, new Date("2026-10-15T09:00:00Z"));
  // 14: 110 (read) ; 13: 110 − (6 − 1) = 105 ; 12: 105 − 2 = 103 ; 11: 103 − 3 = 100 ; 10: 100 − 3 = 97.
  assert.deepEqual(series.map((p) => [p.day, p.followers, p.counted]), [
    ["2026-10-10", 97, false],
    ["2026-10-11", 100, false],
    ["2026-10-12", 103, false],
    ["2026-10-13", 105, false],
    ["2026-10-14", 110, true],
  ]);
  // Without gains and losses (TikTok), only the counts read.
  const tiktok = followerSeries([row("2026-10-12", { followers: 40 }), row("2026-10-14", { followers: 44 })], 5, new Date("2026-10-15T09:00:00Z"));
  assert.deepEqual(tiktok.map((p) => p.followers), [40, 44]);
});

test("rhythm: a sample week per count, Reels a month of credits holds", async () => {
  const { sampleWeek, RHYTHM_PRESETS } = await import("./rhythm.ts");
  const { PLANS, reelsPerMonth, CARED_REEL_CREDITS } = await import("./plans.ts");
  assert.deepEqual(sampleWeek(3).map((d) => d.day), ["mardi", "jeudi", "samedi"]);
  assert.match(sampleWeek(3)[0]!.idea, /résultat/);
  assert.equal(sampleWeek(0).length, 1);
  assert.equal(sampleWeek(12).length, 7);
  assert.equal(RHYTHM_PRESETS.filter((p) => p.advised).length, 1);
  // Each offer pays for at least one Reel made with care per post of its weekly rhythm (about 4 weeks a month), carousels aside.
  for (const plan of ["essentiel", "pro"] as const) {
    assert.equal(reelsPerMonth(plan), Math.floor(PLANS[plan].credits / CARED_REEL_CREDITS));
    assert.ok(reelsPerMonth(plan) >= PLANS[plan].postsPerWeek * 3, plan);
  }
});

test("voice: Scribe words, phrases on the Reel's clock, subtitles and speech", async () => {
  const { fromScribe, voicePhrases, voiceForEditor, VOICE_AT } = await import("./voice.ts");
  const { buildReelProps } = await import("./motion.ts");
  const t = fromScribe({
    text: "Le secret ? Trois minutes. Pas plus.",
    language_code: "fra",
    audio_duration_secs: 4.2,
    words: [
      { text: "Le", type: "word", start: 0.1, end: 0.2 },
      { text: " ", type: "spacing", start: 0.2, end: 0.25 },
      { text: "secret ?", type: "word", start: 0.25, end: 0.7 },
      { text: "(rires)", type: "audio_event", start: 0.7, end: 1 },
      { text: "Trois", type: "word", start: 1.2, end: 1.5 },
      { text: "minutes.", type: "word", start: 1.5, end: 2 },
      { text: "Pas", type: "word", start: 2.6, end: 2.8 },
      { text: "plus.", type: "word", start: 2.8, end: 3.1 },
    ],
  });
  assert.deepEqual(t.words.map((w) => w.w), ["Le", "secret ?", "Trois", "minutes.", "Pas", "plus."]);
  assert.equal(t.duration, 4.2);
  const phrases = voicePhrases(t);
  assert.deepEqual(phrases.map((p) => p.text), ["Le secret ?", "Trois minutes.", "Pas plus."]);
  assert.equal(phrases[0]!.start, Math.round((0.1 + VOICE_AT) * 100) / 100);
  assert.equal(voiceForEditor(t).ends_at, 4.5);

  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 6,
    subtitles: true,
    segments: [{ clip_id: "a", in: 0, out: 6, zoom: "none" }],
    texts: [],
    images: [],
    voice: { media_id: "v1", at: VOICE_AT },
  });
  const props = buildReelProps(plan, {
    template: "doux",
    clipUrls: { a: "https://x/a.mp4" },
    words: { a: [{ w: "bonjour", start: 1, end: 1.5 }] },
    voice: { src: "https://x/v.ogg", words: t.words },
    brand: { name: "Lune" },
  });
  // Her voice plays from 0.3 s, its words are the subtitles, the clip's own speech stays muted.
  assert.deepEqual(props.voice, { src: "https://x/v.ogg", from: 9 });
  assert.equal(props.words[0]!.w, "Le");
  assert.equal(props.words[0]!.from, 9 + 3);
  assert.equal(props.segments[0]!.type === "clip" && props.segments[0]!.speech, undefined);
  // Without her voice, the clip where someone speaks keeps its sound.
  const { voice: _v, ...noVoice } = plan;
  const plain = buildReelProps(noVoice, { template: "doux", clipUrls: { a: "https://x/a.mp4" }, words: { a: [{ w: "bonjour", start: 1, end: 1.5 }] }, brand: { name: "Lune" } });
  assert.equal(plain.segments[0]!.type === "clip" && plain.segments[0]!.speech, true);
  assert.equal(plain.voice, undefined);
});

test("tempo: cuts and texts on the beats, one signature transition, the rhythm for the critic", async () => {
  const { snapToTempo, beatOf } = await import("./tempo.ts");
  const { normalizeEditPlan } = await import("./editor.ts");
  const { planTimeline } = await import("./motion.ts");
  const { rhythmLine } = await import("./critic.ts");
  const beat = beatOf("dynamique")!; // 120 BPM: 0.5 s
  const plan = editPlanObjectSchema.parse({
    ...validPlan,
    template: "dynamique",
    duration: 6,
    images: [],
    transitions: "cut",
    segments: [
      { clip_id: "a", in: 0, out: 1.37, zoom: "none", accent: "punch" },
      { clip_id: "b", in: 2, out: 3.1, zoom: "none", accent: "wipe" },
      { clip_id: "a", in: 3, out: 5.66, zoom: "none" },
    ],
    texts: [{ text: "Le geste juste", from: 0.1, to: 1.2, style: "hook" }],
  });
  const snapped = snapToTempo(plan, { a: 10, b: 3.3 });
  const starts = planTimeline(snapped).segments.map((s) => s.start);
  for (const t of starts) assert.ok(Math.abs(t - Math.round(t / beat) * beat) < 0.025, `cut at ${t}`);
  assert.equal(snapped.texts[0]!.from, 0);
  assert.ok(snapped.texts[0]!.to - snapped.texts[0]!.from >= 1.5);
  // A clip never goes past its end: b (3.3 s long) starts at 2, so at most 1.3 s → 1 s (2 beats).
  const b = snapped.segments[1]!;
  assert.ok("clip_id" in b && b.out <= 3.3);
  // Crossfades: each cut still on a beat (the overlap is added to the lengths).
  const faded = snapToTempo({ ...plan, template: "doux", transitions: "fade" }, { a: 10, b: 10 });
  const doux = beatOf("doux")!;
  for (const t of planTimeline(faded).segments.map((s) => s.start)) assert.ok(Math.abs(t - Math.round(t / doux) * doux) < 0.025, `faded cut at ${t}`);
  // Over her voice: no grid.
  assert.deepEqual(snapToTempo({ ...plan, voice: { media_id: "v", at: 0.3 } }, { a: 10, b: 3.3 }).segments, plan.segments);

  const normalized = normalizeEditPlan(plan, { a: 10, b: 3.3 });
  assert.equal(normalized.segments.filter((s) => "accent" in s && s.accent).length, 1);
  assert.match(rhythmLine(normalized), /2 coupes sur 2 sur un temps \(120 BPM\)/);
  assert.match(rhythmLine(normalized), /transition signature : punch à la scène 1/);
});

test("editor: the signature transition goes on the shot where the band appears, the schema stays small", async () => {
  const { fromEditorPlan, signatureShot, editorOutputSchema } = await import("./editor.ts");
  const { z } = await import("zod");
  const base = {
    format: "9:16" as const,
    duration: 9,
    template: "dynamique" as const,
    images: [],
    transitions: "cut" as const,
    subtitles: false,
    music: null,
    segments: [
      { clip_id: "a", in: 0, out: 3, zoom: "none" as const },
      { clip_id: "b", in: 0, out: 3, zoom: "none" as const },
      { clip_id: "c", in: 0, out: 3, zoom: "none" as const },
    ],
    texts: [
      { text: "Le geste juste", from: 0, to: 2, style: "hook" as const },
      { text: "Fait main", from: 6, to: 8, style: "band" as const },
    ],
  };
  assert.equal(signatureShot(base), 2);
  const plan = fromEditorPlan(base);
  assert.deepEqual(plan.segments.map((s) => ("accent" in s ? s.accent : undefined)), [undefined, undefined, "punch"]);
  assert.equal(signatureShot({ ...base, texts: [base.texts[0]!] }), null);
  // The editor writes no accent: the structured-output grammar is at the API's limit.
  assert.doesNotMatch(JSON.stringify(z.toJSONSchema(editorOutputSchema, { unrepresentable: "any" })), /"accent":/);
});


test("turn: a step that only adds buttons or a reaction ends the turn", async () => {
  const { endsTurn } = await import("./turn.ts");
  // Her words, then buttons: no new model call, so no second copy of the answer.
  assert.equal(endsTurn(["reply_with"], true), true);
  assert.equal(endsTurn(["react_to_message"], false), true);
  // Buttons with no word yet: she still writes the message they sit under.
  assert.equal(endsTurn(["reply_with"], false), false);
  // Any other tool needs its result read.
  assert.equal(endsTurn(["update_post", "reply_with"], true), false);
  assert.equal(endsTurn([], true), false);
});

test("bank: a clean shot that moves or hooks is kept, a dark or shaky clip is not", async () => {
  const { bankWorthy } = await import("./bank.ts");
  const shot = { start: 0, end: 3, energy: 4, hook_score: 2, quality: { blurry: false, dark: false, shaky: false } };
  assert.equal(bankWorthy({ lighting: "good", shots: [shot] } as never), true);
  assert.equal(bankWorthy({ lighting: "poor", shots: [shot] } as never), false);
  assert.equal(bankWorthy({ lighting: "ok", shots: [{ ...shot, quality: { ...shot.quality, shaky: true } }] } as never), false);
  // Too short, or still and without a hook.
  assert.equal(bankWorthy({ lighting: "ok", shots: [{ ...shot, end: 1 }] } as never), false);
  assert.equal(bankWorthy({ lighting: "ok", shots: [{ ...shot, energy: 1, hook_score: 2 }] } as never), false);
});

test("clip sort: only a sure match on a known publication is kept", async () => {
  const { acceptedSort } = await import("./clip-sort.ts");
  const candidates = new Set(["p1"]);
  assert.equal(acceptedSort({ post_id: "p1", sure: true, why: "" }, candidates), "p1");
  assert.equal(acceptedSort({ post_id: "p1", sure: false, why: "" }, candidates), null);
  assert.equal(acceptedSort({ post_id: "p2", sure: true, why: "" }, candidates), null);
  assert.equal(acceptedSort({ post_id: null, sure: true, why: "" }, candidates), null);
});

test("nudge: one short reminder when nothing went out for a while, never twice a week", async () => {
  const { nudgeAfterDays, shouldNudge, nudgeMessage } = await import("./nudge.ts");
  assert.equal(nudgeAfterDays(3), 4);
  assert.equal(nudgeAfterDays(2), 6);
  assert.equal(nudgeAfterDays(7), 3);
  const base = { daysSince: 6, upcoming: false, daysSinceNudge: null, postsPerWeek: 3 };
  assert.equal(shouldNudge(base), true);
  assert.equal(shouldNudge({ ...base, daysSince: 2 }), false);
  assert.equal(shouldNudge({ ...base, upcoming: true }), false);
  assert.equal(shouldNudge({ ...base, daysSinceNudge: 3 }), false);
  assert.equal(shouldNudge({ ...base, daysSinceNudge: 8 }), true);
  assert.match(nudgeMessage(6, 0), /^Ça fait 6 jours sans publication 🙂 Envoie-moi les photos ou vidéos que tu as sous la main, je m'occupe du reste\.$/);
  assert.match(nudgeMessage(6, 2), /vidéos que j'ai gardées/);
});
