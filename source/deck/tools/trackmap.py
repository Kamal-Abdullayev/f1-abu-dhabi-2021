# Builds the circuit outline for the deck's "final lap" slide from the project's track data
# (OpenStreetMap, ODbL): an SVG path in the same orientation as the replay's home view.
# usage: python3 -I trackmap.py   -> prints the path data and marker positions, writes img/_track_preview.png
import json, math
from PIL import Image, ImageDraw
T = json.load(open('../out/track_pack.json'))
cl = T['cl']; L = T['length']
YAW, PITCH = 1.2, 0.86                        # the replay's home view: screen right = (cos yaw, -sin yaw), up = (-sin yaw, -cos yaw)
def proj(p): return (p[0]*math.cos(YAW) - p[1]*math.sin(YAW), (p[0]*math.sin(YAW) + p[1]*math.cos(YAW))*math.sin(PITCH))
P = [proj(p) for p in cl]
xs = [p[0] for p in P]; ys = [p[1] for p in P]
W, H, PAD = 960.0, 560.0, 44.0
sc = min((W-2*PAD)/(max(xs)-min(xs)), (H-2*PAD)/(max(ys)-min(ys)))
ox = (W - sc*(max(xs)-min(xs)))/2 - sc*min(xs); oy = (H - sc*(max(ys)-min(ys)))/2 - sc*min(ys)
def scr(p): q = proj(p); return (q[0]*sc+ox, q[1]*sc+oy)
S = [scr(p) for p in cl]
# Douglas-Peucker on the closed line (open it at the start point)
def dp(pts, eps):
    keep = [False]*len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts)-1)]
    while st:
        a, b = st.pop()
        ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx-ax, by-ay; n = math.hypot(dx, dy) or 1e-9
        m, mi = 0, -1
        for i in range(a+1, b):
            d = abs((pts[i][0]-ax)*dy - (pts[i][1]-ay)*dx)/n
            if d > m: m, mi = d, i
        if m > eps and mi > 0:
            keep[mi] = True; st.append((a, mi)); st.append((mi, b))
    return [i for i, k in enumerate(keep) if k]
half = len(S)//2
i1 = dp(S[:half+1], 0.6); i2 = [half+i for i in dp(S[half:] + [S[0]], 0.6)]
idx = i1 + i2[1:]
SS = S + [S[0]]
pts = [SS[i] for i in idx]
print('points', len(pts), 'scale px/m', round(sc, 4), 'size', W, H)
x0, y0 = pts[0]
absd = 'M' + ' L'.join('%.1f %.1f' % p for p in pts) + ' Z'
reld = 'M0 0 L' + ' L'.join('%.1f %.1f' % (p[0]-x0, p[1]-y0) for p in pts[1:])
print('START', '%.1f %.1f' % (x0, y0))
print('ABS', absd)
print('REL', reld)
# the chaser's rest point: 14 px before the line along the track, and its path (line -> ... -> rest point)
def at(s):
    i = int((s % L)/T['ds']) % len(S); return S[i]
back = 26/0.5924   # about 26 px along the main straight
q = at(L - back)
cut = [p for p, i in zip(pts, idx) if i*T['ds'] < L - back] + [q]
print('REST2', '%.1f %.1f' % q)
print('REL2', 'M%.1f %.1f L' % (x0-q[0], y0-q[1]) + ' L'.join('%.1f %.1f' % (p[0]-q[0], p[1]-q[1]) for p in cut[1:]))
for c in T['corners']:
    a = at(c['sApex']); print('T%-2d s=%4d frac=%.3f  x=%.0f y=%.0f  %s' % (c['n'], c['sApex'], c['sApex']/L, a[0], a[1], c.get('note', '')[:50]))
im = Image.new('RGB', (int(W), int(H)), (11, 14, 20)); d = ImageDraw.Draw(im)
d.line(pts, fill=(242, 239, 232), width=5)
for c in T['corners']:
    a = at(c['sApex']); d.ellipse([a[0]-6, a[1]-6, a[0]+6, a[1]+6], outline=(255, 59, 47)); d.text((a[0]+8, a[1]-6), str(c['n']), fill=(246, 185, 59))
d.ellipse([x0-5, y0-5, x0+5, y0+5], fill=(255, 59, 47))
a = at(100); d.text((a[0], a[1]+8), '>dir', fill=(120, 200, 120))
im.save('img/_track_preview.png')

# timing of the two dots: both move at steady speed along the drawn line; the chaser starts B seconds later
# and its duration is set so that it draws level 16 m before the Turn 5 apex, as in the replay
def plen(ps): return sum(math.hypot(ps[i+1][0]-ps[i][0], ps[i+1][1]-ps[i][1]) for i in range(len(ps)-1))
Ltot = plen(pts); LH = plen(cut)
i5 = int((1372-16)/T['ds'])
d5 = plen([SS[i] for i in idx if i <= i5] + [S[i5]])
DH, B = 9.0, 0.1
DV = (DH*d5/LH - B)*Ltot/d5
print('LEN total %.1f leader %.1f to-pass %.1f frac %.4f' % (Ltot, LH, d5, d5/Ltot))
print('TIMING leader dur %.2f s begin 0 ; chaser begin %.2f s dur %.2f s ; chaser finishes at %.2f s' % (DH, B, DV, B+DV))
