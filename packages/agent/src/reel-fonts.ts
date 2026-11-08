import type { EditPlan } from "./schemas.ts";
import { LOOK_FONT } from "./text-look.ts";

// A Reel's fonts or text colour changed without making it again (Tristan, 7 November: « Met ma police please » had
// launched a whole paid correction, the editor and the motion designer again, 0,77 €, for « le reste du Reel ne bouge
// pas »). A change of font or colour is a setting of the Reel, like the words of a text (« Changer les mots ou la place
// d'un texte refait la vidéo… gratuitement »): the plan gets its new fonts (plan.fonts, or none for her charter), its
// texts' looks follow them by role, and a composition that names a family or a text colour in its code has those words
// of its code changed in place, deterministically (never written again by a model), then checked by the scene check
// before the video is made again (lib/agent/reel-fonts.ts). Free: no credit is debited. docs/marque.md, « Police et
// couleurs d'un Reel changées sans le refaire ».

/** What she asks: her charter's fonts back (« remets ma police »), a title or text font, a text colour, her charter's colours back. */
export type FontChange = {
  /** Her charter's two fonts back (« remets ma police », « mets ma typo »). */
  charter?: boolean;
  /** A Google Fonts family for its titles. */
  display?: string;
  /** A Google Fonts family for its other texts. */
  body?: string;
  /** Its texts' colour (#rrggbb). */
  color?: string;
  /** Her charter's colours back (the Reel's own colours, plan.colors, dropped). */
  charterColors?: boolean;
};

export type ReelFontPair = { display: string; body: string };

/** What a font change did to the plan: its compositions whose code was changed (their index in plan.layers), and a text colour that no code line held. */
export type ReelFontsResult = { plan: EditPlan; rewritten: number[]; colorMissed: boolean; changed: boolean };

/** A look's patch that only changes a font or a colour (the free path on a Reel whose composition draws its texts). */
export function fontOrColorOnly(patch: Record<string, unknown> | undefined): boolean {
  if (!patch) return false;
  const given = Object.entries(patch).filter(([, v]) => v !== undefined && v !== null);
  if (!given.length) return false;
  return given.every(([k, v]) => {
    if (k === "font" || k === "color") return typeof v === "string";
    if (k === "emphasis") return typeof v === "object" && v !== null && Object.keys(v).every((e) => e === "font" || e === "color");
    return false;
  });
}

// ——— A small reader of JS source: its string literals and its tokens ————————————————————————————————————————————

type Literal = { start: number; end: number };
type Token = { kind: "string" | "ident" | "punct" | "number" | "template"; text: string; start: number; end: number };

/** The characters after which a « / » opens a regular expression rather than a division. */
const BEFORE_REGEX = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_KEYWORDS = new Set(["return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "instanceof", "yield", "await"]);

/**
 * The string literals of a source (each its content, without its quotes; a template's text between its expressions) and
 * its tokens (identifiers, punctuation, strings), comments and regular expressions skipped. Null when it cannot be read
 * to its end (an unclosed string or comment): nothing is changed in it then.
 */
export function readSource(code: string): { literals: Literal[]; tokens: Token[] } | null {
  const literals: Literal[] = [];
  const tokens: Token[] = [];
  // Open template literals, each with the depth of « { » inside its current expression.
  const templates: number[] = [];
  let i = 0;
  const n = code.length;
  const lastSignificant = () => tokens.at(-1);
  const readTemplateText = (from: number): number | null => {
    // From just after « ` » or « } »: its text up to « ${ » or the closing « ` ».
    let j = from;
    while (j < n) {
      const c = code[j]!;
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "`") {
        literals.push({ start: from, end: j });
        tokens.push({ kind: "template", text: code.slice(from, j), start: from, end: j });
        templates.pop();
        return j + 1;
      }
      if (c === "$" && code[j + 1] === "{") {
        literals.push({ start: from, end: j });
        tokens.push({ kind: "template", text: code.slice(from, j), start: from, end: j });
        templates[templates.length - 1] = 0;
        return j + 2;
      }
      j++;
    }
    return null;
  };
  while (i < n) {
    const c = code[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      i = end < 0 ? n : end + 1;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      if (end < 0) return null;
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && code[j] !== c) {
        if (code[j] === "\\") j++;
        else if (code[j] === "\n") return null;
        j++;
      }
      if (j >= n) return null;
      literals.push({ start: i + 1, end: j });
      tokens.push({ kind: "string", text: code.slice(i + 1, j), start: i + 1, end: j });
      i = j + 1;
      continue;
    }
    if (c === "`") {
      templates.push(0);
      const next = readTemplateText(i + 1);
      if (next === null) return null;
      i = next;
      continue;
    }
    if (c === "/") {
      const prev = lastSignificant();
      // « i++ / n »: a division after an increment, never a regular expression.
      const before = tokens.at(-2);
      const step = prev?.kind === "punct" && (prev.text === "+" || prev.text === "-") && before?.text === prev.text && before.end === prev.start;
      const regex = !step && (!prev || (prev.kind === "punct" && BEFORE_REGEX.has(prev.text)) || (prev.kind === "ident" && REGEX_KEYWORDS.has(prev.text)));
      if (regex) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          const r = code[j]!;
          if (r === "\\") j++;
          else if (r === "[") inClass = true;
          else if (r === "]") inClass = false;
          else if (r === "/" && !inClass) break;
          else if (r === "\n") return null;
          j++;
        }
        if (j >= n) return null;
        j++;
        while (j < n && /[a-z]/i.test(code[j]!)) j++;
        tokens.push({ kind: "punct", text: "regex", start: i, end: j });
        i = j;
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(code[j]!)) j++;
      tokens.push({ kind: "ident", text: code.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_.]/.test(code[j]!)) j++;
      tokens.push({ kind: "number", text: code.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }
    // Inside a template's expression: its own braces counted, its closing « } » back to the template's text.
    if (templates.length && c === "{") templates[templates.length - 1]!++;
    if (templates.length && c === "}") {
      if (templates[templates.length - 1] === 0) {
        const next = readTemplateText(i + 1);
        if (next === null) return null;
        i = next;
        continue;
      }
      templates[templates.length - 1]!--;
    }
    tokens.push({ kind: "punct", text: c, start: i, end: i + 1 });
    i++;
  }
  return templates.length ? null : { literals, tokens };
}

/** The source with these spans replaced (non-overlapping, any order). */
function spliced(code: string, edits: { start: number; end: number; text: string }[]): string {
  let out = code;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A composition's code with each font family of `map` changed to its new one, only where a string literal names it as a
 * family (« 'Bebas Neue', sans-serif », « "Anton" », « Anton, serif »), never elsewhere in its code or words. The new
 * names are Google Fonts families (letters, digits and spaces: safe in any quotes). Unchanged when unreadable.
 */
export function rewriteFamilies(code: string, map: Record<string, string>): { code: string; replaced: string[] } {
  const entries = Object.entries(map).filter(([from, to]) => from && to && from !== to && LOOK_FONT.test(to));
  if (!entries.length) return { code, replaced: [] };
  const read = readSource(code);
  if (!read) return { code, replaced: [] };
  const replaced = new Set<string>();
  const edits: { start: number; end: number; text: string }[] = [];
  for (const lit of read.literals) {
    const text = code.slice(lit.start, lit.end);
    let next = text;
    for (const [from, to] of entries) {
      const at = new RegExp(`(^|[,'"]\\s*)${escapeRegex(from)}(?=\\s*(?:[,'"]|$))`, "g");
      const changed = next.replace(at, (_, lead: string) => `${lead}${to}`);
      if (changed !== next) replaced.add(from);
      next = changed;
    }
    if (next !== text) edits.push({ start: lit.start, end: lit.end, text: next });
  }
  return { code: spliced(code, edits), replaced: [...replaced] };
}

/** A literal colour (#rgb, #rrggbb, #rrggbbaa, rgb()/rgba(), or white and black by name). */
const COLOR_LITERAL = /^\s*(?:#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\([^)]*\)|white|black)\s*$/i;
const FONT_KEYS = new Set(["fontFamily", "fontSize", "font"]);

/**
 * A composition's code with its texts' colour changed (Tristan: « change la couleur du texte »): the `color` of each style
 * object that sets a font (fontFamily, fontSize), when it is a colour literal (« color: "#fff3df" ») or a constant holding
 * one (« const TUBE = "#fff3df" », « color: TUBE »); a colour computed or passed in (« color » given to a function) is not
 * changed (`count` 0: the caller says so). Unchanged when unreadable.
 */
export function rewriteTextColors(code: string, color: string): { code: string; count: number } {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { code, count: 0 };
  const read = readSource(code);
  if (!read) return { code, count: 0 };
  const t = read.tokens;
  type Frame = { font: boolean; literals: Token[]; names: string[] };
  const frames: Frame[] = [];
  const literals: Token[] = [];
  const names = new Set<string>();
  for (let k = 0; k < t.length; k++) {
    const tok = t[k]!;
    if (tok.kind === "punct" && tok.text === "{") {
      frames.push({ font: false, literals: [], names: [] });
      continue;
    }
    if (tok.kind === "punct" && tok.text === "}") {
      const frame = frames.pop();
      if (frame?.font) {
        literals.push(...frame.literals);
        frame.names.forEach((x) => names.add(x));
      }
      continue;
    }
    const frame = frames.at(-1);
    if (!frame) continue;
    const prev = t[k - 1];
    const isKey = (tok.kind === "ident" || tok.kind === "string") && prev?.kind === "punct" && (prev.text === "{" || prev.text === ",") && t[k + 1]?.text === ":";
    if (!isKey) continue;
    if (FONT_KEYS.has(tok.text)) frame.font = true;
    if (tok.text !== "color") continue;
    const value = t[k + 2];
    const after = t[k + 3];
    if (!value || !after || after.kind !== "punct" || (after.text !== "," && after.text !== "}")) continue;
    if (value.kind === "string" && COLOR_LITERAL.test(value.text)) frame.literals.push(value);
    else if (value.kind === "ident") frame.names.push(value.text);
  }
  // A constant holding a colour literal, named as a text's colour: « const TUBE = "#fff3df" ».
  for (let k = 0; k + 3 < t.length; k++) {
    const [kw, name, eq, value] = [t[k]!, t[k + 1]!, t[k + 2]!, t[k + 3]!];
    if (!((kw.text === "const" || kw.text === "let" || kw.text === "var") && name.kind === "ident" && names.has(name.text) && eq.text === "=")) continue;
    if (value.kind !== "string" || !COLOR_LITERAL.test(value.text)) continue;
    // Its literal alone (« ; », « , », or the next statement without one); « "#a" + x » holds no single colour.
    const end = t[k + 4];
    if (!end || end.kind === "ident" || (end.kind === "punct" && (end.text === ";" || end.text === "," || end.text === "}"))) literals.push(value);
  }
  const unique = [...new Map(literals.map((l) => [l.start, l])).values()];
  return { code: spliced(code, unique.map((l) => ({ start: l.start, end: l.end, text: color }))), count: unique.length };
}

/** Whether the source compiles as plain JS (a syntax check, nothing run). */
export function parsesAsJs(code: string): boolean {
  try {
    new Function(code);
    return true;
  } catch {
    return false;
  }
}

const BRAND = { display: "brand_display", body: "brand_body" } as const;

/**
 * The plan with its new fonts and text colour, nothing else changed (its shots, cuts, words, music, animations): its
 * fonts (plan.fonts set, or dropped for her charter's), its texts' looks on her two fonts by role (a family of their own
 * becomes « brand_display » for a title or the title font, « brand_body » for the rest), a skill's words in a font of their
 * own (« Une police par mot ») in hers, and each composition of the Reel (a Reel-wide one, never a skill's: its code reads
 * her fonts, never rewritten) with the families its code names changed to the new ones and, for a colour, its texts'
 * colour. `shown`: the two fonts the Reel shows now (resolveReelBrand), `target`: those it will show.
 */
export function withReelFonts(plan: EditPlan, change: FontChange, shown: ReelFontPair, target: ReelFontPair): ReelFontsResult {
  const fontsChange = Boolean(change.charter || change.display || change.body);
  let changed = false;
  const next: EditPlan = { ...plan };
  if (fontsChange) {
    if (change.charter) delete next.fonts;
    else next.fonts = { display: target.display, body: target.body };
    changed = true;
  }
  if (change.charterColors && next.colors) {
    delete next.colors;
    changed = true;
  }
  if (fontsChange) {
    next.texts = plan.texts.map((t) => {
      const look = t.look;
      const own = t.font;
      if (!look && !own) return t;
      const out = { ...t };
      delete out.font;
      if (look) {
        const role = look.font === shown.body || (t.style !== "hook" && look.font !== shown.display) ? BRAND.body : BRAND.display;
        const font = look.font === BRAND.display || look.font === BRAND.body ? look.font : role;
        const emphasis = look.emphasis?.font && look.emphasis.font !== BRAND.display && look.emphasis.font !== BRAND.body ? { ...look.emphasis, font: BRAND.display } : look.emphasis;
        out.look = { ...look, font, ...(emphasis ? { emphasis } : {}) };
      }
      return out;
    });
  }
  if (change.color && /^#[0-9a-f]{6}$/i.test(change.color)) {
    next.texts = (next.texts ?? plan.texts).map((t) => (t.look ? { ...t, look: { ...t.look, color: change.color! } } : t));
    changed = true;
  }
  const rewritten: number[] = [];
  let colorMissed = false;
  if (!plan.skill && plan.layers?.length) {
    next.layers = plan.layers.map((layer, index) => {
      if (!layer.compose || !layer.motion.code) return layer;
      let code = layer.motion.code;
      let js = layer.motion.js;
      let fonts = layer.motion.fonts;
      if (fontsChange) {
        // The families its code names: those it loads besides hers, and her two when written out in its code.
        const map: Record<string, string> = {};
        for (const family of [...(layer.motion.fonts ?? []), shown.display, shown.body]) {
          if (map[family] !== undefined) continue;
          const to = family === shown.body && family !== shown.display ? target.body : target.display;
          if (to !== family) map[family] = to;
        }
        const r = rewriteFamilies(code, map);
        if (r.replaced.length) {
          code = r.code;
          if (js) js = rewriteFamilies(js, map).code;
          // Loaded apart no more: replaced, or now one of the Reel's two fonts (loaded with it).
          fonts = fonts?.filter((f) => !r.replaced.includes(f) && f !== target.display && f !== target.body);
        }
      }
      if (change.color && /^#[0-9a-f]{6}$/i.test(change.color)) {
        const r = rewriteTextColors(code, change.color);
        if (r.count) {
          code = r.code;
          if (js) js = rewriteTextColors(js, change.color).code;
        } else if (layer.motion.draws_texts) colorMissed = true;
      }
      if (code === layer.motion.code) return layer;
      // A change that would not compile where its code did: its code kept as it was.
      if (parsesAsJs(layer.motion.code) && !parsesAsJs(code)) return layer;
      rewritten.push(index);
      changed = true;
      const motion = { ...layer.motion, code, ...(js ? { js } : {}) };
      if (fonts?.length) motion.fonts = fonts;
      else delete motion.fonts;
      return { ...layer, motion };
    });
  }
  return { plan: next, rewritten, colorMissed, changed };
}
