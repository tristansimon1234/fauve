import assert from "node:assert/strict";
import { test } from "node:test";
import { readAnswer } from "./answer.ts";
import { HOUSE_MODELS } from "./house-models.ts";
import {
  candidateKey,
  candidateReading,
  cleanTrades,
  proposedReel,
  readingDigest,
  readScoutJudge,
  reelEmbed,
  requestsWords,
  SCOUT_DAILY_EUR,
  SCOUT_JUDGE_EUR,
  SCOUT_JUDGE_PROMPT,
  SCOUT_KNOWN_AT,
  SCOUT_PASS,
  scoutAllows,
  scoutCatalogue,
  scoutJudgeInput,
  scoutJudgeSchema,
  statusOfVerdict,
  type ScoutJudge,
} from "./model-scout.ts";
import type { StolenStyle } from "./steal.ts";

// A Reel's reading as Steal keeps it, built on a model's own (a complete look), with the sheets of a business's copy.
const reading: StolenStyle = {
  look: {
    ...HOUSE_MODELS[0]!.look,
    shots: [
      { at: 0.5, ground: "une rue", laid: "objet", subject: "une tasse" },
      { at: 1.2, ground: "un comptoir", laid: "aucun", subject: "" },
    ],
  },
  measures: { duration: 12.43, cuts: [1, 2.5, 4], bpm: 121.6, lufs: -14, spoken: 0 },
  reader: 7,
  outline: "3 plans, un titre",
  sheets: [{ from: 0, to: 2, path: "0b8f5c2e-0000-4000-8000-000000000000/inspirations/x/sheets/00.jpg" }],
};

const answer = (over: Partial<ScoutJudge> = {}): ScoutJudge => ({
  form: true,
  nearest: "decode",
  closeness: 3,
  what_is_new: "Le texte se découpe dans les fenêtres du décor.",
  name: "Titre dans les fenêtres",
  trades: ["restaurant", "bar"],
  needs: "un plan fixe de sa devanture",
  score: 8,
  why: "Une forme nette qu'aucun modèle ne fait.",
  ...over,
});

test("model scout: a Reel is known by one key however its link is written", () => {
  const code = "instagram:DfLqTq6CgLL";
  for (const link of [
    "https://www.instagram.com/reel/DfLqTq6CgLL/",
    "instagram.com/reels/DfLqTq6CgLL?igsh=abc123",
    "https://www.instagram.com/p/DfLqTq6CgLL/",
    "Regarde ça https://m.instagram.com/cafe.lune/reel/DfLqTq6CgLL/ !",
  ]) {
    assert.equal(candidateKey(link), code, link);
  }
  // Instagram's codes have a case: never folded.
  assert.notEqual(candidateKey("https://www.instagram.com/reel/dflqtq6cgll/"), code);
  assert.equal(candidateKey("https://www.tiktok.com/@cafe.lune/video/7301234567890123456?lang=fr"), "tiktok:7301234567890123456");
  assert.equal(candidateKey("https://www.tiktok.com/@cafe.lune/video/7301234567890123456"), candidateKey("https://m.tiktok.com/v/7301234567890123456"));
  // A short link is known by itself (its host folded, its code kept).
  assert.equal(candidateKey("https://VM.tiktok.com/ZMh3abcDE/"), "tiktok:vm.tiktok.com/ZMh3abcDE");
  assert.equal(candidateKey("https://youtube.com/shorts/abc_DEF-123?si=x"), "youtube:abc_DEF-123");
  assert.equal(candidateKey("https://youtu.be/abc_DEF-123"), "youtube:abc_DEF-123");
  assert.equal(candidateKey("https://example.com/reel/abc"), null);
  assert.equal(candidateKey(""), null);
});

test("model scout: Tristan proposes Instagram Reels and TikToks, never what the reading cannot open", () => {
  assert.deepEqual(proposedReel("  https://www.instagram.com/reel/DfLqTq6CgLL/?igsh=x "), { key: "instagram:DfLqTq6CgLL", link: "https://www.instagram.com/reel/DfLqTq6CgLL/", platform: "instagram" });
  assert.equal(proposedReel("https://www.tiktok.com/@a/video/123")?.platform, "tiktok");
  assert.equal(proposedReel("https://youtube.com/shorts/abc"), null);
  assert.equal(proposedReel("pas un lien"), null);
});

test("model scout: a Reel is shown in its network's own player, nothing kept", () => {
  assert.equal(reelEmbed("instagram:DfLqTq6CgLL"), "https://www.instagram.com/reel/DfLqTq6CgLL/embed/");
  assert.match(reelEmbed("tiktok:7301234567890123456") ?? "", /^https:\/\/www\.tiktok\.com\/player\/v1\/7301234567890123456\?/);
  assert.equal(reelEmbed("youtube:abc_DEF-123"), "https://www.youtube.com/embed/abc_DEF-123");
  assert.equal(reelEmbed("tiktok:vm.tiktok.com/ZMh3abcDE"), null);
});

test("model scout: a candidate keeps the reading without the business's sheets", () => {
  const kept = candidateReading(reading);
  assert.equal(kept.sheets, undefined);
  assert.equal(kept.outline, undefined);
  assert.deepEqual(kept.look, reading.look);
  assert.deepEqual(kept.measures, reading.measures);
  // The business's reading itself is left as it was.
  assert.equal(reading.sheets?.length, 1);
});

test("model scout: the judgement reads the Reel's form in a few lines, nothing of its files", () => {
  const digest = readingDigest(reading);
  assert.equal(digest.layout, reading.look.layout);
  assert.equal(digest.seconds, 12.4);
  assert.equal(digest.shots, 4);
  assert.equal(digest.bpm, 122);
  assert.match(digest.hook, /^mystère : /);
  assert.ok((digest.moments?.length ?? 0) <= 8);
  assert.match(digest.cut_outs ?? "", /^1 plan sur 2 /);
  const text = JSON.stringify(digest);
  assert.doesNotMatch(text, /sheets|inspirations\//);
  assert.equal(readingDigest({ ...reading, look: { ...reading.look, moments: undefined, shots: undefined } }).moments, undefined);
});

test("model scout: the judgement gets where the Reel comes from and its reading, never who sent it", () => {
  const input = JSON.parse(scoutJudgeInput({ reading, platform: "instagram", from: "steal" })) as Record<string, unknown>;
  assert.deepEqual(Object.keys(input), ["from", "platform", "reel"]);
  assert.deepEqual(input.reel, JSON.parse(JSON.stringify(readingDigest(reading))));
  assert.match(String(input.from), /business/);
  assert.match(String(JSON.parse(scoutJudgeInput({ reading, platform: "tiktok", from: "admin" })).from), /team/);
});

test("model scout: the models it is compared with, each once, short enough to keep a judgement near a cent", () => {
  const catalogue = JSON.parse(scoutCatalogue()) as { key: string; name: string; does: string }[];
  assert.equal(catalogue.length, HOUSE_MODELS.length);
  assert.equal(new Set(catalogue.map((m) => m.key)).size, catalogue.length);
  assert.ok(catalogue.every((m) => m.name && m.does));
  assert.equal(scoutCatalogue(), scoutCatalogue());
  // Its name and pitch only, a short prompt: a judgement stays near a cent on Sonnet however many models there are.
  assert.ok(scoutCatalogue().length / catalogue.length < 320, String(scoutCatalogue().length / catalogue.length));
  assert.ok(SCOUT_JUDGE_PROMPT.length < 3_000, String(SCOUT_JUDGE_PROMPT.length));
  assert.match(SCOUT_JUDGE_PROMPT, /in French/i);
  assert.doesNotMatch(SCOUT_JUDGE_PROMPT, /gérante/);
});

test("model scout: the verdict of a judgement", () => {
  assert.equal(readScoutJudge(answer()).verdict, "new_form");
  // Content is never a form, whatever its score.
  assert.equal(readScoutJudge(answer({ form: false, score: 10 })).verdict, "content");
  // A model already does it.
  assert.equal(readScoutJudge(answer({ closeness: SCOUT_KNOWN_AT })).verdict, "known");
  assert.equal(readScoutJudge(answer({ score: SCOUT_PASS - 1 })).verdict, "weak");
  // The nearest model by its key or its name; one that does not exist is none, and cannot make it known.
  assert.equal(readScoutJudge(answer({ nearest: "Titre qui se décode" })).nearest, "decode");
  const unknown = readScoutJudge(answer({ nearest: "titre-inconnu", closeness: 10 }));
  assert.deepEqual([unknown.nearest, unknown.closeness, unknown.verdict], [null, null, "new_form"]);
  // Bounds and words kept clean.
  assert.equal(readScoutJudge(answer({ score: 14 })).score, 10);
  assert.equal(readScoutJudge(answer({ closeness: -3 })).closeness, 0);
  assert.ok(readScoutJudge(answer({ what_is_new: "mot ".repeat(120) })).novelty.length <= 200);
});

test("model scout: an answer past its limits is brought within them", () => {
  const read = readAnswer(scoutJudgeSchema, { ...answer(), what_is_new: "x ".repeat(200), closeness: 12, trades: ["coiffure", "bar", "café", "fleuriste"] });
  assert.ok(read.what_is_new.length <= 200);
  assert.equal(read.closeness, 10);
  assert.equal(read.trades.length, 3);
});

test("model scout: the trades it suits, as chips", () => {
  assert.deepEqual(cleanTrades(["Coiffure", "coiffure ", "", "restaurant.", "boutique", "bar"]), ["coiffure", "restaurant", "boutique"]);
  assert.deepEqual(cleanTrades(["?", "x"]), []);
});

test("model scout: a business's Reel judged new waits for Tristan, the others are kept dropped to count the next requests", () => {
  assert.equal(statusOfVerdict("new_form"), "new");
  for (const verdict of ["known", "content", "weak", "unreadable"] as const) assert.equal(statusOfVerdict(verdict), "dropped");
});

test("model scout: the day's judgements stop at their cap", () => {
  assert.equal(scoutAllows(0), true);
  assert.equal(scoutAllows(SCOUT_DAILY_EUR - SCOUT_JUDGE_EUR), true);
  assert.equal(scoutAllows(SCOUT_DAILY_EUR - SCOUT_JUDGE_EUR / 2), false);
  assert.equal(scoutAllows(0.5, 0.5), false);
});

test("model scout: how often it was sent, for Tristan", () => {
  assert.equal(requestsWords(0), null);
  assert.equal(requestsWords(1), "Envoyé une fois à recopier");
  assert.equal(requestsWords(3), "Envoyé 3 fois à recopier");
});
