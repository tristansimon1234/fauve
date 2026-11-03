# The subject of each photo cut out on the rented card (lib/render/gpu.ts): the full BiRefNet (general use, MIT, the
# same family as the cut-out sandbox's lite model, in rembg's ONNX export, made half precision once on Modal) reads
# the photo, and everything after is cutout.mjs's own rules, so a cut-out from the card and one from the sandbox mean
# the same: the specks dropped, the soft edge kept only around what stays, its coverage, parts, box, the edges it runs
# into and the share of its edge the model was unsure of (stickerWorthy, sceneWorthy), and the photo with that
# transparency at 1440 px at most, in WebP (else PNG). A person, a dish, a product, a glass: the full model keeps
# hair, flowers and a glass's rim that the lite one rounds off.
# Usage: PHOTO_MODEL=… python -I photo_cut.py jobs.json → prints {"<id>": { w, h, coverage, parts, box, touches,
# unsure, ext, uploaded } | { error }}. jobs.json: [{ id, url (the photo, signed) or src (a local file),
# upload?: { webp, png } (signed upload links), out? }]. PHOTO_CPU=1 runs it on a CPU.
import json
import os
import re
import subprocess
import sys
import time

# portrait.py and matte.py sit beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
# The model's input: a 1024 × 1024 picture.
S = 1024
# The cut-out's longest side: enough for a sticker on a 1080 × 1920 Reel.
MAX_SIDE = 1440
# A part of the subject smaller than this share of the largest is a speck, dropped.
SPECK = 0.1
# How far (px at 1024) the model's soft edge is kept around the subject.
EDGE = 6


def size(src):
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
    m = re.search(r", (\d{2,5})x(\d{2,5})", info)
    if not m:
        raise RuntimeError("image illisible")
    return int(m.group(1)), int(m.group(2))


def pixels(src, w, h):
    """The photo at w × h, RGB (read by ffmpeg, as the sandbox reads it)."""
    import numpy as np

    raw = subprocess.run([FFMPEG, "-v", "error", "-i", src, "-vf", f"scale={w}:{h}:flags=lanczos", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], capture_output=True).stdout
    if len(raw) != w * h * 3:
        raise RuntimeError("image illisible")
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def cut(job, session):
    import cv2
    import numpy as np

    w, h = size(job["src"])
    img = pixels(job["src"], S, S)
    # BiRefNet's normalisation (ImageNet's), on the picture scaled to its brightest pixel, like rembg.
    x = img.astype(np.float32) / max(1, int(img.max()))
    x = ((x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)).transpose(2, 0, 1)[None]
    logits = session.run(None, {session.get_inputs()[0].name: x})[0][0, 0].astype(np.float32)
    prob = 1 / (1 + np.exp(-logits))
    lo, hi = float(prob.min()), float(prob.max())
    prob = (prob - lo) / ((hi - lo) or 1)

    # The subject's parts (4 neighbours), specks dropped; the soft edge kept only around what stays.
    count, labels, stats, _ = cv2.connectedComponentsWithStats((prob > 0.5).astype(np.uint8), connectivity=4)
    areas = stats[1:, cv2.CC_STAT_AREA]
    if not len(areas):
        raise RuntimeError("aucun sujet trouvé")
    keep = [i + 1 for i, a in enumerate(areas) if a >= areas.max() * SPECK]
    kept = np.isin(labels, keep).astype(np.uint8)
    near = cv2.dilate(kept, np.ones((2 * EDGE + 1, 2 * EDGE + 1), np.uint8)) > 0
    v = np.where(near, prob, 0)
    mask = np.round(v * 255).astype(np.uint8)
    on = v > 0.5
    n = int(on.sum())
    if not n:
        raise RuntimeError("aucun sujet trouvé")
    unsure = int(((v > 0.1) & (v < 0.9)).sum())
    ys, xs = np.nonzero(on)
    r = lambda t: round(float(t), 3)  # noqa: E731
    # How much of each edge of the photo the subject runs into (a bust runs into the bottom).
    edge = lambda line: round(float((line > 127).mean()), 2)  # noqa: E731
    touches = {"top": edge(mask[0]), "bottom": edge(mask[-1]), "left": edge(mask[:, 0]), "right": edge(mask[:, -1])}

    scale = min(1.0, MAX_SIDE / max(w, h))
    W, H = max(2, int(round(w * scale / 2)) * 2), max(2, int(round(h * scale / 2)) * 2)
    rgba = np.dstack([pixels(job["src"], W, H), cv2.resize(mask, (W, H), interpolation=cv2.INTER_CUBIC)])
    file = f"{job['out']}.webp"
    written = subprocess.run(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-i", "pipe:0", "-frames:v", "1", "-c:v", "libwebp", "-quality", "90", "-pix_fmt", "yuva420p", file],
        input=rgba.tobytes(),
        capture_output=True,
    )
    if written.returncode != 0:
        file = f"{job['out']}.png"
        if not cv2.imwrite(file, cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_PNG_COMPRESSION, 9]):
            raise RuntimeError(f"image : {written.stderr.decode(errors='replace')[:200]}")
    return {
        "file": file,
        "w": W,
        "h": H,
        "coverage": r(n / (S * S)),
        "parts": len(keep),
        "box": {"x": r(xs.min() / S), "y": r(ys.min() / S), "w": r((xs.max() - xs.min() + 1) / S), "h": r((ys.max() - ys.min() + 1) / S)},
        "touches": touches,
        "unsure": r(unsure / n),
    }


if __name__ == "__main__":
    from portrait import fetch, load, log, send

    jobs = json.load(open(sys.argv[1]))
    session = load(os.environ.get("PHOTO_MODEL", "/models/general-fp16.onnx"), gpu=os.environ.get("PHOTO_CPU") != "1")
    work = os.environ.get("PHOTO_WORK", "/tmp")
    results = {}
    for i, job in enumerate(jobs):
        try:
            started = time.time()
            src = job.get("src")
            if not src:
                src = os.path.join(work, f"photo{i}")
                fetch(job["url"], src)
            res = cut({**job, "src": src, "out": job.get("out") or os.path.join(work, f"cut{i}")}, session)
            ext = "webp" if res["file"].endswith(".webp") else "png"
            if job.get("upload"):
                send(res["file"], job["upload"][ext], f"image/{ext}")
                res = {k: v for k, v in res.items() if k != "file"} | {"uploaded": True}
            results[job["id"]] = res | {"ext": ext}
            log(f"photo {i + 1}/{len(jobs)} cut out in {time.time() - started:.1f} s")
        except Exception as error:  # noqa: BLE001 — one photo that fails never stops the others
            log(f"photo {job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
    sys.stderr.flush()
    # As matte.py: out at once, without waiting on the model's threads and the card's libraries to wind down.
    os._exit(0)
