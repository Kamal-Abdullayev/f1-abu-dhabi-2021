"""Summarise the Overpass city file: tag counts, named features, features near the main straight.
Usage: python3 -I city_info.py <osm_city.json> <track_raw.json>"""
import json
import math
import sys
from collections import Counter

with open(sys.argv[1], encoding='utf-8') as f:
    els = json.load(f)['elements']
with open(sys.argv[2], encoding='utf-8') as f:
    tr = json.load(f)
LAT0, LON0, KX, KZ = tr['lat0'], tr['lon0'], tr['kx'], tr['kz']
cl = tr['cl2m']


def xz(p):
    return ((p['lon'] - LON0) * KX, -(p['lat'] - LAT0) * KZ)


def geom(e):
    if e['type'] == 'way':
        return [xz(p) for p in e.get('geometry', [])]
    g = []
    for m in e.get('members', []):
        if m.get('role') in ('outer', '') and 'geometry' in m:
            g.extend(xz(p) for p in m['geometry'])
    return g


def area(g):
    a = 0.0
    for i in range(len(g)):
        x1, z1 = g[i]
        x2, z2 = g[(i + 1) % len(g)]
        a += x1 * z2 - x2 * z1
    return abs(a) / 2


def cen(g):
    return (sum(p[0] for p in g) / len(g), sum(p[1] for p in g) / len(g))


print('elements', len(els), Counter(e['type'] for e in els))
keys = Counter()
for e in els:
    t = e.get('tags', {})
    for k in ('building', 'natural', 'waterway', 'leisure', 'man_made', 'highway', 'landuse', 'tourism', 'amenity', 'barrier', 'area:highway', 'sport', 'bridge', 'tunnel'):
        if k in t:
            keys[(k, t[k])] += 1
for (k, v), c in sorted(keys.items(), key=lambda x: (-x[1])):
    if c >= 3 or k in ('natural', 'man_made', 'tourism', 'leisure', 'waterway'):
        print('  %-14s %-22s %d' % (k, v, c))
print('NAMED (name, main tag, centre x,z, area m2, extra)')
seen = set()
rows = []
for e in els:
    t = e.get('tags', {})
    nm = t.get('name:en') or t.get('name')
    if not nm:
        continue
    g = geom(e)
    if not g:
        continue
    main = next(('%s=%s' % (k, t[k]) for k in ('building', 'leisure', 'tourism', 'man_made', 'natural', 'amenity', 'landuse', 'highway', 'barrier', 'sport') if k in t), '')
    if main.startswith('highway'):
        key = (nm, main)
        if key in seen:
            continue
        seen.add(key)
    c = cen(g)
    rows.append((nm, main, c, area(g) if g[0] == g[-1] or e['type'] == 'relation' else 0, {k: t[k] for k in ('height', 'building:levels', 'layer', 'bridge', 'tunnel', 'capacity') if k in t}))
for r in sorted(rows, key=lambda r: r[0]):
    print('  %-48s %-26s (%5.0f,%5.0f) %7.0f %s' % (r[0][:48], r[1][:26], r[2][0], r[2][1], r[3], r[4] or ''))
# features near the main straight (chain s 576..1070) and bridges/tunnels/towers anywhere near the track
N = len(cl)
ds = tr['length'] / N
ms = [cl[i] for i in range(int(560 / ds), int(1100 / ds))]


def dmin(p, P):
    return min(math.dist(p, q) for q in P)


print('NEAR MAIN STRAIGHT (<70 m), non-road:')
for e in els:
    t = e.get('tags', {})
    if 'highway' in t and t['highway'] in ('footway', 'service', 'pedestrian', 'residential'):
        continue
    g = geom(e)
    if not g:
        continue
    c = cen(g)
    d = dmin(c, ms)
    if d < 70:
        i = min(range(len(ms)), key=lambda q: math.dist(c, ms[q]))
        tt = {k: v for k, v in t.items() if not k.startswith('name:') and k not in ('source', 'wikidata', 'wikipedia')}
        print('  s~%4.0f d %3.0f  c(%5.0f,%5.0f) area %6.0f  %s' % (560 + i * ds, d, c[0], c[1], area(g) if g[0] == g[-1] else 0, tt))
print('BRIDGES / TUNNELS / TOWERS / LAYERED:')
for e in els:
    t = e.get('tags', {})
    if not ('bridge' in t or 'tunnel' in t or t.get('man_made') in ('tower', 'mast', 'bridge') or 'covered' in t):
        continue
    g = geom(e)
    if not g:
        continue
    c = cen(g)
    if dmin(c, cl[::10]) < 150:
        tt = {k: v for k, v in t.items() if not k.startswith('name:')}
        L = sum(math.dist(g[i], g[i + 1]) for i in range(len(g) - 1))
        print('  c(%5.0f,%5.0f) len %4.0f  %s' % (c[0], c[1], L, tt))
hs = [e for e in els if 'building' in e.get('tags', {})]
print('buildings', len(hs), 'with height', sum(1 for e in hs if 'height' in e['tags']), 'with levels', sum(1 for e in hs if 'building:levels' in e['tags']))
big = sorted(((area(geom(e)), e) for e in hs if geom(e)), key=lambda x: -x[0])[:40]
print('LARGEST BUILDINGS:')
for a, e in big:
    t = e['tags']
    c = cen(geom(e))
    print('  %7.0f m2 (%5.0f,%5.0f) %s' % (a, c[0], c[1], {k: v for k, v in t.items() if k in ('name', 'building', 'height', 'building:levels', 'leisure', 'tourism', 'amenity')}))
