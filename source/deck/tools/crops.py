# Cuts the stitched screenshots to the exact boxes the slides use (Slides ignores object-position,
# so each picture is cropped here to its box's aspect ratio). usage: python3 -I crops.py
from PIL import Image
import os
os.makedirs('img/final', exist_ok=True)
def cut(src, box, size, out, q=88):
    im = Image.open('img/raw_%s.jpg' % src).convert('RGB')
    if box: im = im.crop(box)
    if size and im.size != size: im = im.resize(size, Image.LANCZOS)
    im.save('img/final/%s.jpg' % out, quality=q, optimize=True); print(out, im.size, os.path.getsize('img/final/%s.jpg' % out)//1024, 'KB')
cut('hero',      (0, 120, 2133, 1320),  (1920, 1080), 'cover')
cut('fireworks', None,                  (1920, 1080), 'close')
cut('line',      None,                  (1920, 1080), 'moment')
cut('hotel',     (180, 0, 1417, 900),   None,         'what')        # 1237x900 -> box 880x640
cut('pit',       (0, 0, 1237, 900),     None,         'pit')         # 1237x900 -> box 880x640
cut('golden',    (240, 100, 1400, 752), (784, 441),   'cam_map')
cut('chase',     None,                  (784, 441),   'cam_chase')
cut('tv',        None,                  (784, 441),   'cam_tv')
cut('approach',  None,                  (784, 441),   'cam_dir')
cut('car2',      None,                  None,         'car')         # 1600x900 -> box 1040x585
cut('grid',      (800, 0, 1600, 450),   None,         'grid')        # 800x450 -> box 560x315
cut('golden',    None,                  None,         'golden')      # 1600x900 -> box 816x459
cut('night',     None,                  None,         'night')
cut('dash',      None,                  None,         'dash', 92)    # 1600x900 -> box 1088x612
cut('phone',     None,                  None,         'phone', 92)   # 750x1624 -> box 342x740
names = ['cover','close','moment','what','pit','cam_map','cam_chase','cam_tv','cam_dir','car','grid','golden','night','dash','phone']
W, H, cols = 480, 300, 4
sheet = Image.new('RGB', (W*cols, H*((len(names)+cols-1)//cols)), (30, 30, 30))
for n, nm in enumerate(names):
    im = Image.open('img/final/%s.jpg' % nm); im.thumbnail((W-8, H-8)); sheet.paste(im, ((n % cols)*W + 4, (n//cols)*H + 4))
sheet.save('img/_final_contact.jpg', quality=82)
