import { useMemo, useRef, useState, type ReactNode } from "react";
import { AbsoluteFill, cancelRender } from "remotion";
import { loadCustomFonts, loadFonts } from "./fonts";
import { compileComponent, Fallback } from "./MotionScene";
import { inkOn, useLayerCheck } from "./TextLayer";
import type { ReelProps } from "./types";

// The studio's components placed on a still (a title, a tag, a checklist…):
// each one is drawn at its design width, then zoomed into its box (position and
// width as shares of the frame) and tilted. One that fails is drawn as plain
// text, so a slide always goes out; in check mode (the designer's test render)
// a failure or a text out of the frame cancels the render with the reason.

type ElementComponent = (props: { width: number; brand: ReelProps["brand"] & { ink: string; cream: string }; texts: Record<string, string> }) => ReactNode;
type Placed = NonNullable<ReelProps["elements"]>[number];

function Plain({ texts, props }: { texts: Record<string, string>; props: ReelProps }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, color: "#fff", fontFamily: `"${props.brand.bodyFont}", sans-serif`, textShadow: "0 2px 12px rgba(0,0,0,.45)" }}>
      {Object.values(texts)
        .filter(Boolean)
        .map((text, i) => (
          <div key={i} style={{ fontWeight: i === 0 ? 800 : 500, fontSize: i === 0 ? 56 : 34, lineHeight: 1.2, whiteSpace: "pre-line" }}>
            {text}
          </div>
        ))}
    </div>
  );
}

function PlacedElement({ element, index, props, check }: { element: Placed; index: number; props: ReelProps; check: boolean }) {
  const Generated = useMemo(() => compileComponent<ElementComponent>(element.js, "Element"), [element.js]);
  const name = element.label ?? `composant ${index + 1}`;
  useState(() => {
    if (!Generated && check) cancelRender(new Error(`${name} : fonction Element introuvable dans le code`));
    return null;
  });
  const width = element.box.w * props.width;
  const brand = { ...props.brand, ...(element.accent ? { accent: element.accent, accentInk: inkOn(element.accent) } : {}), ink: "#1C1530", cream: "#FBF7F4" };
  const plain = <Plain texts={element.texts} props={props} />;
  return (
    <div
      data-fauve-element={index}
      style={{
        position: "absolute",
        left: element.box.x * props.width,
        top: element.box.y * props.height,
        width,
        transform: element.box.rotate ? `rotate(${element.box.rotate}deg)` : undefined,
        transformOrigin: "50% 50%",
      }}
    >
      {/* zoom (not scale) so the box takes the drawn height: rotation and hit areas stay right. */}
      <div style={{ width: element.base, zoom: width / element.base }}>
        {Generated ? (
          <Fallback fallback={plain} onError={(error) => check && cancelRender(new Error(`${name} : ${error instanceof Error ? error.message : String(error)}`))}>
            <Generated width={element.base} brand={brand} texts={element.texts} />
          </Fallback>
        ) : (
          plain
        )}
      </div>
    </div>
  );
}

export function Elements({ props }: { props: ReelProps }) {
  const root = useRef<HTMLDivElement>(null);
  const check = Boolean(props.elementsCheck);
  useLayerCheck(root, props, check);
  return (
    <AbsoluteFill ref={root} data-fauve-elements="">
      {(props.elements ?? []).map((element, i) => (
        <PlacedElement key={i} element={element} index={i} props={props} check={check} />
      ))}
    </AbsoluteFill>
  );
}

/**
 * One component on its own (the bank's cards and pages): drawn at its design width,
 * centred on a transparent frame, with its fonts. `scale` < 1 leaves room around it.
 */
export function ElementAlone({
  element,
  brand,
  scale = 0.84,
}: {
  element: Pick<Placed, "js" | "texts" | "fonts" | "base" | "accent">;
  brand: ReelProps["brand"];
  scale?: number;
}) {
  loadCustomFonts(brand.customFonts);
  loadFonts([brand.displayFont, brand.bodyFont, ...element.fonts]);
  const Generated = useMemo(() => compileComponent<ElementComponent>(element.js, "Element"), [element.js]);
  const full = { ...brand, ...(element.accent ? { accent: element.accent, accentInk: inkOn(element.accent) } : {}), ink: "#1C1530", cream: "#FBF7F4" };
  // Every component fills the card's width (a small tag is enlarged, within reason).
  const zoom = Math.min(2.4, (1080 * scale) / element.base);
  const props = { brand } as ReelProps;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: element.base, zoom }}>
        {Generated ? (
          <Fallback fallback={<Plain texts={element.texts} props={props} />}>
            <Generated width={element.base} brand={full} texts={element.texts} />
          </Fallback>
        ) : (
          <Plain texts={element.texts} props={props} />
        )}
      </div>
    </AbsoluteFill>
  );
}
