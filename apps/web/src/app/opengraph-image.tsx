import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PLANS } from "@fauve/agent";
import { ImageResponse } from "next/og";

// The picture shown when a link to the landing is shared (WhatsApp, Instagram, iMessage, LinkedIn…), in the site's
// paper and ink: the line logo, the promise in big type, three of its Reels side by side between hairlines.
export const alt = "Tes Reels, jamais pareils. Edith, ton community manager IA.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Read once at module scope: nothing here depends on the request, so the image is made at build time.
const asset = (name: string) => readFile(join(process.cwd(), "src/app/_og", name));
const dataUrl = async (name: string, type: string) => `data:${type};base64,${(await asset(name)).toString("base64")}`;

const INK = "#121110";
const PAPER = "#F5F2EC";

/** The logo for the picture: the line head of the icon, in ink on the paper (the icon is white on ink). */
const lineLogo = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg.replace(/<rect[^>]*\/>/, "").replaceAll("#FFFFFF", INK)).toString("base64")}`;

const [semi, medium, serif, logo, ...reels] = await Promise.all([
  asset("intertight-600.ttf"),
  asset("intertight-500.ttf"),
  asset("instrument-italic.ttf"),
  readFile(join(process.cwd(), "public/icon.svg"), "utf8").then(lineLogo),
  ...["coiffure", "bar", "fleuriste"].map((reel) => dataUrl(`reel-${reel}.jpg`, "image/jpeg")),
]);

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, padding: "44px 56px", fontFamily: "Grotesk", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${INK}`, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={logo} width={46} height={46} alt="" />
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -1.4 }}>Edith</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: 2.4, textTransform: "uppercase" }}>Community manager IA</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: 8 }}>
            <div style={{ fontSize: 112, fontWeight: 600, letterSpacing: -7, lineHeight: 0.9 }}>Tes Reels,</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
              <div style={{ fontSize: 112, fontWeight: 600, letterSpacing: -7, lineHeight: 0.9 }}>jamais</div>
              <div style={{ fontFamily: "Instrument", fontStyle: "italic", fontSize: 124, lineHeight: 0.9, letterSpacing: -3 }}>pareils.</div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", marginTop: 26, color: "#6B675F" }}>{`edith-ai.app · dès ${PLANS.decouverte.priceEur} € par mois`}</div>
          </div>
          <div style={{ display: "flex", gap: 10, paddingBottom: 8 }}>
            {reels.map((src, i) => (
              <img key={src.length + i} src={src} width={146} height={260} alt="" style={{ objectFit: "cover", border: `1px solid ${INK}` }} />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Grotesk", data: semi, weight: 600, style: "normal" },
        { name: "Grotesk", data: medium, weight: 500, style: "normal" },
        { name: "Instrument", data: serif, weight: 400, style: "italic" },
      ],
    },
  );
}
