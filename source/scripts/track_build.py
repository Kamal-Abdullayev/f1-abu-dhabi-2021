"""Build the Yas Marina GP centreline (2021 layout) from the OSM relation, analyse corners, draw a PNG.
Usage: python3 -I track_build.py <osm_circuit.json> <out_dir>"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

src, outd = sys.argv[1], sys.argv[2]
with open(src, encoding='utf-8') as f:
    els = json.load(f)['elements']
ways = {e['id']: e for e in els if e['type'] == 'way'}
LAT0, LON0 = 24.4715, 54.6060
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110540.0


def xz(p):
    return ((p['lon'] - LON0) * KX, -(p['lat'] - LAT0) * KZ)


def pts(wid):
    return [xz(p) for p in ways[wid]['geometry']]


GP = [168477013, 1469184731, 1469184732, 188337196, 1255169703, 1255169704]
# chain by node ids in driving direction
chain = [GP[0]]
left = set(GP[1:])
while left:
    end = ways[chain[-1]]['nodes'][-1]
    nxt = [w for w in left if ways[w]['nodes'][0] == end]
    if not nxt:
        print('CHAIN BREAK after', chain[-1], 'remaining', left)
        break
    chain.append(nxt[0])
    left.discard(nxt[0])
print('chain', chain, 'closed', ways[chain[-1]]['nodes'][-1] == ways[chain[0]]['nodes'][0])
raw = []
for w in chain:
    p = pts(w)
    raw.extend(p if not raw else p[1:])
if math.dist(raw[0], raw[-1]) < 0.01:
    raw = raw[:-1]
n = len(raw)
rawlen = sum(math.dist(raw[i], raw[(i + 1) % n]) for i in range(n))
print('raw nodes', n, 'raw length', round(rawlen, 1))
seg = sorted(math.dist(raw[i], raw[(i + 1) % n]) for i in range(n))
print('node spacing min/median/max', round(seg[0], 1), round(seg[n // 2], 1), round(seg[-1], 1))


def catmull(P, step=1.0):
    """Closed centripetal Catmull-Rom through P, sampled densely."""
    out = []
    m = len(P)
    for i in range(m):
        p0, p1, p2, p3 = P[(i - 1) % m], P[i], P[(i + 1) % m], P[(i + 2) % m]
        d = math.dist(p1, p2)
        k = max(2, int(d / step))
        t0 = 0.0
        t1 = t0 + math.dist(p0, p1) ** 0.5
        t2 = t1 + d ** 0.5
        t3 = t2 + math.dist(p2, p3) ** 0.5
        for j in range(k):
            t = t1 + (t2 - t1) * j / k

            def L(a, b, ta, tb):
                if tb - ta < 1e-9:
                    return a
                u = (t - ta) / (tb - ta)
                return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)
            a1 = L(p0, p1, t0, t1)
            a2 = L(p1, p2, t1, t2)
            a3 = L(p2, p3, t2, t3)
            b1 = L(a1, a2, t0, t2)
            b2 = L(a2, a3, t1, t3)
            out.append(L(b1, b2, t1, t2))
    return out


def resample(P, ds):
    m = len(P)
    cum = [0.0]
    for i in range(m):
        cum.append(cum[-1] + math.dist(P[i], P[(i + 1) % m]))
    total = cum[-1]
    k = int(round(total / ds))
    out = []
    j = 0
    for i in range(k):
        s = total * i / k
        while cum[j + 1] < s:
            j += 1
        a, b = P[j % m], P[(j + 1) % m]
        u = (s - cum[j]) / max(1e-9, cum[j + 1] - cum[j])
        out.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
    return out, total


dense = catmull(raw, 1.0)
cl, total = resample(dense, 2.0)
N = len(cl)
ds = total / N
print('smoothed length', round(total, 1), 'points', N, 'ds', round(ds, 3))
# signed area: x east, z south. positive => clockwise on a north-up map? compute and report
area = 0.0
for i in range(N):
    a, b = cl[i], cl[(i + 1) % N]
    area += a[0] * b[1] - b[0] * a[1]
area /= 2
print('shoelace area (x east, z south)', round(area), '=> on a north-up map the direction of travel is', 'clockwise' if area > 0 else 'anticlockwise')
hd = [math.atan2(cl[(i + 1) % N][0] - cl[i - 1][0], cl[(i + 1) % N][1] - cl[i - 1][1]) for i in range(N)]
W = 6  # smoothing half-window in points (12 m)
kap = []
for i in range(N):
    d = hd[(i + W) % N] - hd[(i - W) % N]
    while d > math.pi:
        d -= 2 * math.pi
    while d < -math.pi:
        d += 2 * math.pi
    kap.append(d / (2 * W * ds))
# with x east / z south and heading atan2(dx,dz): positive dθ = turning ... determine by sign test below
TH = 1 / 350.0
corners = []
i = 0
while i < N:
    if abs(kap[i]) > TH:
        j = i
        sg = 1 if kap[i] > 0 else -1
        while j < N and abs(kap[j]) > TH and (kap[j] > 0) == (sg > 0):
            j += 1
        ang = sum(kap[i:j]) * ds
        ap = max(range(i, j), key=lambda q: abs(kap[q]))
        corners.append([i, ap, j, sg, ang])
        i = j
    else:
        i += 1
# merge same-sign corners separated by < 30 m
merged = []
for c in corners:
    if merged and merged[-1][3] == c[3] and (c[0] - merged[-1][2]) * ds < 30:
        m0 = merged[-1]
        ap = m0[1] if abs(kap[m0[1]]) >= abs(kap[c[1]]) else c[1]
        merged[-1] = [m0[0], ap, c[2], c[3], m0[4] + c[4]]
    else:
        merged.append(c)
merged = [c for c in merged if abs(math.degrees(c[4])) >= 8]
print('CORNERS (s from way-chain start; sign + means heading angle atan2(dx,dz) increasing)')
for q, c in enumerate(merged):
    print('%2d s_in %6.0f apex %6.0f out %6.0f  sign %+d  angle %6.1f deg  minR %5.0f m  apex xz (%.0f,%.0f)' % (
        q + 1, c[0] * ds, c[1] * ds, c[2] * ds, c[3], math.degrees(c[4]), 1 / abs(kap[c[1]]), cl[c[1]][0], cl[c[1]][1]))
# straights
print('STRAIGHTS > 150 m:')
prev_out = merged[-1][2] - N
for c in merged:
    L = (c[0] - prev_out) * ds
    if L > 150:
        print('  from s %.0f to %.0f  length %.0f' % ((prev_out % N) * ds, c[0] * ds, L))
    prev_out = c[2]
with open(os.path.join(outd, 'track_raw.json'), 'w') as f:
    json.dump({'lat0': LAT0, 'lon0': LON0, 'kx': KX, 'kz': KZ, 'raw': [[round(x, 2), round(z, 2)] for x, z in raw],
               'cl2m': [[round(x, 2), round(z, 2)] for x, z in cl], 'length': total}, f)
# ---------- drawing
other = [w for w in ways if w not in GP]
allp = [p for w in ways.values() for p in [xz(g) for g in w['geometry']]]
minx = min(p[0] for p in allp) - 60
maxx = max(p[0] for p in allp) + 60
minz = min(p[1] for p in allp) - 60
maxz = max(p[1] for p in allp) + 60
SC = 1.25
Wd, Hd = int((maxx - minx) * SC), int((maxz - minz) * SC)
img = Image.new('RGB', (Wd, Hd), (250, 250, 248))
dr = ImageDraw.Draw(img)


def P(p):
    return ((p[0] - minx) * SC, (p[1] - minz) * SC)


for w in other:
    g = [P(p) for p in pts(w)]
    nm = ways[w].get('tags', {}).get('name', '')
    col = (60, 140, 220) if 'Pit' in nm else (170, 170, 170)
    if 'Kart' in nm or ways[w].get('tags', {}).get('sport') == 'karting':
        col = (210, 200, 160)
    dr.line(g, fill=col, width=3)
    mid = g[len(g) // 2]
    dr.text((mid[0] + 4, mid[1] + 2), str(w)[-4:], fill=col)
dr.line([P(p) for p in cl] + [P(cl[0])], fill=(30, 30, 30), width=4)
for s in range(0, int(total), 250):
    i = int(s / ds) % N
    p = P(cl[i])
    dr.ellipse((p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), fill=(220, 30, 30))
    dr.text((p[0] + 6, p[1] - 12), str(s), fill=(200, 0, 0))
for q, c in enumerate(merged):
    p = P(cl[c[1]])
    dr.ellipse((p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5), outline=(0, 120, 0), width=2)
    dr.text((p[0] - 22, p[1] + 6), 'c%d' % (q + 1), fill=(0, 110, 0))
p0, p1 = P(cl[0]), P(cl[15])
dr.line([p0, p1], fill=(255, 0, 255), width=7)
dr.text((10, 10), 'N up. black = GP centreline, red = metres from chain start (magenta tick = s 0, direction of travel), blue = pit lane ways, green = detected corners', fill=(0, 0, 0))
img.save(os.path.join(outd, 'track_overview.png'))
print('png', Wd, Hd)
