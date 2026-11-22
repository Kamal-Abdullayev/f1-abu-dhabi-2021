"""Project buildings near the main straight onto track distance (new s, finish line = 0 at chain 800).
Usage: python3 -I straight_probe.py <osm_city.json> <track_pack.json>"""
import json
import math
import sys

with open(sys.argv[1], encoding='utf-8') as f:
    els = json.load(f)['elements']
with open(sys.argv[2], encoding='utf-8') as f:
    tp = json.load(f)
LAT0, LON0 = tp['lat0'], tp['lon0']
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110540.0
cl = tp['cl']
N = len(cl)
ds = tp['length'] / N


def xz(p):
    return ((p['lon'] - LON0) * KX, -(p['lat'] - LAT0) * KZ)


def geom(e):
    if e['type'] == 'way':
        return [xz(p) for p in e.get('geometry', [])]
    g = []
    for m in e.get('members', []):
        if 'geometry' in m:
            g.extend(xz(p) for p in m['geometry'])
    return g


# main straight region: s from T16 exit (5059) through 0 to T1 entry (270): use signed s (negative before the line)
idx = list(range(int(4900 / ds), N)) + list(range(0, int(420 / ds)))


def proj(p):
    best = min(idx, key=lambda q: (cl[q][0] - p[0]) ** 2 + (cl[q][1] - p[1]) ** 2)
    a, b = cl[best - 1], cl[(best + 1) % N]
    t = (b[0] - a[0], b[1] - a[1])
    v = (p[0] - cl[best][0], p[1] - cl[best][1])
    lat = (t[0] * v[1] - t[1] * v[0]) / math.hypot(*t)  # + = right of travel
    s = best * ds
    if s > 2600:
        s -= tp['length']
    return s, lat


for e in els:
    t = e.get('tags', {})
    if not ('building' in t or t.get('barrier') in ('wall', 'fence') or t.get('man_made') or t.get('amenity') == 'parking' or t.get('landuse') in ('grass', 'retail') or 'leisure' in t):
        continue
    g = geom(e)
    if len(g) < 2:
        continue
    pr = [proj(p) for p in g]
    lat = [x[1] for x in pr]
    if min(abs(v) for v in lat) > 75:
        continue
    cx = sum(p[0] for p in g) / len(g)
    cz = sum(p[1] for p in g) / len(g)
    cs, clat = proj((cx, cz))
    if abs(clat) > 110 or not (-330 < cs < 400):
        continue
    ss = [x[0] for x in pr]
    key = {k: v for k, v in t.items() if k in ('name', 'building', 'barrier', 'man_made', 'amenity', 'landuse', 'leisure', 'building:levels', 'height')}
    print('s %5.0f..%5.0f  lat %5.0f..%5.0f  pts %3d  %s' % (min(ss), max(ss), min(lat), max(lat), len(g), key))
