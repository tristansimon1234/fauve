import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_GUIDES } from "./app-guide.ts";
import { previewMusic } from "./mix.ts";
import {
  modelVoiceChoice,
  readingSpans,
  SAID_GAP,
  SAID_SPEED_MAX,
  saidCues,
  saidKey,
  saidPlacements,
  saidReading,
  saidSpans,
  saidTrackFilter,
  saidTranscript,
  sayWords,
  skillSaysOn,
  type SaidCost,
  type SaidPlacement,
  type SayWordsIO,
} from "./model-voice.ts";
import { buildReelProps } from "./motion.ts";
import { editPlanSchema } from "./schemas.ts";
import { MONTAGE_SKILLS } from "./skill-library.ts";
import { SKILL_FILL_PROMPT, skillFillInput, skillPlan, withoutVoice } from "./skills.ts";
import { leadPlan } from "./sound-follow.ts";
import { cutsOnBeats } from "./tempo.ts";
import { DEFAULT_VOICE_ID, fromTtsAlignment, SIMONE_VOICES, type OwnVoice } from "./voice-over.ts";

// A model whose words are what its voice says (model-voice.ts; docs/voix.md, « La voix dit les mots du modèle »):
// « Celui-là, celui-là… » declares it, its words said each at its moments, laid on one track, the voice she chose.

const celui = MONTAGE_SKILLS["celui-la"]!;
const WORDS: Record<string, string> = { appel: "Hééééé", arret: "Attends !", regarde: "Regarde", celui: "Celle-là", et: "Eeeeet…", fin: "Tout ça !" };
const FILES = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
const voiceOf = (name: string) => SIMONE_VOICES.find((v) => v.name === name)!.id;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Her Reel on « Celui-là » as the engine builds it (skillPlan): nine photos, her words. */
const celuiPlan = (texts: Record<string, string> = WORDS) =>
  skillPlan({ skill: celui, name: "Celui-là, celui-là…", files: FILES, fill: { shots: FILES.map((f) => ({ file: f.id, at: 0 })), texts, end: null } });

/** Their sound in a reading (s): a stretched hail longer than its moment, a stop word too long to be said three times in 0,4 s. */
const SPANS = {
  "Hééééé": { in: 0.1, out: 0.9, dips: [] },
  "Attends !": { in: 1.3, out: 1.75, dips: [1.45] },
  Regarde: { in: 2.2, out: 2.65, dips: [] },
  "Celle-là": { in: 3.1, out: 3.5, dips: [] },
  "Eeeeet…": { in: 4, out: 4.9, dips: [] },
  "Tout ça !": { in: 5.3, out: 5.8, dips: [] },
};

test("a model's said words: each at its moments on the beats, never into the next one, sped up a little, else shortened between two syllables", () => {
  const plan = celuiPlan();
  const cues = skillSaysOn(celui, plan)!;
  // Her hail, her stop word on its three pops, « Regarde », her pointing word on each of her seven products, her
  // hesitation, her last word; each one's room up to the next word, the last one's to the Reel's end.
  assert.deepEqual(cues.map((c) => c.text), ["Hééééé", "Attends !", "Attends !", "Attends !", "Regarde", ...Array<string>(7).fill("Celle-là"), "Eeeeet…", "Tout ça !"]);
  cues.forEach((c, i) => assert.equal(c.until, cues[i + 1]?.at ?? plan.duration));
  // On the frames its code shows them (the original's moments): her words' own frames, and each product's cut.
  assert.equal(plan.segments.length, 9);
  assert.deepEqual(cues.map((c) => Math.round(c.at * 30)).slice(0, 6), [1, 21, 26, 33, 52, 71]);
  assert.equal(Math.round(cues.at(-1)!.at * 30), 248);
  const laid = saidPlacements(cues, SPANS, plan.duration);
  // The second pop of her stop word, while the first still sounds, is left out; the third is said; seven pointing words.
  assert.deepEqual(laid.filter((p) => p.text === "Attends !").map((p) => p.at), [0.7, 1.1]);
  assert.equal(laid.filter((p) => p.text === "Celle-là").length, 7);
  // Never into the next word (SAID_GAP before it), sped up SAID_SPEED_MAX at most, its pitch kept.
  laid.forEach((p, i) => {
    const ends = p.at + (p.out - p.in) / p.speed;
    assert.ok(ends <= (laid[i + 1]?.at ?? plan.duration) - SAID_GAP + 0.006, `« ${p.text} » at ${p.at} ends at ${ends}`);
    assert.ok(p.speed >= 1 && p.speed <= SAID_SPEED_MAX, `« ${p.text} » ×${p.speed}`);
  });
  // Her stretched hail, longer than its moment: a little faster, whole; the stop word said twice, the first a little faster.
  assert.ok(laid[0]!.speed > 1.2 && !laid[0]!.cut && laid[0]!.out === 0.9, JSON.stringify(laid[0]));
  assert.ok(laid[1]!.speed > 1 && laid[2]!.speed === 1, JSON.stringify(laid.slice(1, 3)));
  // Too long even sped up: shortened at its last dip between two syllables that leaves most of it, never mid-syllable…
  const long = saidPlacements([{ slot: "regarde", text: "Regarde-moi ça", at: 1, until: 1.5 }], { "Regarde-moi ça": { in: 0, out: 1, dips: [0.35, 0.62] } }, 1.5);
  assert.deepEqual(long[0], { text: "Regarde-moi ça", at: 1, in: 0, out: 0.62, speed: SAID_SPEED_MAX, cut: true });
  // … else (a held vowel, no dip) at its room, faded.
  const held = saidPlacements([{ slot: "appel", text: "Hééééé", at: 0, until: 0.4 }], { "Hééééé": { in: 0, out: 1, dips: [] } }, 5);
  assert.ok(held[0]!.cut && Math.abs(held[0]!.out - (0.4 - SAID_GAP) * SAID_SPEED_MAX) < 0.002, JSON.stringify(held[0]));
  // A Reel held longer on its first image (a sound she follows): every moment later by it.
  const led = skillSaysOn(celui, leadPlan(plan, 0.2))!;
  led.forEach((c, i) => assert.ok(Math.abs(c.at - cues[i]!.at - 0.2) < 0.002, `${c.text}: ${c.at}`));
});

test("a model's said words: read once in one go, each cut out of the reading on its own sound, a breath left out, a plosive kept whole", () => {
  const cues = skillSaysOn(celui, celuiPlan())!;
  const reading = saidReading(cues);
  // Each word once, in the order it is first said, each its own sentence: one call, one voice, one level.
  assert.equal(reading.text, "Hééééé. Attends ! Regarde. Celle-là. Eeeeet… Tout ça !");
  assert.deepEqual(reading.words, ["Hééééé", "Attends !", "Regarde", "Celle-là", "Eeeeet…", "Tout ça !"]);
  // ElevenLabs' timing of each character, grouped in words as for every voice (fromTtsAlignment): each word from its
  // first token to its last (« Tout ça ! » two of them).
  const chars = [...reading.text];
  const transcript = fromTtsAlignment({ characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05) }, reading.text);
  const aligned = readingSpans(reading.words, transcript)!;
  assert.equal(aligned.length, 6);
  assert.deepEqual(aligned[5], { start: transcript.words.at(-2)!.start, end: transcript.words.at(-1)!.end });
  assert.equal(readingSpans(["Un", "Deux"], { words: [{ w: "Un.", start: 0, end: 0.3 }] }), null);
  // Its levels every 10 ms: a breath (−34 dB) before the first word, a plosive's closure inside the second (« a-ttends »).
  const levels = Array.from({ length: 300 }, (_, i) =>
    i >= 12 && i < 20 ? -34 : i >= 30 && i < 70 ? -14 : i >= 120 && i < 132 ? -16 : i >= 132 && i < 140 ? -60 : i >= 140 && i < 170 ? -12 : i >= 240 && i < 280 ? -15 : -70,
  );
  const spans = saidSpans([{ start: 0.32, end: 0.68 }, { start: 1.22, end: 1.68 }, { start: 2.45, end: 2.7 }], levels);
  assert.deepEqual(spans, [
    // Its breath left out, its sound kept whole with a hair before its attack and after its release.
    { in: 0.285, out: 0.73, dips: [] },
    // Joined across its closure, noted as where it may be shortened without cutting a syllable.
    { in: 1.185, out: 1.73, dips: [1.325] },
    // On its own sound, wherever ElevenLabs timed it.
    { in: 2.385, out: 2.83, dips: [] },
  ]);
  // Without levels (the workshop did not read them): ElevenLabs' timing, with a small margin.
  assert.deepEqual(saidSpans([{ start: 0.32, end: 0.68 }, { start: 1.22, end: 1.68 }], [])[0], { in: 0.29, out: 0.74, dips: [] });
});

test("a model's said words: one track the Reel's length, each word levelled like a voice, delayed to the sample, on silence", () => {
  const placed: SaidPlacement[] = [
    { text: "Hééééé", at: 0.033, in: 0.285, out: 0.73, speed: 1.2 },
    { text: "Attends !", at: 0.7, in: 1.185, out: 1.735, speed: 1 },
  ];
  const filter = saidTrackFilter(placed, { gain: 3.5, duration: 9.2 });
  assert.match(filter, /^\[0:a\]aformat=sample_rates=44100:channel_layouts=mono,volume=3\.5dB,asplit=2\[w0\]\[w1\];/);
  assert.match(filter, /\[w0\]atrim=start=0\.285:end=0\.730,asetpts=PTS-STARTPTS,atempo=1\.200,afade=t=in:d=0\.005,afade=t=out:st=0\.341:d=0\.03,adelay=1455S:all=1\[d0\]/);
  assert.match(filter, /\[w1\]atrim=start=1\.185:end=1\.735,asetpts=PTS-STARTPTS,afade=t=in:d=0\.005,afade=t=out:st=0\.520:d=0\.03,adelay=30870S:all=1\[d1\]/);
  assert.match(filter, /\[d0\]\[d1\]amix=inputs=2:duration=longest:normalize=0,apad,atrim=end=9\.200,alimiter=limit=0\.891:level=false\[out\]$/);
  // One word: no split nor mix; a shortened one fades out over 60 ms; none: silence.
  assert.match(saidTrackFilter([{ ...placed[0]!, cut: true }], { gain: 0, duration: 4 }), /^\[0:a\]aformat=sample_rates=44100:channel_layouts=mono\[w0\];\[w0\]atrim=.*:d=0\.06,adelay=1455S:all=1\[d0\];\[d0\]apad,atrim=end=4\.000,/);
  assert.equal(saidTrackFilter([], { gain: 0, duration: 4 }), "anullsrc=r=44100:cl=mono,atrim=end=4.000[out]");
  // Its words on the Reel's clock, as a voice's transcript: what the preview ducks the music under.
  assert.deepEqual(saidTranscript(placed, 9.2), {
    text: "Hééééé Attends !",
    duration: 9.2,
    words: [
      { w: "Hééééé", start: 0.03, end: 0.4 },
      { w: "Attends !", start: 0.7, end: 1.25 },
    ],
    language: "fr",
  });
});

test("a model's said words: the voice chosen, Edith's default for her or hers, a man's when she asks, none when she takes it away", () => {
  const says = celui.saysWords;
  const auto = { use: "auto" as const };
  const clone: OwnVoice = { id: "OwnVoice12345", name: "Ma voix", made_at: "2026-11-01" };
  // By default: Edith's default voice, or the one her business chose (Style › Voix off).
  assert.equal(modelVoiceChoice({ says, post: null, studio: auto, own: null }), DEFAULT_VOICE_ID);
  assert.equal(modelVoiceChoice({ says, post: null, studio: { use: "auto", voice_id: voiceOf("Jules") }, own: null }), voiceOf("Jules"));
  // The one she chose for this Reel (« Créer » › Voix off, the Reel's page), her own clone, a man's voice when she asks one.
  assert.equal(modelVoiceChoice({ says, post: { mode: "on", voice_id: voiceOf("Lucie") }, studio: { use: "auto", voice_id: voiceOf("Jules") }, own: null }), voiceOf("Lucie"));
  assert.equal(modelVoiceChoice({ says, post: null, studio: { use: "auto", voice_id: clone.id }, own: clone }), clone.id);
  const man = SIMONE_VOICES.find((v) => v.id === modelVoiceChoice({ says, post: null, studio: auto, own: null, gender: "homme" }));
  assert.ok(man && man.gender === "m" && !man.asmr, JSON.stringify(man));
  assert.equal(modelVoiceChoice({ says, post: { mode: "on", voice_id: voiceOf("Jules") }, studio: auto, own: null, gender: "homme" }), voiceOf("Jules"));
  // Another business's clone (or a voice deleted since) is never read for her: the default voice.
  assert.equal(modelVoiceChoice({ says, post: { mode: "on", voice_id: "SomeoneElse1234" }, studio: auto, own: clone }), DEFAULT_VOICE_ID);
  // None: « Sans voix » on this Reel, « Jamais » for her business, her own voice laid over it, the sound of the Reel she copies kept.
  assert.equal(modelVoiceChoice({ says, post: { mode: "off" }, studio: auto, own: null }), null);
  assert.equal(modelVoiceChoice({ says, post: null, studio: { use: "never" }, own: null }), null);
  assert.equal(modelVoiceChoice({ says, post: null, studio: auto, own: null, laid: true }), null);
  assert.equal(modelVoiceChoice({ says, post: null, studio: auto, own: null, keptSound: true }), null);
  // Asked for this Reel, over her business's « Jamais »; a Reel she copies without a voice gets none unless she asks.
  assert.equal(modelVoiceChoice({ says, post: { mode: "on" }, studio: { use: "never" }, own: null }), DEFAULT_VOICE_ID);
  assert.equal(modelVoiceChoice({ says, post: null, studio: auto, own: null, copied: "aucune" }), null);
  assert.equal(modelVoiceChoice({ says, post: { mode: "on" }, studio: auto, own: null, copied: "aucune" }), DEFAULT_VOICE_ID);
  assert.equal(modelVoiceChoice({ says, post: null, studio: auto, own: null, copied: "quelqu'un parle" }), DEFAULT_VOICE_ID);
  // A model that would not say them by default: only when she asks.
  assert.equal(modelVoiceChoice({ says: { ...says!, default: false }, post: null, studio: auto, own: null }), null);
  assert.equal(modelVoiceChoice({ says: { ...says!, default: false }, post: { mode: "on" }, studio: auto, own: null }), DEFAULT_VOICE_ID);
  // Edith knows it, in her mode d'emploi, by what it does: never by the model's name (Tristan, 6 November: « je préfère
  // ne pas divulguer nos modèles »).
  assert.match(APP_GUIDES.voix, /le même petit mot tombe sur chacun de ses produits \(« Celui-là »\), la voix dit les mots écrits à l'écran/);
  assert.doesNotMatch(APP_GUIDES.voix, /Celui-là, celui-là/);
});

test("a model's said words: a correction keeps the voice and its words but what her request changes; « Sans voix » takes it away", () => {
  const plan = celuiPlan();
  const cues = skillSaysOn(celui, plan)!;
  const key = saidKey(DEFAULT_VOICE_ID, cues);
  // The same words, the same voice: the same key (the track of the version it corrects is kept, nothing read again).
  assert.equal(saidKey(DEFAULT_VOICE_ID, skillSaysOn(celui, celuiPlan())!), key);
  // A word changed (her request, or by hand in « Modifier »): the voice says the new one, its key another (made again).
  const changed = { ...plan, texts: plan.texts.map((t) => (t.text === "Celle-là" ? { ...t, text: "Celui-là" } : t)) };
  const said = skillSaysOn(celui, changed)!;
  assert.equal(said.filter((c) => c.text === "Celui-là").length, 7);
  assert.notEqual(saidKey(DEFAULT_VOICE_ID, said), key);
  // Its last word taken out: her pointing word with « ! » said in its place.
  const noLast = celuiPlan({ ...WORDS, fin: "" });
  assert.equal(skillSaysOn(celui, noLast)!.at(-1)!.text, "Celle-là !");
  // Another voice: another key.
  assert.notEqual(saidKey(voiceOf("Jules"), cues), key);
  // A plan of another version of it, or whose cut changed: nothing said again, kept as it is.
  assert.equal(skillSaysOn(celui, { ...plan, skill: { key: "celui-la", version: 1 } }), null);
  assert.equal(skillSaysOn(celui, { ...plan, duration: plan.duration + 1 }), null);
  // On the plan: its track from 0, its voice named, subtitles off (its words are on screen); never a voice id of the browser's making.
  const voiced = { ...plan, voice: { media_id: "track", at: 0 }, says_words: { voice_id: DEFAULT_VOICE_ID, key }, subtitles: false };
  assert.ok(editPlanSchema.safeParse(voiced).success);
  assert.equal(editPlanSchema.safeParse({ ...voiced, says_words: { voice_id: "../../x" } }).success, false);
  // « Sans voix »: its voice and the voice saying its words gone, her words on screen as they are.
  const gone = withoutVoice(voiced);
  assert.equal("voice" in gone, false);
  assert.equal("says_words" in gone, false);
  assert.equal(gone.subtitles, false);
  assert.deepEqual(gone.texts, plan.texts);
  assert.deepEqual(gone.layers, plan.layers);
});

test("a model's said words in the Reel: heard from its track, no subtitles, her music under it as under any voice, its cuts on its beats", () => {
  const plan = celuiPlan();
  const cues = skillSaysOn(celui, plan)!;
  const voiced = { ...plan, voice: { media_id: "track", at: 0 }, says_words: { voice_id: DEFAULT_VOICE_ID, key: saidKey(DEFAULT_VOICE_ID, cues) }, subtitles: false };
  const words = saidTranscript(saidPlacements(cues, SPANS, plan.duration), plan.duration).words;
  const props = buildReelProps(voiced, {
    template: "libre",
    clipUrls: Object.fromEntries(FILES.map((f) => [f.id, `/${f.id}.jpg`])),
    photoIds: FILES.map((f) => f.id),
    brand: { name: "Atelier Terre" },
    soundtrack: "/music.mp3",
    voice: { src: "/mots.mp3", words },
  });
  assert.deepEqual(props.voice, { src: "/mots.mp3", from: 0 });
  assert.deepEqual(props.words, []);
  // The music under it, ducked while its words are said (the voice_over mix), as in the render's mix: from her hail to
  // her last word.
  assert.equal(props.soundtrack?.volume, previewMusic("voice_over", []).volume);
  const windows = props.soundtrack?.duck?.windows ?? [];
  assert.ok(windows.length >= 1 && windows[0]![0] === 1 && windows.at(-1)![0] === 248, JSON.stringify(windows));
  assert.equal(cutsOnBeats(voiced), true);
});

test("a model's said words: one reading for all of them, its cost logged by the character (kind voice), the workshop's seconds too", async () => {
  const plan = celuiPlan();
  const cues = skillSaysOn(celui, plan)!;
  const key = saidKey(DEFAULT_VOICE_ID, cues);
  const reading = saidReading(cues);
  const costs: SaidCost[] = [];
  const kept: Parameters<SayWordsIO["keep"]>[0][] = [];
  const read: string[] = [];
  const io: SayWordsIO = {
    speak: async (text, voiceId) => {
      read.push(`${voiceId}: ${text}`);
      // A character every 50 ms, as ElevenLabs times them.
      const chars = [...text];
      const transcript = fromTtsAlignment({ characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05) }, text);
      return { mp3: new Uint8Array([1, 2, 3]), transcript, model: "eleven_v4", voiceId };
    },
    lay: async (_reading, compose) => {
      // Its levels not read: ElevenLabs' timing with a margin; its loudness −22 LUFS, brought to a voice's −14.
      const { filter, laid } = compose({ lufs: -22, levels: [] });
      assert.match(filter, /volume=8dB/);
      return { mp3: new Uint8Array([9]), lufs: -22, laid, seconds: 4.2 };
    },
    cost: async (row) => {
      costs.push(row);
    },
    keep: async (track) => {
      kept.push(track);
      return "m1";
    },
  };
  const prices = { usdPerKchar: 0.08, eur: (usd: number) => usd * 0.9, sandboxEur: (seconds: number) => seconds * 0.001 };
  const made = await sayWords(io, { cues, voiceId: DEFAULT_VOICE_ID, duration: plan.duration, key, prices });
  assert.equal(made.mediaId, "m1");
  // Read once, with her voice, all her words in one go.
  assert.deepEqual(read, [`${DEFAULT_VOICE_ID}: ${reading.text}`]);
  // Its cost per call, kind voice: the reading by the character (ElevenLabs), then the workshop's seconds that laid it.
  assert.deepEqual(costs.map((c) => [c.kind, c.provider, c.units]), [["voice", "elevenlabs", reading.text.length], ["voice", "vercel_sandbox", 4]]);
  assert.ok(Math.abs(costs[0]!.cost_eur - (reading.text.length / 1000) * 0.08 * 0.9) < 1e-12);
  assert.ok(Math.abs(costs[1]!.cost_eur - 0.0042) < 1e-12);
  assert.deepEqual(costs.map((c) => c.meta.purpose), ["said_words", "said_words"]);
  // Kept with its words on the Reel's clock, each at its moment, its voice, its key.
  assert.deepEqual(kept[0]!.ai, { mode: "said_words", voice_id: DEFAULT_VOICE_ID, model: "eleven_v4", lufs: -22, key });
  assert.deepEqual(kept[0]!.transcript.words.map((w) => w.start), made.laid.map((p) => round2(p.at)));
  assert.equal(made.laid.filter((p) => p.text === "Celle-là").length, 7);
  // Its reading paid even when what follows fails (a timing that does not match its words): the Reel goes without it.
  costs.length = 0;
  await assert.rejects(sayWords({ ...io, speak: async (_text, voiceId) => ({ mp3: new Uint8Array(), transcript: { words: [] }, model: "eleven_v4", voiceId }) }, { cues, voiceId: DEFAULT_VOICE_ID, duration: plan.duration, key, prices }));
  assert.deepEqual(costs.map((c) => c.provider), ["elevenlabs"]);
});

test("nothing said for a model that does not declare it: no moments, no voice, its filler never told", () => {
  for (const skill of Object.values(MONTAGE_SKILLS)) {
    if (skill.key === "celui-la") continue;
    assert.equal(skill.saysWords, undefined, skill.key);
    assert.equal(modelVoiceChoice({ says: skill.saysWords, post: { mode: "on" }, studio: { use: "auto" }, own: null }), null, skill.key);
    assert.deepEqual(saidCues(skill, skill.timeline(skill.shots[0], { end: false }), WORDS, 30), [], skill.key);
  }
  const mosaique = MONTAGE_SKILLS.mosaique!;
  const files = Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, photo: true, seconds: 0 }));
  const plan = skillPlan({ skill: mosaique, name: "Mosaïque qui change", files, fill: { shots: files.map((f) => ({ file: f.id, at: 0 })), texts: { titre: "Bouquets du jour" }, end: null } });
  assert.equal(skillSaysOn(mosaique, plan), null);
  assert.equal("mots_dits" in skillFillInput({ skill: mosaique, name: "Mosaïque qui change", n: 8, files, business: {}, request: "", says: true }), false);
  // Its filler knows that a voice saying a model's words fits, and that those words must be said in time.
  assert.match(SKILL_FILL_PROMPT, /With « mots_dits », a voice says this model's own words/);
  assert.match(SKILL_FILL_PROMPT, /a text marked « dit_par_la_voix » is also heard/);
});
