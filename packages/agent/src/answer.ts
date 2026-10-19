import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// A model's JSON answer is read as written, then brought within its schema's limits. The API
// compiles only the shape of a structured output into its grammar (types, required fields, a
// few formats): the SDK moves lengths, patterns, bounds, item counts and even the lists of
// allowed values into the descriptions, then parses the answer with the whole Zod schema. One
// critic's sentence of 301 characters failed that parse and lost a carousel whose slides were
// already rendered; a site reading lost its art direction to a music brief of 90 characters.
// Gemini is given the same limits as words. So an answer that misses one is repaired before it
// is parsed: a text cut at a word, a list shortened, a number rounded or clamped, an option
// matched without its case or accents (else its default, else the first of its list when it is
// required), an optional field left out, an item that cannot be kept dropped from its list.
// Only an answer that cannot be repaired fails, with the error of its first reading.

type Node = { [key: string]: unknown };
const DROP = Symbol("drop");
type Repaired = { value: unknown; changes: number } | typeof DROP;

/** Room kept inside an exclusive bound. */
const EXCLUSIVE_STEP = 0.001;

const limits = new WeakMap<z.ZodType, Node>();

/** The schema as JSON Schema with all its limits, as it reads an input (a field with a default may be absent). */
function limitsOf(schema: z.ZodType): Node {
  let found = limits.get(schema);
  if (!found) {
    found = z.toJSONSchema(schema, { io: "input", reused: "ref", unrepresentable: "any" }) as Node;
    limits.set(schema, found);
  }
  return found;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
const same = (a: unknown, b: unknown) => a === b || (typeof a === "object" && a !== null && JSON.stringify(a) === JSON.stringify(b));

function jsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

/** "#/$defs/name" (or "#", the whole schema) with the keywords written next to the reference. */
function resolve(node: Node, root: Node): Node {
  const { $ref, ...rest } = node;
  if (typeof $ref !== "string") return node;
  const path = $ref.replace(/^#\/?/, "").split("/").filter(Boolean);
  let target: unknown = root;
  for (const key of path) target = (target as Node | undefined)?.[decodeURIComponent(key)];
  return target && typeof target === "object" ? { ...resolve(target as Node, root), ...rest } : rest;
}

/** A text cut to n characters: at the end of a word when one ends close enough, never inside a character. */
function cut(text: string, n: number): string {
  let end = n;
  if (end > 0 && /[\uD800-\uDBFF]/.test(text[end - 1] ?? "")) end -= 1;
  const head = text.slice(0, end);
  const space = head.lastIndexOf(" ");
  const kept = /\s/.test(text[end] ?? " ") || space < end * 0.4 ? head : head.slice(0, space);
  return kept.replace(/[\s,;:–—-]+$/u, "");
}

/** What stands for a required choice the model wrote off its list: the first of the list. */
function standIn(node: Node, root: Node): unknown {
  const target = resolve(node, root);
  return Array.isArray(target.enum) && target.enum.length > 1 ? target.enum[0] : undefined;
}

function repairString(text: string, node: Node): Repaired {
  let value = text;
  let changes = 0;
  if (typeof node.maxLength === "number" && value.length > node.maxLength) {
    value = cut(value, node.maxLength);
    changes++;
  }
  if (typeof node.pattern === "string") {
    let pattern: RegExp | null = null;
    try {
      pattern = new RegExp(node.pattern);
    } catch {
      pattern = null;
    }
    if (pattern && !pattern.test(value)) {
      const trimmed = value.trim();
      if (trimmed === value || !pattern.test(trimmed)) return DROP;
      value = trimmed;
      changes++;
    }
  }
  if (typeof node.minLength === "number" && value.length < node.minLength) return DROP;
  return { value, changes };
}

function repairNumber(number: number, node: Node, integer: boolean): Repaired {
  let value = number;
  let changes = 0;
  if (!Number.isFinite(value)) return DROP;
  if (integer && !Number.isInteger(value)) {
    value = Math.round(value);
    changes++;
  }
  const step = node.multipleOf;
  if (typeof step === "number" && step > 0 && Math.abs(value / step - Math.round(value / step)) > 1e-9) {
    value = Math.round(value / step) * step;
    changes++;
  }
  const room = integer ? 1 : EXCLUSIVE_STEP;
  const low = typeof node.minimum === "number" ? node.minimum : typeof node.exclusiveMinimum === "number" ? node.exclusiveMinimum + room : -Infinity;
  const high = typeof node.maximum === "number" ? node.maximum : typeof node.exclusiveMaximum === "number" ? node.exclusiveMaximum - room : Infinity;
  if (value < low) {
    value = low;
    changes++;
  } else if (value > high) {
    value = high;
    changes++;
  }
  return { value, changes };
}

function repairArray(list: unknown[], node: Node, root: Node): Repaired {
  const prefix = Array.isArray(node.prefixItems) ? (node.prefixItems as Node[]) : [];
  const items: unknown[] = [];
  let changes = 0;
  for (const [i, item] of list.entries()) {
    const repaired = within(item, i < prefix.length ? prefix[i] : (node.items as Node | boolean | undefined), root);
    if (repaired === DROP) {
      // A tuple keeps its places: one it cannot keep fails it; an item of a list leaves the list.
      if (i < prefix.length) return DROP;
      changes++;
      continue;
    }
    items.push(repaired.value);
    changes += repaired.changes;
  }
  if (typeof node.maxItems === "number" && items.length > node.maxItems) {
    items.length = node.maxItems;
    changes++;
  }
  if (typeof node.minItems === "number" && items.length < node.minItems) return DROP;
  return { value: items, changes };
}

function repairObject(input: Record<string, unknown>, node: Node, root: Node): Repaired {
  const properties = (node.properties ?? {}) as Record<string, Node>;
  const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
  const extra = node.additionalProperties;
  const names = node.propertyNames as Node | undefined;
  // A required field the answer does not have rules this shape out (a variant of a union among others).
  for (const key of required) if (!Object.hasOwn(input, key) && !("default" in resolve(properties[key] ?? {}, root))) return DROP;
  const out: Record<string, unknown> = {};
  let changes = 0;
  for (const [key, item] of Object.entries(input)) {
    if (Object.hasOwn(properties, key)) {
      const repaired = within(item, properties[key], root);
      if (repaired !== DROP) {
        out[key] = repaired.value;
        changes += repaired.changes;
        continue;
      }
      changes++;
      // Left out: an optional field, or one whose default the schema fills in.
      if (!required.has(key)) continue;
      const stand = standIn(properties[key]!, root);
      if (stand === undefined) return DROP;
      out[key] = stand;
      continue;
    }
    if (extra && typeof extra === "object") {
      // A record: an entry whose key does not fit, or whose value cannot be kept, leaves it.
      const name = names ? within(key, names, root) : { value: key, changes: 0 };
      const repaired = name !== DROP && name.changes === 0 ? within(item, extra as Node, root) : DROP;
      if (repaired === DROP) {
        changes++;
        continue;
      }
      out[key] = repaired.value;
      changes += repaired.changes;
      continue;
    }
    // A closed shape leaves out what it does not know; an open one lets the schema decide.
    if (extra === false) {
      changes++;
      continue;
    }
    out[key] = item;
  }
  return { value: out, changes };
}

/** The value brought within one node of the schema, with the number of changes made, or DROP. */
function within(value: unknown, schema: Node | boolean | undefined, root: Node): Repaired {
  if (schema === undefined || schema === true) return { value, changes: 0 };
  if (schema === false) return DROP;
  const node = resolve(schema, root);
  const variants = (Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : null) as Node[] | null;
  if (variants) {
    // The variant the answer fits with the fewest changes (a discriminator that differs rules one out).
    let best: Repaired = DROP;
    for (const variant of variants) {
      const repaired = within(value, variant, root);
      if (repaired !== DROP && (best === DROP || repaired.changes < best.changes)) best = repaired;
      if (best !== DROP && best.changes === 0) break;
    }
    return best;
  }
  if (Array.isArray(node.allOf)) {
    let current: Repaired = { value, changes: 0 };
    for (const part of node.allOf as Node[]) {
      if (current === DROP) return DROP;
      const repaired: Repaired = within(current.value, part, root);
      current = repaired === DROP ? DROP : { value: repaired.value, changes: current.changes + repaired.changes };
    }
    return current;
  }

  const kind = jsonType(value);
  const types = (Array.isArray(node.type) ? node.type : typeof node.type === "string" ? [node.type] : null) as string[] | null;
  const integer = Boolean(types?.includes("integer") && !types.includes("number"));
  if (types && !types.includes(kind) && !((kind === "integer" || kind === "number") && (types.includes("number") || types.includes("integer")))) return DROP;
  if ("const" in node && !same(node.const, value)) return DROP;
  if (Array.isArray(node.enum) && !node.enum.some((option) => same(option, value))) {
    // A single value is a discriminator: it rules the answer out. A list forgives the case and accents.
    const match = typeof value === "string" && node.enum.length > 1 ? node.enum.find((option) => typeof option === "string" && fold(option) === fold(value)) : undefined;
    return match === undefined ? DROP : { value: match, changes: 1 };
  }
  if (kind === "string") return repairString(value as string, node);
  if (kind === "number" || kind === "integer") return repairNumber(value as number, node, integer);
  if (kind === "array") return repairArray(value as unknown[], node, root);
  if (kind === "object") return repairObject(value as Record<string, unknown>, node, root);
  return { value, changes: 0 };
}

/** The value brought within the schema's limits (not parsed yet), or null when it cannot be. */
export function withinLimits(schema: z.ZodType, value: unknown): unknown {
  const root = limitsOf(schema);
  const repaired = within(value, root, root);
  return repaired === DROP ? null : repaired.value;
}

/**
 * A model's JSON answer parsed with its schema: as written when it passes, otherwise brought
 * within the schema's limits first. Throws the first reading's error when it cannot be repaired.
 */
export function readAnswer<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const first = schema.safeParse(value);
  if (first.success) return first.data;
  const root = limitsOf(schema);
  const repaired = within(value, root, root);
  if (repaired !== DROP) {
    const second = schema.safeParse(repaired.value);
    if (second.success) {
      const missed = first.error.issues.slice(0, 6).map((issue) => `${issue.path.join(".")} ${issue.message}`);
      console.warn("model answer brought within its limits:", missed.join(" ; "));
      return second.data;
    }
  }
  throw first.error;
}

/** The SDK's structured output format for a schema, with its answer read by readAnswer. */
export function outputFormat<T extends z.ZodType>(schema: T): ReturnType<typeof betaZodOutputFormat<T>> {
  return { ...betaZodOutputFormat(schema), parse: (content: string) => readAnswer(schema, JSON.parse(content)) };
}
