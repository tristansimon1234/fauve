import assert from "node:assert/strict";
import { test } from "node:test";
import { addFacts, readMemory, removeFacts } from "./memory.ts";
import { editPlanObjectSchema, editPlanSchema, segmentSeconds } from "./schemas.ts";
import { canTransition } from "./status.ts";
import { claudeCostUsd, supportsServerFallback, usdToEur } from "./pricing.ts";
import { isInSessionWindow } from "./whatsapp-templates.ts";
import { CREDIT_PRICES } from "./credits.ts";
import { businessFamily, filmIdeas, postIdeas } from "./post-ideas.ts";
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

test("variants: same cut and rhythm with a new hook, priced as a render", async () => {
  const { variantPlan } = await import("./editor.ts");
  const { quoteVariant, CREDIT_PRICES } = await import("./credits.ts");
  const plan = editPlanSchema.parse({ ...validPlan, template: "libre", tempo: 92 });
  const variant = variantPlan(plan, { hook: "Respire. Tout part de là." });
  assert.equal(variant.template, "libre"); // no ambiance to switch any more
  assert.equal(variant.tempo, 92);
  assert.deepEqual(variant.segments, plan.segments); // same cut
  assert.equal(variant.texts[0]!.text, "Respire. Tout part de là.");
  // An older quote asking for another template: the cut, the rhythm and the form stay.
  const old = variantPlan(editPlanSchema.parse({ ...validPlan, template: "collage" }), { template: "doux" } as { hook?: string });
  assert.equal(old.template, "collage");
  assert.equal(old.texts[0]!.text, validPlan.texts[0]!.text); // hook kept when not given
  assert.equal(quoteVariant().max, CREDIT_PRICES.variant);
});

test("the editor chooses each Reel's tempo and the collage form, no ambiance", async () => {
  const { fromEditorPlan, signatureTransition, EDITOR_SYSTEM_PROMPT } = await import("./editor.ts");
  const base = {
    duration: 6,
    segments: [
      { clip_id: "a", in: 0, out: 2, move: "none", speed: 1 },
      { clip_id: "b", in: 0, out: 2, move: "none", speed: 1 },
      { clip_id: "c", in: 0, out: 2, move: "none", speed: 1 },
    ],
    texts: [
      { text: "le geste juste", from: 0, to: 1.8, style: "hook" as const },
      { text: "essai offert", from: 2.1, to: 3.9, style: "band" as const },
    ],
    transitions: "cut" as const,
    subtitles: false,
  };
  const calm = fromEditorPlan({ ...base, tempo: 82, collage: false });
  assert.equal(calm.template, "libre");
  assert.equal(calm.tempo, 82);
  assert.equal(calm.segments.find((s) => "accent" in s && s.accent)?.["accent" as never], "wipe"); // a calm Reel's signature: the wipe
  const lively = fromEditorPlan({ ...base, tempo: 124, collage: false });
  assert.equal(lively.segments.find((s) => "accent" in s && s.accent)?.["accent" as never], "punch");
  assert.equal(fromEditorPlan({ ...base, tempo: 400, collage: false }).tempo, 130); // kept in its range
  assert.equal(fromEditorPlan({ ...base, tempo: 20, collage: false }).tempo, 70);
  const collage = fromEditorPlan({ ...base, tempo: 104, collage: true });
  assert.equal(collage.template, "collage");
  assert.equal(collage.tempo, 104);
  // A plan written with a template (older callers) keeps it.
  assert.equal(fromEditorPlan({ ...base, template: "chic" }).template, "chic");
  assert.equal(signatureTransition("libre"), "punch"); // 100 BPM by default
  assert.equal(signatureTransition("doux"), "wipe");
  assert.doesNotMatch(EDITOR_SYSTEM_PROMPT, /quatre ambiances|default_template/);
  assert.match(EDITOR_SYSTEM_PROMPT, /« tempo »/);
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

test("pricing: Gemini, the sandbox, the music and the transcriptions are priced", async () => {
  const { geminiCostUsd, musicCostUsd, sandboxCostUsd, transcriptionCostUsd } = await import("./pricing.ts");
  const tokens = { input: 1_000_000, output: 100_000 };
  // Introductory Flash price through 2026, doubled from January 1, 2027.
  assert.equal(geminiCostUsd("gemini-3.7-flash", tokens, new Date("2026-10-15T12:00:00Z")), 0.75 + 0.375);
  assert.equal(geminiCostUsd("gemini-3.8-flash", tokens, new Date("2027-01-01T00:00:00Z")), 1.5 + 0.75);
  assert.equal(geminiCostUsd("gemini-unknown", tokens), null);
  // An hour on 4 vCPUs in Paris: CPU on every vCPU and 2 GB of memory each.
  assert.ok(Math.abs(sandboxCostUsd(3600, 4, "cdg1") - 4 * (0.177 + 2 * 0.0292)) < 1e-9);
  assert.ok(sandboxCostUsd(60, 4, "iad1") < sandboxCostUsd(60, 4, "cdg1"));
  assert.equal(sandboxCostUsd(-5, 4), 0);
  assert.ok(Math.abs(musicCostUsd(20) - 0.05) < 1e-9);
  assert.ok(Math.abs(transcriptionCostUsd(3600) - 0.22) < 1e-9);
});

test("when a publication goes out, in her words", async () => {
  const { publishWhen } = await import("./when.ts");
  const now = new Date("2026-10-15T10:00:00Z"); // a Thursday, noon in Paris
  assert.deepEqual(publishWhen("2026-10-16T16:00:00Z", "Europe/Paris", now), { full: "Vendredi 16 octobre à 18 h", short: "demain à 18 h" });
  assert.equal(publishWhen("2026-10-15T16:30:00Z", "Europe/Paris", now).short, "aujourd’hui à 18 h 30");
  assert.equal(publishWhen("2026-10-17T08:00:00Z", "Europe/Paris", now).short, "samedi à 10 h");
  assert.equal(publishWhen("2026-10-24T16:00:00Z", "Europe/Paris", now).short, "le 24 octobre à 18 h");
  assert.equal(publishWhen("2026-11-01T17:00:00Z", "Europe/Paris", now).full, "Dimanche 1er novembre à 18 h");
});

test("créer: the format Simone advises, what fits, and the steps she shows", async () => {
  const { advisedFormat, formatBlocked, mediaPhrase, creationSteps, creationPhase } = await import("./creation.ts");
  assert.equal(advisedFormat({ videos: 1, photos: 3 }), "reel");
  assert.equal(advisedFormat({ videos: 0, photos: 3 }), "carousel");
  assert.equal(advisedFormat({ videos: 0, photos: 1 }), "post");
  assert.equal(advisedFormat({ videos: 0, photos: 0 }), "reel");
  assert.equal(formatBlocked("reel", { videos: 0, photos: 1 }), null);
  assert.ok(formatBlocked("carousel", { videos: 1, photos: 2 }));
  assert.ok(formatBlocked("carousel", { videos: 0, photos: 1 }));
  assert.equal(formatBlocked("post", { videos: 0, photos: 1 }), null);
  assert.ok(formatBlocked("story", { videos: 1, photos: 1 }));
  assert.equal(mediaPhrase({ videos: 3, photos: 1 }), "tes 3 vidéos et ta photo");
  assert.equal(mediaPhrase({ videos: 1, photos: 0 }), "ta vidéo");
  // Rapide: no review; Max: a second version; no music: no composing.
  assert.deepEqual(creationSteps("rapide", { videos: 2, photos: 0 }, true).map((s) => s.phase), ["watch", "edit", "render"]);
  assert.deepEqual(creationSteps("max", { videos: 2, photos: 0 }, true).map((s) => s.phase), ["watch", "edit", "second", "render", "review"]);
  assert.equal(creationSteps("soigne", { videos: 1, photos: 0 }, false).find((s) => s.phase === "render")?.label, "Je monte la vidéo");
  assert.equal(creationPhase(null, false), "watch");
  assert.equal(creationPhase("design", false), "watch");
  assert.equal(creationPhase("design", true), "edit");
  assert.equal(creationPhase("fix", true), "review");
});

test("créer: what she imagines titles the post, and reaches the montage and the voice whole", async () => {
  const { imaginedBrief, intentionTitle } = await import("./creation.ts");
  const idea = "Montre la queue devant le samedi midi, puis comment on fait le sandwich, et finis sur moi. Dis qu'on est ouvert du mercredi au dimanche.";
  assert.equal(intentionTitle(idea), "Montre la queue devant le samedi midi, puis comment on fait…");
  assert.equal(intentionTitle("  Un Reel   pour la rentrée "), "Un Reel pour la rentrée");
  assert.equal(intentionTitle(""), "");
  assert.equal(imaginedBrief(idea), `Ce que la gérante imagine : ${idea}`);
  assert.equal(imaginedBrief("   "), undefined);
});

test("créer: « Oui, publie-le » and « Je regarde d’abord » are answered without Simone", async () => {
  const { publishOfferAnswer, publishQuestion, PUBLISH_OFFER_OPTIONS } = await import("./creation.ts");
  assert.equal(publishOfferAnswer(PUBLISH_OFFER_OPTIONS[0]), "yes");
  assert.equal(publishOfferAnswer(PUBLISH_OFFER_OPTIONS[1]), "look");
  assert.equal(publishOfferAnswer("Je regarde d'abord !"), "look");
  // The draft_ready template's own buttons.
  assert.equal(publishOfferAnswer("Oui, vas-y"), "yes");
  assert.equal(publishOfferAnswer("Je veux le voir"), "look");
  assert.equal(publishOfferAnswer("oui mais change la musique"), null);
  assert.equal(publishQuestion({ full: "Vendredi 16 octobre à 18 h", short: "vendredi à 18 h" }, true), "Je le publie vendredi à 18 h ?");
  assert.equal(publishQuestion({ full: "Vendredi 16 octobre à 18 h", short: "vendredi à 18 h" }, false), "Je le publie maintenant ?");
  assert.ok(PUBLISH_OFFER_OPTIONS.every((o) => o.length <= 20), "WhatsApp reply buttons hold 20 characters");
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
  assert.match(brief, /~15 s, coupes rapides\./); // an older style: its energy in words
  assert.match(planBrief({ ...plan, style: "collage" }), /~15 s, en collage\./);
  assert.match(planBrief({ ...plan, style: undefined }), /~15 s\./);
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

test("plan edit: one thumbnail moment per scene, in its middle", async () => {
  const { sceneTimes } = await import("./plan-edit.ts");
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 8,
    segments: [
      { clip_id: "a", in: 2, out: 5 },
      { scene: { kind: "title", title: "B", background: "accent" }, duration: 2 },
      { clip_id: "c", in: 0, out: 3, speed: 0.5 },
    ],
    texts: [],
    images: [],
  });
  // A slowed clip lasts longer on screen: its middle moves with it.
  assert.deepEqual(sceneTimes(plan), [1.5, 4, 8]);
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
  // A number keeps its word on the same line (« 10 minutes »).
  assert.deepEqual(props.texts[1]?.items?.map((i) => i.title), ["Arriver 10\u00a0minutes avant", "Une gourde"]);
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
  // Exposure is a gamma curve on the mid-tones: a dark clip (+0.3) comes out of the shadow, a bright one (-0.2) goes down.
  const { exposureGamma, EXPOSURE_GAMMAS } = await import("./retouch.ts");
  assert.equal(exposureGamma(0.3), 0.75);
  assert.equal(exposureGamma(-0.2), 1.2);
  assert.equal(exposureGamma(0.01), null);
  assert.equal(exposureGamma(2), 0.6);
  assert.match(cssFilter({ exposure: 0.15, contrast: 0.1 })!, /^url\(#fauve-exposure-85\) contrast\(1\.030\)$/);
  // Every step the filter can point to is drawn.
  for (const e of [-0.5, -0.1, 0.05, 0.2, 0.45]) assert.ok(EXPOSURE_GAMMAS.includes(exposureGamma(e)!), String(e));

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

test("effort: each level adds its review, second version and corrections to what a montage may cost", async () => {
  const { quoteMontage, montageCharge, effortVersions, CREDIT_PRICES } = await import("./credits.ts");
  const { otherEffort } = await import("./effort.ts");
  const rapide = quoteMontage({ clips: 3, correction: false });
  assert.deepEqual(quoteMontage({ clips: 3, correction: false, effort: "rapide" }), rapide); // no level = Rapide, as before
  assert.equal(rapide.fixRounds, 0);

  const soigne = quoteMontage({ clips: 3, correction: false, effort: "soigne" });
  assert.equal(soigne.base, rapide.base + CREDIT_PRICES.review);
  assert.equal(soigne.max, soigne.base + CREDIT_PRICES.fixRound); // the new scenes are already in the price
  assert.ok(soigne.max <= 20); // a cared Reel stays near CARED_REEL_CREDITS

  const max = quoteMontage({ clips: 3, correction: false, effort: "max" });
  assert.equal(max.base, rapide.base + CREDIT_PRICES.alternative + CREDIT_PRICES.review);
  assert.equal(max.fixRounds, 2);
  assert.ok(max.max > soigne.max);

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
  // The first image as the feed shows it, then the hook at 1 s.
  assert.equal(moments[0]!.t, 0.3);
  assert.match(moments[0]!.label, /^1re image/);
  assert.deepEqual(moments[0]!.texts, ["Le cours du matin"]);
  assert.equal(moments[1]!.t, 1);
  assert.match(moments[1]!.label, /^Accroche/);
  assert.equal(moments.at(-1)!.t, 9.5);
  assert.ok(moments.some((m) => m.scene === 2 && m.texts.includes("RENTRÉE"))); // the animation's slot text
  assert.ok(moments.every((m, i) => i === 0 || m.t > moments[i - 1]!.t));

  // Many scenes: at most `max` frames, the first image, the hook and the end kept.
  const long = editPlanSchema.parse({
    ...plan,
    duration: 30,
    segments: Array.from({ length: 15 }, (_, i) => ({ clip_id: `c${i}`, in: 0, out: 2 })),
  });
  const few = reviewMoments(long, 6);
  assert.equal(few.length, 6);
  assert.deepEqual([few[0]!.t, few[1]!.t], [0.3, 1]);
  assert.equal(few.at(-1)!.t, 29.5);

  // An animation over several shots is looked at in its middle, with its words, whatever the scenes (a
  // boutique's « -20 % » caught between her fingers was judged missing: no scene's middle fell on it).
  const layered = editPlanSchema.parse({ ...plan, layers: [{ motion: { brief: "le -20 % attrapé puis lancé", texts: { promo: "-20 %" } }, from: 2, to: 5.5 }] });
  const caught = reviewMoments(layered).find((m) => m.t === 3.75);
  assert.match(caught!.label, /^Animation sur plusieurs plans \(de 2 à 5,5 s\)/);
  assert.ok(caught!.texts.includes("-20 %"));
  // Kept when the scenes leave no room.
  const counted = reviewMoments(editPlanSchema.parse({ ...long, layers: [{ motion: { brief: "un compteur" }, from: 10, to: 14 }] }), 6);
  assert.equal(counted.length, 6);
  assert.ok(counted.some((m) => m.t === 12 && m.label.startsWith("Animation")));

  const brief = fixBrief({ score: 6, issues: [{ scene: 1, problem: "accroche trop longue", fix: "la réduire à 3 mots" }] }, "Ouverture dynamique");
  assert.match(brief, /6\/10/);
  assert.match(brief, /Scène 1 : accroche trop longue → la réduire à 3 mots/);
  assert.match(brief, /Ouverture dynamique/);
  // A face under a text: the text moves, the shot stays; a collage keeps its form and its richness.
  assert.match(brief, /le plan reste/);
  assert.match(brief, /jamais une forme à prendre/);
  assert.match(alternativeBrief(plan, null), /Deuxième version/);
  assert.match(planDigest(plan), /Accroche : « Le cours du matin »/);
});

test("critic: the manager's line never says what is left to do", async () => {
  const { managerLine, normalizeReview } = await import("./critic.ts");
  // Culte's free collage was delivered with « Il reste à dégager les visages… ».
  assert.equal(
    managerLine("J'ai vérifié l'accroche, les coupes sur la musique et la fin avec l'offre. Il reste à dégager les visages de l'accroche et à mettre plus de monde dans le collage."),
    "J'ai vérifié l'accroche, les coupes sur la musique et la fin avec l'offre.",
  );
  assert.equal(managerLine("J'ai raccourci l'accroche et retiré un plan flou."), "J'ai raccourci l'accroche et retiré un plan flou.");
  assert.equal(managerLine("Il faudrait encore resserrer la fin."), "");
  const review = normalizeReview({ best: 1, why: "", score: 8, hook: 8, ok: true, issues: [], summary: "J'ai vérifié les coupes. Il reste à éclaircir la scène 2." }, 1);
  assert.equal(review.summary, "J'ai vérifié les coupes.");
  const { MONTAGE_CRITIC_PROMPT } = await import("./critic.ts");
  assert.match(MONTAGE_CRITIC_PROMPT, /jamais de changer le plan/);
  assert.match(MONTAGE_CRITIC_PROMPT, /jamais une forme à prendre/);
});

test("critic: an overlong answer is clamped, not thrown away; lateness is measured from the last step", async () => {
  const { normalizeReview } = await import("./critic.ts");
  const { effortPitch, montageLate } = await import("./effort.ts");
  const long = "x".repeat(500);
  const review = normalizeReview(
    { best: 5, why: long, score: 14, hook: 0, ok: false, summary: long, issues: Array.from({ length: 6 }, () => ({ scene: 99, problem: long, fix: long })) },
    2,
  );
  assert.equal(review.best, 2); // within the versions shown
  assert.equal(review.score, 10);
  assert.equal(review.hook, 1);
  assert.equal(review.issues.length, 4);
  assert.equal(review.issues[0]!.scene, 30);
  assert.equal(review.issues[0]!.problem.length, 200);
  assert.equal(review.summary.length, 300);

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
  // A reworded button still replaces its own line (one per kind), older wording included.
  const reworded = withAdjustment("Tons clairs.\nAjustement de la gérante — Plus chaleureux : tons chauds, rythme posé.", "warmer");
  assert.equal(reworded.split("\n").filter((l) => /Plus chaleureux/.test(l)).length, 1);
  assert.ok(reworded.endsWith("rythme posé.") && reworded.includes("des visages"));
});

test("the first Reel's buttons and the ambiances speak plain words", async () => {
  const { STYLE_CHECK_OPTIONS } = await import("./restyle.ts");
  assert.deepEqual(STYLE_CHECK_OPTIONS, ["Ça me ressemble", "Plus rapide", "Moins de texte", "Plus chaleureux", "Autre chose"]);
  const { AMBIANCES, MOTION_TEMPLATES } = await import("./schemas.ts");
  for (const t of MOTION_TEMPLATES) {
    const { label, hint, photo } = AMBIANCES[t];
    assert.ok(label && hint && photo, t);
    assert.doesNotMatch(`${label} ${hint} ${photo}`, /dynamique|pêchu|doux\b|chic\b/i, "no designer's adjective on screen");
  }
  // No ambiance to choose any more: each Reel its own rhythm, in the look of her charter.
  const { FAUVE_SYSTEM_PROMPT } = await import("./prompts.ts");
  assert.ok(FAUVE_SYSTEM_PROMPT.includes("chaque Reel à son rythme") && !FAUVE_SYSTEM_PROMPT.includes("« Coupes rapides »"));
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
  // A short label on the button, a whole example request in the field: how it starts, how it ends.
  const dish = postIdeas("restaurant").reel.find((i) => i.label === "Le plat du jour");
  assert.ok(dish && /Commence par/.test(dish.prompt) && dish.prompt.length <= 500);
  for (const kinds of ["studio de Pilates", "Salon de coiffure", "brasserie", "fleuriste", null].map((b) => postIdeas(b))) {
    for (const list of Object.values(kinds)) assert.ok(list.length >= 4 && list.every((i) => i.label.length <= 34 && i.prompt.length <= 260));
  }
  assert.equal(filmIdeas("Salon de coiffure").length, 3);
  assert.ok(filmIdeas(null).every((f) => f.idea && f.how));
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

test("voice over: when Simone puts her voice on a Reel, and which voice", async () => {
  const { wantsVoiceOver, findVoice, readVoiceSetting, readPostVoice, SIMONE_VOICES, DEFAULT_VOICE_ID } = await import("./voice-over.ts");
  const base = { post: null, studio: "auto" as const, onReel: null, correction: false, speechInClips: false, footageSeconds: 14, photos: 0 };
  // Auto: a new Reel whose images tell something, with nobody speaking and enough to show.
  assert.equal(wantsVoiceOver(base), true);
  assert.equal(wantsVoiceOver({ ...base, speechInClips: true }), false);
  assert.equal(wantsVoiceOver({ ...base, footageSeconds: 6 }), false);
  assert.equal(wantsVoiceOver({ ...base, footageSeconds: 6, photos: 2 }), true);
  // A correction keeps what the Reel had, unless she asked for a voice on it.
  assert.equal(wantsVoiceOver({ ...base, correction: true }), false);
  assert.equal(wantsVoiceOver({ ...base, correction: true, post: { mode: "on" } }), true);
  // The studio's setting, then the Reel's own choice over it.
  assert.equal(wantsVoiceOver({ ...base, studio: "never" }), false);
  assert.equal(wantsVoiceOver({ ...base, studio: "never", post: { mode: "on" } }), true);
  assert.equal(wantsVoiceOver({ ...base, studio: "always", speechInClips: true }), true);
  assert.equal(wantsVoiceOver({ ...base, studio: "always", post: { mode: "off" } }), false);
  // Her own voice note is never covered; Simone's voice is made again only when asked (another text or voice).
  assert.equal(wantsVoiceOver({ ...base, onReel: "hers", post: { mode: "on", remake: true } }), false);
  assert.equal(wantsVoiceOver({ ...base, onReel: "simone", post: { mode: "on" } }), false);
  assert.equal(wantsVoiceOver({ ...base, onReel: "simone", post: { mode: "on", remake: true } }), true);
  // Voices by name or id, the first one by default; broken settings read as auto.
  assert.equal(findVoice("jules")?.id, "8qnuneLiGjGrT4A62CCe");
  assert.equal(findVoice("D6VK2PsbVdaFL5aALfRc")?.name, "Eva");
  assert.equal(findVoice("Gérard"), undefined);
  assert.equal(DEFAULT_VOICE_ID, SIMONE_VOICES[0].id);
  assert.equal(SIMONE_VOICES.length, 8);
  // The whispered voices are hers to choose: never the default.
  assert.equal(SIMONE_VOICES[0].asmr, false);
  assert.deepEqual(SIMONE_VOICES.filter((v) => v.asmr).map((v) => v.name), ["Koraly", "Mister K"]);
  assert.equal(findVoice("mister k")?.id, "k1w1SeihHyKDJXr7nZRX");
  assert.deepEqual(readVoiceSetting(undefined), { use: "auto" });
  assert.deepEqual(readVoiceSetting({ use: "loud" }), { use: "auto" });
  assert.equal(readPostVoice({ mode: "maybe" }), null);
  assert.deepEqual(readPostVoice({ mode: "on", wish: "parle de la promo" }), { mode: "on", wish: "parle de la promo" });
});

test("music: the composer's ending falls after the Reel, a beat that falls away inside it is found", async () => {
  const { BASS_LEVELS_FILTER, grooveGaps, musicTail } = await import("./mix.ts");
  // The composer watches the Reel then its first 6 s (all of a short one), as Instagram loops it.
  assert.equal(musicTail(11.67), 6);
  assert.equal(musicTail(4.2), 4.2);
  assert.match(BASS_LEVELS_FILTER, /lowpass=f=150.*asetnsamples=n=4000:p=0.*RMS_level$/);
  // Culte's collage, bass every half second: the groove (-15 dB) stops at 6.5 s, then the piece dies away.
  const culte = [-15.3, -15.7, -15.1, -15.7, -15.1, -15.6, -15.2, -16.4, -18.2, -16.8, -15.7, -14.9, -15.8, -37.4, -37.8, -37.1, -39, -55.4, -45, -48.8, -54.4, -61.8, -73.5, -Infinity];
  assert.deepEqual(grooveGaps(culte, 11.67), [{ from: 6.5, to: 10.5 }]);
  // A groove that holds, a kick missing here and there: nothing.
  const holds = Array.from({ length: 24 }, (_, i) => (i % 5 === 3 ? -21 : -15));
  assert.deepEqual(grooveGaps(holds, 11.67), []);
  // A break of a second in the middle is found; an ending inside the mix's own fade is not.
  const broken = [...holds.slice(0, 10), -40, -40, ...holds.slice(12)];
  assert.deepEqual(grooveGaps(broken, 11.67), [{ from: 5, to: 6 }]);
  assert.deepEqual(grooveGaps([...holds.slice(0, 22), -60, -70], 11.67), []);
  // A piece without a beat (all quiet alike) is not a break.
  assert.deepEqual(grooveGaps(Array.from({ length: 20 }, () => -48), 10), []);
});

test("music: the piece's beats are found and set on the cuts' grid", async () => {
  const { BEAT_STEP, beatGrid, coarser } = await import("./mix.ts");
  // Bass every 10 ms, each step the mean power of what it holds (an attack starts inside a step):
  // a kick (-10 dB, then decaying) every `period` from `offset`, over a soft bed with some noise.
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 4;
  const kick = (since: number) => (since < 0.02 ? -10 : since < 0.1 ? -18 : -42 + noise());
  const piece = (period: number, offset: number, seconds = 18, level = kick) =>
    Array.from({ length: Math.round(seconds / BEAT_STEP) }, (_, i) => {
      let power = 0;
      for (let j = 0; j < 10; j++) power += 10 ** (level((i * BEAT_STEP + (j * BEAT_STEP) / 10 - offset + period * 100) % period) / 10) / 10;
      return 10 * Math.log10(power);
    });
  // Asked at 108 BPM, played a hair slow with its first kick 40 ms in: found within a few milliseconds.
  const grid = beatGrid(piece(0.5547, 0.04), 60 / 108)!;
  assert.ok(Math.abs(grid.period - 0.5547) < 0.0005, `${grid.period}`);
  assert.ok(Math.abs(grid.offset - 0.04) <= 0.005, `${grid.offset}`);
  // A bass that never stops (Culte's): a short dip before each beat, then it swells back over 30 ms. Its
  // biggest jump in power comes 20 ms after the beat starts; the beat is still found where it starts.
  const swell = (since: number) => (since > 0.5347 ? -28 : since < 0.01 ? -19 : since < 0.02 ? -16 : since < 0.03 ? -14 : -13 + noise() / 4);
  const swelling = beatGrid(piece(0.5547, 0.06, 18, swell), 60 / 108)!;
  assert.ok(Math.abs(swelling.offset - 0.06) <= 0.005, `${swelling.offset}`);
  // Played at another tempo (120 BPM), or without a beat: left as it is.
  assert.equal(beatGrid(piece(0.5, 0.1), 60 / 108), null);
  assert.equal(beatGrid(Array.from({ length: 1800 }, () => -40 + noise()), 60 / 108), null);
  // Every 10 ms read every half second: their mean power.
  assert.deepEqual(coarser([-10, -10, -20, -20], 2).map(Math.round), [-10, -20]);
});

test("review: the sentence she reads is never cut in the middle of a word", async () => {
  const { shortSentence } = await import("./critic.ts");
  const said =
    "J'ai vérifié que l'accroche était lisible dès la 1re image, que le collage respectait la charte et que le rythme était bon ; il restait à remplacer les plans vides ou sombres par des plans avec des gens, et à rendre l'appel final plus lisible.";
  assert.equal(shortSentence(said, 300), said);
  // Too long: cut on a word, with « … » (before, « plus lisib »).
  const cut = shortSentence(said, 240);
  assert.ok(cut.length <= 240);
  assert.match(cut, / plus…$/);
  // Two sentences: the first one whole.
  assert.equal(shortSentence(`J'ai raccourci l'accroche. ${said}`, 120), "J'ai raccourci l'accroche.");
  assert.equal(shortSentence("  deux   espaces  ", 50), "deux espaces");
});

test("mix: what is said at the level of a voice, the music under it and still heard", async () => {
  const { mixGains, mixFilter, previewMusic, speechWindows, speechGain, SPEECH_LUFS } = await import("./mix.ts");
  const { buildReelProps } = await import("./motion.ts");
  // A quiet ElevenLabs voice (-30 LUFS) over music as composed (-15): the voice comes up, the music goes under it.
  const voiceOver = mixGains({ speech: -30, music: -15.7 }, true);
  assert.equal(voiceOver.kind, "voice_over");
  assert.equal(voiceOver.speechGain, 16);
  assert.equal(voiceOver.musicGain, -4.3);
  assert.ok(voiceOver.duck);
  // Someone speaks in a shot: the music keeps its level and ducks harder under them.
  const inClips = mixGains({ speech: -21, music: -15 }, false);
  assert.equal(inClips.kind, "speech_in_clips");
  assert.equal(inClips.musicGain, 0);
  assert.ok(inClips.duck!.ratio > voiceOver.duck!.ratio);
  // Nothing said (silence measures -70, or no sound track): the music alone, never ducked.
  for (const speech of [-70, null]) {
    const alone = mixGains({ speech, music: -15.3 }, true);
    assert.equal(alone.kind, "music");
    assert.equal(alone.duck, null);
    assert.equal(alone.speechGain, 0);
  }
  // A whisper is not blown up, a shout is brought down.
  assert.equal(speechGain(-44), 20);
  assert.equal(speechGain(-4), SPEECH_LUFS + 4);
  assert.equal(speechGain(-60), null);
  // The filter graph: ducked under the leveled voice, peaks held, faded at the end; the music alone without a key.
  const graph = mixFilter(voiceOver, 12.18);
  assert.match(graph, /\[0:a\][^;]*volume=16dB,asplit=2\[key\]\[own\]/);
  assert.match(graph, /\[m\]\[key\]sidechaincompress=threshold=0\.03:ratio=1\.6/);
  assert.match(graph, /alimiter=limit=0\.891:level=false,afade=t=out:st=12\.18:d=0\.8\[a\]$/);
  assert.doesNotMatch(mixFilter(mixGains({ speech: null, music: -15 }, false), 10), /\[0:a\]/);
  assert.doesNotMatch(mixFilter(voiceOver, null), /afade/);

  // Pauses under half a second keep the music down.
  assert.deepEqual(speechWindows([{ from: 30, to: 40 }, { from: 9, to: 20 }, { from: 22, to: 28 }], 15), [[9, 40]]);
  assert.deepEqual(speechWindows([{ from: 9, to: 20 }, { from: 60, to: 70 }], 15), [[9, 20], [60, 70]]);
  assert.deepEqual(previewMusic("music", []), { volume: 1 });
  const preview = previewMusic("voice_over", [[9, 40]]);
  assert.equal(preview.volume, 0.56);
  assert.equal(preview.duck!.volume, 0.28);

  // In the live preview: the music lower under her voice, and lower still while it speaks.
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 6,
    subtitles: false,
    segments: [{ clip_id: "a", in: 0, out: 6, zoom: "none" }],
    texts: [],
    images: [],
    voice: { media_id: "v1", at: 0.3 },
  });
  const words = [
    { w: "Le", start: 0.1, end: 0.2 },
    { w: "secret.", start: 0.25, end: 0.7 },
    { w: "Viens.", start: 3, end: 3.4 },
  ];
  const props = buildReelProps(plan, { template: "doux", clipUrls: { a: "https://x/a.mp4" }, voice: { src: "https://x/v.mp3", words }, soundtrack: "https://x/m.mp3", brand: { name: "Lune" } });
  assert.deepEqual(props.soundtrack, { src: "https://x/m.mp3", volume: 0.56, duck: { volume: 0.28, windows: [[12, 30], [99, 111]] } });
  // Without a voice nor anyone speaking: the music as it is.
  const { voice: _v, ...noVoice } = plan;
  const plain = buildReelProps(noVoice, { template: "doux", clipUrls: { a: "https://x/a.mp4" }, soundtrack: "https://x/m.mp3", brand: { name: "Lune" } });
  assert.deepEqual(plain.soundtrack, { src: "https://x/m.mp3", volume: 1 });
  // Someone speaks in the clip: the music at its level, down while they speak.
  const talking = buildReelProps(noVoice, { template: "doux", clipUrls: { a: "https://x/a.mp4" }, words: { a: [{ w: "bonjour", start: 1, end: 1.5 }] }, soundtrack: "https://x/m.mp3", brand: { name: "Lune" } });
  assert.deepEqual(talking.soundtrack, { src: "https://x/m.mp3", volume: 1, duck: { volume: 0.13, windows: [[30, 45]] } });
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

  // A Reel's own tempo (no ambiance): its cuts on its beats, its BPM told to the critic.
  const own = snapToTempo({ ...plan, template: "libre", tempo: 90 }, { a: 10, b: 10 });
  const ninety = 60 / 90;
  for (const t of planTimeline(own).segments.map((s) => s.start)) assert.ok(Math.abs(t - Math.round(t / ninety) * ninety) < 0.025, `own-tempo cut at ${t}`);
  assert.match(rhythmLine(normalizeEditPlan({ ...plan, template: "libre", tempo: 90 }, { a: 10, b: 10 })), /\(90 BPM\)/);
  // A « libre » plan without a tempo: 100 BPM.
  assert.match(rhythmLine(normalizeEditPlan({ ...plan, template: "libre" }, { a: 10, b: 10 })), /\(100 BPM\)/);
});

test("formats: a key message held all along, film dust when the editor asks, French spaces on screen", async () => {
  const { fromEditorPlan, editorOutputSchema } = await import("./editor.ts");
  const { buildReelProps, frenchSpaces } = await import("./motion.ts");
  const { qualityChecks } = await import("./critic.ts");
  const { voiceOverDecisionSchema, reelFormatSchema } = await import("./voice-over.ts");
  const output = {
    duration: 12,
    tempo: 118,
    collage: false,
    segments: [
      { clip_id: "a", in: 0, out: 1.5, move: "none", speed: 1 },
      { clip_id: "b", in: 0, out: 1.5, move: "none", speed: 1 },
      { clip_id: "a", in: 3, out: 4.5, move: "none", speed: 1 },
    ],
    texts: [{ text: "offre de rentrée : -15 % sur les cours", from: 0, to: 4.5, style: "hook" as const, items: [{ title: "code CULTE1" }] }],
    transitions: "cut" as const,
    subtitles: false,
    effect: "dust" as const,
  };
  assert.equal(editorOutputSchema.safeParse({ plan: output, rationale: "message clé" }).success, true);
  const plan = fromEditorPlan(output as never);
  assert.equal(plan.effect, "dust");
  assert.equal(fromEditorPlan({ ...output, effect: "none" } as never).effect, undefined);
  const parsed = editPlanSchema.parse(plan);
  const props = buildReelProps(parsed, { template: "dynamique", clipUrls: { a: "https://x/a.mp4", b: "https://x/b.mp4" }, brand: { name: "Culte" } });
  assert.equal(props.effect, "dust");
  // « : » never starts a line.
  assert.equal(props.texts[0]!.text, "offre de rentrée\u202f: -15\u202f% sur les cours");
  assert.equal(frenchSpaces("Prête ? « Viens » !"), "Prête\u202f? «\u202fViens\u202f»\u202f!");
  // One message held all along passes the checks: it is the hook, and the only text.
  const checks = qualityChecks(parsed);
  assert.equal(checks.find((c) => c.key === "hook")!.ok, true);
  assert.equal(checks.find((c) => c.key === "texts")!.ok, true);
  // The writer chooses the form first: a key message comes back with nothing to read.
  assert.deepEqual(reelFormatSchema.options, ["raconte", "message"]);
  assert.equal(voiceOverDecisionSchema.safeParse({ format: "message", why: "une offre", hooks: [], rest: "" }).success, true);
});

test("lab fixes: lines that hold together, a breath between sentences, subtitles off faces, the format told to the critic", async () => {
  const { frenchSpaces } = await import("./motion.ts");
  const { sentencePauses, withPauses, SENTENCE_GAP } = await import("./voice-over.ts");
  const { pauseFilter } = await import("./mix.ts");
  const { subtitleRow, SUBTITLE_ROW } = await import("./retouch.ts");
  const { formatLine } = await import("./critic.ts");
  // A number never ends a line apart from the word it counts; « 65 € » stays together as before.
  assert.equal(frenchSpaces("ta rentrée : 3 cours à 65 €"), "ta rentrée\u202f: 3\u00a0cours à 65\u202f€");
  assert.equal(frenchSpaces("ouvert dès 7 h"), "ouvert dès 7\u00a0h");
  assert.equal(frenchSpaces("le 12 mars, 2 places"), "le 12\u00a0mars, 2\u00a0places");
  // Two sentences read in one breath get a silence between them; a real pause is left alone.
  const words = [
    { w: "Voilà", start: 7.6, end: 7.84 },
    { w: "le", start: 7.92, end: 8 },
    { w: "maître.", start: 8.04, end: 8.8 },
    { w: "Du", start: 8.84, end: 8.88 },
    { w: "dimanche.", start: 8.96, end: 9.4 },
    { w: "Viens", start: 10, end: 10.3 },
  ];
  const pauses = sentencePauses(words);
  assert.deepEqual(pauses, [{ at: 8.82, add: Math.round((SENTENCE_GAP - 0.04) * 100) / 100 }]);
  const paused = withPauses({ text: "", duration: 10.5, words, language: "fr" }, pauses);
  assert.equal(paused.words[2]!.end, 8.8);
  assert.equal(paused.words[3]!.start, 9.15);
  assert.equal(paused.duration, 10.81);
  assert.equal(withPauses(paused, []), paused);
  const graph = pauseFilter(pauses, "volume=2dB");
  assert.match(graph, /asplit=2\[a0\]\[a1\]/);
  assert.match(graph, /\[a0\]atrim=end=8\.820/);
  assert.match(graph, /aevalsrc=0:c=mono:s=44100:d=0\.310/);
  assert.match(graph, /concat=n=3:v=0:a=1,volume=2dB\[out\]$/);
  // A face on the subtitles' row sends them to the nearest clear row; a clear row stays.
  assert.equal(subtitleRow([]), null);
  assert.equal(subtitleRow([{ x: 0.3, y: 0.2, w: 0.4, h: 0.2 }]), null);
  const moved = subtitleRow([{ x: 0.3, y: SUBTITLE_ROW.y - 0.05, w: 0.4, h: 0.12 }]);
  assert.ok(moved !== null && (moved + SUBTITLE_ROW.h < SUBTITLE_ROW.y - 0.05 || moved > SUBTITLE_ROW.y + 0.07));
  // The form she chose is judged as hers: a collage stays a collage after the review.
  const { ambianceLine } = await import("./critic.ts");
  assert.match(ambianceLine("collage")!, /le collage.*jamais le collage lui-même/);
  assert.match(ambianceLine("chic")!, /Sobre et élégant/); // a Reel made before keeps its ambiance
  assert.equal(ambianceLine("libre"), null); // its own rhythm: nothing to hold the critic to
  assert.equal(ambianceLine(null), null);
  assert.equal(ambianceLine("class_of_the_day"), null);
  // The critic judges a key message held on screen as the point of the format.
  assert.match(formatLine("message")!, /message clé/);
  assert.match(formatLine("raconte")!, /voix/);
  assert.equal(formatLine(undefined), null);
});

test("quality checks: what the Reels that work have, read on the plan for the critic", async () => {
  const { qualityChecks, qualityLine } = await import("./critic.ts");
  const { normalizeEditPlan } = await import("./editor.ts");
  // A tight Reel: a video first, a hook in the first second, short shots on the beat, the last shot back on the first clip.
  const good = normalizeEditPlan(
    editPlanObjectSchema.parse({
      ...validPlan,
      template: "dynamique",
      duration: 6,
      images: [],
      segments: [
        { clip_id: "a", in: 0, out: 1.5, zoom: "none" },
        { clip_id: "b", in: 0, out: 1.5, zoom: "none" },
        { clip_id: "c", in: 0, out: 1.5, zoom: "none" },
        { clip_id: "a", in: 3, out: 4.5, zoom: "none" },
      ],
      texts: [
        { text: "6 h 45, personne ne sait", from: 0, to: 1.6, style: "hook" },
        { text: "réserve ton essai", from: 4.5, to: 6, style: "caption" },
      ],
    }),
    { a: 10, b: 10, c: 10 },
  );
  assert.ok(qualityChecks(good).every((c) => c.ok), qualityLine(good));
  assert.doesNotMatch(qualityLine(good), /à revoir/);
  // A still photo first, no hook, long shots off the beat, an end elsewhere, four texts: each one to look at again.
  const slow = editPlanObjectSchema.parse({
    ...validPlan,
    template: "doux",
    duration: 12,
    images: [],
    subtitles: false,
    segments: [
      { clip_id: "p1", in: 0, out: 4, zoom: "none", photo: { source: { width: 1080, height: 1350 } } },
      { clip_id: "b", in: 0, out: 4, zoom: "none" },
      { clip_id: "c", in: 0, out: 4, zoom: "none" },
    ],
    texts: [
      { text: "un", from: 2, to: 4, style: "caption" },
      { text: "deux", from: 4, to: 6, style: "caption" },
      { text: "trois", from: 6, to: 8, style: "caption" },
      { text: "quatre", from: 8, to: 10, style: "caption" },
    ],
  });
  const failed = qualityChecks(slow).filter((c) => !c.ok).map((c) => c.key);
  assert.deepEqual(failed.sort(), ["beat", "hook", "loop", "motion", "opening", "pace", "texts"]);
  assert.match(qualityLine(slow), /à revoir : la 1re image est une photo fixe, aucune accroche écrite/);
  // The same photo with a slow move: it moves.
  const moving = { ...slow, segments: [{ ...slow.segments[0]!, move: "in" as const }, ...slow.segments.slice(1)] };
  assert.equal(qualityChecks(moving).find((c) => c.key === "motion")!.ok, true);
  // An end elsewhere is a tip, never a reason to refuse; someone's sentence held 7 s stays out of the pace.
  assert.equal(qualityChecks(slow).find((c) => c.key === "loop")!.must, false);
  assert.match(qualityLine(slow), /à tenter si un clip le permet : la fin ne reboucle pas/);
  const talk = editPlanObjectSchema.parse({
    ...validPlan,
    template: "doux",
    duration: 10,
    images: [],
    segments: [
      { clip_id: "a", in: 0, out: 1.5, zoom: "none" },
      { clip_id: "t", in: 0, out: 7, zoom: "none" },
      { clip_id: "a", in: 2, out: 3.5, zoom: "none" },
    ],
  });
  assert.equal(qualityChecks(talk).find((c) => c.key === "pace")!.ok, true);
});

test("editor: the signature transition goes on the shot where the band appears, the schema stays small", async () => {
  const { fromEditorPlan, signatureShot, editorOutputSchema } = await import("./editor.ts");
  const { z } = await import("zod");
  const base = {
    format: "9:16" as const,
    duration: 11,
    template: "dynamique" as const,
    images: [],
    transitions: "cut" as const,
    subtitles: false,
    music: null,
    segments: [
      { clip_id: "a", in: 0, out: 3, zoom: "none" as const },
      { clip_id: "b", in: 0, out: 3, zoom: "none" as const },
      { clip_id: "c", in: 0, out: 3, zoom: "none" as const },
      { clip_id: "d", in: 0, out: 2, zoom: "none" as const },
    ],
    texts: [
      { text: "Le geste juste", from: 0, to: 2, style: "hook" as const },
      { text: "Fait main", from: 6, to: 8, style: "band" as const },
    ],
  };
  assert.equal(signatureShot(base), 2);
  const plan = fromEditorPlan(base);
  assert.deepEqual(plan.segments.map((s) => ("accent" in s ? s.accent : undefined)), [undefined, undefined, "punch", undefined]);
  assert.equal(signatureShot({ ...base, texts: [base.texts[0]!] }), null);
  // The editor writes no accent: the structured-output grammar is at the API's limit.
  assert.doesNotMatch(JSON.stringify(z.toJSONSchema(editorOutputSchema, { unrepresentable: "any" })), /"accent":/);
});


test("turn: a step that closes her message with its own words ends the turn", async () => {
  const { endsTurn } = await import("./turn.ts");
  // Her words with buttons or a reaction: no new model call, so no second copy of the answer.
  assert.equal(endsTurn(["reply_with"], true), true);
  assert.equal(endsTurn(["react_to_message"], true), true);
  // Buttons or a reaction alone: the answer is still to come (an earlier « je regarde » is no answer).
  assert.equal(endsTurn(["reply_with"], false), false);
  assert.equal(endsTurn(["react_to_message"], false), false);
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
  const base = { daysSince: 6, upcoming: false, daysSinceNudge: null, unanswered: 0, postsPerWeek: 3 };
  assert.equal(shouldNudge(base), true);
  assert.equal(shouldNudge({ ...base, daysSince: 2 }), false);
  assert.equal(shouldNudge({ ...base, upcoming: true }), false);
  assert.equal(shouldNudge({ ...base, daysSinceNudge: 3 }), false);
  assert.equal(shouldNudge({ ...base, daysSinceNudge: 8 }), true);
  // Two reminders without an answer: no more until she writes.
  assert.equal(shouldNudge({ ...base, daysSinceNudge: 8, unanswered: 1 }), true);
  assert.equal(shouldNudge({ ...base, daysSinceNudge: 30, unanswered: 2 }), false);
  assert.match(nudgeMessage(6, 0), /^Ça fait 6 jours sans publication 🙂 Envoie-moi les photos ou vidéos que tu as sous la main, je m'occupe du reste\.$/);
  assert.match(nudgeMessage(6, 2), /vidéos que j'ai gardées/);
});

test("access: the first publication is free, then nothing without a subscription, nothing without credits", async () => {
  const { accessOf, FREE_ANALYSES } = await import("./access.ts");
  // Onboarding: her first publication is made in full, but stays locked.
  const first = accessOf({ subscription: null, firstPostMade: false, credits: 220, analyses: 0 });
  assert.deepEqual([first.create, first.analyze, first.unlock], [true, true, false]);
  assert.equal(accessOf({ subscription: null, firstPostMade: false, credits: 220, analyses: FREE_ANALYSES }).analyze, false);
  // Made: nothing else until she subscribes.
  const after = accessOf({ subscription: null, firstPostMade: true, credits: 220, analyses: 2 });
  assert.deepEqual([after.create, after.analyze, after.unlock, after.reason], [false, false, false, "subscribe"]);
  assert.equal(accessOf({ subscription: "canceled", firstPostMade: true, credits: 220, analyses: 2 }).create, false);
  // Trial or active: everything, while there are credits.
  const trial = accessOf({ subscription: "trialing", firstPostMade: true, credits: 40, analyses: 9 });
  assert.deepEqual([trial.create, trial.analyze, trial.unlock], [true, true, true]);
  const empty = accessOf({ subscription: "active", firstPostMade: true, credits: 0, analyses: 9 });
  assert.deepEqual([empty.create, empty.analyze, empty.unlock, empty.reason], [false, false, true, "credits"]);
});

test("photo text: a Reel's text moves off text already in the photo", async () => {
  const { avoidPhotoText } = await import("./retouch.ts");
  // Lettering across the lower middle of the photo, where a caption sits by default.
  const shots = [{ start: 0, length: 2, boxes: [{ x: 0.1, y: 0.6, w: 0.8, h: 0.1 }] }, { start: 2, length: 2, boxes: [] }];
  const [caption, hook, later, placed] = avoidPhotoText(
    [
      { from: 0, to: 1.5, style: "caption" as const },
      { from: 0, to: 1.5, style: "hook" as const },
      { from: 2.5, to: 4, style: "caption" as const },
      { from: 0, to: 1.5, style: "caption" as const, y: 0.6 },
    ],
    shots,
  );
  assert.notEqual(caption!.y, undefined);
  assert.ok(caption!.y! + 0.1 < 0.6 || caption!.y! > 0.7);
  // Clear where it is, on another shot, or placed by hand: untouched.
  assert.equal(hook!.y, undefined);
  assert.equal(later!.y, undefined);
  assert.equal(placed!.y, 0.6);
});

test("end card: the Reel ends on a real shot and no text runs under the card", async () => {
  const { normalizeEditPlan } = await import("./editor.ts");
  const plan = {
    format: "9:16",
    duration: 8,
    template: "dynamique",
    segments: [
      { clip_id: "a", in: 0, out: 3, zoom: "none" },
      { scene: { kind: "title", title: "Offre", background: "accent" }, duration: 2.5 },
    ],
    texts: [{ text: "Viens essayer", from: 0, to: 6, style: "hook", emphasis: [] }],
    images: [],
    transitions: "cut",
    subtitles: false,
    music: null,
    end_card: { title: "indar" },
  } as never;
  const out = normalizeEditPlan(plan, { a: 9 });
  assert.equal("clip_id" in out.segments.at(-1)!, true);
  assert.ok(out.texts.every((t) => t.to <= out.duration - 1.6 + 0.001));
});

test("finish: clips corrected and framed, still shots move, animations play over footage, texts off faces", async () => {
  const { finishPlan } = await import("./finish.ts");
  const shot = (start: number, end: number, extra: object) => ({
    start, end, description: "", subject: "", energy: 2, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, ...extra,
  });
  const analysis = (shots: object[], correction?: object) => ({
    duration: 10, orientation: "landscape", summary: "", setting: "", lighting: "ok", shots, best_moments: [{ start: 6, end: 8, why: "" }], transcript: "", issues: [], ...(correction ? { correction } : {}),
  });
  const facts = {
    clips: {
      // A still shot of the room, a bit dark and leaning; a handheld shot of a face on the left.
      a: analysis([shot(0, 10, { camera: "static", subject_box: [200, 600, 900, 900] })], { exposure: 0.3, contrast: 0.02, saturation: 0, warmth: 0.1, straighten: 2 }),
      b: analysis([shot(0, 10, { camera: "handheld", faces_visible: true, subject_box: [400, 100, 1000, 400] })]),
    },
    photos: {},
  } as never;
  const plan = {
    format: "9:16", duration: 8, template: "doux", images: [], transitions: "cut", subtitles: false, music: null,
    segments: [
      { clip_id: "a", in: 0, out: 2, zoom: "none" },
      { motion: { brief: "Offre", fallback: { kind: "title", title: "Offre", background: "accent" } }, duration: 2 },
      { clip_id: "b", in: 1, out: 4, zoom: "none", move: "none" },
    ],
    // A band over the face of shot b (its default row is right where the head is).
    texts: [{ text: "Petits groupes", from: 4.2, to: 6.5, style: "band" }],
  } as never;
  const out = finishPlan(plan, facts, { a: 10, b: 10 });
  const [a, motion, b] = out.segments as Record<string, unknown>[];
  assert.deepEqual(a!.adjust, { exposure: 0.3, warmth: 0.1, straighten: 2, focus: { x: 0.75, y: 0.55 } });
  assert.equal(a!.move, "in");
  // The animation carries on shot a's footage, from where it stopped.
  assert.deepEqual(motion!.over, { clip_id: "a", in: 2 });
  // A handheld shot keeps the camera as filmed.
  assert.equal(b!.move, "none");
  assert.notEqual(out.texts[0]!.y, undefined);
});

test("editor: each gesture says whether her hands show in the vertical frame", async () => {
  const { editorClip, handsInFrame } = await import("./finish.ts");
  const shot = { start: 0, end: 10, description: "", subject: "", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, subject_box: [100, 400, 1000, 600] };
  const analysis = {
    duration: 10, orientation: "portrait", summary: "", setting: "", lighting: "ok", shots: [shot], best_moments: [], transcript: "", issues: [],
    actions: [
      { start: 0, end: 1, what: "elle pointe la caméra" },
      { start: 2, end: 3, what: "elle lève le bras sur le côté" },
    ],
  } as never;
  // A hand: id, then 21 points (x, y) in thousandths; wrist, thumb tip and index tip near the middle.
  const hand = (x: number) => [0, ...Array.from({ length: 21 }, () => [x, 500]).flat()];
  const frames = (x: number) => Array.from({ length: 120 }, (_, k) => (k < 30 ? { h: [hand(x)] } : {}));
  // Filmed upright: the whole width shows. Her hand in the first second, none when the arm leaves the frame.
  const upright = { fps: 30, w: 540, h: 960, from: 0, n: 120, frames: frames(500) };
  const clip = editorClip("v", analysis, upright as never);
  assert.deepEqual(clip.actions?.map((a) => (a as { mains?: string }).mains), ["dans le cadre", "hors du cadre"]);
  // Filmed wide: the vertical frame keeps a window around her (centre); a hand at the far left is out of it.
  assert.equal(handsInFrame({ ...upright, w: 960, h: 540, frames: frames(100) } as never, analysis, 0, 1), 0);
  assert.equal(handsInFrame({ ...upright, w: 960, h: 540, frames: frames(500) } as never, analysis, 0, 1), 1);
  // Without tracks, the gestures as Gemini read them.
  assert.equal("mains" in (editorClip("v", analysis).actions?.[0] ?? {}), false);
});

test("finish: texts keep off the faces tracked image by image, moment by moment", async () => {
  const { finishPlan, trackedFaces } = await import("./finish.ts");
  // Gemini saw a face at the top of her box (rows 0.1 to 0.3); she leans in: the tracker sees it at 0.35 to 0.6.
  const shot = { start: 0, end: 10, description: "", subject: "", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, camera: "handheld", subject_box: [100, 200, 600, 800] };
  const clips = { v: { duration: 10, orientation: "portrait", summary: "", setting: "", lighting: "ok", shots: [shot], best_moments: [], transcript: "", issues: [] } };
  const face = [0, 300, 350, 380, 250];
  const tracks = (seen: (k: number) => boolean) => ({ v: { fps: 30, w: 540, h: 960, from: 0, n: 90, frames: Array.from({ length: 90 }, (_, k) => (seen(k) ? { f: [face] } : {})) } });
  const plan = {
    format: "9:16", duration: 3, template: "libre", images: [], transitions: "cut", subtitles: false, music: null,
    segments: [{ clip_id: "v", in: 0, out: 3, zoom: "none", move: "none" }],
    texts: [{ text: "Petits groupes", from: 0, to: 1.5, style: "band" }],
  } as never;
  const band = (facts: object) => (finishPlan(plan, facts as never, { v: 10 }).texts[0] as { y?: number; auto_y?: boolean });
  // Gemini's face is above the band's row: it stays, on her face.
  assert.equal(band({ clips, photos: {} }).y, undefined);
  // Tracked: padded (hair, chin), widened for a zoom; nowhere fully clear, the row her face covers least.
  const always = tracks(() => true);
  const [zone] = trackedFaces(always.v as never, 0, 3)!;
  assert.ok(zone!.y < 0.27 && zone!.y + zone!.h > 0.65);
  const moved = band({ clips, photos: {}, tracks: always });
  assert.equal(moved.y, 0.12);
  assert.equal(moved.auto_y, true);
  // She comes close only at the end of the shot: a text before it keeps its row.
  assert.equal(band({ clips, photos: {}, tracks: tracks((k) => k >= 60) }).y, undefined);
  // No face tracked in the passage: Gemini's reading again.
  assert.equal(trackedFaces(tracks(() => false).v as never, 0, 3), null);
});

test("editor: the answer's camera, speed and footage under animations become the plan", async () => {
  const { z } = await import("zod");
  const { fromEditorPlan, editorOutputSchema } = await import("./editor.ts");
  const plan = fromEditorPlan({
    duration: 6, template: "dynamique", transitions: "cut", subtitles: false,
    fonts: { display: "Anton", body: "bad;font" },
    segments: [
      { clip_id: "a", in: 0, out: 2, move: "Punch", speed: 1 },
      { clip_id: "b", in: 1, out: 2, move: "zoom-in", speed: 0.5 },
      { motion: { brief: "Offre", fallback: { kind: "title", title: "Offre", background: "accent" }, template_id: "not-a-uuid" }, duration: 2, over_clip: "b" },
    ],
    texts: [{ text: "Ce soir on dîne italien", from: 0, to: 2, style: "hook" }],
  } as never);
  const [a, b, motion] = plan.segments as Record<string, unknown>[];
  assert.equal(a!.move, "punch");
  assert.equal("speed" in a!, false);
  // An unknown move is no move; slow motion is kept.
  assert.equal(b!.move, "none");
  assert.equal(b!.speed, 0.5);
  assert.deepEqual(motion!.over, { clip_id: "b" });
  assert.equal("template_id" in (motion!.motion as object), false);
  assert.deepEqual(plan.fonts, { display: "Anton" });
  assert.equal(plan.format, "9:16");
  assert.deepEqual(plan.images, []);
  // The answer stays a small grammar: one union, no formats (a uuid compiles to a long pattern).
  const json = JSON.stringify(z.toJSONSchema(editorOutputSchema, { unrepresentable: "any" }));
  assert.equal((json.match(/"anyOf"/g) ?? []).length, 1);
  assert.doesNotMatch(json, /"format"/);
});

test("speed: a slowed shot lasts longer on screen and its cut still lands on a beat", async () => {
  const { segmentSeconds } = await import("./schemas.ts");
  const { normalizeEditPlan } = await import("./editor.ts");
  assert.equal(segmentSeconds({ clip_id: "a", in: 1, out: 2, zoom: "none", speed: 0.5 } as never), 2);
  const plan = normalizeEditPlan(
    {
      format: "9:16", duration: 4, template: "dynamique", images: [], transitions: "cut", subtitles: false, music: null, texts: [],
      segments: [{ clip_id: "a", in: 0, out: 1.1, zoom: "none", speed: 0.5 }, { clip_id: "b", in: 0, out: 1.9, zoom: "none" }],
    } as never,
    { a: 10, b: 10 },
  );
  const first = plan.segments[0] as { in: number; out: number; speed?: number };
  // 1.1 s of clip at half speed ≈ 2.2 s on screen → 4 beats of 0.5 s at 120 BPM = 2 s, i.e. 1 s of clip.
  assert.equal(first.speed, 0.5);
  assert.equal(first.out, 1);
});

test("Simone's voice: character timings become words, punctuation kept for the phrases", async () => {
  const { fromTtsAlignment, spokenWords } = await import("./voice-over.ts");
  const { voicePhrases } = await import("./voice.ts");
  const text = "Tu sais pourquoi ? Viens ce soir.";
  const characters = [...text];
  const starts = characters.map((_, i) => i * 0.05);
  const ends = characters.map((_, i) => i * 0.05 + 0.05);
  const t = fromTtsAlignment({ characters, character_start_times_seconds: starts, character_end_times_seconds: ends }, text);
  assert.deepEqual(t.words.map((w) => w.w), ["Tu", "sais", "pourquoi\u202F?", "Viens", "ce", "soir."], "a lone « ? » joins the word before it");
  assert.equal(t.words[0]!.start, 0);
  assert.equal(t.words[1]!.start, 0.15);
  assert.equal(t.duration, Math.round(ends.at(-1)! * 100) / 100);
  assert.equal(t.language, "fr");
  // Phrases still close on a full stop, like a transcribed voice note.
  assert.equal(voicePhrases(t, 0).at(-1)!.text, "Viens ce soir.");
  assert.equal(spokenWords("Tu sais pourquoi ? Viens — ce soir."), 6);
});

test("acting tags are played, never read in the subtitles", async () => {
  const { fromTtsAlignment, spokenWords, stripAudioTags } = await import("./voice-over.ts");
  const text = "[smiling] Viens ce soir. [laughs softly] Promis.";
  const characters = [...text];
  const t = fromTtsAlignment({ characters, character_start_times_seconds: characters.map((_, i) => i * 0.05), character_end_times_seconds: characters.map((_, i) => i * 0.05 + 0.05) }, text);
  assert.deepEqual(t.words.map((w) => w.w), ["Viens", "ce", "soir.", "Promis."]);
  assert.equal(t.text, "Viens ce soir. Promis.");
  assert.equal(spokenWords(text), 4);
  assert.equal(stripAudioTags("Tu sais pourquoi ? [warmly] Viens."), "Tu sais pourquoi ? Viens.");
});

test("voice: the hook keeps the first phrase, its words say the rest", async () => {
  const { clearOfVoice } = await import("./editor.ts");
  const phrases = [
    { start: 0.3, end: 2.1 },
    { start: 2.4, end: 6 },
    { start: 7.6, end: 11 },
  ];
  const texts = [
    { text: "ta pizza, sans raccourci", from: 0, to: 3.5, style: "hook" },
    { text: "48 h de pousse", from: 3, to: 5, style: "band" },
    { text: "réserve ta table", from: 10, to: 13, style: "caption" },
  ];
  // The hook ends soon after the first phrase; the band and the invitation go (the subtitles say them).
  assert.deepEqual(
    clearOfVoice(texts, phrases).map((t) => [t.text, t.from, t.to]),
    [["ta pizza, sans raccourci", 0, 2.5]],
  );
  // No hook on its first phrase: nothing but the subtitles.
  assert.deepEqual(clearOfVoice([{ text: "x", from: 3, to: 5, style: "band" }], [{ start: 0.3, end: 12 }]), []);
  assert.deepEqual(clearOfVoice([{ text: "y", from: 2.5, to: 4, style: "hook" }], phrases), []);
  // No voice: the texts as they are.
  assert.equal(clearOfVoice(texts, []).length, 3);
});

test("voice: the last shot holds after the last word when its clip has room", async () => {
  const { holdAfterVoice } = await import("./editor.ts");
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 8,
    segments: [
      { clip_id: "a", in: 0, out: 4, zoom: "none" },
      { clip_id: "b", in: 1, out: 5, zoom: "none" },
    ],
    texts: [],
    images: [],
  });
  const held = holdAfterVoice(plan, 8.2, { a: 10, b: 20 });
  const last = held.segments.at(-1)!;
  assert.equal("clip_id" in last ? last.out : null, 6.7);
  assert.equal(held.duration, 9.7);
  // No room left in the clip: unchanged.
  assert.equal(holdAfterVoice(plan, 8.2, { a: 10, b: 5 }), plan);
});

test("ending: the last text cut by the end starts earlier, never over another one", async () => {
  const { readableEnding } = await import("./editor.ts");
  const texts = [
    { from: 2, to: 6 },
    { from: 9.3, to: 10 },
  ];
  assert.deepEqual(readableEnding(texts, [], 10), [
    { from: 2, to: 6 },
    { from: 8.2, to: 10 },
  ]);
  // Over an animation: left as it was (normalize drops it when too short).
  assert.deepEqual(readableEnding(texts, [{ from: 8, to: 9.2 }], 10).at(-1), { from: 9.3, to: 10 });
});

test("texts and animations: an animated hook is not written again after it, and two texts never show at once", async () => {
  const { clearOfAnimations } = await import("./editor.ts");
  const opening = { from: 0, to: 1.67, words: "alors, tu reviens quand ?" };
  const texts = [
    { text: "Alors, tu reviens quand ?", from: 0, to: 1.67 },
    { text: "ton reformer t'attend pour la rentrée", from: 1.67, to: 12.2 },
  ];
  // The opening animation already says the hook: only the message stays (Culte's collage showed both, one over the other).
  assert.deepEqual(clearOfAnimations(texts, [opening], 12.24), [texts[1]]);
  // Another hook than the animation's words is moved after it, and the message waits for its end.
  const other = [{ text: "la rentrée est là", from: 0, to: 1.5 }, texts[1]!];
  assert.deepEqual(clearOfAnimations(other, [opening], 12.24), [
    { text: "la rentrée est là", from: 1.67, to: 3.17 },
    { text: "ton reformer t'attend pour la rentrée", from: 3.17, to: 12.2 },
  ]);
  // Two texts at once without any animation: the later one waits, or goes when it would not be read.
  assert.deepEqual(
    clearOfAnimations(
      [
        { text: "a", from: 0, to: 3 },
        { text: "b", from: 1, to: 3.5 },
        { text: "c", from: 2, to: 6 },
      ],
      [],
      10,
    ),
    [
      { text: "a", from: 0, to: 3 },
      { text: "c", from: 3, to: 6 },
    ],
  );
});

test("texts and animations over several shots: one that writes words keeps texts off it, a silent one does not", async () => {
  const { normalizeEditPlan } = await import("./editor.ts");
  const scene = "function Scene(){return null}";
  // A boutique Reel opened on an animated hook over her shots and a written hook, one over the other.
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 12,
    template: "libre",
    images: [],
    segments: [
      { clip_id: "a", in: 0, out: 6 },
      { clip_id: "b", in: 0, out: 6 },
    ],
    texts: [{ text: "Lille, ce week-end c'est -20 %", from: 0, to: 2.5, style: "hook" }],
    layers: [{ motion: { brief: "Accroche : « lille, tu fais quoi ce week-end ? »", js: scene }, from: 0, to: 1.5 }],
  });
  // The written hook waits for the animated one to end, about as long as it was.
  const out = normalizeEditPlan(plan, { a: 10, b: 10 });
  assert.deepEqual(out.texts.map((t) => t.from), [1.5]);
  assert.ok(out.texts[0]!.to - out.texts[0]!.from > 2.3);
  // An animation without words (a frame, her cut-out saying hi) leaves the texts where they are.
  const silent = normalizeEditPlan(editPlanSchema.parse({ ...plan, layers: [{ motion: { brief: "un cadre qui suit son visage", js: scene }, from: 0, to: 1.5 }] }), { a: 10, b: 10 });
  assert.deepEqual(silent.texts.map((t) => t.from), [0]);
});

test("signature transition: never on the last shot", async () => {
  const { signatureShot } = await import("./editor.ts");
  const segments = [
    { clip_id: "a", in: 0, out: 2 },
    { clip_id: "b", in: 0, out: 2 },
    { clip_id: "c", in: 0, out: 3 },
  ];
  assert.equal(signatureShot({ segments, texts: [{ style: "band", from: 2.1 }], transitions: "cut" }), 1);
  assert.equal(signatureShot({ segments, texts: [{ style: "band", from: 4.2 }], transitions: "cut" }), null);
});

test("brand: ink on a mid-tone accent, the business's name on one line", async () => {
  const { inkOn, keepName } = await import("./motion.ts");
  // A dusty pink takes ink (white on it reads at 2.8:1), a deep plum keeps white.
  assert.equal(inkOn("#C9898F"), "#1C1530");
  assert.equal(inkOn("#5B3FD9"), "#FFFFFF");
  assert.equal(inkOn("#F2694E"), "#1C1530");
  assert.equal(keepName("Viens chez Trattoria Sole ce soir", "Trattoria Sole"), "Viens chez Trattoria Sole ce soir");
  assert.equal(keepName("atelier mila, rue des Lilas", "Atelier Mila"), "atelier mila, rue des Lilas");
  assert.equal(keepName("Maya", "Maya"), "Maya");
});

test("fonts: a well-known family Google does not serve gets its free twin", async () => {
  const { fontTwin, googleFamilyName } = await import("./fonts.ts");
  assert.equal(fontTwin("Gotham Rounded"), "Montserrat");
  assert.equal(fontTwin("Proxima-Nova Soft W01"), "Montserrat");
  assert.equal(fontTwin("futura_pt_book"), "Jost");
  assert.equal(fontTwin("Canela Deck"), "Fraunces");
  assert.equal(fontTwin("Helvetica Neue"), "Inter");
  assert.equal(fontTwin("Ma Police Maison"), null);
  assert.equal(googleFamilyName("playfair  display"), "Playfair Display");
  assert.equal(googleFamilyName("DM Sans"), "DM Sans");
});

test("site page: a site builder's interface font and icon fonts are never a business's", async () => {
  const { isBrandFont } = await import("./site-page.ts");
  assert.equal(isBrandFont("squarespace-ui-font"), false);
  assert.equal(isBrandFont("Clarkson"), false);
  assert.equal(isBrandFont("Font Awesome 6 Free"), false);
  assert.equal(isBrandFont("wfont_6f0a8a_3b1"), false);
  assert.equal(isBrandFont("-apple-system"), false);
  assert.equal(isBrandFont("obviously"), true);
  assert.equal(isBrandFont("Poppins"), true);
});

test("site page: fonts are named as the business would name them, their weight read from the name", async () => {
  const { brandFontName, fontNameStyle } = await import("./site-page.ts");
  assert.equal(brandFontName("acumin-pro"), "Acumin Pro");
  assert.equal(brandFontName("Domainesemibolditalic"), "Domaine");
  assert.equal(brandFontName("American Grotesk Bold"), "American Grotesk");
  assert.equal(brandFontName("obviously"), "Obviously");
  assert.equal(brandFontName("Sebenta Heavy"), "Sebenta");
  assert.deepEqual(fontNameStyle("Domainesemibolditalic"), { weight: 700, italic: true });
  assert.deepEqual(fontNameStyle("Sebenta Heavy"), { weight: 900, italic: false });
  assert.deepEqual(fontNameStyle("obviously"), { weight: null, italic: false });
});

const measuredPage = {
  display: [
    { family: "squarespace-ui-font", share: 0.5, uppercase: 1, bold: 1, size: 14, letter_spacing: 0, centered: 0 },
    { family: "obviously", share: 0.3, uppercase: 0, bold: 0, size: 38, letter_spacing: 0, centered: 0.9, sample: "Pilates Reformer Hot Pilates" },
  ],
  middle: [],
  body: [{ family: "Clarkson", share: 0.2, uppercase: 0, bold: 0, size: 15, letter_spacing: 0, centered: 0 }],
  loaded_fonts: ["obviously"],
  areas: [
    { color: "#e6d8f9", share: 0.3 },
    { color: "photo", share: 0.2 },
    { color: "#000000", share: 0.29 },
  ],
  texts: [{ color: "#ffffff", share: 0.6 }],
  buttons: [{ color: "#000000", share: 0.8 }],
};

test("site page: its titles' font is the one its titles use, never the builder's", async () => {
  const { pageFonts, pageMeasureSchema } = await import("./site-page.ts");
  const page = pageMeasureSchema.parse(measuredPage);
  const { display, body } = pageFonts(page);
  assert.equal(display?.raw, "obviously");
  assert.equal(display?.name, "Obviously");
  // No brand font for the body text: its titles' font takes it.
  assert.equal(body?.raw, "obviously");
});

test("site page: the facts the reading gets name its fonts and the colours on screen, without photos", async () => {
  const { pageFacts, pageMeasureSchema } = await import("./site-page.ts");
  const facts = pageFacts(pageMeasureSchema.parse(measuredPage), [{ color: "#e6d8f9", share: 0.28 }]);
  assert.match(facts, /titres en « obviously » \(en casse normale, centrée, 38 px/);
  assert.match(facts, /#e6d8f9 28 %/);
  assert.match(facts, /photos et vidéos : 20 %/);
  assert.doesNotMatch(facts, /squarespace-ui-font|Clarkson/);
});

test("site page: what was measured settles the titles' case and alignment", async () => {
  const { measuredTitles, pageMeasureSchema } = await import("./site-page.ts");
  const page = pageMeasureSchema.parse(measuredPage);
  const read = { font: "display" as const, case: "upper" as const, weight: "black" as const, align: "left" as const, tracking: "normal" as const };
  // The reading thought « bold capitals, flush left »: the page says normal case, centred.
  assert.deepEqual(measuredTitles(page, read), { ...read, case: "normal", align: "center" });
});

test("site page: the palette takes the exact colours measured, keeps the ones seen elsewhere", async () => {
  const { snapPalette } = await import("./site-page.ts");
  assert.deepEqual(snapPalette(["#FF6410", "#e5d9f8", "#aa0000"], ["#ff6200", "#e6d8f9", "#000000"]), ["#ff6200", "#e6d8f9", "#aa0000"]);
  assert.deepEqual(snapPalette(["#ff6200", "#ff6201"], ["#ff6200"]), ["#ff6200"]);
});

test("signature: plain lines for the editor, the designer and the critic", async () => {
  const { signatureLines, brandSignatureSchema } = await import("./signature.ts");
  assert.equal(signatureLines(undefined), undefined);
  const signature = brandSignatureSchema.parse({
    ambiance: "dynamique",
    titles: { font: "display", case: "normal", weight: "regular", align: "center", tracking: "normal" },
    stress: "marker",
    band: "light",
    grade: "moody",
    base: "dark",
    motion: "energique",
    music: "deep house",
    voice: "tutoiement, phrases courtes",
  });
  const lines = signatureLines(signature)!;
  assert.match(lines, /casse normale/);
  assert.match(lines, /entouré ou souligné à la main, une seule fois par Reel/);
  assert.match(lines, /aplat clair/);
  assert.match(lines, /musique : deep house/);
});

test("signature: no ambiance any more, an older one is left out", async () => {
  const { brandSignatureSchema, SIGNATURE_GUIDE } = await import("./signature.ts");
  assert.equal("ambiance" in brandSignatureSchema.shape, false);
  assert.doesNotMatch(SIGNATURE_GUIDE, /ambiance/);
  const old = brandSignatureSchema.parse({
    ambiance: "chic",
    titles: { font: "display", case: "normal", weight: "regular", align: "center", tracking: "normal" },
    stress: "color",
    band: "white",
    grade: "natural",
    base: "light",
    motion: "epure",
    music: "lo-fi",
    voice: "tutoiement",
  });
  assert.equal("ambiance" in old, false);
  const { brandProfileSchema } = await import("./schemas.ts");
  assert.equal("default_template" in brandProfileSchema.partial().parse({ default_template: "chic" }), false);
});

test("motion: the signature reaches the render's brand, only what the render applies", async () => {
  const { resolveReelBrand } = await import("./motion.ts");
  const signature = {
    ambiance: "doux" as const,
    titles: { font: "body" as const, case: "upper" as const, weight: "black" as const, align: "left" as const, tracking: "wide" as const },
    stress: "block" as const,
    band: "accent" as const,
    grade: "flash" as const,
    base: "light" as const,
    motion: "fait_main" as const,
    music: "funk",
    voice: "vouvoiement",
  };
  const brand = resolveReelBrand({}, "doux", { name: "Test", accent: "#aa0000", signature });
  assert.deepEqual(brand.signature, { titles: signature.titles, stress: "block", band: "accent", grade: "flash", base: "light" });
  assert.equal(resolveReelBrand({}, "doux", { name: "Test" }).signature, undefined);
});

test("photo moves: most photos held still, one slow push on the strongest, a pan for a wide one, never twice the same in a row", async () => {
  const { photoMoves } = await import("./finish.ts");
  const detection = { regions: [], notes: "", subject: null } as never;
  const photos = {
    a: { width: 1080, height: 1350, detection },
    b: { width: 1080, height: 1350, detection },
    c: { width: 1920, height: 1080, detection },
    d: { width: 1080, height: 1350, detection },
  };
  const seg = (clip_id: string, seconds: number, move?: string) => ({ clip_id, in: 0, out: seconds, zoom: "none" as const, ...(move ? { move } : {}) });
  // A Reel that opens on a photo: the one push is on it (it moves from the first image); the wide photo pans; the rest stay still.
  const moves = photoMoves({ segments: [seg("a", 1.2), seg("b", 2.6), seg("c", 1.8), seg("d", 1.4, "in")] as never }, photos);
  assert.deepEqual([...moves.values()], ["in", "none", "left", "none"]);
  // Opening on a video: the editor's own push wins and is the only one.
  const afterVideo = photoMoves({ segments: [seg("v", 1.5), seg("b", 2.6), seg("c", 1.8), seg("d", 1.4, "in")] as never }, photos);
  assert.deepEqual([...afterVideo.entries()], [[1, "none"], [2, "left"], [3, "in"]]);
  // Without one: the photo held longest.
  const second = photoMoves({ segments: [seg("v", 1.5), seg("a", 1.2), seg("b", 2.6), seg("d", 1.4)] as never }, photos);
  assert.deepEqual([...second.values()], ["none", "in", "none"]);
});

test("signature: its narrators are the gallery's voices that are not whispered", async () => {
  const { NARRATOR_NAMES, brandSignatureSchema } = await import("./signature.ts");
  const { SIMONE_VOICES } = await import("./voice-over.ts");
  assert.deepEqual([...NARRATOR_NAMES], SIMONE_VOICES.filter((v) => !v.asmr).map((v) => v.name));
  // A signature saved before the narrator existed still reads.
  const old = { ambiance: "doux", titles: { font: "display", case: "normal", weight: "bold", align: "center", tracking: "normal" }, stress: "color", band: "white", grade: "natural", base: "light", motion: "epure", music: "lo-fi", voice: "tutoiement" };
  assert.equal(brandSignatureSchema.safeParse(old).success, true);
});

test("hooks: the strongest shot opens, the hook is read from the first image, the judge's pick holds, the voice speaks at once", async () => {
  const { openingCandidates, hookAtStart, pickHook, planHook, hookWords } = await import("./hook.ts");
  const { voiceAt, voiceForEditor, VOICE_FIRST_WORD } = await import("./voice.ts");
  const { scriptFrom, voiceOverScriptSchema } = await import("./voice-over.ts");
  const { qualityChecks, normalizeReview, voiceLine } = await import("./critic.ts");
  const { normalizeEditPlan } = await import("./editor.ts");
  const { buildReelProps } = await import("./motion.ts");
  type Look = Record<string, unknown>;
  const shot = (start: number, end: number, look: Look = {}) => ({
    start,
    end,
    description: `plan ${start}`,
    subject: "plat",
    energy: 3,
    hook_score: 3,
    quality: { blurry: false, dark: false, shaky: false },
    faces_visible: false,
    framing: "medium" as const,
    camera: "handheld" as const,
    subject_box: [0, 0, 1000, 1000],
    beauty: 3,
    ...look,
  });
  const analysis = (shots: ReturnType<typeof shot>[], best: { start: number; end: number; why: string }[] = []) =>
    ({ duration: 10, orientation: "portrait", summary: "", setting: "", lighting: "good", shots, best_moments: best, transcript: "", issues: [] }) as never;
  const clips = [
    { media_id: "decor", analysis: analysis([shot(0, 3, { framing: "wide", camera: "static", hook_score: 2, description: "la salle vide" })]) },
    {
      media_id: "geste",
      analysis: analysis([shot(0, 2), shot(2, 6, { hook_score: 5, beauty: 5, framing: "close", description: "le fromage qui file" })], [{ start: 3, end: 4.5, why: "le fromage file" }]),
    },
    { media_id: "flou", analysis: analysis([shot(0, 3, { hook_score: 5, beauty: 5, quality: { blurry: true, dark: false, shaky: false } })]) },
  ];
  // The strongest shot opens, where its best moment starts; a blurry one never comes before a clean one; a photo only without videos.
  const openings = openingCandidates(clips, [{ media_id: "p", contenu: "la vitrine" }]);
  assert.equal(openings[0]!.media_id, "geste");
  assert.equal(openings[0]!.what, "le fromage qui file");
  assert.deepEqual([openings[0]!.start, openings[0]!.end], [3, 4.5]);
  assert.equal(openings[1]!.media_id, "geste");
  assert.ok(openings.every((o) => o.kind === "video"));
  assert.deepEqual(openingCandidates([], [{ media_id: "p1" }, { media_id: "p2" }]).map((o) => o.media_id), ["p1", "p2"]);

  // The hook is on screen from the first image; a caption first, or a hook that comes late, is left alone.
  const texts = [
    { text: "pourquoi cette file ?", from: 0.56, to: 2, style: "hook" },
    { text: "réserve", from: 5, to: 7, style: "caption" },
  ];
  assert.equal(hookAtStart(texts)[0]!.from, 0);
  assert.equal(hookAtStart(texts)[1]!.from, 5);
  assert.equal(hookAtStart([{ ...texts[1]!, from: 0.5 }])[0]!.from, 0.5);
  assert.equal(hookAtStart([{ ...texts[0]!, from: 2 }])[0]!.from, 2);
  const normalized = normalizeEditPlan(
    editPlanObjectSchema.parse({
      ...validPlan,
      template: "dynamique",
      images: [],
      segments: [
        { clip_id: "a", in: 0, out: 1.5, zoom: "none" },
        { clip_id: "b", in: 0, out: 3, zoom: "none" },
      ],
      texts: [{ text: "pourquoi cette file ?", from: 0.4, to: 2, style: "hook" }],
    }),
    { a: 10, b: 10 },
  );
  assert.equal(normalized.texts[0]!.from, 0);
  assert.equal(planHook(normalized)!.text.text, "pourquoi cette file ?");

  // The judge's pick holds when it is short enough; else the best scored one that holds; the emphasis keeps its own words.
  const given = ["Cette file rue Charlot, personne ne la regrette."];
  const answer = {
    ideas: [
      { text: "Pourquoi tout le monde fait la queue ici ?", emphasis: ["la queue", "ailleurs"] },
      { text: "Une file de vingt minutes pour un sandwich, et personne ne repart sans le sien, même sous la pluie", emphasis: [] },
    ],
    scores: [
      { index: 0, score: 5, why: "plat" },
      { index: 1, score: 8, why: "une vraie question" },
      { index: 2, score: 9, why: "fort mais long" },
    ],
    best: 2,
  };
  const voice = pickHook(given, answer, "voix");
  assert.equal(voice.text, "Pourquoi tout le monde fait la queue ici ?");
  assert.equal(voice.index, 1);
  assert.equal(voice.score, 8);
  // A written hook is read at a glance: 7 words at most (the 8-word question stays a voice's).
  assert.equal(pickHook(given, answer, "texte").index, 0);
  const written = pickHook(["La file de la rue Charlot"], { ideas: [{ text: "40 minutes pour un sandwich ?", emphasis: ["40 minutes", "toaster"] }], scores: [{ index: 1, score: 9, why: "un chiffre" }], best: 1 }, "texte");
  assert.deepEqual([written.text, written.emphasis], ["40 minutes pour un sandwich ?", ["40 minutes"]]);
  assert.equal(pickHook(given, { ideas: [], scores: [], best: 7 }, "voix").text, given[0]);
  assert.equal(hookWords("[casually] Pourquoi cette file ?"), 3);

  // The voice: its first sentence chosen, then all that follows; written as hooks and the rest.
  assert.equal(scriptFrom(" Pourquoi cette file ? ", "Ici, tout passe au toaster.").script, "Pourquoi cette file ? Ici, tout passe au toaster.");
  assert.equal(voiceOverScriptSchema.safeParse({ hooks: ["a", "b"], rest: "c" }).success, true);

  // A voice note that opens on silence: its first word is heard at once (the silence is cut).
  const note = { text: "Pourquoi cette file ?", duration: 3, words: [{ w: "Pourquoi", start: 0.9, end: 1.3 }, { w: "cette", start: 1.3, end: 1.5 }, { w: "file ?", start: 1.5, end: 1.9 }] };
  const at = voiceAt(note);
  assert.equal(at, -0.7);
  assert.equal(voiceForEditor(note, at).phrases[0]!.start, VOICE_FIRST_WORD);
  assert.equal(voiceAt({ words: [{ w: "Alors", start: 0.05, end: 0.3 }] }), 0.15);
  const spokenPlan = editPlanSchema.parse({ ...validPlan, duration: 6, segments: [{ clip_id: "a", in: 0, out: 6, zoom: "none" }], texts: [], images: [], voice: { media_id: "v", at } });
  const props = buildReelProps(spokenPlan, { template: "doux", clipUrls: { a: "https://x/a.mp4" }, voice: { src: "https://x/v.ogg", words: note.words }, brand: { name: "Lune" } });
  assert.equal(props.voice!.from, -21); // the render cuts the 0.7 s before it
  assert.equal(props.words[0]!.from, 6); // its first word at 0.2 s
  assert.match(voiceLine(spokenPlan, note)!, /« Pourquoi cette file \? », dite de 0,2 à 1,2 s/);

  // The checks: a hook that waits, a first shot held too long.
  const late = editPlanObjectSchema.parse({
    ...validPlan,
    template: "doux",
    images: [],
    segments: [
      { clip_id: "a", in: 0, out: 2.8, zoom: "none" },
      { clip_id: "b", in: 0, out: 1.5, zoom: "none" },
    ],
    texts: [{ text: "pourquoi cette file ?", from: 0.6, to: 2.5, style: "hook" }],
  });
  const checks = qualityChecks(late);
  assert.match(checks.find((c) => c.key === "hook")!.words, /seulement à 0,6 s/);
  assert.equal(checks.find((c) => c.key === "opening")!.ok, false);
  assert.equal(qualityChecks({ ...late, segments: [{ clip_id: "a", in: 0, out: 1.2, zoom: "none" }, late.segments[1]!] }).find((c) => c.key === "opening")!.ok, true);

  // A weak hook never lets the Reel go while there is something to correct.
  const review = (hook: number, issues: { scene: number | null; problem: string; fix: string }[]) => normalizeReview({ best: 1, why: "", score: 8, hook, ok: true, issues, summary: "" }, 1);
  assert.equal(review(5, [{ scene: 1, problem: "1re image : une salle vide", fix: "ouvrir sur le fromage qui file" }]).ok, false);
  assert.equal(review(5, []).ok, true);
  assert.equal(review(8, [{ scene: 2, problem: "x", fix: "y" }]).ok, true);
});

test("lab fixes 2: a Reel's message shows its title, subtitles off faces read where the photo shows them", async () => {
  const { buildReelProps } = await import("./motion.ts");
  const { photoBoxInFrame, subtitleRow } = await import("./retouch.ts");
  // A band with items in a Reel is a message: its own words are its title (on a photo, a list's text only names it).
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 6,
    segments: [{ clip_id: "a", in: 0, out: 6, zoom: "none" }],
    texts: [{ text: "3 cours pour 65 €", from: 1, to: 5, style: "band", items: [{ title: "pack découverte" }, { title: "tous niveaux" }] }],
    images: [],
  });
  const props = buildReelProps(plan, { template: "doux", clipUrls: { a: "https://x/a.mp4" }, brand: { name: "Culte" } });
  assert.equal(props.texts[0]!.message, true);
  assert.equal(buildReelProps({ ...plan, texts: [{ ...plan.texts[0]!, items: undefined }] }, { template: "doux", clipUrls: { a: "https://x/a.mp4" }, brand: { name: "Culte" } }).texts[0]!.message, undefined);

  // A 4:5 photo fills the vertical frame by its height: a face keeps its rows, widened by the slow zoom about the centre.
  const face = { x: 0.3, y: 0.1, w: 0.4, h: 0.55 };
  const shown = photoBoxInFrame(face, { source: { width: 1280, height: 1600 } })!;
  assert.ok(shown.y < 0.1 && shown.y > 0.03);
  assert.ok(shown.y + shown.h > 0.65 && shown.y + shown.h < 0.7);
  // Under the face, the subtitles drop to the row below it; a face filling the frame takes the row it covers least.
  assert.equal(subtitleRow([shown]), 0.71);
  const big = { x: 0, y: 0.05, w: 1, h: 0.69 };
  assert.equal(subtitleRow([big]), 0.71);
  // Covering every row alike, no row is better: the usual one stays.
  assert.equal(subtitleRow([{ x: 0, y: 0.05, w: 1, h: 0.8 }]), null);
});

test("off faces: one subtitle row for the Reel, animations moved off the faces under them, the engine's places worked out again", async () => {
  const { finishPlan, sceneShifts, withShifts } = await import("./finish.ts");
  const { avoidPhotoText, reelSubtitleRow, sceneShift, SUBTITLE_ROW } = await import("./retouch.ts");
  const { carryTextStyle } = await import("./editor.ts");
  const { buildReelProps } = await import("./motion.ts");
  const shot = (start: number, end: number, extra: object) => ({
    start, end, description: "", subject: "", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false, camera: "handheld", ...extra,
  });
  const analysis = (shots: object[]) => ({ duration: 10, orientation: "portrait", summary: "", setting: "", lighting: "ok", shots, best_moments: [], transcript: "", issues: [] });
  const facts = {
    clips: {
      // Someone talking to the camera, the head right on the subtitles' usual row.
      b: analysis([shot(0, 10, { faces_visible: true, subject_box: [500, 300, 1000, 700] })]),
      c: analysis([shot(0, 10, {})]),
    },
    photos: {
      // A face behind sunglasses: not recognizable, still a face no text may cover.
      p: {
        width: 1080,
        height: 1920,
        detection: { regions: [{ kind: "face", label: "visage", box_2d: [0, 200, 300, 800], recognizable: false }], adjust: { exposure: 0, contrast: 0, saturation: 0, warmth: 0, straighten: 0 }, subject: { x: 500, y: 400 }, notes: "" },
      },
    },
  } as never;
  const plan = {
    format: "9:16", duration: 9.5, template: "doux", images: [], transitions: "cut", subtitles: true, music: null,
    segments: [
      { motion: { brief: "un grilled cheese et une coupe ?", fallback: { kind: "title", title: "x", background: "accent" } }, duration: 1.5, over: { clip_id: "p" } },
      { clip_id: "b", in: 0, out: 6, zoom: "none", subtitle_y: 0.3 },
      { clip_id: "c", in: 0, out: 2, zoom: "none" },
    ],
    texts: [
      // Placed by the engine for an earlier version: worked out again (over shot c, nothing in the way).
      { text: "Petits groupes", from: 7.6, to: 9, style: "band", y: 0.33, auto_y: true },
      // Placed by her hand: it stays.
      { text: "rue Charlot", from: 7.6, to: 9.4, style: "caption", y: 0.3 },
    ],
  } as never;
  const out = finishPlan(plan, facts, { b: 10, c: 10, p: 5 });
  const [motion, b] = out.segments as Record<string, unknown>[];
  const busy = (motion!.over as { busy: { y: number; h: number }[] }).busy;
  assert.equal(busy.length, 1);
  assert.equal(busy[0]!.y, 0);
  assert.ok(busy[0]!.h > 0.3 && busy[0]!.h < 0.4);
  // One row for the whole Reel, not the usual one (the face of the long shot sits on it); none per shot.
  assert.equal(typeof out.subtitle_y, "number");
  assert.notEqual(out.subtitle_y, SUBTITLE_ROW.y);
  assert.equal("subtitle_y" in b!, false);
  assert.equal(out.texts[0]!.y, undefined);
  assert.equal(out.texts[0]!.auto_y, undefined);
  assert.equal(out.texts[1]!.y, 0.3);
  // No face on the usual row anywhere: the usual row.
  assert.equal(reelSubtitleRow([{ length: 3, boxes: [{ x: 0.3, y: 0.1, w: 0.4, h: 0.2 }] }]), null);
  // A face on it for a moment of a long Reel is worth less than a face on another row for most of it.
  assert.equal(
    reelSubtitleRow([
      { length: 1, boxes: [{ x: 0.3, y: SUBTITLE_ROW.y, w: 0.4, h: 0.06 }] },
      { length: 8, boxes: [{ x: 0.3, y: 0.68, w: 0.4, h: 0.1 }] },
    ]),
    0.56,
  );
  // A text moved by the engine says so, and its place goes with the shots.
  const band: { text: string; from: number; to: number; style: "band"; y?: number; auto_y?: boolean } = { text: "x", from: 0, to: 2, style: "band" };
  const moved = avoidPhotoText([band], [{ start: 0, length: 2, boxes: [{ x: 0.2, y: 0.44, w: 0.6, h: 0.12 }] }]);
  assert.equal(moved[0]!.auto_y, true);
  assert.equal(typeof moved[0]!.y, "number");
  // A message (title, subtitle, details) is a third of the frame tall: it clears the whole face, not one line's height.
  const message: { text: string; from: number; to: number; style: "caption"; items: { title: string }[]; y?: number; auto_y?: boolean } = {
    text: "ton reformer t'attend",
    from: 0,
    to: 6,
    style: "caption",
    items: [{ title: "3 cours à 65 €" }],
  };
  const face = [{ start: 0, length: 6, boxes: [{ x: 0.3, y: 0.45, w: 0.4, h: 0.15 }] }];
  assert.equal(avoidPhotoText([message], face)[0]!.y, 0.12);
  // A face high in the frame leaves its row free.
  assert.equal(avoidPhotoText([message], [{ start: 0, length: 6, boxes: [{ x: 0.3, y: 0.2, w: 0.4, h: 0.15 }] }])[0]!.y, undefined);
  // A correction keeps her hand's place, not the engine's.
  const carried = carryTextStyle(
    { ...(plan as object), texts: [{ text: "Petits groupes", from: 7, to: 9, style: "band" }, { text: "rue Charlot", from: 7, to: 9, style: "caption" }] } as never,
    plan,
  );
  assert.equal(carried.texts[0]!.y, undefined);
  assert.equal(carried.texts[1]!.y, 0.3);

  // The opening animation's words sit on the sunglasses: they go under the face.
  assert.equal(sceneShift({ top: 0.09, bottom: 0.36 }, busy), 0.29);
  // A face low in the frame: they go above it (the bottom quarter stays free).
  assert.equal(sceneShift({ top: 0.42, bottom: 0.68 }, [{ y: 0.5, h: 0.28 }]), -0.2);
  assert.equal(sceneShift({ top: 0.42, bottom: 0.6 }, [{ y: 0.05, h: 0.2 }]), 0);
  assert.equal(sceneShift({ top: 0.2, bottom: 0.6 }, [{ y: 0.05, h: 0.7 }]), 0);
  const shifts = sceneShifts(out, { m0: [0.09, 0.36] });
  assert.equal(shifts.get(0), 0.29);
  const kept = withShifts(out, shifts)!;
  assert.equal((kept.segments[0] as { motion: { shift: number } }).motion.shift, 0.29);
  assert.equal(withShifts(kept, shifts), null);

  // The render gets both: the scene's move, the subtitles' one row.
  const withCode = { ...kept, segments: kept.segments.map((s) => ("motion" in s ? { ...s, motion: { ...s.motion, js: "function Scene(){return null}" } } : s)) };
  const props = buildReelProps(editPlanSchema.parse(withCode), { template: "doux", clipUrls: { b: "https://x/b.mp4", c: "https://x/c.mp4", p: "https://x/p.jpg" }, photoIds: ["p"], brand: { name: "Mousse" } });
  assert.equal((props.segments[0] as { shift?: number }).shift, 0.29);
  assert.equal(props.subtitleY, out.subtitle_y);
});

test("collages: a clean cut-out makes a sticker over its print, in a collage only", async () => {
  const { stickerWorthy, cutoutSchema } = await import("./cutout.ts");
  const { buildReelProps } = await import("./motion.ts");
  const clean = { coverage: 0.315, parts: 1, touches: { top: 0, bottom: 0.2, left: 0, right: 0 }, unsure: 0.017 };
  // A person standing in the photo (her legs cut by its bottom): a sticker.
  assert.equal(stickerWorthy(clean), true);
  // A close-up cut off by the top and a side, a speck, a room in pieces, a blurry edge: prints.
  assert.equal(stickerWorthy({ ...clean, coverage: 0.66, touches: { top: 0.48, bottom: 0, left: 0.11, right: 0.57 } }), false);
  assert.equal(stickerWorthy({ ...clean, coverage: 0.01 }), false);
  assert.equal(stickerWorthy({ ...clean, parts: 5 }), false);
  assert.equal(stickerWorthy({ ...clean, unsure: 0.3 }), false);
  assert.equal(
    cutoutSchema.safeParse({ path: "s/cutouts/p.webp", w: 1078, h: 1440, box: { x: 0.18, y: 0.15, w: 0.65, h: 0.85 }, ...clean, sticker: true, model: "birefnet-lite", at: "2026-10-16T12:00:00Z" }).success,
    true,
  );

  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 6,
    template: "collage",
    segments: [
      { clip_id: "p", in: 0, out: 3, zoom: "none", photo: { source: { width: 1497, height: 2000 } } },
      { clip_id: "q", in: 0, out: 3, zoom: "none" },
    ],
    texts: [{ text: "back to culte", from: 0, to: 3, style: "hook" }],
    images: [],
  });
  const sticker = { src: "https://x/p.webp", box: { x: 0.18, y: 0.15, w: 0.65, h: 0.85 } };
  const inputs = { clipUrls: { p: "https://x/p.jpg", q: "https://x/q.jpg" }, photoIds: ["p", "q"], brand: { name: "Culte" }, cutouts: { p: sticker, q: sticker } };
  const props = buildReelProps(plan, { template: "collage", ...inputs });
  assert.deepEqual((props.segments[0] as { cutout?: unknown }).cutout, sticker);
  // Laid where the print shows its subject: never without the photo's framing.
  assert.equal("cutout" in props.segments[1]!, false);
  // Another ambiance keeps its photos whole.
  assert.equal("cutout" in buildReelProps({ ...plan, template: "doux" }, { template: "doux", ...inputs }).segments[0]!, false);
});

test("free animations: her photos, and an animation over several shots", async () => {
  const { buildReelProps, scenePhotos } = await import("./motion.ts");
  const { fromEditorPlan, normalizeEditPlan } = await import("./editor.ts");
  const { planMediaIds, scenePhotoIds } = await import("./schemas.ts");

  // The editor asks for one over the whole Reel (her cut-out saying hello on every shot); an empty brief goes.
  const asked = fromEditorPlan({
    duration: 6,
    template: "doux",
    transitions: "cut",
    subtitles: false,
    texts: [],
    segments: [
      { clip_id: "a", in: 0, out: 3, move: "none", speed: 1 },
      { clip_id: "b", in: 0, out: 3, move: "none", speed: 1 },
    ],
    layers: [
      { brief: "elle surgit à chaque plan pour dire coucou", from: 0, to: 9 },
      { brief: " ", from: 0, to: 2 },
    ],
  } as never);
  assert.deepEqual(asked.layers, [{ motion: { brief: "elle surgit à chaque plan pour dire coucou" }, from: 0, to: 9 }]);
  // Inside the Reel, and a new animation within the budget: none without one.
  const kept = normalizeEditPlan(asked, { a: 10, b: 10 });
  assert.equal(kept.layers?.[0]?.to, kept.duration);
  assert.equal(normalizeEditPlan(asked, { a: 10, b: 10 }, 0).layers, undefined);

  // The photos her animations compose with count among the plan's media (the render loads them).
  const scene = "function Scene(){return null}";
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 8,
    template: "doux",
    texts: [],
    images: [],
    segments: [
      { clip_id: "a", in: 0, out: 3, zoom: "none" },
      { motion: { brief: "sa photo détourée", js: scene, photos: ["p"] }, duration: 2 },
      { clip_id: "b", in: 0, out: 3, zoom: "none" },
    ],
    layers: [{ motion: { brief: "coucou", js: scene, photos: ["p", "q"] }, from: 1, to: 7 }],
  });
  assert.deepEqual(scenePhotoIds(plan), ["p", "q"]);
  assert.deepEqual(planMediaIds(plan).sort(), ["a", "b", "p", "q"]);
  const subject = { x: 0.2, y: 0.1, w: 0.6, h: 0.9 };
  const inputs = {
    clipUrls: { a: "https://x/a.mp4", b: "https://x/b.mp4", p: "https://x/p.jpg" },
    photoAspects: { p: 0.75 },
    cutouts: { p: { src: "https://x/p.webp", box: subject } },
    brand: { name: "Culte" },
  };
  // A photo without its link is left out; one with a clean cut-out brings it, with its subject.
  assert.deepEqual(scenePhotos(["p", "q"], inputs), [{ src: "https://x/p.jpg", aspect: 0.75, cutout: "https://x/p.webp", subject }]);
  const props = buildReelProps(plan, { template: "doux", ...inputs });
  const motion = props.segments[1] as { type: string; photos?: unknown[] };
  assert.equal(motion.type, "motion");
  assert.equal(motion.photos?.length, 1);
  // From 1 s to 7 s, with the cuts under it (at 3 s and 5 s), counted from its start.
  assert.deepEqual(
    props.layers?.map((l) => ({ from: l.from, length: l.durationInFrames, cuts: l.cuts, photos: l.photos?.length })),
    [{ from: 30, length: 180, cuts: [60, 120], photos: 1 }],
  );
  // One the motion designer could not write is not drawn.
  const unwritten = editPlanSchema.parse({ ...plan, layers: [{ motion: { brief: "coucou" }, from: 0, to: 4 }] });
  assert.equal(buildReelProps(unwritten, { template: "doux", ...inputs }).layers, undefined);
});

test("free animations: a correction keeps the ones written, and a cut-out cut by its frame still serves", async () => {
  const { keepWrittenAnimations, normalizeEditPlan } = await import("./editor.ts");
  const { sceneWorthy, cutEdges } = await import("./cutout.ts");
  const { scenePhotos } = await import("./motion.ts");
  const scene = "function Scene(){return null}";
  const previous = editPlanSchema.parse({
    ...validPlan,
    duration: 6,
    template: "doux",
    texts: [],
    images: [],
    segments: [
      { clip_id: "a", in: 0, out: 3, zoom: "none" },
      { motion: { brief: "la fin avec le chef", js: scene, photos: ["p"], fallback: { kind: "title", title: "Mousse", background: "accent" } }, duration: 2 },
    ],
    layers: [{ motion: { brief: "le chef dit coucou à chaque plan", js: scene, photos: ["p"] }, from: 0, to: 5 }],
  });
  // The editor writes them back as briefs: they keep their code and photos, a new brief stays new.
  const rewritten = editPlanSchema.parse({
    ...previous,
    segments: [previous.segments[0], { motion: { brief: "la fin avec le chef", fallback: { kind: "title", title: "Mousse", background: "accent" } }, duration: 2 }],
    layers: [{ motion: { brief: "le chef dit coucou à chaque plan" }, from: 0, to: 5 }, { motion: { brief: "un compteur" }, from: 0, to: 3 }],
  });
  const kept = keepWrittenAnimations(rewritten, previous);
  assert.deepEqual(kept.layers?.map((l) => [l.motion.brief, Boolean(l.motion.js), l.motion.photos]), [
    ["le chef dit coucou à chaque plan", true, ["p"]],
    ["un compteur", false, undefined],
  ]);
  // A correction allows no new animation: the written ones stay, the new one goes, none turns into its fixed scene.
  const corrected = normalizeEditPlan(kept, { a: 10 }, 0);
  assert.deepEqual(corrected.layers?.map((l) => l.motion.brief), ["le chef dit coucou à chaque plan"]);
  assert.equal(corrected.segments.some((s) => "motion" in s && s.motion.js === scene), true);
  assert.equal(keepWrittenAnimations(rewritten, null), rewritten);

  // One rewritten for its new shots takes the place of the one it replaces: a correction keeps it (the
  // boutique's « -20 % » caught between her fingers vanished from the version that fixed the rest).
  const { replacedAnimations } = await import("./editor.ts");
  const moved = keepWrittenAnimations(editPlanSchema.parse({ ...previous, layers: [{ motion: { brief: "le chef dit coucou, sur les nouveaux plans" }, from: 0, to: 4 }] }), previous);
  assert.equal(replacedAnimations(moved, previous), 1);
  assert.deepEqual(normalizeEditPlan(moved, { a: 10 }, replacedAnimations(moved, previous)).layers?.map((l) => l.motion.brief), ["le chef dit coucou, sur les nouveaux plans"]);
  assert.equal(normalizeEditPlan(moved, { a: 10 }, 0).layers, undefined);
  // Nothing replaced when the written ones are kept as they were, nor on a new montage.
  assert.equal(replacedAnimations(kept, previous), 0);
  assert.equal(replacedAnimations(moved, null), 0);

  // A chef seated at his table runs into the top and the left: no sticker, but an animation can bring him in from there.
  const chef = { coverage: 0.419, parts: 1, touches: { top: 0.17, bottom: 0, left: 0.21, right: 0.08 }, unsure: 0.016 };
  assert.equal(sceneWorthy(chef), true);
  assert.deepEqual(cutEdges(chef.touches), ["top", "left", "right"]);
  assert.equal(sceneWorthy({ ...chef, parts: 5 }), false);
  const photos = scenePhotos(["p"], {
    clipUrls: { p: "https://x/p.jpg" },
    sceneCutouts: { p: { src: "https://x/p.webp", box: { x: 0, y: 0, w: 0.8, h: 1 }, edges: ["top", "left"] } },
  });
  assert.deepEqual(photos[0]?.cutEdges, ["top", "left"]);
  assert.equal(photos[0]?.cutout, "https://x/p.webp");
});

test("readings that hold: a long line never loses a site's look", async () => {
  const { clampReading, clampSiteLook, siteLookSchema } = await import("./moodboard.ts");
  const { clip, brandSignatureSchema } = await import("./signature.ts");
  const asReading = (r: unknown) => r as Parameters<typeof clampSiteLook>[0];

  // A reading taken as written, then clamped: a 120-character music brief, an odd font name, a bad colour.
  const long = "underground club techno with neon synths, deep pulsing bass, sweaty basement energy and sharp hi-hats all night long";
  const reading = {
    reading: "x",
    direction: "y",
    palette: ["#FF6200", "orange", "#e6d8f9", "#ff6200"],
    fonts: { display: "Obviously-Wide!", body: "" },
    signature: {
      ambiance: "dynamique",
      titles: { font: "display", case: "upper", weight: "black", align: "center", tracking: "tight" },
      stress: "block",
      band: "accent",
      grade: "moody",
      base: "dark",
      motion: "energique",
      music: long,
      narrator: { voice: "Neto", delivery: "z".repeat(200) },
      voice: "tutoiement",
    },
    sample: { hook: "h".repeat(80), key: "k", band: "b".repeat(70) },
    photos: [1, 2],
  };
  assert.equal(siteLookSchema.safeParse(reading).success, true); // the long brief no longer throws the reading away
  const kept = clampSiteLook(asReading(reading));
  assert.ok(kept.signature.music.length <= 80 && kept.signature.music.startsWith("underground club techno"));
  assert.doesNotMatch(kept.signature.music, /[,\s]$/);
  assert.equal(brandSignatureSchema.safeParse(kept.signature).success, true); // what a profile keeps
  assert.deepEqual(kept.palette, ["#ff6200", "#e6d8f9"]);
  assert.deepEqual(kept.fonts, { display: "Obviously Wide", body: "Obviously Wide" });
  assert.equal(kept.sample.hook.length, 60);
  assert.equal(clampReading(asReading({ ...reading, fonts: { display: "", body: "" } })).fonts.display, "Inter");
  assert.equal(clip("une phrase assez longue pour être coupée", 20), "une phrase assez");
});

test("collage: one free composition lays the Reel's shots, never a paid animation", async () => {
  const { fromEditorPlan, keepWrittenAnimations, normalizeEditPlan } = await import("./editor.ts");
  const { compositionShots, textBands } = await import("./compose.ts");
  const { finishPlan } = await import("./finish.ts");
  const { buildReelProps } = await import("./motion.ts");
  const durations = { a: 10, p: 5 };
  const editor = (layers: { brief: string; from: number; to: number }[]) =>
    fromEditorPlan({
      duration: 5,
      template: "collage",
      transitions: "cut",
      subtitles: false,
      texts: [{ text: "back to culte", from: 0, to: 1.5, style: "hook", emphasis: [] }],
      segments: [
        { clip_id: "a", in: 0, out: 3, move: "none", speed: 1 },
        { clip_id: "p", in: 0, out: 2, move: "none", speed: 1 },
      ],
      layers,
    } as never);

  // The editor forgot it: the engine adds it over the whole Reel, even with no animation left in the budget.
  const added = normalizeEditPlan(editor([]), durations, 0);
  assert.equal(added.layers?.length, 1);
  assert.deepEqual([added.layers![0]!.compose, added.layers![0]!.from, added.layers![0]!.to], [true, 0, added.duration]);
  assert.match(added.layers![0]!.motion.brief, /back to culte/);
  // Its own animation over the whole Reel becomes the composition; another one is counted as usual.
  const asked = editor([
    { brief: "un mur de tirages qui se remplit, elle détourée qui sort du papier à la fin", from: 0, to: 5 },
    { brief: "un compteur", from: 1, to: 3 },
  ]);
  const one = normalizeEditPlan(asked, durations, 1);
  assert.deepEqual(one.layers?.map((l) => [l.motion.brief.slice(0, 13), Boolean(l.compose)]), [
    ["un mur de tir", true],
    ["un compteur", false],
  ]);
  assert.deepEqual(normalizeEditPlan(asked, durations, 0).layers?.map((l) => Boolean(l.compose)), [true]);
  // Another ambiance has none.
  assert.equal(normalizeEditPlan(editPlanSchema.parse({ ...one, template: "doux", layers: [one.layers![0]] }), durations).layers, undefined);

  // A correction that leaves it out keeps it, with its code.
  const scene = "function Scene(){return null}";
  const previous = editPlanSchema.parse({ ...one, layers: [{ ...one.layers![0]!, motion: { ...one.layers![0]!.motion, js: scene } }] });
  const carried = keepWrittenAnimations(editor([]), previous);
  assert.deepEqual(carried.layers?.map((l) => [Boolean(l.compose), l.motion.js]), [[true, scene]]);

  // Its texts keep their usual rows: the composition keeps faces off them (an engine's place goes, a hand-placed one stays).
  const facts = {
    clips: {
      a: {
        duration: 10, orientation: "portrait", summary: "", setting: "", lighting: "ok", best_moments: [], transcript: "", issues: [],
        shots: [{ start: 0, end: 10, description: "elle pousse sur le reformer", subject: "cliente", energy: 4, hook_score: 4, quality: { blurry: false, dark: false, shaky: false }, faces_visible: true, subject_box: [100, 600, 900, 950] }],
      },
    },
    photos: {
      p: { width: 1200, height: 1600, detection: { regions: [{ kind: "face", label: "visage", box_2d: [100, 300, 300, 600], recognizable: true }], adjust: { exposure: 0, contrast: 0, saturation: 0, warmth: 0, straighten: 0 }, subject: { x: 450, y: 500 }, notes: "l'équipe en rang" } },
    },
  } as never;
  const placed = editPlanSchema.parse({ ...previous, texts: [{ text: "back to culte", from: 0, to: 1.5, style: "hook", y: 0.5, auto_y: true }, { text: "rue de culte", from: 2, to: 4, style: "caption", y: 0.3 }] });
  const finished = finishPlan(placed, facts, durations);
  assert.deepEqual(finished.texts.map((t) => t.y), [undefined, 0.3]);
  assert.equal(finished.subtitle_y, undefined);

  // What the designer reads: each shot, when, what it shows; and where the texts go over it (px of 1920).
  assert.deepEqual(
    compositionShots(finished, facts, {}, new Set(["p"])).map((s) => [s.shot, s.de, s.a, s.type, s.format, s.sujet_a, s.visages, s.detouree]),
    [
      // The cut on the collage's beat (108 BPM): 2.78 s.
      [0, 0, 83, "vidéo", "portrait", "droite", true, undefined],
      [1, 83, 150, "photo", "portrait", undefined, true, true],
    ],
  );
  assert.deepEqual(textBands(finished)[0], { de: 0, a: 45, y_haut: 384, y_bas: 768, texte: "back to culte" });

  // The render gets the shots it lays: segment, span, shape, subject, and the photo's cut-out.
  const props = buildReelProps(
    editPlanSchema.parse({ ...finished, layers: [{ ...finished.layers![0]!, motion: { ...finished.layers![0]!.motion, js: scene } }] }),
    {
      template: "collage",
      clipUrls: { a: "https://x/a.mp4", p: "https://x/p.jpg" },
      photoIds: ["p"],
      aspects: { a: 0.5625 },
      photoAspects: { p: 0.75 },
      cutouts: { p: { src: "https://x/p.webp", box: { x: 0.2, y: 0.1, w: 0.5, h: 0.8 } } },
      brand: { name: "Culte" },
    },
  );
  const layer = props.layers![0]!;
  assert.equal(layer.compose, true);
  assert.deepEqual(
    layer.shots?.map((s) => [s.segment, s.from, s.durationInFrames, s.kind, s.cutout ?? null]),
    [
      [0, 0, 83, "video", null],
      [1, 83, 67, "photo", "https://x/p.webp"],
    ],
  );
});

test("what moves: the tracks under each animation, placed as the Reel draws the footage", async () => {
  const { buildReelProps, clipAspect } = await import("./motion.ts");
  const { clipsUnderAnimations, movesForDesigner, sliceTracks, trackWorthy } = await import("./tracking.ts");
  const { MOTION_DESIGNER_PROMPT } = await import("./motion-scene.ts");
  const { EDITOR_SYSTEM_PROMPT } = await import("./editor.ts");

  // Someone in the clip: a gesture Gemini noted, a face, hands at work. A plate alone has nothing to follow.
  const shot = { start: 0, end: 4, description: "", subject: "plat", energy: 3, hook_score: 3, quality: { blurry: false, dark: false, shaky: false }, faces_visible: false };
  assert.equal(trackWorthy({ shots: [shot], actions: [] }), false);
  assert.equal(trackWorthy({ shots: [shot], actions: [{ start: 1, end: 2, what: "elle montre la vitrine" }] }), true);
  assert.equal(trackWorthy({ shots: [{ ...shot, faces_visible: true }] }), true);
  assert.equal(trackWorthy({ shots: [{ ...shot, subject: "mains" }] }), true);
  assert.equal(clipAspect({ orientation: "landscape" }), 16 / 9);

  // A vertical clip: one hand at the centre during its first 4 s, nothing after.
  const hand = [0, ...Array.from({ length: 21 }, (_, k) => [500 + k, 500 + k]).flat()];
  const frames = Array.from({ length: 180 }, (_, i) => (i < 120 ? { h: [hand] } : {}));
  const file = { v: 1, fps: 30, w: 540, h: 960, from: 0, n: 180, frames };
  const slice = sliceTracks(file, 30, 60);
  assert.equal(slice?.from, 30);
  assert.equal(slice?.frames.length, 30);
  assert.equal(slice?.aspect, 0.5625);
  // A passage where nothing is seen gives nothing.
  assert.equal(sliceTracks(file, 130, 170), null);

  const js = "function Scene(){return null}";
  const plan = editPlanSchema.parse({
    ...validPlan,
    duration: 6,
    template: "libre",
    texts: [],
    images: [],
    segments: [
      { clip_id: "a", in: 1, out: 3, zoom: "none" },
      { motion: { brief: "le mot part de sa main", js }, duration: 2, over: { clip_id: "a", in: 2 } },
      { clip_id: "b", in: 0, out: 2, zoom: "none" },
    ],
    layers: [{ motion: { brief: "suit sa main", js }, from: 0, to: 2 }],
  });
  assert.deepEqual(clipsUnderAnimations(plan).sort(), ["a", "b"]);
  assert.deepEqual(clipsUnderAnimations({ ...plan, layers: undefined }), ["a"]);

  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: { a: "https://x/a.mp4", b: "https://x/b.mp4" },
    aspects: { a: 9 / 16, b: 9 / 16 },
    brand: { name: "Culte" },
    tracks: { a: file },
  });
  // The scene over her passage reads it from that passage's first image, with the slow push-in under it.
  const scene = props.segments[1] as { type: string; track?: { at: number; startFrom: number; look: { move?: string }; tracks: { from: number } }[] };
  assert.equal(scene.type, "motion");
  assert.deepEqual(scene.track?.map((p) => ({ at: p.at, startFrom: p.startFrom, move: p.look.move, from: p.tracks.from })), [{ at: 0, startFrom: 60, move: "in", from: 60 }]);
  // The animation over the montage reads the shot under it from its in point; a clip without tracks gives nothing.
  const layer = props.layers?.[0];
  assert.deepEqual(layer?.track?.map((p) => ({ at: p.at, startFrom: p.startFrom, length: p.length, clip: p.clip })), [{ at: 0, startFrom: 30, length: 60, clip: "a" }]);
  // Without tracks, nothing is added.
  const bare = buildReelProps(plan, { template: "libre", clipUrls: { a: "https://x/a.mp4", b: "https://x/b.mp4" }, brand: { name: "Culte" } });
  assert.equal((bare.segments[1] as { track?: unknown }).track, undefined);
  assert.equal(bare.layers?.[0]?.track, undefined);

  // The motion designer is told where the hand is (px of the frame) and the gesture, on its own frames.
  const moves = movesForDesigner(layer!.track!, 60, { a: [{ start: 1.5, end: 2, what: "elle pince l'air" }] });
  assert.deepEqual(moves?.gestes, [{ de: 15, a: 30, quoi: "elle pince l'air" }]);
  const first = moves?.mains?.[0]?.trajet?.[0];
  assert.ok(first && Math.abs(first.paume[0] - 550) <= 2 && Math.abs(first.paume[1] - 977) <= 2, JSON.stringify(first));
  assert.equal(moves?.mains?.[0]?.vue, "images 0 à 55");
  // In a composition, only when things are seen (the shot is laid in a box of its own).
  assert.equal(movesForDesigner(layer!.track!, 60, {}, { positions: false })?.mains?.[0]?.trajet, undefined);

  // The contract says how to read it, without naming any effect; the editor knows the gestures.
  assert.match(MOTION_DESIGNER_PROMPT, /track\(frame\)/);
  assert.match(MOTION_DESIGNER_PROMPT, /function Scene\(\{[^}]*track \}\)/);
  assert.match(EDITOR_SYSTEM_PROMPT, /« actions »/);
});
