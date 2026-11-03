# An object she shows (a cup she lifts, a product, a ball) followed through a passage of her video on the rented
# card (lib/render/gpu.ts): found by its name on a few images of the passage by an open-vocabulary detector
# (Grounding DINO tiny, Apache 2.0), then followed image by image both ways from the image it is seen best on by
# SAM 2.1 (tiny, Apache 2.0), both run by transformers' own classes from safetensors pinned by their digests (no code
# from a model hub), and its edge made like hers (matte.py's finish: snapped to the picture's own edges, its colours
# freed of the background, its box and its outline at every image). An animation names it in its code (Subject,
# SubjectBox, SubjectOutline or Outline given `object`); the engine reads the name there (objectsDrawn).
# Usage: python -I track_objects.py jobs.json → prints {"<id>": { still, frames, keys, people, top, boxes, contours,
# found, uploaded } | { error }}. jobs.json: [{ id, url (the clip, signed) or src (a local video), from, to, name,
# upload?: { webm, png }, out? }]. DETECTOR_MODEL and TRACKER_MODEL: the models' folders; OBJECTS_CPU=1 runs on a CPU.
import json
import os
import sys
import time

# matte.py and portrait.py sit beside this file (python -I does not put the script's folder on the path).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DETECTOR = os.environ.get("DETECTOR_MODEL", "/models/grounding-dino-tiny")
TRACKER = os.environ.get("TRACKER_MODEL", "/models/sam2.1-hiera-tiny")
CPU = os.environ.get("OBJECTS_CPU") == "1"
# A box the detector is surer of than this is the object; below, it is not found (the animation does without it).
FOUND = 0.3
# The images of the passage the detector looks at: its middle first, then around it.
LOOKS = (0.5, 0.3, 0.7, 0.15, 0.85)


def models():
    import torch
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor, Sam2VideoModel, Sam2VideoProcessor

    from portrait import log

    started = time.time()
    device = "cpu" if CPU else "cuda"
    dtype = torch.float32 if CPU else torch.bfloat16
    detector = (AutoProcessor.from_pretrained(DETECTOR), AutoModelForZeroShotObjectDetection.from_pretrained(DETECTOR, use_safetensors=True).to(device).eval())
    tracker = (Sam2VideoProcessor.from_pretrained(TRACKER), Sam2VideoModel.from_pretrained(TRACKER, use_safetensors=True).to(device, dtype=dtype).eval())
    log(f"detector and tracker loaded on the {'CPU' if CPU else 'card'} in {time.time() - started:.1f} s")
    return device, dtype, detector, tracker


def find(frames, name, detector, device):
    """Where the object is seen best on a few images of the passage: (image, [x1, y1, x2, y2] px, score), or None."""
    import torch
    from PIL import Image

    processor, model = detector
    # Grounding DINO reads a lower-case phrase ending with a full stop.
    text = name.strip().lower().rstrip(".") + "."
    best = None
    for share in LOOKS:
        k = min(len(frames) - 1, max(0, int(round(share * (len(frames) - 1)))))
        h, w = frames[k].shape[:2]
        inputs = processor(images=Image.fromarray(frames[k]), text=text, return_tensors="pt").to(device)
        with torch.inference_mode():
            outputs = model(**inputs)
        found = processor.post_process_grounded_object_detection(outputs, inputs.input_ids, threshold=FOUND, text_threshold=0.25, target_sizes=[(h, w)])[0]
        for box, score in zip(found["boxes"].tolist(), found["scores"].tolist()):
            if best is None or score > best[2]:
                best = (k, [float(v) for v in box], float(score))
        # Clearly seen on the middle image: no need to look further.
        if best and best[2] >= 0.5:
            break
    return best


def track(frames, k, box, tracker, device, dtype, size):
    """The object at every image, as a soft cut-out (0 to 1) at `size` (w, h), followed both ways from image k."""
    import cv2
    import numpy as np
    import torch

    processor, model = tracker
    session = processor.init_video_session(video=list(frames), inference_device=device, dtype=dtype)
    processor.add_inputs_to_inference_session(inference_session=session, frame_idx=k, obj_ids=1, input_boxes=[[box]])
    masks = {}
    with torch.inference_mode():
        model(inference_session=session, frame_idx=k)
        for reverse in (False, True):
            for out in model.propagate_in_video_iterator(session, start_frame_idx=k, reverse=reverse):
                logits = processor.post_process_masks([out.pred_masks.float()], original_sizes=[[session.video_height, session.video_width]], binarize=False)[0]
                prob = torch.sigmoid(logits[0, 0]).cpu().numpy().astype(np.float32)
                masks[out.frame_idx] = cv2.resize(prob, size, interpolation=cv2.INTER_LINEAR)
    empty = np.zeros((size[1], size[0]), np.float32)
    return [masks.get(i, empty) for i in range(len(frames))]


def follow(job, device, dtype, detector, tracker):
    """A passage's object found, followed and cut out (matte.py's finish), or an error that says why."""
    import matte

    from portrait import log

    started = time.time()
    src_w, src_h, hdr = matte.probe(job["src"])
    start = max(0.0, float(job["from"]))
    seconds = min(matte.MAX_SECONDS, max(1.0 / matte.FPS, float(job["to"]) - start))
    scale = min(1.0, matte.OUT_LONG / max(src_w, src_h))
    ow, oh = max(2, int(round(src_w * scale / 2)) * 2), max(2, int(round(src_h * scale / 2)) * 2)
    frames = matte.decode(job["src"], start, seconds, ow, oh, hdr)
    n = len(frames)
    log(f"{n} images of {ow}×{oh} decoded in {time.time() - started:.1f} s")
    seen = find(frames, job["name"], detector, device)
    if not seen:
        raise RuntimeError(f"« {job['name']} » introuvable dans ce plan")
    k, box, score = seen
    log(f"« {job['name']} » found on image {k + 1}/{n} ({score:.2f}) at {[round(v) for v in box]}")
    tracked = time.time()
    mw, mh = max(2, ow // 2), max(2, oh // 2)
    masks = [matte.main_subject(m) for m in track(frames, k, box, tracker, device, dtype, (mw, mh))]
    # A light smoothing over time, against a shimmer of the edges (as for her).
    masks = [masks[0]] + [0.6 * masks[i] + 0.2 * masks[i - 1] + 0.2 * masks[min(n - 1, i + 1)] for i in range(1, n)]
    log(f"followed through {n} images in {time.time() - tracked:.1f} s")
    r = matte.finish(job, frames, masks, False, n, False, started, ow, oh)
    return r | {"found": round(score, 2)}


if __name__ == "__main__":
    from portrait import fetch, log, send

    jobs = json.load(open(sys.argv[1]))
    device, dtype, detector, tracker = models()
    work = os.environ.get("OBJECTS_WORK", "/tmp")
    results = {}
    for i, job in enumerate(jobs):
        try:
            src = job.get("src")
            if not src:
                src = os.path.join(work, f"clip{i}")
                fetch(job["url"], src)
            r = follow({**job, "src": src, "out": job.get("out") or os.path.join(work, f"object{i}")}, device, dtype, detector, tracker)
            if job.get("upload"):
                send(r["file"], job["upload"]["png" if r["still"] else "webm"], "image/png" if r["still"] else "video/webm")
                r = {k: v for k, v in r.items() if k != "file"} | {"uploaded": True}
            results[job["id"]] = r
        except Exception as error:  # noqa: BLE001 — one object that fails never stops the others
            log(f"object {job.get('id')} failed: {str(error)[:200]}")
            results[job["id"]] = {"error": str(error)[:300]}
    print(json.dumps(results))
    sys.stdout.flush()
    sys.stderr.flush()
    # As matte.py: out at once, without waiting on the models' threads and the card's libraries to wind down.
    os._exit(0)
