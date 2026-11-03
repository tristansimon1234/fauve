# Her cut-out at every image, on a rented graphics card (a Modal sandbox with an L4, lib/render/gpu.ts): BiRefNet-
# portrait (MIT), the full model trained on people, in rembg's ONNX export (a file of weights, no code, pinned by its
# digest when the card's image is built), reads each image of the passage, and the edge is made as on the cut-out
# sandbox (matte.py's finish: snapped to the picture's own edges, its colours freed of the old background). On a busy
# set (pampas grass and a curtain behind a model, the first fashion test in production) the person model of the
# sandbox took the plumes for hair; this one keeps her alone, her hair, a knee cut by the frame and a fur jacket
# included (measured on six images of four clips). About 20 s an image on 4 CPUs here: a card reads one in a few
# tenths of a second.
# Usage: PORTRAIT_MODEL=… python -I portrait.py jobs.json → prints {"<id>": { still, frames, keys, people, top, boxes,
# seconds, uploaded } | { error }}. jobs.json: [{ id, url (the clip, signed) or src (a local video), from, to,
# upload?: { webm, png } (signed upload links: the cut-out is sent there), out? }]. PORTRAIT_CPU=1 runs it on a CPU.
import json
import os
import sys
import time
import urllib.request

# matte.py sits beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# The size the model reads (it was trained on 1024 × 1024 images).
SIZE = 1024


def load(path, gpu=True):
    """The model: on the card (its CUDA libraries come with onnxruntime-gpu's wheels), or on the CPU when asked."""
    import onnxruntime as ort

    if gpu:
        # The CUDA and cuDNN libraries installed by pip (onnxruntime-gpu[cuda,cudnn]), loaded before the session.
        ort.preload_dlls()
        session = ort.InferenceSession(path, providers=[("CUDAExecutionProvider", {"cudnn_conv_algo_search": "HEURISTIC"}), "CPUExecutionProvider"])
        if "CUDAExecutionProvider" not in session.get_providers():
            # On a CPU it would take an hour: the app falls back to its own cut-out sandbox instead.
            raise RuntimeError("pas de carte graphique pour le modèle")
        return session
    options = ort.SessionOptions()
    options.intra_op_num_threads = os.cpu_count() or 4
    options.enable_mem_pattern = False
    return ort.InferenceSession(path, options, providers=["CPUExecutionProvider"])


def reader(session):
    """read(images, w, h): each image's cut-out (0 to 1, float32) at w × h."""
    import cv2
    import numpy as np

    name = session.get_inputs()[0].name
    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)

    def read(images, w, h):
        out = []
        for img in images:
            x = cv2.resize(img, (SIZE, SIZE), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
            m = session.run(None, {name: ((x - mean) / std).transpose(2, 0, 1)[None]})[0][0, 0]
            # The export gives its logits: a sigmoid makes them a cut-out (values already in 0..1 are kept).
            if m.min() < 0 or m.max() > 1:
                m = 1 / (1 + np.exp(-m))
            out.append(cv2.resize(m.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR))
        return out

    return read


def cut_every_image(job, read):
    """A passage cut out by reading every image (no key images to carry along the moves), then matte.py's finish."""
    import cv2
    import numpy as np
    import matte

    started = time.time()
    src_w, src_h, hdr = matte.probe(job["src"])
    start = max(0.0, float(job["from"]))
    seconds = min(matte.MAX_SECONDS, max(1.0 / matte.FPS, float(job["to"]) - start))
    scale = min(1.0, matte.OUT_LONG / max(src_w, src_h))
    ow, oh = max(2, int(round(src_w * scale / 2)) * 2), max(2, int(round(src_h * scale / 2)) * 2)
    frames = matte.decode(job["src"], start, seconds, ow, oh, hdr)
    n = len(frames)
    # A passage where nothing moves is read once (its cut-out is one image, a PNG), as on the sandbox.
    ww, wh = matte.WORK_WIDE, max(2, int(round(oh * matte.WORK_WIDE / ow / 2)) * 2)
    small = [cv2.resize(cv2.cvtColor(f, cv2.COLOR_RGB2GRAY), (ww // 3, wh // 3), interpolation=cv2.INTER_AREA) for f in frames]
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_ULTRAFAST)
    total = sum(float(np.percentile(np.linalg.norm(flow.calc(small[i - 1], small[i], None), axis=2) * 3, 95)) for i in range(1, n))
    if total < matte.STILL_MOVE:
        mid = n // 2
        return matte.finish(job, frames, [matte.main_subject(read([frames[mid]], ow, oh)[0])], True, 1, True, started, ow, oh, mid)
    # Read at half the picture's size (finish makes the edge at full size, on the picture itself).
    mw, mh = max(2, ow // 2), max(2, oh // 2)
    masks = [matte.main_subject(m) for m in read(list(frames), mw, mh)]
    # A light smoothing over time, against a shimmer of the edges (a fast hand keeps most of its own image).
    masks = [masks[0]] + [0.6 * masks[i] + 0.2 * masks[i - 1] + 0.2 * masks[min(n - 1, i + 1)] for i in range(1, n)]
    return matte.finish(job, frames, masks, False, n, True, started, ow, oh)


def fetch(url, path):
    with urllib.request.urlopen(url, timeout=120) as res, open(path, "wb") as out:
        while chunk := res.read(1 << 20):
            out.write(chunk)


def send(path, url, content_type):
    """The cut-out PUT to its signed upload link (Supabase Storage)."""
    with open(path, "rb") as f:
        body = f.read()
    req = urllib.request.Request(url, data=body, method="PUT", headers={"Content-Type": content_type, "x-upsert": "true"})
    with urllib.request.urlopen(req, timeout=120) as res:
        if res.status >= 300:
            raise RuntimeError(f"envoi du détourage refusé ({res.status})")


if __name__ == "__main__":
    import matte

    matte.HDR_FILTER = os.environ.get("HDR_FILTER", matte.HDR_FILTER)
    jobs = json.load(open(sys.argv[1]))
    read = reader(load(os.environ.get("PORTRAIT_MODEL", "/models/portrait.onnx"), gpu=os.environ.get("PORTRAIT_CPU") != "1"))
    work = os.environ.get("PORTRAIT_WORK", "/tmp")
    results = {}
    for i, job in enumerate(jobs):
        try:
            src = job.get("src")
            if not src:
                src = os.path.join(work, f"in{i}")
                fetch(job["url"], src)
            r = cut_every_image({**job, "src": src, "out": job.get("out") or os.path.join(work, f"out{i}")}, read)
            if job.get("upload"):
                send(r["file"], job["upload"]["png" if r["still"] else "webm"], "image/png" if r["still"] else "video/webm")
                r = {k: v for k, v in r.items() if k != "file"} | {"uploaded": True}
            results[job["id"]] = r
        except Exception as error:  # noqa: BLE001 — one passage that fails never stops the others
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
