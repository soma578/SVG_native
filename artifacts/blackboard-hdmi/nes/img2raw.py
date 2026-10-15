"""Fit an image into 1280x720 (letterboxed) and write raw RGB888 bytes."""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im.thumbnail((1280, 720), Image.LANCZOS)
canvas = Image.new("RGB", (1280, 720))
canvas.paste(im, ((1280 - im.width) // 2, (720 - im.height) // 2))
open(dst, "wb").write(canvas.tobytes())
