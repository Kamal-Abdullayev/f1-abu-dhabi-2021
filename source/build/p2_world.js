/* ================= p2_world.js : WORLD, the static scenery =================
   Owner: stage. This file is the concatenation of stage_src/w1_base.js ... w6_end.js. Edit the pieces, not this file.
   Everything is built once at load from K (track and pit geometry), CITY (OpenStreetMap scenery) and PIT (shared pit layout).
   Plain text only on signs; no logos, no sponsor names. */
const WORLD=(()=>{
const T_BUILD=performance.now();
const TN=K.TN,DS=K.DS,HW=K.HW,TX=K.TX,TZ=K.TZ,NX=K.NX,NZ=K.NZ,TH=K.TH,TK=K.TK,TKW=K.TKW,PN=K.PN,PDS=K.PDS,PLEN=K.PLEN,PH=K.PH;
const V2=THREE.Vector2,wi=i=>((i%TN)+TN)%TN,sIdx=s=>wi(Math.round(K.sw(s)/DS));
/* ground layers: all within 8 cm of y = 0; the order is also enforced with polygonOffset (see MAT) so it holds at any distance */
const Y={land:-.08,golf:-.075,grass:-.07,sandp:-.065,flat:-.06,road:-.05,apron:-.035,pit:-.025,paint:-.015,track:0,mark:.012,sea:-1.5};
const Q={sand:C(0xd8cba9),sandD:C(0xcbbd9b),beach:C(0xcfc3a2),golf:C(0x86a865),grass:C(0x8fb06a),pitch:C(0x7db35f),bunker:C(0xe8dcbc),park:C(0x8c8a87),pond:C(0x4f8fa3),
 road:C(0x77757a),apron:C(0x67666a),pitT:C(0x5d5c61),tarmac:C(0x56555a),blue:C(0x8ccbe4),blueD:C(0x5fa8cf),white:C(0xf2f5f6),kerbR:C(0xc8281e),
 conc:C(0xb5b0a6),concD:C(0x8e8a83),wall:C(0xd9d6cf),wallW:C(0xefece5),steel:C(0xb4b7ba),dark:C(0x3a3c41),black:C(0x1d1e21),seat:C(0x5d7fa3),seat2:C(0x6c8db0),
 roofW:C(0xf1eee6),red:C(0xc4161c),glassD:C(0x2f3840),wood:C(0xa48a67),deck:C(0xcfc8b8),tecA:C(0xdfe3e6),tecB:C(0x7fb2cf),inter:C(0xe9e6de),interD:C(0x55565a)};
const o1={},o2={};

/* ---------- small geometry helpers (rings are arrays of [x, z]) ---------- */
function flatPts(r){const o=[];for(let i=0;i+1<r.length;i+=2)o.push([r[i],r[i+1]]);return o;}
function ringPts(r){const o=flatPts(r),n=o.length;if(n>3&&Math.abs(o[0][0]-o[n-1][0])<.01&&Math.abs(o[0][1]-o[n-1][1])<.01)o.pop();return o;}
function area2(p){let a=0;for(let i=0,n=p.length;i<n;i++){const u=p[i],v=p[(i+1)%n];a+=u[0]*v[1]-v[0]*u[1];}return a;}
function bboxP(p){let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const q of p){if(q[0]<a)a=q[0];if(q[0]>b)b=q[0];if(q[1]<c)c=q[1];if(q[1]>d)d=q[1];}return [a,b,c,d];}
function centP(p){let x=0,z=0;for(const q of p){x+=q[0];z+=q[1];}return [x/p.length,z/p.length];}
function inPts(x,z,p){let c=false;for(let i=0,n=p.length,j=n-1;i<n;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function inBox(x,z,b,m){m=m||0;return x>=b[0]-m&&x<=b[1]+m&&z>=b[2]-m&&z<=b[3]+m;}
function triFaces(pts,holes){try{return THREE.ShapeUtils.triangulateShape(pts.map(p=>new V2(p[0],p[1])),(holes||[]).map(h=>h.map(p=>new V2(p[0],p[1]))));}catch(e){return [];}}
/* upward-facing triangle and quad into a Batch (winding fixed here, so folded strips still light correctly) */
function tri(b,ax,ay,az,bx,by,bz,cx,cy,cz,c){if((bz-az)*(cx-ax)-(bx-ax)*(cz-az)<0){let t=bx;bx=cx;cx=t;t=by;by=cy;cy=t;t=bz;bz=cz;cz=t;}
 b.P.push(ax,ay,az,bx,by,bz,cx,cy,cz);b.N.push(0,1,0,0,1,0,0,1,0);b.C.push(c.r,c.g,c.b,c.r,c.g,c.b,c.r,c.g,c.b);}
function quad(b,p0,p1,p2,p3,c){tri(b,p0[0],p0[1],p0[2],p1[0],p1[1],p1[2],p2[0],p2[1],p2[2],c);tri(b,p0[0],p0[1],p0[2],p2[0],p2[1],p2[2],p3[0],p3[1],p3[2],c);}
function polyFlat(b,pts,y,c,holes){const all=holes&&holes.length?pts.concat(...holes):pts;for(const f of triFaces(pts,holes)){const A=all[f[0]],B2=all[f[1]],C2=all[f[2]];tri(b,A[0],y,A[1],B2[0],y,B2[1],C2[0],y,C2[1],c);}}
/* any quad, normal chosen to agree with the hint (hx, hy, hz) */
function bq(b,p0,p1,p2,p3,c,hx,hy,hz){const ux=p1[0]-p0[0],uy=p1[1]-p0[1],uz=p1[2]-p0[2],vx=p3[0]-p0[0],vy=p3[1]-p0[1],vz=p3[2]-p0[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
 let o=[p0,p1,p2,p0,p2,p3];if(nx*hx+ny*hy+nz*hz<0){nx=-nx;ny=-ny;nz=-nz;o=[p0,p2,p1,p0,p3,p2];}
 for(const p of o){b.P.push(p[0],p[1],p[2]);b.N.push(nx,ny,nz);b.C.push(c.r,c.g,c.b);}}
/* prism from a ring: walls y0..y1 into b, roof into rb (or b) */
function extrude(b,pts,y0,y1,wc,rc,rb){const n=pts.length;if(n<3)return;const sg=area2(pts)>0?1:-1;
 for(let i=0;i<n;i++){const p=pts[i],q=pts[(i+1)%n],dx=q[0]-p[0],dz=q[1]-p[1];bq(b,[p[0],y0,p[1]],[q[0],y0,q[1]],[q[0],y1,q[1]],[p[0],y1,p[1]],wc,dz*sg,0,-dx*sg);}
 if(rc)polyFlat(rb||b,pts,y1,rc);}
/* walls with window-texture coordinates into a TB */
function wallsUV(tb,pts,y0,y1,c,u0){const n=pts.length,sg=area2(pts)>0?1:-1,vT=(y1-y0)/12.4;let u=u0||0;
 for(let i=0;i<n;i++){const p=pts[i],q=pts[(i+1)%n],dx=q[0]-p[0],dz=q[1]-p[1],l=Math.hypot(dx,dz);if(l<.3)continue;const nx=dz/l*sg,nz=-dx/l*sg,u1=u+l/12.8;
  const A=[p[0],y0,p[1],u,0],B2=[q[0],y0,q[1],u1,0],C2=[q[0],y1,q[1],u1,vT],D=[p[0],y1,p[1],u,vT],o=sg>0?[A,C2,B2,A,D,C2]:[A,B2,C2,A,C2,D];   /* counter-clockwise seen from outside */
  for(const v of o)tb.v(v[0],v[1],v[2],nx,0,nz,c,v[3],v[4]);u=u1;}}
/* Sutherland-Hodgman clip of a ring against the half plane a*x + b*z <= c */
function clipHalf(pts,a,b,c){const o=[],n=pts.length;for(let i=0;i<n;i++){const p=pts[i],q=pts[(i+1)%n],dp=a*p[0]+b*p[1]-c,dq=a*q[0]+b*q[1]-c;if(dp<=0)o.push(p);if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);o.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}return o;}
function scaleRing(pts,k,c){c=c||centP(pts);return pts.map(p=>[c[0]+(p[0]-c[0])*k,c[1]+(p[1]-c[1])*k]);}

/* ---------- where am I relative to the track and the pit path ---------- */
const CELL=48,gkey=(cx,cz)=>cx*8192+cz;
function mkGrid(X,Z,n){const g=new Map();for(let i=0;i<n;i++){const k=gkey(Math.floor(X[i]/CELL),Math.floor(Z[i]/CELL));let l=g.get(k);if(!l){l=[];g.set(k,l);}l.push(i);}return g;}
function gNear(g,X,Z,x,z){const cx=Math.floor(x/CELL),cz=Math.floor(z/CELL);let bd=1e18,bi=-1;for(let a=-2;a<=2;a++)for(let c=-2;c<=2;c++){const l=g.get(gkey(cx+a,cz+c));if(!l)continue;for(let k=0;k<l.length;k++){const i=l[k],dx=x-X[i],dz=z-Z[i],d=dx*dx+dz*dz;if(d<bd){bd=d;bi=i;}}}return bi<0?-1:(gNear.d=Math.sqrt(bd),bi);}
const gT=mkGrid(TX,TZ,TN),gP=mkGrid(K.PX,K.PZ,PN+1);
let nI=-1,nD=1e9,nL=0,pI=-1,pD=1e9,pL=0;
/* nearest track sample: sets nI (index), nD (distance, 1e9 when farther than about 100 m), nL (lateral, + left) */
function nearT(x,z){nI=gNear(gT,TX,TZ,x,z);if(nI<0){nD=1e9;nL=0;return nD;}nD=gNear.d;nL=(x-TX[nI])*NX[nI]+(z-TZ[nI])*NZ[nI];return nD;}
/* nearest pit-path sample: pI, pD, pL */
function nearP(x,z){pI=gNear(gP,K.PX,K.PZ,x,z);if(pI<0){pD=1e9;pL=0;return pD;}pD=gNear.d;pL=(x-K.PX[pI])*K.PNX[pI]+(z-K.PZ[pI])*K.PNZ[pI];return pD;}
const tp=(i,lat)=>[TX[i]+NX[i]*lat,TZ[i]+NZ[i]*lat];
const pq=(q,lat)=>{K.pitPos(q,lat,o1);return [o1.x,o1.z];};
const pq3=(q,lat,dy)=>{K.pitPos(q,lat,o1);return [o1.x,o1.y+(dy||0),o1.z];};
const pHead=q=>PH[Math.max(0,Math.min(PN,Math.round(q/PDS)))];

/* ---------- pit exit trench: the dip of K.pitY, open cut with a covered part under Turn 1 ---------- */
const TR=(()=>{let q0=-1,q1=-1,c0=-1,dEnd=-1,qx=-1,bd=1e9;
 for(let q=0;q<=PLEN;q+=1){const y=K.pitY(q);if(y<-.03){if(q0<0)q0=q;q1=q;}if(y<=-5&&c0<0)c0=q;if(y<=-4.4)dEnd=q;}
 for(let q=q0;q<=q1;q+=1){const p=pq(q,0);nearT(p[0],p[1]);if(nD<bd){bd=nD;qx=q;}}
 let c1=dEnd;for(let q=qx;q<=dEnd;q+=1){const p=pq(q,0);nearT(p[0],p[1]);if(nL>=15.5){c1=q;break;}}
 return {q0:q0-1,q1:q1+1,c0,c1,qx,wall:.5,inL:()=>4.7,inR:q=>4.7+2.4*(1-sstep(q0+4,q0+40,q))};})();
function trenchRing(qa,qb){const L=[],R=[],n=Math.max(1,Math.ceil((qb-qa)/2));for(let k=0;k<=n;k++){const q=qa+(qb-qa)*k/n;L.push(pq(q,TR.inL(q)+TR.wall));R.push(pq(q,-(TR.inR(q)+TR.wall)));}return L.concat(R.reverse());}
const HOLES=[trenchRing(TR.q0,TR.c0),trenchRing(TR.c1,TR.q1)],HOLEB=HOLES.map(bboxP);
const inTrench=(x,z)=>{for(let k=0;k<2;k++)if(inBox(x,z,HOLEB[k])&&inPts(x,z,HOLES[k]))return true;return false;};

/* ---------- materials of the static scenery ----------
   Own set (p1's M is left alone because actors use it). Each lit material is patched: as night comes (uFloodMix -> 1) the direct light,
   which is then the floodlighting, is multiplied by the red channel of a flood map looked up by world x,z; the green channel adds warm
   street lighting. ENV drives the uniforms in FU. */
const FU={uFloodMap:{value:null},uFloodO:{value:new V2(0,0)},uFloodS:{value:new V2(1,1)},uFloodMix:{value:0},uWarm:{value:new THREE.Color(0,0,0)},
 uMoon:{value:new THREE.Color(0,0,0)},uMoonV:{value:new V3(0,1,0)},   /* faint moonlight on everything static (view-space direction), so the island reads at night */
 uShK:{value:1}};   /* how much shadow the static scenery receives: ENV fades it out and in around the moment the static casters are switched off */
/* the stock light loop, with the sun shadow on static scenery scaled by uShK (if three.js words the line differently nothing changes) */
const LFB=THREE.ShaderChunk.lights_fragment_begin.replace('vDirectionalShadowCoord[ i ] ) : 1.0;','vDirectionalShadowCoord[ i ] ) * uShK + ( 1.0 - uShK ) : 1.0;');
function patch(m){m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,FU);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 uFloodO,uFloodS;varying vec2 vFloodUv;')
   .replace('#include <project_vertex>','#include <project_vertex>\n{vec4 fw=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nfw=instanceMatrix*fw;\n#endif\nfw=modelMatrix*fw;vFloodUv=(fw.xz-uFloodO)*uFloodS;}');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uFloodMap;uniform float uFloodMix,uShK;uniform vec3 uWarm,uMoon,uMoonV;varying vec2 vFloodUv;').replace('#include <lights_fragment_begin>',LFB)
   .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n{vec4 fl=texture2D(uFloodMap,vFloodUv);float fk=mix(1.,fl.r,uFloodMix);reflectedLight.directDiffuse*=fk;reflectedLight.directSpecular*=fk;reflectedLight.directDiffuse+=(uWarm*fl.g+uMoon*max(dot(normal,uMoonV),0.))*diffuseColor.rgb;}');};
 m.envMapIntensity=.2;return m;}
const aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const asphaltTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d'),im=g.createImageData(256,256);for(let i=0;i<65536;i++){const v=208+Math.floor(rnd()*47)-(rnd()<.06?38:0);im.data[i*4]=v;im.data[i*4+1]=v;im.data[i*4+2]=v;im.data[i*4+3]=255;}g.putImageData(im,0,0);
 const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=aniso;return t;})();
const fenceTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');g.clearRect(0,0,128,128);g.strokeStyle='rgba(214,218,221,.9)';g.lineWidth=1.25;for(let k=-128;k<256;k+=10.667){g.beginPath();g.moveTo(k,0);g.lineTo(k+128,128);g.stroke();g.beginPath();g.moveTo(k+128,0);g.lineTo(k,128);g.stroke();}
 g.strokeStyle='rgba(200,204,208,1)';g.lineWidth=3;g.strokeRect(0,0,128,128);const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=aniso;return t;})();
/* window pattern: [day colour map, lit-window map for the night] */
const wallTex=(()=>{const on=[];for(let i=0;i<16;i++)on.push(rnd()<.46);const mk=lit=>{const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');g.fillStyle=lit?'#000':'#f6f3ec';g.fillRect(0,0,256,256);
  for(let r=0;r<4;r++){if(!lit){g.fillStyle='rgba(60,50,40,.12)';g.fillRect(0,r*64+57,256,3);}
   for(let c=0;c<4;c++){const x=c*64+10,y=r*64+12,o=on[r*4+c];if(lit){g.fillStyle=o?((r+c)%3?'#ffd9a0':'#dfe9ff'):'#0d0c0b';g.fillRect(x,y,44,38);continue;}
    const gr=g.createLinearGradient(0,y,0,y+38);gr.addColorStop(0,'#5f7686');gr.addColorStop(1,'#8fa3ae');g.fillStyle=gr;g.fillRect(x,y,44,38);g.fillStyle='rgba(255,255,255,.5)';g.fillRect(x+21,y,2,38);}}
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=aniso;return t;};return [mk(false),mk(true)];})();
const gmat=(off,o)=>patch(std(Object.assign({vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:off,polygonOffsetUnits:off},o||{})));
const MAT={land:gmat(10),golf:gmat(9),grass:gmat(8),sand:gmat(7),flat:gmat(6,{roughness:.7}),road:gmat(5,{roughness:.95}),
 apron:gmat(4,{map:asphaltTex,roughness:.93}),pit:gmat(3,{map:asphaltTex,roughness:.93}),paint:gmat(2,{roughness:.86}),track:gmat(1,{map:asphaltTex,roughness:.93}),mark:gmat(-2,{roughness:.8}),
 clay:patch(std({vertexColors:true,flatShading:true})),smooth:patch(std({vertexColors:true,roughness:.72})),roof:patch(std({vertexColors:true,roughness:.9})),
 glass:patch(std({color:C(0x86aabb),roughness:.2,metalness:.25,emissive:C(0xffd9a0),emissiveIntensity:0})),
 lamp:std({color:C(0xfff3d6),emissive:C(0xfff0d2),emissiveIntensity:.15}),
 inter:new THREE.MeshBasicMaterial({vertexColors:true}),
 bw:patch(new THREE.MeshStandardMaterial({map:wallTex[0],emissiveMap:wallTex[1],emissive:new THREE.Color(1,1,1),emissiveIntensity:0,vertexColors:true,roughness:.88})),
 fence:patch(new THREE.MeshStandardMaterial({map:fenceTex,transparent:true,alphaTest:.04,depthWrite:false,side:THREE.DoubleSide,roughness:.6,metalness:.4})),
 fan:patch(std({vertexColors:true,roughness:1})),foliage:patch(std({vertexColors:true,flatShading:true,roughness:1})),boat:patch(std({vertexColors:true,roughness:.4,metalness:.1}))};
MAT.glass.envMapIntensity=.9;MAT.boat.envMapIntensity=.5;MAT.bw.envMapIntensity=.25;
/* batches: B structures, BS smooth structures, GL glass, LP lamp heads, MK paint on tarmac, IN self-lit interiors, RF roofs
   (CAN was the grandstand roofs; they are see-through structures with their own batches now, see SEE below, and CAN stays empty) */
const B=new Batch(),BS=new Batch(),GL=new Batch(),LP=new Batch(),MK=new Batch(),IN=new Batch(),RF=new Batch(),CAN=new Batch(),AP=new Batch(),PL=new Batch(),PT=new Batch(),RD=new Batch();
const BW=new TB(),FN=new TB(),SG=new TB();
const glowS=[],glowB=[],glowW=[],CASTERS=[],STAT={};
const glow=(x,y,z,c,k)=>{(k===2?glowB:k===1?glowW:glowS).push(x,y,z,c.r,c.g,c.b);};
const cWht=C(0xfff6e2),cWarm=C(0xffc98a),cCool=C(0xdfeaff),cRed=C(0xff3b2a),cGrn=C(0x39e07a),cDim=C(0xffc98a).multiplyScalar(.45);
/* batch -> mesh in `world`; uvS adds planar texture coordinates (world x,z / uvS) so overlapping tarmac pieces match exactly */
function flush(b,mat,cast,recv,uvS){if(!b.P.length)return null;const g=b.geom();if(uvS){const p=b.P,u=new Float32Array(p.length/3*2);for(let i=0,j=0;i<p.length;i+=3,j+=2){u[j]=p[i]/uvS;u[j+1]=p[i+2]/uvS;}g.setAttribute('uv',new THREE.BufferAttribute(u,2));}
 const m=new THREE.Mesh(g,mat);m.castShadow=!!cast;m.receiveShadow=recv!==false;world.add(m);if(cast)CASTERS.push(m);return m;}

/* ---------- see-through structures ----------
   Whatever can stand between a camera and a car (start gantry, bridges over the track, hotel bridge and canopy, grandstand roofs) is
   built as its own mesh with its own material instead of going into the shared batches, so that the camera part can fade it alone.
   WORLD.seeThrough lists them: {name, meshes, box:[x0,y0,z0,x1,y1,z1], vols, hit, set(opacity), opacity}.
   vols: convex volumes, each a flat list of planes nx,ny,nz,d (a point is inside where n.p <= d for every plane). hit(ax,ay,az,bx,by,bz),
   when present, is the structure's own test of a segment and is used instead of vols. The camera part tests the segment from the
   camera to the car against box first, then against vols or hit, and calls set(). Nothing here moves: same geometry, split meshes. */
const SEE=[];
/* the material of one such structure: MAT.clay again (same night patch), but its own, so that its opacity is its own */
const seeMat=o=>patch(std(Object.assign({vertexColors:true,flatShading:true},o||{})));
/* convex hull of points [x, z] */
function hull2(p){const s=p.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
 for(const q of s){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
 for(let i=s.length-1;i>=0;i--){const q=s[i];while(up.length>1&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
 lo.pop();up.pop();return lo.concat(up);}
/* prism over the convex hull of a footprint, from y0 to y1, widened sideways by `grow` metres; `extra` = more planes (nx,ny,nz,d, ...) */
function volPrism(pts,y0,y1,grow,extra){const h=hull2(pts),n=h.length,sg=area2(h)>0?1:-1,pl=[];
 for(let i=0;i<n;i++){const a=h[i],b=h[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<1e-6)continue;const nx=dz/l*sg,nz=-dx/l*sg;pl.push(nx,0,nz,nx*a[0]+nz*a[1]+(grow||0));}
 pl.push(0,1,0,y1,0,-1,0,-y0);if(extra)for(const v of extra)pl.push(v);return new Float32Array(pl);}
/* rectangle footprint: centre, heading of its long axis, half length, half width */
const rectPts=(x,z,h,hl,hw)=>{const tx=Math.sin(h),tz=Math.cos(h),nx=tz,nz=-tx;return [[x+tx*hl+nx*hw,z+tz*hl+nz*hw],[x+tx*hl-nx*hw,z+tz*hl-nz*hw],[x-tx*hl-nx*hw,z-tz*hl-nz*hw],[x-tx*hl+nx*hw,z-tz*hl+nz*hw]];};
function seeAdd(name,meshes,vols,hit){const ms=meshes.filter(Boolean),mats=[],box=[1e9,1e9,1e9,-1e9,-1e9,-1e9];if(!ms.length)return null;
 for(let k=2,n0=name;SEE.some(q=>q.name===name);k++)name=n0+' '+k;
 for(const m of ms){m.name=name;if(mats.indexOf(m.material)<0)mats.push(m.material);m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;
  box[0]=Math.min(box[0],b.min.x);box[1]=Math.min(box[1],b.min.y);box[2]=Math.min(box[2],b.min.z);box[3]=Math.max(box[3],b.max.x);box[4]=Math.max(box[4],b.max.y);box[5]=Math.max(box[5],b.max.z);}
 for(let k=0;k<3;k++){box[k]-=1;box[k+3]+=1;}
 /* opaque at 1 (drawn exactly as before); below that it blends, and stops writing depth once it is mostly gone so that it hides nothing */
 const e={name,meshes:ms,box,vols:vols||[],hit:hit||null,opacity:1,
  set(o){o=o<0?0:o>1?1:o;e.opacity=o;const tr=o<.999;for(const m of mats){if(m.uniforms){if(m.uniforms.uSee)m.uniforms.uSee.value=o;continue;}m.opacity=o;m.transparent=tr;m.depthWrite=o>.6;}}};
 SEE.push(e);return e;}

/* ---------- land from the coastline (OSM rule: land on the left of each way) ---------- */
const LAND=(()=>{const ways=CITY.coast.map(flatPts).filter(w=>w.length>2),used=ways.map(()=>false),chains=[],eq=(a,b)=>Math.abs(a[0]-b[0])<1&&Math.abs(a[1]-b[1])<1;
 ways.forEach((w,i)=>{if(used[i])return;used[i]=true;let ch=w.slice(),grew=true;while(grew){grew=false;ways.forEach((v,j)=>{if(used[j])return;if(eq(v[0],ch[ch.length-1])){ch=ch.concat(v.slice(1));used[j]=true;grew=true;}else if(eq(v[v.length-1],ch[0])){ch=v.slice(0,-1).concat(ch);used[j]=true;grew=true;}});}chains.push(ch);});
 chains.sort((a,b)=>b.length-a.length);const dd=ch=>ch.filter((p,i)=>i===0||Math.hypot(p[0]-ch[i-1][0],p[1]-ch[i-1][1])>.3);
 const isl=dd(chains[0]),rings=[isl],open=[isl];
 if(chains[1]){const m=dd(chains[1]),s=m[0],e=m[m.length-1];open.push(m);rings.push(m.concat([[e[0],3600],[4800,3600],[4800,-5900],[s[0],-5900]]));}
 return {rings,open,bb:rings.map(bboxP)};})();
const isLand=(x,z)=>{for(let k=0;k<LAND.rings.length;k++)if(inBox(x,z,LAND.bb[k])&&inPts(x,z,LAND.rings[k]))return true;return false;};
if(area2(LAND.rings[0])>0)console.warn('stage: coastline orientation unexpected');
{const LB=new Batch();polyFlat(LB,LAND.rings[0],Y.land,Q.sand,HOLES);if(LAND.rings[1])polyFlat(LB,LAND.rings[1],Y.land,Q.sandD);flush(LB,MAT.land,false,true);
 /* shore: quay wall around the marina side, a sloping beach elsewhere; nothing goes below the water line */
 const quay=(x,z)=>x>-260&&x<620&&z>20&&z<1300;
 LAND.open.forEach(ch=>{const n=ch.length,off=[];for(let i=0;i<n;i++){const a=ch[Math.max(0,i-1)],c=ch[Math.min(n-1,i+1)],dx=c[0]-a[0],dz=c[1]-a[1],l=Math.hypot(dx,dz)||1;off.push([ch[i][0]-dz/l*9,ch[i][1]+dx/l*9]);}
  for(let i=0;i<n-1;i++){const a=ch[i],c=ch[i+1],dx=c[0]-a[0],dz=c[1]-a[1];if(quay((a[0]+c[0])/2,(a[1]+c[1])/2))bq(B,[a[0],Y.land,a[1]],[c[0],Y.land,c[1]],[c[0],Y.sea,c[1]],[a[0],Y.sea,a[1]],Q.conc,-dz,0,dx);
   else quad(B,[a[0],Y.land,a[1]],[c[0],Y.land,c[1]],[off[i+1][0],Y.sea,off[i+1][1]],[off[i][0],Y.sea,off[i][1]],Q.beach);}});}

/* ---------- sea: one big plane, drawn first without depth write so that land and everything else simply covers it ---------- */
const waterU=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uT:{value:0},uSun:{value:new V3(0,1,0)},uSunC:{value:new THREE.Color(1,1,1)},uSky:{value:new THREE.Color(.6,.75,.9)},uAmb:{value:new THREE.Color(.8,.9,1)},uDeep:{value:C(0x0e3550)},uShal:{value:C(0x2a8098)},uRough:{value:1}}]);
waterU.uFloodMap=FU.uFloodMap;waterU.uFloodO=FU.uFloodO;waterU.uFloodS=FU.uFloodS;waterU.uWarm=FU.uWarm;
const waterMat=new THREE.ShaderMaterial({uniforms:waterU,fog:true,depthWrite:false,
 vertexShader:`varying vec3 vW;
#include <fog_pars_vertex>
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`,
 fragmentShader:`uniform float uT,uRough;uniform vec3 uSun,uSunC,uSky,uAmb,uDeep,uShal,uWarm;uniform sampler2D uFloodMap;uniform vec2 uFloodO,uFloodS;varying vec3 vW;
#include <fog_pars_fragment>
vec2 wv(vec2 p,vec2 d,float L,float sp,float A){float k=6.2831853/L,f=k*(dot(d,p)-sp*uT);return d*(A*k*cos(f));}
void main(){vec2 p=vW.xz;float dc=length(cameraPosition-vW);
 /* short waves fade out with distance so the far sea stays calm instead of shimmering */
 vec2 q=p+vec2(sin(p.y*.043+uT*.21)+sin(p.y*.017-uT*.13),sin(p.x*.039-uT*.17)+sin(p.x*.021+uT*.11))*2.8;   /* bent wave fronts: no woven look */
 vec2 g=wv(q,vec2(.8,.6),23.,2.2,.04)*smoothstep(2600.,700.,dc)+wv(q,vec2(-.31,.95),17.,1.9,.032)*smoothstep(2000.,600.,dc)+wv(q,vec2(-.5,.86),11.,1.6,.03)*smoothstep(1300.,400.,dc)+wv(q,vec2(.93,-.37),7.1,1.4,.028)*smoothstep(900.,280.,dc)+wv(q,vec2(.2,-.98),5.3,1.2,.03)*smoothstep(700.,200.,dc)+wv(q,vec2(-.9,-.3),2.6,.9,.024)*smoothstep(380.,110.,dc)+wv(q,vec2(.6,-.7),1.3,.7,.014)*smoothstep(190.,60.,dc);
 g*=uRough;vec3 n=normalize(vec3(-g.x,1.,-g.y));vec3 V=normalize(cameraPosition-vW);
 /* the mirror part uses a much calmer normal than the sparkle, so the harbour does not look like woven cloth */
 vec3 nf=normalize(vec3(-g.x*.3,1.,-g.y*.3));float fr=pow(1.-max(dot(nf,V),0.),4.);
 float big=sin(dot(p,vec2(.011,.019))+uT*.05)*sin(dot(p,vec2(-.016,.008))-uT*.04);
 vec3 base=mix(uDeep,uShal,clamp(.45+.28*g.x+.035*big,0.,1.));vec3 col=mix(base*(uAmb+uSunC*.5*max(dot(nf,uSun),0.)),uSky,clamp(fr*.8+.04,0.,1.));
 float sp=pow(max(dot(reflect(-uSun,n),V),0.),220.);col+=uSunC*sp*1.8;
 vec4 fl=texture2D(uFloodMap,(p+n.xz*22.-uFloodO)*uFloodS);col+=uWarm*(fl.g*.55+fl.r*.1)*(.25+.75*fr);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
 #include <fog_fragment>
}`});
const water=new THREE.Mesh(new THREE.PlaneGeometry(26000,26000),waterMat);water.rotation.x=-PI/2;water.position.set(0,Y.sea,0);water.renderOrder=-5;water.frustumCulled=false;world.add(water);

/* ---------- area fills from the map: golf course, grass, sand, car parks, ponds and pools ---------- */
{const GF=new Batch(),GR=new Batch(),SD=new Batch(),FL=new Batch();
 for(const g of CITY.green){const p=ringPts(g.r);if(p.length<3)continue;if(g.k==='golf')polyFlat(GF,p,Y.golf,Q.golf);else polyFlat(GR,p,Y.grass,g.k==='pitch'?Q.pitch:Q.grass);}
 for(const s of CITY.sand){const p=ringPts(s.r);if(p.length>2)polyFlat(SD,p,Y.sandp,Q.bunker);}
 for(const s of CITY.parking){const p=ringPts(s.r);if(p.length>2)polyFlat(FL,p,Y.flat,Q.park);}
 for(const s of CITY.pools){const p=ringPts(s.r);if(p.length>2)polyFlat(FL,p,Y.flat,P.pool);}
 for(const s of CITY.water){if(s.k==='marina')continue;const p=ringPts(s.r);if(p.length>2)polyFlat(FL,p,Y.flat,Q.pond);}
 flush(GF,MAT.golf,false,true);flush(GR,MAT.grass,false,true);flush(SD,MAT.sand,false,true);flush(FL,MAT.flat,false,true);}

/* ---------- public roads (ribbons); other circuit tarmac from the track pack goes to the apron layer ---------- */
const ROADLAMP=[],ROADLAMP0=[],ROADPALM=[];
function ribbonPL(b,pl,w,y,c,skip){const pts=[];for(let i=0;i+1<pl.length;i++){const a=pl[i],q=pl[i+1],n=Math.max(1,Math.ceil(Math.hypot(q[0]-a[0],q[1]-a[1])/10));for(let k=0;k<n;k++)pts.push([a[0]+(q[0]-a[0])*k/n,a[1]+(q[1]-a[1])*k/n]);if(i+2>=pl.length)pts.push(q);}
 let prev=null;for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],q=pts[Math.min(pts.length-1,i+1)],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz)||1,x=pts[i][0],z=pts[i][1];
  if(skip&&skip(x,z)){prev=null;continue;}const cur=[[x+dz/l*w,y,z-dx/l*w],[x-dz/l*w,y,z+dx/l*w]];if(prev)quad(b,prev[0],prev[1],cur[1],cur[0],c);prev=cur;}
 return pts;}
{const hwid=[2.6,3.6,5.4];let acc=0,acp=0;
 for(const rd of CITY.roads){const pts=ribbonPL(RD,flatPts(rd[2]),hwid[rd[0]]||3,Y.road,Q.road,inTrench);
  if(rd[0]>=2)for(let i=1;i<pts.length;i++){acp+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);if(acp>23){acp=0;const a=pts[i-1],q=pts[i],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz)||1,w=hwid[2]+3.4;ROADPALM.push([q[0]-dz/l*w,q[1]+dx/l*w],[q[0]+dz/l*w,q[1]-dx/l*w]);}}
  if(rd[0]>=1)for(let i=1;i<pts.length;i++){acc+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);if(acc>52){acc=0;const a=pts[i-1],q=pts[i],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz)||1,w=(hwid[rd[0]]||3)+1.5;ROADLAMP.push([q[0]+dz/l*w,q[1]-dx/l*w]);}}
  /* minor roads: a light every 80 m (glow only), so the road network shows at night */
  else{let a0=40;for(let i=1;i<pts.length;i++){a0+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);if(a0>80){a0=0;const a=pts[i-1],q=pts[i],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz)||1;ROADLAMP0.push([q[0]+dz/l*4,q[1]-dx/l*4]);}}}}
 for(const a of TRACK.alt)ribbonPL(AP,a.p,a.len>600?6.5:5,Y.apron,Q.apron,inTrench);}

/* ================= TRACK CORRIDOR: what lies beside the tarmac at every track sample =================
   WL / WR = paved width beyond the track edge on the left / right, up to the barrier. Base table below (from K.CORNERS, so it follows
   the kernel), widened by K.latExtent when the kernel provides it, narrowed by grandstands and water, and tied to the pit lane
   where the pit path runs alongside. */
const cs=n=>K.CORNERS[n-1];
const WL=new Float32Array(TN).fill(4.5),WR=new Float32Array(TN).fill(4.5),wallL=new Uint8Array(TN).fill(1),wallR=new Uint8Array(TN).fill(1),plainL=new Uint8Array(TN),plainR=new Uint8Array(TN),npL=new Uint8Array(TN),npR=new Uint8Array(TN);
/* pit path as seen from each track sample, per side: lateral and pit distance (NaN = not alongside) */
const PLL=new Float32Array(TN).fill(NaN),PLR=new Float32Array(TN).fill(NaN),PQL=new Float32Array(TN).fill(NaN),PQR=new Float32Array(TN).fill(NaN);
for(let i=0;i<TN;i++){const tx=Math.sin(TH[i]),tz=Math.cos(TH[i]),x=TX[i],z=TZ[i];
 for(let j=0;j<PN;j++){const dx0=K.PX[j]-x,dz0=K.PZ[j]-z;if(dx0>70||dx0<-70||dz0>70||dz0<-70)continue;const dx1=K.PX[j+1]-x,dz1=K.PZ[j+1]-z,a0=dx0*tx+dz0*tz,a1=dx1*tx+dz1*tz;if(a0*a1>0)continue;
  const t=a0===a1?0:a0/(a0-a1),lat=lerp(dx0*NX[i]+dz0*NZ[i],dx1*NX[i]+dz1*NZ[i],t),q=(j+t)*PDS;if(Math.abs(lat)>45)continue;
  if(lat<-.5){if(isNaN(PLR[i])||-lat<-PLR[i]){PLR[i]=lat;PQR[i]=q;}}else if(lat>.5){if(isNaN(PLL[i])||lat<PLL[i]){PLL[i]=lat;PQL[i]=q;}}}}
function bump(W,a,b,c,d,w){for(let n=Math.floor(a/DS);n<=Math.ceil(d/DS);n++){const s=n*DS,k=s<b?sstep(a,b,s):s>c?1-sstep(c,d,s):1,i=wi(n);if(w*k>W[i])W[i]=w*k;}}
function setZone(W,a,b,c,d,w){for(let n=Math.floor(a/DS);n<=Math.ceil(d/DS);n++){const s=n*DS,k=s<b?sstep(a,b,s):s>c?1-sstep(c,d,s):1,i=wi(n);W[i]=lerp(W[i],w,k);}}
function mark(F,a,b,v){for(let n=Math.floor(a/DS);n<=Math.ceil(b/DS);n++)F[wi(n)]=v;}
{const c1=cs(1),c2=cs(2),c5=cs(5),c6=cs(6),c7=cs(7),c8=cs(8),c9=cs(9),c11=cs(11),c12=cs(12),c13=cs(13),c14=cs(14),c15=cs(15),c16=cs(16);
 bump(WR,c2.sIn-50,c2.sIn,c2.sOut,c2.sOut+50,10);
 bump(WR,c5.sIn-60,c5.sIn+10,c5.sOut+10,c5.sOut+70,24);
 bump(WR,c6.sIn-70,c6.sIn-10,c6.s,c6.s+12,22);bump(WR,c6.s-4,c6.s+12,c7.s+6,c7.sOut+62,30);mark(plainR,c6.sIn-80,c7.sOut+80,1);
 bump(WL,c7.sIn-15,c7.s-5,c7.sOut,c7.sOut+40,12);
 bump(WR,c8.sIn-20,c8.sIn,c8.sOut,c8.sOut+30,7);
 bump(WR,c9.sIn-60,c9.sIn,c9.sOut+10,c9.sOut+90,18);
 bump(WL,c11.sIn-30,c11.sIn,c11.sOut,c11.sOut+40,9);
 bump(WL,c12.sIn-40,c12.sIn,c12.sOut,c12.sOut+40,14);
 bump(WR,c13.sIn-20,c13.sIn,c13.s+8,c13.sOut,9);
 bump(WL,c15.sIn-30,c15.sIn+10,c15.sOut+10,c15.sOut+50,10);
 bump(WL,c16.sIn-10,c16.sIn+20,c16.sOut+10,c16.sOut+50,11);
 setZone(WL,c16.sOut+60,c16.sOut+90,K.TLEN+c1.sIn-60,K.TLEN+c1.sIn-20,3.5);
 /* widen to what the cars really use, when the kernel says so. K.latExtent = {L, R, min, max, body}: Float32Array per track sample,
    L and R positive metres from the centre line, min and max signed (+ = left); with `body` the values are the car body (centre + 1 m) */
 const ext=(()=>{const e=K.latExtent;if(!e)return null;const L=new Float32Array(TN),R=new Float32Array(TN),bodyIn=typeof e.body==='number';try{
   if(typeof e==='function'){for(let i=0;i<TN;i++){const v=e(i*DS),mn=Array.isArray(v)?v[0]:v.min,mx=Array.isArray(v)?v[1]:v.max;L[i]=Math.max(0,mx||0);R[i]=Math.max(0,-(mn||0));}}
   else if(e.min&&e.max&&e.min.length>=TN){for(let i=0;i<TN;i++){L[i]=Math.max(0,e.max[i]||0);R[i]=Math.max(0,-(e.min[i]||0));}}
   else if(e.L&&e.R&&e.L.length>=TN){for(let i=0;i<TN;i++){L[i]=Math.max(0,e.L[i]||0);R[i]=Math.max(0,e.R[i]||0);}}
   else return null;
  }catch(err){return null;}return {L,R,touch:bodyIn?.08:1.05,gap:bodyIn?.7:1.7};})();
 STAT.latExtent=!!ext;
 if(ext)for(const [W,E] of [[WL,ext.L],[WR,ext.R]]){const d=new Float32Array(TN);for(let i=0;i<TN;i++){let m=0;for(let k=-5;k<=5;k++)m=Math.max(m,E[wi(i+k)]);d[i]=m>HW-.5?m-HW+ext.gap:0;}for(let i=0;i<TN;i++)if(d[i]>W[i])W[i]=d[i];}
 /* Turn 14 exit: the outside barrier is close and a car stops against it: the wall face sits at the outermost body edge */
 {const need=ext?Math.max(3.3,...Array.from({length:70},(_,k)=>ext.R[sIdx(c14.sOut-30+k*2)]-HW+ext.touch)):3.35;STAT.t14=+need.toFixed(2);setZone(WR,c13.sOut-6,c13.sOut+14,c14.sOut+100,c14.sOut+140,Math.min(need,6.5));}
}
/* obstacles along the normal: grandstands and the marina quay limit the run-off */
{const seg=[];CITY.grandstands.forEach(g=>{const p=ringPts(g.r);for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];seg.push(a[0],a[1],b[0],b[1],3.5);}});
 const ch=LAND.open[0];for(let i=0;i+1<ch.length;i++){const a=ch[i],b=ch[i+1];if(a[0]>-320&&a[0]<700&&a[1]>-150&&a[1]<1350)seg.push(a[0],a[1],b[0],b[1],5.5);}
 for(let i=0;i<TN;i++)for(const sd of [1,-1]){const ox=TX[i],oz=TZ[i],dx=NX[i]*sd,dz=NZ[i]*sd;let best=1e9;
  for(let k=0;k<seg.length;k+=5){const ax=seg[k]-ox,az=seg[k+1]-oz,ex=seg[k+2]-seg[k],ez=seg[k+3]-seg[k+1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-9)continue;const t=(ax*ez-az*ex)/den,u=(ax*dz-az*dx)/den;if(t>HW&&t<75&&u>=0&&u<=1){const lim=t-HW-seg[k+4];if(lim<best)best=lim;}}
  if(best<1e8){const W=sd>0?WL:WR;if(W[i]>best)W[i]=Math.max(1.2,best);}}}
/* inside of tight corners: the paved strip cannot be wider than the radius allows */
for(let i=0;i<TN;i++){let k=0;for(let d=-3;d<=3;d++){const v=TK[wi(i+d)];if(Math.abs(v)>Math.abs(k))k=v;}if(Math.abs(k)<.012)continue;const lim=Math.max(1.5,1/Math.abs(k)-HW-3);if(k>0){if(!plainL[i]&&WL[i]>lim)WL[i]=lim;}else if(!plainR[i]&&WR[i]>lim)WR[i]=lim;}
/* pit lane alongside: verge up to the pit wall or trench parapet; no track barrier where the pit complex builds its own */
const QW0=PIT.wallQ0,QW1=PIT.wallQ1;
for(let i=0;i<TN;i++){const s=i*DS;
 if(!isNaN(PLR[i])&&(s>K.S_IN-6||s<400)){const q=PQR[i],l=-PLR[i];npR[i]=q<=TR.c0+2?1:0;
  if(q<QW0){WR[i]=Math.max(lerp(WR[i],4.5,sstep(0,30,q)),l+5.3-HW);}   /* the track barrier follows the outside of the pit entry road */
  else if(q<=TR.c0+2){WR[i]=Math.max(.8,l-(q<TR.q0?5.55:TR.inL(q)+TR.wall+.5)-HW);wallR[i]=0;}}
 if(!isNaN(PLL[i])&&s>250&&s<K.S_OUT+60){const q=PQL[i],l=PLL[i];npL[i]=1;
  if(q>=TR.c1-8&&q<=TR.q1+2){WL[i]=Math.max(.8,Math.min(WL[i],l-(TR.inR(q)+TR.wall+.5)-HW));wallL[i]=0;}
  else if(q>TR.q1)WL[i]=Math.max(4.5,l+5.3-HW);}}
{const c1=cs(1);bump(WR,c1.s+2,c1.s+6,c1.sOut-4,c1.sOut+36,9.5);}
STAT.wMax=[Math.max(...WL).toFixed(1),Math.max(...WR).toFixed(1)];

/* ================= TRACK SURFACE ================= */
{const TS=new Batch(),NSTR=6,t=Q.tarmac,P_=TS.P,N_=TS.N,C_=TS.C;
 const put=(i,lat)=>{const d=lat-K.TRL[i],e=Math.exp(-d*d/2.4),br=K.TV[wi(i+8)]<K.TV[i]-1.5?.1:0,k=1-.2*e-br*e;P_.push(TX[i]+NX[i]*lat,Y.track,TZ[i]+NZ[i]*lat);N_.push(0,1,0);C_.push(t.r*k,t.g*k,t.b*k);};
 for(let i=0;i<TN;i++){const j=wi(i+1);for(let k=0;k<NSTR;k++){const l0=HW-k*2*HW/NSTR,l1=HW-(k+1)*2*HW/NSTR;put(i,l0);put(i,l1);put(j,l0);put(i,l1);put(j,l1);put(j,l0);}}
 flush(TS,MAT.track,false,true,7);}
/* strip between two lateral offsets over one sample step, into a flat batch */
function strip(b,i,a0,b0,a1,b1,y,c){const j=wi(i+1);if(Math.abs(a0-b0)<.01&&Math.abs(a1-b1)<.01)return;const p0=tp(i,a0),p1=tp(i,b0),p2=tp(j,b1),p3=tp(j,a1);quad(b,[p0[0],y,p0[1]],[p1[0],y,p1[1]],[p2[0],y,p2[1]],[p3[0],y,p3[1]],c);}
/* verges (plain tarmac, apron layer) and painted run-offs (pale blue with white bands) */
{const BND=[1.5,3,5.5,7,9.5,10.5],BCOL=[Q.white,Q.blue,Q.blueD,Q.blue,Q.white,Q.blue];
 for(const sd of [1,-1]){const W=sd>0?WL:WR,plain=sd>0?plainL:plainR,np=sd>0?npL:npR,lim=new Float32Array(TN);
  /* no bands near a tight inside on this side: folded strips must all have one colour */
  for(let i=0;i<TN;i++){let m=1e9;for(let d=-25;d<=25;d+=5){const k=TK[wi(i+d)];if(k*sd>.02)m=Math.min(m,1/Math.abs(k)-HW-1);}lim[i]=plain[i]?0:m;}
  for(let i=0;i<TN;i++){const j=wi(i+1),w0=W[i],w1=W[j];strip(AP,i,sd*(HW-.6),sd*(HW+w0+.7),sd*(HW-.6),sd*(HW+w1+.7),Y.apron,Q.apron);
   if((w0<6.5&&w1<6.5)||np[i]||np[j])continue;const bands=lim[i]>=12&&lim[j]>=12;
   if(!bands){strip(PT,i,sd*(HW+Math.min(1.5,w0)),sd*(HW+w0),sd*(HW+Math.min(1.5,w1)),sd*(HW+w1),Y.paint,Q.blue);continue;}
   for(let k=0;k<BND.length;k++){const a=BND[k],e=k+1<BND.length?BND[k+1]:1e9;strip(PT,i,sd*(HW+Math.min(a,w0)),sd*(HW+Math.min(e,w0)),sd*(HW+Math.min(a,w1)),sd*(HW+Math.min(e,w1)),Y.paint,BCOL[k]);}}}}
/* edge lines and kerbs (paint layer on top of the tarmac) */
const mergeR=i=>{const s=i*DS;return s>K.S_IN-8&&s<K.S_IN+96;},mergeL=i=>{const s=i*DS;return s>K.S_OUT-118&&s<K.S_OUT+12;};
{const kIn=i=>Math.abs(TK[i])>.011,kOut=i=>Math.abs(TKW[i])>.0075&&Math.abs(TK[i])<.03,kf=[new Uint8Array(TN),new Uint8Array(TN)];
 for(let i=0;i<TN;i++){if(TK[i]>0?kIn(i):kOut(i))for(let d=-2;d<=2;d++)kf[0][wi(i+d)]=1;if(TK[i]<0?kIn(i):kOut(i))for(let d=-2;d<=2;d++)kf[1][wi(i+d)]=1;}
 for(let i=0;i<TN;i++){const mR=mergeR(i),mL=mergeL(i);
  if(!mL||(i&3)<2)strip(MK,i,HW-.15,HW-.33,HW-.15,HW-.33,Y.mark,Q.white);
  if(!mR||(i&3)<2)strip(MK,i,-HW+.33,-HW+.15,-HW+.33,-HW+.15,Y.mark,Q.white);
  if(kf[0][i]&&!mL)strip(MK,i,HW+1.5,HW-.05,HW+1.5,HW-.05,Y.mark,i&1?Q.kerbR:Q.white);
  if(kf[1][i]&&!mR)strip(MK,i,-HW+.05,-HW-1.5,-HW+.05,-HW-1.5,Y.mark,i&1?Q.white:Q.kerbR);}}
/* painted rectangle on the tarmac: centre s, lateral lat, size across x along */
function mkRect(s,lat,across,along,c,y){K.trackPos(s,lat,o1);const h=o1.h,tx=Math.sin(h),tz=Math.cos(h),nx=tz,nz=-tx,x=o1.x,z=o1.z,a=across/2,l=along/2,yy=y||Y.mark;
 quad(MK,[x+nx*a-tx*l,yy,z+nz*a-tz*l],[x-nx*a-tx*l,yy,z-nz*a-tz*l],[x-nx*a+tx*l,yy,z-nz*a+tz*l],[x+nx*a+tx*l,yy,z+nz*a+tz*l],c);}
/* finish line and the twenty grid slots (slot k is 8 + 8 (k - 1) m behind the line; odd on the left) */
mkRect(0,0,2*HW-.7,.7,Q.white,Y.mark+.004);
for(let k=1;k<=20;k++){const s=-(8+8*(k-1)),lat=k&1?2.7:-2.7;mkRect(s+3.1,lat,2.7,.24,Q.white);mkRect(s+2.0,lat+1.35,.2,2.4,Q.white);mkRect(s+2.0,lat-1.35,.2,2.4,Q.white);}

/* ================= BARRIERS AND CATCH FENCE ================= */
/* wall along a line of points [x, z, outX, outZ] (track-side face, outward unit normal); null breaks the line */
function wallLine(pts,h,th,col,fenceTop,col2){let pv=null,u=0,n=0;for(const p of pts){if(!p){pv=null;continue;}if(pv){const a=pv,b=p,c=(n++&1)&&col2?col2:col,y0=-.12;
   const ao=[a[0]+a[2]*th,a[1]+a[3]*th],bo=[b[0]+b[2]*th,b[1]+b[3]*th];
   bq(B,[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],h,b[1]],[a[0],h,a[1]],c,-a[2],0,-a[3]);bq(B,[ao[0],y0,ao[1]],[bo[0],y0,bo[1]],[bo[0],h,bo[1]],[ao[0],h,ao[1]],c,a[2],0,a[3]);
   quad(B,[a[0],h,a[1]],[b[0],h,b[1]],[bo[0],h,bo[1]],[ao[0],h,ao[1]],c);
   if(fenceTop){const ax=a[0]+a[2]*th*.5,az=a[1]+a[3]*th*.5,bx=b[0]+b[2]*th*.5,bz=b[1]+b[3]*th*.5,l=Math.hypot(bx-ax,bz-az),u1=u+l/1.7,v1=(fenceTop-h)/1.7,w=Q.white,nx=-a[2],nz=-a[3];
    FN.v(ax,h,az,nx,0,nz,w,u,0);FN.v(bx,h,bz,nx,0,nz,w,u1,0);FN.v(bx,fenceTop,bz,nx,0,nz,w,u1,v1);FN.v(ax,h,az,nx,0,nz,w,u,0);FN.v(bx,fenceTop,bz,nx,0,nz,w,u1,v1);FN.v(ax,fenceTop,az,nx,0,nz,w,u,v1);u=u1%1;}}
  pv=p;}}
const BARR=[[],[]];   /* barrier lines kept for later (masts, boards, crowd fences) */
for(const sd of [1,-1]){const W=sd>0?WL:WR,wf=sd>0?wallL:wallR,pts=[];let lastOk=null,gapByFold=false;
 for(let n=0;n<=TN;n+=2){const i=wi(n),lat=sd*(HW+W[i]),p=tp(i,lat);let ok=!!wf[i];
  if(ok){nearT(p[0],p[1]);const wj=sd>0?WL[nI]:WR[nI];if(nI>=0&&nL*sd>0&&nL*sd<HW+wj-.9&&Math.abs(nI-i)>3&&Math.abs(nI-i)<TN-3){ok=false;gapByFold=true;}}else gapByFold=false;
  if(!ok){if(!gapByFold&&lastOk){pts.push(null);lastOk=null;}continue;}
  const q=[p[0],p[1],NX[i]*sd,NZ[i]*sd,i];if(!lastOk&&pts.length&&pts[pts.length-1])pts.push(null);pts.push(q);lastOk=q;gapByFold=false;}
 BARR[sd>0?0:1]=pts;wallLine(pts,1.0,.5,Q.wall,3.5,Q.wallW);}

/* ================= DISTANCE AND DRS BOARDS (plain text) ================= */
/* one text atlas for every sign in the scene: ten rows with the team names (garage fascias), then the board cells */
const ATL=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=1024;const g=cv.getContext('2d'),F=s=>'800 '+s+'px Inter,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
 g.fillStyle='#f4f4f1';g.fillRect(0,0,1024,1024);g.fillStyle='#16171a';g.textAlign='center';g.textBaseline='middle';
 K.TEAMS.forEach((t,k)=>{let fs=54;g.font=F(fs);const w=g.measureText(t.name).width;if(w>960){fs*=960/w;g.font=F(fs);}g.fillText(t.name,512,k*80+43);});
 const TXT=['200','150','100','50','DRS','80'];g.font=F(84);TXT.forEach((t,k)=>{const x=(k%4)*256,y=800+Math.floor(k/4)*112;g.strokeStyle='#16171a';g.lineWidth=8;g.strokeRect(x+6,y+6,244,100);if(t)g.fillText(t,x+128,y+60);});
 const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=aniso;MAT.sign=patch(std({map:tex,vertexColors:true,roughness:.7}));
 return {team:k=>[0,1,1-(k+1)*80/1024,1-k*80/1024],cell:k=>[(k%4)/4,(k%4+1)/4,1-(800+(Math.floor(k/4)+1)*112)/1024,1-(800+Math.floor(k/4)*112)/1024]};})();
/* upright text panel into SG: centre (x, y, z), half width, half height, facing unit normal (nx, nz), atlas rectangle uv; reads left to right for someone facing it */
function panel(x,y,z,hw,hh,nx,nz,uv){const ax=nz,az=-nx,A=[x-ax*hw,z-az*hw],Bp=[x+ax*hw,z+az*hw],w=Q.white,y0=y-hh,y1=y+hh;
 SG.v(A[0],y0,A[1],nx,0,nz,w,uv[0],uv[2]);SG.v(Bp[0],y0,Bp[1],nx,0,nz,w,uv[1],uv[2]);SG.v(Bp[0],y1,Bp[1],nx,0,nz,w,uv[1],uv[3]);SG.v(A[0],y0,A[1],nx,0,nz,w,uv[0],uv[2]);SG.v(Bp[0],y1,Bp[1],nx,0,nz,w,uv[1],uv[3]);SG.v(A[0],y1,A[1],nx,0,nz,w,uv[0],uv[3]);}
{const board=(s,sd,k)=>{const i=sIdx(s),W=sd>0?WL[i]:WR[i],lat=sd*(HW+Math.max(1.4,W-.9)),p=tp(i,lat),h=TH[i],tx=Math.sin(h),tz=Math.cos(h);
  B.box(.14,1.6,.14,p[0],-.1,p[1],Q.dark,h);B.box(2.6,1.35,.06,p[0]+tx*.02,1.45,p[1]+tz*.02,Q.dark,h);
  panel(p[0]-tx*.04,2.12,p[1]-tz*.04,1.25,.62,-tx,-tz,ATL.cell(k));};   /* faces the oncoming cars */
 /* braking-distance boards on the outside of the corner; for Turn 1 on the grandstand side, because the outside there is the strip
    along the pit wall (kept free, and a "50" there reads like a pit speed limit) */
 for(const n of [1,5,6,9,12,14,16]){const c=cs(n),sd=n===1?1:-c.side,s0=c.sIn+6;[[200,0],[150,1],[100,2],[50,3]].forEach(d=>{if(n!==5&&n!==6&&n!==9&&d[0]===200)return;board(s0-d[0],sd,d[1]);});}
 for(const s of [cs(5).sOut+150,cs(8).sOut+70])for(const sd of [1,-1])board(s,sd,4);}

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

/* ================= BUILDINGS ================= */
function polyDown(b,pts,y,c){for(const f of triFaces(pts)){let A=pts[f[0]],B2=pts[f[1]],C2=pts[f[2]];if((B2[1]-A[1])*(C2[0]-A[0])-(B2[0]-A[0])*(C2[1]-A[1])>0){const t=B2;B2=C2;C2=t;}
  b.P.push(A[0],y,A[1],B2[0],y,B2[1],C2[0],y,C2[1]);b.N.push(0,-1,0,0,-1,0,0,-1,0);b.C.push(c.r,c.g,c.b,c.r,c.g,c.b,c.r,c.g,c.b);}}
/* keep map buildings out of the track corridor and off the pit path */
function clearRing(pts){return pts.map(p=>{let x=p[0],z=p[1];nearT(x,z);if(nI>=0){const w=HW+(nL>0?WL[nI]:WR[nI])+2.4;if(Math.abs(nL)<w&&nD<w+2){const s=nL>=0?1:-1;x=TX[nI]+NX[nI]*s*w;z=TZ[nI]+NZ[nI]*s*w;}}
 nearP(x,z);if(pI>=0&&pD<10&&pI*PDS>30){const s=pL>=0?1:-1;x=K.PX[pI]+K.PNX[pI]*s*10;z=K.PZ[pI]+K.PNZ[pI]*s*10;}return [x,z];});}
const BLD=[];   /* footprints kept for trees, masts and lamps: {pts, bb, h} */
const wallCols=[C(0xf2ede3),C(0xe8dfce),C(0xe1d6c2),C(0xd9d4cb),C(0xcfc8ba),C(0xe9e2d2),C(0xdcd3c4)],roofCols=[C(0xc9c2b5),C(0xb9b2a6),C(0xd6cdbc),C(0xa9a399),C(0xcfc9be)];
function block(pts,y0,y1,wc,rc,u0){wallsUV(BW,pts,y0,y1,wc,u0||0);polyFlat(RF,pts,y1,rc);}
let HOTEL=null,REDROOF=null,TOWER=null;
CITY.buildings.forEach((b,bi)=>{let pts=ringPts(b.r);if(pts.length<3)return;const c0=centP(pts),nm=b.n||'';
 if(!nm&&b.a>9000&&b.a<11000&&Math.hypot(c0[0]+5,c0[1]-213)<60)return;                 /* the pit building is built from PIT */
 if(nm.indexOf('W Abu Dhabi')===0){HOTEL=pts;return;}
 if(!nm&&b.a>150000){REDROOF=pts;return;}
 if(nm==='Control Tower'&&b.k!=='roof'){TOWER=pts;return;}
 pts=clearRing(pts);const bb=bboxP(pts),onLand=isLand(c0[0],c0[1]),base=onLand?-.4:Y.sea+.3;
 let h=b.h||(b.lv?b.lv*3.5:0);if(nm==='Yas Mall')h=17;if(b.k==='stadium')h=24;
 if(!h)h=b.k==='carport'?3.2:b.k==='roof'?10:b.k==='construction'?7:b.k==='apartments'?27:b.a<150?4.6:b.a<600?7.2:b.a<2500?10.5:13.5;
 if(!b.h&&!b.lv&&b.k==='yes')h+=(bi*7%4)*.9;
 BLD.push({pts,bb,h});
 if(b.k==='carport'||b.k==='roof'){const y=h,rc=b.k==='roof'?Q.roofW:roofCols[bi%roofCols.length];extrude(B,pts,y-.45,y,rc,rc);polyDown(B,pts,y-.45,Q.wall);
  const step=Math.max(1,Math.round(pts.length/8));for(let i=0;i<pts.length;i+=step){const p=pts[i],q=[c0[0]+(p[0]-c0[0])*.94,c0[1]+(p[1]-c0[1])*.94];B.cyl(b.k==='roof'?.45:.14,y-.45-base,q[0],base,q[1],Q.steel,6);}
  if(b.k==='roof'){const inner=scaleRing(pts,.72,c0);block(inner,base,y*.55,wallCols[bi%wallCols.length],Q.deck);}return;}
 block(pts,base,h,wallCols[(bi*7+Math.floor(b.a))%wallCols.length],roofCols[(bi*5+pts.length)%roofCols.length],bi*.37);
 if(b.k==='stadium'){const r=Math.sqrt(b.a/PI)*.86;BS.addM(GEO.sph,Q.roofW,M4(c0[0],h-.5,c0[1],0,0,0,r,r*.22,r));}
 /* two wall lamps per larger building (fixed corners, no random numbers), so the built-up parts of the island show at night */
 if(b.a>320){const n=pts.length,y=Math.min(4.2,h*.55);for(const k of [(bi*3)%n,(bi*3+(n>>1))%n]){const p=pts[k];glow(c0[0]+(p[0]-c0[0])*1.04,y,c0[1]+(p[1]-c0[1])*1.04,cWarm,0);}}
 if(h>30)glow(c0[0],h+1.5,c0[1],cRed,0);});

/* ---------- the three-pointed red roof north of the circuit: a plain red shell, no markings ---------- */
const redMat=patch(std({color:Q.red,roughness:.55,metalness:.1,flatShading:true,emissive:Q.red,emissiveIntensity:0}));
if(REDROOF){const p=REDROOF,c=centP(p),n=p.length,RB=new Batch(),mid=scaleRing(p,.5,c),lip=scaleRing(p,1.012,c),e0=11,e1=27,e2=34,red=Q.red;
 BLD.push({pts:p,bb:bboxP(p),h:e2});extrude(B,scaleRing(p,.985,c),-.4,e0-.6,Q.glassD,null);
 for(let i=0;i<n;i++){const j=(i+1)%n,a=lip[i],b=lip[j],ma=mid[i],mb=mid[j];
  bq(RB,[a[0],e0-1.6,a[1]],[b[0],e0-1.6,b[1]],[b[0],e0,b[1]],[a[0],e0,a[1]],red,a[0]-c[0],0,a[1]-c[1]);
  bq(RB,[a[0],e0,a[1]],[b[0],e0,b[1]],[mb[0],e1,mb[1]],[ma[0],e1,ma[1]],red,0,1,0);
  bq(RB,[ma[0],e1,ma[1]],[mb[0],e1,mb[1]],[c[0],e2,c[1]],[c[0],e2,c[1]],red,0,1,0);}
 polyDown(RB,lip,e0-1.6,red);for(let i=0;i<n;i+=3){const a=lip[i];glow(a[0],e0-.8,a[1],cDim,0);}   /* a faint line of lights under the rim */
 const m=new THREE.Mesh(RB.geom(),redMat);m.castShadow=true;m.receiveShadow=true;world.add(m);CASTERS.push(m);}

/* ---------- control tower by Turn 1: podium, shaft, glazed pod with a tilted cap ---------- */
if(TOWER){const p=clearRing(TOWER),c=centP(p),x=c[0],z=c[1];BLD.push({pts:p,bb:bboxP(p),h:60});block(p,-.4,9,wallCols[0],Q.deck);
 BS.cyl(5.2,38,x,9,z,Q.wallW,20);BS.addM(new THREE.CylinderGeometry(12.5,7,5,24),Q.wallW,M4(x,49.5,z));GL.cyl(12.6,4.6,x,52,z,P.white,24);BS.cyl(13.4,.8,x,56.6,z,Q.wallW,24);
 BS.addM(cylG(24),Q.roofW,M4(x+1.2,58.6,z,0,0,.07,14.6,1.1,14.6));B.cyl(.25,9,x,59,z,Q.steel,6);glow(x,68.5,z,cRed,0);
 for(let k=0;k<12;k++){const a=k/12*TAU;glow(x+Math.cos(a)*12.9,54.2,z+Math.sin(a)*12.9,cWht,1);}}

/* ---------- hotel between Turn 13 and Turn 14: two masses, a glazed bridge over the track, a grid-shell canopy ---------- */
let canopyU=null,hotelGlass=null;
if(HOTEL){const sA=cs(13).sOut+8,sB=cs(14).sIn-8;K.trackPos(sA,0,o1);K.trackPos(sB,0,o2);const pA=[o1.x,o1.z],pB=[o2.x,o2.z],ux=pB[0]-pA[0],uz=pB[1]-pA[1],ul=Math.hypot(ux,uz),nx=uz/ul,nz=-ux/ul,d0=nx*pA[0]+nz*pA[1],CLR=15,mx=(pA[0]+pB[0])/2,mz=(pA[1]+pB[1])/2;
 /* lateral = n . p - d0 (+ = left of the track = west) */
 const west=clearRing(clipHalf(HOTEL,-nx,-nz,-d0-CLR)),east=clearRing(clipHalf(HOTEL,nx,nz,d0-CLR)),neck=clipHalf(clipHalf(HOTEL,nx,nz,d0+CLR+1.5),-nx,-nz,-d0+CLR+1.5);
 const wTow=scaleRing(clipHalf(west,nx,nz,d0+CLR+112),.84),eTow=scaleRing(east,.8),HT=37;
 BLD.push({pts:west,bb:bboxP(west),h:HT},{pts:east,bb:bboxP(east),h:HT});
 if(west.length>2){block(west,-.4,9,wallCols[1],Q.deck);if(wTow.length>2)block(wTow,9,HT,wallCols[0],Q.roofW,.3);}
 if(east.length>2){block(east,Y.sea+.2,7,wallCols[1],Q.deck);if(eTow.length>2)block(eTow,7,HT-2,wallCols[0],Q.roofW,.6);}
 /* the bridge is a see-through structure (see SEE in the base piece): three meshes of its own, bands and roof, glass, lit underside,
    with materials that look like MAT.clay / MAT.roof, MAT.glass and MAT.inter (the glass follows MAT.glass at night, see env.tick) */
 if(neck.length>2){const y0=11,y1=19.5,HS=new Batch(),HG=new Batch(),HI=new Batch();extrude(HG,neck,y0,y1,P.white,null);polyFlat(HS,neck,y1,Q.roofW);polyDown(HI,neck,y0,Q.inter);
  const nb=scaleRing(neck,1.012);for(let i=0;i<nb.length;i++){const a=nb[i],b=nb[(i+1)%nb.length];for(const y of [y0,y0+4.2,y1-.3])bq(HS,[a[0],y,a[1]],[b[0],y,b[1]],[b[0],y+.3,b[1]],[a[0],y+.3,a[1]],Q.wallW,(a[0]+b[0])/2-mx,0,(a[1]+b[1])/2-mz);}
  hotelGlass=patch(std({color:C(0x86aabb),roughness:.2,metalness:.25,emissive:C(0xffd9a0),emissiveIntensity:0}));hotelGlass.envMapIntensity=.9;
  const hi=new THREE.MeshBasicMaterial({vertexColors:true});hi.color=MAT.inter.color;
  seeAdd('Hotel bridge',[flush(HS,seeMat(),true,true),flush(HG,hotelGlass,false,true),flush(HI,hi,false,false)],[volPrism(nb,y0-.1,y1+.4)]);}
 /* canopy: a height field draped over both masses and the bridge, drawn as a see-through diamond lattice that glows at night */
 const bw=bboxP(wTow.length>2?wTow:west),be=bboxP(eTow.length>2?eTow:east),bn=bboxP(neck.length>2?neck:[pA,pB]);
 const blobs=[[(bw[0]+bw[1])/2,(bw[2]+bw[3])/2,(bw[1]-bw[0])/2+17,(bw[3]-bw[2])/2+15,47],[(be[0]+be[1])/2,(be[2]+be[3])/2,(be[1]-be[0])/2+15,(be[3]-be[2])/2+15,45],[(bn[0]+bn[1])/2,(bn[2]+bn[3])/2,(bn[1]-bn[0])/2+24,(bn[3]-bn[2])/2+14,31]];
 const hf=(x,z)=>{let h=0;for(let k=0;k<blobs.length;k++){const b=blobs[k],r2=((x-b[0])/b[2])**2+((z-b[1])/b[3])**2,v=1-r2*r2;if(v>0){const y=b[4]*Math.sqrt(v);if(y>h)h=y;}}return h;};
 let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const b of blobs){x0=Math.min(x0,b[0]-b[2]);x1=Math.max(x1,b[0]+b[2]);z0=Math.min(z0,b[1]-b[3]);z1=Math.max(z1,b[1]+b[3]);}
 const ST=3.4,nxg=Math.ceil((x1-x0)/ST),nzg=Math.ceil((z1-z0)/ST),HMIN=12.5,pos=[],nor=[],uvs=[],fade=[],idx=[],id=new Int32Array((nxg+1)*(nzg+1)).fill(-1);
 const vert=(i,j)=>{const k=j*(nxg+1)+i;if(id[k]>=0)return id[k];const x=x0+i*ST,z=z0+j*ST,h=hf(x,z),e=.8,gx=(hf(x+e,z)-hf(x-e,z))/(2*e),gz=(hf(x,z+e)-hf(x,z-e))/(2*e),l=Math.hypot(gx,1,gz);
  pos.push(x,Math.max(h,HMIN-2),z);nor.push(-gx/l,1/l,-gz/l);uvs.push((x+z)/5.4,(x-z)/5.4);fade.push(sstep(HMIN,HMIN+7,h));return id[k]=pos.length/3-1;};
 for(let j=0;j<nzg;j++)for(let i=0;i<nxg;i++){const x=x0+i*ST,z=z0+j*ST;if(Math.max(hf(x,z),hf(x+ST,z),hf(x,z+ST),hf(x+ST,z+ST))<HMIN)continue;const a=vert(i,j),b=vert(i+1,j),c=vert(i+1,j+1),d=vert(i,j+1);idx.push(a,d,c,a,c,b);}
 const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));cg.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));cg.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));cg.setAttribute('aFade',new THREE.Float32BufferAttribute(fade,1));cg.setIndex(idx);
 canopyU=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uT:{value:0},uGlow:{value:0},uSee:{value:1},uSun:{value:new V3(0,1,0)},uSunC:{value:new THREE.Color(1,1,1)},uAmb:{value:new THREE.Color(.5,.5,.5)}}]);
 const cm=new THREE.Mesh(cg,new THREE.ShaderMaterial({uniforms:canopyU,fog:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,extensions:{derivatives:true},
  vertexShader:`attribute float aFade;varying float vFade;varying vec2 vL;varying vec3 vN,vW;
#include <fog_pars_vertex>
void main(){vFade=aFade;vL=uv;vN=normal;vW=position;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`,
  fragmentShader:`uniform float uT,uGlow,uSee;uniform vec3 uSun,uSunC,uAmb;varying float vFade;varying vec2 vL;varying vec3 vN,vW;
#include <fog_pars_fragment>
vec3 pal(float t){return .5+.5*cos(6.2831853*(t+vec3(0.,.33,.67)));}
void main(){vec2 f=abs(fract(vL)-.5);float d=min(f.x,f.y),w=fwidth(vL.x)+fwidth(vL.y);float line=1.-smoothstep(.055,.055+max(w,.012),d);line=mix(line,.22,clamp(w*1.6,0.,1.));
 vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 base=mix(vec3(.62,.72,.8),vec3(.93,.94,.95),line);vec3 col=base*(uAmb+uSunC*max(dot(n,uSun),0.)*.9);
 vec3 led=pal(uT*.0045+vW.x*.0026+vW.z*.0019)*.75+pal(uT*.0031-vW.z*.004+.4)*.35;col=col*(1.-.55*uGlow)+led*uGlow*(.5+.75*line);
 gl_FragColor=vec4(col,mix(.16+.14*uGlow,1.,line)*vFade*(.8+.2*uGlow)*uSee);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
 #include <fog_fragment>
}`}));cm.renderOrder=4;cm.frustumCulled=false;world.add(cm);STAT.canopy=idx.length/3;
 /* the canopy is a see-through structure too (uSee scales its alpha). Its own test for the cameras: the segment is cut to the box of the
    canopy and sampled; it goes through the shell when one sample is above the height field and a later one below it, both where the
    lattice is really drawn (the faint rim does not count). Allocates nothing. */
 const cb=[x0,HMIN-2,z0,x1,48,z1];
 seeAdd('Hotel canopy',[cm],[],(ax,ay,az,bx,by,bz)=>{const dx=bx-ax,dy=by-ay,dz=bz-az;let t0=0,t1=1,prev=0;
  for(let k=0;k<3;k++){const a=k===0?ax:k===1?ay:az,d=k===0?dx:k===1?dy:dz,lo=cb[k],hi=cb[k+3];if(d>-1e-9&&d<1e-9){if(a<lo||a>hi)return false;continue;}
   let u=(lo-a)/d,v=(hi-a)/d;if(u>v){const w=u;u=v;v=w;}if(u>t0)t0=u;if(v<t1)t1=v;if(t0>t1)return false;}
  for(let i=0;i<=24;i++){const t=t0+(t1-t0)*i/24,h=hf(ax+dx*t,az+dz*t),s=h>HMIN+1.5?(ay+dy*t>h?1:-1):0;if(s&&prev&&s!==prev)return true;prev=s;}
  return false;});}

/* ================= BRIDGES OVER THE TRACK, MARINA PONTOONS, YACHTS ================= */
/* bridges that are mapped as an outline: a deck with clearance where it crosses the circuit, ramps (or stairs) down at both ends */
CITY.bridges.forEach(br=>{const pts=br.c?ringPts(br.p):flatPts(br.p);if(pts.length<2)return;
 if(!br.c){let near=false;for(const p of pts){nearT(p[0],p[1]);if(nD<30)near=true;}if(near||pts.length<2)return;
  /* small footbridges between the quays: a low deck */
  ribbonPL(B,pts,1.8,.18,Q.deck);return;}
 let over=false;const bb=bboxP(pts);for(let i=0;i<TN;i+=2)if(inBox(TX[i],TZ[i],bb)&&inPts(TX[i],TZ[i],pts)){over=true;break;}
 if(!over){extrude(B,pts,-.3,.4,Q.conc,Q.road);return;}
 let e1=pts[0],e2=pts[1],md=0;for(const a of pts)for(const b of pts){const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d>md){md=d;e1=a;e2=b;}}
 const wd=Math.abs(area2(pts))/2/md,road=wd>8.5,H=road?7.2:6.4,ux=(e2[0]-e1[0])/md,uz=(e2[1]-e1[1])/md,px=-uz,pz=ux,hw=Math.max(2,wd/2),RL=road?46:15;
 /* a bridge over the track is a see-through structure (see SEE in the base piece): its own batch BR, mesh and material.
    v = what the cameras test: the deck with its parapets, every pier (widened: they are thin), and both ramps as wedges */
 const BR=new Batch(),v=[volPrism(pts,H-.9,H+1.2)],hd=Math.atan2(ux,uz),pier=(r,x,z)=>{BR.cyl(r,H-.8,x,-.1,z,Q.conc,8);v.push(volPrism(rectPts(x,z,0,.4,.4),-.1,H-.8,.5));};
 extrude(BR,pts,H-.8,H,Q.concD,road?Q.road:Q.deck);polyDown(BR,pts,H-.8,Q.concD);const cc=centP(pts);
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],hx=(a[0]+b[0])/2-cc[0],hz=(a[1]+b[1])/2-cc[1];bq(BR,[a[0],H,a[1]],[b[0],H,b[1]],[b[0],H+1.1,b[1]],[a[0],H+1.1,a[1]],Q.wall,hx,0,hz);bq(BR,[a[0],H,a[1]],[b[0],H,b[1]],[b[0],H+1.1,b[1]],[a[0],H+1.1,a[1]],Q.wall,-hx,0,-hz);}
 /* piers under the span wherever they are clear of the track corridor */
 for(let d=8;d<md-6;d+=13){const cx=e1[0]+ux*d,cz=e1[1]+uz*d;nearT(cx,cz);const w=nI<0?0:HW+(nL>0?WL[nI]:WR[nI])+2.5;if(nI>=0&&nD<w+hw)continue;for(const sd of (road?[1,-1]:[0]))pier(road?.5:.32,cx+px*hw*.7*sd,cz+pz*hw*.7*sd);}
 for(const en of [[e1,-1],[e2,1]]){const e=en[0],s=en[1],cx=e[0]-ux*s*2,cz=e[1]-uz*s*2,fx=cx+ux*s*RL,fz=cz+uz*s*RL;
  quad(BR,[cx+px*hw,H,cz+pz*hw],[cx-px*hw,H,cz-pz*hw],[fx-px*hw,-.05,fz-pz*hw],[fx+px*hw,-.05,fz+pz*hw],road?Q.road:Q.conc);
  for(const sd of [1,-1])bq(BR,[cx+px*hw*sd,-.1,cz+pz*hw*sd],[fx+px*hw*sd,-.1,fz+pz*hw*sd],[fx+px*hw*sd,-.05,fz+pz*hw*sd],[cx+px*hw*sd,H,cz+pz*hw*sd],Q.conc,px*sd,0,pz*sd);
  /* the ramp: its box, cut by the plane of the sloping deck (inside = below the deck) */
  {const wx=ux*s*H/RL,wz=uz*s*H/RL;v.push(volPrism(rectPts((cx+fx)/2,(cz+fz)/2,hd,RL/2,hw),-.1,H+.1,.2,[wx,1,wz,H+.15+wx*cx+wz*cz]));}
  for(const sd of [1,-1]){nearT(cx+px*hw*sd,cz+pz*hw*sd);if(nD>HW+9)pier(.5,cx+px*hw*sd*.8,cz+pz*hw*sd*.8);}}
 seeAdd(road?'Road bridge':'Footbridge',[flush(BR,seeMat(),true,true)],v);});

/* pontoons and piers */
const PIERS=[];
CITY.piers.forEach(pr=>{if(!pr.c){ribbonPL(B,flatPts(pr.p),1.2,-.78,Q.deck);return;}const pts=ringPts(pr.p);if(pts.length<3)return;const fl=pts.length>100,y=pr.k==='breakwater'?.3:fl?-.8:-.3;
 extrude(B,pts,Y.sea,y,Q.concD,pr.k==='breakwater'?Q.conc:Q.deck);PIERS.push({pts,bb:bboxP(pts),y,fl,sg:area2(pts)>0?1:-1});});
const onPier=(x,z)=>{for(const p of PIERS)if(inBox(x,z,p.bb)&&inPts(x,z,p.pts))return true;return false;};
const isWater=(x,z)=>!isLand(x,z)&&!onPier(x,z);

/* yachts: three sizes, instanced; moored stern-to along the pontoon edges where there is free water */
{const hull=(b,L,w,h)=>{b.box(w,h,L*.82,0,0,-L*.09,P.hull);b.addM(GEO.box,P.hull,M4(0,h/2,L*.32,0,PI/4,0,w*.7,h,w*.7));b.box(w+.05,h*.2,L*.8,0,h*.55,-L*.09,P.navy);b.box(w*.92,.08,L*.78,0,h,-L*.09,Q.wood);};
 const g1=new Batch();hull(g1,9,2.9,1);g1.box(1.9,.8,3,0,1.05,-1.2,P.white);g1.cyl(.07,10,0,1.05,.8,P.steel,5);g1.box(.08,.08,4,0,2.5,-1.4,P.steel);
 const g2=new Batch();hull(g2,17,4.6,1.7);g2.box(3.9,1.5,8.5,0,1.75,-2.2,P.white);g2.box(3.95,.6,7.5,0,2.25,-2.2,P.glassD);g2.box(3.1,1.2,4.6,0,3.25,-2.8,P.white);g2.box(3.15,.5,4,0,3.55,-2.8,P.glassD);g2.cyl(.06,2.4,0,4.45,-3,P.steel,5);
 const g3=new Batch();hull(g3,38,7.6,2.6);g3.box(6.6,2.2,22,0,2.65,-5,P.white);g3.box(6.65,.8,20,0,3.45,-5,P.glassD);g3.box(5.6,2,15,0,4.85,-6.5,P.white);g3.box(5.65,.7,13.5,0,5.45,-6.5,P.glassD);g3.box(4.2,1.6,8,0,6.85,-7.5,P.white);g3.cyl(.1,4,0,8.45,-8,P.steel,5);g3.box(3,.3,1,0,9.85,-8,P.white);
 const L=[9,17,38],Wd=[3.6,5.6,9],placed=[[],[],[]],all=[];
 const tryBoat=(x,z,nx,nz,type)=>{const l=L[type],cx=x+nx*(l/2+1.3),cz=z+nz*(l/2+1.3);for(const k of [.04,.5,1.04]){if(!isWater(x+nx*(l*k+1.4),z+nz*(l*k+1.4)))return false;}
  for(const sd of [-1,1])if(!isWater(cx-nz*sd*Wd[type]*.5,cz+nx*sd*Wd[type]*.5))return false;
  for(const o of all){if(Math.hypot(o[0]-cx,o[1]-cz)<(o[2]+l)*.5+.8&&Math.abs((o[0]-cx)*nz-(o[1]-cz)*nx)<(Wd[type]+o[3])*.5+.7)return false;}
  all.push([cx,cz,l,Wd[type]]);placed[type].push([cx,cz,Math.atan2(nx,nz)]);return true;};
 const along=(a,b,ox,oz,types)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<7)return;const ux=(b[0]-a[0])/l,uz=(b[1]-a[1])/l;let d=2.4;while(d<l-1.5&&all.length<340){const type=types[Math.floor(rnd()*types.length)];if(rnd()<.84&&tryBoat(a[0]+ux*d,a[1]+uz*d,ox,oz,type))d+=Wd[type]+1.1;else d+=2.6;}};
 PIERS.forEach(p=>{const n=p.pts.length;for(let i=0;i<n;i++){const a=p.pts[i],b=p.pts[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<7)continue;along(a,b,dz/l*p.sg,-dx/l*p.sg,p.fl?(l>26?[0,1,1]:[0,0,1]):l>70?[2,1]:[1,0]);}});
 [g1,g2,g3].forEach((g,t)=>{const list=placed[t];if(!list.length)return;const geo=g.geom(),im=new THREE.InstancedMesh(geo,MAT.boat,list.length);let cx=0,cz=0;
  list.forEach((p,i)=>{im.setMatrixAt(i,M4(p[0],Y.sea-.05,p[1],0,p[2],0));cx+=p[0];cz+=p[1];
   glow(p[0],Y.sea+(t===0?2.2:t===1?3.4:5.6),p[1],cWarm,0);if(t===0)glow(p[0]+Math.sin(p[2])*.8,Y.sea+11,p[1]+Math.cos(p[2])*.8,cWht,1);if(t===2){glow(p[0]+Math.sin(p[2])*9,Y.sea+3.6,p[1]+Math.cos(p[2])*9,cWarm,0);glow(p[0]-Math.sin(p[2])*12,Y.sea+4.2,p[1]-Math.cos(p[2])*12,cWarm,0);}});
  cx/=list.length;cz/=list.length;let r=0;for(const p of list)r=Math.max(r,Math.hypot(p[0]-cx,p[1]-cz));geo.boundingSphere=new THREE.Sphere(new V3(cx,2,cz),r+25);
  im.castShadow=true;im.receiveShadow=true;world.add(im);CASTERS.push(im);});
 STAT.boats=placed.map(p=>p.length);}

/* ================= TREES AND PALMS (instanced), FLOODLIGHT MASTS, LAMPS ================= */
MAT.foliage.side=THREE.DoubleSide;
const padQ0=BLD0-45,padQ1=BLD1+25;
/* a spot on land that is clear of the track corridor, the pit complex, buildings and grandstands */
function freeSpot(x,z,r){if(!isLand(x,z)||inTrench(x,z))return false;nearT(x,z);if(nI>=0){const w=HW+(nL>0?WL[nI]:WR[nI])+2.5+r;if(Math.abs(nL)<w&&nD<w+3)return false;}
 nearP(x,z);if(pI>=0){const q=pI*PDS;if(pD<12+r)return false;if(q>padQ0&&q<padQ1&&pL<0&&pL>-82)return false;}
 for(const b of BLD)if(inBox(x,z,b.bb,r+1.5)&&inPts(x,z,b.pts))return false;for(const s of STANDS)if(inBox(x,z,s.bb,r+3)&&inPts(x,z,s.pts))return false;return true;}
/* instanced set split into four quadrants, each with its own bounding sphere so it can be culled */
function instQuads(geo,mat,list,mk,cast){const Qd=[[],[],[],[]];for(const t of list)Qd[(t[0]<-40?0:1)+(t[1]<120?0:2)].push(t);
 for(const l of Qd){if(!l.length)continue;const g=geo.clone(),im=new THREE.InstancedMesh(g,mat,l.length);let cx=0,cz=0;l.forEach((t,i)=>{im.setMatrixAt(i,mk(t));cx+=t[0];cz+=t[1];});cx/=l.length;cz/=l.length;let r=0;for(const t of l)r=Math.max(r,Math.hypot(t[0]-cx,t[1]-cz));
  g.boundingSphere=new THREE.Sphere(new V3(cx,8,cz),r+36);im.castShadow=!!cast;im.receiveShadow=true;world.add(im);if(cast)CASTERS.push(im);}}
const TREES=[],PALMS=[];   /* exported: [x, z, crown radius, height] */
{const trees=[],palms=[];
 for(const g of CITY.green){if(g.k==='pitch')continue;const p=ringPts(g.r);if(p.length<3)continue;const bb=bboxP(p),golf=g.k==='golf',n=golf?430:Math.min(10,Math.round(g.a/520));let k=0,tries=0;
  while(k<n&&tries++<n*9){const x=rr(bb[0],bb[1]),z=rr(bb[2],bb[3]);if(!inPts(x,z,p)||!freeSpot(x,z,2))continue;(golf||rnd()<.42?trees:palms).push([x,z,rr(.8,1.35)]);k++;}}
 for(const p of ROADPALM)if(palms.length<1700&&rnd()<.8&&freeSpot(p[0],p[1],1.5))palms.push([p[0],p[1],rr(.9,1.3)]);
 {const ch=LAND.open[0];let acc=0;for(let i=1;i<ch.length;i++){const a=ch[i-1],b=ch[i];if(!(a[0]>-260&&a[0]<620&&a[1]>20&&a[1]<1300))continue;const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;acc+=l;
   while(acc>21){acc-=21;const u=1-acc/l,x=a[0]+dx*clamp(u,0,1)+dz/l*5.5,z=a[1]+dz*clamp(u,0,1)-dx/l*5.5;if(freeSpot(x,z,1.5))palms.push([x,z,rr(.9,1.2)]);}}}
 const tb=new Batch();tb.box(.5,3,.5,0,0,0,P.trunk);tb.addM(GEO.ico,P.leaf,M4(0,4.9,0,.4,.7,0,2.9,2.6,2.9));tb.addM(GEO.ico,P.leaf2,M4(1.1,6.2,-.5,.2,1.9,0,1.9,1.7,1.9));
 const pb=new Batch();pb.box(.34,8.6,.34,0,0,0,P.trunk);
 for(let k=0;k<7;k++){const a=k/7*TAU,cx=Math.sin(a),cz=Math.cos(a),wx=cz,wz=-cx,c=k&1?P.palm:P.palm2,P0=[0,8.6,0],M=[cx*2.3,9.35,cz*2.3],T=[cx*4.5,7.9,cz*4.5],
   v=(p,w)=>[p[0]+wx*w,p[1],p[2]+wz*w],put=(A,B2,C2)=>{pb.P.push(A[0],A[1],A[2],B2[0],B2[1],B2[2],C2[0],C2[1],C2[2]);pb.N.push(0,1,0,0,1,0,0,1,0);pb.C.push(c.r,c.g,c.b,c.r,c.g,c.b,c.r,c.g,c.b);};
  put(v(P0,-.15),v(P0,.15),v(M,.62));put(v(P0,-.15),v(M,.62),v(M,-.62));put(v(M,-.62),v(M,.62),v(T,.1));put(v(M,-.62),v(T,.1),v(T,-.1));}
 /* round trees close to the track stand in front of trackside cameras: none within 30 m of the barrier (palms stay: thin trunk, high crown).
    Filtered after the placement, so the random sequence, and with it everything placed later, is unchanged. */
 const keep=trees.filter(t=>{nearT(t[0],t[1]);return nI<0||nD>HW+(nL>0?WL[nI]:WR[nI])+30;});
 instQuads(tb.geom(),MAT.foliage,keep,t=>M4(t[0],Y.land,t[1],0,(t[0]*7.3+t[1]*3.1)%TAU,0,t[2],t[2],t[2]),true);
 instQuads(pb.geom(),MAT.foliage,palms,t=>M4(t[0],Y.land,t[1],0,(t[0]*5.7+t[1]*2.3)%TAU,0,t[2],t[2],t[2]),true);
 for(const t of keep)TREES.push([t[0],t[1],4.2*t[2],8.2*t[2]]);for(const t of palms)PALMS.push([t[0],t[1],4.6*t[2],9.6*t[2]]);
 STAT.trees=[keep.length,palms.length,trees.length-keep.length];}

/* floodlight masts all round the circuit, alternating sides, and a row behind the pit building.
   Positions depend only on geometry (no random numbers); exported as WORLD.masts for the camera placement of the show part. */
const MASTS=[];
{const list=[],MH=31;
 for(let n=0;n*55<K.TLEN-20;n++){const i=sIdx(n*55+12);for(const sd of (n&1?[1,-1]:[-1,1])){const W=sd>0?WL[i]:WR[i],p=tp(i,sd*(HW+W+4.4));if(!freeSpot(p[0],p[1],1.2))continue;list.push([p[0],p[1],Math.atan2(-NX[i]*sd,-NZ[i]*sd)]);break;}}
 for(let q=BLD0+20;q<BLD1;q+=58){const p=pq(q,GL0-BLDD-3.5),n=pNrm(q);list.push([p[0],p[1],Math.atan2(n[0],n[1])]);}
 const mb=new Batch();mb.box(.5,MH,.5,0,0,0,Q.steel);mb.addM(GEO.box,Q.dark,M4(0,MH+.7,.45,-.5,0,0,4.8,1.7,.3));mb.addM(GEO.box,C(0xfdfdf6),M4(0,MH+.64,.64,-.5,0,0,4.4,1.3,.08));
 instQuads(mb.geom(),MAT.clay,list,t=>M4(t[0],0,t[1],0,t[2],0),true);
 for(const t of list){glow(t[0]+Math.sin(t[2])*.8,MH+.5,t[1]+Math.cos(t[2])*.8,cCool,2);MASTS.push([t[0],t[1],MH+1.6]);}STAT.masts=list.length;}

/* street lamps (posts near the circuit, a glow everywhere), quay lamps, lights under the grandstand roofs */
{const posts=[];for(const p of ROADLAMP){if(!isLand(p[0],p[1]))continue;const close=p[0]>-900&&p[0]<900&&p[1]>-1250&&p[1]<1400;if(close&&!freeSpot(p[0],p[1],.4))continue;glow(p[0],9.3,p[1],cWarm,0);if(close)posts.push([p[0],p[1],0]);}
 for(const p of ROADLAMP0)if(freeSpot(p[0],p[1],.4))glow(p[0],7.2,p[1],cDim,0);
 const ch=LAND.open[0];let acc=0;for(let i=1;i<ch.length;i++){const a=ch[i-1],b=ch[i];if(!(a[0]>-260&&a[0]<620&&a[1]>20&&a[1]<1300))continue;const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;acc+=l;
  while(acc>27){acc-=27;const u=clamp(1-acc/l,0,1),x=a[0]+dx*u+dz/l*2.6,z=a[1]+dz*u-dx/l*2.6;if(freeSpot(x,z,.3)){glow(x,4.6,z,cWarm,0);posts.push([x,z,1]);}}}
 const lb=new Batch();lb.box(.16,1,.16,0,0,0,Q.dark);lb.box(.5,.03,.5,0,1,0,C(0xfff6dc));
 instQuads(lb.geom(),MAT.clay,posts,t=>M4(t[0],0,t[1],0,0,0,1,t[2]?4.5:9.2,1),false);
 for(const s of STANDS){if(!s.n)continue;for(let k=1;k<s.S.length;k+=3){const c=s.S[k];glow(c.ix+c.dx*c.d*.46,s.yT+6.4,c.iz+c.dz*c.d*.46,cWht,1);}}
 STAT.lamps=posts.length;}

/* ================= FLOOD MAP: where the night lighting falls =================
   Red = floodlights (track, run-offs, pit lane, paddock, grandstands); green = warm street lighting (roads, car parks, quays, around buildings).
   A canvas over the whole built-up part of the island, blurred, looked up by world x,z in every patched material and in the water shader. */
{const X0=-1300,X1=1300,Z0=-2150,Z1=1800,S=.3,Wc=Math.round((X1-X0)*S),Hc=Math.round((Z1-Z0)*S),cv=document.createElement('canvas');cv.width=Wc;cv.height=Hc;const g=cv.getContext('2d');
 g.fillStyle='#000';g.fillRect(0,0,Wc,Hc);g.globalCompositeOperation='lighter';g.lineJoin='round';g.lineCap='round';
 const path=(pts,close)=>{g.beginPath();for(let i=0;i<pts.length;i++){const x=(pts[i][0]-X0)*S,z=(pts[i][1]-Z0)*S;if(i)g.lineTo(x,z);else g.moveTo(x,z);}if(close)g.closePath();};
 const R=v=>'rgb('+Math.round(v*255)+',0,0)',G=v=>'rgb(0,'+Math.round(v*255)+',0)';
 const strokes=(col,list)=>{for(const w of list){g.lineWidth=w[0]*S;g.strokeStyle=col(w[1]);g.stroke();}};
 const vis=p=>p[0]>X0-60&&p[0]<X1+60&&p[1]>Z0-60&&p[1]<Z1+60;
 /* floodlights */
 const cl=[],le=[],ri=[];for(let i=0;i<TN;i++){cl.push([TX[i],TZ[i]]);le.push(tp(i,HW+WL[i]+6));ri.push(tp(i,-(HW+WR[i]+6)));}
 path(cl,true);strokes(R,[[150,.03],[120,.05],[96,.07],[76,.1],[58,.16],[42,.24]]);
 g.beginPath();[le,ri].forEach(l=>{l.forEach((p,i)=>{const x=(p[0]-X0)*S,z=(p[1]-Z0)*S;if(i)g.lineTo(x,z);else g.moveTo(x,z);});g.closePath();});g.fillStyle=R(.5);g.fill('evenodd');
 {const pl=[];for(let q=0;q<=PLEN;q+=4)pl.push(pq(q,0));path(pl,false);strokes(R,[[80,.2],[46,.35],[26,.4]]);
  const pad=[];for(let q=170;q<=630;q+=10)pad.push(pq(q,-8));for(let q=630;q>=170;q-=10)pad.push(pq(q,-74));path(pad,true);g.fillStyle=R(.6);g.fill();}
 for(const s of CITY.grandstands){const p=ringPts(s.r);path(p,true);g.fillStyle=R(.75);g.fill();strokes(R,[[22,.2]]);}
 /* warm street lighting */
 for(const rd of CITY.roads){const p=flatPts(rd[2]);if(!p.some(vis))continue;path(p,false);strokes(G,rd[0]>=1?[[34,.12],[16,.3]]:[[14,.2]]);}
 for(const s of CITY.parking){const p=ringPts(s.r);if(!p.some(vis))continue;path(p,true);g.fillStyle=G(.3);g.fill();}
 for(const b of CITY.buildings){const p=ringPts(b.r);if(b.a<120||!p.some(vis))continue;path(p,true);g.fillStyle=G(.16);g.fill();strokes(G,[[22,.12]]);}
 for(const pr of CITY.piers){const p=flatPts(pr.p);if(!p.some(vis))continue;path(p,!!pr.c);if(pr.c){g.fillStyle=G(.4);g.fill();}strokes(G,[[12,.2]]);}
 {const ch=LAND.open[0].filter(p=>p[0]>-300&&p[0]<680&&p[1]>-100&&p[1]<1300);path(ch,false);strokes(G,[[30,.16],[14,.22]]);}
 /* blur both channels (two box passes) so nothing shows an edge on the ground */
 const im=g.getImageData(0,0,Wc,Hc),d=im.data,tmp=new Float32Array(Math.max(Wc,Hc)),r=2,k=1/(2*r+1);
 for(let ch=0;ch<2;ch++)for(let pass=0;pass<2;pass++){
  for(let y=0;y<Hc;y++){let s=0;const o=y*Wc*4+ch;for(let x=-r;x<Wc;x++){if(x+r<Wc)s+=d[o+(x+r)*4];if(x-r-1>=0)s-=d[o+(x-r-1)*4];if(x>=0)tmp[x]=s*k;}for(let x=0;x<Wc;x++)d[o+x*4]=tmp[x];}
  for(let x=0;x<Wc;x++){let s=0;const o=x*4+ch;for(let y=-r;y<Hc;y++){if(y+r<Hc)s+=d[o+(y+r)*Wc*4];if(y-r-1>=0)s-=d[o+(y-r-1)*Wc*4];if(y>=0)tmp[y]=s*k;}for(let y=0;y<Hc;y++)d[o+y*Wc*4]=tmp[y];}}
 for(let x=0;x<Wc;x++)for(const y of [0,1,Hc-2,Hc-1]){d[(y*Wc+x)*4]=0;d[(y*Wc+x)*4+1]=0;}for(let y=0;y<Hc;y++)for(const x of [0,1,Wc-2,Wc-1]){d[(y*Wc+x)*4]=0;d[(y*Wc+x)*4+1]=0;}
 g.putImageData(im,0,0);
 const tex=new THREE.CanvasTexture(cv);tex.flipY=false;tex.generateMipmaps=false;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
 FU.uFloodMap.value=tex;FU.uFloodO.value.set(X0,Z0);FU.uFloodS.value.set(1/(X1-X0),1/(Z1-Z0));STAT.flood=[Wc,Hc];}

/* ================= FLUSH THE SHARED BATCHES ================= */
flush(RD,MAT.road,false,true);flush(AP,MAT.apron,false,true,7);flush(PL,MAT.pit,false,true,7);flush(PT,MAT.paint,false,true);flush(MK,MAT.mark,false,true);
if(SG.P.length){const m=new THREE.Mesh(SG.geom(),MAT.sign);m.receiveShadow=true;world.add(m);}
flush(B,MAT.clay,true,true);flush(BS,MAT.smooth,true,true);flush(RF,MAT.roof,true,true);flush(CAN,MAT.clay,true,true);
flush(GL,MAT.glass,false,true);flush(LP,MAT.lamp,false,false);flush(IN,MAT.inter,false,false);
if(BW.P.length){const m=new THREE.Mesh(BW.geom(),MAT.bw);m.castShadow=true;m.receiveShadow=true;world.add(m);CASTERS.push(m);}
if(FN.P.length){const m=new THREE.Mesh(FN.geom(),MAT.fence);m.renderOrder=2;world.add(m);}
/* lamp glows: gS warm street and boat lights, gW white lights, gB floodlight heads. A lamp never shrinks below a few pixels,
   so street lighting, quays and yachts still read from the widest view. */
const gS=glowS.length?glowPoints(glowS,13):null,gW=glowW.length?glowPoints(glowW,11):null,gB=glowB.length?glowPoints(glowB,42):null;
function minPx(o,px){if(!o)return;o.material.onBeforeCompile=sh=>{sh.uniforms.uMinPx={value:px*renderer.getPixelRatio()};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uMinPx;').replace('#include <fog_vertex>','gl_PointSize=max(gl_PointSize,uMinPx);\n#include <fog_vertex>');};o.material.needsUpdate=true;}
minPx(gS,3.4);minPx(gW,3);minPx(gB,4.4);
STAT.buildMs=Math.round(performance.now()-T_BUILD);STAT.glows=[glowS.length/6,glowW.length/6,glowB.length/6];
STAT.tris={B:B.P.length/9,BS:BS.P.length/9,RD:RD.P.length/9,AP:AP.P.length/9,PT:PT.P.length/9,MK:MK.P.length/9,BW:BW.P.length/9,FN:FN.P.length/9,RF:RF.P.length/9,CAN:CAN.P.length/9};
/* see-through structures: name, meshes, test volumes, triangles */
STAT.see=SEE.map(e=>e.name+': '+e.meshes.length+' mesh, '+(e.hit?'own test':e.vols.length+' vol')+', '+e.meshes.reduce((a,m)=>a+(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3,0)+' tri');
/* the glass of the hotel bridge has its own material; it follows MAT.glass, which ENV drives (called by ENV every frame, after it has set the others) */
const envTick=()=>{if(typeof hotelGlass!=='undefined'&&hotelGlass)hotelGlass.emissiveIntensity=MAT.glass.emissiveIntensity;};

return {
 setStartLights:typeof setStartLights==='function'?setStartLights:()=>{},
 startLights:typeof startLights==='function'?startLights:()=>-1,
 groundY:()=>0,
 /* obstacles for cameras: floodlight masts as [x, z, height]; round trees and palms as [x, z, crown radius, height] */
 masts:typeof MASTS==='undefined'?[]:MASTS,trees:typeof TREES==='undefined'?[]:TREES,palms:typeof PALMS==='undefined'?[]:PALMS,
 stat:STAT,
 /* for the cameras: structures that can be faded when they stand between the camera and a car (see SEE in the base piece):
    [{name, meshes, box:[x0,y0,z0,x1,y1,z1], vols:[Float32Array of planes nx,ny,nz,d], hit(ax,ay,az,bx,by,bz) or null, set(opacity), opacity}] */
 seeThrough:SEE,
 /* for ENV (same owner): materials to drive, glow sets, uniforms, the list of static shadow casters; tick = WORLD's own per-frame part */
 env:{FU,MAT,waterU,CASTERS,gS,gW,gB,canopyU:typeof canopyU==='undefined'?null:canopyU,red:typeof redMat==='undefined'?null:redMat,redC:Q.red.clone(),tick:envTick},
 /* for checks: corridor widths and helpers */
 dbg:{WL,WR,wallL,wallR,PLL,PLR,PQL,PQR,TR,LAND,isLand,BARR}
};
})();
