
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
