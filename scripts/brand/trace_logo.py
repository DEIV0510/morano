"""Vectoriza el wordmark del logo oficial de Morano Europe SL.

Rectángulos: geometría medida a mano (trazo de 7 px, entrelazado).
Texto: potrace sobre el raster original ampliado 6x por palabra/color.
"""
import sys, json
sys.path.insert(0, sys.argv[1])
import numpy as np
from PIL import Image
import potrace

SRC = sys.argv[2]
OUT = sys.argv[3]
S = 6  # factor de ampliación

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.float32)

words = {
    "morano": ((430, 0, 910, 213), "navy"),
    "europe": ((930, 0, 1330, 213), "gold"),
    "sl": ((1340, 0, 1470, 213), "gray"),
}


def ink(region, kind):
    x0, y0, x1, y1 = region
    sub = a[y0:y1, x0:x1]
    if kind == "gray":
        v = 255 - sub.mean(axis=2)
    else:
        v = 255 - sub.min(axis=2)
    return v


def bez(p):
    return f"{p[0]/S:.2f} {p[1]/S:.2f}"


paths = {}
for name, (region, kind) in words.items():
    v = ink(region, kind)
    peak = np.percentile(v[v > 40], 90) if (v > 40).any() else v.max()
    img = Image.fromarray(np.clip(v / peak * 255, 0, 255).astype(np.uint8))
    big = img.resize((img.width * S, img.height * S), Image.LANCZOS)
    big = np.asarray(big.filter(__import__("PIL.ImageFilter", fromlist=["x"]).GaussianBlur(S * 0.55)))
    # potracer rellena los píxeles "oscuros" (valor bajo): la tinta debe ir en False
    bm = potrace.Bitmap(big <= 127)
    plist = bm.trace(turdsize=200, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                     alphamax=1.0, opticurve=True, opttolerance=0.2)
    x0, y0 = region[0] * S, region[1] * S
    d = []
    for curve in plist:
        sp = curve.start_point
        d.append(f"M{(sp.x + x0)/S:.2f} {(sp.y + y0)/S:.2f}")
        for seg in curve.segments:
            if seg.is_corner:
                c, e = seg.c, seg.end_point
                d.append(f"L{(c.x + x0)/S:.2f} {(c.y + y0)/S:.2f}L{(e.x + x0)/S:.2f} {(e.y + y0)/S:.2f}")
            else:
                c1, c2, e = seg.c1, seg.c2, seg.end_point
                d.append(f"C{(c1.x + x0)/S:.2f} {(c1.y + y0)/S:.2f} {(c2.x + x0)/S:.2f} {(c2.y + y0)/S:.2f} {(e.x + x0)/S:.2f} {(e.y + y0)/S:.2f}")
        d.append("Z")
    paths[name] = "".join(d)
    print(name, kind, "curvas:", len(plist))

json.dump(paths, open(OUT, "w"))
