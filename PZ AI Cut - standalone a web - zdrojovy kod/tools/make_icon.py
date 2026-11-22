"""Ikona PZ AI Cut Standalone: bílé nůžky s jiskrou na fialovém gradientu.
Výstup src/icon.png (512) + build/icon.ico (16–256). Spuštění: py -I tools/make_icon.py"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024  # kreslí se ve 2× a zmenšuje (hladké hrany)


def gradient(w, h, c1, c2):
    g = Image.new("RGB", (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (x * 0.5 + y * 0.5) / (w * 0.5 + h * 0.5)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return g


def rot(p, a, c):
    x, y = p
    ca, sa = math.cos(a), math.sin(a)
    return (c[0] + x * ca - y * sa, c[1] + x * sa + y * ca)


def blade(d, c, ang, length, w0, fill):
    """Čepel od čepu ve směru ang: zúžená ke špičce."""
    pts = []
    n = 24
    for i in range(n + 1):  # horní hrana
        t = i / n
        pts.append((t * length, -w0 * (1 - t) ** 0.9 * 0.55))
    for i in range(n, -1, -1):  # dolní (ostří) – rovnější
        t = i / n
        pts.append((t * length, w0 * (1 - t) ** 1.4 * 0.45))
    d.polygon([rot(p, ang, c) for p in pts], fill=fill)


def handle(d, c, ang, dist, ro, ri, arm, fill):
    """Rameno od čepu dozadu a oko rukojeti (s otvorem)."""
    a = ang + math.pi
    hc = rot((dist, 0), a, c)
    ex = rot((dist - ro * 0.6, 0), a, c)
    d.line([c, ex], fill=fill, width=arm)
    d.ellipse((hc[0] - ro, hc[1] - ro, hc[0] + ro, hc[1] + ro), fill=fill)
    d.ellipse((hc[0] - ri, hc[1] - ri, hc[0] + ri, hc[1] + ri), fill=0)


def sparkle(d, cx, cy, r, fill, p=2.6):
    pts = []
    for i in range(160):
        t = 2 * math.pi * i / 160
        c, s = math.cos(t), math.sin(t)
        pts.append((cx + r * math.copysign(abs(c) ** p, c), cy + r * math.copysign(abs(s) ** p, s)))
    d.polygon(pts, fill=fill)


def make():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    r = int(S * 0.22)
    pad = int(S * 0.04)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + 16, S - pad, S - pad + 16), r, fill=(0, 0, 0, 130))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(20)))
    box = Image.new("L", (S, S), 0)
    ImageDraw.Draw(box).rounded_rectangle((pad, pad, S - pad, S - pad), r, fill=255)
    bg = gradient(S, S, (150, 70, 255), (52, 16, 170)).convert("RGBA")
    img.paste(bg, (0, 0), box)
    gloss = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse((-S * 0.3, -S * 0.8, S * 1.3, S * 0.40), fill=(255, 255, 255, 30))
    img.alpha_composite(Image.composite(gloss, Image.new("RGBA", (S, S), (0, 0, 0, 0)), box))

    # nůžky jako maska (bílá), osa míří doprava nahoru
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    c = (S * 0.45, S * 0.55)  # čep
    axis = math.radians(-45)
    open_ = math.radians(16)
    a1, a2 = axis - open_, axis + open_
    L, w0 = S * 0.31, S * 0.16
    hd, ro, ri, arm = S * 0.24, S * 0.105, S * 0.062, int(S * 0.06)
    # spodní polovina nůžek, pak mezera kolem horní čepele a horní polovina
    blade(d, c, a2, L, w0, 255)
    handle(d, c, a2, hd, ro, ri, arm, 255)
    gap = Image.new("L", (S, S), 0)
    blade(ImageDraw.Draw(gap), c, a1, L, w0, 255)
    m.paste(0, (0, 0), gap.filter(ImageFilter.MaxFilter(15)))
    blade(d, c, a1, L, w0, 255)
    handle(d, c, a1, hd, ro, ri, arm, 255)
    d.ellipse((c[0] - 24, c[1] - 24, c[0] + 24, c[1] + 24), fill=255)  # čep
    d.ellipse((c[0] - 10, c[1] - 10, c[0] + 10, c[1] + 10), fill=0)
    # jiskry u špiček
    sparkle(d, S * 0.775, S * 0.215, S * 0.105, 255)
    sparkle(d, S * 0.865, S * 0.385, S * 0.042, 255)

    sh = Image.new("RGBA", (S, S), (25, 5, 80, 0))
    sh.putalpha(m.point(lambda v: int(v * 0.45)).filter(ImageFilter.GaussianBlur(14)))
    img.alpha_composite(sh, (0, 12))
    white = Image.new("RGBA", (S, S), (255, 255, 255, 255))
    white.putalpha(m)
    img.alpha_composite(white)

    img.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, "src", "icon.png"))
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    img.resize((256, 256), Image.LANCZOS).save(
        os.path.join(ROOT, "build", "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("ok")


if __name__ == "__main__":
    make()
