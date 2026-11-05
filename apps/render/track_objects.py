# An object she shows (a cup she lifts, a product, a ball) followed through a passage of her video on the rented
# card (lib/render/gpu.ts): found by its name on a few images of the passage by an open-vocabulary detector
# (Grounding DINO tiny, Apache 2.0), then followed image by image both ways from the image it is seen best on by
# SAM 2.1 (tiny, Apache 2.0), both run by transformers' own classes from safetensors pinned by their digests (no code
# from a model hub), and its edge made like hers (matte.py's finish: snapped to the picture's own edges, its colours
# freed of the background, its box and its outline at every image). An animation names it in its code (Subject,
# SubjectBox, SubjectOutline or Outline given `object`); the engine reads the name there (objectsDrawn). On one of her
# photos (`photo`), the object is found on the photo itself and cut out once (a glass on a table, the cup she holds),
# as one still image the size of the photo: a word then runs round it or behind it on a photo as on a video.
# « every window » follows each window seen (at most EVERY_MAX), together one object; an object in separate pieces (the
# letters of a sign, the bulbs of a garland, each of « every … ») gives them in reading order (`parts`), so an
# animation lights them one by one (Tristan: « enseigne, fenêtre, image qui a de quoi faire un effet stylé »).
# Each of « every … » whose box overlaps another's there also gets its own outline at every image (`pieces`), so an
# animation shows one alone (Subject part).
# Usage: python -I track_objects.py jobs.json → prints {"<id>": { still, frames, keys, people, top, boxes, contours,
# found, parts?, pieces?, uploaded } | { error }}. jobs.json: [{ id, url (the clip or the photo, signed) or src (a local file), from, to,
# name, photo?, upload?: { webm, png }, out? }]. DETECTOR_MODEL and TRACKER_MODEL: the models' folders; OBJECTS_CPU=1
# runs on a CPU. A job with `clear` (and no name) reads the clear areas of its passage instead (clear_area.py, ClearBox:
# { clear, frames, still }), in the same machine, without loading the models.
import json
import os
import subprocess
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
# « every window », « every lamp »: each one seen is followed (at most this many), together one object in pieces.
EVERY = "every "
EVERY_MAX = 12
# The most pieces an object is told in (the letters of a sign, the windows of a facade, the bulbs of a garland).
PARTS_MAX = 24


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


def phrase(name):
    """What the detector reads for a name: lower case, ending with a full stop (Grounding DINO's way), without « every »."""
    text = name.strip().lower()
    if text.startswith(EVERY):
        text = text[len(EVERY):]
    return text.rstrip(".").strip() + "."


def distinct(boxes, scores):
    """The different things seen (box, score), surest first: a box mostly inside a surer one, or around it, is that one again."""
    kept = []
    for box, score in sorted(zip(boxes, scores), key=lambda b: -b[1]):
        x1, y1, x2, y2 = box
        area = max(1e-6, (x2 - x1) * (y2 - y1))
        same = False
        for other, _ in kept:
            inter = max(0.0, min(x2, other[2]) - max(x1, other[0])) * max(0.0, min(y2, other[3]) - max(y1, other[1]))
            if inter / area > 0.6 or inter / max(1e-6, (other[2] - other[0]) * (other[3] - other[1])) > 0.6:
                same = True
                break
        if not same:
            kept.append((box, score))
    return kept


def find(frames, name, detector, device):
    """
    Where the object is seen best on a few images of the passage: (image, [[x1, y1, x2, y2] px], score), or None; for
    « every … », every one seen on the image where most are (each window of a facade), surest first.
    """
    import torch
    from PIL import Image

    processor, model = detector
    every = name.strip().lower().startswith(EVERY)
    text = phrase(name)
    best = None
    for share in LOOKS:
        k = min(len(frames) - 1, max(0, int(round(share * (len(frames) - 1)))))
        h, w = frames[k].shape[:2]
        inputs = processor(images=Image.fromarray(frames[k]), text=text, return_tensors="pt").to(device)
        with torch.inference_mode():
            outputs = model(**inputs)
        found = processor.post_process_grounded_object_detection(outputs, inputs.input_ids, threshold=FOUND, text_threshold=0.25, target_sizes=[(h, w)])[0]
        seen = distinct([[float(v) for v in b] for b in found["boxes"].tolist()], [float(s) for s in found["scores"].tolist()])
        if not seen:
            continue
        kept = seen[:EVERY_MAX] if every else seen[:1]
        rank = (len(kept), kept[0][1])
        if best is None or rank > best[3]:
            best = (k, [b for b, _ in kept], kept[0][1], rank)
        # Clearly seen on the middle image: no need to look further (every one of them: all the images looked at).
        if best[2] >= 0.5 and not every:
            break
    return best[:3] if best else None


def track(frames, k, boxes, tracker, device, dtype, size):
    """Each object at every image, as soft cut-outs (0 to 1) at `size` (w, h), followed both ways from image k: a list of images per box."""
    import cv2
    import numpy as np
    import torch

    processor, model = tracker
    session = processor.init_video_session(video=list(frames), inference_device=device, dtype=dtype)
    count = len(boxes)
    # A copy of the ids: the processor empties the list it is given (a list of ids it kept had left none to read back).
    processor.add_inputs_to_inference_session(inference_session=session, frame_idx=k, obj_ids=list(range(1, count + 1)) if count > 1 else 1, input_boxes=[boxes])
    masks = [{} for _ in range(count)]
    with torch.inference_mode():
        model(inference_session=session, frame_idx=k)
        for reverse in (False, True):
            for out in model.propagate_in_video_iterator(session, start_frame_idx=k, reverse=reverse):
                logits = processor.post_process_masks([out.pred_masks.float()], original_sizes=[[session.video_height, session.video_width]], binarize=False)[0]
                for j in range(min(count, logits.shape[0])):
                    prob = torch.sigmoid(logits[j, 0]).cpu().numpy().astype(np.float32)
                    masks[j][out.frame_idx] = cv2.resize(prob, size, interpolation=cv2.INTER_LINEAR)
    empty = np.zeros((size[1], size[0]), np.float32)
    return [[m.get(i, empty) for i in range(len(frames))] for m in masks]


def reading_order(boxes):
    """Boxes (x, y, w, h) in reading order: rows from the top (a box whose middle falls within a row joins it), each from the left."""
    rows = []
    for b in sorted(boxes, key=lambda b: b[1] + b[3] / 2):
        mid = b[1] + b[3] / 2
        for row in rows:
            if min(r[1] for r in row) <= mid <= max(r[1] + r[3] for r in row):
                row.append(b)
                break
        else:
            rows.append([b])
    return [b for row in rows for b in sorted(row, key=lambda b: b[0])]


def pieces_inside(picture, whole):
    """
    The pieces an object in one piece draws inside its cut-out by their colours (a sign cut out with the sky between its
    letters and its support, a window with its frame): its colours sorted in two or three groups, and of the groups
    that make three pieces of a letter's shape or more (as tall as a good part of it, narrow, of a height), the one
    whose colour stands furthest from what is around the object (the letters, not the sky seen between them) gives
    them, in boxes (x, y, w, h) at the cut-out's size, with its colours (the groups' centres and its own, Lab), so its
    cut-out can be kept to them; none when no group does, or when its pieces are not evenly laid. `picture`: the image
    at its own size (read at full size: a sign's letters are a few pixels wide at half).
    """
    import cv2
    import numpy as np

    mh, mw = whole.shape
    ph, pw = picture.shape[:2]
    full = cv2.resize(whole, (pw, ph), interpolation=cv2.INTER_LINEAR) if (pw, ph) != (mw, mh) else whole
    inside = full > 0.5
    ys, xs = np.nonzero(inside)
    if len(xs) < 400:
        return [], None
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    lab_all = cv2.cvtColor(np.ascontiguousarray(picture), cv2.COLOR_RGB2LAB).astype(np.float32)
    # What is around it: a ring just outside its cut-out.
    ring = (cv2.dilate(inside.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0) & ~inside
    around = lab_all[ring].mean(axis=0) if ring.any() else None
    keep = inside[y0:y1, x0:x1]
    h, w = keep.shape
    data = lab_all[y0:y1, x0:x1].reshape(-1, 3)[keep.reshape(-1)]
    cv2.setRNGSeed(7)
    best, best_rank, colours = [], None, None
    for groups in (2, 3):
        _, labels, centres = cv2.kmeans(data, groups, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
        sorted_into = np.full(keep.size, -1, np.int32)
        sorted_into[keep.reshape(-1)] = labels.ravel()
        sorted_into = sorted_into.reshape(h, w)
        for g in range(groups):
            layer = cv2.morphologyEx((sorted_into == g).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            _, _, stats, _ = cv2.connectedComponentsWithStats(layer, 8)
            shaped = [s for s in stats[1:] if s[cv2.CC_STAT_HEIGHT] >= 0.3 * h and s[cv2.CC_STAT_WIDTH] <= 0.35 * w and s[cv2.CC_STAT_AREA] >= 0.003 * h * w]
            if len(shaped) < 3:
                continue
            # Letters are of a height: the pieces far shorter than the group's tallest go (a bolt, a reflection).
            tallest = max(s[cv2.CC_STAT_HEIGHT] for s in shaped)
            shaped = sorted([s for s in shaped if s[cv2.CC_STAT_HEIGHT] >= 0.55 * tallest], key=lambda s: s[cv2.CC_STAT_LEFT])
            if len(shaped) < 3:
                continue
            # Evenly laid along it, of like widths: a word, a row of panes; not a scatter of patches.
            widths = np.array([s[cv2.CC_STAT_WIDTH] for s in shaped], np.float32)
            mids = np.array([s[cv2.CC_STAT_LEFT] + s[cv2.CC_STAT_WIDTH] / 2 for s in shaped], np.float32)
            steps = np.diff(mids)
            if widths.std() > 0.6 * widths.mean() or (len(steps) > 1 and steps.std() > 0.7 * steps.mean()):
                continue
            apart = float(np.linalg.norm(centres[g] - around)) if around is not None else 0.0
            rank = (apart, len(shaped))
            if best_rank is None or rank > best_rank:
                best_rank = rank
                best = [(x0 + int(s[cv2.CC_STAT_LEFT]), y0 + int(s[cv2.CC_STAT_TOP]), int(s[cv2.CC_STAT_WIDTH]), int(s[cv2.CC_STAT_HEIGHT])) for s in shaped]
                colours = (centres.astype(np.float32), g)
    if len(best) < 3:
        return [], None
    # Back at the cut-out's size.
    sx, sy = mw / pw, mh / ph
    return [(int(round(x * sx)), int(round(y * sy)), max(1, int(round(bw * sx))), max(1, int(round(bh * sy)))) for x, y, bw, bh in best], colours


def keep_colours(picture, mask, colours):
    """An object's cut-out at one image kept to its pieces' colours (a sign's letters, not the sky between them), softly."""
    import cv2
    import numpy as np

    centres, g = colours
    h, w = mask.shape
    lab = cv2.cvtColor(cv2.resize(np.ascontiguousarray(picture), (w, h), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2LAB).astype(np.float32)
    nearest = np.argmin(np.linalg.norm(lab[:, :, None, :] - centres[None, None, :, :], axis=3), axis=2)
    mine = cv2.morphologyEx((nearest == g).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(np.float32)
    return mask * cv2.GaussianBlur(mine, (3, 3), 0)


def relative(boxes, whole):
    """Pieces (x, y, w, h px) in reading order as shares of the object's box in that cut-out (flat), PARTS_MAX at most."""
    import numpy as np

    ys, xs = np.nonzero(whole > 0.5)
    if len(boxes) < 2 or not len(xs):
        return None
    wx, wy = int(xs.min()), int(ys.min())
    ww, wh = int(xs.max()) - wx + 1, int(ys.max()) - wy + 1
    return [round(v, 3) for x, y, w, h in reading_order(boxes)[:PARTS_MAX] for v in ((x - wx) / ww, (y - wy) / wh, w / ww, h / wh)]


def parts_of(each, k, picture=None):
    """
    The object's pieces on the image it was found on (the letters of a sign, the bulbs of a garland, each window of
    « every window »), in boxes (x, y, w, h px of the cut-out): each one followed, else the separate pieces of its
    cut-out, else those its colours draw inside it (`picture`: that image at its own size; their colours come with
    them); none when it is in one piece (an animation then cuts it in slices itself).
    """
    import cv2
    import numpy as np

    whole = np.maximum.reduce([e[k] for e in each]) if len(each) > 1 else each[0][k]
    if not (whole > 0.5).any():
        return [], None
    boxes = []
    if len(each) > 1:
        for e in each:
            py, px = np.nonzero(e[k] > 0.5)
            if len(px):
                boxes.append((int(px.min()), int(py.min()), int(px.max() - px.min()) + 1, int(py.max() - py.min()) + 1))
        return boxes, None
    count, _, stats, _ = cv2.connectedComponentsWithStats((whole > 0.5).astype(np.uint8), 8)
    if count > 2:
        areas = stats[1:, cv2.CC_STAT_AREA]
        for s in stats[1:][areas >= 0.03 * areas.max()]:
            boxes.append((int(s[cv2.CC_STAT_LEFT]), int(s[cv2.CC_STAT_TOP]), int(s[cv2.CC_STAT_WIDTH]), int(s[cv2.CC_STAT_HEIGHT])))
    if len(boxes) >= 2 or picture is None:
        return boxes, None
    return pieces_inside(picture, whole)


def piece_outlines(each, k):
    """
    Each of « every … » apart (the picture kit's Subject part draws one alone): its own outline at every image (as the
    object's, half its points, shares of the picture), in the pieces' reading order on image k (that of `parts`), for
    the pieces whose box there overlaps another's (two towers, two gondolas: their boxes alone whitened them together),
    None for the others (their box is enough); None when no box overlaps another.
    """
    import numpy as np

    import matte

    seen = []
    for j, e in enumerate(each):
        py, px = np.nonzero(e[k] > 0.5)
        if len(px):
            seen.append((int(px.min()), int(py.min()), int(px.max() - px.min()) + 1, int(py.max() - py.min()) + 1, j))
    ordered = reading_order(seen)[:PARTS_MAX]

    def overlap(a, b):
        return min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]) > 1 and min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]) > 1

    out = []
    for a in ordered:
        if any(b is not a and overlap(a, b) for b in ordered):
            out.append([None if c is None else [v for i in range(0, len(c), 4) for v in c[i:i + 2]] for c in matte.contours_of(each[a[4]])])
        else:
            out.append(None)
    return out if any(o is not None for o in out) else None


def photo_frames(src, w, h):
    """A photo as one image at w × h, RGB (read by ffmpeg, as photo_cut.py reads it for her cut-out)."""
    import numpy as np

    import matte

    raw = subprocess.run([matte.FFMPEG, "-v", "error", "-i", src, "-vf", f"scale={w}:{h}:flags=lanczos,format=rgb24", "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    if len(raw) != w * h * 3:
        raise RuntimeError("photo illisible")
    return np.frombuffer(raw, np.uint8).reshape(1, h, w, 3)


def follow(job, device, dtype, detector, tracker):
    """A passage's object found, followed and cut out (matte.py's finish), or an error that says why; on a photo, found and cut out once."""
    import numpy as np

    import matte

    from portrait import log

    started = time.time()
    photo = bool(job.get("photo"))
    src_w, src_h, hdr = matte.probe(job["src"])
    scale = min(1.0, matte.OUT_LONG / max(src_w, src_h))
    ow, oh = max(2, int(round(src_w * scale / 2)) * 2), max(2, int(round(src_h * scale / 2)) * 2)
    if photo:
        frames = photo_frames(job["src"], ow, oh)
    else:
        start = max(0.0, float(job["from"]))
        seconds = min(matte.MAX_SECONDS, max(1.0 / matte.FPS, float(job["to"]) - start))
        frames = matte.decode(job["src"], start, seconds, ow, oh, hdr)
    n = len(frames)
    log(f"{n} images of {ow}×{oh} decoded in {time.time() - started:.1f} s")
    seen = find(frames, job["name"], detector, device)
    if not seen:
        raise RuntimeError(f"« {job['name']} » introuvable dans ce plan")
    k, boxes, score = seen
    log(f"« {job['name']} » found on image {k + 1}/{n} ({score:.2f}): {len(boxes)} at {[[round(v) for v in b] for b in boxes]}")
    tracked = time.time()
    mw, mh = max(2, ow // 2), max(2, oh // 2)
    each = [[matte.main_subject(m) for m in masks] for masks in track(frames, k, boxes, tracker, device, dtype, (mw, mh))]
    # « every … »: all of them at every image, one object in pieces.
    masks = [np.maximum.reduce([e[i] for e in each]) for i in range(n)] if len(each) > 1 else each[0]
    # Its pieces where it was found (its letters, its bulbs, each window), placed later on its box at every image.
    found, colours = parts_of(each, k, frames[k])
    if colours is not None:
        # In one block, its letters drawn by their colours: its cut-out kept to them at every image (the sky seen between
        # a sign's letters is not the sign), so what lights up is its letters, not their boxes.
        masks = [keep_colours(frames[i], masks[i], colours) for i in range(n)]
    # A light smoothing over time, against a shimmer of the edges (as for her).
    masks = [masks[0]] + [0.6 * masks[i] + 0.2 * masks[i - 1] + 0.2 * masks[min(n - 1, i + 1)] for i in range(1, n)]
    pieces = relative(found, masks[k])
    log(f"followed through {n} images in {time.time() - tracked:.1f} s" + (f", in {len(pieces) // 4} pieces" if pieces else ""))
    # Each of « every … » apart where their boxes overlap (Subject part); an outline missing leaves their boxes, never the object.
    apart = None
    if len(each) > 1 and pieces:
        try:
            apart = piece_outlines(each, k)
        except Exception as error:  # noqa: BLE001
            log(f"pieces' outlines not read: {error}")
    # A photo's object: one still image (a PNG the size of the photo, laid exactly over it).
    r = matte.finish(job, frames, masks, photo, n, False, started, ow, oh)
    return r | {"found": round(score, 2)} | ({"parts": pieces} if pieces else {}) | ({"pieces": apart} if apart else {})


if __name__ == "__main__":
    from portrait import fetch, log, send

    jobs = json.load(open(sys.argv[1]))
    # The models load once, for the first object to follow: a run that only reads clear areas never loads them.
    loaded = []
    work = os.environ.get("OBJECTS_WORK", "/tmp")
    results = {}
    fetched = {}
    for i, job in enumerate(jobs):
        try:
            src = job.get("src")
            if not src:
                # A clip named twice (an object and its clear areas) is fetched once.
                src = fetched.get(job["url"]) or os.path.join(work, f"clip{i}")
                if job["url"] not in fetched:
                    fetch(job["url"], src)
                    fetched[job["url"]] = src
            if job.get("clear"):
                # Where a text can be set in it (ClearBox): read on the CPU, nothing to send.
                import clear_area

                results[job["id"]] = clear_area.read({**job, "src": src})
                continue
            if not loaded:
                loaded.extend(models())
            device, dtype, detector, tracker = loaded
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
