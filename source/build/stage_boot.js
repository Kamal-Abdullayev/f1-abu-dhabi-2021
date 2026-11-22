/* ================= stage_boot.js : test loop and hook for the stage =================
   Owner: stage. Not part of the final page. The Browser pane is usually hidden, so drive everything through window.__stage:
   seek(t), step(n, dt), look(x, z, dist, yaw, pitch), eye(px,py,pz, tx,ty,tz, fov), at(s, lat, h, ds, tlat, th, fov), daylight(on), lights(n), state(). */
{
 let rt=-8,playing=false,speed=1,last=performance.now();
 const cam={mode:'orbit',x:-60,z:60,dist:2700,yaw:.5,pitch:.95,p:new V3(),t:new V3(),fov:30},foc={x:0,y:0,z:0,dist:100},o={};
 fitView();window.addEventListener('resize',fitView);
 function place(){if(camera.fov!==cam.fov){camera.fov=cam.fov;camera.updateProjectionMatrix();}
  if(cam.mode==='orbit'){camera.position.set(cam.x+cam.dist*Math.sin(cam.yaw)*Math.cos(cam.pitch),cam.dist*Math.sin(cam.pitch),cam.z+cam.dist*Math.cos(cam.yaw)*Math.cos(cam.pitch));camera.lookAt(cam.x,0,cam.z);foc.x=cam.x;foc.y=0;foc.z=cam.z;foc.dist=cam.dist;}
  else{camera.position.copy(cam.p);camera.lookAt(cam.t);foc.x=cam.t.x;foc.y=cam.t.y;foc.z=cam.t.z;foc.dist=cam.p.distanceTo(cam.t);}}
 const frame=dt=>{if(playing)rt=Math.min(rt+dt*speed,K.TEND);ACT.tick(rt,dt,false);place();ENV.tick(rt,dt,foc);renderer.render(scene,camera);};
 const loop=()=>{const n=performance.now(),dt=Math.min(.1,(n-last)/1000);last=n;frame(dt);requestAnimationFrame(loop);};
 requestAnimationFrame(loop);
 window.__stage={K,WORLD,ENV,THREE,scene,renderer,camera,
  seek(t){rt=t;return rt;},
  step(n,dt){for(let i=0;i<(n||1);i++)frame(dt===undefined?1/30:dt);return +rt.toFixed(2);},
  play(){playing=true;},pause(){playing=false;},setSpeed(x){speed=x;},
  look(x,z,dist,yaw,pitch){cam.mode='orbit';cam.fov=30;cam.x=x;cam.z=z;cam.dist=dist;if(yaw!==undefined)cam.yaw=yaw;if(pitch!==undefined)cam.pitch=pitch;return this.step(1,0);},
  eye(px,py,pz,tx,ty,tz,fov){cam.mode='free';cam.p.set(px,py,pz);cam.t.set(tx,ty,tz);cam.fov=fov||30;return this.step(1,0);},
  /* camera relative to the track: at distance s, lateral lat, height h, looking at s + ds, lateral tlat, height th */
  at(s,lat,h,ds,tlat,th,fov){K.trackPos(s,lat,o);const px=o.x,pz=o.z;K.trackPos(s+(ds===undefined?40:ds),tlat||0,o);return this.eye(px,h,pz,o.x,th||0,o.z,fov);},
  /* the same relative to the pit path */
  atPit(q,lat,h,dq,tlat,th,fov){K.pitPos(q,lat,o);const px=o.x,pz=o.z,py=o.y;K.pitPos(q+(dq===undefined?30:dq),tlat||0,o);return this.eye(px,py+h,pz,o.x,o.y+(th||0),o.z,fov);},
  daylight(on){ENV.setDaylight(on,true);return this.step(1,0);},lights(n){WORLD.setStartLights(n);return this.step(1,0);},
  select(code){CAM.select(code);},
  state(){const i=renderer.info;return {rt:+rt.toFixed(2),clock:K.clockTxt(rt),hour:+ENV.hour.toFixed(3),night:+ENV.night.toFixed(2),daylight:ENV.daylight,calls:i.render.calls,tris:i.render.triangles,geoms:i.memory.geometries,tex:i.memory.textures,progs:i.programs?i.programs.length:0,stat:WORLD.stat||null};}
 };
}
