import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PLANS } from "@fauve/agent";
import { ImageResponse } from "next/og";

// The picture shown when a link to the landing is shared (WhatsApp, Instagram, iMessage, LinkedIn…):
// the promise in the landing's type, beside three of its Reels as on a contact sheet.
export const alt = "Edith est une IA. Tes Reels n’en ont pas l’air.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Read once at module scope: nothing here depends on the request, so the image is made at build time.
const asset = (name: string) => readFile(join(process.cwd(), "src/app/_og", name));
const dataUrl = async (name: string, type: string) => `data:${type};base64,${(await asset(name)).toString("base64")}`;

const [heavy, semi, serif, mascot, ...reels] = await Promise.all([
  asset("jakarta-800.ttf"),
  asset("jakarta-600.ttf"),
  asset("instrument-italic.ttf"),
  readFile(join(process.cwd(), "src/app/icon.svg")).then((svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`),
  ...["pilates", "cafe", "cave"].map((reel) => dataUrl(`reel-${reel}.jpg`, "image/jpeg")),
]);

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FBF7F4", padding: "64px 72px", fontFamily: "Jakarta", color: "#1C1530" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={mascot} width={52} height={54} alt="" />
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Edith</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: 3, color: "#5E5670", marginBottom: 22 }}>TON COMMUNITY MANAGER IA, SUR WHATSAPP</div>
            <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1 }}>Edith est une IA.</div>
            <div style={{ fontFamily: "Instrument", fontStyle: "italic", fontSize: 74, lineHeight: 1, color: "#5B3FD9", marginTop: 8 }}>Tes Reels n’en ont pas l’air.</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#5E5670" }}>{`edith-ai.app · dès ${PLANS.decouverte.priceEur} € par mois`}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {reels.map((src, i) => (
            <img key={src.length + i} src={src} width={150} height={267} alt="" style={{ borderRadius: 14, objectFit: "cover", marginTop: i === 1 ? -60 : 40, boxShadow: "0 18px 40px rgba(28,21,48,0.18)" }} />
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: heavy, weight: 800, style: "normal" },
        { name: "Jakarta", data: semi, weight: 600, style: "normal" },
        { name: "Instrument", data: serif, weight: 400, style: "italic" },
      ],
    },
  );
}
