import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import { fitsPending } from "./Fit";
import { fontsLoaded } from "./fonts";
import { compileComponent, Fallback } from "./MotionScene";
import type { ReelProps } from "./types";

// A text layer designed as code by the text designer (checked before it gets
// here): drawn over the photo with its slot texts. If it fails at render time,
// the texts are drawn plainly instead, so a slide always goes out. In check mode
// (the designer's test render) a failure, or a text out of the frame, cancels
// the render with the reason, which goes back to the designer.

type LayerComponent = (props: {
  width: number;
  height: number;
  brand: ReelProps["brand"] & { ink: string; cream: string };
  texts: Record<string, string>;
}) => ReactNode;

/** Every text stays this far from the edges (px on a 1080-wide frame). */
const MARGIN = 40;
const TOLERANCE = 8;

/** Dark ink on a light colour, white on a dark one. */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.45 ? "#1C1530" : "#FFFFFF";
}

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

function Plain({ texts, props }: { texts: Record<string, string>; props: ReelProps }) {
  const k = props.width / 1080;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: 72 * k, gap: 18 * k, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)" }}>
      {Object.values(texts)
        .filter(Boolean)
        .map((text, i) => (
          <div key={i} style={{ color: "#fff", fontFamily: `"${props.brand.bodyFont}", sans-serif`, fontWeight: i === 0 ? 800 : 500, fontSize: (i === 0 ? 64 : 38) * k, lineHeight: 1.2, whiteSpace: "pre-line" }}>
            {text}
          </div>
        ))}
    </AbsoluteFill>
  );
}

/** In check mode: once fonts and fitted boxes have settled, every text must sit inside the frame's margins. */
export function useLayerCheck(root: React.RefObject<HTMLDivElement | null>, props: ReelProps, enabled: boolean) {
  const [handle] = useState(() => (enabled ? delayRender("text layer check", { timeoutInMilliseconds: 60000 }) : null));
  useEffect(() => {
    if (handle === null) return;
    (async () => {
      await fontsLoaded();
      for (let i = 0; i < 300 && fitsPending() > 0; i++) await waitFrame();
      await waitFrame();
      const container = root.current;
      if (!container) return continueRender(handle);
      const origin = container.getBoundingClientRect();
      const scale = origin.width / props.width || 1;
      const out: string[] = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (!text) continue;
        range.selectNodeContents(node);
        for (const r of Array.from(range.getClientRects())) {
          if (r.width < 1 || r.height < 1) continue;
          const [x1, y1, x2, y2] = [(r.left - origin.left) / scale, (r.top - origin.top) / scale, (r.right - origin.left) / scale, (r.bottom - origin.top) / scale];
          const inside = x1 >= MARGIN - TOLERANCE && y1 >= MARGIN - TOLERANCE && x2 <= props.width - MARGIN + TOLERANCE && y2 <= props.height - MARGIN + TOLERANCE;
          if (!inside) out.push(`« ${text.slice(0, 40)} » (x ${Math.round(x1)} à ${Math.round(x2)}, y ${Math.round(y1)} à ${Math.round(y2)})`);
        }
      }
      if (!out.length) return continueRender(handle);
      cancelRender(
        new Error(`texte hors du cadre : ${[...new Set(out)].slice(0, 3).join(" ; ")}. Chaque texte doit rester entier à ${MARGIN} px des bords (cadre ${props.width} × ${props.height}).`),
      );
    })().catch((error: unknown) => cancelRender(error instanceof Error ? error : new Error(String(error))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function TextLayer({ props }: { props: ReelProps }) {
  const layer = props.layer!;
  const check = Boolean(layer.check);
  const root = useRef<HTMLDivElement>(null);
  const Generated = useMemo(() => compileComponent<LayerComponent>(layer.js, "Layer"), [layer.js]);
  useLayerCheck(root, props, check && Boolean(Generated));
  const [failedEarly] = useState(() => {
    if (!Generated && check) cancelRender(new Error("fonction Layer introuvable dans le code"));
    return !Generated;
  });
  const plain = <Plain texts={layer.texts} props={props} />;
  if (failedEarly || !Generated) return plain;
  return (
    <Fallback
      fallback={plain}
      onError={(error) => check && cancelRender(new Error(`erreur dans le calque : ${error instanceof Error ? error.message : String(error)}`))}
    >
      <AbsoluteFill
        ref={root}
        data-fauve-layer=""
        style={
          layer.place
            ? { transform: `translate(${layer.place.x * props.width}px, ${layer.place.y * props.height}px) scale(${layer.place.scale})`, transformOrigin: "50% 50%" }
            : undefined
        }
      >
        <Generated
          width={props.width}
          height={props.height}
          brand={{ ...props.brand, ...(layer.accent ? { accent: layer.accent, accentInk: inkOn(layer.accent) } : {}), ink: "#1C1530", cream: "#FBF7F4" }}
          texts={layer.texts}
        />
      </AbsoluteFill>
    </Fallback>
  );
}
