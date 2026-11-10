import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_GUIDES } from "./app-guide.ts";
import {
  curateIdeas,
  IDEA_DOORS,
  IDEA_NAMES,
  ideaCity,
  ideaDoors,
  ideaFits,
  ideaMonth,
  ideaName,
  ideaPreviewPath,
  ideaTrade,
  IDEAS_FLOOR,
  IDEAS_MAX,
  IDEAS_MIN,
  unnamedIdeas,
  type IdeaFile,
} from "./house-ideas.ts";
import { HOUSE_MODELS } from "./house-models.ts";
import { MONTAGE_SKILLS } from "./skill-library.ts";
import { toolSpecs } from "./tools.ts";

// « Regarde nos idées » (docs/modeles.md, « Nos modèles restent internes »; Tristan, 10 November).

const ALL = Object.values(MONTAGE_SKILLS).map((s) => ({ key: s.key, least: s.files[0] }));
const files = (n: number, shows: string, extra: Partial<IdeaFile> = {}): IdeaFile[] =>
  Array.from({ length: n }, (_, i) => ({ kind: i % 3 === 2 ? "photo" : "video", seconds: 8, shows, aspect: 0.56, ...extra }));
const SALON = files(6, "Une coiffeuse coupe les cheveux d'une cliente dans le salon, gros plan sur les ciseaux");

test("every idea has a plain name of its own: never its team name, never « modèle »", () => {
  assert.deepEqual(unnamedIdeas(), []);
  for (const m of HOUSE_MODELS) {
    const name = IDEA_NAMES[m.key]!;
    assert.ok(name.length >= 6 && name.length <= 32, m.key);
    assert.doesNotMatch(name, /mod[eè]le|template|skill/i, m.key);
  }
  assert.equal(new Set(Object.values(IDEA_NAMES)).size, Object.keys(IDEA_NAMES).length, "two ideas with the same name");
  assert.equal(ideaName("nope"), null);
  assert.equal(ideaPreviewPath("rallume", "mp4"), "house/previews/rallume.mp4");
});

test("6 to 8 ideas, never the catalogue: only the validated candidates her files can make, her trade's first", () => {
  const shown = curateIdeas({ studioId: "a", month: "2026-11", trade: ideaTrade("salon de coiffure"), files: SALON, candidates: ALL });
  assert.ok(shown.length >= IDEAS_MIN && shown.length <= IDEAS_MAX, String(shown.length));
  assert.ok(shown.length < ALL.length);
  // Her trade's own ideas lead (the split screen of the gesture and its result, the step by step).
  assert.ok(shown.slice(0, 4).some((k) => k === "ecran-partage" || k === "recette"), shown.join());
  // Only what was validated for her (the candidates the server passes: skillGate, a preview kept).
  const few = ALL.filter((c) => ["nike", "decode", "mosaique", "quatre-coins"].includes(c.key));
  const gated = curateIdeas({ studioId: "a", month: "2026-11", trade: "coiffure", files: SALON, candidates: few });
  assert.deepEqual([...gated].sort(), ["decode", "mosaique", "nike", "quatre-coins"]);
  // Below the floor, no page at all.
  assert.deepEqual(curateIdeas({ studioId: "a", month: "2026-11", trade: "coiffure", files: SALON, candidates: few.slice(0, IDEAS_FLOOR - 1) }), []);
  // Deterministic: the same business, the same month, the same files, the same ideas.
  assert.deepEqual(curateIdeas({ studioId: "a", month: "2026-11", trade: "coiffure", files: SALON, candidates: ALL }), shown);
});

test("an idea needs what her files have: someone talking, the evening, a shop front, enough files", () => {
  const talk = files(3, "Une gérante parle face caméra devant un mur blanc", { speaks: true });
  const silent = files(3, "Une gérante devant un mur blanc");
  assert.equal(ideaFits("mot-cle", 1, talk), true);
  assert.equal(ideaFits("mot-cle", 1, silent), false);
  assert.equal(ideaFits("rallume", 4, files(6, "La salle du café le soir, les lampes allumées")), true);
  assert.equal(ideaFits("rallume", 4, files(6, "La salle en plein jour")), false);
  // Not read yet: what must be seen is not known, the idea is left out rather than refused later.
  assert.equal(ideaFits("facade", 1, [{ kind: "video", seconds: 10 }]), false);
  assert.equal(ideaFits("pile", 20, files(6, "des coupes")), false);
  // Videos only, never photos alone.
  assert.equal(ideaFits("quatre-coins", 4, files(6, "le salon", { kind: "photo" })), false);
  // Wide videos for the quarter turn.
  assert.equal(ideaFits("tourne", 6, files(8, "des gestes")), false);
  assert.equal(ideaFits("tourne", 6, files(8, "des gestes", { kind: "video", aspect: 1.78 })), true);
});

test("rotation: what a business of her trade in her city saw this month comes only when nothing else is left", () => {
  const first = curateIdeas({ studioId: "a", month: "2026-11", trade: "restaurant", files: files(8, "Un plat de pâtes sur la table, la salle le soir, des clients"), candidates: ALL });
  const second = curateIdeas({ studioId: "b", month: "2026-11", trade: "restaurant", files: files(8, "Un plat de pâtes sur la table, la salle le soir, des clients"), candidates: ALL, taken: first });
  assert.ok(second.length >= IDEAS_MIN);
  assert.deepEqual(second.filter((k) => first.includes(k)), []);
  // Few left without them: the shown ones fill up to IDEAS_MIN, never more.
  const narrow = ALL.filter((c) => ["nike", "decode", "mosaique", "quatre-coins", "journee", "raccords", "collage", "bienvenue"].includes(c.key));
  const seen = ["nike", "decode", "mosaique", "quatre-coins", "journee"];
  const filled = curateIdeas({ studioId: "c", month: "2026-11", trade: "autre", files: files(10, "la salle, des clients, des plats"), candidates: narrow, taken: seen });
  assert.equal(filled.length, IDEAS_MIN);
  assert.ok(filled.slice(0, 3).every((k) => !seen.includes(k)), filled.join());
  // Another business sees another order between equals.
  const other = curateIdeas({ studioId: "z", month: "2026-11", trade: "coiffure", files: SALON, candidates: ALL });
  const mine = curateIdeas({ studioId: "a", month: "2026-11", trade: "coiffure", files: SALON, candidates: ALL });
  assert.notDeepEqual(other, mine);
});

test("her trade and her city as the rotation reads them", () => {
  assert.equal(ideaTrade("salon de coiffure"), "coiffure");
  assert.equal(ideaTrade("barbier"), "coiffure");
  assert.equal(ideaTrade("bar à vins et cave"), "bar");
  assert.equal(ideaTrade("café-restaurant"), "restaurant");
  assert.equal(ideaTrade("café de spécialité"), "cafe");
  assert.equal(ideaTrade("studio de Pilates Reformer"), "mouvement");
  assert.equal(ideaTrade("atelier de céramique"), "atelier");
  assert.equal(ideaTrade(null), "autre");
  assert.equal(ideaCity({ address: "12 rue de Bretagne, 75003 Paris" }), "paris");
  assert.equal(ideaCity({ facts: ["Le salon est au 4 rue Mercière, 69002 Lyon."] }), "lyon");
  assert.equal(ideaCity({ businessType: "studio de Pilates Reformer, Hot Pilates et Hot Yoga à Paris" }), "paris");
  assert.equal(ideaCity({ businessType: "salon de coiffure" }), null);
  assert.equal(ideaMonth(new Date("2026-11-30T23:30:00Z")), "2026-12");
  assert.equal(ideaMonth(new Date("2026-11-10T12:00:00Z")), "2026-11");
});

test("the three doors of a new Reel, as WhatsApp buttons; the ideas page behind a button, never named by Edith", () => {
  assert.deepEqual(ideaDoors("whatsapp", true), ["Fais-moi confiance", "J’ai mon idée", "Regarde nos idées"]);
  assert.ok(ideaDoors("whatsapp", true).every((label) => label.length <= 20));
  assert.deepEqual(ideaDoors("app", true), [IDEA_DOORS.trust, IDEA_DOORS.know, IDEA_DOORS.ideas]);
  // Too few ideas for her: two doors.
  assert.deepEqual(ideaDoors("whatsapp", false), ["Fais-moi confiance", "J’ai mon idée"]);
  assert.ok(toolSpecs.get_page_link.input.shape.page.options.includes("idees"));
  assert.ok("doors" in toolSpecs.reply_with.input.shape);
  // Her mode d'emploi says where the ideas are, never an idea's name.
  assert.match(APP_GUIDES.publication, /Regarde nos idées/);
  for (const name of Object.values(IDEA_NAMES)) assert.ok(!APP_GUIDES.publication.includes(`« ${name} »`), name);
});
