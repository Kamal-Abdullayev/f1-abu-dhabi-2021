"""Run an Overpass (OpenStreetMap) query. Usage: python3 -I fetch_osm.py <query_file> <out_file>"""
import sys
import time
import urllib.parse
import urllib.request

qfile, out = sys.argv[1], sys.argv[2]
with open(qfile, encoding='utf-8') as f:
    q = f.read()
eps = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]
data = urllib.parse.urlencode({'data': q}).encode()
for ep in eps * 2:
    try:
        req = urllib.request.Request(ep, data=data, headers={'User-Agent': 'race-replay-fetch/1.0'})
        with urllib.request.urlopen(req, timeout=240) as r:
            b = r.read()
        if b[:1] == b'{':
            with open(out, 'wb') as f:
                f.write(b)
            print('ok', ep, len(b))
            break
        print('non-json', ep, b[:200])
    except Exception as e:  # noqa: BLE001
        print('fail', ep, repr(e)[:200])
        time.sleep(4)
else:
    raise SystemExit('all endpoints failed')
