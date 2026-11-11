#!/usr/bin/env python3
"""Turns the frames from capture.mjs into the looping images in docs/media.

    python3 scripts/media/encode.py [clip ...]     # mood-idle, tracking-dark, stills and so on

Needs Pillow with WebP support. Playwright's ffmpeg has no GIF or WebP encoder, and GitHub only
embeds images in Markdown, so the clips are animated WebP. They're drawn at twice the size the
docs show them at, for 2x screens. Every clip must come out under 3 MB, and a clip that doesn't
fails the run.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(os.environ.get("MEDIA_WORK", Path(tempfile.gettempdir()) / "agent-mascots-media"))
OUT = ROOT / "docs/media"
LIMIT = int(os.environ.get("MEDIA_LIMIT", 3_000_000))
FRAME_MS = 40

MOODS = "idle thinking working success error listening speaking waiting sleeping".split()


def load(path, size=None):
    image = Image.open(path).convert("RGBA")
    if size and image.size != tuple(size):
        image = image.resize(size, Image.LANCZOS)
    return np.asarray(image, dtype=np.float32) / 255


def premultiply(frame):
    out = frame.copy()
    out[..., :3] *= out[..., 3:]
    return out


def unpremultiply(frame):
    alpha = np.maximum(frame[..., 3:], 1e-4)
    out = frame.copy()
    out[..., :3] = np.clip(out[..., :3] / alpha, 0, 1)
    return out


def blend(a, b, k):
    """Mix through premultiplied alpha, so a fading edge doesn't pick up a dark fringe."""
    return unpremultiply(premultiply(a) * (1 - k) + premultiply(b) * k)


def close_loop(frames, overlap):
    """`frames[:overlap]` lead in to the first frame. Fades the tail into them."""
    lead, body = frames[:overlap], frames[overlap:]
    length = len(body)
    out = list(body)
    for i in range(overlap):
        k = (i + 1) / (overlap + 1)
        out[length - overlap + i] = blend(body[length - overlap + i], lead[i], k)
    return out


def distance(a, b):
    """How far apart two frames look. Takes the worst 2% of pixels, so an eye or a spark counts."""
    diff = np.abs(premultiply(a) - premultiply(b)).sum(axis=2).ravel()
    worst = max(1, diff.size // 50)
    return float(np.partition(diff, -worst)[-worst:].mean())


def seam_report(frames):
    """The jump across the loop point, as a multiple of a typical step between frames."""
    steps = [distance(frames[i], frames[i + 1]) for i in range(0, len(frames) - 1, 3)]
    return distance(frames[-1], frames[0]) / max(float(np.median(steps)), 1e-6)


def find_seam(paths, shortest, longest, overlap):
    """Finds the two frames closest to each other, between `shortest` and `longest` frames apart."""
    small = [load(path, (90, 90)) for path in paths]
    best = None
    for start in range(overlap, len(small) - shortest):
        for end in range(start + shortest, min(start + longest + 1, len(small))):
            score = distance(small[start], small[end])
            if best is None or score < best[0]:
                best = (score, start, end)
    return best


def write_webp(frames, name, quality, method=6, minimize=True, duration=FRAME_MS):
    images = [Image.fromarray((frame * 255 + 0.5).astype(np.uint8), "RGBA") for frame in frames]
    has_alpha = any(frame[..., 3].min() < 1 for frame in frames[:3])
    if not has_alpha:
        images = [image.convert("RGB") for image in images]
    path = OUT / f"{name}.webp"
    images[0].save(
        path,
        format="WEBP",
        save_all=True,
        append_images=images[1:],
        duration=duration,
        loop=0,
        quality=quality,
        method=method,
        lossless=False,
        minimize_size=minimize,
        allow_mixed=False,
        # Anything lower bands the soft shadows and halos.
        alpha_quality=100,
        exact=False,
    )
    bytes_written = path.stat().st_size
    print(f"{path.relative_to(ROOT)}: {len(images)} frames, {bytes_written:,} B, q{quality}")
    if bytes_written > LIMIT:
        raise SystemExit(f"{path.name} is over the 3 MB limit")
    return path


def fit(frames, name, qualities, **options):
    """Writes at the first quality under the limit, best first."""
    for quality in qualities:
        path = OUT / f"{name}.webp"
        try:
            return write_webp(frames, name, quality, **options)
        except SystemExit:
            path.unlink(missing_ok=True)
    raise SystemExit(f"{name} doesn't fit at any quality")


def mood_frames(mood):
    """The loop, and how many captured frames each of its frames stands for."""
    meta = json.loads((WORK / "meta.json").read_text())["moods"]
    # The longest loop by far, so it drops every other frame to stay near the other clips.
    stride = meta.get("stride", {}).get(mood, 1)
    paths = sorted((WORK / "moods" / mood).glob("*.png"))
    size = (meta["size"], meta["size"])
    shortest, longest = meta["ranges"].get(mood, (meta["shortest"], meta["longest"]))
    _, start, end = find_seam(paths, shortest, longest, meta["overlap"])
    frames = [load(path, size) for path in paths[start - meta["overlap"] : end]]
    length = (end - start) * FRAME_MS / 1000
    print(f"{mood}: {length:.2f}s loop from frame {start}")
    return close_loop(frames, meta["overlap"])[::stride], stride


def encode_mood(mood):
    frames, stride = mood_frames(mood)
    print(f"{mood}: seam is {seam_report(frames):.1f}x a typical step")
    fit(frames, f"mood-{mood}", (76, 70) if stride > 1 else (84, 78, 72), duration=FRAME_MS * stride)


def row_frames(name, variant):
    meta = json.loads((WORK / "meta.json").read_text())[name]
    frames = [load(path, meta["size"]) for path in sorted((WORK / f"{name}-{variant}").glob("*.png"))]
    return close_loop(frames, meta["overlap"])


def encode_row(name, variant):
    clip = f"{name}-{variant}"
    frames = row_frames(name, variant)
    print(f"{clip}: seam is {seam_report(frames):.1f}x a typical step")
    fit(frames, clip, (84, 78, 72, 66), method=4, minimize=False)


def still(frame, name):
    """A clip's first frame, for readers who asked for reduced motion. From the capture, not the
    WebP, so it is lossless."""
    path = OUT / f"{name}.png"
    image = Image.fromarray((frame * 255 + 0.5).astype(np.uint8), "RGBA")
    if frame[..., 3].min() >= 1:
        image = image.convert("RGB")
    image.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} B")


def stills():
    for mood in MOODS:
        still(mood_frames(mood)[0][0], f"mood-{mood}-still")
    for name in ("materials", "tracking"):
        for variant in ("light", "dark"):
            still(row_frames(name, variant)[0], f"{name}-still-{variant}")


CLIPS = {
    **{f"mood-{mood}": lambda mood=mood: encode_mood(mood) for mood in MOODS},
    "materials-light": lambda: encode_row("materials", "light"),
    "materials-dark": lambda: encode_row("materials", "dark"),
    "tracking-light": lambda: encode_row("tracking", "light"),
    "tracking-dark": lambda: encode_row("tracking", "dark"),
    "stills": stills,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[1:] or CLIPS:
        CLIPS[name]()
        sys.stdout.flush()


if __name__ == "__main__":
    main()
