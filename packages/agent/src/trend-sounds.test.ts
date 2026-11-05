import assert from "node:assert/strict";
import { test } from "node:test";
import { chartSongs, instagramSounds, linkExpiry, sameSound, soundList, soundReels, soundWords, SOUND_LIST_SIZE } from "./trend-sounds.ts";

// The shapes Treg's providers answered at the first bench (5 November 2026), trimmed.
const chart = {
  output: {
    data: {
      chart_info: { id: 7245341979050396417 },
      music_list: [
        { id: 7245341979050396417, trend: 4, music_info: { id: 7613798254214187000, id_str: "7613798254214187009", title: "Coming Up Roses", author: "Harry Styles", user_count: 221526, duration: 60 } },
        { trend: 4, music_info: { id_str: "7613798254214187010", title: "Housewife", author: "Tate McRae", user_count: 527121 } },
        { trend: 4, music_info: { title: "" } },
      ],
    },
  },
};

test("trend sounds: a TikTok chart's songs, their exact id (id_str, the number loses its last digits)", () => {
  const songs = chartSongs(chart);
  assert.equal(songs.length, 2);
  assert.deepEqual(songs[0], { title: "Coming Up Roses", artist: "Harry Styles", tiktokId: "7613798254214187009", users: 221526 });
});

test("trend sounds: an Instagram music search, the id of its page and its cover", () => {
  const found = instagramSounds({
    data: {
      data: {
        count: 10,
        items: [
          { id: "1258821776191042", audio_id: "1969670177763370", title: "Coming Up Roses", display_artist: "Harry Styles", duration_in_ms: 248866, is_explicit: false, cover_artwork_thumbnail_uri: "https://scontent.cdninstagram.com/v/a.jpg" },
          { id: "847727728401625", title: "Coming Up Roses (Ana’s Bridgerton Violin Version)", display_artist: "Ana Done" },
          { id: "x", title: "Not an id" },
        ],
      },
    },
  });
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], { audioId: "1258821776191042", title: "Coming Up Roses", artist: "Harry Styles", cover: "https://scontent.cdninstagram.com/v/a.jpg", seconds: 249, explicit: false });
  // The song itself, not its cover version.
  assert.equal(sameSound({ title: "Coming Up Roses", artist: "Harry Styles" }, found)?.audioId, "1258821776191042");
  assert.equal(sameSound({ title: "Coming Up Roses", artist: "Someone Else" }, found), null);
  assert.equal(sameSound({ title: "Can I Ride", artist: "SIDEPIECE & 95 South" }, [{ audioId: "1686149526042093", title: "Can I Ride", artist: "SIDEPIECE, 95 South", cover: null, seconds: null, explicit: false }])?.audioId, "1686149526042093");
});

test("trend sounds: the Reels that use a sound, their plays and their video", () => {
  const reels = soundReels({
    success: true,
    reels: [
      { code: "DfGrBx5OMSr", play_count: 1540266, video_versions: [{ url: "https://scontent-bos5-1.cdninstagram.com/o1/v/a.mp4?oe=6AEEE0E2" }] },
      { code: "DdSgWaBJXp1", ig_play_count: 188884 },
      { nothing: true },
    ],
  });
  assert.deepEqual(reels, [
    { code: "DfGrBx5OMSr", plays: 1540266, video: "https://scontent-bos5-1.cdninstagram.com/o1/v/a.mp4?oe=6AEEE0E2" },
    { code: "DdSgWaBJXp1", plays: 188884, video: null },
  ]);
  // Its link works until its `oe` time (hexadecimal seconds).
  assert.equal(linkExpiry("https://x.cdninstagram.com/a.mp4?oe=6AEEE0E2")?.toISOString(), new Date(0x6aeee0e2 * 1000).toISOString());
  assert.equal(linkExpiry("https://x.cdninstagram.com/a.mp4"), null);
});

test("trend sounds: 30 songs, the Top 50 first then the Viral 50, each once", () => {
  const top = Array.from({ length: 50 }, (_, i) => ({ title: `Top ${i}`, artist: "A", tiktokId: null, users: null }));
  const viral = [{ title: "Top 0", artist: "A", tiktokId: null, users: null }, ...Array.from({ length: 49 }, (_, i) => ({ title: `Viral ${i}`, artist: "B", tiktokId: null, users: null }))];
  const list = soundList(top, viral);
  assert.equal(list.length, SOUND_LIST_SIZE);
  assert.equal(list.filter((s) => s.chart === "top").length, 20);
  assert.equal(list[20]?.title, "Viral 0");
  assert.equal(list[20]?.rank, 2);
  assert.equal(soundWords("SugarCrash! (Sped Up) feat. X"), "sugarcrash");
});
