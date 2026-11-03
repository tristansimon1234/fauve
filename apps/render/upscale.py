# Her photos and videos too small for a Reel (a video WhatsApp shrank to 480p, a small photo from a website) made
# larger on the rented card (lib/render/gpu.ts) by Real-ESRGAN (realesr-general-x4v3 by Xintao Wang, BSD 3-Clause: its
# weights from the project's own release, pinned by their digest; its network, SRVGGNetCompact, transcribed below and
# read with torch.load(weights_only=True)): drawn four times larger, brought down to the size a 1080 × 1920 Reel needs
# (its short side 1080), then blended a little with the plain enlargement (BLEND) so skin and walls never look painted.
# It rebuilds the edges and fine texture that the compression blurred; it adds nothing that was not in the picture.
# Usage: python -I upscale.py jobs.json → prints {"<id>": { w, h, frames?, fps?, uploaded } | { error }}. jobs.json:
# [{ id, url (signed) or src (a local file), kind: video|image, upload?: { mp4 } | { jpg }, out? }].
# UPSCALE_MODEL: the .pth; UPSCALE_CPU=1 runs on a CPU; HDR_FILTER: an iPhone's HDR made SDR (as the render does).
#
# SRVGGNetCompact is from Real-ESRGAN (https://github.com/xinntao/Real-ESRGAN): BSD 3-Clause License, Copyright (c)
# 2021, Xintao Wang. All rights reserved. Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met: 1. Redistributions of source code must
# retain the above copyright notice, this list of conditions and the following disclaimer. 2. Redistributions in binary
# form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the
# documentation and/or other materials provided with the distribution. 3. Neither the name of the copyright holder nor
# the names of its contributors may be used to endorse or promote products derived from this software without specific
# prior written permission. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
# OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
# PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
# INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
# THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY
# WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
import json
import os
import re
import subprocess
import sys
import time

# portrait.py sits beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

MODEL = os.environ.get("UPSCALE_MODEL", "/models/esrgan/realesr-general-x4v3.pth")
CPU = os.environ.get("UPSCALE_CPU") == "1"
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
HDR_FILTER = os.environ.get("HDR_FILTER", "")
# The short side a 1080 × 1920 Reel needs.
TARGET = 1080
# The share of the drawn picture kept; the rest is the plain (bicubic) enlargement, against a painted look.
BLEND = 0.8
# A picture larger than this (pixels at its own size) is drawn in tiles, with an overlap so no seam shows.
TILE = 512
PAD = 16


def network():
    """SRVGGNetCompact (num_feat 64, num_conv 32, ×4, PReLU), as Real-ESRGAN builds realesr-general-x4v3."""
    import torch.nn as nn
    import torch.nn.functional as F

    class SRVGGNetCompact(nn.Module):
        def __init__(self, num_feat=64, num_conv=32, upscale=4):
            super().__init__()
            self.upscale = upscale
            self.body = nn.ModuleList([nn.Conv2d(3, num_feat, 3, 1, 1), nn.PReLU(num_parameters=num_feat)])
            for _ in range(num_conv):
                self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
                self.body.append(nn.PReLU(num_parameters=num_feat))
            self.body.append(nn.Conv2d(num_feat, 3 * upscale * upscale, 3, 1, 1))
            self.upsampler = nn.PixelShuffle(upscale)

        def forward(self, x):
            out = x
            for layer in self.body:
                out = layer(out)
            return self.upsampler(out) + F.interpolate(x, scale_factor=self.upscale, mode="nearest")

    return SRVGGNetCompact()


def load(device):
    import torch

    from portrait import log

    started = time.time()
    net = network().eval()
    weights = torch.load(MODEL, map_location="cpu", weights_only=True)
    net.load_state_dict(weights.get("params_ema") or weights["params"], strict=True)
    net = net.to(device)
    if device == "cuda":
        net = net.half()
    log(f"Real-ESRGAN loaded on the {'card' if device == 'cuda' else 'CPU'} in {time.time() - started:.1f} s")
    return net


def target_size(w, h):
    """The size it is brought to: its short side TARGET, never smaller than it is, both sides even."""
    scale = max(1.0, TARGET / min(w, h))
    return max(2, int(round(w * scale / 2)) * 2), max(2, int(round(h * scale / 2)) * 2)


def enlarge(net, rgb, size, device):
    """One picture (uint8 H×W×3, numpy) drawn at `size` (w, h): ×4 by the network (in tiles when large), brought to size, blended."""
    import torch
    import torch.nn.functional as F

    dtype = torch.float16 if device == "cuda" else torch.float32
    x = torch.from_numpy(rgb).to(device).permute(2, 0, 1)[None].to(dtype) / 255
    _, _, h, w = x.shape
    with torch.inference_mode():
        if h * w <= TILE * TILE * 2:
            big = net(x)
        else:
            big = torch.zeros((1, 3, h * 4, w * 4), device=device, dtype=dtype)
            for top in range(0, h, TILE):
                for left in range(0, w, TILE):
                    t0, l0 = max(0, top - PAD), max(0, left - PAD)
                    t1, l1 = min(h, top + TILE + PAD), min(w, left + TILE + PAD)
                    out = net(x[:, :, t0:t1, l0:l1])
                    th, tw = min(TILE, h - top), min(TILE, w - left)
                    big[:, :, top * 4 : (top + th) * 4, left * 4 : (left + tw) * 4] = out[:, :, (top - t0) * 4 : (top - t0 + th) * 4, (left - l0) * 4 : (left - l0 + tw) * 4]
        tw, th = size
        drawn = F.interpolate(big.float(), size=(th, tw), mode="area")
        plain = F.interpolate(x.float(), size=(th, tw), mode="bicubic", align_corners=False)
        out = (BLEND * drawn + (1 - BLEND) * plain).clamp(0, 1)
    return (out[0].permute(1, 2, 0) * 255 + 0.5).byte().cpu().numpy()


def probe(src):
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
    size = re.search(r"Video:.*?, (\d{2,5})x(\d{2,5})", info)
    if not size:
        raise RuntimeError("vidéo illisible")
    w, h = int(size.group(1)), int(size.group(2))
    if re.search(r"rotation of -?90", info) or re.search(r"rotate\s*:\s*-?90", info):
        w, h = h, w
    fps = re.search(r"([0-9.]+) fps", info)
    return w, h, float(fps.group(1)) if fps else 30.0, bool(re.search(r"arib-std-b67|smpte2084", info)), "Audio:" in info


def image(job, net, device):
    import numpy as np
    from PIL import Image, ImageOps

    photo = ImageOps.exif_transpose(Image.open(job["src"])).convert("RGB")
    w, h = photo.size
    size = target_size(w, h)
    out = enlarge(net, np.asarray(photo), size, device)
    file = f"{job['out']}.jpg"
    Image.fromarray(out).save(file, quality=92, subsampling=0)
    return {"file": file, "w": size[0], "h": size[1], "from": [w, h]}


def video(job, net, device):
    from portrait import log

    started = time.time()
    w, h, fps, hdr, audio = probe(job["src"])
    pace = fps if 10 <= fps <= 120 else 30.0
    tw, th = target_size(w, h)
    hdr_part = f"{HDR_FILTER}," if hdr and HDR_FILTER else ""
    dec = subprocess.Popen(
        [FFMPEG, "-v", "error", "-i", job["src"], "-map", "0:v:0", "-vf", f"{hdr_part}fps={pace:.5f}", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    file = f"{job['out']}.mp4"
    sound = ["-i", job["src"], "-map", "0:v:0", "-map", "1:a:0", "-c:a", "copy", "-shortest"] if audio else ["-map", "0:v:0"]
    enc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{tw}x{th}", "-r", f"{pace:.5f}", "-i", "pipe:0", *sound,
         "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", file],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    import numpy as np

    size = w * h * 3
    n = 0
    while True:
        raw = dec.stdout.read(size)
        if len(raw) != size:
            break
        enc.stdin.write(enlarge(net, np.frombuffer(raw, np.uint8).reshape(h, w, 3), (tw, th), device).tobytes())
        n += 1
    dec.stdout.close()
    dec.wait()
    enc.stdin.close()
    if enc.wait() != 0 or not n:
        raise RuntimeError(f"vidéo : {enc.stderr.read().decode(errors='replace')[:200]}")
    log(f"{n} images of {w}×{h} drawn at {tw}×{th} in {time.time() - started:.1f} s")
    return {"file": file, "w": tw, "h": th, "frames": n, "fps": round(pace, 3), "from": [w, h]}


if __name__ == "__main__":
    import torch

    from portrait import fetch, log, send

    jobs = json.load(open(sys.argv[1]))
    device = "cpu" if CPU or not torch.cuda.is_available() else "cuda"
    if device == "cpu" and not CPU:
        raise SystemExit("pas de carte graphique pour Real-ESRGAN")
    net = load(device)
    work = os.environ.get("UPSCALE_WORK", "/tmp")
    results = {}
    for i, job in enumerate(jobs):
        try:
            src = job.get("src")
            if not src:
                src = os.path.join(work, f"media{i}")
                fetch(job["url"], src)
            started = time.time()
            r = (video if job.get("kind") == "video" else image)({**job, "src": src, "out": job.get("out") or os.path.join(work, f"large{i}")}, net, device)
            log(f"{job.get('kind', 'image')} {i + 1}/{len(jobs)} enlarged from {r['from'][0]}×{r['from'][1]} to {r['w']}×{r['h']} in {time.time() - started:.1f} s")
            if job.get("upload"):
                kind = "mp4" if job.get("kind") == "video" else "jpg"
                send(r["file"], job["upload"][kind], "video/mp4" if kind == "mp4" else "image/jpeg")
                r = {k: v for k, v in r.items() if k != "file"} | {"uploaded": True}
            results[job["id"]] = r
        except Exception as error:  # noqa: BLE001 — one file that fails never stops the others
            log(f"upscale {job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
    sys.stderr.flush()
    # As matte.py: out at once, without waiting on the model's threads and the card's libraries to wind down.
    os._exit(0)
