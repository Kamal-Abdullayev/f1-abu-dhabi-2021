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
