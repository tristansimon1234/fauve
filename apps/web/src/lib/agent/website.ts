import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { extractBrandStyle, extractSiteInfo, stylesheetLinks, type BrandStyle, type SiteInfo } from "@fauve/agent";

// The URL comes from a WhatsApp message: only public web pages, never our own network.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 127],
  ["::ffff:0:0", 96], // IPv4-mapped: checked as IPv4 below
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 4;

export class WebsiteError extends Error {}

function parseUrl(input: string): URL {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new WebsiteError("Adresse invalide");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new WebsiteError("Seuls les liens http(s) sont acceptés");
  if (url.port && url.port !== "80" && url.port !== "443") throw new WebsiteError("Port non autorisé");
  if (url.username || url.password) throw new WebsiteError("Adresse invalide");
  return url;
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new WebsiteError("Site introuvable");
  for (const { address, family } of addresses) {
    const mapped = family === 6 ? address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] : undefined;
    const isBlocked = mapped
      ? blocked.check(mapped, "ipv4")
      : blocked.check(address, family === 6 ? "ipv6" : "ipv4");
    if (isBlocked) throw new WebsiteError("Adresse non autorisée");
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

async function fetchPublic(input: string, accept: RegExp, signal: AbortSignal): Promise<{ url: string; body: string }> {
  let url = parseUrl(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; FauveBot/1.0; +https://fauve-one.vercel.app)",
        accept: "text/html,application/xhtml+xml,text/css;q=0.9",
        "accept-language": "fr-FR,fr;q=0.9",
      },
    }).catch((e: unknown) => {
      throw new WebsiteError(
        e instanceof Error && e.name === "TimeoutError" ? "Le site met trop de temps à répondre" : "Site injoignable",
      );
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = parseUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new WebsiteError(`Le site répond ${res.status}`);
    if (!accept.test(res.headers.get("content-type") ?? "")) throw new WebsiteError("Ce lien n'est pas une page web");
    return { url: url.toString(), body: await readCapped(res) };
  }
  throw new WebsiteError("Trop de redirections");
}

export type WebsiteReading = SiteInfo & { style: BrandStyle };

/** Fetches a public web page and extracts what Fauve needs from it: content, links, colours and fonts. */
export async function readWebsite(input: string): Promise<WebsiteReading> {
  const signal = AbortSignal.timeout(15_000);
  const page = await fetchPublic(input, /text\/html|application\/xhtml/i, signal);
  const css = await Promise.all(
    stylesheetLinks(page.body, page.url).map((href) =>
      fetchPublic(href, /text\/css|text\/plain/i, signal)
        .then((r) => r.body)
        .catch(() => ""),
    ),
  );
  return { ...extractSiteInfo(page.body, page.url), style: extractBrandStyle(page.body, css) };
}
