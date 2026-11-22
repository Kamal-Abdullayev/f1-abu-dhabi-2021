"""Build the race data pack from the downloaded Jolpica files and print a summary.
Usage: python3 -I race_pack.py <dl_dir> <out_json>"""
import glob
import json
import os
import sys

dl, outp = sys.argv[1], sys.argv[2]


def load(n):
    with open(os.path.join(dl, n), encoding='utf-8') as f:
        return json.load(f)


def sec(s):
    p = s.split(':')
    v = 0.0
    for x in p:
        v = v * 60 + float(x)
    return v


race = load('race.json')['MRData']['RaceTable']['Races'][0]
print('RACE', race['raceName'], race['date'], race.get('time'), race['Circuit']['circuitName'])
res = load('results.json')['MRData']['RaceTable']['Races'][0]['Results']
qual = load('qualifying.json')['MRData']['RaceTable']['Races'][0]['QualifyingResults']
pits = load('pitstops.json')['MRData']['RaceTable']['Races'][0]['PitStops']

id2code = {}
drivers = []
for r in res:
    d = r['Driver']
    id2code[d['driverId']] = d['code']
    drivers.append({
        'id': d['driverId'], 'code': d['code'], 'num': int(r['number']),
        'first': d['givenName'], 'last': d['familyName'], 'nat': d['nationality'],
        'team': r['Constructor']['name'], 'teamId': r['Constructor']['constructorId'],
        'grid': int(r['grid']), 'pos': int(r['position']), 'posText': r['positionText'],
        'laps': int(r['laps']), 'status': r['status'], 'points': float(r['points']),
        'time': r.get('Time', {}).get('time'), 'ms': int(r['Time']['millis']) if 'Time' in r else None,
        'fl': r.get('FastestLap', {}).get('Time', {}).get('time'), 'flLap': r.get('FastestLap', {}).get('lap'),
        'flRank': r.get('FastestLap', {}).get('rank'),
    })
qmap = {}
for q in qual:
    qmap[q['Driver']['code']] = {'qpos': int(q['position']), 'q1': q.get('Q1'), 'q2': q.get('Q2'), 'q3': q.get('Q3')}
    id2code.setdefault(q['Driver']['driverId'], q['Driver']['code'])
for d in drivers:
    d.update(qmap.get(d['code'], {}))

laps = {}
total = None
count = 0
for fn in sorted(glob.glob(os.path.join(dl, 'laps_*.json'))):
    with open(fn, encoding='utf-8') as f:
        j = json.load(f)
    total = int(j['MRData']['total'])
    rs = j['MRData']['RaceTable']['Races']
    if not rs:
        continue
    for L in rs[0]['Laps']:
        n = int(L['number'])
        for t in L['Timings']:
            c = id2code[t['driverId']]
            laps.setdefault(c, {})[n] = (sec(t['time']), int(t['position']))
            count += 1
print('lap timing entries', count, 'api total', total)

lapT, lapP, cum = {}, {}, {}
for d in drivers:
    c = d['code']
    L = laps.get(c, {})
    ns = sorted(L)
    assert ns == list(range(1, len(ns) + 1)), (c, ns[:5], len(ns))
    lapT[c] = [round(L[n][0], 3) for n in ns]
    lapP[c] = [L[n][1] for n in ns]
    s = 0.0
    cu = []
    for v in lapT[c]:
        s += v
        cu.append(round(s, 3))
    cum[c] = cu

win = [d for d in drivers if d['pos'] == 1][0]
wt = cum[win['code']][-1]
print('winner', win['code'], 'sum laps', wt, 'official ms', win['ms'], 'diff', round(wt - win['ms'] / 1000, 3))
print('%-3s %-3s %-4s %-2s %-2s %-4s %-22s %-10s %-9s %-9s %s' % ('pos', 'cod', 'num', 'gr', 'qp', 'laps', 'team', 'status', 'gapCalc', 'official', 'q3/q2/q1'))
for d in sorted(drivers, key=lambda x: x['pos']):
    c = d['code']
    n = len(cum.get(c, []))
    g = round(cum[c][-1] - wt, 3) if n == 58 else None
    print('%-3s %-3s %-4s %-2s %-2s %-4s %-22s %-10s %-9s %-9s %s %s' % (
        d['pos'], c, d['num'], d['grid'], d.get('qpos'), '%d/%d' % (n, d['laps']), d['team'][:22], d['status'][:10], g, d['time'],
        d.get('q3') or d.get('q2') or d.get('q1'), d['fl']))

pl = []
for p in pits:
    c = id2code[p['driverId']]
    pl.append({'code': c, 'lap': int(p['lap']), 'stop': int(p['stop']), 'tod': p['time'], 'dur': float(p['duration']) if ':' not in p['duration'] else sec(p['duration'])})
pl.sort(key=lambda x: (x['lap'], x['tod']))
print('PIT STOPS', len(pl))
print(' '.join('%s:L%d#%d:%.1f@%s' % (p['code'], p['lap'], p['stop'], p['dur'], p['tod']) for p in pl))


def show(c, a, b):
    print(c, 'laps %d-%d' % (a, b), ' '.join('%d:%.3f(P%d)' % (i, lapT[c][i - 1], lapP[c][i - 1]) for i in range(a, min(b, len(lapT[c])) + 1)))


for c in ('VER', 'HAM', 'PER'):
    show(c, 1, 3)
    show(c, 12, 23)
    show(c, 34, 39)
    show(c, 50, 58)
print('GAP HAM-VER at line by lap (HAM cum - VER cum; negative = HAM ahead):')
print(' '.join('%d:%+.2f' % (i + 1, cum['HAM'][i] - cum['VER'][i]) for i in range(58)))
for n in (1, 2, 13, 14, 15, 20, 21, 22, 35, 36, 37, 38, 52, 53, 54, 55, 56, 57, 58):
    order = sorted([(lapP[c][n - 1], c) for c in lapP if len(lapP[c]) >= n])
    print('ORDER L%d' % n, ' '.join(c for _, c in order))
# cars on the road at the moment the leader ends laps 56, 57: progress = laps done + fraction
for n in (52, 53, 54, 55, 56, 57):
    lead = min((cum[c][n - 1], c) for c in cum if len(cum[c]) >= n)
    T = lead[0]
    road = []
    for c in cum:
        cu = cum[c]
        if not cu:
            continue
        k = 0
        while k < len(cu) and cu[k] <= T + 1e-6:
            k += 1
        if k >= len(cu):
            if cu[-1] <= T + 1e-6 and len(cu) < 58:
                continue
            frac = 0.0
        else:
            st = cu[k - 1] if k else 0.0
            frac = (T - st) / (cu[k] - st)
        road.append((frac if frac > 0 else 1.0, k, c))
    road.sort(key=lambda x: -x[0])
    print('ROAD when leader %s ends L%d (t=%.1f):' % (lead[1], n, T), ' '.join('%s(%d,%.3f)' % (c, k, fr) for fr, k, c in road))
print('LAP 53-58 all:')
for c in sorted(lapT, key=lambda c: -len(lapT[c])):
    if len(lapT[c]) >= 53:
        print(c, ' '.join('%.3f' % v for v in lapT[c][52:]), '| cum57 %.3f' % cum[c][56] if len(cum[c]) >= 57 else '')
print('LAP 34-38 all:')
for c in sorted(lapT, key=lambda c: -len(lapT[c])):
    if len(lapT[c]) >= 34:
        print(c, ' '.join('%.3f' % v for v in lapT[c][33:38]))
print('fastest laps:', sorted((min(v), c, v.index(min(v)) + 1) for c, v in lapT.items() if v)[:6])
st0 = load('standings_before.json')['MRData']['StandingsTable']['StandingsLists'][0]['DriverStandings'][:4]
st1 = load('driverStandings.json')['MRData']['StandingsTable']['StandingsLists'][0]['DriverStandings'][:4]
cs = load('constructorStandings.json')['MRData']['StandingsTable']['StandingsLists'][0]['ConstructorStandings'][:3]
print('before', [(s['Driver']['code'], s['points'], s['wins']) for s in st0])
print('after', [(s['Driver']['code'], s['points'], s['wins']) for s in st1])
print('constructors', [(s['Constructor']['name'], s['points']) for s in cs])
pack = {'race': {'name': race['raceName'], 'date': race['date'], 'timeUTC': race.get('time'), 'circuit': race['Circuit']['circuitName'], 'laps': 58},
        'drivers': sorted(drivers, key=lambda x: x['pos']), 'lapT': lapT, 'lapP': lapP, 'cum': cum, 'pits': pl,
        'standingsBefore': [(s['Driver']['code'], float(s['points']), int(s['wins'])) for s in st0],
        'standingsAfter': [(s['Driver']['code'], float(s['points']), int(s['wins'])) for s in st1],
        'constructors': [(s['Constructor']['name'], float(s['points'])) for s in cs]}
with open(outp, 'w', encoding='utf-8') as f:
    json.dump(pack, f, separators=(',', ':'))
print('wrote', outp, os.path.getsize(outp))
