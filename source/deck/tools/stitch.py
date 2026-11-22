# Stitch tiled screenshots into one picture.
# usage: python3 -I stitch.py OUT.jpg COLS TILE1.jpg TILE2.jpg ...   (tile files row by row)
import sys
from PIL import Image

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows))
for n, im in enumerate(ims):
    sheet.paste(im, ((n % cols) * w, (n // cols) * h))
sheet.save(out, quality=93)
print(out, sheet.size)
