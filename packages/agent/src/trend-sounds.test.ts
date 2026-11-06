import assert from "node:assert/strict";
import { test } from "node:test";
import { accountSongs, instagramSounds, linkExpiry, sameSound, shortCount, soundReels, soundWords } from "./trend-sounds.ts";

// The shapes Treg's providers answered at the benches (5 and 6 November 2026), trimmed.
test("trend sounds: an Instagram music search, the id of its page and its cover", () => {
  const found = instagramSounds({
    data: {
      data: {
        count: 10,
        items: [
          { id: "1258821776191042", audio_id: "1969670177763370", title: "Coming Up Roses", display_artist: "Harry Styles", duration_in_ms: 248866, is_explicit: false, cover_artwork_thumbnail_uri: "https://scontent.cdninstagram.com/v/a.jpg", progressive_download_url: "https://scontent.cdninstagram.com/o1/a.mp4?oe=6AEEE0E2", highlight_start_times_in_ms: [39000, 146500] },
          { id: "847727728401625", title: "Coming Up Roses (Ana’s Bridgerton Violin Version)", display_artist: "Ana Done" },
          { id: "x", title: "Not an id" },
        ],
      },
    },
  });
  assert.equal(found.length, 2);
  assert.deepEqual(found[0], { audioId: "1258821776191042", title: "Coming Up Roses", artist: "Harry Styles", cover: "https://scontent.cdninstagram.com/v/a.jpg", seconds: 249, explicit: false, track: "https://scontent.cdninstagram.com/o1/a.mp4?oe=6AEEE0E2", highlight: 39 });
  // The song itself, not its cover version.
  assert.equal(sameSound({ title: "Coming Up Roses", artist: "Harry Styles" }, found)?.audioId, "1258821776191042");
  assert.equal(sameSound({ title: "Coming Up Roses", artist: "Someone Else" }, found), null);
  assert.equal(sameSound({ title: "Can I Ride", artist: "SIDEPIECE & 95 South" }, [{ audioId: "1686149526042093", title: "Can I Ride", artist: "SIDEPIECE, 95 South", cover: null, seconds: null, explicit: false, track: null, highlight: null }])?.audioId, "1686149526042093");
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

test("trend sounds: the songs of an account's Reels, its own sounds left out", () => {
  const songs = accountSongs({
    items: [
      { media: { code: "DfY8zyuunEm", play_count: 6332, clips_music_attribution_info: { audio_id: "1399893890111262" }, clips_metadata: { music_info: { music_asset_info: { title: "Sweater Weather", display_artist: "The Neighbourhood", audio_cluster_id: "1399893890111262" }, music_consumption_info: { is_trending_in_clips: true } } } } },
      { media: { code: "DfHDcFmOJwR", clips_metadata: { original_sound_info: { original_audio_title: "Original audio" } } } },
    ],
  });
  assert.deepEqual(songs, [{ audioId: "1399893890111262", title: "Sweater Weather", artist: "The Neighbourhood", code: "DfY8zyuunEm", plays: 6332, trending: true }]);
  assert.equal(soundWords("SugarCrash! (Sped Up) feat. X"), "sugarcrash");
  // Its TikTok videos, the way the apps write a count.
  assert.equal(shortCount(1_240_000), "1,2\u00a0M");
  assert.equal(shortCount(48_200), "48\u00a0k");
  assert.equal(shortCount(950), "950");
});
