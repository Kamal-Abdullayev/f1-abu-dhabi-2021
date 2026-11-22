# Makes a stand-alone copy of the pitch deck that opens in any browser: one page, slides stacked.
# usage (from source/deck): python3 tools/standalone.py <out_dir>
import json, os, re, shutil, sys
out = sys.argv[1]; os.makedirs(os.path.join(out, 'img'), exist_ok=True)
deck = json.load(open('project/deck.json'))
blob = {}
for line in open('assets.txt'):
    m = re.match(r'(\S+\.jpg)\s+(/_blob/\w+)', line)
    if m:
        blob[m.group(2)] = 'img/' + m.group(1); shutil.copy('img/final/' + m.group(1), os.path.join(out, 'img', m.group(1)))
fonts = ''.join('<link rel="stylesheet" href="%s">' % f['href'] for f in deck['faces'].values())
css = '''* { margin: 0 } html { background: #05070b }
body { font: 32px/1.2 sans-serif; width: 1920px; transform-origin: 0 0 }
body > section { width: 1920px !important; height: 1080px !important; overflow: hidden !important; box-sizing: border-box !important; position: relative; isolation: isolate; margin-bottom: 24px }
aside { display: none !important }
h1 { font-size: 96px; font-weight: 600 } h2 { font-size: 64px; font-weight: 600 } h3 { font-size: 44px; font-weight: 600 }
x-shape { display: block; clip-path: polygon(0 30%, 60% 30%, 60% 0, 100% 50%, 60% 100%, 60% 70%, 0 70%) }'''
late = '.bleed, .scrim-l, .scrim-b { z-index: -1 }'
body = ''
for sid in deck['order']:
    s = open('project/slides/%s.html' % sid).read()
    for k, v in blob.items(): s = s.replace(k, v)
    body += s
js = "<script>function f(){var k=innerWidth/1920;document.body.style.transform='scale('+k+')';document.documentElement.style.height=(document.body.scrollHeight*k)+'px';document.documentElement.style.overflowX='hidden'}addEventListener('resize',f);addEventListener('load',f);f()</script>"
open(os.path.join(out, 'index.html'), 'w').write('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>%s</title>%s<style>%s</style><style>%s</style><style>%s</style>%s%s' % (deck['title'], fonts, css, open('project/deck.css').read(), late, body, js))
print('wrote', out, len(deck['order']), 'slides', len(blob), 'pictures')
