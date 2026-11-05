# What the filler reads on her files (packages/agent/src/skills.ts, skillFiles), measured on the CPU in the cut-out
# sandbox (the tracker's Python, OpenCV and numpy, no model), once per file, when a model whose slots want it is filled:
# - the fast moves of her camera (« Ville en coups de fouet »: its whips, its sweeps and its rush in were faked because
#   nothing told where her own videos have them): the picture's own move from one image to the next (the optical flow
#   fitted to a pan, a tilt and a zoom), a run of images that each move more than FAST of the picture's width, or that
#   change a lot while blurred by their own move (a whip is all blur: its flow is lost); each with its way and its speed;
# - the moments something passes right in front of the lens (« Une journée chez toi »: a band of dark blur that covers
#   the picture and hides a cut): most of the picture losing its detail at once, for less than COVER_LONGEST seconds;
# - how colourful it is (« Quart de tour, deux tons »: a few shots stay in colour where colour counts): Hasler and
#   Süsstrunk's colourfulness, its median over the file and its most colourful second.
# Usage: python -I video_read.py jobs.json → prints {"<id>": { seconds, fps, moves, covered, colour } | { error }}.
# jobs.json: [{ id, src (a local video or photo), photo? }]. FFMPEG: ffmpeg; HDR_FILTER: NORMALIZE's tone mapping.
# `python -I video_read.py --test` checks it on synthetic videos.
import json
import os
import re
import subprocess
import sys
import time

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
HDR_FILTER = os.environ.get("HDR_FILTER", "")
# The picture is read at this width (its height by its shape), at its own rate (30 at most).
WIDE = 256
MOST_FPS = 30.0
# The longest file read (seconds).
MAX_SECONDS = 90.0
# A fast move: the picture moves FAST of its width at least per 1/30 s, for FAST_FRAMES images at least (gaps of
# FAST_GAP images joined); a whip when it reaches WHIP, or when its images blur (their sharpness under BLURRED of the
# file's usual) while they change much more than usual (CHANGE times its median change): its flow is lost in the blur.
FAST = 0.035
FAST_FRAMES = 3
FAST_GAP = 2
WHIP = 0.10
BLURRED = 0.35
CHANGE = 3.0
# A rush in or out: the picture grows (or shrinks) by ZOOM a 1/30 s at least, for FAST_FRAMES images, ZOOM_TOTAL in all.
ZOOM = 0.012
ZOOM_TOTAL = 0.08
# A shift laid by phase correlation counts from this response (0 to 1) when the flow lost the move.
PHASE_SURE = 0.08
# A cut (a video she edited, a stock clip): one image unlike the one before (its change CUT times the usual at least,
# CUT_LEAST of the light at least) while neither is blurred: never part of a move, and a move never runs across it.
CUT = 6.0
CUT_LEAST = 0.07
# Something passes before the lens: COVER of its cells lose their detail at once, both ways (under LOST of their
# usual), for COVER_FRAMES images at least and less than COVER_LONGEST seconds (longer, the scene itself is plain);
# a grid of CELLS columns. Nearly all of them (COVER_WHOLE): a pass, even where the flow saw a whip.
COVER = 0.6
LOST = 0.25
COVER_LONGEST = 2.5
COVER_FRAMES = 3
COVER_WHOLE = 0.85
CELLS = 16
# The moments told, at most.
MOST_MOVES = 12
MOST_COVERED = 6


def log(message):
    print(f"[video] {message}", file=sys.stderr, flush=True)


def probe(src):
    """Its size (as shown: a turned phone video's sides swapped), its rate, its length (s), whether it is HDR."""
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
    m = re.search(r"Video:.*?, (\d{2,5})x(\d{2,5})", info)
    if not m:
        raise RuntimeError("vidéo illisible")
    w, h = int(m.group(1)), int(m.group(2))
    rot = re.search(r"rotation of (-?\d+(?:\.\d+)?) degrees|rotate\s*:\s*(-?\d+)", info)
    if rot and 45 < abs(float(rot.group(1) or rot.group(2))) % 180 < 135:
        w, h = h, w
    fps = re.search(r"(\d+(?:\.\d+)?) fps", info)
    d = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", info)
    seconds = int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else 0.0
    return w, h, float(fps.group(1)) if fps else 30.0, seconds, bool(re.search(r"arib-std-b67|smpte2084", info))


def frames_of(src, w, h, fps, hdr, photo=False):
    """Its images one by one at w × h, RGB, at its own rate (MOST_FPS at most)."""
    import numpy as np

    rate = "" if photo or fps <= MOST_FPS + 0.5 else f"fps={MOST_FPS:g}"
    chain = ",".join(filter(None, [HDR_FILTER if hdr else "", rate, f"scale={w}:{h}:flags=area", "format=rgb24"]))
    args = [FFMPEG, "-v", "error", "-i", src, "-t", f"{MAX_SECONDS:.0f}", "-vf", chain] + (["-frames:v", "1"] if photo else []) + ["-f", "rawvideo", "-"]
    proc = subprocess.Popen(args, stdout=subprocess.PIPE)
    size = w * h * 3
    try:
        while True:
            raw = proc.stdout.read(size)
            if len(raw) < size:
                break
            yield np.frombuffer(raw, np.uint8).reshape(h, w, 3)
    finally:
        proc.stdout.close()
        proc.wait()


def colourfulness(rgb):
    """Hasler and Süsstrunk's colourfulness of an image (0 grey; 33 moderately, 59 quite, 82 highly colourful)."""
    import numpy as np

    x = rgb.astype(np.float32)
    rg = x[:, :, 0] - x[:, :, 1]
    yb = 0.5 * (x[:, :, 0] + x[:, :, 1]) - x[:, :, 2]
    return float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))


def colour_words(score):
    """Its colourfulness in the filler's words (French)."""
    return "très colorée" if score >= 59 else "colorée" if score >= 33 else "peu colorée" if score >= 15 else "presque sans couleur"


def motion(prev, cur, dis, grid, window):
    """
    The picture's move from one image to the next (grey, float32 0 to 1): a fit of the optical flow to a zoom about the
    centre and a shift (s, dx, dy, the shift in px), robust to what moves on its own (RANSAC); when the flow loses it (a
    move of a quarter of the picture an image, beyond its reach), the shift that best lays one image on the other (phase
    correlation), when it is clear; None when neither holds.
    """
    import cv2
    import numpy as np

    flow = dis.calc((prev * 255).astype(np.uint8), (cur * 255).astype(np.uint8), None)
    p0 = grid.reshape(-1, 2)
    p1 = p0 + flow[grid[..., 1].astype(int), grid[..., 0].astype(int)].reshape(-1, 2)
    m, inliers = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=1.5, maxIters=500)
    h, w = prev.shape
    if m is not None and inliers is not None and inliers.sum() >= len(p0) * 0.3:
        s = float(np.sqrt(abs(np.linalg.det(m[:2, :2]))))
        centre = np.array([w / 2, h / 2])
        moved = m[:, :2] @ centre + m[:, 2] - centre
        return s, float(moved[0]), float(moved[1])
    (dx, dy), response = cv2.phaseCorrelate(prev, cur, window)
    return (1.0, float(dx), float(dy)) if response >= PHASE_SURE else None


def runs(flags, gap):
    """The runs of True in a list (start, end inclusive), those `gap` apart or less joined."""
    out = []
    for i, f in enumerate(flags):
        if not f:
            continue
        if out and i - out[-1][1] <= gap + 1:
            out[-1][1] = i
        else:
            out.append([i, i])
    return out


def read(job):
    """A file's readings: { seconds, fps, moves, covered, colour }."""
    import cv2
    import numpy as np

    started = time.time()
    photo = bool(job.get("photo"))
    sw, sh, fps, seconds, hdr = probe(job["src"])
    w = WIDE
    h = max(2, int(round(WIDE * sh / sw / 2)) * 2)
    rate = fps if fps <= MOST_FPS + 0.5 else MOST_FPS
    if photo:
        rgb = next(frames_of(job["src"], w, h, fps, hdr, True), None)
        if rgb is None:
            raise RuntimeError("photo illisible")
        score = colourfulness(rgb)
        return {"colour": {"score": round(score), "words": colour_words(score)}}
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_ULTRAFAST)
    ys, xs = np.mgrid[4 : h - 4 : 8, 4 : w - 4 : 8]
    grid = np.dstack([xs, ys]).astype(np.float32)
    window = cv2.createHanningWindow((w, h), cv2.CV_32F)
    rows = max(2, int(round(CELLS * h / w)))
    prev = None
    speed, zoom, sharp, change, detail, light, tones, colours, ways = [], [], [], [], [], [], [], [], []
    for i, rgb in enumerate(frames_of(job["src"], w, h, fps, hdr)):
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        sharp.append(float(cv2.Laplacian(gray, cv2.CV_32F).var()))
        g = cv2.GaussianBlur(gray, (0, 0), 1.0)
        # Its detail each way: a whip blurs one way only, what passes before the lens both.
        detail.append(np.stack([cv2.resize(np.abs(cv2.Sobel(g, cv2.CV_32F, 1, 0)), (CELLS, rows), interpolation=cv2.INTER_AREA), cv2.resize(np.abs(cv2.Sobel(g, cv2.CV_32F, 0, 1)), (CELLS, rows), interpolation=cv2.INTER_AREA)]))
        light.append(cv2.resize(gray, (CELLS, rows), interpolation=cv2.INTER_AREA))
        tones.append(cv2.resize(rgb, (CELLS, rows), interpolation=cv2.INTER_AREA))
        if i % max(1, int(round(rate / 2))) == 0:
            colours.append(colourfulness(rgb))
        if prev is None:
            speed.append(0.0)
            zoom.append(0.0)
            change.append(0.0)
            ways.append((0.0, 0.0))
        else:
            change.append(float(np.abs(gray - prev).mean()))
            m = motion(prev, gray, dis, grid, window)
            # Per 1/30 s, whatever its rate: a share of its width, and a zoom.
            k = rate / 30.0
            if m is None:
                speed.append(float("nan"))
                zoom.append(0.0)
                ways.append((0.0, 0.0))
            else:
                s, dx, dy = m
                speed.append(float(np.hypot(dx, dy) / w * k))
                zoom.append(float((s - 1) * k))
                ways.append((dx, dy))
        prev = gray
    n = len(sharp)
    if n < 2:
        raise RuntimeError("aucune image lue")
    sharp_a = np.array(sharp)
    change_a = np.array(change)
    usual_sharp = float(np.median(sharp_a)) + 1e-6
    usual_change = float(np.median(change_a[1:])) + 1e-4
    speed_a = np.array(speed)
    blurred = (sharp_a < BLURRED * usual_sharp) & (change_a > CHANGE * usual_change)
    # Its cuts: an image unlike the one before, neither of them blurred by a move.
    cut = np.zeros(n, bool)
    for i in range(1, n):
        cut[i] = change_a[i] >= max(CUT_LEAST, CUT * usual_change) and sharp_a[i] >= BLURRED * usual_sharp and sharp_a[i - 1] >= BLURRED * usual_sharp
    lost = np.isnan(speed_a)
    fast = np.where(lost, 0.0, speed_a) >= FAST
    zooming = np.abs(np.array(zoom)) >= ZOOM
    t = lambda i: round(i / rate, 2)  # noqa: E731
    moving = (fast | (blurred & (lost | (np.where(lost, 0.0, speed_a) >= FAST / 2))) | zooming) & ~cut
    spans = []
    for a, b in runs(moving, FAST_GAP):
        # Never across a cut: the run split there.
        start = a
        for k in range(a + 1, b + 1):
            if cut[k]:
                spans.append((start, k - 1))
                start = k + 1
        spans.append((start, b))
    moves = []
    for a, b in spans:
        if b - a + 1 < FAST_FRAMES:
            continue
        seg = slice(a, b + 1)
        known = ~lost[seg]
        peak = float(np.max(speed_a[seg][known])) if known.any() else 0.0
        blur = bool(blurred[seg].mean() >= 0.3)
        zooms = np.array(zoom[seg])
        # Its way: the picture's own shift, image by image, weighted by its speed (a glide before a whip does not set it).
        weights = np.where(known, np.nan_to_num(speed_a[seg]), 0.0)
        dx = float(sum(weights[k - a] * ways[k][0] for k in range(a, b + 1)))
        dy = float(sum(weights[k - a] * ways[k][1] for k in range(a, b + 1)))
        if zooming[seg].mean() >= 0.5 and abs(zooms.mean()) >= ZOOM and peak < WHIP:
            # A rush in or out grows the picture by ZOOM_TOTAL at least over its run (a breath of the hand does not).
            if abs(float(np.prod(1 + zooms)) - 1) < ZOOM_TOTAL:
                continue
            kind, towards = ("rush" if zooms.mean() > 0 else "pull"), ("in" if zooms.mean() > 0 else "out")
        else:
            # The camera goes the other way from the picture: the picture slides left when it pans right.
            horizontal = abs(dx) >= abs(dy)
            towards = ("right" if dx < 0 else "left") if horizontal else ("down" if dy < 0 else "up")
            kind = "whip" if peak >= WHIP or blur else "pan" if horizontal else "tilt"
        moves.append({"from": t(a), "to": t(b + 1), "kind": kind, "towards": towards, "speed": round(max(peak, WHIP if blur else 0.0), 3)})
    moves = sorted(moves, key=lambda m: -m["speed"])[:MOST_MOVES]
    moves.sort(key=lambda m: m["from"])
    # Something before the lens: most of its cells lose their detail at once, both ways (a whip keeps the detail across
    # its move: the edges along it), for a moment.
    cells = np.array(detail)
    lum = np.array(light)
    usual = np.median(cells, axis=0) + 1e-4
    usual_light = np.median(lum, axis=0)
    gone = (cells < LOST * usual[None]).all(axis=1)
    share = gone.reshape(n, -1).mean(axis=1)
    covered = []
    whipped = np.zeros(n, bool)
    for m in moves:
        if m["kind"] == "whip":
            whipped[int(round(m["from"] * rate)) : int(round(m["to"] * rate))] = True
    for a, b in runs(share >= COVER, 1):
        # A pass takes a few images at least (a white flash of an edit is one), and never as long as a dark scene; a
        # whip's blur is the whip's, unless nearly the whole picture went plain (COVER_WHOLE: a band before the lens,
        # whose plain images the flow takes for a whip).
        whole = float(share[a : b + 1].max()) >= COVER_WHOLE
        if (b - a + 1) < COVER_FRAMES or (b - a + 1) / rate > COVER_LONGEST or (whipped[a : b + 1].mean() > 0.5 and not whole):
            continue
        seg = slice(a, b + 1)
        peak = a + int(np.argmax(share[seg]))
        mask = gone[peak]
        # Its colour where it covers (the brown of a stone column passing close, the grey of a coat) and whether it is dark.
        tone = np.array(tones[peak])[mask].mean(axis=0) if mask.any() else np.array(tones[peak]).reshape(-1, 3).mean(axis=0)
        # Where it came in from: the side its first covered cells are on.
        first = gone[a].mean(axis=0)
        side = "right" if first[CELLS // 2 :].mean() > first[: CELLS // 2].mean() + 0.1 else "left" if first[: CELLS // 2].mean() > first[CELLS // 2 :].mean() + 0.1 else None
        covered.append({
            "from": t(a), "to": t(b + 1), "peak": t(peak), "share": round(float(share[peak]), 2),
            "colour": "#" + "".join(f"{int(round(v)):02x}" for v in np.clip(tone, 0, 255)),
            "dark": bool(float(lum[peak][mask].mean() if mask.any() else lum[peak].mean()) < 0.4),
            **({"enters": side} if side else {}),
        })
    covered = sorted(covered, key=lambda c: -c["share"])[:MOST_COVERED]
    covered.sort(key=lambda c: c["from"])
    # A move told inside a plain pass before the lens is the pass, not the camera's.
    passes = [c for c in covered if c["share"] >= COVER_WHOLE]
    moves = [m for m in moves if not any(m["from"] < c["to"] and m["to"] > c["from"] and (min(m["to"], c["to"]) - max(m["from"], c["from"])) >= 0.5 * (m["to"] - m["from"]) for c in passes)]
    score = float(np.median(colours)) if colours else 0.0
    out = {"seconds": round(n / rate, 2), "fps": round(rate, 2), "moves": moves, "covered": covered, "colour": {"score": round(score), "words": colour_words(score)}}
    if len(colours) >= 4:
        # Its most colourful second (two readings a second).
        best = max(range(len(colours) - 1), key=lambda k: colours[k] + colours[k + 1])
        out["colour"]["best"] = {"from": round(best * 0.5, 1), "to": round(best * 0.5 + 1, 1), "score": round((colours[best] + colours[best + 1]) / 2)}
    log(f"{job.get('id')}: {n} images in {time.time() - started:.1f} s, {len(moves)} fast moves, {len(covered)} covered, colour {round(score)}")
    return out


# ——— Its checks on synthetic videos ———————————————————————————————————————————————————————————————————————————————


def synthetic(path, seconds=4.0, fps=30):
    """
    A test video: a textured scene the camera holds, then whips right at 1.0 s (four blurred images moving 20 % of the
    width each), holds, then something dark and blurred covers the picture from 2.4 to 2.8 s; colourful stripes.
    """
    import cv2
    import numpy as np

    rng = np.random.default_rng(4)
    w, h = 320, 180
    scene = np.zeros((h, w * 4, 3), np.uint8)
    k = 0
    while k < w * 4:
        # Stripes of uneven widths and heights (a regular pattern would hide a move of its own period).
        step = int(rng.integers(6, 30))
        scene[int(rng.integers(0, h // 3)) :, k : k + step] = rng.integers(40, 255, 3)
        k += step
    scene = cv2.GaussianBlur(scene, (0, 0), 1.0)
    scene = np.clip(scene.astype(np.int16) + rng.integers(-20, 20, scene.shape), 0, 255).astype(np.uint8)
    enc = subprocess.Popen([FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", path], stdin=subprocess.PIPE)
    x = 0.0
    for i in range(int(seconds * fps)):
        moving = 30 <= i < 34
        if moving:
            x += 0.2 * w
        img = scene[:, int(x) : int(x) + w].copy()
        if moving:
            img = cv2.blur(img, (41, 1))
        if 72 <= i < 84:
            # A dark blur passing close to the lens, from the right, covering it all from image 75 to 80.
            cover = min(1.0, (i - 71) / 4) if i < 76 else 1.0 if i < 81 else max(0.0, (84 - i) / 4)
            edge = int(w * (1 - cover))
            img[:, edge:] = (img[:, edge:] * 0.1 + 25).astype(np.uint8)
            img[:, edge:] = cv2.GaussianBlur(img[:, edge:], (0, 0), 9)
        enc.stdin.write(img.tobytes())
    enc.stdin.close()
    enc.wait()


def self_test():
    """Its readings on a synthetic video: the whip found right where and the way it goes, the cover, the colour."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "test.mp4")
        synthetic(path)
        r = read({"id": "test", "src": path})
    whips = [m for m in r["moves"] if m["kind"] == "whip"]
    assert len(whips) == 1 and abs(whips[0]["from"] - 1.0) <= 0.1 and whips[0]["towards"] == "right", r["moves"]
    assert len(r["covered"]) == 1 and 2.3 <= r["covered"][0]["peak"] <= 2.8 and r["covered"][0]["dark"], r["covered"]
    assert r["colour"]["score"] >= 33, r["colour"]
    print("video_read: ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--test"]:
        self_test()
        sys.exit(0)
    jobs = json.load(open(sys.argv[1]))
    results = {}
    for job in jobs:
        try:
            results[job["id"]] = read(job)
        except Exception as error:  # noqa: BLE001 — one file that fails never stops the others
            log(f"{job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
