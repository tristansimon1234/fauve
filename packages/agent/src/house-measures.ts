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
  "carte-feutre": { duration: 9, cuts: Array.from({ length: 89 }, (_, k) => Math.round((k + 1) * 10) / 100), bpm: 135, lufs: -14.2 },
  "plans-fixes": { duration: 12.54, cuts: [4.17, 5.17, 6.1, 7, 7.87, 8.83, 9.77, 10.63], bpm: null, lufs: -14.1 },
  "decode": { duration: 22.66, cuts: [5.73, 5.9, 6.03, 6.17, 6.3, 6.43, 6.57, 6.7, 6.83, 6.97, 7.1, 7.23, 7.37, 7.5, 7.63, 7.77, 7.9, 8.03, 8.17, 8.3, 8.43, 8.57, 8.7, 8.83, 8.97, 9.1, 9.23, 9.37, 9.5, 9.63, 9.8, 9.93, 10.07, 10.2, 10.33, 10.47, 10.6, 10.73, 10.87, 11, 11.13, 11.27, 11.4, 11.53, 11.67, 11.8, 11.93, 12.07, 12.2, 12.33, 12.47, 12.6, 12.73, 12.87, 13, 13.13, 13.27, 14.7, 16.9, 17.2, 19.73, 21.17, 21.6], bpm: 122, lufs: -15.1 },
  "nike": { duration: 12, cuts: [0.17, 0.67, 1.43, 1.67, 3.23, 4.6, 5.4, 6.47, 7.33, 7.8, 8.07, 9, 9.73, 10.37], bpm: null, lufs: -14.4 },
  "titre-derriere": { duration: 12.07, cuts: [3.37, 4.43, 4.63, 4.8, 5, 5.8, 6.23, 6.8, 7.37, 9.17, 10.2, 10.33, 10.43, 10.57, 10.67, 10.8, 10.93, 11.03, 11.17, 11.27, 11.4, 11.53], bpm: 82.9, lufs: -14.2 },
  "facade": { duration: 9.4, cuts: [5.27, 9], bpm: null, lufs: -14.5 },
  "gaufre": { duration: 12.76, cuts: [5.27, 5.83, 6.33, 9], bpm: 120, lufs: -14.5 },
  "cadre": { duration: 6.41, cuts: [0.33, 0.67, 1, 1.33, 1.7, 2.03, 2.37, 2.7, 3.03, 3.37, 3.7, 4.03, 4.37, 4.7, 5.03, 5.37, 5.7], bpm: 90, lufs: -14.4 },
  "mot-cle": { duration: 23.45, cuts: [5.67, 16.7], bpm: 108, lufs: -14.1 },
  "eventail": { duration: 19.97, cuts: [3.63, 4.63, 5.63, 6.63, 7.67, 8.7, 9.7, 10.67, 11.67, 12.63, 13.67, 14.67, 15.63], bpm: 119.8, lufs: -14.2 },
  "coulisses": { duration: 10.5, cuts: [1.17, 1.5, 2.5, 3.33, 3.6, 3.63, 3.67, 3.77, 3.8, 3.83, 3.93, 4.17, 4.5, 4.93, 5.33, 6.27, 6.53, 6.83, 7.13, 7.53, 7.97, 8.2, 8.6, 8.83, 9.1, 9.5, 9.77], bpm: null, lufs: -15.9 },
  "quatre-coins": { duration: 21.8, cuts: [5.5, 6.2, 6.83, 7.8, 8.63, 9.5, 10.5, 11.3, 12.03, 13.13, 14.33], bpm: 92, lufs: -14.1 },
  "fenetres": { duration: 13.8, cuts: [0.13, 0.8, 1.33, 1.8, 3.37, 4, 4.53, 4.87, 5.2, 6, 6.47, 6.77, 8.83, 9.53, 10.17, 10.83, 11.33, 11.57, 12.17, 12.8], bpm: 92.9, lufs: -14.2 },
  "ecran-partage": { duration: 12.77, cuts: [2.23, 5.73, 7.73, 10.67], bpm: null, lufs: -14.1 },
  "journee": { duration: 15.05, cuts: [0.27, 0.93, 1.83, 2.5, 3.03, 3.5, 3.87, 4.5, 5.27, 6.27, 7.13, 8, 8.7, 9.03, 9.43, 9.67, 10.63, 11.47, 12.2], bpm: null, lufs: -14.2 },
  "rallume": { duration: 13.13, cuts: [5, 5.63, 6.27, 7.5, 8.13, 8.77, 10, 10.63, 11.27], bpm: 96, lufs: null },
  "tourne": { duration: 12.82, cuts: [0.2, 0.37, 0.53, 0.8, 1.83, 2.3, 3.27, 4.13, 5.03, 6.1, 6.6, 6.97, 7.43, 7.6, 7.73, 7.87, 8.1, 8.5, 8.63, 8.73, 8.87, 9, 9.5, 9.77, 10.13, 10.27, 10.63], bpm: 118.3, lufs: -14.1 },
  "frappe": { duration: 13.37, cuts: [4.87, 7.87, 8.4, 8.77, 10.17, 11.6, 11.93, 12.27, 12.6], bpm: 82.4, lufs: -14.1 },
  "coups-de-fouet": { duration: 23.31, cuts: [0.67, 1.87, 2.87, 3.53, 4.43, 5.37, 6.3, 7.53, 8.63, 9.13, 9.97, 11, 12.2, 13.03, 13.77, 14.63, 15.53, 16.47, 17.1, 18.1, 19.13, 19.87], bpm: 84, lufs: -14.2 },
  "table": { duration: 8.93, cuts: [2.03, 2.33, 2.47, 2.5, 2.53, 3.37, 4, 4.77, 5.43, 6.1, 6.67, 6.7], bpm: 110, lufs: -14.2 },
  "aplat": { duration: 8.8, cuts: [4, 5.93, 7.87, 8.37], bpm: 123, lufs: -14.2 },
  "pile": { duration: 9.2, cuts: [], bpm: null, lufs: -14.2 },
  "mon-travail": { duration: 9.17, cuts: [], bpm: null, lufs: -14.1 },
  "interrupteur": { duration: 9.2, cuts: [], bpm: 71.85, lufs: -14.3 },
  "photo-dump": { duration: 11.33, cuts: [0.67, 1.1, 1.47, 1.83, 2.3, 2.63, 3.37, 3.7, 4.07, 4.37, 5.07, 5.47, 5.8, 6.17, 6.87, 7.3, 8.23, 8.53, 8.87, 9.9, 10.63], bpm: null, lufs: -14.1 },
  "interface": { duration: 12.77, cuts: [], bpm: 110.5, lufs: -14.2 },
  "pixel": { duration: 15.6, cuts: [1.33, 3.47, 5, 8.17, 9.07, 12.17, 14.13], bpm: 100, lufs: -14.5 },
  "createur": { duration: 31, cuts: [4.03, 6.87, 7.8, 8.67, 9.67, 12.07, 14.97, 15.1, 18.3, 20.67, 21.7, 23, 24.73, 25.73, 26.37, 26.9, 27.7, 30.03, 30.8], bpm: null, lufs: -14.3 },
  "silhouette": { duration: 11.15, cuts: [0.47, 1.07, 3.9, 5.37, 9.57], bpm: null, lufs: -14.1 },
  "vision": { duration: 8.55, cuts: [0.2, 0.7, 1.2, 1.5, 1.77, 2.1, 2.63, 3, 3.27, 3.63, 4.67, 5.13, 5.37, 5.67, 5.93, 6.53, 6.87, 7.13, 8.03], bpm: null, lufs: -14.1 },
  "detourages": { duration: 16.47, cuts: [6.23, 6.6, 6.83, 7.2, 7.53, 7.97, 8.27, 8.6, 8.93, 9.67, 10, 10.27, 10.93, 11.37, 11.73, 12.17, 12.67, 13.13, 13.47, 13.77, 14.4, 14.83], bpm: 140, lufs: -14.2 },
  // Its fiche's cuts (the first image of each new picture: its title card's black, then under its burn and its roll),
  // on its cuts' grid; its loudness by ffmpeg's ebur128.
  "court-metrage": { duration: 24.4, cuts: [0.13, 4, 6.83, 9.6, 12.4, 15.2, 18.03, 20.87], bpm: 85.5, lufs: -10.3 },
  "titre-cinema": { duration: 20.57, cuts: [6.1, 8.1, 10.07, 13.83, 16.9], bpm: 124.2, lufs: -22 },
  "celui-la": { duration: 8.66, cuts: [2.3, 3.03, 3.63, 4.3, 4.87, 5.47, 6.07, 6.77], bpm: 96.5, lufs: -14.2 },
  "routine": { duration: 58.54, cuts: [0.17, 0.3, 0.47, 0.63, 0.8, 0.93, 1.1, 1.27, 1.4, 1.57, 1.73, 1.9, 2.07, 2.83, 3.73, 4.93, 5.97, 6.8, 7.17, 8.1, 9, 9.97, 10.9, 11.67, 13.27, 14.2, 14.97, 16.17, 17.1, 18.07, 18.97, 19.97, 21.1, 22, 23, 24.4, 25.87, 27.1, 28.6, 29.87, 31.3, 32.63, 33.77, 35.3, 37.1, 39.63, 42.2, 43.23, 44.6, 45.7, 47.2, 49.17, 50.37, 51.6, 52.5, 53.73, 54.83, 55.83, 57.4, 58.43], bpm: 90.73, lufs: -25.5 },
  // Its fiche's cuts (docs/fiches/nuit.md): its stutter and its round things on its roll, the black, the burn, its night (each flash counted with the shot it burns, the leak with the shot it ends).
  "nuit": { duration: 12, cuts: [0.13, 0.3, 0.43, 0.5, 0.63, 0.77, 0.93, 1, 1.1, 1.17, 1.27, 1.33, 1.43, 1.5, 1.53, 1.63, 1.67, 1.7, 1.77, 1.8, 1.87, 1.93, 1.97, 2.2, 2.47, 2.6, 3.2, 4.2, 4.63, 5.17, 5.47, 6.8, 7.13, 8, 8.33, 8.63, 8.93, 9.17, 9.27, 10.07, 10.93, 11, 11.13, 11.47, 11.6, 11.93], bpm: 136.8, lufs: -14.3 },
  // Its 64 flashes, its logo on the black and its name, by the image each starts on (docs/fiches/bientot.md); no steady beat.
  "bientot": {
    duration: 6.63,
    cuts: [3, 5, 8, 11, 14, 17, 20, 23, 26, 29, 31, 34, 37, 40, 43, 46, 49, 52, 54, 57, 60, 63, 66, 69, 72, 75, 78, 80, 83, 86, 89, 91, 93, 96, 99, 101, 104, 106, 109, 112, 114, 116, 119, 121, 124, 127, 130, 132, 134, 136, 139, 142, 145, 147, 150, 153, 156, 159, 162, 165, 168, 171, 174, 177, 195].map((f) => Math.round((f / 30) * 100) / 100),
    bpm: null,
    lufs: -14.2,
  },
  // Its fiche's 14 cuts, read image by image; its first piece's tempo counted one beat in two (142,4 BPM; its second, 150,5, after its break).
  "nom-de-ville": { duration: 14.73, cuts: [2.27, 2.73, 3.13, 3.53, 3.97, 6.33, 7.27, 8.33, 9.13, 9.8, 10.73, 11.47, 12.83, 13.8], bpm: 71.2, lufs: -19.9 },
  // Its fiche's cuts (docs/fiches/carnet.md, image by image: its 43 hard cuts and its window's jump at 14,1 s); its music's
  // pulse is weak (89,8 BPM) and leads none of its cuts: its catalogue's tempo decides.
  "carnet": { duration: 37.36, cuts: [1.37, 1.83, 2.03, 2.27, 2.5, 2.77, 3.03, 3.5, 4.1, 4.6, 5.13, 5.53, 6.33, 6.63, 7.27, 7.6, 8.67, 8.93, 9.17, 9.33, 9.63, 9.77, 9.93, 10.33, 10.67, 14.1, 15.5, 17.47, 20.43, 21.6, 22.87, 23.13, 24.53, 25.33, 26.2, 28.33, 28.87, 29.83, 30.1, 30.23, 30.5, 30.67, 33.17, 36.67], bpm: null, lufs: -18 },
  "petites-lumieres": { duration: 9.83, cuts: [4.13, 6.67], bpm: 83, lufs: -14.2 },
  "vlog-ville": { duration: 41.83, cuts: [2.63, 2.7, 2.8, 2.87, 2.97, 3.03, 3.13, 3.2, 3.3, 3.37, 3.83, 4.13, 4.53, 5.33, 6.13, 8.57, 10.47, 10.93, 11.27, 11.5, 11.67, 12.47, 13.6, 15.3, 17.3, 17.9, 17.97, 18.07, 18.13, 18.27, 18.4, 18.47, 18.57, 18.77, 18.87, 19.03, 19.2, 19.37, 19.63, 20.27, 20.53, 20.6, 21.1, 21.53, 22.1, 22.43, 22.97, 23.63, 24.07, 24.57, 24.7, 24.77, 24.87, 25.03, 25.1, 25.2, 25.27, 25.43, 25.53, 25.6, 25.7, 25.77, 25.87, 25.93, 26.03, 26.1, 26.2, 26.27, 26.37, 26.83, 27.67, 28.27, 28.87, 29.2, 29.9, 31.6, 33.37, 34.2, 35.57, 37.03, 37.5, 39.03, 39.9], bpm: 76, lufs: -25.9 },
  "assiettes": { duration: 16.9, cuts: [0.47, 1.03, 1.53, 2.13, 2.47, 2.83, 3.23, 3.6, 4.3, 4.67, 5.13, 5.63, 6.27, 6.37, 9.23, 9.7, 10.43, 10.97, 11.6, 11.93, 12.27, 12.77, 13.07, 13.93, 14.2, 14.57, 14.87, 15.43, 15.73, 16.33], bpm: 91.6, lufs: -20.1 },
  // Its fiche's 49 cuts (measure.py's, each looked at: its gestures, its four tastings, its jumps in one frame); no beat
  // to count (his voice alone, no music one hears: the catalogue's tempo is its music's under her voice).
  "chef-face": {
    duration: 59.87,
    cuts: [0.93, 2.03, 2.73, 3.2, 3.87, 5.53, 6.07, 7.4, 8.23, 9.17, 10.2, 10.77, 11.47, 11.97, 12.57, 15.67, 17.47, 20.2, 23.73, 25.07, 26.13, 26.47, 27.87, 30.67, 31.97, 33.53, 34.73, 35.13, 35.67, 37.33, 37.63, 38.03, 39.83, 43.63, 44.47, 46.43, 47.13, 48.17, 49.27, 49.63, 50.47, 50.97, 51.57, 51.97, 57.2, 57.63, 58, 58.63, 59],
    bpm: null,
    lufs: -16.5,
  },
  // Its fiche's 56 cuts (13 to a new place, 43 in the same place, a gesture each), read image to image with its
  // subtitles masked; no steady beat under its voice (its catalogue's tempo, 85, decides); its loudness by ebur128.
  "recette": { duration: 44.97, cuts: [1.03, 3.67, 4.27, 5.03, 5.73, 6.5, 7.13, 7.9, 8.53, 9.1, 9.6, 10.23, 11.87, 12.43, 13.1, 13.77, 14.43, 15.43, 15.93, 16.3, 16.93, 17.6, 18.4, 19.3, 19.83, 20.5, 21.17, 21.8, 22.57, 23.17, 23.83, 24.23, 25.2, 25.83, 26.43, 27.17, 27.73, 28.37, 29.1, 29.7, 30.4, 30.9, 31.5, 32.6, 33.3, 34.27, 35.4, 36.3, 37.37, 38.57, 39.2, 40.1, 41.27, 42.03, 42.9, 43.57], bpm: null, lufs: -14.3 },
  // Its fiche's nine cuts, one every second to the image (docs/fiches/affiches.md); its music's beat (a trap beat at 134
  // BPM) leads none of them, laid on a one-second grid that drifts against it: its catalogue's tempo (120, two beats a
  // poster) decides. Its loudness by ebur128.
  "affiches": { duration: 10, cuts: [1, 2, 3, 4, 5, 6, 7, 8, 9], bpm: null, lufs: -14.2 },
  // Its fiche (docs/fiches/vitraux.md): one still shot, no cut; a kick on every beat (123,4 BPM, the first at 0,345 s,
  // on the grid within 5 ms); its sound cut at 9,00 s for the loop; its loudness by ebur128.
  "vitraux": { duration: 9, cuts: [], bpm: 123.4, lufs: -14.1 },
  // Its fiche's two cuts (the close-up opened on a click, closed on the second click of a double click), read image by
  // image; no beat in its sound (its street's, cut by its first click and back on its last: its catalogue's tempo, 90,
  // decides); its loudness by ebur128.
  "curseur": { duration: 10.2, cuts: [2.27, 5.97], bpm: null, lufs: -17.3 },
  // Its fiche's 23 cuts, read image by image (measure.py found them all); its drop's tempo (its intro's voice has its own pace).
  "bienvenue": { duration: 7.73, cuts: [0.83, 1.5, 2.03, 2.73, 2.9, 3.07, 3.23, 3.4, 3.7, 3.97, 4.37, 4.63, 4.9, 5.3, 5.57, 5.7, 5.87, 6.1, 6.33, 6.77, 6.97, 7.23, 7.43], bpm: 91.7, lufs: -14.2 },
};
