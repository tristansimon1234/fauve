// Her videos as a Remotion render reads them: each file prepared once before the render, in the render workshop
// (NORMALIZE and SLOW_NORMALIZE in apps/web/src/lib/render/sandbox.ts) and by the local skill render
// (scripts/skill-render.mts), both with the ffmpeg settings written here, so that a Reel slow or stalled in the workshop
// is slow or stalled on a local render too.

/** Images a second of a prepared video (the Reel's: REEL_FPS). */
const FPS = 30;

/**
 * A key image every second in every video the render plays, at any frame rate (x264's own default is one every 250
 * images, 8 s). Remotion's OffthreadVideo keeps the images it decoded in a cache shared by every video on screen (a
 * share of it per extraction thread, two by default: about 80 images of 1080p for a 1 GB cache), and it closes a video
 * whose images it all dropped; that video's next image is then decoded again from the key image before it. With six of
 * her videos on screen at once, deep into their files (the six bands of « Titre qui se décode »), each one decoded again
 * from its key image dropped the others' images, so every image of every band was decoded again from its key image,
 * up to 250 images each: 1 690 images decoded for 5 of the Reel, 4,4 s an image with one tab, and with four (the
 * workshop's) 30 images in 160 s, an image waiting up to 43 s (Remotion gives up on one at 60): the bench's render never
 * finished. With a key image every second, an image missed is never more than 29 images away: 154 images decoded for
 * the same 5, 1,25 s an image with one tab, the 30 in 35 s with four (its bench's plan replayed, its frames the same side
 * by side, 47 dB at the least); the files are a quarter to two fifths larger.
 */
export const PREPARED_KEY_SECONDS = 1;

/** The images between two key images of a prepared video at `fps` images a second. */
export const keyInterval = (fps = FPS) => Math.max(1, Math.round(fps * PREPARED_KEY_SECONDS));

/**
 * Its long side at most: enough to frame a 1080 × 1920 Reel, and Remotion's frame extractor no longer runs out of memory
 * on ten phone videos at full size (killed by the system, the Paris Reel came out broken at 11 s).
 */
export const PREPARED_LONG_SIDE = 2560;

/**
 * The ffmpeg filter of a prepared video: its long side PREPARED_LONG_SIDE at most, at the Reel's frame rate, its last
 * image held `hold` seconds more. A phone video (variable frame rate, odd timestamps, a picture a little shorter than
 * its sound) could stop Remotion on « No frame found at position »; this one always has an image where the plan asks.
 */
export function preparedFilter(hold = 2): string {
  const side = PREPARED_LONG_SIDE;
  return `scale='if(gt(iw,ih),min(iw,${side}),-2)':'if(gt(iw,ih),-2,min(ih,${side}))':flags=lanczos,fps=${FPS},tpad=stop_mode=clone:stop_duration=${hold},format=yuv420p`;
}

/** Its encoding: H.264 at a near-transparent quality, a key image every second, its sound kept. */
export const PREPARED_CODEC: readonly string[] = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-g", String(keyInterval()), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"];

/** What ffmpeg says of an iPhone's HDR video (HLG or PQ, 10 bits), as a grep pattern: such a video is tone-mapped (HDR_TO_SDR). */
export const HDR_MARKS = "arib-std-b67|smpte2084";

/** An iPhone's HDR video tone-mapped to the SDR of a Reel on the way, else its colours come out washed out. */
export const HDR_TO_SDR = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv";

/** The colour tags of a tone-mapped video. */
export const HDR_TAGS: readonly string[] = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
