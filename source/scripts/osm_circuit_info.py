"""Summarise the raceway ways/relations in the Overpass circuit file.
Usage: python3 -I osm_circuit_info.py <osm_circuit.json>"""
import json
import math
import sys

with open(sys.argv[1], encoding='utf-8') as f:
    j = json.load(f)
els = j['elements']
ways = [e for e in els if e['type'] == 'way']
rels = [e for e in els if e['type'] == 'relation']
lats = [p['lat'] for w in ways for p in w.get('geometry', [])]
lons = [p['lon'] for w in ways for p in w.get('geometry', [])]
lat0 = (min(lats) + max(lats)) / 2
lon0 = (min(lons) + max(lons)) / 2
print('ways', len(ways), 'relations', len(rels), 'bbox', min(lats), min(lons), max(lats), max(lons), 'centre', lat0, lon0)
kx = math.cos(math.radians(lat0)) * 111320.0
kz = 110540.0


def xz(p):
    return ((p['lon'] - lon0) * kx, -(p['lat'] - lat0) * kz)


def length(w):
    g = [xz(p) for p in w['geometry']]
    return sum(math.dist(g[i], g[i + 1]) for i in range(len(g) - 1))


for r in rels:
    roles = {}
    for m in r.get('members', []):
        roles[(m['type'], m.get('role', ''))] = roles.get((m['type'], m.get('role', '')), 0) + 1
    print('REL', r['id'], r.get('tags'), roles)
    wl = [m['ref'] for m in r.get('members', []) if m['type'] == 'way']
    print('   member ways', wl)
tot = 0
print('WAYS (id, len m, nodes, start xz, end xz, tags)')
for w in sorted(ways, key=lambda w: -length(w)):
    L = length(w)
    tot += L
    g = w['geometry']
    a, b = xz(g[0]), xz(g[-1])
    t = dict(w.get('tags', {}))
    t.pop('highway', None)
    print(w['id'], '%.0f' % L, len(g), '(%.0f,%.0f)' % a, '(%.0f,%.0f)' % b, 'closed' if w['nodes'][0] == w['nodes'][-1] else '', t)
print('total raceway length', round(tot))
