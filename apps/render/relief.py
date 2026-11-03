# A photo in relief (Prequel's 3D photo, CapCut's 3D zoom), on the rented card (lib/render/gpu.ts): its depth read once
# by Depth Anything V2 small (Apache 2.0, transformers' own class, its safetensors pinned by their digest), then each
# image of the shot drawn by moving every pixel by its own depth, like a camera that travels: the nearer, the more it
# grows (a push) or slides (a pan), the room behind holding. Nothing is invented and no hole ever opens: each pixel is
# traced from the nearest surface back (parallax occlusion mapping), so a nearer thing grows over what is behind it and
# its edge toward the camera's centre holds. Nothing is blurred: every pixel is drawn from the photo by a bicubic
# sample (a softened room behind, like a lens, took 80 % of the street's detail on the terrace: Tristan, « ça floute un
# poil l'image ? »).
# Written as a video of the photo's own frame (H.264), drawn by the Reel in place of the photo with the same framing,
# retouch and camera move (apps/render/src/Depth.tsx): the video only adds the depth.
# Usage: python -I relief.py jobs.json → prints {"<id>": { frames, w, h, near, uploaded } | { error }}. jobs.json:
# [{ id, url (the photo, signed) or src (a local file), move: in|out|left|right, frames (the shot's length at 30 i/s),
# origin: { x, y } (the frame's centre on the photo, shares: a push grows about it), shift (a pan: how far the room
# slides over the shot, share of the photo's width, signed), upload?: { mp4 }, out? }].
# DEPTH_MODEL: the model's folder; RELIEF_CPU=1 runs on a CPU.
import json
import os
import subprocess
import sys
import time

# portrait.py, matte.py and photo_cut.py sit beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

MODEL = os.environ.get("DEPTH_MODEL", "/models/depth-anything-v2-small")
CPU = os.environ.get("RELIEF_CPU") == "1"
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
# The video's longest side: the photo as large as a 1080 × 1920 Reel shows it, with room for the camera's own zoom drawn
# over it (up to about 12 %), so the Reel never enlarges it; never more than the photo has.
MAX_SIDE = 2208
# At the end of a push, the nearest point has grown this much more than the room (the farthest, not at all).
PUSH = 0.07
# On a pan, the nearest point slides this much further than the room (the farthest, as the room).
PAN = 1.0
# Steps from the nearest surface back for each pixel (then one more, between the last two).
STEPS = 16


def ease(t):
    """The Reel's camera curve (Easing.inOut(Easing.sin), apps/render/src/track.ts), so the depth moves with the room."""
    import math

    t = min(1.0, max(0.0, t))
    return (1 - math.cos(math.pi * t)) / 2


def depth_of(rgb, model, processor, device):
    """The photo's depth at its size, 0 the farthest to 1 the nearest (2 % of the photo clipped at each end)."""
    import numpy as np
    import torch
    from PIL import Image

    h, w = rgb.shape[:2]
    inputs = processor(images=Image.fromarray(rgb), return_tensors="pt").to(device)
    with torch.inference_mode():
        d = model(**inputs).predicted_depth
    d = torch.nn.functional.interpolate(d[:, None].float(), size=(h, w), mode="bicubic", align_corners=False)[0, 0]
    lo, hi = torch.quantile(d.flatten()[:: max(1, d.numel() // 1_000_000)], torch.tensor([0.02, 0.98], device=d.device))
    d = ((d - lo) / max(1e-6, float(hi - lo))).clamp(0, 1).cpu().numpy().astype(np.float32)
    # Its edges laid on the photo's own (as a cut-out's edge), so a step in depth falls where the picture changes.
    import matte

    gray = (rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)) / 255
    return np.clip(matte.guided(gray, d, 6, 1e-4), 0, 1)


def draw(job, rgb, depth, device, encode):
    """Every image of the shot, warped by depth on the card, sent to the encoder."""
    import numpy as np
    import torch

    h, w = depth.shape
    n = max(1, int(job["frames"]))
    move = job["move"]
    ox = float(job.get("origin", {}).get("x", 0.5)) * w
    oy = float(job.get("origin", {}).get("y", 0.5)) * h
    shift = float(job.get("shift", 0)) * w
    photo = torch.from_numpy(rgb).to(device).permute(2, 0, 1)[None].float() / 255
    d = torch.from_numpy(depth).to(device)[None, None]
    ys, xs = torch.meshgrid(torch.arange(h, device=device, dtype=torch.float32) + 0.5, torch.arange(w, device=device, dtype=torch.float32) + 0.5, indexing="ij")

    def source(delta, e):
        """Where a pixel comes from when the surface it shows is at depth `delta` (0 to 1), at the move's point `e`."""
        if move in ("left", "right"):
            return xs - PAN * delta * e * shift, ys
        g = 1 + PUSH * delta * e
        return ox + (xs - ox) / g, oy + (ys - oy) / g

    def sample(img, x, y, mode="bilinear"):
        grid = torch.stack(((x / w) * 2 - 1, (y / h) * 2 - 1), dim=-1)[None]
        return torch.nn.functional.grid_sample(img, grid, mode=mode, padding_mode="border", align_corners=False)

    for f in range(n):
        p = ease(f / n)
        e = {"in": p, "out": 1 - p}.get(move, 2 * p - 1)
        if abs(e) < 1e-6:
            out = photo
        else:
            # From the nearest surface back: the first depth whose surface is at least that near is the one seen.
            found = torch.zeros_like(d, dtype=torch.bool)
            hit = torch.zeros_like(d)
            prev_delta = None
            prev_gap = None
            for j in range(STEPS):
                delta = 1 - j / (STEPS - 1)
                x, y = source(delta, e)
                gap = sample(d, x, y) - delta
                now = (~found) & (gap >= 0)
                if prev_gap is None:
                    hit = torch.where(now, torch.full_like(d, delta), hit)
                else:
                    # Between the last miss and this hit, where the surface crosses the ray.
                    cross = prev_delta + (delta - prev_delta) * (-prev_gap) / (gap - prev_gap).clamp(min=1e-6)
                    hit = torch.where(now, cross.clamp(0, 1), hit)
                found |= now
                prev_delta, prev_gap = delta, gap
            x, y = source(hit[0, 0], e)
            # Bicubic: a nearer thing is enlarged a little, and keeps its detail.
            out = sample(photo, x, y, "bicubic")
        encode((out[0].clamp(0, 1).permute(1, 2, 0) * 255 + 0.5).byte().cpu().numpy())
    return n


def relief(job, model, processor, device):
    import numpy as np

    from photo_cut import pixels, size

    from portrait import log

    started = time.time()
    sw, sh = size(job["src"])
    scale = min(1.0, MAX_SIDE / max(sw, sh))
    w, h = max(2, int(round(sw * scale / 2)) * 2), max(2, int(round(sh * scale / 2)) * 2)
    rgb = np.array(pixels(job["src"], w, h), copy=True)
    depth = depth_of(rgb, model, processor, device)
    log(f"depth of a {w}×{h} photo read in {time.time() - started:.1f} s")
    file = f"{job['out']}.mp4"
    enc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", "30", "-i", "pipe:0",
         "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "12",
         "-g", "15", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", file],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    drawn = time.time()
    n = draw(job, rgb, depth, device, lambda img: enc.stdin.write(img.tobytes()))
    enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError(f"vidéo : {enc.stderr.read().decode(errors='replace')[:200]}")
    log(f"{n} images drawn and written in {time.time() - drawn:.1f} s")
    # How much of the photo is near (the share of it over the middle depth): nothing near, the relief barely shows.
    return {"file": file, "frames": n, "w": w, "h": h, "near": round(float((depth > 0.5).mean()), 3)}


if __name__ == "__main__":
    import torch
    from transformers import AutoImageProcessor, DepthAnythingForDepthEstimation

    from portrait import fetch, log, send

    jobs = json.load(open(sys.argv[1]))
    started = time.time()
    device = "cpu" if CPU else "cuda"
    processor = AutoImageProcessor.from_pretrained(MODEL)
    model = DepthAnythingForDepthEstimation.from_pretrained(MODEL, use_safetensors=True).to(device).eval()
    log(f"depth model loaded on the {'CPU' if CPU else 'card'} in {time.time() - started:.1f} s")
    work = os.environ.get("RELIEF_WORK", "/tmp")
    results = {}
    for i, job in enumerate(jobs):
        try:
            src = job.get("src")
            if not src:
                src = os.path.join(work, f"photo{i}")
                fetch(job["url"], src)
            r = relief({**job, "src": src, "out": job.get("out") or os.path.join(work, f"relief{i}")}, model, processor, device)
            if job.get("upload"):
                send(r["file"], job["upload"]["mp4"], "video/mp4")
                r = {k: v for k, v in r.items() if k != "file"} | {"uploaded": True}
            results[job["id"]] = r
        except Exception as error:  # noqa: BLE001 — one photo that fails never stops the others
            log(f"relief {job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
    sys.stderr.flush()
    # As matte.py: out at once, without waiting on the model's threads and the card's libraries to wind down.
    os._exit(0)
