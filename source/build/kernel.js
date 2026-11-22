/* ================= REPLAY KERNEL =================
   Pure function of race time. No rendering, no randomness.
   Real data: every finish-line crossing time (cum), pit laps and pit-lane durations, tyre compounds.
   Estimated: where a car is between two line crossings, speeds, lateral position, stationary time. */
function makeKernel(TP,RP,EX){
'use strict';
const PI=Math.PI,TAU=PI*2;
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const angd=(a,b)=>{let d=(b-a)%TAU;if(d>PI)d-=TAU;if(d<-PI)d+=TAU;return d;};
const HW=7,LATMAX=HW-1.5,CARL=5.6;

/* ---------- circuit centreline: 2640 samples, index 0 = finish line, driving direction ---------- */
const TN=2640,wi=i=>((i%TN)+TN)%TN;
const TX=new Float32Array(TN),TZ=new Float32Array(TN),NX=new Float32Array(TN),NZ=new Float32Array(TN),TH=new Float32Array(TN),TV=new Float32Array(TN),TRL=new Float32Array(TN);
let TLEN=0,DS=0;
{const src=TP.cl,m=src.length,sm=(A,w)=>A.map((_,i)=>{let s=0;for(let j=-w;j<=w;j++)s+=A[((i+j)%m+m)%m];return s/(2*w+1);});
 let ax=src.map(p=>p[0]),az=src.map(p=>p[1]);ax=sm(ax,1);az=sm(az,1);
 /* keep index 0 on the original finish line: project the old point 0 */
 const cum=new Float64Array(m+1);for(let i=0;i<m;i++){const j=(i+1)%m;cum[i+1]=cum[i]+Math.hypot(ax[j]-ax[i],az[j]-az[i]);}
 TLEN=cum[m];DS=TLEN/TN;let j=0;for(let i=0;i<TN;i++){const s=TLEN*i/TN;while(cum[j+1]<s)j++;const k=(j+1)%m,u=(s-cum[j])/Math.max(1e-9,cum[j+1]-cum[j]);TX[i]=ax[j]+(ax[k]-ax[j])*u;TZ[i]=az[j]+(az[k]-az[j])*u;}}
for(let i=0;i<TN;i++){const a=wi(i-1),b=wi(i+1),dx=TX[b]-TX[a],dz=TZ[b]-TZ[a],l=Math.hypot(dx,dz)||1,tx=dx/l,tz=dz/l;TH[i]=Math.atan2(tx,tz);NX[i]=tz;NZ[i]=-tx;}
const smoothA=(src,w)=>{const o=new Float32Array(TN);for(let i=0;i<TN;i++){let s=0;for(let j=-w;j<=w;j++)s+=src[wi(i+j)];o[i]=s/(2*w+1);}return o;};
const kRaw=new Float32Array(TN);for(let i=0;i<TN;i++)kRaw[i]=angd(TH[wi(i-1)],TH[wi(i+1)])/(2*DS);
const TK=smoothA(kRaw,4),TKW=smoothA(smoothA(kRaw,10),7);   /* + = left-hander */
const sw=s=>((s%TLEN)+TLEN)%TLEN,fwd=(a,b)=>sw(b-a);
const SCL=TLEN/TP.length;
const CORNERS=TP.corners.map(c=>{let i=Math.round(c.sApex*SCL/DS)%TN,bi=i;for(let j=-10;j<=10;j++){const q=wi(i+j);if(Math.abs(TK[q])>Math.abs(TK[bi]))bi=q;}
 return {n:c.n,id:'T'+c.n,dir:c.dir,i:bi,s:bi*DS,sIn:c.sIn*SCL,sOut:c.sOut*SCL,angle:c.angle,minR:c.minR,note:c.note,x:TX[bi],z:TZ[bi],side:c.dir==='L'?1:-1};});
const cornerS=n=>CORNERS[n-1].s;

/* ---------- racing line (minimum curvature inside the usable width) and reference speed ---------- */
const RLQ=4,RLN=TN/RLQ,RLE=new Float64Array(RLN),RLK=new Float64Array(RLN);
{const px=new Float64Array(RLN),pz=new Float64Array(RLN),w=j=>((j%RLN)+RLN)%RLN;for(let j=0;j<RLN;j++){px[j]=TX[j*RLQ];pz[j]=TZ[j*RLQ];}
 for(let n=0;n<700;n++)for(let j=0;j<RLN;j++){const i=j*RLQ,a=w(j-2),b=w(j-1),c=w(j+1),d=w(j+2),gx=px[a]-4*px[b]+6*px[j]-4*px[c]+px[d],gz=pz[a]-4*pz[b]+6*pz[j]-4*pz[c]+pz[d],e=clamp(RLE[j]-1.6*(gx*NX[i]+gz*NZ[i])/6,-LATMAX+.3,LATMAX-.3);RLE[j]=e;px[j]=TX[i]+e*NX[i];pz[j]=TZ[i]+e*NZ[i];}
 for(let j=0;j<RLN;j++){const b=w(j-1),c=w(j+1),ax=px[j]-px[b],az=pz[j]-pz[b],bx=px[c]-px[j],bz=pz[c]-pz[j];RLK[j]=2*(ax*bz-az*bx)/(Math.hypot(ax,az)*Math.hypot(bx,bz)*Math.hypot(px[c]-px[b],pz[c]-pz[b]));}}
const rlAt=(A,i)=>{const j=Math.floor(i/RLQ),u=i/RLQ-j;return A[j]*(1-u)+A[(j+1)%RLN]*u;};
for(let i=0;i<TN;i++)TRL[i]=clamp(rlAt(RLE,i)*.85,-LATMAX+.6,LATMAX-.6);
const VTOP=91.5,accOf=v=>Math.max(.25,Math.min(11.2,905/Math.max(v,1)-.00113*v*v)),brkOf=v=>16+30*Math.pow(v/85,2);
/* typical apex speeds, km/h (tuning targets, not measurements) */
const APEX={1:138,2:262,3:250,4:300,5:77,6:93,7:101,8:255,9:186,10:262,11:238,12:97,13:126,14:113,15:188,16:126};
{const vc=new Float32Array(TN);for(let i=0;i<TN;i++){const k=Math.abs(rlAt(RLK,i));vc[i]=k>.0052?Math.sqrt(18/(k-.005)):220;}
 const cs=CORNERS.map(c=>{let mn=1e9;for(let d=-28;d<=28;d++)mn=Math.min(mn,vc[wi(c.i+d)]);return {i:c.i,g:clamp(APEX[c.n]/3.6/mn,.45,3)};}).sort((a,b)=>a.i-b.i);
 for(let i=0;i<TN;i++){let a=cs[cs.length-1],b=cs[0];for(let q=0;q<cs.length;q++)if(cs[q].i<=i)a=cs[q];for(let q=cs.length-1;q>=0;q--)if(cs[q].i>i)b=cs[q];
  const span=wi(b.i-a.i)||TN,u=wi(i-a.i)/span;TV[i]=Math.min(VTOP,vc[i]*(a.g+(b.g-a.g)*u));}
 for(let n=2*TN;n>=0;n--){const i=wi(n),j=wi(n+1);TV[i]=Math.min(TV[i],Math.sqrt(TV[j]*TV[j]+2*brkOf(TV[j])*DS));}
 for(let n=0;n<2*TN;n++){const i=wi(n),j=wi(n-1);TV[i]=Math.min(TV[i],Math.sqrt(TV[j]*TV[j]+2*accOf(TV[j])*DS));}}
const tvAt=s=>{const f=sw(s)/DS,i0=Math.floor(f),i=i0%TN,j=(i+1)%TN;return TV[i]+(TV[j]-TV[i])*(f-i0);};
const tAt=(A,s)=>{const f=sw(s)/DS,i0=Math.floor(f),i=i0%TN,j=(i+1)%TN;return A[i]+(A[j]-A[i])*(f-i0);};
function trackPos(s,lat,o){const f=sw(s)/DS,i0=Math.floor(f),i=i0%TN,j=(i+1)%TN,t=f-i0;o.x=TX[i]+(TX[j]-TX[i])*t+(NX[i]+(NX[j]-NX[i])*t)*lat;o.z=TZ[i]+(TZ[j]-TZ[i])*t+(NZ[i]+(NZ[j]-NZ[i])*t)*lat;o.y=0;o.h=TH[i]+angd(TH[i],TH[j])*t;return o;}

/* ---------- pit path: entry before Turn 16, lane, tunnel under Turn 1, rejoin on the left at Turn 3 ---------- */
const PSRC=TP.pit.p,PN=PSRC.length-1,PLEN=TP.pit.length,PDS=PLEN/PN;
const PX=new Float32Array(PN+1),PZ=new Float32Array(PN+1),PNX=new Float32Array(PN+1),PNZ=new Float32Array(PN+1),PH=new Float32Array(PN+1),PKc=new Float32Array(PN+1);
{const sm=(A,w)=>A.map((_,i)=>{if(i<w||i>PN-w)return A[i];let s=0;for(let j=-w;j<=w;j++)s+=A[i+j];return s/(2*w+1);});let ax=PSRC.map(p=>p[0]),az=PSRC.map(p=>p[1]);ax=sm(sm(ax,4),4);az=sm(sm(az,4),4);
 for(let i=0;i<=PN;i++){PX[i]=ax[i];PZ[i]=az[i];}
 for(let i=0;i<=PN;i++){const a=Math.max(0,i-1),b=Math.min(PN,i+1),dx=PX[b]-PX[a],dz=PZ[b]-PZ[a],l=Math.hypot(dx,dz)||1;PH[i]=Math.atan2(dx/l,dz/l);PNX[i]=dz/l;PNZ[i]=-dx/l;}
 for(let i=0;i<=PN;i++){const a=Math.max(0,i-3),b=Math.min(PN,i+3);PKc[i]=angd(PH[a],PH[b])/((b-a)*PDS);}}
const S_IN=TP.pit.sEntry*SCL,S_OUT=TP.pit.sExit*SCL,Q_LINE=TP.pit.lineAt,Q_TUN0=TP.pit.tunnel[0],Q_TUN1=TP.pit.tunnel[1];
/* 80 km/h between Q_LIM0 and Q_LIM1; the pit-lane time in the data ('dur') is taken between Q_LIM0 and Q_LOOP1 */
const Q_LIM0=(typeof globalThis!=='undefined'&&globalThis.__QL0)||327,Q_LIM1=589,Q_LOOP1=714,V_LIM=22.0,Q_SC=597;
/* tunnel dip under Turn 1 */
const pitY=q=>-5.6*(sstep(600,668,q)-sstep(752,822,q));
function pitPos(q,lat,o){const f=clamp(q,0,PLEN)/PDS,i=Math.min(PN-1,Math.floor(f)),t=f-i;o.x=PX[i]+(PX[i+1]-PX[i])*t+(PNX[i]+(PNX[i+1]-PNX[i])*t)*lat;o.z=PZ[i]+(PZ[i+1]-PZ[i])*t+(PNZ[i]+(PNZ[i+1]-PNZ[i])*t)*lat;o.y=pitY(q);o.h=PH[i]+angd(PH[i],PH[i+1])*t;return o;}
/* pit distance -> equivalent track distance (for running order): 0..Q_LINE maps to S_IN..TLEN, Q_LINE..PLEN maps to 0..S_OUT */
const sEq=q=>q<Q_LINE?S_IN+q*(TLEN-S_IN)/Q_LINE:(q-Q_LINE)*S_OUT/(PLEN-Q_LINE);
/* teams and pit boxes (all boxes are after the timing line; order is an assumption) */
const TEAMS=EX.teams.map((t,i)=>Object.assign({},t,{i}));
const teamByCode={};TEAMS.forEach(t=>teamByCode[t.code]=t);
EX.garageOrderFromPitEntry.forEach((c,k)=>{teamByCode[c].box=k;teamByCode[c].boxQ=364+22.2*k;});
const TEAM_OF={red_bull:'RBR',mercedes:'MER',ferrari:'FER',mclaren:'MCL',alpine:'ALP',alphatauri:'AT',aston_martin:'AMR',williams:'WIL',alfa:'ARR',haas:'HAA'};
const BOXLAT=-3.9;

/* ---------- speed profiles as tables of reference time over distance ---------- */
class Prof{constructor(d0,h,v){const n=v.length-1;this.d0=d0;this.h=h;this.n=n;this.v=v;this.tau=new Float64Array(n+1);for(let i=0;i<n;i++){const a=Math.max(v[i],.35),b=Math.max(v[i+1],.35);this.tau[i+1]=this.tau[i]+h*2/(a+b);}this.T=this.tau[n];this.d1=d0+n*h;}
 tauAt(d){const f=clamp((d-this.d0)/this.h,0,this.n),i=Math.min(this.n-1,Math.floor(f));return this.tau[i]+(this.tau[i+1]-this.tau[i])*(f-i);}
 dAt(t){const T=this.tau;if(t<=0)return this.d0;if(t>=this.T)return this.d1;let lo=0,hi=this.n;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m;}return this.d0+(lo+(t-T[lo])/(T[lo+1]-T[lo]))*this.h;}
 /* same, with the last interval remembered on h (a segment): time usually moves on a little between calls */
 dAtH(t,h){const T=this.tau,n=this.n;if(t<=0)return this.d0;if(t>=this.T)return this.d1;let i=h._hi|0;if(i>=n)i=0;
  if(!(T[i]<=t&&t<T[i+1])){if(i+2<=n&&T[i+1]<=t&&t<T[i+2])i++;else{let lo=0,hi=n;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m;}i=lo;}h._hi=i;}
  return this.d0+(i+(t-T[i])/(T[i+1]-T[i]))*this.h;}
 vAt(d){const f=clamp((d-this.d0)/this.h,0,this.n),i=Math.min(this.n-1,Math.floor(f));return this.v[i]+(this.v[i+1]-this.v[i])*(f-i);}}
const trackProf=(()=>{const v=new Float32Array(TN+1);for(let i=0;i<=TN;i++)v[i]=TV[i%TN];return new Prof(0,DS,v);})();
const LREF=trackProf.T;
/* generic speed along the pit path (no stop) */
/* speed along the pit path. All of it is an estimate fitted to the lap-time data: an in-lap is about 2 s slower than a normal
   lap and an out-lap about 20.5 s slower, and the pit-lane time between the two loops is 21.2 to 22.7 s. That puts the start
   of the 80 km/h zone close to the timing line and the second loop after the slow tunnel curve. */
const PH_=.25,PGN=Math.round(PLEN/PH_);
const PITK=Object.assign({entryA:22,entryMin:24,entryMax:67,entryAcc:6,brake:28,limAcc:7.5,exitA:28,exitMin:22,tunMax:27,exitMax:70,exitAcc:7.5},(typeof globalThis!=='undefined'&&globalThis.__PITK)||{});
const pitLim=(()=>{const v=new Float32Array(PGN+1),kq=q=>Math.abs(PKc[Math.min(PN,Math.round(q/PDS))]);
 for(let i=0;i<=PGN;i++){const q=i*PH_,k=kq(q);let lim=200;
  if(q<Q_LIM0){lim=k>1e-4&&q>40?Math.sqrt(PITK.entryA/k):200;lim=clamp(lim,PITK.entryMin,PITK.entryMax);}
  else if(q<=Q_LIM1)lim=V_LIM;
  else{lim=k>1e-4?Math.sqrt(PITK.exitA/k):200;lim=clamp(lim,PITK.exitMin,q<Q_TUN1+40?PITK.tunMax:PITK.exitMax);}
  v[i]=lim;}
 return v;})();
/* o.stopQ: stop there; o.v0: speed on entering the path; o.v1: speed on leaving it; o.cap: never faster than this */
function pitProfX(o){o=o||{};const v=Float32Array.from(pitLim),n=PGN;
 if(o.cap!=null)for(let i=0;i<=n;i++)if(v[i]>o.cap)v[i]=o.cap;
 if(o.stopQ!=null)for(let i=0;i<=n;i++){const q=i*PH_,d=Math.abs(q-o.stopQ);if(d<45)v[i]=Math.min(v[i],Math.sqrt(2*(q<o.stopQ?11:7.5)*d));}
 if(o.v1!=null)v[n]=Math.min(v[n],o.v1);
 for(let i=n-1;i>=0;i--)v[i]=Math.min(v[i],Math.sqrt(v[i+1]*v[i+1]+2*(i*PH_>Q_LIM1?13:PITK.brake)*PH_));
 if(o.v0!=null)v[0]=Math.min(v[0],o.v0);
 for(let i=1;i<=n;i++)v[i]=Math.min(v[i],Math.sqrt(v[i-1]*v[i-1]+2*(i*PH_>Q_LIM1?PITK.exitAcc:i*PH_<Q_LIM0?PITK.entryAcc:PITK.limAcc)*PH_));
 return new Prof(0,PH_,v);}
const pitProf=stopQ=>pitProfX({stopQ});
TEAMS.forEach(t=>{t.prof=pitProf(t.boxQ);});
const pitProfFree=pitProfX(),pitV=pitProfFree.v;

/* ---------- neutralised periods: everyone slows; each lap is then rescaled so its line time stays exact ---------- */
const VSC0=3163,VSC1=3345,MV=.75,SC0=4701,SC1=5321,MS=.76;
const TMIN=-30,TMAX=5640,MH=.25,MNG=Math.round((TMAX-TMIN)/MH);
const ramp=(t,a,b,ra,rb)=>clamp((t-a)/ra,0,1)*clamp((b-t)/rb,0,1);
function mkM(scEnd){const m=new Float32Array(MNG+1),M=new Float64Array(MNG+1);for(let i=0;i<=MNG;i++){const t=TMIN+i*MH;m[i]=Math.min(1-(1-MV)*ramp(t,VSC0,VSC1,4,4),1-(1-MS)*ramp(t,SC0,scEnd,5,4));}
 for(let i=0;i<MNG;i++)M[i+1]=M[i]+(m[i]+m[i+1])*.5*MH;return {m,M};}
const MF=[mkM(SC1)];
const Mat=(mi,t)=>{const A=MF[mi].M,f=clamp((t-TMIN)/MH,0,MNG),i=Math.min(MNG-1,Math.floor(f));return A[i]+(A[i+1]-A[i])*(f-i);};
const mat=(mi,t)=>{const A=MF[mi].m,f=clamp((t-TMIN)/MH,0,MNG),i=Math.min(MNG-1,Math.floor(f));return A[i]+(A[i+1]-A[i])*(f-i);};

/* monotone cubic through (x,y) points */
const hmean=(ha,da,hb,db)=>{if(da*db<=0)return 0;const w1=2*hb+ha,w2=hb+2*ha;return (w1+w2)/(w1/da+w2/db);};
function pchip(xs,ys){const n=xs.length,h=[],d=[],m=new Array(n);for(let i=0;i<n-1;i++){h[i]=xs[i+1]-xs[i];d[i]=(ys[i+1]-ys[i])/h[i];}
 m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=hmean(h[i-1],d[i-1],h[i],d[i]);
 return {n,h,d,m,f(x){let i=0;while(i<n-2&&x>xs[i+1])i++;const t=clamp((x-xs[i])/h[i],0,1),t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h[i]*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h[i]*m[i+1];},
  df(x){let i=0;while(i<n-2&&x>xs[i+1])i++;const t=clamp((x-xs[i])/h[i],0,1),t2=t*t;return ((6*t2-6*t)*ys[i]+(3*t2-4*t+1)*h[i]*m[i]+(-6*t2+6*t)*ys[i+1]+(3*t2-2*t)*h[i]*m[i+1])/h[i];},
  /* value and slope in one go: sets F and D */
  F:0,D:0,fd(x){let i=0;while(i<n-2&&x>xs[i+1])i++;const hi=h[i],t=clamp((x-xs[i])/hi,0,1),t2=t*t,t3=t2*t,a=ys[i],b=ys[i+1],ma=hi*m[i],mb=hi*m[i+1];
   this.F=(2*t3-3*t2+1)*a+(t3-2*t2+t)*ma+(3*t2-2*t3)*b+(t3-t2)*mb;this.D=((6*t2-6*t)*a+(3*t2-4*t+1)*ma+(6*t-6*t2)*b+(3*t2-2*t)*mb)/hi;}};}
/* pace changes smoothly from one lap to the next: shared slope where two free-running segments meet */
function smoothJoins(c){const S=c.segs;for(let i=1;i<S.length;i++){const a=S[i-1],b=S[i];if(!a.pc||!b.pc||Math.abs(a.t1-b.t0)>1e-6)continue;const pa=a.pc,pb=b.pc,m=hmean(pa.h[pa.n-2],pa.d[pa.n-2],pb.h[0],pb.d[0]);
  /* keep each piece monotone: slope no more than 3 times its own secant */
  const mm=Math.min(m,3*pa.d[pa.n-2],3*pb.d[0]);pa.m[pa.n-1]=mm;pb.m[0]=mm;}}

/* ---------- cars ---------- */
const T_FIN=RP.cum.VER[57];
const cars=RP.drivers.filter(d=>RP.cum[d.code]&&RP.cum[d.code].length).map((d,i)=>{const team=teamByCode[TEAM_OF[d.teamId]];
 return {i,kind:'car',id:d.code,code:d.code,num:d.num,first:d.first,last:d.last,name:d.first+' '+d.last,nat:d.nat,team,grid:d.grid,pos:d.pos,status:d.status,points:d.points,timeTxt:d.time,q:d.q3||d.q2||d.q1,
  cum:RP.cum[d.code],lapT:RP.lapT[d.code],lapP:RP.lapP[d.code],N:RP.cum[d.code].length,pits:RP.pits.filter(p=>p.code===d.code).sort((a,b)=>a.lap-b.lap),comp:EX.stints[d.code],
  slotD:8+8*(d.grid-1),slotLat:d.grid%2?2.7:-2.7,segs:[],mi:0,knots:{},latScr:[],finished:d.status==='Finished'||d.status.startsWith('+'),stopInfo:[]};});
const carBy={};cars.forEach(c=>carBy[c.code]=c);
const DNS=RP.drivers.filter(d=>!RP.cum[d.code]||!RP.cum[d.code].length).map(d=>({code:d.code,name:d.first+' '+d.last,num:d.num,grid:d.grid,team:teamByCode[TEAM_OF[d.teamId]]}));
/* per-car neutralisation: the five lapped cars released on lap 57 go back to racing speed when told to overtake */
/* release times fitted so that the five run at about their racing pace from then to their next line crossing */
const RELEASE={NOR:5255.5,ALO:5256.6,OCO:5257.7,LEC:5258.8,VET:5260.5},T_HOLD=5264.5;
Object.keys(RELEASE).forEach(k=>{carBy[k].mi=MF.length;MF.push(mkM(RELEASE[k]+4));});

/* lap-1 profile: standing start from the grid slot */
/* launch quality (m/s2 off the line): Hamilton got away better than Verstappen; the values are estimates */
const LAUNCH={HAM:11.2,VER:9.9,NOR:8.9};
function startProf(c){const n=Math.ceil(TLEN+c.slotD),v=new Float32Array(n+1),al=LAUNCH[c.code]||10;let vl=0;for(let i=0;i<=n;i++){const d=-c.slotD+i*(TLEN+c.slotD)/n;v[i]=Math.min(tvAt(d),vl);vl=Math.sqrt(vl*vl+2*Math.min(al,accOf(vl))*(TLEN+c.slotD)/n);}return new Prof(-c.slotD,(TLEN+c.slotD)/n,v);}
cars.forEach(c=>c.sProf=startProf(c));

/* segment kinds: 0 track, 1 pit path, 2 hidden */
const AUXD=4;
function mkScal(c,prof,type,lapBase,t0,t1,d0,d1,knots){/* knots: [[d,t],...] strictly inside */
 const pts=[[d0,t0]].concat(knots||[],[[d1,t1]]),mi=c.mi,x0=pts.map(p=>Mat(mi,p[1])),y0=pts.map(p=>prof.tauAt(p[0]));
 for(let i=1;i<x0.length;i++)if(!(x0[i]>x0[i-1]+1e-6)||!(y0[i]>y0[i-1]-1e-9))throw new Error('bad knot order '+c.code+' lap '+(lapBase+1)+' '+JSON.stringify(pts));
 /* every long interval runs at one steady pace; the change of pace is confined to AUXD seconds at each end,
    so two cars that run close together keep their gap between the points where it is known */
 const xs=[x0[0]],ys=[y0[0]];for(let i=1;i<x0.length;i++){const h=x0[i]-x0[i-1],k=(y0[i]-y0[i-1])/h;if(h>3*AUXD){xs.push(x0[i-1]+AUXD,x0[i]-AUXD);ys.push(y0[i-1]+k*AUXD,y0[i]-k*AUXD);}xs.push(x0[i]);ys.push(y0[i]);}
 return {t0,t1,type,prof,lapBase,mi,fixed:false,x0:xs[0],y0:ys[0],k:(ys[ys.length-1]-ys[0])/(xs[xs.length-1]-xs[0]),pc:pchip(xs,ys),nk:pts.length-2};}
function scal(c,prof,type,lapBase,t0,t1,d0,d1,knots){const seg=mkScal(c,prof,type,lapBase,t0,t1,d0,d1,knots);c.segs.push(seg);return seg;}
function fixed(c,prof,type,lapBase,t0,d0,d1,extra){const y0=prof.tauAt(d0),dur=prof.tauAt(d1)-y0,seg=Object.assign({t0,t1:t0+dur,type,prof,lapBase,fixed:true,y0,k:1,dEnd:d1},extra||{});c.segs.push(seg);return seg;}
function hold(c,type,lapBase,t0,t1,d,extra){const seg=Object.assign({t0,t1,type,lapBase,hold:true,d},extra||{});c.segs.push(seg);return seg;}
const fixedDur=(prof,d0,d1)=>prof.tauAt(d1)-prof.tauAt(d0);
/* pace (speed relative to the profile) at the very end of the car's last segment, when that segment is free running */
const endPace=c=>{const g=c.segs[c.segs.length-1];return g&&g.pc?g.pc.m[g.pc.n-1]*mat(g.mi,g.t1):null;};
/* time lost stopping at a box, from the pit loops */
function stopTime(team,dur){const p=team.prof;const loop=fixedDur(p,Q_LIM0,Q_LOOP1);return {st:dur-loop,loop};}
const STMIN=1.7;
/* out-lap reference: the lap profile, but joining from the pit exit road at VOUT and accelerating from there */
const VOUT=41,outLapProf=(()=>{const v=new Float32Array(TN+1),i0=Math.ceil(S_OUT/DS);for(let i=0;i<=TN;i++)v[i]=TV[i%TN];let vl=VOUT;for(let i=i0-1;i<=TN;i++){v[i]=Math.min(v[i],vl);vl=Math.sqrt(v[i]*v[i]+2*accOf(v[i])*DS);}return new Prof(0,DS,v);})();

function buildCar(c){c.segs.length=0;c.stopInfo.length=0;const bq=c.team.boxQ;
 hold(c,0,0,TMIN,0,-c.slotD,{grid:true});
 let outLap=null;/* pit record whose stop falls on this lap */
 for(let n=1;n<=c.N;n++){const T0=n===1?0:c.cum[n-2],T1=c.cum[n-1],pin=c.pits.find(p=>p.lap===n),retIn=(c.code==='PER'&&n===c.N),lb=n-1;
  if(LIMP[c.code]&&n===c.N){limpLap(c,lb,T0,T1);break;}
  const prof=n===1?c.sProf:outLap?outLapProf:trackProf,inL=!!(pin||retIn);
  /* the pit path is driven in real time; its entry and exit speeds are matched to the pace of the track part,
     which in turn depends on the time left for it: a few rounds settle it */
  let sg=null,pO=null,pI=null,st=0,tA=T0,dA=n===1?-c.slotD:0,tB=T1,dB=TLEN,vS=.93*VOUT,vE=.93*tvAt(S_IN);
  for(let it=0;it<4;it++){
   if(outLap){pO=pitProfX({stopQ:bq,v1:vS});st=Math.max(STMIN,outLap.dur-fixedDur(pO,Q_LIM0,Q_LOOP1));tA=T0+fixedDur(pO,Q_LINE,PLEN)+st;dA=S_OUT;}
   if(inL){pI=pitProfX({v0:vE,stopQ:bq});tB=T1-fixedDur(pI,0,Q_LINE);dB=S_IN;}
   const kn=(c.knots[n]||[]).filter(k=>k[0]>dA+1&&k[0]<dB-1&&k[1]>tA+.05&&k[1]<tB-.05).sort((a,b)=>a[0]-b[0]);
   sg=mkScal(c,prof,0,lb,tA,tB,dA,dB,kn);
   if(!outLap&&!inL)break;
   vS=sg.pc.m[0]*mat(c.mi,tA)*prof.vAt(dA);vE=sg.pc.m[sg.pc.n-1]*mat(c.mi,tB)*prof.vAt(dB);}
  if(outLap){const a=fixed(c,pO,1,lb,T0,Q_LINE,bq,{pitIn:true,toBox:bq,boxLat:BOXLAT}),h=hold(c,1,lb,a.t1,a.t1+st,bq,{box:true,lat:BOXLAT}),b=fixed(c,pO,1,lb,h.t1,bq,PLEN,{pitOut:true,fromBox:bq});b.t1=tA;
   c.stopInfo.push({lap:outLap.lap,dur:outLap.dur,st,stRaw:outLap.dur-fixedDur(pO,Q_LIM0,Q_LOOP1),t0:h.t0,t1:h.t1,from:c.comp[c.pits.indexOf(outLap)],to:c.comp[c.pits.indexOf(outLap)+1]});}
  c.segs.push(sg);sg.lap=n;sg.inLap=inL;sg.outLap=!!outLap;
  if(inL){const e=fixed(c,pI,1,lb,tB,0,Q_LINE,{pitIn:true,entry:true});e.t1=T1;}
  outLap=pin||null;}
 smoothJoins(c);tail(c);}

/* what happens on a car's last lap when it crawls back to the pits, and after the last timed line crossing */
const TEND=T_FIN+150;
function customProf(d1,f,dec,acc){dec=dec||14;acc=acc||6;const n=Math.ceil(d1/DS),h=d1/n,v=new Float32Array(n+1);for(let i=0;i<=n;i++)v[i]=f(i*h);for(let i=n-1;i>=0;i--)v[i]=Math.min(v[i],Math.sqrt(v[i+1]*v[i+1]+2*dec*h));for(let i=1;i<=n;i++)v[i]=Math.min(v[i],Math.sqrt(v[i-1]*v[i-1]+2*acc*h)+.0001);return new Prof(0,h,v);}
/* slowing-down lap: from the speed at the line down to an easy pace, never faster than racing speed */
const COOLF=.6,COOLCAP=58;
function coolProf(v0,k0,d1,stop){const n=Math.ceil(d1/DS),h=d1/n,v=new Float32Array(n+1);v[0]=v0;
 for(let i=1;i<=n;i++){const tv=tvAt(i*h),p=v[i-1];v[i]=Math.min(tv*k0,Math.max(Math.min(tv*COOLF,COOLCAP),Math.sqrt(Math.max(0,p*p-2*7*h))),Math.sqrt(p*p+2*4*h));}
 if(stop)for(let i=n;i>=0;i--)v[i]=Math.min(v[i],Math.sqrt(2*5*Math.max(0,d1-i*h))+.01);
 return new Prof(0,h,v);}
const PARK={VER:[TLEN-12,-3.6],HAM:[TLEN-27,2.6],SAI:[TLEN-42,-3.6]};
/* the other finishers stop nose to tail in the pit lane (fast lane), in the order they arrive */
const PFQ=560,PFGAP=7,PFLAT=0;
cars.filter(c=>c.finished&&!PARK[c.code]).sort((a,b)=>a.cum[a.N-1]-b.cum[b.N-1]).forEach((c,i)=>c.pfi=i);
/* Raikkonen (brake problem at Turn 6) and Russell (gearbox) lose most of a minute on their last lap and are classified
   with it, so the lap ends at the timing line in the pit lane. Shape of the lap: estimate. */
const LIMPK=72,LIMP={
 /* he cannot slow enough for Turn 6 (20 m/s2 instead of 32), reaches the barrier at 6 m/s, runs along it at 8 m/s; speeds are along his real path */
 RAI:{inc:'rai',at:()=>ALT_R.sB,v:(d,k0,f)=>{const a=ALT_R;if(d<=a.sB){const rem=d<a.s0?a.s0-d+a.arcB:a.arcB-altArc(a,d);return Math.min(d<cornerS(6)-100?tvAt(d)*k0:999,Math.sqrt(36+2*20*Math.max(0,rem))/(d<a.s0?1:altR(a,d)));}return d<a.s1?8/altR(a,d):Math.min(tvAt(d)*f,LIMPK*f);},dec:30,acc:3},
 RUS:{inc:'rus',at:()=>470,v:(d,k0,f)=>{const w=sstep(350,620,d);return Math.min(tvAt(d)*(k0+(f-k0)*w),LIMPK*f+(1-w)*200);},dec:6,acc:3}};
function limpLap(c,lb,T0,T1){const L=LIMP[c.code],k0=endPace(c)||.9,mk=f=>{const pr=customProf(S_IN,d=>L.v(d,k0,f),L.dec,L.acc),pI=pitProfX({cap:Math.max(V_LIM+2,LIMPK*f),v0:pr.vAt(S_IN),stopQ:c.team.boxQ});return {pr,pI,T:pr.T+fixedDur(pI,0,Q_LINE)};};
 let lo=.08,hi=1.1,r=null;for(let i=0;i<44;i++){const m=(lo+hi)/2;r=mk(m);if(r.T>T1-T0)lo=m;else hi=m;}
 const a=fixed(c,r.pr,0,lb,T0,0,S_IN,{inc:L.inc,inLap:true,lap:lb+1}),e=fixed(c,r.pI,1,lb,a.t1,0,Q_LINE,{pitIn:true,entry:true});a.t1=T1-fixedDur(r.pI,0,Q_LINE);e.t0=a.t1;e.t1=T1;
 c.limpF=(lo+hi)/2;c.limpCap=Math.max(V_LIM+2,LIMPK*c.limpF);c.incT=T0+r.pr.tauAt(L.at());}
function tail(c){const F=c.cum[c.N-1],lb=c.N,k0=endPace(c)||.9,bq=c.team.boxQ;
 const off=t=>{c.segs.push({t0:t,t1:TMAX+1,type:2,lapBase:lb,hold:true,d:0,gone:true});};
 if(c.finished){const v0=k0*tvAt(0);
  if(PARK[c.code]){const p=PARK[c.code],pr=coolProf(v0,k0,p[0],true),a=fixed(c,pr,0,lb,F,0,p[0],{cool:true});hold(c,0,lb,a.t1,TMAX+1,p[0],{parked:true,lat:p[1]});c.parkT=a.t1;}
  else{const pr=coolProf(v0,k0,S_IN,false),a=fixed(c,pr,0,lb,F,0,S_IN,{cool:true,inLap:true}),qs=PFQ-PFGAP*(c.pfi||0),pp=pitProfX({stopQ:qs,cap:COOLCAP*.7,v0:pr.vAt(S_IN)}),b=fixed(c,pp,1,lb,a.t1,0,qs,{pitIn:true,cool:true,toBox:qs,boxLat:PFLAT});hold(c,1,lb,b.t1,TMAX+1,qs,{parked:true,lat:PFLAT});c.parkT=b.t1;}
  return;}
 if(c.code==='PER'||LIMP[c.code]){const pp=pitProfX({stopQ:bq,cap:c.limpCap||99}),a=fixed(c,pp,1,lb,F,Q_LINE,bq,{pitIn:true,toBox:bq,boxLat:BOXLAT}),h=hold(c,1,lb,a.t1,a.t1+6,bq,{box:true,lat:BOXLAT});off(h.t1);c.outT=a.t1;c.outWhere='pits';return;}
 if(c.code==='GIO'){const sp=CORNERS[8].sOut+24,pr=customProf(sp,d=>Math.min(tvAt(d)*k0*(1-sstep(sp-420,sp-150,d)*.55),Math.sqrt(2*3.2*Math.max(0,sp-d))+.01));
  const a=fixed(c,pr,0,lb,F,0,sp,{inc:'gio'});hold(c,0,lb,a.t1,VSC1-28,sp,{parked:true,lat:-11.5,wreck:true});off(VSC1-28);c.incT=a.t1;c.outT=a.t1;c.outWhere='Turn 9';c.stopS=sp;return;}
 if(c.code==='LAT'){const sp=CORNERS[13].sOut+22,pr=customProf(sp,d=>Math.min(tvAt(d)*k0,Math.sqrt(2*17*Math.max(0,sp-d))+.01),18);
  const a=fixed(c,pr,0,lb,F,0,sp,{inc:'lat'});hold(c,0,lb,a.t1,5212,sp,{parked:true,lat:-(HW+2.3),wreck:true,yaw:1.1});off(5212);c.incT=a.t1-1.6;c.outT=a.t1;c.outWhere='Turn 14';c.stopS=sp;return;}
 off(F);}
/* pit lane numbers for the test harness */
const pitInfo=(()=>{const p=pitProfFree,tm=TEAMS[0].prof,sp=[];for(let q=0;q<=PLEN;q+=50)sp.push([q,p.vAt(q)]);
 return {sections:[[0,Q_LIM0],[Q_LIM0,Q_LINE],[Q_LINE,Q_LIM1],[Q_LIM1,Q_LOOP1],[Q_LOOP1,PLEN]].map(s=>({from:s[0],to:s[1],len:s[1]-s[0],t:fixedDur(p,s[0],s[1])})),total:p.T,stopLoss:tm.T-p.T,loop:fixedDur(tm,Q_LIM0,Q_LOOP1),
  trackIn:LREF-trackProf.tauAt(S_IN),pitIn:fixedDur(p,0,Q_LINE),trackOut:trackProf.tauAt(S_OUT),pitOut:fixedDur(p,Q_LINE,PLEN),speeds:sp};})();

/* ---------- evaluating a car at time t ---------- */
function segAt(c,t){const S=c.segs;let i=c._si||0;if(i>=S.length)i=S.length-1;if(t>=S[i].t0&&t<S[i].t1)return S[i];let lo=0,hi=S.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(S[m].t0<=t)lo=m;else hi=m-1;}c._si=lo;return S[lo];}
/* fills o: type, d (track s or pit q), D (total progress in metres), v, seg */
function prog(c,t,o){const g=segAt(c,t);o.seg=g;o.type=g.type;
 if(g.hold){o.d=g.d;o.v=0;}
 else if(g.fixed){const tau=g.y0+clamp(t-g.t0,0,g.t1-g.t0);o.d=Math.min(g.prof.dAtH(tau,g),g.dEnd);o.v=t>=g.t1?0:g.prof.vAt(o.d);
  /* into and out of a box the speed goes to zero exactly at the stopping place (the table is 0.25 m coarse) */
  if(g.toBox!=null)o.v=Math.min(o.v,Math.sqrt(22*Math.max(0,g.dEnd-o.d)));else if(g.fromBox!=null)o.v=Math.min(o.v,Math.sqrt(15*Math.max(0,o.d-g.fromBox)));}
 else{const pc=g.pc;pc.fd(Mat(g.mi,clamp(t,g.t0,g.t1)));const kk=pc.D;o.d=g.prof.dAtH(pc.F,g);o.v=kk*mat(g.mi,t)*g.prof.vAt(o.d);o.kk=kk;}
 if(c.alts&&g.type===0&&!g.hold){const a=altOf(c,g.lapBase+1,o.d);if(a)o.v*=altR(a,o.d);}
 o.D=g.lapBase*TLEN+(g.type===1?sEq(o.d):o.d);return o;}
const _p={},_q={};
/* time at which the car's total progress reaches D (within [ta,tb]) */
function timeAtD(c,D,ta,tb){for(let i=0;i<44;i++){const m=(ta+tb)/2;if(prog(c,m,_q).D<D)ta=m;else tb=m;}return (ta+tb)/2;}
const lapSpan=(c,n)=>[n===1?0:c.cum[n-2],c.cum[n-1]];
const timeAtS=(c,n,s)=>{const sp=lapSpan(c,n);return timeAtD(c,(n-1)*TLEN+s,sp[0],sp[1]);};

const H=carBy.HAM,V=carBy.VER,PZc=carBy.PER;
const s5=cornerS(5),s6=cornerS(6),s7=cornerS(7),s9=cornerS(9),s1=cornerS(1);
/* ---------- excursions off the track that have their own path in the plane ----------
   Far outside a tight corner the (s, lateral) grid is stretched or folded, so a car that leaves the road there is drawn on a
   smooth curve through hand-placed points (x east, z south). Its s still counts progress and still runs from s0 to s1. */
function mkAlt(code,lap,s0,lat0,s1,lat1,mid){const P=[],o={},pt=(s,l)=>{trackPos(s,l,o);P.push([o.x,o.z]);};
 pt(s0-14,lat0);pt(s0,lat0);mid.forEach(p=>P.push(p));pt(s1,lat1);pt(s1+14,lat1);
 const X=[],Z=[],cr=(a,b,c,d,t)=>.5*(2*b+(c-a)*t+(2*a-5*b+4*c-d)*t*t+(3*b-a-3*c+d)*t*t*t);
 for(let i=1;i<P.length-2;i++)for(let j=0;j<24;j++){const t=j/24;X.push(cr(P[i-1][0],P[i][0],P[i+1][0],P[i+2][0],t));Z.push(cr(P[i-1][1],P[i][1],P[i+1][1],P[i+2][1],t));}
 X.push(P[P.length-2][0]);Z.push(P[P.length-2][1]);
 const C=new Float32Array(X.length);for(let i=1;i<X.length;i++)C[i]=C[i-1]+Math.hypot(X[i]-X[i-1],Z[i]-Z[i-1]);
 const a={lap,s0,s1,X,Z,C,L:C[C.length-1],rho:0,mid:P};a.rho=(s1-s0)/a.L;const c=carBy[code];(c.alts=c.alts||[]).push(a);return a;}
/* share of the path covered when the car's s is at share u of [s0,s1]; the speed along the path equals the s-rate at both ends */
const altW=(a,u)=>{const r=a.rho,u2=u*u,u3=u2*u;return (u3-2*u2+u)*r+(3*u2-2*u3)+(u3-u2)*r;};
/* real speed along the path divided by the s-rate */
const altR=(a,s)=>{const u=clamp((s-a.s0)/(a.s1-a.s0),0,1),r=a.rho;return (r*(3*u*u-4*u+1)+6*u-6*u*u+r*(3*u*u-2*u))/r;};
const altArc=(a,s)=>altW(a,clamp((s-a.s0)/(a.s1-a.s0),0,1))*a.L;
const altSofArc=(a,arc)=>{let lo=0,hi=1;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(altW(a,m)*a.L<arc)lo=m;else hi=m;}return a.s0+(lo+hi)/2*(a.s1-a.s0);};
function altPos(a,s,o){const d=altArc(a,s),C=a.C,n=C.length-1;let lo=0,hi=n;while(hi-lo>1){const m=(lo+hi)>>1;if(C[m]<=d)lo=m;else hi=m;}
 const f=clamp((d-C[lo])/Math.max(1e-6,C[hi]-C[lo]),0,1),i0=Math.max(0,lo-1),i1=Math.min(n,hi+1);
 o.x=a.X[lo]+(a.X[hi]-a.X[lo])*f;o.z=a.Z[lo]+(a.Z[hi]-a.Z[lo])*f;o.y=0;
 const h0=Math.atan2(a.X[hi]-a.X[i0],a.Z[hi]-a.Z[i0]),h1=Math.atan2(a.X[i1]-a.X[lo],a.Z[i1]-a.Z[lo]);o.h=h0+angd(h0,h1)*f;return o;}
const altOf=(c,lap,s)=>{const A=c.alts;for(let i=0;i<A.length;i++){const a=A[i];if(a.lap===lap&&s>a.s0&&s<a.s1)return a;}return null;};
/* signed distance from the centre line of a point near track distance s (+ = left) */
function nearLat(x,z,s,o){const i0=Math.round(sw(s)/DS);let bd=1e9,bi=0;for(let j=-45;j<=45;j++){const w=wi(i0+j),d=(x-TX[w])*(x-TX[w])+(z-TZ[w])*(z-TZ[w]);if(d<bd){bd=d;bi=w;}}if(o)o.i=bi;return (x-TX[bi])*NX[bi]+(z-TZ[bi])*NZ[bi];}
/* lap 1, Turn 6: Hamilton, on the outside of Verstappen, cannot make the corner, crosses the run-off inside Turn 7 and rejoins */
const ALT_H=mkAlt('HAM',1,s6-30,-4.6,s7+70,-2.5,[[-455.4,320.9],[-452.7,339.8],[-439.3,348.7],[-424,354.5],[-406,357.5],[-391,363],[-380,374],[-372.8,386.5]]);
/* Raikkonen's last lap: brake problem, straight on at Turn 6, along the barrier, back to the road before Turn 7 */
const ALT_R=mkAlt('RAI',carBy.RAI.N,s6-30,-1.2,s6+48,-3.2,[[-452.3,323.5],[-457.2,338.7],[-459.6,349.1],[-453.5,355.5],[-442,355.5],[-430,349.5],[-416,342.5]]);
ALT_R.arcB=45;ALT_R.sB=altSofArc(ALT_R,ALT_R.arcB);

/* ---------- lap 1: by SK1 metres the field is in the order of the first lap chart, G1K seconds apart (estimate) ---------- */
const SK1=620,G1K=.26;
{const T0=H.sProf.tauAt(SK1)*H.cum[0]/H.sProf.T;cars.slice().sort((a,b)=>a.cum[0]-b.cum[0]).forEach((c,i)=>{c.rank1=i;c.knots[1]=[[SK1,T0+G1K*i+(i?.08:0)]];});}
/* ---------- pass 1: Hamilton first, on the reference profile scaled to his real lap times ---------- */
buildCar(H);
/* lap 57 behind the safety car: the queue holds station until the five lapped cars have been released */
const lapOf=(c,t)=>{let n=1;while(n<c.N&&c.cum[n-1]<=t)n++;return n;};
const H57=lapSpan(H,57);
function holdKnot(c,t){const n=lapOf(c,t),sp=lapSpan(c,n),g=sp[0]-H57[0];if(g<0||g>40)return;const ph=prog(H,t-g,_p);if(ph.seg.type!==0)return;const s=ph.D-56*TLEN;if(s<50||s>S_IN-50)return;(c.knots[n]=c.knots[n]||[]).push([s,t]);}
['VER','RIC','STR','SAI','BOT','MSC','TSU','GAS'].forEach(k=>holdKnot(carBy[k],T_HOLD));
Object.keys(RELEASE).forEach(k=>holdKnot(carBy[k],RELEASE[k]));
/* once the five are gone the rest close the hole: Verstappen is a second behind Hamilton 16 s after the hold, the others follow in turn */
const gapKnot57=(c,t,g)=>{const n=lapOf(c,t),ph=prog(H,t-g,_p);if(ph.seg.type!==0)return;const s=ph.D-56*TLEN;if(s<50||s>S_IN-50)return;(c.knots[n]=c.knots[n]||[]).push([s,t]);};
{const g57=c=>c.cum.find(x=>x>H.cum[56])-H.cum[56],gV=g57(V);let gp=-9;['VER','RIC','STR','SAI','BOT','MSC','TSU','GAS'].forEach((k,j)=>{const c=carBy[k],g=Math.max(1+(g57(c)-gV)*1.15,gp+.6);gp=g;gapKnot57(c,T_HOLD+16+3*j,g);});}
/* everyone else, final (Perez gets his lap-21 knots below and is built again) */
cars.forEach(c=>{if(c!==H)buildCar(c);});
/* ---------- pass 2: places that race reports describe, as gaps to another car at given points ---------- */
const gapKnots=(c,n,ref,rn,list)=>{c.knots[n]=(c.knots[n]||[]).filter(k=>k.keep).concat(list.map(p=>[p[0],timeAtS(ref,rn,p[0])+p[1]]));};
/* lap 1: Hamilton ahead into Turn 1; Verstappen alongside at Turn 6; Hamilton across the run-off and ahead again */
H.knots[1][0].keep=true;
gapKnots(H,1,V,1,[[s5+60,-.36],[s6-110,-.25],[s6+2,.03],[s7+70,-.9]]);
/* lap 20: Hamilton passes Perez into Turn 6, Perez back in front before Turn 9 */
gapKnots(H,20,PZc,20,[[s5+70,.38],[s6-150,.12],[s6-28,-.14],[s7+40,-.2],[s9-330,-.02],[s9-70,.17],[s9+190,.36]]);
/* lap 21: Hamilton by for good before Turn 6; Perez then lets Verstappen through and pits */
gapKnots(PZc,21,H,21,[[s5+70,-.34],[s6-260,-.1],[s6-60,.16],[s7+40,.55],[s9-200,1.9]]);
/* lap 58: Verstappen inside at Turn 5; Hamilton in the tow, alongside into Turn 9, then dropped */
gapKnots(H,58,V,58,[[s1,-.36],[s5-150,-.27],[s5-34,-.07],[s5+14,.13],[s5+80,.3],[s6-420,.22],[s6-40,.19],[s7+36,.31],[s9-360,.16],[s9-170,.035],[s9-60,.03],[s9+30,.27],[s9+215,.72],[cornerS(12),1.28],[cornerS(14),1.62],[cornerS(16),2.02]]);
[H,PZc].forEach(buildCar);

/* ---------- safety car: red coupe, leads Hamilton by a fixed time, in at the end of lap 57 ---------- */
const SC={kind:'sc',id:'SC',code:'SC',name:'Safety Car',num:'SC',team:{code:'RC',name:'Race Control',ui:'#ff5a3c'},segs:[]};
/* it joins at the pit exit SC_LEAD seconds before Hamilton gets there and leaves the track at the pit entry as far ahead of him;
   in between it is where Hamilton will be SC_LEAD seconds later. Speeds at both hand-overs are matched. */
const SC_LEAD=1.75,D_JOIN=53*TLEN+S_OUT,D_PEEL=56*TLEN+S_IN;
const scHJ=timeAtD(H,D_JOIN,H.cum[52],H.cum[53]),scHP=timeAtD(H,D_PEEL,H.cum[55],H.cum[56]),scVJ=prog(H,scHJ,_p).v,scVP=prog(H,scHP,_p).v;
const scProfOut=(()=>{const v=Float32Array.from(pitProfX({v1:scVJ,cap:42}).v);for(let i=0;i<=PGN;i++){const q=i*PH_;v[i]=Math.min(v[i],Math.sqrt(2*4.5*Math.max(0,q-Q_SC))+.02);}return new Prof(0,PH_,v);})();
const scProfIn=pitProfX({v0:scVP,stopQ:Q_SC});
const scTJ=scHJ-SC_LEAD,scT0=scTJ-fixedDur(scProfOut,Q_SC,PLEN),scTP=scHP-SC_LEAD,scT1=scTP+fixedDur(scProfIn,0,Q_SC);
/* o.lat on the pit path is the lateral on that path (the blends into the track at both ends are made in pitXY) */
function scProg(t,o){o.type=1;o.v=0;o.lights=t>scT0-6&&t<scTP-34;o.out=t>=scT0&&t<scT1;
 if(t<scT0){o.d=Q_SC;o.D=-1e9;o.lat=-5.2;return o;}
 if(t<scTJ){o.d=scProfOut.dAt(scProfOut.tauAt(Q_SC)+(t-scT0));o.v=scProfOut.vAt(o.d);o.D=53*TLEN+sEq(o.d);o.lat=-5.2*(1-sstep(Q_SC,Q_SC+40,o.d));return o;}
 if(t<scTP){prog(H,t+SC_LEAD,_q);o.type=0;o.D=_q.D;o.d=sw(_q.D);o.v=_q.v;o.lat=null;return o;}
 if(t<scT1){o.d=Math.min(Q_SC,scProfIn.dAt(t-scTP));o.v=scProfIn.vAt(o.d);o.D=56*TLEN+sEq(o.d);o.lat=-5.2*sstep(Q_SC-60,Q_SC,o.d);return o;}
 o.d=Q_SC;o.D=-1e9;o.lat=-5.2;return o;}

/* ---------- lateral position: sampled 4 times a second over the whole race ---------- */
const LH=.25,LT0=-12,LN=Math.ceil((TEND+20-LT0)/LH);
const ALL=cars.concat([SC]);
/* latA: lateral position at the samples; dispA: the part of it that is the sideways move made for other cars */
ALL.forEach(c=>{c.latA=new Float32Array(LN+1);c.dispA=new Float32Array(LN+1);});
/* scripted lines: [car, lap, [[s,lat],...]] (lat: + left, - right of the centreline; null = racing line) */
const RLs=s=>tAt(TRL,s);
const SCRIPT=[];
const scr=(code,lap,pts)=>SCRIPT.push({c:carBy[code],lap,pts});
/* between s6-30 and s7+70 Hamilton is on his own path (ALT_H), and Raikkonen between s6-30 and s6+48 on his last lap (ALT_R) */
scr('HAM',1,[[s6-100,null],[s6-30,-4.6],[s7+70,-2.5],[s7+140,null]]);
scr('VER',1,[[s6-120,null],[s6-50,3.6],[s6-4,4.6],[s6+24,-5],[s7-16,-5],[s7+10,-4.2],[s7+44,2.5],[s7+110,null]]);
scr('VER',58,[[s5-170,null],[s5-110,3.2],[s5-30,4.6],[s5+6,4.9],[s5+38,1.2],[s5+84,-3.6],[s5+150,null],[s6-330,null],[s6-200,2.6],[s6-40,3.4],[s6+10,4.4],[s7-10,-1],[s7+40,null],[s9-380,null],[s9-260,1.2],[s9-70,2.4],[s9-6,4.2],[s9+120,2],[s9+230,null]]);
scr('HAM',58,[[s5-170,null],[s5-100,.6],[s5-20,-.9],[s5+12,-2.4],[s5+50,-4.8],[s5+110,-2.2],[s5+180,null],[s6-330,null],[s6-200,-2.4],[s6-40,-3.4],[s6+10,-1.2],[s7+10,null],[s9-380,null],[s9-270,-3.2],[s9-70,-4.4],[s9+10,-4.2],[s9+120,-3],[s9+240,null]]);
scr('RAI',carBy.RAI.N,[[s6-90,null],[s6-30,-1.2],[s6+48,-3.2],[s7+10,-4.2],[s7+60,null]]);
scr('LAT',51,[[s9-30,null],[s9+50,-5.4],[s9+130,-8.8],[s9+200,-5],[s9+260,null],[CORNERS[13].s+20,null],[CORNERS[13].sOut-12,-1.5],[CORNERS[13].sOut+8,-5.8],[CORNERS[13].sOut+22,-(HW+2.3)]]);
scr('GIO',34,[[CORNERS[8].sOut-150,null],[CORNERS[8].sOut-60,-4.6],[CORNERS[8].sOut+24,-11.5]]);
/* scripted lateral at s, or null; Ls = the car's normal line there (what a null point of a script stands for) */
function scriptLat(c,lap,s,Ls){for(const q of SCRIPT){if(q.c!==c||q.lap!==lap)continue;const P=q.pts;if(s<P[0][0]||s>P[P.length-1][0])continue;for(let i=0;i<P.length-1;i++){if(s<=P[i+1][0]){const a=P[i],b=P[i+1],u=sstep(a[0],b[0],s),la=a[1]==null?Ls:a[1],lb=b[1]==null?Ls:b[1];if(a[1]==null&&b[1]==null)return null;_slk=a[1]==null?u:b[1]==null?1-u:1;return la+(lb-la)*u;}}}return null;}
let _slk=0;
/* lap 1: from the two grid columns the field settles into two files either side of the racing line, COL1 metres off it, in the
   order of the first lap chart (odd places left like on the grid, even places right: a car that gains a place takes the file
   of the car it passes), and merges into one file on the straight before Turn 9 */
const COL1=1.6,COL1_C=3.2,COL1_S0=2800,COL1_S1=3400;
/* clamp to +-c with a rounded corner of half width w (no step in slope) */
const sclamp=(x,c,w)=>{const a=Math.abs(x);if(a<=c-w)return x;if(a>=c+w)return x<0?-c:c;const t=(a-c+w)/(2*w),v=c-w+2*w*(t-t*t*.5);return x<0?-v:v;};
function baseLat(c,g,s,o){/* returns the lateral target; o.lock 0..1: how firmly the car is held on it (1 = the solver must not move it) */
 o.lock=0;
 if(g.hold){o.lock=1;return g.grid?c.slotLat:(g.lat||0);}
 const lap=g.lapBase+1;let L=RLs(s);
 if(g.lapBase===0&&s<COL1_S1){const col=(c.rank1%2?-1:1)*COL1;const w=sstep(COL1_S0,COL1_S1,s),Lc=lerp(sclamp(L,COL1_C,.9),L,w)+col*(1-w);L=s<SK1?lerp(c.slotLat,Lc,sstep(60,520,s+c.slotD)):Lc;}
 if(g.inLap&&s>S_IN-230){L=lerp(L,-2.6,sstep(S_IN-230,S_IN-40,s));o.lock=sstep(S_IN-200,S_IN-120,s);}
 if(g.outLap&&s<S_OUT+190){L=lerp(3.6,L,sstep(S_OUT+10,S_OUT+190,s));o.lock=1-sstep(S_OUT+50,S_OUT+130,s);}
 if(g.cool&&PARK[c.code]){const p=PARK[c.code];L=lerp(L,p[1],sstep(p[0]-260,p[0]-40,s));o.lock=Math.max(o.lock,sstep(p[0]-170,p[0]-90,s));}
 const sl=scriptLat(c,lap,s,L);if(sl!=null){o.lock=Math.max(o.lock,_slk);return sl;}
 return L;}
/* lateral on the pit path: into and out of a box or parking place (the blends into the track at both ends are made in pitXY) */
const pitLat=(c,g,q)=>{if(g.hold)return g.lat||0;let L=0;
 if(g.toBox!=null)L+=g.boxLat*sstep(g.toBox-19,g.toBox-2,q);
 if(g.fromBox!=null)L+=BOXLAT*(1-sstep(g.fromBox+2,g.fromBox+17,q));return L;};
/* safety car on the track: a little inside the racing line; joins from the pit exit on the left, leaves to the pit entry on the right */
const scBase=(o,ob)=>{const dj=o.D-D_JOIN,dp=D_PEEL-o.D;let b=RLs(o.d)*.6;if(dj<190)b=lerp(3.6,b,sstep(10,190,dj));if(dp<230)b=lerp(-2.6,b,sstep(40,230,dp));ob.lock=Math.max(1-sstep(50,120,dj),1-sstep(110,190,dp));return b;};
/* the first and last stretch of the pit path run beside the track: where a point of the path sits in track coordinates */
const QV0=90,QV1=PLEN-150,QE=70,QX=95;
const pitTr=(()=>{const S=new Float32Array(PN+1),L=new Float32Array(PN+1);
 for(let i=0;i<=PN;i++){const q=i*PDS;if(q>QV0+6&&q<QV1-6)continue;const i0=Math.round((q<=QV0+6?S_IN+q:S_OUT-(PLEN-q))/DS);let bd=1e9,bi=0;for(let j=-30;j<=30;j++){const w=wi(i0+j),d=(PX[i]-TX[w])*(PX[i]-TX[w])+(PZ[i]-TZ[w])*(PZ[i]-TZ[w]);if(d<bd){bd=d;bi=w;}}
  const dx=PX[i]-TX[bi],dz=PZ[i]-TZ[bi];S[i]=bi*DS+dx*Math.sin(TH[bi])+dz*Math.cos(TH[bi]);L[i]=dx*NX[bi]+dz*NZ[bi];}return {S,L};})();
const ptS=q=>{const f=clamp(q,0,PLEN)/PDS,i=Math.min(PN-1,Math.floor(f));return pitTr.S[i]+(pitTr.S[i+1]-pitTr.S[i])*(f-i);};
const ptL=q=>{const f=clamp(q,0,PLEN)/PDS,i=Math.min(PN-1,Math.floor(f));return pitTr.L[i]+(pitTr.L[i+1]-pitTr.L[i])*(f-i);};
const PT_S0=S_IN-ptS(0),PT_S1=S_OUT-ptS(PLEN);
/* track coordinates {s, lat} of a car on the first QV0 or last PLEN-QV1 metres of the pit path; pl = its lateral on the path.
   Over the first QE and the last QX metres the car is blended between its line on the track (lateral -2.6 going in, +3.6 coming
   out) and the pit path, so that position and heading are continuous at the hand-over. */
function pitTrk(q,pl,o){
 if(q<QE){const w=sstep(0,QE,q);o.s=ptS(q)+PT_S0*(1-w);o.lat=-2.6*(1-w)+(ptL(q)+pl)*w;}
 else if(q>PLEN-QX){const w=sstep(PLEN-QX,PLEN,q);o.s=ptS(q)+PT_S1*w;o.lat=(ptL(q)+pl)*(1-w)+3.6*w;}
 else{o.s=ptS(q);o.lat=ptL(q)+pl;}return o;}
const _t={};
/* position of a car on the pit path */
function pitXY(q,pl,o){if(q<QE||q>PLEN-QX){pitTrk(q,pl,_t);trackPos(_t.s,_t.lat,o);o.y=pitY(q);return o;}return pitPos(q,pl,o);}
/* position and heading; plf(q) gives the lateral on the path */
const _u={},_w={};
function pitPose(q,plf,o){pitXY(q,plf(q),o);const q0=Math.max(0,q-.7),q1=Math.min(PLEN,q+.7);pitXY(q0,plf(q0),_u);pitXY(q1,plf(q1),_w);o.h=Math.atan2(_w.x-_u.x,_w.z-_u.z);return o;}
/* cars that are lengthwise closer than G0 (in metres of real distance) are moved apart sideways: fully (SEP) when closer than G1.
   The need is known ahead of time, so the move starts NR samples before the cars come together and is undone as late after. */
const SEP=3.2,LIM=LATMAX+.5,G1=6.0,G0=7.3,NR=7,RNG=36;
const latStats={episodes:0,unsolved:0,worst:0};
/* K.latExtent: per track sample, how far any car body gets from the centre line over the whole race.
   L = largest distance on the left, R = largest on the right (both positive metres); max = L and min = -R (signed, + = left).
   The car body is counted with half its width (body = 1 m), parked and wrecked cars with their real footprint. */
const EXT_HW=1,latExtent={L:new Float32Array(TN),R:new Float32Array(TN),min:new Float32Array(TN),max:new Float32Array(TN),body:EXT_HW};
const extPut=(i,lat,hw)=>{i=wi(i);if(lat+hw>latExtent.L[i])latExtent.L[i]=lat+hw;if(hw-lat>latExtent.R[i])latExtent.R[i]=hw-lat;};
{const NA=ALL.length,mk=()=>ALL.map(()=>new Float32Array(LN+1)),on=ALL.map(()=>new Uint8Array(LN+1)),lk=mk(),sS=mk(),vS=mk(),bS=mk(),o={},ob={};
 /* A: where every car is and where it would like to be */
 for(let k=0;k<=LN;k++){const t=LT0+k*LH;
  for(let ci=0;ci<NA;ci++){const c=ALL[ci];let f=0,s=0,b=0,l=0,q=-1,g=null;
   if(c===SC){scProg(t,o);if(o.out){if(o.type===0){f=1;s=sw(o.d);b=scBase(o,ob);l=ob.lock;}else q=o.d;}}
   else{prog(c,t,o);g=o.seg;if(g.type===0){if(c.alts&&!g.hold&&altOf(c,g.lapBase+1,o.d)){/* off the road on its own path: nobody reacts to it */}else{f=1;s=sw(o.d);b=baseLat(c,g,o.d,ob);l=ob.lock;}}else if(g.type===1)q=o.d;}
   if(q>=0&&(q<QV0||q>QV1)){pitTrk(q,c===SC?o.lat:pitLat(c,g,q),_t);f=2;s=sw(_t.s);b=_t.lat;l=1;}
   on[ci][k]=f;sS[ci][k]=s;vS[ci][k]=o.v;bS[ci][k]=b;lk[ci][k]=l;}}
 /* B: pairs that come close, as a need 0..1 per sample (1 = they overlap lengthwise at some moment around the sample) */
 const P=new Map(),idx=[],lastK=new Int32Array(NA*NA).fill(-9),lastG=new Float32Array(NA*NA),lastU=new Float32Array(NA*NA);
 for(let k=0;k<=LN;k++){idx.length=0;for(let ci=0;ci<NA;ci++)if(on[ci][k])idx.push(ci);const n=idx.length;if(n<2)continue;
  idx.sort((p,q)=>sS[p][k]-sS[q][k]);
  for(let i=0;i<n;i++)for(let d=1;d<n;d++){const ia=idx[i],ib=idx[(i+d)%n],gap=fwd(sS[ia][k],sS[ib][k]);if(gap>RNG)break;if(on[ia][k]===2&&on[ib][k]===2)continue;
   const a=ia<ib?ia:ib,b=ia<ib?ib:ia,key=a*NA+b,g=ia===a?-gap:gap;
   /* the inside of a tight corner is shorter than the centre line */
   const sm=sS[ia][k]+gap*.5,kap=Math.max(Math.abs(tAt(TK,sS[ia][k])),Math.abs(tAt(TK,sm)),Math.abs(tAt(TK,sS[ib][k]))),sg=tAt(TK,sm)>=0?1:-1,xin=sg*(bS[a][k]+bS[b][k])*.5+.8,f=clamp(1-kap*clamp(xin,0,3.5),.5,1);
   let u=sstep(G0,G1,gap*f),up=0,cross=false;
   if(lastK[key]===k-1){up=lastU[key];cross=lastG[key]*g<0;}
   const un=cross?1:Math.max(u,up),E=P.get(key)||(P.set(key,{a,b,ks:[],us:[]}),P.get(key));
   if(lastK[key]===k-1&&(cross||u>up)){/* the sample before also covers this moment */const m=E.ks.length-1,uv=cross?1:u;if(m>=0&&E.ks[m]===k-1){if(E.us[m]<uv)E.us[m]=uv;}else{E.ks.push(k-1);E.us.push(uv);}}
   if(un>0){E.ks.push(k);E.us.push(un);}
   lastK[key]=k;lastG[key]=g;lastU[key]=u;}}
 const RHO=[];for(let d=0;d<=NR;d++)RHO.push(d<=1?1:.5*(1+Math.cos(PI*(d-1)/NR)));
 const eps=[];
 P.forEach(E=>{const ks=E.ks,us=E.us;let i=0;while(i<ks.length){let j=i;while(j+1<ks.length&&ks[j+1]-ks[j]<=2*NR+2)j++;
   const k0=Math.max(0,ks[i]-NR),k1=Math.min(LN,ks[j]+NR),r=new Float32Array(k1-k0+1);let um=0,km=ks[i];
   for(let q=i;q<=j;q++){const u=us[q];if(u>um){um=u;km=ks[q];}for(let d=-NR;d<=NR;d++){const kk=ks[q]+d;if(kk<k0||kk>k1)continue;const v=u*RHO[d<0?-d:d];if(v>r[kk-k0])r[kk-k0]=v;}}
   eps.push({a:E.a,b:E.b,k0,k1,r,sig:0,km});i=j+1;}});
 eps.sort((p,q)=>p.k0-q.k0||p.a-q.a||p.b-q.b);latStats.episodes=eps.length;
 /* C: sweep through time; each pair keeps the side it is given when it first comes into play */
 const x=new Float32Array(NA),xp=new Float32Array(NA),act=[];let ep=0;
 const reach=(from,to)=>{const seen=[from],st=[from];while(st.length){const u=st.pop();for(const E of act){if(!E.sig)continue;const p=E.sig>0?E.a:E.b,q=E.sig>0?E.b:E.a;if(p!==u||seen.indexOf(q)>=0)continue;if(q===to)return true;seen.push(q);st.push(q);}}return false;};
 const side=(E,k)=>{const a=E.a,b=E.b,km=E.km,la=lk[a][km]>.5,lb=lk[b][km]>.5,db=bS[a][km]-bS[b][km];
  if(la&&lb)return db>=0?1:-1;
  if(reach(a,b))return 1;if(reach(b,a))return -1;
  if(la||lb){if(Math.abs(db)>.6)return db>0?1:-1;const L=la?bS[a][km]:bS[b][km];return (L>0)===!!la?1:-1;}
  const dp=k>0&&on[a][k-1]&&on[b][k-1]?xp[a]-xp[b]:0;if(Math.abs(dp)>.7)return dp>0?1:-1;if(Math.abs(db)>.7)return db>0?1:-1;
  /* in a train the cars go left and right in turn: a car that already has to move left for one neighbour stays left of the next */
  let pl=0;for(const F of act){if(!F.sig)continue;if(F.a===a||F.b===b)pl+=F.sig;if(F.b===a||F.a===b)pl-=F.sig;}if(pl)return pl>0?1:-1;
  /* the faster car takes the inside of the next corner; on a straight it leaves the racing line to the other car */
  const fa=vS[a][km]>=vS[b][km],s0=Math.max(sS[a][km],sS[b][km]);let kk=0;for(let q=0;q<160;q+=8)kk+=tAt(TKW,s0+q);
  const ins=Math.abs(kk)>.03?(kk>0?1:-1):(tAt(TRL,s0)>0?-1:1);return fa?ins:-ins;};
 for(let k=0;k<=LN;k++){
  for(let i=act.length-1;i>=0;i--)if(act[i].k1<k)act.splice(i,1);
  while(ep<eps.length&&eps[ep].k0<=k){const E=eps[ep++];E.sig=side(E,k);act.push(E);}
  for(let ci=0;ci<NA;ci++)x[ci]=bS[ci][k];
  if(act.length){for(let it=0;it<60;it++){let mv=0;for(const E of act){const a=E.a,b=E.b;if(!on[a][k]||!on[b][k])continue;const w=E.r[k-E.k0];if(w<=0)continue;
     const sg=E.sig,nat=sg*(bS[a][k]-bS[b][k]);if(nat>=SEP)continue;const req=nat+(SEP-nat)*w,e=req-sg*(x[a]-x[b]);if(e<1e-3)continue;const ma=1-lk[a][k],mb=1-lk[b][k],ms=ma+mb;if(ms<.02)continue;if(e>mv)mv=e;
     /* each gives way in proportion to how free it is; a car is never pushed off the road (beyond LIM) unless its own line is out there */
     if(ma>0){const ba=bS[a][k];x[a]=clamp(x[a]+sg*e*ma/ms,Math.min(-LIM,ba),Math.max(LIM,ba));}if(mb>0){const bb=bS[b][k];x[b]=clamp(x[b]-sg*e*mb/ms,Math.min(-LIM,bb),Math.max(LIM,bb));}}
    if(mv<.002)break;}
   for(const E of act){const a=E.a,b=E.b;if(!on[a][k]||!on[b][k]||E.r[k-E.k0]<.999||lk[a][k]+lk[b][k]>1.98)continue;const d=E.sig*(x[a]-x[b]);if(d<SEP-.25){latStats.unsolved++;if(SEP-d>latStats.worst)latStats.worst=SEP-d;}}}
  for(let ci=0;ci<NA;ci++){const A=ALL[ci].latA,Dp=ALL[ci].dispA;if(on[ci][k]===1){const dv=x[ci]-bS[ci][k];A[k]=x[ci];Dp[k]=dv;if(k>0&&on[ci][k-1]!==1){A[k-1]=x[ci];Dp[k-1]=dv;if(k>1&&on[ci][k-2]!==1){A[k-2]=x[ci];Dp[k-2]=dv;}}}else{A[k]=k>0?A[k-1]:0;Dp[k]=k>0?Dp[k-1]:0;}xp[ci]=x[ci];}}
 /* D: how far from the centre line the car bodies get, per track sample (for paving the run-offs) */
 for(let ci=0;ci<NA;ci++){const A=ALL[ci].latA;let pi=-1,pl=0;for(let k=0;k<=LN;k++){if(on[ci][k]!==1){pi=-1;continue;}const i=Math.round(sS[ci][k]/DS),l=A[k];
   if(pi>=0){const n=wi(i-pi);if(n>1&&n<90)for(let j=1;j<n;j++)extPut(pi+j,pl+(l-pl)*j/n,EXT_HW);}
   extPut(i,l,EXT_HW);pi=i;pl=l;}}
 cars.forEach(c=>c.segs.forEach(g=>{if(!g.hold||g.type!==0||g.gone)return;const y=g.yaw||0,l=g.grid?c.slotLat:(g.lat||0),hw=2.8*Math.abs(Math.sin(y))+EXT_HW*Math.abs(Math.cos(y)),n=Math.ceil((2.8*Math.abs(Math.cos(y))+EXT_HW*Math.abs(Math.sin(y)))/DS),i0=Math.round(sw(g.d)/DS);for(let j=-n;j<=n;j++)extPut(i0+j,l,hw);}));
 cars.forEach(c=>(c.alts||[]).forEach(a=>{const q={};for(let j=0;j<a.X.length;j++){const l=nearLat(a.X[j],a.Z[j],a.s0+(a.s1-a.s0)*j/(a.X.length-1),q);extPut(q.i,l,EXT_HW+.3);extPut(q.i+1,l,EXT_HW+.3);extPut(q.i-1,l,EXT_HW+.3);}}));
 for(let i=0;i<TN;i++){latExtent.max[i]=latExtent.L[i];latExtent.min[i]=-latExtent.R[i];}}
/* lateral position at any time: the car's own line, evaluated exactly, plus the sampled sideways move made for other cars */
/* monotone cubic through the samples: no step in the sideways speed, and never outside the two samples around t */
const dispAt=(c,t)=>{const A=c.dispA,f=clamp((t-LT0)/LH,0,LN),i=Math.min(LN-1,Math.floor(f)),u=f-i,y0=A[i],y1=A[i+1],s1=y1-y0;if(s1===0)return y0;
 const s0=i>0?y0-A[i-1]:s1,s2=i<LN-1?A[i+2]-y1:s1,m0=s0*s1<=0?0:2*s0*s1/(s0+s1),m1=s1*s2<=0?0:2*s1*s2/(s1+s2),u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*y0+(u3-2*u2+u)*m0+(3*u2-2*u3)*y1+(u3-u2)*m1;};
const _r={},_rb={};
const latOn=(c,g,d,t)=>g.hold?(g.grid?c.slotLat:(g.lat||0)):baseLat(c,g,d,_rb)+dispAt(c,t);
/* NaN when the car is not on the track (pit path, hidden, or off the road on a path of its own) */
function latTr(c,t){if(c===SC){scProg(t,_r);return _r.type===0?scBase(_r,_rb)+dispAt(c,t):NaN;}prog(c,t,_r);const g=_r.seg;if(g.type!==0||(c.alts&&!g.hold&&altOf(c,g.lapBase+1,_r.d)))return NaN;return latOn(c,g,_r.d,t);}
function latAt(c,t){const l=latTr(c,t);if(l===l)return l;return _r.type===1?(c===SC?_r.lat:pitLat(c,_r.seg,_r.d)):0;}

/* ---------- full state of a car for drawing ---------- */
const _a={},_b={};
function carState(c,t,o){o=o||{};
 if(c===SC){scProg(t,_p);o.type=_p.type;o.vis=true;o.v=_p.v;o.D=_p.D;o.d=_p.d;o.lights=_p.lights;o.out=_p.out;
  if(_p.type===0){o.lat=scBase(_p,_rb)+dispAt(c,t);trackPos(_p.d,o.lat,o);o.h+=yawOf(c,t,_p.v,o.lat);}
  else{o.lat=_p.lat;if(o.out&&_p.v>.05)pitPose(_p.d,t<scTJ?scLatOut:scLatIn,o);else pitPos(_p.d,o.lat,o);}
  return o;}
 prog(c,t,_p);const g=_p.seg;o.type=g.type;o.seg=g;o.v=_p.v;o.D=_p.D;o.d=_p.d;o.vis=g.type!==2;o.lap=g.lapBase+1;
 if(g.type===0){const a=c.alts&&!g.hold?altOf(c,g.lapBase+1,_p.d):null;
  if(a){altPos(a,_p.d,o);o.lat=nearLat(o.x,o.z,_p.d);o.alt=true;}
  else{o.alt=false;o.lat=latOn(c,g,_p.d,t);trackPos(_p.d,o.lat,o);o.h+=g.yaw?g.yaw:g.hold?0:yawOf(c,t,_p.v,o.lat);}}
 else if(g.type===1){o.lat=pitLat(c,g,_p.d);if(g.hold)pitPos(_p.d,o.lat,o);else{_pc=c;_pg=g;pitPose(_p.d,plCur,o);}}
 return o;}
let _pc=null,_pg=null;const plCur=q=>pitLat(_pc,_pg,q),scLatOut=q=>-5.2*(1-sstep(Q_SC,Q_SC+40,q)),scLatIn=q=>-5.2*sstep(Q_SC-60,Q_SC,q);
/* the car points along its path: track direction plus the angle of its sideways motion (l0 = lateral now) */
function yawOf(c,t,v,l0){if(v<1.5)return 0;const h=.15,a=latTr(c,t-h),b=latTr(c,t+h);let dl;if(a===a&&b===b)dl=(b-a)/(2*h);else if(b===b)dl=(b-l0)/h;else if(a===a)dl=(l0-a)/h;else return 0;return clamp(Math.atan2(dl,Math.max(v,6)),-.22,.22);}

/* ---------- running order, laps, tyres ---------- */
function lapsDone(c,t){let n=0;const C=c.cum;while(n<c.N&&C[n]<=t)n++;return n;}
function order(t){const a=cars.map(c=>{prog(c,t,_p);const done=lapsDone(c,t),out=_p.seg.gone||(_p.seg.wreck)||(c.outT!=null&&t>=c.outT);return {c,D:_p.D,done,out,last:done?c.cum[done-1]:0};});
 a.sort((x,y)=>(x.out!==y.out)?(x.out?1:-1):x.out?(y.done-x.done)||(x.last-y.last):t>=T_FIN&&x.done===x.c.N&&y.done===y.c.N?(y.done-x.done)||(x.last-y.last):y.D-x.D);return a;}
function tyre(c,t){let k=0;for(const s of c.stopInfo)if(t>=(s.t0+s.t1)/2)k++;const done=lapsDone(c,t),since=k?c.stopInfo[k-1].lap:0;return {comp:c.comp[Math.min(k,c.comp.length-1)],age:Math.max(0,done-since),stops:k};}
function leaderLap(t){let m=0;for(const c of cars){const d=lapsDone(c,t);if(d>m)m=d;}return clamp(m+1,1,58);}
/* fastest lap so far (real lap times of completed laps) */
const FLAPS=[];cars.forEach(c=>c.lapT.forEach((v,i)=>FLAPS.push({t:c.cum[i],v,c,lap:i+1})));FLAPS.sort((a,b)=>a.t-b.t);{let b=null;FLAPS.forEach(f=>{if(!b||f.v<b.v)b=f;f.best=b;});}
function fastest(t){let lo=-1,hi=FLAPS.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(FLAPS[m].t<=t)lo=m;else hi=m-1;}return lo<0?null:FLAPS[lo].best;}
const PTS=EX.points;
function title(t){const o=order(t),fl=fastest(t),r={};['VER','HAM'].forEach(k=>{const i=o.findIndex(e=>e.c.code===k),e=o[i];let p=e.out?0:(PTS[i]||0);if(fl&&fl.c.code===k&&i<10&&!e.out)p+=1;r[k]={pos:i+1,pts:EX.championship.before[k]+p,add:p};});
 r.lead=r.VER.pts>r.HAM.pts?'VER':r.HAM.pts>r.VER.pts?'HAM':'VER';return r;}

/* ---------- race control state and log ---------- */
const tPass=(()=>{let a=H.cum[56],b=H.cum[57];for(let i=0;i<50;i++){const m=(a+b)/2;if(prog(V,m,_p).D<prog(H,m,_q).D)a=m;else b=m;}return (a+b)/2;})();
const sPass=sw(prog(V,tPass,_p).D);
const LAT=carBy.LAT,GIO=carBy.GIO,RAI=carBy.RAI,RUS=carBy.RUS;
function status(t){if(t<-6)return {k:'grid',txt:'ON THE GRID',cls:'warn'};if(t<0)return {k:'lights',txt:'LIGHTS '+Math.min(5,Math.floor(t+6)+1)+' / 5',cls:'bad',n:Math.min(5,Math.floor(t+6)+1)};
 if(t>=T_FIN)return {k:'flag',txt:'CHEQUERED FLAG',cls:''};
 if(t>=SC0&&t<H.cum[56])return {k:'sc',txt:t>=T_HOLD?'SAFETY CAR · IN THIS LAP':'SAFETY CAR',cls:'warn'};
 if(t>=VSC0&&t<VSC1)return {k:'vsc',txt:'VIRTUAL SAFETY CAR',cls:'warn'};
 if(t>=LAT.incT&&t<SC0)return {k:'yellow',txt:'YELLOW · TURN 14',cls:'warn',corner:14};
 if(t>=GIO.incT&&t<VSC0)return {k:'yellow',txt:'YELLOW · TURN 9',cls:'warn',corner:9};
 if(t>=RAI.incT&&t<RAI.incT+40)return {k:'yellow',txt:'YELLOW · TURN 6',cls:'warn',corner:6};
 return {k:'green',txt:'GREEN FLAG',cls:''};}
const tT6=timeAtS(V,1,s6-150);
const LOG=[];const log=(t,lvl,text)=>LOG.push({t,lvl,text,lap:0});
EX.events.forEach(e=>{});
log(-6,'','Start procedure. 19 cars on the grid; slot 20 is empty (Mazepin withdrawn before the race).');
log(.5,'','Lights out. Hamilton, on medium tyres from second, gets the better start and leads Verstappen into Turn 1.');
log(timeAtS(V,1,s6)+2,'w','Turn 6: Verstappen brakes late down the inside. Both run wide; Hamilton crosses the run-off, misses Turn 7 and stays in front.');
log(timeAtS(V,1,s6)+38,'','Race control: no investigation necessary. Gap at the end of lap 1: 1.114 s.');
cars.forEach(c=>c.stopInfo.forEach(s=>log(s.t1,'',c.code+' pit stop on lap '+s.lap+' · '+({S:'soft',M:'medium',H:'hard'})[s.from]+' to '+({S:'soft',M:'medium',H:'hard'})[s.to]+' · '+s.dur.toFixed(1)+' s in the pit lane')));
log(H.cum[13]+2,'','Hamilton pits a lap after Verstappen. Perez stays out and leads.');
log(timeAtS(H,20,s5),'w','Lap 20: Hamilton catches Perez, who is on old soft tyres. They swap places between Turn 6 and Turn 9; Perez is back in front.');
log(timeAtS(H,21,s6)+3,'w','Lap 21: Hamilton gets by for good. Verstappen has closed from 8.7 s to under 2 s. Perez lets his team-mate through and pits.');
log(RAI.incT,'w','Raikkonen has a brake problem and brushes the barrier at Turn 6.');log(RAI.outT,'b','Raikkonen retires in the pit lane. It is his last Grand Prix.');
log(RUS.outT,'b','Russell retires in the pit lane with a gearbox problem.');
log(GIO.incT,'w','Giovinazzi stops at the side of the track at Turn 9 with a gearbox problem. Yellow flags.');
log(VSC0,'w','Virtual safety car deployed.');log(VSC1,'','Virtual safety car ending. Verstappen pitted for new hard tyres; Hamilton stayed out.');
log(carBy.NOR.stopInfo.length>1?carBy.NOR.stopInfo[1].t0-20:0,'','Norris pits with a slow puncture.');
log(LAT.incT+1,'b','Latifi, who ran wide at Turn 9 while fighting Schumacher, hits the barrier at the exit of Turn 14.');
log(SC0,'w','Safety car deployed.');
log(V.stopInfo[2]?V.stopInfo[2].t1+1:SC0+60,'w','Verstappen pits for soft tyres. Hamilton stays out on hard tyres fitted on lap 14 to keep track position.');
log(carBy.PER.outT,'b','Perez retires in the pits.');
log(H.cum[55]+8,'w','Five lapped cars (Norris, Alonso, Ocon, Leclerc, Vettel) sit between Hamilton and Verstappen in the queue.');
log(H.cum[55]+36,'w','Race control: lapped cars will not be allowed to overtake.');
log(RELEASE.NOR-2,'w','Race control: the five cars between Hamilton and Verstappen may overtake the safety car. Ricciardo, Stroll and Schumacher stay where they are.');
log(T_HOLD,'w','Safety car in this lap.');
log(H.cum[56],'','Green flag for the final lap. Verstappen is 0.456 s behind. DRS is not available after a restart.');
log(tPass,'b','Turn 5: Verstappen, on five-lap-old soft tyres, dives down the inside and takes the lead.');
log(timeAtS(V,58,s9)+1,'w','Hamilton draws alongside on the run to Turn 9. Verstappen keeps the inside and stays ahead.');
log(T_FIN,'','Chequered flag. Verstappen wins by 2.256 s and is World Champion. Sainz is third.');
LOG.sort((a,b)=>a.t-b.t);LOG.forEach(l=>l.lap=leaderLap(Math.max(0,l.t)));
const CHAPTERS=[{id:'lights',name:'Lights out',t:-10,dur:42},{id:'t6',name:'Lap 1 · Turn 6',t:tT6-6,dur:26},{id:'stops',name:'First stops',t:V.stopInfo[0].t0-24,dur:60},{id:'perez',name:'Perez holds up Hamilton',t:timeAtS(H,20,s5)-10,dur:125},
 {id:'vsc',name:'Virtual safety car',t:GIO.incT-12,dur:50},{id:'latifi',name:'Latifi crash · safety car',t:LAT.incT-14,dur:70},{id:'unlap',name:'Lapped cars released',t:RELEASE.NOR-10,dur:44},{id:'final',name:'Final lap',t:H.cum[56]-25,dur:25+90+40},{id:'flag',name:'Chequered flag',t:T_FIN-12,dur:60}];

/* ---------- self check ---------- */
/* car body for the overlap test: a capsule, half length 1.85 m, radius 0.95 m (5.6 m by 1.9 m) */
const CAP_H=1.85,CAP_R=.95;
const pSegD=(px,pz,ax,az,bx,bz)=>{const vx=bx-ax,vz=bz-az,l=vx*vx+vz*vz,u=l>0?clamp(((px-ax)*vx+(pz-az)*vz)/l,0,1):0;return Math.hypot(px-ax-vx*u,pz-az-vz*u);};
/* distance between the centre segments of two cars given as {x,z,h}; the bodies touch when it is under 2*CAP_R */
function capDist(A,B){const ax=Math.sin(A.h)*CAP_H,az=Math.cos(A.h)*CAP_H,bx=Math.sin(B.h)*CAP_H,bz=Math.cos(B.h)*CAP_H,
 a0x=A.x-ax,a0z=A.z-az,a1x=A.x+ax,a1z=A.z+az,b0x=B.x-bx,b0z=B.z-bz,b1x=B.x+bx,b1z=B.z+bz,
 cr=(ox,oz,px,pz,qx,qz)=>(px-ox)*(qz-oz)-(pz-oz)*(qx-ox);
 if(cr(b0x,b0z,b1x,b1z,a0x,a0z)*cr(b0x,b0z,b1x,b1z,a1x,a1z)<0&&cr(a0x,a0z,a1x,a1z,b0x,b0z)*cr(a0x,a0z,a1x,a1z,b1x,b1z)<0)return 0;
 return Math.min(pSegD(a0x,a0z,b0x,b0z,b1x,b1z),pSegD(a1x,a1z,b0x,b0z,b1x,b1z),pSegD(b0x,b0z,a0x,a0z,a1x,a1z),pSegD(b1x,b1z,a0x,a0z,a1x,a1z));}
const wrapH=g=>g-TLEN*Math.round(g/TLEN);
/* places where the lead between two cars changes inside [ta,tb]: [{t,s,ahead}] */
function leadChanges(A,B,ta,tb){const out=[],h=.05;let pg=null,pt=ta;for(let t=ta;t<=tb+1e-9;t+=h){const g=prog(A,t,_p).D-prog(B,t,_q).D;if(pg!==null&&pg*g<0){let a=pt,b=t;for(let i=0;i<30;i++){const m=(a+b)/2,gm=prog(A,m,_p).D-prog(B,m,_q).D;if(gm*pg>0)a=m;else b=m;}out.push({t:+b.toFixed(2),s:+sw(prog(A,b,_p).D).toFixed(0),ahead:g>0?A.code:B.code});}if(g!==0){pg=g;pt=t;}}return out;}
function validate(opt){opt=opt||{};const res={};let maxErr=0,worst='',mism=0;
 cars.forEach(c=>{for(let n=1;n<=c.N;n++){const T=c.cum[n-1],sp=lapSpan(c,n),a=timeAtD(c,n*TLEN-1e-4,sp[0]-.5,Math.min(sp[1]+2,TMAX)),e=Math.abs(a-T);if(e>maxErr){maxErr=e;worst=c.code+' lap '+n;}}});
 res.maxLineErr=+maxErr.toFixed(4);res.worstLine=worst;
 /* order at each line crossing against the recorded position */
 cars.forEach(c=>{for(let n=1;n<=c.N;n++){const T=c.cum[n-1];let pos=1;for(const o of cars){if(o===c)continue;if(o.N>=n&&o.cum[n-1]<T)pos++;}if(pos!==c.lapP[n-1])mism++;}});
 res.dataOrderMismatch=mism;
 /* replay order just after each crossing equals the data order (cars on the same lap) */
 let roadMis=0;const rm=[];cars.forEach(c=>{for(let n=1;n<=c.N;n++){const T=c.cum[n-1]+.02;prog(c,T,_p);const Dc=_p.D;for(const o of cars){if(o===c||o.N<n)continue;const ahead=o.cum[n-1]<c.cum[n-1];prog(o,T,_q);if(o.outT!=null&&T>o.outT)continue;if(ahead!==(_q.D>Dc)&&Math.abs(o.cum[n-1]-c.cum[n-1])>.03){roadMis++;if(rm.length<6)rm.push(c.code+'/'+o.code+' L'+n);}}}});
 res.roadOrderMismatch=roadMis;res.roadOrderExamples=rm;
 /* 10 Hz sweep over the whole race: body overlap, speed, acceleration, position jumps, passes under the safety car */
 const dt=opt.dt||.1,t0=opt.t0!=null?opt.t0:LT0,t1=opt.t1!=null?opt.t1:TEND,NT=Math.round((t1-t0)/dt),n=ALL.length,S=ALL.map(()=>({})),P=ALL.map(()=>({on:false,x:0,z:0,v:0,tr:false})),gp=new Float64Array(n*n).fill(NaN);
 const open={},eps=[],pairs={},scPass=[],jumps=[],aC=[],aT=[],qMax=[0,0],qMaxAt=['',''];let qMin=1e9,qMinAt='',paMax=0,paAt='',lrMax=0,lrAt='',latMax=0,latAtW='',dMin=1e9,dMinAt='',ov=0,pitOv=0,vmax=0,amax=0,vWho='',aWho='',scMin=1e9,scMinAt='',relPass=0;
 for(let it=0;it<=NT;it++){const t=t0+it*dt;let hitT=false,hitP=false;
  ALL.forEach((c,i)=>{const s=S[i],p=P[i];carState(c,t,s);s.on=!!s.vis&&s.type!==2;s.tr=s.on&&s.type===0&&!(s.seg&&s.seg.hold);
   if(s.on){if(s.v>vmax){vmax=s.v;vWho=c.code+' t='+t.toFixed(1);}
    if(p.on){const a=Math.abs(s.v-p.v)/dt;if(a>amax){amax=a;aWho=c.code+' t='+t.toFixed(1);}if(a>(aC[i]||0)){aC[i]=a;aT[i]=t;}
     /* a jump in position shows as a huge acceleration of the drawn point (second difference); real ones stay under about 80 */
     if(p.on2){const pa=Math.hypot(s.x-2*p.x+p.x2,s.z-2*p.z+p.z2)/(dt*dt);if(pa>paMax){paMax=pa;paAt=c.code+' t='+t.toFixed(1);}if(pa>150&&jumps.length<40)jumps.push({c:c.code,t:+t.toFixed(1),pathAccel:+pa.toFixed(0),v:+s.v.toFixed(1)});}
     if(s.tr&&p.tr&&!s.alt&&!p.alt){const lr=Math.abs(s.lat-p.lat)/dt;if(lr>lrMax){lrMax=lr;lrAt=c.code+' t='+t.toFixed(1);}}}
    if(s.tr&&!s.alt&&!(s.seg&&s.seg.inc)&&Math.abs(s.lat)>latMax){latMax=Math.abs(s.lat);latAtW=c.code+' t='+t.toFixed(1);}}
   });
  for(let a=0;a<n;a++){const A=S[a];if(!A.on)continue;for(let b=a+1;b<n;b++){const B=S[b];if(!B.on)continue;
    /* road order: who is ahead, for pairs that are both running on the track */
    if(A.tr&&B.tr){const g=wrapH(A.D-B.D),pg=gp[a*n+b];if(pg===pg&&pg*g<0&&Math.abs(g)<80&&Math.abs(pg)<80&&t>SC0+6&&t<H.cum[56]){const pa=g>0?ALL[a]:ALL[b],pd=g>0?ALL[b]:ALL[a];
       if(RELEASE[pa.code]!=null&&t>=RELEASE[pa.code]-1)relPass++;else scPass.push({t:+t.toFixed(1),passer:pa.code,passed:pd.code,s:+sw(A.D).toFixed(0)});}gp[a*n+b]=g;}else gp[a*n+b]=NaN;
    if(Math.abs(A.x-B.x)>7.6||Math.abs(A.z-B.z)>7.6||Math.abs(A.y-B.y)>2.5)continue;
    const d=capDist(A,B);if(ALL[a]===SC||ALL[b]===SC){if(S[n-1].out&&d<scMin){scMin=d;scMinAt=(ALL[a]===SC?ALL[b]:ALL[a]).code+' t='+t.toFixed(1);}}
    if(d<dMin){dMin=d;dMinAt=ALL[a].code+'/'+ALL[b].code+' t='+t.toFixed(1);}
    if(d<2*CAP_R-1e-4){const pit=A.type===1||B.type===1,key=ALL[a].code+'/'+ALL[b].code+(pit?' pit':'');pairs[key]=(pairs[key]||0)+dt;if(pit)hitP=true;else hitT=true;
     let e=open[key];if(!e||it-e.it>1){e={pair:key,t:+t.toFixed(1),dur:0,minD:d,lap:leaderLap(t),sA:+A.d.toFixed(0),sB:+B.d.toFixed(0),latA:+A.lat.toFixed(1),latB:+B.lat.toFixed(1),vA:+A.v.toFixed(0),vB:+B.v.toFixed(0)};open[key]=e;eps.push(e);}
     e.it=it;e.dur+=dt;if(d<e.minD)e.minD=d;}}}
  if(hitT)ov+=dt;if(hitP)pitOv+=dt;
  /* spacing in the queue behind the safety car (cars running on the track, without the released five once they are let go) */
  if(it%5===0&&t>SC0+90&&t<H.cum[56]){const DH=S[H.i].D,q=[];for(let i=0;i<n-1;i++){const s=S[i],c=ALL[i];if(!s.tr||(RELEASE[c.code]!=null&&t>=RELEASE[c.code]-.5))continue;q.push({c:c.code,b:sw(DH-s.D)});}
   q.sort((a,b)=>a.b-b.b);const w=t>H.cum[55]-30&&t<=H.cum[55]?0:t>T_HOLD+45?1:-1;
   for(let i=1;i<q.length;i++){const g=q[i].b-q[i-1].b,at=q[i-1].c+'/'+q[i].c+' t='+t.toFixed(0);if(g<qMin){qMin=g;qMinAt=at;}if(w>=0&&g>qMax[w]){qMax[w]=g;qMaxAt[w]=at;}}}
  for(let i=0;i<n;i++){const s=S[i],p=P[i];p.on2=p.on&&s.on;p.x2=p.x;p.z2=p.z;p.on=s.on;p.x=s.x;p.z=s.z;p.v=s.v;p.tr=s.tr;p.lat=s.lat;p.alt=s.alt;}}
 eps.forEach(e=>{delete e.it;e.dur=+e.dur.toFixed(1);e.minD=+e.minD.toFixed(2);});
 res.trackOverlapS=+ov.toFixed(1);res.pitOverlapS=+pitOv.toFixed(1);res.overlapEpisodes=eps.length;res.overlapPairs=Object.keys(pairs).map(k=>[k,+pairs[k].toFixed(1)]).sort((a,b)=>b[1]-a[1]).slice(0,8);
 res.overlapExamples=opt.list?eps:eps.slice().sort((a,b)=>b.dur-a.dur).slice(0,8);
 res.maxSpeedKmh=+(vmax*3.6).toFixed(1);res.maxSpeedAt=vWho;res.maxAccel=+amax.toFixed(1);res.maxAccelAt=aWho;res.accelTop=ALL.map((c,i)=>[c.code,+(aC[i]||0).toFixed(1),+(aT[i]||0).toFixed(1)]).sort((a,b)=>b[1]-a[1]).slice(0,opt.list?99:5);res.positionJumps=jumps.length;res.jumpExamples=jumps.slice(0,6);
 res.maxPathAccel=+paMax.toFixed(0);res.maxPathAccelAt=paAt;res.maxLatRate=+lrMax.toFixed(2);res.maxLatRateAt=lrAt;res.maxLatOnTrack=+latMax.toFixed(2);res.maxLatOnTrackAt=latAtW;
 res.closestApproach={bodyGapM:+(dMin-2*CAP_R).toFixed(2),at:dMinAt};res.latSolver=latStats;
 /* pace factors (speed relative to the reference lap) and pit stops */
 let kmin=9,kmax=0,kminW='',kmaxW='',k1max=0,k1W='';const pitRows=[],neut=(a,b)=>(a<VSC1+4&&b>VSC0)||(a<SC1+12&&b>SC0);
 cars.forEach(c=>{const lapSeg={};c.segs.forEach(g=>{if(g.fixed||g.hold||g.type!==0||!g.pc)return;const ks=[],ns=g.nk?400:60;for(let i=0;i<=ns;i++){const t=g.t0+(g.t1-g.t0)*i/ns;if(c.alts&&altOf(c,g.lapBase+1,prog(c,t,_p).d))continue;/* off the road on its own path: speed is judged along that path, see story */ks.push(g.pc.df(Mat(g.mi,t))*mat(g.mi,t));}
   const mx=Math.max.apply(null,ks),mn=Math.min.apply(null,ks);g.kmax=mx;g.kmin=mn;lapSeg[g.lap]=g;if(mx>kmax){kmax=mx;kmaxW=c.code+' lap '+g.lap;}if(mn<kmin){kmin=mn;kminW=c.code+' lap '+g.lap;}if(g.lap===1&&mx>k1max){k1max=mx;k1W=c.code;}});
  const clean=q=>{const g=lapSeg[q];return g&&q>1&&!g.inLap&&!g.outLap&&!g.nk&&!neut(g.t0,g.t1)?g.k:null;},refK=L=>{const v=L.map(clean).filter(x=>x!=null).sort((a,b)=>a-b);return v.length?v[v.length>>1]:null;};
  c.stopInfo.forEach(s=>{const gi=lapSeg[s.lap],go=lapSeg[s.lap+1],rb=refK([s.lap-1,s.lap-2,s.lap-3]),ra=refK([s.lap+2,s.lap+3,s.lap+4]),ro=ra||rb;
   pitRows.push({code:c.code,lap:s.lap,dur:+s.dur.toFixed(2),stationary:+s.st.toFixed(2),inPace:gi&&rb?+(gi.k/rb).toFixed(3):null,outPace:go&&ro?+(go.k/ro).toFixed(3):null,neutral:!!((gi&&neut(gi.t0,gi.t1))||(go&&neut(go.t0,go.t1))),boxAfterLine:c.team.boxQ>Q_LINE});});});
 res.paceMax=+kmax.toFixed(3);res.paceMaxAt=kmaxW;res.paceMin=+kmin.toFixed(3);res.paceMinAt=kminW;res.lap1PaceMax=+k1max.toFixed(3);res.lap1PaceMaxAt=k1W;res.pitStops=pitRows;
 {const g=pitRows.filter(r=>!r.neutral),st=pitRows.map(r=>r.stationary),md=a=>{a=a.filter(x=>x!=null).sort((x,y)=>x-y);return a.length?a[a.length>>1]:null;},rng=a=>{a=a.filter(x=>x!=null);return [Math.min.apply(null,a),Math.max.apply(null,a)];};
  res.pit={stops:pitRows.length,stationaryRange:rng(st),greenStops:g.length,inPaceMedian:md(g.map(r=>r.inPace)),inPaceRange:rng(g.map(r=>r.inPace)),outPaceMedian:md(g.map(r=>r.outPace)),outPaceRange:rng(g.map(r=>r.outPace)),allBoxesAfterLine:pitRows.every(r=>r.boxAfterLine)};}
 /* the stories */
 const st={};
 {const tH=timeAtS(H,1,s1-60),tV=timeAtS(V,1,s1-60);st.start={hamAheadAtT1M:+(prog(H,tH,_p).D-prog(V,tH,_q).D).toFixed(1),hamReachesT1BeforeVerS:+(tV-tH).toFixed(2),changes:leadChanges(H,V,0.5,timeAtS(V,1,s5))};
  const t6=timeAtS(V,1,s6),t7=timeAtS(V,1,s7+80),cs={};let lm=0,v0=1e9,v1=0,vv0=1e9;for(let t=t6-3;t<t7+2;t+=.05){carState(H,t,cs);lm=Math.min(lm,cs.lat);if(cs.alt){v0=Math.min(v0,cs.v);v1=Math.max(v1,cs.v);}}
  for(let t=timeAtS(V,1,s6-30);t<timeAtS(V,1,s7+70);t+=.05)vv0=Math.min(vv0,prog(V,t,_p).v);
  st.lap1T6={verMinusHamAtT6M:+(prog(V,t6,_p).D-prog(H,t6,_q).D).toFixed(1),verLat:+carState(V,t6,cs).lat.toFixed(1),hamLat:+carState(H,t6,cs).lat.toFixed(1),hamWidestLat:+lm.toFixed(1),hamRunoffKmh:[+(v0*3.6).toFixed(0),+(v1*3.6).toFixed(0)],verMinKmh:+(vv0*3.6).toFixed(0),hamAheadAfterT7M:+(prog(H,t7,_p).D-prog(V,t7,_q).D).toFixed(1),changes:leadChanges(H,V,timeAtS(V,1,s5),V.cum[0])};
  st.lap20=leadChanges(H,PZc,H.cum[18]+1,H.cum[19]-.01);st.lap21=leadChanges(H,PZc,H.cum[19]+.01,timeAtS(H,21,S_IN-10));
  st.lap21VerPer=leadChanges(V,PZc,V.cum[19]+.01,timeAtS(PZc,21,S_IN-10));
  const ch=leadChanges(V,H,H.cum[56]+.01,T_FIN-.01),t9=timeAtS(V,58,s9-80),t6b=timeAtS(V,58,s6-60);let mx=0;for(let t=tPass;t<timeAtS(V,58,s9+250);t+=.05)mx=Math.max(mx,prog(V,t,_p).D-prog(H,t,_q).D);
  st.lap58={changes:ch,verInsideAtPass:latAt(V,tPass)>latAt(H,tPass),latVer:+latAt(V,tPass).toFixed(1),latHam:+latAt(H,tPass).toFixed(1),verAheadAtT6M:+(prog(V,t6b,_p).D-prog(H,t6b,_q).D).toFixed(1),verAheadNearT9M:+(prog(V,t9,_p).D-prog(H,t9,_q).D).toFixed(1),latVerT9:+latAt(V,t9).toFixed(1),latHamT9:+latAt(H,t9).toFixed(1),maxGapBeforeT9exitM:+mx.toFixed(1)};}
 res.story=st;
 res.passT=+tPass.toFixed(2);res.passS=+sPass.toFixed(0);res.passFromT5apex=+(sPass-s5).toFixed(0);res.passLocal=clockTxt(tPass);
 /* queue behind the safety car at the end of leader lap 56: road position behind Hamilton, without wrecks and cars in the pits */
 {const tq=H.cum[55]+.001,DH=prog(H,tq,_p).D,q=cars.map(c=>{prog(c,tq,_p);return {c:c.code,back:sw(DH-_p.D),ok:_p.seg.type===0&&!_p.seg.hold};}).filter(e=>e.ok).sort((a,b)=>a.back-b.back);
  res.queueEndL56=q.map(e=>e.c).join(' ');res.queueSpreadM=+q[q.length-1].back.toFixed(0);res.queueGapsM=q.slice(1).map((e,i)=>+(e.back-q[i].back).toFixed(0));}
 res.queue={minSpacingM:+qMin.toFixed(1),minSpacingAt:qMinAt,maxGapEndL56M:+qMax[0].toFixed(0),maxGapEndL56At:qMaxAt[0],maxGapLap57M:+qMax[1].toFixed(0),maxGapLap57At:qMaxAt[1]};
 res.scPassesNotAllowed=scPass.length;res.scPassExamples=scPass.slice(0,opt.list?999:8);res.scReleasedPasses=relPass;
 res.margin=+(H.cum[57]-V.cum[57]).toFixed(3);res.winner=order(T_FIN+.01)[0].c.code;res.LREF=+LREF.toFixed(2);res.TLEN=+TLEN.toFixed(1);
 res.sc={leaves:+scT0.toFixed(1),joins:+scTJ.toFixed(1),peels:+scTP.toFixed(1),parks:+scT1.toFixed(1),closestBodyM:+(scMin-2*CAP_R).toFixed(2),closestAt:scMinAt};
 return res;}
const T0CLOCK=17*3600+3*60+24;
function clockTxt(t){const x=Math.round(T0CLOCK+t),h=Math.floor(x/3600),m=Math.floor(x/60)%60,s=x%60;return h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;}

return {TN,DS,get TLEN(){return TLEN;},TX,TZ,NX,NZ,TH,TK,TKW,TV,TRL,HW,LATMAX,CORNERS,cornerS,sw,fwd,tAt,tvAt,trackPos,pitPos,pitY,PN,PDS,PLEN,PX,PZ,PNX,PNZ,PH,S_IN,S_OUT,Q_LINE,Q_LIM0,Q_LIM1,Q_TUN0,Q_TUN1,Q_SC,BOXLAT,sEq,
 TEAMS,teamByCode,cars,carBy,DNS,SC,ALL,LREF,T_FIN,TEND,TMIN,VSC0,VSC1,SC0,SC1,RELEASE,T_HOLD,PARK,prog,carState,scProg,order,tyre,lapsDone,leaderLap,fastest,title,status,LOG,CHAPTERS,tPass,sPass,tT6,timeAtS,timeAtD,validate,clockTxt,latAt,mat,
 scT0,scTJ,scTP,scT1,lapSpan,
 /* added later */
 capDist,leadChanges,Q_LOOP1,V_LIM,pitInfo,PFQ,PFGAP,PFLAT,latStats,latExtent};}
if(typeof module!=='undefined')module.exports=makeKernel;
