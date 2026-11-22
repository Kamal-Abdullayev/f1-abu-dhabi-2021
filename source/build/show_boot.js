/* ================= show_boot.js : test boot for the show parts (ACT + CAM) on the stage stub =================
   Owner: show. Not part of the final page. Hook: window.__show
   The Browser pane is usually hidden (no requestAnimationFrame): drive with __show.step(n, dt) and step once before a screenshot. */
{
 let rt=-12,playing=false,speed=1,last=performance.now(),jump=true,dbg=null;const errs=[];
 /* stand-in for the dashboard's free-area report (CAM reads UI.safe() when it exists): set window.__safe = {left, top, right, bottom} to try it */
 var UI={safe(){return window.__safe||null;}};
 window.addEventListener('error',e=>errs.push(String(e.message)+' @'+e.lineno+':'+e.colno));
 fitView();window.addEventListener('resize',fitView);
 /* test scenery on top of the stage stub (its garage boxes are turned 90 degrees and cover the crew places): pit wall with a catch
    fence, open-front garages, start gantry with the flag platform. Only for looking at the actors; the real stage builds these. */
 if(WORLD.stub){const o={},b=new Batch(),old=world.children[world.children.length-1];if(old&&old.isMesh)old.visible=false;
  for(let l=-K.HW;l<K.HW;l+=1){K.trackPos(0,l+.5,o);b.box(1,.04,1.2,o.x,.03,o.z,P.mark,K.TH[0]);}
  const fp=[],fu=[],fi=[];let fn=0;
  for(let q=PIT.wallQ0;q<PIT.wallQ1;q+=4){K.pitPos(q+2,PIT.wallLat,o);b.box(.5,PIT.wallTop,4.02,o.x,0,o.z,P.conc,o.h);
   const a={},c={};K.pitPos(q,PIT.wallLat,a);K.pitPos(q+4,PIT.wallLat,c);fp.push(a.x,PIT.wallTop,a.z,c.x,PIT.wallTop,c.z,c.x,PIT.fenceTop,c.z,a.x,PIT.fenceTop,a.z);fu.push(q/.5,0,(q+4)/.5,0,(q+4)/.5,4.5,q/.5,4.5);fi.push(fn,fn+1,fn+2,fn,fn+2,fn+3);fn+=4;
   if(Math.round((q-PIT.wallQ0)/4)%3===0)b.box(.12,PIT.fenceTop-PIT.wallTop,.12,a.x,PIT.wallTop,a.z,P.steel,o.h);}
  K.TEAMS.forEach(t=>{const W=PIT.garageW-.8,D=PIT.garageDepth,Hg=PIT.garageH,lc=PIT.garageLat-D/2,tc=C(t.ui);
   K.pitPos(t.boxQ,lc,o);b.box(D,.4,W,o.x,Hg-.4,o.z,P.roof,o.h);K.pitPos(t.boxQ,PIT.garageLat-D+.2,o);b.box(.4,Hg,W,o.x,0,o.z,P.cream,o.h);
   [-1,1].forEach(sd=>{K.pitPos(t.boxQ+sd*(W/2-.15),lc,o);b.box(D,Hg,.3,o.x,0,o.z,P.white,o.h);});K.pitPos(t.boxQ,PIT.garageLat,o);b.box(.3,1,W,o.x,Hg-1.4,o.z,tc,o.h);
   K.pitPos(t.boxQ,lc,o);b.box(D,.05,W,o.x,0,o.z,P.pavem,o.h);
   K.pitPos(t.boxQ,PIT.standLat-.2,o);b.box(1.5,.12,4.2,o.x,2.5,o.z,tc,o.h);[-1,1].forEach(sd=>{K.pitPos(t.boxQ+sd*2,PIT.standLat-.8,o);b.box(.1,2.5,.1,o.x,0,o.z,P.steel,o.h);});});
  {const y=PIT.gantryY,gl=PIT.gantryLat;[-1,1].forEach(sd=>{K.trackPos(0,sd*gl,o);b.box(.6,y+.9,.6,o.x,0,o.z,P.dark,o.h);});K.trackPos(0,0,o);b.box(2*gl,.9,.9,o.x,y,o.z,P.dark,o.h);
   K.trackPos(0,-gl,o);b.box(2,.15,2.1,o.x,PIT.flagY-.15,o.z,P.steel,o.h);}
  world.add(b.mesh(M.clay));
  const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d');g.strokeStyle='rgba(210,214,218,.95)';g.lineWidth=5;g.strokeRect(0,0,64,64);
  const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=8;
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fg.setAttribute('uv',new THREE.Float32BufferAttribute(fu,2));fg.setIndex(fi);
  world.add(new THREE.Mesh(fg,new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false})));}
 let lineup=null;
 const frame=(dt,adv)=>{if(adv)rt=clamp(rt+dt*speed,K.TMIN,K.TEND);ACT.tick(rt,dt,jump);CAM.tick(rt,dt,jump);jump=false;
  if(lineup){const o={},seen={};let k=0;ACT.cars.forEach(a=>{const tc=a.c.team.code;if(seen[tc]){return;}seen[tc]=1;K.trackPos(K.sw(60+(k<5?0:9)),(k%5-2)*2.7,o);a.obj.visible=true;a.obj.position.set(o.x,0,o.z);a.obj.rotation.set(0,o.h,0);a.obj.scale.setScalar(1);a.obj.updateMatrix();k++;});
   K.trackPos(K.sw(60-lineup.back),0,o);const c={};K.trackPos(K.sw(66),0,c);dbg={p:[o.x,lineup.up,o.z],t:[c.x,.4,c.z],fov:34};}
  if(dbg){ACT.markers.visible=false;camera.position.set(dbg.p[0],dbg.p[1],dbg.p[2]);camera.fov=dbg.fov||30;camera.near=dbg.near||.3;camera.far=9000;camera.updateProjectionMatrix();camera.lookAt(dbg.t[0],dbg.t[1],dbg.t[2]);}
  ENV.tick(rt,dt,dbg?{x:dbg.t[0],y:0,z:dbg.t[2],dist:120}:CAM.focus());renderer.render(scene,camera);};
 const loop=()=>{const n=performance.now(),dt=Math.min(.1,(n-last)/1000);last=n;try{frame(dt,playing);}catch(e){errs.push('frame: '+e.message+' '+(e.stack||'').split('\n')[1]);}requestAnimationFrame(loop);};
 requestAnimationFrame(loop);
 const r1=x=>+x.toFixed(1);
 window.__show={K,ACT,CAM,PIT,
  seek(t){rt=clamp(t,K.TMIN,K.TEND);jump=true;return rt;},
  step(n,dt){for(let i=0;i<(n||1);i++){try{frame(dt||1/30,true);}catch(e){errs.push('step: '+e.message+' '+(e.stack||'').split('\n')[1]);throw e;}}return +rt.toFixed(3);},
  /* fast sweep for error hunting: ticks every dt of race time from a to b, renders only every `every`-th tick */
  sweep(a,b,dt,every){let n=0,r=0;const t0=performance.now();rt=clamp(a,K.TMIN,K.TEND);jump=true;every=every||50;
   while(rt<b&&rt<K.TEND){rt=Math.min(rt+dt,K.TEND);ACT.tick(rt,dt,jump);CAM.tick(rt,dt,jump);jump=false;ENV.tick(rt,dt,CAM.focus());n++;if(n%every===0){renderer.render(scene,camera);r++;}}
   renderer.render(scene,camera);return {ticks:n,renders:r+1,ms:Math.round(performance.now()-t0),end:+rt.toFixed(2),errs:errs.length};},
  /* advance and place everything without drawing (used by the line-of-sight check in show_los.js) */
  tick(n,dt){for(let i=0;i<(n||1);i++){rt=clamp(rt+(dt||1/30),K.TMIN,K.TEND);ACT.tick(rt,dt||1/30,jump);CAM.tick(rt,dt||1/30,jump);jump=false;}return rt;},
  now(){return rt;},
  /* ten cars, one per team, in two rows on the main straight, seen from behind and above: for checking the liveries */
  lineup(on,back,up){lineup=on?{back:back||17,up:up||6}:null;},
  play(){playing=true;},pause(){playing=false;},setSpeed(x){speed=x;},
  select(code){CAM.select(code);},setCam(m){CAM.set(m);},flyTo(k){CAM.flyTo(k);},home(){CAM.home();},snap(){CAM.snap();},daylight(on){ENV.setDaylight(on);},
  finalLap(){rt=K.carBy.HAM.cum[56]-25;jump=true;speed=1;CAM.set('director');playing=true;return rt;},
  /* free debug camera: look([x,y,z],[x,y,z],fov) ; look() switches it off */
  look(p,t,fov,near){dbg=p?{p,t,fov,near}:null;},
  /* look at a point given in pit-lane coordinates */
  lookPit(q,lat,y,dq,dlat,dy,fov){const a={},b={};K.pitPos(q,lat,a);K.pitPos(q+dq,lat+dlat,b);dbg={p:[b.x,y+dy,b.z],t:[a.x,y,a.z],fov:fov||40};},
  /* look at a car from an offset in its own frame (back, side, up) */
  lookCar(code,back,side,up,fov){const s=K.carState(code==='SC'?K.SC:K.carBy[code],rt,{}),fx=Math.sin(s.h),fz=Math.cos(s.h);dbg={p:[s.x-fx*back+fz*side,(s.y||0)+up,s.z-fz*back-fx*side],t:[s.x,(s.y||0)+.5,s.z],fov:fov||30};},
  errs(){return errs.slice();},
  /* screen position of a car, picking at a screen point, and a synthetic click through the real pointer handlers */
  project(code){const a=code==='SC'?ACT.sc:ACT.cars.find(q=>q.c.code===code),v=a.obj.position.clone();v.y+=.6;v.project(camera);const R=canvas.getBoundingClientRect();return [Math.round((v.x*.5+.5)*R.width),Math.round((-v.y*.5+.5)*R.height),+v.z.toFixed(4)];},
  projPt(x,y,z){const v=new V3(x,y,z),d=v.distanceTo(camera.position);v.project(camera);const R=canvas.getBoundingClientRect();return [Math.round((v.x*.5+.5)*R.width),Math.round((-v.y*.5+.5)*R.height),v.z<1&&v.z>-1?Math.round(d):-1];},
  projPit(q,lat,y){const o={};K.pitPos(q,lat,o);return this.projPt(o.x,y,o.z);},
  pick(x,y){const c=CAM.pickAt(x,y);return c?c.code:null;},
  click(x,y){const R=canvas.getBoundingClientRect(),o={pointerId:7,pointerType:'mouse',button:0,clientX:R.left+x,clientY:R.top+y,bubbles:true};canvas.dispatchEvent(new PointerEvent('pointerdown',o));canvas.dispatchEvent(new PointerEvent('pointerup',o));return CAM.sel&&CAM.sel.code;},
  drag(x0,y0,x1,y1,opt){const R=canvas.getBoundingClientRect(),o=Object.assign({pointerId:8,pointerType:'mouse',button:0,bubbles:true},opt||{});canvas.dispatchEvent(new PointerEvent('pointerdown',Object.assign({},o,{clientX:R.left+x0,clientY:R.top+y0})));
   for(let i=1;i<=6;i++)canvas.dispatchEvent(new PointerEvent('pointermove',Object.assign({},o,{clientX:R.left+x0+(x1-x0)*i/6,clientY:R.top+y0+(y1-y0)*i/6})));canvas.dispatchEvent(new PointerEvent('pointerup',Object.assign({},o,{clientX:R.left+x1,clientY:R.top+y1})));},
  wheel(dy){canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:dy,bubbles:true,cancelable:true}));},
  rig(){const r=CAM.rig;return {x:r1(r.t.x),z:r1(r.t.z),dist:r1(r.dist),yaw:+r.yaw.toFixed(3),pitch:+r.pitch.toFixed(3),follow:r.follow};},
  shots(){return CAM.SHOTS.map(s=>[s.name,r1(s.t0),r1(s.t1)]);},
  /* draw calls of everything outside `world` (actors, camera ring), shadow passes included */
  calls(){const v=world.visible,I=renderer.info;world.visible=false;renderer.render(scene,camera);const a=I.render.calls,t=I.render.triangles;
   /* three.js resets its counters after the shadow pass, so count once more with the reset in our hands: main pass + shadow pass */
   I.autoReset=false;I.reset();renderer.render(scene,camera);const as=I.render.calls;I.reset();world.visible=v;renderer.render(scene,camera);const all=I.render.calls;I.autoReset=true;renderer.render(scene,camera);
   return {actors:a,actorsWithShadowPass:as,actorTris:t,all:renderer.info.render.calls,allWithShadowPass:all,allTris:renderer.info.render.triangles};},
  state(){const o=K.order(rt);return {rt:+rt.toFixed(2),clock:K.clockTxt(rt),lap:K.leaderLap(rt),status:K.status(rt).txt,lead:o[0]&&o[0].c.code,mode:CAM.mode,shot:CAM.shot,sel:CAM.sel&&CAM.sel.code,night:+ENV.night.toFixed(2),
   lights:WORLD.startLights?WORLD.startLights():null,calls:renderer.info.render.calls,tris:renderer.info.render.triangles,cam:[r1(camera.position.x),r1(camera.position.y),r1(camera.position.z)],fov:r1(camera.fov),near:camera.near,errs:errs.length};}
 };
}
