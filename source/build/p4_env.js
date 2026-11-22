/* ================= p4_env.js : ENV, light and atmosphere =================
   Owner: stage. Light follows the local clock 17:03:24 + rt: golden hour at the start, sunset 17:36, dusk, night from about 18:08.
   One directional light (p1's `sun`) is the sun by day and the floodlighting by night; a second one without shadows fills the
   other side at night. Static scenery is lit by the floodlights only where WORLD's flood map says so (uniforms in WORLD.env.FU)
   and gets a faint moonlight everywhere; cars and people from the other parts use unpatched materials and are always fully lit.
   tick() allocates nothing; the environment map is re-baked only when the sky has changed noticeably.
   ENV also owns the shadow box of `sun` (size, bias, position): it follows the focus and steps with the viewing distance. */
const ENV=(()=>{
 const E=WORLD.env||{},FU=E.FU||{},MATS=E.MAT||{};
 const st={night:0,hour:17.06,daylight:false};
 const H0=17+3/60+24/3600,HSET=17.6,HDAY=14.2,AZS=1.27;
 /* sun elevation in degrees for a local decimal hour (stylised: 52 at 14:12, 10 at the start, 0 at 17:36, then sinking) */
 const elev=h=>h<H0?10+14.7*(H0-h):h<HSET?10*(HSET-h)/(HSET-H0):-14*(h-HSET);
 const moonDir=new V3(.62,.72,.31).normalize();   /* a bright moon high in the east-south-east, as on the evening of the race */
 /* ---------- sky dome and stars (both follow the camera) ---------- */
 const skyU={uTop:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uSun:{value:new V3(0,1,0)},uSunC:{value:new THREE.Color(1,1,1)},uSunK:{value:1},uGlowC:{value:new THREE.Color()},uGlowK:{value:0},uMoonD:{value:moonDir.clone()},uMoonK:{value:0}};
 const skyMat=new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
  vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 uTop,uHor,uSun,uSunC,uGlowC,uMoonD;uniform float uSunK,uGlowK,uMoonK;varying vec3 vD;
void main(){vec3 d=normalize(vD);float h=clamp(d.y,0.,1.);vec3 c=mix(uHor,uTop,pow(h,.5));float s=max(dot(d,uSun),0.);c+=uSunC*(pow(s,1400.)*7.+pow(s,30.)*.3)*uSunK;
 float az=max(dot(normalize(d.xz+vec2(1e-5)),normalize(uSun.xz+vec2(1e-5))),0.);c+=uGlowC*uGlowK*pow(az,3.)*pow(1.-h,6.);
 float m=max(dot(d,uMoonD),0.);c+=vec3(.86,.9,1.)*(smoothstep(.99988,.99993,m)*1.25+pow(m,900.)*.22+pow(m,40.)*.035)*uMoonK;
 if(d.y<0.)c=mix(uHor,uHor*.55,clamp(-d.y*5.,0.,1.));gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <encodings_fragment>
}`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(9000,32,18),skyMat);sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
 const stars=(()=>{const n=700,p=new Float32Array(n*3);let s=1234567;const r=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<n;i++){const a=r()*TAU,y=.06+.94*r(),q=Math.sqrt(1-y*y);p[i*3]=Math.cos(a)*q*8600;p[i*3+1]=y*8600;p[i*3+2]=Math.sin(a)*q*8600;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({size:1.6,sizeAttenuation:false,color:0xdfe6ff,transparent:true,opacity:0,depthWrite:false,depthTest:false,fog:false}));m.frustumCulled=false;m.renderOrder=-9;m.visible=false;scene.add(m);return m;})();
 /* ---------- environment map: the sky, plus a ring of lamps at night so paint and glass pick up highlights ---------- */
 const skyScene=new THREE.Scene();skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(40,24,12),skyMat));
 const lampMat=new THREE.MeshBasicMaterial({color:0x000000,fog:false,toneMapped:false});
 {const g=new THREE.SphereGeometry(1.5,8,6);for(let k=0;k<10;k++){const a=k/10*TAU+.3,m=new THREE.Mesh(g,lampMat);m.position.set(Math.cos(a)*30,13+(k%3)*5,Math.sin(a)*30);skyScene.add(m);}}
 const pmrem=new THREE.PMREMGenerator(renderer);let envRT=null,envSig='',envWait=0;
 function bakeEnv(){const rt=pmrem.fromScene(skyScene,.04);if(envRT)envRT.dispose();envRT=rt;scene.environment=rt.texture;}
 /* ---------- lights ---------- */
 const fill=new THREE.DirectionalLight(0xffffff,0);fill.position.set(900,1100,-420);scene.add(fill);scene.add(fill.target);
 const cSunHi=C(0xfff2de),cSunLo=C(0xff8a44),cFlood=C(0xf3f6ff),cSkyD=C(0xffffff),cSkyG=C(0xffdcb8),cSkyN=C(0x56689c),cGndD=C(0xd6cbb6),cGndN=C(0x272c3c),
  cTopD=C(0x3b78c9),cTopG=C(0x4675b8),cTopN=C(0x070a15),cHorD=C(0xbfd8ee),cHorG=C(0xf6cda2),cHorK=C(0x6b6f8f),cHorN=C(0x151e34),cGlow=C(0xff9a52),cWarm=C(0xffdcb6),cMoon=C(0xa9bcff);
 const sunDir=new V3(),floodDir=new V3(),dir=new V3(),_c1=new THREE.Color(),_c2=new THREE.Color(),_c3=new THREE.Color(),_r=new V3(),_u=new V3(),_f=new V3(),UP=new V3(0,1,0);
 let dl=0,dlT=0,shHS=0,lastCast=-1;
 const HS=[[160,95],[330,190],[700,400],[1300,720],[2200,1100],[1e9,1500]];
 function tick(rt,dt,f){
  dt=dt||0;if(dl!==dlT){const k=1-Math.exp(-dt*6);dl+=(dlT-dl)*k;if(Math.abs(dlT-dl)<.004)dl=dlT;}
  const hReal=H0+rt/3600,h=hReal+(HDAY-hReal)*dl,el=elev(h);st.hour=h;
  const day=sstep(-7.5,2.5,el),night=1-day,low=1-sstep(2,30,el),sunVis=sstep(-1.5,3,el),floodOn=sstep(4,-4,el),lampOn=sstep(5,-3,el),gold=low*day;st.night=night;
  /* sun azimuth swings from south-west in the afternoon to west-south-west at sunset (AZS: about 9 degrees further west than the real
     244 degrees, so the low sun reaches half of the main straight past the pit building); the floodlight comes from the same side, steeply */
  const az=lerp(.6,AZS,sstep(HDAY,HSET,h)),er=el*PI/180,ce=Math.cos(er);sunDir.set(-Math.sin(az)*ce,Math.sin(er),Math.cos(az)*ce);
  floodDir.set(-Math.sin(AZS)*.42,.906,Math.cos(AZS)*.42);
  /* the low sun is strong and the sky weak, so sunlit and shaded parts differ clearly in the golden hour */
  const IS=sunVis*lerp(1.6,1.25,sstep(8,35,el)),IF=1.05*floodOn,IT=IS+IF,mixF=IT>1e-4?IF/IT:1;
  dir.copy(sunDir).multiplyScalar(IS).addScaledVector(floodDir,IF);if(dir.lengthSq()<1e-6)dir.copy(floodDir);dir.normalize();if(dir.y<.03){dir.y=.03;dir.normalize();}
  _c1.copy(cSunHi).lerp(cSunLo,low*.62);sun.color.copy(_c1).lerp(cFlood,mixF);sun.intensity=IT;
  fill.intensity=.5*floodOn;fill.color.copy(cFlood);
  /* shadow box follows the focus; its size steps with the viewing distance */
  const fx=f?f.x:0,fy=f?(f.y||0):0,fz=f?f.z:0,fd=f&&f.dist?f.dist:600;let hs=1500;for(let i=0;i<HS.length;i++)if(fd<HS[i][0]){hs=HS[i][1];break;}
  if(hs!==shHS){shHS=hs;const s=sun.shadow.camera;s.left=-hs;s.right=hs;s.top=hs;s.bottom=-hs;s.near=20;s.far=5200;s.updateProjectionMatrix();const tx=2*hs/sun.shadow.mapSize.x;sun.shadow.normalBias=clamp(tx*1.6,.05,.6);sun.shadow.bias=-(.03+tx*.6)/5180;}
  {const tx=2*shHS/sun.shadow.mapSize.x;_f.copy(dir);_r.crossVectors(UP,_f).normalize();_u.crossVectors(_f,_r);
   const a=Math.round((fx*_r.x+fy*_r.y+fz*_r.z)/tx)*tx,b=Math.round((fx*_u.x+fy*_u.y+fz*_u.z)/tx)*tx,c=fx*_f.x+fy*_f.y+fz*_f.z;
   const px=_r.x*a+_u.x*b+_f.x*c,py=_r.y*a+_u.y*b+_f.y*c,pz=_r.z*a+_u.z*b+_f.z*c;
   sun.target.position.set(px,py,pz);sun.position.set(px+dir.x*2600,py+dir.y*2600,pz+dir.z*2600);sun.target.updateMatrixWorld();
   fill.target.position.set(fx,fy,fz);fill.position.set(fx+900,fy+1100,fz-420);fill.target.updateMatrixWorld();}
  /* static scenery stops casting shadows once the floodlights have taken over (cars keep theirs) */
  const cast=mixF<.9?1:0;if(cast!==lastCast&&E.CASTERS){lastCast=cast;for(const m of E.CASTERS)m.castShadow=!!cast;}
  if(FU.uShK)FU.uShK.value=clamp(Math.abs(mixF-.9)/.04,0,1);   /* shadows on the scenery fade out before that switch and back in after it: no pop */
  /* hemisphere light, sky, fog, exposure */
  _c1.copy(cSkyD).lerp(cSkyG,gold*.8);hemi.color.copy(cSkyN).lerp(_c1,day);hemi.groundColor.copy(cGndN).lerp(cGndD,day);hemi.intensity=lerp(.5,lerp(.55,.64,gold),day);
  _c2.copy(cHorD).lerp(cHorG,gold*.85);_c3.copy(cHorN).lerp(cHorK,sstep(0,.55,day));
  _c1.copy(_c3).lerp(_c2,sstep(.45,1,day));                        /* horizon */
  _c2.copy(cTopD).lerp(cTopG,gold*.8);_c3.copy(cTopN).lerp(_c2,Math.pow(day,1.4)); /* zenith */
  scene.background.copy(_c1);scene.fog.color.copy(_c1);scene.fog.near=Math.max(5,fd*.6+900);scene.fog.far=fd+9000;
  skyU.uHor.value.copy(_c1);skyU.uTop.value.copy(_c3);skyU.uSun.value.copy(sunDir);skyU.uSunC.value.copy(cSunHi).lerp(cSunLo,low*.9);skyU.uSunK.value=sstep(-4,1,el)*(.35+.65*day);
  skyU.uGlowC.value.copy(cGlow);skyU.uGlowK.value=low*sstep(-9,0,el)*(.25+.75*(1-sstep(6,30,el)))*.9;skyU.uMoonK.value=sstep(.2,.9,night);
  sky.position.copy(camera.position);stars.position.copy(camera.position);stars.visible=night>.25;stars.material.opacity=sstep(.25,1,night)*.85;
  renderer.toneMappingExposure=lerp(1.02,lerp(1.05,1.12,gold),day);
  /* uniforms and materials of the static scenery */
  if(FU.uFloodMix){FU.uFloodMix.value=mixF;FU.uWarm.value.copy(cWarm).multiplyScalar(.46*lampOn);}
  if(FU.uMoon){FU.uMoon.value.copy(cMoon).multiplyScalar(.2*night);FU.uMoonV.value.copy(moonDir).transformDirection(camera.matrixWorldInverse);}
  if(MATS.bw){MATS.bw.emissiveIntensity=lampOn*1.5;MATS.glass.emissiveIntensity=lampOn*.7;MATS.lamp.emissiveIntensity=.15+lampOn*1.7;const k=lerp(.62,1,lampOn);MATS.inter.color.setRGB(k,k,k);}
  if(E.gS){E.gS.material.opacity=lampOn;E.gS.visible=lampOn>.02;}if(E.gW){E.gW.material.opacity=lampOn;E.gW.visible=lampOn>.02;}
  if(E.gB){const k=(.12+.88*floodOn)*(1-dl);E.gB.material.opacity=k;E.gB.visible=k>.02;}
  /* sea: sun by day, a faint moon path at night (never the floodlights) */
  if(E.waterU){const w=E.waterU;w.uT.value=rt;w.uSun.value.copy(dir).lerp(moonDir,mixF*night).normalize();w.uSunC.value.copy(sun.color).multiplyScalar(Math.min(1,IT)*.8*(1-mixF)).add(_c2.copy(cMoon).multiplyScalar(.55*night));
   w.uSky.value.copy(_c1);if(w.uAmb)w.uAmb.value.copy(_c3).lerp(_c1,.45).multiplyScalar(1.15);}
  if(E.canopyU){E.canopyU.uT.value=rt;E.canopyU.uGlow.value=lampOn;E.canopyU.uSun.value.copy(dir);E.canopyU.uSunC.value.copy(sun.color).multiplyScalar(IT*(1-mixF*.5));E.canopyU.uAmb.value.copy(hemi.color).multiplyScalar(hemi.intensity);}
  if(E.red&&E.redC){const k=lerp(1,.34,night);E.red.color.copy(E.redC).multiplyScalar(k);E.red.emissiveIntensity=lampOn*.02;}   /* the big red roof goes dark with the rest: a dull dark red */
  if(E.tick)E.tick(rt,dt,night,lampOn);
  /* environment map */
  lampMat.color.setRGB(3*floodOn,3*floodOn,3.2*floodOn);
  envWait-=dt;const sig=(day*40|0)+'|'+(gold*12|0)+'|'+(el>0?(el/3|0):-1)+'|'+(floodOn*8|0);if(sig!==envSig&&(envWait<=0||!envRT)){envSig=sig;envWait=.6;bakeEnv();}
 }
 return Object.assign(st,{tick,setDaylight(on,now){st.daylight=!!on;dlT=on?1:0;if(now)dl=dlT;},elev});
})();
