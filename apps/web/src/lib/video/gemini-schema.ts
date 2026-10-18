import { z } from "zod";

/** A Zod schema as Gemini's structured output takes it: JSON Schema without the keywords it refuses. */
export function geminiSchema(schema: z.ZodType): unknown {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$schema" && key !== "additionalProperties")
        .map(([key, v]) => [key, strip(v)]),
    );
  };
  return strip(z.toJSONSchema(schema));
}
