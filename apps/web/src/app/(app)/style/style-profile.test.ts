import assert from "node:assert/strict";
import { test } from "node:test";
import { applyStyleForm, nextProfile, sanitizeProfile, styleFormSchema, toStyleForm } from "./style-profile.ts";
import { fontStylesheet, inkOn } from "./style-options.ts";

const form = {
  art_direction: "  Minimaliste et lumineux  ",
  colors: ["#C2410C", "#fbf7f4", "#c2410c"],
  display_font: "Fraunces",
  body_font: null,
  tone: "Doux",
  caption_length: "short" as const,
  emojis: "none" as const,
  hashtags: ["#pilates", "pilates", "reformer"],
  dos: ["Montrer les mains", " ", ""],
  donts: [],
  voice_use: "always" as const,
  voice_id: "8qnuneLiGjGrT4A62CCe",
};

test("style: a missing or broken profile gets the required defaults", () => {
  for (const raw of [undefined, null, "oops", [], { tone: 42, caption_length: "huge" }]) {
    const profile = sanitizeProfile(raw);
    assert.equal(typeof profile.tone, "string");
    assert.equal(profile.caption_length, "medium");
    assert.deepEqual(profile.dos, []);
  }
  const form = toStyleForm(sanitizeProfile({ fonts: ["Bad<Font>", "Inter"], colors: ["#ABCDEF"] }));
  assert.equal(form.display_font, null);
  assert.equal(form.body_font, "Inter");
  assert.deepEqual(form.colors, ["#abcdef"]);
  assert.equal("default_template" in form, false);
  // No voice set yet: Simone puts one when it tells something, with her first voice.
  assert.equal(form.voice_use, "auto");
  assert.equal(form.voice_id, "D6VK2PsbVdaFL5aALfRc");
});

test("style: the form is normalized and applied over the current profile", () => {
  const parsed = styleFormSchema.parse(form);
  assert.equal(parsed.art_direction, "Minimaliste et lumineux");
  assert.deepEqual(parsed.colors, ["#c2410c", "#fbf7f4"]);
  assert.deepEqual(parsed.hashtags, ["pilates", "reformer"]);
  assert.deepEqual(parsed.dos, ["Montrer les mains"]);

  const current = { tone: "x", caption_length: "long", emojis: "many", hashtags: [], visual_notes: "Lumière", dos: [], donts: [], logo_path: "s/brand/logo-1.png", extra: { kept: true } };
  const next = nextProfile(current, (p) => applyStyleForm(p, parsed));
  assert.equal(next.visual_notes, "Lumière");
  assert.equal(next.logo_path, "s/brand/logo-1.png");
  assert.deepEqual(next.extra, { kept: true });
  // The missing body font takes the default one.
  assert.deepEqual(next.fonts, ["Fraunces", "Inter Tight"]);
  assert.deepEqual(next.voice, { use: "always", voice_id: "8qnuneLiGjGrT4A62CCe" });
  assert.equal(toStyleForm(next).voice_use, "always");
});

test("style: emptied optional fields are removed", () => {
  const parsed = styleFormSchema.parse({ ...form, art_direction: "", colors: [], display_font: null });
  const next = nextProfile({ art_direction: "old", colors: ["#000000"], fonts: ["Inter", "Inter"], default_template: "doux" }, (p) =>
    applyStyleForm(p, parsed),
  );
  // An older ambiance goes too: a Reel has its own rhythm now.
  for (const key of ["art_direction", "colors", "fonts", "default_template"]) assert.equal(key in next, false, key);
});

test("style: invalid input is rejected", () => {
  assert.equal(styleFormSchema.safeParse({ ...form, colors: ["red"] }).success, false);
  assert.equal(styleFormSchema.safeParse({ ...form, display_font: "Comic<script>" }).success, false);
  assert.equal(styleFormSchema.safeParse({ ...form, art_direction: "a".repeat(1501) }).success, false);
  assert.equal(styleFormSchema.safeParse({ ...form, colors: Array(7).fill("#000000") }).success, false);
  assert.equal(styleFormSchema.safeParse({ ...form, hashtags: ["deux mots"] }).success, false);
  assert.equal(styleFormSchema.safeParse({ ...form, voice_use: "sometimes" }).success, false);
  assert.equal(styleFormSchema.safeParse({ ...form, voice_id: "../voices" }).success, false);
});

test("style: font stylesheets and ink colour", () => {
  assert.equal(
    fontStylesheet("Instrument Serif"),
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap",
  );
  assert.match(fontStylesheet("Syne"), /family=Syne:wght@400;500;600;700;800&/);
  // A family typed by the manager is requested without axes.
  assert.equal(fontStylesheet("Libre Baskerville"), "https://fonts.googleapis.com/css2?family=Libre+Baskerville&display=swap");
  assert.equal(inkOn("#5b3fd9"), "#FFFFFF");
  assert.equal(inkOn("#fbf7f4"), "#1C1530");
});
