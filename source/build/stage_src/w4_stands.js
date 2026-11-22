
/* ================= GRANDSTANDS WITH CROWDS =================
   Each OSM grandstand outline is a long strip. Its edges are sorted into the front (facing the track) and the back; cross-sections run
   from the front to the back every few metres, so straight, L-shaped and U-shaped stands all work. Tiers, a back wall, a roof over the
   upper rows, and one seated figure per place as an instanced mesh per stand. */
function resample(ch,step){const L=[0];for(let i=1;i<ch.length;i++)L.push(L[i-1]+Math.hypot(ch[i][0]-ch[i-1][0],ch[i][1]-ch[i-1][1]));const tot=L[L.length-1],n=Math.max(2,Math.round(tot/step)),o=[];let j=0;
 for(let k=0;k<=n;k++){const d=tot*k/n;while(j<ch.length-2&&L[j+1]<d)j++;const u=(d-L[j])/Math.max(1e-6,L[j+1]-L[j]);o.push([ch[j][0]+(ch[j+1][0]-ch[j][0])*u,ch[j][1]+(ch[j+1][1]-ch[j][1])*u]);}return o;}
function standChains(pts,tgt){const n=pts.length,sg=area2(pts)>0?1:-1,len=[],cls=[];
 for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1e-6,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,t=tgt(mx,mz),tx=t[0]-mx,tz=t[1]-mz,tl=Math.hypot(tx,tz)||1,f=(dz/l*sg*tx-dx/l*sg*tz)/tl;len.push(l);cls.push(f>.35?1:f<-.35?-1:0);}
 const run=s=>{const m=cls.map(c=>c===s);
  for(let i=0;i<n;i++){if(m[i]||!m[(i+n-1)%n])continue;let j=i,g=0;while(!m[j%n]&&j<i+n){g+=len[j%n];j++;}if(j<i+n&&g<9)for(let k=i;k<j;k++)m[k%n]=true;}
  let best=null;for(let i=0;i<n;i++){if(!m[i]||m[(i+n-1)%n])continue;let j=i,L=0;while(m[j%n]&&j<i+n){L+=len[j%n];j++;}if(!best||L>best.L)best={i,j,L};}
  if(!best)return null;const ch=[];for(let k=best.i;k<=best.j;k++)ch.push(pts[k%n]);return ch;};
 return {F:run(1),Bk:run(-1),sg};}
function standSecs(F,Bk,sg){const R=resample(F,3.6),S=[];
 for(let k=0;k<R.length;k++){const a=R[Math.max(0,k-1)],b=R[Math.min(R.length-1,k+1)],tx=b[0]-a[0],tz=b[1]-a[1],l=Math.hypot(tx,tz)||1,dx=(sg>0?-tz:tz)/l,dz=(sg>0?tx:-tx)/l,ox=R[k][0],oz=R[k][1];let best=1e9;
  for(let i=0;i+1<Bk.length;i++){const ax=Bk[i][0]-ox,az=Bk[i][1]-oz,ex=Bk[i+1][0]-Bk[i][0],ez=Bk[i+1][1]-Bk[i][1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-9)continue;const t=(ax*ez-az*ex)/den,u=(ax*dz-az*dx)/den;if(t>1&&t<60&&u>=-.02&&u<=1.02&&t<best)best=t;}
  S.push({ix:ox,iz:oz,dx,dz,d:best});}
 /* fill misses from the neighbours, then even out the depth a little */
 const ds=S.map(s=>s.d).filter(d=>d<1e8).sort((p,q)=>p-q),med=ds.length?ds[ds.length>>1]:20;for(const s of S){if(s.d>1e8)s.d=med;s.d=clamp(s.d,med*.6,med*1.25);}
 for(const s of S){s.ox=s.ix+s.dx*s.d;s.oz=s.iz+s.dz*s.d;}return {S,med};}
const STANDS=[],FANS=[];
MAT.fan.onBeforeCompile=(f=>function(sh){f(sh);/* the shirt takes the instance colour, the head keeps its own */sh.vertexShader=sh.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nif(position.y>.77)vColor.xyz=color.xyz;\n#endif');})(MAT.fan.onBeforeCompile);
{const RISE=.8,Y0=2.6,fanCols=[[C(0xf08a24),20],[C(0xd8202a),12],[C(0xf4f1ea),22],[C(0x1b2540),10],[C(0x27b8a8),8],[C(0x2b2c30),9],[C(0x6aa9e0),6],[C(0xf2c230),5],[C(0x9a9ca0),8]],colSum=fanCols.reduce((a,c)=>a+c[1],0);
 const pickCol=()=>{let r=rnd()*colSum;for(const c of fanCols){r-=c[1];if(r<=0)return c[0];}return fanCols[0][0];};
 CITY.grandstands.forEach((g,gi)=>{const pts=ringPts(g.r),named=!!g.n,cen=centP(pts);
  const tgt=named?(x,z)=>{nearT(x,z);return nI<0?[0,150]:[TX[nI],TZ[nI]];}:(x,z)=>[197.5,z];
  const ch=standChains(pts,tgt);if(!ch.F||!ch.Bk||ch.F.length<2||ch.Bk.length<2){STAT['stand'+gi]='skipped';return;}
  const sec=standSecs(ch.F,ch.Bk,ch.sg),S=sec.S,N=S.length-1,T=clamp(Math.round((sec.med-3)/1.7),5,12),yT=Y0+(T-1)*RISE,yB=yT+3.4,roof=named,yR0=yT+7.2,yR1=yT+5.2,fr0=.4,fr1=1.07;
  const pt=(s,f,y)=>[s.ix+s.dx*s.d*f,y,s.iz+s.dz*s.d*f],fT=s=>(s.d-3)/s.d;
  const CAN=new Batch();   /* the roof of this stand: a see-through structure with its own mesh and material (see SEE in the base piece) */
  for(let k=0;k<N;k++){const A=S[k],E=S[k+1],fa=fT(A),fe=fT(E),hx=-A.dx,hz=-A.dz;
   bq(B,pt(A,0,-.1),pt(E,0,-.1),pt(E,0,Y0),pt(A,0,Y0),Q.wall,hx,0,hz);
   for(let j=0;j<T;j++){const a0=fa*j/T,a1=fa*(j+1)/T,e0=fe*j/T,e1=fe*(j+1)/T,y=Y0+j*RISE;quad(B,pt(A,a0,y),pt(A,a1,y),pt(E,e1,y),pt(E,e0,y),j&1?Q.seat:Q.seat2);
    if(j)bq(B,pt(A,a0,y-RISE),pt(E,e0,y-RISE),pt(E,e0,y),pt(A,a0,y),Q.concD,hx,0,hz);}
   quad(B,pt(A,fa,yT),pt(A,1,yT),pt(E,1,yT),pt(E,fe,yT),Q.conc);
   bq(B,pt(A,1,-.1),pt(E,1,-.1),pt(E,1,yB),pt(A,1,yB),Q.wall,-hx,0,-hz);bq(B,pt(A,.995,yT),pt(E,.995,yT),pt(E,.995,yB),pt(A,.995,yB),Q.wallW,hx,0,hz);
   if(roof){quad(CAN,pt(A,fr0,yR0),pt(A,fr1,yR1),pt(E,fr1,yR1),pt(E,fr0,yR0),Q.roofW);bq(CAN,pt(A,fr0,yR0-.4),pt(A,fr1,yR1-.4),pt(E,fr1,yR1-.4),pt(E,fr0,yR0-.4),Q.wall,0,-1,0);
    bq(CAN,pt(A,fr0,yR0-.4),pt(E,fr0,yR0-.4),pt(E,fr0,yR0),pt(A,fr0,yR0),Q.roofW,hx,0,hz);bq(CAN,pt(A,fr1,yR1-.4),pt(E,fr1,yR1-.4),pt(E,fr1,yR1),pt(A,fr1,yR1),Q.roofW,-hx,0,-hz);
    /* the posts and struts that carry the roof belong to it (same mesh), so they fade with it */
    if(k%3===0){const c=pt(A,.97,0);CAN.cyl(.32,yR1-.3,c[0],0,c[2],Q.steel,6);const m=pt(A,.62,0),hh=lerp(yR0,yR1,(.62-fr0)/(fr1-fr0))-.4,l=Math.hypot(m[0]-c[0],m[2]-c[2]);
     CAN.addM(GEO.box,Q.steel,M4((c[0]+m[0])/2,(yB+hh)/2,(c[2]+m[2])/2,Math.atan2(l,hh-yB)-PI/2,Math.atan2(-A.dx,-A.dz),0,.22,.22,Math.hypot(l,hh-yB)));}}}
  for(const k of [0,N]){const s=S[k],sgn=k?1:-1,tx=(S[Math.min(N,k+1)].ix-S[Math.max(0,k-1)].ix)*sgn,tz=(S[Math.min(N,k+1)].iz-S[Math.max(0,k-1)].iz)*sgn;bq(B,pt(s,0,-.1),pt(s,1,-.1),pt(s,1,yB),pt(s,0,Y0),Q.wall,tx,0,tz);
   if(roof){bq(CAN,pt(s,fr0,yR0-.4),pt(s,fr1,yR1-.4),pt(s,fr1,yR1),pt(s,fr0,yR0),Q.roofW,tx,0,tz);}}
  /* what the cameras test: the roof strip in pieces of four cross-sections (about 14 m), so that bent stands are followed closely;
     from the top of the back wall (where the struts start) to the top of the roof */
  if(roof){const v=[],xz=p=>[p[0],p[2]];for(let k=0;k<N;k+=4){const A=S[k],E=S[Math.min(N,k+4)];v.push(volPrism([xz(pt(A,fr0,0)),xz(pt(A,fr1,0)),xz(pt(E,fr1,0)),xz(pt(E,fr0,0))],yB-.2,yR0+.1,.6));}
   seeAdd(g.n+' roof',[flush(CAN,seeMat(),true,true)],v);}
  STANDS.push({n:g.n||'',pts,bb:bboxP(pts),S,T,yT,cen});
  /* crowd: one place every 1.25 m on every tier */
  if(named){const list=[],occ=g.n==='Main Grandstand'||g.n==='North Grandstand'?.92:.86;
   for(let j=0;j<T;j++){let carry=rr(0,1.25);for(let k=0;k<N;k++){const A=S[k],E=S[k+1],fa=fT(A)*(j+.55)/T,fe=fT(E)*(j+.55)/T,a=pt(A,fa,0),e=pt(E,fe,0),l=Math.hypot(e[0]-a[0],e[2]-a[2]);let d=carry;
     for(;d<l;d+=1.25){if(rnd()>occ)continue;const u=d/l;list.push(a[0]+(e[0]-a[0])*u,Y0+j*RISE+.02,a[2]+(e[2]-a[2])*u,Math.atan2(-A.dx,-A.dz));}carry=d-l;}}
   FANS.push({n:g.n,list});}
 });
 /* one instanced mesh per stand, with a bounding sphere around its own crowd so it is culled correctly */
 const fb=new Batch();fb.box(.5,.62,.42,0,.14,0,C(0xffffff));fb.addM(new THREE.OctahedronGeometry(.19,0),P.skin,M4(0,.97,0));const fgeo=fb.geom();let tot=0;
 FANS.forEach(F=>{const n=F.list.length/4;if(!n)return;const geo=fgeo.clone(),im=new THREE.InstancedMesh(geo,MAT.fan,n);let cx=0,cy=0,cz=0;
  for(let i=0;i<n;i++){const x=F.list[i*4],y=F.list[i*4+1],z=F.list[i*4+2];cx+=x;cy+=y;cz+=z;im.setMatrixAt(i,M4(x,y,z,0,F.list[i*4+3]+rr(-.25,.25),0,1,rr(.92,1.2),1));im.setColorAt(i,pickCol());}
  cx/=n;cy/=n;cz/=n;let r=0;for(let i=0;i<n;i++)r=Math.max(r,Math.hypot(F.list[i*4]-cx,F.list[i*4+1]-cy,F.list[i*4+2]-cz));geo.boundingSphere=new THREE.Sphere(new V3(cx,cy,cz),r+2);
  im.castShadow=false;im.receiveShadow=false;world.add(im);tot+=n;});
 STAT.fans=tot;STAT.stands=STANDS.map(s=>(s.n||'-')+':'+s.S.length+'x'+s.T);}
