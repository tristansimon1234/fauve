// Types of tone_read.mjs (read by the engine's tests).
export type ToneOfPixels = { mean: number; low: number; high: number; burnt: number; rgb: [number, number, number] | null };
export const TONE_SIZE: number;
export const TONE_FRAMES: number;
export function toneOfPixels(rgb: Uint8Array): ToneOfPixels | null;
export function toneArgs(job: { file: string; from?: number; to?: number; crop?: readonly number[]; still?: boolean }): string[];
export function readTones(
  jobs: { id: string; file: string; from?: number; to?: number; crop?: readonly number[]; still?: boolean }[],
  ffmpeg?: string,
): Promise<Record<string, ToneOfPixels | null>>;
