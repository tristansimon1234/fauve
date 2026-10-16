// A web page as a visitor sees it, for the onboarding: a capture of its top and what its
// styles really are (the fonts its titles and its texts use, the colours that fill the page,
// its buttons), read in the sandbox's headless Chrome through the DevTools protocol. The
// colours found in a site's code are often the site builder's own (Squarespace, WordPress
// presets): only what is on screen counts here.
// Usage: node page.mjs <url> <out-dir> → writes <out-dir>/page.png and <out-dir>/page.json.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [url, out] = process.argv.slice(2);
// A laptop's window (sections a screen high stay a screen high); the capture keeps two screens.
const WIDTH = 1280;
const VIEW = 900;
const HEIGHT = 1800;
const chrome = process.env.BROWSER_EXECUTABLE;
if (!url || !out || !chrome) {
  console.error("usage: BROWSER_EXECUTABLE=… node page.mjs <url> <out-dir>");
  process.exit(2);
}
const port = 9300 + Math.floor(Math.random() * 600);
const flags = ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--lang=fr-FR", `--remote-debugging-port=${port}`, `--window-size=${WIDTH},${VIEW}`];
if (process.env.PAGE_PROXY) flags.push(`--proxy-server=${process.env.PAGE_PROXY}`);
const child = spawn(chrome, [...flags, "about:blank"], { stdio: "ignore" });
const done = (code) => {
  child.kill("SIGKILL");
  process.exit(code);
};
setTimeout(() => done(4), 55_000).unref();

/** The page's DevTools socket, once Chrome listens. */
async function pageSocket() {
  for (let i = 0; i < 60; i++) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json(), () => null);
    const page = targets?.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (page) return page.webSocketDebuggerUrl;
    await sleep(150);
  }
  throw new Error("no page target");
}

// Node 22 has a WebSocket of its own; an older one uses Remotion's (« ws »).
const Socket = globalThis.WebSocket ?? (await import("ws")).default;
const ws = new Socket(await pageSocket());
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let next = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data));
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) listeners.get(msg.method)?.(msg.params);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++next;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const once = (method, ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    listeners.set(method, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
const evaluate = async (fn) => (await send("Runtime.evaluate", { expression: `(${fn})()`, returnByValue: true, awaitPromise: true })).result?.value;

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: VIEW, deviceScaleFactor: 1, mobile: false });
const loaded = once("Page.loadEventFired", 20_000);
await send("Page.navigate", { url });
await loaded;
await sleep(2500);

// Cookie banners and pop-ups cover the page: their « accept » button when there is one,
// then whatever still covers most of the screen goes. Sections that wait for a scroll to
// fade in (Elementor, AOS, WOW…) are shown at once.
const accepted = await evaluate(() => {
  const words = /^(tout accepter|accepter( tout| et fermer)?|j'accepte|j’accepte|accept( all)?|allow all|autoriser|ok|d'accord|d’accord|compris|got it)$/i;
  const known = "#onetrust-accept-btn-handler, #axeptio_btn_acceptAll, #didomi-notice-agree-button, .cmplz-accept, #CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #tarteaucitronPersonalize2, .cc-allow, [data-cky-tag=accept-button]";
  const button =
    document.querySelector(known) ??
    [...document.querySelectorAll("button, a, [role=button]")].find((b) => words.test((b.textContent ?? "").trim()) && b.getBoundingClientRect().width > 0);
  if (!button) return false;
  button.click();
  return true;
});
await sleep(accepted ? 900 : 200);
await evaluate(() => {
  const css = document.createElement("style");
  css.textContent = ".elementor-invisible,[data-aos],.wow,.reveal,.fade-in,.animate-on-scroll{visibility:visible!important;opacity:1!important;transform:none!important;animation:none!important}";
  document.head.append(css);
  const screen = window.innerWidth * window.innerHeight;
  const covering = /popup|modal|overlay|cookie|consent|cmplz|didomi|axeptio|onetrust|newsletter|dialog|preload|loader|splash|age-?gate/i;
  for (const el of document.body.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" || s.display === "none") continue;
    const r = el.getBoundingClientRect();
    const big = r.width * r.height > screen * 0.5;
    const named = covering.test(`${el.id} ${el.className}`);
    if ((big && (named || Number(s.zIndex) >= 100)) || (named && r.height > 80)) el.remove();
  }
  document.documentElement.style.overflow = "auto";
  document.body.style.overflow = "auto";
});

// Lazy images (WordPress caches, lazysizes, Squarespace…) get their real source at once, then
// a slow scroll down the page wakes what loads on scroll, and the images get time to arrive.
await evaluate(async () => {
  for (const img of document.querySelectorAll("img")) {
    const src = img.dataset.src ?? img.dataset.lazySrc ?? img.dataset.original ?? img.dataset.image;
    const srcset = img.dataset.srcset ?? img.dataset.lazySrcset;
    if (srcset) img.srcset = srcset;
    if (src && /^(https?:)?\/\//.test(src)) img.src = src;
    img.loading = "eager";
  }
  const end = Math.min(document.documentElement.scrollHeight, 6000);
  for (let y = 0; y < end; y += 450) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 160));
  }
  window.scrollTo(0, 0);
  const pending = [...document.images].filter((i) => !i.complete && i.getBoundingClientRect().top + window.scrollY < end);
  await Promise.race([Promise.all(pending.map((i) => i.decode().catch(() => null))), new Promise((r) => setTimeout(r, 4000))]);
  await new Promise((r) => setTimeout(r, 600));
});

const style = await evaluate(() => {
  const LIMIT = Math.min(document.documentElement.scrollHeight, 6000);
  const first = (family) => family.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const shown = (el) => {
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
  };
  const toHex = (c) => {
    const m = c.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?/);
    if (!m) return null;
    const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    if (alpha < 0.6) return null;
    return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  };
  const tally = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);

  // Texts: every visible run of words, by role (titles are big), weighted by the room it takes.
  const fonts = new Map();
  const textColors = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const words = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (words.length < 2) continue;
    const el = node.parentElement;
    if (!el || !shown(el) || el.closest("script, style, noscript, svg, [aria-hidden=true]")) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    if (!rect.width || !rect.height || top > LIMIT || top + rect.height < 0) continue;
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize) || 16;
    const role = size >= 26 || /^H[12]$/.test(el.tagName) ? "display" : size <= 22 ? "body" : "middle";
    const weight = words.length * size;
    total += weight;
    const key = `${role}|${first(s.fontFamily)}`;
    const f = fonts.get(key) ?? { role, family: first(s.fontFamily), weight: 0, upper: 0, bold: 0, sizes: new Map(), spacing: 0, center: 0, sample: "" };
    f.weight += weight;
    if (s.textTransform === "uppercase" || (words === words.toUpperCase() && /[A-Z]/.test(words))) f.upper += weight;
    if (Number(s.fontWeight) >= 600) f.bold += weight;
    tally(f.sizes, Math.round(size), weight);
    f.spacing += (s.letterSpacing === "normal" ? 0 : parseFloat(s.letterSpacing) / size) * weight;
    if (s.textAlign === "center") f.center += weight;
    if (!f.sample && role !== "body" && words.length > 3) f.sample = words.slice(0, 60);
    fonts.set(key, f);
    const color = toHex(s.color);
    if (color) tally(textColors, color, rect.width * rect.height);
  }

  // What fills the page: each element's background painted in document order on a coarse
  // grid (later elements on top), photos and videos as « photo ».
  const COLS = 64;
  const cell = window.innerWidth / COLS;
  const rows = Math.ceil(LIMIT / cell);
  const grid = new Array(COLS * rows).fill(toHex(getComputedStyle(document.body).backgroundColor) ?? toHex(getComputedStyle(document.documentElement).backgroundColor) ?? "#ffffff");
  const paint = (rect, value) => {
    const y0 = Math.max(0, Math.floor((rect.top + window.scrollY) / cell));
    const y1 = Math.min(rows, Math.ceil((rect.bottom + window.scrollY) / cell));
    const x0 = Math.max(0, Math.floor(rect.left / cell));
    const x1 = Math.min(COLS, Math.ceil(rect.right / cell));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) grid[y * COLS + x] = value;
  };
  const buttons = new Map();
  for (const el of document.body.querySelectorAll("*")) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || rect.top + window.scrollY > LIMIT || !shown(el)) continue;
    const s = getComputedStyle(el);
    if (/^(IMG|VIDEO|PICTURE|CANVAS|IFRAME)$/.test(el.tagName) || (s.backgroundImage.includes("url(") && rect.width * rect.height > 40_000)) {
      paint(rect, "photo");
      continue;
    }
    const bg = toHex(s.backgroundColor);
    if (bg) paint(rect, bg);
    // Buttons and calls to action: the colour that says « click here ».
    if ((el.tagName === "BUTTON" || el.tagName === "A") && rect.width < 600 && rect.height < 140 && (el.textContent ?? "").trim()) {
      const fill = bg ?? (parseFloat(s.borderWidth) >= 1 ? toHex(s.borderColor) : null);
      if (fill) tally(buttons, fill, rect.width * rect.height);
    }
  }
  const areas = new Map();
  for (const v of grid) tally(areas, v, 1);

  const share = (map, n = 8) => {
    const sum = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([color, v]) => ({ color, share: Math.round((v / sum) * 1000) / 1000 }));
  };
  const byRole = (role) =>
    [...fonts.values()]
      .filter((f) => f.role === role)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((f) => ({
        family: f.family,
        share: Math.round((f.weight / (total || 1)) * 1000) / 1000,
        uppercase: Math.round((f.upper / f.weight) * 100) / 100,
        bold: Math.round((f.bold / f.weight) * 100) / 100,
        size: [...f.sizes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        letter_spacing: Math.round((f.spacing / f.weight) * 1000) / 1000,
        centered: Math.round((f.center / f.weight) * 100) / 100,
        ...(f.sample ? { sample: f.sample } : {}),
      }));
  return {
    title: document.title,
    display: byRole("display"),
    middle: byRole("middle"),
    body: byRole("body"),
    loaded_fonts: [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/^["']|["']$/g, "")))].slice(0, 12),
    areas: share(areas, 10),
    texts: share(textColors, 6),
    buttons: share(buttons, 4),
  };
});

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } });
writeFileSync(`${out}/page.png`, Buffer.from(shot.data, "base64"));
// The whole page at half size (up to 6000 px down): the colours that fill it, counted on its pixels.
const tall = await evaluate(() => Math.min(document.documentElement.scrollHeight, 6000));
const full = await send("Page.captureScreenshot", { format: "jpeg", quality: 80, captureBeyondViewport: true, clip: { x: 0, y: 0, width: WIDTH, height: Math.max(HEIGHT, tall), scale: 0.5 } });
writeFileSync(`${out}/full.jpg`, Buffer.from(full.data, "base64"));
writeFileSync(`${out}/page.json`, JSON.stringify({ url, accepted_cookies: accepted, ...style }));
ws.close();
done(0);
