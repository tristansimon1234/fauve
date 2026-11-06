import type { EffectPiece } from "../pieces.ts";

// « Face caméra et références », the effect (docs/fiches/createur.md, effects 1, 3 and 10; its whole Reel is
// skills/createur.ts, version 1): over her talking shot, what she names shows above her at the instant she names it.
// Timed on what she says under it (`spoken`) and laying her photos (`photos`): its filler chooses up to four of her
// photos of the things she names (her products, her dishes, her work) and writes each name as she says it (nom1 …
// nom4, in the order she says them, each with its photo in the same order); its code finds each name in what she says
// by its letters (accents, case and a plural's s aside). From that instant to the next name (or the effect's end), its
// photo takes the top half of the picture, cut sharp, no line, no frame, and she the bottom half: over her own picture
// when her head is below the middle (the original keeps him in his frame), else her own picture moved down at the
// montage's scale until her head is in the bottom half (laid in the bottom half and framed on her by the engine when
// her face was not followed, as the skill does: a wider look at her horizontal video); the first one, an object cut out cleanly,
// sits on her wall above her head instead (no rim, no shadow) when her head leaves room for it; a name without a photo
// is written big on her, under her face; full frame on her word (the `format` setting, the original's names cited).
// What she says is written by it, as its skill writes it: small sober subtitles, a phrase at a time, white, no word in
// colour, on the split's line (onto the photo when her eyes come up to it), under her face before the first name. Her
// face as the engine followed it (`track`), read over each name's whole span; without it, the split, which keeps her
// whole whatever her place. Left out: the model's hook on black bands, its wall of thumbnails with her cut out in front,
// her logo's card with its chime when she says her business's name, its cuts on her breaths (the montage's).

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track, spoken, photos }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const HALF = Math.round(H / 2);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const list = shots || [];
  // Its shots: those that play during it (her talk, maybe cut into pieces by the editor).
  const mine = list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const shotAt = (f) => { let k = mine.length ? mine[0] : -1; for (const i of mine) if (list[i].from <= f) k = i; return k; };
  const BEAT = mark("beat", 18);
  const display = "'" + brand.displayFont + "', 'Inter Tight', Arial, sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', Arial, sans-serif";
  const pics = (Array.isArray(photos) ? photos : []).filter((p) => p && typeof p.src === "string" && p.src);

  // 1. What she says under it: each word at its frame, and its letters alone (accents and case aside).
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const said = (Array.isArray(spoken) ? spoken : [])
    .filter((w) => w && typeof w.w === "string" && Number.isFinite(w.from))
    .map((w) => ({ w: w.w, from: Math.round(w.from), to: Math.round(Number.isFinite(w.to) ? w.to : w.from + 8), bare: plain(w.w) }))
    .sort((a, b) => a.from - b.from);
  const flat = [];
  said.forEach((w, i) => w.bare.split(" ").filter(Boolean).forEach((t) => flat.push({ t, i })));
  const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2);
  const findFrom = (tokens, start, used) => {
    for (let j = Math.max(0, start); j + tokens.length <= flat.length; j++) {
      let ok = true;
      for (let q = 0; q < tokens.length && ok; q++) ok = !used.has(flat[j + q].i) && same(flat[j + q].t, tokens[q]);
      if (ok) return j;
    }
    return -1;
  };

  // 2. The names she says, in her order, each with its photo (the filler's, in the same order), each on the image she
  // says it; a name not found on a beat between the ones found. More photos than names: the last name shows the rest in turn.
  const names = ["nom1", "nom2", "nom3", "nom4"].map(word).filter(Boolean).map((text, k) => ({ text, k, tokens: plain(text).split(" ").filter(Boolean) }));
  names.forEach((n, k) => { n.pics = k === names.length - 1 ? pics.slice(k) : pics.slice(k, k + 1); });
  const used = new Set();
  let cursor = 0;
  names.forEach((n) => {
    if (!n.tokens.length) return;
    let j = findFrom(n.tokens, cursor, used);
    if (j < 0) j = findFrom(n.tokens, 0, used);
    if (j < 0) return;
    for (let q = 0; q < n.tokens.length; q++) used.add(flat[j + q].i);
    n.at = said[flat[j].i].from;
    cursor = j + n.tokens.length;
  });
  const snap = (f) => Math.max(0, Math.round(f / BEAT) * BEAT);
  const found = names.map((n, i) => (n.at !== undefined ? i : -1)).filter((i) => i >= 0);
  names.forEach((n, k) => {
    if (n.at !== undefined) return;
    if (!found.length) { n.at = snap((k * D) / names.length); return; }
    const a = found.filter((i) => i < k).pop();
    const b = found.find((i) => i > k);
    const ta = a === undefined ? 0 : names[a].at;
    const tb = b === undefined ? D : names[b].at;
    const ia = a === undefined ? -1 : a;
    const ib = b === undefined ? names.length : b;
    n.at = a === undefined && k === 0 ? 0 : snap(ta + ((tb - ta) * (k - ia)) / (ib - ia));
  });
  const HOLD = Math.max(18, Math.round(BEAT));
  const shown = [];
  names.slice().sort((a, b) => a.at - b.at).forEach((n) => {
    const at = Math.max(n.at, shown.length ? shown[shown.length - 1].at + HOLD : 0);
    if (at <= D - Math.round(HOLD / 2)) shown.push({ ...n, at: Math.round(at) });
  });
  shown.forEach((n, i) => { n.end = i + 1 < shown.length ? shown[i + 1].at : D; });
  const nameAt = (f) => { let n = null; for (const x of shown) if (x.at <= f) n = x; return n; };

  // 3. Her face as the engine follows it, over a span (its top with her hair, its bottom with her chin): the room above
  // her head, where her chest starts.
  const faceAt = (f, box) => {
    if (typeof track !== "function") return null;
    const seen = (box ? track(f, box) : track(f)) || {};
    let head = null;
    const grow = (top, bottom, eyes) => { head = head ? { top: Math.min(head.top, top), bottom: Math.max(head.bottom, bottom), eyes: Math.min(head.eyes, eyes) } : { top, bottom, eyes }; };
    const faces = (seen.faces || []).filter((x) => x && x.width > 0 && x.height > 0);
    if (faces.length) {
      const face = faces.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
      grow(face.y - face.height * 0.95, face.y + face.height * 0.75, face.points && face.points.right_eye ? Math.min(face.points.right_eye.y, face.points.left_eye ? face.points.left_eye.y : Infinity) : face.y - face.height * 0.1);
    }
    // Her head from her body too (its nose or its ears, sized by her shoulders), where the face model misses or
    // misplaces it (her head turned, too far): her hair and her chin, as the scene check draws her silhouette.
    (seen.bodies || []).forEach((b) => {
      const p = (b && b.points) || {};
      const at = (k) => (p[k] && p[k].visible ? p[k] : null);
      const ls = at("left_shoulder");
      const rs = at("right_shoulder");
      const ears = at("left_ear") && at("right_ear") ? { y: (at("left_ear").y + at("right_ear").y) / 2 } : null;
      const nose = at("nose") || ears;
      if (!ls || !rs || !nose) return;
      const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
      if (sw >= 8) grow(nose.y - 0.68 * sw, nose.y + 0.48 * sw, nose.y - 0.12 * sw);
    });
    return head;
  };
  const faceOver = (from, to) => {
    let head = null;
    for (let f = Math.max(0, from); f < Math.min(D, Math.max(from + 1, to)); f += 6) {
      const x = faceAt(f);
      if (x) head = head ? { top: Math.min(head.top, x.top), bottom: Math.max(head.bottom, x.bottom) } : x;
    }
    return head;
  };

  // 4. Each name's form, read once over its span (nothing moves while she says it): full frame on her word; the first
  // one's object cut out on her wall above her head when there is room; its photo over the top half of her own picture
  // when her head is below the middle; else she is laid again in the bottom half, framed on her face.
  const lineH = Math.round(H * 0.034);
  // A block that many px high near her, never on her face: under it while that stays above the apps' caption, else
  // above her head, else as low as the caption allows.
  const nearHer = (head, tall) => {
    if (!head) return Math.round(0.42 * H);
    const under = Math.max(0.42 * H, head.bottom + 0.02 * H);
    if (under + tall <= 0.74 * H) return Math.round(under);
    const above = head.top - 0.02 * H - tall;
    if (above >= 0.06 * H) return Math.round(above);
    return Math.round(0.74 * H - tall);
  };
  const format = setting("format", "moitie");
  shown.forEach((n, i) => {
    const head = faceOver(n.at, n.end);
    n.head = head;
    const p = n.pics[0];
    // The cut-out stands above her head, over her words when they cannot go under her face.
    const subTop = head ? nearHer(head, 2 * lineH) : 0;
    n.roof = head ? Math.min(head.top, subTop) - 0.02 * H : 0;
    if (!p) n.form = "name";
    else if (format === "plein") n.form = "plein";
    else if (i === 0 && n.pics.length === 1 && p.cutout && p.subject && p.subject.h > 0 && head && n.roof - 0.08 * H >= 0.15 * H) n.form = "cutout";
    else if (head && head.top >= HALF + 0.01 * H) n.form = "over";
    else n.form = "split";
    // Laid again, her own picture at the montage's scale, moved down until her head is in the bottom half (the original
    // keeps him in his frame); with no face followed, framed on her in the bottom half by the engine.
    n.drop = n.form === "split" && head ? Math.round(Math.max(0, Math.min(HALF, HALF + 0.02 * H - head.top))) : null;
  });

  const layers = [];
  const now = nameAt(frame);
  const cur = shotAt(frame);
  // A photo laid in a box, cut sharp, framed on its subject; two or three of one name in turn over its span.
  const inTurn = (n) => n.pics[Math.min(n.pics.length - 1, Math.floor(((frame - n.at) / Math.max(1, n.end - n.at)) * n.pics.length))];
  const photoIn = (p, box, key) => {
    const s = p.subject;
    const at = s && s.w > 0 && s.h > 0 ? Math.round((s.x + s.w / 2) * 100) + "% " + Math.round((s.y + s.h / 2) * 100) + "%" : "50% 50%";
    return h("div", { key, style: { position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, overflow: "hidden", backgroundColor: "#000000" } },
      h(Img, { src: p.src, style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: at } }));
  };
  let subY = null;
  if (now && now.form === "plein") {
    layers.push(photoIn(inTurn(now), { left: 0, top: 0, width: W, height: H }, "full" + now.at));
    subY = Math.round(H * 0.5);
  } else if (now && now.form === "cutout") {
    // Her own picture stays; the object stands on her wall above her head (and above her words when they go there),
    // centred, half the width at most, no rim, no shadow.
    const p = now.pics[0];
    const s = p.subject;
    const aspect = (s.w / Math.max(0.01, s.h)) * (Number(p.aspect) || 1);
    const tall = Math.round(Math.min(now.roof - 0.08 * H, (W * 0.5) / Math.max(0.2, aspect)));
    layers.push(h(Cutout, { key: "cut" + now.at, photo: p, x: Math.round((W - tall * aspect) / 2), y: Math.round(now.roof - tall), height: tall, rim: 0, shadow: false }));
  } else if (now && (now.form === "over" || now.form === "split")) {
    const low = { position: "absolute", left: 0, top: HALF, width: W, height: H - HALF };
    if (now.form === "split" && cur >= 0) {
      layers.push(now.drop !== null
        ? h("div", { key: "low" + cur, style: { ...low, overflow: "hidden" } }, h(Footage, { shot: cur, style: { position: "absolute", left: 0, top: now.drop - HALF, width: W, height: H } }))
        : h(Footage, { key: "low" + cur, shot: cur, style: low }));
    }
    layers.push(photoIn(inTurn(now), { left: 0, top: 0, width: W, height: HALF }, "top" + now.at));
    subY = HALF;
    // Her eyes come up to the split's line (her face at the top of the bottom half): the subtitles go onto the photo.
    if (now.form === "split" && cur >= 0) {
      const face = now.drop !== null ? faceAt(frame) : faceAt(frame, { shot: cur, left: 0, top: HALF, width: W, height: H - HALF });
      const eyes = face ? face.eyes + (now.drop || 0) : Infinity;
      if (eyes < HALF + Math.round(0.11 * H)) subY = HALF - Math.round(0.045 * H);
    }
  } else if (now && now.form === "name") {
    // A name without a photo: written big on her, under her face (above her head when her face is low), her words with
    // it, never on her face, left of the apps' buttons.
    const tall = Math.round(H * 0.1);
    const top = nearHer(now.head, tall + 2 * lineH + Math.round(0.01 * H));
    layers.push(h(FitText, { key: "big-" + now.text, style: { position: "absolute", left: 140, width: W - 280, top, height: tall }, innerStyle: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: Math.round(H * 0.08), lineHeight: 1, color: "#ffffff", textShadow: "0 0 2px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.4)", whiteSpace: "nowrap" } }, now.text));
    subY = top + tall + Math.round(0.01 * H) + lineH;
  }
  if (subY === null) {
    // Her words near her, never on her face: under it, else above her head; in the middle with no face followed.
    const head = now ? now.head : faceOver(0, shown.length ? shown[0].at : D);
    subY = head ? nearHer(head, 2 * lineH) + lineH : Math.round(0.5 * H);
  }

  // 5. What she says, written by it as its skill writes it: small sober subtitles, a phrase at a time (nine words at
  // most), white, no word in colour, on the split's line, under her face otherwise.
  const phrases = [];
  let ph = [];
  said.forEach((w, i) => {
    const prev = said[i - 1];
    if (prev && ph.length && (w.from - prev.to >= 10 || /[.!?…;:]$/.test(prev.w) || (/,$/.test(prev.w) && ph.length >= 3) || ph.length >= 9)) { phrases.push(ph); ph = []; }
    ph.push(w);
  });
  if (ph.length) phrases.push(ph);
  const phrase = phrases.find((x, i) => frame >= x[0].from && frame < Math.min(x[x.length - 1].to + 8, phrases[i + 1] ? phrases[i + 1][0].from : Infinity));
  // Never a word twice (v2): a name written big on her right now is left out of its phrase.
  const plainOf = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const twice = now && now.form === "name" ? plainOf(now.text).split(" ") : [];
  const left = phrase ? phrase.filter((w) => !(plainOf(w.w) && plainOf(w.w).split(" ").every((x) => twice.includes(x)))) : [];
  const sub = left.length
    ? h(FitText, { key: "sub-" + phrase[0].from, style: { position: "absolute", left: 140, width: W - 280, top: Math.round(subY - lineH), height: lineH * 2 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: Math.round(H * 0.026), lineHeight: 1.25, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: "0 0 2px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.5)" } },
        left.map((w) => w.w).join(" "))
    : null;
  return h(AbsoluteFill, null, layers, sub);
}`;

export const createur: EffectPiece = {
  key: "createur",
  version: 2,
  name: "Face caméra et références",
  how: "pendant qu'elle parle face caméra, la photo de chaque chose qu'elle nomme surgit d'un coup dans la moitié haute de l'écran à l'instant où elle la nomme, jusqu'à la suivante, elle dans la moitié du bas, son visage entier (la première, un objet détouré, posée sur son mur au-dessus de sa tête quand il y a la place) ; ses mots en petits sous-titres sobres sur la ligne de partage ; une chose nommée sans photo s'écrit en grand sur elle ; puis le montage reprend.",
  needs: "une vidéo d'elle (ou de quelqu'un de l'équipe) qui parle face caméra, avec de la place au-dessus de sa tête, et une photo de chacune des choses qu'elle nomme (ses produits, ses plats, ses réalisations).",
  lays: "sur son plan face caméra pendant qu'elle nomme une à quatre choses dont elle a les photos, ce plan seul ou ses morceaux coupés par le monteur",
  shots: [1, 6],
  seconds: [2, 10],
  require: { files: 2, shot: { framing: ["medium", "close", "wide"], person: true, video: true } },
  spoken: true,
  photos: { want: "une photo de chacune des choses qu'elle nomme dans ce passage (un produit, un plat, une réalisation), dans l'ordre où elle les nomme, celle qui la montre le mieux", most: 4 },
  texts: [
    { slot: "nom1", want: "le nom de la première chose qu'elle nomme, tel qu'elle le dit (une forme comme « le croissant », « nos tresses », « le pot bleu ») : sa photo surgit au-dessus d'elle à cet instant", max: 24, required: true },
    { slot: "nom2", want: "facultatif : le nom de la chose suivante qu'elle nomme, tel qu'elle le dit, après la précédente", max: 24, required: false },
    { slot: "nom3", want: "facultatif : le nom de la chose d'après, tel qu'elle le dit, après la précédente", max: 24, required: false },
    { slot: "nom4", want: "facultatif : le nom de la dernière chose qu'elle nomme, tel qu'elle le dit, après la précédente", max: 24, required: false },
  ],
  settings: [
    {
      name: "format",
      want: "la place de ses photos : dans la moitié haute de l'écran, elle en bas, ou plein écran chacune à son moment",
      choices: [
        { value: "moitie", says: "chaque photo dans la moitié haute, elle en bas, son visage entier (comme l'original)" },
        { value: "plein", says: "chaque photo plein écran à l'instant où elle la nomme, ses sous-titres au milieu" },
      ],
    },
  ],
  code: CODE,
};
