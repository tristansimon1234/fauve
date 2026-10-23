// Stills of the Reel composition, as JPEGs, in the render sandbox: carousel slides (photos
// with their texts), or frames of a Reel (the motion designer looking at its animations
// over her footage). Usage: node stills.mjs jobs.json [bundle-dir]
// jobs.json: [{ id, out, frame, props, scale? }], or { props, jobs: [{ id, out, frame, scale? }] }
// for frames of one Reel → prints {"<id>": null | "error"}.
// One browser for every still (a still is then a second or two).
import { readFileSync } from "node:fs";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const jobs = Array.isArray(input) ? input : input.jobs.map((job) => ({ ...job, props: input.props }));
const bundle = new URL(process.argv[3] ?? "./build", new URL(`file://${process.cwd()}/`)).pathname;
const browserExecutable = process.env.BROWSER_EXECUTABLE ?? null;
const browser = await openBrowser("chrome", { browserExecutable, logLevel: "error" });
const results = {};
// One Reel's frames share its props: its composition is selected once.
const compositions = new Map();
try {
  for (const job of jobs) {
    try {
      const composition =
        compositions.get(job.props) ??
        (await selectComposition({ serveUrl: bundle, id: "Reel", inputProps: job.props, puppeteerInstance: browser, browserExecutable, logLevel: "error" }));
      compositions.set(job.props, composition);
      await renderStill({
        serveUrl: bundle,
        composition,
        inputProps: job.props,
        frame: job.frame,
        output: job.out,
        imageFormat: "jpeg",
        jpegQuality: 92,
        scale: job.scale ?? 1,
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
