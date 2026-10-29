# Edith's voice-over laid on the intro's scenes (Intro.tsx): each sentence of the voice (read by
# ElevenLabs through /api/admin/voices?say=…&text=…, which gives each word's time) starts on its
# scene, and each scene lasts what its animations need, or its sentence and a breath.
# python3 place-voice.py <the voice's mp3>  →  intro-voice.mp3 (into ../../web/public/landing) and voice.json (the scenes, Intro's props).
import sys
import json, subprocess
# Sentences of the voice (word times from ElevenLabs), and the scene each one opens.
sentences = [(0.00, 3.60), (3.63, 7.84), (7.92, 10.40), (10.48, 13.12), (13.16, 16.88), (16.96, 18.64), (18.72, 19.20)]
ids = ["hello", "whatsapp", "reel", "carousel", "publish", "app", "start"]
# What each scene's animations need at least (seconds), and the breath after its sentence.
minimum = {"hello": 3.6, "whatsapp": 6.8, "reel": 4.4, "carousel": 5.0, "publish": 4.8, "app": 3.4, "start": 3.0}
LEAD, TAIL = 0.3, 1.0
scenes, t = [], 0.0
for (a, b), i in zip(sentences, ids):
    length = max(minimum[i], LEAD + (b - a) + TAIL)
    scenes.append({"id": i, "from": round(t, 2), "to": round(t + length, 2)})
    t += length
total = round(t, 2)
# Each sentence cut with a little room, then laid at its scene's start.
parts, inputs = [], []
for k, ((a, b), sc) in enumerate(zip(sentences, scenes)):
    start = max(0, a - 0.03)
    end = min(b + 0.15, sentences[k + 1][0] - 0.01) if k + 1 < len(sentences) else b + 0.3
    delay = int(round((sc["from"] + LEAD) * 1000))
    parts.append(f"[0:a]atrim={start}:{end},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={end-start-0.04:.3f}:d=0.04,adelay={delay}|{delay}[s{k}]")
graph = ";".join(parts) + ";" + "".join(f"[s{k}]" for k in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0,apad=whole_dur={total}[out]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", sys.argv[1], "-filter_complex", graph, "-map", "[out]", "-t", str(total), "-ar", "44100", "-ac", "2", "-b:a", "128k", "intro-voice.mp3"], check=True)
json.dump({"voice": "intro-voice.mp3", "scenes": scenes}, open("voice.json", "w"), indent=2)
print(total, json.dumps(scenes))
