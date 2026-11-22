/* ================= stub_stage.js : stand-in for p2_world.js + p4_env.js =================
   Owner: coordinator. Same interface as the real stage, minimal looks:
   flat ground, track and pit-lane ribbons, pit wall line, light that goes from late afternoon to night with the race clock.
   Use it in test pages until the real WORLD and ENV parts exist. Never ship it. */
const WORLD=(()=>{
 const gnd=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),std({color:C(0xd9cfb8),roughness:1}));gnd.rotation.x=-PI/2;gnd.position.y=-.06;gnd.receiveShadow=true;world.add(gnd);
 function ribbon(n,X,Z,NXa,NZa,hw,yf,col,closed){const p=[],ix=[];for(let i=0;i<n;i++){const y=yf?yf(i):0;p.push(X[i]+NXa[i]*hw,y,Z[i]+NZa[i]*hw,X[i]-NXa[i]*hw,y,Z[i]-NZa[i]*hw);}
  const m=closed?n:n-1;for(let i=0;i<m;i++){const a=i*2,b=((i+1)%n)*2;ix.push(a,a+1,b,b,a+1,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();
  const me=new THREE.Mesh(g,std({color:col,roughness:.95,side:THREE.DoubleSide}));me.receiveShadow=true;world.add(me);return me;}
 ribbon(K.TN,K.TX,K.TZ,K.NX,K.NZ,K.HW,()=>.02,C(0x4c4b50),true);
 ribbon(K.PN+1,K.PX,K.PZ,K.PNX,K.PNZ,4.6,i=>K.pitY(i*K.PDS)+.03,C(0x66646a),false);
 /* finish line and pit wall, so tests can see where things are */
 {const b=new Batch(),o={};
  for(let l=-K.HW;l<K.HW;l+=1){K.trackPos(0,l+.5,o);b.box(1,.04,1.2,o.x,.03,o.z,P.mark,K.TH[0]);}
  for(let q=PIT.wallQ0;q<PIT.wallQ1;q+=4){K.pitPos(q,PIT.wallLat,o);b.box(.5,PIT.wallTop,4,o.x,0,o.z,P.conc,K.PH[Math.min(K.PN,Math.round(q/K.PDS))]);}
  K.TEAMS.forEach(t=>{K.pitPos(t.boxQ,PIT.garageLat-PIT.garageDepth/2,o);b.box(PIT.garageDepth,PIT.garageH,PIT.garageW-1,o.x,0,o.z,C(t.ui),K.PH[Math.round(t.boxQ/K.PDS)]+PI/2);});
  world.add(b.mesh(M.clay));}
 let lit=-1;
 return {setStartLights(n){lit=n;},startLights:()=>lit,groundY:()=>0,stub:true};
})();
const ENV=(()=>{
 const st={night:0,hour:17.06,daylight:false,stub:true};
 const day=new THREE.Color(0xdfe6ee),dusk=new THREE.Color(0xd9a27a),dark=new THREE.Color(0x0a0e18),tmp=new THREE.Color();
 function tick(rt,dt,f){const hour=st.daylight?14:17+3.4/60+rt/3600;st.hour=hour;const n=st.daylight?0:sstep(17.45,18.2,hour),g=st.daylight?0:sstep(16.2,17.6,hour)*(1-n);st.night=n;
  hemi.intensity=lerp(.8,.42,n);sun.intensity=lerp(1.25,.08,n);
  tmp.copy(day).lerp(dusk,g).lerp(dark,n);scene.background.copy(tmp);scene.fog.color.copy(tmp);
  const fx=f?f.x:0,fz=f?f.z:0,el=lerp(.9,.12,st.daylight?0:sstep(16,17.7,hour));
  sun.position.set(fx-900*Math.cos(el),1100*Math.sin(el)+60,fz+500*Math.cos(el));sun.target.position.set(fx,0,fz);sun.target.updateMatrixWorld();
  renderer.toneMappingExposure=lerp(1.1,1.0,n);}
 return Object.assign(st,{tick,setDaylight(on){st.daylight=!!on;}});
})();
