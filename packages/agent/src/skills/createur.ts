import { nominalSaid, type MontageSkill, type SkillSound } from "../skills.ts";

// « Face caméra et références », version 2 (v1: 5 November), written on its original's fiche (docs/fiches/createur.md: its first 31 s
// measured image by image at 30 i/s, its cuts on her breaths and on the words that name an image, its places, its sound;
// Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A creator talks to the
// camera and what he talks about shows: above his head, in the top half, full frame for each name he cites. Timed on her
// voice (SkillVoice): her talking video is the Reel, cut by the engine (her « euh » and long pauses out), the frame
// changing between two ideas on the first word of the next one (`cut: attack`, the original's cuts): her other take,
// else a tighter frame held. Its filler casts her other files on what she says (`refs`): an idea's own images, an image
// for each name of a list she says, her business's name when she says it. As the original:
//   her first phrase   on black bands, the whole phrase there from its first word, its words to come in grey, each
//                      white as she says it (Captions bands), then small sober subtitles, a phrase at a time, white,
//                      no word in colour, in the middle of the picture (on the split's line, under her face);
//   an idea's image    the top half of the picture, her the bottom half framed on her face (cut sharp, no line); two
//                      or three images in turn; the first idea's photo of an object on a simple ground, when her head
//                      leaves room above it, cut out on her wall above her head instead (no rim, no shadow);
//   four or more       a wall of thumbnails behind her, two columns sliding in from both edges (7 images, blurred),
//                      her cut out in front of it (only on those shots), else the wall above her head;
//   a name she cites   its image full frame from the instant she names it to the next name (the subtitles staying in
//                      the middle); a name without an image written big on her;
//   her business named a white card grows from the middle onto her chest under her face (14 images, blurred at first)
//                      with a chime, her logo on it (else her name), and stays her idea; above her head the next idea
//                      when there is room.
// Version 2 (Tristan on v1's bench, 6 November: « pas ouf »; its bench had no real person speaking, a free video and a
// synthetic voice): a name written big on her is left out of its subtitle (never a word twice), and its filler casts an
// image on every idea it has one for, the one that shows what she says then (the original's screen changes at each idea).
// No music (its original has none: her voice alone), no grade (the images she shows stay as they are). Her vertical
// video full frame (the original's), her horizontal video in the bottom half with her images in the top half all along;
// the `format` setting: split all along, or full frame all along. Not done (docs/fiches/createur.md, its note): her
// wall recoloured to the image above (a reading of an image's colour), the joke card on an old tape (a pause in her
// talk to lay an insert), the word written by hand then typed (a slot for the word her hands write).

const ROOM_MIN = 0.15;
const CHIME = { sound: "sparkle chime", seconds: 1.2, gain: -2 };
/** Its chime rings as its card grows (s after she starts saying her name: the original's 13,83 → 13,96). */
const CHIME_AT = 0.13;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** An idea with this many images of its own makes a wall behind her (the original's thumbnails). */
export const WALL_FROM = 4;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, texts, track, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const talkN = Math.max(1, Math.min(shots.length, Math.round(mark("said_shots", shots.length))));
  const refsN = Math.max(0, Math.min(shots.length - talkN, Math.round(mark("said_refs", 0))));
  const shotAt = (f) => { let k = 0; for (let i = 0; i < talkN; i++) if (shots[i].from <= f) k = i; return k; };
  const cur = shotAt(frame);
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Arial', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const W = width;
  const H = height;
  const HALF = Math.round(H / 2);
  const full = { position: "absolute", left: 0, top: 0, width: W, height: H };

  // 1. Her images on what she says (after her talk's shots): each one's idea, its item (0 its idea's own, j its j-th
  // name), its span; an idea's own images share one span.
  const refs = Array.from({ length: refsN }, (_, i) => {
    const s = shots[talkN + i];
    const from = mark("said_ref" + (i + 1) + "_from", s.from);
    return { i: talkN + i, idea: mark("said_ref" + (i + 1) + "_idea", 0), item: mark("said_ref" + (i + 1) + "_item", 0), from, to: mark("said_ref" + (i + 1) + "_to", from + s.durationInFrames), shot: s };
  });
  const named = refs.find((r) => r.item > 0 && frame >= r.from && frame < r.to);
  const owned = refs.filter((r) => r.item === 0 && frame >= r.from && frame < r.to);

  // 2. Her face as the engine follows it (in the box her shot is laid in): the room above her head, under her chin.
  const faceAt = (f, box) => {
    if (typeof track !== "function") return null;
    const seen = track(f, { shot: shotAt(f), left: box.left, top: box.top, width: box.width, height: box.height }) || {};
    const faces = (seen.faces || []).filter((x) => x && x.width > 0 && x.height > 0);
    if (!faces.length) return null;
    const face = faces.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    return { top: face.y - face.height * 0.95, bottom: face.y + face.height * 0.75 };
  };

  // 3. Its form: as her video when vertical (each image where the original puts it), split all along for her horizontal
  // video or on her word, full frame all along on her word.
  const format = setting("format", "auto");
  const wideTalk = (Number(shots[0] && shots[0].aspect) || 0.5625) > 1.15;
  const split = refsN > 0 && (format === "partage" || (format === "auto" && wideTalk));
  const plain = format === "plein";
  const herFull = h(Footage, { key: "her" + cur, shot: cur, style: full });
  const herLow = h(Footage, { key: "low" + cur, shot: cur, style: { position: "absolute", left: 0, top: HALF, width: W, height: H - HALF } });
  const imageIn = (r, box, key) => h(Footage, { key: key + r.i, shot: r.i, at: r.shot.from, style: { position: "absolute", ...box } });
  const top = { left: 0, top: 0, width: W, height: HALF };
  // Two or three images of one idea in turn over its span.
  const inTurn = (group) => { if (!group.length) return null; const span = Math.max(1, group[0].to - group[0].from); return group[Math.min(group.length - 1, Math.floor(((frame - group[0].from) / span) * group.length))]; };
  // Split all along: the image of now, else the last one shown (held), else the first one to come.
  const lastShown = () => { let last = null; for (const r of refs) if (r.from <= frame) last = r; return last || refs[0] || null; };

  const layers = [];
  let subY = null;
  // No subtitles while her card covers her chest (the original's: none from its logo on).
  let hush = false;
  if (split) {
    const r = named || inTurn(owned) || lastShown();
    layers.push(herLow);
    if (r) layers.push(imageIn(r, top, "top"));
    subY = HALF;
  } else if (named) {
    // A name she cites: its image full frame from the instant she names it.
    layers.push(imageIn(named, { left: 0, top: 0, width: W, height: H }, "named"));
    subY = Math.round(H * 0.5);
  } else if (owned.length && plain) {
    layers.push(imageIn(inTurn(owned), { left: 0, top: 0, width: W, height: H }, "plain"));
    subY = Math.round(H * 0.5);
  } else if (owned.length >= 4) {
    // A wall of her thumbnails behind her: two columns sliding in from both edges, posed, her cut out in front of it
    // (else the wall stops above her head); on the shot of its own idea from its first image.
    const her = shotAt(Math.max(frame, owned[0].from + 2));
    layers.push(h(Footage, { key: "her" + her, shot: her, style: full }));
    const cutBox = SubjectBox(shots[her], frame, { left: 0, top: 0, width: W, height: H });
    const face = faceAt(frame, { left: 0, top: 0, width: W, height: H });
    const roof = Math.round(H * 0.03);
    const floor = cutBox ? Math.round(H * 0.73) : Math.round(Math.max(H * 0.2, face ? face.top - H * 0.02 : H * 0.4));
    const t = frame - owned[0].from;
    // Two columns, the left one from the left edge, the right one from the right (the original's 6–48 % and 54–92 %),
    // from the top down to 73 % of the height behind her: thumbnails 16:9 or taller (4:5 at most), as many rows as fit,
    // smaller and in 16:9 when there is less room (above her head).
    const rows = Math.ceil(owned.length / 2);
    const gap = Math.round(H * 0.018);
    const colW = [Math.round(W * 0.42), Math.round(W * 0.38)];
    const colX = [Math.round(W * 0.06), Math.round(W * 0.54)];
    const thumbH = Math.max(Math.round(H * 0.07), Math.min(Math.round(colW[1] / 0.8), Math.floor((floor - roof - (rows - 1) * gap) / rows)));
    const slide = t >= 0 && t < 7 ? 1 - Math.pow(t / 7, 2.2) : 0;
    owned.forEach((r, j) => {
      const c = j % 2;
      const y = roof + Math.floor(j / 2) * (thumbH + gap);
      if (y + thumbH > floor + 1) return;
      const tw = Math.min(colW[c], Math.round(thumbH * (16 / 9)));
      const x = c === 0 ? colX[0] + colW[0] - tw : colX[1];
      const dx = Math.round((c === 0 ? -1 : 1) * slide * (tw + (c === 0 ? x : W - x) + W * 0.05));
      layers.push(h("div", { key: "wall" + r.i, style: { position: "absolute", left: x, top: y, width: tw, height: thumbH, overflow: "hidden", transform: dx ? "translateX(" + dx + "px)" : undefined, filter: slide > 0.05 ? "blur(" + Math.round(slide * 10) + "px)" : undefined, boxShadow: "0 14px 46px rgba(0,0,0,0.38)" } },
        h(Footage, { shot: r.i, at: r.shot.from, style: { position: "absolute", left: 0, top: 0, width: tw, height: thumbH } })));
    });
    if (cutBox) layers.push(h(Subject, { key: "cut" + her, shot: her, style: full }));
    subY = Math.round(H * 0.6);
  } else if (owned.length) {
    const r = inTurn(owned);
    const face = faceAt(frame, { left: 0, top: 0, width: W, height: H });
    const room = face ? face.top - H * 0.02 - H * 0.08 : 0;
    // The first idea's photo of an object on a simple ground, cut out on her wall above her head, when there is room.
    const cut = r.idea === 1 && owned.length === 1 && r.shot.kind === "photo" && r.shot.cutout && r.shot.subject && room >= H * ${ROOM_MIN};
    if (cut) {
      layers.push(herFull);
      const s = r.shot.subject;
      const aspect = (s.w / Math.max(0.01, s.h)) * (Number(r.shot.aspect) || 1);
      const ht = Math.round(Math.min(room, (W * 0.5) / aspect));
      layers.push(h(Cutout, { key: "cutout" + r.i, photo: r.shot, x: Math.round((W - ht * aspect) / 2), y: Math.round(face.top - H * 0.02 - ht), height: ht, rim: 0, shadow: false }));
      subY = Math.round(Math.max(H * 0.5, face.bottom + H * 0.03));
    } else {
      // The top half for what the idea is about, her the bottom half framed on her face.
      layers.push(herLow, imageIn(r, top, "top"));
      subY = HALF;
    }
  } else {
    layers.push(herFull);
  }
  const faceNow = !split && !named && !(owned.length && plain) ? faceAt(frame, { left: 0, top: 0, width: W, height: H }) : null;
  if (subY === null) subY = Math.round(faceNow ? Math.max(H * 0.5, faceNow.bottom + H * 0.03) : H * 0.5);

  // 4. Her business named: a white card grows from the middle onto her chest under her face, her logo on it (else her
  // name), and stays her idea; above her head the next idea when there is room.
  const nameFrom = mark("said_name_from", -1);
  const ideasN = Math.max(0, Math.round(mark("said_ideas", 0)));
  const ideaFroms = Array.from({ length: ideasN }, (_, i) => mark("said_idea" + (i + 1) + "_from", 0));
  const ideaOfName = nameFrom >= 0 ? ideaFroms.filter((f) => f <= nameFrom + 1).length : 0;
  // On her chest to the end of her idea, 2,5 s at most (then her words are subtitled again).
  const cardEnd = Math.min(nameFrom + 75, ideaOfName && ideaOfName < ideasN ? ideaFroms[ideaOfName] - 2 : durationInFrames);
  const cardW = Math.round(W * 0.74);
  const cardH = Math.round(cardW * 0.52);
  const card = (box, grow) => {
    const k = grow < 1 ? 0.12 + 0.88 * (1 - Math.pow(1 - grow, 3)) : 1;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const ox = W * 0.5 + (cx - W * 0.5) * k - (box.width * k) / 2;
    const oy = H * 0.55 + (cy - H * 0.55) * k - (box.height * k) / 2;
    return h("div", { key: "card", style: { position: "absolute", left: Math.round(ox), top: Math.round(oy), width: Math.round(box.width * k), height: Math.round(box.height * k), background: "#ffffff", borderRadius: Math.round(W * 0.012), boxShadow: "0 18px 50px rgba(0,0,0,0.32)", overflow: "hidden", filter: grow < 0.35 ? "blur(" + Math.round((0.35 - grow) * 24) + "px)" : undefined } },
      brand.logoUrl
        ? h(Img, { src: brand.logoUrl, style: { position: "absolute", left: "10%", top: "14%", width: "80%", height: "72%", objectFit: "contain" } })
        : h(FitText, { style: { position: "absolute", left: "8%", top: "12%", width: "84%", height: "76%" }, innerStyle: { fontFamily: display, fontWeight: 700, fontSize: Math.round(box.height * 0.42 * k), lineHeight: 1, color: "#111111", textAlign: "center" } }, brand.name || ""));
  };
  if (nameFrom >= 0 && !named && !split && frame >= nameFrom && frame < cardEnd) {
    // On her chest under her face when it fits above the apps' caption, else above her head, never on her face.
    const face = faceAt(nameFrom, { left: 0, top: 0, width: W, height: H });
    const under = Math.max(H * 0.43, face ? face.bottom + H * 0.02 : H * 0.43);
    const above = face ? face.top - H * 0.02 - cardH : -1;
    const cardTop = Math.round(under + cardH <= H * 0.75 ? under : above >= H * 0.06 ? above : H * 0.75 - cardH);
    layers.push(card({ left: Math.round((W - cardW) / 2), top: cardTop, width: cardW, height: cardH }, Math.min(1, (frame - nameFrom) / 14)));
    hush = true;
  } else if (nameFrom >= 0 && !named && !split && !owned.length && frame >= cardEnd && frame < cardEnd + 72) {
    const face = faceAt(cardEnd + 2, { left: 0, top: 0, width: W, height: H });
    if (face && face.top - H * 0.04 - cardH >= H * 0.06) layers.push(card({ left: Math.round((W - cardW) / 2), top: Math.round(face.top - H * 0.02 - cardH), width: cardW, height: cardH }, 1));
  }

  // 5. A name she cites without an image of it: written big on her, under her face.
  const big = !named ? reelTexts.find((t) => t.role === "caption" && frame >= t.from && frame < t.to) : null;
  if (big) {
    const top = Math.round(faceNow ? Math.max(H * 0.42, faceNow.bottom + H * 0.02) : H * 0.42);
    layers.push(h(FitText, { key: "big" + big.from, style: { position: "absolute", left: 90, width: W - 180, top, height: Math.round(H * 0.1) }, innerStyle: { fontFamily: own(big), fontWeight: 700, fontSynthesis: "none", fontSize: Math.round(H * 0.08), lineHeight: 1, color: "#ffffff", textShadow: "0 2px 3px rgba(0,0,0,0.35)", whiteSpace: "nowrap" } }, big.text));
    subY = Math.round(Math.min(H * 0.72, top + H * 0.12));
  }
  function own(t) { return t && t.font ? "'" + t.font + "', " + display : display; }

  // 6. What she says, written by it: her first phrase on black bands, word by word, then small sober subtitles, a phrase
  // at a time, white, in the middle (on the split's line, under her face, under a card).
  const words = (spoken || []).filter((w) => w && typeof w.w === "string");
  const firstTo = mark("said_idea1_to", words.length ? words[words.length - 1].to : 0);
  let bandsN = 0;
  for (let i = 0; i < words.length && bandsN < 25; i++) {
    if (words[i].from > firstTo + 1 || words[i].from - words[0].from > 180) break;
    bandsN = i + 1;
    if (/[.!?…]$/.test(words[i].w)) break;
  }
  const bandWords = words.slice(0, bandsN);
  const rest = words.slice(bandsN);
  const phrases = [];
  let ph = [];
  rest.forEach((w, i) => {
    const prev = rest[i - 1];
    if (prev && ph.length && (w.from - prev.to >= 10 || /[.!?…;:]$/.test(prev.w) || (/,$/.test(prev.w) && ph.length >= 3) || ph.length >= 9)) { phrases.push(ph); ph = []; }
    ph.push(w);
  });
  if (ph.length) phrases.push(ph);
  const bandsTo = bandWords.length ? bandWords[bandWords.length - 1].to + 6 : -1;
  const row = Math.min(0.62, Math.max(0.46, subY / H));
  const said = frame < bandsTo
    ? h(Captions, { key: "bands", words: bandWords, style: "bands", look: { row } })
    : hush
      ? null
      : (() => {
        const p = phrases.find((x, i) => frame >= x[0].from && frame < Math.min(x[x.length - 1].to + 8, phrases[i + 1] ? phrases[i + 1][0].from : Infinity));
        if (!p) return null;
        // Never a word twice: a name written big on her right now is left out of its phrase (v2).
        const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        const twice = big ? plain(big.text).split(" ") : [];
        const left = p.filter((w) => !(plain(w.w) && plain(w.w).split(" ").every((x) => twice.includes(x))));
        if (!left.length) return null;
        const lineH = Math.round(H * 0.034);
        return h("div", { key: "sub" + p[0].from, style: { position: "absolute", left: 120, width: W - 240, top: Math.round(subY - lineH), height: lineH * 2, display: "flex", alignItems: "center", justifyContent: "center" } },
          h("div", { style: { fontFamily: body, fontWeight: 600, fontSize: Math.round(H * 0.026), lineHeight: 1.25, color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: "0 1px 2px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.35)" } }, left.map((w) => w.w).join(" ")));
      })();

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, layers, said);
}`;

export const createur: MontageSkill = {
  key: "createur",
  version: 2,
  // Its original has no music: its tempo only counts its sounds' beats, never its cuts (her voice leads).
  bpm: 90,
  shots: [1, 40],
  // Her talking video and at least one image of what she talks about; up to nine.
  files: [2, 10],
  how: "Elle parle face caméra, et ce dont elle parle apparaît : sa première phrase sur des bandeaux noirs, chaque mot qui passe du gris au blanc quand elle le dit, puis de petits sous-titres sobres au milieu ; pendant une idée, son image dans la moitié du haut (elle dans la moitié du bas), ou détourée sur son mur au-dessus de sa tête pour la première quand il y a la place ; quatre images ou plus d'une idée en mur derrière elle ; une image plein écran pour chaque chose qu'elle cite, au moment où elle la nomme ; quand elle dit le nom de son commerce, son logo surgit sur une carte blanche avec un carillon ; le cadre change entre deux idées ; pas de musique.",
  end: false,
  texts: [],
  voice: {
    key: "le mot qui porte l'idée (il n'est pas écrit : il sépare ses idées)",
    ideas: [1, 8],
    items: "les choses qu'elle cite l'une après l'autre dans une idée (ses produits, ses plats, ses réalisations, des noms) : chaque nom au moment où elle le dit, avec l'image de ses fichiers qui le montre",
    max: { key: 20, item: 24 },
    cut: "attack",
    refs: "une photo ou une vidéo de ce dont elle parle à ce moment-là, qui le montre vraiment (le produit qu'elle nomme, le plat, la réalisation, l'avant/après, son lieu), jamais une image au hasard : l'écran change à chaque idée comme chez l'original, donc une image pour chaque idée dont elle a une image qui va (une à trois, en haut de l'écran pendant qu'elle la dit ; un objet sur un fond simple détouré au-dessus de sa tête), quatre ou plus pour un mur derrière elle quand elle parle de tout ce qu'elle fait, une pour chaque nom d'une liste (plein écran à l'instant où elle le dit) ; ses plus belles et ses plus nettes d'abord, jamais deux fois la même, jamais sa vidéo où elle parle",
    name: "son logo surgit sur une carte blanche, avec un carillon, quand elle dit le nom de son commerce",
    subtitles: "own",
  },
  settings: [
    {
      name: "format",
      want: "la forme : comme sa vidéo, en écran partagé tout du long, ou elle plein cadre tout du long",
      choices: [
        { value: "auto", says: "comme sa vidéo : verticale plein cadre, chaque image à sa place comme l'original ; horizontale, elle dans la moitié du bas et ses images dans celle du haut" },
        { value: "partage", says: "moitié-moitié tout du long : ses images en haut, elle en bas" },
        { value: "plein", says: "elle plein cadre, et chaque image plein cadre à son moment" },
      ],
    },
  ],
  // Its original has no common grade: her shots keep their light, the images she shows stay as they are.
  finish: { contrast: 0, saturation: 0, warmth: 0, grain: 0, vignette: 0, fade: 0 },
  timeline(n, { said: given }) {
    const said = given ?? nominalSaid(n, {});
    // Nothing big but a name without an image of it: its keywords and the names it shows are only her images.
    const texts: Record<string, { from: number; to: number }> = {};
    said.ideas.forEach((idea, k) => {
      texts[`idee${k + 1}`] = { from: idea.at, to: idea.at };
      const end = said.texts[`idee${k + 1}`]?.to ?? idea.to;
      idea.items.forEach((item, j) => {
        const next = idea.items[j + 1];
        texts[`idee${k + 1}_${j + 1}`] = item.file ? { from: item.at, to: item.at } : { from: item.at, to: next ? next.at : end };
      });
    });
    // Her cut-out only on the shots of an idea whose images make a wall behind her.
    const walls = new Set(said.ideas.flatMap((idea, k) => ((idea.files?.length ?? 0) >= WALL_FROM ? [k] : [])));
    const sounds: SkillSound[] = said.name ? [{ at: round3(said.name.from + CHIME_AT), ...CHIME }] : [];
    return {
      duration: said.duration,
      shots: said.shots.map((s) => ({ start: s.start, end: s.end, want: "elle, face caméra, avec de la place au-dessus de sa tête", take: s.take, punch: s.punch })),
      texts,
      marks: {},
      sounds,
      // Its original has no music: her voice alone, with its chime.
      music: { none: true },
      cutouts: said.shots.flatMap((s, i) => (walls.has(s.idea) ? [i] : [])),
    };
  },
  code: CODE,
};
