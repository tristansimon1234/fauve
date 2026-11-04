# Where a text can be set in her shot: its sky, else an empty wall or any calm, even area (ClearBox in the
# animations' scope, apps/render/src/clear.ts). Read on the CPU from the passage of her video a composition names (or
# one of her photos), in the machine that follows objects (track_objects.py; one without a card when there is no
# object to follow): a grid over the picture says, cell by cell, where it stays calm through the whole passage (no
# edge, no texture, an even colour, in at least CALM_VOTE of the images read) and where that calm is the sky (open to
# the top of the picture); the camera's move is read image by image too, so a text set there stays on its place of the
# scene while the camera pans, tilts or pushes. The composition chooses its own area on this grid at render time (its
# shape, its size, the upper part first, inside the box it lays the shot in), so one reading serves every text.
# Nothing here is a model: a few milliseconds an image at 384 px. On the bench's Notre-Dame shot, « Lieu tapé »'s name
# typed « in the sky » at its original's fixed place had landed on the towers: the white sky is beside them.
# Usage: python -I clear_area.py jobs.json → prints {"<id>": { clear: { cols, rows, cells, motion? }, frames, still } |
# { error }}. jobs.json: [{ id, src (a local video or photo), from, to, photo? }]. FFMPEG: ffmpeg; HDR_FILTER: NORMALIZE's
# tone mapping. `python -I clear_area.py --test` checks it on synthetic images.
import json
import os
import subprocess
import sys
import time

# matte.py sits beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# The size the picture is read at (its long side, px), and the cells along that side (square cells: 64 × 36 on 16:9).
WORK_LONG = 384
GRID_LONG = 64
# The images whose calm is read (spread over the passage, its first and last among them), and the share of them a
# cell must be calm in (a passer-by crossing a wall for a moment leaves it calm; a sign that blinks does not).
KEYS = 9
CALM_VOTE = 0.75
# A pixel is busy past this gradient (Lab units a pixel, its light and its colour, once smoothed: a building's edge
# is 10 to 60, foliage 5 to 20, a white or blue sky under 1, a sunset's slope about 1, soft clouds 1 to 3).
EDGE = 3.2
# A cell is calm when its own pixels and those half a cell around it are this little busy (BUSY_SHARE of them past
# EDGE), their fine texture under TEXTURE on average and their slope under SLOPE. Measured at 384 px: skies and empty
# walls 0.05 to 0.13 of texture, a wall or a sky at night 0.3 (its noise), soft clouds and a grey floor 0.2; the wood of
# a café table 0.8, a road at night 1.1, trees 2.4, the Seine's ripples 4.9.
BUSY_SHARE = 0.015
TEXTURE = 0.45
SLOPE = 2.0
# The texture of a noisy video's calmest cells times NOISE is its bar instead, up to TEXTURE_MOST (a night shot's
# facade, 0.5 to 0.75 of noise, stays calm; its road, 1.1, does not).
NOISE = 1.7
TEXTURE_MOST = 0.85
# The camera holds when it moves less than this along the passage (shares of the picture, or of its scale).
STILL_MOVE = 0.004
# Its move is measured against an anchor image, a new one every ANCHOR images (or sooner, when fewer than half of its
# points are still followed); a layer of the picture that moves its own way holds LAYER_SHARE of the points followed
# at least (and LAYER_POINTS). Anchored every 15 images, the Eiffel shot's 3 s drifted 2.6 % up from its direct
# measure, every 90 none.
ANCHOR = 90
LAYER_SHARE = 0.15
LAYER_POINTS = 12
# The longest passage read (seconds).
MAX_SECONDS = 30.0


def log(message):
    print(f"[clear] {message}", file=sys.stderr, flush=True)


def grid_size(w, h):
    """The grid over a picture of w × h: GRID_LONG cells along its long side, square cells."""
    if w >= h:
        return GRID_LONG, max(2, int(round(GRID_LONG * h / w)))
    return max(2, int(round(GRID_LONG * w / h))), GRID_LONG


def work_size(w, h):
    """The picture's size for the reading: WORK_LONG on its long side, even sides."""
    k = WORK_LONG / max(w, h)
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def busyness(rgb):
    """
    What makes each pixel busy, in Lab (its light, and its colour at half weight): its gradient once smoothed (an edge, a
    line), and its fine texture (the picture less a blurred copy of itself: wood grain, leaves, ripples, gravel), which a
    sky's slope or the shading of a wall never has.
    """
    import cv2
    import numpy as np

    lab = cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)
    sharp = cv2.GaussianBlur(lab, (0, 0), 0.7)
    soft = cv2.GaussianBlur(lab, (0, 0), 2.0)
    gradient = np.zeros(rgb.shape[:2], np.float32)
    texture = np.zeros(rgb.shape[:2], np.float32)
    for channel, weight in ((0, 1.0), (1, 0.5), (2, 0.5)):
        gx = cv2.Sobel(sharp[:, :, channel], cv2.CV_32F, 1, 0, ksize=3) / 8.0
        gy = cv2.Sobel(sharp[:, :, channel], cv2.CV_32F, 0, 1, ksize=3) / 8.0
        gradient += weight * (gx * gx + gy * gy)
        texture += weight * np.abs(sharp[:, :, channel] - soft[:, :, channel])
    return np.sqrt(gradient), texture


def calm_cells(rgb, cols, rows):
    """
    The calm cells of one image (rows × cols, True where a text could sit): read on each cell and half a cell around
    it, few busy pixels (an edge that only touches its corner counts), little fine texture, a gentle slope at most.
    """
    import cv2
    import numpy as np

    h, w = rgb.shape[:2]
    gradient, texture = busyness(rgb)
    busy = (gradient > EDGE).astype(np.float32)
    cw, ch = w / cols, h / rows
    kx, ky = max(3, int(round(cw * 2)) | 1), max(3, int(round(ch * 2)) | 1)
    around = lambda image: cv2.blur(image, (kx, ky), borderType=cv2.BORDER_REPLICATE)  # noqa: E731
    ys = np.clip(((np.arange(rows) + 0.5) * ch).astype(int), 0, h - 1)
    xs = np.clip(((np.arange(cols) + 0.5) * cw).astype(int), 0, w - 1)
    at = np.ix_(ys, xs)
    fine = around(texture)[at]
    # A video's own noise is no texture: past what its calmest cells show (a night shot's sky and walls, 0.46 at its
    # calmest twentieth where a day's sky shows 0.1), the bar rises with it, never past TEXTURE_MOST (wood stays wood).
    bar = min(TEXTURE_MOST, max(TEXTURE, NOISE * float(np.percentile(fine, 5))))
    return (around(busy)[at] <= BUSY_SHARE) & (fine <= bar) & (around(gradient)[at] <= SLOPE)


def open_to_top(calm):
    """The calm cells joined to the top row of the picture through calm cells (4-connected): its sky, or a wall up to its edge."""
    import cv2
    import numpy as np

    count, labels = cv2.connectedComponents(calm.astype(np.uint8), connectivity=4)
    if count <= 1:
        return np.zeros_like(calm)
    top = set(int(v) for v in labels[0][calm[0]])
    return np.isin(labels, list(top)) & calm if top else np.zeros_like(calm)


def far_layer(p0, p1):
    """
    The move of the farthest things between two images (a similarity, 2 × 3), from points followed from one to the
    other: the moves found one after the other by RANSAC (each on the points the ones before left), and of those that
    hold enough of the points, the slowest. A sky is as far as it gets: it moves like the tower behind the fence, never
    like the fence the camera walks along (in the Eiffel shot, the fence moved 2 px an image, the tower 0.1). None when
    too few points agree (a white wall, a sky alone).
    """
    import cv2
    import numpy as np

    found = []
    left = np.arange(len(p0))
    for _ in range(3):
        if len(left) < LAYER_POINTS:
            break
        m, inliers = cv2.estimateAffinePartial2D(p0[left], p1[left], method=cv2.RANSAC, ransacReprojThreshold=0.8, maxIters=3000, confidence=0.995)
        if m is None or inliers is None:
            break
        kept = inliers.reshape(-1).astype(bool)
        if kept.sum() < max(LAYER_POINTS, LAYER_SHARE * len(p0)):
            break
        moved = np.linalg.norm((p1[left][kept] - p0[left][kept]).reshape(-1, 2), axis=1)
        found.append((float(np.median(moved)), m))
        left = left[~kept]
    return min(found, key=lambda f: f[0])[1] if found else None


def camera(grey):
    """
    The camera's move through the passage: for each image, where a point of the first image is on it, as a scale about
    the picture's centre and a shift (s, dx, dy, shares of the picture: x' = 0.5 + s·(x − 0.5) + dx), its turn left
    aside; lightly smoothed. Each image is measured against an anchor (the first, then a new one every ANCHOR images or
    when too few of its points are still followed) rather than against the image before: chained from image to image,
    the Eiffel shot's 3 s had drifted to a zoom of 1.04 that was never filmed. The farthest layer of the picture moves
    it (far_layer). None when it holds.
    """
    import cv2
    import numpy as np

    n = len(grey)
    h, w = grey[0].shape

    def corners(image):
        p = cv2.goodFeaturesToTrack(image, maxCorners=500, qualityLevel=0.01, minDistance=6, blockSize=7)
        return p if p is not None else np.zeros((0, 1, 2), np.float32)

    anchor, at_anchor = 0, np.eye(3)
    points = corners(grey[0])
    chain = [np.eye(3)]
    for i in range(1, n):
        last = chain[-1]
        here = None
        if len(points) >= LAYER_POINTS:
            nxt, status, _ = cv2.calcOpticalFlowPyrLK(grey[anchor], grey[i], points, None, winSize=(31, 31), maxLevel=4)
            back, status2, _ = cv2.calcOpticalFlowPyrLK(grey[i], grey[anchor], nxt, None, winSize=(31, 31), maxLevel=4)
            ok = (status.reshape(-1) == 1) & (status2.reshape(-1) == 1) & (np.linalg.norm((back - points).reshape(-1, 2), axis=1) < 0.7)
            m = far_layer(points[ok], nxt[ok]) if ok.sum() >= LAYER_POINTS else None
            if m is not None:
                here = np.vstack([m, [0, 0, 1]]) @ at_anchor
            followed = ok.sum() / max(1, len(points))
        else:
            followed = 0.0
        # Not measured (too few points agree): the camera holds where it was.
        chain.append(here if here is not None else last)
        if i - anchor >= ANCHOR or followed < 0.5:
            anchor, at_anchor, points = i, chain[-1], corners(grey[i])
    centre = np.array([w / 2, h / 2, 1.0])
    moves = []
    for m in chain:
        c = m @ centre
        moves.append((float(np.sqrt(abs(np.linalg.det(m[:2, :2])))), float(c[0] / w - 0.5), float(c[1] / h - 0.5)))
    moves = np.array(moves, np.float64)
    if np.abs(moves[:, 1:]).max() < STILL_MOVE and np.abs(moves[:, 0] - 1).max() < STILL_MOVE:
        return None
    # A centred average over 5 images: the estimate's own jitter, not the camera's.
    padded = np.concatenate([moves[:1].repeat(2, 0), moves, moves[-1:].repeat(2, 0)])
    smooth = np.stack([padded[i : i + 5].mean(axis=0) for i in range(n)])
    smooth[0] = (1.0, 0.0, 0.0)
    return smooth


def where(move, u, v):
    """Where points of the first image (shares) are on an image the camera moved by `move` (s, dx, dy)."""
    s, dx, dy = move
    return 0.5 + s * (u - 0.5) + dx, 0.5 + s * (v - 0.5) + dy


def clear_map(frames):
    """
    The clear areas of a passage (RGB images, its first is the reference): its grid (cols × rows cells, rows from the
    top: « 2 » the sky, calm and open to the top of the picture; « 1 » calm elsewhere, an empty wall, an even floor;
    « 0 » busy, or out of the picture at some image), in the first image's place, and the camera's move (motion: s, dx,
    dy for each image, flat) when it moves.
    """
    import cv2
    import numpy as np

    n = len(frames)
    h, w = frames[0].shape[:2]
    cols, rows = grid_size(w, h)
    moves = camera([cv2.cvtColor(np.ascontiguousarray(f), cv2.COLOR_RGB2GRAY) for f in frames]) if n > 1 else None
    keys = sorted(set(int(round(k)) for k in np.linspace(0, n - 1, min(n, KEYS))))
    # The reference cells' centres and corners (shares of the first image).
    u = (np.arange(cols) + 0.5) / cols
    v = (np.arange(rows) + 0.5) / rows
    uu, vv = np.meshgrid(u, v)
    calm_votes = np.zeros((rows, cols), np.int32)
    sky_votes = np.zeros((rows, cols), np.int32)
    seen = np.ones((rows, cols), bool)
    if moves is not None:
        # Out of the picture at any image (its four corners): it is not there through the whole passage.
        for m in moves:
            for cu, cv_ in ((-0.5, -0.5), (0.5, -0.5), (-0.5, 0.5), (0.5, 0.5)):
                x, y = where(m, uu + cu / cols, vv + cv_ / rows)
                seen &= (x >= 0) & (x <= 1) & (y >= 0) & (y <= 1)
    for k in keys:
        calm = calm_cells(frames[k], cols, rows)
        sky = open_to_top(calm)
        if moves is None or k == 0:
            calm_votes += calm
            sky_votes += sky
            continue
        # This image's cells under the reference's (the camera moved): read where each reference cell now is.
        x, y = where(moves[k], uu, vv)
        ci = np.clip((x * cols).astype(int), 0, cols - 1)
        ri = np.clip((y * rows).astype(int), 0, rows - 1)
        calm_votes += calm[ri, ci]
        sky_votes += sky[ri, ci]
    need = int(np.ceil(CALM_VOTE * len(keys)))
    calm = (calm_votes >= need) & seen
    sky = calm & (sky_votes * 2 >= len(keys))
    grid = np.where(sky, 2, np.where(calm, 1, 0)).astype(np.uint8)
    out = {"cols": cols, "rows": rows, "cells": "".join(str(int(c)) for c in grid.reshape(-1))}
    if moves is not None:
        out["motion"] = [round(float(x), 4) for m in moves for x in m]
    return out


def decode(src, start, seconds, photo):
    """The passage's images (or the photo, one image) at the reading's size, RGB, as the Reel plays them (30 i/s, tone-mapped)."""
    import numpy as np

    import matte

    w, h, hdr = matte.probe(src)
    ww, wh = work_size(w, h)
    if photo:
        raw = subprocess.run([matte.FFMPEG, "-v", "error", "-i", src, "-vf", f"scale={ww}:{wh}:flags=area,format=rgb24", "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
        if len(raw) != ww * wh * 3:
            raise RuntimeError("photo illisible")
        return np.frombuffer(raw, np.uint8).reshape(1, wh, ww, 3)
    return matte.decode(src, start, seconds, ww, wh, hdr)


def read(job):
    """A job's clear areas: { clear, frames, still } (still: the camera holds, one place for the whole passage)."""
    started = time.time()
    photo = bool(job.get("photo"))
    start = max(0.0, float(job.get("from") or 0))
    seconds = min(MAX_SECONDS, max(1.0 / 30, float(job.get("to") or 0) - start))
    frames = decode(job["src"], start, seconds, photo)
    found = clear_map(frames)
    calm = sum(c != "0" for c in found["cells"]) / len(found["cells"])
    sky = found["cells"].count("2") / len(found["cells"])
    log(f"{job.get('id')}: {len(frames)} images in {time.time() - started:.1f} s, {calm:.0%} calm, {sky:.0%} sky{', the camera moves' if 'motion' in found else ''}")
    return {"clear": found, "frames": len(frames), "still": "motion" not in found}


def synthetic(w=384, h=216, seed=3, shift=0):
    """
    A test picture: a sky (a soft gradient with a little noise) over a building whose facade is busy (windows, edges),
    a thin crane in the sky on the right, and a plain wall in the bottom left; `shift` moves the whole scene left (px),
    as a camera panning right would.
    """
    import cv2
    import numpy as np

    rng = np.random.default_rng(seed)
    pad = 64
    W = w + 2 * pad
    img = np.zeros((h, W, 3), np.float32)
    ys = np.linspace(0, 1, h)[:, None]
    img[:] = (np.array([150, 190, 235]) * (1 - 0.25 * ys) + np.array([235, 225, 210]) * 0.25 * ys)[:, None, :].reshape(h, 1, 3)
    img += rng.normal(0, 1.2, img.shape)
    # The building: from x 45 % to 75 %, from 35 % of the height to the bottom, its windows in rows.
    x0, x1, y0 = pad + int(0.45 * w), pad + int(0.75 * w), int(0.35 * h)
    img[y0:, x0:x1] = (120, 100, 80)
    for yy in range(y0 + 6, h - 6, 14):
        for xx in range(x0 + 5, x1 - 8, 12):
            img[yy : yy + 7, xx : xx + 5] = (30, 30, 40)
    # A crane: a thin dark line from the top, at 88 % across.
    cv2.line(img, (pad + int(0.88 * w), 0), (pad + int(0.86 * w), int(0.5 * h)), (60, 50, 40), 2)
    # A plain wall at the bottom left, under a busy band (shrubs).
    img[int(0.62 * h) :, pad : pad + int(0.3 * w)] = (200, 196, 188)
    band = rng.integers(40, 160, (int(0.08 * h), int(0.4 * w), 3))
    img[int(0.55 * h) : int(0.55 * h) + band.shape[0], pad : pad + band.shape[1]] = band
    img = np.clip(img, 0, 255).astype(np.uint8)
    return np.ascontiguousarray(img[:, pad + shift : pad + shift + w])


def with_fence(img, shift):
    """The test picture behind a fence close to the camera (dark bars across its left half), the fence `shift` px to the left."""
    import cv2

    out = img.copy()
    h, w = out.shape[:2]
    for x in range(-shift % 18, w // 2, 18):
        cv2.line(out, (x, h), (x + 40, int(0.3 * h)), (20, 40, 30), 3)
    return out


def night(seed=5):
    """A test picture at night: a black sky, a plain facade, a textured road, all under a video's noise."""
    import numpy as np

    rng = np.random.default_rng(seed)
    h, w = 216, 384
    img = np.full((h, w, 3), 12.0, np.float32)
    img[:, int(0.5 * w) :] = (150, 140, 120)
    stripes = (np.sin(np.arange(w) * 1.3)[None, :] * 25 + rng.normal(0, 20, (int(0.25 * h), w)))[:, :, None]
    img[int(0.75 * h) :] = 60 + stripes
    img += rng.normal(0, 2.5, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def self_test():
    """Its readings on synthetic pictures: the sky beside the building and off the crane, the wall, a pan followed, a fence passing in front, a night's noise."""
    import numpy as np

    still = clear_map([synthetic()] * 4)
    cols, rows = still["cols"], still["rows"]
    grid = np.array([int(c) for c in still["cells"]]).reshape(rows, cols)
    cell = lambda x, y: grid[int(y * rows), int(x * cols)]  # noqa: E731
    assert (cols, rows) == (64, 36) and "motion" not in still, (cols, rows)
    assert cell(0.2, 0.15) == 2, "the sky on the left is sky"
    assert cell(0.6, 0.6) == 0, "the facade is busy"
    assert cell(0.6, 0.2) == 2, "the sky above the building is sky"
    assert cell(0.87, 0.2) == 0, "the crane is busy"
    assert cell(0.12, 0.85) == 1, "the plain wall is calm, not sky"
    assert cell(0.12, 0.58) == 0, "the shrubs are busy"
    # The camera pans right by 60 px (16 % of the picture) over 31 images: followed, and what leaves the picture is out.
    pan = [synthetic(shift=2 * i) for i in range(31)]
    moving = clear_map(pan)
    m = np.array(moving["motion"]).reshape(-1, 3)
    assert len(m) == 31 and abs(m[-1][1] + 60 / 384) < 0.01 and abs(m[-1][0] - 1) < 0.01, m[-1]
    grid = np.array([int(c) for c in moving["cells"]]).reshape(rows, cols)
    assert grid[5, 2] == 0, "the left edge leaves the picture: out"
    assert grid[5, 20] == 2 and grid[20, 40] == 0, "the sky stays sky, the facade busy, in the first image's place"
    # The camera holds, a fence close to it slides 3 px an image (the Eiffel shot): the farthest layer is what moves the
    # sky, so the camera holds; the cells the fence sweeps are busy, the sky right of it stays sky.
    fenced = clear_map([with_fence(synthetic(), 3 * i) for i in range(31)])
    if "motion" in fenced:
        m = np.array(fenced["motion"]).reshape(-1, 3)
        assert np.abs(m[:, 1:]).max() < 0.01 and np.abs(m[:, 0] - 1).max() < 0.01, m[-1]
    grid = np.array([int(c) for c in fenced["cells"]]).reshape(rows, cols)
    assert grid[int(0.6 * rows), int(0.2 * cols)] == 0 and grid[5, 40] == 2, "the fence's sweep is busy, the sky beside it sky"
    # At night: the black sky and the facade stay calm under the noise, the road's texture does not.
    dark = clear_map([night(seed) for seed in range(3)])
    grid = np.array([int(c) for c in dark["cells"]]).reshape(rows, cols)
    assert grid[10, 10] == 2 and grid[20, 50] == 2, "the black sky and the facade at night"
    assert grid[int(0.9 * rows), 20] == 0, "the road's texture"
    print("clear_area: ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--test"]:
        self_test()
        sys.exit(0)
    jobs = json.load(open(sys.argv[1]))
    results = {}
    for job in jobs:
        try:
            results[job["id"]] = read(job)
        except Exception as error:  # noqa: BLE001 — one passage that fails never stops the others
            log(f"{job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
