/* ================= stub_show.js : stand-in for p3_actors.js + p5_cam.js =================
   Owner: coordinator. Same interface as the real ACT and CAM, minimal looks:
   every car is a coloured box placed from the kernel; one orbiting overview camera that can follow the selected car.
   Use it in test pages until the real parts exist. Never ship it. */
const ACT=(()=>{
 const list=K.ALL.map(c=>{const m=new THREE.Mesh(new THREE.BoxGeometry(1.9,1,5.4),std({color:c===K.SC?C(0xd0202e):C(c.team.ui)}));m.castShadow=true;scene.add(m);return {c,obj:m,st:{}};});
 function tick(rt){for(const a of list){const s=K.carState(a.c,rt,a.st);a.obj.visible=!!s.vis;if(s.vis){a.obj.position.set(s.x,(s.y||0)+.5,s.z);a.obj.rotation.y=s.h;}}}
 return {tick,cars:list.filter(a=>a.c!==K.SC),sc:list.find(a=>a.c===K.SC),stub:true};
})();
const CAM=(()=>{
 const AREAS={start:{label:'Start/finish',s:0},t5:{label:'Turn 5',s:K.cornerS(5)},chicane:{label:'Chicane',s:K.cornerS(6)},marsa:{label:'Turn 9',s:K.cornerS(9)},hotel:{label:'Hotel',s:K.cornerS(13)}};
 const st={mode:'map',sel:null,AREAS,MODES:['map','chase','tv','director'],stub:true},subs=[],o={};
 let tx=-60,tz=60,dist=2700,yaw=.5,pitch=.95,gx=tx,gz=tz,gd=dist;
 function tick(rt,dt){if(st.sel){const s=K.carState(st.sel,rt,o);if(s.vis){gx=s.x;gz=s.z;gd=st.mode==='map'?260:70;}}
  const k=1-Math.exp(-(dt||.016)*4);tx+=(gx-tx)*k;tz+=(gz-tz)*k;dist+=(gd-dist)*k;
  camera.position.set(tx+dist*Math.sin(yaw)*Math.cos(pitch),dist*Math.sin(pitch),tz+dist*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(tx,0,tz);}
 function select(code){st.sel=code?(K.carBy[code]||null):null;if(!st.sel){gd=2700;gx=-60;gz=60;}subs.forEach(f=>f(st.sel));}
 function flyTo(k){const a=AREAS[k];if(!a)return;st.sel=null;subs.forEach(f=>f(null));K.trackPos(a.s,0,o);gx=o.x;gz=o.z;gd=420;}
 return Object.assign(st,{tick,select,flyTo,focus:()=>({x:tx,y:0,z:tz,dist}),set(m){if(st.MODES.indexOf(m)>=0)st.mode=m;},home(){select(null);},onSelect(f){subs.push(f);}});
})();
