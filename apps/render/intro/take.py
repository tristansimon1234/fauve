# Edith's voice-over for the intro (Intro.tsx), read in one take by ElevenLabs through
# /api/admin/voices?say=…&text=… (CRON_SECRET, from the database), which answers the voice and each
# word's time: the animation follows its words (cue in Intro.tsx), nothing is cut or moved.
# python3 take.py <the route's answer.json> <the voice's mp3>
#   → intro-voice.mp3 (into ../../web/public/landing) and voice.json (its words, read by Intro.tsx).
import json
import subprocess
import sys

answer = json.load(open(sys.argv[1]))
words = answer["samples"][0]["words"]
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", sys.argv[2], "-ac", "1", "-ar", "44100", "-b:a", "64k", "../../web/public/landing/intro-voice.mp3"], check=True)
lines = ",\n".join("  " + json.dumps({"w": w["w"], "start": w["start"], "end": w["end"]}, ensure_ascii=False) for w in words)
open("voice.json", "w").write('{\n "voice": "intro-voice.mp3",\n "words": [\n' + lines + "\n ]\n}\n")
print(len(words), "words,", words[-1]["end"], "s")
