#!/usr/bin/env python3
"""Format « présentateur » : images en fond, présentateur en médaillon, voix off
et sous-titres synchronisés en bas. Pas de musique (à ajouter dans TikTok).

Usage : python3 tiktok-gta6/talk.py tiktok-gta6/episodes/<fichier>.json

L'épisode fournit :
  voice   chemin du .wav de la voix off (relatif à tiktok-gta6/)
  words   [[mot, début_s, fin_s], ...] : minutage mot à mot de la voix
  scenes  [{start, kicker, big, accent, bg, focus, source}] : titres et fonds
  presenter (optionnel) image du présentateur ; absente = pas de médaillon
"""
import json
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from generate import (ACCENTS, FPS, H, SAFE_L, SAFE_R, SAFE_T, W, ease_out, fit_text, font,
                      make_background, paste_center, pill, render_block, write_post_text)

HERE = os.path.dirname(os.path.abspath(__file__))
CX = (SAFE_L + SAFE_R) // 2
SUB_Y = 1455          # centre des sous-titres, au-dessus de l'interface TikTok
FACE = 210            # côté du médaillon présentateur
FACE_Y = 1268
TAIL = 0.5            # silence final


CARD_W, CARD_H, CARD_Y = 870, 580, 660   # image du jeu : carte nette en haut


def load_bg(name, accent):
    """Renvoie (fond flouté plein écran, image source nette pour la carte)."""
    path = os.path.join(HERE, "media", name) if name else None
    if not path or not os.path.exists(path):
        return make_background(accent).convert("RGBA"), None
    src = Image.open(path).convert("RGB")
    scale = max(W / src.width, H / src.height)
    full = src.resize((int(src.width * scale) + 1, int(src.height * scale) + 1), Image.BILINEAR)
    x = (full.width - W) // 2
    full = full.crop((x, 0, x + W, H)).filter(ImageFilter.GaussianBlur(28))
    return ImageEnhance.Brightness(full).enhance(0.45).convert("RGBA"), src


CARD_MASK = Image.new("L", (CARD_W, CARD_H), 0)
ImageDraw.Draw(CARD_MASK).rounded_rectangle([0, 0, CARD_W - 1, CARD_H - 1], radius=44, fill=255)


def card_frame(src, focus, t, dur, idx):
    """Carte avec zoom lent (avant ou arrière selon la scène), cadrée sur `focus` (0..1)."""
    p = min(1.0, t / max(dur, 0.01))
    z = 1.04 + 0.14 * (p if idx % 2 == 0 else 1 - p)
    ch = min(src.height, src.width * CARD_H / CARD_W) / z
    cw = ch * CARD_W / CARD_H
    x = min(max(focus * src.width - cw / 2 + (p - 0.5) * 40, 0), src.width - cw)
    y = (src.height - ch) / 2
    card = src.resize((CARD_W, CARD_H), Image.BILINEAR, box=(x, y, x + cw, y + ch)).convert("RGBA")
    card.putalpha(CARD_MASK)
    return card


def shade():
    """Assombrit le bas pour que les sous-titres restent lisibles sur n'importe quel fond."""
    a = np.zeros((H, W), dtype=np.uint8)
    ramp = np.clip((np.arange(H) - 900) / 500, 0, 1) * 185
    a[:] = ramp[:, None].astype(np.uint8)
    img = Image.new("RGBA", (W, H), (8, 4, 22, 0))
    img.putalpha(Image.fromarray(a))
    return img


def presenter_tile(path):
    img = Image.open(path).convert("RGB")
    s = min(img.size)
    # Cadrage serré sur le visage (portrait centré, tête dans les deux tiers hauts).
    box = (int(s * 0.17), int(s * 0.01), int(s * 0.83), int(s * 0.67))
    img = img.crop(box).resize((FACE, FACE), Image.LANCZOS)
    mask = Image.new("L", (FACE, FACE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, FACE - 1, FACE - 1], radius=50, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def voice_envelope(path, n_frames):
    """Volume de la voix image par image (0..1), pour animer le médaillon."""
    with wave.open(path) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float)
        if w.getnchannels() == 2:
            x = x[::2]
        dur = len(x) / sr
    env = np.zeros(n_frames)
    hop = sr // FPS
    for i in range(min(n_frames, len(x) // hop)):
        env[i] = np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2))
    env = env / (np.percentile(env, 95) + 1e-9)
    env = np.clip(env, 0, 1)
    for i in range(1, n_frames):  # retombée douce
        env[i] = max(env[i], env[i - 1] * 0.8)
    return env, dur


def chunk_words(words, max_chars=17, max_words=3):
    """Regroupe les mots en sous-titres courts, coupés à la ponctuation."""
    chunks, cur = [], []
    for w in words:
        text = w[0]
        if cur and (len(" ".join(c[0] for c in cur)) + 1 + len(text) > max_chars or len(cur) >= max_words):
            chunks.append(cur)
            cur = []
        cur.append(w)
        if text[-1] in ".,!?:»":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def render_sub(chunk, active, f):
    """Une ligne de sous-titre : mot en cours en jaune, les autres en blanc."""
    texts = [c[0].upper() for c in chunk]
    space = f.getlength(" ")
    widths = [f.getlength(t) for t in texts]
    asc, desc = f.getmetrics()
    pad = 30
    img = Image.new("RGBA", (int(sum(widths) + space * (len(texts) - 1)) + 2 * pad, asc + desc + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = pad
    for i, t in enumerate(texts):
        fill = (255, 225, 0, 255) if i == active else (255, 255, 255, 255)
        d.text((x + 5, pad + 6), t, font=f, fill=(0, 0, 0, 255), stroke_width=12, stroke_fill=(0, 0, 0, 255))
        d.text((x, pad), t, font=f, fill=fill, stroke_width=10, stroke_fill=(0, 0, 0, 255))
        x += widths[i] + space
    return img


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as fh:
        ep = json.load(fh)
    out_dir = os.path.join(HERE, "output")
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.join(out_dir, ep.get("slug", ep["date"]))
    voice = os.path.join(HERE, ep["voice"])
    with wave.open(voice) as w:
        total = w.getnframes() / w.getframerate() + TAIL
    n_frames = int(round(total * FPS))
    env, _ = voice_envelope(voice, n_frames)

    scenes = ep["scenes"]
    for i, s in enumerate(scenes):
        s["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else total
        s["rgb"] = ACCENTS[s.get("accent", "pink")]
        lines = s["big"].split("\n")
        s["layer"] = render_block(lines, fit_text(lines, "black", SAFE_R - SAFE_L - 40, s.get("size", 135)),
                                  (255, 255, 255, 255), s["rgb"], stroke=11)
        s["pill"] = pill(s["kicker"], s["rgb"]) if s.get("kicker") else None
        s["src"] = render_block([s["source"]], font("bold", 32), (255, 255, 255, 235), (0, 0, 0), stroke=5) if s.get("source") else None
        s["img"], s["card"] = load_bg(s.get("bg"), s["rgb"])

    chunks = chunk_words(ep["words"])
    f_sub = font("black", 88)
    sub_w = SAFE_R - SAFE_L + 60
    ppath = os.path.join(HERE, "media", ep["presenter"]) if ep.get("presenter") else None
    tile = presenter_tile(ppath) if ppath and os.path.exists(ppath) else None
    dark = shade()

    silent = base + ".silent.mp4"
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
         "-pix_fmt", "yuv420p", silent], stdin=subprocess.PIPE)
    si = 0
    for n in range(n_frames):
        t = n / FPS
        while si + 1 < len(scenes) and t >= scenes[si + 1]["start"]:
            si += 1
        s = scenes[si]
        ts = t - s["start"]
        frame = s["img"].copy()
        frame.alpha_composite(dark)
        d = ImageDraw.Draw(frame)
        if s["card"] is not None:
            x0, y0 = CX - CARD_W // 2, CARD_Y - CARD_H // 2
            d.rounded_rectangle([x0 - 8, y0 - 8, x0 + CARD_W + 7, y0 + CARD_H + 7], radius=52, fill=s["rgb"] + (255,))
            frame.alpha_composite(card_frame(s["card"], s.get("focus", 0.5), ts, s["end"] - s["start"], si), (x0, y0))
        # Barre de progression continue.
        by = SAFE_T - 50
        d.rounded_rectangle([SAFE_L, by, SAFE_R, by + 10], radius=5, fill=(255, 255, 255, 80))
        d.rounded_rectangle([SAFE_L, by, SAFE_L + max(10, (SAFE_R - SAFE_L) * t / total), by + 10], radius=5, fill=s["rgb"] + (255,))
        if s["pill"]:
            k = ease_out(ts / 0.25)
            paste_center(frame, s["pill"], CX, SAFE_T + 60 - (1 - k) * 60, alpha=k)
        p = ease_out(ts / 0.25)
        paste_center(frame, s["layer"], CX, 1010, scale=1.5 - 0.5 * p, alpha=min(1, ts / 0.08 + 0.3))
        if s["src"] and ts > 0.5:
            paste_center(frame, s["src"], CX, CARD_Y - CARD_H // 2 + 36, alpha=ease_out((ts - 0.5) / 0.3))
        if tile:
            a = env[n]
            ring = 10 + int(16 * a)
            half = FACE // 2 + ring
            d.rounded_rectangle([CX - half, FACE_Y - half, CX + half, FACE_Y + half], radius=50 + ring,
                                fill=s["rgb"] + (int(120 + 135 * a),))
            d.rounded_rectangle([CX - FACE // 2 - 6, FACE_Y - FACE // 2 - 6, CX + FACE // 2 + 6, FACE_Y + FACE // 2 + 6],
                                radius=56, fill=(255, 255, 255, 255))
            paste_center(frame, tile, CX, FACE_Y + 4 * math.sin(t * 2.2), scale=1.0)
        # Sous-titre courant.
        cur = None
        for ch in chunks:
            if ch[0][1] - 0.05 <= t:
                cur = ch
        if cur and t < cur[-1][2] + 0.35:
            active = max((i for i, w in enumerate(cur) if t >= w[1] - 0.03), default=0)
            sub = render_sub(cur, active, f_sub)
            sc = min(1.0, sub_w / sub.width) * (0.8 + 0.2 * ease_out((t - cur[0][1] + 0.05) / 0.12))
            paste_center(frame, sub, CX, SUB_Y, scale=sc)
        if ts < 0.1 and si > 0:
            frame = Image.blend(frame, Image.new("RGBA", (W, H), (255, 255, 255, 255)), 0.45 * (1 - ts / 0.1))
        proc.stdin.write(frame.convert("RGB").tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg a échoué pendant l'encodage vidéo")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-i", voice, "-c:v", "copy",
         "-af", f"loudnorm=I=-14:TP=-1.5:LRA=11,apad=pad_dur={TAIL}", "-ar", "44100", "-c:a", "aac", "-b:a", "192k",
         "-t", f"{total:.3f}", "-movflags", "+faststart", base + ".mp4"], check=True)
    os.remove(silent)
    ep.setdefault("voiceover", " ".join(w[0] for w in ep["words"]))
    write_post_text(ep, base + ".txt")
    print(f"OK {base}.mp4 ({total:.1f}s)")


if __name__ == "__main__":
    main()
