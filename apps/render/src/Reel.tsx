import { useId, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CarouselDesign } from "./Carousel";
import { COLLAGE_OVERLAP, COLLAGE_SERIF, CollageBackdrop, CollageBand, CollageCaption, CollageCard, CollageEndCard, CollageHook, CollageMessage, Grain, printSize, stickerTop, type Sticker } from "./Collage";
import { FilmDust } from "./FilmDust";
import { Fit } from "./Fit";
import { loadCustomFonts, loadFonts } from "./fonts";
import { MotionScene } from "./MotionScene";
import { Backdrop, SceneView } from "./Scene";
import { ClipBlurLayer, cssFilter, ExposureFilters, Photo } from "./Retouch";
import { Elements } from "./Elements";
import { TextLayer } from "./TextLayer";
import { TEXT_Y, themeFor, type Theme } from "./theme";
import { cameraMotion, faceFocus, framingPercent, punchScale, straightening, type FaceZone } from "./track";
import type { CameraMove, ReelProps, ReelUnder, TextLook } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Safe zones: Instagram and TikTok cover the bottom quarter and the right edge. */
// Same margin on both sides, so centred texts sit on the frame's centre line; 140 px keeps
// them clear of Instagram's buttons on the right.
const SAFE = { left: 140, right: 140 };

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** A word of a text is stressed when the plan names it, or names a part of it (« 3 » in « 3 cours », held together on one line). */
const stressedIn = (emphasis: Set<string>, word: string) =>
  emphasis.has(normalize(word)) || word.split(/[\u00a0\u202f]/).some((part) => normalize(part).length > 0 && emphasis.has(normalize(part)));

/** Where a text breaks into words: any space but the non-breaking ones, which hold a business's name together. */
const SPACES = /[^\S\u00a0\u202f]+/;

export function Reel(props: ReelProps) {
  // The Reel's rhythm (its tempo; an older Reel: its ambiance), set the business's way (its titles, key words, boxes and light).
  const theme = themeFor(props.template, props.brand.signature, props.tempo);
  // The studio's own fonts first, so their families are not asked of Google.
  loadCustomFonts(props.brand.customFonts);
  if (props.carousel) {
    // A designed carousel draws the whole slide itself, in every weight of its fonts.
    loadFonts([props.brand.displayFont, props.brand.bodyFont, ...props.carousel.fonts], { wide: true });
    return (
      <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
        <ExposureFilters />
        <CarouselDesign props={props} theme={theme} />
      </AbsoluteFill>
    );
  }
  const collage = props.template === "collage";
  loadFonts([
    ...(collage ? [COLLAGE_SERIF] : []),
    props.brand.displayFont,
    props.brand.bodyFont,
    ...props.texts.flatMap((t) => [t.look, t.detail_look].flatMap((l) => (l ? [l.font, ...(l.emphasis?.font ? [l.emphasis.font] : [])] : []))),
    ...(props.layer?.fonts ?? []),
    ...(props.elements ?? []).flatMap((e) => e.fonts),
    // The fonts an animation brings for itself (a universe she names, the Reel she copies).
    ...props.segments.flatMap((s) => (s.type === "motion" ? (s.fonts ?? []) : [])),
    ...(props.layers ?? []).flatMap((l) => l.fonts ?? []),
  ]);
  const k = props.width / 1080;
  // A free collage, or another composed Reel (a split screen…): its composition lays the shots (the fixed prints,
  // or the plain montage, only if its code cannot run).
  const compose = props.layers?.find((l) => l.compose);
  // One that draws the whole picture (Tristan: « tout ça n'est pas assez libre ») has its own ground, texts and end:
  // the engine's paper, texts and end card only play in its fallback. Another composition always does.
  const whole = Boolean(compose?.drawsTexts) || Boolean(compose && !collage);
  const isShot = (segment: ReelProps["segments"][number]) => segment.type === "clip" || segment.type === "image";
  // A collage's print of a shot: a card that stays a little under the next one sliding over it.
  const print = (segment: ReelProps["segments"][number], i: number, from = 0) =>
    segment.type === "clip" || segment.type === "image" ? (
      <Sequence key={i} from={segment.startAt - from} durationInFrames={Math.min(segment.durationInFrames + COLLAGE_OVERLAP, props.durationInFrames - segment.startAt)} layout="none">
        {/* Over the opening shot, its sticker is drawn above the texts (the hook behind the subject), back in its card for the overlap. */}
        <CollageCard index={i} props={props} sticker={stickerOf(segment, theme)} layer={hookBehind(props, i) ? "print" : "all"} stickerFrom={segment.durationInFrames}>
          {segment.type === "clip" ? <Shot segment={segment} theme={theme} /> : <Photo src={segment.src} edit={segment.edit} grade={theme.grade} frame={printSize(props)} />}
        </CollageCard>
      </Sequence>
    ) : null;

  // The Reel's texts as the engine draws them (a collage subject in front of its hook between them).
  const engineTexts = (
    <>
      {props.texts.map((t, i) =>
        underStickers(props, t) ? (
          <Sequence key={`t${i}`} from={t.from} durationInFrames={t.durationInFrames} layout="none">
            <TextBeat text={t} index={i} props={props} theme={theme} k={k} />
          </Sequence>
        ) : null,
      )}
      {/* A collage subject in front of its hook: the words go behind the person, as if cut out with them. */}
      {props.segments.map((segment, i) =>
        hookBehind(props, i) && segment.type === "image" ? (
          <Sequence key={`k${i}`} from={segment.startAt} durationInFrames={segment.durationInFrames} layout="none">
            <CollageCard index={i} props={props} sticker={stickerOf(segment, theme)} layer="sticker" />
          </Sequence>
        ) : null,
      )}
      {props.texts.map((t, i) =>
        underStickers(props, t) ? null : (
          <Sequence key={`t${i}`} from={t.from} durationInFrames={t.durationInFrames} layout="none">
            <TextBeat text={t} index={i} props={props} theme={theme} k={k} />
          </Sequence>
        ),
      )}
    </>
  );
  // A shot or a scene of the plain montage, one after the other.
  const montaged = (segment: ReelProps["segments"][number], i: number) => (
    <Sequence key={i} from={segment.startAt} durationInFrames={segment.durationInFrames} layout="none">
      <FadeIn frames={i > 0 && !collage ? props.fadeFrames : 0}>
        {segment.type === "clip" || segment.type === "image" ? (
          <Accent kind={segment.accent} color={props.brand.accent}>
            {segment.type === "clip" ? (
              <Shot segment={segment} theme={theme} />
            ) : (
              <KenBurns on={Boolean(segment.zoom)} move={segment.move} index={i} durationInFrames={segment.durationInFrames} theme={theme}>
                <Photo src={segment.src} edit={segment.edit} grade={theme.grade} />
              </KenBurns>
            )}
            <Legibility theme={theme} />
          </Accent>
        ) : (
          // Animations play over her footage (the passage the plan names), else on the studio's colours.
          <AbsoluteFill>
            {segment.under ? (
              <Under under={segment.under} durationInFrames={segment.durationInFrames} theme={theme} />
            ) : segment.type === "motion" ? (
              // No footage to play over: the studio's colours (new scenes are transparent).
              <Backdrop background={segment.fallback.background} props={props} k={k} />
            ) : null}
            {segment.type === "motion" ? (
              <MotionScene
                js={segment.js}
                texts={segment.texts ?? {}}
                fallback={segment.fallback}
                durationInFrames={segment.durationInFrames}
                props={props}
                theme={theme}
                k={k}
                overlay={Boolean(segment.under)}
                shift={segment.shift}
                photos={segment.photos}
                track={segment.track}
              />
            ) : (
              <SceneView scene={segment.scene} durationInFrames={segment.durationInFrames} props={props} theme={theme} k={k} overlay={Boolean(segment.under)} />
            )}
          </AbsoluteFill>
        )}
      </FadeIn>
    </Sequence>
  );
  const endCard = props.endCard ? (
    <Sequence from={props.endCard.from} layout="none">
      {collage ? <CollageEndCard props={props} k={k} /> : <EndCard props={props} k={k} />}
    </Sequence>
  ) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ExposureFilters />
      {collage && !whole ? <CollageBackdrop props={props} /> : null}
      {compose ? (
        <Sequence from={compose.from} durationInFrames={compose.durationInFrames} layout="none">
          <MotionScene
            js={compose.js}
            texts={compose.texts}
            durationInFrames={compose.durationInFrames}
            props={props}
            theme={theme}
            k={k}
            overlay
            photos={compose.photos}
            cuts={compose.cuts}
            footage={{ shots: compose.shots ?? [], draw: (shot, size) => drawShot(props.segments[shot.segment], theme, size, shot.face) }}
            reelTexts={compose.reelTexts}
            end={compose.end}
            fallbackNode={
              !collage ? (
                // The plain montage: her shots full frame, the Reel's texts and end card.
                <>
                  {props.segments.map((segment, i) => (isShot(segment) ? montaged(segment, i) : null))}
                  {engineTexts}
                  {endCard}
                </>
              ) : whole ? (
                // The fixed collage in full: its paper, its prints, the Reel's texts and end card on paper.
                <>
                  <CollageBackdrop props={props} />
                  {props.segments.map((segment, i) => print(segment, i, compose.from))}
                  {engineTexts}
                  {endCard}
                  <Grain props={props} />
                </>
              ) : (
                <>{props.segments.map((segment, i) => print(segment, i, compose.from))}</>
              )
            }
          />
        </Sequence>
      ) : null}
      {props.segments.map((segment, i) =>
        // A composed Reel's shots are laid by its composition; a collage's, else each one a print.
        isShot(segment) && compose ? null : collage && isShot(segment) ? print(segment, i) : montaged(segment, i),
      )}
      {/* Animations over several shots (a character on every shot, a counter that runs…), above the montage, under its texts. */}
      {(props.layers ?? []).map((layer, i) =>
        layer.compose ? null : (
          <Sequence key={`l${i}`} from={layer.from} durationInFrames={layer.durationInFrames} layout="none">
            <MotionScene
              js={layer.js}
              texts={layer.texts}
              durationInFrames={layer.durationInFrames}
              props={props}
              theme={theme}
              k={k}
              overlay
              photos={layer.photos}
              cuts={layer.cuts}
              track={layer.track}
            />
          </Sequence>
        ),
      )}
      {props.effect === "dust" ? <FilmDust k={k} /> : null}

      {whole ? null : engineTexts}

      {props.words.length > 0 && <Subtitles props={props} theme={theme} k={k} />}
      {props.layer ? <TextLayer props={props} /> : null}
      {props.elements?.length ? <Elements props={props} /> : null}
      <Logo props={props} k={k} />

      {whole ? null : endCard}
      {collage && !whole ? <Grain props={props} /> : null}
      {props.soundtrack?.src ? <Audio src={props.soundtrack.src} volume={(f) => musicVolume(props.soundtrack!, f)} /> : null}
      {props.voice?.src ? (
        // A voice that starts before the Reel (negative from): its silence before the first word is cut.
        <Sequence from={Math.max(0, props.voice.from)} layout="none">
          <Audio src={props.voice.src} trimBefore={Math.max(0, -props.voice.from)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

/** One of her shots in a box of that size, as the Reel draws it (its retouch, its camera move, its light), its faces whole: for a composition. */
function drawShot(segment: ReelProps["segments"][number] | undefined, theme: Theme, size: { width: number; height: number }, face?: FaceZone): ReactNode {
  if (segment?.type === "clip") return <Shot segment={segment} theme={theme} frame={size} face={face} />;
  if (segment?.type === "image") return <Photo src={segment.src} edit={segment.edit} grade={theme.grade} frame={size} />;
  return null;
}

/** A collage photo's sticker: its cut-out with the photo's framing and the Reel's light (none without a clean cut-out). */
function stickerOf(segment: ReelProps["segments"][number], theme: Theme): Sticker | undefined {
  return segment.type === "image" && segment.cutout && segment.edit ? { src: segment.cutout.src, box: segment.cutout.box, edit: segment.edit, grade: theme.grade } : undefined;
}

/** The hooks that may pass behind a sticker: plain words (a styled or composed text stays in front). */
const plainHook = (t: ReelProps["texts"][number]) => t.style === "hook" && !t.look && !t.items?.length;

/**
 * A collage hook that passes behind a sticker's subject: only when the subject rises into
 * its words from below, like a magazine cover (the head over the bottom of the line). A
 * subject standing over the whole line would hide it: then the words stay in front.
 */
function behindSubject(props: ReelProps, sticker: Pick<Sticker, "box" | "edit">, text: ReelProps["texts"][number]): boolean {
  const top = props.height * (text.y ?? 0.08);
  return stickerTop(props, sticker) > top + props.height * 0.24 * (text.scale ?? 1) * 0.6;
}

/** A collage shot whose sticker stands in front of the hook (its words behind the subject): a photo with its cut-out while such a hook shows. */
function hookBehind(props: ReelProps, i: number): boolean {
  const segment = props.segments[i];
  // A composed collage lays its own subjects (and its fallback prints keep their stickers in their cards).
  if (props.layers?.some((l) => l.compose)) return false;
  if (props.template !== "collage" || !segment || segment.type !== "image" || !segment.cutout || !segment.edit) return false;
  const sticker = { box: segment.cutout.box, edit: segment.edit };
  const end = segment.startAt + segment.durationInFrames;
  return props.texts.some((t) => plainHook(t) && t.from < end && t.from + t.durationInFrames > segment.startAt && behindSubject(props, sticker, t));
}

/** A text drawn under the stickers that stand in front of the hook (every other text stays above them). */
function underStickers(props: ReelProps, t: ReelProps["texts"][number]): boolean {
  return (
    plainHook(t) &&
    props.segments.some((s, i) => hookBehind(props, i) && t.from < s.startAt + s.durationInFrames && t.from + t.durationInFrames > s.startAt)
  );
}

/**
 * The music's volume at a frame of the live preview (the render mixes it afterwards,
 * measured): its level, and the lower one while someone speaks, reached in 3 frames
 * and left over 15, like the render's ducking.
 */
function musicVolume(track: NonNullable<ReelProps["soundtrack"]>, frame: number): number {
  const volume = track.volume ?? 1;
  if (!track.duck) return volume;
  let ducked = 0;
  for (const [from, to] of track.duck.windows) {
    if (frame < from - 3 || frame > to + 15) continue;
    ducked = Math.max(ducked, frame < from ? (frame - from + 3) / 3 : frame > to ? 1 - (frame - to) / 15 : 1);
  }
  return volume + (track.duck.volume - volume) * ducked;
}

/**
 * The Reel's one signature transition into a shot, kept sober: « punch », a short
 * zoom that settles (8 frames, no bounce); « wipe », a band in the brand colour that
 * sweeps across the new shot (12 frames), never a frame of colour alone. Anything else
 * is a clean cut.
 */
function Accent({ kind, color, children }: { kind?: "punch" | "wipe"; color: string; children: ReactNode }) {
  const frame = useCurrentFrame();
  if (kind === "punch") {
    return <AbsoluteFill style={{ transform: `scale(${punchScale(frame)})` }}>{children}</AbsoluteFill>;
  }
  if (kind === "wipe") {
    // A band a third of the frame wide, from the right edge out past the left one.
    const x = interpolate(frame, [0, 12], [100, -36], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    return (
      <AbsoluteFill>
        {children}
        {frame < 13 ? <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: "36%", backgroundColor: color }} /> : null}
      </AbsoluteFill>
    );
  }
  return <>{children}</>;
}

function FadeIn({ frames, children }: { frames: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: frames ? interpolate(frame, [0, frames], [0, 1], clamp) : 1 }}>{children}</AbsoluteFill>;
}

/**
 * Soft gradients keep white text readable on any footage (the hook's upper third, the
 * lines lower down), and darker corners give the picture depth.
 */
function Legibility({ theme }: { theme: Theme }) {
  return (
    <>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.2) 26%, rgba(0,0,0,0.06) 46%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.1) 72%, rgba(0,0,0,0.3) 100%)",
        }}
      />
      {theme.vignette ? <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${theme.vignette}) 100%)` }} /> : null}
    </>
  );
}

/**
 * The camera's move over a shot, like an editor adds it to a still shot: a slow push-in
 * or pull-out, a slow pan, or a tighter crop held (a jump cut on the beat).
 */
function cameraTransform(move: CameraMove, frame: number, durationInFrames: number, theme: Theme): string | undefined {
  // The same move places what is tracked in the footage (track.ts): a word on a fingertip stays on it.
  const motion = cameraMotion(move, frame, durationInFrames, theme);
  if (!motion) return undefined;
  return motion.shift !== undefined ? `scale(${motion.scale}) translateX(${motion.shift}%)` : `scale(${motion.scale})`;
}

/** A photo in a Reel: the move the editor chose, else a slow zoom with a slight drift, one way then the other from a photo to the next. */
function KenBurns({
  on,
  move,
  index,
  durationInFrames,
  theme,
  children,
}: {
  on: boolean;
  move?: CameraMove;
  index: number;
  durationInFrames: number;
  theme: Theme;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  if (move && move !== "none") return <AbsoluteFill style={{ transform: cameraTransform(move, frame, durationInFrames, theme) }}>{children}</AbsoluteFill>;
  if (!on) return <>{children}</>;
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const zoomIn = index % 2 === 0;
  const scale = zoomIn ? 1.04 + 0.12 * p : 1.16 - 0.12 * p;
  const drift = (index % 4 < 2 ? 1 : -1) * 1.6 * p;
  return <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${drift}%)` }}>{children}</AbsoluteFill>;
}

type ClipSegment = Extract<ReelProps["segments"][number], { type: "clip" }>;

/**
 * Where to anchor a wider clip in the vertical crop so its subject (focus, shares of
 * the picture) stays in view: object-position puts that share of the overflow on the left.
 */
function framing(focus: { x: number; y: number } | undefined, aspect: number | undefined, frameAspect: number): string | undefined {
  const at = framingPercent(focus, aspect, frameAspect);
  return at ? `${at[0]}% ${at[1]}%` : undefined;
}

/** A tilted picture rotated straight, enlarged just enough that no corner shows. */
function straighten(degrees: number | undefined, frameAspect: number): string | undefined {
  const straight = straightening(degrees, frameAspect);
  return straight ? `rotate(${straight.degrees}deg) scale(${straight.scale.toFixed(4)})` : undefined;
}

/** A clip as filmed and retouched, covering the frame, or the box it is drawn in (`frame`: a collage's composition). */
function Shot({ segment, theme, frame: box, face }: { segment: ClipSegment; theme: Theme; frame?: { width: number; height: number }; face?: FaceZone }) {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const { width, height } = box ?? video;
  const move = segment.move ?? (segment.zoom ? "in" : "none");
  const frameAspect = width / height;
  const focus = faceFocus(segment.adjust?.focus, face, segment.aspect, frameAspect);
  return (
    <AbsoluteFill style={{ transform: cameraTransform(move, frame, segment.durationInFrames, theme) }}>
      <AbsoluteFill style={{ transform: straighten(segment.adjust?.straighten, frameAspect) }}>
        <OffthreadVideo
          src={segment.src}
          trimBefore={segment.startFrom}
          playbackRate={segment.speed ?? 1}
          // Only the passages where someone speaks keep their sound; the rest is under the music.
          muted={!segment.speech}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: framing(focus, segment.aspect, frameAspect),
            filter: [theme.grade, cssFilter(segment.adjust)].filter(Boolean).join(" ") || undefined,
          }}
        />
        {segment.blur?.tracks.length ? (
          <ClipBlurLayer blur={segment.blur} startFrom={segment.startFrom} focus={focus} speed={segment.speed} size={box} />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * Her footage under an animation: the passage keeps playing with a slow push-in, as filmed. No veil: what the
 * animation lays over it, and how much of it shows, is the motion designer's (a fixed scene brings its own scrim).
 */
function Under({ under, durationInFrames, theme }: { under: ReelUnder; durationInFrames: number; theme: Theme }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: cameraTransform("in", frame, durationInFrames, theme) }}>
        {under.type === "clip" ? (
          <OffthreadVideo
            src={under.src}
            trimBefore={under.startFrom}
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: framing(under.adjust?.focus, under.aspect, width / height),
              filter: [theme.grade, cssFilter(under.adjust)].filter(Boolean).join(" ") || undefined,
            }}
          />
        ) : (
          <Photo src={under.src} edit={under.edit} grade={theme.grade} />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function useExit(durationInFrames: number, theme: Theme) {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [durationInFrames - theme.exitFrames, durationInFrames], [1, 0], clamp);
  return { opacity: out, translate: (1 - out) * -12 };
}

/** A dark rounded background behind a text, set by hand to read it on a busy image. */
function backdrop(text: ReelProps["texts"][number], k: number): CSSProperties {
  return text.backdrop
    ? { background: "rgba(20,14,36,0.62)", borderRadius: 18 * k, padding: `${14 * k}px ${24 * k}px`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
    : {};
}

/**
 * Left and right edges of a text's box: the safe margins, or narrower around a
 * centre moved by hand (`x`), so the text stays inside the safe zone.
 */
function sides(text: ReelProps["texts"][number], props: ReelProps, k: number): { left: number; right: number } {
  // A feed photo (4:5) has no app buttons over it: narrower margins than a Reel's.
  const still = props.height / props.width < 1.5;
  const left = (still ? 72 : SAFE.left) * k;
  const right = (still ? 72 : SAFE.right) * k;
  if (text.x === undefined) return { left, right };
  const centre = text.x * props.width;
  const half = Math.max(80 * k, Math.min(centre - left, props.width - right - centre));
  return { left: centre - half, right: props.width - centre - half };
}

function TextBeat({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  // Remount when edited, so the fit is measured again (scene editor).
  const key = `${text.text}|${text.style}|${text.scale ?? 1}|${text.x ?? ""}|${text.backdrop ?? false}|${text.look ? JSON.stringify(text.look) : ""}`;
  // A key message with its details (« Don't miss it ! », « OFFRE DE RENTRÉE », the codes): composed on three levels.
  // A message held on screen (title, subtitle, details): the hook of a key message, or any text of a Reel with items.
  if ((text.style === "hook" || text.message) && text.items?.length && !text.look) {
    // A collage sets every word on paper: the message too, which reads on its light paper and prints.
    if (props.template === "collage") return <CollageMessage key={`${key}|${JSON.stringify(text.items)}`} text={text} index={index} props={props} theme={theme} k={k} sides={sides(text, props, k)} />;
    return <KeyMessage key={`${key}|${JSON.stringify(text.items)}`} text={text} index={index} props={props} theme={theme} k={k} />;
  }
  if (text.look || text.items) return <LookText key={`${key}|${JSON.stringify([text.items, text.detail_look, text.bullet])}`} text={text} index={index} props={props} theme={theme} k={k} />;
  if (props.template === "collage") {
    const C = text.style === "hook" ? CollageHook : text.style === "band" ? CollageBand : CollageCaption;
    return <C key={key} text={text} index={index} props={props} theme={theme} k={k} sides={sides(text, props, k)} />;
  }
  if (text.style === "hook") return <Hook key={key} text={text} index={index} props={props} theme={theme} k={k} />;
  // While a voice speaks, its subtitles are the bare line: any other line goes in the apps' white box, to read on any wall.
  if (text.style === "band" || (props.words.length && !text.backdrop)) return <Band key={key} text={text} index={index} props={props} theme={theme} k={k} />;
  return <Caption key={key} text={text} index={index} props={props} theme={theme} k={k} />;
}

/** A soft double shadow: white type reads on any footage without looking like a sticker. */
const TEXT_SHADOW = "0 2px 6px rgba(0,0,0,0.22), 0 10px 36px rgba(0,0,0,0.42)";
/** A line set bare over footage: a tighter shadow under the letters, so it reads on a bright wall too. */
const LINE_SHADOW = "0 1px 3px rgba(0,0,0,0.45), 0 3px 14px rgba(0,0,0,0.45), 0 10px 34px rgba(0,0,0,0.3)";

const hexRgb = (hex: string): [number, number, number] | null => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbLuminance = ([r, g, b]: [number, number, number]) => {
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const rgbHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * Over footage, the luminance a brand colour needs to read against the dark shadow under the
 * letters: 3:1, the bar for large bold type. At 0.3, a pizzeria's deep red (#C8102E) was lifted
 * to a pale pink that no longer looked like its brand; a navy or a burgundy is still lifted.
 */
const FOOTAGE_LUMINANCE = 0.1;

/**
 * The brand colour as it reads where it is set: over footage a dark colour is lifted toward
 * white (same hue) until the word stands out; on a white box a pale one is taken down toward ink.
 */
function legible(hex: string, on: "footage" | "white"): string {
  let c = hexRgb(hex);
  if (!c) return hex;
  for (let i = 0; i < 8; i++) {
    const l = rgbLuminance(c);
    if (on === "footage" ? l >= FOOTAGE_LUMINANCE : l <= 0.3) break;
    c = c.map((v) => (on === "footage" ? v + (255 - v) * 0.2 : v * 0.8)) as [number, number, number];
  }
  return rgbHex(c);
}

/**
 * A key word circled by hand, like the strokes on a business's site: an open loop drawn
 * around the word in a few frames, its end running past its start; a long group gets a
 * scribbled underline instead.
 */
function Marker({ color, from, long, children }: { color: string; from: number; long: boolean; children: ReactNode }) {
  const frame = useCurrentFrame();
  const clip = useId();
  // Drawn by uncovering the stroke from left to right (a dash animation does not survive the non-scaling stroke).
  const drawn = interpolate(frame, [from, from + (long ? 10 : 13)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const stroke = { fill: "none", stroke: color, strokeWidth: long ? 7 : 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, vectorEffect: "non-scaling-stroke" as const };
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      <svg
        viewBox="0 0 200 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={
          long
            ? { position: "absolute", left: "-2%", width: "104%", top: "88%", height: "26%", overflow: "visible" }
            : { position: "absolute", left: "-9%", width: "118%", top: "-4%", height: "112%", overflow: "visible" }
        }
      >
        <defs>
          <clipPath id={clip}>
            <rect x={-20} y={-20} width={240 * drawn} height={140} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {long ? (
            <path d="M 4 40 C 50 22, 120 30, 196 18 M 30 70 C 80 52, 140 58, 180 50" {...stroke} />
          ) : (
            <path d="M 28 20 C 78 0, 168 4, 193 38 C 207 68, 152 98, 94 96 C 36 94, 4 78, 7 50 C 10 26, 52 10, 118 9" {...stroke} />
          )}
        </g>
      </svg>
    </span>
  );
}

/** A key message's title this short stays on one line (« Don't miss it ! »). */
const KEY_TITLE_ONE_LINE = 12;

/** Frames of its entrance a hook that opens the Reel has already played on the first frame. */
const HOOK_LEAD = 4;

/** A key message's letter spacing (em) for each choice of its charter. */
const KEY_SPACING = {
  tight: { title: -0.035, subtitle: -0.01, details: -0.01 },
  normal: { title: -0.01, subtitle: 0, details: 0 },
  wide: { title: 0.02, subtitle: 0.05, details: 0.01 },
} as const;

/** How colourful a colour is (0 grey, 1 pure): a light brand colour worth showing on a title. */
const chroma = ([r, g, b]: [number, number, number]) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));

/**
 * One key message held over the Reel, composed like a creator's (« Don't miss it ! », then
 * « OFFRE DE RENTRÉE », then its details): the title very big and heavy in the display font,
 * in the brand's light colour when it has one; a subtitle in bold capitals; the details small
 * and regular; aligned the business's way. Each level enters after the other, then stays put.
 */
function KeyMessage({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const h = theme.hook;
  const left = h.align === "left";
  const size = h.size * k * (text.scale ?? 1);
  const body = `"${MONOSPACE.test(props.brand.bodyFont) ? props.brand.displayFont : props.brand.bodyFont}", sans-serif`;
  // The spacing of its letters is the business's choice (its charter's titles: tight, normal, wide).
  const spacing = KEY_SPACING[props.brand.signature?.titles.tracking ?? "normal"];
  const emphasis = new Set(text.emphasis.flatMap((e) => e.split(SPACES)).map(normalize));
  const light = props.brand.palette?.light ? hexRgb(props.brand.palette.light) : null;
  const titleColor = light && rgbLuminance(light) > 0.55 && chroma(light) > 0.08 ? props.brand.palette!.light! : "#fff";
  const [first, ...rest] = text.items!;
  const details = [first!.detail, ...rest.flatMap((item) => [item.title, item.detail])].filter((d): d is string => Boolean(d?.trim()));
  const lead = text.from === 0 ? HOOK_LEAD : 0;
  const enter = (i: number): CSSProperties => {
    const p = spring({ frame: frame + lead - i * 5, fps, config: theme.spring });
    return { opacity: interpolate(p, [0, 0.5], [0, 1], clamp), transform: `translateY(${interpolate(p, [0, 1], [18 * k, 0])}px)` };
  };
  const box: CSSProperties = {
    position: "absolute",
    top: props.height * (text.y ?? 0.46),
    height: props.height * 0.34,
    ...sides(text, props, k),
    opacity: exit.opacity,
    transform: `translateY(${exit.translate * k}px)`,
  };
  return (
    <Fit style={box} innerStyle={{ alignItems: left ? "flex-start" : "center", textAlign: left ? "left" : "center", justifyContent: "flex-start" }} marker={String(index)}>
      {/* Bare over the footage for most of the Reel: the tight shadow that reads on a bright wall too (a light lilac title on a white studio). */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: left ? "flex-start" : "center", textShadow: LINE_SHADOW }}>
        <span
          style={{
            fontFamily: `"${props.brand.displayFont}", sans-serif`,
            fontWeight: Math.max(800, h.weight),
            fontSize: size * 1.05,
            lineHeight: 0.98,
            // A very short title holds on one line; a longer one breaks into even lines rather than shrink the whole message.
            ...(text.text.length <= KEY_TITLE_ONE_LINE ? { whiteSpace: "nowrap" as const } : { textWrap: "balance" as const }),
            letterSpacing: h.uppercase ? h.letterSpacing * k : `${spacing.title}em`,
            textTransform: h.uppercase ? "uppercase" : "none",
            color: titleColor,
            ...enter(0),
          }}
        >
          {text.text.split(SPACES).filter(Boolean).map((word, i) => (
            <span key={i} style={stressedIn(emphasis, word) ? { color: legible(props.brand.accent, "footage") } : undefined}>
              {i ? " " : ""}
              {word}
            </span>
          ))}
        </span>
        <span style={{ fontFamily: body, fontWeight: 800, fontSize: size * 0.46, letterSpacing: `${spacing.subtitle}em`, textTransform: "uppercase", color: "#fff", marginTop: size * 0.22, textWrap: "balance", ...enter(1) }}>
          {first!.title}
        </span>
        {details.map((line, i) => (
          <span key={i} style={{ fontFamily: body, fontWeight: 500, fontSize: size * 0.27, lineHeight: 1.3, letterSpacing: `${spacing.details}em`, color: "#fff", marginTop: i ? 0 : size * 0.08, textWrap: "balance", ...enter(2 + i) }}>
            {line}
          </span>
        ))}
      </div>
    </Fit>
  );
}

/** The text that carries a marker signature's stroke: the first hook with a key word. */
const markedHook = (props: ReelProps) => props.texts.findIndex((t) => t.style === "hook" && t.emphasis.length > 0);

function Hook({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const emphasis = new Set(text.emphasis.flatMap((e) => e.split(SPACES)).map(normalize));
  // The stroke drawn by hand is the brand's gesture, once in a Reel: on its first hook with a key word; a later one takes its colour.
  const h = theme.hook.stress === "marker" && index !== markedHook(props) ? { ...theme.hook, stress: "color" as const } : theme.hook;
  const words = text.text.split(SPACES).filter(Boolean);
  // Opening the Reel, its entrance is already under way on the first frame: the feed shows it at once.
  const lead = text.from === 0 ? HOOK_LEAD : 0;

  // The hook sits in the upper third, big, where the eye lands first; a long one shrinks to its box.
  const box: CSSProperties = {
    position: "absolute",
    top: props.height * (text.y ?? TEXT_Y.hook),
    height: props.height * 0.27 * (text.scale ?? 1),
    ...sides(text, props, k),
    opacity: exit.opacity,
    transform: `translateY(${exit.translate * k}px)`,
  };
  const left = h.align === "left";
  const style: CSSProperties = {
    display: "block",
    ...(left ? { alignItems: "flex-start", textAlign: "left" } : {}),
    fontFamily: `"${h.family === "display" || MONOSPACE.test(props.brand.bodyFont) ? props.brand.displayFont : props.brand.bodyFont}", sans-serif`,
    fontWeight: h.weight,
    fontStyle: h.italic ? "italic" : "normal",
    fontSize: h.size * k * (text.scale ?? 1),
    lineHeight: h.lineHeight,
    letterSpacing: h.letterSpacing * k,
    textTransform: h.uppercase ? "uppercase" : "none",
    color: "#fff",
    textShadow: text.backdrop ? "none" : TEXT_SHADOW,
    // Lines of even length: never one word left alone at the top or the end.
    textWrap: "balance",
  };
  // A stressed word: on a box in the brand colour (like a creator highlights it), in italic, or in the brand colour.
  const stressed = (word: string): CSSProperties | undefined => {
    if (!stressedIn(emphasis, word)) return undefined;
    if (h.stress === "box") return { background: props.brand.accent, color: props.brand.accentInk, borderRadius: 12 * k, padding: `0 ${14 * k}px`, textShadow: "none" };
    if (h.stress === "italic") return { fontStyle: "italic" };
    // A serif accent in a sans hook: the display font's italic, a touch larger (serif faces run small).
    if (h.stress === "serif") return { fontFamily: `"${props.brand.displayFont}", serif`, fontStyle: "italic", fontWeight: 400, fontSize: "1.12em", letterSpacing: 0 };
    // Circled by hand: the word keeps its colour, the stroke is drawn around it (Marker).
    if (h.stress === "marker") return { position: "relative" };
    return { color: legible(props.brand.accent, "footage") };
  };

  // Words enter one after the other; stressed words side by side share one block (« cette pâte »), never a chip each.
  const groups: { words: string[]; stress: CSSProperties | undefined }[] = [];
  for (const word of words) {
    const stress = stressed(word);
    const last = groups.at(-1);
    if (last && stress && last.stress) last.words.push(word);
    else groups.push({ words: [word], stress });
  }

  // The dark background, when set, hugs the lines of text, not the whole box.
  return (
    <Fit style={box} innerStyle={style} marker={String(index)}>
      <span style={text.backdrop ? { ...backdrop(text, k), lineHeight: 1.3 } : undefined}>
        {groups.map((group, i) => {
          const p = spring({ frame: frame + lead - i * h.stagger, fps, config: theme.spring });
          const enter: CSSProperties =
            h.enter === "pop"
              ? { transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: interpolate(p, [0, 0.35], [0, 1], clamp) }
              : h.enter === "rise"
                ? { transform: `translateY(${interpolate(p, [0, 1], [26 * k, 0])}px)`, opacity: interpolate(p, [0, 0.6], [0, 1], clamp) }
                : { transform: `translateY(${interpolate(p, [0, 1], [10 * k, 0])}px)`, opacity: p };
          // A strong number stressed in the hook (« 48 h », « 6 ») stands alone on its line, very big, in the brand colour.
          if (group.stress && /^\d/.test(group.words[0]!)) {
            return (
              <span key={i} style={{ display: "block", ...enter }}>
                <span style={{ display: "inline-block", fontSize: "2.1em", lineHeight: 0.92, letterSpacing: "-0.03em", color: legible(props.brand.accent, "footage") }}>{group.words.join(" ")}</span>
              </span>
            );
          }
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre", ...enter }}>
              {group.stress && h.stress === "marker" ? (
                <Marker color={legible(props.brand.accent, "footage")} from={Math.max(0, i * h.stagger + 5 - lead)} long={group.words.join(" ").length > 12}>
                  {group.words.join(" ")}
                </Marker>
              ) : (
                <span style={{ display: "inline-block", ...group.stress }}>{group.words.join(" ")}</span>
              )}
              {i < groups.length - 1 ? " " : ""}
            </span>
          );
        })}
      </span>
    </Fit>
  );
}

/**
 * The statement: the words on a box hugging each line, like the text tool of Instagram or
 * TikTok (white with dark letters, or the brand colour), or an outlined frame for the
 * minimal ambiance. It grows in from slightly smaller, then holds.
 */
function Band({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const b = theme.band;
  const reveal = spring({ frame, fps, config: { damping: 200, stiffness: 170, mass: 0.7 } });
  const emphasis = new Set(text.emphasis.flatMap((e) => e.split(SPACES)).map(normalize));
  const size = b.size * k * (text.scale ?? 1);
  // The box: the apps' white one, or the business's own colours (its accent, its dark, its light).
  const palette = props.brand.palette ?? { secondary: props.brand.accent, light: "#FFFFFF", dark: "#141414" };
  const onBox =
    b.box === "white"
      ? { bg: "#FFFFFF", fg: "#16121F" }
      : b.box === "dark"
        ? { bg: palette.dark, fg: palette.light }
        : b.box === "light"
          ? { bg: palette.light, fg: palette.dark }
          : { bg: props.brand.accent, fg: props.brand.accentInk };
  // A stressed word: in the brand colour (one that reads on its box), never a chip of its own.
  const stress = (word: string): CSSProperties | undefined =>
    !stressedIn(emphasis, word)
      ? undefined
      : b.box === "white" || b.box === "light"
        ? { color: legible(props.brand.accent, "white") }
        : b.box === "dark"
          ? { color: legible(props.brand.accent, "footage") }
          : { textDecoration: "underline", textDecorationThickness: `${3 * k}px`, textUnderlineOffset: `${6 * k}px` };
  const words = text.text.split(SPACES).filter(Boolean);
  const type: CSSProperties = {
    fontFamily: `"${b.family === "display" || MONOSPACE.test(props.brand.bodyFont) ? props.brand.displayFont : props.brand.bodyFont}", sans-serif`,
    fontWeight: b.weight,
    fontSize: size,
    letterSpacing: b.letterSpacing * k,
    textTransform: b.uppercase ? "uppercase" : "none",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: props.height * (text.y ?? TEXT_Y.band),
        ...sides(text, props, k),
        display: "flex",
        justifyContent: "center",
        opacity: Math.min(exit.opacity, interpolate(reveal, [0, 0.4], [0, 1], clamp)),
        transform: `translateY(${exit.translate * k}px) rotate(${b.tilt}deg) scale(${0.9 + 0.1 * reveal})`,
      }}
    >
      {b.box === "outline" ? (
        <div
          data-fauve-text={index}
          style={{
            ...type,
            border: `${2 * k}px solid rgba(255,255,255,0.92)`,
            padding: `${20 * k}px ${40 * k}px`,
            color: "#fff",
            textAlign: "center",
            lineHeight: 1.25,
            background: "rgba(0,0,0,0.16)",
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          {text.text}
        </div>
      ) : (
        <div data-fauve-text={index} style={{ textAlign: "center", lineHeight: 1.42, textWrap: "balance" }}>
          <span
            style={{
              ...type,
              background: onBox.bg,
              color: onBox.fg,
              padding: `${6 * k}px ${22 * k}px`,
              borderRadius: b.radius * k,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {words.map((word, i) => (
              <span key={i}>
                <span style={stress(word)}>{word}</span>
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

/** A typewriter face reads thin in a caption: the display font takes over. */
const MONOSPACE = /mono|code|courier|typewriter/i;

function Caption({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const p = spring({ frame, fps, config: { damping: 200, stiffness: 160 } });
  const font = MONOSPACE.test(props.brand.bodyFont) ? props.brand.displayFont : props.brand.bodyFont;
  // Lively ambiances put the line on a dark box, like the apps' text tool; the calm ones keep it bare, with a soft shadow.
  const boxed = theme.caption.box && !text.backdrop;
  return (
    <div
      data-fauve-text={index}
      style={{
        position: "absolute",
        top: props.height * (text.y ?? (props.words.length ? TEXT_Y.band : TEXT_Y.caption)),
        ...sides(text, props, k),
        textAlign: "center",
        opacity: Math.min(p, exit.opacity),
        transform: `translateY(${(1 - p) * 14 * k + exit.translate * k}px)`,
      }}
    >
      <div style={{ lineHeight: boxed ? 1.42 : 1.2, textWrap: "balance" }}>
        <span
          style={{
            color: "#fff",
            fontFamily: `"${font}", sans-serif`,
            fontWeight: theme.caption.weight,
            fontSize: theme.caption.size * k * (text.scale ?? 1),
            textShadow: text.backdrop || boxed ? "none" : LINE_SHADOW,
            ...(boxed
              ? { background: "rgba(14,12,20,0.74)", padding: `${6 * k}px ${20 * k}px`, borderRadius: 14 * k, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
              : backdrop(text, k)),
          }}
        >
          {text.text}
        </span>
      </div>
    </div>
  );
}

/** A look's colour: hex, or the studio's own. */
function lookColor(color: string, props: ReelProps, alpha = 1): string {
  const hex = color === "accent" ? props.brand.accent : color === "accent_ink" ? props.brand.accentInk : color;
  if (alpha >= 1 || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const lookShadows = (k: number) => ({
  none: "none",
  soft: "0 4px 28px rgba(0,0,0,0.35)",
  strong: "0 2px 10px rgba(0,0,0,0.75)",
  hard: `${5 * k}px ${5 * k}px 0 rgba(0,0,0,0.9)`,
});


/** The look a list without one of its own gets: the template's body font, white, a soft shadow. */
function listFallback(props: ReelProps): TextLook {
  return { font: props.brand.bodyFont, weight: 700, italic: false, uppercase: false, size: 48, letter_spacing: 0, line_height: 1.2, color: "#ffffff", align: "left", shadow: "strong", rotate: 0, enter: "rise" };
}

/** Typography of a look, at the frame's scale. */
function lookType(look: TextLook, props: ReelProps, k: number, scale: number): CSSProperties {
  return {
    fontFamily: `"${look.font}", "${props.brand.bodyFont}", sans-serif`,
    fontWeight: look.weight,
    fontStyle: look.italic ? "italic" : "normal",
    fontSize: look.size * k * scale,
    lineHeight: look.line_height,
    letterSpacing: `${look.letter_spacing}em`,
    textTransform: look.uppercase ? "uppercase" : "none",
    color: lookColor(look.color, props),
    textShadow: lookShadows(k)[look.shadow],
    ...(look.stroke ? { WebkitTextStroke: `${look.stroke.width * k}px ${lookColor(look.stroke.color, props)}`, paintOrder: "stroke fill" } : {}),
  };
}

/** Box and pill: one block behind the whole text. */
function lookBlock(look: TextLook, props: ReelProps, k: number): CSSProperties {
  const fill = look.fill;
  if (!fill || fill.kind === "line") return { display: "inline-block" };
  return {
    display: "inline-block",
    background: lookColor(fill.color, props, fill.opacity),
    borderRadius: fill.kind === "pill" ? 999 : (fill.radius ?? 8) * k,
    padding: fill.kind === "pill" ? `${14 * k}px ${36 * k}px` : `${14 * k}px ${26 * k}px`,
  };
}

/** Line: a highlight that hugs each line of text. */
function lookLine(look: TextLook, props: ReelProps, k: number): CSSProperties | undefined {
  const fill = look.fill;
  if (fill?.kind !== "line") return undefined;
  return {
    background: lookColor(fill.color, props, fill.opacity),
    borderRadius: (fill.radius ?? 6) * k,
    padding: `${2 * k}px ${10 * k}px`,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    lineHeight: look.line_height + 0.22,
  };
}

/** The mark before an item of a list. */
function BulletMark({ bullet, n, size, props }: { bullet: NonNullable<ReelProps["texts"][number]["bullet"]>; n: number; size: number; props: ReelProps }) {
  const color = lookColor(bullet.color, props);
  const box: CSSProperties = { width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" };
  if (bullet.kind === "check" || bullet.kind === "box") {
    return (
      <span style={{ ...box, border: `${Math.max(2, size * 0.09)}px solid ${color}`, boxSizing: "border-box" }}>
        {bullet.kind === "check" ? (
          <svg viewBox="0 0 24 24" width={size * 1.05} height={size * 1.05} style={{ marginTop: -size * 0.28, marginRight: -size * 0.3 }}>
            <path d="M3 13l6 6L22 4" fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    );
  }
  if (bullet.kind === "dot") return <span style={box}><span style={{ width: size * 0.36, height: size * 0.36, borderRadius: 999, background: color }} /></span>;
  if (bullet.kind === "dash") return <span style={box}><span style={{ width: size * 0.6, height: Math.max(2, size * 0.1), background: color }} /></span>;
  return <span style={{ ...box, width: "auto", minWidth: size, color, fontSize: size * 0.9, fontWeight: 700 }}>{bullet.kind === "number" ? `${n + 1}.` : "→"}</span>;
}

/**
 * A text with a look of its own (copied from an example, or set by hand): any
 * Google font, colours, a box, pill or line highlight behind it, an outline, a
 * shadow, a tilt and an entrance; or a list (checklist, planning, steps) with a
 * bullet, a title and a smaller line per item. It shrinks to fit its box.
 */
function LookText({ text, index, props, theme, k }: { text: ReelProps["texts"][number]; index: number; props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(text.durationInFrames, theme);
  const look = text.look ?? listFallback(props);
  const scale = text.scale ?? 1;
  const emphasis = new Set(text.emphasis.flatMap((e) => e.split(SPACES)).map(normalize));
  const top = text.y ?? TEXT_Y[text.style];

  const box: CSSProperties = {
    position: "absolute",
    top: props.height * top,
    height: text.items
      ? props.height * Math.max(0.2, 0.94 - top)
      : props.height * (text.style === "hook" ? 0.3 : 0.2) * Math.max(1, scale),
    ...sides(text, props, k),
    opacity: exit.opacity,
    transform: `translateY(${exit.translate * k}px)`,
  };
  const inner: CSSProperties = {
    justifyContent: "flex-start",
    alignItems: look.align === "left" ? "flex-start" : look.align === "right" ? "flex-end" : "center",
    textAlign: look.align,
  };

  // Entrances play in a video; a still (carousel) is captured once they are over. Opening the Reel, already under way.
  const lead = text.from === 0 ? HOOK_LEAD : 0;
  const enterOf = (i: number): CSSProperties => {
    const p = spring({ frame: frame + lead - i * 3, fps, config: theme.spring });
    if (look.enter === "pop") return { transform: `scale(${interpolate(p, [0, 1], [0.55, 1])})`, opacity: interpolate(p, [0, 0.4], [0, 1], clamp) };
    if (look.enter === "rise") return { transform: `translateY(${interpolate(p, [0, 1], [30 * k, 0])}px)`, opacity: p };
    if (look.enter === "slide") return { transform: `translateX(${interpolate(p, [0, 1], [-40 * k, 0])}px)`, opacity: p };
    if (look.enter === "fade" || look.enter === "typewriter") return { opacity: interpolate(frame + lead, [i * 2, i * 2 + 10], [0, 1], clamp) };
    return {};
  };

  if (text.items) {
    const detail: TextLook = text.detail_look ?? {
      ...look,
      size: look.size * 0.62,
      weight: 400,
      uppercase: false,
      letter_spacing: 0,
      fill: undefined,
      stroke: undefined,
      emphasis: undefined,
    };
    const size = look.size * k * scale;
    return (
      <Fit style={box} innerStyle={inner} marker={String(index)}>
        <div style={{ display: "flex", flexDirection: "column", gap: size * 0.85, alignItems: inner.alignItems, transform: look.rotate ? `rotate(${look.rotate}deg)` : undefined }}>
          {/* In a Reel, its own words head the list (on a photo, they only name it). */}
          {text.message ? (
            <span style={{ ...lookBlock(look, props, k), ...enterOf(0) }}>
              <span style={{ ...lookType(look, props, k, scale * 1.3), ...lookLine(look, props, k) }}>{text.text}</span>
            </span>
          ) : null}
          {text.items.map((item, n) => (
            <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: size * 0.42, textAlign: look.align, ...enterOf(n * 2) }}>
              {text.bullet ? <BulletMark bullet={text.bullet} n={n} size={size * 0.95} props={props} /> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: size * 0.22, alignItems: inner.alignItems }}>
                <span style={lookBlock(look, props, k)}>
                  <span style={{ ...lookType(look, props, k, scale), ...lookLine(look, props, k) }}>{item.title}</span>
                </span>
                {item.detail ? (
                  <span style={{ ...lookType(detail, props, k, scale), ...lookLine(detail, props, k) }}>{item.detail}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Fit>
    );
  }

  const words = text.text.split(SPACES).filter(Boolean);
  const typed = look.enter === "typewriter" ? Math.floor(Math.max(0, frame) / 1.4) : Infinity;
  let shown = 0;
  return (
    <Fit style={box} innerStyle={inner} marker={String(index)}>
      <div style={{ ...lookBlock(look, props, k), transform: look.rotate ? `rotate(${look.rotate}deg)` : undefined }}>
        <span style={{ ...lookType(look, props, k, scale), ...lookLine(look, props, k) }}>
          {words.map((word, i) => {
            const start = shown;
            shown += word.length + 1;
            const visible = look.enter === "typewriter" ? word.slice(0, Math.max(0, typed - start)) : word;
            const e = stressedIn(emphasis, word) ? look.emphasis : undefined;
            const stress: CSSProperties | undefined = e
              ? {
                  color: e.color ? lookColor(e.color, props) : undefined,
                  fontFamily: e.font ? `"${e.font}", "${look.font}", sans-serif` : undefined,
                  fontStyle: e.italic ? "italic" : undefined,
                  background: e.fill ? lookColor(e.fill, props) : undefined,
                  borderRadius: e.fill ? 6 * k : undefined,
                  padding: e.fill ? `0 ${8 * k}px` : undefined,
                }
              : undefined;
            return (
              <span key={i} style={{ display: "inline-block", whiteSpace: "pre", ...(look.enter === "typewriter" ? {} : enterOf(i)) }}>
                {/* Typewriter: the letters not typed yet keep their room, so lines never jump. */}
                <span style={stress}>
                  {visible}
                  {visible.length < word.length ? <span style={{ opacity: 0 }}>{word.slice(visible.length)}</span> : null}
                </span>
                {i < words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </span>
      </div>
    </Fit>
  );
}

/** The studio's logo over a still or a video, centred at the top or the bottom. */
function Logo({ props, k }: { props: ReelProps; k: number }) {
  if (!props.logo || !props.brand.logoUrl) return null;
  const edge = props.height * 0.035;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "center", ...(props.logo === "top" ? { top: edge } : { bottom: edge }) }}>
      <Img src={props.brand.logoUrl} style={{ maxWidth: 240 * k, maxHeight: 130 * k, objectFit: "contain" }} />
    </div>
  );
}

/** Where the voice's subtitles sit: low, above the apps' buttons and caption (a line set meanwhile moves up). */
const SUBTITLE_Y = 0.64;

/** A thin dark outline behind the letters and a short shadow, as native captions: sharp on a white wall, no grey veil. */
const subtitleEdge = (k: number): CSSProperties => ({
  WebkitTextStroke: `${(3 * k).toFixed(2)}px rgba(0,0,0,0.72)`,
  paintOrder: "stroke fill",
  textShadow: `0 ${(2 * k).toFixed(2)}px ${(4 * k).toFixed(2)}px rgba(0,0,0,0.35)`,
});

/** A phrase's end: the next words start a new line of subtitles. */
const PHRASE_END = /[.,!?;:…]$/;

/** Word-by-word subtitles: short phrases, the spoken word lit up. */
function Subtitles({ props, theme, k }: { props: ReelProps; theme: Theme; k: number }) {
  const frame = useCurrentFrame();
  const chunks: ReelProps["words"][] = [];
  for (const word of props.words) {
    const current = chunks.at(-1);
    const last = current?.at(-1);
    // Two or three words at a time, never across a phrase's end: read at a glance, in time with the voice.
    if (current && last && current.length < 3 && word.from - last.to < 12 && !PHRASE_END.test(last.w)) current.push(word);
    else chunks.push([word]);
  }
  // Shown all along the voice, like the apps' own captions: the other texts and the animations keep off their row.
  const chunk = chunks.find((c) => frame >= c[0]!.from && frame <= c.at(-1)!.to + 6);
  if (!chunk) return null;
  const s = theme.subtitle;
  // One place for the whole Reel, off the faces (the engine's choice); older plans set a row per shot.
  const start = chunk[0]!.from;
  const shot = props.segments.find((seg) => start >= seg.startAt && start < seg.startAt + seg.durationInFrames);
  const y =
    props.subtitleY ?? (shot && (shot.type === "clip" || shot.type === "image") && shot.subtitleY !== undefined ? shot.subtitleY : SUBTITLE_Y);
  return (
    <div
      style={{
        position: "absolute",
        top: props.height * y,
        left: SAFE.left * k,
        right: SAFE.right * k,
        textAlign: "center",
        fontFamily: `"${MONOSPACE.test(props.brand.bodyFont) ? props.brand.displayFont : props.brand.bodyFont}", sans-serif`,
        fontWeight: s.weight,
        fontSize: s.size * k,
        textTransform: s.uppercase ? "uppercase" : "none",
        lineHeight: 1.3,
        color: "#fff",
        ...subtitleEdge(k),
      }}
    >
      {chunk.map((word, i) => {
        const active = frame >= word.from && frame <= word.to;
        const style: CSSProperties = !active
          ? {}
          : s.highlight === "pill"
            ? { background: props.brand.accent, color: props.brand.accentInk, borderRadius: 10 * k, padding: `0 ${10 * k}px`, textShadow: "none", WebkitTextStroke: 0 }
            : s.highlight === "serif"
              ? // Its display font's italic, a touch larger (serif faces run small), like the words its site sets apart.
                { fontFamily: `"${props.brand.displayFont}", serif`, fontStyle: "italic", fontWeight: 400, fontSize: "1.1em", textTransform: "none" }
              : { color: legible(props.brand.accent, "footage") };
        return (
          <span key={i} style={{ display: "inline-block", margin: `0 ${8 * k}px`, ...style }}>
            {active && s.highlight === "marker" ? (
              <Marker color={legible(props.brand.accent, "footage")} from={word.from} long>
                {word.w}
              </Marker>
            ) : (
              word.w
            )}
          </span>
        );
      })}
    </div>
  );
}

const plainName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
const sameName = (title: string, name: string) => Boolean(plainName(title)) && plainName(title) === plainName(name);

function EndCard({ props, k }: { props: ReelProps; k: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shade = interpolate(frame, [0, 12], [0, 1], clamp);
  const p = spring({ frame: frame - 4, fps, config: { damping: 200, stiffness: 100 } });
  const card = props.endCard!;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(20,14,32,${0.55 * shade})`,
        backdropFilter: `blur(${10 * shade}px)`,
        color: "#fff",
      }}
    >
      {/* A long studio name shrinks instead of leaving the frame. */}
      <Fit style={{ position: "absolute", top: props.height * 0.12, bottom: props.height * 0.2, left: SAFE.left * k, right: SAFE.right * k }}>
        {(fit) => (
          <div style={{ opacity: p, transform: `translateY(${(1 - p) * 24 * k}px)` }}>
            {props.brand.logoUrl ? (
              // A dark logo would vanish on the dark veil: in white if it is one colour, else on a light plate.
              <div
                style={{
                  display: "inline-block",
                  marginBottom: 28 * k,
                  ...(props.brand.logoOnDark === "plate" ? { background: "#FBF7F4", padding: `${22 * k}px ${30 * k}px`, borderRadius: 26 * k, boxShadow: "0 12px 40px rgba(0,0,0,.35)" } : {}),
                }}
              >
                <Img
                  src={props.brand.logoUrl}
                  style={{
                    display: "block",
                    maxWidth: 520 * k,
                    maxHeight: 220 * k,
                    objectFit: "contain",
                    ...(props.brand.logoOnDark === "white" ? { filter: "brightness(0) invert(1) drop-shadow(0 2px 10px rgba(0,0,0,.35))" } : {}),
                  }}
                />
              </div>
            ) : null}
            {/* The logo already says the name: written again under it, it reads twice. */}
            {props.brand.logoUrl && sameName(card.title, props.brand.name) ? null : (
              <div style={{ fontFamily: `"${props.brand.displayFont}", serif`, fontStyle: "italic", fontSize: 96 * k, lineHeight: 1.05 }}>
                {card.title}
              </div>
            )}
            {card.subtitle ? (
              <div
                style={{
                  marginTop: 22 * k,
                  fontFamily: `"${props.brand.bodyFont}", sans-serif`,
                  fontWeight: 600,
                  fontSize: Math.max(38, 28 / fit) * k, // stays readable when a long name shrinks
                  opacity: 0.92,
                }}
              >
                {card.subtitle}
              </div>
            ) : null}
            <div style={{ margin: `${30 * k}px auto 0`, width: 64 * k, height: 4 * k, borderRadius: 4 * k, background: props.brand.accent }} />
          </div>
        )}
      </Fit>
    </AbsoluteFill>
  );
}
