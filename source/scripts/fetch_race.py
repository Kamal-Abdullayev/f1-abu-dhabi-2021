"""Fetch 2021 Abu Dhabi GP (season 2021, round 22) timing data from the Jolpica F1 API
(the Ergast-compatible public API). Usage: python3 -I fetch_race.py <out_dir>"""
import json
import os
import sys
import time
import urllib.request

UA = {'User-Agent': 'race-replay-fetch/1.0', 'Accept': 'application/json'}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            print('retry', attempt, url, repr(e)[:160])
            time.sleep(3 + 3 * attempt)
    raise SystemExit('failed ' + url)


out = sys.argv[1]
root = 'https://api.jolpi.ca/ergast/f1/'
base = root + '2021/22/'
singles = {
    'race.json': root + '2021/22.json',
    'results.json': base + 'results.json',
    'qualifying.json': base + 'qualifying.json',
    'pitstops.json': base + 'pitstops.json?limit=100',
    'standings_before.json': root + '2021/21/driverStandings.json',
    'standings_after.json': root + '2021/22/driverStandings.json',
    'constructors_after.json': root + '2021/22/constructorStandings.json',
}
for name, url in singles.items():
    b = get(url)
    with open(os.path.join(out, name), 'wb') as f:
        f.write(b)
    print(name, len(b))
    time.sleep(0.7)

off = 0
total = None
page = 0
while total is None or off < total:
    b = get(base + 'laps.json?limit=100&offset=%d' % off)
    j = json.loads(b)
    total = int(j['MRData']['total'])
    with open(os.path.join(out, 'laps_%02d.json' % page), 'wb') as f:
        f.write(b)
    print('laps page', page, 'offset', off, 'total', total, len(b))
    off += 100
    page += 1
    time.sleep(0.7)
print('done')
