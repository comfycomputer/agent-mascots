#!/usr/bin/env python3
"""The promo video's sound: a short piece of music and its sound effects, synthesised from
scratch, so there are no samples to license. video.mjs runs it with the cue list it writes:

    python3 scripts/media/audio.py cues.json score.wav

Needs numpy and ffmpeg. 120 beats a minute in D major, one chord a bar:
D, Bm, G, A three times, then Em, A and home to D. The sound effects are tuned to the
chord under them, so they sit in the music rather than on top of it. The mix is normalised to
-14 LUFS, where X and LinkedIn play it.
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SR = 48_000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4
rng = np.random.default_rng(7)

# ---------- the harmony ----------

# Pad voicings move as little as possible; the bass sits where a phone speaker can still hear it.
CHORDS = {
    "D": ([54, 57, 61, 64], 38),
    "Bm": ([54, 57, 61, 62], 35),
    "G": ([54, 57, 59, 62], 43),
    "A": ([52, 57, 59, 61], 45),
    "Em": ([54, 55, 59, 62], 40),
    "Dend": ([54, 57, 61, 64, 69], 38),
}
BARS = ["D", "Bm", "G", "A"] * 3 + ["Em", "A", "Dend"]

# A bell melody over the middle and the end, as (step, note, length in steps) per bar.
MELODY = {
    "D": [(0, 81, 4), (4, 78, 2), (6, 81, 2), (8, 85, 6)],
    "Bm": [(0, 83, 4), (4, 81, 2), (6, 78, 2), (8, 76, 6)],
    "G": [(0, 74, 2), (2, 76, 2), (4, 78, 4), (8, 81, 6)],
    "A": [(0, 76, 4), (4, 78, 2), (6, 81, 2), (8, 83, 4), (12, 85, 4)],
    "Em": [(0, 83, 4), (4, 79, 4), (8, 78, 8)],
    "Aend": [(0, 76, 4), (4, 81, 4), (8, 85, 4), (12, 88, 4)],
}
# The mallets' rolling figure: an index into the chord's tones per sixteenth, or None for a rest.
FIGURE = [0, 2, 1, 3, None, 2, 4, 3, 1, None, 2, 0, 3, None, 4, 2]
ACCENTS = {0: 1.0, 6: 0.85, 8: 0.9, 14: 0.8}
# Bass: (step, length in steps, interval above the root).
BASS = [(0, 3, 0), (3, 2, 0), (6, 2, 12), (8, 3, 0), (11, 2, 7), (14, 2, 12)]


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def tones(chord):
    pad, root = CHORDS[chord]
    return sorted([n + 12 for n in pad[:4]] + [root + 36])


# ---------- building blocks ----------


def time(seconds):
    return np.arange(int(seconds * SR)) / SR


def spectral(x, gain):
    """Filters `x` by a gain curve over frequency. Zero-phase, so nothing smears in time."""
    n = len(x)
    size = 1 << (n - 1).bit_length()
    spectrum = np.fft.rfft(x, size)
    f = np.fft.rfftfreq(size, 1 / SR)
    return np.fft.irfft(spectrum * gain(f), size)[:n]


def lowpass(x, cutoff, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / cutoff) ** (2 * order)))


def highpass(x, cutoff, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1e-3)) ** (2 * order)))


def bandpass(x, low, high):
    return highpass(lowpass(x, high), low)


def noise(seconds):
    return rng.standard_normal(int(seconds * SR))


def decay(seconds, tau, attack=0.002):
    t = time(seconds)
    return np.minimum(1, t / attack) * np.exp(-t / tau)


def sweep(f0, f1, seconds, curve=0.05):
    """A sine gliding from f0 to f1, quickly at first."""
    t = time(seconds)
    f = f1 + (f0 - f1) * np.exp(-t / curve)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


class Bus:
    """A stereo track. `add` places a mono or stereo sound at a time, with a pan."""

    def __init__(self, seconds):
        self.x = np.zeros((2, int(seconds * SR)))

    def add(self, at, sound, gain=1.0, pan=0.0):
        start = int(round(at * SR))
        if start >= self.x.shape[1]:
            return
        sound = np.atleast_2d(sound)
        if sound.shape[0] == 1:
            angle = (pan + 1) * np.pi / 4
            sound = np.vstack([sound[0] * np.cos(angle), sound[0] * np.sin(angle)]) * np.sqrt(2)
        if start < 0:
            sound, start = sound[:, -start:], 0
        end = min(self.x.shape[1], start + sound.shape[1])
        self.x[:, start:end] += gain * sound[:, : end - start]


# ---------- instruments ----------


def kick():
    t = time(0.45)
    f = 46 + 120 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = highpass(noise(0.45), 2500) * np.exp(-t / 0.002) * 0.25
    return np.tanh(1.6 * (body + click)) / np.tanh(1.6)


def clap():
    t = time(0.5)
    hits = sum(np.roll(np.exp(-t / 0.005), int(d * SR)) * (t >= d) for d in (0, 0.009, 0.019))
    tail = np.exp(-np.maximum(t - 0.019, 0) / 0.11) * (t >= 0.019)
    return bandpass(noise(0.5), 900, 3200) * (hits * 0.8 + tail * 0.5)


def hat(open_=False):
    length = 0.4 if open_ else 0.08
    tau = 0.13 if open_ else 0.018
    metallic = sum(np.sign(np.sin(2 * np.pi * f * time(length))) for f in (3020, 4610, 5890, 7380)) * 0.12
    return highpass(noise(length) * 0.7 + metallic, 7000) * decay(length, tau, 0.0005)


def shaker():
    return bandpass(noise(0.07), 5000, 11000) * decay(0.07, 0.022, 0.006)


def bass(note, seconds):
    t = time(seconds + 0.08)
    f = hz(note)
    tone = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 0.006) * np.where(t < seconds, 1 - 0.25 * t / seconds, (0.75) * np.exp(-(t - seconds) / 0.02))
    return lowpass(np.tanh(1.4 * tone * env), 900)


def pad(notes, seconds):
    """Three detuned saws a note, softened, slow to swell and slow to let go. Stereo."""
    length = seconds + 1.2
    t = time(length)
    out = np.zeros((2, len(t)))
    for note in notes:
        for side, cents in ((0, -7), (1, 7), (0, 2), (1, -3)):
            f = hz(note) * 2 ** (cents / 1200)
            phase = rng.uniform(0, 2 * np.pi)
            saw = sum(np.sin(2 * np.pi * f * k * t + phase * k) / k for k in range(1, int(3500 / f) + 1))
            out[side] += saw
    env = np.minimum(1, t / 0.35) * np.where(t < seconds, 1, np.exp(-(t - seconds) / 0.35))
    # Above the bass and below the mallets, so the three never crowd one another.
    out = np.vstack([highpass(lowpass(ch, 1500, 2), 180) for ch in out]) * env
    return out / (len(notes) * 3)


def mallet(note, velocity=1.0, length=1.4):
    """A soft marimba-ish strike: a fundamental and two inharmonic modes that die quickly."""
    t = time(length)
    f = hz(note)
    tone = (
        np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42)
        + 0.32 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.09)
        + 0.08 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.03)
    )
    strike = lowpass(noise(length), 3000) * np.exp(-t / 0.0015) * 0.15
    return (tone + strike) * np.minimum(1, t / 0.0015) * velocity


def bell(note, seconds=1.2, index=1.6):
    """Two-operator FM at a 2:1 ratio: a glassy electric piano, brighter as it strikes."""
    length = seconds + 1.0
    t = time(length)
    f = hz(note)
    mod = index * np.exp(-t / 0.25) * np.sin(2 * np.pi * 2 * f * t)
    tone = np.sin(2 * np.pi * f * t + mod) + 0.15 * np.sin(2 * np.pi * 4.01 * f * t) * np.exp(-t / 0.15)
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.9) * np.where(t < seconds, 1, np.exp(-(t - seconds) / 0.25))
    return tone * env


# ---------- effects ----------


def reverb(x, seconds=1.7, tau=0.42, predelay=0.018, brightness=5500):
    """Convolution with decaying noise, a different noise each side, for width."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = []
    for side in range(2):
        ir = lowpass(rng.standard_normal(n), brightness) * np.exp(-t / tau)
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
        ir /= np.sqrt(np.sum(ir**2))
        size = 1 << (x.shape[1] + len(ir)).bit_length()
        y = np.fft.irfft(np.fft.rfft(x[side], size) * np.fft.rfft(ir, size), size)[: x.shape[1]]
        out.append(y)
    return np.vstack(out)


def ping_pong(x, delay=0.75 * BEAT, feedback=0.38, repeats=6, tone=3500):
    """A dotted-eighth delay that bounces between the sides and darkens as it goes."""
    out = np.zeros_like(x)
    d = int(delay * SR)
    echo = x.mean(axis=0)
    for k in range(1, repeats + 1):
        echo = lowpass(echo, tone)
        side = k % 2
        shifted = np.zeros(x.shape[1])
        shifted[k * d :] = echo[: x.shape[1] - k * d] * feedback**k
        out[side] += shifted
    return out


def stft_filter(x, cutoff_at):
    """A lowpass whose cutoff moves: `cutoff_at(t)` gives it, in Hz, at each moment."""
    size, hop = 2048, 512
    window = np.hanning(size)
    pad = np.concatenate([np.zeros(size), x, np.zeros(size)])
    out = np.zeros_like(pad)
    norm = np.zeros_like(pad)
    f = np.fft.rfftfreq(size, 1 / SR)
    for start in range(0, len(pad) - size, hop):
        t = (start - size + size / 2) / SR
        frame = np.fft.rfft(pad[start : start + size] * window)
        gain = 1 / np.sqrt(1 + (f / max(cutoff_at(t), 50)) ** 4)
        out[start : start + size] += np.fft.irfft(frame * gain, size) * window
        norm[start : start + size] += window**2
    return (out / np.maximum(norm, 1e-6))[size : size + len(x)]


def whoosh(length):
    tail = 0.25
    total = length + tail
    t = time(total)
    air = stft_filter(noise(total), lambda s: 400 * (9000 / 400) ** min(1, max(0, s / length)))
    env = np.where(t < length, (t / length) ** 2.2, np.exp(-(t - length) / 0.05))
    pan = np.clip(-0.7 + 1.4 * t / total, -1, 1)
    mono = air * env
    return np.vstack([mono * np.cos((pan + 1) * np.pi / 4), mono * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)


def riser(length):
    t = time(length + 0.1)
    air = stft_filter(noise(len(t) / SR), lambda s: 300 * (12000 / 300) ** min(1, max(0, s / length)))
    env = np.minimum(1, (t / length) ** 2.5) * np.where(t < length, 1, np.exp(-(t - length) / 0.03))
    tone = sum(np.sin(2 * np.pi * np.cumsum(hz(n) * 2 ** (2 * t / length)) / SR) for n in (62, 69, 74)) / 3
    return air * env * 0.9 + tone * env * 0.25


def impact():
    t = time(1.2)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.35)
    crack = lowpass(noise(1.2), 2500) * np.exp(-t / 0.05) * 0.4
    return boom + crack


def pop(f):
    """A bubble: a sine that leaps up an octave and a half as it dies, over a soft thump."""
    t = time(0.25)
    body = sweep(f * 0.55, f * 1.6, 0.25, 0.03) * decay(0.25, 0.06, 0.001)
    thump = np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.03) * 0.5
    return body + thump


def boop():
    """The poke: a short wobble, the mascot saying 'hey'."""
    t = time(0.3)
    f = 620 * (1 + 0.06 * np.sin(2 * np.pi * 26 * t) * np.exp(-t / 0.1)) * (1 + 0.25 * np.exp(-t / 0.04))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(0.3, 0.08, 0.004)


def key():
    t = time(0.03)
    return bandpass(noise(0.03), 2500, 7500) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.002) * 0.3


def puff():
    return bandpass(noise(0.18), 1500, 7000) * decay(0.18, 0.05, 0.01)


# ---------- the score ----------


def score(cues, seconds):
    drums, low, pads, mallets, lead, fx = (Bus(seconds + 2) for _ in range(6))
    chord_at = lambda t: BARS[min(int(t // BAR), len(BARS) - 1)]  # noqa: E731
    kicks = []

    for b, chord in enumerate(BARS):
        at = b * BAR
        notes, root = CHORDS[chord]
        intro, build, groove, breakdown, final = b == 0, b == 1, 2 <= b <= 9 or b in (12, 13), b in (10, 11), b == 14
        name = "Dend" if final else chord

        # The pad, every bar. Swells in at the start; rings out at the end.
        pads.add(at, pad(CHORDS[name][0], BAR + (2.5 if final else 0)), 0.5)

        # Mallets: sparse to begin with, then the full figure.
        tt = tones("D" if final else chord)
        for step, index in enumerate(FIGURE):
            if index is None:
                continue
            if final and step > 8:
                continue
            velocity = ACCENTS.get(step, 0.55) * (0.8 + 0.2 * rng.random())
            pan = [-0.35, 0.25, -0.1, 0.4, 0.0][index]
            mallets.add(at + step * STEP + rng.normal(0, 0.003), mallet(tt[index], velocity), 0.33, pan)

        if groove:
            for beat in range(4):
                kicks.append(at + beat * BEAT)
                drums.add(at + beat * BEAT, kick(), 0.9)
            for beat in (1, 3):
                drums.add(at + beat * BEAT, clap(), 0.42, 0.05)
        if build or breakdown:
            # A softer clap on 2 and 4 keeps the pulse without the kick.
            for beat in (1, 3):
                drums.add(at + beat * BEAT, clap(), 0.25, 0.05)
        if build:
            for k in range(8):
                drums.add(at + 3 * BEAT + k * STEP / 2, clap() * (0.2 + 0.1 * k / 8), 0.3, 0.05)
        if intro:
            # No drums yet, but a pulse: shakers on the eighths.
            for step in range(0, 16, 2):
                drums.add(at + step * STEP + rng.normal(0, 0.004), shaker(), 0.1 + 0.04 * rng.random(), -0.3)
        if not intro and not final:
            for step in range(16):
                offbeat = step % 4 == 2
                if offbeat:
                    open_ = groove and b >= 6 and step in (6, 14)
                    drums.add(at + step * STEP, hat(open_), 0.28 if open_ else 0.32, 0.25)
                elif step % 2 == 1 or step % 4 == 0:
                    drums.add(at + step * STEP + rng.normal(0, 0.004), shaker(), 0.09 + 0.04 * rng.random(), -0.3)

        # Bass in the groove, and for the second half of the breakdown, back in before the drop.
        if groove or (b == 11):
            for step, length, interval in BASS:
                if b == 11 and step < 8:
                    continue
                low.add(at + step * STEP, bass(root + interval, length * STEP * 0.92), 0.55)
        if intro or build:
            low.add(at, bass(root, BAR * 0.95), 0.4)
        if final:
            low.add(at, lowpass(bass(root, BAR * 0.9), 300), 0.3)

        # The bell melody, over the middle section and again at the end.
        if 6 <= b <= 9 or b in (12, 13, 14):
            line = MELODY["Aend"] if b == 13 else MELODY.get(chord, [])
            if final:
                line = [(0, 86, 16)]
            for step, note, length in line:
                lead.add(at + step * STEP, bell(note, length * STEP), 0.22, 0.1)

    # The sound effects, each tuned to the chord under it.
    for cue in cues:
        t, kind, n = cue["t"], cue["type"], cue.get("n", 0)
        tt = tones(chord_at(t))
        if kind == "pop":
            fx.add(t, pop(hz(tt[2] + 12)), 0.35)
            fx.add(t + 0.02, mallet(tt[4] + 12, 0.8), 0.2, 0.2)
        elif kind == "boop":
            fx.add(t, boop(), 0.18, 0.1)
        elif kind == "swap":
            fx.add(t, pop(hz(tt[n % 5] + 12)), 0.18, [-0.3, 0.3][n % 2])
            fx.add(t, puff(), 0.12, [0.3, -0.3][n % 2])
        elif kind == "key":
            fx.add(t, key(), 0.05 + 0.02 * rng.random(), 0.15)
        elif kind == "whoosh":
            fx.add(t, whoosh(cue["length"]), 0.32)
        elif kind == "riser":
            fx.add(t, riser(cue["length"]), 0.3)
        elif kind == "hit":
            fx.add(t, impact(), 0.45)
        elif kind == "bubble":
            fx.add(t, pop(hz(tt[n % 5] + 24)), 0.07, rng.uniform(-0.7, 0.7))
        elif kind == "pluck":
            fx.add(t, mallet(tt[n % 5] + 12, 1.0), 0.4, -0.4 + 0.2 * n)
            fx.add(t, bell(tt[n % 5] + 12, 0.2, 1.0), 0.12, -0.4 + 0.2 * n)
        elif kind == "sparkle":
            for k, note in enumerate([93, 90, 88, 85, 81, 78]):
                fx.add(t + k * STEP / 1.5, bell(note, 0.15, 2.2), 0.09, [-0.5, 0.5][k % 2])

    # Sidechain: everything but the drums and effects ducks under each kick, so the groove breathes.
    n = drums.x.shape[1]
    duck = np.ones(n)
    tt = np.arange(n) / SR
    for k in kicks:
        start = int(k * SR)
        span = tt[start : start + int(0.4 * SR)] - k
        duck[start : start + len(span)] = np.minimum(duck[start : start + len(span)], 1 - 0.55 * np.exp(-span / 0.09))
    for bus, depth in ((pads, 1.0), (low, 0.6), (mallets, 0.35), (lead, 0.3)):
        bus.x *= 1 - depth * (1 - duck)

    mallet_mix = mallets.x + ping_pong(mallets.x) * 0.55
    wet = reverb(pads.x * 0.35 + mallet_mix * 0.4 + lead.x * 0.55 + fx.x * 0.25 + drums.x * 0.08)
    mix = drums.x + low.x + pads.x + mallet_mix + lead.x + fx.x + wet * 0.45

    mix = np.vstack([highpass(ch, 28) for ch in mix])
    mix = mix[:, : int(seconds * SR)]
    # A short fade, so the last chord doesn't stop dead at the cut.
    fade = int(0.6 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
    peak = np.max(np.abs(mix))
    return np.tanh(1.1 * mix / peak) / np.tanh(1.1) * 0.7


def write_wav(path, x):
    pcm = (np.clip(x.T, -1, 1) * 32767).astype("<i2")
    import wave

    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def loudnorm(source, target):
    """Two passes of ffmpeg's loudnorm: measure, then apply in one linear gain to -14 LUFS."""
    measure = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(source), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stderr
    stats = json.loads(measure[measure.rindex("{") : measure.rindex("}") + 1])
    filter_ = (
        "loudnorm=I=-14:TP=-1.5:LRA=11:linear=true"
        f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}"
        f":measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}"
    )
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(source), "-af", filter_, "-ar", str(SR), str(target)], check=True)


def main():
    cues_path, out = Path(sys.argv[1]), Path(sys.argv[2])
    spec = json.loads(cues_path.read_text())
    assert spec["bpm"] == BPM, f"the picture is cut at {spec['bpm']} bpm and the music is {BPM}"
    mix = score(spec["cues"], spec["seconds"])
    with tempfile.TemporaryDirectory() as folder:
        raw = Path(folder) / "raw.wav"
        write_wav(raw, mix)
        loudnorm(raw, out)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
