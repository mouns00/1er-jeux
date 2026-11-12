#!/usr/bin/env python3
"""Format « présentateur » : image du jeu en plein écran, tête du présentateur qui
parle en haut à gauche, voix off et sous-titres synchronisés en bas.
Pas de musique (à ajouter dans TikTok).

Usage : python3 tiktok-gta6/talk.py tiktok-gta6/episodes/<fichier>.json

L'épisode fournit :
  voice   chemin du .wav de la voix off (relatif à tiktok-gta6/)
  words   [[mot, début_s, fin_s], ...] : minutage mot à mot de la voix
  scenes  [{start, kicker, big, accent, bg, focus}] : titres et fonds.
          bg est une image ou une vidéo de tiktok-gta6/media/.
  presenter (optionnel) {file, mouth: [x, y, demi-largeur], chin: y} en pixels de la photo
"""
import json
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

from generate import (ACCENTS, FPS, H, SAFE_L, SAFE_R, SAFE_T, W, ease_out, fit_text, font,
                      make_background, paste_center, pill, render_block, write_post_text)

HERE = os.path.dirname(os.path.abspath(__file__))
CX = (SAFE_L + SAFE_R) // 2
SUB_Y = 1440          # centre des sous-titres, au-dessus de l'interface TikTok
SUB_SIZE = 62
FACE = 250            # côté du carré présentateur
FACE_X, FACE_Y = 60, 245   # coin haut-gauche du carré
TAIL = 0.5            # silence final
VIDEO_EXT = (".mp4", ".mov", ".webm", ".mkv")
MOUTH_STEPS = 13      # nombre d'ouvertures de bouche précalculées
MOUTH_MAX = 26        # ouverture maximale, en pixels de la photo d'origine


# ------------------------------------------------------------------ fonds


class Background:
    """Fond plein écran : image avec travelling lent, ou vidéo lue en boucle."""

    def __init__(self, name, accent):
        path = os.path.join(HERE, "media", name) if name else None
        self.video = None
        if path and os.path.exists(path) and path.lower().endswith(VIDEO_EXT):
            self.video = subprocess.Popen(
                ["ffmpeg", "-loglevel", "error", "-stream_loop", "-1", "-i", path, "-an",
                 "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},eq=brightness=-0.06",
                 "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
            return
        if path and os.path.exists(path):
            img = Image.open(path).convert("RGB")
        else:
            img = make_background(accent)
        scale = max(W * 1.2 / img.width, H * 1.2 / img.height)
        img = img.resize((int(img.width * scale) + 1, int(img.height * scale) + 1), Image.LANCZOS)
        self.img = ImageEnhance.Brightness(img).enhance(0.85)

    def frame(self, focus, t, dur, idx):
        if self.video:
            raw = self.video.stdout.read(W * H * 3)
            return Image.frombytes("RGB", (W, H), raw).convert("RGBA")
        p = min(1.0, t / max(dur, 0.01))
        z = 1.0 + 0.12 * (p if idx % 2 == 0 else 1 - p)
        cw, ch = W * 1.14 / z, H * 1.14 / z
        drift = (p - 0.5) * 120 * (1 if idx % 2 == 0 else -1)
        x = min(max(focus * self.img.width - cw / 2 + drift, 0), self.img.width - cw)
        y = (self.img.height - ch) / 2
        return self.img.resize((W, H), Image.BILINEAR, box=(x, y, x + cw, y + ch)).convert("RGBA")


def shade():
    """Assombrit le haut et le bas pour garder titres et sous-titres lisibles."""
    y = np.arange(H)
    a = np.clip((y - 1050) / 450, 0, 1) * 190 + np.clip((560 - y) / 400, 0, 1) * 150
    img = Image.new("RGBA", (W, H), (8, 4, 22, 0))
    img.putalpha(Image.fromarray(np.repeat(a[:, None], W, axis=1).astype(np.uint8)))
    return img


# ------------------------------------------------------------ présentateur


def mouth_states(cfg):
    """Précalcule le carré présentateur pour chaque ouverture de bouche.

    La mâchoire est étirée vers le bas sous la ligne des lèvres et l'intérieur de
    la bouche est peint dans l'ouverture : la bouche suit ainsi le volume de la voix.
    """
    src = np.asarray(Image.open(os.path.join(HERE, "media", cfg["file"])).convert("RGB")).astype(np.float32)
    h, w = src.shape[:2]
    mx, my, hw = cfg["mouth"]
    chin = cfg["chin"]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    lip = my - 4 * ((xx - mx) / hw) ** 2            # ligne des lèvres, légèrement courbée
    side = np.clip(1 - ((xx - mx) / hw) ** 2, 0, 1)
    states = []
    s = min(h, w)
    box = (int(s * 0.17), int(s * 0.01), int(s * 0.83), int(s * 0.67))
    mask = Image.new("L", (FACE, FACE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, FACE - 1, FACE - 1], radius=36, fill=255)
    for k in range(MOUTH_STEPS):
        o = MOUTH_MAX * k / (MOUTH_STEPS - 1)
        jaw = o * np.exp(-((xx - mx) / (hw * 1.25)) ** 2)      # descente de la mâchoire
        gap = o * np.sqrt(side)                                 # ouverture entre les lèvres
        below = yy - lip
        ramp = np.clip(below / (jaw + 4), 0, 1)
        fade = np.clip((chin - yy) / np.maximum(chin - lip - jaw - 4, 1), 0, 1)
        shift = jaw * ramp * fade
        sy = np.clip(yy - shift, 0, h - 1)
        y0 = np.floor(sy).astype(np.int32)
        y1 = np.minimum(y0 + 1, h - 1)
        fy = (sy - y0)[..., None]
        xi = xx.astype(np.int32)
        out = src[y0, xi] * (1 - fy) + src[y1, xi] * fy
        if o > 0:
            inside = np.clip(np.minimum(below, gap - below) / 2.0, 0, 1) * (gap > 1)
            depth = np.clip(below / np.maximum(gap, 1), 0, 1)[..., None]
            interior = np.array([52, 16, 18], np.float32) * (1 - depth) + np.array([24, 6, 8], np.float32) * depth
            teeth = (np.clip((gap * 0.24 - below) / 2.0, 0, 1) * np.clip(side * 1.6 - 0.5, 0, 1) * (below > 0) * min(1, o / 12))[..., None]
            interior = interior * (1 - teeth * 0.45) + np.array([200, 190, 182], np.float32) * teeth * 0.45
            out = out * (1 - inside[..., None]) + interior * inside[..., None]
        tile = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).crop(box).resize((FACE, FACE), Image.LANCZOS).convert("RGBA")
        tile.putalpha(mask)
        states.append(tile)
    return states


def voice_envelope(path, n_frames):
    """Ouverture de bouche image par image (0..1) à partir du volume de la voix."""
    with wave.open(path) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float)
        if w.getnchannels() == 2:
            x = x[::2]
    env = np.zeros(n_frames)
    hop = sr // FPS
    for i in range(min(n_frames, len(x) // hop)):
        env[i] = np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2))
    env = np.clip(env / (np.percentile(env, 92) + 1e-9), 0, 1)
    env[env < 0.12] = 0
    out = np.zeros(n_frames)
    for i in range(1, n_frames):  # ouverture rapide, fermeture un peu plus douce
        target = env[i] ** 0.75
        out[i] = out[i - 1] + (target - out[i - 1]) * (0.75 if target > out[i - 1] else 0.5)
    return out


# ------------------------------------------------------------ sous-titres


def chunk_words(words, max_chars=20, max_words=4):
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
    pad = 24
    img = Image.new("RGBA", (int(sum(widths) + space * (len(texts) - 1)) + 2 * pad, asc + desc + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = pad
    for i, t in enumerate(texts):
        fill = (255, 225, 0, 255) if i == active else (255, 255, 255, 255)
        d.text((x, pad), t, font=f, fill=fill, stroke_width=8, stroke_fill=(0, 0, 0, 255))
        x += widths[i] + space
    return img


# ------------------------------------------------------------------ rendu


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
    env = voice_envelope(voice, n_frames)

    pres = ep.get("presenter")
    tiles = None
    if pres and os.path.exists(os.path.join(HERE, "media", pres["file"])):
        tiles = mouth_states(pres)
    text_x = FACE_X + FACE + 34 if tiles else SAFE_L
    text_w = SAFE_R - text_x

    scenes = ep["scenes"]
    backgrounds = {}
    for i, s in enumerate(scenes):
        s["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else total
        s["rgb"] = ACCENTS[s.get("accent", "pink")]
        lines = s["big"].split("\n")
        s["layer"] = render_block(lines, fit_text(lines, "black", text_w - 60, s.get("size", 84), 40),
                                  (255, 255, 255, 255), s["rgb"], stroke=7)
        s["pill"] = pill(s["kicker"], s["rgb"], size=30) if s.get("kicker") else None
        key = s.get("bg")
        if key not in backgrounds:
            backgrounds[key] = Background(key, s["rgb"])
        s["bgobj"] = backgrounds[key]

    chunks = chunk_words(ep["words"])
    f_sub = font("black", SUB_SIZE)
    sub_w = SAFE_R - SAFE_L + 40
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
        frame = s["bgobj"].frame(s.get("focus", 0.5), ts, s["end"] - s["start"], si)
        frame.alpha_composite(dark)
        d = ImageDraw.Draw(frame)
        by = SAFE_T - 50
        d.rounded_rectangle([SAFE_L, by, SAFE_R, by + 8], radius=4, fill=(255, 255, 255, 80))
        d.rounded_rectangle([SAFE_L, by, SAFE_L + max(8, (SAFE_R - SAFE_L) * t / total), by + 8], radius=4, fill=s["rgb"] + (255,))
        if tiles:
            # Léger mouvement de tête : respiration lente + petit hochement sur la voix.
            bob = 3 * math.sin(t * 1.7) + 4 * env[n]
            ang = 1.2 * math.sin(t * 0.9) + 0.8 * math.sin(t * 2.3)
            d.rounded_rectangle([FACE_X - 6, FACE_Y - 6, FACE_X + FACE + 5, FACE_Y + FACE + 5], radius=42, fill=(255, 255, 255, 255))
            tile = tiles[int(round(env[n] * (MOUTH_STEPS - 1)))]
            inner = Image.new("RGBA", (FACE, FACE), (20, 22, 30, 255))
            moved = tile.resize((int(FACE * 1.08), int(FACE * 1.08)), Image.BILINEAR).rotate(ang, Image.BILINEAR)
            inner.alpha_composite(moved, (-int(FACE * 0.04), -int(FACE * 0.04) + int(bob)))
            inner.putalpha(tiles[0].getchannel("A"))
            frame.alpha_composite(inner, (FACE_X, FACE_Y))
        p = ease_out(ts / 0.25)
        if s["pill"]:
            frame.alpha_composite(s["pill"], (text_x, FACE_Y - 2))
        layer = s["layer"]
        if p < 1:
            a = layer.getchannel("A").point(lambda v: int(v * (0.3 + 0.7 * p)))
            layer = layer.copy()
            layer.putalpha(a)
        frame.alpha_composite(layer, (text_x - 24 + int((1 - p) * 60), FACE_Y + 58))
        cur = None
        for ch in chunks:
            if ch[0][1] - 0.05 <= t:
                cur = ch
        if cur and t < cur[-1][2] + 0.35:
            active = max((i for i, w in enumerate(cur) if t >= w[1] - 0.03), default=0)
            sub = render_sub(cur, active, f_sub)
            sc = min(1.0, sub_w / sub.width) * (0.88 + 0.12 * ease_out((t - cur[0][1] + 0.05) / 0.12))
            paste_center(frame, sub, CX + 60, SUB_Y, scale=sc)
        proc.stdin.write(frame.convert("RGB").tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg a échoué pendant l'encodage vidéo")
    for b in backgrounds.values():
        if b.video:
            b.video.kill()
    # Voix seule, sans effet ni réverbération : simple mise à niveau du volume.
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
