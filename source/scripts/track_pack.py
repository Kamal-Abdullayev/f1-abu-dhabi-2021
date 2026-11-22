"""Final track pack: s=0 at the finish line, official corner numbers, pit lane path, alt tarmac ways, PNG.
Usage: python3 -I track_pack.py <osm_circuit.json> <track_raw.json> <out_dir> <S0 chain metres>"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

circ, rawp, outd, S0 = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
with open(circ, encoding='utf-8') as f:
    els = json.load(f)['elements']
with open(rawp, encoding='utf-8') as f:
    tr = json.load(f)
ways = {e['id']: e for e in els if e['type'] == 'way'}
LAT0, LON0, KX, KZ = tr['lat0'], tr['lon0'], tr['kx'], tr['kz']


def xz(p):
    return ((p['lon'] - LON0) * KX, -(p['lat'] - LAT0) * KZ)


def pts(wid):
    return [xz(p) for p in ways[wid]['geometry']]


def catmull_open(P, step=1.0):
    out = []
    m = len(P)
    for i in range(m - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, m - 1)]
        d = math.dist(p1, p2)
        k = max(2, int(d / step))
        t0 = 0.0
        t1 = t0 + max(math.dist(p0, p1), 1e-6) ** 0.5
        t2 = t1 + max(d, 1e-6) ** 0.5
        t3 = t2 + max(math.dist(p2, p3), 1e-6) ** 0.5
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
            out.append(L(L(a1, a2, t0, t2), L(a2, a3, t1, t3), t1, t2))
    out.append(P[-1])
    return out


def resample_open(P, ds):
    cum = [0.0]
    for i in range(len(P) - 1):
        cum.append(cum[-1] + math.dist(P[i], P[i + 1]))
    total = cum[-1]
    k = int(round(total / ds))
    out = []
    j = 0
    for i in range(k + 1):
        s = total * i / k
        while j < len(P) - 2 and cum[j + 1] < s:
            j += 1
        a, b = P[j], P[j + 1]
        u = (s - cum[j]) / max(1e-9, cum[j + 1] - cum[j])
        out.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
    return out, total


cl0 = [tuple(p) for p in tr['cl2m']]
N = len(cl0)
total = tr['length']
ds = total / N
i0 = int(round(S0 / ds)) % N
cl = cl0[i0:] + cl0[:i0]
hd = [math.atan2(cl[(i + 1) % N][0] - cl[i - 1][0], cl[(i + 1) % N][1] - cl[i - 1][1]) for i in range(N)]
W = 6
kap = []
for i in range(N):
    d = hd[(i + W) % N] - hd[(i - W) % N]
    while d > math.pi:
        d -= 2 * math.pi
    while d < -math.pi:
        d += 2 * math.pi
    kap.append(d / (2 * W * ds))
TH = 1 / 350.0
cs = []
i = 0
while i < N:
    if abs(kap[i]) > TH:
        j = i
        sg = kap[i] > 0
        while j < N and abs(kap[j]) > TH and (kap[j] > 0) == sg:
            j += 1
        cs.append([i, max(range(i, j), key=lambda q: abs(kap[q])), j, 1 if sg else -1, sum(kap[i:j]) * ds])
        i = j
    else:
        i += 1
mg = []
for c in cs:
    if mg and mg[-1][3] == c[3] and (c[0] - mg[-1][2]) * ds < 30:
        m0 = mg[-1]
        ap = m0[1] if abs(kap[m0[1]]) >= abs(kap[c[1]]) else c[1]
        mg[-1] = [m0[0], ap, c[2], c[3], m0[4] + c[4]]
    else:
        mg.append(c)
mg = [c for c in mg if abs(math.degrees(c[4])) >= 8]
assert len(mg) == 16, len(mg)
NOTES = {1: 'left 90 at the end of the main straight; pit exit tunnel passes underneath', 2: 'fast left', 3: 'fast right; pit exit road rejoins here on the left',
         4: 'fast left kink', 5: 'North hairpin (left) - last-lap pass happened here', 6: 'chicane left - lap 1 incident; DRS zone 1 ends',
         7: 'chicane right', 8: 'left kink onto the second straight', 9: 'Marsa corner: long banked left - Giovinazzi stopped here',
         10: 'right kink', 11: 'right', 12: 'tight right before the hotel', 13: 'left, then under the hotel bridge',
         14: 'left after the hotel - Latifi crashed at the exit (outside barrier)', 15: 'fast right', 16: 'final corner (right); pit entry is on the inside'}
corners = []
for q, c in enumerate(mg):
    corners.append({'n': q + 1, 'dir': 'L' if c[3] > 0 else 'R', 'sIn': round(c[0] * ds), 'sApex': round(c[1] * ds), 'sOut': round(c[2] * ds),
                    'angle': round(abs(math.degrees(c[4]))), 'minR': round(1 / abs(kap[c[1]])), 'x': round(cl[c[1]][0], 1), 'z': round(cl[c[1]][1], 1), 'note': NOTES[q + 1]})
for c in corners:
    print('T%-2d %s sIn %4d apex %4d out %4d  %3d deg  R %3d m  (%6.1f,%6.1f)  %s' % (c['n'], c['dir'], c['sIn'], c['sApex'], c['sOut'], c['angle'], c['minR'], c['x'], c['z'], c['note']))


def nearest(p, P, step=1):
    best = min(range(0, len(P), step), key=lambda q: (P[q][0] - p[0]) ** 2 + (P[q][1] - p[1]) ** 2)
    return best, math.dist(p, P[best])


# pit lane
PIT = [176695254, 176695255, 176695253]
for a, b in zip(PIT, PIT[1:]):
    assert ways[a]['nodes'][-1] == ways[b]['nodes'][0], (a, b)
praw = []
lens = []
for w in PIT:
    p = pts(w)
    lens.append(sum(math.dist(p[i], p[i + 1]) for i in range(len(p) - 1)))
    praw.extend(p if not praw else p[1:])
pit, plen = resample_open(catmull_open(praw, 1.0), 2.0)
pds = plen / (len(pit) - 1)
ie, de = nearest(pit[0], cl)
ix, dx = nearest(pit[-1], cl)
il, dl = nearest(cl[0], pit)
print('pit path length %.0f (lane %.0f + tunnel %.0f + exit road %.0f), points %d' % (plen, lens[0], lens[1], lens[2], len(pit)))
print('pit entry leaves track at s=%.0f (dist %.1f m), rejoins at s=%.0f (dist %.1f m)' % (ie * ds, de, ix * ds, dx))
print('timing line crosses pit lane at pit distance %.0f m (lateral offset from track centre %.1f m)' % (il * pds, dl))
# distance from pit path to track along the lane, to find the parallel working lane
prof = []
for k in range(0, len(pit), 10):
    j, d = nearest(pit[k], cl, 2)
    prof.append((round(k * pds), round(j * ds), round(d, 1)))
print('pit profile (pit dist, nearest track s, lateral dist):', prof)
# side of pit lane relative to travel at the line
t = (cl[1][0] - cl[-1][0], cl[1][1] - cl[-1][1])
v = (pit[il][0] - cl[0][0], pit[il][1] - cl[0][1])
cross = t[0] * v[1] - t[1] * v[0]
print('heading at line (deg from +z toward +x):', round(math.degrees(hd[0]), 1), ' pit lane is on the', 'RIGHT' if cross > 0 else 'LEFT', 'of travel (x east, z south; cross=%.1f)' % cross)
GPW = {168477013, 1469184731, 1469184732, 188337196, 1255169703, 1255169704}
alt = []
for wid, w in ways.items():
    tg = w.get('tags', {})
    if wid in GPW or wid in PIT or tg.get('sport') == 'karting' or 'Kart' in tg.get('name', ''):
        continue
    p = pts(wid)
    L = sum(math.dist(p[i], p[i + 1]) for i in range(len(p) - 1))
    alt.append({'id': wid, 'name': tg.get('name', ''), 'len': round(L), 'p': [[round(x, 1), round(z, 1)] for x, z in p]})
pack = {
    'about': 'Yas Marina Circuit, 2021 Grand Prix layout. Source: OpenStreetMap (ODbL). x east, z south, metres. cl is closed, 2 m spacing, index 0 = finish line, order = driving direction (anticlockwise on a north-up map).',
    'lat0': LAT0, 'lon0': LON0, 'length': round(total, 1), 'officialLength': 5281, 'ds': round(ds, 4),
    'cl': [[round(x, 2), round(z, 2)] for x, z in cl], 'corners': corners,
    'pit': {'p': [[round(x, 2), round(z, 2)] for x, z in pit], 'ds': round(pds, 4), 'length': round(plen, 1), 'sEntry': round(ie * ds), 'sExit': round(ix * ds),
            'lineAt': round(il * pds), 'laneEnd': round(lens[0]), 'tunnel': [round(lens[0]), round(lens[0] + lens[1])], 'side': 'right'},
    'alt': alt,
}
with open(os.path.join(outd, 'track_pack.json'), 'w') as f:
    json.dump(pack, f, separators=(',', ':'))
print('wrote track_pack.json', os.path.getsize(os.path.join(outd, 'track_pack.json')))
allp = cl + pit
minx = min(p[0] for p in allp) - 80
maxx = max(p[0] for p in allp) + 80
minz = min(p[1] for p in allp) - 80
maxz = max(p[1] for p in allp) + 80
SC = 1.3
img = Image.new('RGB', (int((maxx - minx) * SC), int((maxz - minz) * SC)), (250, 250, 248))
dr = ImageDraw.Draw(img)


def P(p):
    return ((p[0] - minx) * SC, (p[1] - minz) * SC)


for a in alt:
    dr.line([P(p) for p in a['p']], fill=(190, 190, 190), width=2)
dr.line([P(p) for p in pit], fill=(60, 140, 220), width=3)
k0, k1 = int(lens[0] / pds), int((lens[0] + lens[1]) / pds)
dr.line([P(p) for p in pit[k0:k1]], fill=(150, 60, 200), width=5)
dr.line([P(p) for p in cl] + [P(cl[0])], fill=(30, 30, 30), width=4)
for s in range(0, int(total), 500):
    p = P(cl[int(s / ds) % N])
    dr.ellipse((p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3), fill=(220, 30, 30))
    dr.text((p[0] + 5, p[1] + 3), str(s), fill=(200, 0, 0))
for c in corners:
    p = P(cl[int(c['sApex'] / ds)])
    dr.ellipse((p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6), outline=(0, 120, 0), width=2)
    dr.text((p[0] - 26, p[1] - 16), 'T%d' % c['n'], fill=(0, 110, 0))
p0 = P(cl[0])
nx, nz = math.cos(hd[0]), -math.sin(hd[0])
dr.line([(p0[0] - nx * 18, p0[1] - nz * 18), (p0[0] + nx * 18, p0[1] + nz * 18)], fill=(255, 0, 255), width=5)
dr.text((p0[0] + 8, p0[1] - 26), 'FINISH s=0', fill=(200, 0, 200))
pl = P(pit[il])
dr.ellipse((pl[0] - 5, pl[1] - 5, pl[0] + 5, pl[1] + 5), fill=(255, 0, 255))
img.save(os.path.join(outd, 'track_final.png'))
