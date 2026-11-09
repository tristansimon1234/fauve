import { test } from "node:test";
import assert from "node:assert/strict";
import { FILM_KINDS, filmGuide, ON_SCREEN } from "./shooting.ts";
import { fileHabit, filesVerdict, filesVerdictLine, type CheckedFile } from "./file-check.ts";
import { FAUVE_SYSTEM_PROMPT, studioContextPrompt } from "./prompts.ts";
import { toolSpecs } from "./tools.ts";
import { APP_GUIDES } from "./app-guide.ts";

// Tristan: « Dans quelle mesure Edith peut conseiller avant la conception d'un Reel », then « oui »; and « les prompts ne
// doivent pas être des règles à rallonge »: the coaching and the verdict are data and code, Edith's prompt only points.

const TRADES = ["studio de Pilates", "salon de coiffure", "restaurant", "fleuriste", "garage", null];

test("film_guide: three shots for any trade and idea, the hook first, short enough to read on a phone", () => {
  for (const businessType of TRADES) {
    for (const kind of FILM_KINDS) {
      for (const who of [...ON_SCREEN, undefined]) {
        const g = filmGuide({ businessType, kind, who });
        assert.equal(g.shots.length, 3);
        assert.equal(g.points.length, 5);
        assert.match(g.points[0]!, /^1re seconde : /);
        assert.match(g.points[3]!, /^Lumière : /);
        assert.match(g.points[4]!, /^Téléphone : .*verticale/);
        for (const p of g.points) assert.ok(p.length <= 140, p);
        assert.ok(g.short.length <= 200, g.short);
        assert.doesNotMatch(JSON.stringify(g), /\{qui\}|undefined|—/);
        // Each shot says how long to film it and where to stand.
        for (const s of g.shots) assert.ok(s.seconds >= 2 && s.seconds <= 10 && s.angle.length > 3);
      }
    }
  }
});

test("film_guide: written with the words of her trade and for who accepts to be seen", () => {
  assert.match(filmGuide({ businessType: "restaurant", kind: "geste" }).points.join(" "), /assiette/);
  assert.match(filmGuide({ businessType: "studio de Pilates", kind: "avant_apres" }).points[1]!, /salle vide/);
  // Her: face to camera; her team: someone of the team; nobody (or unknown): her hands and her voice apart.
  assert.match(filmGuide({ businessType: "salon de coiffure", kind: "conseil", who: "elle" }).points[0]!, /toi face caméra/);
  assert.match(filmGuide({ businessType: "salon de coiffure", kind: "conseil", who: "equipe" }).points[0]!, /quelqu'un de l'équipe face caméra/);
  for (const who of ["personne", undefined] as const) {
    const g = filmGuide({ businessType: "salon de coiffure", kind: "conseil", who });
    assert.doesNotMatch(g.points.join(" "), /face caméra|visage/);
    assert.match(g.points[0]!, /tes mains .* vu d'en haut/);
  }
  // Her subject is named; the evenings of winter come early; her habits change the point they concern.
  assert.match(filmGuide({ businessType: "salon de coiffure", kind: "geste", subject: "le balayage" }).short, /\(le balayage\)/);
  assert.match(filmGuide({ businessType: null, kind: "geste", month: 10 }).light, /avant 16 h/);
  assert.doesNotMatch(filmGuide({ businessType: null, kind: "geste", month: 5 }).light, /16 h/);
  assert.match(filmGuide({ businessType: null, kind: "lieu", habit: "landscape" }).phone, /tes dernières vidéos étaient couchées/);
  assert.match(filmGuide({ businessType: null, kind: "lieu", habit: "mixed" }).light, /une seule sorte de lumière/);
});

// Shapes of real clip analyses (prod, 8 November): a still wide shot of an empty salon, a dark cold night shot filmed
// lying down, a barber at work with a blurred middle.
const salon: CheckedFile = {
  kind: "video",
  width: 1080,
  height: 1920,
  duration: 10.5,
  analysis: {
    duration: 10.5,
    orientation: "portrait",
    lighting: "ok",
    issues: ["Plan totalement statique sans présence humaine ni action"],
    correction: { warmth: -0.05, exposure: 0.1 },
    shots: [{ start: 0, end: 10.5, quality: { dark: false, shaky: false, blurry: false }, hook_score: 1, energy: 1, faces_visible: false }],
  },
};
const night: CheckedFile = {
  kind: "video",
  width: 1920,
  height: 1080,
  duration: 9.8,
  analysis: {
    duration: 9.8,
    orientation: "landscape",
    lighting: "poor",
    issues: ["Scène très sombre avec forte dominante bleue/froide"],
    correction: { warmth: 0.15, exposure: 0.2 },
    shots: [{ start: 0, end: 9.8, quality: { dark: true }, hook_score: 2, energy: 2 }],
  },
};
const barber: CheckedFile = {
  kind: "video",
  width: 1080,
  height: 1920,
  duration: 11.8,
  analysis: {
    duration: 11.8,
    orientation: "portrait",
    lighting: "good",
    issues: ["Perte de point sur le barbier entre 3.0s et 6.5s"],
    correction: { warmth: 0.05, exposure: 0.05 },
    shots: [
      { start: 0, end: 2.8, hook_score: 4, faces_visible: true, energy: 2 },
      { start: 2.8, end: 6.8, quality: { blurry: true }, hook_score: 2 },
      { start: 6.8, end: 11.8, hook_score: 3 },
    ],
  },
};
const warmPhoto: CheckedFile = { kind: "image", width: 1710, height: 1080, adjust: { warmth: -0.15, exposure: 0.05 } };
const keys = (files: CheckedFile[]) => filesVerdict(files).problems.map((p) => p.key);

test("files verdict: what was measured on her files, most important first, with the ten seconds that would fix it", () => {
  // One still shot of an empty room: nothing to open on, and the same image throughout.
  const still = filesVerdict([salon], "salon de coiffure");
  assert.deepEqual(still.problems.map((p) => p.key), ["no_hook", "one_shot"]);
  assert.equal(still.problems[1]!.words, "tout est dans le même plan");
  assert.match(still.fix!, /^3 plans de 3 s qui bougent, pour ouvrir sur tes mains et l'outil/);
  // Someone talking to the camera in one shot says something else in each passage: not « le même plan ».
  const talking = { ...salon, analysis: { ...salon.analysis!, transcript: "Aujourd'hui je te montre…", shots: [{ ...salon.analysis!.shots![0]!, faces_visible: true }] } };
  assert.deepEqual(keys([talking]), []);
  // Named as she sent them, a photo apart from the videos.
  const words = filesVerdict([barber, night, warmPhoto], "restaurant").problems.map((p) => p.words);
  assert.ok(words.includes("ta 2e vidéo et ta photo sont à l'horizontale"), String(words));
  assert.ok(words.includes("ta 2e vidéo est très sombre"), String(words));
  assert.ok(words.includes("des lumières qui ne vont pas ensemble (ta 2e vidéo froide, ta photo jaune)"), String(words));
  assert.equal(filesVerdict([night, { ...night }]).problems.find((p) => p.key === "landscape")!.words, "tes deux vidéos sont à l'horizontale");
  // A good set: nothing to say (a blurred passage under half of a clip is not a blurred clip).
  assert.deepEqual(keys([barber]), []);
  assert.equal(filesVerdictLine([barber]), "Ses fichiers depuis le dernier lancement (1, mesurés) : rien à redire sur leur forme.");
});

test("files verdict: light burnt, against the light, blurred, shaky, too short, photos only, nothing measured", () => {
  const burnt = { ...barber, analysis: { ...barber.analysis!, correction: { exposure: -0.15 } } };
  assert.deepEqual(keys([burnt]), ["burnt"]);
  // Against the light, named plainly; a slight one is not a problem.
  const backlit = { ...barber, analysis: { ...barber.analysis!, issues: ["Contre-jour intense et reflet lumineux"], correction: { exposure: -0.1 } } };
  assert.deepEqual(keys([backlit]), ["backlit"]);
  const slight = { ...barber, analysis: { ...barber.analysis!, issues: ["Léger contre-jour et surexposition ponctuelle"], correction: { exposure: -0.1 } } };
  assert.deepEqual(keys([slight]), []);
  const blurred = { ...barber, analysis: { ...barber.analysis!, shots: barber.analysis!.shots!.map((s) => ({ ...s, quality: { blurry: true, shaky: true } })) } };
  assert.deepEqual(keys([blurred]), ["blurry", "shaky"]);
  assert.match(filesVerdict([blurred]).fix!, /téléphone posé ou à deux mains/);
  const tiny = { ...barber, duration: 1, analysis: { ...barber.analysis!, duration: 1 } };
  assert.deepEqual(keys([barber, tiny]), ["too_short"]);
  assert.deepEqual(keys([tiny]), ["little"]);
  assert.deepEqual(keys([warmPhoto, { ...warmPhoto }]), ["photos_only", "landscape"]);
  // A video not read yet says nothing: no line rather than a guess.
  assert.equal(filesVerdictLine([{ kind: "video", width: 1920, height: 1080, duration: 8 }]), null);
  // Advice, never a refusal: the line says so, and never discards a file.
  const line = filesVerdictLine([salon, night], "studio de Pilates")!;
  assert.match(line, /10 s à filmer qui arrangeraient ça : 3 plans de 3 s qui bougent, pour ouvrir sur les pieds ou les mains/);
  assert.match(line, /elle peut lancer avec ce qu'il y a/);
  assert.ok(line.length < 600, line);
});

test("her habit on her latest videos changes the shot list", () => {
  assert.equal(fileHabit([night, { ...night }, barber]), "landscape");
  assert.equal(fileHabit([barber, { ...barber }]), null);
  assert.equal(fileHabit([barber]), null);
});

test("Edith reads it in her context and from her tools, her prompt only points to it", () => {
  const ctx = studioContextPrompt({ now: "lundi 9 novembre 2026, 10 h", timezone: "Europe/Paris", studioName: "Lune", firstName: null, onboardingStep: "done", instagram: null, files: filesVerdictLine([salon]) });
  assert.match(ctx, /Ses fichiers depuis le dernier lancement \(1, mesurés\) : rien ne bouge assez pour la 1re seconde/);
  assert.match(FAUVE_SYSTEM_PROMPT, /how to film them \(film_guide\)/);
  assert.match(FAUVE_SYSTEM_PROMPT, /her Reel's files as measured \(« Ses fichiers »\)/);
  assert.ok(FAUVE_SYSTEM_PROMPT.length < 12_000);
  assert.equal(toolSpecs.film_guide.input.safeParse({ genre: "geste", qui: "personne", sujet: "la tarte du jour" }).success, true);
  assert.equal(toolSpecs.film_guide.input.safeParse({ genre: "danse" }).success, false);
  assert.match(APP_GUIDES.conseils, /10 secondes à filmer/);
});
