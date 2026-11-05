// Two videos of one take (« Face caméra et références », docs/fiches/createur.md, effect 9: two phones filming her at
// once, from the front and from the side), synced on their sound so a Reel can switch from one to the other in the
// middle of what she says, her words going on. Their words first (each video's read by Scribe): two videos whose words
// are mostly the same, in the same order, may be one take, their offset roughly the gap between the same words. Then
// their sound (decoded in the sandbox, mono at 8 kHz, takeAudioInSandbox): the envelopes of their onsets correlated
// over the whole of both (two microphones in one room hear her voice start and stop together, whatever their colour),
// then, around that, their samples cross-correlated with a phase transform (GCC-PHAT, robust to two microphones that
// colour her voice differently and to the room's echo), to a sample. Pure: the sandbox decodes, this measures.

/** One of her words, timed (s on its video's clock). */
type Word = { w: string; start: number; end: number };

/** The sample rate the sandbox decodes her sound at for a sync: enough for a voice's onsets, and light to correlate. */
export const TAKE_RATE = 8000;
/** The most of each video's sound decoded for a sync (s): a Reel's talk, with room. */
export const TAKE_MAX_SECONDS = 120;
/** How far apart two phones may have started recording (s), searched when their words say nothing. */
export const TAKE_SEARCH = 20;
/**
 * The correlation of their onset envelopes at their offset (Pearson, over their overlap) over which two videos are one
 * take: one voice heard by two phones reaches 0.6 to 0.95; two takes of the same words, or two different voices, stay
 * under 0.3 (synthetic speech with different microphones, an echo and noise: tests).
 */
export const TAKE_MATCH = 0.45;
/** Envelope frames a second (10 ms): the coarse offset's step. */
const ENVELOPE_RATE = 100;

const bare = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Whether two videos' words are the same speech, and their rough offset: their words aligned in order (the longest
 * common sequence of the same bare words), each pair's gap (its time in b minus its time in a), their median. Null
 * when fewer than 6 words or less than half of the shorter one's words match: not one take (or too little said).
 */
export function wordsOffset(a: Word[], b: Word[]): { offset: number; matched: number; share: number } | null {
  const x = a.map((w) => bare(w.w));
  const y = b.map((w) => bare(w.w));
  if (x.length < 6 || y.length < 6) return null;
  // The longest common subsequence (a talk is 400 words at most: 160 000 cells).
  const n = x.length;
  const m = y.length;
  const table = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * (m + 1) + j] = x[i] && x[i] === y[j] ? table[(i + 1) * (m + 1) + j + 1]! + 1 : Math.max(table[(i + 1) * (m + 1) + j]!, table[i * (m + 1) + j + 1]!);
    }
  }
  const gaps: number[] = [];
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (x[i] && x[i] === y[j]) {
      gaps.push(b[j]!.start - a[i]!.start);
      i++;
      j++;
    } else if (table[(i + 1) * (m + 1) + j]! >= table[i * (m + 1) + j + 1]!) i++;
    else j++;
  }
  const share = gaps.length / Math.min(n, m);
  if (gaps.length < 6 || share < 0.5) return null;
  gaps.sort((p, q) => p - q);
  const offset = gaps[Math.floor(gaps.length / 2)]!;
  return { offset: Math.round(offset * 1000) / 1000, matched: gaps.length, share: Math.round(share * 100) / 100 };
}

/** Signed 16-bit little-endian samples (ffmpeg's s16le) as floats in −1..1. */
export function pcmSamples(bytes: Uint8Array): Float32Array {
  const count = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

/** In-place radix-2 FFT of re + i·im (their length a power of two); `inverse`: the inverse transform, unscaled. */
function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/**
 * The cross-correlation r[k] = Σ a[t] · b[t + k] for k in [lo, hi] (b later than a by k), by FFT; `phat`: each frequency
 * weighed to one (only the timing of what happens counts, not the colour of either microphone).
 */
function correlate(a: ArrayLike<number>, b: ArrayLike<number>, lo: number, hi: number, phat: boolean): Float64Array {
  const size = pow2(a.length + b.length);
  const ar = new Float64Array(size);
  const ai = new Float64Array(size);
  const br = new Float64Array(size);
  const bi = new Float64Array(size);
  for (let i = 0; i < a.length; i++) ar[i] = a[i]!;
  for (let i = 0; i < b.length; i++) br[i] = b[i]!;
  fft(ar, ai);
  fft(br, bi);
  // conj(A) · B: its inverse is Σ a[t] b[t + k].
  for (let f = 0; f < size; f++) {
    const re = ar[f]! * br[f]! + ai[f]! * bi[f]!;
    const im = ar[f]! * bi[f]! - ai[f]! * br[f]!;
    const mag = phat ? Math.hypot(re, im) + 1e-12 : 1;
    ar[f] = re / mag;
    ai[f] = im / mag;
  }
  fft(ar, ai, true);
  const out = new Float64Array(hi - lo + 1);
  for (let k = lo; k <= hi; k++) out[k - lo] = ar[((k % size) + size) % size]! / size;
  return out;
}

/**
 * Where her voice starts and swells, 100 times a second: each 10 ms's loudness in decibels, its rise from the frame
 * before (a fall counts nothing), centred. Two microphones in one room give the same onsets, whatever their colour.
 */
export function onsetEnvelope(samples: Float32Array, rate: number): Float64Array {
  const hop = Math.max(1, Math.round(rate / ENVELOPE_RATE));
  const frames = Math.floor(samples.length / hop);
  const level = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) sum += samples[i]! * samples[i]!;
    level[f] = 10 * Math.log10(sum / hop + 1e-9);
  }
  const rise = new Float64Array(frames);
  for (let f = 1; f < frames; f++) rise[f] = Math.max(0, level[f]! - level[f - 1]!);
  const mean = rise.reduce((s, v) => s + v, 0) / Math.max(1, frames);
  for (let f = 0; f < frames; f++) rise[f] = rise[f]! - mean;
  return rise;
}

/** Pearson's correlation of a[t] and b[t + k] over their overlap. */
function pearsonAt(a: Float64Array, b: Float64Array, k: number): number {
  const from = Math.max(0, -k);
  const to = Math.min(a.length, b.length - k);
  if (to - from < 50) return 0;
  let sa = 0;
  let sb = 0;
  for (let t = from; t < to; t++) {
    sa += a[t]!;
    sb += b[t + k]!;
  }
  const n = to - from;
  const ma = sa / n;
  const mb = sb / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let t = from; t < to; t++) {
    const x = a[t]! - ma;
    const y = b[t + k]! - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/**
 * The offset of video b from video a (s: the same moment of her talk is at t in a and at t + offset in b) and how sure
 * it is (`score`: their onsets' correlation at it, 0 to 1; TAKE_MATCH and over, one take). `around`: their words'
 * rough offset, searched within a second of it; else within `search` seconds (TAKE_SEARCH). Null when either is silent
 * or too short.
 */
export function takeOffset(a: Float32Array, b: Float32Array, rate: number, options: { around?: number; search?: number } = {}): { offset: number; score: number } | null {
  const ea = onsetEnvelope(a, rate);
  const eb = onsetEnvelope(b, rate);
  if (ea.length < 200 || eb.length < 200) return null;
  // 1. The coarse offset, to 10 ms: their onsets over the whole of both.
  const search = Math.round((options.search ?? TAKE_SEARCH) * ENVELOPE_RATE);
  const centre = options.around !== undefined ? Math.round(options.around * ENVELOPE_RATE) : 0;
  const reach = options.around !== undefined ? ENVELOPE_RATE : search;
  const lo = Math.max(-(ea.length - 50), centre - reach);
  const hi = Math.min(eb.length - 50, centre + reach);
  if (hi < lo) return null;
  const coarse = correlate(ea, eb, lo, hi, false);
  let best = 0;
  for (let k = 1; k < coarse.length; k++) if (coarse[k]! > coarse[best]!) best = k;
  const lag = lo + best;
  const score = pearsonAt(ea, eb, lag);
  // 2. To a sample: a stretch of a where she speaks, against b around it, phase-transformed, within 30 ms of the coarse one.
  const hop = rate / ENVELOPE_RATE;
  const coarseSamples = Math.round(lag * hop);
  const length = Math.min(Math.round(15 * rate), a.length);
  const loudest = (() => {
    // The stretch of a with the most going on (its onsets' sum over 15 s windows, by 1 s steps).
    const win = Math.round(15 * ENVELOPE_RATE);
    let at = 0;
    let top = -Infinity;
    for (let s = 0; s + win <= ea.length; s += ENVELOPE_RATE) {
      let sum = 0;
      for (let t = s; t < s + win; t++) sum += Math.max(0, ea[t]!);
      if (sum > top) {
        top = sum;
        at = s;
      }
    }
    return Math.round(at * hop);
  })();
  const start = Math.max(0, Math.min(a.length - length, loudest));
  const margin = Math.round(0.03 * rate);
  const piece = a.subarray(start, start + length);
  // b where that stretch should be, with a margin on each side: piece[t] = a[start + t] ≈ b[start + t + D].
  const from = Math.max(0, start + coarseSamples - margin);
  const other = b.subarray(from, Math.min(b.length, start + coarseSamples + length + margin));
  let offset = lag / ENVELOPE_RATE;
  if (other.length > 2 * margin && piece.length > rate) {
    // r[k] = Σ piece[t] · other[t + k] peaks at k = start + D − from, near k0.
    const k0 = start + coarseSamples - from;
    const fine = correlate(piece, other, k0 - margin, k0 + margin, true);
    let top = 0;
    for (let k = 1; k < fine.length; k++) if (fine[k]! > fine[top]!) top = k;
    // Its peak between two samples (a parabola through it and its neighbours).
    const y0 = fine[top - 1] ?? fine[top]!;
    const y1 = fine[top]!;
    const y2 = fine[top + 1] ?? fine[top]!;
    const bend = y0 - 2 * y1 + y2;
    const sub = bend < 0 ? (0.5 * (y0 - y2)) / bend : 0;
    offset = (from + (k0 - margin + top + sub) - start) / rate;
  }
  return { offset: Math.round(offset * 10000) / 10000, score: Math.round(score * 1000) / 1000 };
}

/**
 * One of her other videos measured against her main one: the same take (her words matched and their sound correlated
 * at TAKE_MATCH or more) and its offset (s: its time = the main's + offset), or not the same take. Kept on the main
 * video's speech (speech.takes) so it is measured once.
 */
export type TakeSync = { media_id: string; offset: number; score: number; same: boolean };

/** Whether a measured sync makes the two videos one take. */
export const sameTake = (sync: Pick<TakeSync, "score"> | null | undefined) => Boolean(sync && sync.score >= TAKE_MATCH);
