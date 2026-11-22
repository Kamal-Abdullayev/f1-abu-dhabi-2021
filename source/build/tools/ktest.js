/* Offline test of the replay kernel.
   node ktest.js val            self check (validate) with pit table
   node ktest.js prof           reference lap: corner speeds, pit section times
   node ktest.js gap <lap..>    time gap A-B along the lap (env A, B; default HAM, VER)
   node ktest.js order <t>      running order at race time t
   node ktest.js ov [t0 t1]     every overlap episode in the window
   node ktest.js near <t> [m]   cars on the road at time t (road order behind the leader), optional max metres
   node ktest.js trace <code> <t0> <t1> [step]   s, v, lat, type of one car
   node ktest.js pair <A> <B> <t0> <t1> [step]   gap and lateral positions of two cars
   node ktest.js seg <code>     segments of one car
   node ktest.js scq            safety-car queue: gaps at several times
   node ktest.js pit            pit lane traffic: closest pairs in the pit lane
   node ktest.js time           build time of makeKernel (5 runs) */
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', '..', 'out');
const J = n => JSON.parse(fs.readFileSync(path.join(OUT, n), 'utf8'));
const makeKernel = require(path.join(__dirname, '..', 'kernel.js'));
const TP = J('track_pack.json'), RP = J('race_pack.json'), EX = J('race_extra.json');
const t0 = Date.now();
const K = makeKernel(TP, RP, EX);
const mode = process.argv[2] || 'all', arg = process.argv.slice(3);
console.log('build ms', Date.now() - t0, 'TLEN', K.TLEN.toFixed(1), 'LREF', K.LREF.toFixed(2), 'DS', K.DS.toFixed(4));
const kmh = v => (v * 3.6).toFixed(0), f1 = x => (+x).toFixed(1), f2 = x => (+x).toFixed(2);
if (mode === 'time') {
  const ts = []; for (let i = 0; i < 5; i++) { const a = process.hrtime.bigint(); makeKernel(TP, RP, EX); ts.push(Number(process.hrtime.bigint() - a) / 1e6); }
  console.log('makeKernel ms:', ts.map(x => x.toFixed(0)).join(' '), 'median', ts.sort((a, b) => a - b)[2].toFixed(0));
}
if (mode === 'all' || mode === 'prof') {
  console.log('CORNER apex km/h:', K.CORNERS.map(c => { let mn = 1e9; for (let d = -20; d <= 20; d++) mn = Math.min(mn, K.TV[(c.i + d + K.TN) % K.TN]); return 'T' + c.n + ':' + kmh(mn); }).join(' '));
  const segs = [];
  for (let i = 0; i < K.TN; i++) { const a = K.TV[(i - 1 + K.TN) % K.TN], b = K.TV[i], c = K.TV[(i + 1) % K.TN]; if (b >= a && b > c) segs.push('s' + (i * K.DS).toFixed(0) + ':' + kmh(b)); }
  console.log('local max speeds:', segs.join(' '));
  console.log('racing line offset range', Math.min(...K.TRL).toFixed(1), Math.max(...K.TRL).toFixed(1));
  console.log('pit: S_IN', K.S_IN.toFixed(0), 'S_OUT', K.S_OUT.toFixed(0), 'PLEN', K.PLEN, 'Q_LINE', K.Q_LINE, 'limiter', K.Q_LIM0, K.Q_LIM1, 'boxes', K.TEAMS.map(t => t.code + ':' + t.boxQ.toFixed(0)).join(' '));
  if (K.pitInfo) {
    const p = K.pitInfo;
    console.log('pit section times, no stop (s): ' + p.sections.map(s => s.from + '-' + s.to + ': ' + f2(s.t) + ' (' + kmh(s.len / s.t) + ' km/h avg)').join(' | '));
    console.log('pit path total without a stop', f2(p.total), 's; a stop adds', f2(p.stopLoss), 's plus the stationary time; limiter to limiter with a stop', f2(p.loop), 's');
    console.log('same road on the track at reference pace: S_IN to line', f2(p.trackIn), 's (pit entry to line ' + f2(p.pitIn) + ' s, in-lap loss ' + f2(p.pitIn - p.trackIn) + ' s at reference pace); line to S_OUT', f2(p.trackOut), 's (line to pit exit ' + f2(p.pitOut) + ' s without the stop)');
    console.log('speeds km/h along the pit path every 50 m:', p.speeds.map(s => s[0] + ':' + kmh(s[1])).join(' '));
  }
}
if (mode === 'all' || mode === 'val') {
  const t1 = Date.now();
  const r = K.validate();
  console.log('validate ms', Date.now() - t1);
  const pit = r.pitStops; delete r.pitStops;
  const story = r.story; delete r.story;
  const ex = r.overlapExamples; delete r.overlapExamples;
  const sx = r.scPassExamples; delete r.scPassExamples;
  const jx = r.jumpExamples; delete r.jumpExamples;
  console.log(JSON.stringify(r, null, 0).replace(/,"/g, ', "').replace(/\{"/g, '{ "').replace(/(, "(trackOverlapS|maxSpeedKmh|paceMax|pit|passT|queueEndL56|scPassesNotAllowed|margin|sc|overlapPairs|positionJumps|dataOrderMismatch)")/g, '\n$1'));
  console.log('overlap examples (longest first):'); ex.forEach(e => console.log('  ' + JSON.stringify(e)));
  if (sx.length) { console.log('passes under the safety car that are not allowed:'); sx.forEach(e => console.log('  ' + JSON.stringify(e))); }
  if (jx.length) { console.log('position jumps:'); jx.forEach(e => console.log('  ' + JSON.stringify(e))); }
  console.log('story:'); Object.keys(story).forEach(k => console.log('  ' + k + ': ' + JSON.stringify(story[k])));
  console.log('PIT  code lap  dur  stationary  inPace  outPace  (n = lap touched by VSC or safety car)');
  pit.forEach(p => console.log('  ' + [p.code, String(p.lap).padStart(2), p.dur.toFixed(2), p.stationary.toFixed(2), p.inPace, p.outPace, p.neutral ? 'n' : ''].join('  ')));
  console.log('chapters', K.CHAPTERS.map(c => c.id + '@' + c.t.toFixed(0)).join(' '));
  console.log('tT6', K.tT6.toFixed(1), 'incidents', ['RAI', 'RUS', 'GIO', 'LAT', 'PER'].map(k => k + ':' + (K.carBy[k].incT || 0).toFixed(0) + '/' + (K.carBy[k].outT || 0).toFixed(0)).join(' '));
  console.log('parks', ['VER', 'HAM', 'SAI'].map(k => k + ':' + (K.carBy[k].parkT - K.T_FIN).toFixed(0)).join(' '));
}
if (mode === 'ov') {
  const o = { list: true }; if (arg.length >= 2) { o.t0 = +arg[0]; o.t1 = +arg[1]; }
  const r = K.validate(o);
  console.log('track', r.trackOverlapS, 'pit', r.pitOverlapS, 'episodes', r.overlapEpisodes);
  r.overlapExamples.forEach(e => console.log([e.pair.padEnd(11), 't', e.t, 'dur', e.dur, 'min', e.minD, 'lap', e.lap, 's', e.sA, e.sB, 'lat', e.latA, e.latB, 'v', e.vA, e.vB].join(' ')));
  if (r.scPassExamples.length) console.log('sc passes', JSON.stringify(r.scPassExamples));
}
if (mode === 'gap') {
  const laps = arg.map(Number);
  const A = K.carBy[process.env.A || 'HAM'], B = K.carBy[process.env.B || 'VER'], step = +(process.env.STEP || 250);
  for (const n of laps) {
    const row = [];
    for (let s = 100; s < K.TLEN; s += step) { try { row.push(s + ':' + (K.timeAtS(A, n, s) - K.timeAtS(B, n, s)).toFixed(2)); } catch (e) { row.push(s + ':?'); } }
    console.log('lap', n, A.code + '-' + B.code, row.join(' '));
  }
}
if (mode === 'order') {
  const t = +arg[0];
  console.log(K.order(t).map((e, i) => (i + 1) + '.' + e.c.code + (e.out ? 'x' : '') + '(' + (e.D / K.TLEN).toFixed(3) + ')').join(' '));
  console.log(JSON.stringify(K.title(t)), JSON.stringify(K.status(t)));
}
const stOf = (c, t) => { const o = K.carState(c, t, {}); return o; };
if (mode === 'near') {
  const t = +arg[0], lim = +(arg[1] || 1e9), rows = [];
  let lead = null;
  K.ALL.forEach(c => { const o = stOf(c, t); if (!o.vis || o.type === 2) return; if (c.kind === 'sc' && !o.out) return; rows.push({ c: c.code, type: o.type, d: o.d, D: o.D, v: o.v, lat: o.lat, hold: !!(o.seg && o.seg.hold) }); });
  const tr = rows.filter(r => r.type === 0).sort((a, b) => K.sw(a.d) - K.sw(b.d));
  console.log('t', t, 'on track by s:');
  tr.forEach((r, i) => { const nx = tr[(i + 1) % tr.length], gap = K.fwd(r.d, nx.d); if (lim < 1e9 && gap > lim && K.fwd(tr[(i - 1 + tr.length) % tr.length].d, r.d) > lim) return; console.log('  ' + r.c.padEnd(4), 's', K.sw(r.d).toFixed(1).padStart(7), 'lat', f1(r.lat).padStart(5), 'v', f1(r.v).padStart(5), 'gap to next', f1(gap).padStart(7), r.hold ? 'hold' : ''); });
  const pt = rows.filter(r => r.type === 1).sort((a, b) => a.d - b.d);
  if (pt.length) console.log(' pit:', pt.map(r => r.c + ' q' + f1(r.d) + ' lat' + f1(r.lat) + ' v' + f1(r.v)).join(' | '));
}
if (mode === 'trace') {
  const c = arg[0] === 'SC' ? K.SC : K.carBy[arg[0]], a = +arg[1], b = +arg[2], h = +(arg[3] || 1);
  for (let t = a; t <= b + 1e-9; t += h) { const o = stOf(c, t); console.log(t.toFixed(2), 'type', o.type, 'd', f1(o.d), 'v', f1(o.v), 'lat', f2(o.lat), 'lap', o.lap, o.seg ? Object.keys(o.seg).filter(k => o.seg[k] === true).join(',') : ''); }
}
if (mode === 'pair') {
  const A = arg[0] === 'SC' ? K.SC : K.carBy[arg[0]], B = arg[1] === 'SC' ? K.SC : K.carBy[arg[1]], a = +arg[2], b = +arg[3], h = +(arg[4] || .5);
  for (let t = a; t <= b + 1e-9; t += h) { const p = stOf(A, t), q = stOf(B, t), g = p.D - q.D; console.log(t.toFixed(2), A.code, 'd', f1(p.d), 'lat', f2(p.lat), 'v', f1(p.v), 'ty', p.type, '|', B.code, 'd', f1(q.d), 'lat', f2(q.lat), 'v', f1(q.v), 'ty', q.type, '| A-B', f1(g - K.TLEN * Math.round(g / K.TLEN)), 'body', f2(K.capDist(p, q) - 1.9)); }
}
if (mode === 'seg') {
  const c = K.carBy[arg[0]];
  c.segs.forEach(g => console.log(f2(g.t0).padStart(8), f2(Math.min(g.t1, 9999)).padStart(8), 'type', g.type, g.hold ? 'hold d=' + f1(g.d) : g.fixed ? 'fixed to ' + f1(g.dEnd) : 'scal lap ' + g.lap + ' k=' + g.k.toFixed(3) + ' knots=' + g.nk, Object.keys(g).filter(k => g[k] === true && k !== 'fixed' && k !== 'hold').join(',')));
}
if (mode === 'scq') {
  const H = K.carBy.HAM, times = arg.length ? arg.map(Number) : [4760, 4800, 4884, 4950, 5036, 5100, 5182, 5220, 5250, 5262, 5275, 5290, 5305, 5318, 5326, 5330];
  for (const t of times) {
    const sc = stOf(K.SC, t), DH = K.prog(H, t, {}).D, rows = [];
    K.cars.forEach(c => { const o = K.prog(c, t, {}); if (o.seg.type !== 0 || o.seg.hold) return; rows.push({ c: c.code, back: K.sw(DH - o.D), v: o.v }); });
    rows.sort((a, b) => a.back - b.back);
    console.log('t', t, 'SC', sc.type === 0 && sc.out ? 'ahead of HAM by ' + f1(sc.D - DH) + ' m' : 'not on track', '| queue (m behind the car in front): ' + rows.map((r, i) => r.c + (i ? ' ' + f1(r.back - rows[i - 1].back) : '')).join(', '));
  }
}
if (mode === 'pit') {
  /* closest approach of every pair that is in the pit lane at the same time */
  const best = {}, S = K.ALL.map(() => ({}));
  for (let t = 0; t < K.TEND; t += .1) {
    const on = [];
    K.ALL.forEach((c, i) => { const o = K.carState(c, t, S[i]); if (o.vis && o.type === 1) on.push(i); });
    for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) { const A = S[on[a]], B = S[on[b]]; if (Math.abs(A.y - B.y) > 2.5) continue; const d = K.capDist(A, B) - 1.9, key = K.ALL[on[a]].code + '/' + K.ALL[on[b]].code + ' L' + K.leaderLap(t); if (d < 3 && (!best[key] || d < best[key].d)) best[key] = { d, t, qa: A.d, qb: B.d, la: A.lat, lb: B.lat }; }
  }
  Object.keys(best).sort((a, b) => best[a].d - best[b].d).slice(0, 30).forEach(k => { const e = best[k]; console.log(k.padEnd(14), 'body gap', f2(e.d), 't', f1(e.t), 'q', f1(e.qa), f1(e.qb), 'lat', f1(e.la), f1(e.lb)); });
}
