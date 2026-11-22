/* ================= p5_cam.js : cameras, input, picking, selection =================
   Owner: show. Exports CAM. Needs p1_engine.js and p3_actors.js (ACT).
   map: free overview, follows the selected car · chase: a camera attached to the selected car or the leader, with preset views (behind,
   front, left, right, above, onboard) that the user can drag round the car · tv: trackside cameras from kernel geometry ·
   director: scripted shots for the final lap keyed to race time read from the kernel; outside that window it behaves like tv.
   In every mode the structures listed in WORLD.seeThrough fade when they stand between the camera and the car that is looked at. */
const CAM=(()=>{
 const st={mode:'map',sel:null,MODES:['map','chase','tv','director'],VIEWS:['behind','front','left','right','above','onboard'],view:'behind',pickSafetyCar:true,shot:''};
 const subs=[],_o={},_ts={},_cs={},_v=new V3(),_v2=new V3(),_pv=new V3(),sv={},sh={},ssc={};
 const V=K.carBy.VER,H=K.carBy.HAM,TANH=Math.tan(15*PI/180),DEG=180/PI;
 const aspect=()=>camera.aspect||1,fovK=()=>{const a=aspect();return a<1?clamp(1/a,1,1.7):1;},zoomK=()=>{const a=aspect();return a<1?clamp(1/a,1,1.9):1;};

 /* ---------- circuit bounds and the home view ---------- */
 let bx0=1e9,bx1=-1e9,bz0=1e9,bz1=-1e9;for(let i=0;i<K.TN;i++){bx0=Math.min(bx0,K.TX[i]);bx1=Math.max(bx1,K.TX[i]);bz0=Math.min(bz0,K.TZ[i]);bz1=Math.max(bz1,K.TZ[i]);}
 const CX=(bx0+bx1)/2,CZ=(bz0+bz1)/2;
 /* the part of the window that no dashboard panel covers, when the dashboard says so (UI.safe() in CSS pixels); null otherwise */
 const rect=()=>canvas.getBoundingClientRect();
 function safeRect(){try{if(typeof UI!=='undefined'&&UI&&typeof UI.safe==='function'){const s=UI.safe();if(s&&s.right-s.left>40&&s.bottom-s.top>40)return s;}}catch(e){}return null;}
 function homeView(){const a=aspect(),port=a<.9,yaw=port?.24:1.2,pitch=port?1.02:.86,rx=Math.cos(yaw),rz=-Math.sin(yaw),ux=-Math.sin(yaw),uz=-Math.cos(yaw);
  /* extent of the circuit along the screen's right and up directions for this yaw */
  let r0=1e9,r1=-1e9,u0=1e9,u1=-1e9;for(let i=0;i<K.TN;i+=4){const r=K.TX[i]*rx+K.TZ[i]*rz,u=K.TX[i]*ux+K.TZ[i]*uz;if(r<r0)r0=r;if(r>r1)r1=r;if(u<u0)u0=u;if(u>u1)u1=u;}
  const rc=(r0+r1)/2,uc=(u0+u1)/2,W=(r1-r0)/2+40,Hh=((u1-u0)/2+40)*Math.sin(pitch);
  /* fit it into the free part of the window, but never zoom out more than about twice for that */
  const s=safeRect(),R=rect(),fw=s?clamp((s.right-s.left)/Math.max(1,R.width),.62,1):1,fh=s?clamp((s.bottom-s.top)/Math.max(1,R.height),.55,1):1;
  return {x:rc*rx+uc*ux,z:rc*rz+uc*uz,yaw,pitch,dist:clamp(1.2*Math.max(W/(TANH*a*fw),Hh/(TANH*fh)),900,6200)};}
 /* chase: where the followed car is in the picture, in pixels of the unshifted window (carExt), from a few points of its outline:
    nose, front wing ends, the four wheels on the ground, top of the airbox, rear wing ends (x = the car's left, y, z = ahead) */
 const vo={x:0,y:0},HULL=[0,.25,2.85,.98,.05,2.6,-.98,.05,2.6,1,0,2.1,-1,0,2.1,1,0,-2.2,-1,0,-2.2,0,1,-.5,.52,.96,-2.75,-.52,.96,-2.75],ext={x0:0,x1:0,y0:0,y1:0,ok:false};let keepOn=false;
 function carExt(s,W,Hh){camera.updateMatrixWorld();const f=Hh/2/Math.tan(camera.fov*PI/360),ch=Math.cos(s.h),sn=Math.sin(s.h),y=s.y||0;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;ext.ok=false;
  for(let i=0;i<HULL.length;i+=3){const lx=HULL[i],lz=HULL[i+2];_pv.set(s.x+ch*lx+sn*lz,y+HULL[i+1],s.z-sn*lx+ch*lz).applyMatrix4(camera.matrixWorldInverse);if(_pv.z>-.3)return;
   const px=W/2+_pv.x/-_pv.z*f,py=Hh/2-_pv.y/-_pv.z*f;if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;}
  ext.x0=x0;ext.x1=x1;ext.y0=y0;ext.y1=y1;ext.ok=true;}
 /* shift the picture so that the camera's aim lands in the middle of that free part (all modes); eased, and limited to 30 % of the window */
 let vpW=0,vpH=0;   /* window size as applySafe last saw it (the chase camera frames the car with it, without asking the layout again) */
 function applySafe(dt){const R=rect(),W=Math.round(R.width),Hh=Math.round(R.height),s=safeRect();let tx=0,ty=0;vpW=W;vpH=Hh;
  if(s&&W>50&&Hh>50){tx=clamp((s.left+s.right)/2-W/2,-W*.3,W*.3);ty=clamp((s.top+s.bottom)/2-Hh/2,-Hh*.3,Hh*.3);
   /* chase: the car itself must stay clear of the panels too. Behind the car the camera aims well ahead of it, so the car sits low in
      the picture and would end up under the timing panel; the picture is then shifted a little further (centred if the car is too big) */
   if(keepOn&&ext.ok){let lo=s.top+8-ext.y0,hi=s.bottom-8-ext.y1;ty=clamp(lo<=hi?clamp(ty,lo,hi):(lo+hi)/2,-Hh*.38,Hh*.38);
    lo=s.left+10-ext.x0;hi=s.right-10-ext.x1;tx=clamp(lo<=hi?clamp(tx,lo,hi):(lo+hi)/2,-W*.38,W*.38);}}
  const k=dt>0?1-Math.exp(-dt*5):1;vo.x+=(tx-vo.x)*k;vo.y+=(ty-vo.y)*k;const ox=Math.round(vo.x),oy=Math.round(vo.y),v=camera.view;
  if(!ox&&!oy){if(v&&v.enabled)camera.clearViewOffset();}
  else if(!v||!v.enabled||v.offsetX!==-ox||v.offsetY!==-oy||v.fullWidth!==W||v.fullHeight!==Hh)camera.setViewOffset(W,Hh,-ox,-oy,W,Hh);}
 const rig={t:new V3(CX,0,CZ),yaw:1.2,pitch:.86,dist:2400,goal:null,follow:false},foc={x:CX,y:0,z:CZ,dist:2400},camLook=new V3(CX,0,CZ);
 let inited=false,cut='',chaseH=0,chaseZ=1,chaseC=null,tvZ=1,realT=0,tvCur=null,shotI=-2;
 function setProj(fov,near,far){if(Math.abs(camera.fov-fov)>.02||camera.near!==near||camera.far!==far){camera.fov=fov;camera.near=near;camera.far=far;camera.updateProjectionMatrix();}}
 function camApply(){const cp=Math.cos(rig.pitch);camera.position.set(rig.t.x+rig.dist*Math.sin(rig.yaw)*cp,rig.t.y+rig.dist*Math.sin(rig.pitch),rig.t.z+rig.dist*Math.cos(rig.yaw)*cp);camera.lookAt(rig.t);}
 /* place the camera; kp = 0 puts it exactly, otherwise it eases there; the look target always eases unless snap */
 function shoot(px,py,pz,tx,ty,tz,fov,near,snap,kp,kl,dt){_v.set(px,py,pz);if(snap||!kp)camera.position.copy(_v);else camera.position.lerp(_v,1-Math.exp(-dt*kp));
  _v2.set(tx,ty,tz);if(snap)camLook.copy(_v2);else camLook.lerp(_v2,1-Math.exp(-dt*(kl||12)));
  setProj(clamp(fov*fovK(),4,75),near,9000);camera.lookAt(camLook);foc.x=camLook.x;foc.y=camLook.y;foc.z=camLook.z;foc.dist=camera.position.distanceTo(camLook);}

 /* ---------- see-through structures ----------
    WORLD.seeThrough lists what can hide a car: the start gantry, the bridges over the track, the hotel bridge and canopy, the grandstand
    roofs; each with a box, convex test volumes (lists of planes nx,ny,nz,d) or a test of its own, and set(opacity). Every frame the
    camera that ran says what it looks at: one to three cars (seeCar: five points along each, so a nose or a tail under a beam counts
    too) or one point (seePoint). A structure that a segment from the camera to one of those points goes through fades to SEE_LOW
    within a quarter of a second and comes back the same way once it no longer blocks. Nothing is allocated per frame. */
 const SEE=(typeof WORLD!=='undefined'&&WORLD&&WORLD.seeThrough)||[],SEE_LOW=.12,SEE_RATE=(1-SEE_LOW)/.25,seeHold=new Float32Array(SEE.length),SEE_MAX=21,seeP=new Float32Array(SEE_MAX*3);
 let seeN=0,seeCut=false,sT0=0,sT1=1;
 /* adds a car to what is looked at: five points along it; at speed two more ahead of it, where it will be within the quarter second that a fade takes */
 function seeCar(s){const fx=Math.sin(s.h),fz=Math.cos(s.h),y=(s.y||0)+.55,ld=clamp((s.v||0)*.25,0,24),n=ld>2.6?7:5;if(seeN+n>SEE_MAX)return;
  for(let i=0;i<n;i++){const d=i<5?(i-2)*1.3:2.6+ld*(i-4)*.5,k=(seeN+i)*3;seeP[k]=s.x+fx*d;seeP[k+1]=y;seeP[k+2]=s.z+fz*d;}seeN+=n;}
 function seePoint(x,y,z){seeP[0]=x;seeP[1]=y;seeP[2]=z;seeN=1;}
 const slab=(lo,hi,a,d)=>{if(d>-1e-9&&d<1e-9)return a>=lo&&a<=hi;let u=(lo-a)/d,v=(hi-a)/d;if(u>v){const w=u;u=v;v=w;}if(u>sT0)sT0=u;if(v<sT1)sT1=v;return sT0<=sT1;};
 /* does the segment a -> a + d, up to the share t1 of it, meet the box [x0,y0,z0,x1,y1,z1] / go through the convex volume pl */
 const segBox=(b,ax,ay,az,dx,dy,dz,t1)=>{sT0=0;sT1=t1;return slab(b[0],b[3],ax,dx)&&slab(b[1],b[4],ay,dy)&&slab(b[2],b[5],az,dz);};
 function segVol(pl,ax,ay,az,dx,dy,dz,t1){let t0=0;for(let i=0;i<pl.length;i+=4){const nx=pl[i],ny=pl[i+1],nz=pl[i+2],den=nx*dx+ny*dy+nz*dz,dist=nx*ax+ny*ay+nz*az-pl[i+3];
   if(den>-1e-9&&den<1e-9){if(dist>0)return false;continue;}const t=-dist/den;if(den<0){if(t>t0)t0=t;}else if(t<t1)t1=t;if(t0>t1)return false;}return true;}
 function seeBlocked(e){const cx=camera.position.x,cy=camera.position.y,cz=camera.position.z;
  for(let i=0;i<seeN;i++){const dx=seeP[i*3]-cx,dy=seeP[i*3+1]-cy,dz=seeP[i*3+2]-cz,len=Math.hypot(dx,dy,dz);if(len<1.5)continue;const t1=1-Math.min(.5,.8/len);   /* stop just short of the car */
   if(!segBox(e.box,cx,cy,cz,dx,dy,dz,t1))continue;
   if(e.hit){if(e.hit(cx,cy,cz,cx+dx*t1,cy+dy*t1,cz+dz*t1))return true;continue;}
   for(let k=0;k<e.vols.length;k++)if(segVol(e.vols[k],cx,cy,cz,dx,dy,dz,t1))return true;}
  return false;}
 /* a structure stays see-through for 0.4 s after it last blocked, so that it does not come and go between two cars of a group */
 function updSee(dt,snap){for(let i=0;i<SEE.length;i++){const e=SEE[i];if(seeN&&seeBlocked(e))seeHold[i]=.4;else if(seeHold[i]>0)seeHold[i]=snap?0:seeHold[i]-dt;
   const g=seeHold[i]>0?SEE_LOW:1,o=e.opacity;if(o!==g)e.set(snap?g:o<g?Math.min(g,o+dt*SEE_RATE):Math.max(g,o-dt*SEE_RATE));}}
 const faded=()=>{const o=[];for(const e of SEE)if(e.opacity<.99)o.push(e.name);return o;};
 /* is a point of the ground on the circuit or in the pit lane (tarmac plus a few metres either side) */
 function onRoad(x,z){const r2=(K.HW+5)*(K.HW+5);for(let i=0;i<K.TN;i+=3){const dx=K.TX[i]-x,dz=K.TZ[i]-z;if(dx*dx+dz*dz<r2)return true;}
  for(let i=0;i<=K.PN;i+=3){const dx=K.PX[i]-x,dz=K.PZ[i]-z;if(dx*dx+dz*dz<64)return true;}return false;}

 /* ---------- trackside cameras ----------
    A camera place is [distance along the lap, lateral (+ = left of travel), height]. Every place below was chosen and then checked with
    the line-of-sight test of the show test pages (show_los.js: tvPlan, plan, director, tv) against the real scenery. Wherever it works the
    camera stands inside the paved corridor, just in front of the barrier: floodlight masts, palms and lamp posts are then behind it and
    nothing can stand between it and the cars it covers. If the circuit geometry in the kernel ever changes, run that test again. */
 const at=(s,lat,y)=>{K.trackPos(K.sw(s),lat,_o);return {s:K.sw(s),x:_o.x,y,z:_o.z,side:lat>0?1:-1};};
 /* tv cameras: one near every corner (Turns 6/7 share one), more along the straights and wherever a floodlight mast on the inside of
    a bend would otherwise stand in the view (Turn 3, exit of Turn 9); each covers the track up to 40 m past itself. The Turn 5 camera
    is the place of the director's shot of the pass. */
 const TVC=[[135,-8.9,4.6],[316,-10.4,4.6],[564,-10.4,4.6],[690,10.4,4.6],[804,10.4,4.6],[984,-10.4,4.6],[1188,10.4,4.6],[K.cornerS(5)-22,-(K.HW+13),9],[1631,10.4,4.6],[1869,-10.4,4.6],[2108,10.4,4.6],
  [2346,-10.4,4.6],[2577,10.4,4.6],[2799,-10.4,4.6],[3002,10.4,6.5],[3205,-10.4,4.6],[3408,10.4,4.6],[3611,-26.5,4.6],[3730,-10.4,4.6],[3822,-10.4,4.6],[4033,10.4,4.6],[4161,10.4,4.6],
  [4303,10.4,4.6],[4411,-10.4,4.6],[4533,-10.4,4.6],[4688,10.4,4.6],[4842,10.4,4.6],[5040,10.4,4.6],[5236,-8.8,4.6]].map(a=>at(a[0],a[1],a[2]));
 /* pit lane cameras: q, lateral offset, height (null = just above the road, for the tunnel) */
 const PVC=[[90,6,6],[250,6.6,6.5],[400,6.6,6.5],[540,6.6,6.5],[640,-5,4.6],[745,2.6,null],[880,-6,5.5],[1080,-7,6]].map(a=>{K.pitPos(a[0],a[1],_o);return {q:a[0],x:_o.x,z:_o.z,y:a[2]==null?_o.y+2.3:a[2]};});
 function tvPick(s){if(s.type===1){for(const q of PVC)if(q.q>=s.d-30)return q;return PVC[PVC.length-1];}const d=K.sw(s.d);for(const q of TVC)if(q.s>=d-40)return q;return TVC[0];}

 /* ---------- which car the cameras follow ---------- */
 const WIN=K.order(K.T_FIN+.01)[0].c,alive=(c,s)=>c===K.SC?!!s.out:!!s.vis;
 function leader(rt){if(rt>=K.T_FIN)return WIN;let best=null,bd=-1e18;for(const c of K.cars){const p=K.prog(c,rt,_o);if(p.type===2||p.seg.gone||p.seg.wreck)continue;if(p.D>bd){bd=p.D;best=c;}}return best||WIN;}
 function target(rt){const c=st.sel;if(c&&alive(c,K.carState(c,rt,_ts)))return c;return leader(rt);}

 /* ---------- the three manual cameras ---------- */
 function tickMap(rt,dt,jumped){const c=st.sel;let fol=false;
  if(rig.follow&&c){const s=K.carState(c,rt,_ts);if(alive(c,s)){fol=true;const k=jumped?1:1-Math.exp(-dt*8);rig.t.x=lerp(rig.t.x,s.x,k);rig.t.z=lerp(rig.t.z,s.z,k);rig.t.y=lerp(rig.t.y,Math.max(0,s.y||0),k);}}
  if(!fol)rig.t.y=lerp(rig.t.y,0,1-Math.exp(-dt*3));
  const g=rig.goal;if(g){const k=1-Math.exp(-dt*(g.fast?9:3.2));if(g.x!==undefined&&!fol){rig.t.x=lerp(rig.t.x,g.x,k);rig.t.z=lerp(rig.t.z,g.z,k);}
   if(g.dist!==undefined)rig.dist=lerp(rig.dist,g.dist,k);if(g.yaw!==undefined)rig.yaw+=angd(rig.yaw,g.yaw)*k;if(g.pitch!==undefined)rig.pitch=lerp(rig.pitch,g.pitch,k);
   if((g.x===undefined||fol||Math.hypot(rig.t.x-g.x,rig.t.z-g.z)<.6)&&(g.dist===undefined||Math.abs(rig.dist-g.dist)<1)&&(g.yaw===undefined||Math.abs(angd(rig.yaw,g.yaw))<.004)&&(g.pitch===undefined||Math.abs(rig.pitch-g.pitch)<.004))rig.goal=null;}
  rig.t.x=clamp(rig.t.x,bx0-900,bx1+900);rig.t.z=clamp(rig.t.z,bz0-900,bz1+900);
  setProj(30,clamp(rig.dist*.025,1.5,40),14000);camApply();foc.x=rig.t.x;foc.y=rig.t.y;foc.z=rig.t.z;foc.dist=rig.dist;
  /* what the map camera looks at, for the see-through test: the selected car while it is in the picture; without one, the point in the
     middle of the view when that point is on the circuit or in the pit lane (so roofs and the canopy stay when the user looks at them) */
  let car=false;if(c){const s=K.carState(c,rt,_ts);if(alive(c,s)){camera.updateMatrixWorld();_pv.set(s.x,(s.y||0)+.6,s.z).project(camera);if(_pv.z<1&&_pv.x>-1.05&&_pv.x<1.05&&_pv.y>-1.05&&_pv.y<1.05){seeCar(s);car=true;}}}
  if(!car&&onRoad(rig.t.x,rig.t.z))seePoint(rig.t.x,rig.t.y+.5,rig.t.z);}
 /* behind a car: the camera swings on a smoothed heading, so it never falls back at speed */
 function chaseCam(rt,dt,snap,c,back,up,fov){const s=K.carState(c,rt,_cs),y=s.y||0;if(snap)chaseH=s.h;else chaseH+=angd(chaseH,s.h)*(1-Math.exp(-dt*6));seeCar(s);
  const fx=Math.sin(s.h),fz=Math.cos(s.h);shoot(s.x-Math.sin(chaseH)*back,y+up,s.z-Math.cos(chaseH)*back,s.x+fx*9,y+.9,s.z+fz*9,fov,.35,snap,0,16,dt);foc.x=s.x;foc.y=y;foc.z=s.z;foc.dist=70;}
 function tvCam(rt,dt,snap,c){const s=K.carState(c,rt,_cs),q=tvPick(s);if(q!==tvCur){tvCur=q;snap=true;seeCut=true;}seeCar(s);
  const y=(s.y||0)+.6,d=Math.hypot(q.x-s.x,q.y-y,q.z-s.z);shoot(q.x,q.y,q.z,s.x,y,s.z,clamp(2*Math.atan(9/d)*DEG*tvZ,5,46),.5,snap,0,14,dt);}

 /* ---------- chase: a camera attached to the followed car, which the user can move ----------
    A view is a place on an orbit round the car: yaw (0 = behind, PI = ahead, minus = on the car's left), pitch above the ground,
    distance, lens. A drag adds to yaw and pitch (orb.dy, orb.dp) and the wheel scales the distance (chaseZ); choosing a view clears
    all three. The orbit turns with a smoothed heading, as the chase camera always did, so the picture stays steady when the car turns.
    'behind' without offsets is the former chase view exactly. 'onboard' sits where the T-camera is, above the driver's head, fixed
    to the car and looking along it; there a drag turns the view (orb.ly, orb.lp) and the wheel changes the lens (orb.lz). */
 const VW={behind:{yaw:0,pitch:Math.atan2(2.5,7.6),dist:Math.hypot(7.6,2.5),fov:58},front:{yaw:PI,pitch:.2,dist:8.4,fov:52},left:{yaw:-PI/2,pitch:.16,dist:7.4,fov:50},
  right:{yaw:PI/2,pitch:.16,dist:7.4,fov:50},above:{yaw:0,pitch:1.3,dist:17,fov:42},onboard:{yaw:0,pitch:0,dist:1,fov:64}};
 const PMIN=.05,PMAX=1.5,DMIN=4.2,DMAX=38,LYM=1.3,LP0=-.22,LP1=.45,orb={dy:0,dp:0,cy:0,cp:VW.behind.pitch,cd:VW.behind.dist,cf:58,ly:0,lp:0,lz:1,kl:1,hc:40,kr:0,fit:1};
 /* where the camera may stand and still see the car. Beside the car there is a barrier with a catch fence (3.5 m), `sd` metres away:
    the camera is fine inside it, or beyond it when it is high enough for the sight line to the car to clear the fence (0.6 + 3 * its
    distance / sd). A camera that wants to be lower and further out than that is brought in to the barrier (LIM.k scales its horizontal
    distance; the lens opens to make up for it), then lifted along the fence, then let out again along that clearance line (LIM.r = the
    height it needs), so a side view becomes a view over the fence where the car runs close to a wall. Next to the garages and in the
    pit-exit trench there is no way over: there the camera only comes closer (LIM.hard). LIM.h caps the height under the tunnel roof.
    Widths come from the stage (WORLD.dbg.WL / WR) when it has them, and from PIT in the pit lane. */
 const WB=(typeof WORLD!=='undefined'&&WORLD&&WORLD.dbg)||null,LIM={k:1,h:40,r:0,hard:false};
 function room(s,hz,up,rel){let k=1,h=40,r=0,L=1e9,R=1e9,hard=false;const lo=-hz*Math.sin(rel),al=-hz*Math.cos(rel);   /* the camera's offset to the car's left, and ahead of it */
  if(s.type===0){if(WB&&WB.WL&&WB.WR&&!s.alt){const i=((Math.round(K.sw(s.d+al*.5)/K.DS)%K.TN)+K.TN)%K.TN;L=K.HW+WB.WL[i]-.8-s.lat;R=K.HW+WB.WR[i]-.8+s.lat;}}
  else if(s.type===1){const q=s.d,dip=K.pitY(q)<-.4;let g=dip?4.2:q>PIT.wallQ0&&q<PIT.wallQ1?7:4.5;
   if(g===7)for(let i=0;i<K.TEAMS.length;i++)if(Math.abs(q-K.TEAMS[i].boxQ)<7.5){g=-PIT.garageLat+5.6;break;}   /* in front of an open garage the camera may stand inside it */
   L=(dip?4.2:4.5)-s.lat;R=g+s.lat;hard=dip||lo<0;
   if(K.pitY(q)<=-4.6||K.pitY(q+14)<=-4.6||K.pitY(q+al)<=-4.6){h=-1-(s.y||0);hard=true;}}
  const sd=Math.max(.6,lo>0?L:R),a=Math.abs(lo);
  if(sd<1e8&&a>sd&&up<.6+3*a/sd){
   if(hard)k=Math.max(sd/a,Math.min(1,3/hz));
   else{const u=clamp((3.6-up)/2.4,0,1),rho=a/sd-1;let a2=sd;
    if(rho>.3*u){a2=sd*(1+rho-.3*u);r=.6+3*a2/sd;if(r>9){r=9;a2=sd*2.8;}}else if(rho>.12*u)r=lerp(up,3.6,(rho-.12*u)/(.18*u));
    k=a2/a;}}
  LIM.k=k;LIM.h=Math.max(1.2,h);LIM.r=r;LIM.hard=hard;return LIM;}
 /* the car's own matrix (ACT has placed it this frame): position, heading and the pitch on the tunnel ramps */
 const OBJ=new Map(),_ob=new V3(),_ot=new V3(),_m4=new THREE.Matrix4(),_eu=new THREE.Euler(0,0,0,'YXZ');
 try{ACT.cars.forEach(a=>OBJ.set(a.c,a.obj));if(ACT.sc)OBJ.set(K.SC,ACT.sc.obj);}catch(e){}
 function onboard(c,s,dt){const o=OBJ.get(c),sc=c===K.SC,py=sc?1.5:1.1,pz=sc?-.02:-.26,cp=Math.cos(orb.lp);let M=o&&o.visible&&o.matrix?o.matrix:null;
  if(!M){_eu.set(s.type===1?-Math.atan2(K.pitY(s.d+1.8)-K.pitY(s.d-1.8),3.6):0,s.h,0);M=_m4.makeRotationFromEuler(_eu).setPosition(s.x,s.y||0,s.z);}
  _ob.set(0,py,pz).applyMatrix4(M);_ot.set(Math.sin(orb.ly)*cp*30,py+(Math.sin(orb.lp)-.07)*30,pz+Math.cos(orb.ly)*cp*30).applyMatrix4(M);
  shoot(_ob.x,_ob.y,_ob.z,_ot.x,_ot.y,_ot.z,VW.onboard.fov*orb.lz,.1,true,0,0,dt);foc.x=s.x;foc.y=s.y||0;foc.z=s.z;foc.dist=70;}
 function orbitCam(rt,dt,snap,c){const s=K.carState(c,rt,_cs),y=s.y||0,g=VW[st.view]||VW.behind;seeCar(s);
  if(snap)chaseH=s.h;else chaseH+=angd(chaseH,s.h)*(1-Math.exp(-dt*6));
  if(st.view==='onboard'){onboard(c,s,dt);return;}
  if(!vpW){const R_=rect();vpW=Math.round(R_.width);vpH=Math.round(R_.height);}
  const k=snap?1:1-Math.exp(-dt*10),kk=snap?1:1-Math.exp(-dt*8),sr=safeRect(),Wp=vpW,Hp=vpH;
  orb.cy+=(g.yaw+orb.dy-orb.cy)*k;orb.cp+=(clamp(g.pitch+orb.dp,PMIN,PMAX)-orb.cp)*k;orb.cd+=(clamp(g.dist*chaseZ,DMIN,DMAX)-orb.cd)*k;orb.cf+=(g.fov-orb.cf)*k;
  /* behind the car the camera looks ahead of it, as before; from the side, the front or above it looks at the car */
  const a=chaseH+orb.cy,w=Math.pow(Math.max(0,Math.cos(orb.cy)),2)*(1-sstep(.45,1.2,orb.cp)),fx=Math.sin(s.h),fz=Math.cos(s.h);
  for(let pass=snap?4:1;pass>0;pass--){const cd=clamp(orb.cd*orb.fit,DMIN,DMAX);let hz=cd*Math.cos(orb.cp),up=Math.max(.5,cd*Math.sin(orb.cp));const L=room(s,hz,up,a-s.h);
   /* closer because of a barrier: the lens opens so that the car keeps its size; over the fence: at least as high as the sight line needs */
   const stuck=L.hard;orb.kl+=(L.k-orb.kl)*kk;orb.hc+=(L.h-orb.hc)*kk;orb.kr+=(L.r-orb.kr)*kk;const ks=Math.min(1,orb.kl);hz*=ks;up=Math.min(Math.max(up,orb.kr),orb.hc);
   const fv=ks<.999?2*Math.atan(Math.tan(orb.cf*PI/360)*Math.min(1.5,1/ks))*DEG:orb.cf;
   /* the aim eases as it always did behind the car; where the camera looks at the car itself it is rigid, or the car would run out of the picture at speed */
   shoot(s.x-Math.sin(a)*hz,y+up,s.z-Math.cos(a)*hz,s.x+fx*9*w,y+lerp(.62,.9,w),s.z+fz*9*w,fv,.35,snap,0,16+(1-w)*500,dt);
   /* the whole car has to fit into the free part of the window: if it does not at the view's own distance, the camera backs off
      (orb.fit, never below 1; the user's own zoom is left alone, and nothing is added while a wall holds the camera close) */
   carExt(s,Wp,Hp);
   if(ext.ok&&Wp>50&&Hp>50){const aw=Math.max(60,(sr?sr.right-sr.left:Wp)-28),ah=Math.max(60,(sr?sr.bottom-sr.top:Hp)-20),r=Math.max((ext.x1-ext.x0)/aw,(ext.y1-ext.y0)/ah)*clamp(orb.cd/g.dist,.2,5);
    let tf=orb.fit;if(r>1||r<.93)tf=clamp(orb.fit*r/.97,1,3);if(stuck&&ks<.98&&tf>orb.fit)tf=orb.fit;orb.fit=snap?tf:orb.fit+(tf-orb.fit)*(1-Math.exp(-dt*5));}}
  foc.x=s.x;foc.y=y;foc.z=s.z;foc.dist=70;keepOn=true;}
 function setView(v){if(!VW[v])return st.view;const was=st.view;st.view=v;orb.dy=orb.dp=0;chaseZ=1;orb.ly=orb.lp=0;orb.lz=1;
  if(v==='onboard'||was==='onboard')cut='';else orb.cy=VW[v].yaw+angd(VW[v].yaw,orb.cy);return v;}   /* into or out of the car is a cut; the others swing the short way round */
 function orbitBy(dyaw,dpitch,direct){const g=VW[st.view]||VW.behind,p0=g.pitch+orb.dp,p1=clamp(p0+dpitch,PMIN,PMAX);orb.dy+=dyaw;orb.dp=p1-g.pitch;
  if(direct){orb.cy+=dyaw;orb.cp=clamp(orb.cp+p1-p0,PMIN,PMAX);}if(orb.dy>TAU||orb.dy<-TAU){const w=orb.dy>0?-TAU:TAU;orb.dy+=w;orb.cy+=w;}}
 function lookBy(left,upw){orb.ly=clamp(orb.ly+left,-LYM,LYM);orb.lp=clamp(orb.lp+upw,LP0,LP1);}
 /* the chase offset: read it, or set it (yaw and pitch in radians on top of the view's own, yaw > 0 towards the car's right; distance
    in metres). Onboard, yaw > 0 looks left and pitch > 0 looks up. */
 const num=v=>typeof v==='number'&&isFinite(v);
 function orbitApi(yaw,pitch,dist){const g=VW[st.view]||VW.behind;
  if(st.view==='onboard'){if(num(yaw))orb.ly=clamp(yaw,-LYM,LYM);if(num(pitch))orb.lp=clamp(pitch,LP0,LP1);return {view:st.view,yaw:+orb.ly.toFixed(4),pitch:+orb.lp.toFixed(4),dist:0,lens:+orb.lz.toFixed(3)};}
  if(num(yaw))orb.dy=yaw;if(num(pitch))orb.dp=clamp(g.pitch+pitch,PMIN,PMAX)-g.pitch;if(num(dist)&&dist>0)chaseZ=clamp(dist,DMIN,DMAX)/g.dist;
  return {view:st.view,yaw:+orb.dy.toFixed(4),pitch:+orb.dp.toFixed(4),dist:+clamp(g.dist*chaseZ,DMIN,DMAX).toFixed(2),fit:+orb.fit.toFixed(3)};}   /* fit: how much the camera has backed off to get the whole car into the free part of the window */

 /* ---------- director: the final lap ---------- */
 const SHOTS=[],RB=K.teamByCode.RBR,q0=RB?RB.boxQ:K.Q_LINE+40,tL=H.cum[56],tF=K.T_FIN,tP=K.tPass;
 const pitP=(q,lat,y)=>{K.pitPos(q,lat,_o);return {x:_o.x,y,z:_o.z};};
 /* fixed camera aimed at a point; the lens follows the distance so that about R metres fit above and below the target */
 function fixed(P,tx,ty,tz,R,fmin,fmax,snap,dt,kl){const d=Math.hypot(P.x-tx,P.y-ty,P.z-tz);shoot(P.x,P.y,P.z,tx,ty,tz,clamp(2*Math.atan(R/d)*DEG,fmin,fmax),.5,snap,0,kl||12,dt);}
 const mx=w=>lerp(sv.x,sh.x,w),mz=w=>lerp(sv.z,sh.z,w);
 /* fixed camera on a group of cars, L[0] being the one it stays with. Another car is in the picture while the angle between it and
    L[0], seen from the camera, is small enough for the lens (full weight up to 0.5 rad, none from 0.85 rad); the camera aims at the
    weighted middle and opens the lens to hold all of them plus R metres around the nearest. So two cars coming at the camera are both
    in the picture, the camera pans with the first as it goes by, and the second comes back in once it has passed too. `up` lifts the
    aim above the cars by that share of the picture height (of the free part of the window), for the scenery behind them. */
 const _g=[{},{},{}],_pc={x:0,y:36,z:0},VH=[sv,sh],QUE=[sh,ssc,sv];
 function group(P,L,R,fmin,fmax,snap,dt,up){const n=L.length,a=_g[0];let dx=0,dy=0,dz=0,ws=0;
  for(let i=0;i<n;i++){const b=L[i],g=_g[i];g.x=b.x-P.x;g.y=(b.y||0)+.7-P.y;g.z=b.z-P.z;g.d=Math.hypot(g.x,g.y,g.z)||1;g.x/=g.d;g.y/=g.d;g.z/=g.d;
   g.w=i?1-sstep(.5,.85,Math.acos(clamp(g.x*a.x+g.y*a.y+g.z*a.z,-1,1))):1;dx+=g.x*g.w;dy+=g.y*g.w;dz+=g.z*g.w;ws+=g.w;}
  const dl=Math.hypot(dx,dy,dz)||1;dx/=dl;dy/=dl;dz/=dl;let half=0,dn=a.d,d=0;
  for(let i=0;i<n;i++){const g=_g[i];half=Math.max(half,g.w*Math.acos(clamp(g.x*dx+g.y*dy+g.z*dz,-1,1)));dn=Math.min(dn,lerp(a.d,g.d,g.w));d+=g.d*g.w;}
  d/=ws;const fov=clamp(2*(half+Math.atan(R/dn))*DEG,fmin,fmax);let lift=0;
  if(up){const s=safeRect();lift=d*Math.tan(up*(s?clamp((s.bottom-s.top)/Math.max(1,rect().height),.25,1):1)*Math.min(75,fov*fovK())/DEG);}
  shoot(P.x,P.y,P.z,P.x+dx*d,P.y+dy*d+lift,P.z+dz*d,fov,.5,snap,0,40,dt);for(let i=0;i<n;i++)seeCar(L[i]);}
 try{
  const cs=n=>K.cornerS(n),C_=n=>K.CORNERS[n-1],tA=s=>K.timeAtS(V,58,s);
  const bis=(f,a,b)=>{for(let i=0;i<44;i++){const m=(a+b)/2;if(f(m))b=m;else a=m;}return (a+b)/2;};
  const tSC=s=>bis(t=>{K.scProg(t,_o);return _o.type===1||_o.D>=56*K.TLEN+s;},H.cum[55]-4,K.scTP);
  /* fixed cameras of the final lap, each relative to its corner (see the note on camera places above); E = track edge.
     Turn 5: outside of the hairpin, 22 m before the apex, 13 m out in the run-off, 9 m up. From there the two cars come straight at the
     camera, go side by side through the apex 20 to 30 m away and leave to the right, with the grandstand behind them; the masts on the
     inside of the hairpin are never between the camera and the cars (checked every 0.02 s from 4.2 s before to 2.6 s after the pass).
     Marina: on the infield side of the straight after Turn 9, 1.8 m from the track edge, 5 m up: the cars come out of the hairpin, pass
     in front of the yachts and palms and go away to Turn 10. It takes over once both cars are clear of the masts in the hairpin.
     Hotel: two low cameras (3.5 m) inside the barrier on the outside of the track. The first stands at Turn 13: the cars come at it from
     Turn 12, pass a few metres away in front of the west block and go away under the bridge. The second stands 70 m after Turn 14 and
     looks back: the cars come round the corner with the bridge and the lit canopy of the east wing behind them (the second car is
     behind the corner of the west block for the first 0.4 s of that shot). */
  const E=K.HW,P_T5=at(cs(5)-22,-(E+13),9),P_T6=at(cs(6)+15,E+3.4,6.5),P_T9=at(cs(9)+13,-(E+17),15),P_M1=at(cs(10)-79,E+1.8,5),P_M2=at(cs(11)+33,E+3.4,9),
   P_HA=at(cs(13)+3,-(E+3.4),3.5),P_HB=at(cs(14)+70,-(E+3.4),3.5),P_T16=at(cs(16)-112,E+3.4,6.5);
  /* where one camera hands over to the next, as distances along the lap */
  const s9M=cs(9)+193,sM=cs(10)+46,sQ=cs(10)+105,sH1=cs(12)+21,sH2=cs(13)+120,sH3=cs(14)+141,sH4=cs(14)+74;
  /* on the approach side of the start gantry, just above its light panel */
  const P_GAN=(()=>{K.trackPos(-3,-1.2,_o);return {x:_o.x,y:PIT.gantryY+2.1,z:_o.z};})();
  /* pit wall positions around the Red Bull crew (they stand along q0 +/- 11 m at the wall) */
  const P_CREW=pitP(q0+7,-2.4,1.75),T_CREW=pitP(q0-1,5,2.0),P_WALL=pitP(q0+15,PIT.wallLat+2.5,2.3),T_WALL=pitP(q0-26,PIT.wallLat+2.9,1.7),T_CEL=pitP(q0-22,6.6,2.5),P_LOW=pitP(q0+8.2,.9,.7),T_LOW=pitP(q0+6.2,5.2,3.7);
  const WC={x:K.TX[0]+110,z:K.TZ[0]+120};
  const orbit=(yaw,R,hgt,ty,fov,snap,dt)=>shoot(WC.x+Math.sin(yaw)*R,hgt,WC.z+Math.cos(yaw)*R,WC.x,ty,WC.z,fov,8,snap,0,4,dt);
  const add=(name,t0,t1,fn)=>{if(t1-t0>=.8)SHOTS.push({name,t0,t1,fn});};
  const tPeel=K.scTP;
  /* the safety-car queue comes round on the same trackside cameras that later show the last lap */
  add('Safety car queue, marina',tSC(cs(10)-110),tSC(sQ),(rt,dt,snap)=>group(P_M1,QUE,9,6,44,snap,dt,.1));
  add('Safety car queue, Turn 11',tSC(sQ),tSC(sH1),(rt,dt,snap)=>group(P_M2,QUE,10,6,44,snap,dt));
  add('Safety car queue, hotel',tSC(sH1),tSC(sH2),(rt,dt,snap)=>group(P_HA,QUE,7.5,12,46,snap,dt,.18));
  add('Safety car queue, Turn 14',tSC(sH2),tSC(sH3),(rt,dt,snap)=>group(P_HB,QUE,7.5,12,46,snap,dt,.18));
  /* from above and behind Verstappen, over the middle of the track (the mast heads stay out to the sides): the safety car ahead turns
     off into the pit entry, Hamilton and the queue stay on the track. Moving cameras are placed exactly every frame. */
  add('Safety car into the pit lane',tSC(sH3),tPeel+5.5,(rt,dt,snap)=>{const v=sv,fx=Math.sin(v.h),fz=Math.cos(v.h);
   _pc.x=v.x-fx*60+fz*3;_pc.z=v.z-fz*60-fx*3;group(_pc,QUE,9,20,46,true,dt);});
  add('Restart',tPeel+5.5,tL-.5,(rt,dt,snap)=>fixed(P_GAN,mx(.6),.7,mz(.6),6.5,5,40,snap,dt));
  add('Chase into Turn 5',tL-.5,tP-4.2,(rt,dt,snap)=>chaseCam(rt,dt,snap,V,9.2,3.1,56));
  add('The pass, Turn 5',tP-4.2,tP+4.9,(rt,dt,snap)=>fixed(P_T5,mx(.5),.7,mz(.5),12,8,44,snap,dt));
  /* low, beside the track and inside the barrier, moving along just ahead of Verstappen and looking back at the two cars */
  add('Back straight',tP+4.9,tA(cs(6)-330),(rt,dt,snap)=>{K.trackPos(K.sw(sv.d+8),-(E+2.6),_o);shoot(_o.x,2.4,_o.z,mx(.45),.8,mz(.45),46,.5,true,0,0,dt);});
  add('Turn 6 and Turn 7',tA(cs(6)-330),tA(cs(7)+70),(rt,dt,snap)=>fixed(P_T6,mx(.5),.7,mz(.5),12,6,54,snap,dt));
  add('Chase to Turn 9',tA(cs(7)+70),tA(cs(9)-250),(rt,dt,snap)=>chaseCam(rt,dt,snap,H,9.5,3.2,54));
  add('The fight into Turn 9',tA(cs(9)-250),tA(s9M),(rt,dt,snap)=>fixed(P_T9,mx(.5),.7,mz(.5),13,6,42,snap,dt));
  add('Marina',tA(s9M),tA(sM),(rt,dt,snap)=>group(P_M1,VH,9,6,44,snap,dt,.1));
  add('Turn 11 and Turn 12',tA(sM),tA(sH1),(rt,dt,snap)=>group(P_M2,VH,10,6,42,snap,dt));
  add('Hotel section, Turn 13',tA(sH1),tA(sH2),(rt,dt,snap)=>group(P_HA,VH,7.5,12,46,snap,dt,.18));
  add('Hotel section, Turn 14',tA(sH2),tA(sH4),(rt,dt,snap)=>group(P_HB,VH,7.5,12,46,snap,dt,.18));
  add('Red Bull crew at the pit wall',tA(sH4),tF-8.8,(rt,dt,snap)=>shoot(P_CREW.x,P_CREW.y,P_CREW.z,T_CREW.x,T_CREW.y,T_CREW.z,40,.3,snap,0,6,dt));
  add('Last corner',tF-8.8,tF-4.2,(rt,dt,snap)=>fixed(P_T16,sv.x,.7,sv.z,10,6,40,snap,dt));
  /* on the track side of the wall, level with the crew hanging on the fence: the car comes at the camera under the gantry and the flag */
  add('The line, from the pit wall',tF-4.2,tF+2.8,(rt,dt,snap)=>shoot(P_WALL.x,P_WALL.y,P_WALL.z,T_WALL.x,T_WALL.y,T_WALL.z,48,.2,snap,0,6,dt));
  add('Red Bull crew celebrates',tF+2.8,tF+9,(rt,dt,snap)=>{const u=clamp((rt-tF-2.8)/6.2,0,1),e=pitP(q0+13.5+u*2.5,2.6-u*.8,2.25);shoot(e.x,e.y,e.z,T_CEL.x,T_CEL.y,T_CEL.z,46,.3,snap,0,6,dt);});
  /* low enough that the bursts stand against the sky, high enough to see the pit straight below them */
  add('Fireworks, wide',tF+9,tF+26,(rt,dt,snap)=>orbit(.25+(rt-tF-9)*.005,780,105,92,30,snap,dt));
  add('Crew and fireworks',tF+26,tF+40,(rt,dt,snap)=>shoot(P_LOW.x,P_LOW.y,P_LOW.z,T_LOW.x,T_LOW.y,T_LOW.z,56,.2,snap,0,6,dt));
  add('Fireworks over the circuit',tF+40,tF+96,(rt,dt,snap)=>orbit(-.95+(rt-tF-40)*.008,820,120,98,30,snap,dt));
  add('Cool-down lap',tF+96,K.TEND+1,(rt,dt,snap)=>tvCam(rt,dt,snap,V));
  /* two short cutaways to the Red Bull crew, cut into the shots above: walking out to the pit wall, and the reaction to the pass */
  const cutIn=(name,t0,t1,fn)=>{if(!(t1-t0>=1.2))return;for(const s of SHOTS.slice()){if(s.t1<=t0||s.t0>=t1)continue;
    if(s.t0<t0&&s.t1>t1){SHOTS.push({name:s.name,t0:t1,t1:s.t1,fn:s.fn});s.t1=t0;}else if(s.t0<t0)s.t1=t0;else if(s.t1>t1)s.t0=t1;else s.t1=s.t0;}
   SHOTS.push({name,t0,t1,fn});for(let i=SHOTS.length-1;i>=0;i--)if(SHOTS[i].t1-SHOTS[i].t0<.8)SHOTS.splice(i,1);};
  const tW=ACT.RB&&isFinite(ACT.RB.tW)?ACT.RB.tW:tL+2,P_OUT=pitP(q0-9,3.3,1.7),T_OUT=pitP(q0+2.5,-4.6,1.1);
  cutIn('Red Bull crew to the pit wall',clamp(tW+1.6,tL+2,tP-9),clamp(tW+1.6,tL+2,tP-9)+3,(rt,dt,snap)=>shoot(P_OUT.x,P_OUT.y,P_OUT.z,T_OUT.x,T_OUT.y,T_OUT.z,44,.3,snap,0,6,dt));
  cutIn('Red Bull crew reacts',tP+2.1,tP+4.9,(rt,dt,snap)=>shoot(P_CREW.x,P_CREW.y,P_CREW.z,T_CREW.x,T_CREW.y+.2,T_CREW.z,42,.3,snap,0,6,dt));
  SHOTS.sort((a,b)=>a.t0-b.t0);
  /* the cars a fixed shot is about, for the see-through test (see director) */
  const ABOUT={'Restart':VH,'The pass, Turn 5':VH,'Back straight':VH,'Turn 6 and Turn 7':VH,'The fight into Turn 9':VH,'Last corner':[sv],'The line, from the pit wall':[sv]};
  for(const s of SHOTS)s.cars=ABOUT[s.name]||null;
 }catch(e){SHOTS.length=0;if(window.console)console.warn('director shots not built',e);}
 function director(rt,dt,snap){let i=-1;for(let k=0;k<SHOTS.length;k++)if(rt>=SHOTS[k].t0&&rt<SHOTS[k].t1){i=k;break;}
  if(i<0){if(shotI!==-1){snap=true;seeCut=true;}shotI=-1;tvCam(rt,dt,snap,target(rt));st.shot='';return;}
  if(i!==shotI){shotI=i;snap=true;tvCur=null;seeCut=true;}
  K.carState(V,rt,sv);K.carState(H,rt,sh);K.carState(K.SC,rt,ssc);SHOTS[i].fn(rt,dt,snap);st.shot=SHOTS[i].name;
  /* see-through test: group, chase and tv shots have said which cars they are about; the other shots on the two title rivals are listed
     in ABOUT; shots of the crew and the fireworks are about no car, and nothing fades for them */
  const ab=SHOTS[i].cars;if(!seeN&&ab)for(let k=0;k<ab.length;k++)seeCar(ab[k]);}

 /* ---------- selection ring ---------- */
 const ringM=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:false,fog:false});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1,64),ringM);ring.rotation.x=-PI/2;ring.visible=false;ring.renderOrder=5;scene.add(ring);
 const ring2=new THREE.Mesh(new THREE.RingGeometry(.95,1,64),ringM.clone());ring2.rotation.x=-PI/2;ring2.visible=false;ring2.renderOrder=5;scene.add(ring2);
 function updRing(rt){const c=st.sel;let on=false;if(c&&st.mode==='map'){const s=K.carState(c,rt,_ts);if(alive(c,s)){on=true;const r=Math.max(4.4,rig.dist*.015),y=(s.y||0)+.18;
   ring.position.set(s.x,y,s.z);ring.scale.setScalar(r*(1.03+.03*Math.sin(realT*5)));const f=(realT*.8)%1;ring2.position.set(s.x,y,s.z);ring2.scale.setScalar(r*(1.05+f*.5));ring2.material.opacity=(1-f)*.6;}}
  ring.visible=ring2.visible=on;}

 /* ---------- per frame ---------- */
 function tick(rt,dt,jumped){dt=dt||0;realT+=dt;if(!inited){inited=true;const h=homeView();rig.t.set(h.x,0,h.z);rig.yaw=h.yaw;rig.pitch=h.pitch;rig.dist=h.dist;}
  const m=st.mode;let snap=!!jumped||cut!==m;cut=m;seeN=0;seeCut=false;keepOn=false;
  if(m==='map'){tickMap(rt,dt,!!jumped);st.shot='';}
  else if(m==='chase'){const c=target(rt);if(c!==chaseC){chaseC=c;snap=true;}orbitCam(rt,dt,snap,c);st.shot='';}   /* another car: a cut, not a swing */
  else if(m==='tv'){tvCam(rt,dt,snap,target(rt));st.shot='';}
  else director(rt,dt,snap);
  applySafe(dt);updRing(rt);updSee(dt,snap||seeCut);}

 /* ---------- steps for the on-screen pad and the keyboard ----------
    nudge(a, k): a = 'rl' / 'rr' rotate left / right (the scene turns anticlockwise / clockwise, as a drag to the right / left does),
    'tu' / 'td' tilt up (lower, towards the horizon) / down (higher, more from above), 'zi' / 'zo' zoom in / out, 'rs' reset.
    k scales the step (repeats while a button is held use less). Returns false when the step means nothing in the current mode:
    map and chase take all of them, tv and director only zoom and reset. Onboard, rotate and tilt turn the view. */
 function resetView(){const m=st.mode;
  if(m==='map'){const h=homeView();rig.goal=st.sel&&rig.follow?{dist:220*zoomK(),yaw:h.yaw,pitch:h.pitch,fast:true}:{x:h.x,z:h.z,dist:h.dist,yaw:h.yaw,pitch:h.pitch};}
  else if(m==='chase'){const g=VW[st.view]||VW.behind;orb.dy=orb.dp=0;chaseZ=1;orb.ly=orb.lp=0;orb.lz=1;orb.cy=g.yaw+angd(g.yaw,orb.cy);}
  else tvZ=1;}
 function nudge(a,k){k=k>0?k:1;const m=st.mode,ry=a==='rl'?-1:a==='rr'?1:0,rp=a==='tu'?-1:a==='td'?1:0,zf=a==='zi'?Math.pow(.86,k):a==='zo'?Math.pow(1/.86,k):0;
  if(a==='rs'){resetView();return true;}
  if(m==='map'){if(!(ry||rp||zf))return false;const g=rig.goal||(rig.goal={});g.fast=true;
   if(ry)g.yaw=(g.yaw!==undefined?g.yaw:rig.yaw)+ry*.12*k;if(rp)g.pitch=clamp((g.pitch!==undefined?g.pitch:rig.pitch)+rp*.07*k,.2,1.45);
   if(zf)g.dist=clamp((g.dist!==undefined?g.dist:rig.dist)*zf,28,6500);return true;}
  if(zf){zoomBy(zf);return true;}
  if(m==='chase'&&(ry||rp)){if(st.view==='onboard')lookBy(-ry*.12*k,-rp*.07*k);else orbitBy(ry*.12*k,rp*.07*k,false);return true;}
  return false;}

 /* ---------- selection, areas ---------- */
 function setSel(c,fly){c=c||null;const ch=c!==st.sel;st.sel=c;rig.follow=!!c;
  if(c){ringM.color.copy(C(c.team.ui)).lerp(new THREE.Color(1,1,1),.35);ring2.material.color.copy(ringM.color);if(fly!==false&&st.mode==='map')rig.goal={dist:Math.min(rig.dist,220*zoomK())};}
  if(ch)subs.forEach(f=>f(st.sel));}
 function select(code){setSel(!code?null:typeof code==='string'?(code==='SC'?K.SC:K.carBy[code]||null):code);}
 const AREAS=(()=>{const A=(label,x,z,dist,yaw,pitch)=>({label,x,z,dist,yaw,pitch}),c=n=>K.CORNERS[n-1],o={};K.trackPos(K.sw(-30),-6,o);
  /* start/finish: from ahead of the grid and a little to the grandstand side, looking back down the straight between the grandstand roof
     and the pit building: grid, gantry, pit wall, pit lane and garage fronts are all in view */
  return {start:A('Start/finish',o.x,o.z,310,K.TH[0]+.42,.68),t5:A('Turn 5',c(5).x+10,c(5).z+60,330,.5,.78),chicane:A('Chicane',(c(6).x+c(7).x)/2,(c(6).z+c(7).z)/2,300,-1.9,.72),
   marsa:A('Turn 9',c(9).x-60,c(9).z-40,420,2.5,.75),hotel:A('Hotel',(c(12).x+c(14).x)/2+20,(c(12).z+c(14).z)/2,420,1.25,.7)};})();
 function set(m){if(st.MODES.indexOf(m)<0)return;const was=st.mode;st.mode=m;
  if(m==='map'&&was!=='map'&&st.sel){rig.follow=true;rig.goal={dist:Math.min(rig.dist,220*zoomK())};}}
 function flyTo(k){const a=AREAS[k];if(!a)return;set('map');setSel(null);rig.goal={x:a.x,z:a.z,dist:a.dist*zoomK(),yaw:a.yaw,pitch:a.pitch};}
 function home(){set('map');setSel(null);const h=homeView();rig.goal={x:h.x,z:h.z,dist:h.dist,yaw:h.yaw,pitch:h.pitch};}
 /* finish any fly-to at once (tests, or a boot that wants no opening move) */
 function snapNow(){const g=rig.goal;if(!g)return;if(g.x!==undefined){rig.t.x=g.x;rig.t.z=g.z;}if(g.dist!==undefined)rig.dist=g.dist;if(g.yaw!==undefined)rig.yaw=g.yaw;if(g.pitch!==undefined)rig.pitch=g.pitch;rig.goal=null;}

 /* ---------- picking in screen space ---------- */
 function pickAt(x,y){const R=rect(),W=R.width,Hh=R.height,tf=2*Math.tan(camera.fov*PI/360);let best=null,bs=1e9;
  const test=(a)=>{if(!a.live)return;const p=a.obj.position;_pv.set(p.x,p.y+.6,p.z);const depth=_pv.distanceTo(camera.position);_pv.project(camera);if(_pv.z>1||_pv.z<-1)return;
   const sx=(_pv.x*.5+.5)*W,sy=(-_pv.y*.5+.5)*Hh,rp=Math.max(MOBILE?24:14,3.2*Hh/(tf*depth)*.85),d=Math.hypot(sx-x,sy-y);if(d<rp&&d/rp<bs){bs=d/rp;best=a.c;}};
  ACT.cars.forEach(test);if(st.pickSafetyCar)test(ACT.sc);return best;}

 /* ---------- pointer, wheel and touch on the canvas ---------- */
 const ptrs=new Map();let drag=null,pinch=null,hovT=0;
 const pinchState=()=>{const a=[...ptrs.values()];return {d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),a:Math.atan2(a[1].y-a[0].y,a[1].x-a[0].x),cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2};};
 function panBy(dx,dy){const k=2*rig.dist*TANH/Math.max(1,rect().height),rx=Math.cos(rig.yaw),rz=-Math.sin(rig.yaw),fx=-Math.sin(rig.yaw),fz=-Math.cos(rig.yaw),f=dy*k/Math.max(.3,Math.sin(rig.pitch));
  rig.t.x+=-rx*dx*k+fx*f;rig.t.z+=-rz*dx*k+fz*f;rig.follow=false;if(rig.goal){delete rig.goal.x;delete rig.goal.z;}}
 const zoomBy=f=>{if(st.mode==='map'){rig.dist=clamp(rig.dist*f,28,6500);if(rig.goal)delete rig.goal.dist;}
  else if(st.mode==='chase'){if(st.view==='onboard')orb.lz=clamp(orb.lz*f,.55,1.17);else{const d=(VW[st.view]||VW.behind).dist;chaseZ=clamp(chaseZ*f,DMIN/d,DMAX/d);}}
  else tvZ=clamp(tvZ*f,.45,2.2);};
 canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId);}catch(_){}const R=rect();ptrs.set(e.pointerId,{x:e.clientX-R.left,y:e.clientY-R.top});
  if(ptrs.size===1)drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,rot:e.button===2||e.ctrlKey||e.shiftKey,t:performance.now(),moved:false};else if(ptrs.size===2){pinch=pinchState();if(drag)drag.moved=true;}});
 canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId),R=rect();
  if(!p){const n=performance.now();if(n-hovT<70||e.pointerType==='touch')return;hovT=n;canvas.style.cursor=pickAt(e.clientX-R.left,e.clientY-R.top)?'pointer':st.mode==='map'||st.mode==='chase'?'grab':'default';return;}
  p.x=e.clientX-R.left;p.y=e.clientY-R.top;
  if(ptrs.size===2&&pinch){const n=pinchState();zoomBy(pinch.d/Math.max(8,n.d));if(st.mode==='map'){rig.yaw+=angd(pinch.a,n.a);panBy(n.cx-pinch.cx,n.cy-pinch.cy);if(rig.goal){delete rig.goal.yaw;}}
   else if(st.mode==='chase'&&st.view!=='onboard')orbitBy(angd(pinch.a,n.a),0,true);pinch=n;return;}
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>5)drag.moved=true;if(!drag.moved)return;
  /* chase: any drag looks round the car (onboard: turns the view, the picture follows the pointer) */
  if(st.mode==='chase'){if(st.view==='onboard')lookBy(dx*.0042,dy*.003);else orbitBy(-dx*.006,dy*.005,true);return;}
  if(st.mode!=='map')return;
  if(drag.rot){rig.yaw-=dx*.006;rig.pitch=clamp(rig.pitch+dy*.005,.2,1.45);if(rig.goal){delete rig.goal.yaw;delete rig.goal.pitch;}}else panBy(dx,dy);});
 const pUp=e=>{const p=ptrs.get(e.pointerId);if(!ptrs.delete(e.pointerId))return;
  if(ptrs.size===0){if(drag&&!drag.moved&&performance.now()-drag.t<650&&e.type==='pointerup'){const c=pickAt(p.x,p.y);setSel(c);}drag=null;pinch=null;}
  else{pinch=null;const q=[...ptrs.values()][0],R=rect();drag={x:q.x+R.left,y:q.y+R.top,sx:q.x+R.left,sy:q.y+R.top,rot:false,t:0,moved:true};}};
 canvas.addEventListener('pointerup',pUp);canvas.addEventListener('pointercancel',pUp);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(clamp(e.deltaY,-120,120)*.0014));},{passive:false});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());

 /* new with the chase views and the see-through structures: VIEWS and view (the chase preset), setView(name), orbit() / orbit(yaw, pitch,
    dist), nudge(step, scale), faded() -> names of the structures that are see-through now, see = WORLD.seeThrough */
 return Object.assign(st,{tick,set,select,flyTo,home,AREAS,SHOTS,TVC,PVC,snap:snapNow,pickAt,onSelect(f){subs.push(f);},focus:()=>foc,rig,
  setView,orbit:orbitApi,nudge,faded,see:SEE});
})();
