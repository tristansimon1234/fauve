#!/usr/bin/env python3
"""Merge a new model's branch into main's catalogue files by transplanting its entries (never by lines): for each
catalogue file, main's version is kept and every entry the branch added (a model, its HOUSE_WHEN line, its effect line,
its measures, a font pair, a skill import and entry) is copied whole, before the end of its list. Usage:
transplant.py <repo> <branch>; run while the merge is in progress (after `git merge --no-commit`)."""
import re, subprocess, sys
root, branch = sys.argv[1], sys.argv[2]
def show(rev, path):
    return subprocess.run(["git", "-C", root, "show", f"{rev}:{path}"], capture_output=True, text=True, check=True).stdout
def balanced(text, start, open_ch, close_ch):
    depth = 0
    i = start
    in_str = None
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "\\": i += 2; continue
            if c == in_str: in_str = None
        elif c == "/" and text[i + 1:i + 2] == "/":
            i = text.index("\n", i); continue
        elif c == "/" and text[i + 1:i + 2] == "*":
            i = text.index("*/", i) + 2; continue
        elif c in "\"'`": in_str = c
        elif c == open_ch: depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0: return i
        i += 1
    raise ValueError("unbalanced")
def entries(text, list_start, list_end, opener):
    """The blocks of a list between list_start and list_end, each starting at a line matching opener (regex at line start)."""
    out = []
    for m in re.finditer(opener, text[list_start:list_end], re.M):
        s = list_start + m.start()
        brace = text.index("{", s) if "{" in m.group(0) else None
        out.append((s, m))
    return out
ours_path = lambda p: f"{root}/{p}"
changed = []
# 1. house-models.ts: model({ ... }) entries of HOUSE_MODELS, by key; HOUSE_WHEN one-line entries, by key.
p = "packages/agent/src/house-models.ts"
ours = open(ours_path(p), encoding="utf-8").read(); theirs = show(branch, p)
def models(text):
    a = text.index("export const HOUSE_MODELS"); z = text.index("\n];", a)
    found = {}
    for m in re.finditer(r"^  model\(\{\n    key: \"([a-z0-9-]+)\",", text[a:z], re.M):
        s = a + m.start(); e = balanced(text, s + 2, "(", ")")
        # include the trailing "," and newline
        e2 = text.index("\n", e) + 1
        found[m.group(1)] = text[s:e2]
    return found, z
om, oz = models(ours); tm, _ = models(theirs)
add = [v for k, v in tm.items() if k not in om]
if add:
    ours = ours[:oz + 1] + "".join(add) + ours[oz + 1:]
    changed.append(f"{p}: {len(add)} model(s)")
def when(text):
    a = text.index("export const HOUSE_WHEN"); z = text.index("\n};", a)
    return {m.group(1): m.group(0) for m in re.finditer(r'^  "?([a-z0-9-]+)"?: \{ pour:.*$', text[a:z], re.M)}, z
ow, owz = when(ours); tw, _ = when(theirs)
addw = [v for k, v in tw.items() if k not in ow]
if addw:
    ours = ours[:owz + 1] + "\n".join(addw) + "\n" + ours[owz + 1:]
    changed.append(f"{p}: {len(addw)} HOUSE_WHEN line(s)")
open(ours_path(p), "w", encoding="utf-8").write(ours)
# 2. house-effects.ts: "key": { effet, il_faut } blocks of HOUSE_EFFECTS.
p = "packages/agent/src/house-effects.ts"
ours = open(ours_path(p), encoding="utf-8").read(); theirs = show(branch, p)
def effects(text):
    a = text.index("export const HOUSE_EFFECTS"); a = text.index("{", text.index("=", a)); z = balanced(text, a, "{", "}")
    found = {}
    for m in re.finditer(r'^  "?([a-z0-9-]+)"?: \{', text[a:z], re.M):
        s = a + m.start(); e = balanced(text, a + m.end() - 1, "{", "}")
        found[m.group(1)] = text[s:text.index("\n", e) + 1]
    return found, z
oe, oz = effects(ours); te, _ = effects(theirs)
adde = [v for k, v in te.items() if k not in oe]
if adde:
    line_start = ours.rfind("\n", 0, oz) + 1
    ours = ours[:line_start] + "".join(adde) + ours[line_start:]
    changed.append(f"{p}: {len(adde)} effect(s)")
open(ours_path(p), "w", encoding="utf-8").write(ours)
# 3. house-measures.ts: "key": { duration … } entries (one line or several, with the comment lines just before them).
p = "packages/agent/src/house-measures.ts"
ours = open(ours_path(p), encoding="utf-8").read(); theirs = show(branch, p)
def measures(text):
    a = text.index("export const HOUSE_MEASURES"); a = text.index("{", text.index("=", a)); z = balanced(text, a, "{", "}")
    found = {}
    for m in re.finditer(r'^  "?([a-z0-9-]+)"?: \{', text[a:z], re.M):
        s0 = a + m.start(); e = balanced(text, a + m.end() - 1, "{", "}")
        # its comment lines just before it
        s1 = s0
        while True:
            prev = text.rfind("\n", 0, s1 - 1) + 1
            if text[prev:s1].startswith("  //"): s1 = prev
            else: break
        found[m.group(1)] = text[s1:text.index("\n", e) + 1]
    return found, z
om_, oz = measures(ours); tm_, _ = measures(theirs)
addm = [v for k, v in tm_.items() if k not in om_]
if addm:
    line_start = ours.rfind("\n", 0, oz) + 1
    ours = ours[:line_start] + "".join(addm) + ours[line_start:]
    changed.append(f"{p}: {len(addm)} measure(s)")
open(ours_path(p), "w", encoding="utf-8").write(ours)
# 4. font-pairs.ts: { … key: "pair" … } entries of FONT_PAIRS, by key.
p = "packages/agent/src/font-pairs.ts"
ours = open(ours_path(p), encoding="utf-8").read(); theirs = show(branch, p)
def pairs(text):
    a = text.index("export const FONT_PAIRS"); a = text.index("[", text.index("=", a)); z = balanced(text, a, "[", "]")
    found = {}
    for m in re.finditer(r"^  \{\n", text[a:z], re.M):
        s = a + m.start(); e = balanced(text, s + 2, "{", "}")
        block = text[s:text.index("\n", e) + 1]
        k = re.search(r'key: "([a-z0-9-]+)"', block)
        if k: found[k.group(1)] = block
    return found, z
op, oz = pairs(ours); tp, _ = pairs(theirs)
addp = [v for k, v in tp.items() if k not in op]
if addp:
    line_start = ours.rfind("\n", 0, oz) + 1
    ours = ours[:line_start] + "".join(addp) + ours[line_start:]
    changed.append(f"{p}: {len(addp)} pair(s)")
open(ours_path(p), "w", encoding="utf-8").write(ours)
# 5. skill-library.ts: import lines and map entries.
p = "packages/agent/src/skill-library.ts"
ours = open(ours_path(p), encoding="utf-8").read(); theirs = show(branch, p)
imp = r'^import \{ [A-Za-z]+ \} from "\./skills/[a-z0-9-]+\.ts";$'
oi = set(re.findall(imp, ours, re.M)); addi = [l for l in re.findall(imp, theirs, re.M) if l not in oi]
if addi:
    last = list(re.finditer(imp, ours, re.M))[-1]
    ours = ours[:last.end() + 1] + "\n".join(addi) + "\n" + ours[last.end() + 1:]
a = ours.index("export const MONTAGE_SKILLS"); z = ours.index("\n};", a)
ent = r'^  ("?[a-z0-9-]+"?)(: [A-Za-z]+)?,$'
ok_ = {m.group(1).strip('"') for m in re.finditer(ent, ours[a:z], re.M)}
ta = theirs.index("export const MONTAGE_SKILLS"); tz = theirs.index("\n};", ta)
adds = [m.group(0) for m in re.finditer(ent, theirs[ta:tz], re.M) if m.group(1).strip('"') not in ok_]
if adds:
    ours = ours[:z + 1] + "\n".join(adds) + "\n" + ours[z + 1:]
if addi or adds: changed.append(f"{p}: {len(addi)} import(s), {len(adds)} entr(y/ies)")
open(ours_path(p), "w", encoding="utf-8").write(ours)
print("; ".join(changed) or "nothing to transplant")
