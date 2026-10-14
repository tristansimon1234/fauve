import { continueRender, delayRender } from "remotion";

// Any Google Fonts family, loaded through the CSS API. Families do not all have
// every weight or an italic, and the API rejects a request for a missing one,
// so each family is tried from the richest request to the plainest. Rendering
// waits for the fonts, with a timeout so a network hiccup only means fallbacks.

const loaded = new Set<string>();
// Settles when every family asked so far is loaded or given up on (text is measured after it).
let settled: Promise<void> = Promise.resolve();

const variants = (family: string) => {
  const name = family.trim().replace(/ +/g, "+");
  return [
    `${name}:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,700`,
    `${name}:wght@400;500;600;700;800`,
    `${name}:ital@0;1`,
    name,
  ];
};

function loadStylesheet(href: string): Promise<boolean> {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve(true);
    link.onerror = () => {
      link.remove();
      resolve(false);
    };
    document.head.appendChild(link);
  });
}

async function loadFamily(family: string): Promise<void> {
  for (const variant of variants(family)) {
    if (await loadStylesheet(`https://fonts.googleapis.com/css2?family=${variant}&display=block`)) break;
  }
  await Promise.all(
    ["400", "italic 400", "700", "800"].map((w) => document.fonts.load(`${w} 64px "${family}"`).catch(() => undefined)),
  );
}

/** The studio's own fonts (uploaded files): loaded from their URL, never asked of Google. */
export function loadCustomFonts(fonts: { family: string; url: string }[] | undefined): void {
  const wanted = (fonts ?? []).filter((f) => /^[A-Za-z0-9 ]{2,40}$/.test(f.family) && !loaded.has(f.family));
  if (!wanted.length || typeof document === "undefined") return;
  wanted.forEach((f) => loaded.add(f.family));
  const handle = delayRender(`custom fonts: ${wanted.map((f) => f.family).join(", ")}`, { timeoutInMilliseconds: 25000 });
  const finished = Promise.all(
    wanted.map((f) =>
      new FontFace(f.family, `url("${f.url}")`)
        .load()
        .then((face) => {
          document.fonts.add(face);
        })
        .catch(() => undefined),
    ),
  ).then(() => continueRender(handle));
  settled = Promise.all([settled, finished]).then(() => undefined);
}

export function loadFonts(families: string[]): void {
  const wanted = [...new Set(families)].filter((f) => /^[A-Za-z0-9 ]{2,40}$/.test(f) && !loaded.has(f));
  if (!wanted.length || typeof document === "undefined") return;
  wanted.forEach((f) => loaded.add(f));

  const handle = delayRender(`fonts: ${wanted.join(", ")}`, { timeoutInMilliseconds: 25000 });
  let done = false;
  let resolve = () => {};
  const finished = new Promise<void>((r) => (resolve = r));
  const finish = () => {
    if (done) return;
    done = true;
    continueRender(handle);
    resolve();
  };
  settled = Promise.all([settled, finished]).then(() => undefined);
  Promise.all(wanted.map(loadFamily)).finally(finish);
  setTimeout(finish, 15000);
}

/** Resolves once the fonts are ready, so text sizes can be measured. */
export function fontsLoaded(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  return settled.then(() => document.fonts.ready).then(() => undefined);
}
