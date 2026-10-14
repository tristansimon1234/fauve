import { z } from "zod";

// How much care goes into a montage, chosen per montage (Fauve proposes the
// studio's default, the manager can pick another on the quote). The chain of
// specialists stays the same (editor → motion designer → render → critic);
// the level sets how many versions are made and how many times the critic
// has them corrected.

export const effortSchema = z.enum(["rapide", "soigne", "max"]);
export type Effort = z.infer<typeof effortSchema>;

export const DEFAULT_EFFORT: Effort = "soigne";

export type EffortLevel = {
  label: string;
  /** In one line, for the manager. */
  pitch: string;
  /** Versions made for a new montage (a correction is always one). */
  versions: 1 | 2;
  /** The critic watches the rendered video before it goes out. */
  review: boolean;
  /** Corrections the critic may ask for, each one rendered and checked again. */
  fixRounds: number;
  /** How long it takes, as Fauve announces it. */
  minutes: string;
  /** The editor's reasoning effort. */
  editorEffort: "medium" | "high";
};

export const EFFORTS: Record<Effort, EffortLevel> = {
  rapide: {
    label: "Rapide",
    pitch: "Une version, envoyée telle quelle",
    versions: 1,
    review: false,
    fixRounds: 0,
    minutes: "2 à 4",
    editorEffort: "medium",
  },
  soigne: {
    label: "Soigné",
    pitch: "Brigitte regarde la vidéo et la corrige si besoin",
    versions: 1,
    review: true,
    fixRounds: 1,
    minutes: "4 à 8",
    editorEffort: "high",
  },
  max: {
    label: "Max",
    pitch: "Deux versions, Brigitte garde la meilleure et la peaufine",
    versions: 2,
    review: true,
    fixRounds: 2,
    minutes: "8 à 15",
    editorEffort: "high",
  },
};

/** No news after this many minutes: the montage has most likely failed. */
export const EFFORT_LATE_MINUTES: Record<Effort, number> = { rapide: 10, soigne: 15, max: 25 };

const ORDER: Effort[] = ["rapide", "soigne", "max"];

/** The level offered next to the quoted one (a WhatsApp button): the one above if allowed, else the one below. */
export function otherEffort(current: Effort, available: Effort[]): Effort | null {
  const i = ORDER.indexOf(current);
  const up = ORDER[i + 1];
  if (up && available.includes(up)) return up;
  const down = ORDER[i - 1];
  return down && available.includes(down) ? down : null;
}

/** What a level does, in one line: a correction is one version, so Max only corrects more. */
export function effortPitch(effort: Effort, correction = false): string {
  return correction && effort === "max" ? "Brigitte regarde la vidéo et la corrige jusqu’à deux fois" : EFFORTS[effort].pitch;
}

/** One step of the chain runs in one invocation (5 min at most, plus queueing). */
export const STEP_LATE_MINUTES = 8;

/**
 * A launched montage with no news for too long has most likely failed: measured
 * from its last step when the chain records them (a Max montage can run long
 * while every step moves), else from its launch.
 */
export function montageLate(input: { startedAt: number; stageAt: number | null; effort: Effort | null; now: number }): boolean {
  const minutes = (since: number) => (input.now - since) / 60_000;
  return input.stageAt !== null ? minutes(input.stageAt) >= STEP_LATE_MINUTES : minutes(input.startedAt) >= EFFORT_LATE_MINUTES[input.effort ?? "rapide"];
}
