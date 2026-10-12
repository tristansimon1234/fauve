import assert from "node:assert/strict";
import { test } from "node:test";
import { editPlanObjectSchema, editPlanSchema } from "./schemas.ts";
import { canTransition } from "./status.ts";
import { claudeCostUsd, usdToEur } from "./pricing.ts";
import { isInSessionWindow } from "./whatsapp-templates.ts";

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

test("pricing: the chat model is priced", async () => {
  const { CHAT_MODEL, claudeCostUsd } = await import("./pricing.ts");
  assert.equal(claudeCostUsd(CHAT_MODEL, { input_tokens: 1_000_000, output_tokens: 100_000 }), 3);
});
