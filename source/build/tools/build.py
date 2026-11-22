"""Assemble a page from a shell and script parts.
Usage: python3 -I build.py <out.html> <shell.html> <part.js> [<part.js> ...]

- The shell must contain the marker <!--SCRIPTS--> ; it is replaced by the three.js tag and one inline script.
- The parts are concatenated in the order given inside one IIFE with 'use strict'.
- The concatenated script is also written to build/_check/<name>.js so it can be syntax-checked:
      node --check build/_check/<name>.js
Each part can also be built into its own test page with its own part list."""
import os
import sys

if len(sys.argv) < 4:
    raise SystemExit(__doc__)
out, shell, parts = sys.argv[1], sys.argv[2], sys.argv[3:]
THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
src = ["(function(){\n'use strict';\nif(!window.THREE){var e_=document.getElementById('err');if(e_)e_.style.display='grid';return;}\n"]
for p in parts:
    with open(p, encoding='utf-8') as f:
        code = f.read()
    src.append('\n/* ======== %s ======== */\n' % os.path.basename(p))
    src.append(code)
    src.append('\n')
src.append('})();\n')
js = ''.join(src)
if '</script' in js.lower():
    raise SystemExit('a part contains the text </script ; escape it')
with open(shell, encoding='utf-8') as f:
    html = f.read()
if '<!--SCRIPTS-->' not in html:
    raise SystemExit('shell has no <!--SCRIPTS--> marker')
html = html.replace('<!--SCRIPTS-->', '<script src="%s"></script>\n<script>\n%s</script>' % (THREE, js))
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
chk = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_check')
os.makedirs(chk, exist_ok=True)
cj = os.path.join(chk, os.path.splitext(os.path.basename(out))[0] + '.js')
with open(cj, 'w', encoding='utf-8') as f:
    f.write(js)
print('wrote', out, len(html), 'bytes from', len(parts), 'parts; check with: node --check', cj)
