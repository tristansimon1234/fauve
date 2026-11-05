import type { ReelMeasures } from "./steal.ts";

// What the sandbox measured on the reference Reel of each house model (house-models.ts), as the reading of a Reel
// she sends measures it (scene cuts at threshold 12 on a 320 px copy at 30 i/s, bass every 10 ms and tempoOf, EBU R128):
// its length, its hard cuts, its tempo when a steady beat stands out, its loudness. Measured locally on the copies the
// lab kept (step=model), never in production. A model written again on its original's fiche (docs/fiches/<key>.md)
// takes the fiche's cuts, read image by image (the detector missed some and took flashes, held images or moves for
// others), and its tempo as counted on its music; null when its music has no steady beat (its catalogue's tempo, the
// grid of its cuts, decides). Its bpm wins over the catalogue's tempo (houseStyle).

export const HOUSE_MEASURES: Record<string, ReelMeasures> = {
  "mots-meles": { duration: 18.67, cuts: [], bpm: null, lufs: null },
  "mosaique": { duration: 6.04, cuts: [], bpm: 130, lufs: -14.1 },
  "carte-feutre": { duration: 9.06, cuts: [0.2, 0.4, 0.7, 0.9, 1.1, 1.4, 1.6, 1.9, 2.1, 2.4, 2.6, 2.9, 3.1, 3.4, 3.6, 3.9, 4.2, 4.4, 4.7, 4.9, 5.2, 5.4, 5.7, 5.9, 6.2, 6.4, 6.7, 6.9, 7.2, 7.4, 7.7, 7.9, 8.2, 8.4, 8.7, 8.9], bpm: 92, lufs: -14.2 },
  "plans-fixes": { duration: 12.54, cuts: [4.17, 5.17, 6.1, 7, 7.87, 8.83, 9.77, 10.63], bpm: null, lufs: -14.1 },
  "decode": { duration: 22.66, cuts: [5.73, 5.9, 6.03, 6.17, 6.3, 6.43, 6.57, 6.7, 6.83, 6.97, 7.1, 7.23, 7.37, 7.5, 7.63, 7.77, 7.9, 8.03, 8.17, 8.3, 8.43, 8.57, 8.7, 8.83, 8.97, 9.1, 9.23, 9.37, 9.5, 9.63, 9.8, 9.93, 10.07, 10.2, 10.33, 10.47, 10.6, 10.73, 10.87, 11, 11.13, 11.27, 11.4, 11.53, 11.67, 11.8, 11.93, 12.07, 12.2, 12.33, 12.47, 12.6, 12.73, 12.87, 13, 13.13, 13.27, 14.7, 16.9, 17.2, 19.73, 21.17, 21.6], bpm: 122, lufs: -15.1 },
  "nike": { duration: 12, cuts: [0.17, 0.67, 1.43, 1.67, 3.23, 4.6, 5.4, 6.47, 7.33, 7.8, 8.07, 9, 9.73, 10.37], bpm: null, lufs: -14.4 },
  "titre-derriere": { duration: 12.07, cuts: [3.37, 4.43, 4.63, 4.8, 5, 5.8, 6.23, 6.8, 7.37, 9.17, 10.2, 10.33, 10.43, 10.57, 10.67, 10.8, 10.93, 11.03, 11.17, 11.27, 11.4, 11.53], bpm: 82.9, lufs: -14.2 },
  "facade": { duration: 9.4, cuts: [5.27, 9], bpm: null, lufs: -14.5 },
  "gaufre": { duration: 12.76, cuts: [5.27, 9], bpm: null, lufs: -14.5 },
  "cadre": { duration: 6.41, cuts: [0.33, 0.67, 1, 1.33, 1.7, 2.03, 2.37, 2.7, 3.03, 3.37, 3.7, 4.03, 4.37, 4.7, 5.03, 5.37, 5.7], bpm: 90, lufs: -14.4 },
  "mot-cle": { duration: 23.45, cuts: [], bpm: 108, lufs: -14.1 },
  "eventail": { duration: 19.97, cuts: [3.63, 4.63, 5.63, 6.63, 7.67, 8.7, 9.7, 10.67, 11.67, 12.63, 13.67, 14.67, 15.63], bpm: 119.8, lufs: -14.2 },
  "coulisses": { duration: 10.54, cuts: [], bpm: null, lufs: -15.9 },
  "quatre-coins": { duration: 21.8, cuts: [5.5, 6.2, 6.83, 7.8, 8.63, 9.5, 10.5, 11.3, 12.03, 13.13, 14.33], bpm: 92, lufs: -14.1 },
  "fenetres": { duration: 13.8, cuts: [0.73, 1.33, 3.37, 4.4, 4.87, 5.2, 5.53, 6, 6.2, 6.43, 6.77, 8.83, 9.53, 10.17, 10.83, 11.57, 12.17, 12.8, 13.27], bpm: 93, lufs: -14.2 },
  "ecran-partage": { duration: 12.77, cuts: [2.23, 5.73, 7.73, 10.67], bpm: null, lufs: -14.1 },
  "journee": { duration: 15.05, cuts: [0.27, 0.93, 1.83, 2.5, 3.03, 3.5, 3.87, 4.5, 5.27, 6.27, 7.13, 8, 8.7, 9.03, 9.43, 9.67, 10.63, 11.47, 12.2], bpm: null, lufs: -14.2 },
  "tourne": { duration: 12.82, cuts: [0.2, 0.37, 0.53, 0.8, 1.83, 2.3, 3.27, 4.13, 5.03, 6.1, 6.6, 6.97, 7.43, 7.6, 7.73, 7.87, 8.1, 8.5, 8.63, 8.73, 8.87, 9, 9.5, 9.77, 10.13, 10.27, 10.63], bpm: 118.3, lufs: -14.1 },
  "frappe": { duration: 13.37, cuts: [4.87, 7.87, 8.4, 8.77, 10.17, 11.6, 11.93, 12.27, 12.6], bpm: 82.4, lufs: -14.1 },
  "coups-de-fouet": { duration: 23.31, cuts: [0.67, 1.87, 2.87, 3.53, 4.43, 5.37, 6.3, 7.53, 8.63, 9.13, 9.97, 11, 12.2, 13.03, 13.77, 14.63, 15.53, 16.47, 17.1, 18.1, 19.13, 19.87], bpm: 84, lufs: -14.2 },
  "table": { duration: 8.93, cuts: [2.03, 2.33, 3.37, 4, 4.77, 5.43], bpm: 110, lufs: -14.2 },
  "aplat": { duration: 8.87, cuts: [1.97, 2.53, 3.67, 4, 5.93, 8.37], bpm: null, lufs: -14.2 },
  "pile": { duration: 9.2, cuts: [], bpm: null, lufs: -14.2 },
  "interrupteur": { duration: 9.2, cuts: [], bpm: 142, lufs: -14.3 },
  "photo-dump": { duration: 11.33, cuts: [0.67, 1.1, 1.47, 1.83, 2.3, 2.63, 3.37, 3.7, 4.07, 4.37, 5.07, 5.47, 5.8, 6.17, 6.87, 7.3, 8.23, 8.53, 8.87, 9.9, 10.63], bpm: null, lufs: -14.1 },
  "interface": { duration: 12.77, cuts: [], bpm: null, lufs: -14.2 },
  "pixel": { duration: 15.6, cuts: [1.33, 3.47, 5, 8.17, 9.07, 12.17, 14.13], bpm: null, lufs: -14.5 },
  "createur": { duration: 31, cuts: [6.87, 7.8, 8.67, 9.67, 14.97, 18.3, 20.67, 21.7, 23, 24.73, 27.7, 30.03, 30.8], bpm: null, lufs: -14.3 },
  "silhouette": { duration: 11.15, cuts: [0.47, 1.07, 3.9, 5.37, 9.57], bpm: null, lufs: -14.1 },
  "vision": { duration: 8.55, cuts: [0.2, 0.7, 1.2, 1.5, 1.77, 2.1, 2.63, 3, 3.27, 3.63, 4.67, 5.13, 5.37, 5.67, 5.93, 6.53, 6.87, 7.13, 8.03], bpm: null, lufs: -14.1 },
  "detourages": { duration: 16.53, cuts: [6.23, 6.6, 6.83, 7.2, 7.53, 8.27, 8.6, 8.93, 9.67, 10, 10.27, 10.93, 11.37, 11.73, 12.17, 12.67, 13.13, 13.77, 14.4, 14.83], bpm: 94, lufs: -14.2 },
};
