/* ================= boot_min.js : smallest possible loop and test hook =================
   Owner: coordinator. For smoke tests of the shared foundation with the stubs. Copy it as a starting point for your own test boot.
   The Browser pane is usually hidden, which pauses requestAnimationFrame: drive the page with __min.step() and step once right before a screenshot. */
{
 let rt=-8,playing=true,speed=1,last=performance.now();
 fitView();window.addEventListener('resize',fitView);
 const frame=dt=>{if(playing)rt=Math.min(rt+dt*speed,K.TEND);ACT.tick(rt,dt,false);CAM.tick(rt,dt,false);ENV.tick(rt,dt,CAM.focus());renderer.render(scene,camera);};
 const loop=()=>{const n=performance.now(),dt=Math.min(.1,(n-last)/1000);last=n;frame(dt);requestAnimationFrame(loop);};
 requestAnimationFrame(loop);
 window.__min={K,
  seek(t){rt=t;return rt;},
  step(n,dt){for(let i=0;i<(n||1);i++)frame(dt||1/30);return rt;},
  play(){playing=true;},pause(){playing=false;},setSpeed(x){speed=x;},
  select(code){CAM.select(code);},flyTo(k){CAM.flyTo(k);},daylight(on){ENV.setDaylight(on);},
  state(){const o=K.order(rt);return {rt:+rt.toFixed(2),clock:K.clockTxt(rt),lap:K.leaderLap(rt),status:K.status(rt).txt,lead:o[0]&&o[0].c.code,night:+ENV.night.toFixed(2),calls:renderer.info.render.calls,tris:renderer.info.render.triangles};}
 };
}
