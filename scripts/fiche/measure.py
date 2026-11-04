# The measures of an original Reel image by image, before its model is written (Tristan: « ton analyse préalable des
# reels manque réellement », « tu n'as pas tout vu, il y a des trucs qui clignotent »): its format, its cuts at 30
# images a second, its music's tempo and hits and which cuts fall on them, its blinks (a part of the picture that
# lights up for a few images: a sign letter by letter, windows, a flash) and its global flashes and fades, each with
# its time, its share of the picture and where. Read with Gemini's breakdown (house/breakdowns/<key>.json) and the
# sheets of sheet.sh, each event looked at closely before it goes in the fiche (docs/fiches/<key>.md).
# Usage: python3 -I scripts/fiche/measure.py video.mp4 [--json out.json]. Needs ffmpeg, ffprobe and numpy.
import json
import subprocess
import sys

import numpy as np

FPS = 30
W, H = 192, 108
SR = 22050


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", path], capture_output=True, check=True, text=True).stdout
    info = json.loads(out)
    video = next((s for s in info["streams"] if s["codec_type"] == "video"), {})
    num, den = (video.get("r_frame_rate") or "30/1").split("/")
    return {
        "width": int(video.get("width", 0)),
        "height": int(video.get("height", 0)),
        "fps": round(float(num) / float(den or 1), 3),
        "duration": round(float(info["format"]["duration"]), 3),
        "sound": any(s["codec_type"] == "audio" for s in info["streams"]),
    }


def frames_of(path, w, h):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={FPS},scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw[: n * w * h * 3], np.uint8).reshape(n, h, w, 3).astype(np.float32)


def cuts_of(rgb):
    """Its cuts: an image unlike the one before it (its pixels and its colours), far more than its neighbours are."""
    gray = rgb.mean(axis=3)
    n = len(gray)
    diff = np.zeros(n)
    hist_diff = np.zeros(n)
    for i in range(1, n):
        diff[i] = np.abs(gray[i] - gray[i - 1]).mean()
        a = np.histogramdd(rgb[i].reshape(-1, 3), bins=(8, 8, 8), range=((0, 256),) * 3)[0].ravel()
        b = np.histogramdd(rgb[i - 1].reshape(-1, 3), bins=(8, 8, 8), range=((0, 256),) * 3)[0].ravel()
        hist_diff[i] = np.abs(a - b).sum() / (2 * a.sum())
    flagged = []
    for i in range(1, n):
        around = np.concatenate([diff[max(1, i - 6) : i], diff[i + 1 : i + 7]])
        local = np.median(around) if len(around) else 0
        if diff[i] > max(12.0, 3.0 * local + 4) and hist_diff[i] > 0.18:
            flagged.append({"frame": i, "at": round(i / FPS, 3), "change": round(float(diff[i]), 1), "colours": round(float(hist_diff[i]), 2)})
        elif diff[i] > max(18.0, 4.0 * local + 6):
            # A jump cut in the same place (same colours, the picture moved): marked as such.
            flagged.append({"frame": i, "at": round(i / FPS, 3), "change": round(float(diff[i]), 1), "colours": round(float(hist_diff[i]), 2), "same_place": True})
    # Three images or more in a row that each change a lot: not cuts but a fast move (a quick zoom, a whip pan, a
    # camera rushing in), from its first image to its last; one or two: the strongest is the cut.
    cuts, moves, run = [], [], []
    for f in flagged + [None]:
        if f is not None and run and f["frame"] - run[-1]["frame"] <= 1:
            run.append(f)
            continue
        if len(run) >= 3:
            moves.append({"from": run[0]["at"], "to": round((run[-1]["frame"] + 1) / FPS, 3), "images": len(run), "same_place": all(r.get("same_place") for r in run)})
        elif run:
            cuts.append(max(run, key=lambda r: r["change"]))
        run = [f] if f is not None else []
    return cuts, moves, diff


def music_of(path, duration):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    if len(x) < SR:
        return None
    hop, win = 220, 1024
    count = 1 + (len(x) - win) // hop
    window = np.hanning(win)
    spec = np.abs(np.array([np.fft.rfft(x[i * hop : i * hop + win] * window) for i in range(count)]))
    flux = np.concatenate([[0], np.maximum(0, np.diff(np.log1p(spec * 10), axis=0)).sum(axis=1)])
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1 :]
    rate = SR / hop
    at = lambda lag: float(np.interp(lag, np.arange(len(ac)), ac)) if lag < len(ac) - 1 else 0.0
    # Each tempo scored on the beat and its multiples (a groove's off-beats and fills blur one lag only), with a
    # gentle preference for 80 to 130 BPM (half or double a beat reads the same to the ear: both are listed).
    scored = []
    for bpm in np.arange(60, 181, 0.25):
        lag = 60 / bpm * rate
        score = sum(at(k * lag) / k for k in (1, 2, 3, 4))
        scored.append((float(bpm), score))
    values = np.array([v for _, v in scored])
    values = (values - values.mean()) / (values.std() + 1e-9)
    prior = np.array([-((np.log2(b / 105)) / 0.5) ** 2 / 2 for b, _ in scored])
    total = values + prior
    order = np.argsort(-total)
    candidates = []
    for i in order:
        b = scored[i][0]
        if all(abs(b - c) > 3 for c in candidates):
            candidates.append(b)
        if len(candidates) == 3:
            break
    # A pulse past 140 is its eighth notes (a lo-fi beat at 82 BPM reads as 165), under 70 its half notes: told as the
    # beat a dancer counts, between 70 and 140 (the editor's grid then halves or doubles it).
    def folded(b):
        while b >= 140:
            b /= 2
        while b < 70:
            b *= 2
        return b

    pulse = candidates[0]
    candidates = [folded(c) for c in candidates]
    bpm = candidates[0]
    period = 60 / bpm / (hop / SR)
    # Its first beat: the phase where the onsets line up best on its grid.
    phases = np.arange(0, period, 0.5)
    strength = [flux[np.arange(p, len(flux), period).astype(int)].sum() for p in phases]
    offset = phases[int(np.argmax(strength))] * hop / SR
    peaks = [i for i in range(1, len(flux) - 1) if flux[i] > flux[i - 1] and flux[i] >= flux[i + 1] and flux[i] > 2.0]
    hits = [{"at": round(p * hop / SR, 3), "strength": round(float(flux[p]), 1)} for p in peaks]
    loud = np.array([np.sqrt(np.mean(x[i : i + SR // 10] ** 2)) for i in range(0, len(x) - SR // 10, SR // 10)])
    return {"bpm": round(bpm, 2), "pulse": round(pulse, 2), "candidates": [round(c, 2) for c in candidates], "first_beat": round(float(offset), 3), "hits": hits, "loudness_tenths": [round(float(v), 3) for v in loud]}


def blinks_of(gray, cuts):
    """Parts of the picture brighter than just before and just after (a light, a letter, a window, a flash), not at a cut."""
    n = len(gray)
    near_cut = set()
    for c in cuts:
        for d in range(-3, 4):
            near_cut.add(c["frame"] + d)
    events = []
    for i in range(3, n - 5):
        if i in near_cut:
            continue
        before = gray[i - 3 : i].mean(axis=0)
        after = gray[i + 3 : i + 5].mean(axis=0)
        lit = (gray[i] - before > 25) & (gray[i] - after > 20)
        share = float(lit.mean())
        if share > 0.004:
            ys, xs = np.nonzero(lit)
            events.append({"frame": i, "at": round(i / FPS, 3), "share": round(share * 100, 1), "box": [round(xs.min() / W, 2), round(ys.min() / H, 2), round(xs.max() / W, 2), round(ys.max() / H, 2)]})
    # Runs of consecutive images grouped into one event each.
    grouped = []
    for e in events:
        if grouped and e["frame"] - grouped[-1]["to_frame"] <= 1:
            g = grouped[-1]
            g["to_frame"] = e["frame"]
            g["to"] = e["at"]
            g["peak_share"] = max(g["peak_share"], e["share"])
            g["box"] = [min(g["box"][0], e["box"][0]), min(g["box"][1], e["box"][1]), max(g["box"][2], e["box"][2]), max(g["box"][3], e["box"][3])]
            g["images"] += 1
        else:
            grouped.append({"from_frame": e["frame"], "to_frame": e["frame"], "from": e["at"], "to": e["at"], "peak_share": e["share"], "box": e["box"], "images": 1})
    return grouped


def flashes_of(gray, cuts):
    """The whole picture lighting up or going dark (a flash, a fade, a dip to black), image by image."""
    m = gray.mean(axis=(1, 2))
    out = []
    for i in range(2, len(m) - 3):
        up = m[i] - m[i - 2 : i].mean()
        if up > 20 and m[i] - m[i + 2 : i + 4].mean() > 10:
            out.append({"at": round(i / FPS, 3), "kind": "flash", "brightness": round(float(m[i]), 1)})
    dark = [i for i in range(len(m)) if m[i] < 12]
    if dark:
        runs = []
        for i in dark:
            if runs and i - runs[-1][1] <= 1:
                runs[-1][1] = i
            else:
                runs.append([i, i])
        out += [{"at": round(a / FPS, 3), "to": round((b + 1) / FPS, 3), "kind": "black"} for a, b in runs if b - a >= 1]
    light = [i for i in range(len(m)) if m[i] > 243]
    if light:
        runs = []
        for i in light:
            if runs and i - runs[-1][1] <= 1:
                runs[-1][1] = i
            else:
                runs.append([i, i])
        out += [{"at": round(a / FPS, 3), "to": round((b + 1) / FPS, 3), "kind": "white"} for a, b in runs]
    return sorted(out, key=lambda e: e["at"])


def main():
    path = sys.argv[1]
    info = probe(path)
    rgb = frames_of(path, W, H)
    gray = rgb.mean(axis=3)
    cuts, moves, _ = cuts_of(rgb)
    music = music_of(path, info["duration"]) if info["sound"] else None
    if music and len(cuts) >= 4:
        # Between its tempos, the one its cuts fall on best (an edit cut on the beat says its tempo better than the ear).
        def fit(bpm):
            half = 60 / bpm / 2
            best = 0.0
            for phase in np.arange(0, half, 0.005):
                d = [abs(((c["at"] - phase + half / 2) % half) - half / 2) for c in cuts]
                best = max(best, float(np.mean([np.exp(-((x / 0.035) ** 2)) for x in d])))
            return best
        fits = {b: fit(b) for b in music["candidates"]}
        music["cuts_fit"] = {str(b): round(v, 2) for b, v in fits.items()}
        music["bpm"] = max(music["candidates"], key=lambda b: fits[b] + (0.05 if b == music["candidates"][0] else 0))
    if music:
        beat = 60 / music["bpm"]
        for c in cuts:
            near = min(music["hits"], key=lambda h: abs(h["at"] - c["at"])) if music["hits"] else None
            c["beats"] = round((c["at"] - music["first_beat"]) / beat, 2)
            if near:
                c["nearest_hit_ms"] = round((near["at"] - c["at"]) * 1000)
    shots = []
    starts = [0] + [c["frame"] for c in cuts]
    ends = [c["frame"] for c in cuts] + [len(gray)]
    for a, b in zip(starts, ends):
        shots.append({"from": round(a / FPS, 3), "to": round(b / FPS, 3), "length": round((b - a) / FPS, 3), "brightness": round(float(gray[a:b].mean()), 1)})
    result = {
        **info,
        "format": "horizontal" if info["width"] > info["height"] * 1.15 else "vertical" if info["height"] > info["width"] * 1.15 else "square",
        "cuts": cuts,
        "fast_moves": moves,
        "shots": shots,
        "blinks": blinks_of(gray, cuts),
        "flashes": flashes_of(gray, cuts),
        "music": music,
    }
    if "--json" in sys.argv:
        json.dump(result, open(sys.argv[sys.argv.index("--json") + 1], "w"), indent=1)
    print(f"{info['width']}×{info['height']} {info['fps']} i/s, {info['duration']} s, {result['format']}, son: {'oui' if info['sound'] else 'non'}")
    if music:
        print(f"tempo ~{music['bpm']} BPM (pulsation mesurée {music['pulse']}, candidats {music['candidates']}" + (f", accord des coupes {music['cuts_fit']}" if "cuts_fit" in music else "") + f"), premier temps {music['first_beat']} s, {len(music['hits'])} coups forts")
    print(f"{len(cuts)} coupes:")
    for c in cuts:
        print(f"  {c['at']:7.3f} s (image {c['frame']})" + (f", temps {c['beats']}" if "beats" in c else "") + (f", coup le plus proche {c['nearest_hit_ms']:+d} ms" if "nearest_hit_ms" in c else "") + (" [même lieu]" if c.get("same_place") else ""))
    for m in moves:
        print(f"  mouvement rapide (zoom, filé, caméra qui fonce) de {m['from']} à {m['to']} s ({m['images']} images)" + (" dans le même lieu" if m["same_place"] else ""))
    print(f"{len(result['blinks'])} clignotements (hors coupes):")
    for g in result["blinks"]:
        print(f"  {g['from']:.3f}-{g['to']:.3f} s ({g['images']} images), jusqu'à {g['peak_share']} % de l'image, zone x {g['box'][0]}-{g['box'][2]} y {g['box'][1]}-{g['box'][3]}")
    for f in result["flashes"]:
        print(f"  {f['kind']} à {f['at']} s" + (f" jusqu'à {f['to']} s" if "to" in f else ""))


if __name__ == "__main__":
    main()
