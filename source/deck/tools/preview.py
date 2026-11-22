# Local check pages for the deck: joins the deck's CSS and slide files, four slides to a page, with the
# uploaded pictures swapped for their local copies. Check only; nothing here is published.
# usage: python3 -I preview.py   -> _preview_1.html ... in the deck folder
import json, re
deck = json.load(open('project/deck.json'))
blob = {}
for line in open('assets.txt'):
    m = re.match(r'(\S+\.jpg)\s+(/_blob/\w+)', line)
    if m: blob[m.group(2)] = 'img/final/' + m.group(1)
fonts = ''.join('<link rel="stylesheet" href="%s">' % f['href'] for f in deck['faces'].values())
css = '''* { margin: 0 }
body { font: 32px/1.2 sans-serif; background: #333; display: grid; grid-template-columns: 640px 640px; }
body > section { width: 1920px !important; height: 1080px !important; overflow: hidden !important; box-sizing: border-box !important; position: relative; isolation: isolate; zoom: 0.33333; }
section[hidden], aside, noscript { display: none !important }
h1 { font-size: 96px; font-weight: 600 } h2 { font-size: 64px; font-weight: 600 } h3 { font-size: 44px; font-weight: 600 }
p, li, h1, h2, h3, td, th { overflow-wrap: break-word; text-wrap: pretty }
x-shape, x-icon, x-embed { display: block }'''
late = '.bleed, .scrim-l, .scrim-b { z-index: -1 }'
order = deck['order']
for n in range(0, len(order), 4):
    body = ''
    for sid in order[n:n+4]:
        s = open('project/slides/%s.html' % sid).read()
        for k, v in blob.items(): s = s.replace(k, v)
        body += s
    open('_preview_%d.html' % (n//4 + 1), 'w').write('<!doctype html><meta charset="utf-8"><title>deck check %d</title>%s<style>%s</style><link rel="stylesheet" href="project/deck.css"><style>%s</style>%s' % (n//4 + 1, fonts, css, late, body))
    print('_preview_%d.html' % (n//4 + 1), order[n:n+4])

# one page with every slide, one per screen at 1280 x 720: open it with #<slide id>
body = ''
for sid in order:
    t = open('project/slides/%s.html' % sid).read()
    for k, v in blob.items(): t = t.replace(k, v)
    body += t
css1 = css.replace('display: grid; grid-template-columns: 640px 640px;', '').replace('zoom: 0.33333', 'zoom: 0.66667')
open('_preview_all.html', 'w').write('<!doctype html><meta charset="utf-8"><title>deck check</title>%s<style>%s</style><link rel="stylesheet" href="project/deck.css"><style>%s</style>%s' % (fonts, css1, late, body))
print('_preview_all.html', len(order), 'slides')
