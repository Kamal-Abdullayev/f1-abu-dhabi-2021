/* ================= p3_actors.js : everything that moves =================
   Owner: show. Exports ACT. Needs p1_engine.js. WORLD, ENV and CAM are used only inside tick().
   Every actor is placed from race time rt alone, so a seek in either direction shows the right picture.
   Draw calls: one mesh per car (bodywork and text decals share one material through a text atlas; a matt twin of it for one team),
   one InstancedMesh for all wheels, three InstancedMeshes for all people (bodies, arms, legs). */
const ACT=(()=>{
 const _o={},_o2={},_mB=new THREE.Matrix4(),_m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_q=new THREE.Quaternion(),
  _e=new THREE.Euler(0,0,0,'YXZ'),_e2=new THREE.Euler(0,0,0,'ZXY'),_p=new V3(),_s=new V3(1,1,1),_one=new V3(1,1,1),_zero=new THREE.Matrix4().makeScale(0,0,0);
 const hx=s=>C(parseInt(s)),frac=x=>x-Math.floor(x),WHITE=new THREE.Color(1,1,1);
 const CARBON=C(0x1b1c1f),RIMC=C(0x2c2d31),SILV=C(0xb4b7ba),REDL=C(0xc8141c),TCAMY=C(0xe6e21a);
 const cR=C(0xff2a18),cAmb=C(0xffa51e),cGrn=C(0x35e06a),cW=C(0xfff2d8);

 /* ---------- materials: cars and people keep a little of their own colour at night (uGlow follows ENV.night) ---------- */
 const GLOWU={value:0};
 const glowPatch=sh=>{sh.uniforms.uGlow=GLOWU;sh.fragmentShader='uniform float uGlow;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*uGlow;');};
 /* instanced parts: aTint.x = share of the instance colour, aTint.y = share of the second instance colour iCol2 */
 const tintPatch=sh=>{sh.uniforms.uGlow=GLOWU;
  sh.vertexShader='attribute vec2 aTint;\nattribute vec3 iCol2;\n'+sh.vertexShader.replace('#include <color_vertex>','vColor=color.xyz*((1.0-aTint.x-aTint.y)+instanceColor.xyz*aTint.x+iCol2*aTint.y);');
  sh.fragmentShader='uniform float uGlow;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*(uGlow*1.15);');};
 /* Batch with a per-vertex tint attribute */
 class TBatch extends Batch{constructor(){super();this.T=[];this.t=[0,0];}
  tint(a,b){this.t=[a||0,b||0];return this;}
  addM(geo,c,m){const n0=this.P.length;super.addM(geo,c,m);for(let i=n0;i<this.P.length;i+=3)this.T.push(this.t[0],this.t[1]);return this;}
  geom(){const g=super.geom();g.setAttribute('aTint',new THREE.Float32BufferAttribute(this.T,2));return g;}}
 function inst(geo,mat,n,cast){geo.setAttribute('iCol2',new THREE.InstancedBufferAttribute(new Float32Array(n*3),3));const im=new THREE.InstancedMesh(geo,mat,n);
  for(let i=0;i<n;i++){im.setMatrixAt(i,_zero);im.setColorAt(i,WHITE);}im.castShadow=cast!==false;im.receiveShadow=false;im.frustumCulled=false;scene.add(im);return im;}
 const mattM=std({vertexColors:true,roughness:.8});mattM.onBeforeCompile=tintPatch;

 /* ---------- text atlas, plain system font only: cell 0 is plain white (all bodywork points there); then one cell per car number,
    one per three-letter driver code and one per team name. The glyphs are white (numbers with a dark rim); the vertex colour of a
    decal tints them light or dark to suit the paint underneath. No logos, no marks of any kind. ---------- */
 const AT=1024,WU=64/AT,WV=1-64/AT,FONT='px system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
 const cellN=k=>[(k%8)*128,Math.floor(k/8)*128,128,128],cellC=i=>[(i%8)*128,384+Math.floor(i/8)*64,128,64],cellT=i=>[(i%2)*512,576+Math.floor(i/2)*80,512,80];
 /* pixel rectangle -> [u0, v0 (bottom), u1, v1 (top)] */
 const uvr=r=>[(r[0]+3)/AT,1-(r[1]+r[3]-3)/AT,(r[0]+r[2]-3)/AT,1-(r[1]+3)/AT];
 const teamTxt=t=>String(t.name||t.code).split(' ').slice(0,2).join(' ').toUpperCase();
 const atlas=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=AT;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,128,128);
  g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
  const fit=(t,px,w)=>{g.font='800 '+px+FONT;const mw=g.measureText(t).width;if(mw>w)g.font='800 '+(px*w/mw).toFixed(1)+FONT;};
  K.cars.forEach((c,i)=>{const r=cellN(i+1),t=String(c.num),x=r[0]+64,y=r[1]+64;
   g.font='900 '+(t.length>1?78:94)+FONT;g.lineWidth=10;g.strokeStyle='#0e0f12';g.fillStyle='#fff';g.strokeText(t,x,y+6);g.fillText(t,x,y+6);
   const q=cellC(i);fit(c.code,50,112);g.fillText(c.code,q[0]+64,q[1]+35);});
  K.TEAMS.forEach((t,i)=>{const q=cellT(i);fit(teamTxt(t),66,484);g.fillText(teamTxt(t),q[0]+256,q[1]+44);});
  const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;})();
 /* little sky reflection: seen from behind at a flat angle the paint must keep its own colour (black stays black, navy stays navy) */
 const carMat=std({vertexColors:true,map:atlas,alphaTest:.5,roughness:.55,metalness:.1});carMat.envMapIntensity=.35;carMat.onBeforeCompile=glowPatch;
 /* the same for matt paint */
 const carMatt=std({vertexColors:true,map:atlas,alphaTest:.5,roughness:.82,metalness:.04});carMatt.envMapIntensity=.22;carMatt.onBeforeCompile=glowPatch;

 /* ---------- car batch: Batch plus lofted skins ----------
    loft(R, o): R = rows of points [x, y, z]: rings along a body, sections along a wing, or the outline of a plate taken at several places.
    o.open: the rows do not close on themselves · o.k: paint zone, one for all, one per segment of the row, or a function (row, segment)
    · o.cap: 1 closes the first row, 2 the last, 3 both (o.kc, o.kc2: their zones). Normals are smooth and weighted by area, so a curved
    skin looks round and a thin plate keeps flat faces with soft edges; the winding is turned outward by itself.
    Colour: every quad asks paint(zone, x, y, z of its centre, ny, z of the corner): flat zones get crisp borders on the mesh lines,
    and a livery can still fade along the car through the corner z. */
 class CarB extends Batch{
  constructor(paint){super();this.U=[];this.paint=paint;}
  addM(geo,c,m){const n0=this.P.length;super.addM(geo,c,m);for(let i=n0;i<this.P.length;i+=3)this.U.push(WU,WV);return this;}
  v(p,n,c,u,w){this.P.push(p[0],p[1],p[2]);this.N.push(n[0],n[1],n[2]);this.C.push(c.r,c.g,c.b);this.U.push(u,w);}
  loft(R,o){o=o||{};const n=R.length,m=R[0].length,mm=o.open?m-1:m,key=o.k,kf=typeof key==='function'?key:Array.isArray(key)?(i,j)=>key[j]:()=>key;
   const cen=R.map(r=>{const c=[0,0,0];for(const p of r){c[0]+=p[0]/m;c[1]+=p[1]/m;c[2]+=p[2]/m;}return c;}),Nv=R.map(r=>r.map(()=>[0,0,0])),F=[];let sg=0;
   for(let i=0;i<n-1;i++)for(let j=0;j<mm;j++){const j2=(j+1)%m,a=R[i][j],b=R[i+1][j],c=R[i+1][j2],d=R[i][j2];
    const ux=c[0]-a[0],uy=c[1]-a[1],uz=c[2]-a[2],vx=d[0]-b[0],vy=d[1]-b[1],vz=d[2]-b[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const qx=(a[0]+b[0]+c[0]+d[0])/4,qy=(a[1]+b[1]+c[1]+d[1])/4,qz=(a[2]+b[2]+c[2]+d[2])/4;
    sg+=nx*(qx-(cen[i][0]+cen[i+1][0])/2)+ny*(qy-(cen[i][1]+cen[i+1][1])/2)+nz*(qz-(cen[i][2]+cen[i+1][2])/2);
    for(const t of [Nv[i][j],Nv[i+1][j],Nv[i+1][j2],Nv[i][j2]]){t[0]+=nx;t[1]+=ny;t[2]+=nz;}
    F.push([i,j,j2,nx,ny,nz,qx,qy,qz]);}
   const s=sg<0?-1:1;
   for(const r of Nv)for(const t of r){const l=s/(Math.hypot(t[0],t[1],t[2])||1);t[0]*=l;t[1]*=l;t[2]*=l;}
   for(const f of F){const i=f[0],j=f[1],j2=f[2],l=Math.hypot(f[3],f[4],f[5])||1,k=kf(i,j);
    for(const e of (s>0?[[i,j],[i+1,j],[i+1,j2],[i,j],[i+1,j2],[i,j2]]:[[i,j],[i+1,j2],[i+1,j],[i,j],[i,j2],[i+1,j2]])){const p=R[e[0]][e[1]];this.v(p,Nv[e[0]][e[1]],this.paint(k,f[6],f[7],f[8],s*f[4]/l,p[2]),WU,WV);}}
   if(o.cap&1)this.cap(R[0],cen[0],cen[1],o.kc||kf(0,0));if(o.cap&2)this.cap(R[n-1],cen[n-1],cen[n-2],o.kc2||o.kc||kf(n-2,0));
   return {R,Nv,m,s};}
  /* flat lid over a row (a fan round its middle), facing away from the neighbouring row */
  cap(r,c,c2,k){const m=r.length;let nx=0,ny=0,nz=0;for(let j=0;j<m;j++){const a=r[j],b=r[(j+1)%m];nx+=(a[1]-b[1])*(a[2]+b[2]);ny+=(a[2]-b[2])*(a[0]+b[0]);nz+=(a[0]-b[0])*(a[1]+b[1]);}
   const l=Math.hypot(nx,ny,nz)||1,s=nx*(c[0]-c2[0])+ny*(c[1]-c2[1])+nz*(c[2]-c2[2])<0?-1:1,nn=[s*nx/l,s*ny/l,s*nz/l],col=this.paint(k,c[0],c[1],c[2],nn[1],c[2]);
   for(let j=0;j<m;j++){const a=r[j],b=r[(j+1)%m];this.v(c,nn,col,WU,WV);this.v(s>0?a:b,nn,col,WU,WV);this.v(s>0?b:a,nn,col,WU,WV);}}
  /* tube along a path: rx across (level for a level path), ry the other way, ns sides; rx and ry may be lists (one value per point) */
  tube(Pt,rx,ry,ns,k,cap,ph){const n=Pt.length,R=[];
   for(let i=0;i<n;i++){const a=Pt[Math.max(0,i-1)],b=Pt[Math.min(n-1,i+1)],p=Pt[i];let tx=b[0]-a[0],ty=b[1]-a[1],tz=b[2]-a[2];const tl=Math.hypot(tx,ty,tz)||1;tx/=tl;ty/=tl;tz/=tl;
    let sx=-tz,sy=0,sz=tx;const sl=Math.hypot(sx,sz);if(sl<1e-4){sx=1;sz=0;}else{sx/=sl;sz/=sl;}
    const ux=sy*tz-sz*ty,uy=sz*tx-sx*tz,uz=sx*ty-sy*tx,a1=Array.isArray(rx)?rx[i]:rx,b1=Array.isArray(ry)?ry[i]:ry,r=[];
    for(let j=0;j<ns;j++){const an=(j/ns+(ph||0))*TAU,cs=Math.cos(an)*a1,sn=Math.sin(an)*b1;r.push([p[0]+sx*cs+ux*sn,p[1]+sy*cs+uy*sn,p[2]+sz*cs+uz*sn]);}
    R.push(r);}
   return this.loft(R,{k,cap});}
  /* upright thin plate between two places on the ground plan: bottom and top height at each end */
  fin(x0,z0,b0,t0,x1,z1,b1,t1,th,k){const dx=x1-x0,dz=z1-z0,l=Math.hypot(dx,dz)||1,nx=dz/l*th/2,nz=-dx/l*th/2;
   return this.loft([[[x0+nx,b0,z0+nz],[x0+nx,t0,z0+nz],[x0-nx,t0,z0-nz],[x0-nx,b0,z0-nz]],[[x1+nx,b1,z1+nz],[x1+nx,t1,z1+nz],[x1-nx,t1,z1-nz],[x1-nx,b1,z1-nz]]],{k,cap:3});}
  /* text decal: the patch of a loft between rows i0..i1 and points j0..j1, lifted e off the skin and following it exactly;
     map(a, b) takes the place in the patch (a along the rows, b along the points, both 0..1) to a place in the atlas cell r */
  decal(L,i0,i1,j0,j1,r,map,col,e){const m=L.m,R=L.R,Nv=L.Nv,jj=j=>((j%m)+m)%m,ds=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]),A=[0],V=[];
   for(let i=i0;i<i1;i++)A.push(A[A.length-1]+ds(R[i][jj(j0)],R[i+1][jj(j0)]));
   for(let i=i0;i<=i1;i++){const B=[0],row=[];for(let j=j0;j<j1;j++)B.push(B[B.length-1]+ds(R[i][jj(j)],R[i][jj(j+1)]));
    for(let j=j0;j<=j1;j++){const p=R[i][jj(j)],nn=Nv[i][jj(j)],uv=map(A[i-i0]/A[A.length-1],B[j-j0]/B[B.length-1]);row.push([[p[0]+nn[0]*e,p[1]+nn[1]*e,p[2]+nn[2]*e],nn,r[0]+(r[2]-r[0])*uv[0],r[1]+(r[3]-r[1])*uv[1]]);}
    V.push(row);}
   for(let i=0;i<i1-i0;i++)for(let j=0;j<j1-j0;j++){const a=V[i][j],b=V[i+1][j],c=V[i+1][j+1],d=V[i][j+1];for(const q of (L.s>0?[a,b,c,a,c,d]:[a,c,b,a,d,c]))this.v(q[0],q[1],col,q[2],q[3]);}}
  geom(){const g=super.geom();g.setAttribute('uv',new THREE.Float32BufferAttribute(this.U,2));return g;}}

 /* ---------- 2021 paint as plain colour patterns (approximations from memory; no logos, no sponsor marks, nothing standing in for one) ----------
    Zones: N nose and monocoque (Nt top, Ns flank, Nb underside) · E engine cover (Et airbox top, Ef airbox side and fin, Eh shoulder,
    Es thin stripe on the flank, El flank, Eb underside) · P sidepod (Pt top, Pu upper flank, Ps thin stripe, Pl lower flank, Pb underside)
    · F front wing (F0 main plane .. F3 top flap, Fg lip on the top flap) · FE front endplate (FEt top band) · R rear wing (R0 main plane,
    R1 flap, Rg lip) · RE<col><row> rear endplate: col 0 front, 1 middle, 2 rear band; row 0 lower part, 1 thin line, 2 main part,
    3 top band · M mirror. a, b, c = the team's body, second and accent colour from the kernel.
    The body colour carries the car from behind and above in every scheme. */
 const mixC=new THREE.Color(),mix=(a,b,t)=>mixC.copy(a).lerp(b,t),BLK=C(0x0c0c0e),MRED=C(0x86161f),WMID=C(0x2a74e0),isRE=k=>k[0]==='R'&&k[1]==='E';
 const LIV={
  /* black; teal thin lines low on the sidepods and on the endplates; engine cover fading to silver-grey at the rear; dark red patch on the airbox sides */
  MER:(k,x,y,z,ny,vz,a,b,c)=>k[0]==='E'?(k==='Ef'&&z>-.56&&z<-.1&&y<.86?MRED:mix(a,c,sstep(-.75,-2.05,vz))):k==='Ps'||k==='FEt'||(isRE(k)&&k[3]==='1')?b:a,
  /* dark navy; yellow nose tip and airbox top; red only as narrow stripes (engine cover flank, endplate edges) */
  RBR:(k,x,y,z,ny,vz,a,b,c)=>(k[0]==='N'&&z>2.5)||((k==='Et'||(k==='Ef'&&y>.88))&&z>-.56)?c:(k==='Es'&&z<-.12)||k==='FEt'||(isRE(k)&&k[2]==='2')?b:a,
  /* bright red, the engine cover and the rear wing darkening to burgundy; front wing and rear main plane black underneath */
  FER:(k,x,y,z,ny,vz,a,b,c)=>k[0]==='E'?mix(a,b,sstep(-.9,-1.95,vz)):k[0]==='R'?(k==='R0'&&ny<-.3?BLK:b):k[0]==='F'&&k[1]!=='E'&&ny<-.5?BLK:a,
  /* papaya; blue lower sidepod flanks, rear of the engine cover and rear endplates */
  MCL:(k,x,y,z,ny,vz,a,b,c)=>k==='Pl'||k==='Ps'||k==='Pb'||(k[0]==='E'&&z<-1.45)||isRE(k)?b:a,
  /* blue; white and red bands on the rear of the engine cover and on the rear endplates; black low on the sidepods */
  ALP:(k,x,y,z,ny,vz,a,b,c)=>k[0]==='E'&&z<-1.45?(z<-1.8?c:b):isRE(k)?(k[2]==='2'?c:k[2]==='1'?b:a):k==='Pl'||k==='Pb'?BLK:a,
  /* navy on top (nose top, cockpit surround, spine, wings); white flanks, sidepods and engine cover sides */
  AT:(k,x,y,z,ny,vz,a,b,c)=>k==='Ns'||k[0]==='P'||k==='El'||k==='Es'?b:a,
  /* dark green; thin magenta-pink stripe along the sidepods and engine cover, and on the wing edges */
  AMR:(k,x,y,z,ny,vz,a,b,c)=>k==='Ps'||k==='Es'||k==='FEt'||k==='Fg'||k==='Rg'||(isRE(k)&&k[3]==='3')?c:a,
  /* white nose fading through mid blue to dark blue at the rear; yellow on the endplate tops and the rear lip */
  WIL:(k,x,y,z,ny,vz,a,b,c)=>k==='FEt'||k==='Rg'||(isRE(k)&&k[3]==='3')?c:mixC.copy(b).lerp(WMID,sstep(2.3,.9,vz)).lerp(a,sstep(.6,-1.4,vz)),
  /* white front and middle; engine cover, fin and rear endplates dark red; a dark red band on the nose */
  ARR:(k,x,y,z,ny,vz,a,b,c)=>(k[0]==='E'&&z<-.56)||isRE(k)||(k[0]==='N'&&z>2.27&&z<2.5)?b:a,
  /* white; a blue and a red band on the nose and on the engine cover; red front endplates, blue and red rear endplates */
  HAA:(k,x,y,z,ny,vz,a,b,c)=>k[0]==='N'&&z>2.05&&z<2.5?(z>2.27?b:c):k[0]==='E'&&z<-1.45&&z>-2.1?(z<-1.8?b:c):k==='FE'||k==='FEt'?b:isRE(k)?(k[2]==='2'?b:c):a,
  X:(k,x,y,z,ny,vz,a)=>a};
 /* helmets: one plain main colour per driver, illustrative only (no designs) */
 const HELMC={VER:0xf1f1f1,PER:0xe0b020,HAM:0x6b2d90,BOT:0x2a8fd0,SAI:0xc81e28,LEC:0xf0eeea,NOR:0xd4e21a,RIC:0x5fd0c8,ALO:0x1e5fbf,OCO:0xe04050,GAS:0xf2f2f2,TSU:0xe03a3a,
  VET:0xf4f4f4,STR:0x20a060,RUS:0x1c2e7a,LAT:0xd8343a,RAI:0xe9e9e9,GIO:0x1f7a46,MSC:0xc8e61e};

 /* ---------- the single-seater: 5.6 m long, 2.0 m wide, 0.95 m to the top of the airbox, nose to +z, +x = the car's left ----------
    A 2021-rules car at low-poly level, every surface generated here: lofted nose, monocoque, engine cover and sidepods, four-element
    front wing, rear wing, floor, bargeboards, diffuser, halo, suspension. Proportions are approximate. */
 const HELM=new THREE.SphereGeometry(1,12,10),COCK=C(0x0f1012),GLASS=C(0x9fb4c0),TXW=C(0xf6f6f6),TXD=C(0x101114),VISOR=C(0x15171b);
 /* T-camera: black on the lower-numbered car of each team, yellow on the other, so team-mates can be told apart */
 const lowNum=(()=>{const m={};K.cars.forEach(c=>{const k=c.team.code;if(m[k]==null||+c.num<m[k])m[k]=+c.num;});return m;})();
 /* nose and monocoque, front to back: z, half width, bottom, top, corner radius, floor of the cockpit opening */
 const NS=[[2.8,.045,.178,.212,.017],[2.775,.085,.165,.228,.03],[2.7,.115,.158,.255,.045],[2.5,.135,.165,.315,.06],[2.27,.152,.185,.385,.07],[2.05,.17,.21,.45,.075],[1.75,.2,.25,.535,.08],[1.5,.225,.27,.585,.085],
  [1.1,.26,.15,.61,.09],[.98,.268,.09,.615,.09],[.945,.27,.08,.62,.085,.55],[.9,.272,.07,.625,.08,.55],[.6,.285,.06,.655,.07,.55],[.14,.295,.06,.705,.06,.55],[.105,.295,.06,.71,.06],[-.12,.295,.06,.7,.06],[-.5,.27,.06,.5,.06]];
 const KN=['Nt','Nt','Nt','Ns','Ns','Ns','Nb','Nb','Nb','Ns','Ns','Ns','Nt','Nt','Nt','Nt'];
 /* engine cover with airbox and fin: z, then [x, y] of the top edge, airbox side, fin foot, shoulder, widest point, lower edge */
 const ES=[[-.05,[.07,.925],[.115,.885],[.128,.72],[.2,.63],[.287,.5],[.287,.06]],[-.13,[.072,.945],[.118,.9],[.13,.72],[.2,.63],[.287,.5],[.287,.06]],[-.55,[.065,.95],[.108,.9],[.122,.7],[.2,.615],[.295,.48],[.295,.06]],
  [-.8,[.028,.92],[.05,.87],[.06,.64],[.16,.56],[.28,.42],[.28,.06]],[-1.08,[.012,.872],[.014,.8],[.02,.575],[.115,.51],[.24,.36],[.24,.06]],[-1.45,[.012,.79],[.014,.72],[.018,.505],[.09,.45],[.18,.3],[.17,.06]],
  [-1.8,[.012,.712],[.014,.65],[.016,.45],[.07,.4],[.125,.28],[.12,.09]],[-2.1,[.012,.645],[.013,.59],[.015,.42],[.058,.375],[.09,.29],[.085,.15]],[-2.2,[.012,.47],[.013,.45],[.015,.41],[.055,.37],[.08,.3],[.075,.2]]];
 const KE=['Ef','Ef','Eh','Es','El','El','Eb','El','El','Es','Eh','Ef','Ef','Et'];
 /* sidepod: z, outer x, bottom, top, shoulder radius, undercut, inner x (inside the monocoque or the engine cover) */
 const PS=[[.51,.71,.43,.56,.03,0,.28],[.4,.775,.27,.585,.07,.08,.22],[.15,.8,.17,.59,.09,.16,.22],[-.25,.8,.09,.575,.1,.14,.2],[-.7,.76,.07,.52,.1,.08,.1],[-1.15,.63,.07,.42,.09,.04,.1],[-1.55,.47,.07,.31,.07,.02,.1],[-1.9,.3,.07,.2,.05,0,.08]];
 /* front wing: main plane and three flaps; sections at x = .25 (end of the flat centre), .6 and .965: z and y of the leading edge, z and y of the trailing edge */
 const WNG=[[[.25,2.74,.078,2.47,.066],[.6,2.69,.075,2.43,.07],[.965,2.61,.07,2.37,.075]],[[.25,2.485,.078,2.365,.118],[.6,2.445,.08,2.325,.112],[.965,2.385,.08,2.28,.098]],
  [[.25,2.378,.12,2.265,.178],[.6,2.338,.112,2.228,.158],[.965,2.292,.098,2.2,.124]],[[.25,2.278,.175,2.175,.25],[.6,2.24,.155,2.143,.212],[.965,2.21,.122,2.13,.152]]];
 /* rear wing sections as [z, y] round the profile: main plane, flap (its last three points are the face seen from behind) */
 const RM=[[-2.29,.745],[-2.42,.718],[-2.54,.738],[-2.64,.795],[-2.645,.78],[-2.54,.715],[-2.42,.692],[-2.3,.722]],RF=[[-2.655,.8],[-2.705,.86],[-2.745,.925],[-2.76,.918],[-2.72,.855],[-2.672,.795]];
 function carGeo(c,ix){const t=c.team,c1=hx(t.body),c2=hx(t.second),c3=hx(t.accent),liv=LIV[t.code]||LIV.X,D=CARBON,tc=(+c.num===lowNum[t.code])?C(0x0c0c0e):TCAMY,hc=HELMC[c.code]!=null?C(HELMC[c.code]):c2;
  /* zones: d carbon, x cockpit and intakes, l rain light; everything else is the team's paint */
  const paint=(k,x,y,z,ny,vz)=>k==='d'?D:k==='x'?COCK:k==='l'?REDL:liv(k,x,y,z,ny,vz,c1,c2,c3),at=(k,x,y,z,ny)=>paint(k,x,y,z,ny==null?1:ny,z);
  const b=new CarB(paint),S=[1,-1],mir=h=>h.concat(h.slice().reverse().map(p=>[-p[0],p[1],p[2]]));
  /* nose and monocoque: slim nose rising to the cockpit; the opening is a sunk dark floor between the cockpit sides, the surround
     runs back into the engine cover. Ring: top band edge, rim, upper corner, three points on the flank, lower corner, bottom edge. */
  const LN=b.loft(NS.map(s=>{const z=s[0],w=s[1],yb=s[2],yt=s[3],r=s[4],a=.6*w,cx=w-.29*r;
    return mir([[a,s[5]||yt,z],[Math.min(a+.04,(a+cx)/2),yt,z],[cx,yt-.29*r,z],[w,yt-r,z],[w,Math.max((yt+yb)/2,yt-r-.15),z],[w,yb+r,z],[cx,yb+.29*r,z],[a,yb,z]]);}),
   {k:(i,j)=>(j===0||j>13)&&(NS[i][5]||NS[i+1][5])?'x':KN[j],cap:1});
  /* engine cover: airbox with a dark intake, narrowing to the gearbox, thin fin on the spine; a 3.5 cm band on the flank for stripes */
  const LE=b.loft(ES.map(s=>{const z=s[0],sh=s[4],w=s[5],f=.035/Math.hypot(w[0]-sh[0],w[1]-sh[1]);
    return mir([s[1],s[2],s[3],sh,[sh[0]+(w[0]-sh[0])*f,sh[1]+(w[1]-sh[1])*f],w,s[6]].map(p=>[p[0],p[1],z]));}),{k:KE,cap:3,kc:'x',kc2:'El'});
  /* sidepods: dark inlet, undercut flank, falling and narrowing to the rear; a 4 cm band on the flank for stripes */
  S.forEach(sd=>b.loft(PS.map(s=>{const z=s[0],xo=s[1],yb=s[2],yt=s[3],y2=yt-s[4],ys=yb+.42*(y2-yb),f=y=>xo-s[5]*Math.pow((y2-y)/(y2-yb),1.5);
    return [[s[6],yt],[xo-s[4],yt],[xo,y2],[f(ys+.02),ys+.02],[f(ys-.02),ys-.02],[xo-s[5],yb],[s[6],yb]].map(p=>[sd*p[0],p[1],z]);}),{open:1,k:['Pt','Pt','Pu','Ps','Pl','Pb'],cap:3,kc:'x',kc2:'Pl'}));
  /* floor with the cut ahead of the rear wheels, diffuser with strakes */
  b.loft([[1.5,.14],[1.3,.3],[1.2,.42],[1.02,.62],[.74,.8],[-.95,.8],[-1.5,.63],[-1.56,.56],[-1.8,.54]].map(s=>[[s[1],.035,s[0]],[s[1],.065,s[0]],[-s[1],.065,s[0]],[-s[1],.035,s[0]]]),{k:'d',cap:3});
  b.loft([[-1.8,.54,.035,.065],[-2.02,.53,.105,.13],[-2.2,.525,.185,.2]].map(s=>[[s[1],s[2],s[0]],[s[1],s[3],s[0]],[-s[1],s[3],s[0]],[-s[1],s[2],s[0]]]),{k:'d',cap:2});
  [-.525,-.3,-.1,.1,.3,.525].forEach(x=>b.fin(x,-1.8,.035,.065,x,-2.2,.035,.18,.012,'d'));
  /* front wing: main plane, three flaps outboard of the flat centre, lip on the top flap, endplates, nose pylons */
  const wing=(st,th,k)=>b.loft(st.map(s=>[[s[0],s[2]+th/2,s[1]],[s[0],s[4]+th/2,s[3]],[s[0],s[4]-th/2,s[3]],[s[0],s[2]-th/2,s[1]]]),{k,cap:3});
  wing(WNG[0].slice().reverse().map(s=>[-s[0],s[1],s[2],s[3],s[4]]).concat(WNG[0]),.016,'F0');
  /* rear wing: main plane, flap with a lip, low beam element, pylon; crash structure with the rain light */
  const span=(pr,k)=>b.loft([.505,-.505].map(x=>pr.map(p=>[x,p[1],p[0]])),{k});
  span(RM,'R0');const LF=span(RF,'R1');span([[-2.745,.925],[-2.762,.918],[-2.764,.94],[-2.75,.943]],'Rg');span([[-2.36,.372],[-2.5,.398],[-2.5,.384],[-2.36,.358]],'d');
  b.loft([.011,-.011].map(x=>[[-2.18,.36],[-2.38,.36],[-2.47,.705],[-2.37,.715]].map(p=>[x,p[1],p[0]])),{k:'d',cap:3});
  b.loft([[-2.15,.07,.24],[-2.74,.045,.275]].map(s=>[[s[1],s[2],s[0]],[s[1],.36,s[0]],[-s[1],.36,s[0]],[-s[1],s[2],s[0]]]),{k:'d',cap:2,kc2:'l'});
  b.tube([[0,.412,-2.1],[0,.418,-2.28]],.046,.046,8,'x',2);                                                    /* exhaust */
  const arm=(p,q,w,h)=>b.tube([p,q],w||.032,h||.009,4,'d');
  S.forEach(sd=>{const X=(x,y,z)=>[sd*x,y,z];
   for(let e=1;e<4;e++)wing(WNG[e].map(s=>[sd*s[0],s[1],s[2],s[3],s[4]]),.012,['F'+e,'F'+e,'F'+e,'d']);   /* dark leading edges read as the slots between the elements */
   b.loft(WNG[3].map(s=>[[sd*s[0],s[4]+.004,s[3]+.012],[sd*s[0],s[4]+.024,s[3]+.004],[sd*s[0],s[4]+.024,s[3]-.005],[sd*s[0],s[4]+.002,s[3]-.005]]),{k:'Fg',cap:3});
   b.loft([[2.63,.1],[2.5,.16],[2.3,.235],[2.11,.255]].map(s=>[[sd*.985,.04,s[0]],[sd*.985,s[1]-.035,s[0]],[sd*.985,s[1],s[0]],[sd*.967,s[1],s[0]],[sd*.967,s[1]-.035,s[0]],[sd*.967,.04,s[0]]]),{k:['FE','FEt','FEt','FEt','FE','FE'],cap:3});
   b.fin(sd*.09,2.69,.07,.185,sd*.1,2.5,.07,.2,.012,'Ns');
   /* rear endplate: rows = lower part, thin line, main part, top band; columns = rear band, middle, front */
   b.loft([[-2.78,.43,0],[-2.7,.33,0],[-2.5,.2,0],[-2.2,.2,.11]].map(s=>{const yy=[s[1],.5,.52,.86,.905],zz=y=>s[0]-s[2]*sstep(.3,.9,y);return yy.map(y=>[sd*.525,y,zz(y)]).concat(yy.slice().reverse().map(y=>[sd*.505,y,zz(y)]));}),{k:(i,j)=>'RE'+(2-i)+[0,1,2,3,3,3,2,1,0,0][j],cap:3});
   /* raised floor edge, bargeboards, sidepod deflector, floor fences */
   b.tube([X(.79,.08,.72),X(.79,.08,-.95),X(.625,.08,-1.49)],.016,.03,4,'d',3,.125);
   b.fin(sd*.34,1.2,.07,.2,sd*.66,.72,.07,.31,.014,'d');b.fin(sd*.5,1.1,.07,.14,sd*.76,.8,.07,.2,.012,'d');b.fin(sd*.8,.64,.07,.34,sd*.812,.42,.07,.43,.012,'d');
   b.fin(sd*.72,.6,.065,.13,sd*.775,.3,.065,.15,.01,'d');b.fin(sd*.62,.66,.065,.12,sd*.69,.42,.065,.14,.01,'d');
   /* suspension: wishbones as flat blades, push and pull rods, track rod, driveshaft; brake scoops (the drums belong to the wheels) */
   arm(X(.67,.47,1.76),X(.16,.42,1.98));arm(X(.67,.47,1.75),X(.22,.52,1.42));arm(X(.67,.2,1.76),X(.14,.245,2));arm(X(.67,.2,1.75),X(.2,.3,1.45));
   arm(X(.64,.22,1.75),X(.19,.53,1.72),.015,.015);arm(X(.67,.34,1.88),X(.17,.36,1.92),.014,.012);
   arm(X(.6,.47,-1.86),X(.07,.4,-1.55));arm(X(.6,.47,-1.85),X(.04,.38,-2.08));arm(X(.6,.2,-1.86),X(.1,.16,-1.5));arm(X(.6,.2,-1.85),X(.05,.19,-2.1));
   arm(X(.6,.44,-1.83),X(.1,.16,-1.68),.014,.014);b.tube([X(.6,.34,-1.85),X(.06,.3,-1.85)],.026,.026,6,'d');
   b.box(.04,.17,.07,sd*.57,.27,1.875,D);b.box(.05,.16,.12,sd*.52,.3,-1.71,D);   /* the front one clears the tyre up to 0.4 rad of steering */b.box(.1,.02,.07,sd*.225,.35,1.95,D);   /* ... and the camera pod on the side of the nose */
   /* mirror on its stalk */
   b.box(.15,.065,.05,sd*.53,.62,.6,at('M',sd*.53,.65,.6));b.box(.125,.045,.008,sd*.53,.63,.572,GLASS);arm(X(.28,.6,.6),X(.46,.648,.6),.02,.008);});
  /* T-camera on the airbox */
  b.box(.03,.05,.1,0,.935,-.4,D);b.box(.05,.045,.18,0,.972,-.4,tc);b.box(.2,.026,.07,0,.984,-.4,tc);
  /* halo: hoop from the cockpit sides round the front, centre pylon */
  const HP=[[.265,.69,-.08],[.262,.765,.04],[.256,.835,.2],[.243,.868,.4],[.2,.878,.58],[.115,.878,.715]];
  b.tube(HP.concat([[0,.875,.775]],HP.slice().reverse().map(p=>[-p[0],p[1],p[2]])),.03,.022,6,'d',3);b.tube([[0,.6,1.03],[0,.79,.885],[0,.87,.79]],.022,.04,6,'d',1);
  /* helmet with a dark visor band */
  {const n0=b.C.length,hy=.725,hz=.34;b.addM(HELM,hc,M4(0,hy,hz,0,0,0,.125,.135,.15));
   for(let i=n0;i<b.C.length;i+=9){const y=(b.P[i+1]+b.P[i+4]+b.P[i+7])/3-hy,z=(b.P[i+2]+b.P[i+5]+b.P[i+8])/3-hz;if(z>.05&&y>.001&&y<.078)for(let q=0;q<9;q+=3){b.C[i+q]=VISOR.r;b.C[i+q+1]=VISOR.g;b.C[i+q+2]=VISOR.b;}}}
  /* plain text through the atlas: number on the top of the monocoque (reads from behind) and on both sides of the fin, driver code
     beside the cockpit, team name on the back of the rear flap; light or dark glyphs to suit the paint under them */
  const tn=(k,x,y,z,ny)=>{const q=at(k,x,y,z,ny);return .2126*q.r+.7152*q.g+.0722*q.b>.28?TXD:TXW;},rn=uvr(cellN(ix+1)),rc=uvr(cellC(ix));
  b.decal(LN,7,8,14,17,rn,(a,q)=>[1-q,1-a],tn('Nt',0,.6,1.3),.006);
  b.decal(LE,4,5,0,2,rn,(a,q)=>[a,1-q],tn('Ef',.02,.7,-1.26,0),.006);b.decal(LE,4,5,11,13,rn,(a,q)=>[1-a,q],tn('Ef',-.02,.7,-1.26,0),.006);
  b.decal(LN,11,12,3,4,rc,(a,q)=>[a,1-q],tn('Ns',.28,.47,.75,0),.006);b.decal(LN,11,12,11,12,rc,(a,q)=>[1-a,q],tn('Ns',-.28,.47,.75,0),.006);
  b.decal(LF,0,1,3,5,uvr(cellT(t.i)),(a,q)=>[a,1-q],tn('R1',0,.86,-2.72,-.6),.005);
  return b.geom();}
 const mkObj=(geo,mat)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=false;m.rotation.order='YXZ';m.matrixAutoUpdate=false;scene.add(m);return m;};
 /* wheel anchors: x, z, width, steers */
 const WR=.34,WF1=[[.83,1.75,.31,1],[-.83,1.75,.31,1],[.79,-1.85,.4,0],[-.79,-1.85,.4,0]],WSC=[[.8,1.36,.28,1],[-.8,1.36,.28,1],[.8,-1.3,.3,0],[-.8,-1.3,.3,0]];
 const carList=K.cars.map((c,i)=>({c,obj:mkObj(carGeo(c,i),c.team.code==='RBR'?carMatt:carMat),st:{},wp:WF1,live:false,comp:'',wk:null}));

 /* ---------- safety car: plain red coupe, amber and green light bar, no badges ---------- */
 const scA=(()=>{const b=new Batch(),R=C(0xc4161c),G=C(0x14171b),L=C(0xe9e9e2);
  b.box(1.72,.62,4.5,0,.16,0,R);b.addM(GEO.box,R,M4(0,.79,1.44,.13,0,0,1.66,.12,1.62));b.box(1.56,.36,1.5,0,.78,-.45,G);     /* lower body, bonnet, glass house */
  b.addM(GEO.box,G,M4(0,1.04,.42,.49,0,0,1.48,.05,.68));b.box(1.46,.07,.95,0,1.16,-.42,R);                               /* windscreen, roof */
  b.addM(GEO.box,R,M4(0,1.02,-1.5,-.276,0,0,1.54,.08,1.26));b.addM(GEO.box,G,M4(0,1.07,-1.3,-.276,0,0,1.26,.02,.6));     /* fastback, rear window */
  b.box(1.54,.2,.42,0,.78,-1.41,R);b.box(1.58,.1,.42,0,.78,-1.81,R);b.box(1.6,.07,.34,0,.78,-2.08,R);
  [-1,1].forEach(s=>{b.box(.3,.1,.94,s*.8,.69,1.36,R);b.box(.3,.1,.94,s*.8,.69,-1.3,R);b.box(.06,.1,1.7,s*.87,.16,.03,G);b.box(.15,.09,.08,s*.9,.86,.3,R);
   b.box(.32,.1,.06,s*.56,.6,2.24,L);b.box(.3,.1,.24,s*.36,1.275,-.42,C(0xd98a12));});
  b.box(1.0,.22,.05,0,.28,2.24,G);b.box(1.62,.05,.2,0,.13,2.2,G);b.box(1.44,.07,.05,0,.66,-2.24,C(0x7a0c10));b.box(1.3,.12,.1,0,.16,-2.22,G);
  b.box(1.12,.05,.26,0,1.23,-.42,G);b.box(.3,.1,.24,0,1.275,-.42,C(0x1f7a3a));
  const U=[];for(let i=0;i<b.P.length;i+=3)U.push(WU,WV);const g=b.geom();g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  return {c:K.SC,obj:mkObj(g,carMat),st:{},wp:WSC,live:false};})();

 /* ---------- wheels: one InstancedMesh; the instance colour tints the sidewall ring (compound) ---------- */
 const TYC={S:C(0xe0362b),M:C(0xf5c518),H:C(0xf2f2ee),SC:C(0x2b2c2f)};
 /* The wheel is turned round its axle (x) from a profile of [x, radius] points that runs over the top from the inner side to the
    outer side: tyre with rounded shoulders, the compound band on the outer sidewall, a 13-inch rim set back in the wheel with ten
    spokes. Width 1 here; the instance scales x to the tyre width. Local +x is the outer face, so right-hand wheels are turned round.
    Instance colour = the compound band; second instance colour = the sidewall inside the band (tyre black on the racing cars, rim
    grey on the safety car, which so gets a larger wheel and a lower tyre). */
 const wheels=(()=>{const b=new TBatch(),SEG=20,SPOKE=C(0x6f7278);
  const lathe=(pr,col)=>{const n=pr.length,nr=pr.map((p,i)=>{let ax=0,ar=0;for(const k of [i-1,i]){if(k<0||k>n-2)continue;const dx=pr[k+1][0]-pr[k][0],dr=pr[k+1][1]-pr[k][1],l=Math.hypot(dx,dr)||1;ax-=dr/l;ar+=dx/l;}const l=Math.hypot(ax,ar)||1;return [ax/l,ar/l];});
   const put=(i,f)=>{const cs=Math.cos(f),sn=Math.sin(f);b.P.push(pr[i][0],pr[i][1]*cs,pr[i][1]*sn);b.N.push(nr[i][0],nr[i][1]*cs,nr[i][1]*sn);b.C.push(col.r,col.g,col.b);b.T.push(b.t[0],b.t[1]);};
   for(let i=0;i<n-1;i++)for(let j=0;j<SEG;j++){const f0=j/SEG*TAU,f1=(j+1)/SEG*TAU;if(pr[i][1]>0){put(i,f0);put(i,f1);put(i+1,f1);}if(pr[i+1][1]>0){put(i,f0);put(i+1,f1);put(i+1,f0);}}};
  lathe([[-.8,0],[-.8,.165],[-.45,.165]],CARBON);                                                             /* brake drum on the inner side: it steers with the wheel */
  lathe([[-.45,.165],[-.45,.188],[-.5,.25],[-.5,.3],[-.455,.33],[-.37,.34],[.37,.34],[.455,.33],[.5,.3]],P.tyre);
  b.tint(1,0);lathe([[.5,.3],[.5,.252]],WHITE);b.tint(0,1);lathe([[.5,.252],[.47,.19]],WHITE);b.tint(0,0);
  lathe([[.47,.19],[.46,.172],[.3,.162],[.3,0]],RIMC);
  for(let k=0;k<5;k++)b.addM(GEO.box,SPOKE,M4(.35,0,0,k*PI/5,0,0,.1,.02,.32));b.cylX(.045,.13,.36,0,0,SILV,8);
  const n4=carList.length*4,im=inst(b.geom(),mattM,n4+4),a2=im.geometry.attributes.iCol2.array;
  for(let k=0;k<n4+4;k++){const c=k<n4?P.tyre:SPOKE;a2[k*3]=c.r;a2[k*3+1]=c.g;a2[k*3+2]=c.b;}im.geometry.attributes.iCol2.needsUpdate=true;
  for(let k=0;k<4;k++)im.setColorAt(n4+k,TYC.SC);return im;})();
 function placeWheels(a,base,roll,steer){const wp=a.wp,mat=a.obj.matrix;
  for(let k=0;k<4;k++){const w=wp[k],r=w[0]<0;_e.set(r?-roll:roll,(w[3]?steer:0)+(r?PI:0),0);_q.setFromEuler(_e);_p.set(w[0],WR,w[1]);_s.set(w[2],1,1);_m.compose(_p,_q,_s);_m2.multiplyMatrices(mat,_m);wheels.setMatrixAt(base+k,_m2);}}
 function hideWheels(base){for(let k=0;k<4;k++)wheels.setMatrixAt(base+k,_zero);}

 /* ---------- lights and markers ---------- */
 const gS=new GlowSet(160,2.4),gB=new GlowSet(48,7);
 function glowL(set,obj,lx,ly,lz,col,k){_p.set(lx,ly,lz).applyMatrix4(obj.matrix);set.add(_p.x,_p.y,_p.z,col,k);}
 const NM=carList.length+1,mkP=new Float32Array(NM*3).fill(1e8),mkC=new Float32Array(NM*3);
 const markers=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const g2=cv.getContext('2d');g2.beginPath();g2.arc(32,32,26,0,TAU);g2.fillStyle='#fff';g2.fill();g2.lineWidth=8;g2.strokeStyle='rgba(16,18,22,.92)';g2.stroke();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(mkP,3));g.setAttribute('color',new THREE.BufferAttribute(mkC,3));
  K.ALL.forEach((c,i)=>{const k=C(c.team.ui);mkC[i*3]=k.r;mkC[i*3+1]=k.g;mkC[i*3+2]=k.b;});
  const m=new THREE.Points(g,new THREE.PointsMaterial({size:MOBILE?14:13,sizeAttenuation:false,vertexColors:true,map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false,depthWrite:false,fog:false}));
  m.frustumCulled=false;m.renderOrder=8;scene.add(m);return m;})();
 /* the safety car shows green while the released cars go by, amber otherwise */
 const GREEN=(()=>{const r=K.RELEASE?Object.keys(K.RELEASE).map(k=>K.RELEASE[k]):[];return r.length?[Math.min.apply(null,r)-1,Math.max.apply(null,r)+7]:[1,0];})();

 let frameN=0,wreckFx=null;
 function tickCars(rt,night,jumped){const tyreDue=jumped||frameN%5===0,flash=frac(rt*4)<.5;let colDirty=false;
  for(let i=0;i<carList.length;i++){const a=carList[i],c=a.c,s=K.carState(c,rt,a.st),obj=a.obj;a.live=!!s.vis;a.fx=null;
   if(a.wk&&wreckFx)wreckFx(a,rt,s);
   const f=a.fx,vis=f?f.vis:a.live;
   mkP[i*3]=a.live?s.x:1e8;mkP[i*3+1]=a.live?(s.y||0)+1.2:1e8;mkP[i*3+2]=a.live?s.z:1e8;
   obj.visible=vis;if(!vis){hideWheels(i*4);continue;}
   let pitch=0;if(s.type===1)pitch=-Math.atan2(K.pitY(s.d+1.8)-K.pitY(s.d-1.8),3.6);
   if(f){obj.position.set(f.x,f.y,f.z);obj.rotation.set(f.rx||0,f.h,f.rz||0);obj.scale.setScalar(f.sc);}
   else{obj.position.set(s.x,s.y||0,s.z);obj.rotation.set(pitch,s.h,0);if(obj.scale.x!==1)obj.scale.setScalar(1);}
   obj.updateMatrix();
   placeWheels(a,i*4,((s.type===1?s.d:s.D)/WR)%TAU,s.type===0&&s.v>1?clamp(K.tAt(K.TK,s.d)*4.6,-.45,.45):0);
   if(tyreDue){const ty=K.tyre(c,rt).comp;if(ty!==a.comp){a.comp=ty;const col=TYC[ty]||TYC.H;for(let k=0;k<4;k++)wheels.setColorAt(i*4+k,col);colDirty=true;}}
   /* rear light: a small point just behind the car, so it never washes over the bodywork */
   const lim=s.type===1&&s.v>1&&s.d>K.Q_LIM0&&s.d<K.Q_LIM1,rk=lim?(flash?.9:.1):night*.55;
   if(rk>.02&&a.live)glowL(gS,obj,0,.33,-2.86,cR,rk);}
  /* safety car */
  {const a=scA,s=K.carState(K.SC,rt,a.st),obj=a.obj,i=carList.length;a.live=!!s.out;let pitch=0;if(s.type===1)pitch=-Math.atan2(K.pitY(s.d+1.5)-K.pitY(s.d-1.5),3);
   obj.position.set(s.x,s.y||0,s.z);obj.rotation.set(pitch,s.h,0);obj.updateMatrix();
   placeWheels(a,i*4,((s.type===1?s.d:s.D)/WR)%TAU,s.type===0&&s.v>1?clamp(K.tAt(K.TK,s.d)*3.6,-.45,.45):0);
   mkP[i*3]=a.live?s.x:1e8;mkP[i*3+1]=a.live?(s.y||0)+1.4:1e8;mkP[i*3+2]=a.live?s.z:1e8;
   if(s.lights){const ph=frac(rt*3)<.5,col=rt>=GREEN[0]&&rt<GREEN[1]?cGrn:cAmb;glowL(gS,obj,.36,1.37,-.42,col,ph?1.15:.1);glowL(gS,obj,-.36,1.37,-.42,col,ph?.1:1.15);glowL(gB,obj,0,1.5,-.42,col,.3);}
   if(a.live&&night>.05){glowL(gS,obj,.56,.65,2.3,cW,night);glowL(gS,obj,-.56,.65,2.3,cW,night);glowL(gS,obj,.6,.69,-2.28,cR,night*.7);glowL(gS,obj,-.6,.69,-2.28,cR,night*.7);}}
  if(colDirty)wheels.instanceColor.needsUpdate=true;wheels.instanceMatrix.needsUpdate=true;markers.geometry.attributes.position.needsUpdate=true;}

 /* ---------- people: three InstancedMeshes (bodies, arms, legs), about 1.74 m tall ----------
    instance colour = clothes; iCol2 = head (skin or helmet) on bodies, hands on arms, trousers on legs */
 const FIGMAX=168,HIP=.84,SHO=1.36,gy=v=>new THREE.Color(v,v,v);
 const figBody=(()=>{const b=new TBatch();b.tint(1,0).box(.42,.58,.24,0,.84,0,WHITE);b.box(.37,.1,.22,0,.76,0,gy(.82));b.box(.2,.045,.21,0,1.7,-.005,gy(.86));b.box(.16,.02,.1,0,1.7,.13,gy(.86));
  b.tint(0,1).addM(new THREE.IcosahedronGeometry(1,1),WHITE,M4(0,1.6,0,0,0,0,.125,.135,.13));return inst(b.geom(),mattM,FIGMAX);})();
 const figArm=(()=>{const b=new TBatch();b.tint(1,0).box(.11,.6,.12,0,-.6,0,gy(.9));b.tint(0,1).box(.09,.11,.1,0,-.71,0,WHITE);return inst(b.geom(),mattM,FIGMAX*2);})();
 const figLeg=(()=>{const b=new TBatch();b.tint(0,1).box(.16,.84,.18,0,-.84,0,gy(.84));b.tint(0,0).box(.16,.07,.27,0,-.84,.045,C(0x1d1d20));return inst(b.geom(),mattM,FIGMAX*2);})();
 const col2=(im,j,c)=>{const a=im.geometry.attributes.iCol2.array;a[j*3]=c.r;a[j*3+1]=c.g;a[j*3+2]=c.b;};
 const SKIN=[0xe8bc98,0xd3a17c,0xb47e58,0x8d5c3e,0xf1cba8].map(C),GLOVE=C(0x202226);
 let nFig=0;
 /* clothes, trousers, head, hands */
 function newFig(cl,tr,hd,gl){const i=nFig++;figBody.setColorAt(i,cl);col2(figBody,i,hd);for(let k=0;k<2;k++){figArm.setColorAt(i*2+k,cl);col2(figArm,i*2+k,gl||hd);col2(figLeg,i*2+k,tr||cl);}return i;}
 function limb(im,j,px,py,rx,rz,sy){_e2.set(rx,0,rz);_q.setFromEuler(_e2);_p.set(px,py,0);_s.set(1,sy,1);_m.compose(_p,_q,_s);_m2.multiplyMatrices(_mB,_m);im.setMatrixAt(j,_m2);}
 /* one figure: feet at (x,y,z), heading hd, lean forward, drop = crouch depth in metres,
    aL/aR arm swing forward (PI = straight up), sL/sR arm spread, lL/lR leg swing forward, sc scale (0 hides) */
 function put(i,x,y,z,hd,lean,drop,aL,sL,aR,sR,lL,lR,sc){
  if(!(sc>0)){figBody.setMatrixAt(i,_zero);figArm.setMatrixAt(i*2,_zero);figArm.setMatrixAt(i*2+1,_zero);figLeg.setMatrixAt(i*2,_zero);figLeg.setMatrixAt(i*2+1,_zero);return;}
  _e.set(lean,hd,0);_q.setFromEuler(_e);_p.set(x,y,z);_s.set(sc,sc,sc);_mB.compose(_p,_q,_s);
  _m.makeTranslation(0,-drop,0);_m2.multiplyMatrices(_mB,_m);figBody.setMatrixAt(i,_m2);
  limb(figArm,i*2,.27,SHO-drop,-aL,sL,1);limb(figArm,i*2+1,-.27,SHO-drop,-aR,-sR,1);
  const ls=(HIP-drop)/HIP;limb(figLeg,i*2,.1,HIP-drop,-lL,0,ls);limb(figLeg,i*2+1,-.1,HIP-drop,-lR,0,ls);}
 const bump=(t,t0,rise,hold,fall)=>sstep(t0,t0+rise,t)*(1-sstep(t0+rise+hold,t0+rise+hold+fall,t));

 /* ---------- team crews: 10 pit crew, 3 on the pit-wall stand, a few more at the Red Bull and Mercedes garages ---------- */
 const lum=c=>c.r*.2126+c.g*.7152+c.b*.0722;
 const crewCol=t=>{const c=hx(t.body);if(lum(c)<.03){c.multiplyScalar(1.9);c.r=Math.max(c.r,.028);c.g=Math.max(c.g,.03);c.b=Math.max(c.b,.034);}return c;};
 /* pit-stop places around the box: [along, across, facing (relative to the lane heading), crouch, arms, lean] */
 const WORK=[[3.55,0,PI,.22,1.1,.15],[-3.6,0,0,.22,1.1,.15],[1.75,1.5,-PI/2,.42,1.25,.2],[1.75,-1.5,PI/2,.42,1.25,.2],[-1.85,1.5,-PI/2,.42,1.25,.2],[-1.85,-1.5,PI/2,.42,1.25,.2],
  [2.6,1.8,-PI/2-.5,.1,.9,.3],[2.6,-1.8,PI/2+.5,.1,.9,.3],[-2.7,1.8,-PI/2+.5,.1,.9,.3],[-2.7,-1.8,PI/2-.5,.1,.9,.3]];
 const TM=K.TEAMS.map(t=>{const T={t,q0:t.boxQ,crew:[],wall:[],extra:[],stops:[],idle:false,special:false},cl=crewCol(t),helm=hx(t.second),nx=t.code==='RBR'?7:t.code==='MER'?5:0;
  K.cars.forEach(c=>{if(c.team===t)c.stopInfo.forEach(s=>{if(isFinite(s.t0)&&isFinite(s.t1))T.stops.push({t0:s.t0,t1:s.t1});});});
  const mk=(q,lat,face,helmet)=>{K.pitPos(q,lat,_o);return {i:newFig(cl,null,helmet?helm:pick(SKIN),helmet?GLOVE:null),hq:q,hl:lat,ix:_o.x,iz:_o.z,ih:_o.h+face,p1:rnd(),p2:rnd(),p3:rnd()};};
  for(let j=0;j<10;j++)T.crew.push(j<4?mk(T.q0+[-5.4,-1.9,1.7,5.2][j]+rr(-.3,.3),PIT.crewLat+rr(-.25,.25),PI/2+rr(-.5,.5),true):mk(T.q0+rr(-7.5,7.5),PIT.garageLat-rr(1.3,5.2),rr(-PI,PI),true));
  for(let j=0;j<3;j++)T.wall.push(mk(T.q0+(j-1)*1.15,PIT.standLat,PI/2+rr(-.12,.12),false));
  for(let j=0;j<nx;j++)T.extra.push(mk(T.q0-8+16*(j+.5)/nx+rr(-.4,.4),PIT.crewLat-.95+rr(-.2,.2),PI/2+rr(-.35,.35),false));
  return T;});
 const putIdle=f=>put(f.i,f.ix,0,f.iz,f.ih,0,0,0,.06,0,.06,0,0,1);
 TM.forEach(T=>{T.wall.forEach(putIdle);T.extra.forEach(putIdle);});
 function teamTick(T,rt){let k=0,near=0,rel=0;
  for(const s of T.stops){if(rt<s.t0-14||rt>s.t1+6)continue;k=Math.max(k,sstep(s.t0-13,s.t0-9.5,rt)*(1-sstep(s.t1+1.2,s.t1+4.6,rt)));
   near=Math.max(near,sstep(s.t0-.5,s.t0+.2,rt)*(1-sstep(s.t1-.15,s.t1+.3,rt)));rel=Math.max(rel,sstep(s.t1-.5,s.t1-.05,rt)*(1-sstep(s.t1+1.3,s.t1+2.4,rt)));}
  if(k<=0){if(T.idle)return false;T.idle=true;T.crew.forEach(putIdle);return true;}
  T.idle=false;
  for(let j=0;j<10;j++){const f=T.crew[j],W=WORK[j];let u=W[0],w=W[1]*(1+.34*(1-near));if(j===0){u+=.9*(1-near);w-=1.9*rel;}
   K.pitPos(T.q0+u,K.BOXLAT+w,_o);const wk=k<1?Math.sin(k*11+j)*.55*Math.min(1,k*6,(1-k)*6):0,arm=W[4]*near;
   put(f.i,lerp(f.ix,_o.x,k),0,lerp(f.iz,_o.z,k),f.ih+angd(f.ih,_o.h+W[2])*k,W[5]*near,W[3]*near*k,arm-wk*.6,.05,arm+wk*.6,.05,wk,-wk,1);}
  return true;}

 /* ---------- the finish: the Red Bull crew goes to the pit wall, climbs the fence, celebrates ---------- */
 const RBT=TM.find(T=>T.t.code==='RBR')||TM[0],V=K.carBy.VER,HAM=K.carBy.HAM,tL=HAM.cum[56],tF=K.T_FIN,tP=K.tPass,WALLQ=PIT.wallLat-.19;
 const RB=(()=>{const q0=RBT.q0,walk=RBT.crew.concat(RBT.extra).sort((a,b)=>a.hq-b.hq),n=walk.length,nw=Math.ceil(n/2),slots=[];
  for(let k=0;k<nw;k++)slots.push(q0-3.2-.95*k);for(let k=0;k<n-nw;k++)slots.push(q0+3.2+.95*k);slots.sort((a,b)=>a-b);
  /* the safety car drives down the pit lane just before; nobody crosses until it has gone by */
  let tW=tL-6;try{let a=K.scTP,b=K.scT1;if(b>a){for(let i=0;i<40;i++){const m=(a+b)/2;K.scProg(m,_o);if(_o.type===1&&_o.d<q0+14&&m<K.scT1)a=m;else b=m;}tW=b+1.2;}}catch(e){}
  tW=Math.min(tW,tP-8.6);const span=clamp(tP-1.6-5.4-tW,1.2,7);
  walk.forEach((f,k)=>{f.sq=slots[k];f.sl=4.72;f.walk=true;f.climb=k%3!==2;f.run=!f.climb;f.down=f.climb&&k%4===0;f.dOut=f.p1*span;f.wd=4.5+f.p2*.9;f.hz=1.55+f.p3*.6;
   /* runners keep to the strip between the fast lane and the timing stands, so a car coming down the lane never meets them */
   f.r=.15+f.p2*.95;f.c=f.p3*3.8;f.rd=11.5+f.p1*3.5;f.rl=2.75+f.p2*.45;K.pitPos(f.sq,f.sl,_o);f.wh=Math.atan2(_o.x-f.ix,_o.z-f.iz);});
  RBT.wall.forEach(f=>{f.sq=f.hq;f.sl=f.hl;f.walk=false;f.climb=false;f.run=false;f.dOut=0;f.wd=1;f.hz=1.6+f.p3*.5;f.r=.1+f.p2*.6;f.c=0;});
  return {tW,all:walk.concat(RBT.wall),q0,west:q0-11.8,east:q0+11};})();
 function rbPose(f,rt){const u=f.walk?clamp((rt-(RB.tW+f.dOut))/f.wd,0,1):1,e=u*u*(3-2*u);
  let q=lerp(f.hq,f.sq,e),lat=lerp(f.hl,f.sl,e),y=0,lean=0,drop=0,aL=0,aR=0,sL=.06,sR=.06,lL=0,lR=0,hop=0,turn=0,face=PI/2;
  if(u>0&&u<1){const ph=(rt-RB.tW-f.dOut)*8+f.p1*6;lL=Math.sin(ph)*.62;lR=-lL;aL=-lL*.7;aR=-lR*.7;lean=.07;}
  if(u>=1){const ta=f.walk?RB.tW+f.dOut+f.wd:RB.tW-.5;aL=aR=.95*sstep(ta,ta+.7,rt);   /* forearms on the wall */
   const cz=bump(rt,tP+f.r,.25,3.6+f.p1*1.6,.9);                    /* the pass at Turn 5 */
   if(cz>0){const w=(rt-tP-f.r);hop=Math.abs(Math.sin(w*PI*f.hz))*.26*cz;aL=lerp(aL,2.75+.25*Math.sin(w*9+f.p2*6),cz);aR=lerp(aR,2.75+.25*Math.sin(w*9+f.p3*6),cz);sL=sR=lerp(.06,-.32,cz);}
   let up=0;
   if(f.climb){const uc=clamp((rt-(tF-13.2+f.c))/2.2,0,1),ud=f.down?clamp((rt-(tF+10+f.c*1.4))/1.7,0,1):0;up=uc*uc*(3-2*uc)*(1-ud*ud*(3-2*ud));
    if(up>0){y=up*PIT.wallTop;lat=lerp(lat,WALLQ,up);const mv=Math.sin(up*PI);lean=.17*up;aL=lerp(aL,2.35,up);aR=lerp(aR,2.05+.5*mv,up);lL=mv*.9;lR=-mv*.35;sL=sR=.08;}}
   else if(rt>tF-13&&rt<tF){hop=Math.max(hop,Math.abs(Math.sin((rt-tF)*PI*1.3+f.p1*3))*.05);}       /* on their toes */
   const cf=sstep(tF-.1,tF+.35,rt);                                 /* the chequered flag */
   if(cf>0){const w=rt-tF,dec=1-.45*sstep(40,120,w),hz=f.hz*(1+.15*Math.sin(w*.35+f.p1*5));
    if(up>.5){aR=lerp(aR,2.8+.3*Math.sin(w*10+f.p2*6),cf);aL=lerp(aL,2.5+.2*Math.sin(w*10+f.p3*6),cf*.7);sL=sR=lerp(.08,-.25,cf);hop=Math.abs(Math.sin(w*PI*hz+f.p1*3))*.09*cf*dec;lean=lerp(lean,.2+.05*Math.sin(w*5+f.p2*6),cf);}
    else{hop=Math.abs(Math.sin(w*PI*hz+f.p1*3))*.3*cf*dec;aL=lerp(aL,2.8+.3*Math.sin(w*9+f.p2*6),cf);aR=lerp(aR,2.8+.3*Math.sin(w*9+f.p3*6),cf);sL=sR=lerp(.06,-.33,cf);if(f.down){lat=lerp(lat,4.1-f.p2*1.2,sstep(0,1,(rt-(tF+11.7+f.c*1.4))/1.5));turn=(f.p1-.5)*2.4*sstep(tF+11,tF+14,rt);}}
    if(f.run){const tr=rt-(tF+1.2+f.p1*2.2);if(tr>0){const run=Math.min(tr,f.rd),d=4.7*(run-.5*(1-Math.exp(-2*run))),go=tr<f.rd?1:0,k1=sstep(0,.5,tr);
      q-=d;lat=lerp(lat,f.rl,sstep(0,1,tr));face=lerp(PI/2,PI,k1);
      if(go){const ph=tr*17+f.p2*6;lL=Math.sin(ph)*.78;lR=-lL;hop=Math.abs(Math.sin(ph))*.07;lean=.13;aL=2.5+.4*Math.sin(ph);aR=2.5-.4*Math.sin(ph);sL=sR=-.2;}
      else{face=lerp(PI,(f.p3-.5)*1.6,sstep(f.rd,f.rd+.6,tr));}}}}}
  K.pitPos(q,lat,_o);let hd=_o.h+face+turn;if(u>0&&u<1)hd=f.wh;else if(u<=0)hd=f.ih;
  put(f.i,_o.x,y+hop,_o.z,hd,lean,drop,aL,sL,aR,sR,lL,lR,1);}
 function rbTick(rt){const on=rt>=RB.tW-.5;if(!on){if(RBT.special){RBT.special=false;RBT.idle=false;RBT.wall.forEach(putIdle);RBT.extra.forEach(putIdle);}return false;}
  RBT.special=true;RBT.idle=false;for(const f of RB.all)rbPose(f,rt);return true;}
 function tickCrews(rt){let ch=false;for(const T of TM){if(T===RBT&&rbTick(rt)){ch=true;continue;}if(teamTick(T,rt))ch=true;}return ch;}

 /* ---------- stopped cars: marshals at both; a recovery vehicle lifts the crashed one, the parked one is pushed away ----------
    The kernel says where the car stops and when it is gone; the lift, the push and the people are illustration. */
 const propM=std({vertexColors:true,flatShading:true,roughness:.8});propM.onBeforeCompile=glowPatch;
 const MORANGE=C(0xf07a1a),CR_REACH=7.1,CR_LAT=-(K.HW+1.6),CR_FAR=82;
 const flags=(()=>{const b=new TBatch();b.box(.03,.95,.03,0,0,0,C(0x333333));b.tint(1,0).box(.62,.46,.02,.33,.47,0,WHITE);return inst(b.geom(),mattM,4,false);})();
 const truck=(()=>{const b=new Batch(),Y=C(0xf2b632),D=C(0x26272a),G=C(0x2f3840);
  b.box(2.1,.9,4.4,0,.55,0,Y);b.box(1.05,.95,1.35,-.5,1.45,-.25,Y);b.box(1.09,.5,1.39,-.5,1.78,-.25,G);b.box(1.0,.75,1.1,.5,1.45,-1.55,D);b.box(2.2,.2,.3,0,.5,2.25,D);
  [[-1,1.45],[1,1.45],[-1,-1.45],[1,-1.45]].forEach(w=>{b.cylX(.62,.52,w[0]*.95,.62,w[1],D,12);b.cylX(.3,.56,w[0]*.95,.62,w[1],Y,8);});
  const body=b.mesh(propM,true,false),bb=new Batch();bb.box(.34,.34,8.6,0,-.17,4.3,Y);bb.box(.3,.3,.5,0,-.3,8.4,D);bb.box(.07,1.3,.07,0,-1.47,8.5,D);
  const boom=bb.mesh(propM,true,false);boom.position.set(.45,2.15,-1.5);const g=new THREE.Group();g.add(body);g.add(boom);g.rotation.order='YXZ';g.visible=false;scene.add(g);return {g,boom};})();
 const WK=[];
 carList.forEach(a=>{const g=a.c.segs.find(q=>q.wreck);if(!g||!(g.t1>g.t0+30))return;K.trackPos(g.d,g.lat,_o);const dur=g.t1-g.t0,a0=Math.min(70,dur*.14);
  const w={a,t0:g.t0,t1:g.t1,d:g.d,lat:g.lat,th:_o.h,h:_o.h+(g.yaw||0),crane:!!g.yaw&&!WK.some(q=>q.crane),a0,a1:a0+Math.min(32,dur*.07),m:[],on:false,fx:{vis:true,x:0,y:0,z:0,h:0,rx:0,rz:0,sc:1}};
  w.tEnd=g.t1+(w.crane?27:7);for(let k=0;k<(w.crane?5:4);k++)w.m.push({i:newFig(MORANGE,null,pick(SKIN),null),p1:rnd()});
  w.fm={i:newFig(MORANGE,null,pick(SKIN),null)};w.fi=WK.length;if(w.fi<4)flags.setColorAt(w.fi,C(0xffd400));a.wk=w;WK.push(w);});
 const ease=u=>u*u*(3-2*u);
 /* recovery vehicle: distance of its centre ahead of the stopped car, boom pitch, lift of the car */
 const crAlong=(w,rt)=>rt<w.t1-4?lerp(CR_FAR,CR_REACH,ease(clamp((rt-w.t0-w.a0)/(w.a1-w.a0),0,1))):lerp(CR_REACH,CR_FAR,ease(clamp((rt-w.t1+4)/29.5,0,1)));
 const crPitch=(w,rt)=>.3-.28*sstep(w.t1-27,w.t1-22,rt)+.16*sstep(w.t1-20,w.t1-11,rt);
 const crLift=(w,rt)=>rt<w.t1-20?0:Math.max(0,2.15+8.6*Math.sin(crPitch(w,rt))-2.32);
 wreckFx=(a,rt,s)=>{const w=a.wk,f=w.fx;if(rt>=w.tEnd)return;
  if(w.crane){if(rt<w.t1-20)return;K.trackPos(w.d+crAlong(w,rt)-CR_REACH,lerp(w.lat,CR_LAT-.45,sstep(w.t1-4,w.t1+3,rt)),_o);f.x=_o.x;f.z=_o.z;f.y=crLift(w,rt);f.h=w.h+.12*Math.sin((rt-w.t1)*.5)*sstep(w.t1-18,w.t1-12,rt);f.rz=.05*Math.sin((rt-w.t1)*.9);}
  else{if(rt<w.t1-16)return;const k=sstep(w.t1-16,w.t1+6,rt);K.trackPos(w.d+14*k,w.lat-2.6*sstep(w.t1-9,w.t1+6,rt),_o);f.x=_o.x;f.z=_o.z;f.y=0;f.h=w.th-.14*sstep(w.t1-12,w.t1+2,rt);f.rz=0;}
  f.sc=1-sstep(w.tEnd-1.4,w.tEnd,rt);f.vis=f.sc>.01;a.fx=f;};
 function tickWrecks(rt){let ch=false,trk=false;
  for(const w of WK){const on=rt>=w.t0+3&&rt<w.tEnd+10;
   if(!on){if(w.on){w.on=false;ch=true;w.m.forEach(m=>put(m.i,0,0,0,0,0,0,0,0,0,0,0,0,0));put(w.fm.i,0,0,0,0,0,0,0,0,0,0,0,0,0);if(w.fi<4)flags.setMatrixAt(w.fi,_zero);}continue;}
   w.on=true;ch=true;
   /* yellow flag up the road */
   {const sc=sstep(w.t0+3,w.t0+3.6,rt)*(1-sstep(w.t1+5,w.t1+5.8,rt)),wv=Math.sin(rt*7);K.trackPos(w.d-34,w.lat-.6,_o);const hd=_o.h+PI;
    put(w.fm.i,_o.x,0,_o.z,hd,0,0,.2,.06,2.85,-.1+.12*wv,0,0,sc);
    if(w.fi<4){if(sc>0){_e.set(0,hd,.5*wv);_q.setFromEuler(_e);_p.set(_o.x-Math.cos(hd)*.3,1.98,_o.z+Math.sin(hd)*.3);_s.set(sc,sc,sc);_m.compose(_p,_q,_s);flags.setMatrixAt(w.fi,_m);}else flags.setMatrixAt(w.fi,_zero);}}
   if(w.crane){const al=crAlong(w,rt)-CR_REACH,lift=crLift(w,rt),vis=rt>=w.t0+w.a0&&rt<w.tEnd;
    if(vis){trk=true;K.trackPos(w.d+al+CR_REACH,CR_LAT,_o);const sc=sstep(w.t0+w.a0,w.t0+w.a0+1.2,rt)*(1-sstep(w.tEnd-1.4,w.tEnd,rt));truck.g.position.set(_o.x,0,_o.z);truck.g.rotation.y=_o.h+PI;truck.g.scale.setScalar(Math.max(.001,sc));truck.boom.rotation.x=-crPitch(w,rt);truck.g.updateMatrix();
     glowL(gS,truck.g,-.5,2.5,-.25,cAmb,frac(rt*1.6)<.5?1:.15);}
    const T=[[-3.6,1.3],[-1.3,3],[1.5,3],[3.6,1.2],[5.8,2.4]];
    w.m.forEach((m,k)=>{const tA=w.t0+7+k*1.6,u=ease(clamp((rt-tA)/6,0,1)),back=sstep(w.t1-29,w.t1-26,rt),lv=ease(clamp((rt-(w.t1-3+k*.6))/13,0,1));
     const ds=lerp(lerp(T[k][0]+17,T[k][0],u),T[k][0]+32,lv),dl=lerp(lerp(-.2,T[k][1]+back*1.2,u),2.3+k*.25,lv),moving=(u>0&&u<1)||(lv>0&&lv<1);
     K.trackPos(w.d+ds,w.lat+dl,_o);const face=moving?(lv>0?_o.h:_o.h+PI):Math.atan2(w.a.obj.position.x-_o.x,w.a.obj.position.z-_o.z),wk=moving?Math.sin(rt*7+k*2)*.55:0,work=(k===1||k===2)&&u>=1&&back<=0?1:0,guide=lift>0&&lv<=0?1:0;
     put(m.i,_o.x,0,_o.z,face,.25*work,.36*work,work*1.2+guide*(1.5+.2*Math.sin(rt*3+k))-wk*.6,.06,work*1.2+wk*.6,.06,wk,-wk,sstep(tA,tA+.6,rt)*(1-sstep(w.t1+9+k*.6,w.t1+10+k*.6,rt)));});}
   else{const k=sstep(w.t1-16,w.t1+6,rt),al=14*k,dlat=-2.6*sstep(w.t1-9,w.t1+6,rt),push=rt>w.t1-17?1:0,T=[[-3.5,-.55],[-3.5,.55],[-3.1,1.5],[5.2,2.2]];
    w.m.forEach((m,j)=>{const tA=w.t0+9+j*1.5,u=ease(clamp((rt-tA)/6,0,1)),pu=push&&j<3?sstep(w.t1-17,w.t1-15.2,rt):0;
     const ds=lerp(T[j][0]-16,j<3?lerp(T[j][0]-1.6,T[j][0],pu):T[j][0],u)+al,dl=lerp(2.5,T[j][1],u)+dlat;K.trackPos(w.d+ds,w.lat+dl,_o);
     const moving=(u>0&&u<1)||(k>0&&k<1),wk=moving?Math.sin(rt*(pu?5:7)+j*2)*(pu?.4:.55):0;
     put(m.i,_o.x,0,_o.z,_o.h+(j===3&&u>=1?PI:0),.38*pu,0,1.35*pu-wk*.5*(1-pu),.06,1.35*pu+wk*.5*(1-pu),.06,wk,-wk,sstep(tA,tA+.6,rt)*(1-sstep(w.tEnd-1.4,w.tEnd,rt)));});}}
  if(truck.g.visible!==trk)truck.g.visible=trk;if(ch)flags.instanceMatrix.needsUpdate=true;return ch;}

 /* ---------- chequered flag on the gantry platform (right-hand post, pit wall side) ---------- */
 const CHQ=(()=>{const cv=document.createElement('canvas');cv.width=96;cv.height=64;const g=cv.getContext('2d');for(let y=0;y<4;y++)for(let x=0;x<6;x++){g.fillStyle=(x+y)%2?'#0c0c0c':'#f6f6f6';g.fillRect(x*16,y*16,16,16);}
  const tex=new THREE.CanvasTexture(cv);tex.magFilter=THREE.NearestFilter;tex.encoding=THREE.sRGBEncoding;
  const geo=new THREE.PlaneGeometry(1.5,1,8,3);geo.translate(.75,1.6,0);const mat=std({map:tex,side:THREE.DoubleSide,roughness:.85});mat.onBeforeCompile=glowPatch;
  const cloth=new THREE.Mesh(geo,mat);cloth.castShadow=true;const pb=new Batch();pb.cyl(.022,2.12,0,0,0,C(0x8a8d90),6);const pole=pb.mesh(propM,false,false);
  const g3=new THREE.Group();g3.add(cloth);g3.add(pole);g3.rotation.order='YXZ';g3.visible=false;scene.add(g3);
  K.trackPos(0,-(PIT.gantryLat-.5),_o);let tLast=tF;   /* the stage's platform is centred on the post line, open toward the track */K.cars.forEach(c=>{if(c.finished)tLast=Math.max(tLast,c.cum[c.N-1]);});
  return {g:g3,geo,base:Float32Array.from(geo.attributes.position.array),x:_o.x,y:PIT.flagY,z:_o.z,hd:_o.h+PI/2,fig:newFig(C(0xf2f2f2),C(0x24262b),pick(SKIN),null),t0:tF-5,t1:tLast+3,on:null};})();
 function tickFlag(rt){const k=sstep(CHQ.t0,CHQ.t0+.8,rt)*(1-sstep(CHQ.t1,CHQ.t1+1.2,rt)),on=k>0;
  if(!on&&CHQ.on===false)return false;CHQ.on=on;const w=Math.sin((rt-CHQ.t0)*TAU*1.15),w2=Math.cos((rt-CHQ.t0)*TAU*1.15);
  put(CHQ.fig,CHQ.x,CHQ.y,CHQ.z,CHQ.hd,.1*k,0,k*(1.75+.25*w2),k*.25*w+.06,k*(1.75+.25*w2),-k*.25*w+.06,0,0,1);
  CHQ.g.visible=on;if(on){const fx=Math.sin(CHQ.hd),fz=Math.cos(CHQ.hd);CHQ.g.position.set(CHQ.x+fx*.5,CHQ.y+1.2,CHQ.z+fz*.5);CHQ.g.rotation.set(.5+.14*w2,CHQ.hd,.85*w*k);
   const p=CHQ.geo.attributes.position,b=CHQ.base,ph=(rt-CHQ.t0)*13;for(let i=0;i<p.count;i++){const x=b[i*3];p.array[i*3+2]=Math.sin(x*3.4-ph)*.1*x+Math.sin(x*6.1-ph*1.3+b[i*3+1]*2)*.04*x;}p.needsUpdate=true;}
  return true;}

 /* ---------- start lights ---------- */
 let lightsN=-9;
 function tickLights(rt,jumped){let n=-1;if(rt<0){const s=K.status(rt);n=s.k==='lights'?s.n:0;}
  if(n!==lightsN||jumped){lightsN=n;if(WORLD.setStartLights)WORLD.setStartLights(n);}}

 /* ---------- fireworks: a pure function of the time since the chequered flag ---------- */
 const inRing=(r,x,z)=>{let f=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const xi=r[i],zi=r[i+1],xj=r[j],zj=r[j+1];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)f=!f;}return f;};
 const ND=192,DIR=new Float32Array(ND*3);for(let i=0;i<ND;i++){const y=1-2*(i+.5)/ND,r=Math.sqrt(1-y*y),a=i*2.399963+rr(-.12,.12);DIR[i*3]=Math.cos(a)*r;DIR[i*3+1]=y;DIR[i*3+2]=Math.sin(a)*r;}
 const FW=(()=>{const sites=[],o={};let off=K.HW+62;const mg=(CITY.named||[]).find(n=>n.n==='Main Grandstand');
  if(mg){let bd=1e9;for(let s=-200;s<=300;s+=10){K.trackPos(s,0,o);bd=Math.min(bd,Math.hypot(mg.x-o.x,mg.z-o.z));}off=clamp(bd+42,55,125);}
  for(let j=0;j<6;j++){K.trackPos(-70+j*46,off,o);sites.push({x:o.x,z:o.z,g:0});}                      /* behind the main grandstand */
  const ng=sites.length,wm=(CITY.water||[]).find(w=>/Marina/.test(w.n||'')),nm=(CITY.named||[]).find(n=>n.n==='Yas Marina'),mc=nm?{x:nm.x,z:nm.z}:{x:K.TX[0]+310,z:K.TZ[0]+285};
  [[0,0],[70,-50],[-60,40],[40,80],[-30,-90]].forEach(d=>{const x=mc.x+d[0],z=mc.z+d[1];if(!wm||inRing(wm.r,x,z))sites.push({x,z,g:1});});  /* over the marina */
  if(sites.length===ng)sites.push({x:mc.x,z:mc.z,g:1});
  const COLS=[0xffd27a,0xff3b2b,0xfff1dc,0x4f9bff,0x5cf08a,0xff58c8,0xff9a3c,0xb07bff].map(C),shells=[];let t=.05,cx=0,cz=0,end=0;
  while(t<79){const fin=t>61,open=t<3.2,st=rnd()<.6?sites[Math.floor(rnd()*ng)]:sites[ng+Math.floor(rnd()*(sites.length-ng))],ty=rnd(),type=ty<.55?0:ty<.74?1:ty<.9?2:3;
   const s={t0:t,rise:rr(1.25,1.85),x:st.x+rr(-9,9),z:st.z+rr(-9,9),h:rr(88,185)*(type===2?.9:1),R:rr(30,58),n:Math.floor(rr(64,112)),life:type===2?rr(2.8,3.6):rr(1.8,2.7),col:type===2?COLS[0]:pick(COLS),col2:pick(COLS),type,o:Math.floor(rnd()*ND),ti:rr(-.7,.7),az:rr(0,TAU)};
   shells.push(s);end=Math.max(end,s.t0+s.rise+s.life);t+=open?rr(.08,.3):fin?rr(.1,.34):rr(.32,.88);}
  sites.forEach(s=>{cx+=s.x/sites.length;cz+=s.z/sites.length;});
  return {sites,shells,end,center:{x:cx,y:120,z:cz}};})();
 const FWMAX=7200,FWG=20,fwPos=new Float32Array(FWMAX*3),fwCol=new Float32Array(FWMAX*3),fwGP=new Float32Array(FWG*3),fwGC=new Float32Array(FWG*3);
 const mkPts=(pos,col,size)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({size,map:dotTex,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true,fog:false,toneMapped:false}));m.frustumCulled=false;m.visible=false;m.renderOrder=6;scene.add(m);return m;};
 const fwPts=mkPts(fwPos,fwCol,10),fwGlow=mkPts(fwGP,fwGC,200);
 function tickFW(rt,kf){const tau=rt-tF;if(tau<-.2||tau>FW.end+.2){if(fwPts.visible){fwPts.visible=false;fwGlow.visible=false;}return;}
  let n=0,g=0;const P=fwPos,Q=fwCol;
  for(const s of FW.shells){const a=tau-s.t0;if(a<0)break;if(a>s.rise+s.life)continue;
   if(a<s.rise){const u=a/s.rise;for(let k=0;k<4&&n<FWMAX;k++){const uu=Math.max(0,u-k*.03),br=.95-k*.22;P[n*3]=s.x;P[n*3+1]=s.h*(1-(1-uu)*(1-uu));P[n*3+2]=s.z;Q[n*3]=br;Q[n*3+1]=.8*br;Q[n*3+2]=.5*br;n++;}continue;}
   const b=a-s.rise,k=1-b/s.life,br=Math.pow(k,1.15)*1.3,wh=1-sstep(0,.3,b),ct=Math.cos(s.ti),sn=Math.sin(s.ti),ca=Math.cos(s.az),sa=Math.sin(s.az),gq=s.type===2?4.6:2.3;
   /* every spark is drawn three times along its own path: head and a short fading tail */
   for(let tr=0;tr<3;tr++){const bb=b-tr*.075;if(bb<0)break;const r=s.R*(1-Math.exp(-3.3*bb)),drop=gq*bb*bb,bt=br*(tr===0?1:tr===1?.42:.18);
    for(let j=0;j<s.n&&n<FWMAX;j++){let dx,dy,dz;if(s.type===1){const an=j/s.n*TAU,x0=Math.cos(an),z0=Math.sin(an),y1=-z0*sn,z1=z0*ct;dx=x0*ca+z1*sa;dy=y1;dz=-x0*sa+z1*ca;}else{const d=((j*7+s.o)%ND)*3;dx=DIR[d];dy=DIR[d+1];dz=DIR[d+2];}
     const c=s.type===3&&j%2?s.col2:s.col,tw=(.72+.28*Math.sin(b*26+j*2.4))*bt;P[n*3]=s.x+dx*r;P[n*3+1]=s.h+dy*r-drop;P[n*3+2]=s.z+dz*r;Q[n*3]=lerp(c.r,1,wh)*tw;Q[n*3+1]=lerp(c.g,1,wh)*tw;Q[n*3+2]=lerp(c.b,1,wh)*tw;n++;}}
   if(b<.45&&g<FWG){const e=(1-b/.45)*.55;fwGP[g*3]=s.x;fwGP[g*3+1]=s.h;fwGP[g*3+2]=s.z;fwGC[g*3]=lerp(s.col.r,1,.4)*e;fwGC[g*3+1]=lerp(s.col.g,1,.4)*e;fwGC[g*3+2]=lerp(s.col.b,1,.4)*e;g++;}}
  const cd=Math.hypot(camera.position.x-FW.center.x,camera.position.y-FW.center.y,camera.position.z-FW.center.z);
  fwPts.material.size=clamp(cd*.0058,3.3,14)*kf;fwGlow.material.size=70*kf;
  fwPts.geometry.setDrawRange(0,n);fwPts.geometry.attributes.position.needsUpdate=true;fwPts.geometry.attributes.color.needsUpdate=true;fwPts.visible=n>0;
  fwGlow.geometry.setDrawRange(0,g);fwGlow.geometry.attributes.position.needsUpdate=true;fwGlow.geometry.attributes.color.needsUpdate=true;fwGlow.visible=g>0;}

 /* ---------- soft contact shadow under every car ---------- */
 const blobs=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d'),gr=g.createRadialGradient(32,32,4,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.9)');gr.addColorStop(.55,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
  const geo=new THREE.PlaneGeometry(1,1);geo.rotateX(-PI/2);const im=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),color:0x000000,transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6,fog:false}),NM);
  for(let i=0;i<NM;i++)im.setMatrixAt(i,_zero);im.frustumCulled=false;im.renderOrder=2;scene.add(im);return im;})();
 function tickBlobs(){const L=K.ALL.length;for(let i=0;i<L;i++){const a=i<carList.length?carList[i]:scA,o=a.obj;if(!o.visible||o.position.y>.4){blobs.setMatrixAt(i,_zero);continue;}
   _e.set(0,o.rotation.y,0);_q.setFromEuler(_e);_p.set(o.position.x,o.position.y+.07,o.position.z);_s.set(2.9*o.scale.x,1,6.6*o.scale.x);_m.compose(_p,_q,_s);blobs.setMatrixAt(i,_m);}blobs.instanceMatrix.needsUpdate=true;}

 /* ---------- per frame ---------- */
 let figDirty=true;
 function tick(rt,dt,jumped){frameN++;const night=ENV.night||0,kf=1/Math.max(.03,Math.tan(camera.fov*PI/360));
  GLOWU.value=night*.2;gS.m.material.size=.3*kf;gB.m.material.size=1.5*kf;
  tickCars(rt,night,jumped);tickBlobs();
  let ch=tickCrews(rt);if(tickWrecks(rt))ch=true;if(tickFlag(rt))ch=true;
  if(ch||figDirty||jumped){figDirty=false;figBody.instanceMatrix.needsUpdate=true;figArm.instanceMatrix.needsUpdate=true;figLeg.instanceMatrix.needsUpdate=true;}
  tickLights(rt,jumped);tickFW(rt,kf);
  /* markers only in the wide map view */
  const f=CAM.focus(),dv=CAM.mode==='map'?sstep(240,520,Math.hypot(camera.position.x-f.x,camera.position.y-f.y,camera.position.z-f.z)):0;markers.visible=dv>.02;markers.material.opacity=dv;
  gS.flush();gB.flush();}
 return {tick,cars:carList,sc:scA,RB,TM,FW,WK,CHQ,markers,people:()=>nFig};
})();
