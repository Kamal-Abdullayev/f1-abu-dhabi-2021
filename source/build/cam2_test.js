/* ================= cam2_test.js : helpers for testing the cameras and the see-through structures =================
   TEST CODE ONLY, never part of the delivered page. Goes after p7_boot.js in a test build. Hook: window.__dbg
   It only exposes the parts to the console and adds a few read-only helpers. */
{
 const _v=new V3(),Y=()=>window.__yas;
 /* outline points of a car (x = its left, y, z = ahead): nose, front wing ends, wheels on the ground, airbox top, rear wing ends */
 const HULL=[0,.25,2.85,.98,.05,2.6,-.98,.05,2.6,1,0,2.1,-1,0,2.1,1,0,-2.2,-1,0,-2.2,0,1,-.5,.52,.96,-2.75,-.52,.96,-2.75];
 const proj=(x,y,z)=>{camera.updateMatrixWorld();_v.set(x,y,z).project(camera);return [Math.round((_v.x*.5+.5)*innerWidth),Math.round((-_v.y*.5+.5)*innerHeight),+_v.z.toFixed(4)];};
 /* the car's rectangle on screen, CSS pixels: [x0, y0, x1, y1], null when part of it is behind the camera */
 function carBox(code){const c=code==='SC'?K.SC:K.carBy[code],s=K.carState(c,Y().state().rt,{}),ch=Math.cos(s.h),sn=Math.sin(s.h);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(let i=0;i<HULL.length;i+=3){const p=proj(s.x+ch*HULL[i]+sn*HULL[i+2],(s.y||0)+HULL[i+1],s.z-sn*HULL[i]+ch*HULL[i+2]);if(p[2]>=1)return null;x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  return [x0,y0,x1,y1];}
 const rc=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return r.width>0&&r.height>0?[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]:null;};
 window.__dbg={WORLD,CAM,ACT,ENV,UI,K,CITY,TRACK,PIT,scene,world,camera,renderer,proj,carBox,rc,
  /* meshes in the static scenery: [type, name, triangles, material type, transparent, opacity, castShadow, visible] */
  meshes(){const out=[];world.traverse(o=>{if(!o.isMesh&&!o.isPoints)return;const g=o.geometry,m=Array.isArray(o.material)?o.material[0]:o.material,n=g.index?g.index.count/3:g.attributes.position.count/3;
   out.push([o.type,o.name||'',Math.round(n)*(o.isInstancedMesh?o.count:1),m.type,!!m.transparent,+(+m.opacity).toFixed(2),!!o.castShadow,o.visible]);});return out;},
  cam(){return {p:camera.position.toArray().map(v=>+v.toFixed(2)),fov:+camera.fov.toFixed(1),near:camera.near,far:camera.far};},
  info(){return {calls:renderer.info.render.calls,tris:renderer.info.render.triangles,geo:renderer.info.memory.geometries,tex:renderer.info.memory.textures,programs:renderer.info.programs?renderer.info.programs.length:0};},
  /* a chase view of a car at race time t: run = play one second up to t (moving camera), else settle at t. Returns the car's rectangle, the
     free rectangle of the window, whether the car is inside it, what is faded */
  fit(v,t,run,code){const y=Y();code=code||'VER';y.select(code);y.seek(t-(run?1:0));y.view(v);if(run)y.step(30,1/30);else{y.step(30,.05);y.seek(t);y.step(2,.001);}
   const s=y.state(),b=carBox(code),sf=UI.safe();return {view:s.view,rt:s.rt,box:b,size:b?[b[2]-b[0],b[3]-b[1]]:null,safe:[Math.round(sf.left),Math.round(sf.top),Math.round(sf.right),Math.round(sf.bottom)],
    inside:!!b&&b[0]>=sf.left&&b[2]<=sf.right&&b[1]>=sf.top&&b[3]<=sf.bottom,faded:s.faded,orbit:s.orbit,fov:+camera.fov.toFixed(1),camY:+camera.position.y.toFixed(2),calls:s.calls,tris:s.tris,errors:s.errors};},
  /* do the dashboard panels overlap each other: pairs of ids whose rectangles intersect */
  overlaps(ids){ids=ids||['top','kpis','ctl','detail','tablep','play','sheet','areas','result','about'];const R=ids.map(i=>[i,rc(i)]).filter(a=>a[1]),o=[];
   for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i][1],b=R[j][1];if(a[0]<b[2]-.5&&b[0]<a[2]-.5&&a[1]<b[3]-.5&&b[1]<a[3]-.5)o.push(R[i][0]+'/'+R[j][0]);}return {rects:R,overlaps:o};}};
}
