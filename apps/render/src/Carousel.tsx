import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, cancelRender, continueRender, delayRender, getRemotionEnvironment } from "remotion";
import { fitsPending } from "./Fit";
import { fontsLoaded } from "./fonts";
import { compileComponent, Fallback, SCOPE, scissorRim } from "./MotionScene";
import { PaperCutout } from "./PaperCutout";
import { coverLayout, cssFilter, Photo as RetouchPhoto } from "./Retouch";
import type { Theme } from "./theme";
import type { CarouselPhoto, PhotoEdit, ReelProps } from "./types";

// A whole carousel designed as code by the carousel designer: one component draws
// every slide (`slide` of `count`), so the slides hold together like a graphic
// designer's series: her photos framed on their subject, her subjects cut out
// (in front of a title, out of their frame, as stickers), text slides, shapes and
// photos that run from one slide to the next (Strip). It is checked by a test
// render (check mode) before it gets here; if it fails at render time, a plain
// slide (her photo and its texts) goes out instead.

type CarouselComponent = (props: {
  slide: number;
  count: number;
  width: number;
  height: number;
  brand: ReelProps["brand"] & { ink: string; cream: string };
  texts: Record<string, string>;
  photos: CarouselPhoto[];
}) => ReactNode;

type Frame = { slide: number; count: number; width: number; height: number; grade?: string; photos: CarouselPhoto[]; check: boolean; light: string };

const CarouselContext = createContext<Frame | null>(null);

function useFrame(): Frame {
  const frame = useContext(CarouselContext);
  if (!frame) throw new Error("hors d'un carrousel");
  return frame;
}

const px = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** The size a box is drawn at (px); a box sized another way is taken as the whole slide. */
const boxSize = (frame: Frame, style?: CSSProperties) => ({ width: px(style?.width) ?? frame.width, height: px(style?.height) ?? frame.height });

/** A photo's retouch, reframed on request: another point to keep in the middle, a closer crop. */
function photoEdit(photo: CarouselPhoto, focus?: { x: number; y: number }, zoom?: number): PhotoEdit {
  const edit = photo.edit ?? { source: { width: Math.round(photo.aspect * 1000), height: 1000 } };
  const fit = (v: number) => Math.min(1, Math.max(0, v));
  return {
    ...edit,
    adjust: {
      ...edit.adjust,
      ...(focus && Number.isFinite(focus.x) && Number.isFinite(focus.y) ? { focus: { x: fit(focus.x), y: fit(focus.y) } } : {}),
      ...(zoom && Number.isFinite(zoom) && zoom > 1 ? { zoom: Math.min(4, zoom) } : {}),
    },
  };
}

/** The colour filters of a photo in this carousel: the brand's light, then its own retouch. */
const filterOf = (frame: Frame, photo: CarouselPhoto) => [frame.grade, cssFilter(photo.edit?.adjust)].filter(Boolean).join(" ") || undefined;

/** A photo the code asks for that does not exist: the test render says so; a render draws the slide without it. */
function absent(frame: Frame, what: string): null {
  if (frame.check) throw new Error(`<${what}> sur une photo qui n'existe pas (photos en a ${frame.photos.length} : de photos[0] à photos[${frame.photos.length - 1}])`);
  return null;
}

/**
 * One of her photos in a box (`style`: its place and size in px, and anything else: a radius,
 * a border, a shadow, a rotation): retouched, in the brand's light, covering the box framed on
 * its subject; `focus` (the point to keep in the middle, shares of the photo) and `zoom` (> 1) reframe it.
 */
function BoxPhoto({ photo, style, focus, zoom }: { photo?: CarouselPhoto; style?: CSSProperties; focus?: { x: number; y: number }; zoom?: number }) {
  const frame = useFrame();
  const box: CSSProperties = { position: "absolute", overflow: "hidden", ...style };
  if (!photo) return absent(frame, "Photo") ?? <div style={{ ...box, background: frame.light }} />;
  return (
    <div style={box}>
      <RetouchPhoto src={photo.src} edit={photoEdit(photo, focus, zoom)} grade={frame.grade} frame={boxSize(frame, style)} />
    </div>
  );
}

/** What places a box (never how it looks): a Subject sits exactly where its Photo is, without a second border or shadow. */
const GEOMETRY = new Set(["position", "left", "top", "right", "bottom", "inset", "width", "height", "transform", "transformOrigin", "rotate", "scale", "translate", "zIndex", "opacity"]);
const geometry = (style?: CSSProperties): CSSProperties => Object.fromEntries(Object.entries(style ?? {}).filter(([key]) => GEOMETRY.has(key)));

/**
 * The subject of a photo drawn in that box, cut out, exactly over it: drawn after a title, the
 * title passes behind the person; and it is not held by the box, so a head can break out of its
 * frame. Same `style`, `focus` and `zoom` as its Photo. No rim or shadow unless asked.
 */
function Subject({ photo, style, focus, zoom, rim = 0, shadow = false }: { photo?: CarouselPhoto; style?: CSSProperties; focus?: { x: number; y: number }; zoom?: number; rim?: number; shadow?: boolean }) {
  const frame = useFrame();
  if (!photo) return absent(frame, "Subject");
  if (!photo.cutout) {
    if (frame.check) throw new Error(`<Subject> sur photos[${frame.photos.indexOf(photo)}], qui n'a pas de détourage net : vérifie photo.cutout avant`);
    return null;
  }
  const edit = photoEdit(photo, focus, zoom);
  const layout = coverLayout(boxSize(frame, style), edit.source, edit.adjust);
  const filter = filterOf(frame, photo);
  const straighten = edit.adjust?.straighten;
  return (
    <div style={{ position: "absolute", ...geometry(style) }}>
      <AbsoluteFill style={{ transform: straighten ? `rotate(${straighten}deg)` : undefined }}>
        {rim > 0 || shadow ? (
          <PaperCutout src={photo.cutout} width={layout.width} height={layout.height} spec={scissorRim(rim, shadow)} filter={filter} style={{ left: layout.left, top: layout.top }} />
        ) : (
          <Img src={photo.cutout} style={{ position: "absolute", left: layout.left, top: layout.top, width: layout.width, height: layout.height, filter }} />
        )}
      </AbsoluteFill>
    </div>
  );
}

/**
 * A photo's subject alone, cut out like a sticker: the subject's box with its top-left corner at
 * (x, y) and `height` px high, a white scissor rim (`rim` px) and a warm shadow by default.
 */
function Cutout({ photo, x, y, height, rim = 10, shadow = true, style }: { photo?: CarouselPhoto; x: number; y: number; height: number; rim?: number; shadow?: boolean; style?: CSSProperties }) {
  const frame = useFrame();
  if (!photo) return absent(frame, "Cutout");
  if (!photo.cutout || !photo.subject || !(photo.subject.h > 0)) {
    if (frame.check) throw new Error(`<Cutout> sur photos[${frame.photos.indexOf(photo)}], qui n'a pas de détourage net : vérifie photo.cutout avant`);
    return null;
  }
  if (!(height > 0)) return null;
  const frameHeight = height / photo.subject.h;
  const frameWidth = frameHeight * photo.aspect;
  return (
    <PaperCutout
      src={photo.cutout}
      width={frameWidth}
      height={frameHeight}
      spec={scissorRim(rim, shadow)}
      filter={filterOf(frame, photo)}
      style={{ left: x - photo.subject.x * frameWidth, top: y - photo.subject.y * frameHeight, ...style }}
    />
  );
}

/**
 * The whole carousel side by side (count × width px wide, the slides' height): what is laid in it
 * runs from one slide to the next, seamless when she swipes; each slide shows its own part.
 */
function Strip({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const frame = useFrame();
  return <div style={{ ...style, position: "absolute", top: 0, left: -frame.slide * frame.width, width: frame.count * frame.width, height: frame.height }}>{children}</div>;
}

// Photo: her photo in a box. Subject: its subject cut out over it. Cutout: a subject as a sticker.
// Strip: the slides side by side. No Footage: a carousel has no shots.
const CAROUSEL_SCOPE = { ...Object.fromEntries(Object.entries(SCOPE).filter(([name]) => name !== "Footage")), Cutout, Photo: BoxPhoto, Subject, Strip };

/** Every text this far from the edges (px on a 1080-wide slide). */
export const CAROUSEL_MARGIN = 40;
/** On the cover, the sides keep more: the profile grid shows it in 3:4, about 34 px cut off each side. */
export const COVER_SIDE = 76;
/** The smallest type (px on a 1080-wide slide) that still reads on a phone. */
export const MIN_TYPE = 26;
const TOLERANCE = 6;

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

/**
 * Where the letters of a text line are (its ink, from its baseline), and its type size, in px of
 * the page: a line's box is the font's, which a display serif makes half as tall again as its letters.
 */
function inkMeter() {
  const ctx = document.createElement("canvas").getContext("2d");
  const cache = new Map<string, { fa: number; fd: number; aa: number; ad: number }>();
  return (text: string, style: CSSStyleDeclaration, r: DOMRect) => {
    if (!ctx) return { top: r.top, bottom: r.bottom, size: r.height / 1.2 };
    const font = `${style.fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`;
    const shown = style.textTransform === "uppercase" ? text.toUpperCase() : text;
    const key = `${font}|${shown}`;
    let m = cache.get(key);
    if (!m) {
      ctx.font = font;
      const t = ctx.measureText(shown);
      m = { fa: t.fontBoundingBoxAscent, fd: t.fontBoundingBoxDescent, aa: t.actualBoundingBoxAscent, ad: t.actualBoundingBoxDescent };
      cache.set(key, m);
    }
    const s = r.height / Math.max(1, m.fa + m.fd);
    const baseline = r.top + m.fa * s;
    return { top: baseline - m.aa * s, bottom: baseline + m.ad * s, size: 100 * s };
  };
}

/** The families the browser could load (the faces Google served). */
function loadedFamilies(): Set<string> {
  const families = new Set<string>();
  document.fonts.forEach((face) => {
    if (face.status === "loaded") families.add(face.family.replace(/^["']|["']$/g, ""));
  });
  return families;
}

/**
 * Waits for the fonts the slide really uses (a weight is fetched when first laid out) and its
 * fitted boxes. In check mode, then: a font the code asked for that does not exist, a text cut by
 * an edge of the slide or too close to it, or too small for a phone, fails the test render with the reason.
 */
function useSettled(root: React.RefObject<HTMLDivElement | null>, props: ReelProps) {
  const carousel = props.carousel!;
  // The live preview (the editors' player) draws as it loads; only a render waits.
  const [handle] = useState(() => (getRemotionEnvironment().isRendering ? delayRender("carousel", { timeoutInMilliseconds: 60000 }) : null));
  useEffect(() => {
    if (handle === null) return;
    (async () => {
      await fontsLoaded();
      for (let i = 0; i < 300 && fitsPending() > 0; i++) await waitFrame();
      await waitFrame();
      await document.fonts.ready;
      if (!carousel.check) return continueRender(handle);
      const problems: string[] = [];
      const families = loadedFamilies();
      const missing = carousel.fonts.filter((family) => !families.has(family));
      if (missing.length) problems.push(`police introuvable sur Google Fonts : ${missing.join(", ")} (donne le nom exact d'une famille Google Fonts)`);
      const container = root.current;
      if (container) {
        const origin = container.getBoundingClientRect();
        const scale = origin.width / props.width || 1;
        const side = carousel.slide === 0 ? COVER_SIDE : CAROUSEL_MARGIN;
        const out: string[] = [];
        const small: string[] = [];
        const ink = inkMeter();
        const range = document.createRange();
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent?.trim();
          if (!text || !node.parentElement) continue;
          const style = getComputedStyle(node.parentElement);
          if (style.visibility === "hidden" || style.display === "none") continue;
          range.selectNodeContents(node);
          for (const r of Array.from(range.getClientRects())) {
            if (r.width < 1 || r.height < 1) continue;
            const letters = ink(text, style, r);
            const [x1, y1, x2, y2] = [(r.left - origin.left) / scale, (letters.top - origin.top) / scale, (r.right - origin.left) / scale, (letters.bottom - origin.top) / scale];
            // A text laid on another slide of the strip is not on this one.
            if (x2 <= 0 || x1 >= props.width || y2 <= 0 || y1 >= props.height) continue;
            const inside = x1 >= side - TOLERANCE && y1 >= CAROUSEL_MARGIN - TOLERANCE && x2 <= props.width - side + TOLERANCE && y2 <= props.height - CAROUSEL_MARGIN + TOLERANCE;
            if (!inside) out.push(`« ${text.slice(0, 40)} » (x ${Math.round(x1)} à ${Math.round(x2)}, y ${Math.round(y1)} à ${Math.round(y2)})`);
            if (letters.size / scale < MIN_TYPE) small.push(`« ${text.slice(0, 40)} » (${Math.round(letters.size / scale)} px)`);
          }
        }
        if (out.length)
          problems.push(
            `texte coupé par un bord ou trop près : ${[...new Set(out)].slice(0, 3).join(" ; ")}. Sur la diapositive ${carousel.slide + 1}, chaque texte reste entier à ${side} px des côtés et ${CAROUSEL_MARGIN} px du haut et du bas (${props.width} × ${props.height})${carousel.slide === 0 ? ", la couverture garde plus de marge sur les côtés : la grille du profil la montre en 3:4" : ""} ; un texte ne passe jamais d'une diapositive à l'autre`,
          );
        if (small.length) problems.push(`texte trop petit pour un téléphone : ${[...new Set(small)].slice(0, 3).join(" ; ")}. ${MIN_TYPE} px de police au moins, même rétréci par FitText`);
      }
      if (!problems.length) return continueRender(handle);
      cancelRender(new Error(`diapositive ${carousel.slide + 1} : ${problems.join(" | ")}`));
    })().catch((error: unknown) => cancelRender(error instanceof Error ? error : new Error(String(error))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** If the code cannot run: her photo for this slide and its texts, plainly. */
function PlainSlide({ props, frame }: { props: ReelProps; frame: Frame }) {
  const carousel = props.carousel!;
  const photo = carousel.photos[Math.min(carousel.slide, carousel.photos.length - 1)];
  const texts = Object.entries(carousel.texts)
    .filter(([name, text]) => text.trim() && carousel.slotSlides?.[name] === carousel.slide + 1)
    .map(([, text]) => text);
  const k = props.width / 1080;
  return (
    <AbsoluteFill style={{ backgroundColor: frame.light }}>
      {photo ? <RetouchPhoto src={photo.src} edit={photo.edit} grade={frame.grade} /> : null}
      {texts.length ? (
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: 80 * k, gap: 18 * k, background: photo ? "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)" : undefined }}>
          {texts.map((text, i) => (
            <div key={i} style={{ color: photo ? "#FFFFFF" : "#1C1530", fontFamily: `"${props.brand.displayFont}", sans-serif`, fontWeight: i === 0 ? 800 : 500, fontSize: (i === 0 ? 64 : 38) * k, lineHeight: 1.2, whiteSpace: "pre-line" }}>
              {text}
            </div>
          ))}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

export function CarouselDesign({ props, theme }: { props: ReelProps; theme: Theme }) {
  const carousel = props.carousel!;
  const root = useRef<HTMLDivElement>(null);
  const Generated = useMemo(() => compileComponent<CarouselComponent>(carousel.js, "Carousel", CAROUSEL_SCOPE), [carousel.js]);
  const frame: Frame = {
    slide: carousel.slide,
    count: carousel.count,
    width: props.width,
    height: props.height,
    grade: theme.grade,
    photos: carousel.photos,
    check: Boolean(carousel.check),
    light: props.brand.palette?.light ?? "#EFEAE4",
  };
  useSettled(root, props);
  const [failedEarly] = useState(() => {
    if (!Generated && carousel.check) cancelRender(new Error("fonction Carousel introuvable dans le code"));
    return !Generated;
  });
  const plain = <PlainSlide props={props} frame={frame} />;
  return (
    <CarouselContext.Provider value={frame}>
      <AbsoluteFill ref={root} data-fauve-carousel="" style={{ backgroundColor: "#FFFFFF", overflow: "hidden" }}>
        {failedEarly || !Generated ? (
          plain
        ) : (
          <Fallback
            fallback={plain}
            onError={(error) => carousel.check && cancelRender(new Error(`diapositive ${carousel.slide + 1} : erreur dans le code : ${error instanceof Error ? error.message : String(error)}`))}
          >
            <Generated
              slide={carousel.slide}
              count={carousel.count}
              width={props.width}
              height={props.height}
              brand={{ ...props.brand, ink: "#1C1530", cream: "#FBF7F4" }}
              texts={carousel.texts}
              photos={carousel.photos}
            />
          </Fallback>
        )}
      </AbsoluteFill>
    </CarouselContext.Provider>
  );
}
