
/* ================= BRIDGES OVER THE TRACK, MARINA PONTOONS, YACHTS ================= */
/* bridges that are mapped as an outline: a deck with clearance where it crosses the circuit, ramps (or stairs) down at both ends */
CITY.bridges.forEach(br=>{const pts=br.c?ringPts(br.p):flatPts(br.p);if(pts.length<2)return;
 if(!br.c){let near=false;for(const p of pts){nearT(p[0],p[1]);if(nD<30)near=true;}if(near||pts.length<2)return;
  /* small footbridges between the quays: a low deck */
  ribbonPL(B,pts,1.8,.18,Q.deck);return;}
 let over=false;const bb=bboxP(pts);for(let i=0;i<TN;i+=2)if(inBox(TX[i],TZ[i],bb)&&inPts(TX[i],TZ[i],pts)){over=true;break;}
 if(!over){extrude(B,pts,-.3,.4,Q.conc,Q.road);return;}
 let e1=pts[0],e2=pts[1],md=0;for(const a of pts)for(const b of pts){const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d>md){md=d;e1=a;e2=b;}}
 const wd=Math.abs(area2(pts))/2/md,road=wd>8.5,H=road?7.2:6.4,ux=(e2[0]-e1[0])/md,uz=(e2[1]-e1[1])/md,px=-uz,pz=ux,hw=Math.max(2,wd/2),RL=road?46:15;
 /* a bridge over the track is a see-through structure (see SEE in the base piece): its own batch BR, mesh and material.
    v = what the cameras test: the deck with its parapets, every pier (widened: they are thin), and both ramps as wedges */
 const BR=new Batch(),v=[volPrism(pts,H-.9,H+1.2)],hd=Math.atan2(ux,uz),pier=(r,x,z)=>{BR.cyl(r,H-.8,x,-.1,z,Q.conc,8);v.push(volPrism(rectPts(x,z,0,.4,.4),-.1,H-.8,.5));};
 extrude(BR,pts,H-.8,H,Q.concD,road?Q.road:Q.deck);polyDown(BR,pts,H-.8,Q.concD);const cc=centP(pts);
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],hx=(a[0]+b[0])/2-cc[0],hz=(a[1]+b[1])/2-cc[1];bq(BR,[a[0],H,a[1]],[b[0],H,b[1]],[b[0],H+1.1,b[1]],[a[0],H+1.1,a[1]],Q.wall,hx,0,hz);bq(BR,[a[0],H,a[1]],[b[0],H,b[1]],[b[0],H+1.1,b[1]],[a[0],H+1.1,a[1]],Q.wall,-hx,0,-hz);}
 /* piers under the span wherever they are clear of the track corridor */
 for(let d=8;d<md-6;d+=13){const cx=e1[0]+ux*d,cz=e1[1]+uz*d;nearT(cx,cz);const w=nI<0?0:HW+(nL>0?WL[nI]:WR[nI])+2.5;if(nI>=0&&nD<w+hw)continue;for(const sd of (road?[1,-1]:[0]))pier(road?.5:.32,cx+px*hw*.7*sd,cz+pz*hw*.7*sd);}
 for(const en of [[e1,-1],[e2,1]]){const e=en[0],s=en[1],cx=e[0]-ux*s*2,cz=e[1]-uz*s*2,fx=cx+ux*s*RL,fz=cz+uz*s*RL;
  quad(BR,[cx+px*hw,H,cz+pz*hw],[cx-px*hw,H,cz-pz*hw],[fx-px*hw,-.05,fz-pz*hw],[fx+px*hw,-.05,fz+pz*hw],road?Q.road:Q.conc);
  for(const sd of [1,-1])bq(BR,[cx+px*hw*sd,-.1,cz+pz*hw*sd],[fx+px*hw*sd,-.1,fz+pz*hw*sd],[fx+px*hw*sd,-.05,fz+pz*hw*sd],[cx+px*hw*sd,H,cz+pz*hw*sd],Q.conc,px*sd,0,pz*sd);
  /* the ramp: its box, cut by the plane of the sloping deck (inside = below the deck) */
  {const wx=ux*s*H/RL,wz=uz*s*H/RL;v.push(volPrism(rectPts((cx+fx)/2,(cz+fz)/2,hd,RL/2,hw),-.1,H+.1,.2,[wx,1,wz,H+.15+wx*cx+wz*cz]));}
  for(const sd of [1,-1]){nearT(cx+px*hw*sd,cz+pz*hw*sd);if(nD>HW+9)pier(.5,cx+px*hw*sd*.8,cz+pz*hw*sd*.8);}}
 seeAdd(road?'Road bridge':'Footbridge',[flush(BR,seeMat(),true,true)],v);});

/* pontoons and piers */
const PIERS=[];
CITY.piers.forEach(pr=>{if(!pr.c){ribbonPL(B,flatPts(pr.p),1.2,-.78,Q.deck);return;}const pts=ringPts(pr.p);if(pts.length<3)return;const fl=pts.length>100,y=pr.k==='breakwater'?.3:fl?-.8:-.3;
 extrude(B,pts,Y.sea,y,Q.concD,pr.k==='breakwater'?Q.conc:Q.deck);PIERS.push({pts,bb:bboxP(pts),y,fl,sg:area2(pts)>0?1:-1});});
const onPier=(x,z)=>{for(const p of PIERS)if(inBox(x,z,p.bb)&&inPts(x,z,p.pts))return true;return false;};
const isWater=(x,z)=>!isLand(x,z)&&!onPier(x,z);

/* yachts: three sizes, instanced; moored stern-to along the pontoon edges where there is free water */
{const hull=(b,L,w,h)=>{b.box(w,h,L*.82,0,0,-L*.09,P.hull);b.addM(GEO.box,P.hull,M4(0,h/2,L*.32,0,PI/4,0,w*.7,h,w*.7));b.box(w+.05,h*.2,L*.8,0,h*.55,-L*.09,P.navy);b.box(w*.92,.08,L*.78,0,h,-L*.09,Q.wood);};
 const g1=new Batch();hull(g1,9,2.9,1);g1.box(1.9,.8,3,0,1.05,-1.2,P.white);g1.cyl(.07,10,0,1.05,.8,P.steel,5);g1.box(.08,.08,4,0,2.5,-1.4,P.steel);
 const g2=new Batch();hull(g2,17,4.6,1.7);g2.box(3.9,1.5,8.5,0,1.75,-2.2,P.white);g2.box(3.95,.6,7.5,0,2.25,-2.2,P.glassD);g2.box(3.1,1.2,4.6,0,3.25,-2.8,P.white);g2.box(3.15,.5,4,0,3.55,-2.8,P.glassD);g2.cyl(.06,2.4,0,4.45,-3,P.steel,5);
 const g3=new Batch();hull(g3,38,7.6,2.6);g3.box(6.6,2.2,22,0,2.65,-5,P.white);g3.box(6.65,.8,20,0,3.45,-5,P.glassD);g3.box(5.6,2,15,0,4.85,-6.5,P.white);g3.box(5.65,.7,13.5,0,5.45,-6.5,P.glassD);g3.box(4.2,1.6,8,0,6.85,-7.5,P.white);g3.cyl(.1,4,0,8.45,-8,P.steel,5);g3.box(3,.3,1,0,9.85,-8,P.white);
 const L=[9,17,38],Wd=[3.6,5.6,9],placed=[[],[],[]],all=[];
 const tryBoat=(x,z,nx,nz,type)=>{const l=L[type],cx=x+nx*(l/2+1.3),cz=z+nz*(l/2+1.3);for(const k of [.04,.5,1.04]){if(!isWater(x+nx*(l*k+1.4),z+nz*(l*k+1.4)))return false;}
  for(const sd of [-1,1])if(!isWater(cx-nz*sd*Wd[type]*.5,cz+nx*sd*Wd[type]*.5))return false;
  for(const o of all){if(Math.hypot(o[0]-cx,o[1]-cz)<(o[2]+l)*.5+.8&&Math.abs((o[0]-cx)*nz-(o[1]-cz)*nx)<(Wd[type]+o[3])*.5+.7)return false;}
  all.push([cx,cz,l,Wd[type]]);placed[type].push([cx,cz,Math.atan2(nx,nz)]);return true;};
 const along=(a,b,ox,oz,types)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<7)return;const ux=(b[0]-a[0])/l,uz=(b[1]-a[1])/l;let d=2.4;while(d<l-1.5&&all.length<340){const type=types[Math.floor(rnd()*types.length)];if(rnd()<.84&&tryBoat(a[0]+ux*d,a[1]+uz*d,ox,oz,type))d+=Wd[type]+1.1;else d+=2.6;}};
 PIERS.forEach(p=>{const n=p.pts.length;for(let i=0;i<n;i++){const a=p.pts[i],b=p.pts[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<7)continue;along(a,b,dz/l*p.sg,-dx/l*p.sg,p.fl?(l>26?[0,1,1]:[0,0,1]):l>70?[2,1]:[1,0]);}});
 [g1,g2,g3].forEach((g,t)=>{const list=placed[t];if(!list.length)return;const geo=g.geom(),im=new THREE.InstancedMesh(geo,MAT.boat,list.length);let cx=0,cz=0;
  list.forEach((p,i)=>{im.setMatrixAt(i,M4(p[0],Y.sea-.05,p[1],0,p[2],0));cx+=p[0];cz+=p[1];
   glow(p[0],Y.sea+(t===0?2.2:t===1?3.4:5.6),p[1],cWarm,0);if(t===0)glow(p[0]+Math.sin(p[2])*.8,Y.sea+11,p[1]+Math.cos(p[2])*.8,cWht,1);if(t===2){glow(p[0]+Math.sin(p[2])*9,Y.sea+3.6,p[1]+Math.cos(p[2])*9,cWarm,0);glow(p[0]-Math.sin(p[2])*12,Y.sea+4.2,p[1]-Math.cos(p[2])*12,cWarm,0);}});
  cx/=list.length;cz/=list.length;let r=0;for(const p of list)r=Math.max(r,Math.hypot(p[0]-cx,p[1]-cz));geo.boundingSphere=new THREE.Sphere(new V3(cx,2,cz),r+25);
  im.castShadow=true;im.receiveShadow=true;world.add(im);CASTERS.push(im);});
 STAT.boats=placed.map(p=>p.length);}
