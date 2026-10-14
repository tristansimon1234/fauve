import { z } from "zod";

// What Fauve keeps about a business across conversations (studios.memory): short
// facts the manager gave or Fauve read on the website. Shown in Fauve's context on
// every turn, and in Style where the manager can read and remove them.

export const MAX_FACTS = 40;
export const MAX_FACT_CHARS = 240;

export const memoryFactSchema = z.object({ fact: z.string().min(1).max(MAX_FACT_CHARS), at: z.string() });
export type MemoryFact = z.infer<typeof memoryFactSchema>;

/** A stored memory, tolerant of anything malformed. */
export function readMemory(raw: unknown): MemoryFact[] {
  return (Array.isArray(raw) ? raw : []).flatMap((f) => {
    const parsed = memoryFactSchema.safeParse(f);
    return parsed.success ? [parsed.data] : [];
  });
}

const key = (fact: string) => fact.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Adds facts (a fact already known is not repeated); past the cap, the oldest go. */
export function addFacts(memory: MemoryFact[], facts: string[], at: string): MemoryFact[] {
  const known = new Set(memory.map((f) => key(f.fact)));
  const added = facts
    .map((f) => f.trim().replace(/\s+/g, " ").slice(0, MAX_FACT_CHARS))
    .filter((f) => {
      const k = key(f);
      if (!k || known.has(k)) return false;
      known.add(k);
      return true;
    })
    .map((fact) => ({ fact, at }));
  return [...memory, ...added].slice(-MAX_FACTS);
}

/** Removes facts by their number in the context (1-based). */
export function removeFacts(memory: MemoryFact[], numbers: number[]): MemoryFact[] {
  const gone = new Set(numbers);
  return memory.filter((_, i) => !gone.has(i + 1));
}
