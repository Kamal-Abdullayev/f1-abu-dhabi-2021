/* ================= show_los.js : line-of-sight check for the cameras =================
   Owner: show. TEST CODE ONLY, never part of the shipped page. Goes after show_boot.js in the show test pages. Hook: window.__los
   It collects the triangles of the static scenery (`world`, opaque meshes only, nothing below 0.3 m) into a grid over x/z and casts
   segments from the camera to points on the followed cars. Whatever a segment meets before the car is reported with its position.
     __los.build()                      once per page load (about a second); returns the triangle count
     __los.director(dt, only)           every director shot (or those matching the RegExp), played in steps of dt: [name, blocked rays, first cases]
     __los.framing(dt, only)            the same shots: are the followed cars inside the picture, and how large
     __los.tv(code, t0, t1, dt)         tv mode following a car: per trackside camera, how often the car is hidden
     __los.chase(code, t0, t1, dt)      chase mode: where something sits between car and camera (camera inside geometry)
     __los.at(codes)                    the current camera against the given cars
     __los.search({...})                try camera places beside the track for a time window; best first
     __los.points([[x,y,z],...])        the current camera against arbitrary points */
{
 const CELL=20,S=window.__show,KEY=(ix,iz)=>(ix+2048)*4096+(iz+2048);let G=null;
 function build(){const t0=performance.now(),cells=new Map(),info=[],v=new V3(),m4=new THREE.Matrix4(),im=new THREE.Matrix4();let T=new Float32Array(9*400000),ID=new Uint16Array(400000),n=0,skipped=0;
  world.updateMatrixWorld(true);
  world.traverse(o=>{if(!o.isMesh||!o.geometry||!o.geometry.attributes.position)return;for(let p=o;p;p=p.parent)if(!p.visible)return;
   const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>!m||m.transparent||m.depthWrite===false||m.visible===false)){skipped++;return;}
   const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null,nt=Math.floor((idx?idx.length:pos.count)/3),inst=o.isInstancedMesh?o.count:1;
   if(o.isInstancedMesh&&(inst>9000||inst*nt>1200000)){skipped++;return;}
   const id=info.length;info.push({mesh:o.name||o.type,tris:nt*inst,inst:o.isInstancedMesh?inst:0,mat:mats[0].type,kept:0});
   const W=new Float32Array(pos.count*3);
   for(let k=0;k<inst;k++){if(o.isInstancedMesh){o.getMatrixAt(k,im);m4.multiplyMatrices(o.matrixWorld,im);}else m4.copy(o.matrixWorld);
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m4);W[i*3]=v.x;W[i*3+1]=v.y;W[i*3+2]=v.z;}
    for(let t=0;t<nt;t++){const a=(idx?idx[t*3]:t*3)*3,b=(idx?idx[t*3+1]:t*3+1)*3,c=(idx?idx[t*3+2]:t*3+2)*3;
     if(W[a+1]<.3&&W[b+1]<.3&&W[c+1]<.3)continue;
     if(n*9>=T.length){const T2=new Float32Array(T.length*2);T2.set(T);T=T2;const I2=new Uint16Array(ID.length*2);I2.set(ID);ID=I2;}
     const q=n*9;T[q]=W[a];T[q+1]=W[a+1];T[q+2]=W[a+2];T[q+3]=W[b];T[q+4]=W[b+1];T[q+5]=W[b+2];T[q+6]=W[c];T[q+7]=W[c+1];T[q+8]=W[c+2];ID[n]=id;info[id].kept++;
     const x0=Math.floor(Math.min(W[a],W[b],W[c])/CELL),x1=Math.floor(Math.max(W[a],W[b],W[c])/CELL),z0=Math.floor(Math.min(W[a+2],W[b+2],W[c+2])/CELL),z1=Math.floor(Math.max(W[a+2],W[b+2],W[c+2])/CELL);
     if((x1-x0+1)*(z1-z0+1)<=400)for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const key=KEY(ix,iz);let l=cells.get(key);if(!l){l=[];l.stamp=0;cells.set(key,l);}l.push(n);}
     n++;}}});
  G={T,ID,n,cells,info,seen:new Uint32Array(n),stamp:0};return {tris:n,meshes:info.length,skipped,cells:cells.size,ms:Math.round(performance.now()-t0),info:info.filter(i=>i.kept>0).map(i=>i.mesh+':'+i.mat.replace('Material','')+':'+i.kept+(i.inst?'/inst'+i.inst:''))};}
 /* first thing between P and Q (stops `margin` metres short of Q); null when the way is free */
 function ray(px,py,pz,qx,qy,qz,margin){if(!G)build();const dx=qx-px,dy=qy-py,dz=qz-pz,len=Math.hypot(dx,dy,dz);if(len<.5)return null;const T=G.T,seen=G.seen,stamp=++G.stamp,tMin=.35/len;let best=1-(margin==null?1.6:margin)/len,hit=-1;
  const ns=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(CELL*.5)));
  for(let s=0;s<=ns;s++){const ix=Math.floor((px+dx*s/ns)/CELL),iz=Math.floor((pz+dz*s/ns)/CELL);
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=G.cells.get(KEY(ix+a,iz+b));if(!l||l.stamp===stamp)continue;l.stamp=stamp;
    for(let k=0;k<l.length;k++){const ti=l[k];if(seen[ti]===stamp)continue;seen[ti]=stamp;const o=ti*9,ax=T[o],ay=T[o+1],az=T[o+2],e1x=T[o+3]-ax,e1y=T[o+4]-ay,e1z=T[o+5]-az,e2x=T[o+6]-ax,e2y=T[o+7]-ay,e2z=T[o+8]-az;
     const hx=dy*e2z-dz*e2y,hy=dz*e2x-dx*e2z,hz=dx*e2y-dy*e2x,det=e1x*hx+e1y*hy+e1z*hz;if(det>-1e-10&&det<1e-10)continue;const f=1/det,sx=px-ax,sy=py-ay,sz=pz-az,u=f*(sx*hx+sy*hy+sz*hz);if(u<0||u>1)continue;
     const qx_=sy*e1z-sz*e1y,qy_=sz*e1x-sx*e1z,qz_=sx*e1y-sy*e1x,w=f*(dx*qx_+dy*qy_+dz*qz_);if(w<0||u+w>1)continue;const t=f*(e2x*qx_+e2y*qy_+e2z*qz_);if(t>tMin&&t<best){best=t;hit=ti;}}}}
  if(hit<0)return null;const i=G.info[G.ID[hit]];return {d:+(best*len).toFixed(1),of:+len.toFixed(1),at:[+(px+dx*best).toFixed(1),+(py+dy*best).toFixed(1),+(pz+dz*best).toFixed(1)],what:i.mesh+':'+i.mat.replace('Material','')+(i.inst?':inst':'')};}
 /* three points on a car: middle, nose, tail */
 const _s={};
 function carPts(code,t){const c=code==='SC'?K.SC:K.carBy[code],s=K.carState(c,t,_s),y=s.y||0,fx=Math.sin(s.h),fz=Math.cos(s.h);return [[s.x,y+.6,s.z],[s.x+fx*2.3,y+.45,s.z+fz*2.3],[s.x-fx*2.3,y+.5,s.z-fz*2.3]];}
 const fromCam=(p,m)=>ray(camera.position.x,camera.position.y,camera.position.z,p[0],p[1],p[2],m);
 function at(codes){const t=S.now(),out=[];for(const code of codes){carPts(code,t).forEach((p,k)=>{const h=fromCam(p);if(h)out.push([code,['mid','nose','tail'][k],h]);});}return out;}
 const subjects=name=>/^Safety car/.test(name)?['SC','HAM','VER']:/crew|Fireworks/i.test(name)?null:/Cool-down|Last corner|The line/.test(name)?['VER']:['VER','HAM'];
 /* plays every director shot (or those whose name matches `only`) from its first to its last moment in steps of dt and casts the rays at every step */
 function director(dt,only){dt=dt||.1;CAM.select(null);CAM.set('director');const rep=[];
  for(const sh of CAM.SHOTS){if(only&&!only.test(sh.name))continue;const subj=subjects(sh.name);if(!subj){rep.push([sh.name,'skipped']);continue;}let bad=0,tot=0,badT=0,nT=0;const ex=[];
   S.seek(sh.t0+.02);S.tick(1,1/60);
   for(let t=sh.t0+.05;t<sh.t1-.03;t+=dt){S.tick(1,dt);const tt=S.now();if(tt>=sh.t1-.004)break;let any=false;nT++;
    for(const code of subj){const st=K.carState(code==='SC'?K.SC:K.carBy[code],tt,{});if(code==='SC'?!st.out:!st.vis)continue;const pts=carPts(code,tt);pts.push([st.x,(st.y||0)+.95,st.z]);
     pts.forEach((p,j)=>{tot++;const h=fromCam(p);if(h){bad++;any=true;if(ex.length<3)ex.push({t:+tt.toFixed(2),code,part:j,h});}});}
    if(any)badT++;}
   rep.push([sh.name+' '+sh.t0.toFixed(1)+'-'+sh.t1.toFixed(1),bad+'/'+tot+' rays, '+badT+'/'+nT+' steps'].concat(ex));}
  return rep;}
 /* are the followed cars in the picture, and how large: plays every director shot like director() and projects the cars. Per shot:
    [name, steps, per car the share of steps inside the middle 90 % of the picture (and the first time it is not), size of the first
    car = its length as a share of the picture height, smallest..largest] */
 function framing(dt,only){dt=dt||.1;CAM.select(null);CAM.set('director');const rep=[],v=new V3();
  for(const sh of CAM.SHOTS){if(only&&!only.test(sh.name))continue;const subj=subjects(sh.name);if(!subj)continue;const inF={},out={},seen={};let n=0,smin=9,smax=0;subj.forEach(c=>{inF[c]=0;seen[c]=0;out[c]=null;});
   S.seek(sh.t0+.02);S.tick(1,1/60);
   for(let t=sh.t0+.05;t<sh.t1-.03;t+=dt){S.tick(1,dt);const tt=S.now();if(tt>=sh.t1-.004)break;n++;camera.updateMatrixWorld(true);
    subj.forEach((code,k)=>{const st=K.carState(code==='SC'?K.SC:K.carBy[code],tt,{});if(code==='SC'?!st.out:!st.vis)return;seen[code]++;v.set(st.x,(st.y||0)+.6,st.z);const d=v.distanceTo(camera.position);v.project(camera);
     if(v.z<1&&Math.abs(v.x)<.9&&Math.abs(v.y)<.9)inF[code]++;else if(out[code]==null)out[code]=+tt.toFixed(2);
     if(k===0){const sz=2*Math.atan(2.8/d)/(camera.fov*Math.PI/180);if(sz<smin)smin=sz;if(sz>smax)smax=sz;}});}
   rep.push([sh.name+' '+sh.t0.toFixed(1)+'-'+sh.t1.toFixed(1),n,subj.map(c=>c+' '+(seen[c]?Math.round(100*inF[c]/seen[c]):'-')+'%'+(out[c]!=null?' (out '+out[c]+')':'')).join(', '),'size '+smin.toFixed(2)+'..'+smax.toFixed(2)]);}
  return rep;}
 /* which tv camera is in use: nearest of CAM.TVC / CAM.PVC to the camera */
 function camId(){let b='?',bd=4;CAM.TVC.forEach((q,i)=>{const d=Math.hypot(q.x-camera.position.x,q.y-camera.position.y,q.z-camera.position.z);if(d<bd){bd=d;b='T'+i+'@'+Math.round(q.s);}});
  CAM.PVC.forEach((q,i)=>{const d=Math.hypot(q.x-camera.position.x,q.y-camera.position.y,q.z-camera.position.z);if(d<bd){bd=d;b='P'+i+'@q'+Math.round(q.q);}});return b;}
 function tv(code,t0,t1,dt){dt=dt||.25;CAM.select(code);CAM.set('tv');S.seek(t0);S.tick(1,1/30);const by={};
  for(let t=t0;t<t1;t+=dt){S.tick(1,dt);const tt=S.now(),id=camId(),r=by[id]||(by[id]={n:0,part:0,full:0,ex:null});let b=0;carPts(code,tt).forEach(p=>{const h=fromCam(p);if(h){b++;if(!r.ex)r.ex={t:+tt.toFixed(1),h};}});r.n++;if(b)r.part++;if(b===3)r.full++;}
  return Object.keys(by).map(k=>[k,by[k].n,by[k].part,by[k].full,by[k].ex]);}
 function chase(code,t0,t1,dt){dt=dt||.2;CAM.select(code);CAM.set('chase');S.seek(t0);S.tick(1,1/30);const bad=[];let n=0;const c=code==='SC'?K.SC:K.carBy[code];
  for(let t=t0;t<t1;t+=dt){S.tick(1,dt);const tt=S.now(),s=K.carState(c,tt,{});if(!s.vis)continue;n++;const h=fromCam([s.x,(s.y||0)+.9,s.z],.8);if(h&&bad.length<40)bad.push({t:+tt.toFixed(1),type:s.type,d:Math.round(s.d),camY:+camera.position.y.toFixed(1),h});}
  return {samples:n,blocked:bad.length,bad};}
 /* try camera places beside the track: o = {s0, s1, ds, lats:[...], ys:[...], times:[...], codes:[...], dmin, dmax} */
 function search(o){const res=[],p={},codes=o.codes||['VER','HAM'],pts=[];for(const t of o.times)for(const code of codes)carPts(code,t).forEach(q=>pts.push(q));
  for(let s=o.s0;s<=o.s1;s+=o.ds||4)for(const lat of o.lats)for(const y of o.ys){K.trackPos(K.sw(s),lat,p);let bad=0,dmin=1e9,dmax=0;const ex=[];
   for(const q of pts){const d=Math.hypot(q[0]-p.x,q[1]-y,q[2]-p.z);if(d<dmin)dmin=d;if(d>dmax)dmax=d;const h=ray(p.x,y,p.z,q[0],q[1],q[2]);if(h){bad++;if(ex.length<1)ex.push(h);}}
   res.push({s:Math.round(s),lat,y,bad,of:pts.length,dmin:Math.round(dmin),dmax:Math.round(dmax),ex:ex[0]||null});}
  res.sort((a,b)=>a.bad-b.bad||a.dmax-b.dmax);return res.slice(0,o.top||12);}
 /* same, for places given as [x, y, z] */
 function searchXYZ(list,times,codes){const pts=[];for(const t of times)for(const code of codes||['VER','HAM'])carPts(code,t).forEach(q=>pts.push(q));
  return list.map(p=>{let bad=0,dmin=1e9,dmax=0,ex=null;for(const q of pts){const d=Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);if(d<dmin)dmin=d;if(d>dmax)dmax=d;const h=ray(p[0],p[1],p[2],q[0],q[1],q[2]);if(h){bad++;if(!ex)ex=h;}}return {p,bad,of:pts.length,dmin:Math.round(dmin),dmax:Math.round(dmax),ex};});}
 function points(list,from){const c=from||[camera.position.x,camera.position.y,camera.position.z];return list.map(p=>ray(c[0],c[1],c[2],p[0],p[1],p[2],.3));}
 /* track points a tv camera must see: from 40 m past the previous camera to 40 m past this one, every 2 m (a mast pole is thin),
    centre line and 4 m either side */
 function tvTargets(i,step){const T=CAM.TVC,c=T[i],prev=T[(i+T.length-1)%T.length],a=K.sw(prev.s+40),len=K.fwd(a,K.sw(c.s+40)),tg=[],q={};
  for(let d=0;d<=len;d+=step||2)for(const l of [0,-4,4]){K.trackPos(K.sw(a+d),l,q);tg.push([q.x,.6,q.z]);}return tg;}
 /* how much of its stretch each tv camera sees now: [index, s, blocked, of] */
 function tvNow(){return CAM.TVC.map((c,i)=>{const tg=tvTargets(i);let bad=0;for(const t of tg)if(ray(c.x,c.y,c.z,t[0],t[1],t[2],.3))bad++;return [i,Math.round(c.s),bad,tg.length];});}
 /* best place for tv cameras i0..i1-1: both sides, just inside the barrier or just behind it, three heights, shifted up to 32 m along the track */
 function tvPlan(i0,i1){const D=WORLD.dbg||{},HW=K.HW,T=CAM.TVC,res=[],p={};
  for(let i=i0;i<Math.min(i1,T.length);i++){const c=T[i],tg=tvTargets(i);let best=null;
   for(const ds of [0,-8,8,-16,16,-24,24,-32,32])for(const sd of [c.side,-c.side]){const s=K.sw(c.s+ds),idx=Math.round(s/K.DS)%K.TN,w=sd>0?(D.WL?D.WL[idx]:4.5):(D.WR?D.WR[idx]:4.5);
    for(const lat of [HW+clamp(w-1,1.2,3.4),HW+w+1.5])for(const y of [4.6,6.5,9]){K.trackPos(s,sd*lat,p);let bad=0;for(const t of tg)if(ray(p.x,y,p.z,t[0],t[1],t[2],.3))bad++;
     const cost=bad*100+Math.abs(ds)+(sd===c.side?0:6)+(y-4.6)*.5+(lat>HW+w?3:0);if(!best||cost<best.cost)best={i,cost:Math.round(cost),bad,of:tg.length,s:Math.round(s),lat:+(sd*lat).toFixed(1),y,w:+w.toFixed(1)};}}
   res.push(best);}return res;}
 /* fixed camera for a director shot: o = {s0, s1, ds, ys, t0, t1, dt, codes, offs:[metres beyond the track edge]}; places inside the
    paved corridor first (masts, palms and lamp posts are never there), then 1.5 m behind the barrier. Sorted: nothing in the way, then near. */
 function plan(o){const D=WORLD.dbg||{},HW=K.HW,res=[],p={},pts=[];for(let t=o.t0;t<=o.t1;t+=o.dt||.15)for(const code of o.codes||['VER','HAM']){if(code==='SC'&&!K.carState(K.SC,t,{}).out)continue;carPts(code,t).forEach(q=>pts.push(q));}
  for(let s=o.s0;s<=o.s1;s+=o.ds||8)for(const sd of [1,-1]){const ss=K.sw(s),idx=Math.round(ss/K.DS)%K.TN,w=sd>0?(D.WL?D.WL[idx]:4.5):(D.WR?D.WR[idx]:4.5),L=[[HW+clamp(w-1,1.2,3.4),0]];
   (o.offs||[]).forEach(f=>{if(f<w-.6)L.push([HW+f,0]);});L.push([HW+w+1.5,1]);
   for(const l of L)for(const y of o.ys||[4.6,6.5,9]){K.trackPos(ss,sd*l[0],p);let bad=0,sum=0,dmin=1e9,dmax=0;for(const q of pts){const d=Math.hypot(q[0]-p.x,q[1]-y,q[2]-p.z);sum+=d;if(d<dmin)dmin=d;if(d>dmax)dmax=d;if(ray(p.x,y,p.z,q[0],q[1],q[2]))bad++;}
    res.push({s:Math.round(ss),lat:+(sd*l[0]).toFixed(1),y,behind:l[1],bad,of:pts.length,mean:Math.round(sum/pts.length),dmin:Math.round(dmin),dmax:Math.round(dmax),w:+w.toFixed(1)});}}
  res.sort((a,b)=>a.bad-b.bad||a.behind-b.behind||a.mean-b.mean);return res.slice(0,o.top||10);}
 const corr=s=>{const D=WORLD.dbg||{},i=Math.round(K.sw(s)/K.DS)%K.TN;return [D.WL?+D.WL[i].toFixed(1):null,D.WR?+D.WR[i].toFixed(1):null];};
 window.__los={build,ray,at,director,framing,tv,chase,search,searchXYZ,points,carPts,tvNow,tvPlan,tvTargets,plan,corr,masts:()=>WORLD.masts,get grid(){return G;}};
}
