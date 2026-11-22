/* ================= p7_boot.js : replay state, main loop, test hook =================
   Owner: ui. Last part of the page. Owns the replay state (race time, playing, speed, mode) and the loop:
     race time advances -> ACT.tick -> CAM.tick -> ENV.tick -> UI.tick -> render
   Every picture is a pure function of race time, so a seek only sets the time and flags `jumped` for the next frame.
   Test hook: window.__yas (the Browser pane is usually hidden, which pauses requestAnimationFrame: drive the page with step()). */
{
 const START=Math.max(K.TMIN,-12),END=K.TEND,CH=K.CHAPTERS;
 const FF=60,NEAR=20;               /* highlights: fast-forward factor between chapters; gaps this short (s) just play on */
 const S={rt:START,playing:true,speed:1,eff:1,mode:'full',jumped:true,hold:false,hlKey:null,frames:0};
 const errs=[];
 window.addEventListener('error',e=>{if(errs.length<30)errs.push(String(e.message||e)+(e.lineno?' @'+e.lineno:''));});
 const ended=()=>S.rt>=END-1e-6;
 const chap=id=>CH.find(c=>c.id===id)||null;
 /* about 25 s before Hamilton ends lap 57, when the safety car is about to come in */
 const finalT=()=>{const h=K.carBy.HAM;return h&&h.cum[56]!=null?h.cum[56]-25:(chap('final')||{t:END-120}).t;};

 /* highlights: 1x inside a chapter window, otherwise fast-forward to the start of the next chapter.
    The length of the whole gap between two chapters decides (not the time left), so a fast-forward lands exactly on the next start. */
 function hlAt(t){let next=END,cur=null,prev=-Infinity;for(const c of CH){const e=c.t+c.dur;if(t>=c.t&&t<e)cur=c;else if(c.t>t){if(c.t<next)next=c.t;}else if(e>prev)prev=e;}
  if(cur)return {sp:1,to:cur.t+cur.dur,cur};
  return {sp:next-(prev>-Infinity?prev:t)<=NEAR?1:FF,to:next,cur:null};}
 const effNow=()=>S.mode==='highlights'?hlAt(S.rt).sp:S.speed;
 /* how long Highlights takes from the first chapter to the end, in real seconds */
 const hlDur=(()=>{let t=CH.length?CH[0].t:START,d=0,n=0;while(t<END&&n++<100000){const h=hlAt(t),to=Math.min(h.to,END);d+=(to-t)/h.sp;t=to>t?to:t+1;}return d;})();
 /* a camera for each chapter while Highlights is on (keys are chapter ids; unknown ids leave the camera alone) */
 const HLCAM={lights:{area:'start'},t6:{area:'chicane'},stops:{area:'start'},perez:{cam:'tv',sel:'HAM'},vsc:{area:'marsa'},latifi:{area:'hotel'},unlap:{cam:'tv',sel:'HAM'},final:{cam:'director'},flag:{cam:'director'}};
 function hlCam(){if(S.mode!=='highlights')return;const h=hlAt(S.rt),key=h.cur?h.cur.id:h.sp>1?'ff':'gap';if(key===S.hlKey)return;S.hlKey=key;
  if(key==='gap')return;
  if(key==='ff'){CAM.set('map');CAM.home();return;}
  const p=HLCAM[key];if(!p)return;
  if(p.area&&CAM.AREAS[p.area]){CAM.select(null);UI.flyTo(p.area);}
  else if(p.cam){CAM.select(p.sel||null);CAM.set(p.cam);}}

 function advance(dt){
  if(S.mode==='highlights'){const h=hlAt(S.rt);S.eff=h.sp;let nt=S.rt+dt*h.sp;if(h.sp>1&&nt>h.to)nt=h.to;S.rt=nt;}
  else{S.eff=S.speed;S.rt+=dt*S.speed;}
  if(S.rt>=END){S.rt=END;S.playing=false;}}
 function seek(t){t=+t;if(!isFinite(t))return S.rt;S.rt=clamp(t,K.TMIN,END);S.jumped=true;S.hlKey=null;if(S.mode==='final'&&S.rt<finalT()-.5)S.mode='full';UI.seeked();return S.rt;}
 function restart(){seek(START);S.speed=1;S.mode='full';S.playing=true;CAM.set('map');CAM.home();UI.cinema(false);return S.rt;}
 function play(){if(ended())return restart();S.playing=true;return S.rt;}
 function pause(){S.playing=false;return S.rt;}
 function setSpeed(x){x=+x;if(!(x>0)||!isFinite(x))return S.speed;S.speed=Math.min(x,600);if(S.mode==='highlights')S.mode='full';return S.speed;}
 function jump(id){const c=chap(id);if(!c)return false;seek(c.t);S.playing=true;return S.rt;}
 /* the entry the user asked for: the restart and the last lap at 1x with the director camera */
 function finalLap(){seek(finalT());S.speed=1;S.mode='final';S.playing=true;CAM.select(null);CAM.set('director');UI.cinema(true);return S.rt;}
 function highlights(on){if(on===false){if(S.mode==='highlights')S.mode='full';return S.mode;}
  if(ended())seek(CH.length?CH[0].t:START);S.mode='highlights';S.hlKey=null;S.playing=true;return S.mode;}

 /* what the dashboard may read and do */
 const api={START,hlDur,
  get rt(){return S.rt;},get playing(){return S.playing&&!ended();},get speed(){return S.speed;},get eff(){return effNow();},get mode(){return S.mode;},get ended(){return ended();},
  play,pause,toggle(){return S.playing&&!ended()?pause():play();},setSpeed,seek,jump,finalLap,highlights,restart,hold(on){S.hold=!!on;}};

 function frame(dt,render){hlCam();const j=S.jumped;S.jumped=false;
  ACT.tick(S.rt,dt,j);CAM.tick(S.rt,dt,j);ENV.tick(S.rt,dt,CAM.focus());UI.tick(S.rt,dt);
  if(render!==false)renderer.render(scene,camera);S.frames++;}
 let last=performance.now();
 function loop(now){const dt=Math.min(.1,Math.max(1e-4,(now-last)/1000));last=now;if(S.playing&&!S.hold&&!ended())advance(dt);frame(dt);requestAnimationFrame(loop);}

 fitView();window.addEventListener('resize',fitView);
 UI.init(api);
 frame(1e-4);
 requestAnimationFrame(loop);

 window.__yas={K,UI,
  seek(t){return +seek(t).toFixed(3);},play(){play();return S.playing;},pause(){pause();return S.playing;},setSpeed(x){return setSpeed(x);},
  /* advance replay time by dt * speed per step and render, whether or not the page is paused; `every` renders only each n-th step */
  step(n,dt,every){n=Math.max(1,n|0);dt=dt>0?dt:1/30;every=Math.max(1,every|0);for(let i=0;i<n;i++){if(!ended())advance(dt);frame(dt,(i+1)%every===0||i===n-1);}UI.refresh();return +S.rt.toFixed(3);},
  state(){const rt=S.rt,o=K.order(rt),t=K.title(rt),h=S.mode==='highlights'?hlAt(rt):null;
   return {rt:+rt.toFixed(3),clock:K.clockTxt(rt),lap:K.leaderLap(rt),status:K.status(rt).txt,playing:api.playing,speed:S.speed,eff:effNow(),mode:S.mode,ended:ended(),
    chapter:h&&h.cur?h.cur.id:null,cam:CAM.mode,sel:CAM.sel?CAM.sel.code:null,lead:o[0]?o[0].c.code:null,title:t.lead,pts:{VER:t.VER.pts,HAM:t.HAM.pts},
    daylight:!!ENV.daylight,night:+(+ENV.night||0).toFixed(2),frames:S.frames,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,errors:errs.slice(),ui:UI.state(),
    /* chase preset, chase offset {view, yaw, pitch, dist}, and the names of the structures that are see-through at the moment */
    view:CAM.view||null,orbit:CAM.orbit?CAM.orbit():null,faded:CAM.faded?CAM.faded():[]};},
  jump(id){const r=jump(id);UI.refresh();return r;},
  finalLap(){const r=finalLap();UI.refresh();return +r.toFixed(3);},
  setCam(m){CAM.set(m);UI.refresh();return CAM.mode;},
  select(code){CAM.select(code||null);UI.refresh();return CAM.sel?CAM.sel.code:null;},
  flyTo(k){UI.flyTo(k);UI.refresh();return k;},
  validate(opt){return K.validate(opt);},
  /* extras */
  highlights(on){const r=highlights(on!==false);UI.refresh();return r;},restart(){const r=restart();UI.refresh();return r;},
  daylight(on){ENV.setDaylight(on!==false);UI.refresh();return !!ENV.daylight;},
  draw(){frame(1e-4);UI.refresh();return +S.rt.toFixed(3);},
  /* chase views: view('behind' | 'front' | 'left' | 'right' | 'above' | 'onboard') switches to the chase camera with that preset;
     orbit(yaw, pitch, dist) sets the offset on top of the preset (radians, metres) and returns it, orbit() only reads it;
     nudge('rl' | 'rr' | 'tu' | 'td' | 'zi' | 'zo' | 'rs') is one step of the on-screen pad */
  view(name){if(name&&CAM.setView){CAM.set('chase');CAM.setView(name);}UI.refresh();return CAM.view||null;},
  orbit(yaw,pitch,dist){const r=CAM.orbit?CAM.orbit(yaw,pitch,dist):null;UI.refresh();return r;},
  nudge(a,k){const r=CAM.nudge?CAM.nudge(a,k):false;UI.refresh();return r;},
  /* where a car is on screen now, in CSS pixels (to aim a test click at it); null when it is not visible */
  screen(code){const c=code==='SC'?K.SC:K.carBy[code];if(!c)return null;const s=K.carState(c,S.rt,{});if(!s.vis||(c===K.SC&&!s.out))return null;camera.updateMatrixWorld();
   const v=new V3(s.x,(s.y||0)+.6,s.z).project(camera);return v.z>1||v.z<-1?null:[Math.round((v.x*.5+.5)*innerWidth),Math.round((-v.y*.5+.5)*innerHeight)];},
  get errors(){return errs.slice();},get finalT(){return finalT();},get hlDur(){return hlDur;}};
}
