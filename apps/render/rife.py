# Slow motion made smooth on the rented card (lib/render/gpu.ts): the passage of her video a slowed shot plays, at 60
# images a second, each image in between made by RIFE v4.26 (Practical-RIFE by hzwer, MIT: flownet.pkl from its
# author's own release, pinned by its digest; its network transcribed below from IFNet_HDv3.py and warplayer.py,
# inference only, its weights read with torch.load(weights_only=True)). The render sandbox made those images with
# ffmpeg's motion interpolation, 29 s of one core for a second of video, smeared on hands and edges, and only for 3 s of
# clip a Reel; here a second of the card or so a second of video. A video filmed at 48 i/s or more keeps its own images
# (resampled to 60, as the sandbox does). Across a cut in her clip, no image is blended: the one before is held.
# The file is the sandbox's own (SLOW_NORMALIZE in lib/render/sandbox.ts): from `from` seconds, `seconds` long, at 60
# images a second, its long side 2560 px at most, its last image held a second, an iPhone's HDR made SDR (HDR_FILTER).
# Usage: python -I rife.py jobs.json → prints {"<id>": { frames, fps, w, h, made, cuts, uploaded } | { error }}.
# jobs.json: [{ id, url (the clip, signed) or src (a local file), from, seconds, upload?: { mp4 }, out? }].
# RIFE_MODEL: flownet.pkl; RIFE_CPU=1 runs on a CPU.
#
# The network (IFNet, warp) below is derived from Practical-RIFE (https://github.com/hzwer/Practical-RIFE):
# MIT License, Copyright (c) 2021 hzwer. Permission is hereby granted, free of charge, to any person obtaining a copy of
# this software and associated documentation files (the "Software"), to deal in the Software without restriction,
# including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following
# conditions: The above copyright notice and this permission notice shall be included in all copies or substantial
# portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
# INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
# IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
# ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
# DEALINGS IN THE SOFTWARE.
import json
import os
import re
import subprocess
import sys
import time

# portrait.py sits beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

MODEL = os.environ.get("RIFE_MODEL", "/models/rife/flownet.pkl")
CPU = os.environ.get("RIFE_CPU") == "1"
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
HDR_FILTER = os.environ.get("HDR_FILTER", "")
# The Reel's pace, the slow file's, and the file's longest side (NORMALIZE's).
FPS = 30
OUT_FPS = 60
MAX_SIDE = 2560
# A video filmed at this many images a second or more has its own images in between.
HIGH_FPS = 48
# Two images this far apart (mean difference of their small grey copies, 0 to 1) are a cut: the first is held.
CUT = 0.16


def network():
    """IFNet v4.26 (inference only), as Practical-RIFE's IFNet_HDv3.py builds it."""
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    def warp(x, flow):
        b, _, h, w = flow.shape
        gx = torch.linspace(-1.0, 1.0, w, device=flow.device, dtype=flow.dtype).view(1, 1, 1, w).expand(b, 1, h, w)
        gy = torch.linspace(-1.0, 1.0, h, device=flow.device, dtype=flow.dtype).view(1, 1, h, 1).expand(b, 1, h, w)
        grid = torch.cat([gx, gy], 1)
        flow = torch.cat([flow[:, 0:1] / ((x.shape[3] - 1.0) / 2.0), flow[:, 1:2] / ((x.shape[2] - 1.0) / 2.0)], 1)
        return F.grid_sample(x, (grid + flow).permute(0, 2, 3, 1), mode="bilinear", padding_mode="border", align_corners=True)

    def conv(i, o, k=3, s=1, p=1, d=1):
        return nn.Sequential(nn.Conv2d(i, o, k, s, p, dilation=d, bias=True), nn.LeakyReLU(0.2, True))

    class Head(nn.Module):
        def __init__(self):
            super().__init__()
            self.cnn0 = nn.Conv2d(3, 16, 3, 2, 1)
            self.cnn1 = nn.Conv2d(16, 16, 3, 1, 1)
            self.cnn2 = nn.Conv2d(16, 16, 3, 1, 1)
            self.cnn3 = nn.ConvTranspose2d(16, 4, 4, 2, 1)
            self.relu = nn.LeakyReLU(0.2, True)

        def forward(self, x):
            x = self.relu(self.cnn0(x))
            x = self.relu(self.cnn1(x))
            x = self.relu(self.cnn2(x))
            return self.cnn3(x)

    class ResConv(nn.Module):
        def __init__(self, c):
            super().__init__()
            self.conv = nn.Conv2d(c, c, 3, 1, 1)
            self.beta = nn.Parameter(torch.ones((1, c, 1, 1)))
            self.relu = nn.LeakyReLU(0.2, True)

        def forward(self, x):
            return self.relu(self.conv(x) * self.beta + x)

    class IFBlock(nn.Module):
        def __init__(self, in_planes, c=64):
            super().__init__()
            self.conv0 = nn.Sequential(conv(in_planes, c // 2, 3, 2, 1), conv(c // 2, c, 3, 2, 1))
            self.convblock = nn.Sequential(*[ResConv(c) for _ in range(8)])
            self.lastconv = nn.Sequential(nn.ConvTranspose2d(c, 4 * 13, 4, 2, 1), nn.PixelShuffle(2))

        def forward(self, x, flow=None, scale=1):
            x = F.interpolate(x, scale_factor=1.0 / scale, mode="bilinear", align_corners=False)
            if flow is not None:
                flow = F.interpolate(flow, scale_factor=1.0 / scale, mode="bilinear", align_corners=False) * 1.0 / scale
                x = torch.cat((x, flow), 1)
            feat = self.convblock(self.conv0(x))
            tmp = F.interpolate(self.lastconv(feat), scale_factor=scale, mode="bilinear", align_corners=False)
            return tmp[:, :4] * scale, tmp[:, 4:5], tmp[:, 5:]

    class IFNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.block0 = IFBlock(7 + 8, c=192)
            self.block1 = IFBlock(8 + 4 + 8 + 8, c=128)
            self.block2 = IFBlock(8 + 4 + 8 + 8, c=96)
            self.block3 = IFBlock(8 + 4 + 8 + 8, c=64)
            self.block4 = IFBlock(8 + 4 + 8 + 8, c=32)
            self.encode = Head()

        def forward(self, img0, img1, timestep, scale=1.0):
            scales = [16 / scale, 8 / scale, 4 / scale, 2 / scale, 1 / scale]
            t = timestep.expand(img0.shape[0], 1, img0.shape[2], img0.shape[3])
            f0, f1 = self.encode(img0), self.encode(img1)
            flow = mask = feat = None
            w0, w1 = img0, img1
            for i, blk in enumerate([self.block0, self.block1, self.block2, self.block3, self.block4]):
                if flow is None:
                    flow, mask, feat = blk(torch.cat((img0, img1, f0, f1, t), 1), None, scale=scales[i])
                else:
                    wf0, wf1 = warp(f0, flow[:, :2]), warp(f1, flow[:, 2:4])
                    fd, mask, feat = blk(torch.cat((w0, w1, wf0, wf1, t, mask, feat), 1), flow, scale=scales[i])
                    flow = flow + fd
                w0, w1 = warp(img0, flow[:, :2]), warp(img1, flow[:, 2:4])
            m = torch.sigmoid(mask)
            return w0 * m + w1 * (1 - m)

    return IFNet


def load(device):
    import torch

    from portrait import log

    started = time.time()
    net = network()().eval()
    weights = torch.load(MODEL, map_location="cpu", weights_only=True)
    weights = {k.replace("module.", "", 1): v for k, v in weights.items() if k.startswith("module.")}
    missing, _ = net.load_state_dict(weights, strict=False)
    if missing:
        raise RuntimeError(f"RIFE : poids manquants ({len(missing)})")
    net = net.to(device)
    if device == "cuda":
        net = net.half()
    log(f"RIFE loaded on the {'card' if device == 'cuda' else 'CPU'} in {time.time() - started:.1f} s")
    return net


def probe(src):
    """Its size, its images a second and whether it is HDR (as SLOW_NORMALIZE reads them)."""
    info = subprocess.run([FFMPEG, "-hide_banner", "-i", src], capture_output=True, text=True).stderr
    size = re.search(r"Video:.*?, (\d{2,5})x(\d{2,5})", info)
    if not size:
        raise RuntimeError("vidéo illisible")
    fps = re.search(r"([0-9.]+) fps", info)
    rotated = re.search(r"rotation of -?90", info) or re.search(r"rotate\s*:\s*-?90", info)
    w, h = int(size.group(1)), int(size.group(2))
    if rotated:
        w, h = h, w
    return w, h, float(fps.group(1)) if fps else 30.0, bool(re.search(r"arib-std-b67|smpte2084", info))


def encoder(file, w, h):
    return subprocess.Popen(
        [FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(OUT_FPS), "-i", "pipe:0",
         "-vf", "tpad=stop_mode=clone:stop_duration=1,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
         "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-movflags", "+faststart", file],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def smooth(job, net, device):
    import numpy as np
    import torch
    import torch.nn.functional as F

    from portrait import log

    started = time.time()
    sw, sh, fps, hdr = probe(job["src"])
    scale = min(1.0, MAX_SIDE / max(sw, sh))
    w, h = max(2, int(round(sw * scale / 2)) * 2), max(2, int(round(sh * scale / 2)) * 2)
    start, seconds = max(0.0, float(job["from"])), max(0.1, float(job["seconds"]))
    hdr_part = f"{HDR_FILTER}," if hdr and HDR_FILTER else ""
    file = f"{job['out']}.mp4"
    if fps >= HIGH_FPS:
        # Filmed fast: its own images, resampled to 60 (as the sandbox does).
        made = subprocess.run(
            [FFMPEG, "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{seconds:.3f}", "-i", job["src"], "-map", "0:v:0",
             "-vf", f"{hdr_part}fps={OUT_FPS},scale={w}:{h}:flags=lanczos,tpad=stop_mode=clone:stop_duration=1,format=yuv420p",
             "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-movflags", "+faststart", file],
            capture_output=True,
        )
        if made.returncode != 0:
            raise RuntimeError(f"vidéo : {made.stderr.decode(errors='replace')[:200]}")
        return {"file": file, "frames": int(round(seconds * OUT_FPS)), "fps": round(fps, 2), "w": w, "h": h, "made": 0, "cuts": 0}
    # Its images at 30 a second (a phone's varying pace evened out, as NORMALIZE does), one at a time.
    dec = subprocess.Popen(
        [FFMPEG, "-v", "error", "-ss", f"{start:.3f}", "-t", f"{seconds:.3f}", "-i", job["src"], "-map", "0:v:0",
         "-vf", f"{hdr_part}fps={FPS},scale={w}:{h}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    enc = encoder(file, w, h)
    size = w * h * 3
    # RIFE reads sizes in multiples of 64: padded with black, cropped after.
    ph, pw = (h + 63) // 64 * 64, (w + 63) // 64 * 64
    dtype = torch.float16 if device == "cuda" else torch.float32
    half = torch.full((1, 1, 1, 1), 0.5, device=device, dtype=dtype)

    def tensor(raw):
        t = torch.frombuffer(bytearray(raw), dtype=torch.uint8).to(device).view(h, w, 3).permute(2, 0, 1)[None].to(dtype) / 255
        return F.pad(t, (0, pw - w, 0, ph - h))

    def small(t):
        return F.interpolate(t[:, :, :h, :w].float().mean(1, keepdim=True), size=(64, max(1, round(64 * w / h))), mode="area")

    prev_raw = dec.stdout.read(size)
    if len(prev_raw) != size:
        raise RuntimeError("aucune image dans ce passage")
    prev = tensor(prev_raw)
    prev_small = small(prev)
    n, made, cuts = 1, 0, 0
    with torch.inference_mode():
        while True:
            raw = dec.stdout.read(size)
            enc.stdin.write(prev_raw)
            if len(raw) != size:
                break
            cur = tensor(raw)
            cur_small = small(cur)
            if float((cur_small - prev_small).abs().mean()) > CUT:
                # A cut in her clip: the image before is held, never blended into the next.
                mid_raw = prev_raw
                cuts += 1
            else:
                mid = net(prev, cur, half)[:, :, :h, :w].clamp(0, 1)
                mid_raw = (mid[0].permute(1, 2, 0).float() * 255 + 0.5).byte().cpu().numpy().tobytes()
                made += 1
            enc.stdin.write(mid_raw)
            prev, prev_raw, prev_small = cur, raw, cur_small
            n += 1
    dec.wait()
    enc.stdin.close()
    if enc.wait() != 0:
        raise RuntimeError(f"vidéo : {enc.stderr.read().decode(errors='replace')[:200]}")
    log(f"{n} images of {w}×{h} at {fps:.0f} i/s, {made} made in between, {cuts} cuts held, in {time.time() - started:.1f} s")
    return {"file": file, "frames": 2 * n - 1, "fps": round(fps, 2), "w": w, "h": h, "made": made, "cuts": cuts}


if __name__ == "__main__":
    import torch

    from portrait import fetch, log, send

    jobs = json.load(open(sys.argv[1]))
    device = "cpu" if CPU or not torch.cuda.is_available() else "cuda"
    if device == "cpu" and not CPU:
        raise SystemExit("pas de carte graphique pour RIFE")
    net = load(device)
    work = os.environ.get("RIFE_WORK", "/tmp")
    results = {}
    for i, job in enumerate(jobs):
        try:
            src = job.get("src")
            if not src:
                src = os.path.join(work, f"clip{i}")
                fetch(job["url"], src)
            r = smooth({**job, "src": src, "out": job.get("out") or os.path.join(work, f"smooth{i}")}, net, device)
            if job.get("upload"):
                send(r["file"], job["upload"]["mp4"], "video/mp4")
                r = {k: v for k, v in r.items() if k != "file"} | {"uploaded": True}
            results[job["id"]] = r
        except Exception as error:  # noqa: BLE001 — one passage that fails never stops the others
            log(f"slow motion {job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
    sys.stderr.flush()
    # As matte.py: out at once, without waiting on the model's threads and the card's libraries to wind down.
    os._exit(0)
