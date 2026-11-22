
/* ================= FLOOD MAP: where the night lighting falls =================
   Red = floodlights (track, run-offs, pit lane, paddock, grandstands); green = warm street lighting (roads, car parks, quays, around buildings).
   A canvas over the whole built-up part of the island, blurred, looked up by world x,z in every patched material and in the water shader. */
{const X0=-1300,X1=1300,Z0=-2150,Z1=1800,S=.3,Wc=Math.round((X1-X0)*S),Hc=Math.round((Z1-Z0)*S),cv=document.createElement('canvas');cv.width=Wc;cv.height=Hc;const g=cv.getContext('2d');
 g.fillStyle='#000';g.fillRect(0,0,Wc,Hc);g.globalCompositeOperation='lighter';g.lineJoin='round';g.lineCap='round';
 const path=(pts,close)=>{g.beginPath();for(let i=0;i<pts.length;i++){const x=(pts[i][0]-X0)*S,z=(pts[i][1]-Z0)*S;if(i)g.lineTo(x,z);else g.moveTo(x,z);}if(close)g.closePath();};
 const R=v=>'rgb('+Math.round(v*255)+',0,0)',G=v=>'rgb(0,'+Math.round(v*255)+',0)';
 const strokes=(col,list)=>{for(const w of list){g.lineWidth=w[0]*S;g.strokeStyle=col(w[1]);g.stroke();}};
 const vis=p=>p[0]>X0-60&&p[0]<X1+60&&p[1]>Z0-60&&p[1]<Z1+60;
 /* floodlights */
 const cl=[],le=[],ri=[];for(let i=0;i<TN;i++){cl.push([TX[i],TZ[i]]);le.push(tp(i,HW+WL[i]+6));ri.push(tp(i,-(HW+WR[i]+6)));}
 path(cl,true);strokes(R,[[150,.03],[120,.05],[96,.07],[76,.1],[58,.16],[42,.24]]);
 g.beginPath();[le,ri].forEach(l=>{l.forEach((p,i)=>{const x=(p[0]-X0)*S,z=(p[1]-Z0)*S;if(i)g.lineTo(x,z);else g.moveTo(x,z);});g.closePath();});g.fillStyle=R(.5);g.fill('evenodd');
 {const pl=[];for(let q=0;q<=PLEN;q+=4)pl.push(pq(q,0));path(pl,false);strokes(R,[[80,.2],[46,.35],[26,.4]]);
  const pad=[];for(let q=170;q<=630;q+=10)pad.push(pq(q,-8));for(let q=630;q>=170;q-=10)pad.push(pq(q,-74));path(pad,true);g.fillStyle=R(.6);g.fill();}
 for(const s of CITY.grandstands){const p=ringPts(s.r);path(p,true);g.fillStyle=R(.75);g.fill();strokes(R,[[22,.2]]);}
 /* warm street lighting */
 for(const rd of CITY.roads){const p=flatPts(rd[2]);if(!p.some(vis))continue;path(p,false);strokes(G,rd[0]>=1?[[34,.12],[16,.3]]:[[14,.2]]);}
 for(const s of CITY.parking){const p=ringPts(s.r);if(!p.some(vis))continue;path(p,true);g.fillStyle=G(.3);g.fill();}
 for(const b of CITY.buildings){const p=ringPts(b.r);if(b.a<120||!p.some(vis))continue;path(p,true);g.fillStyle=G(.16);g.fill();strokes(G,[[22,.12]]);}
 for(const pr of CITY.piers){const p=flatPts(pr.p);if(!p.some(vis))continue;path(p,!!pr.c);if(pr.c){g.fillStyle=G(.4);g.fill();}strokes(G,[[12,.2]]);}
 {const ch=LAND.open[0].filter(p=>p[0]>-300&&p[0]<680&&p[1]>-100&&p[1]<1300);path(ch,false);strokes(G,[[30,.16],[14,.22]]);}
 /* blur both channels (two box passes) so nothing shows an edge on the ground */
 const im=g.getImageData(0,0,Wc,Hc),d=im.data,tmp=new Float32Array(Math.max(Wc,Hc)),r=2,k=1/(2*r+1);
 for(let ch=0;ch<2;ch++)for(let pass=0;pass<2;pass++){
  for(let y=0;y<Hc;y++){let s=0;const o=y*Wc*4+ch;for(let x=-r;x<Wc;x++){if(x+r<Wc)s+=d[o+(x+r)*4];if(x-r-1>=0)s-=d[o+(x-r-1)*4];if(x>=0)tmp[x]=s*k;}for(let x=0;x<Wc;x++)d[o+x*4]=tmp[x];}
  for(let x=0;x<Wc;x++){let s=0;const o=x*4+ch;for(let y=-r;y<Hc;y++){if(y+r<Hc)s+=d[o+(y+r)*Wc*4];if(y-r-1>=0)s-=d[o+(y-r-1)*Wc*4];if(y>=0)tmp[y]=s*k;}for(let y=0;y<Hc;y++)d[o+y*Wc*4]=tmp[y];}}
 for(let x=0;x<Wc;x++)for(const y of [0,1,Hc-2,Hc-1]){d[(y*Wc+x)*4]=0;d[(y*Wc+x)*4+1]=0;}for(let y=0;y<Hc;y++)for(const x of [0,1,Wc-2,Wc-1]){d[(y*Wc+x)*4]=0;d[(y*Wc+x)*4+1]=0;}
 g.putImageData(im,0,0);
 const tex=new THREE.CanvasTexture(cv);tex.flipY=false;tex.generateMipmaps=false;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
 FU.uFloodMap.value=tex;FU.uFloodO.value.set(X0,Z0);FU.uFloodS.value.set(1/(X1-X0),1/(Z1-Z0));STAT.flood=[Wc,Hc];}

/* ================= FLUSH THE SHARED BATCHES ================= */
flush(RD,MAT.road,false,true);flush(AP,MAT.apron,false,true,7);flush(PL,MAT.pit,false,true,7);flush(PT,MAT.paint,false,true);flush(MK,MAT.mark,false,true);
if(SG.P.length){const m=new THREE.Mesh(SG.geom(),MAT.sign);m.receiveShadow=true;world.add(m);}
flush(B,MAT.clay,true,true);flush(BS,MAT.smooth,true,true);flush(RF,MAT.roof,true,true);flush(CAN,MAT.clay,true,true);
flush(GL,MAT.glass,false,true);flush(LP,MAT.lamp,false,false);flush(IN,MAT.inter,false,false);
if(BW.P.length){const m=new THREE.Mesh(BW.geom(),MAT.bw);m.castShadow=true;m.receiveShadow=true;world.add(m);CASTERS.push(m);}
if(FN.P.length){const m=new THREE.Mesh(FN.geom(),MAT.fence);m.renderOrder=2;world.add(m);}
/* lamp glows: gS warm street and boat lights, gW white lights, gB floodlight heads. A lamp never shrinks below a few pixels,
   so street lighting, quays and yachts still read from the widest view. */
const gS=glowS.length?glowPoints(glowS,13):null,gW=glowW.length?glowPoints(glowW,11):null,gB=glowB.length?glowPoints(glowB,42):null;
function minPx(o,px){if(!o)return;o.material.onBeforeCompile=sh=>{sh.uniforms.uMinPx={value:px*renderer.getPixelRatio()};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uMinPx;').replace('#include <fog_vertex>','gl_PointSize=max(gl_PointSize,uMinPx);\n#include <fog_vertex>');};o.material.needsUpdate=true;}
minPx(gS,3.4);minPx(gW,3);minPx(gB,4.4);
STAT.buildMs=Math.round(performance.now()-T_BUILD);STAT.glows=[glowS.length/6,glowW.length/6,glowB.length/6];
STAT.tris={B:B.P.length/9,BS:BS.P.length/9,RD:RD.P.length/9,AP:AP.P.length/9,PT:PT.P.length/9,MK:MK.P.length/9,BW:BW.P.length/9,FN:FN.P.length/9,RF:RF.P.length/9,CAN:CAN.P.length/9};
/* see-through structures: name, meshes, test volumes, triangles */
STAT.see=SEE.map(e=>e.name+': '+e.meshes.length+' mesh, '+(e.hit?'own test':e.vols.length+' vol')+', '+e.meshes.reduce((a,m)=>a+(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3,0)+' tri');
/* the glass of the hotel bridge has its own material; it follows MAT.glass, which ENV drives (called by ENV every frame, after it has set the others) */
const envTick=()=>{if(typeof hotelGlass!=='undefined'&&hotelGlass)hotelGlass.emissiveIntensity=MAT.glass.emissiveIntensity;};

return {
 setStartLights:typeof setStartLights==='function'?setStartLights:()=>{},
 startLights:typeof startLights==='function'?startLights:()=>-1,
 groundY:()=>0,
 /* obstacles for cameras: floodlight masts as [x, z, height]; round trees and palms as [x, z, crown radius, height] */
 masts:typeof MASTS==='undefined'?[]:MASTS,trees:typeof TREES==='undefined'?[]:TREES,palms:typeof PALMS==='undefined'?[]:PALMS,
 stat:STAT,
 /* for the cameras: structures that can be faded when they stand between the camera and a car (see SEE in the base piece):
    [{name, meshes, box:[x0,y0,z0,x1,y1,z1], vols:[Float32Array of planes nx,ny,nz,d], hit(ax,ay,az,bx,by,bz) or null, set(opacity), opacity}] */
 seeThrough:SEE,
 /* for ENV (same owner): materials to drive, glow sets, uniforms, the list of static shadow casters; tick = WORLD's own per-frame part */
 env:{FU,MAT,waterU,CASTERS,gS,gW,gB,canopyU:typeof canopyU==='undefined'?null:canopyU,red:typeof redMat==='undefined'?null:redMat,redC:Q.red.clone(),tick:envTick},
 /* for checks: corridor widths and helpers */
 dbg:{WL,WR,wallL,wallR,PLL,PLR,PQL,PQR,TR,LAND,isLand,BARR}
};
})();
