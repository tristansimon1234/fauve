# The subject of a passage of her video, cut out at every image, run in the cut-out sandbox (never in the web
# app): so an animation can lay a text behind her as she walks, or lay her alone on a colour or on paper. The
# photo model (BiRefNet lite, MIT, rembg's ONNX export, the cut-outs' own) reads the images where the picture has
# moved since the last one it read, a key image; between two, the cut-out follows the moves measured by the optical
# flow (OpenCV's DIS), from the nearest key image, so a limb is never drawn twice. When the tracker followed a body
# there (track.py), only what stands on a person is kept: the model cuts out "what is in front", chairs included,
# one key image yes and the next no. A passage where nothing moves is read once: one image, its cut-out for the
# whole passage (a hill under a title, a shop front). Measured on a 720p street video: about 7 s per key image on 4
# CPUs (8.6 GB of memory at most), a key every 2 to 12 images by the moves, so a fast walk costs about 2 min of work
# a second of video there (about half on the sandbox's 8), a still shot one image. Its edge is then made at full size
# (lot 7, Tristan: « il faudra améliorer le détourage »): snapped to the edges of the picture itself by a guided filter
# on its light (the model reads at 1024 and the moves at 540: upscaled, its edge was soft and slightly off), and the
# colours of the edge freed of the background behind it, the subject's own colour carried out to its border (on a new
# ground, the half-transparent edge kept a grey halo of the old one). Without a tracked body, only the main subject and
# what is nearly as big stay (a chair or a lamp cut out on its own goes).
# Usage: python matte.py jobs.json → prints {"<id>": { file, still, frames, keys, seconds } | { error }}.
# jobs.json: [{ id, src (a local video), from, to (seconds of the clip), out (a path without its extension),
# track? (the clip's tracks JSON, its frames from the clip's start at 30 i/s) }]. MATTE_MODEL: the ONNX model;
# FFMPEG: ffmpeg; HDR_FILTER: NORMALIZE's tone mapping, so her cut-out has the colours of the shot it lies on.
import json
import os
import re
import subprocess
import sys
import time

FPS = 30
# The long side of the cut-out (the shot is framed in a 1080 × 1920 Reel) and of the picture the moves are read on.
OUT_LONG = 1920
WORK_WIDE = 540
# A key image again once the picture has moved this much since the last one (px at 540 wide), and at least every 12 images.
MOVE = 24.0
MAX_GAP = 15
# A passage whose whole move stays under this is still: one key image for all of it.
STILL_MOVE = 24.0
# The longest passage cut out (a Reel shows a few seconds of a shot).
MAX_SECONDS = 8.0
# The person: a body's bones, drawn thick around its skeleton (MediaPipe's 33 points).
BONES = [(11, 13), (13, 15), (12, 14), (14, 16), (15, 17), (15, 19), (16, 18), (16, 20), (23, 25), (25, 27), (27, 29), (27, 31), (24, 26), (26, 28), (28, 30), (28, 32), (11, 23), (12, 24)]

MODEL = os.environ.get("MATTE_MODEL", "model.onnx")
# A person's own model (MediaPipe's selfie segmenter, Apache 2.0): every image read in a few hundredths of a second,
# only the person; used where the tracker followed a body, the photo model elsewhere (an object, a dish, a hill).
# Measured on a woman talking to camera, 2.6 s: 20 s of work against 317 s for the photo model, her whole body kept,
# her hair a little less fine.
PERSON_MODEL = os.environ.get("PERSON_MODEL", "")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
HDR_FILTER = os.environ.get("HDR_FILTER", "")


def probe(src):
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
    m = re.search(r"Video:.*?, (\d{2,5})x(\d{2,5})", info)
    if not m:
        raise RuntimeError("vidéo illisible")
    w, h = int(m.group(1)), int(m.group(2))
    rot = re.search(r"rotation of (-?\d+(?:\.\d+)?) degrees|rotate\s*:\s*(-?\d+)", info)
    if rot and 45 < abs(float(rot.group(1) or rot.group(2))) % 180 < 135:
        w, h = h, w
    return w, h, bool(re.search(r"arib-std-b67|smpte2084", info))


def decode(src, start, seconds, w, h, hdr):
    """The passage's images at the Reel's rate, as NORMALIZE makes them (its tone mapping), at w × h, RGB."""
    import numpy as np

    chain = ",".join(filter(None, [HDR_FILTER if hdr else "", f"fps={FPS}", f"scale={w}:{h}:flags=lanczos", "format=rgb24"]))
    # Seeking after the input: exact to the image, the same images as the Reel plays.
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", src, "-ss", f"{start:.3f}", "-t", f"{seconds:.3f}", "-vf", chain, "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    n = len(raw) // (w * h * 3)
    if not n:
        raise RuntimeError("aucune image lue")
    return np.frombuffer(raw[: n * w * h * 3], np.uint8).reshape(n, h, w, 3)


def bodies_at(track, frame):
    """The bodies the tracker saw at an image of the clip: their 33 points (x, y in thousandths, visibility in hundredths)."""
    if not track or frame < 0 or frame >= len(track["frames"]):
        return []
    return [b[1:] for b in track["frames"][frame].get("b", [])]


def person_gate(bodies, w, h):
    """Where the people are: their skeletons drawn thick, then grown and softened; None when no body is seen."""
    import cv2
    import numpy as np

    if not bodies:
        return None
    gate = np.zeros((h, w), np.uint8)
    for b in bodies:
        pts = [(b[k * 3] / 1000 * w, b[k * 3 + 1] / 1000 * h, b[k * 3 + 2] / 100) for k in range(33)]
        if min(pts[11][2], pts[12][2]) < 0.3:
            continue
        shoulders = max(8.0, ((pts[11][0] - pts[12][0]) ** 2 + (pts[11][1] - pts[12][1]) ** 2) ** 0.5)
        torso = np.array([pts[11][:2], pts[12][:2], pts[24][:2], pts[23][:2]], np.int32)
        cv2.fillConvexPoly(gate, torso, 255)
        for a, c in BONES:
            if min(pts[a][2], pts[c][2]) < 0.2:
                continue
            thick = shoulders * (0.5 if a >= 23 else 0.38)
            cv2.line(gate, (int(pts[a][0]), int(pts[a][1])), (int(pts[c][0]), int(pts[c][1])), 255, max(2, int(thick)))
        head = pts[0]
        cv2.circle(gate, (int(head[0]), int(head[1] - shoulders * 0.15)), int(shoulders * 0.75), 255, -1)
    if not gate.any():
        return None
    grow = max(9, int(h * 0.05) | 1)
    gate = cv2.dilate(gate, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow, grow)))
    return cv2.GaussianBlur(gate, (grow, grow), 0).astype(np.float32) / 255.0


def main_subject(m):
    """The main subject of a cut-out and what is nearly as big (a second person); a small thing apart goes."""
    import cv2
    import numpy as np

    count, labels, stats, _ = cv2.connectedComponentsWithStats((m > 0.5).astype(np.uint8), 8)
    if count <= 2:
        return m
    areas = stats[1:, cv2.CC_STAT_AREA]
    keep = np.isin(labels, 1 + np.nonzero(areas >= 0.25 * areas.max())[0]).astype(np.uint8)
    keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    return m * cv2.GaussianBlur(keep.astype(np.float32), (15, 15), 0)


def box(x, r):
    import cv2

    return cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REFLECT)


def guided(guide, p, r, eps):
    """He's guided filter: p reshaped to follow the edges of guide (both float32, one channel)."""
    mean_i, mean_p = box(guide, r), box(p, r)
    var_i = box(guide * guide, r) - mean_i * mean_i
    a = (box(guide * p, r) - mean_i * mean_p) / (var_i + eps)
    b = mean_p - a * mean_i
    return box(a, r) * guide + box(b, r)


def cut(job, session):
    import cv2
    import numpy as np

    started = time.time()
    src_w, src_h, hdr = probe(job["src"])
    start = max(0.0, float(job["from"]))
    seconds = min(MAX_SECONDS, max(1.0 / FPS, float(job["to"]) - start))
    scale = min(1.0, OUT_LONG / max(src_w, src_h))
    ow, oh = max(2, int(round(src_w * scale / 2)) * 2), max(2, int(round(src_h * scale / 2)) * 2)
    frames = decode(job["src"], start, seconds, ow, oh, hdr)
    n = len(frames)
    ww, wh = WORK_WIDE, max(2, int(round(oh * WORK_WIDE / ow / 2)) * 2)
    work = [cv2.resize(f, (ww, wh), interpolation=cv2.INTER_AREA) for f in frames]
    gray = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) for f in work]

    # Where the picture moves: key images where it moves, few where it is still.
    fast = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_ULTRAFAST)
    small = [cv2.resize(g, (ww // 3, wh // 3)) for g in gray]
    keys, moved, total = [0], 0.0, 0.0
    for i in range(1, n):
        step = float(np.percentile(np.linalg.norm(fast.calc(small[i - 1], small[i], None), axis=2) * 3, 95))
        moved += step
        total += step
        if moved >= MOVE or i - keys[-1] >= MAX_GAP:
            keys.append(i)
            moved = 0.0
    still = total < STILL_MOVE
    if still:
        keys = [n // 2]
    elif keys[-1] != n - 1:
        keys.append(n - 1)

    track = None
    if job.get("track"):
        try:
            track = json.load(open(job["track"]))
        except Exception:  # noqa: BLE001 — no tracks: the photo model alone
            track = None
    first = int(round(start * FPS))
    people = sum(1 for k in keys if bodies_at(track, first + k)) * 2 >= len(keys) if track else False

    # A person, followed by the tracker: her own model at every image (no key images to carry along the moves). The
    # photo model elsewhere, or when it is missing. A hand blurred by a fast gesture may come out thinner.
    if people and not still and PERSON_MODEL and os.path.exists(PERSON_MODEL):
        return finish(job, frames, person_masks(frames, ww, wh), still, 0, people, started, ow, oh)

    inp = session.get_inputs()[0].name
    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)

    def read(img):
        x = cv2.resize(img, (1024, 1024), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
        m = session.run(None, {inp: ((x - mean) / std).transpose(2, 0, 1)[None]})[0][0, 0]
        return cv2.resize(1 / (1 + np.exp(-m)), (ww, wh), interpolation=cv2.INTER_LINEAR)

    km = {}
    last_gate = None
    for k in keys:
        m = read(frames[k])
        if people:
            g = person_gate(bodies_at(track, first + k), ww, wh)
            # A body the tracker lost for a moment: the last place it was seen, a little wider.
            g = g if g is not None else (cv2.dilate(last_gate, np.ones((15, 15), np.uint8)) if last_gate is not None else None)
            if g is not None:
                m = m * g
                last_gate = g
        km[k] = m if people else main_subject(m)

    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    grid = np.dstack(np.meshgrid(np.arange(ww), np.arange(wh))).astype(np.float32)

    def carry(mask, a, b):
        """The cut-out of image a, moved to image b along the flow from b to a (each flow used once, not kept)."""
        return cv2.remap(mask, grid + dis.calc(gray[b], gray[a], None), None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    masks = []
    if still:
        masks = [km[keys[0]]]
    else:
        # Each image from the nearest key image, step by step along the moves (a long jump loses a fast limb);
        # a short cross-fade at the middle only, so the change of key image does not jump.
        forward = {}
        for k0, k1 in zip(keys, keys[1:]):
            a = km[k0]
            for t in range(k0 + 1, k1):
                a = carry(a, t - 1, t)
                forward[t] = a
            b = km[k1]
            for t in range(k1 - 1, k0, -1):
                b = carry(b, t + 1, t)
                w = min(1.0, max(0.0, ((t - k0) / (k1 - k0) - 0.4) / 0.2))
                forward[t] = forward[t] * (1 - w) + b * w
        masks = [km[t] if t in km else forward[t] for t in range(n)]
        # A light smoothing over time, against a shimmer of the edges.
        masks = [masks[0]] + [0.5 * masks[i] + 0.25 * masks[i - 1] + 0.25 * masks[min(n - 1, i + 1)] for i in range(1, n)]

    return finish(job, frames, masks, still, len(keys), people, started, ow, oh, keys[0] if still else 0)


def person_masks(frames, ww, wh):
    """A person at every image, read by her own model (in the order of the images: it keeps the person from one to the next)."""
    import cv2
    import mediapipe as mp
    import numpy as np
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision

    options = vision.ImageSegmenterOptions(
        base_options=mpp.BaseOptions(model_asset_path=PERSON_MODEL), running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True
    )
    masks = []
    with vision.ImageSegmenter.create_from_options(options) as segmenter:
        for i, f in enumerate(frames):
            found = segmenter.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f)), int(i * 1000 / FPS))
            conf = found.confidence_masks
            # Its first class is the background: the person is all the rest (hair, body, face, clothes).
            person = 1.0 - conf[0].numpy_view() if len(conf) > 1 else conf[0].numpy_view()
            # The main person and those nearly as big (someone small at the back goes); never cut by the skeleton's
            # outline, which took the hem of a crop top and a bare waist away.
            masks.append(main_subject(cv2.resize(np.ascontiguousarray(person, dtype=np.float32), (ww, wh), interpolation=cv2.INTER_LINEAR)))
    # A light smoothing over time, against a shimmer of the edges.
    return [masks[0]] + [0.5 * masks[i] + 0.25 * masks[i - 1] + 0.25 * masks[min(len(masks) - 1, i + 1)] for i in range(1, len(masks))]


def finish(job, frames, masks, still, keys, people, started, ow, oh, still_at=0):
    """The cut-out of every image written out (its edge made at full size), with where its top sits."""
    import cv2
    import numpy as np

    def head_top(m):
        # The top of the subject (its head, its hair): the first row where it covers 2 % of the width, as a share of the height.
        rows = np.nonzero((m > 0.5).mean(axis=1) > 0.02)[0]
        return rows[0] / m.shape[0] if len(rows) else 1.0

    # Where its top sits along the passage (the highest a fifth of the time: a head that rises counts), so a word laid
    # behind her is placed where her head covers only its bottom.
    top = round(float(np.percentile([head_top(m) for m in masks], 20)), 3)

    def box_of(m):
        # Where the subject is in the image (shares of it: left, top, width, height), so a label or brackets follow it.
        ys, xs = np.nonzero(m > 0.5)
        if not len(xs):
            return None
        h, w = m.shape
        return [round(xs.min() / w, 3), round(ys.min() / h, 3), round((xs.max() - xs.min() + 1) / w, 3), round((ys.max() - ys.min() + 1) / h, 3)]

    boxes = [box_of(m) for m in masks]

    # The edge at full size: the guided filter's reach and the band where the edge's colours are carried out.
    reach = max(4, ow // 135)
    soft = (2 * reach + 1) | 1

    def rgba(f, m):
        # Its edge on the picture's own edges, then solid where the model is fairly sure (a body blurred by its own move
        # read at 0.5 stays solid), soft at the edge.
        light = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        up = cv2.resize(m, (ow, oh), interpolation=cv2.INTER_LINEAR).astype(np.float32)
        snapped = np.clip(guided(light, up, reach, 1e-3), 0, 1)
        a = np.clip((snapped - 0.22) / 0.38, 0, 1)
        a = a * a * (3 - 2 * a)
        # Its edge's colours: the subject's own, just inside, carried out to its border where it is half transparent.
        solid = (a >= 0.95).astype(np.float32)
        weight = cv2.blur(solid, (soft, soft))
        img = f.astype(np.float32)
        inside = cv2.blur(img * solid[..., None], (soft, soft)) / np.maximum(weight, 1e-3)[..., None]
        t = (np.clip((0.98 - a) / 0.3, 0, 1) * (weight > 0.04))[..., None]
        color = img * (1 - t) + inside * t
        return np.dstack([np.clip(color, 0, 255).astype(np.uint8), (a * 255).astype(np.uint8)])

    if still:
        out = f"{job['out']}.png"
        cv2.imwrite(out, cv2.cvtColor(rgba(frames[still_at], masks[0]), cv2.COLOR_RGBA2BGRA))
    else:
        out = f"{job['out']}.webm"
        enc = subprocess.Popen(
            [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{ow}x{oh}", "-r", str(FPS), "-i", "-",
             "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "32", "-deadline", "realtime", "-cpu-used", "8",
             "-row-mt", "1", "-auto-alt-ref", "0", out],
            stdin=subprocess.PIPE,
        )
        for f, m in zip(frames, masks):
            enc.stdin.write(rgba(f, m).tobytes())
        enc.stdin.close()
        if enc.wait() != 0:
            raise RuntimeError("encodage du détourage impossible")
    return {"file": out, "still": still, "frames": len(frames), "keys": keys, "people": people, "top": top, "boxes": boxes, "seconds": round(time.time() - started, 1)}


if __name__ == "__main__":
    import onnxruntime as ort

    jobs = json.load(open(sys.argv[1]))
    options = ort.SessionOptions()
    options.intra_op_num_threads = os.cpu_count() or 4
    # No memory plan (the pool stays, for speed): with both, the model held 13 GB of the sandbox's 16 over a passage
    # of 2 s; without the plan, 8.6 GB at the same speed (without the pool too, 7.4 GB but twice as slow).
    options.enable_mem_pattern = False
    session = ort.InferenceSession(MODEL, options, providers=["CPUExecutionProvider"])
    results = {}
    # One passage after the other: the model already uses every CPU.
    for job in jobs:
        try:
            results[job["id"]] = cut(job, session)
        except Exception as error:  # noqa: BLE001 — one passage that fails never stops the others
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
    os._exit(0)
