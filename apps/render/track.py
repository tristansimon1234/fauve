# What moves in her videos, run in the cut-out sandbox (never in the web app): at every
# image, where each hand is (its 21 points, fingertips included), each face (its box, eyes,
# nose, mouth, ears) and each body (33 points), followed from one image to the next with an
# id that stays, smoothed, short gaps filled. Open models (MediaPipe Tasks, Apache 2.0) on the
# CPU. Nothing here knows what an animation will do with it: it only says where things are.
# Usage: python track.py jobs.json → prints {"<id>": { file, frames, hands, faces, bodies, seconds } | { error }}.
# jobs.json: [{ id, src (a local video), out (the JSON file to write) }]. TRACK_MODELS: the folder of the
# three models; FFMPEG: ffmpeg. The file written: { v, fps, w, h, from, n, frames: [{ h, f, b }] }, each frame
# with its hands h: [id, x0, y0 … x20, y20], faces f: [id, x, y, w, h, then 6 points x, y] and bodies b:
# [id, x0, y0, v0 … x32, y32, v32], in thousandths of the picture (v: visibility in hundredths).
import json
import math
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor

FPS = 30
# The longest side the models read: enough for a hand at arm's length, light enough for 30 images a second.
LONG_SIDE = 960
# A clip is followed over its first minute at most (a Reel is 30 s).
MAX_SECONDS = 60
# A gap of a few images (a hand blurred by its own move) is filled; a longer one is an exit.
MAX_GAP = 5
# A thing seen fewer images than this is noise.
MIN_FRAMES = 6
HAND_CONFIDENCE = 0.4
BODY_CONFIDENCE = 0.7
FACE_CONFIDENCE = 0.7

MODELS = os.environ.get("TRACK_MODELS", ".")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


def size_of(src):
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
    m = re.search(r"Video:.*?, (\d{2,5})x(\d{2,5})", info)
    if not m:
        raise RuntimeError("vidéo illisible")
    w, h = int(m.group(1)), int(m.group(2))
    rot = re.search(r"rotation of (-?\d+(?:\.\d+)?) degrees|rotate\s*:\s*(-?\d+)", info)
    if rot:
        angle = abs(float(rot.group(1) or rot.group(2))) % 180
        if 45 < angle < 135:
            w, h = h, w
    return w, h


class OneEuro:
    """Smooths a value that jitters at rest without lagging when it moves fast (Casiez et al.)."""

    # Still at rest (1.2 Hz), and quick to follow a fast move: a word held between two fingers must not trail behind them.
    def __init__(self, min_cutoff=1.2, beta=20.0, d_cutoff=2.0):
        self.min_cutoff, self.beta, self.d_cutoff = min_cutoff, beta, d_cutoff
        self.x = None
        self.dx = 0.0

    @staticmethod
    def alpha(cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x, dt):
        if self.x is None:
            self.x = x
            return x
        dx = (x - self.x) / dt
        a_d = self.alpha(self.d_cutoff, dt)
        self.dx = a_d * dx + (1 - a_d) * self.dx
        a = self.alpha(self.min_cutoff + self.beta * abs(self.dx), dt)
        self.x = a * x + (1 - a) * self.x
        return self.x


class Ids:
    """Gives each thing seen the id it had on the previous images: the nearest one, close enough for its size."""

    def __init__(self):
        self.last = {}  # id -> (frame, x, y, size)
        self.next = 0

    def assign(self, frame, items):
        """items: [(x, y, size)] → their ids, in the same order."""
        pairs = []
        for i, (x, y, s) in enumerate(items):
            for tid, (f, lx, ly, ls) in self.last.items():
                if frame - f > MAX_GAP + 1:
                    continue
                d = math.hypot(x - lx, y - ly) / max(0.02, (s + ls) / 2)
                if d < 1.2:
                    pairs.append((d, i, tid))
        pairs.sort()
        ids = [None] * len(items)
        taken = set()
        for d, i, tid in pairs:
            if ids[i] is None and tid not in taken:
                ids[i] = tid
                taken.add(tid)
        for i in range(len(items)):
            if ids[i] is None:
                ids[i] = self.next
                self.next += 1
        for i, (x, y, s) in enumerate(items):
            self.last[ids[i]] = (frame, x, y, s)
        return ids


def head_of(pts, aspect):
    """A face box and its six points (eyes, nose, mouth, ears) from a body's head points, when it faces the camera."""
    nose, l_eye, r_eye, l_ear, r_ear, m_l, m_r = (pts[k] for k in (0, 2, 5, 7, 8, 9, 10))
    if min(nose[2], l_eye[2], r_eye[2]) < 0.6:
        return None
    eyes = math.hypot((l_eye[0] - r_eye[0]) * aspect, l_eye[1] - r_eye[1])
    ears = math.hypot((l_ear[0] - r_ear[0]) * aspect, l_ear[1] - r_ear[1]) if min(l_ear[2], r_ear[2]) > 0.5 else 0
    width = max(ears * 1.05, eyes * 2.4)  # in heights of the picture
    if width <= 0:
        return None
    mouth = ((m_l[0] + m_r[0]) / 2, (m_l[1] + m_r[1]) / 2)
    cx, cy = nose[0], ((l_eye[1] + r_eye[1]) / 2 + mouth[1]) / 2
    bw, bh = width / aspect, width * 1.25
    box = (cx - bw / 2, cy - bh * 0.55, bw, bh)
    points = [(r_eye[0], r_eye[1]), (l_eye[0], l_eye[1]), (nose[0], nose[1]), mouth, (r_ear[0], r_ear[1]), (l_ear[0], l_ear[1])]
    return box, points


def distinct(bodies, aspect):
    """The bodies of an image, a body read twice (the same head and shoulders, arms guessed two ways) kept once: the better seen."""
    kept = []
    for body in sorted(bodies, key=lambda b: -sum(p[2] for p in b[:25])):
        same = False
        for other in kept:
            shared = [(a, b) for a, b in zip(body[:13], other[:13]) if a[2] > 0.5 and b[2] > 0.5]
            if shared and sum(math.hypot((a[0] - b[0]) * aspect, a[1] - b[1]) for a, b in shared) / len(shared) < 0.05:
                same = True
                break
        if not same:
            kept.append(body)
    return kept


def inside(face_box, box):
    cx, cy = face_box[0] + face_box[2] / 2, face_box[1] + face_box[3] / 2
    return box[0] <= cx <= box[0] + box[2] and box[1] <= cy <= box[1] + box[3]


def spread(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(max(xs) - min(xs), max(ys) - min(ys))


def track(job):
    import numpy as np
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    started = time.time()
    src_w, src_h = size_of(job["src"])
    scale = LONG_SIDE / max(src_w, src_h)
    w = max(2, int(round(src_w * min(1, scale) / 2)) * 2)
    h = max(2, int(round(src_h * min(1, scale) / 2)) * 2)
    video = vision.RunningMode.VIDEO
    hands = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=f"{MODELS}/hand_landmarker.task"),
            running_mode=video,
            num_hands=2,
            # Found a little more easily than the defaults (a hand blurred by its own move), but kept only while it is
            # really there: lower, a hand hidden in the hair was still placed on the cheek.
            min_hand_detection_confidence=HAND_CONFIDENCE,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    )
    poses = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=f"{MODELS}/pose_landmarker_full.task"),
            running_mode=video,
            num_poses=2,
            # Strict: at the defaults, a hand filmed alone was read as a small body (and its head as a face).
            min_pose_detection_confidence=BODY_CONFIDENCE,
            min_pose_presence_confidence=BODY_CONFIDENCE,
            min_tracking_confidence=BODY_CONFIDENCE,
        )
    )
    faces = vision.FaceDetector.create_from_options(
        # Real faces score 0.8 and more; a hand or a pattern can reach 0.56.
        vision.FaceDetectorOptions(base_options=BaseOptions(model_asset_path=f"{MODELS}/blaze_face_short_range.tflite"), running_mode=video, min_detection_confidence=FACE_CONFIDENCE)
    )
    # Raw RGB images at the Reel's rate, the same grid as the video the render plays (normalized at 30 i/s).
    decode = subprocess.Popen(
        [FFMPEG, "-v", "error", "-t", str(MAX_SECONDS), "-i", job["src"], "-vf", f"fps={FPS},scale={w}:{h},format=rgb24", "-f", "rawvideo", "-"],
        stdout=subprocess.PIPE,
    )
    frame_bytes = w * h * 3
    raw = []  # per image: hands [(points)], faces [(box, points)], bodies [(points with visibility)]
    try:
        i = 0
        while True:
            buf = decode.stdout.read(frame_bytes)
            if not buf or len(buf) < frame_bytes:
                break
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.frombuffer(buf, dtype=np.uint8).reshape(h, w, 3))
            ms = int(i * 1000 / FPS)
            hr = hands.detect_for_video(image, ms)
            pr = poses.detect_for_video(image, ms)
            fr = faces.detect_for_video(image, ms)
            raw.append(
                {
                    "h": [[(l.x, l.y) for l in lm] for lm in hr.hand_landmarks],
                    # A point is seen when it is in the picture and not hidden (the least of the two).
                    "b": distinct([[(l.x, l.y, min(1.0 if l.visibility is None else l.visibility, 1.0 if l.presence is None else l.presence)) for l in lm] for lm in pr.pose_landmarks], w / h),
                    "f": [
                        (
                            (d.bounding_box.origin_x / w, d.bounding_box.origin_y / h, d.bounding_box.width / w, d.bounding_box.height / h),
                            [(k.x, k.y) for k in (d.keypoints or [])][:6],
                        )
                        for d in fr.detections
                    ],
                }
            )
            i += 1
    finally:
        decode.stdout.close()
        decode.wait()
        hands.close()
        poses.close()
        faces.close()
    if not raw:
        raise RuntimeError("aucune image lue")

    # Ids that stay from one image to the next, then one smoothing filter per coordinate of each thing.
    ids = {"h": Ids(), "f": Ids(), "b": Ids()}
    series = {"h": {}, "f": {}, "b": {}}  # kind -> id -> {frame: values}
    for n, seen in enumerate(raw):
        hand_keys = [spread(pts) for pts in seen["h"]]
        for tid, pts in zip(ids["h"].assign(n, hand_keys), seen["h"]):
            series["h"].setdefault(tid, {})[n] = [c for p in pts for c in p]
        # A face too far for the face model (a whole body in the frame) is read from its body's head.
        seen["f"] = seen["f"] + [face for face in (head_of(pts, w / h) for pts in seen["b"]) if face and not any(inside(face[0], b) for b, _ in seen["f"])]
        face_keys = [(b[0] + b[2] / 2, b[1] + b[3] / 2, max(b[2], b[3])) for b, _ in seen["f"]]
        for tid, (box, pts) in zip(ids["f"].assign(n, face_keys), seen["f"]):
            pts = (pts + [(box[0] + box[2] / 2, box[1] + box[3] / 2)] * 6)[:6]
            series["f"].setdefault(tid, {})[n] = list(box) + [c for p in pts for c in p]
        body_keys = [spread([(x, y) for x, y, v in pts if v > 0.5] or [(x, y) for x, y, v in pts]) for pts in seen["b"]]
        for tid, pts in zip(ids["b"].assign(n, body_keys), seen["b"]):
            series["b"].setdefault(tid, {})[n] = [c for p in pts for c in p]

    dt = 1.0 / FPS
    frames = [{} for _ in raw]
    counts = {"h": 0, "f": 0, "b": 0}
    for kind, by_id in series.items():
        kept = 0
        for tid, values in by_id.items():
            if len(values) < MIN_FRAMES:
                continue
            kept += 1
            first, last = min(values), max(values)
            filters = None
            previous = None
            for n in range(first, last + 1):
                if n in values:
                    v = values[n]
                    gap = n - previous if previous is not None else 1
                    if previous is not None and 1 < gap <= MAX_GAP + 1:
                        # A short gap: the images in between are drawn on the line from the last place to this one.
                        before = values[previous]
                        for g in range(previous + 1, n):
                            t = (g - previous) / gap
                            values[g] = [a + (b - a) * t for a, b in zip(before, v)]
                            write(frames, kind, g, tid, values[g], filters, dt)
                    elif previous is not None and gap > MAX_GAP + 1:
                        filters = None  # back after an exit: no smoothing across it
                    if filters is None:
                        filters = [OneEuro() for _ in v]
                    write(frames, kind, n, tid, v, filters, dt)
                    previous = n
        counts[kind] = kept

    out = {"v": 1, "fps": FPS, "w": w, "h": h, "from": 0, "n": len(frames), "frames": frames}
    with open(job["out"], "w") as f:
        json.dump(out, f, separators=(",", ":"))
    return {"file": job["out"], "frames": len(frames), "hands": counts["h"], "faces": counts["f"], "bodies": counts["b"], "seconds": round(time.time() - started, 1)}


def write(frames, kind, n, tid, values, filters, dt):
    """One thing at one image, smoothed, in thousandths (a body's visibility in hundredths)."""
    smooth = [f(v, dt) for f, v in zip(filters, values)] if filters else values
    if kind == "b":
        # x, y, visibility: only the places are smoothed, the visibility is kept as read.
        row = []
        for k in range(0, len(values), 3):
            row += [round(smooth[k] * 1000), round(smooth[k + 1] * 1000), round(max(0.0, min(1.0, values[k + 2])) * 100)]
    else:
        row = [round(v * 1000) for v in smooth]
    frames[n].setdefault(kind, []).append([tid] + row)


def run(job):
    try:
        return job["id"], track(job)
    except Exception as error:  # noqa: BLE001 — one clip that fails never stops the others
        return job["id"], {"error": str(error)[:300]}


if __name__ == "__main__":
    jobs = json.load(open(sys.argv[1]))
    workers = max(1, min(len(jobs), 4))
    results = {}
    if workers == 1:
        for job in jobs:
            key, value = run(job)
            results[key] = value
    else:
        import multiprocessing

        with ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context("spawn")) as pool:
            for key, value in pool.map(run, jobs):
                results[key] = value
    print(json.dumps(results))
    sys.stdout.flush()
    os._exit(0)
