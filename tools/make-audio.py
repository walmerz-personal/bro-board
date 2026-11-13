#!/usr/bin/env python3
"""Make a spoken recording of every phrase on the board.

Uses Kokoro, a free open-source voice model. Run from the repository root:

    pip install kokoro-onnx soundfile
    python tools/make-audio.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin

The two model files come from
https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0).
ffmpeg must be installed. Only missing recordings are made, unless --all is given.
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOARD = ROOT / "web/src/data/default-board.json"
MANIFEST = ROOT / "web/src/data/audio-manifest.json"
AUDIO_DIR = ROOT / "web/public/audio"


def phrases(board):
    for category in board["categories"]:
        if category.get("phrase"):
            yield category["phrase"]
        for item in category.get("items", []):
            yield item["phrase"]


def file_name(voice, phrase):
    digest = hashlib.sha1(f"{voice}|{phrase}".encode()).hexdigest()[:12]
    return f"{digest}.mp3"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--voices", required=True)
    parser.add_argument("--voice", help="voice name; defaults to the one in the manifest")
    parser.add_argument("--speed", type=float, default=0.9)
    parser.add_argument("--all", action="store_true", help="remake every recording")
    args = parser.parse_args()

    old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    voice = args.voice or old.get("voice")
    if not voice:
        parser.error("--voice is needed the first time")

    board = json.loads(BOARD.read_text())
    wanted = {phrase: file_name(voice, phrase) for phrase in dict.fromkeys(phrases(board))}
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    todo = [p for p, f in wanted.items() if args.all or not (AUDIO_DIR / f).exists()]
    if todo:
        import soundfile
        from kokoro_onnx import Kokoro

        kokoro = Kokoro(args.model, args.voices)
        for phrase in todo:
            samples, rate = kokoro.create(phrase, voice=voice, speed=args.speed, lang="en-us")
            with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
                soundfile.write(wav.name, samples, rate)
                # Even out loudness, add a short lead-in so the first sound is not clipped.
                subprocess.run(
                    ["ffmpeg", "-loglevel", "error", "-y", "-i", wav.name,
                     "-af", "adelay=120:all=1,loudnorm=I=-16:TP=-1.5:LRA=11",
                     "-ar", "24000", "-ac", "1", "-b:a", "48k", str(AUDIO_DIR / wanted[phrase])],
                    check=True,
                )
            print("made", wanted[phrase], phrase)

    # Remove recordings that no phrase uses any more.
    for stale in set(p.name for p in AUDIO_DIR.glob("*.mp3")) - set(wanted.values()):
        (AUDIO_DIR / stale).unlink()
        print("removed", stale)

    MANIFEST.write_text(json.dumps({"voice": voice, "files": wanted}, indent=2) + "\n")
    print(f"{len(wanted)} phrases, {len(todo)} made, voice {voice}")


if __name__ == "__main__":
    main()
