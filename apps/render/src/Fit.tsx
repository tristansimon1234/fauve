import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { continueRender, delayRender } from "remotion";
import { fontsLoaded } from "./fonts";

// A box whose content shrinks until it fits: a long title or a long word gets a
// smaller size instead of leaving the frame. The content is laid out wider and
// scaled down as a whole, so sizes, margins and line breaks keep their balance.
// It is measured once the fonts and images are loaded, with every transform
// switched off (entrance animations scale and move words), so the size is the
// same on every frame and in every render tab.

const MIN_SCALE = 0.3;
const MEASURING = "data-fit-measuring";

let pending = 0;
/** Boxes that have not measured their content yet (the scene check waits for them). */
export const fitsPending = () => pending;

function measuringStyle() {
  if (document.getElementById("fit-measuring")) return;
  const style = document.createElement("style");
  style.id = "fit-measuring";
  style.textContent = `[${MEASURING}], [${MEASURING}] * { transform: none !important; transition: none !important; }`;
  document.head.appendChild(style);
}

/** How many times the content is larger than the box (≤ 1 when it fits). */
function overflowRatio(inner: HTMLElement): number {
  const box = inner.getBoundingClientRect();
  // The content's own extent: glyph boxes may poke out of a tight line height, only the size counts.
  let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
  const grow = (r: DOMRect) => {
    if (!r.width && !r.height) return;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  };
  inner.querySelectorAll("*").forEach((el) => grow(el.getBoundingClientRect()));
  // Text can overflow the element that holds it (a word longer than the line).
  const range = document.createRange();
  const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) grow(r);
  }
  if (right < left) return 0;
  return Math.max((right - left) / box.width, (bottom - top) / box.height);
}

/** Images change the layout once loaded (a logo): wait for them too. */
function imagesLoaded(root: HTMLElement | null): Promise<void> {
  const images = Array.from(root?.querySelectorAll("img") ?? []).filter((img) => !img.complete);
  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        }),
    ),
  ).then(() => undefined);
}

const size = (scale: number) => `${(100 / scale).toFixed(3)}%`;

export function Fit({
  style,
  innerStyle,
  children,
}: {
  /** The box: position and size (it must be positioned). */
  style: CSSProperties;
  /** Layout and typography of the content; centred by default. */
  innerStyle?: CSSProperties;
  /** The content, or a function of the scale (to keep small texts readable when it shrinks). */
  children: ReactNode | ((scale: number) => ReactNode);
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => {
    pending++;
    return delayRender("fit text", { timeoutInMilliseconds: 25000 });
  });
  const released = useRef(false);
  const release = () => {
    if (released.current) return;
    released.current = true;
    pending--;
    continueRender(handle);
  };

  useEffect(() => {
    let alive = true;
    fontsLoaded()
      .then(() => imagesLoaded(inner.current))
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
      release();
    };
  }, []);

  // Shrinks step by step (each step re-renders synchronously, before anything is drawn).
  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!ready || !box || !content || released.current) return;
    measuringStyle();
    box.setAttribute(MEASURING, "");
    const ratio = overflowRatio(content);
    box.removeAttribute(MEASURING);
    if (ratio > 1.005 && scale > MIN_SCALE) setScale(Math.max(MIN_SCALE, (scale / ratio) * 0.98));
    else release();
  }, [ready, scale]);

  return (
    <div ref={outer} style={style}>
      <div
        ref={inner}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size(scale),
          height: size(scale),
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          ...innerStyle,
        }}
      >
        {typeof children === "function" ? children(scale) : children}
      </div>
    </div>
  );
}
