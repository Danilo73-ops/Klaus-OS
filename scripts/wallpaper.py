#!/usr/bin/env python3
# Python / scripts/wallpaper.py / Python 3 stdlib / Klaus OS XFCE wallpaper
"""Procedural, offline, sharp 20:9 PNG wallpaper. No third-party modules."""
import math
import os
import struct
import sys
import zlib

WIDTH, HEIGHT = 1600, 720

def png_chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data) & 0xffffffff)

def blend(r, g, b, cr, cg, cb, t):
    t = max(0.0, min(t, 1.0))
    return (r + (cr-r)*t, g + (cg-g)*t, b + (cb-b)*t)

def draw(destination):
    os.makedirs(os.path.dirname(os.path.abspath(destination)), exist_ok=True)
    compressor = zlib.compressobj(level=6)
    payload = bytearray()
    inv_w = 1.0 / WIDTH
    inv_h = 1.0 / HEIGHT
    two_pi = 2.0 * math.pi
    for iy in range(HEIGHT):
        y = iy * inv_h
        row = bytearray(1 + WIDTH * 3)
        for ix in range(WIDTH):
            x = ix * inv_w
            # Subtle space-blue gradient.
            r = 2 + 6*y + 4*x
            g = 10 + 24*y + 9*x
            b = 28 + 45*y + 15*x
            # Main Windows-11-inspired translucent ribbons.
            curve = .44 + .155 * math.sin(two_pi*(x*.83-.10))
            d = y - curve
            glow = math.exp(-((d/.135)**2)) * (.55 + .32*x)
            r,g,b = blend(r,g,b, 8, 100, 195, glow)
            highlight = math.exp(-((d/.011)**2)) * .76
            r,g,b = blend(r,g,b, 33, 222, 255, highlight)
            curve2 = .62 + .13 * math.sin(two_pi*(x*.70+.15))
            d2 = y - curve2
            glow2 = math.exp(-((d2/.11)**2)) * .62
            r,g,b = blend(r,g,b, 5, 124, 174, glow2)
            r,g,b = blend(r,g,b, 34, 237, 239, math.exp(-((d2/.009)**2))*.73)
            curve3 = .31 + .20*math.sin(two_pi*(x*.63+.29))
            d3 = y-curve3
            glow3 = math.exp(-((d3/.16)**2)) * .35
            r,g,b = blend(r,g,b, 31, 64, 178, glow3)
            r,g,b = blend(r,g,b, 74, 134, 250, math.exp(-((d3/.012)**2))*.41)
            # Colored halo to the right, keeping left desktop icons readable.
            dist = ((x-.78)/.32)**2 + ((y-.48)/.48)**2
            halo = math.exp(-3.6*dist) * .3
            r,g,b = blend(r,g,b, 18, 140, 239, halo)
            # Inset edge vignette, a glassy premium finish.
            edge = max(abs(x-.50)*1.4, abs(y-.50)*1.5)
            shade = max(0.0, (edge-.34)*.38)
            row[1+ix*3:4+ix*3] = (max(0, min(255, int(r*(1-shade)))),
                                max(0, min(255, int(g*(1-shade)))),
                                max(0, min(255, int(b*(1-shade)))))
        payload.extend(compressor.compress(row))
    payload.extend(compressor.flush())
    with open(destination, "wb") as fp:
        fp.write(b"\x89PNG\r\n\x1a\n")
        fp.write(png_chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)))
        fp.write(png_chunk(b"IDAT", bytes(payload)))
        fp.write(png_chunk(b"IEND", b""))
    print(f"[KLAUS OS] Wallpaper PNG gerado: {destination} ({WIDTH}x{HEIGHT})")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("uso: python3 wallpaper.py /caminho/wallpaper.png", file=sys.stderr)
        sys.exit(2)
    draw(sys.argv[1])
