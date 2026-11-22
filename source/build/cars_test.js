/* ================= cars_test.js : TEST CODE ONLY for the car models (never part of the delivered page) =================
   Goes after p7_boot.js in a test build. Hook window.__cars:
     hideUI(on)                         hide every dashboard element, so only the 3D picture is left
     look([x,y,z],[x,y,z],fov,near)     free camera; look() switches it off
     lookCar(code,back,side,up,fov,ty,fwd)  free camera in the car's own frame (metres behind, to its left, above; aim height ty, aim shift fwd)
     lineup(on,gap,s,row)               ten cars, one per team, in two rows of five on the main straight (wheels placed here as p3 does)
     lookLine(back,side,up,fov,k)       free camera relative to car k of the line-up (0..4 first row, 5..9 second row; default 5)
     info()                             triangles per car mesh, wheel triangles, draw calls
   The free camera is applied inside renderer.render, so it holds whatever drives the frame (step, draw, the loop). */
{
 let dbg=null,line=null;
 const _o={},_m=new THREE.Matrix4(),_m2=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(0,0,0,'YXZ'),_p=new V3(),_s=new V3();
 const wheels=scene.children.find(o=>o.isInstancedMesh&&o.count===(ACT.cars.length+1)*4);
 const pickTen=()=>{const seen={},L=[];ACT.cars.forEach((a,i)=>{const k=a.c.team.code;if(seen[k])return;seen[k]=1;L.push({a,i});});return L;};
 function applyLine(){const L=pickTen(),n=L.length;ACT.cars.forEach(a=>{if(!L.some(q=>q.a===a))a.obj.visible=false;});
  L.forEach((q,k)=>{const a=q.a;if(line.file)K.trackPos(K.sw(line.s+k*line.file),line.lat,_o);else K.trackPos(K.sw(line.s+(k<5?0:line.row)),(k%5-2)*line.gap,_o);a.obj.visible=true;a.obj.position.set(_o.x,0,_o.z);a.obj.rotation.set(0,_o.h,0);a.obj.scale.setScalar(1);a.obj.updateMatrix();
   if(wheels)for(let w=0;w<4;w++){const p=a.wp[w],r=p[0]<0&&line.mirror;_e.set(0,r?PI:0,0);_q.setFromEuler(_e);_p.set(p[0],.34,p[1]);_s.set(p[2],1,1);_m.compose(_p,_q,_s);_m2.multiplyMatrices(a.obj.matrix,_m);wheels.setMatrixAt(q.i*4+w,_m2);}});
  if(wheels){ACT.cars.forEach((a,i)=>{if(!a.obj.visible)for(let w=0;w<4;w++){_m.makeScale(0,0,0);wheels.setMatrixAt(i*4+w,_m);}});wheels.instanceMatrix.needsUpdate=true;}}
 const rr0=renderer.render.bind(renderer);
 renderer.render=(s,c)=>{if(s===scene){if(line)applyLine();
   if(dbg){ACT.markers.visible=false;if(camera.view&&camera.view.enabled)camera.clearViewOffset();camera.position.set(dbg.p[0],dbg.p[1],dbg.p[2]);camera.fov=dbg.fov||30;camera.near=dbg.near||.2;camera.far=9000;camera.updateProjectionMatrix();camera.lookAt(dbg.t[0],dbg.t[1],dbg.t[2]);}}
  rr0(s,c);};
 const frame=(o,back,side,up,fov,ty,fwd)=>{const h=o.rotation.y,fx=Math.sin(h),fz=Math.cos(h),lx=Math.cos(h),lz=-Math.sin(h),p=o.position;fwd=fwd||0;
  dbg={p:[p.x-fx*back+lx*side,p.y+up,p.z-fz*back+lz*side],t:[p.x+fx*fwd,p.y+(ty==null?.45:ty),p.z+fz*fwd],fov:fov||30};};
 let st=null;
 window.__cars={K,ACT,CAM,ENV,scene,camera,renderer,
  hideUI(on){if(on===false){if(st){st.remove();st=null;}return false;}if(!st){st=document.createElement('style');st.textContent='body>*:not(canvas){display:none!important}';document.head.appendChild(st);}return true;},
  look(p,t,fov,near){dbg=p?{p,t,fov,near}:null;return !!dbg;},
  lookCar(code,back,side,up,fov,ty,fwd){const a=code==='SC'?ACT.sc:ACT.cars.find(q=>q.c.code===code);if(!a)return false;frame(a.obj,back,side,up,fov,ty,fwd);return true;},
  lineup(on,gap,s,row,file,lat){line=on===false?null:{gap:gap||2.7,s:s==null?60:s,row:row||9,file:file||0,lat:lat||0,mirror:true};return !!line;},
  lookLine(back,side,up,fov,k,ty,fwd){const L=pickTen();if(line)applyLine();const a=L[k==null?Math.floor(L.length/2):k].a;frame(a.obj,back,side,up,fov,ty,fwd);return a.c.code;},
  order(){return pickTen().map(q=>q.a.c.team.code+':'+q.a.c.code);},
  info(){const tri=g=>(g.index?g.index.count:g.attributes.position.count)/3,per=ACT.cars.map(a=>a.c.code+' '+tri(a.obj.geometry));
   return {car:per,wheel:wheels?tri(wheels.geometry):null,sc:tri(ACT.sc.obj.geometry),calls:renderer.info.render.calls,tris:renderer.info.render.triangles};},
  dbg(){return dbg;}};
}
