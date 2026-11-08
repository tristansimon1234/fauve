import assert from "node:assert/strict";
import { test } from "node:test";
import { exchangeTurns, herOwnMessages, ownRequestWords, requestBrief, shownPlan } from "./request-log.ts";
import { HOUSE_PICK_PROMPT, houseFallback, housePickInput, houseRoom, readHouseNext, readHousePick } from "./house-pick.ts";
import { SKILL_FILL_PROMPT, skillFillInput, skillNote } from "./skills.ts";
import { deliveryWords } from "./editor.ts";
import { MONTAGE_SKILLS, skillFor } from "./skill-library.ts";

// Tristan's team studio, 7 November, « Novembre, version cocon »: three videos, « Fais un p'tit réel sur le pouce », Edith's
// plan, « C'est parti ». The filler of « Petites lumières » refused the model over Edith's own plan (« deux textes (…), la
// rue en ouverture et une ligne de fin »), the chain redrew the model by hand (0,58 € of motion designer).
const brief = requestBrief(
  [
    {
      at: "2026-11-07T17:18:11.579Z",
      via: "chat",
      lines: [
        { who: "elle", text: "[elle envoie une vidéo] Fais un p’tit réel sur le pouce", at: "2026-11-07T17:15:39Z" },
        { who: "elle", text: "[elle envoie une vidéo]", at: "2026-11-07T17:15:41Z" },
        { who: "elle", text: "[elle envoie une vidéo]", at: "2026-11-07T17:15:43Z" },
        {
          who: "simone",
          text: "Novembre, version cocon\n\n• Ouverture : la rue de nuit sous l'arbre d'automne, avec le texte « Novembre, on rentre »\n• Ensuite : la flamme de la bougie, puis le coin salon et sa lampe allumée\n• Texte : « Ce soir, on reste au chaud » sur la bougie\n• Fin : une ligne pour t'inviter à écrire à Edith sur WhatsApp\n• Style et son : doux, musique calme, sans voix off, environ 12 s",
          at: "2026-11-07T17:17:15Z",
        },
        { who: "elle", text: "C'est parti", at: "2026-11-07T17:17:49Z" },
      ],
    },
  ],
  "Reel « Novembre, version cocon », style doux, musique calme, sans voix off, environ 12 s. Ouverture : la rue de nuit avec le texte « Novembre, on rentre ».",
)!;

test("Her own words and Edith's plan are told apart in a launch's brief", () => {
  const turns = exchangeTurns(brief);
  assert.equal(turns.exchange, true);
  assert.deepEqual(turns.hers, ["[elle envoie une vidéo] Fais un p’tit réel sur le pouce", "[elle envoie une vidéo]", "[elle envoie une vidéo]", "C'est parti"]);
  assert.equal(turns.edith.length, 1);
  assert.match(turns.brief, /^Reel « Novembre, version cocon »/);
  // Her messages only: never Edith's plan nor her brief.
  const hers = herOwnMessages(brief);
  assert.ok(hers.includes("Fais un p’tit réel sur le pouce"));
  assert.ok(!hers.includes("Novembre, on rentre"));
  // ownRequestWords (what decides a form from her words) still reads Edith's brief, as before.
  assert.ok(ownRequestWords(brief).includes("Novembre, on rentre"));
  // The plan she was shown, whole, with its points.
  const plan = shownPlan(brief);
  assert.match(plan, /^Novembre, version cocon/);
  assert.ok(plan.includes("• Texte : « Ce soir, on reste au chaud » sur la bougie"));
  // A brief without an exchange (the lab's idea) is hers, whole; no plan shown.
  assert.equal(exchangeTurns("Un Reel sur la terrasse").exchange, false);
  assert.equal(herOwnMessages("Un Reel sur la terrasse"), "Un Reel sur la terrasse");
  assert.equal(shownPlan("Un Reel sur la terrasse"), "");
  // An Edith reply without points is no plan.
  const noPlan = requestBrief([{ at: "x", via: "chat", lines: [{ who: "elle", text: "un Reel", at: "x" }, { who: "simone", text: "Tu as des vidéos ?", at: "x" }] }], "b")!;
  assert.equal(shownPlan(noPlan), "");
});

test("The filler adapts Edith's plan to the model, and refuses only for her own words or files", () => {
  const skill = skillFor("petites-lumieres")!;
  const files = ["a", "b", "c"].map((id) => ({ id, photo: false, seconds: 10, shows: "une rue la nuit", aspect: 9 / 16 }));
  const input = skillFillInput({ skill, name: "Petites lumières", n: 3, files, business: { name: "Edith" }, request: brief, own: { words: herOwnMessages(brief), plan: shownPlan(brief) } });
  assert.ok(input.ses_mots?.includes("Fais un p’tit réel sur le pouce"));
  assert.ok(!input.ses_mots?.includes("Ce soir, on reste au chaud"));
  assert.ok(input.plan_montre?.includes("Ce soir, on reste au chaud"));
  // Without an exchange, nothing more than before.
  const plain = skillFillInput({ skill, name: "Petites lumières", n: 3, files, business: {}, request: "Un Reel le soir" });
  assert.equal(plain.ses_mots, undefined);
  assert.equal(plain.plan_montre, undefined);
  // Its rule: only her words and her contract can make « fits » false; Edith's plan is adapted (its words in the text
  // slots, its ending on the card, its order) and what does not fit is said in a second sentence.
  assert.match(SKILL_FILL_PROMPT, /only they can make "fits" false/);
  assert.match(SKILL_FILL_PROMPT, /never a reason for false, even when she answered it « oui » or « c'est parti »/);
  assert.match(SKILL_FILL_PROMPT, /its last line on the ending card/);
  assert.match(SKILL_FILL_PROMPT, /"why" says so in a second short sentence/);
  assert.match(SKILL_FILL_PROMPT, /Her files are false only when none of them, nor anything close, can fill a slot/);
  // What it says of what it left out reaches her at delivery, true, and never names the model.
  const note = skillNote("J'ouvre sur ta rue de nuit, puis ta bougie et ton salon. Le texte « Ce soir, on reste au chaud » n'y est pas.", "Petites lumières");
  assert.equal(deliveryWords(note), "Le texte « Ce soir, on reste au chaud » n'y est pas.");
  assert.equal(deliveryWords(skillNote("Le modèle n'a pas de place pour ce texte.", "Petites lumières")), "");
});

test("The pick sees the plan she said yes to and each coded model's room for its words, with a next best", () => {
  const room = Object.fromEntries(Object.values(MONTAGE_SKILLS).map((s) => [s.key, houseRoom(s)]));
  assert.deepEqual(room["petites-lumieres"], { texts: ["accroche, 22 caractères, facultatif"], end: true });
  const input = JSON.parse(
    housePickInput({ request: brief, business: "agence", files: [{ kind: "video", seconds: 10, shows: "rue de nuit" }], voice: false, avoid: [], room, plan: shownPlan(brief), only: ["petites-lumieres", "decode"] }),
  );
  assert.match(input.plan_montre, /Novembre, on rentre/);
  // Only the models this business plays (their skill in its library).
  assert.deepEqual(input.modeles.map((m: { key: string }) => m.key).sort(), ["decode", "petites-lumieres"]);
  assert.deepEqual(input.modeles.find((m: { key: string }) => m.key === "petites-lumieres").textes, ["accroche, 22 caractères, facultatif"]);
  assert.match(HOUSE_PICK_PROMPT, /plan_montre/);
  assert.match(HOUSE_PICK_PROMPT, /pick only a model that can hold it/);
  assert.match(HOUSE_PICK_PROMPT, /the next best model that fits as well in "next"/);
  // Its next best, read as its first: never the first again, nor one of her last Reels'.
  assert.equal(readHouseNext({ key: "petites-lumieres", next: "decode", why: "" }, 3, []), "decode");
  assert.equal(readHouseNext({ key: "petites-lumieres", next: "petites-lumieres", why: "" }, 3, []), null);
  assert.equal(readHouseNext({ key: "petites-lumieres", next: "none", why: "" }, 3, []), null);
  assert.equal(readHouseNext({ key: "petites-lumieres", next: "decode", why: "" }, 3, ["decode"]), null);
  assert.equal(readHouseNext({ key: "petites-lumieres", why: "" }, 3, []), null);
  assert.equal(readHousePick({ key: "petites-lumieres" }, 3, []), "petites-lumieres");
});

test("A model Edith picked that does not play: its next best once, else made freely, never redrawn by hand", () => {
  const playable = (key: string) => key === "decode";
  // A new Reel: the next best when its skill plays her Reel.
  assert.deepEqual(houseFallback({ picked: true, correction: false, refused: "petites-lumieres", next: "decode", playable }), { next: "decode" });
  // Once: the next best already tried, or the same one, or one that does not play: made freely, the model let go.
  assert.deepEqual(houseFallback({ picked: true, correction: false, refused: "decode", next: "decode", playable }), { free: true });
  assert.deepEqual(houseFallback({ picked: true, correction: false, refused: "quatre-coins", next: "decode", tried: ["decode"], playable }), { free: true });
  assert.deepEqual(houseFallback({ picked: true, correction: false, refused: "petites-lumieres", next: "mosaique", playable }), { free: true });
  assert.deepEqual(houseFallback({ picked: true, correction: false, refused: "petites-lumieres", playable }), { free: true });
  // Her own choice, or a Reel she copies: the editor starts from it, as before.
  assert.equal(houseFallback({ picked: false, correction: false, refused: "petites-lumieres", next: "decode", playable }), null);
  // A correction of a version made on the model: the editor starts from its code, as before; of one the editor made
  // with the model only as an inspiration (« Met ma police please » on « Novembre, version cocon »): let go.
  assert.equal(houseFallback({ picked: true, correction: true, refused: "petites-lumieres", previousOnModel: true, playable }), null);
  assert.deepEqual(houseFallback({ picked: true, correction: true, refused: "petites-lumieres", previousOnModel: false, next: "decode", playable }), { free: true });
});
