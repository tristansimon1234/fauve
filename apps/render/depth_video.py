# Her video's depth at every image of a passage (lib/render/gpu.ts), read on the rented card by the model the photos'
# relief uses (Depth Anything V2 Small, Apache 2.0, relief.py): near white, far black, as a machine sees the room, for a
# composition to show it (Depth in the animations' scope: the grey depth pass of a computer-vision Reel, a fog or a light
# that falls with distance, a reveal from the nearest to the farthest). The same images as the Reel plays (matte.py's
# decode: the Reel's rate, NORMALIZE's tone mapping), scaled per passage (2 % clipped at each end, measured on images
# spread through it, so a near object never makes the room flicker) and smoothed over a few images.
# A job marked `near` writes instead her shot itself at the cut-out's size with its depth as its transparency (near
# opaque, far clear: a WebM VP9 with its alpha), its depth's edge snapped to the picture's (matte.py's guided filter on
# its light), for a composition to keep only what is nearer than a distance that recedes (Near in the animations' scope:
# a shot rebuilt from the nearest to the farthest, a whole foreground kept over another shot's ground).
# Usage: python -I depth_video.py jobs.json → prints {"<id>": { frames, w, h, uploaded } | { error }}.
# jobs.json: [{ id, url (signed) or src (a local file), from, to (seconds of the clip), near?, upload?: { mp4 | webm }, out? }].
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
    if job.get("near"):
        end = min(end, start + NEAR_SECONDS)
    frames = matte.decode(job["src"], start, max(0.04, end - start), w, h, hdr)
    raw = depths(model, processor, frames, device)
    # Its scale, measured once on images spread through the passage: the same near and far for every image.
    picks = np.linspace(0, len(raw) - 1, num=min(SAMPLES, len(raw))).round().astype(int)
    sample = np.concatenate([raw[i][::4, ::4].ravel() for i in picks])
    lo, hi = np.percentile(sample, [2, 98])
    span = max(1e-6, float(hi - lo))
    if job.get("near"):
        return nearness(job, raw, lo, span, w0, h0, hdr, start, end, started)
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


# Her shot with its depth as its transparency: at the cut-out's size (matte.py's OUT_LONG), NEAR_SECONDS at most.
NEAR_SECONDS = 12.0


def nearness(job, raw, lo, span, w0, h0, hdr, start, end, started):
    """
    Her shot at the cut-out's size, each image with its depth as its transparency (near opaque, far clear), its depth
    upscaled and snapped to the picture's own edges by a guided filter on its light (the depth is read at 960 px: its
    edges were soft and a little off), smoothed over time like the grey pass; a WebM VP9 with its alpha.
    """
    import cv2
    import numpy as np

    import matte

    scale = min(1.0, matte.OUT_LONG / max(w0, h0))
    ow, oh = max(2, int(round(w0 * scale / 2)) * 2), max(2, int(round(h0 * scale / 2)) * 2)
    seconds = min(NEAR_SECONDS, max(0.04, end - start))
    file = f"{job['out']}.webm"
    enc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{ow}x{oh}", "-r", str(matte.FPS), "-i", "-",
         "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "24", "-deadline", "realtime", "-cpu-used", "8",
         "-row-mt", "1", "-auto-alt-ref", "0", file],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    reach = max(4, ow // 135)
    previous = None
    count = 0
    # Her images one by one at full size (twenty seconds of them at 1920 px would not hold in memory at once).
    chain = ",".join(filter(None, [os.environ.get("HDR_FILTER", "") if hdr else "", f"fps={matte.FPS}", f"scale={ow}:{oh}:flags=lanczos", "format=rgb24"]))
    proc = subprocess.Popen([FFMPEG, "-v", "error", "-i", job["src"], "-ss", f"{start:.3f}", "-t", f"{seconds:.3f}", "-vf", chain, "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    size = ow * oh * 3
    try:
        for d in raw:
            data = proc.stdout.read(size)
            if len(data) < size:
                break
            rgb = np.frombuffer(data, np.uint8).reshape(oh, ow, 3)
            n = np.clip((d.astype(np.float32) - lo) / span, 0, 1)
            n = n if previous is None else SMOOTH * previous + (1 - SMOOTH) * n
            previous = n
            light = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
            up = cv2.resize(n, (ow, oh), interpolation=cv2.INTER_LINEAR)
            near = np.clip(matte.guided(light, up, reach, 1e-3), 0, 1)
            enc.stdin.write(np.dstack([rgb, (near * 255 + 0.5).astype(np.uint8)]).tobytes())
            count += 1
    finally:
        proc.stdout.close()
        proc.wait()
        enc.stdin.close()
        failed = enc.wait() != 0
    if failed or not count:
        raise RuntimeError(f"proximité : {enc.stderr.read().decode(errors='replace')[:200]}")
    from portrait import log

    log(f"nearness of {count} images at {ow}×{oh} in {time.time() - started:.1f} s")
    return {"file": file, "frames": count, "w": ow, "h": oh}


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
                if job.get("near"):
                    send(r["file"], job["upload"]["webm"], "video/webm")
                else:
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
