/* ================= p1_engine.js : shared foundations =================
   Owner: coordinator. Do not edit; ask for changes instead.
   Every name declared at top level here is visible to all later parts. Never redeclare one of them.
   Needs data.js (TRACK, RACE, EXTRA, CITY) and kernel.js (makeKernel) before it, and a <canvas id="c">. */
const V3=THREE.Vector3,PI=Math.PI,TAU=PI*2;
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
/* deterministic random: same scenery on every load */
let _seed=20211212;const rnd=()=>{_seed=(_seed+0x6D2B79F5)|0;let t=Math.imul(_seed^(_seed>>>15),1|_seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
const rr=(a,b)=>a+(b-a)*rnd(),pick=a=>a[Math.floor(rnd()*a.length)];
const C=h=>new THREE.Color(h).convertSRGBToLinear();
const angd=(a,b)=>{let d=(b-a)%TAU;if(d>PI)d-=TAU;if(d<-PI)d+=TAU;return d;};
const MOBILE=matchMedia('(max-width:820px)').matches||matchMedia('(pointer:coarse)').matches;

/* the replay kernel: whole race as a function of race time */
const K=makeKernel(TRACK,RACE,EXTRA);

/* ---------- renderer, scene, camera, the two base lights ---------- */
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,MOBILE?1.5:2));
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xefe7d6);scene.fog=new THREE.Fog(0xefe7d6,900,6000);
const camera=new THREE.PerspectiveCamera(30,1,3,12000);
const hemi=new THREE.HemisphereLight(0xffffff,0xd6cbb6,.8);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.2);sun.castShadow=true;
{const SM=MOBILE?2048:4096;sun.shadow.mapSize.set(SM,SM);const s=sun.shadow.camera;s.near=100;s.far=2600;s.left=-520;s.right=520;s.top=520;s.bottom=-520;}
sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.5;scene.add(sun);scene.add(sun.target);
/* static scenery goes into `world`; moving things are added to `scene` directly */
const world=new THREE.Group();scene.add(world);
/* call from any boot on load and on resize */
function fitView(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();}

/* ---------- shared pit-lane layout, in pit-path coordinates ----------
   K.pitPos(q, lat, out): q = metres along the pit path, lat > 0 = left of travel = toward the race track on the main straight.
   lat 0 is the centre of the fast lane. Cars stop at lat K.BOXLAT (-3.9) at q = team.boxQ. */
const PIT={
 wallLat:5.3,      /* centre line of the pit wall (0.5 m thick) between the fast lane and the track */
 wallTop:1.05,     /* height of the concrete wall */
 fenceTop:3.3,     /* top of the catch fence that stands on the wall */
 wallQ0:115,wallQ1:588, /* the wall and fence run between these pit distances */
 standLat:4.3,     /* people standing at the wall on the pit-lane side, and the team timing stands */
 garageLat:-7.6,   /* line of the garage doors (front face of the pit building) */
 garageW:20,garageH:6.2,garageDepth:14, /* one garage per team, centred on q = team.boxQ */
 crewLat:-6.2,     /* crew waiting in front of their garage */
 gantryY:7.6,      /* underside of the start gantry beam; the gantry spans the track at s = 0 */
 gantryLat:K.HW+2.4, /* gantry posts at +/- this lateral from the track centre line */
 flagY:3.4         /* platform height for the chequered flag on the right-hand (pit wall side) gantry post */
};

/* ---------- palette and materials ---------- */
const P={white:C(0xf5efe4),cream:C(0xe8dfce),roof:C(0xd6cdbc),accent:C(0xE10600),dark:C(0x3a3c41),mid:C(0x8c8984),steel:C(0xb4b7ba),yellow:C(0xf2b632),
 trunk:C(0x9b7c5b),leaf:C(0x86a862),leaf2:C(0x9cb86c),palm:C(0x6c9a57),palm2:C(0x7fae63),tyre:C(0x2b2c2f),glassD:C(0x2f3840),mark:C(0xf6f1e6),
 silver:C(0xc9ccce),char:C(0x44474d),sand:C(0xd9c9a8),black:C(0x26272a),kerbR:C(0xc8281e),tarmac:C(0x56555a),pitT:C(0x6c6a6b),pavem:C(0xb9b3a8),
 conc:C(0xa9a399),armco:C(0xc6cacd),skin:C(0xe0b08a),hull:C(0xfbf8f2),navy:C(0x1b2540),lawn:C(0x7fa35c),city:C(0xc9c2b5),road:C(0x77757a),
 runoff:C(0x9fd3e6),runoffW:C(0xf2f5f6),pool:C(0x58c4de),red:C(0xd0202e)};
const std=o=>new THREE.MeshStandardMaterial(Object.assign({roughness:.9,metalness:0},o));
const M={
 clay:std({vertexColors:true,flatShading:true}),          /* default for Batch geometry */
 smooth:std({vertexColors:true,roughness:.72}),
 paint:std({vertexColors:true,roughness:.42,metalness:.15}), /* car bodywork */
 glass:std({color:C(0x9fc6d6),roughness:.22,metalness:.1,emissive:C(0xffc27a),emissiveIntensity:0}),
 lamp:std({color:C(0xfff3d6),emissive:C(0xffe2a8),emissiveIntensity:.15}),
 mark:std({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}), /* flat paint on the ground */
 foliage:std({vertexColors:true,flatShading:true,roughness:1})
};

/* ---------- batch builder: many transformed primitives merged into one mesh with vertex colours ---------- */
function M4(x,y,z,rx,ry,rz,sx,sy,sz){return new THREE.Matrix4().compose(new V3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0,'YXZ')),new V3(sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz));}
const GEO={box:new THREE.BoxGeometry(1,1,1),sph:new THREE.SphereGeometry(1,16,10),ico:new THREE.IcosahedronGeometry(1,0),cyl:{}};
const cylG=n=>GEO.cyl[n]||(GEO.cyl[n]=new THREE.CylinderGeometry(1,1,1,n));
const NI=new Map(),_n3=new THREE.Matrix3();
const ni=g=>{let r=NI.get(g);if(!r){r=g.index?g.toNonIndexed():g;NI.set(g,r);}return r;};
class Batch{
 constructor(){this.P=[];this.N=[];this.C=[];}
 addM(geo,c,m){const g=ni(geo),p=g.attributes.position.array,n=g.attributes.normal.array,e=m.elements,k=_n3.getNormalMatrix(m).elements,P_=this.P,N_=this.N,C_=this.C;
  for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2];P_.push(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);
   const a=n[i],b=n[i+1],d=n[i+2];const nx=k[0]*a+k[3]*b+k[6]*d,ny=k[1]*a+k[4]*b+k[7]*d,nz=k[2]*a+k[5]*b+k[8]*d,l=Math.hypot(nx,ny,nz)||1;N_.push(nx/l,ny/l,nz/l);C_.push(c.r,c.g,c.b);}
  return this;}
 /* box sitting on y (bottom) */
 box(w,h,d,x,y,z,c,ry){return this.addM(GEO.box,c,M4(x,y+h/2,z,0,ry||0,0,w,h,d));}
 /* vertical cylinder sitting on y */
 cyl(r,h,x,y,z,c,n){return this.addM(cylG(n||10),c,M4(x,y+h/2,z,0,0,0,r,h,r));}
 /* cylinder along Z / X, centred */
 cylZ(r,l,x,y,z,c,n){return this.addM(cylG(n||12),c,M4(x,y,z,PI/2,0,0,r,l,r));}
 cylX(r,l,x,y,z,c,n){return this.addM(cylG(n||12),c,M4(x,y,z,0,0,PI/2,r,l,r));}
 geom(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.N,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.C,3));return g;}
 mesh(mat,cast,recv){const m=new THREE.Mesh(this.geom(),mat);m.castShadow=cast!==false;m.receiveShadow=recv!==false;return m;}
}
/* textured batch: position, normal, colour, uv */
class TB{constructor(){this.P=[];this.N=[];this.C=[];this.U=[];}
 v(x,y,z,nx,ny,nz,c,u,w){this.P.push(x,y,z);this.N.push(nx,ny,nz);this.C.push(c.r,c.g,c.b);this.U.push(u,w);}
 geom(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.N,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.C,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.U,2));return g;}}

/* ---------- text as a texture (plain text only: no logos) ---------- */
function textTex(txt,o){o=o||{};const H=o.h||128,W=o.w||512,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');if(o.bg){g.fillStyle=o.bg;g.fillRect(0,0,W,H);}
 let fs=H*(o.fs||.62);const f=s=>`800 ${s}px Inter,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif`;g.font=f(fs);const mw=g.measureText(txt).width;if(mw>W*.92){fs*=W*.92/mw;g.font=f(fs);}
 g.fillStyle=o.color||'#2b2926';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,W/2,H/2+fs*.06);const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
/* upright text panel; o.bg = background colour (opaque panel) */
function sign(txt,W,H,x,y,z,ry,o){o=o||{};const tex=textTex(txt,Object.assign({w:Math.min(2048,Math.round(128*W/H)),h:128},o));const m=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({map:tex,transparent:!o.bg}));m.position.set(x,y,z);m.rotation.y=ry||0;(o.parent||world).add(m);return m;}
/* text painted flat on the ground, reading along heading ry */
function decal(txt,W,H,x,z,ry,o){o=o||{};const tex=textTex(txt,Object.assign({w:Math.min(1024,Math.round(128*W/H)),h:128},o));const m=new THREE.Mesh(new THREE.PlaneGeometry(W,H),std({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));m.rotation.order='YXZ';m.rotation.set(-PI/2,ry||0,0);m.position.set(x,(o.y||0)+.06,z);m.receiveShadow=true;(o.parent||world).add(m);return m;}

/* ---------- glow points (lamps, lights) ----------
   Camera FOV is 30 degrees: a PointsMaterial size must be about 3.7 times the intended world size. */
const dotTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(cv);})();
/* static set from a flat array [x,y,z,r,g,b, ...]; fade it with .material.opacity */
function glowPoints(arr,size,parent){const n=arr.length/6,p=new Float32Array(n*3),c=new Float32Array(n*3);for(let i=0;i<n;i++){for(let j=0;j<3;j++){p[i*3+j]=arr[i*6+j];c[i*3+j]=arr[i*6+3+j];}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));
 const m=new THREE.Points(g,new THREE.PointsMaterial({size,map:dotTex,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true,fog:false}));m.frustumCulled=false;(parent||world).add(m);return m;}
/* dynamic set, refilled every frame: add(x,y,z,colour,strength) ... then flush() */
class GlowSet{constructor(max,size){this.max=max;this.n=0;this.p=new Float32Array(max*3);this.c=new Float32Array(max*3);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.p,3));g.setAttribute('color',new THREE.BufferAttribute(this.c,3));this.g=g;
  this.m=new THREE.Points(g,new THREE.PointsMaterial({size,map:dotTex,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true,fog:false}));this.m.frustumCulled=false;scene.add(this.m);}
 add(x,y,z,c,k){if(this.n>=this.max||k<=0.01)return;const i=this.n*3;this.p[i]=x;this.p[i+1]=y;this.p[i+2]=z;this.c[i]=c.r*k;this.c[i+1]=c.g*k;this.c[i+2]=c.b*k;this.n++;}
 flush(){this.g.setDrawRange(0,this.n);this.g.attributes.position.needsUpdate=true;this.g.attributes.color.needsUpdate=true;this.n=0;}}
