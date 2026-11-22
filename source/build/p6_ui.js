/* ================= p6_ui.js : dashboard =================
   Owner: ui. One namespace: UI. Needs shell.html, K (kernel), CAM, ENV, camera, RACE, EXTRA.
   The replay state (time, playing, speed, mode) lives in p7_boot.js and reaches this part through UI.init(api).
   Rule for numbers: everything is read from K at run time. The table shows real data only (values at each car's last
   crossing of the finish line, from c.cum / c.lapT / c.stopInfo). Anything interpolated between two crossings
   (order on track, live gap, speed, map dots) carries an "est." mark. */
const UI=(()=>{
 const $=id=>document.getElementById(id);
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]);
 const svg=p=>`<svg class="i" viewBox="0 0 24 24">${p}</svg>`;
 const IC={
  search:svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  bell:svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  sun:svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  x:svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  info:svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.4v.4"/>'),
  flag:svg('<path d="M4 22V4M4 4h13l-2.5 4 2.5 4H4"/>'),
  timer:svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
  lead:svg('<path d="M3 21v-6h6v6M9 21V9h6v12M15 21v-9h6v9"/>'),
  play:svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  pause:svg('<path d="M8 5v14M16 5v14" stroke-width="3.4"/>'),
  again:svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  list:svg('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
  panel:svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h18M14 14v6"/>'),
  /* camera pad: rotate left / right, tilt up / down, zoom in / out, reset */
  rl:svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  rr:svg('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
  tu:svg('<path d="m6 13 6-6 6 6"/><path d="M5 18h14"/>'),
  td:svg('<path d="m6 11 6 6 6-6"/><path d="M5 6h14"/>'),
  zi:svg('<path d="M12 5v14M5 12h14"/>'),
  zo:svg('<path d="M5 12h14"/>'),
  rs:svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>')};
 document.querySelectorAll('[data-ic]').forEach(el=>{el.innerHTML=IC[el.dataset.ic]||'';el.style.display='inline-flex';});
 const isMob=()=>innerWidth<=820;

 /* ---------- formats ---------- */
 const p2=n=>(n<10?'0':'')+n,DASH='—';
 /* race time h:mm:ss; before lights out it counts down with a minus sign */
 const fmtRt=t=>{const neg=t<0,x=neg?Math.ceil(-t):Math.floor(t);return (neg&&x>0?'−':'')+Math.floor(x/3600)+':'+p2(Math.floor(x/60)%60)+':'+p2(x%60);};
 const fmtDur=s=>{const x=Math.max(0,Math.round(s));return Math.floor(x/60)+':'+p2(x%60);};
 const fmtLap=v=>{if(!(v>0))return DASH;const ms=Math.round(v*1000),m=Math.floor(ms/60000),s=(ms-m*60000)/1000;return m+':'+(s<10?'0':'')+s.toFixed(3);};
 const fmtGap=s=>'+'+s.toFixed(3);
 const lapsTxt=k=>'+'+k+(k>1?' laps':' lap');
 const TYN={S:'Soft',M:'Medium',H:'Hard'};
 const tyHtml=(comp,txt)=>`<i class="ty ${esc(comp)}"></i>${txt}`;
 const EST='<i class="est">est.</i>';

 /* ---------- data prepared once from the kernel ---------- */
 const cars=K.cars,CH=K.CHAPTERS,T0=K.TMIN,T1=K.TEND;
 const RC=(typeof RACE!=='undefined'&&RACE.race)||{};
 const LAPS=RC.laps||cars.reduce((m,c)=>Math.max(m,c.N),0);
 const DRV={};((typeof RACE!=='undefined'&&RACE.drivers)||[]).forEach(d=>{DRV[d.code]=d;});
 /* time at which the race leader completed each lap = the earliest crossing of the line on that lap (real data) */
 const LT=[];for(let n=0;n<LAPS;n++){let m=Infinity;for(const c of cars)if(c.N>n&&c.cum[n]<m)m=c.cum[n];LT.push(m);}
 /* best lap so far after each completed lap */
 const BEST=new Map();cars.forEach(c=>{let b=Infinity,bl=0;BEST.set(c,c.lapT.map((v,i)=>{if(v<b){b=v;bl=i+1;}return {v:b,lap:bl};}));});
 /* all pit stops in time order */
 const STOPS=[];cars.forEach(c=>c.stopInfo.forEach(s=>STOPS.push({c,s,t:(s.t0+s.t1)/2})));STOPS.sort((a,b)=>a.t-b.t);
 /* real gap to the leader at this car's last crossing (n = laps it has completed) */
 function gapLine(c,n){if(n<1)return null;const T=c.cum[n-1];let m=n;while(m<LAPS&&LT[m]<=T)m++;return m>n?{laps:m-n}:{s:T-LT[n-1]};}
 /* real interval to the car that crossed the line just before it on the same lap */
 function intLine(c,n){if(n<1)return null;const T=c.cum[n-1];let a=null,at=-Infinity;for(const o of cars){if(o===c||o.N<n)continue;const x=o.cum[n-1];if(x<T&&x>at){at=x;a=o;}}
  if(!a)return {first:true};let m=n;while(m<a.N&&a.cum[m]<=T)m++;return m>n?{laps:m-n,a}:{s:T-at,a};}

 /* ---------- replay api: p7_boot.js passes the real one to UI.init ---------- */
 let R={rt:T0,playing:false,speed:1,eff:1,mode:'full',ended:false,hlDur:0,START:T0,play(){},pause(){},toggle(){},setSpeed(){},seek(){},jump(){},finalLap(){},highlights(){},restart(){},hold(){}};
 let bound=false,curT=T0;
 const now=()=>bound?R.rt:curT;
 let sync=()=>{};

 /* ---------- one snapshot of the race per refresh ---------- */
 const _pr={},_cs={},_v=new THREE.Vector3();
 let SN=null;
 function snap(rt){
  const o=K.order(rt),fl=K.fastest(rt),by=new Map();
  const live=o.map((e,i)=>{const c=e.c,n=e.done,fin=!!c.finished&&n>=c.N,ret=!!e.out&&!fin;K.prog(c,rt,_pr);
   const r={c,n,D:e.D,live:i+1,line:0,ret,fin,type:_pr.type,inc:!!(_pr.seg&&_pr.seg.inc),ty:K.tyre(c,rt),gap:gapLine(c,n),int:intLine(c,n),last:n?c.lapT[n-1]:0,best:n?BEST.get(c)[n-1]:null,fl:!!(fl&&fl.c===c)};
   r.state=ret?'OUT':fin?'FIN':rt<0?'GRID':r.type===1?'PIT':r.inc?'SLOW':'';by.set(c,r);return r;});
  /* order at the line: laps completed, then time of the last crossing (grid order before the first crossing) */
  const line=live.slice().sort((a,b)=>(a.ret!==b.ret)?(a.ret?1:-1):(b.n-a.n)||((a.n?a.c.cum[a.n-1]:0)-(b.n?b.c.cum[b.n-1]:0))||(a.c.grid-b.c.grid));
  line.forEach((r,i)=>{r.line=i+1;});
  return {rt,live,line,by,fl,lap:K.leaderLap(rt),st:K.status(rt),title:K.title(rt)};}

 /* ---------- pops ---------- */
 const pops=['alerts','qres','chPop'].map($);
 function closePops(ex){pops.forEach(p=>{if(p!==ex)p.classList.remove('open');});}
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.rel,.search'))closePops();});

 /* ---------- camera: area chips and mode ---------- */
 const areasEl=$('areas');let curArea='';
 areasEl.innerHTML=Object.keys(CAM.AREAS).map(k=>`<button data-a="${esc(k)}">${esc(CAM.AREAS[k].label)}</button>`).join('');
 function flyArea(k){if(!CAM.AREAS[k])return;if(CAM.mode!=='map')CAM.set('map');CAM.flyTo(k);curArea=k;}
 areasEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b){flyArea(b.dataset.a);sync();}});
 const CAMN={map:'Map',chase:'Chase',tv:'TV',director:'Director'};
 const camsEl=$('cams');
 camsEl.innerHTML=CAM.MODES.map(m=>`<button data-c="${esc(m)}">${esc(CAMN[m]||m)}</button>`).join('');
 camsEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b){CAM.set(b.dataset.c);curArea='';sync();}});
 /* chase views: where the camera sits round the followed car (a click also switches to the chase camera and clears any drag) */
 const VIEWN={behind:'Behind',front:'Front',left:'Left',right:'Right',above:'Above',onboard:'Onboard'};
 const VIEWT={behind:'Behind the car, looking ahead',front:'Ahead of the car, looking back at it',left:'From the car’s left',right:'From the car’s right',above:'From above',onboard:'From the camera above the driver’s head'};
 const viewsEl=$('views'),padEl=$('pad'),hintEl=$('camHint'),ctlEl=$('ctl');
 viewsEl.innerHTML=(CAM.VIEWS||[]).map(v=>`<button data-v="${esc(v)}" title="${esc(VIEWT[v]||'')}">${esc(VIEWN[v]||v)}</button>`).join('');
 viewsEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&CAM.setView){if(CAM.mode!=='chase')CAM.set('chase');CAM.setView(b.dataset.v);curArea='';sync();}});
 /* pad: one step per press, repeated while the button is held; the same steps are on the keyboard (see the key handler below) */
 const PADS=[['rl','Rotate left','Q'],['rr','Rotate right','E'],['tu','Tilt up, towards the horizon','R'],['td','Tilt down, more from above','F'],['zi','Zoom in','+'],['zo','Zoom out','−'],['rs','Reset the view','0']];
 const KEYS={q:'rl',e:'rr',r:'tu',f:'td','+':'zi','=':'zi','-':'zo','_':'zo','0':'rs'};
 padEl.innerHTML=PADS.map(p=>`<button data-p="${p[0]}" title="${esc(p[1])} (${p[2]})" aria-label="${esc(p[1])}">${IC[p[0]]||''}</button>`).join('');
 let padT=0,padB=null;
 const padStop=()=>{if(padT){clearTimeout(padT);padT=0;}if(padB){padB.classList.remove('hold');padB=null;}};
 const padStep=(a,k)=>{const r=!!(CAM.nudge&&CAM.nudge(a,k));if(r)updCams();return r;};
 padEl.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b||b.disabled||(e.button!==undefined&&e.button>0))return;e.preventDefault();padStop();padB=b;b.classList.add('hold');try{b.setPointerCapture(e.pointerId);}catch(_e){}
  const a=b.dataset.p;padStep(a,1);if(a==='rs')return;const rep=()=>{padStep(a,.5);padT=setTimeout(rep,55);};padT=setTimeout(rep,340);});
 ['pointerup','pointercancel','lostpointercapture'].forEach(t=>padEl.addEventListener(t,padStop));
 addEventListener('blur',padStop);
 /* Enter or Space on a focused pad button: a click that no pointer made */
 padEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&e.detail===0)padStep(b.dataset.p,1);});
 const HINT={
  dmap:'Drag to move · <b>right-drag</b> or <b>Shift+drag</b> to rotate and tilt · wheel to zoom · keys <b>Q E R F + − 0</b> · in Chase, drag to look around a car',
  dchase:'<b>Drag</b> to look around the car · wheel for distance · keys <b>Q E R F + − 0</b> · a view button clears the drag',
  dchaseo:'Onboard: <b>drag</b> to look around · wheel changes the lens · keys <b>Q E R F + − 0</b>',
  dtv:'Trackside cameras on the selected car · wheel to zoom · Map: right-drag or Shift+drag rotates · Chase: drag to look around',
  ddirector:'Scripted cameras for the final lap, trackside cameras before it · Map and Chase can be turned by hand',
  mmap:'One finger moves · two zoom and turn · the buttons tilt too',
  mchase:'Drag to look around the car · pinch for distance',
  mchaseo:'Onboard: drag to look around · pinch for the lens',
  mtv:'Pinch to zoom',mdirector:''};
 function updCams(){const m=CAM.mode;for(const b of camsEl.children){const on=b.dataset.c===m;if(b._on!==on){b._on=on;b.classList.toggle('on',on);}}
  if(m!=='map'||CAM.sel)curArea='';for(const b of areasEl.children){const on=b.dataset.a===curArea;if(b._on!==on){b._on=on;b.classList.toggle('on',on);}}
  /* name of the current director shot, if the camera part reports one */
  setT($('shot'),m==='director'&&typeof CAM.shot==='string'?CAM.shot:'');
  /* views (chase only), pad (what the mode can do), help line */
  if(ctlEl._m!==m){ctlEl._m=m;ctlEl.className='glass '+m;}
  const v=CAM.view||'';for(const b of viewsEl.children){const on=b.dataset.v===v;if(b._on!==on){b._on=on;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');}}
  const turn=m==='map'||m==='chase';for(const b of padEl.children){const a=b.dataset.p,dis=m==='director'||(!turn&&a!=='zi'&&a!=='zo'&&a!=='rs');if(b._d!==dis){b._d=dis;b.disabled=dis;}}
  const hk=(isMob()?'m':'d')+m+(m==='chase'&&v==='onboard'?'o':'');if(hintEl._k!==hk){hintEl._k=hk;hintEl.innerHTML=HINT[hk]||'';}}
 CAM.onSelect(()=>{curArea='';sync();});

 /* ---------- daylight ---------- */
 const dlEl=$('dl');
 dlEl.addEventListener('click',()=>{ENV.setDaylight(!ENV.daylight);sync();});
 function theme(){const d=!!ENV.daylight;if(dlEl._on!==d){dlEl._on=d;dlEl.classList.toggle('on',d);dlEl.setAttribute('aria-pressed',d?'true':'false');}
  const n=ENV.night>.55;if(document.body._n!==n){document.body._n=n;document.body.classList.toggle('night',n);}}

 /* ---------- search: drivers, teams, camera areas, chapters ---------- */
 const qEl=$('q'),qres=$('qres');
 function doSearch(){const q=qEl.value.trim().toLowerCase();if(!q){qres.classList.remove('open');return;}
  const dr=cars.filter(c=>(c.code+' '+c.name+' #'+c.num+' '+c.team.name+' '+(c.nat||'')).toLowerCase().includes(q)).slice(0,8);
  const ar=Object.keys(CAM.AREAS).filter(k=>CAM.AREAS[k].label.toLowerCase().includes(q));
  const ch=CH.filter(c=>c.name.toLowerCase().includes(q));
  const h=dr.map(c=>`<button class="it" data-c="${esc(c.code)}"><i class="dot" style="background:${esc(c.team.ui)}"></i><span><b>${esc(c.code)} · ${esc(c.name)}</b><small>#${esc(c.num)} · ${esc(c.team.name)}</small></span></button>`).join('')
   +ar.map(k=>`<button class="it" data-a="${esc(k)}"><span><b>${esc(CAM.AREAS[k].label)}</b><small>Camera area</small></span></button>`).join('')
   +ch.map(c=>`<button class="it" data-h="${esc(c.id)}"><span><b>${esc(c.name)}</b><small>Chapter · lap ${K.leaderLap(c.t)}</small></span></button>`).join('');
  qres.innerHTML='<h4>Results</h4>'+(h||'<div class="it"><span><small>No matching driver, team, area or chapter</small></span></div>');closePops(qres);qres.classList.add('open');}
 qEl.addEventListener('input',doSearch);qEl.addEventListener('focus',doSearch);
 qEl.addEventListener('keydown',e=>{if(e.key==='Enter'){const b=qres.querySelector('button');if(b)b.click();}if(e.key==='Escape'){qEl.value='';closePops();qEl.blur();}});
 qres.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.c)CAM.select(b.dataset.c);else if(b.dataset.a)flyArea(b.dataset.a);else if(b.dataset.h)R.jump(b.dataset.h);closePops();qEl.value='';qEl.blur();sync();});

 /* ---------- top bar: lap, clocks, status chip ---------- */
 const setT=(el,t)=>{if(el._t!==t){el._t=t;el.textContent=t;}};
 const setH=(el,h)=>{if(el._h!==h){el._h=h;el.innerHTML=h;}};
 const statEl=$('stat');
 function updClock(rt){setT($('ckLoc'),K.clockTxt(rt));setT($('ckRt'),fmtRt(rt));setT($('ckLap'),K.leaderLap(rt)+' / '+LAPS);}
 function updStatus(st){const p=String(st.txt).split(' · ');setT($('stT'),p[0]);setT($('stS'),p[1]?p.slice(1).join(' · ').toLowerCase():'track status');
  const c=st.k==='flag'?'flag':st.cls||'';if(statEl._c!==c){statEl._c=c;statEl.className=c;}}

 /* ---------- cards: lap and status, leader, fastest lap, title as it stands ---------- */
 $('kpis').innerHTML=
  `<div class="kpi glass k_lap"><div class="kc">${IC.flag}</div><div><span>Lap</span><b id="k_lap"></b><em id="ke_lap"></em></div></div>`
  +`<div class="kpi glass k_lead"><div class="kc">${IC.lead}</div><div><span>Leader · gap to second</span><b id="k_lead"></b><em id="ke_lead"></em></div></div>`
  +`<div class="kpi glass k_fast"><div class="kc">${IC.timer}</div><div><span>Fastest lap so far</span><b id="k_fast"></b><em id="ke_fast"></em></div></div>`
  +`<div class="kpi glass tt"><span>Title as it stands<i id="t_lead"></i></span><div class="tgrid"><div class="tr" id="t_VER"></div><div class="tr" id="t_HAM"></div></div></div>`;
 const WINS={};((typeof RACE!=='undefined'&&RACE.standingsBefore)||[]).forEach(s=>{WINS[s[0]]=s[2];});
 const fmtPts=p=>(Math.round(p*2)/2).toFixed(p%1?1:0);
 function updCards(S){
  const st=S.st,ek=$('ke_lap');setT($('k_lap'),S.lap+' / '+LAPS);setT(ek,st.txt);const ec=st.k==='green'?'ok':st.cls||'';if(ek._c!==ec){ek._c=ec;ek.className=ec;}
  const a=S.live[0],b=S.live[1];
  if(a){setT($('k_lead'),a.c.last);let t=DASH;
   if(b&&!b.ret){const n=Math.min(a.n,b.n);
    if(n<1)t=b.c.code+' 2nd · first gap after lap 1';
    else{const d=b.c.cum[n-1]-a.c.cum[n-1];t=d>=0?b.c.code+' +'+d.toFixed(3)+' s at the line · L'+n:b.c.code+' led by '+(-d).toFixed(3)+' s at the line';}}
   setT($('ke_lead'),t);}
  const f=S.fl;setT($('k_fast'),f?fmtLap(f.v):DASH);setT($('ke_fast'),f?'#'+f.c.num+' '+f.c.code+' · lap '+f.lap:'no lap completed yet');
  const T=S.title;['VER','HAM'].forEach(k=>{const x=T[k],c=K.carBy[k],el=$('t_'+k),on=T.lead===k;if(!x||!c)return;
   setH(el,`<div><i class="dot" style="background:${esc(c.team.ui)}"></i><u>${esc(k)}</u><b>${fmtPts(x.pts)}</b></div><em>P${x.pos} now · +${fmtPts(x.add)} pts</em>`);
   if(el._on!==on){el._on=on;el.classList.toggle('on',on);}});
  if(T.VER&&T.HAM){const d=T.VER.pts-T.HAM.pts;setT($('t_lead'),d===0?(T.lead||'')+' ahead on wins'+(WINS.VER!=null&&WINS.HAM!=null?' ('+Math.max(WINS.VER,WINS.HAM)+' to '+Math.min(WINS.VER,WINS.HAM)+')':''):(d>0?'VER':'HAM')+' by '+fmtPts(Math.abs(d))+' pts');}}

 /* ---------- timing tower, pit stops, race log ---------- */
 const LOG=K.LOG;
 const cnt=(arr,rt)=>{let lo=0,hi=arr.length;while(lo<hi){const m=(lo+hi)>>1;if(arr[m].t<=rt)lo=m+1;else hi=m;}return lo;};
 const logN=rt=>cnt(LOG,rt),pitN=rt=>cnt(STOPS,rt);
 let tab='pos',ord='live',tblKey='',cellC=[];
 const chip=(t,c)=>`<span class="s ${c||''}">${t}</span>`;
 const STC={OUT:'b',FIN:'g',PIT:'o',GRID:'',SLOW:'w'};
 function gapCell(r,pos){if(r.ret)return chip('OUT','b');const g=r.gap;if(!g)return DASH;if(g.laps)return lapsTxt(g.laps);return g.s<5e-4?(pos===1?'Leader':'+0.000'):fmtGap(g.s);}
 function intCell(r){if(r.ret)return r.n?'after L'+r.n:'lap 1';const g=r.int;if(!g||g.first)return DASH;return g.laps?lapsTxt(g.laps):fmtGap(g.s);}
 function mvHtml(r){const d=r.line-r.live;return d>0?`<i class="mv u" title="Up ${d} on track since its last crossing of the line (estimated)">▲${d}</i>`:d<0?`<i class="mv d" title="Down ${-d} on track since its last crossing of the line (estimated)">▼${-d}</i>`:'';}
 const numCell=c=>`<i class="dot" style="background:${esc(c.team.ui)}"></i>${esc(c.num)}`;
 const drvCell=c=>`<b>${esc(c.code)}</b><span class="hm"> ${esc(c.last)}</span>`;
 const TABS={
  pos:{name:'Timing',cols:[['P',''],['#','hm'],['Driver',''],['Team','hm'],['Gap',''],['Int',''],['Last lap',''],['Best lap',''],['Tyre',''],['Stops',''],['','']],
   count:S=>S.live.length,
   rows:S=>(ord==='line'?S.line:S.live).map(r=>{const c=r.c,pos=ord==='line'?r.line:r.live,ty=r.ty;return {code:c.code,out:r.ret,c:[
    `<b>${pos}</b>${mvHtml(r)}`,numCell(c),drvCell(c),esc(c.team.name),gapCell(r,pos),intCell(r),fmtLap(r.last),
    r.best?(r.fl?`<span class="fl" title="Fastest lap of the race so far">${fmtLap(r.best.v)}</span>`:fmtLap(r.best.v)):DASH,
    tyHtml(ty.comp,`<span title="${TYN[ty.comp]||''} · ${ty.age} laps old">${esc(ty.comp)} ${ty.age}</span>`),String(ty.stops),r.state?chip(r.state,STC[r.state]):'']};})},
  pits:{name:'Pit stops',cols:[['Lap',''],['#','hm'],['Driver',''],['Team','hm'],['Tyres',''],['Time in pit lane','']],
   count:S=>pitN(S.rt),
   rows:S=>STOPS.slice(0,pitN(S.rt)).reverse().map(p=>({code:p.c.code,c:[String(p.s.lap),numCell(p.c),drvCell(p.c),esc(p.c.team.name),
    tyHtml(p.s.from,TYN[p.s.from]||esc(p.s.from))+' → '+tyHtml(p.s.to,TYN[p.s.to]||esc(p.s.to)),p.s.dur.toFixed(3)+' s']}))},
  log:{name:'Race log',cols:[['Lap',''],['Race time',''],['Event','wr']],
   count:S=>logN(S.rt),
   rows:S=>LOG.slice(0,logN(S.rt)).reverse().map(l=>({code:'',c:[String(l.lap),fmtRt(l.t),chip(esc(l.text),l.lvl==='b'?'b':l.lvl==='w'?'w':'g')]}))}};
 const tabsEl=$('tabs'),thd=$('thd'),tbd=$('tbd'),ordEl=$('ord'),twEl=$('tw');
 tabsEl.innerHTML=Object.keys(TABS).map(k=>`<button data-t="${k}">${TABS[k].name} (<span></span>)</button>`).join('');
 ordEl.innerHTML='<button data-o="live" title="Rows follow the cars on track. Between two crossings of the finish line this order is estimated.">On track · est.</button><button data-o="line" title="Rows follow the real order at each car’s last crossing of the finish line.">At the line</button>';
 const TNOTE={pos:'Gap · Int · laps · tyres: real, at each car’s last line crossing',pits:'Real data: time between the pit entry and pit exit timing lines',log:'Written for this replay from the timing data and race reports'};
 tabsEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b){tab=b.dataset.t;twEl.scrollTop=0;sync();}});
 ordEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b){ord=b.dataset.o;sync();}});
 tbd.addEventListener('click',e=>{const tr=e.target.closest('tr');if(tr&&tr.dataset.code){const k=tr.dataset.code;CAM.select(CAM.sel&&CAM.sel.code===k?null:k);sync();}});
 function updTable(S){
  for(const b of tabsEl.children){const k=b.dataset.t,on=k===tab;if(b._on!==on){b._on=on;b.classList.toggle('on',on);}setT(b.firstElementChild,String(TABS[k].count(S)));}
  for(const b of ordEl.children){const on=b.dataset.o===ord;if(b._on!==on){b._on=on;b.classList.toggle('on',on);}}
  const od=tab==='pos'?'':'none';if(ordEl._d!==od){ordEl._d=od;ordEl.style.display=od;}
  setT($('tnote'),TNOTE[tab]||'');markSheet();
  const T=TABS[tab],rows=T.rows(S),nc=T.cols.length,key=tab+':'+rows.length;
  if(key!==tblKey){tblKey=key;cellC=[];thd.innerHTML='<tr>'+T.cols.map(c=>`<th class="${c[1]}">${c[0]}</th>`).join('')+'</tr>';
   tbd.innerHTML=rows.map(()=>'<tr>'+T.cols.map(c=>`<td class="${c[1]}"></td>`).join('')+'</tr>').join('');}
  const trs=tbd.children,sc=CAM.sel?CAM.sel.code:'';
  for(let i=0;i<rows.length;i++){const r=rows[i],tr=trs[i],code=r.code||'';if(tr._code!==code){tr._code=code;tr.dataset.code=code;}
   const cls=(code?'go':'')+(code&&code===sc?' sel':'')+(r.out?' out':'');if(tr._cls!==cls){tr._cls=cls;tr.className=cls;}
   for(let j=0;j<nc;j++){const k=i*16+j;if(cellC[k]!==r.c[j]){cellC[k]=r.c[j];tr.children[j].innerHTML=r.c[j];}}}}

 /* ---------- detail panel: selected car, or the race overview with a small map ---------- */
 const dCv=$('dCv'),dctx=dCv.getContext('2d'),sheet=$('sheet');
 const MAPB=(()=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let i=0;i<K.TN;i++){const x=K.TX[i],z=K.TZ[i];if(x<x0)x0=x;if(x>x1)x1=x;if(z<z0)z0=z;if(z>z1)z1=z;}return {xc:(x0+x1)/2,zc:(z0+z1)/2,w:x1-x0,h:z1-z0};})();
 const GREY='#8a8378',FONT='600 18px system-ui,-apple-system,"Segoe UI",sans-serif';
 /* map: north points right, so the long side of the circuit lies along the panel */
 function drawMap(S){const g=dctx,W=dCv.width,H=dCv.height,k=Math.min((W-28)/MAPB.h,(H-48)/MAPB.w),ox=W/2,oy=H/2+12;
  const X=z=>ox-(z-MAPB.zc)*k,Y=x=>oy+(x-MAPB.xc)*k;
  g.clearRect(0,0,W,H);g.lineJoin='round';g.lineCap='round';
  g.beginPath();for(let i=0;i<=K.PN;i+=3){if(i)g.lineTo(X(K.PZ[i]),Y(K.PX[i]));else g.moveTo(X(K.PZ[i]),Y(K.PX[i]));}g.strokeStyle='rgba(128,120,110,.5)';g.lineWidth=2.5;g.stroke();
  g.beginPath();for(let i=0;i<K.TN;i+=3){if(i)g.lineTo(X(K.TZ[i]),Y(K.TX[i]));else g.moveTo(X(K.TZ[i]),Y(K.TX[i]));}g.closePath();g.strokeStyle='rgba(128,120,110,.9)';g.lineWidth=5;g.stroke();
  /* finish line */
  g.beginPath();g.moveTo(X(K.TZ[0]+K.NZ[0]*38),Y(K.TX[0]+K.NX[0]*38));g.lineTo(X(K.TZ[0]-K.NZ[0]*38),Y(K.TX[0]-K.NX[0]*38));g.strokeStyle=GREY;g.lineWidth=3;g.stroke();
  const sel=CAM.sel;
  for(let i=S.live.length-1;i>=0;i--){const r=S.live[i],s=K.carState(r.c,S.rt,_cs);if(!s.vis)continue;const x=X(s.z),y=Y(s.x),on=r.c===sel;
   g.beginPath();g.arc(x,y,on?9:r.live===1?7:5.4,0,TAU);g.fillStyle=r.c.team.ui;g.fill();g.lineWidth=on?3:1.6;g.strokeStyle=on?'#111':'rgba(255,255,255,.92)';g.stroke();}
  const sc=K.carState(K.SC,S.rt,_cs);if(sc.out){const x=X(sc.z),y=Y(sc.x);g.beginPath();g.rect(x-5.5,y-5.5,11,11);g.fillStyle='#f2b632';g.fill();g.lineWidth=1.6;g.strokeStyle='#222';g.stroke();}
  g.fillStyle=GREY;g.font=FONT;g.textAlign='left';g.fillText('Positions within a lap: estimated',12,24);g.textAlign='right';g.fillText('N →',W-12,24);}
 /* speed over the last seconds, straight from the kernel (a reconstruction, hence "estimated") */
 function drawTrace(c,rt){const g=dctx,W=dCv.width,H=dCv.height,N=80,SPAN=20,VM=95;let v=0;
  g.clearRect(0,0,W,H);g.strokeStyle='rgba(128,120,110,.28)';g.lineWidth=1;for(let k=1;k<4;k++){g.beginPath();g.moveTo(0,H*k/4+10);g.lineTo(W,H*k/4+10);g.stroke();}
  g.beginPath();for(let i=0;i<=N;i++){const s=K.carState(c,rt-SPAN+SPAN*i/N,_cs);v=s.vis?Math.max(0,s.v||0):0;const x=i/N*W,y=H-8-Math.min(v,VM)/VM*(H-52);if(i)g.lineTo(x,y);else g.moveTo(x,y);}
  g.strokeStyle='#12a0ad';g.lineWidth=3.5;g.lineJoin='round';g.stroke();g.lineTo(W,H);g.lineTo(0,H);g.closePath();g.fillStyle='rgba(18,160,173,.14)';g.fill();
  g.fillStyle=GREY;g.font=FONT;g.textAlign='left';g.fillText('Speed, last '+SPAN+' s · estimated',12,24);g.textAlign='right';g.fillText(Math.round(v*3.6)+' km/h',W-12,24);}
 const dateTxt=(()=>{if(!RC.date)return '';const d=new Date(RC.date+'T00:00:00Z');return isNaN(d)?RC.date:d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});})();
 function overview(S){const L=S.live[0],st=S.st,rt=S.rt,outs=S.live.filter(r=>r.ret).map(r=>r.c.code);
  return {title:'Race overview',sub:[RC.circuit,LAPS+' laps',dateTxt].filter(Boolean).join(' · '),badge:st.txt,cls:st.k==='green'?'':st.k==='flag'?'idle':st.cls==='bad'?'bad':'warn',
   rows:[['Leader',L?'#'+esc(L.c.num)+' '+esc(L.c.name):DASH],['Lap',S.lap+' / '+LAPS],['Race time',fmtRt(rt)],['Local time (approx.)',K.clockTxt(rt)],
    ['Fastest lap so far',S.fl?esc(S.fl.c.code)+' · '+fmtLap(S.fl.v)+' · lap '+S.fl.lap:DASH],['Pit stops so far',String(pitN(rt))],
    ['Retired',outs.length?esc(outs.join(', ')):'none'],['Did not start',K.DNS.map(d=>esc(d.name)).join(', ')||'none']]};}
 /* estimated time gap to the car ahead on track: how long ago that car was where this one is now */
 function liveAhead(r,S){if(r.live<2||r.ret||r.fin||S.rt<0||r.type!==0)return null;const a=S.live[r.live-2];if(!a||a.ret||a.fin||a.type!==0)return null;
  const WIN=150,g=S.rt-K.timeAtD(a.c,r.D,S.rt-WIN,S.rt);return {a:a.c,s:g,over:g>WIN-1};}
 function carInfo(c,S){const r=S.by.get(c),n=r.n,g=r.gap,it=r.int,ty=r.ty,s=K.carState(c,S.rt,_cs),kmh=s.vis?Math.round(Math.max(0,s.v||0)*3.6):0,laps=k=>k+(k===1?' lap':' laps');
  const stops=c.stopInfo.filter(x=>(x.t0+x.t1)/2<=S.rt);
  let badge='RACING',cls='',status='Racing';
  if(r.ret){badge='OUT';cls='bad';status='Retired after '+laps(n)+' · '+esc(c.status)+(c.outWhere?' ('+esc(c.outWhere)+')':'');}
  else if(r.fin){badge='FINISHED';cls='idle';status='Finished P'+c.pos+(c.timeTxt?' · '+esc(c.timeTxt):c.status?' · '+esc(c.status):'');}
  else if(S.rt<0){badge='ON THE GRID';cls='warn';status='On the grid, slot '+c.grid;}
  else if(r.type===1){badge='PIT LANE';cls='act';status='In the pit lane';}
  else if(r.inc){badge='SLOWING';cls='warn';status='Slowing with a problem';}
  else if(g&&g.laps)status='Racing · '+laps(g.laps)+' down';
  const gapT=!n?DASH:g.laps?lapsTxt(g.laps):g.s<5e-4?'Leader':fmtGap(g.s);
  const hero=r.ret?`<div class="hero"><div><b>OUT</b><span>after ${laps(n)}</span></div><div><b>${esc(c.status)}</b><span>${esc(c.outWhere||'')}</span></div></div>`
   :r.fin?`<div class="hero"><div><b>P${c.pos}</b><span>classified</span></div><div><b>${esc(c.timeTxt||c.status||'')}</b><span>${c.pos===1?'race time':'to the winner'}</span></div></div>`
   :`<div class="hero"><div><b>P${r.live}</b><span>on track ${EST}</span></div><div><b>${gapT}</b><span>gap at the line</span></div></div>`;
  const la=liveAhead(r,S);
  const rows=[['Position at the line',n?'P'+r.line+' · end of lap '+n:'P'+c.grid+' · grid'],
   ['Gap to leader, at the line',!n?DASH:g.laps?lapsTxt(g.laps):g.s<5e-4?'0.000 s':fmtGap(g.s)+' s'],
   ['Interval, at the line',!n||it.first?DASH:(it.laps?lapsTxt(it.laps):fmtGap(it.s)+' s')+' to '+esc(it.a.code)]];
  if(!r.ret&&!r.fin)rows.push(['Car ahead on track '+EST,la?esc(la.a.code)+' · '+(la.over?'over 2 min':(la.s<10?la.s.toFixed(1):Math.round(la.s))+' s'):DASH]);
  rows.push(['Last lap',n?fmtLap(r.last)+' · lap '+n:DASH],['Best lap',r.best?fmtLap(r.best.v)+' · lap '+r.best.lap+(r.fl?' · fastest so far':''):DASH],
   ['Tyres',tyHtml(ty.comp,(TYN[ty.comp]||esc(ty.comp))+' · '+laps(ty.age)+' old')],['Pit stops',stops.length?stops.length+' · lap'+(stops.length>1?'s ':' ')+stops.map(x=>x.lap).join(', '):'0'],
   ['Laps completed',n+' / '+LAPS],['Grid','P'+c.grid+(c.q?' · qualifying '+esc(c.q):'')],['Status',status]);
  if(!r.ret)rows.push(['Speed '+EST,s.vis?kmh+' km/h':DASH]);
  return {title:'#'+c.num+' '+c.name,sub:c.team.name+(c.nat?' · '+c.nat:''),badge,cls,hero,rows,trace:r.ret?null:c};}
 function scInfo(S){const s=K.carState(K.SC,S.rt,_cs);return {title:'Safety car',sub:'Race control',badge:s.out?'ON TRACK':'IN THE PIT LANE',cls:s.out?'warn':'idle',
  rows:[['Status',s.out?'Deployed':'Waiting at the pit exit'],['Speed '+EST,Math.round(Math.max(0,s.v||0)*3.6)+' km/h']],trace:s.out?K.SC:null};}
 let cine=false;
 const detailOn=()=>isMob()?sheet.dataset.tab==='detail':!cine;
 function updDetail(S){const c=CAM.sel,d=!c?overview(S):c===K.SC?scInfo(S):carInfo(c,S);setT($('dT'),d.title);setT($('dS'),d.sub);
  const b=$('dB'),bc='badge '+(d.cls||'');setT(b,d.badge);if(b._c!==bc){b._c=bc;b.className=bc;}
  const dx=$('dX'),vis=c?'visible':'hidden';if(dx._v!==vis){dx._v=vis;dx.style.visibility=vis;}
  if(detailOn()){const cr=dCv.getBoundingClientRect(),cw=Math.round(cr.width*2),chh=Math.round(cr.height*2);/* keep the drawing buffer in step with the box, so nothing is stretched */
   if(cw>40&&chh>40&&(dCv.width!==cw||dCv.height!==chh)){dCv.width=cw;dCv.height=chh;}
   if(d.trace)drawTrace(d.trace,S.rt);else drawMap(S);}
  setH($('dBody'),(d.hero||'')+'<div class="rows">'+d.rows.map(r=>`<div class="rw"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')+'</div>');}
 $('dX').addEventListener('click',()=>{CAM.select(null);sync();});

 /* ---------- tag that follows the selected car ---------- */
 const tagEl=$('tag');let tagOn=false;
 function tagPos(rt){const c=CAM.sel;let show=false;
  if(c){const s=K.carState(c,rt,_cs);if(s.vis&&(c!==K.SC||s.out)){camera.updateMatrixWorld();_v.set(s.x,(s.y||0)+2.4,s.z).project(camera);
    if(_v.z>-1&&_v.z<1&&Math.abs(_v.x)<1.05&&Math.abs(_v.y)<1.05){show=true;const x=(_v.x*.5+.5)*innerWidth;let y=(-_v.y*.5+.5)*innerHeight-8,top=1e9;
     /* never on the car itself: seen from above (chase from above, a steep map view) the point 2.4 m over the car lies on the car, so
        the tag is lifted above the highest corner of the car's box on screen */
     const fx=Math.sin(s.h)*2.9,fz=Math.cos(s.h)*2.9,lx=Math.cos(s.h),lz=-Math.sin(s.h),y0=s.y||0;
     for(let k=0;k<8;k++){_v.set(s.x+(k&1?fx:-fx)+(k&2?lx:-lx),y0+(k&4?1.05:0),s.z+(k&1?fz:-fz)+(k&2?lz:-lz)).project(camera);if(_v.z<1){const t=(-_v.y*.5+.5)*innerHeight;if(t<top)top=t;}}
     if(top-10<y)y=top-10;
     tagEl.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-100%)';}}}
  if(show!==tagOn){tagOn=show;tagEl.style.display=show?'block':'none';}}
 function updTag(S){const c=CAM.sel;if(!c)return;const r=S.by.get(c),s=K.carState(c,S.rt,_cs),v=Math.round(Math.max(0,s.v||0)*3.6);
  setH(tagEl.children[0],`<i style="background:${esc(c.team.ui)}"></i>${esc(c.code)}${r?' · '+(r.ret?'OUT':'P'+r.live):''}`);setT(tagEl.children[1],r&&r.ret?'retired':v+' km/h est.');}

 /* ---------- race log: bell and the caption ---------- */
 const alEl=$('alerts');let seenN=0,logKey='';
 $('bell').addEventListener('click',()=>{closePops(alEl);alEl.classList.toggle('open');logKey='';sync();});
 let wasSeek=true;
 function updLog(S){const n=logN(S.rt),open=alEl.classList.contains('open');if(open||n<seenN||wasSeek)seenN=n;wasSeek=false;const u=n-seenN;setT($('bellN'),u?(u>9?'9+':String(u)):'');
  if(open&&logKey!==String(n)){logKey=String(n);alEl.innerHTML='<h4>Race log</h4>'+(n?LOG.slice(0,n).reverse().map(l=>`<div class="al ${esc(l.lvl||'')}"><i></i><div>${esc(l.text)}<small>Lap ${l.lap} · race time ${fmtRt(l.t)} · ${K.clockTxt(l.t)} local, approx.</small></div></div>`).join(''):'<div class="al"><i></i><div>Nothing yet. The log fills as the race goes on.</div></div>');}}
 const capEl=$('cap');let capKey='',resOpen=false;
 function updCap(S){const n=logN(S.rt),l=n?LOG[n-1]:null,eff=R.eff||1,key=l&&eff<=4&&!resOpen&&S.rt-l.t<9*Math.max(1,eff)?String(n):'';
  if(key!==capKey){capKey=key;if(key){capEl.className='on '+(l.lvl||'');capEl.children[0].textContent='Lap '+l.lap+' · race log';capEl.children[1].textContent=l.text;}else capEl.className='';}}

 /* ---------- playback bar: play/pause, speed, scrubber with chapter marks, chapters menu, entry points ---------- */
 const SPEEDS=[1,4,16,60],spdEl=$('spd'),tl=$('tl'),tlF=$('tlF'),tlK=$('tlK'),tlM=$('tlM'),tipEl=$('tlTip'),ppEl=$('pp');
 const frac=t=>clamp((t-T0)/(T1-T0),0,1);
 const chCur=t=>{let r=null;for(const c of CH)if(t>=c.t&&t<c.t+c.dur)r=c;return r;};
 const chNext=t=>{let r=null;for(const c of CH)if(c.t>t&&(!r||c.t<r.t))r=c;return r;};
 spdEl.innerHTML=SPEEDS.map(v=>`<button data-v="${v}" aria-label="Speed ${v} times">${v}×</button>`).join('');
 spdEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b){R.setSpeed(+b.dataset.v);sync();}});
 ppEl.addEventListener('click',()=>{R.toggle();sync();});
 tlM.innerHTML=CH.map(c=>`<button class="tlm${c.id==='final'?' fin':''}" data-id="${esc(c.id)}" style="left:${(frac(c.t)*100).toFixed(3)}%" aria-label="Chapter: ${esc(c.name)}" tabindex="-1"></button>`).join('');
 /* neutralised periods on the rail, found by asking the kernel for the track status along the race */
 {const z=[];let k0='',t0=0;for(let t=0;t<=K.T_FIN;t+=2){const k=K.status(t).k,kk=k==='sc'||k==='vsc'?k:'';if(kk!==k0){if(k0)z.push([t0,t]);k0=kk;t0=t;}}if(k0)z.push([t0,K.T_FIN]);
  $('tlZ').innerHTML=z.map(a=>`<i style="left:${(frac(a[0])*100).toFixed(3)}%;width:${((frac(a[1])-frac(a[0]))*100).toFixed(3)}%"></i>`).join('');}
 $('pbE').textContent=fmtRt(T1);
 tl.setAttribute('aria-valuemin',String(Math.round(T0)));tl.setAttribute('aria-valuemax',String(Math.round(T1)));
 {let drag=false;
  const tAt=e=>{const r=tl.getBoundingClientRect();return T0+clamp((e.clientX-r.left)/Math.max(1,r.width),0,1)*(T1-T0);};
  const tip=e=>{const r=tl.getBoundingClientRect(),x=clamp(e.clientX-r.left,0,r.width),t=T0+x/Math.max(1,r.width)*(T1-T0);let near=null,nd=8;
   if(!isMob())for(const c of CH){const d=Math.abs(frac(c.t)*r.width-x);if(d<nd){nd=d;near=c;}}
   tipEl.innerHTML=near?`<b>${esc(near.name)}</b>Lap ${K.leaderLap(near.t)} · ${fmtRt(near.t)}`:`Lap ${K.leaderLap(t)} · ${fmtRt(t)}`;
   tipEl.style.left=clamp(near?frac(near.t)*r.width:x,70,Math.max(70,r.width-70))+'px';tipEl.style.display='block';};
  tl.addEventListener('pointerdown',e=>{const m=e.target.closest('.tlm');if(m){R.jump(m.dataset.id);sync();return;}
   drag=true;try{tl.setPointerCapture(e.pointerId);}catch(_e){}R.hold(true);R.seek(tAt(e));tip(e);sync();});
  tl.addEventListener('pointermove',e=>{if(drag){R.seek(tAt(e));sync();}tip(e);});
  const up=()=>{if(!drag)return;drag=false;R.hold(false);if(isMob())tipEl.style.display='none';};
  tl.addEventListener('pointerup',up);tl.addEventListener('pointercancel',up);
  tl.addEventListener('pointerleave',()=>{if(!drag)tipEl.style.display='none';});
  tl.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:e.key==='PageUp'?60:e.key==='PageDown'?-60:0;if(d){R.seek(R.rt+d);sync();e.preventDefault();}});}
 const chPop=$('chPop');let chKey='';
 $('chB').addEventListener('click',()=>{closePops(chPop);chPop.classList.toggle('open');chKey='';sync();});
 chPop.addEventListener('click',e=>{const b=e.target.closest('button');if(b){R.jump(b.dataset.id);closePops();sync();}});
 function updChapters(rt){const cur=chCur(rt),nx=chNext(rt);let a='Chapters',b=CH.length+' key moments';
  if(R.mode==='highlights'&&R.eff>1&&nx){a='Fast-forward';b='to: '+nx.name;}
  else if(cur)b=cur.name+' · '+fmtDur(cur.t+cur.dur-rt)+' left',a='Chapter '+(CH.indexOf(cur)+1)+' of '+CH.length;
  else if(nx)b='next: '+nx.name+' · lap '+K.leaderLap(nx.t);
  setT($('chT'),a);setT($('chS'),b);
  for(const m of tlM.children){const on=!!cur&&m.dataset.id===cur.id;if(m._on!==on){m._on=on;m.classList.toggle('on',on);}}
  if(chPop.classList.contains('open')){const key=(cur?cur.id:'')+'|'+CH.filter(c=>c.t+c.dur<=rt).length;if(key!==chKey){chKey=key;
   chPop.innerHTML='<h4>Chapters</h4>'+CH.map((c,i)=>`<button class="it${c===cur?' on':''}${c.t+c.dur<=rt?' past':''}" data-id="${esc(c.id)}"><span class="n">${i+1}</span><span><b>${esc(c.name)}</b><small>Lap ${K.leaderLap(c.t)} · ${K.clockTxt(c.t)} local, approx.</small></span><span class="r">${fmtRt(c.t)}</span></button>`).join('');}}}
 const eFull=$('eFull'),eHl=$('eHl'),eFin=$('eFin');
 const used=()=>{eFin.classList.remove('cue');};
 eFull.addEventListener('click',()=>{used();R.restart();sync();});
 eHl.addEventListener('click',()=>{used();R.highlights(R.mode!=='highlights');sync();});
 eFin.addEventListener('click',()=>{used();R.finalLap();sync();});
 function updPos(rt){const f=(frac(rt)*100).toFixed(3)+'%';if(tlF._f!==f){tlF._f=f;tlF.style.width=f;tlK.style.left=f;}setT($('pbT'),fmtRt(rt));}
 function updPlay(rt){updPos(rt);tl.setAttribute('aria-valuenow',String(Math.round(rt)));tl.setAttribute('aria-valuetext','Lap '+K.leaderLap(rt)+', race time '+fmtRt(rt));
  const ic=R.ended?'again':R.playing?'pause':'play';if(ppEl._ic!==ic){ppEl._ic=ic;ppEl.firstElementChild.innerHTML=IC[ic];ppEl.setAttribute('aria-label',R.ended?'Play again from the grid':R.playing?'Pause':'Play');}
  const hl=R.mode==='highlights',sp=hl?R.eff:R.speed;if(spdEl._a!==hl){spdEl._a=hl;spdEl.classList.toggle('auto',hl);}
  for(const b of spdEl.children){const on=+b.dataset.v===sp;if(b._on!==on){b._on=on;b.classList.toggle('on',on);}}
  [[eFull,'full'],[eHl,'highlights'],[eFin,'final']].forEach(p=>{const on=R.mode===p[1];if(p[0]._on!==on){p[0]._on=on;p[0].classList.toggle('on',on);p[0].setAttribute('aria-pressed',on?'true':'false');}});
  if(R.mode==='final')used();}

 /* ---------- phone: bottom sheet (playback bar on top, then tabs) ---------- */
 const root=document.documentElement;let sheetH=268;
 const sheetMin=()=>{const y=$('entry').offsetTop;return y>40?y:92;};
 const sheetDef=()=>{const s=$('stabs'),y=s.offsetTop+s.offsetHeight;return y>120?y+124:292;};
 /* the sheet never rises over the camera control, so nothing above it is ever covered */
 const sheetMax=()=>{const c=$('ctl').getBoundingClientRect(),a=$('areas').getBoundingClientRect();return Math.max(sheetMin(),innerHeight-(c.height?c.bottom:a.bottom)-8);};
 function setSheetH(h){const mn=sheetMin();sheetH=Math.round(clamp(h,mn,sheetMax()));root.style.setProperty('--sh',sheetH+'px');
  document.body.classList.toggle('sheethi',sheetH>innerHeight*.45);document.body.classList.toggle('sheetmin',sheetH<=mn+4);}
 /* sheet tabs: Timing, Pit stops and Race log are the three tables of the timing panel; then Details and About */
 function markSheet(){for(const b of $('stabs').children){const on=b.dataset.s===sheet.dataset.tab&&(!b.dataset.t||b.dataset.t===tab);if(b._on!==on){b._on=on;b.classList.toggle('on',on);}}}
 function setSheetTab(t){sheet.dataset.tab=t;markSheet();}
 $('stabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b){if(b.dataset.t){tab=b.dataset.t;twEl.scrollTop=0;}setSheetTab(b.dataset.s);
  const want=b.dataset.s==='about'?sheetMax():innerHeight*.5;if(sheetH<want-4)setSheetH(want);sync();}});
 {const g=$('grip');let st=null;
  g.addEventListener('pointerdown',e=>{try{g.setPointerCapture(e.pointerId);}catch(_e){}st={y:e.clientY,h:sheetH,m:false};sheet.classList.add('drag');});
  g.addEventListener('pointermove',e=>{if(!st)return;const dy=e.clientY-st.y;if(Math.abs(dy)>5)st.m=true;if(st.m)setSheetH(st.h-dy);});
  const up=()=>{if(!st)return;sheet.classList.remove('drag');const H=innerHeight,mn=sheetMin(),df=sheetDef(),snaps=[mn,df,Math.round(H*.5),sheetMax()];
   if(!st.m)setSheetH(sheetH<df-20?df:sheetH<H*.5-20?snaps[2]:mn);else setSheetH(snaps.reduce((a,b)=>Math.abs(b-sheetH)<Math.abs(a-sheetH)?b:a));st=null;sync();};
  g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);}
 /* cinema view: hide the timing and detail panels (desktop) or lower the sheet (phone) so the 3D view has the screen */
 const pnlEl=$('pnl');
 function cinema(on){cine=!!on;document.body.classList.toggle('cine',cine);pnlEl.classList.toggle('on',!cine);pnlEl.setAttribute('aria-pressed',cine?'false':'true');if(isMob())setSheetH(cine?sheetMin():sheetDef());}
 pnlEl.addEventListener('click',()=>{cinema(!cine);sync();});

 /* ---------- About note ---------- */
 const abEl=$('about'),CR=(typeof EXTRA!=='undefined'&&EXTRA.credits)||{};
 $('abSub').textContent=[(RC.name||'')+(RC.date?' '+RC.date.slice(0,4):''),RC.circuit,dateTxt].filter(Boolean).join(' · ');
 $('abAft').textContent=(typeof EXTRA!=='undefined'&&EXTRA.aftermath)||'';
 $('abCr1').textContent=CR.timing||'';$('abCr2').textContent=CR.map||'';$('abCr3').textContent=CR.tyres||'';$('abDis').textContent=CR.disclaimer||'';
 /* a card (About on desktop, the result) takes the free area; the panels it would cover are hidden while it is open */
 const dlg=()=>{document.body.classList.toggle('dlg',resOpen||(!isMob()&&abEl.classList.contains('open')));};
 function about(on){if(isMob()){if(on){resGone=true;updResult(now());setSheetTab('about');setSheetH(sheetMax());}}else abEl.classList.toggle('open',!!on);dlg();}
 $('abB').addEventListener('click',()=>{about(!abEl.classList.contains('open'));sync();});
 $('abX').addEventListener('click',()=>about(false));
 {const f=document.createElement('p');f.className='fine';f.innerHTML=esc(CR.disclaimer||'')+'<br>'+esc(CR.map||'')+'<br><button class="lnk" id="dAb">About this replay</button>';$('detail').appendChild(f);
  $('dAb').addEventListener('click',()=>{about(true);sync();});}
 document.addEventListener('pointerdown',e=>{if(abEl.classList.contains('open')&&!e.target.closest('#about,#abB,#rAb,#dAb'))about(false);});
 document.addEventListener('keydown',e=>{const tg=e.target&&e.target.closest?e.target:document.body;
  if(e.key==='Escape'){closePops();about(false);}
  else if((e.code==='Space'||e.key===' ')&&!tg.closest('input,button,textarea')){e.preventDefault();R.toggle();sync();}
  /* camera keys: Q E rotate, R F tilt, + − zoom, 0 reset; never while typing (the search box) or with Ctrl, Cmd or Alt held */
  else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!tg.closest('input,textarea,select,[contenteditable]')){const a=KEYS[e.key]||KEYS[String(e.key).toLowerCase()];if(a&&padStep(a,e.repeat?.5:1))e.preventDefault();}});

 /* ---------- result card when the replay has ended ---------- */
 const resEl=$('result');let resGone=false;
 {const W=cars.slice().sort((a,b)=>a.pos-b.pos),w=W[0],s=W[1],T=K.title(T1),last=k=>K.carBy[k]?K.carBy[k].last:k;
  $('rSub').textContent=[(RC.name||'')+(RC.date?' '+RC.date.slice(0,4):''),RC.circuit,LAPS+' laps'].filter(Boolean).join(' · ');
  $('rSum').innerHTML=(w&&s?`<b>${esc(w.name)}</b> (${esc(w.team.name)}) wins in ${esc(w.timeTxt||'')}, ${esc(String(s.timeTxt||'').replace('+',''))} s ahead of ${esc(s.name)}.`:'')
   +(T.VER&&T.HAM?`<br>Drivers’ championship after the race: <b>${esc(last(T.lead))} ${fmtPts(T[T.lead].pts)}</b>, ${esc(last(T.lead==='VER'?'HAM':'VER'))} ${fmtPts(T[T.lead==='VER'?'HAM':'VER'].pts)}.`:'');
  $('rHd').innerHTML='<tr><th>Pos</th><th class="hm">#</th><th>Driver</th><th class="hm">Team</th><th>Time / gap</th><th>Laps</th><th>Pts</th></tr>';
  $('rBd').innerHTML=W.map(c=>{const d=DRV[c.code]||{},pt=d.posText||String(c.pos);return `<tr><td><b>${esc(pt==='R'?'Ret':pt)}</b></td><td class="hm">${numCell(c)}</td><td><b>${esc(c.code)}</b> ${esc(c.last)}</td><td class="hm">${esc(c.team.name)}</td><td>${esc(c.timeTxt||c.status||'')}</td><td>${c.N}</td><td>${c.points?fmtPts(c.points):''}</td></tr>`;}).join('')
   +K.DNS.map(d=>`<tr class="out"><td><b>DNS</b></td><td class="hm">${d.team?numCell(d):esc(d.num)}</td><td><b>${esc(d.code)}</b> ${esc(String(d.name).split(' ').pop())}</td><td class="hm">${esc(d.team?d.team.name:'')}</td><td>did not start</td><td>0</td><td></td></tr>`).join('');}
 $('rX').addEventListener('click',()=>{resGone=true;sync();});
 $('rFin').addEventListener('click',()=>{R.finalLap();sync();});
 $('rRes').addEventListener('click',()=>{R.restart();sync();});
 $('rAb').addEventListener('click',()=>{about(true);sync();});
 function updResult(rt){const end=rt>=T1-.01;if(!end)resGone=false;const o=end&&!resGone;if(o!==resOpen){resOpen=o;resEl.classList.toggle('open',o);if(o&&isMob())setSheetH(sheetMin());dlg();}}
 /* the part of the window that no panel covers, in CSS pixels (for a camera that wants to frame things clear of the dashboard) */
 const SAFE={left:0,top:0,right:0,bottom:0};
 function updSafe(){const W=innerWidth,H=innerHeight,bx=id=>{const e=$(id),r=e.getBoundingClientRect();return r.width>0&&r.height>0?r:null;};
  if(isMob()){const c=bx('ctl'),t=bx('areas')||bx('top');SAFE.left=0;SAFE.right=W;SAFE.top=c?c.bottom:t?t.bottom:0;SAFE.bottom=H-sheetH;}
  else{const c=bx('ctl'),k=bx('kpis'),t=bx('top'),d=bx('detail'),tb=bx('tablep'),p=bx('play');SAFE.left=0;SAFE.right=d?d.left:W;SAFE.top=c?c.bottom:k?k.bottom:t?t.bottom:0;SAFE.bottom=tb?tb.top:p?p.top:H;}}

 /* ---------- refresh and tick ---------- */
 function quick(rt){updClock(rt);updPos(rt);}
 function refresh(){const rt=now(),S=SN=snap(rt);updClock(rt);updStatus(S.st);updCards(S);updPlay(rt);updChapters(rt);updCams();theme();updTable(S);updDetail(S);updLog(S);updResult(rt);updCap(S);updTag(S);updSafe();}
 sync=refresh;
 let accA=9,accB=9;
 /* called every frame by the loop: the tag every frame, the clock and scrubber 10 times a second, the rest 4 times a second */
 function tick(rt,dt){curT=rt;tagPos(rt);accA+=dt;accB+=dt;if(accB>=.25){accA=accB=0;refresh();}else if(accA>=.1){accA=0;quick(rt);}}
 function layout(){if(isMob())setSheetH(sheetH);else document.body.classList.remove('sheethi');}
 addEventListener('resize',()=>{layout();sync();});
 function init(api){R=api;bound=true;if(R.hlDur>0)$('eHlS').textContent=CH.length+' chapters · about '+Math.max(1,Math.round(R.hlDur/60))+' min';
  if(isMob()){sheet.classList.add('drag');setSheetH(sheetDef());setTimeout(()=>sheet.classList.remove('drag'),60);}refresh();}
 return {tick,init,refresh,cinema,about,
  /* for the boot: fly the map camera to an area (keeps the chip in step), and tell the dashboard that time has jumped */
  flyTo(k){flyArea(k);},seeked(){wasSeek=true;},
  /* free area of the window, CSS pixels: {left, top, right, bottom}; refreshed four times a second */
  safe(){return SAFE;},
  setTab(t){if(TABS[t]){tab=t;refresh();}},setOrder(o){ord=o==='line'?'line':'live';refresh();},setSheet(h){setSheetH(h);refresh();},setSheetTab(t){setSheetTab(t);refresh();},
  state(){return {tab,order:ord,cine,sheetH,sheetTab:sheet.dataset.tab,about:abEl.classList.contains('open'),result:resOpen,unread:$('bellN').textContent,caption:capEl.className?capEl.children[1].textContent:'',area:curArea,mobile:isMob(),hint:hintEl.textContent};}};
})();
