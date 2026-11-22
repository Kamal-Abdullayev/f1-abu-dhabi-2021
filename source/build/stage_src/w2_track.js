
/* ================= TRACK CORRIDOR: what lies beside the tarmac at every track sample =================
   WL / WR = paved width beyond the track edge on the left / right, up to the barrier. Base table below (from K.CORNERS, so it follows
   the kernel), widened by K.latExtent when the kernel provides it, narrowed by grandstands and water, and tied to the pit lane
   where the pit path runs alongside. */
const cs=n=>K.CORNERS[n-1];
const WL=new Float32Array(TN).fill(4.5),WR=new Float32Array(TN).fill(4.5),wallL=new Uint8Array(TN).fill(1),wallR=new Uint8Array(TN).fill(1),plainL=new Uint8Array(TN),plainR=new Uint8Array(TN),npL=new Uint8Array(TN),npR=new Uint8Array(TN);
/* pit path as seen from each track sample, per side: lateral and pit distance (NaN = not alongside) */
const PLL=new Float32Array(TN).fill(NaN),PLR=new Float32Array(TN).fill(NaN),PQL=new Float32Array(TN).fill(NaN),PQR=new Float32Array(TN).fill(NaN);
for(let i=0;i<TN;i++){const tx=Math.sin(TH[i]),tz=Math.cos(TH[i]),x=TX[i],z=TZ[i];
 for(let j=0;j<PN;j++){const dx0=K.PX[j]-x,dz0=K.PZ[j]-z;if(dx0>70||dx0<-70||dz0>70||dz0<-70)continue;const dx1=K.PX[j+1]-x,dz1=K.PZ[j+1]-z,a0=dx0*tx+dz0*tz,a1=dx1*tx+dz1*tz;if(a0*a1>0)continue;
  const t=a0===a1?0:a0/(a0-a1),lat=lerp(dx0*NX[i]+dz0*NZ[i],dx1*NX[i]+dz1*NZ[i],t),q=(j+t)*PDS;if(Math.abs(lat)>45)continue;
  if(lat<-.5){if(isNaN(PLR[i])||-lat<-PLR[i]){PLR[i]=lat;PQR[i]=q;}}else if(lat>.5){if(isNaN(PLL[i])||lat<PLL[i]){PLL[i]=lat;PQL[i]=q;}}}}
function bump(W,a,b,c,d,w){for(let n=Math.floor(a/DS);n<=Math.ceil(d/DS);n++){const s=n*DS,k=s<b?sstep(a,b,s):s>c?1-sstep(c,d,s):1,i=wi(n);if(w*k>W[i])W[i]=w*k;}}
function setZone(W,a,b,c,d,w){for(let n=Math.floor(a/DS);n<=Math.ceil(d/DS);n++){const s=n*DS,k=s<b?sstep(a,b,s):s>c?1-sstep(c,d,s):1,i=wi(n);W[i]=lerp(W[i],w,k);}}
function mark(F,a,b,v){for(let n=Math.floor(a/DS);n<=Math.ceil(b/DS);n++)F[wi(n)]=v;}
{const c1=cs(1),c2=cs(2),c5=cs(5),c6=cs(6),c7=cs(7),c8=cs(8),c9=cs(9),c11=cs(11),c12=cs(12),c13=cs(13),c14=cs(14),c15=cs(15),c16=cs(16);
 bump(WR,c2.sIn-50,c2.sIn,c2.sOut,c2.sOut+50,10);
 bump(WR,c5.sIn-60,c5.sIn+10,c5.sOut+10,c5.sOut+70,24);
 bump(WR,c6.sIn-70,c6.sIn-10,c6.s,c6.s+12,22);bump(WR,c6.s-4,c6.s+12,c7.s+6,c7.sOut+62,30);mark(plainR,c6.sIn-80,c7.sOut+80,1);
 bump(WL,c7.sIn-15,c7.s-5,c7.sOut,c7.sOut+40,12);
 bump(WR,c8.sIn-20,c8.sIn,c8.sOut,c8.sOut+30,7);
 bump(WR,c9.sIn-60,c9.sIn,c9.sOut+10,c9.sOut+90,18);
 bump(WL,c11.sIn-30,c11.sIn,c11.sOut,c11.sOut+40,9);
 bump(WL,c12.sIn-40,c12.sIn,c12.sOut,c12.sOut+40,14);
 bump(WR,c13.sIn-20,c13.sIn,c13.s+8,c13.sOut,9);
 bump(WL,c15.sIn-30,c15.sIn+10,c15.sOut+10,c15.sOut+50,10);
 bump(WL,c16.sIn-10,c16.sIn+20,c16.sOut+10,c16.sOut+50,11);
 setZone(WL,c16.sOut+60,c16.sOut+90,K.TLEN+c1.sIn-60,K.TLEN+c1.sIn-20,3.5);
 /* widen to what the cars really use, when the kernel says so. K.latExtent = {L, R, min, max, body}: Float32Array per track sample,
    L and R positive metres from the centre line, min and max signed (+ = left); with `body` the values are the car body (centre + 1 m) */
 const ext=(()=>{const e=K.latExtent;if(!e)return null;const L=new Float32Array(TN),R=new Float32Array(TN),bodyIn=typeof e.body==='number';try{
   if(typeof e==='function'){for(let i=0;i<TN;i++){const v=e(i*DS),mn=Array.isArray(v)?v[0]:v.min,mx=Array.isArray(v)?v[1]:v.max;L[i]=Math.max(0,mx||0);R[i]=Math.max(0,-(mn||0));}}
   else if(e.min&&e.max&&e.min.length>=TN){for(let i=0;i<TN;i++){L[i]=Math.max(0,e.max[i]||0);R[i]=Math.max(0,-(e.min[i]||0));}}
   else if(e.L&&e.R&&e.L.length>=TN){for(let i=0;i<TN;i++){L[i]=Math.max(0,e.L[i]||0);R[i]=Math.max(0,e.R[i]||0);}}
   else return null;
  }catch(err){return null;}return {L,R,touch:bodyIn?.08:1.05,gap:bodyIn?.7:1.7};})();
 STAT.latExtent=!!ext;
 if(ext)for(const [W,E] of [[WL,ext.L],[WR,ext.R]]){const d=new Float32Array(TN);for(let i=0;i<TN;i++){let m=0;for(let k=-5;k<=5;k++)m=Math.max(m,E[wi(i+k)]);d[i]=m>HW-.5?m-HW+ext.gap:0;}for(let i=0;i<TN;i++)if(d[i]>W[i])W[i]=d[i];}
 /* Turn 14 exit: the outside barrier is close and a car stops against it: the wall face sits at the outermost body edge */
 {const need=ext?Math.max(3.3,...Array.from({length:70},(_,k)=>ext.R[sIdx(c14.sOut-30+k*2)]-HW+ext.touch)):3.35;STAT.t14=+need.toFixed(2);setZone(WR,c13.sOut-6,c13.sOut+14,c14.sOut+100,c14.sOut+140,Math.min(need,6.5));}
}
/* obstacles along the normal: grandstands and the marina quay limit the run-off */
{const seg=[];CITY.grandstands.forEach(g=>{const p=ringPts(g.r);for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];seg.push(a[0],a[1],b[0],b[1],3.5);}});
 const ch=LAND.open[0];for(let i=0;i+1<ch.length;i++){const a=ch[i],b=ch[i+1];if(a[0]>-320&&a[0]<700&&a[1]>-150&&a[1]<1350)seg.push(a[0],a[1],b[0],b[1],5.5);}
 for(let i=0;i<TN;i++)for(const sd of [1,-1]){const ox=TX[i],oz=TZ[i],dx=NX[i]*sd,dz=NZ[i]*sd;let best=1e9;
  for(let k=0;k<seg.length;k+=5){const ax=seg[k]-ox,az=seg[k+1]-oz,ex=seg[k+2]-seg[k],ez=seg[k+3]-seg[k+1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-9)continue;const t=(ax*ez-az*ex)/den,u=(ax*dz-az*dx)/den;if(t>HW&&t<75&&u>=0&&u<=1){const lim=t-HW-seg[k+4];if(lim<best)best=lim;}}
  if(best<1e8){const W=sd>0?WL:WR;if(W[i]>best)W[i]=Math.max(1.2,best);}}}
/* inside of tight corners: the paved strip cannot be wider than the radius allows */
for(let i=0;i<TN;i++){let k=0;for(let d=-3;d<=3;d++){const v=TK[wi(i+d)];if(Math.abs(v)>Math.abs(k))k=v;}if(Math.abs(k)<.012)continue;const lim=Math.max(1.5,1/Math.abs(k)-HW-3);if(k>0){if(!plainL[i]&&WL[i]>lim)WL[i]=lim;}else if(!plainR[i]&&WR[i]>lim)WR[i]=lim;}
/* pit lane alongside: verge up to the pit wall or trench parapet; no track barrier where the pit complex builds its own */
const QW0=PIT.wallQ0,QW1=PIT.wallQ1;
for(let i=0;i<TN;i++){const s=i*DS;
 if(!isNaN(PLR[i])&&(s>K.S_IN-6||s<400)){const q=PQR[i],l=-PLR[i];npR[i]=q<=TR.c0+2?1:0;
  if(q<QW0){WR[i]=Math.max(lerp(WR[i],4.5,sstep(0,30,q)),l+5.3-HW);}   /* the track barrier follows the outside of the pit entry road */
  else if(q<=TR.c0+2){WR[i]=Math.max(.8,l-(q<TR.q0?5.55:TR.inL(q)+TR.wall+.5)-HW);wallR[i]=0;}}
 if(!isNaN(PLL[i])&&s>250&&s<K.S_OUT+60){const q=PQL[i],l=PLL[i];npL[i]=1;
  if(q>=TR.c1-8&&q<=TR.q1+2){WL[i]=Math.max(.8,Math.min(WL[i],l-(TR.inR(q)+TR.wall+.5)-HW));wallL[i]=0;}
  else if(q>TR.q1)WL[i]=Math.max(4.5,l+5.3-HW);}}
{const c1=cs(1);bump(WR,c1.s+2,c1.s+6,c1.sOut-4,c1.sOut+36,9.5);}
STAT.wMax=[Math.max(...WL).toFixed(1),Math.max(...WR).toFixed(1)];

/* ================= TRACK SURFACE ================= */
{const TS=new Batch(),NSTR=6,t=Q.tarmac,P_=TS.P,N_=TS.N,C_=TS.C;
 const put=(i,lat)=>{const d=lat-K.TRL[i],e=Math.exp(-d*d/2.4),br=K.TV[wi(i+8)]<K.TV[i]-1.5?.1:0,k=1-.2*e-br*e;P_.push(TX[i]+NX[i]*lat,Y.track,TZ[i]+NZ[i]*lat);N_.push(0,1,0);C_.push(t.r*k,t.g*k,t.b*k);};
 for(let i=0;i<TN;i++){const j=wi(i+1);for(let k=0;k<NSTR;k++){const l0=HW-k*2*HW/NSTR,l1=HW-(k+1)*2*HW/NSTR;put(i,l0);put(i,l1);put(j,l0);put(i,l1);put(j,l1);put(j,l0);}}
 flush(TS,MAT.track,false,true,7);}
/* strip between two lateral offsets over one sample step, into a flat batch */
function strip(b,i,a0,b0,a1,b1,y,c){const j=wi(i+1);if(Math.abs(a0-b0)<.01&&Math.abs(a1-b1)<.01)return;const p0=tp(i,a0),p1=tp(i,b0),p2=tp(j,b1),p3=tp(j,a1);quad(b,[p0[0],y,p0[1]],[p1[0],y,p1[1]],[p2[0],y,p2[1]],[p3[0],y,p3[1]],c);}
/* verges (plain tarmac, apron layer) and painted run-offs (pale blue with white bands) */
{const BND=[1.5,3,5.5,7,9.5,10.5],BCOL=[Q.white,Q.blue,Q.blueD,Q.blue,Q.white,Q.blue];
 for(const sd of [1,-1]){const W=sd>0?WL:WR,plain=sd>0?plainL:plainR,np=sd>0?npL:npR,lim=new Float32Array(TN);
  /* no bands near a tight inside on this side: folded strips must all have one colour */
  for(let i=0;i<TN;i++){let m=1e9;for(let d=-25;d<=25;d+=5){const k=TK[wi(i+d)];if(k*sd>.02)m=Math.min(m,1/Math.abs(k)-HW-1);}lim[i]=plain[i]?0:m;}
  for(let i=0;i<TN;i++){const j=wi(i+1),w0=W[i],w1=W[j];strip(AP,i,sd*(HW-.6),sd*(HW+w0+.7),sd*(HW-.6),sd*(HW+w1+.7),Y.apron,Q.apron);
   if((w0<6.5&&w1<6.5)||np[i]||np[j])continue;const bands=lim[i]>=12&&lim[j]>=12;
   if(!bands){strip(PT,i,sd*(HW+Math.min(1.5,w0)),sd*(HW+w0),sd*(HW+Math.min(1.5,w1)),sd*(HW+w1),Y.paint,Q.blue);continue;}
   for(let k=0;k<BND.length;k++){const a=BND[k],e=k+1<BND.length?BND[k+1]:1e9;strip(PT,i,sd*(HW+Math.min(a,w0)),sd*(HW+Math.min(e,w0)),sd*(HW+Math.min(a,w1)),sd*(HW+Math.min(e,w1)),Y.paint,BCOL[k]);}}}}
/* edge lines and kerbs (paint layer on top of the tarmac) */
const mergeR=i=>{const s=i*DS;return s>K.S_IN-8&&s<K.S_IN+96;},mergeL=i=>{const s=i*DS;return s>K.S_OUT-118&&s<K.S_OUT+12;};
{const kIn=i=>Math.abs(TK[i])>.011,kOut=i=>Math.abs(TKW[i])>.0075&&Math.abs(TK[i])<.03,kf=[new Uint8Array(TN),new Uint8Array(TN)];
 for(let i=0;i<TN;i++){if(TK[i]>0?kIn(i):kOut(i))for(let d=-2;d<=2;d++)kf[0][wi(i+d)]=1;if(TK[i]<0?kIn(i):kOut(i))for(let d=-2;d<=2;d++)kf[1][wi(i+d)]=1;}
 for(let i=0;i<TN;i++){const mR=mergeR(i),mL=mergeL(i);
  if(!mL||(i&3)<2)strip(MK,i,HW-.15,HW-.33,HW-.15,HW-.33,Y.mark,Q.white);
  if(!mR||(i&3)<2)strip(MK,i,-HW+.33,-HW+.15,-HW+.33,-HW+.15,Y.mark,Q.white);
  if(kf[0][i]&&!mL)strip(MK,i,HW+1.5,HW-.05,HW+1.5,HW-.05,Y.mark,i&1?Q.kerbR:Q.white);
  if(kf[1][i]&&!mR)strip(MK,i,-HW+.05,-HW-1.5,-HW+.05,-HW-1.5,Y.mark,i&1?Q.white:Q.kerbR);}}
/* painted rectangle on the tarmac: centre s, lateral lat, size across x along */
function mkRect(s,lat,across,along,c,y){K.trackPos(s,lat,o1);const h=o1.h,tx=Math.sin(h),tz=Math.cos(h),nx=tz,nz=-tx,x=o1.x,z=o1.z,a=across/2,l=along/2,yy=y||Y.mark;
 quad(MK,[x+nx*a-tx*l,yy,z+nz*a-tz*l],[x-nx*a-tx*l,yy,z-nz*a-tz*l],[x-nx*a+tx*l,yy,z-nz*a+tz*l],[x+nx*a+tx*l,yy,z+nz*a+tz*l],c);}
/* finish line and the twenty grid slots (slot k is 8 + 8 (k - 1) m behind the line; odd on the left) */
mkRect(0,0,2*HW-.7,.7,Q.white,Y.mark+.004);
for(let k=1;k<=20;k++){const s=-(8+8*(k-1)),lat=k&1?2.7:-2.7;mkRect(s+3.1,lat,2.7,.24,Q.white);mkRect(s+2.0,lat+1.35,.2,2.4,Q.white);mkRect(s+2.0,lat-1.35,.2,2.4,Q.white);}

/* ================= BARRIERS AND CATCH FENCE ================= */
/* wall along a line of points [x, z, outX, outZ] (track-side face, outward unit normal); null breaks the line */
function wallLine(pts,h,th,col,fenceTop,col2){let pv=null,u=0,n=0;for(const p of pts){if(!p){pv=null;continue;}if(pv){const a=pv,b=p,c=(n++&1)&&col2?col2:col,y0=-.12;
   const ao=[a[0]+a[2]*th,a[1]+a[3]*th],bo=[b[0]+b[2]*th,b[1]+b[3]*th];
   bq(B,[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],h,b[1]],[a[0],h,a[1]],c,-a[2],0,-a[3]);bq(B,[ao[0],y0,ao[1]],[bo[0],y0,bo[1]],[bo[0],h,bo[1]],[ao[0],h,ao[1]],c,a[2],0,a[3]);
   quad(B,[a[0],h,a[1]],[b[0],h,b[1]],[bo[0],h,bo[1]],[ao[0],h,ao[1]],c);
   if(fenceTop){const ax=a[0]+a[2]*th*.5,az=a[1]+a[3]*th*.5,bx=b[0]+b[2]*th*.5,bz=b[1]+b[3]*th*.5,l=Math.hypot(bx-ax,bz-az),u1=u+l/1.7,v1=(fenceTop-h)/1.7,w=Q.white,nx=-a[2],nz=-a[3];
    FN.v(ax,h,az,nx,0,nz,w,u,0);FN.v(bx,h,bz,nx,0,nz,w,u1,0);FN.v(bx,fenceTop,bz,nx,0,nz,w,u1,v1);FN.v(ax,h,az,nx,0,nz,w,u,0);FN.v(bx,fenceTop,bz,nx,0,nz,w,u1,v1);FN.v(ax,fenceTop,az,nx,0,nz,w,u,v1);u=u1%1;}}
  pv=p;}}
const BARR=[[],[]];   /* barrier lines kept for later (masts, boards, crowd fences) */
for(const sd of [1,-1]){const W=sd>0?WL:WR,wf=sd>0?wallL:wallR,pts=[];let lastOk=null,gapByFold=false;
 for(let n=0;n<=TN;n+=2){const i=wi(n),lat=sd*(HW+W[i]),p=tp(i,lat);let ok=!!wf[i];
  if(ok){nearT(p[0],p[1]);const wj=sd>0?WL[nI]:WR[nI];if(nI>=0&&nL*sd>0&&nL*sd<HW+wj-.9&&Math.abs(nI-i)>3&&Math.abs(nI-i)<TN-3){ok=false;gapByFold=true;}}else gapByFold=false;
  if(!ok){if(!gapByFold&&lastOk){pts.push(null);lastOk=null;}continue;}
  const q=[p[0],p[1],NX[i]*sd,NZ[i]*sd,i];if(!lastOk&&pts.length&&pts[pts.length-1])pts.push(null);pts.push(q);lastOk=q;gapByFold=false;}
 BARR[sd>0?0:1]=pts;wallLine(pts,1.0,.5,Q.wall,3.5,Q.wallW);}

/* ================= DISTANCE AND DRS BOARDS (plain text) ================= */
/* one text atlas for every sign in the scene: ten rows with the team names (garage fascias), then the board cells */
const ATL=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=1024;const g=cv.getContext('2d'),F=s=>'800 '+s+'px Inter,system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
 g.fillStyle='#f4f4f1';g.fillRect(0,0,1024,1024);g.fillStyle='#16171a';g.textAlign='center';g.textBaseline='middle';
 K.TEAMS.forEach((t,k)=>{let fs=54;g.font=F(fs);const w=g.measureText(t.name).width;if(w>960){fs*=960/w;g.font=F(fs);}g.fillText(t.name,512,k*80+43);});
 const TXT=['200','150','100','50','DRS','80'];g.font=F(84);TXT.forEach((t,k)=>{const x=(k%4)*256,y=800+Math.floor(k/4)*112;g.strokeStyle='#16171a';g.lineWidth=8;g.strokeRect(x+6,y+6,244,100);if(t)g.fillText(t,x+128,y+60);});
 const tex=new THREE.CanvasTexture(cv);tex.encoding=THREE.sRGBEncoding;tex.anisotropy=aniso;MAT.sign=patch(std({map:tex,vertexColors:true,roughness:.7}));
 return {team:k=>[0,1,1-(k+1)*80/1024,1-k*80/1024],cell:k=>[(k%4)/4,(k%4+1)/4,1-(800+(Math.floor(k/4)+1)*112)/1024,1-(800+Math.floor(k/4)*112)/1024]};})();
/* upright text panel into SG: centre (x, y, z), half width, half height, facing unit normal (nx, nz), atlas rectangle uv; reads left to right for someone facing it */
function panel(x,y,z,hw,hh,nx,nz,uv){const ax=nz,az=-nx,A=[x-ax*hw,z-az*hw],Bp=[x+ax*hw,z+az*hw],w=Q.white,y0=y-hh,y1=y+hh;
 SG.v(A[0],y0,A[1],nx,0,nz,w,uv[0],uv[2]);SG.v(Bp[0],y0,Bp[1],nx,0,nz,w,uv[1],uv[2]);SG.v(Bp[0],y1,Bp[1],nx,0,nz,w,uv[1],uv[3]);SG.v(A[0],y0,A[1],nx,0,nz,w,uv[0],uv[2]);SG.v(Bp[0],y1,Bp[1],nx,0,nz,w,uv[1],uv[3]);SG.v(A[0],y1,A[1],nx,0,nz,w,uv[0],uv[3]);}
{const board=(s,sd,k)=>{const i=sIdx(s),W=sd>0?WL[i]:WR[i],lat=sd*(HW+Math.max(1.4,W-.9)),p=tp(i,lat),h=TH[i],tx=Math.sin(h),tz=Math.cos(h);
  B.box(.14,1.6,.14,p[0],-.1,p[1],Q.dark,h);B.box(2.6,1.35,.06,p[0]+tx*.02,1.45,p[1]+tz*.02,Q.dark,h);
  panel(p[0]-tx*.04,2.12,p[1]-tz*.04,1.25,.62,-tx,-tz,ATL.cell(k));};   /* faces the oncoming cars */
 /* braking-distance boards on the outside of the corner; for Turn 1 on the grandstand side, because the outside there is the strip
    along the pit wall (kept free, and a "50" there reads like a pit speed limit) */
 for(const n of [1,5,6,9,12,14,16]){const c=cs(n),sd=n===1?1:-c.side,s0=c.sIn+6;[[200,0],[150,1],[100,2],[50,3]].forEach(d=>{if(n!==5&&n!==6&&n!==9&&d[0]===200)return;board(s0-d[0],sd,d[1]);});}
 for(const s of [cs(5).sOut+150,cs(8).sOut+70])for(const sd of [1,-1])board(s,sd,4);}
