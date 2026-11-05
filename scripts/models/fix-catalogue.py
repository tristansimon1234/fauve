#!/usr/bin/env python3
"""After a union merge of two new models' catalogue entries: put back the closing lines git shared between them, and
resolve the features.test.ts counters (the sheets record, the pairs count) by keeping every key."""
import re, sys
root = sys.argv[1] if len(sys.argv) > 1 else "."
# house-effects.ts: an entry opening right after the previous one's il_faut line lacks its closing "  },".
p = f"{root}/packages/agent/src/house-effects.ts"
lines = open(p, encoding="utf-8").read().split("\n")
out = []
for k, l in enumerate(lines):
    if re.match(r'^  "?[a-z][a-z0-9-]*"?: \{$', l) and out and out[-1].strip().startswith("il_faut:"):
        out.append("  },")
    out.append(l)
open(p, "w", encoding="utf-8").write("\n".join(out))
# house-models.ts: a model whose key line follows the previous one's « why » line lacks "    },", "  }),", "  model({".
p = f"{root}/packages/agent/src/house-models.ts"
lines = open(p, encoding="utf-8").read().split("\n")
out = []
for l in lines:
    if re.match(r'^    key: "[a-z][a-z0-9-]*",$', l) and out and out[-1].strip().startswith("why:"):
        out += ["    },", "  }),", "  model({"]
    out.append(l)
open(p, "w", encoding="utf-8").write("\n".join(out))
# features.test.ts: conflicts on the sheets record (keep every key) and on the pairs count (the larger, the comment of HEAD).
p = f"{root}/packages/agent/src/features.test.ts"
s = open(p, encoding="utf-8").read()
def made(m):
    a, b = m.group(1), m.group(2)
    pairs = {}
    for side in (a, b):
        body = re.search(r"\{(.*)\}", side).group(1)
        for kv in re.finditer(r'("?[a-z][a-z0-9-]*"?): (\d+)', body):
            pairs[kv.group(1)] = kv.group(2)
    return "  const made: Record<string, number> = { " + ", ".join(f"{k}: {v}" for k, v in pairs.items()) + " };\n"
def made2(m):
    class G:
        def __init__(self, a, b): self.a, self.b = a, b
        def group(self, i): return self.a if i == 1 else self.b
    return made(G(m.group(1), m.group(3))) + (m.group(2) or "") + (m.group(4) or "")
s = re.sub(r"<<<<<<< HEAD\n(  const made: Record<string, number> = \{[^\n]*\};)\n((?:(?!=======)[^\n]*\n)*)=======\n(  const made: Record<string, number> = \{[^\n]*\};)\n((?:(?!>>>>>>>)[^\n]*\n)*)>>>>>>> [^\n]*\n", made2, s)
open(p, "w", encoding="utf-8").write(s)
left = s.count("<<<<<<<")
print("conflicts left in features.test.ts:", left)

# font-pairs.ts: an entry (its comment or its key) right after the previous one's « fits » line lacks "  }," and "  {".
p = f"{root}/packages/agent/src/font-pairs.ts"
lines = open(p, encoding="utf-8").read().split("\n")
out = []
for l in lines:
    if (l.startswith("    // ") or re.match(r'^    key: "', l)) and out and out[-1].strip().startswith("fits:"):
        out += ["  },", "  {"]
    out.append(l)
open(p, "w", encoding="utf-8").write("\n".join(out))
pairs = len(re.findall(r'^    key: "', "\n".join(out[: next((i for i, l in enumerate(out) if l.startswith("];")), len(out))]), flags=re.M))
# features.test.ts: the pairs count conflict, set to the real count, the comments joined.
p = f"{root}/packages/agent/src/features.test.ts"
s = open(p, encoding="utf-8").read()
def pairs_count(m):
    return "  // The pairs of the font library, the new models' added as they come (November 5 and after).\n  assert.equal(FONT_PAIRS.length, %d);\n" % pairs
s = re.sub(r"<<<<<<< HEAD\n(?:  //[^\n]*\n)*  assert.equal\(FONT_PAIRS.length, \d+\);\n=======\n(?:  //[^\n]*\n)*  assert.equal\(FONT_PAIRS.length, \d+\);\n>>>>>>> [^\n]*\n", pairs_count, s)
open(p, "w", encoding="utf-8").write(s)
print("pairs:", pairs, "conflicts left:", s.count("<<<<<<<"))
