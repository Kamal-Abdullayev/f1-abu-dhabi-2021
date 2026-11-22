"""Compact scenery pack for Yas Marina from the Overpass city file.
Usage: python3 -I city_pack.py <osm_city.json> <track_pack.json> <out_dir>"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

with open(sys.argv[1], encoding='utf-8') as f:
    els = json.load(f)['elements']
with open(sys.argv[2], encoding='utf-8') as f:
    tp = json.load(f)
outd = sys.argv[3]
LAT0, LON0 = tp['lat0'], tp['lon0']
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110540.0
cl = [tuple(p) for p in tp['cl']]
XMIN, XMAX, ZMIN, ZMAX = -1500, 1380, -1930, 1700


def xz(p):
    return ((p['lon'] - LON0) * KX, -(p['lat'] - LAT0) * KZ)


def dp(P, tol):
    if len(P) < 3:
        return P
    a, b = P[0], P[-1]
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz) or 1e-9
    best, bi = 0.0, 0
    for i in range(1, len(P) - 1):
        d = abs((P[i][0] - a[0]) * dz - (P[i][1] - a[1]) * dx) / L
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [a, b]
    return dp(P[:bi + 1], tol)[:-1] + dp(P[bi:], tol)


def simp_ring(P, tol):
    if len(P) > 3 and P[0] == P[-1]:
        P = P[:-1]
    if len(P) < 3:
        return P
    # split at farthest point from P[0] so DP works on a closed ring
    k = max(range(len(P)), key=lambda i: math.dist(P[0], P[i]))
    a = dp(P[:k + 1], tol)
    b = dp(P[k:] + [P[0]], tol)
    return a[:-1] + b[:-1]


def area(g):
    a = 0.0
    for i in range(len(g)):
        x1, z1 = g[i]
        x2, z2 = g[(i + 1) % len(g)]
        a += x1 * z2 - x2 * z1
    return a / 2


def flat(P):
    out = []
    for x, z in P:
        out.append(round(x * 2) / 2)
        out.append(round(z * 2) / 2)
    return out


def inwin(P, m=0):
    cx = sum(p[0] for p in P) / len(P)
    cz = sum(p[1] for p in P) / len(P)
    return XMIN - m < cx < XMAX + m and ZMIN - m < cz < ZMAX + m


def rings_of(e):
    """Outer rings of a way or multipolygon relation, as lists of (x,z)."""
    if e['type'] == 'way':
        g = [xz(p) for p in e.get('geometry', [])]
        return [g] if len(g) >= 3 else []
    segs = [[xz(p) for p in m['geometry']] for m in e.get('members', []) if m['type'] == 'way' and m.get('role', 'outer') in ('outer', '') and 'geometry' in m]
    rings = []
    while segs:
        r = segs.pop(0)
        changed = True
        while changed and math.dist(r[0], r[-1]) > 0.5:
            changed = False
            for i, s in enumerate(segs):
                if math.dist(r[-1], s[0]) < 0.5:
                    r = r + s[1:]
                elif math.dist(r[-1], s[-1]) < 0.5:
                    r = r + s[::-1][1:]
                elif math.dist(r[0], s[-1]) < 0.5:
                    r = s[:-1] + r
                elif math.dist(r[0], s[0]) < 0.5:
                    r = s[::-1][:-1] + r
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if len(r) >= 3:
            rings.append(r)
    return rings


def num(v):
    try:
        return float(str(v).split()[0].replace('m', ''))
    except Exception:  # noqa: BLE001
        return 0.0


def dtrack(p):
    return min(math.dist(p, cl[i]) for i in range(0, len(cl), 12))


pack = {'about': 'Yas Island scenery from OpenStreetMap (ODbL). x east, z south, metres, same frame as track_pack.json. Rings/polylines are flat [x0,z0,x1,z1,...] rounded to 0.5 m; rings are not closed (first point not repeated).',
        'buildings': [], 'grandstands': [], 'water': [], 'coast': [], 'piers': [], 'bridges': [], 'roads': [], 'green': [], 'sand': [], 'parking': [], 'pools': [], 'named': []}
stat = {}
for e in els:
    t = e.get('tags', {})
    nm = t.get('name:en') or t.get('name') or ''
    if 'building' in t and t['building'] not in ('no',):
        for r in rings_of(e):
            if not inwin(r):
                continue
            a = abs(area(r))
            kind = t['building']
            if a < 45 or (kind in ('carport', 'cabin', 'roof') and a < 120 and not nm):
                continue
            ring = simp_ring(r, 0.8)
            if len(ring) < 3:
                continue
            h = num(t.get('height', 0))
            lv = num(t.get('building:levels', 0))
            rec = {'h': h, 'lv': lv, 'a': round(a), 'k': kind, 'r': flat(ring)}
            if nm:
                rec['n'] = nm
            if t.get('man_made') == 'tower':
                rec['tower'] = 1
            if t.get('layer'):
                rec['layer'] = t['layer']
            if kind == 'grandstand':
                pack['grandstands'].append(rec)
            else:
                pack['buildings'].append(rec)
    elif t.get('natural') == 'water' or t.get('leisure') == 'marina' or t.get('natural') == 'bay':
        if t.get('natural') == 'bay':
            continue
        for r in rings_of(e):
            a = abs(area(r))
            if a < 300:
                continue
            ring = simp_ring(r, 1.0)
            pack['water'].append({'a': round(a), 'k': t.get('leisure') or t.get('water') or 'water', 'n': nm, 'r': flat(ring)})
    elif t.get('natural') == 'coastline':
        g = [xz(p) for p in e['geometry']]
        pack['coast'].append(flat(dp(g, 1.5)))
    elif t.get('man_made') in ('pier', 'breakwater'):
        g = [xz(p) for p in e['geometry']]
        if not inwin(g):
            continue
        closed = e['nodes'][0] == e['nodes'][-1]
        pack['piers'].append({'c': 1 if closed else 0, 'k': t['man_made'], 'p': flat(simp_ring(g, 0.5) if closed else dp(g, 0.5))})
    elif t.get('man_made') == 'bridge' or (t.get('bridge') == 'yes' and t.get('highway') in ('unclassified', 'secondary', 'tertiary', 'footway', 'service')):
        g = [xz(p) for p in e['geometry']]
        if dtrack(g[len(g) // 2]) > 260:
            continue
        closed = e['nodes'][0] == e['nodes'][-1]
        pack['bridges'].append({'c': 1 if closed else 0, 'hw': t.get('highway', ''), 'n': nm, 'p': flat(simp_ring(g, 0.5) if closed else dp(g, 0.5))})
    elif t.get('highway') in ('secondary', 'secondary_link', 'tertiary', 'unclassified', 'residential', 'service', 'pedestrian', 'motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link'):
        if t.get('tunnel') in ('yes', 'building_passage'):
            continue
        g = [xz(p) for p in e['geometry']]
        if not inwin(g, 150):
            continue
        L = sum(math.dist(g[i], g[i + 1]) for i in range(len(g) - 1))
        hw = t['highway']
        if hw == 'service' and (L < 90 or t.get('service') in ('parking_aisle', 'driveway')):
            continue
        if hw == 'pedestrian' and L < 60:
            continue
        cls = {'secondary': 2, 'secondary_link': 2, 'tertiary': 2, 'motorway': 3, 'trunk': 3, 'primary': 3, 'motorway_link': 3, 'trunk_link': 3, 'primary_link': 3,
               'unclassified': 1, 'residential': 1, 'service': 0, 'pedestrian': 0}[hw]
        pack['roads'].append([cls, 1 if t.get('bridge') == 'yes' else 0, flat(dp(g, 0.8))])
    elif t.get('landuse') in ('grass', 'greenery', 'meadow', 'forest', 'recreation_ground') or t.get('leisure') in ('park', 'garden', 'golf_course', 'pitch', 'common') or t.get('natural') in ('scrub', 'wood'):
        for r in rings_of(e):
            a = abs(area(r))
            if a < 220 or not inwin(r, 400):
                continue
            k = 'golf' if t.get('leisure') == 'golf_course' else ('pitch' if t.get('leisure') == 'pitch' else 'grass')
            pack['green'].append({'a': round(a), 'k': k, 'r': flat(simp_ring(r, 1.2 if a < 5000 else 2.5))})
    elif t.get('natural') in ('sand', 'beach'):
        for r in rings_of(e):
            a = abs(area(r))
            if a < 800 or a > 400000 or not inwin(r, 300):
                continue
            pack['sand'].append({'a': round(a), 'r': flat(simp_ring(r, 2.0))})
    elif t.get('amenity') == 'parking':
        for r in rings_of(e):
            a = abs(area(r))
            if a < 600 or not inwin(r):
                continue
            pack['parking'].append({'a': round(a), 'n': nm, 'r': flat(simp_ring(r, 1.5))})
    elif t.get('leisure') == 'swimming_pool':
        for r in rings_of(e):
            a = abs(area(r))
            if a < 120 or not inwin(r):
                continue
            pack['pools'].append({'a': round(a), 'r': flat(simp_ring(r, 0.8))})
    if nm and ('building' in t or t.get('leisure') in ('marina', 'sports_centre', 'golf_course', 'water_park', 'stadium', 'outdoor_seating') or t.get('tourism') in ('theme_park', 'hotel') or t.get('man_made') == 'tower'):
        rr = rings_of(e)
        if rr and inwin(rr[0], 200):
            g = rr[0]
            pack['named'].append({'n': nm, 'x': round(sum(p[0] for p in g) / len(g)), 'z': round(sum(p[1] for p in g) / len(g)), 'a': round(abs(area(g))),
                                  'k': t.get('building') or t.get('leisure') or t.get('tourism') or t.get('man_made')})
for k, v in pack.items():
    if isinstance(v, list):
        stat[k] = (len(v), len(json.dumps(v, separators=(',', ':'))))
print(stat)
op = os.path.join(outd, 'city_pack.json')
with open(op, 'w', encoding='utf-8') as f:
    json.dump(pack, f, separators=(',', ':'), ensure_ascii=False)
print('wrote', op, os.path.getsize(op))
print('building heights known', sum(1 for b in pack['buildings'] if b['h'] or b['lv']), 'of', len(pack['buildings']))
print('GRANDSTANDS', [(g.get('n', ''), g['a'], g['h'], g['lv']) for g in pack['grandstands']])
print('WATER', [(w['n'], w['k'], w['a']) for w in sorted(pack['water'], key=lambda w: -w['a'])][:14])
print('BRIDGES', [(b['n'], b['hw'], b['c'], len(b['p']) // 2) for b in pack['bridges']])
print('COAST pieces', [len(c) // 2 for c in pack['coast']])
# ---------------- overview picture
SC = 0.55
W, H = int((XMAX - XMIN) * SC), int((ZMAX - ZMIN) * SC)
img = Image.new('RGB', (W, H), (236, 226, 200))
dr = ImageDraw.Draw(img)


def P(x, z):
    return ((x - XMIN) * SC, (z - ZMIN) * SC)


def pl(fl):
    return [P(fl[i], fl[i + 1]) for i in range(0, len(fl), 2)]


for s in pack['sand']:
    dr.polygon(pl(s['r']), fill=(226, 212, 176))
for g in pack['green']:
    dr.polygon(pl(g['r']), fill=(150, 196, 130) if g['k'] != 'golf' else (170, 206, 150))
for w in pack['water']:
    dr.polygon(pl(w['r']), fill=(120, 170, 215))
for c in pack['coast']:
    dr.line(pl(c), fill=(20, 60, 160), width=2)
for p_ in pack['parking']:
    dr.polygon(pl(p_['r']), fill=(205, 205, 205))
for r in pack['roads']:
    dr.line(pl(r[2]), fill=(150, 150, 150) if r[0] else (185, 185, 185), width=1 + r[0])
for p_ in pack['piers']:
    if p_['c']:
        dr.polygon(pl(p_['p']), fill=(245, 245, 245))
    else:
        dr.line(pl(p_['p']), fill=(245, 245, 245), width=2)
for b in pack['buildings']:
    dr.polygon(pl(b['r']), fill=(200, 120, 90) if not b.get('n') else (170, 70, 60), outline=(90, 50, 40))
for g in pack['grandstands']:
    dr.polygon(pl(g['r']), fill=(90, 90, 200), outline=(30, 30, 120))
for b in pack['bridges']:
    if b['c']:
        dr.polygon(pl(b['p']), outline=(255, 0, 255))
    else:
        dr.line(pl(b['p']), fill=(255, 0, 255), width=3)
for a in tp['alt']:
    dr.line([P(x, z) for x, z in a['p']], fill=(110, 110, 110), width=2)
dr.line([P(x, z) for x, z in tp['pit']['p']], fill=(0, 160, 230), width=2)
dr.line([P(x, z) for x, z in cl] + [P(*cl[0])], fill=(10, 10, 10), width=3)
for n_ in pack['named']:
    if n_['a'] > 2500 or n_['k'] in ('grandstand', 'tower', 'hotel'):
        dr.text(P(n_['x'], n_['z']), n_['n'][:22], fill=(0, 0, 0))
img.save(os.path.join(outd, 'city_overview.png'))
print('png', W, H)
