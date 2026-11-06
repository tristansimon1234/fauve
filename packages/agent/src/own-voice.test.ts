import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_GUIDES } from "./app-guide.ts";
import { previewMusic } from "./mix.ts";
import { skillSaysOn } from "./model-voice.ts";
import { buildReelProps } from "./motion.ts";
import {
  gapPauses,
  HEARD_HOLD,
  heardCurrent,
  ownLeadMiss,
  ownTalk,
  ownTrackFilter,
  ownTrackTranscript,
  ownVoiceKey,
  ownVoicePlay,
  readHeard,
  videoVoice,
  withoutVoiceVideo,
} from "./own-voice.ts";
import { editPlanSchema, type ClipAnalysis } from "./schemas.ts";
import { MONTAGE_SKILLS } from "./skill-library.ts";
import { readSkillFill, replaySkillAudio, saidLines, SKILL_FILL_PROMPT, skillFillInput, skillFillSchema, skillPlan, withoutVoice, type SkillFillAnswer, type SkillHeard } from "./skills.ts";
import { cutsOnBeats, snapToTempo } from "./tempo.ts";
import { toolSpecs } from "./tools.ts";
import { voiceTranscriptSchema, type VoiceTranscript } from "./voice.ts";

// Her own recorded voice leading a model whose words are what its voice says (own-voice.ts; docs/voix.md, « Sa voix
// mène le modèle »): her recording played whole (her « euh », false starts and long pauses cut), the model's cuts and
// its words on hers; and her voice taken from one of her videos (« Sa voix tirée d'une de ses vidéos »).

const celui = MONTAGE_SKILLS["celui-la"]!;

/** « Coucou… euh… attends ! Regarde : celle-là… celle-là… et celle-là… et voilà toute la série ! » as Scribe times a voice note (verbatim, her « euh » among her words). */
const NOTE: VoiceTranscript = {
  text: "Coucou… euh… attends ! Regarde : celle-là… celle-là… et celle-là… et voilà toute la série !",
  duration: 9.4,
  words: [
    { w: "Coucou…", start: 0.62, end: 1.1 },
    { w: "euh…", start: 1.45, end: 1.7 },
    { w: "attends", start: 2.05, end: 2.45 },
    { w: "Regarde", start: 2.8, end: 3.15 },
    { w: "celle-là…", start: 3.6, end: 4.05 },
    { w: "celle-là…", start: 4.75, end: 5.2 },
    { w: "et", start: 5.9, end: 6.0 },
    { w: "celle-là…", start: 6.05, end: 6.5 },
    { w: "et", start: 7.4, end: 7.55 },
    { w: "voilà", start: 7.6, end: 7.9 },
    { w: "toute", start: 7.95, end: 8.15 },
    { w: "la", start: 8.15, end: 8.22 },
    { w: "série", start: 8.25, end: 8.6 },
  ],
  language: "fr",
};

/** What her filler finds in it (her words numbered once her « euh » is cut: 0 Coucou… 1 attends 2 Regarde 3 celle-là… …). */
const FOUND: NonNullable<SkillFillAnswer["sa_voix"]> = {
  suit: true,
  mots: [
    { slot: "appel", from: 0, to: 0, text: "Coucou…" },
    { slot: "arret", from: 1, to: 1, text: "Attends !" },
    { slot: "regarde", from: 2, to: 2, text: "Regarde :" },
    { slot: "celui", from: 3, to: 3, text: "Celle-là…" },
    { slot: "celui", from: 4, to: 4, text: "Celle-là…" },
    { slot: "celui", from: 5, to: 6, text: "Et celle-là…" },
    { slot: "et", from: 7, to: 7, text: "Et…" },
    { slot: "fin", from: 9, to: 11, text: "Toute la série !" },
  ],
};

const FILES = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, photo: true, seconds: 0 }));
const answer = (sa_voix: SkillFillAnswer["sa_voix"]): SkillFillAnswer => ({ fits: true, missing: "", shots: FILES.map((f) => ({ file: f.id, at: 0 })), texts: [], end: null, why: "", sa_voix });

/** Her Reel on « Celui-là » led by her voice, as designSkill builds it. */
function heardPlan(note = NOTE, found = FOUND) {
  const talk = ownTalk("note", note)!;
  const said = readHeard(celui, talk, found)!;
  const line = celui.heard!(said, { end: false })!;
  const fill = readSkillFill(celui, FILES, line.shots.length, answer(found), { heard: said })!;
  const key = ownVoiceKey("note", talk, line.lead ?? 0);
  const plan = skillPlan({ skill: celui, name: "Celui-là, celui-là…", files: FILES, fill, voice: { media_id: "track", at: 0 }, heard: { line, leads: { media_id: "note", key } } });
  return { talk, said, line, plan, key };
}

test("her own voice: her recording cut as a creator cuts a voice, never into words: her silences at its ends, her « euh », her long pauses out", () => {
  const talk = ownTalk("note", NOTE)!;
  // From just before her first word (0,35 s) to just after her last (0,5 s): the second of silence it opened on is gone.
  assert.equal(talk.pieces[0]!.in, 0.27);
  assert.equal(talk.pieces.at(-1)!.out, 9.1);
  // Her « euh » cut out (never heard, never written), each of her long pauses cut down to a breath on each side.
  assert.ok(!talk.words.some((w) => /^euh/.test(w.w)));
  assert.ok(talk.pieces.every((p, i) => i === 0 || p.in > talk.pieces[i - 1]!.out), JSON.stringify(talk.pieces));
  const euh = NOTE.words[1]!;
  assert.ok(talk.pieces.every((p) => p.out <= euh.start + 0.05 || p.in >= euh.end - 0.05), "the « euh » is out");
  // Never into a word: each of her words whole inside one piece, on the Reel's clock one after the other.
  for (const w of NOTE.words.filter((x) => !/^euh/.test(x.w))) assert.ok(talk.pieces.some((p) => w.start >= p.in - 0.01 && w.end <= p.out + 0.01), `« ${w.w} » whole`);
  talk.pieces.forEach((p, i) => assert.equal(Math.round((p.end - p.start) * 100), Math.round((p.out - p.in) * 100), `piece ${i}`));
  assert.ok(talk.duration < NOTE.duration - 2, `${talk.duration} s of ${NOTE.duration}`);
  // A pause of hers longer than 0,4 s cut down to a breath on each side (0,24 s), a shorter one kept as she paused, never
  // the words touching: her « celle-là… » 0,7 s apart, now 0,24 s; around her « euh », her two short pauses kept.
  const gaps = talk.words.slice(1).map((w, i) => Math.round((w.start - talk.words[i]!.end) * 100) / 100);
  assert.ok(gaps.every((g) => g >= 0), JSON.stringify(gaps));
  assert.equal(gaps[3], 0.24);
  assert.equal(gaps[0], 0.64);
  assert.ok(Math.max(...gaps) <= 0.65, JSON.stringify(gaps));
  // A false start (« je je ») goes too; her pauses read on her words' own times, as the workshop finds them.
  const restart = ownTalk("n", { duration: 3, words: [{ w: "je", start: 0.3, end: 0.4 }, { w: "je", start: 0.6, end: 0.7 }, { w: "fais", start: 0.75, end: 1 }, { w: "ça", start: 1.05, end: 1.3 }] })!;
  assert.deepEqual(restart.words.map((w) => w.w), ["je", "fais", "ça"]);
  assert.deepEqual(gapPauses([{ start: 0.5, end: 1 }, { start: 1.1, end: 1.4 }, { start: 2, end: 2.2 }], 3), [{ start: 0, end: 0.5 }, { start: 1.4, end: 2 }, { start: 2.2, end: 3 }]);
  // Fewer than three words: nothing to lead with.
  assert.equal(ownTalk("n", { duration: 2, words: [{ w: "Coucou", start: 0.2, end: 0.6 }] }), null);
});

test("her own voice may lead only a model that takes it as its words, from three words, within a Reel's 45 s", () => {
  const whole = (note: VoiceTranscript) => ownTalk("note", note, Infinity);
  assert.equal(ownLeadMiss(celui, whole(NOTE)), null);
  // Every other model: her voice laid over it, as before.
  for (const skill of Object.values(MONTAGE_SKILLS)) if (skill.key !== "celui-la") assert.equal(ownLeadMiss(skill, whole(NOTE)), "model", skill.key);
  assert.equal(ownLeadMiss(celui, null), "words");
  // Longer than a Reel plays (her last word held, an ending card after it): laid over it, or the chain.
  const long: VoiceTranscript = { text: "", duration: 50, words: Array.from({ length: 120 }, (_, i) => ({ w: `mot${i}`, start: 0.3 + i * 0.4, end: 0.6 + i * 0.4 })) };
  assert.equal(ownLeadMiss(celui, whole(long)), "long");
  const near: VoiceTranscript = { text: "", duration: 44, words: Array.from({ length: 100 }, (_, i) => ({ w: `mot${i}`, start: 0.3 + i * 0.42, end: 0.6 + i * 0.42 })) };
  assert.equal(ownLeadMiss(celui, whole(near)), null);
  assert.equal(ownLeadMiss(celui, whole(near), { end: true }), "long");
  assert.equal(HEARD_HOLD, 1);
});

test("her own voice: her filler's finding read against her words: in order, never overlapping, each slot as often as the model takes it", () => {
  const talk = ownTalk("note", NOTE)!;
  // Her words numbered as her filler reads them, her « euh » already out.
  assert.deepEqual(saidLines(talk.words), ["[0] Coucou…", "[1] attends", "[2] Regarde [3] celle-là…", "[4] celle-là…", "[5] et [6] celle-là…", "[7] et [8] voilà [9] toute [10] la [11] série"]);
  const said = readHeard(celui, talk, FOUND)!;
  assert.deepEqual(said.words.map((w) => [w.slot, w.text]), [["appel", "Coucou…"], ["arret", "Attends !"], ["regarde", "Regarde :"], ["celui", "Celle-là…"], ["celui", "Celle-là…"], ["celui", "Et celle-là…"], ["et", "Et…"], ["fin", "Toute la série !"]]);
  // Each one at the instant she says it, on her talk's clock (her first word's, her last's).
  assert.deepEqual([said.words[0]!.at, said.words[5]!.at, said.words[5]!.end], [talk.words[0]!.start, talk.words[5]!.start, talk.words[6]!.end]);
  assert.equal(said.duration, talk.duration);
  // A number not hers, a run overlapping the one before it, a word of no slot, one past its most: left out.
  const messy = readHeard(celui, talk, {
    suit: true,
    mots: [
      ...FOUND.mots,
      { slot: "celui", from: 40, to: 41, text: "Celle-là" },
      { slot: "celui", from: 6, to: 6, text: "Celle-là" },
      { slot: "logo", from: 8, to: 8, text: "Voilà" },
      { slot: "arret", from: 1, to: 1, text: "Attends !" },
    ],
  })!;
  assert.equal(messy.words.length, said.words.length);
  const stops = readHeard(celui, talk, { suit: true, mots: [0, 1, 2, 3].map((k) => ({ slot: "arret", from: k, to: k, text: "Stop !" })).concat(FOUND.mots.filter((m) => m.slot === "celui")) })!;
  assert.equal(stops.words.filter((w) => w.slot === "arret").length, 3);
  // Written as she says it, within its slot's most characters (her own words when the filler wrote none).
  const plain = readHeard(celui, talk, { suit: true, mots: FOUND.mots.filter((m) => m.slot !== "et").map((m) => (m.slot === "fin" ? { ...m, from: 7, to: 11, text: "" } : m)) })!;
  assert.equal(plain.words.at(-1)!.text, "et voilà toute");
  // Not the model's words (she shows nothing one by one), or fewer than three things pointed at: none.
  assert.equal(readHeard(celui, talk, { suit: false, mots: [] }), null);
  assert.equal(readHeard(celui, talk, { suit: true, mots: FOUND.mots.filter((m) => m.text !== "Et celle-là…") }), null);
  assert.equal(readHeard(MONTAGE_SKILLS.mosaique!, talk, FOUND), null);
});

test("her own voice leading the model: its plan cut on her words, its words hers, her recording as its voice, no subtitles, no beat grid", () => {
  const { plan, line, said, key } = heardPlan();
  assert.ok(editPlanSchema.safeParse(plan).success);
  // Her display, her three products, her series: one shot each, each product cut on her word.
  assert.equal(plan.segments.length, 5);
  assert.equal(line.shots.length, 5);
  // Her words on screen, each the time she says it, in its slot's role (its code finds each one by role and moment).
  assert.deepEqual(plan.texts.map((t) => [t.text, t.style]), [["Coucou…", "hook"], ["Attends !", "band"], ["Regarde :", "band"], ["Celle-là…", "band"], ["Celle-là…", "band"], ["Et celle-là…", "band"], ["Et…", "caption"], ["Toute la série !", "caption"]]);
  for (const w of said.words.filter((x) => x.slot !== "celui")) assert.ok(plan.texts.some((t) => Math.abs(t.from - w.at) < 0.011), `« ${w.text} » from ${w.at}`);
  // Her voice, never subtitled (her words are its words on screen); what it was made from and its key.
  assert.equal(plan.subtitles, false);
  assert.deepEqual(plan.voice, { media_id: "track", at: 0 });
  assert.deepEqual(plan.voice_leads, { media_id: "note", key });
  assert.deepEqual(plan.skill, { key: "celui-la", version: 3, heard: true });
  // Its music under her voice, never set on a beat grid (her cuts are hers), never said again by a voice on its beats.
  assert.equal(cutsOnBeats(plan), false);
  assert.equal(cutsOnBeats(withoutVoice(plan)), false);
  assert.equal(skillSaysOn(celui, plan), null);
  assert.equal(replaySkillAudio(celui, plan), null);
  assert.deepEqual(snapToTempo(withoutVoice(plan), {}), withoutVoice(plan));
  assert.equal(plan.tempo, 96.5);
  // « Sans voix »: her voice and what it led go, her words and her cuts stay where she said them.
  const gone = withoutVoice(plan);
  assert.equal("voice" in gone, false);
  assert.equal("voice_leads" in gone, false);
  assert.deepEqual(gone.texts, plan.texts);
  assert.deepEqual(gone.segments, plan.segments);
  // A correction keeps her words it showed (but what her request changes).
  assert.deepEqual(heardCurrent(plan), plan.texts.map((t) => t.text));
  assert.equal(heardCurrent({ ...plan, skill: { key: "celui-la", version: 3 } }), undefined);
  // A browser never writes it: a key of its making is refused.
  assert.equal(editPlanSchema.safeParse({ ...plan, voice_leads: { media_id: "note", key: "../../x" } }).success, false);
});

test("her own voice in the Reel: heard from its track from the first image, her music under it ducked where she speaks (the voice_over mix)", () => {
  const { plan, talk, line } = heardPlan();
  const words = ownTrackTranscript(talk, line.lead ?? 0).words;
  const props = buildReelProps(plan, {
    template: "libre",
    clipUrls: Object.fromEntries(FILES.map((f) => [f.id, `/${f.id}.jpg`])),
    photoIds: FILES.map((f) => f.id),
    brand: { name: "Atelier Terre" },
    soundtrack: "/music.mp3",
    voice: { src: "/ta-voix.mp3", words },
  });
  assert.deepEqual(props.voice, { src: "/ta-voix.mp3", from: 0 });
  // No subtitles: her words are the model's on screen.
  assert.deepEqual(props.words, []);
  assert.equal(props.soundtrack?.volume, previewMusic("voice_over", []).volume);
  const windows = props.soundtrack?.duck?.windows ?? [];
  assert.ok(windows.length >= 1 && windows[0]![0] === Math.round(words[0]!.start * 30), JSON.stringify(windows));
  // Its music shaped on her words: thin until her first product, stopped on her series and back on her last word.
  const first = line.shots[1]!.start;
  const thin = plan.music_shape?.filters ?? [];
  assert.ok(thin.length === 1 && thin[0]!.kind === "thin" && thin[0]!.from === 0 && Math.abs(thin[0]!.to - first) <= 1 / 30, JSON.stringify(thin));
  const last = plan.texts.at(-1)!;
  assert.ok(Math.abs(plan.music_shape!.pauses![0]!.to - last.from) < 0.011, JSON.stringify(plan.music_shape));
});

test("her own voice on the Reel: whole when nothing inside her words is cut, else its own track cut in the workshop, made once", () => {
  const { talk, line } = heardPlan();
  // Her « euh » and her pauses cut: a track of its own, her pieces one after the other.
  assert.deepEqual(ownVoicePlay(talk, 0), { track: true });
  const filter = ownTrackFilter(talk.pieces, { lead: 0, duration: talk.duration });
  assert.match(filter, new RegExp(`asplit=${talk.pieces.length}`));
  assert.equal((filter.match(/atrim=start=/g) ?? []).length, talk.pieces.length);
  assert.match(filter, /\[p0\]atrim|concat=n=6:v=0:a=1,apad,atrim=end=6\.730\[out\]$/);
  // Each edge of a cut faded over 12 ms (a raw cut clicks); later by its lead when she points at once.
  assert.match(filter, /afade=t=in:st=0:d=0\.012/);
  assert.match(ownTrackFilter(talk.pieces, { lead: 0.25, duration: 7 }), /adelay=11025S:all=1,apad,atrim=end=7\.000\[out\]$/);
  // Its words on the track's clock (what the preview ducks the music under, and what the page shows).
  const words = ownTrackTranscript(talk, 0.25);
  assert.equal(words.words[0]!.start, Math.round((talk.words[0]!.start + 0.25) * 100) / 100);
  assert.equal(words.duration, Math.round((talk.duration + 0.25) * 100) / 100);
  assert.ok(voiceTranscriptSchema.safeParse(words).success);
  // Nothing inside her words cut (a note said in one go): her recording itself, from where her first breath lands.
  const once = ownTalk("note", { duration: 4, words: [{ w: "Coucou", start: 1, end: 1.4 }, { w: "celle-là", start: 1.6, end: 2 }, { w: "celle-là", start: 2.2, end: 2.6 }, { w: "et", start: 2.8, end: 2.9 }, { w: "celle-là", start: 2.95, end: 3.3 }] })!;
  assert.equal(once.pieces.length, 1);
  assert.deepEqual(ownVoicePlay(once, 0.2), { track: false, at: -0.45 });
  // The same recording, the same cut, the same lead: the same key (its track kept by a correction); else another.
  assert.equal(ownVoiceKey("note", talk, line.lead ?? 0), heardPlan().key);
  assert.notEqual(ownVoiceKey("note", talk, 0.3), ownVoiceKey("note", talk, 0));
  assert.notEqual(ownVoiceKey("autre", talk, 0), ownVoiceKey("note", talk, 0));
  assert.match(ownVoiceKey("note", talk, 0), /^[0-9a-f]{16}$/);
});

test("her own voice: its filler told what she says, the model's words to find in it and its cases under her voice, nothing else to write", () => {
  const talk = ownTalk("note", NOTE)!;
  type Input = { sa_voix?: { dit: string; cases: string; mots_du_modele: { slot: string; combien: string; max_caracteres: number }[]; ce_qu_elle_dit: string[]; voix_actuelle?: string[] }; cases: unknown[]; textes: unknown[]; mots_dits?: string; voix_off?: unknown; modele: { longueurs: string } };
  const base = { skill: celui, name: "Celui-là, celui-là…", n: 5, files: FILES, business: { name: "Atelier Terre" }, request: "" };
  const input = skillFillInput({ ...base, hers: { talk, current: ["Coucou…"] }, says: true, voiceOver: { text: NOTE.text, phrases: [] } }) as Input;
  assert.match(input.sa_voix!.dit, /Sa propre voix/);
  assert.match(input.sa_voix!.cases, /une case par produit/);
  assert.deepEqual(input.sa_voix!.ce_qu_elle_dit, saidLines(talk.words));
  assert.deepEqual(Object.fromEntries(input.sa_voix!.mots_du_modele.map((m) => [m.slot, m.combien])), {
    appel: "une fois, ou pas du tout",
    arret: "jusqu'à 3 fois, ou pas du tout",
    regarde: "une fois, ou pas du tout",
    celui: "de 3 à 14 fois",
    et: "une fois, ou pas du tout",
    fin: "une fois, ou pas du tout",
  });
  assert.deepEqual(input.sa_voix!.voix_actuelle, ["Coucou…"]);
  // Its cases and its words are what she says: none given, none to write; no other voice laid over it, none saying its words.
  assert.deepEqual(input.cases, []);
  assert.deepEqual(input.textes, []);
  assert.equal(input.mots_dits, undefined);
  assert.equal(input.voix_off, undefined);
  assert.match(input.modele.longueurs, /sa voix : 6,73 s|sa voix : 6\.73 s/);
  // A model that cannot take her voice as its words: never told.
  assert.equal("sa_voix" in skillFillInput({ ...base, skill: MONTAGE_SKILLS.mosaique!, hers: { talk } }), false);
  // Its filler knows how, and its answer holds it.
  assert.match(SKILL_FILL_PROMPT, /With « sa_voix », her own recorded voice/);
  assert.match(SKILL_FILL_PROMPT, /never a word she does not say/);
  assert.ok(skillFillSchema.safeParse(answer(FOUND)).success);
  // Her words are its texts, none required of the filler.
  const fill = readSkillFill(celui, FILES, 5, answer(FOUND), { heard: readHeard(celui, talk, FOUND)! })!;
  assert.deepEqual(fill.texts, { appel: "Coucou…", arret: "Attends !", regarde: "Regarde :", celui: "Celle-là…", et: "Et…", fin: "Toute la série !" });
});

test("her voice taken from one of her videos: from just before her first word to just after her last, her words on it, that video never shown under it", () => {
  const analysis = {
    duration: 20,
    transcript: "Coucou, attends, regarde celle-là",
    words: [
      { w: "Coucou,", start: 3, end: 3.5 },
      { w: "attends,", start: 4.2, end: 4.6 },
      { w: "regarde", start: 5, end: 5.4 },
      { w: "celle-là", start: 5.6, end: 6.1 },
    ],
    speech: { source: "scribe", cleaned: true, floor: -44, fillers: [{ w: "euh", start: 3.7, end: 3.9 }], pauses: [], path: "s1/clean/v1.mp4" },
  } as unknown as Pick<ClipAnalysis, "duration" | "words" | "speech" | "transcript">;
  const taken = videoVoice(analysis, "v1")!;
  assert.deepEqual([taken.from, taken.to], [2.7, 6.6]);
  // Her words on that recording's clock, her « euh » back among them (as Scribe reads a voice note: the engine cuts it again).
  assert.deepEqual(taken.transcript!.words.map((w) => [w.w, w.start]), [["Coucou,", 0.3], ["euh", 1], ["attends,", 1.5], ["regarde", 2.3], ["celle-là", 2.9]]);
  assert.equal(taken.transcript!.duration, 3.9);
  assert.equal(taken.transcript!.text, "Coucou, attends, regarde celle-là");
  assert.deepEqual(taken.transcript!.video, { media_id: "v1", from: 2.7 });
  assert.ok(voiceTranscriptSchema.safeParse(taken.transcript).success);
  // Its words as Gemini heard them (approximate): its span only, Scribe reads it once taken.
  assert.equal(videoVoice({ ...analysis, speech: { ...analysis.speech!, source: "gemini" } }, "v1")!.transcript, null);
  // Nobody speaks in it: no voice to take.
  assert.equal(videoVoice({ duration: 8, transcript: "", words: [] }, "v2"), null);
  // That video never shown under her voice, unless it is her only file.
  assert.deepEqual(withoutVoiceVideo(["v1", "p1", "p2"], "v1"), ["p1", "p2"]);
  assert.deepEqual(withoutVoiceVideo(["v1"], "v1"), ["v1"]);
  assert.deepEqual(withoutVoiceVideo(["v1", "p1"], undefined), ["v1", "p1"]);
});

test("her own voice in what Edith knows: her tool takes a video's voice only when she asks, her mode d'emploi says it all", () => {
  const field = toolSpecs.update_post.input.shape.voice_media_id;
  assert.match(field.description ?? "", /prends ma voix de la vidéo/);
  assert.match(field.description ?? "", /Jamais la voix de quelqu'un d'autre/);
  assert.match(APP_GUIDES.voix, /sa voix qui mène ce Reel/);
  assert.match(APP_GUIDES.voix, /la voix d'une de ses vidéos où elle parle/);
  // Her own voice's words on her talk's clock: as she says them, the same model of her voice note.
  const kept: SkillHeard = readHeard(celui, ownTalk("note", NOTE)!, FOUND)!;
  assert.ok(kept.words.every((w) => w.end > w.at));
});
