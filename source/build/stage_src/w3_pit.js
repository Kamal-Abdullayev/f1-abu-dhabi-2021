
/* ================= PIT COMPLEX =================
   Pit-path coordinates: q along the pit path, lat + = left of travel = toward the race track on the main straight.
   Layout numbers come from PIT (p1_engine.js) and K (boxQ, Q_LINE, limiter lines, pitY); nothing is copied. */
const P3=(q,lat,y)=>{K.pitPos(q,lat,o1);return [o1.x,y,o1.z];};
const pNrm=q=>{const j=Math.max(0,Math.min(PN,Math.round(q/PDS)));return [K.PNX[j],K.PNZ[j]];};
const pTan=q=>{const h=pHead(q);return [Math.sin(h),Math.cos(h)];};
/* vertical quad between two pit points; hint +1 / -1 = faces toward +lat / -lat, or an [x, z] direction */
function pv(b,q0,l0,q1,l1,y0,y1,c,hint){const a=P3(q0,l0,y0),d=P3(q1,l1,y0),n=pNrm((q0+q1)/2),hx=Array.isArray(hint)?hint[0]:n[0]*hint,hz=Array.isArray(hint)?hint[1]:n[1]*hint;bq(b,a,d,[d[0],y1,d[2]],[a[0],y1,a[2]],c,hx,0,hz);}
/* horizontal quad q0..q1 x l0..l1 at height y (down = seen from below) */
function ph(b,q0,q1,l0,l1,y,c,down){const a=P3(q0,l0,y),b2=P3(q0,l1,y),c2=P3(q1,l1,y),d=P3(q1,l0,y);if(down)bq(b,a,b2,c2,d,c,0,-1,0);else quad(b,a,b2,c2,d,c);}
function pbox(b,q,lat,across,hgt,along,y,c){K.pitPos(q,lat,o1);b.box(across,hgt,along,o1.x,y,o1.z,c,o1.h);}
function pRect(q,lat,across,along,c){K.pitPos(q,lat,o1);const h=o1.h,tx=Math.sin(h),tz=Math.cos(h),nx=tz,nz=-tx,x=o1.x,z=o1.z,a=across/2,l=along/2,y=o1.y+Y.mark;
 quad(MK,[x+nx*a-tx*l,y,z+nz*a-tz*l],[x-nx*a-tx*l,y,z-nz*a-tz*l],[x-nx*a+tx*l,y,z-nz*a+tz*l],[x+nx*a+tx*l,y,z+nz*a+tz*l],c);}
/* wall line in pit coordinates: face at lat(q), body extends toward out (+1 / -1) */
function pLine(q0,q1,latF,out,step){const pts=[],n=Math.max(1,Math.ceil((q1-q0)/(step||4)));for(let k=0;k<=n;k++){const q=q0+(q1-q0)*k/n,p=pq(q,latF(q)),nn=pNrm(q);pts.push([p[0],p[1],nn[0]*out,nn[1]*out]);}return pts;}
const TEAMS=K.TEAMS.slice().sort((a,b)=>a.boxQ-b.boxQ),QB0=TEAMS[0].boxQ,QB1=TEAMS[TEAMS.length-1].boxQ,GSTEP=(QB1-QB0)/(TEAMS.length-1),GW=PIT.garageW,GL0=PIT.garageLat,NBLANK=5;
const BLD0=QB0-NBLANK*GSTEP-GSTEP/2,BLD1=QB1+GSTEP/2+31,BLDD=27,BLDH=12.6;
const laneL=q=>q<QW0-10?4.7:q<=QW1?lerp(4.7,5.05,sstep(QW0-10,QW0,q)):q<TR.q1?lerp(5.05,TR.inL(q)+.05,sstep(QW1,TR.q0,q)):lerp(4.75,5.05,sstep(TR.q1,TR.q1+20,q));
const laneR=q=>q<QW0?5.05:q<BLD1-10?lerp(5.05,-GL0+.1,sstep(QW0,QW0+40,q)):q<TR.q1?lerp(-GL0+.1,TR.inR(q)+.05,sstep(BLD1-10,BLD1,q)):lerp(4.75,5.05,sstep(TR.q1,TR.q1+20,q));
/* lane surface, entry to exit, following the dip (this is also the trench floor) */
for(let j=0;j<PN;j++){const q0=j*PDS,q1=(j+1)*PDS,y0=K.pitY(q0)+Y.pit,y1=K.pitY(q1)+Y.pit;quad(PL,P3(q0,laneL(q0),y0),P3(q0,-laneR(q0),y0),P3(q1,-laneR(q1),y1),P3(q1,laneL(q1),y1),Q.pitT);}
/* paddock apron behind the pit building */
for(let q=BLD0-40;q<BLD1+16;q+=12)ph(AP,q,q+12,GL0-BLDD+1,GL0-BLDD-36,Y.apron,Q.apron);
/* paint: fast-lane lines, limiter lines, timing line, one box per team */
for(let q=QW0+8;q<QW1-4;q+=4){pRect(q+2,-2.05,.16,4,Q.white);if(((q/4)|0)%2)pRect(q+2,2.6,.14,4,Q.white);}
for(const q of [K.Q_LIM0,K.Q_LIM1])pRect(q,-1.3,12.4,.3,Q.white);
pRect(K.Q_LINE,-1.3,12.4,.5,Q.white);
/* speed-limit sign (plain "80", the pit limit in km/h) at the limiter line, facing the cars coming in: hung on the pit-lane side of the
   pit-wall fence, above head height, so the strip between wall and track and the wall top stay free */
{const q=K.Q_LIM0-1.5,t=pTan(q),p=P3(q,PIT.wallLat-.92,2.6);B.box(1.74,.86,.06,p[0]+t[0]*.03,2.17,p[2]+t[1]*.03,Q.dark,pHead(q));panel(p[0]-t[0]*.02,2.6,p[2]-t[1]*.02,.8,.36,-t[0],-t[1],ATL.cell(5));}
TEAMS.forEach(t=>{const c=C(t.ui),q=t.boxQ,l=K.BOXLAT;pRect(q,l+1.55,.18,7.2,c);pRect(q,l-1.55,.18,7.2,c);pRect(q+3.6,l,3.28,.18,c);pRect(q-3.6,l,3.28,.18,c);pRect(q+2.9,l,2.2,.3,Q.white);});

/* ---------- walls: pit wall with fence, outer wall of the entry, trench parapets, divider after the tunnel ---------- */
wallLine(pLine(QW0,TR.c0,q=>q<=QW1?5.05:lerp(5.05,TR.inL(q),sstep(QW1,TR.q0,q)),1,4),PIT.wallTop,.5,Q.wallW,PIT.fenceTop,Q.wall);
{const p=pq(QW0,5.3);B.cyl(.27,PIT.wallTop,p[0],-.1,p[1],Q.wallW,8);}
wallLine(pLine(QW0-3,BLD0,q=>-laneR(q),-1,4),1.0,.5,Q.wall,3.2,Q.wallW);
wallLine(pLine(BLD1,TR.c0,q=>-TR.inR(q),-1,3),PIT.wallTop,.5,Q.wall,3.2,Q.wallW);
wallLine(pLine(TR.c1,TR.q1,q=>TR.inL(q),1,3),PIT.wallTop,.5,Q.wall,3.2,Q.wallW);
{let qe=TR.q1;for(let q=TR.q1;q<PLEN;q+=2){const p=pq(q,-5.6);nearT(p[0],p[1]);if(nD<HW+1.1)break;qe=q;}
 wallLine(pLine(TR.c1,qe,q=>q<TR.q1?-TR.inR(q):-lerp(4.75,5.05,sstep(TR.q1,TR.q1+20,q)),-1,3),PIT.wallTop,.5,Q.wall,3.2,Q.wallW);STAT.divEnd=qe;}
/* trench: retaining walls down to the road, a lit tunnel where it is covered, portals */
{const CEIL=-.6;for(let q=TR.q0;q<TR.q1;q+=2){const q1=Math.min(q+2,TR.q1),cov=q>=TR.c0&&q1<=TR.c1+.01,b=cov?IN:B,c=cov?Q.inter:Q.conc,top=cov?CEIL:0,y=Math.min(K.pitY(q),K.pitY(q1))-.15;
  pv(b,q,TR.inL(q),q1,TR.inL(q1),y,top,c,-1);pv(b,q,-TR.inR(q),q1,-TR.inR(q1),y,top,c,1);
  if(cov){ph(IN,q,q1,TR.inL(q),-TR.inR(q),CEIL,Q.conc,true);if((Math.round(q)>>1)%4===0){const p=P3(q+1,0,CEIL-.12);LP.box(2.4,.1,.5,p[0],p[1],p[2],P.white,pHead(q));glow(p[0],p[1]-.1,p[2],cWht,1);}}}
 for(const e of [[TR.c0,-1],[TR.c1,1]]){const q=e[0],t=pTan(q),w=TR.inL(q)+TR.wall,r=TR.inR(q)+TR.wall;pv(B,q,w,q,-r,CEIL,0,Q.concD,[t[0]*e[1],t[1]*e[1]]);
  const a=pq(q,w),b2=pq(q,-r);wallLine([[a[0],a[1],-t[0]*e[1],-t[1]*e[1]],[b2[0],b2[1],-t[0]*e[1],-t[1]*e[1]]],PIT.wallTop,.5,Q.wall,3.2);}}

/* ---------- pit building: garages (five blank ones first), upper floor, roof; team name as plain text above each door ---------- */
{const OW=GW/2-1.2,OH=4.3,GH=PIT.garageH,RD_=7,segs=[];for(let g=-NBLANK;g<TEAMS.length;g++)segs.push({q:QB0+g*GSTEP,t:g>=0?TEAMS[g]:null});
 const tW=C(0xf3f1ec),tG=C(0x7b7c80),tC=C(0xbfc0c2),shut=C(0xc9cbce);
 segs.forEach(s=>{const q=s.q,t=s.t,a=q-GSTEP/2,b=q+GSTEP/2,n=pNrm(q);
  /* front: pillars, fascia with the name, door or shutter */
  pbox(B,q-(OW+GSTEP/2)/2,GL0-.4,.8,GH,GSTEP/2-OW,0,tW);pbox(B,q+(OW+GSTEP/2)/2,GL0-.4,.8,GH,GSTEP/2-OW,0,tW);
  pbox(B,q,GL0-.25,.5,GH-OH,2*OW,OH,tW);
  if(t){const tc=C(t.ui);pbox(B,q,GL0+.02,.06,.32,2*OW,OH,tc);
   const p=P3(q,GL0+.03,OH+.32+(GH-OH-.32)/2);panel(p[0],p[1],p[2],7.2,.56,n[0],n[1],ATL.team(K.TEAMS.indexOf(t)));
   /* open garage: lit interior */
   ph(IN,q-OW,q+OW,GL0,GL0-RD_,.01,tG);pv(IN,q-OW,GL0-RD_,q+OW,GL0-RD_,0,OH,Q.inter,1);pv(IN,q-OW,GL0-RD_+.04,q+OW,GL0-RD_+.04,2.5,3.2,tc,1);
   const tt=pTan(q);pv(IN,q-OW,GL0,q-OW,GL0-RD_,0,OH,tC,tt);pv(IN,q+OW,GL0,q+OW,GL0-RD_,0,OH,tC,[-tt[0],-tt[1]]);ph(IN,q-OW,q+OW,GL0,GL0-RD_,OH,tC,true);
   const lp=P3(q,GL0-2.2,OH-.16);LP.box(.5,.1,2*OW-3,lp[0],lp[1],lp[2],P.white,pHead(q));glow(lp[0],OH-.4,lp[2],cWht,1);
   /* timing stand at the pit wall: roof on four posts, desk on the wall; people stand at PIT.standLat under it */
   for(const dq of [-2.4,2.4])for(const dl of [3.5,4.75])pbox(B,q+dq,dl,.07,2.5,.07,0,Q.steel);pbox(B,q,4.12,1.5,.1,5.2,2.5,tW);pbox(B,q,3.38,.05,.24,5.2,2.34,tc);pbox(B,q,4.9,.26,.2,4.6,.95,Q.dark);}
  else pbox(B,q,GL0-.12,.12,OH,2*OW,0,shut);
  /* upper floor set back behind a terrace, glass front, roof slab */
  ph(RF,a,b,GL0,GL0-2.6,GH,Q.deck);pbox(GL,q,GL0-.1,.06,1.05,GSTEP,GH,P.white);
  pbox(B,q,GL0-2.6-(BLDD-2.6)/2,BLDD-2.6,BLDH-GH,GSTEP,GH,tW);pbox(GL,q,GL0-2.56,.08,4.3,GSTEP-1.2,GH+.7,P.white);
  pbox(B,q,GL0-BLDD/2-.2,BLDD+2.2,.4,GSTEP,BLDH,Q.roofW);});
 /* end block (no garage) and the closed faces */
 {const a=QB1+GSTEP/2,b=BLD1,m=(a+b)/2,l=b-a;pbox(B,m,GL0-BLDD/2,BLDD,GH,l,0,tW);pbox(GL,m,GL0+.04,.08,2.6,l-3,1.4,P.white);pbox(B,m,GL0-2.6-(BLDD-2.6)/2,BLDD-2.6,BLDH-GH,l,GH,tW);pbox(GL,m,GL0-2.56,.08,4.3,l-1.2,GH+.7,P.white);pbox(B,m,GL0-BLDD/2-.2,BLDD+2.2,.4,l,BLDH,Q.roofW);ph(RF,a,b,GL0,GL0-2.6,GH,Q.deck);}
 /* paddock side with windows, one quad per 22 m so it follows the slight bend of the lane */
 for(let a=BLD0;a<BLD1-.1;a+=GSTEP){const b=Math.min(a+GSTEP,BLD1),A=pq(a,GL0-BLDD-.03),Bp=pq(b,GL0-BLDD-.03),n=pNrm((a+b)/2),u0=(b-BLD0)/12.8,u1=(a-BLD0)/12.8,v1=BLDH/12.4,w=tW;
  BW.v(A[0],0,A[1],-n[0],0,-n[1],w,u1,0);BW.v(Bp[0],0,Bp[1],-n[0],0,-n[1],w,u0,0);BW.v(Bp[0],BLDH,Bp[1],-n[0],0,-n[1],w,u0,v1);BW.v(A[0],0,A[1],-n[0],0,-n[1],w,u1,0);BW.v(Bp[0],BLDH,Bp[1],-n[0],0,-n[1],w,u0,v1);BW.v(A[0],BLDH,A[1],-n[0],0,-n[1],w,u1,v1);}
 {const t=pTan(BLD0);pv(B,BLD0,GL0,BLD0,GL0-BLDD,0,GH,tW,[-t[0],-t[1]]);pv(B,BLD0,GL0-RD_,BLD0,GL0-BLDD,0,BLDH,tW,[-t[0],-t[1]]);}
 ph(IN,BLD0,QB0-GSTEP/2,GL0-.4,GL0-RD_,OH,tC,true);}

/* ================= START GANTRY, START LIGHTS, FLAG PLATFORM ================= */
const SL=(()=>{const s0=0,gl=PIT.gantryLat,gy=PIT.gantryY,top=gy+1.25;K.trackPos(s0,0,o2);const h=o2.h,tx=Math.sin(h),tz=Math.cos(h),nx=NX[0],nz=NZ[0],at=(s,lat)=>[o2.x+tx*s+nx*lat,o2.z+tz*s+nz*lat];
 /* the gantry is a see-through structure (see SEE in the base piece): its own batch, mesh and material */
 const GB=new Batch();
 for(const sd of [1,-1])for(const ds of [-1.25,1.25]){const p=at(ds,sd*gl);GB.box(.36,top+.1,.36,p[0],-.1,p[1],Q.dark,h);}
 for(const ds of [-1.25,1.25])for(const y of [gy,top-.3]){const p=at(ds,0);GB.box(2*gl+.6,.3,.3,p[0],y,p[1],Q.dark,h);}
 for(let l=-gl;l<=gl+.01;l+=gl/4)for(const y of [gy+.09,top-.21]){const p=at(0,l);GB.box(.12,.12,2.5,p[0],y,p[1],Q.steel,h);}
 for(let l=-gl;l<=gl+.01;l+=gl/4)for(const ds of [-1.25,1.25]){const p=at(ds,l);GB.box(.1,top-gy-.3,.1,p[0],gy+.15,p[1],Q.steel,h);}
 {const p=at(-1.52,0);GB.box(9.4,1.3,.22,p[0],gy-.02,p[1],Q.black,h);}
 /* flag platform on the right-hand post (pit wall side): top at PIT.flagY, free in the middle for the waver */
 {const p=at(0,-gl),y=PIT.flagY;GB.box(2.0,.14,2.14,p[0],y-.14,p[1],Q.steel,h);for(const a of [[-1,-1.02],[1,-1.02],[-1,1.02],[1,1.02]]){const c=at(a[1],-gl+a[0]*.95);GB.box(.05,1.05,.05,c[0],y,c[1],Q.dark,h);}
  for(const a of [-1.02,1.02]){const c=at(a,-gl);GB.box(1.9,.05,.05,c[0],y+1.0,c[1],Q.dark,h);}{const c=at(0,-gl-.95);GB.box(.05,.05,2.04,c[0],y+1.0,c[1],Q.dark,h);}}
 const gMesh=flush(GB,seeMat(),true,true);
 /* five columns of two lamps; column 0 is on the driver's left */
 const lb=new Batch(),cg=new THREE.CircleGeometry(.33,14),off=C(0x2a0b09),pos=[],gp=new Float32Array(15),gc=new Float32Array(15);
 for(let c=0;c<5;c++){const lat=(2-c)*1.75;for(const y of [gy+.3,gy+.92]){const p=at(-1.66,lat);lb.addM(cg,off,M4(p[0],y,p[1],0,h+PI,0));}const p=at(-1.8,lat);gp[c*3]=p[0];gp[c*3+1]=gy+.61;gp[c*3+2]=p[1];pos.push(p);}
 const geo=lb.geom(),nv=geo.attributes.position.count/10,mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false,fog:false}));world.add(mesh);
 /* what the cameras test: the truss with the light panel, the two pairs of posts (widened: they are thin), the flag platform */
 {const c=at(-.18,0),f=at(0,-gl),v=[volPrism(rectPts(c[0],c[1],h,1.64,gl+.45),gy-.1,top+.1)];for(const sd of [1,-1]){const p=at(0,sd*gl);v.push(volPrism(rectPts(p[0],p[1],h,1.45,.2),-.1,gy,.6));}
  v.push(volPrism(rectPts(f[0],f[1],h,1.08,1),PIT.flagY-.2,PIT.flagY+1.1,.2));seeAdd('Start gantry',[gMesh,mesh],v);}
 const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(gp,3));gg.setAttribute('color',new THREE.BufferAttribute(gc,3));
 const pts=new THREE.Points(gg,new THREE.PointsMaterial({size:8.5,map:dotTex,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true,fog:false}));pts.frustumCulled=false;world.add(pts);
 let lit=-1;const on=new THREE.Color(1,.05,.03);
 function set(n){n=Math.max(-1,Math.min(5,n|0));if(n===lit)return;lit=n;const ca=geo.attributes.color;for(let c=0;c<5;c++){const k=c<n?on:off;for(let v=c*2*nv;v<(c+1)*2*nv;v++)ca.setXYZ(v,k.r,k.g,k.b);const g=c<n?1:0;gc[c*3]=g;gc[c*3+1]=g*.08;gc[c*3+2]=g*.05;}
  ca.needsUpdate=true;gg.attributes.color.needsUpdate=true;pts.visible=n>0;}
 set(0);return {set,get:()=>lit};})();
const setStartLights=n=>SL.set(n),startLights=()=>SL.get();
