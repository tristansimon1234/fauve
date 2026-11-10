import assert from "node:assert/strict";
import { test } from "node:test";
import { APP_GUIDES } from "./app-guide.ts";
import { MAX_PICK, doorsReady, ownPick, pickButton, pickedLine, pickLabel, whatsappButton } from "./media-pick.ts";
import { FAUVE_SYSTEM_PROMPT } from "./prompts.ts";
import { exchangeFiles, type ExchangeRow } from "./request-log.ts";
import { replyExtrasSchema } from "./schemas.ts";
import { toolSpecs } from "./tools.ts";

// « Choisir mes fichiers » on WhatsApp (docs/whatsapp.md; Tristan, 10 November: « il faut pas me montrer la bibliothèque »).

const A = "0b6f2c1e-1111-4a5b-8c9d-000000000001";
const B = "0b6f2c1e-2222-4a5b-8c9d-000000000002";
const C = "0b6f2c1e-3333-4a5b-8c9d-000000000003";
const row = (direction: ExchangeRow["direction"], body: string, extra: Partial<ExchangeRow> = {}): ExchangeRow => ({ direction, type: "text", body, created_at: "2026-11-10T15:29:00Z", ...extra });

test("on WhatsApp, her médiathèque is a page behind a button; her upload link stays for upload", () => {
  const video = pickButton("video");
  assert.deepEqual(video, { path: "/choisir?type=video", label: "Choisir mes fichiers", purpose: "pick" });
  assert.equal(pickButton("any").path, "/choisir");
  assert.equal(pickButton("photo").path, "/choisir?type=photo");
  // A WhatsApp button's label is 20 characters at most, and the link is one the schema keeps.
  assert.ok(video.label.length <= 20);
  assert.ok(replyExtrasSchema.shape.link.safeParse(video).success);

  // The button under her message: the page a tool chose, else her upload link (none while her videos arrive in HD), else the one publication.
  assert.deepEqual(whatsappButton({ link: video, upload: "video" }, "compressed"), video);
  assert.deepEqual(whatsappButton({ upload: "video" }, "compressed"), { path: "/depot", label: "Envoyer mes fichiers", purpose: "upload" });
  assert.deepEqual(whatsappButton({ upload: "any" }, null)?.path, "/depot");
  assert.equal(whatsappButton({ upload: "video" }, "full"), null);
  assert.deepEqual(whatsappButton({ posts: [A] }, null), { path: `/v/${A}`, label: "Voir la publication", purpose: "open_post" });
  assert.equal(whatsappButton({ posts: [A, B] }, null), null);
  assert.equal(whatsappButton({}, null), null);
});

test("her pick comes back as her message, in her order, only her files, and becomes the files of her Reel", () => {
  assert.equal(pickedLine([A]), `Je prends celle-ci dans la médiathèque, dans cet ordre (media_id : ${A}).`);
  assert.equal(pickedLine([B, A]), `Je prends ces 2 dans la médiathèque, dans cet ordre (media_id : ${B}, ${A}).`);
  // What each one shows, when known: Edith plans with the right files, never ones listed earlier in the conversation.
  assert.equal(
    pickedLine([B, A], { [B]: "La Seine au crépuscule" }),
    `Je prends ces 2 dans la médiathèque, dans cet ordre : 1. La Seine au crépuscule (media_id : ${B}, ${A}).`,
  );
  assert.equal(pickLabel("Vue panoramique sur la Seine à Paris au crépuscule, avec un bateau-mouche naviguant devant. Puis un pont."), "Vue panoramique sur la Seine à Paris au crépuscule");
  // Her order kept, each file once, another studio's file left out, MAX_PICK at most.
  assert.deepEqual(ownPick([C, A, C.toUpperCase(), B], [A, C]), [C, A]);
  assert.deepEqual(ownPick([B], [A]), []);
  const many = Array.from({ length: MAX_PICK + 5 }, (_, i) => `0b6f2c1e-4444-4a5b-8c9d-${String(i).padStart(12, "0")}`);
  assert.equal(ownPick(many, many).length, MAX_PICK);
  // Read by Edith as this Reel's files (since the last launch only).
  const picked = [row("inbound", "J’ai envie de faire un réel avec des vidéos de ma bibliothèque"), row("inbound", pickedLine([B, A]))];
  assert.deepEqual([...exchangeFiles(picked)], [B, A]);
  assert.equal(exchangeFiles([...picked, row("outbound", "C'est parti", { launched: true })]).size, 0);
});

test("the three doors wait for her files: Tristan's « un réel avec des vidéos de ma bibliothèque » gets her library first", () => {
  const asked = [row("inbound", "J’ai envie de faire un réel avec des vidéos de ma bibliothèque")];
  assert.equal(doorsReady(asked), false);
  // Edith's own list of her files is not her pick.
  assert.equal(doorsReady([...asked, row("outbound", `Voilà tes plus récentes (media_id ${A})`)]), false);
  assert.equal(doorsReady([...asked, row("inbound", pickedLine([A, B]))]), true);
  assert.equal(doorsReady([...asked, row("inbound", "", { type: "video", media_id: C })]), true);
  // Said in the tool, in a few words; the prompt does not grow.
  assert.match(toolSpecs.reply_with.input.shape.doors.description ?? "", /fichiers mais pas l'idée/);
  assert.match(toolSpecs.reply_with.description, /sur WhatsApp, une page derrière un bouton/);
  assert.ok(!/in the app, reply_with pick_media/.test(FAUVE_SYSTEM_PROMPT));
  assert.match(APP_GUIDES.whatsapp, /Choisir mes fichiers/);
});
