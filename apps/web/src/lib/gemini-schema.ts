/** Gemini accepts a subset of JSON Schema: drop the keywords it does not need (and `drop`, those it may refuse). */
export function toGeminiSchema(value: unknown, drop: string[] = []): unknown {
  if (Array.isArray(value)) return value.map((v) => toGeminiSchema(v, drop));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$schema" && key !== "additionalProperties" && !drop.includes(key))
      .map(([key, v]) => [key, toGeminiSchema(v, drop)]),
  );
}
