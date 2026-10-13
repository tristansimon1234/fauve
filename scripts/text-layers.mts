// Fauve's house text layers (supabase/seed/text-layers/*.tsx): checks each one
// like a generated layer, transpiles it, and writes the library rows.
// Usage: node scripts/text-layers.mts [--sql]
//   default: writes supabase/seed/text-layers.json (id, name, description, slots, fonts, sample, code, js)
//   --sql:   prints an idempotent upsert into motion_templates (studio_id null, kind « layer »)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { transform } from "sucrase";
import { checkLayerCode, layerSlotSchema } from "../packages/agent/src/text-layer.ts";

const dir = new URL("../supabase/seed/text-layers/", import.meta.url);
const layers = readdirSync(dir)
  .filter((f) => f.endsWith(".tsx"))
  .sort()
  .map((file) => {
    const source = readFileSync(new URL(file, dir), "utf8");
    const [first, ...rest] = source.split("\n");
    const meta = JSON.parse(first!.replace(/^\/\/ @layer /, ""));
    const code = rest.join("\n").trim();
    const problems = checkLayerCode(code);
    if (problems.length) throw new Error(`${file}: ${problems.join(", ")}`);
    for (const slot of meta.slots) layerSlotSchema.parse(slot);
    const js = transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "classic", production: true }).code;
    return { ...meta, code, js };
  });

if (process.argv.includes("--sql")) {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const rows = layers.map(
    (l) =>
      // The source stays in the repo; the library only needs what runs.
      `(${q(l.id)}, null, 'layer', ${q(l.name)}, ${q(l.description)}, ${q(JSON.stringify(l.slots))}::jsonb, '', ${q(l.js)}, '{${l.fonts.join(",")}}')`,
  );
  console.log(
    `insert into public.motion_templates (id, studio_id, kind, name, description, slots, code, js, fonts) values\n${rows.join(",\n")}\non conflict (id) do update set name = excluded.name, description = excluded.description, slots = excluded.slots, code = excluded.code, js = excluded.js, fonts = excluded.fonts;`,
  );
} else {
  writeFileSync(new URL("../supabase/seed/text-layers.json", import.meta.url), `${JSON.stringify(layers, null, 2)}\n`);
  console.log(`${layers.length} layers`);
}
