import assert from "node:assert/strict";
import { test } from "node:test";
import type { VoiceTranscript } from "@fauve/agent";
import { ownTrackPath, ownTrackRow, videoVoicePath, videoVoiceRow } from "./own-voice-files.ts";

// Her own voice's files (own-voice-files.ts): under her studio's folder, hers, as their media_assets rows.

const STUDIO = "0b8c6c2e-3f6e-4a3d-9d8e-2b1f0c9a7e11";
const WORDS: VoiceTranscript = { text: "Coucou attends", duration: 3.9, words: [{ w: "Coucou", start: 0.3, end: 0.8 }, { w: "attends", start: 1.5, end: 1.9 }], language: null };

test("her voice taken from one of her videos: kept once under her studio's folder, as an audio of hers, that video marked in its words", () => {
  assert.equal(videoVoicePath(STUDIO, "v1"), `${STUDIO}/voice/video-v1.m4a`);
  const row = videoVoiceRow({ studioId: STUDIO, videoId: "v1", source: "whatsapp", bytes: 4096, span: { from: 2.7, to: 6.6 }, transcript: WORDS });
  // Under {studio}/: deleting her studio deletes it; one path a video, so the same video gives the same voice.
  assert.ok(row.storage_path.startsWith(`${STUDIO}/voice/`));
  assert.equal(row.storage_path, videoVoicePath(STUDIO, "v1"));
  assert.deepEqual([row.studio_id, row.kind, row.mime_type, row.size_bytes, row.duration, row.consent_ok], [STUDIO, "audio", "audio/mp4", 4096, 3.9, true]);
  // Hers, as she sent the video: never Edith's (a montage lays it as her own voice note), never kept forever as a site's.
  assert.equal(row.source, "whatsapp");
  for (const source of ["web_upload", "library", "website", "ai", "render"]) assert.equal(videoVoiceRow({ studioId: STUDIO, videoId: "v1", source, bytes: 1, span: { from: 0, to: 1 }, transcript: null }).source, "web_upload", source);
  // Its words, that video marked (never shown under her voice), where it starts in it.
  assert.deepEqual(row.transcript?.video, { media_id: "v1", from: 2.7 });
  assert.deepEqual(row.transcript?.words, WORDS.words);
  // Its words not read yet in the video: none, Scribe reads it at its first use.
  assert.equal(videoVoiceRow({ studioId: STUDIO, videoId: "v1", source: "whatsapp", bytes: 1, span: { from: 0, to: 2 }, transcript: null }).transcript, null);
});

test("her voice cut for a model it leads: a file of the engine's under her studio's folder, its words on the Reel's clock, what it was cut from", () => {
  assert.equal(ownTrackPath(STUDIO, "p1", "0123456789abcdef"), `${STUDIO}/voice/p1-ta-voix-0123456789abcdef.mp3`);
  const row = ownTrackRow({ studioId: STUDIO, postId: "p1", key: "0123456789abcdef", from: "note1", bytes: 2048, duration: 6.733, transcript: WORDS });
  assert.ok(row.storage_path.startsWith(`${STUDIO}/`));
  // Made by the engine (never in her library nor in Edith's list of her files), still her voice on the Reel's page.
  assert.deepEqual([row.kind, row.source, row.mime_type, row.duration], ["audio", "render", "audio/mpeg", 6.73]);
  assert.deepEqual(row.ai, { mode: "own_voice", from: "note1", key: "0123456789abcdef" });
  assert.equal(row.transcript, WORDS);
});
