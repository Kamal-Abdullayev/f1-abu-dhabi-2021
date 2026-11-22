"""In-lap / out-lap deltas per pit stop, and race clock offset.  Usage: python3 -I pit_probe.py <race_pack.json>"""
import json
import statistics as st
import sys

with open(sys.argv[1], encoding='utf-8') as f:
    rp = json.load(f)
lapT, cum = rp['lapT'], rp['cum']
team = {d['code']: d['team'] for d in rp['drivers']}


def hms(s):
    h, m, x = s.split(':')
    return int(h) * 3600 + int(m) * 60 + float(x)


print('code team lap dur | prev3 med | in-lap delta | out-lap delta (vs next 3 med) | sum | clock0 = tod - cum[lap] (s after 17:00)')
for p in rp['pits']:
    c, L = p['code'], p['lap']
    lt = lapT[c]
    prev = lt[max(0, L - 4):L - 1]
    nxt = lt[L + 1:L + 4]
    if len(prev) < 2 or len(nxt) < 2 or L >= len(lt):
        print(c, team[c], L, p['dur'], '(not enough laps)', 'clock0', round(hms(p['tod']) - 17 * 3600 - cum[c][L - 1], 1))
        continue
    pm, nm = st.median(prev), st.median(nxt)
    din, dout = lt[L - 1] - pm, lt[L] - nm
    print('%s %-14s L%-2d dur %.1f | prev %.2f | in %+6.2f | out %+6.2f (next %.2f) | sum %+6.2f | clock0 %.1f' % (
        c, team[c][:14], L, p['dur'], pm, din, dout, nm, din + dout, hms(p['tod']) - 17 * 3600 - cum[c][L - 1]))
