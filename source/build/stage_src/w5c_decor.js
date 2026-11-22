
/* ================= TREES AND PALMS (instanced), FLOODLIGHT MASTS, LAMPS ================= */
MAT.foliage.side=THREE.DoubleSide;
const padQ0=BLD0-45,padQ1=BLD1+25;
/* a spot on land that is clear of the track corridor, the pit complex, buildings and grandstands */
function freeSpot(x,z,r){if(!isLand(x,z)||inTrench(x,z))return false;nearT(x,z);if(nI>=0){const w=HW+(nL>0?WL[nI]:WR[nI])+2.5+r;if(Math.abs(nL)<w&&nD<w+3)return false;}
 nearP(x,z);if(pI>=0){const q=pI*PDS;if(pD<12+r)return false;if(q>padQ0&&q<padQ1&&pL<0&&pL>-82)return false;}
 for(const b of BLD)if(inBox(x,z,b.bb,r+1.5)&&inPts(x,z,b.pts))return false;for(const s of STANDS)if(inBox(x,z,s.bb,r+3)&&inPts(x,z,s.pts))return false;return true;}
/* instanced set split into four quadrants, each with its own bounding sphere so it can be culled */
function instQuads(geo,mat,list,mk,cast){const Qd=[[],[],[],[]];for(const t of list)Qd[(t[0]<-40?0:1)+(t[1]<120?0:2)].push(t);
 for(const l of Qd){if(!l.length)continue;const g=geo.clone(),im=new THREE.InstancedMesh(g,mat,l.length);let cx=0,cz=0;l.forEach((t,i)=>{im.setMatrixAt(i,mk(t));cx+=t[0];cz+=t[1];});cx/=l.length;cz/=l.length;let r=0;for(const t of l)r=Math.max(r,Math.hypot(t[0]-cx,t[1]-cz));
  g.boundingSphere=new THREE.Sphere(new V3(cx,8,cz),r+36);im.castShadow=!!cast;im.receiveShadow=true;world.add(im);if(cast)CASTERS.push(im);}}
const TREES=[],PALMS=[];   /* exported: [x, z, crown radius, height] */
{const trees=[],palms=[];
 for(const g of CITY.green){if(g.k==='pitch')continue;const p=ringPts(g.r);if(p.length<3)continue;const bb=bboxP(p),golf=g.k==='golf',n=golf?430:Math.min(10,Math.round(g.a/520));let k=0,tries=0;
  while(k<n&&tries++<n*9){const x=rr(bb[0],bb[1]),z=rr(bb[2],bb[3]);if(!inPts(x,z,p)||!freeSpot(x,z,2))continue;(golf||rnd()<.42?trees:palms).push([x,z,rr(.8,1.35)]);k++;}}
 for(const p of ROADPALM)if(palms.length<1700&&rnd()<.8&&freeSpot(p[0],p[1],1.5))palms.push([p[0],p[1],rr(.9,1.3)]);
 {const ch=LAND.open[0];let acc=0;for(let i=1;i<ch.length;i++){const a=ch[i-1],b=ch[i];if(!(a[0]>-260&&a[0]<620&&a[1]>20&&a[1]<1300))continue;const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;acc+=l;
   while(acc>21){acc-=21;const u=1-acc/l,x=a[0]+dx*clamp(u,0,1)+dz/l*5.5,z=a[1]+dz*clamp(u,0,1)-dx/l*5.5;if(freeSpot(x,z,1.5))palms.push([x,z,rr(.9,1.2)]);}}}
 const tb=new Batch();tb.box(.5,3,.5,0,0,0,P.trunk);tb.addM(GEO.ico,P.leaf,M4(0,4.9,0,.4,.7,0,2.9,2.6,2.9));tb.addM(GEO.ico,P.leaf2,M4(1.1,6.2,-.5,.2,1.9,0,1.9,1.7,1.9));
 const pb=new Batch();pb.box(.34,8.6,.34,0,0,0,P.trunk);
 for(let k=0;k<7;k++){const a=k/7*TAU,cx=Math.sin(a),cz=Math.cos(a),wx=cz,wz=-cx,c=k&1?P.palm:P.palm2,P0=[0,8.6,0],M=[cx*2.3,9.35,cz*2.3],T=[cx*4.5,7.9,cz*4.5],
   v=(p,w)=>[p[0]+wx*w,p[1],p[2]+wz*w],put=(A,B2,C2)=>{pb.P.push(A[0],A[1],A[2],B2[0],B2[1],B2[2],C2[0],C2[1],C2[2]);pb.N.push(0,1,0,0,1,0,0,1,0);pb.C.push(c.r,c.g,c.b,c.r,c.g,c.b,c.r,c.g,c.b);};
  put(v(P0,-.15),v(P0,.15),v(M,.62));put(v(P0,-.15),v(M,.62),v(M,-.62));put(v(M,-.62),v(M,.62),v(T,.1));put(v(M,-.62),v(T,.1),v(T,-.1));}
 /* round trees close to the track stand in front of trackside cameras: none within 30 m of the barrier (palms stay: thin trunk, high crown).
    Filtered after the placement, so the random sequence, and with it everything placed later, is unchanged. */
 const keep=trees.filter(t=>{nearT(t[0],t[1]);return nI<0||nD>HW+(nL>0?WL[nI]:WR[nI])+30;});
 instQuads(tb.geom(),MAT.foliage,keep,t=>M4(t[0],Y.land,t[1],0,(t[0]*7.3+t[1]*3.1)%TAU,0,t[2],t[2],t[2]),true);
 instQuads(pb.geom(),MAT.foliage,palms,t=>M4(t[0],Y.land,t[1],0,(t[0]*5.7+t[1]*2.3)%TAU,0,t[2],t[2],t[2]),true);
 for(const t of keep)TREES.push([t[0],t[1],4.2*t[2],8.2*t[2]]);for(const t of palms)PALMS.push([t[0],t[1],4.6*t[2],9.6*t[2]]);
 STAT.trees=[keep.length,palms.length,trees.length-keep.length];}

/* floodlight masts all round the circuit, alternating sides, and a row behind the pit building.
   Positions depend only on geometry (no random numbers); exported as WORLD.masts for the camera placement of the show part. */
const MASTS=[];
{const list=[],MH=31;
 for(let n=0;n*55<K.TLEN-20;n++){const i=sIdx(n*55+12);for(const sd of (n&1?[1,-1]:[-1,1])){const W=sd>0?WL[i]:WR[i],p=tp(i,sd*(HW+W+4.4));if(!freeSpot(p[0],p[1],1.2))continue;list.push([p[0],p[1],Math.atan2(-NX[i]*sd,-NZ[i]*sd)]);break;}}
 for(let q=BLD0+20;q<BLD1;q+=58){const p=pq(q,GL0-BLDD-3.5),n=pNrm(q);list.push([p[0],p[1],Math.atan2(n[0],n[1])]);}
 const mb=new Batch();mb.box(.5,MH,.5,0,0,0,Q.steel);mb.addM(GEO.box,Q.dark,M4(0,MH+.7,.45,-.5,0,0,4.8,1.7,.3));mb.addM(GEO.box,C(0xfdfdf6),M4(0,MH+.64,.64,-.5,0,0,4.4,1.3,.08));
 instQuads(mb.geom(),MAT.clay,list,t=>M4(t[0],0,t[1],0,t[2],0),true);
 for(const t of list){glow(t[0]+Math.sin(t[2])*.8,MH+.5,t[1]+Math.cos(t[2])*.8,cCool,2);MASTS.push([t[0],t[1],MH+1.6]);}STAT.masts=list.length;}

/* street lamps (posts near the circuit, a glow everywhere), quay lamps, lights under the grandstand roofs */
{const posts=[];for(const p of ROADLAMP){if(!isLand(p[0],p[1]))continue;const close=p[0]>-900&&p[0]<900&&p[1]>-1250&&p[1]<1400;if(close&&!freeSpot(p[0],p[1],.4))continue;glow(p[0],9.3,p[1],cWarm,0);if(close)posts.push([p[0],p[1],0]);}
 for(const p of ROADLAMP0)if(freeSpot(p[0],p[1],.4))glow(p[0],7.2,p[1],cDim,0);
 const ch=LAND.open[0];let acc=0;for(let i=1;i<ch.length;i++){const a=ch[i-1],b=ch[i];if(!(a[0]>-260&&a[0]<620&&a[1]>20&&a[1]<1300))continue;const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;acc+=l;
  while(acc>27){acc-=27;const u=clamp(1-acc/l,0,1),x=a[0]+dx*u+dz/l*2.6,z=a[1]+dz*u-dx/l*2.6;if(freeSpot(x,z,.3)){glow(x,4.6,z,cWarm,0);posts.push([x,z,1]);}}}
 const lb=new Batch();lb.box(.16,1,.16,0,0,0,Q.dark);lb.box(.5,.03,.5,0,1,0,C(0xfff6dc));
 instQuads(lb.geom(),MAT.clay,posts,t=>M4(t[0],0,t[1],0,0,0,1,t[2]?4.5:9.2,1),false);
 for(const s of STANDS){if(!s.n)continue;for(let k=1;k<s.S.length;k+=3){const c=s.S[k];glow(c.ix+c.dx*c.d*.46,s.yT+6.4,c.iz+c.dz*c.d*.46,cWht,1);}}
 STAT.lamps=posts.length;}
