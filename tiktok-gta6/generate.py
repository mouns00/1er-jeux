#!/usr/bin/env python3
"""Génère une vidéo TikTok verticale (1080x1920) à partir d'un fichier épisode JSON.

Usage : python3 tiktok-gta6/generate.py tiktok-gta6/episodes/2026-11-12.json

Sorties (dans tiktok-gta6/output/) :
  <date>.mp4  la vidéo prête à poster
  <date>.txt  légende, hashtags, texte de voix off et sources

Dépendances : Pillow, numpy, ffmpeg.
"""
import json
import math
import os
import random
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
SR = 44100
# Zone sûre TikTok : l'interface couvre le haut, le bas et la colonne de droite.
SAFE_L, SAFE_R, SAFE_T, SAFE_B = 70, 940, 260, 1450

ACCENTS = {
    "pink": (255, 45, 149),
    "cyan": (0, 229, 255),
    "yellow": (255, 221, 0),
    "red": (255, 59, 48),
    "green": (57, 255, 136),
}

FONT_DIRS = ["/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/dejavu"]
FONT_FILES = {
    "black": ["InterDisplay-Black.otf", "Inter-Black.otf", "DejaVuSans-Bold.ttf"],
    "bold": ["Inter-ExtraBold.otf", "Inter-Bold.otf", "DejaVuSans-Bold.ttf"],
}


def font(kind, size):
    for name in FONT_FILES[kind]:
        for d in FONT_DIRS:
            path = os.path.join(d, name)
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def ease_out(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


# ---------------------------------------------------------------- visuel


def make_background(accent):
    """Dégradé nocturne + soleil + halo, calculé une fois par couleur."""
    y = np.linspace(0, 1, H)[:, None]
    top = np.array([10, 6, 28])
    mid = np.array([60, 12, 90])
    bot = np.array(accent) * 0.55
    col = np.where(y < 0.6, top + (mid - top) * (y / 0.6), mid + (bot - mid) * ((y - 0.6) / 0.4))
    img = np.repeat(col[:, None, :], W, axis=1)
    yy, xx = np.mgrid[0:H, 0:W]
    # Soleil rayé derrière l'horizon.
    cx, cy, r = W / 2, 1330, 330
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    sun = (dist < r) & (yy < 1480) & (((yy - cy) % 46 > 12) | (yy < cy))
    sun_col = np.stack(
        [np.full((H, W), 255.0), 120 + 110 * (1 - (yy - (cy - r)) / (2 * r)), np.full((H, W), 90.0)], axis=2
    )
    img = np.where(sun[:, :, None], img * 0.35 + sun_col * 0.65, img)
    glow = np.exp(-((dist / 620) ** 2))[:, :, None] * np.array(accent) * 0.35
    img = img + glow
    # Sol sombre sous l'horizon.
    ground = yy >= 1480
    img = np.where(ground[:, :, None], np.array([8, 4, 22]) + (img - np.array([8, 4, 22])) * 0.12, img)
    # Vignette.
    v = 1 - 0.55 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / 2
    img = img * v[:, :, None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")


def draw_grid(draw, t, accent):
    """Grille en perspective qui défile vers le spectateur."""
    horizon, vx = 1480, W / 2
    col = tuple(int(c * 0.8) for c in accent)
    for i in range(-14, 15):
        draw.line([(vx + i * 30, horizon), (vx + i * 330, H)], fill=col, width=3)
    for k in range(12):
        p = ((k + (t * 0.9) % 1) / 12) ** 2.2
        yy = horizon + p * (H - horizon)
        draw.line([(0, yy), (W, yy)], fill=col, width=2 + int(4 * p))
    draw.line([(0, horizon), (W, horizon)], fill=accent, width=5)


def fit_text(lines, kind, max_w, start, min_size=60):
    size = start
    while size > min_size:
        f = font(kind, size)
        if max(f.getlength(line) for line in lines) <= max_w:
            return f
        size -= 6
    return font(kind, min_size)


def render_block(lines, f, fill, accent, stroke=12, spacing=1.02):
    """Bloc de texte centré : contour noir + ombre décalée couleur accent."""
    asc, desc = f.getmetrics()
    lh = int((asc + desc) * spacing)
    pad = stroke + 30
    bw = int(max(f.getlength(line) for line in lines)) + 2 * pad
    bh = lh * len(lines) + 2 * pad
    img = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        x = (bw - f.getlength(line)) / 2
        y = pad + i * lh
        d.text((x + 10, y + 12), line, font=f, fill=accent + (255,), stroke_width=stroke, stroke_fill=accent + (255,))
    for i, line in enumerate(lines):
        x = (bw - f.getlength(line)) / 2
        y = pad + i * lh
        d.text((x, y), line, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    return img


def paste_center(frame, layer, cx, cy, scale=1.0, alpha=1.0):
    if scale != 1.0:
        layer = layer.resize((max(1, int(layer.width * scale)), max(1, int(layer.height * scale))), Image.BILINEAR)
    if alpha < 1.0:
        a = layer.getchannel("A").point(lambda v: int(v * alpha))
        layer = layer.copy()
        layer.putalpha(a)
    frame.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))


def pill(text, accent, size=44):
    f = font("bold", size)
    tw = int(f.getlength(text))
    img = Image.new("RGBA", (tw + 72, size + 44), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=img.height // 2, fill=accent + (255,))
    d.text((36, 18), text, font=f, fill=(10, 6, 28, 255))
    return img


def big_lines(slide, t):
    """Texte principal ; un compteur animé remplace {n} si la slide en définit un."""
    text = slide["big"]
    if "count" in slide:
        n = slide["count"] * ease_out(t / 0.9)
        text = text.replace("{n}", str(int(round(n))))
    return text.split("\n")


def render_video(ep, silent_path):
    slides = ep["slides"]
    total = sum(s["duration"] for s in slides)
    safe_w = SAFE_R - SAFE_L
    cx = (SAFE_L + SAFE_R) // 2
    backgrounds = {}
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", "yuv420p", silent_path],
        stdin=subprocess.PIPE,
    )
    rng = random.Random(6)
    elapsed = 0.0
    for idx, s in enumerate(slides):
        accent = ACCENTS[s.get("accent", "pink")]
        if accent not in backgrounds:
            backgrounds[accent] = make_background(accent)
        bg = backgrounds[accent]
        final_lines = s["big"].replace("{n}", str(s.get("count", ""))).split("\n")
        f_big = fit_text(final_lines, "black", safe_w - 40, s.get("size", 250))
        static_big = None if "count" in s else render_block(final_lines, f_big, (255, 255, 255, 255), accent)
        kicker = pill(s["kicker"], accent) if s.get("kicker") else None
        sub = None
        if s.get("sub"):
            sub_lines = s["sub"].split("\n")
            sub = render_block(sub_lines, fit_text(sub_lines, "bold", safe_w - 20, 76, 44),
                               accent + (255,), (0, 0, 0), stroke=8, spacing=1.12)
        src = None
        if s.get("source"):
            src = render_block([s["source"]], font("bold", 34), (255, 255, 255, 235), (0, 0, 0), stroke=5)
        big_h = (static_big or render_block(final_lines, f_big, (255, 255, 255, 255), accent)).height
        cy = 800 - (60 if sub else 0)
        for n in range(int(round(s["duration"] * FPS))):
            t = n / FPS
            g = (elapsed + t) / total
            frame = bg.copy().convert("RGBA")
            draw_grid(ImageDraw.Draw(frame), elapsed + t, accent)
            shake = max(0.0, 1 - t / 0.35) * 22
            ox, oy = rng.uniform(-shake, shake), rng.uniform(-shake, shake)
            if kicker:
                k = ease_out(t / 0.25)
                paste_center(frame, kicker, cx + ox, SAFE_T + 60 - (1 - k) * 80, alpha=k)
            layer = static_big or render_block(big_lines(s, t), f_big, (255, 255, 255, 255), accent)
            p = ease_out(t / 0.28)
            pulse = 1 + 0.012 * math.sin(t * 5)
            paste_center(frame, layer, cx + ox, cy + oy, scale=(1.7 - 0.7 * p) * pulse, alpha=min(1, t / 0.1 + 0.3))
            if sub and t > 0.45:
                q = ease_out((t - 0.45) / 0.3)
                paste_center(frame, sub, cx, cy + big_h / 2 + sub.height / 2 + 10 + (1 - q) * 60, alpha=q)
            if src and t > 0.7:
                paste_center(frame, src, cx, SAFE_B - 30, alpha=ease_out((t - 0.7) / 0.3))
            d = ImageDraw.Draw(frame)
            # Barre de progression : un segment par slide.
            seg_gap, x0, x1, by = 10, SAFE_L, SAFE_R, SAFE_T - 50
            seg_w = (x1 - x0 - seg_gap * (len(slides) - 1)) / len(slides)
            for j in range(len(slides)):
                sx = x0 + j * (seg_w + seg_gap)
                d.rounded_rectangle([sx, by, sx + seg_w, by + 10], radius=5, fill=(255, 255, 255, 70))
                fill_p = 1.0 if j < idx else (t / s["duration"] if j == idx else 0.0)
                if fill_p > 0:
                    d.rounded_rectangle([sx, by, sx + max(10, seg_w * fill_p), by + 10], radius=5, fill=(255, 255, 255, 255))
            if t < 0.1:  # flash blanc à chaque changement de slide
                frame = Image.blend(frame, Image.new("RGBA", (W, H), (255, 255, 255, 255)), 0.55 * (1 - t / 0.1))
            proc.stdin.write(frame.convert("RGB").tobytes())
        elapsed += s["duration"]
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg a échoué pendant l'encodage vidéo")
    return total


# ---------------------------------------------------------------- audio


def render_audio(ep, wav_path, total):
    """Instru originale synthétisée (aucun sample) + impact à chaque slide."""
    n = int(total * SR) + SR // 2
    out = np.zeros(n)
    rng = np.random.default_rng(6)

    def add(sig, at):
        i = int(at * SR)
        if i < n:
            sig = sig[: n - i]
            out[i : i + len(sig)] += sig

    def kick(amp=0.9):
        t = np.arange(int(0.32 * SR)) / SR
        return amp * np.sin(2 * np.pi * (45 * t + 22 * (1 - np.exp(-t * 28)))) * np.exp(-t * 9)

    def hat(amp=0.12):
        t = np.arange(int(0.05 * SR)) / SR
        return amp * np.diff(rng.standard_normal(len(t) + 1)) * np.exp(-t * 90)

    def clap(amp=0.3):
        t = np.arange(int(0.18 * SR)) / SR
        return amp * rng.standard_normal(len(t)) * np.exp(-t * 26) * (1 + 0.6 * np.sin(2 * np.pi * 55 * t))

    def bass(freq, dur, amp=0.32):
        t = np.arange(int(dur * SR)) / SR
        return amp * np.tanh(2.2 * np.sin(2 * np.pi * freq * t)) * np.minimum(1, t * 60) * np.exp(-t * 2.5)

    def impact(amp=0.8):
        t = np.arange(int(0.7 * SR)) / SR
        boom = np.sin(2 * np.pi * (38 * t + 30 * (1 - np.exp(-t * 14)))) * np.exp(-t * 5)
        return amp * (boom + 0.5 * rng.standard_normal(len(t)) * np.exp(-t * 22))

    def riser(dur, amp=0.16):
        t = np.arange(int(dur * SR)) / SR
        return amp * rng.standard_normal(len(t)) * (t / dur) ** 2.5

    beat = 60 / 140
    notes = [55.0, 55.0, 65.4, 49.0]  # La, La, Do, Sol
    b = 0
    while b * beat < total:
        at = b * beat
        bar, pos = divmod(b, 4)
        if pos in (0, 2):
            add(kick(), at)
        if pos == 0:
            add(bass(notes[bar % 4], beat * 3.5), at)
        if pos in (1, 3):
            add(clap(), at)
        if pos == 3:
            add(kick(0.7), at + beat * 0.5)
        for h in range(4 if pos == 3 else 2):
            add(hat(), at + h * beat / (4 if pos == 3 else 2))
        b += 1
    at = 0.0
    for s in ep["slides"]:
        add(impact(), at)
        if s["duration"] > 1.2:
            add(riser(0.6), at + s["duration"] - 0.6)
        at += s["duration"]
    fade = int(0.4 * SR)
    out[int(total * SR) - fade : int(total * SR)] *= np.linspace(1, 0, fade)
    out[int(total * SR) :] = 0
    out = np.tanh(out * 1.3) * 0.85
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())


# ---------------------------------------------------------------- main


def write_post_text(ep, path):
    tags = " ".join("#" + h.lstrip("#") for h in ep.get("hashtags", []))
    parts = [
        "=== LÉGENDE À COPIER ===", ep.get("caption", ""), tags, "",
        "=== VOIX OFF (à lire, ou à coller dans la synthèse vocale TikTok) ===", ep.get("voiceover", ""), "",
        "=== SOURCES ===", *ep.get("sources", []),
    ]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts) + "\n")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as fh:
        ep = json.load(fh)
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, ep["date"])
    silent, wav = base + ".silent.mp4", base + ".wav"
    total = render_video(ep, silent)
    render_audio(ep, wav, total)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-i", wav, "-c:v", "copy", "-c:a", "aac",
         "-b:a", "192k", "-shortest", "-movflags", "+faststart", base + ".mp4"],
        check=True,
    )
    os.remove(silent)
    os.remove(wav)
    write_post_text(ep, base + ".txt")
    print(f"OK {base}.mp4 ({total:.1f}s)")


if __name__ == "__main__":
    main()
