// Carousel slides: photos with their texts, rendered as JPEG stills by the Reel
// composition, in the render sandbox. Usage: node stills.mjs jobs.json [bundle-dir]
// jobs.json: [{ id, out, frame, props }] → prints {"<id>": null | "error"}.
// One browser for every slide (a still is then a second or two).
import { readFileSync } from "node:fs";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const bundle = new URL(process.argv[3] ?? "./build", new URL(`file://${process.cwd()}/`)).pathname;
const browserExecutable = process.env.BROWSER_EXECUTABLE ?? null;
const browser = await openBrowser("chrome", { browserExecutable, logLevel: "error" });
const results = {};
try {
  for (const job of jobs) {
    try {
      const composition = await selectComposition({ serveUrl: bundle, id: "Reel", inputProps: job.props, puppeteerInstance: browser, browserExecutable, logLevel: "error" });
      await renderStill({
        serveUrl: bundle,
        composition,
        inputProps: job.props,
        frame: job.frame,
        output: job.out,
        imageFormat: "jpeg",
        jpegQuality: 92,
        puppeteerInstance: browser,
        browserExecutable,
        logLevel: "error",
        timeoutInMilliseconds: 60000,
      });
      results[job.id] = null;
    } catch (error) {
      results[job.id] = String(error instanceof Error ? error.message : error).slice(0, 600);
    }
  }
} finally {
  await browser.close({ silent: true });
}
console.log(JSON.stringify(results));
