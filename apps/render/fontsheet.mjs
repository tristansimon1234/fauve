// Candidate fonts writing the same words, one row each, for the reading of a Reel she copies: Gemini compares the
// strip to the Reel's title and keeps the closest, or none when none is as fine (Tristan: « la police un peu naze…
// pas fine comme sur le Reel envoyé », « faut surtout pas que ça fasse cheap »). Read in the sandbox's headless
// Chrome through the DevTools protocol, the families loaded from Google Fonts as the render loads them.
// Usage: BROWSER_EXECUTABLE=… node fontsheet.mjs <in.json> <out.png>; in.json: { "words": "…", "fonts": ["…"] }.
// Writes out.png (white words on grey, rows numbered from 1) and prints {"loaded":[true,false,…]}.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [input, out] = process.argv.slice(2);
const chrome = process.env.BROWSER_EXECUTABLE;
if (!input || !out || !chrome) {
  console.error("usage: BROWSER_EXECUTABLE=… node fontsheet.mjs <in.json> <out.png>");
  process.exit(2);
}
const { words, fonts } = JSON.parse(readFileSync(input, "utf8"));
const WIDTH = 1080;
const ROW = 240;
const height = ROW * fonts.length;

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const family = (name) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}&display=block`;
const html = `<!doctype html><html><head><meta charset="utf-8">
${fonts.map((f) => `<link rel="stylesheet" href="${family(f)}">`).join("\n")}
<style>
  body { margin: 0; width: ${WIDTH}px; background: #6f6c68; }
  .row { box-sizing: border-box; height: ${ROW}px; display: flex; align-items: center; gap: 24px; padding: 0 36px; border-bottom: 2px solid #5a5754; }
  .n { flex: none; width: 44px; font: 700 40px/1 monospace; color: #ffd84d; }
  .w { flex: 1; min-width: 0; color: #fff; font-size: 84px; line-height: 1.15; white-space: nowrap; overflow: hidden; }
</style></head><body>
${fonts.map((f, i) => `<div class="row"><span class="n">${i + 1}</span><span class="w" style="font-family: '${escape(f)}', serif">${escape(words)}</span></div>`).join("\n")}
</body></html>`;

const port = 9900 + Math.floor(Math.random() * 90);
const child = spawn(chrome, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--window-size=${WIDTH},${height}`, "about:blank"], { stdio: "ignore" });
const done = (code) => {
  child.kill("SIGKILL");
  process.exit(code);
};
setTimeout(() => done(4), 40_000).unref();

async function pageSocket() {
  for (let i = 0; i < 60; i++) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json(), () => null);
    const page = targets?.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (page) return page.webSocketDebuggerUrl;
    await sleep(150);
  }
  throw new Error("no page target");
}

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

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height, deviceScaleFactor: 1, mobile: false });
const loaded = new Promise((resolve) => {
  const timer = setTimeout(resolve, 15_000);
  listeners.set("Page.loadEventFired", () => {
    clearTimeout(timer);
    resolve();
  });
});
await send("Page.navigate", { url: `data:text/html;base64,${Buffer.from(html).toString("base64")}` });
await loaded;
// Each family drawn in its own letters, or known as missing (the comparison leaves it out).
const check = await send("Runtime.evaluate", {
  expression: `(async () => { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 8000))]); const names = ${JSON.stringify(fonts)}; await Promise.all(names.map((n) => document.fonts.load('84px "' + n + '"').catch(() => null))); for (const el of document.querySelectorAll(".w")) { let size = 84; while (el.scrollWidth > el.clientWidth && size > 28) { size -= 4; el.style.fontSize = size + "px"; } } return names.map((n) => document.fonts.check('84px "' + n + '"') && [...document.fonts].some((f) => f.family.replace(/["']/g, "") === n && f.status === "loaded")); })()`,
  returnByValue: true,
  awaitPromise: true,
});
await sleep(300);
const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: WIDTH, height, scale: 1 } });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(JSON.stringify({ loaded: check.result?.value ?? fonts.map(() => false) }));
done(0);
