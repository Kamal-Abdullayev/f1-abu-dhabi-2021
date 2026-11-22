"""Scan the final page for outside links, images, sponsor words and the required notes.
Usage: python3 -I final_scan.py <abudhabi2021.html>"""
import re
import sys

s = open(sys.argv[1], encoding='utf-8').read()
print('bytes', len(s))
print('script src', re.findall(r'<script[^>]*src="([^"]+)"', s))
print('urls', sorted(set(re.findall(r'https?://[^\s"\'<>)\\]+', s))))
for k in ['<img', 'data:image', '.svg', '.png', '.jpg', '.woff', '@import', '<link', 'fetch(', 'XMLHttpRequest', 'localStorage', 'document.cookie']:
    print(repr(k), s.count(k))
# code and visible text without the map-data constant (place names in the OpenStreetMap data are not displayed)
code = re.sub(r'const CITY=.*?;\n', 'const CITY={};\n', s, count=1, flags=re.S)
print('bytes without CITY constant', len(code))
brands = ['Rolex', 'Heineken', 'Pirelli', 'Aramco', 'Emirates', 'Etihad', 'DHL', 'Qatar', 'TAG Heuer', 'Oracle', 'Petronas', 'Shell', 'Santander', 'Mastercard',
          'Marlboro', 'Crypto', 'AWS', 'Lenovo', 'INEOS', 'Ineos', 'Mobil', 'Castrol', 'Gulf', 'Google', 'Monster', 'Puma', 'Tommy', 'BWT', 'Cognizant',
          'Uralkali', 'Orlen', 'Mission Winnow', 'Vuse', 'Dell', 'Splunk', 'TeamViewer', 'Velo', 'Honda', 'Mercedes-AMG', 'Renault', 'Hilton', 'IKEA',
          'Ferrari World', 'W Abu Dhabi', 'Yas Mall', 'Formula 1', 'FIA', 'F1 ', 'Red Bull', 'ADNOC', 'Aston Martin Cognizant', 'Sky', 'Liberty']
for b in brands:
    idx = [m.start() for m in re.finditer(re.escape(b), code)]
    if idx:
        ex = code[max(0, idx[0] - 50):idx[0] + 60].replace('\n', ' ')
        print('WORD %-14s x%-3d | %s' % (b, len(idx), ex))
for k in ['Unofficial fan-made reconstruction', 'Not affiliated with Formula 1', 'OpenStreetMap contributors', 'CC BY-NC-SA 4.0', 'non-commercial', 'RaceFans', 'estimated']:
    print('NOTE', repr(k), code.count(k))
print('title', re.findall(r'<title>(.*?)</title>', s))
