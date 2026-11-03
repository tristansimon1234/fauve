# Her video's depth at every image of a passage (lib/render/gpu.ts), read on the rented card by the model the photos'
# relief uses (Depth Anything V2 Small, Apache 2.0, relief.py): near white, far black, as a machine sees the room, for a
# composition to show it (Depth in the animations' scope: the grey depth pass of a computer-vision Reel, a fog or a light
# that falls with distance, a reveal from the nearest to the farthest). The same images as the Reel plays (matte.py's
# decode: the Reel's rate, NORMALIZE's tone mapping), scaled per passage (2 % clipped at each end, measured on images
# spread through it, so a near object never makes the room flicker) and smoothed over a few images.
# Usage: python -I depth_video.py jobs.json → prints {"<id>": { frames, w, h, uploaded } | { error }}.
# jobs.json: [{ id, url (signed) or src (a local file), from, to (seconds of the clip), upload?: { mp4 }, out? }].
# DEPTH_MODEL: the model's folder; DEPTH_CPU=1 runs on a CPU; HDR_FILTER: an iPhone's HDR made SDR, as the render does.
import json
import os
import subprocess
import sys
import time

# matte.py and portrait.py sit beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

MODEL = os.environ.get("DEPTH_MODEL", "/models/depth-anything-v2-small")
CPU = os.environ.get("DEPTH_CPU") == "1"
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
# Its long side at most (a grey pass needs no more), both sides even.
LONG = 960
# Images read together on the card.
BATCH = 8
# How much each image keeps of the one before (a depth read alone flickers a little from one image to the next).
SMOOTH = 0.35
# The images its scale is measured on, spread through the passage.
SAMPLES = 12


def size_of(w, h):
    scale = min(1.0, LONG / max(w, h))
    return max(2, int(round(w * scale / 2)) * 2), max(2, int(round(h * scale / 2)) * 2)


def depths(model, processor, frames, device):
    """The raw depth of each image (larger is nearer), at the images' size."""
    import numpy as np
    import torch
    from PIL import Image

    h, w = frames.shape[1:3]
    out = []
    for i in range(0, len(frames), BATCH):
        batch = [Image.fromarray(f) for f in frames[i : i + BATCH]]
        inputs = processor(images=batch, return_tensors="pt").to(device)
        if device == "cuda":
            inputs = {k: (v.half() if v.dtype == torch.float32 else v) for k, v in inputs.items()}
        with torch.inference_mode():
            d = model(**inputs).predicted_depth
        d = torch.nn.functional.interpolate(d[:, None].float(), size=(h, w), mode="bicubic", align_corners=False)[:, 0]
        # Kept in half precision: twenty seconds of images at 540 × 960 hold in about 600 MB.
        out.extend(x.cpu().numpy().astype(np.float16) for x in d)
    return out


def passage(job, model, processor, device):
    import numpy as np

    import matte
    from portrait import log

    started = time.time()
    w0, h0, hdr = matte.probe(job["src"])
    w, h = size_of(w0, h0)
    start, end = float(job["from"]), float(job["to"])
    frames = matte.decode(job["src"], start, max(0.04, end - start), w, h, hdr)
    raw = depths(model, processor, frames, device)
    # Its scale, measured once on images spread through the passage: the same near and far for every image.
    picks = np.linspace(0, len(raw) - 1, num=min(SAMPLES, len(raw))).round().astype(int)
    sample = np.concatenate([raw[i][::4, ::4].ravel() for i in picks])
    lo, hi = np.percentile(sample, [2, 98])
    span = max(1e-6, float(hi - lo))
    file = f"{job['out']}.mp4"
    enc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{w}x{h}", "-r", str(matte.FPS), "-i", "pipe:0",
         "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-movflags", "+faststart", file],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    previous = None
    for d in raw:
        n = np.clip((d.astype(np.float32) - lo) / span, 0, 1)
        n = n if previous is None else SMOOTH * previous + (1 - SMOOTH) * n
        previous = n
        enc.stdin.write((n * 255 + 0.5).astype(np.uint8).tobytes())
    enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError(f"vidéo : {enc.stderr.read().decode(errors='replace')[:200]}")
    log(f"depth of {len(raw)} images at {w}×{h} in {time.time() - started:.1f} s")
    return {"file": file, "frames": len(raw), "w": w, "h": h}


if __name__ == "__main__":
    import torch
    from transformers import AutoImageProcessor, DepthAnythingForDepthEstimation

    from portrait import fetch, log, send

    jobs = json.load(open(sys.argv[1]))
    started = time.time()
    device = "cpu" if CPU or not torch.cuda.is_available() else "cuda"
    if device == "cpu" and not CPU:
        raise SystemExit("pas de carte graphique pour la profondeur")
    processor = AutoImageProcessor.from_pretrained(MODEL)
    model = DepthAnythingForDepthEstimation.from_pretrained(MODEL, use_safetensors=True).to(device).eval()
    if device == "cuda":
        model = model.half()
    log(f"depth model loaded on the {'card' if device == 'cuda' else 'CPU'} in {time.time() - started:.1f} s")
    work = os.environ.get("DEPTH_WORK", "/tmp")
    results = {}
    for i, job in enumerate(jobs):
        try:
            src = job.get("src")
            if not src:
                src = os.path.join(work, f"clip{i}")
                fetch(job["url"], src)
            r = passage({**job, "src": src, "out": job.get("out") or os.path.join(work, f"depth{i}")}, model, processor, device)
            if job.get("upload"):
                send(r["file"], job["upload"]["mp4"], "video/mp4")
                r = {k: v for k, v in r.items() if k != "file"} | {"uploaded": True}
            results[job["id"]] = r
        except Exception as error:  # noqa: BLE001 — one passage that fails never stops the others
            log(f"depth {job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
    sys.stderr.flush()
    # As matte.py: out at once, without waiting on the model's threads and the card's libraries to wind down.
    os._exit(0)
