import { continueRender, delayRender } from "remotion";

// Google Fonts with every weight the templates use. Rendering waits for them
// (with a safety timeout, so a network hiccup degrades to fallback fonts).
const FAMILIES: Record<string, string> = {
  "Instrument Serif": "Instrument+Serif:ital@0;1",
  "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700;800",
  Poppins: "Poppins:ital,wght@0,500;0,600;0,700;0,800;1,700;1,800",
  "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,500;0,600;1,500",
};

const loaded = new Set<string>();

export function loadFonts(families: string[]): void {
  const wanted = families.filter((f) => FAMILIES[f] && !loaded.has(f));
  if (!wanted.length || typeof document === "undefined") return;
  wanted.forEach((f) => loaded.add(f));

  const handle = delayRender(`fonts: ${wanted.join(", ")}`, { timeoutInMilliseconds: 20000 });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    continueRender(handle);
  };
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${wanted.map((f) => `family=${FAMILIES[f]}`).join("&")}&display=block`;
  link.onload = () => {
    Promise.all(
      wanted.flatMap((f) => [document.fonts.load(`400 64px "${f}"`), document.fonts.load(`italic 400 64px "${f}"`), document.fonts.load(`800 64px "${f}"`)]),
    )
      .catch(() => undefined)
      .finally(finish);
  };
  link.onerror = finish;
  document.head.appendChild(link);
  setTimeout(finish, 12000);
}
