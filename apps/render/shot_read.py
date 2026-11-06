# What a composition reads on one of her shots besides its clear areas (ClearBox: clear_area.py), read on the CPU in the
# cut-out sandbox (the tracker's Python, OpenCV and numpy, no model), only for the shots a composition's code names
# (packages/agent/src/subject.ts, readsDrawn):
# - its sky (Skyline, SkylineAt): the shot without its sky at every image, a transparent video like her cut-out, so a
#   title laid between its Footage and it sits in the sky behind everything else, roofs, poles, wires, trees and
#   passers-by included, none of them named (« Titre derrière toi »: its title behind the city, a pole through its E,
#   wires across its right half); and its skyline, where the sky ends column by column (the title's foot under its roofs);
# - its vanishing point (VanishingPoint): where the lines of the shot run to, the end of a street, a corridor, a pier
#   (« Éventail de bandes »: its star centred there; « Cadre dans le cadre »: its frame opening there);
# - its light (LightUnder): the mean light of each cell of a grid over the passage (« Mots aux quatre coins »: a shadow
#   only where the wall is bright; « Mots mêlés »: a veil dosed by how bright the video is).
# The camera's move is clear_area.py's (the farthest layer, against an anchor image), so each reading keeps its place of
# the scene as the camera pans or pushes. The sky: clear_area.py's grid says where it is (calm cells joined to the top
# of the picture, through the whole passage); at every image, its colours (a few clusters: a blue, its clouds, its haze)
# grow it pixel by pixel through what stays smooth and of its colours, on a copy of the image without its thin dark
# lines (a closing), so a wire never cuts it; then, at full size, its edge snapped to the picture's (a guided filter on
# its light) and the thin things across it (wires, poles, masts, a bird: darker or lighter than the sky just around them,
# a black-hat and a top-hat) put back in front.
# - its regions (PictureRegions): its first image split along its own edges, by colour (a wall, a door's frame, a plinth,
#   the pavement, the sky, a poster), each region's outline with its holes, together covering it (« Façade qui se
#   construit » v4: the rest of her front built in its own shapes after its elements, never in rectangles).
# Usage: python -I shot_read.py jobs.json → prints {"<id>": { frames, still, motion?, sky?, vanish?, light?, regions?,
# file? } | { error }}. jobs.json: [{ id, src (a local video or photo), from, to, photo?, read: ["ground" | "sky" |
# "vanish" | "light" | "regions"], out? (the ground's path, without its extension) }]. FFMPEG: ffmpeg; HDR_FILTER: NORMALIZE's tone mapping.
# `python -I shot_read.py --test` checks it on synthetic images.
import json
import os
import subprocess
import sys
import time

# matte.py and clear_area.py sit beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

FPS = 30
# The sky is grown at this long side (px), its edge and its thin things made at the cut-out's (OUT_LONG, matte.py).
SKY_LONG = 640
OUT_LONG = 1920
# Thin dark lines up to this thick (px at SKY_LONG) are closed before the sky grows: a wire or a mast never cuts it.
WIRE = 11
# A pixel joins the sky when its colours are this close to one of the sky's clusters (in their spread, at least
# NEAR_FLOOR Lab units) and the closed picture is this smooth there (Lab units a pixel: a roof's edge is 10 to 60).
NEAR = 3.0
NEAR_FLOOR = 7.0
LIGHT_EASE = 3.0
SMOOTH = 4.0
# A cloud: nearly grey (its chroma in OpenCV's Lab, a in and b off 128, under this), as bright as the sky at least,
# and off every straight segment longer than BUILT_SEGMENT of the diagonal (BUILT_WIDTH px around it at SKY_LONG).
CLOUD_CHROMA = 14.0
BUILT_SEGMENT = 0.03
BUILT_LONG = 0.09
BUILT_STEEP = 35.0
BUILT_WIDTH = 7
# Thin things across the sky, at full size: darker (or lighter) than the sky around them by this much (Lab L, 0 to
# 255) at least, or THIN_NOISE times its own grain; kernel: THIN_SIZE of the long side (a pole of 30 px at 1920).
THIN_DARK = 10.0
THIN_LIGHT = 22.0
THIN_NOISE = 5.0
THIN_SIZE = 0.018
# A thin thing is a line: LINE_RATIO times longer than it is wide, LINE_LEAST of the long side at least.
LINE_RATIO = 4.0
LINE_LEAST = 0.015
# The sky's clusters, read on this many of its pixels.
CLUSTERS = 3
SAMPLE = 6000
# Less than this share of the picture is no sky (a corner of a window).
SKY_MIN = 0.01
# An image whose sky was not found keeps the image before's for this many images at most.
CARRY = 15
# Its skyline: a column whose sky starts below this share of the height starts on something (0).
TOP_BAND = 0.06
# The skyline: this many columns, where the sky ends in each (shares of the height from the top).
PROFILE = 64
# The vanishing point: segments at least this long (share of the picture's diagonal), neither nearly level nor nearly
# upright (degrees), agreeing within ANGLE degrees, at least VANISH_LINES of them from two directions VANISH_SPREAD
# apart at least; within VANISH_ROOM of the picture around it; read on VANISH_KEYS images.
SEGMENT = 0.035
LEVEL = 6.0
UPRIGHT = 6.0
ANGLE = 2.5
VANISH_LINES = 5
VANISH_SPREAD = 15.0
VANISH_ROOM = 0.25
VANISH_KEYS = 5
# The lines that run there come from both sides of it (left and right, or above and below): the weaker side's share.
VANISH_BALANCE = 0.2
# The light: images it is read on, spread over the passage (its first and last among them).
LIGHT_KEYS = 9
# The longest passage read (seconds); the ground at full size is read for GROUND_SECONDS at most.
MAX_SECONDS = 30.0
GROUND_SECONDS = 20.0
# Its regions (PictureRegions): its first image at this long side, flattened (mean shift: REGION_SPACE px, REGION_RANGE
# of colour), its colours in REGION_COLOURS groups; each group's pieces of REGION_SEED of the picture at least seed a
# region, grown along the picture's edges (a watershed), then the smallest merged into the neighbour of the nearest
# colour until each is REGION_LEAST of the picture at least and there are REGION_MAX at most; each one's outline in
# REGION_POINTS points at most (its holes besides, REGION_HOLE of the picture at least), two pixels wider all round so
# neighbours overlap without a speck of black between them.
REGION_LONG = 480
REGION_SPACE = 8
REGION_RANGE = 16
REGION_COLOURS = 7
REGION_SEED = 0.003
REGION_LEAST = 0.006
REGION_MAX = 28
REGION_POINTS = 160
REGION_HOLE = 0.004
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
HDR_FILTER = os.environ.get("HDR_FILTER", "")


def log(message):
    print(f"[shot] {message}", file=sys.stderr, flush=True)


def even_size(w, h, long_side):
    k = min(1.0, long_side / max(w, h))
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def stream(src, start, seconds, w, h, hdr, photo=False):
    """The passage's images one by one at w × h, RGB, as the Reel plays them (30 i/s, tone-mapped), without holding them all."""
    import numpy as np

    chain = ",".join(filter(None, [HDR_FILTER if hdr else "", "" if photo else f"fps={FPS}", f"scale={w}:{h}:flags=lanczos", "format=rgb24"]))
    args = [FFMPEG, "-v", "error", "-i", src] + ([] if photo else ["-ss", f"{start:.3f}", "-t", f"{seconds:.3f}"]) + ["-vf", chain] + (["-frames:v", "1"] if photo else []) + ["-f", "rawvideo", "-"]
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


# ——— Its sky ————————————————————————————————————————————————————————————————————————————————————————————————————


def unwired(rgb, size):
    """
    The picture without its thin lines and specks narrower than `size` px, dark or light (a closing, then an opening, of
    each channel): a wire, a pole, a white lamp post, a gull no longer cut the sky in two.
    """
    import cv2
    import numpy as np

    kernel = np.ones((size, size), np.uint8)
    return cv2.morphologyEx(cv2.morphologyEx(rgb, cv2.MORPH_CLOSE, kernel), cv2.MORPH_OPEN, kernel)


def sky_cells(rgb_grid):
    """
    The sky of one image on clear_area.py's grid (its picture at 384 px): its calm cells joined to the top of the picture,
    read without the thin dark lines across it (a wire across the whole sky had cut it from the top); and the cells a
    pixel of sky may reach (two cells around them).
    """
    import cv2
    import numpy as np

    import clear_area

    h, w = rgb_grid.shape[:2]
    cols, rows = clear_area.grid_size(w, h)
    calm = clear_area.calm_cells(unwired(rgb_grid, max(3, int(round(WIRE * max(w, h) / SKY_LONG)) | 1)), cols, rows)
    sky = clear_area.open_to_top(calm).astype(np.uint8)
    # A cell in from the sky's edge seeds it (its border cells may hold a roof's corner); two cells out bound it, and so
    # does the calm it runs into (the sky low between two lamp posts, cut from the top by their lamps): the pixels decide.
    seed = cv2.erode(sky, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT, borderValue=1).astype(bool)
    near = cv2.dilate(sky, np.ones((5, 5), np.uint8))
    count, labels = cv2.connectedComponents(calm.astype(np.uint8), connectivity=4)
    touching = np.unique(labels[(near > 0) & calm])
    touching = touching[touching > 0]
    reach = (near > 0) | (np.isin(labels, touching) & calm)
    reach = cv2.dilate(reach.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    return seed, reach


def cells_at(cells, w, h):
    """A grid of cells (rows × cols, bool) laid over a picture of w × h."""
    import cv2
    import numpy as np

    return cv2.resize(cells.astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST).astype(bool)


def closed_lab(rgb):
    """The picture in Lab (float, L 0 to 255) without its thin dark lines (a closing), a little softened."""
    import cv2
    import numpy as np

    lab = cv2.cvtColor(unwired(rgb, WIRE), cv2.COLOR_RGB2LAB).astype(np.float32)
    return cv2.GaussianBlur(lab, (0, 0), 0.8)


def gradient_of(lab):
    """Its gradient a pixel (Lab, the colour at half weight, as clear_area.py measures it)."""
    import cv2
    import numpy as np

    g = np.zeros(lab.shape[:2], np.float32)
    for c, k in ((0, 1.0), (1, 0.5), (2, 0.5)):
        gx = cv2.Sobel(lab[:, :, c], cv2.CV_32F, 1, 0, ksize=3) / 8.0
        gy = cv2.Sobel(lab[:, :, c], cv2.CV_32F, 0, 1, ksize=3) / 8.0
        g += k * (gx * gx + gy * gy)
    # L on 0..255 in OpenCV's Lab: brought to the 0..100 of clear_area.py's float Lab.
    return np.sqrt(g) * (100.0 / 255.0)


def clusters_of(lab, seed):
    """The sky's colours: a few clusters of its seed's pixels (their means and spreads, Lab), or None when there are too few."""
    import cv2
    import numpy as np

    px = lab[seed]
    if len(px) < 50:
        return None
    rng = np.random.default_rng(7)
    if len(px) > SAMPLE:
        px = px[rng.choice(len(px), SAMPLE, replace=False)]
    k = min(CLUSTERS, max(1, len(px) // 200))
    _, labels, centres = cv2.kmeans(px.astype(np.float32), k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5), 2, cv2.KMEANS_PP_CENTERS)
    labels = labels.reshape(-1)
    spreads = np.array([px[labels == i].std(axis=0) if (labels == i).sum() > 5 else np.full(3, 4.0) for i in range(k)], np.float32)
    return centres.astype(np.float32), spreads


def structured(gray):
    """
    Where the picture has the straight lines of something built, a few pixels around them: its steep segments (the walls,
    windows and masts of a facade), or its very long ones (a roofline, a cornice). A cloud has neither: its flat base is
    short and level.
    """
    import cv2
    import numpy as np

    h, w = gray.shape
    found = cv2.createLineSegmentDetector(cv2.LSD_REFINE_NONE).detect(gray)[0]
    mask = np.zeros((h, w), np.uint8)
    if found is None:
        return mask.astype(bool)
    diagonal = np.hypot(w, h)
    for x0, y0, x1, y1 in found.reshape(-1, 4):
        length = np.hypot(x1 - x0, y1 - y0)
        steep = abs(y1 - y0) >= abs(x1 - x0) * np.tan(np.radians(BUILT_STEEP))
        if (steep and length >= BUILT_SEGMENT * diagonal) or length >= BUILT_LONG * diagonal:
            cv2.line(mask, (int(round(x0)), int(round(y0))), (int(round(x1)), int(round(y1))), 1, BUILT_WIDTH)
    return mask.astype(bool)


def neutral_of(lab):
    """The picture's white (its a, b in OpenCV's Lab): the colour of its brightest pixels, as its grade tints them (a warm grade makes its clouds cream)."""
    import numpy as np

    light = lab[:, :, 0]
    top = light >= np.percentile(light, 98)
    return float(np.median(lab[:, :, 1][top])), float(np.median(lab[:, :, 2][top]))


def veiled(lab, centres, spreads, white):
    """
    A thin cloud: its sky seen through a white veil, its colour between one of the sky's clusters and the picture's white
    (lighter than the cluster), within the cluster's spread: a wisp over a deep blue is a paler blue, never another hue.
    """
    import numpy as np

    top = np.array([255.0, white[0], white[1]], np.float32)
    out = np.zeros(lab.shape[:2], bool)
    for c, s in zip(centres, spreads):
        span = top - c
        if span[0] < 10:
            continue
        t = np.clip((lab[:, :, 0] - c[0]) / span[0], 0, 1)
        expected = c[None, None, :] + t[..., None] * span[None, None, :]
        scale = np.maximum(NEAR * s, NEAR_FLOOR / np.sqrt(3)) * np.array([LIGHT_EASE, 1.0, 1.0], np.float32)
        d = np.sqrt((((lab - expected) / scale) ** 2).sum(axis=2))
        out |= (t > 0.05) & (d <= 1.0)
    return out


def colour_distance(lab, centres, spreads):
    """
    Each pixel's distance to the nearest of the sky's clusters, in their spreads (its haze is wide, its blue narrow, never
    closer than NEAR_FLOOR), its light counting LIGHT_EASE times less than its colour: a sky pales from its top to its
    horizon far more than it changes hue (Brighton's sky, 30 units lighter above the sea than above the kiosk).
    """
    import numpy as np

    near = np.full(lab.shape[:2], np.inf, np.float32)
    for c, s in zip(centres, spreads):
        scale = np.maximum(NEAR * s, NEAR_FLOOR / np.sqrt(3))
        scale = scale * np.array([LIGHT_EASE, 1.0, 1.0], np.float32)
        near = np.minimum(near, np.sqrt((((lab - c) / scale) ** 2).sum(axis=2)))
    return near


def sky_region(rgb_small, seed, reach=None, model=None):
    """
    The sky of one image at the reading's size (bool), grown from its seed through what stays smooth and of its colours
    on the closed picture, within `reach` (the grid's sky and two cells around it), and its clusters (carried to the next
    image when its seed is thin). None when no sky.
    """
    import cv2
    import numpy as np

    lab = closed_lab(rgb_small)
    found = clusters_of(lab, seed) or model
    if found is None:
        return None, None
    centres, spreads = found
    near = colour_distance(lab, centres, spreads)
    smooth = gradient_of(lab) <= SMOOTH
    # Its clouds: as bright as its sky or brighter, nearly grey (a cloud has no colour of its own); smooth or not (a
    # cumulus is all texture), but never along the straight lines of something built (a white facade is as bright).
    white_a, white_b = neutral_of(lab)
    chroma = np.hypot(lab[:, :, 1] - white_a, lab[:, :, 2] - white_b)
    sky_light = float(np.median(lab[seed][:, 0]))
    cloudy = ((lab[:, :, 0] >= min(sky_light, 200) - 12) & (chroma <= CLOUD_CHROMA)) | veiled(lab, centres, spreads, (white_a, white_b))
    built = structured(cv2.cvtColor(rgb_small, cv2.COLOR_RGB2GRAY))
    candidate = ((near <= 1.0) | cloudy) & smooth
    if reach is not None:
        candidate &= reach
    candidate |= cloudy & ~built
    candidate = cv2.morphologyEx(candidate.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    count, labels = cv2.connectedComponents(candidate.astype(np.uint8), connectivity=4)
    if count <= 1:
        return None, found
    hit = np.unique(labels[seed & candidate])
    hit = hit[hit > 0]
    if not len(hit):
        return None, found
    region = np.isin(labels, hit)
    # What it surrounds, never reaching the bottom of the picture: a speck of noise, or a cloud whose edge is crisp
    # (sky when it is mostly of its colours or a cloud's); a bird or a balloon, darker and coloured, stays in front.
    holes = (~region).astype(np.uint8)
    n, lab_holes, stats, _ = cv2.connectedComponentsWithStats(holes, connectivity=8)
    h = region.shape[0]
    fill = []
    for k in range(1, n):
        top, height, area = stats[k, cv2.CC_STAT_TOP], stats[k, cv2.CC_STAT_HEIGHT], stats[k, cv2.CC_STAT_AREA]
        if top + height >= h:
            continue
        if area <= 4:
            fill.append(k)
            continue
        inside = lab_holes == k
        # Mostly of its colours or a cloud's (its soft edge, blue and white mixed, is neither), never darker than the sky.
        if float(((near <= 1.0) | cloudy)[inside].mean()) >= 0.6 and float(lab[:, :, 0][inside].mean()) >= sky_light - 15:
            fill.append(k)
    if fill:
        region |= np.isin(lab_holes, fill)
    if region.mean() < SKY_MIN:
        return None, found
    return region, found


def thin_things(light_full, sky_soft):
    """
    At full size: what is thin across the sky (wires, poles, masts, white lamp posts), darker or lighter than the sky just
    around it, 0 to 1 as much as it covers each pixel (an anti-aliased wire's edge is half sky). Only what holds to
    something: a pole stands on the ground, a wire runs to a pole or out of the picture; what floats in the sky (the
    ridges and gaps of its clouds, a gull) is sky, so a title behind the city never goes behind its clouds.
    """
    import cv2
    import numpy as np

    h, w = light_full.shape
    k = max(5, int(round(THIN_SIZE * max(w, h))) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
    # The sky's own grain (its median spread to a smoothed copy, where it is surely sky): a noisy evening sky needs more.
    sure = sky_soft > 0.95
    grain = 1.0
    if sure.sum() > 500:
        smooth = cv2.GaussianBlur(light_full, (0, 0), 2.0).astype(np.float32)
        grain = float(np.median(np.abs(light_full.astype(np.float32) - smooth)[sure])) + 0.5
    floor = 2.0 * grain
    ground = (sky_soft < 0.5).astype(np.uint8)
    covers = []
    for op, least, borders in ((cv2.MORPH_BLACKHAT, max(THIN_DARK, THIN_NOISE * grain), True), (cv2.MORPH_TOPHAT, max(THIN_LIGHT, 1.5 * THIN_NOISE * grain), False)):
        contrast = cv2.morphologyEx(light_full, op, kernel).astype(np.float32)
        # As much as it covers the pixel: its contrast there over the full contrast of the line just around it (its core).
        peak = cv2.dilate(contrast, np.ones((5, 5), np.uint8))
        share = np.where(peak >= least, np.clip((contrast - floor) / np.maximum(peak - floor, 1.0), 0, 1), 0.0)
        core = (share >= 0.3).astype(np.uint8)
        # Only lines: a piece four times longer than it is wide at least (a wire, a pole, a mast), never a blob (a puff
        # of cloud, the dark gap between two, a gull).
        n, pieces, stats, _ = cv2.connectedComponentsWithStats(core, connectivity=8)
        if n > 1:
            length = np.maximum(stats[:, cv2.CC_STAT_WIDTH], stats[:, cv2.CC_STAT_HEIGHT]).astype(np.float32)
            width = stats[:, cv2.CC_STAT_AREA] / np.maximum(length, 1.0)
            lines = (length >= LINE_RATIO * width) & (length >= LINE_LEAST * max(w, h))
            lines[0] = False
            core = lines[pieces].astype(np.uint8)
        if not core.any():
            covers.append(np.zeros((h, w), np.float32))
            continue
        # What holds: its piece touches the ground (grown by a pixel), or for a dark one the sides or top of the picture.
        count, labels = cv2.connectedComponents(core | ground, connectivity=8)
        anchored = set(np.unique(labels[ground.astype(bool)]).tolist())
        if borders:
            anchored |= set(labels[0, :].tolist()) | set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
        anchored.discard(0)
        held = np.isin(labels, list(anchored)) & ~ground.astype(bool)
        held = cv2.dilate(held.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        covers.append(np.where(held, share, 0.0).astype(np.float32))
    dark, light = covers
    return np.maximum(dark, light), dark >= light


def guided(guide, p, r, eps):
    import matte

    return matte.guided(guide, p, r, eps)


def ground_rgba(rgb_full, region_small):
    """
    Her shot without its sky at full size (RGBA) and the sky's share of it: the sky's region (the reading's size) with its
    edge snapped to the picture's own (a guided filter on its light), the thin things across it put back in front, each
    with its own colour carried to its anti-aliased edge (a wire's edge pixels are half sky: over a title, they would
    draw a pale halo along it).
    """
    import cv2
    import numpy as np

    h, w = rgb_full.shape[:2]
    light = cv2.cvtColor(rgb_full, cv2.COLOR_RGB2LAB)[:, :, 0]
    up = cv2.resize(region_small.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
    reach = max(4, w // 160)
    snapped = np.clip(guided(light.astype(np.float32) / 255.0, up, reach, 1e-3), 0, 1)
    sky = np.clip((snapped - 0.3) / 0.4, 0, 1)
    sky = sky * sky * (3 - 2 * sky)
    thin, dark = thin_things(light, sky)
    edge = (thin > 0.02) & (thin < 0.98) & (sky > 0.02)
    colour = rgb_full
    if edge.any():
        colour = rgb_full.copy()
        colour[edge & dark] = cv2.erode(rgb_full, np.ones((3, 3), np.uint8))[edge & dark]
        colour[edge & ~dark] = cv2.dilate(rgb_full, np.ones((3, 3), np.uint8))[edge & ~dark]
    alpha = 1.0 - sky * (1.0 - thin)
    rgba = np.dstack([colour, (alpha * 255 + 0.5).astype(np.uint8)])
    return rgba, float((1.0 - alpha).mean())


def profile_of(region):
    """Where the sky ends in each of PROFILE columns of the picture (the first row below its sky that is not sky, shares of the height; 0 when the column starts on something)."""
    import numpy as np

    h, w = region.shape
    out = []
    for i in range(PROFILE):
        cols = region[:, int(i * w / PROFILE) : max(int(i * w / PROFILE) + 1, int((i + 1) * w / PROFILE))]
        # A column's sky: from the top down, rows mostly sky; where they stop. A thin band above it that is not sky (the
        # darkened corner of a graded shot, a wire along the edge) does not end it.
        rows = cols.mean(axis=1) >= 0.5
        lead = int(np.argmax(rows)) if rows.any() else h
        if lead > TOP_BAND * h:
            out.append(0.0)
            continue
        rest = rows[lead:]
        top = lead + (int(np.argmin(rest)) if not rest.all() else len(rest))
        out.append(round(float(top) / h, 3))
    return out


# ——— Its vanishing point ———————————————————————————————————————————————————————————————————————————————————————————


def segments_of(gray):
    """Its straight segments (x0, y0, x1, y1, length, angle in degrees from level, 0 to 180), long enough, neither level nor upright."""
    import cv2
    import numpy as np

    h, w = gray.shape
    lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
    found = lsd.detect(gray)[0]
    if found is None:
        return np.zeros((0, 6), np.float32)
    s = found.reshape(-1, 4).astype(np.float32)
    length = np.hypot(s[:, 2] - s[:, 0], s[:, 3] - s[:, 1])
    angle = (np.degrees(np.arctan2(s[:, 3] - s[:, 1], s[:, 2] - s[:, 0])) + 180.0) % 180.0
    keep = (length >= SEGMENT * np.hypot(w, h)) & (np.minimum(angle, 180 - angle) >= LEVEL) & (np.abs(angle - 90) >= UPRIGHT)
    return np.column_stack([s[keep], length[keep], angle[keep]])


def vanishing_point(gray):
    """
    Where the lines of one image run to (x, y shares of it, maybe a little outside) and how sure (the share of its
    slanted lines' length that runs there), or None: each pair of its longest segments meets somewhere; the meeting that
    the most segments' length points at (within ANGLE degrees, from VANISH_SPREAD degrees apart at least) wins, then
    refined on them by least squares.
    """
    import numpy as np

    h, w = gray.shape
    seg = segments_of(gray)
    if len(seg) < VANISH_LINES:
        return None
    seg = seg[np.argsort(-seg[:, 4])][:90]
    p = seg[:, 0:2]
    q = seg[:, 2:4]
    mid = (p + q) / 2
    # Each segment's line as a·x + b·y = c, (a, b) its unit normal.
    d = (q - p) / np.maximum(1e-6, seg[:, 4:5])
    normal = np.column_stack([-d[:, 1], d[:, 0]])
    c = (normal * p).sum(axis=1)
    candidates = []
    n = len(seg)
    for i in range(n):
        for j in range(i + 1, n):
            if abs(((seg[i, 5] - seg[j, 5] + 90) % 180) - 90) < VANISH_SPREAD:
                continue
            m = np.array([normal[i], normal[j]])
            det = np.linalg.det(m)
            if abs(det) < 1e-6:
                continue
            x, y = np.linalg.solve(m, [c[i], c[j]])
            if -VANISH_ROOM * w <= x <= (1 + VANISH_ROOM) * w and -VANISH_ROOM * h <= y <= (1 + VANISH_ROOM) * h:
                candidates.append((x, y))
    if not candidates:
        return None
    cand = np.array(candidates, np.float32)
    if len(cand) > 1500:
        cand = cand[np.random.default_rng(3).choice(len(cand), 1500, replace=False)]

    def support(point):
        # The angle between each segment and the line from its middle to the point: small when it runs there.
        to = point[None, :] - mid
        dist = np.maximum(1e-6, np.hypot(to[:, 0], to[:, 1]))
        cos = np.abs((to * d).sum(axis=1)) / dist
        off = np.degrees(np.arccos(np.clip(cos, -1, 1)))
        # A point on the segment itself (between its ends) is not where it runs to.
        beyond = dist > seg[:, 4] * 0.5
        return off, beyond

    total = float(seg[:, 4].sum())
    # Every candidate at once: each segment's pull (its length squared, as it points there), and from which side of the
    # point it comes. A point lines run to from one side only is where one family of nearly parallel lines meets far
    # away (a gallery's railings alone), not the end of the arcade they and the other side's run to.
    to = cand[:, None, :] - mid[None, :, :]
    dist = np.maximum(1e-6, np.hypot(to[..., 0], to[..., 1]))
    cos = np.abs((to * d[None, :, :]).sum(axis=2)) / dist
    off = np.degrees(np.arccos(np.clip(cos, -1, 1)))
    pull = (seg[None, :, 4] ** 2) * np.exp(-((off / ANGLE) ** 2)) * (dist > seg[None, :, 4] * 0.5)
    left = (pull * (mid[None, :, 0] < cand[:, None, 0])).sum(axis=1)
    above = (pull * (mid[None, :, 1] < cand[:, None, 1])).sum(axis=1)
    score = pull.sum(axis=1)
    balance = np.maximum(np.minimum(left, score - left), np.minimum(above, score - above)) / np.maximum(score, 1e-6)
    score = np.where(balance >= VANISH_BALANCE, score, 0.0)
    if not (score > 0).any():
        return None
    best = cand[int(np.argmax(score))]
    off, beyond = support(best)
    agree = (off <= 2 * ANGLE) & beyond
    if agree.sum() < VANISH_LINES:
        return None
    angles = seg[agree, 5]
    spread = max(abs(((a - b + 90) % 180) - 90) for a in angles for b in angles)
    if spread < VANISH_SPREAD:
        return None
    # Least squares on the segments that agree: the point nearest all their lines, weighted by their lengths.
    weight = seg[agree, 4]
    a_ = normal[agree] * weight[:, None]
    point, *_ = np.linalg.lstsq(a_, c[agree] * weight, rcond=None)
    return {"x": round(float(point[0] / w), 3), "y": round(float(point[1] / h), 3), "strength": round(float(weight.sum() / total), 2), "lines": int(agree.sum())}


# ——— Its light —————————————————————————————————————————————————————————————————————————————————————————————————————


def light_grid(frames, moves, cols, rows):
    """
    The mean light of each cell of the grid (rows from the top, in the first image's place: each reference cell read where
    the camera moved it), over images spread through the passage, as two hex digits (00 dark to ff white, the picture's
    luma); with the passage's mean light and its bright tenth (0 to 1).
    """
    import cv2
    import numpy as np

    import clear_area

    n = len(frames)
    keys = sorted(set(int(round(k)) for k in np.linspace(0, n - 1, min(n, LIGHT_KEYS))))
    u = (np.arange(cols) + 0.5) / cols
    v = (np.arange(rows) + 0.5) / rows
    uu, vv = np.meshgrid(u, v)
    total = np.zeros((rows, cols), np.float64)
    seen = np.zeros((rows, cols), np.float64)
    highs = []
    means = []
    for k in keys:
        luma = cv2.cvtColor(np.ascontiguousarray(frames[k]), cv2.COLOR_RGB2GRAY).astype(np.float32)
        h, w = luma.shape
        cells = cv2.resize(luma, (cols, rows), interpolation=cv2.INTER_AREA)
        means.append(float(luma.mean()))
        highs.append(float(np.percentile(luma, 90)))
        if moves is None or k == 0:
            total += cells
            seen += 1
            continue
        x, y = clear_area.where(moves[k], uu, vv)
        inside = (x >= 0) & (x < 1) & (y >= 0) & (y < 1)
        ci = np.clip((x * cols).astype(int), 0, cols - 1)
        ri = np.clip((y * rows).astype(int), 0, rows - 1)
        total += np.where(inside, cells[ri, ci], 0)
        seen += inside
    grid = np.where(seen > 0, total / np.maximum(seen, 1), 0)
    cells = "".join(f"{int(round(v)):02x}" for v in np.clip(grid, 0, 255).reshape(-1))
    return {"cols": cols, "rows": rows, "cells": cells, "mean": round(float(np.mean(means)) / 255, 3), "high": round(float(np.mean(highs)) / 255, 3)}


# ——— A passage ————————————————————————————————————————————————————————————————————————————————————————————————————


def sky_of(rgb, kw, kh, model=None):
    """One image's sky at the reading's size (bool, or None) and its clusters: seeded by its grid, grown pixel by pixel."""
    import cv2

    import clear_area

    small = cv2.resize(rgb, (kw, kh), interpolation=cv2.INTER_AREA)
    grid = cv2.resize(small, clear_area.work_size(kw, kh), interpolation=cv2.INTER_AREA)
    seed, reach = sky_cells(grid)
    if not seed.any():
        return None, model
    return sky_region(small, cells_at(seed, kw, kh), cells_at(reach, kw, kh), model)


def ground_file(job, src, start, seconds, hdr, sw, sh, photo):
    """
    The shot without its sky at every image, at the cut-out's size: its own colours, the sky transparent (a WebM VP9 with
    its alpha, or a PNG for a photo), and the sky's share of each image; its skyline on the first image.
    """
    import cv2
    import numpy as np

    ow, oh = even_size(sw, sh, OUT_LONG)
    kw, kh = even_size(sw, sh, SKY_LONG)
    out = f"{job['out']}.png" if photo else f"{job['out']}.webm"
    enc = None
    if not photo:
        enc = subprocess.Popen(
            [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{ow}x{oh}", "-r", str(FPS), "-i", "-",
             "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-cpu-used", "8",
             "-row-mt", "1", "-auto-alt-ref", "0", out],
            stdin=subprocess.PIPE,
        )
    shares, profile, model, previous, found = [], None, None, None, None
    count = 0
    missed = 0
    try:
        for rgb in stream(src, start, min(seconds, GROUND_SECONDS), ow, oh, hdr, photo):
            region, model = sky_of(rgb, kw, kh, model)
            # An image whose sky was not found after one that had it (a blur, a passer-by over its seed): the last sky
            # found, half a second at most; else its title would vanish behind the whole shot for an image.
            if region is not None:
                found, missed = region, 0
            elif found is not None and missed < CARRY:
                missed += 1
                region = found
            soft = region.astype(np.float32) if region is not None else np.zeros((kh, kw), np.float32)
            # A light smoothing over time, against a shimmer of its edge (the guided filter snaps it back to the picture).
            blended = soft if previous is None else 0.6 * soft + 0.4 * previous
            previous = soft
            if profile is None:
                profile = profile_of(region) if region is not None else [0.0] * PROFILE
            if region is not None:
                rgba, share = ground_rgba(rgb, blended)
            else:
                rgba, share = np.dstack([rgb, np.full((oh, ow), 255, np.uint8)]), 0.0
            shares.append(share)
            if photo:
                cv2.imwrite(out, cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
            else:
                enc.stdin.write(rgba.tobytes())
            count += 1
    finally:
        if enc:
            enc.stdin.close()
            if enc.wait() != 0:
                raise RuntimeError("encodage du ciel impossible")
    return out, count, shares, profile


def region_labels(rgb):
    """
    Its picture split along its own edges, at REGION_LONG: a label per pixel (1…n). Flattened, its colours sorted in
    groups; each group's larger pieces seed a region, grown along the picture's edges (watershed); then the smallest
    merged into the neighbour whose colour is nearest, until each is large enough and they are few enough.
    """
    import cv2
    import numpy as np

    h, w = rgb.shape[:2]
    sw, sh = even_size(w, h, REGION_LONG)
    small = cv2.resize(np.ascontiguousarray(rgb), (sw, sh), interpolation=cv2.INTER_AREA)
    flat = cv2.pyrMeanShiftFiltering(cv2.cvtColor(small, cv2.COLOR_RGB2BGR), REGION_SPACE, REGION_RANGE, maxLevel=1)
    lab = cv2.cvtColor(flat, cv2.COLOR_BGR2LAB).astype(np.float32)
    cv2.setRNGSeed(7)
    _, groups, _ = cv2.kmeans(lab.reshape(-1, 3), REGION_COLOURS, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    groups = groups.reshape(sh, sw)
    seeds = np.zeros((sh, sw), np.int32)
    n = 0
    for g in range(REGION_COLOURS):
        layer = cv2.morphologyEx((groups == g).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        count, pieces, stats, _ = cv2.connectedComponentsWithStats(layer, 8)
        for i in range(1, count):
            if stats[i, cv2.CC_STAT_AREA] >= REGION_SEED * sw * sh:
                n += 1
                core = cv2.erode((pieces == i).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                seeds[core & (seeds == 0)] = n
    if n == 0:
        return np.ones((sh, sw), np.int32)
    labels = cv2.watershed(flat.copy(), seeds)
    # Its edges (-1) and anything left to the neighbouring region.
    labels[labels < 1] = 0
    while (labels == 0).any():
        grown = cv2.dilate(labels.astype(np.float32), np.ones((3, 3), np.uint8)).astype(np.int32)
        empty = labels == 0
        labels[empty] = grown[empty]
    ring = np.ones((3, 3), np.uint8)
    while True:
        ids, areas = np.unique(labels, return_counts=True)
        smallest = int(np.argmin(areas))
        if len(ids) <= 1 or (len(ids) <= REGION_MAX and areas[smallest] >= REGION_LEAST * sw * sh):
            break
        r = ids[smallest]
        mine = labels == r
        around = (cv2.dilate(mine.astype(np.uint8), ring) > 0) & ~mine
        near, shared = np.unique(labels[around], return_counts=True)
        if not len(near):
            break
        colour = lab[mine].mean(axis=0)
        # The neighbour of the nearest colour, a long shared edge breaking a near tie.
        best = min(range(len(near)), key=lambda i: float(np.linalg.norm(lab[labels == near[i]].mean(axis=0) - colour)) - 0.002 * shared[i])
        labels[mine] = near[best]
    return labels


def regions_of(rgb):
    """
    Its picture's regions (PictureRegions): each one's outline in shares of the picture, flat [x0, y0, x1, y1…], its holes
    after it (each ring opened by -1, -1), largest first, together covering the picture; each a pixel wider all round.
    """
    import cv2
    import numpy as np

    labels = region_labels(rgb)
    sh, sw = labels.shape
    ids, areas = np.unique(labels, return_counts=True)
    out = []
    for r in ids[np.argsort(-areas)]:
        mask = cv2.medianBlur((labels == r).astype(np.uint8) * 255, 7)
        mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
        found, tree = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if not found:
            continue
        tree = tree[0]
        outer = [i for i in range(len(found)) if tree[i][3] < 0]
        if not outer:
            continue
        main = max(outer, key=lambda i: cv2.contourArea(found[i]))
        rings = [found[main]] + [found[i] for i in range(len(found)) if tree[i][3] == main and cv2.contourArea(found[i]) >= REGION_HOLE * sw * sh]
        flat = []
        for k, c in enumerate(rings):
            eps = 0.8
            p = cv2.approxPolyDP(c, eps, True)
            while len(p) > REGION_POINTS // (2 if k else 1) and eps < 20:
                eps *= 1.5
                p = cv2.approxPolyDP(c, eps, True)
            # Its holes while it stays within what is kept of a region (1 200 numbers: ShotReading).
            if len(p) < 3 or len(flat) + 2 * len(p) + 2 > 1200:
                continue
            if k:
                flat += [-1, -1]
            flat += [round(float(v), 4) for x, y in p[:, 0, :] for v in (min(1.0, max(0.0, x / (sw - 1))), min(1.0, max(0.0, y / (sh - 1))))]
        if len(flat) >= 6:
            out.append(flat)
    return out


def read(job):
    """A job's readings: { frames, still, motion?, sky?, vanish?, light?, regions?, file? }."""
    import cv2
    import numpy as np

    import clear_area
    import matte

    started = time.time()
    photo = bool(job.get("photo"))
    wanted = set(job.get("read") or ["sky", "vanish", "light"])
    start = 0.0 if photo else max(0.0, float(job.get("from") or 0))
    # Its regions alone are read on its first image: one image read, whatever the passage's length.
    seconds = 1.0 / FPS if photo or wanted == {"regions"} else min(MAX_SECONDS, max(1.0 / FPS, float(job.get("to") or 0) - start))
    sw, sh, hdr = matte.probe(job["src"])
    # The grid and the camera's move, as clear_area.py reads them (its images at 384 px).
    frames = clear_area.decode(job["src"], start, seconds, photo)
    found = clear_area.clear_map(frames)
    cols, rows, grid = found["cols"], found["rows"], found["cells"]
    moves = np.array(found["motion"]).reshape(-1, 3) if "motion" in found else None
    out = {"frames": len(frames), "still": moves is None}
    if moves is not None:
        out["motion"] = found["motion"]
    if "light" in wanted:
        out["light"] = light_grid(frames, moves, cols, rows)
    if "regions" in wanted:
        # On its first image at its own size (its edges finer than the grid's 384 px).
        first = next(stream(job["src"], start, 1.0 / FPS, *even_size(sw, sh, REGION_LONG), hdr, photo), None)
        out["regions"] = regions_of(first) if first is not None else []
    if "vanish" in wanted:
        keys = sorted(set(int(round(k)) for k in np.linspace(0, len(frames) - 1, min(len(frames), VANISH_KEYS))))
        kw, kh = even_size(sw, sh, SKY_LONG)
        points = []
        for k in keys:
            gray = cv2.cvtColor(cv2.resize(np.ascontiguousarray(frames[k]), (kw, kh), interpolation=cv2.INTER_LINEAR), cv2.COLOR_RGB2GRAY)
            vp = vanishing_point(gray)
            if vp is None:
                continue
            # Back to the first image's place (the camera's move undone).
            if moves is not None:
                s, dx, dy = moves[k]
                vp = {**vp, "x": round(0.5 + (vp["x"] - 0.5 - dx) / s, 3), "y": round(0.5 + (vp["y"] - 0.5 - dy) / s, 3)}
            points.append(vp)
        # Seen on most of its images, the same place: their median; a point seen once is not the shot's.
        if len(points) * 2 >= len(keys) or (len(keys) == 1 and points):
            xs, ys = np.array([p["x"] for p in points]), np.array([p["y"] for p in points])
            mx, my = float(np.median(xs)), float(np.median(ys))
            close = [p for p in points if abs(p["x"] - mx) < 0.08 and abs(p["y"] - my) < 0.08]
            if len(close) * 2 >= len(keys) or (len(keys) == 1 and close):
                out["vanish"] = {"x": round(mx, 3), "y": round(my, 3), "strength": round(float(np.median([p["strength"] for p in close])) * len(close) / len(keys), 2)}
        out.setdefault("vanish", None)
    if "ground" in wanted or "sky" in wanted:
        if "ground" in wanted:
            file, count, shares, profile = ground_file(job, job["src"], start, seconds, hdr, sw, sh, photo)
            share = float(np.mean(shares)) if shares else 0.0
            out["sky"] = {"share": round(share, 3), "profile": profile}
            # No sky: no ground (drawn over its title, the whole shot would hide it); Skyline then draws nothing.
            if share >= SKY_MIN:
                out["file"] = file
                out["ground_frames"] = count
            elif os.path.exists(file):
                os.remove(file)
        else:
            kw, kh = even_size(sw, sh, SKY_LONG)
            first = next(stream(job["src"], start, seconds, kw, kh, hdr, photo), None)
            region, _ = sky_of(first, kw, kh) if first is not None else (None, None)
            out["sky"] = {"share": round(float(region.mean()), 3) if region is not None else 0.0, "profile": profile_of(region) if region is not None else [0.0] * PROFILE}
    log(f"{job.get('id')}: {len(frames)} images in {time.time() - started:.1f} s, {', '.join(sorted(wanted))}" + (f", sky {out['sky']['share']:.0%}" if "sky" in out else "") + (f", vanishing at {out['vanish']['x']}, {out['vanish']['y']}" if out.get("vanish") else ""))
    return out


# ——— Its checks on synthetic images —————————————————————————————————————————————————————————————————————————————————


def street(w=640, h=360, shift=0):
    """A test picture: a sky (blue to pale, a soft cloud) over buildings, a pole and two wires across the sky, the lines of a street running to (0.62, 0.55)."""
    import cv2
    import numpy as np

    rng = np.random.default_rng(1)
    img = np.zeros((h, w, 3), np.float32)
    ys = np.linspace(0, 1, h)[:, None, None]
    img[:] = np.array([90, 150, 225]) * (1 - ys) + np.array([215, 225, 235]) * ys
    cv2.ellipse(img, (int(0.3 * w), int(0.14 * h)), (int(0.1 * w), int(0.04 * h)), 0, 0, 360, (235, 238, 240), -1)
    img = cv2.GaussianBlur(img, (0, 0), 6)
    vp = (0.62 * w + shift, 0.55 * h)
    # Buildings on both sides, their roofs sloping to the vanishing point.
    left = np.array([[0, int(0.25 * h)], [int(vp[0] - 40), int(vp[1] - 30)], [int(vp[0] - 40), h], [0, h]], np.int32)
    right = np.array([[w, int(0.2 * h)], [int(vp[0] + 40), int(vp[1] - 30)], [int(vp[0] + 40), h], [w, h]], np.int32)
    cv2.fillPoly(img, [left], (120, 95, 80))
    cv2.fillPoly(img, [right], (100, 90, 85))
    # Windows in rows, and lines along the street (kerbs, cornices) that run to the vanishing point.
    for k in range(6):
        for side, x0 in ((-1, 0), (1, w)):
            y0 = int((0.35 + 0.1 * k) * h)
            cv2.line(img, (x0, y0), (int(vp[0] + side * 30), int(vp[1] + (y0 - vp[1]) * 0.15)), (40, 35, 30), 2)
    cv2.line(img, (0, h), (int(vp[0]), int(vp[1])), (60, 60, 60), 3)
    cv2.line(img, (w, h), (int(vp[0]), int(vp[1])), (60, 60, 60), 3)
    # A pole and two wires across the sky.
    cv2.line(img, (int(0.85 * w), 0), (int(0.85 * w), h), (45, 40, 35), 4)
    cv2.line(img, (0, int(0.12 * h)), (w, int(0.18 * h)), (40, 40, 40), 1)
    cv2.line(img, (0, int(0.08 * h)), (int(0.85 * w), int(0.15 * h)), (40, 40, 40), 1)
    img += rng.normal(0, 1.5, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def self_test():
    """Its readings on synthetic pictures: the sky beside the buildings, its pole and wires in front, the street's vanishing point, the light of its cells."""
    import cv2
    import numpy as np

    import clear_area

    img = street()
    h, w = img.shape[:2]
    small = cv2.resize(img, clear_area.work_size(w, h), interpolation=cv2.INTER_AREA)
    found = clear_area.clear_map([small] * 4)
    seed, reach = sky_cells(small)
    assert cells_at(seed, w, h)[int(0.04 * h), int(0.45 * w)] and cells_at(seed, w, h)[int(0.25 * h), int(0.6 * w)], "the grid's sky seeds the sky, under its wires too"
    region, _ = sky_of(img, w, h)
    assert region is not None
    assert region[int(0.1 * h), int(0.5 * w)] and region[int(0.13 * h), int(0.2 * w)], "the sky under the wires is sky: they never cut it"
    assert not region[int(0.7 * h), int(0.2 * w)] and not region[int(0.8 * h), int(0.9 * w)], "the buildings are not"
    rgba, share = ground_rgba(img, region.astype(np.float32))
    alpha = 1 - rgba[:, :, 3].astype(np.float32) / 255
    assert 0.2 < share < 0.6, share
    assert alpha[int(0.05 * h), int(0.6 * w)] > 0.9, "the open sky is sky at full size"
    assert alpha[int(0.4 * h), int(0.85 * w)] < 0.2, "the pole is in front"
    wire = int(round(0.12 * h + 0.06 * h * 0.4))
    assert alpha[wire - 1 : wire + 2, int(0.4 * w)].min() < 0.3, "a wire is in front"
    assert alpha[int(0.165 * h), int(0.3 * w)] > 0.8 and alpha[int(0.165 * h), int(0.26 * w)] > 0.8, "the cloud is sky"
    prof = profile_of(region)
    assert prof[2] < 0.35 and prof[-3] < 0.3 and prof[int(0.62 * PROFILE)] > 0.4, prof
    vp = vanishing_point(cv2.cvtColor(img, cv2.COLOR_RGB2GRAY))
    assert vp is not None and abs(vp["x"] - 0.62) < 0.04 and abs(vp["y"] - 0.55) < 0.06, vp
    # Light: the sky's cells are light, the buildings' dark.
    light = light_grid([small] * 3, None, found["cols"], found["rows"])
    cells = np.array([int(light["cells"][i : i + 2], 16) for i in range(0, len(light["cells"]), 2)]).reshape(found["rows"], found["cols"])
    assert cells[1, 30] > 130 and cells[1, 30] - cells[int(0.8 * found["rows"]), 5] > 30, (cells[1, 30], cells[int(0.8 * found["rows"]), 5])
    assert 0.3 < light["mean"] < 0.7 and light["high"] > light["mean"], light
    # No sky (a plain wall to the top, its edges): nothing grown.
    busy = np.random.default_rng(2).integers(0, 255, (h, w, 3)).astype(np.uint8)
    none, _ = sky_of(busy, w, h)
    assert none is None, "nothing calm at the top, no sky"
    # Regions: a shop front (a cream wall, two red doors, a dark window between them, a grey pavement) split along its
    # own edges: each door its own region, the wall one with the doors as holes, the whole picture covered.
    front = np.zeros((360, 640, 3), np.uint8)
    front[:] = (232, 222, 196)
    front[280:] = (120, 118, 115)
    for x0 in (80, 400):
        front[80:280, x0 : x0 + 140] = (170, 30, 60)
    front[110:200, 270:370] = (40, 45, 60)
    front = np.clip(front.astype(np.float32) + np.random.default_rng(3).normal(0, 2, front.shape), 0, 255).astype(np.uint8)
    regions = regions_of(front)
    assert 4 <= len(regions) <= REGION_MAX, len(regions)
    labels = region_labels(front)
    lh, lw = labels.shape
    at = lambda x, y: labels[int(y * lh), int(x * lw)]  # noqa: E731
    assert at(0.23, 0.5) != at(0.73, 0.5) and at(0.23, 0.5) != at(0.5, 0.05), "each door its own region, not the wall's"
    assert at(0.5, 0.42) != at(0.5, 0.05) and at(0.5, 0.9) != at(0.5, 0.05), "the window and the pavement are not the wall"
    assert at(0.05, 0.05) not in (at(0.23, 0.5), at(0.73, 0.5)), "the wall is no door"
    assert any(-1 in flat for flat in regions), "a region around others (the wall) keeps its holes"
    canvas = np.zeros((360, 640), np.uint8)
    for flat in regions:
        rings, ring = [], []
        for i in range(0, len(flat), 2):
            if flat[i] < 0:
                rings.append(ring)
                ring = []
            else:
                ring.append((flat[i] * 639, flat[i + 1] * 359))
        rings.append(ring)
        layer = np.zeros_like(canvas)
        cv2.fillPoly(layer, [np.array(rings[0], np.int32)], 1)
        for hole in rings[1:]:
            cv2.fillPoly(layer, [np.array(hole, np.int32)], 0)
        canvas |= layer
    assert canvas.mean() > 0.97, canvas.mean()
    print("shot_read: ok")


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
