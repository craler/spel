'use strict';
// ---- Utseende: things for the dove to wear, unlocked by playing and kept in this browser.
// Not live yet: the menu page and the looks only appear with ?looks=1 in the address, for trying them out.
const looksLive=testSite||/[?&]looks=1/.test(location.search); // not finished: only on the test site for now
// On the test site (raw.githack.com) there is a button that unlocks everything, for trying the looks out.
let unlockAll=false;try{unlockAll=testSite&&localStorage.getItem('fagelbajs.unlockAll')==='yes';}catch{}
// Lifetime progress, saved on this device: points over all flights, the most stars reached, events completed.
let stats={total:0,maxStars:0,events:0};
try{Object.assign(stats,JSON.parse(localStorage.getItem('fagelbajs.stats')||'{}'));}catch{}
function saveStats(){try{localStorage.setItem('fagelbajs.stats',JSON.stringify(stats));}catch{}}
const lookList=[
 {id:'keps',name:'Röd keps',slot:'head',need:'Flyg en gång',have:()=>[Math.min(flights,1),1]},
 {id:'halsduk',name:'Halsduk',slot:'neck',need:'1 000 poäng totalt',have:()=>[stats.total,1000]},
 {id:'brillor',name:'Solglasögon',slot:'eyes',need:'Nå tre stjärnor',have:()=>[Math.min(stats.maxStars,3),3]},
 {id:'pannband',name:'Ninjapannband',slot:'head',need:'Bedriften Kombokung (kombo ×8)',have:()=>[+done.has('combo'),1]},
 {id:'hatt',name:'Hög hatt',slot:'head',need:'Bedriften Objuden gäst',have:()=>[+done.has('wedding'),1]},
 {id:'krona',name:'Krona',slot:'head',need:'Nå fem stjärnor',have:()=>[Math.min(stats.maxStars,5),5]},
 {id:'mantel',name:'Röd mantel',slot:'back',need:'Flyg tio gånger',have:()=>[Math.min(flights,10),10]},
 {id:'guld',name:'Guldbajs',slot:'poop',need:'10 000 poäng totalt',have:()=>[stats.total,10000]},
];
let worn={};try{worn=JSON.parse(localStorage.getItem('fagelbajs.look')||'{}');}catch{}
const unlocked=l=>{if(unlockAll)return true;const [a,b]=l.have();return a>=b;};
function wearing(slot){if(!looksLive)return null;const id=worn[slot],l=lookList.find(l=>l.id===id);return l&&unlocked(l)?id:null;}
function wear(id){
 const l=lookList.find(l=>l.id===id);if(!l||!unlocked(l))return;
 worn[l.slot]=worn[l.slot]===id?null:id;try{localStorage.setItem('fagelbajs.look',JSON.stringify(worn));}catch{}applyLook();
}
// Colours that follow the look: a pink body and wings, golden droppings.
const normalGoo=['#efe9d2','#e2dbb4','#d3cf9a','#f4f0e2','#c9c08a'],goldGoo=['#f6cf4a','#e8b830','#ffd85e','#d9a520','#f2c84a'];
const plumeNormal={back:'#7c8aab',belly:'#a9b3c9',head:'#6a7697',rump:'#9aa6c0'},plumePink={back:'#c98bb0',belly:'#efc4dc',head:'#b8739e',rump:'#e0a8c8'};
function applyLook(){
 const pal=wearing('body')==='rosa'?plumePink:plumeNormal;for(const k in pal)plumeCol[k]=rgb(pal[k]);
 const gold=wearing('poop')==='guld',goo=(gold?goldGoo:normalGoo).map(rgb);gooShade.splice(0,gooShade.length,...goo);
 gooMat=gold?-2:-1;splatCol.splice(0,3,...rgb(gold?'#f2c84a':'#f4f1e6'));
}
// Wing and tail feathers get the body tint too, keeping their light and dark.
function tintFeather(col){if(wearing('body')!=='rosa')return col;const l=.3*col[0]+.59*col[1]+.11*col[2];return [l*1.5,l*.78,l*1.12];}
// The things it wears are modelled as smooth surfaces in the head's own frame (or the body's for the scarf), so they
// turn with the head. surface() takes a grid of points, works out smooth normals and draws it; glossy parts go
// into the wet-looking batch so they catch the light.
function surface(P,closed,col,xf,batch=dyn){
 const J=P.length,I=P[0].length,sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
 const at=(j,i)=>P[clamp(j,0,J-1)][closed?((i%I)+I)%I:clamp(i,0,I-1)];
 const W=[],Nw=[];
 for(let j=0;j<J;j++){W.push([]);Nw.push([]);for(let i=0;i<I;i++){
  const du=sub(at(j,i+1),at(j,i-1)),dv=sub(at(j+1,i),at(j-1,i));let n=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]];const l=Math.hypot(...n)||1;n=n.map(q=>q/l*.01);
  const p=P[j][i],w=xf(p),q=xf([p[0]+n[0],p[1]+n[1],p[2]+n[2]]),m=sub(q,w),ml=Math.hypot(...m)||1;W[j].push(w);Nw[j].push(m.map(v=>v/ml));}}
 const C=(j,i)=>col(j,i%I);
 for(let j=0;j<J-1;j++)for(let i=0;i<(closed?I:I-1);i++){const k=(i+1)%I;
  batch.smooth([W[j][i],W[j+1][i],W[j+1][k]],[Nw[j][i],Nw[j+1][i],Nw[j+1][k]],[C(j,i),C(j+1,i),C(j+1,k)]);
  batch.smooth([W[j][i],W[j+1][k],W[j][k]],[Nw[j][i],Nw[j+1][k],Nw[j][k]],[C(j,i),C(j+1,k),C(j,k)]);}
}
// A body of revolution round a vertical axis: profile is [radius, height] from top to bottom. tilt leans it forwards.
function lathe(prof,c,col,xf,{n=20,sx=1,sz=1,tilt=0,batch}={}){
 const st=Math.sin(tilt),ct=Math.cos(tilt);
 surface(prof.map(([r,y])=>Array.from({length:n},(_,i)=>{const a=i/n*tau,x=r*Math.cos(a)*sx,z=r*Math.sin(a)*sz;return [c[0]+x,c[1]+y*ct-z*st,c[2]+y*st+z*ct];})),true,col,xf,batch);
}
function ball(c,r,col,xf,batch){lathe(Array.from({length:7},(_,k)=>{const a=k/6*Math.PI;return [Math.sin(a)*r,Math.cos(a)*r];}),c,()=>col,xf,{n:10,batch});}
// A cloth strip from p along a direction, waving: for tails and the scarf's loose end.
function strip(p,dir,side,len,w,col,xf,wave){
 const P=[];for(let j=0;j<=8;j++){const t=j/8,f=wave(t);P.push([-1,1].map(s=>[p[0]+dir[0]*len*t+side[0]*s*w*(1-.3*t)+f[0],p[1]+dir[1]*len*t+side[1]*s*w*(1-.3*t)+f[1],p[2]+dir[2]*len*t+side[2]*s*w*(1-.3*t)+f[2]]));}
 surface(P,false,()=>col,xf);
}
// ---- Fitting to the head. The head is a run of elliptical rings along the beak axis (bodyRings in render.js);
// these read its shape so that what the dove wears hugs it instead of floating at a guessed size.
function ringAt(z){
 const R=bodyRings;if(z<=R[0][0])return R[0];if(z>=R.at(-1)[0])return R.at(-1);
 let k=0;while(R[k+1][0]<z)k++;const t=(z-R[k][0])/(R[k+1][0]-R[k][0]);return R[k].map((v,i)=>mix(v,R[k+1][i],t));
}
function inHead(x,y,z){if(z<.17||z>.444)return false;const [,cy,w,h]=ringAt(z);return (x/w)**2+((y-cy)/h)**2<1;}
// A point on the head's surface: ring at z, angle a round it (pi/2 = the crown of the head), pushed out by off.
function headPt(z,a,off){const [,cy,w,h]=ringAt(z);return [(w+off)*Math.cos(a),cy+(h+off)*Math.sin(a),z];}
// Where a horizontal slice at height y leaves the head, in the direction phi (0 = towards the beak), pushed out by off.
function rimPt(y,phi,off,cz=.33){
 const dx=Math.sin(phi),dz=Math.cos(phi);let lo=0,hi=.22;
 if(!inHead(0,y,cz))return [0,y,cz];
 for(let k=0;k<22;k++){const m=(lo+hi)/2;if(inHead(dx*m,y,cz+dz*m))lo=m;else hi=m;}
 return [dx*(lo+off),y,cz+dz*(lo+off)];
}
function drawLook(face,plain,toHead,toBody){
 if(!looksLive)return;
 const C=s=>rgb(s),head=wearing('head'),shadeOf=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
 if(head==='keps'){
  // A baseball cap moulded over the skull: six panels with stitched seams, a puffed crown, a rolled lip,
  // a button on top and a stiff curved peak with a darker underside.
  const red=C('#cf3a2e'),seam=C('#8f2018'),under=C('#5a1a14'),J=24,I=48,z0=.222,z1=.43;
  const cut=z=>mix(.318,.352,(z-z0)/(z1-z0)),lo=z=>{const [,cy,,h]=ringAt(z);return Math.asin(clamp((cut(z)-cy)/(h+.01),-1,.97));},puff=(z,a)=>.009+.026*Math.sin(a)**2*Math.sin(Math.PI*clamp((z-z0+.02)/(z1-z0+.03),0,1));
  const P=[];for(let j=0;j<=J;j++){const z=z0+(z1-z0)*j/J,row=[];
   for(let i=0;i<=I;i++){const t=i/I,a=mix(lo(z),Math.PI-lo(z),t),edge=Math.min(t,1-t);row.push(headPt(z,a,edge<.015?.009:puff(z,a)+.004));}P.push(row);}
  const seams=[.5,.31,.69];
  surface(P,false,(j,i)=>{const t=i/I,s=seams.some(q=>Math.abs(t-q)<.012);return s?seam:shadeOf(red,.82+.18*Math.sin(Math.PI*t));},toHead);
  const top=headPt(.318,Math.PI/2,puff(.318,Math.PI/2)+.004);ball(top,.012,seam,toHead);
  // the peak: two skins and a rounded front edge
  const y0=cut(z1)-.006;
  const peak=(dy,col)=>{const Q=[];for(let j=0;j<=10;j++){const t=j/10,row=[];for(let i=0;i<=16;i++){const u=i/16*2-1,w=.112*(1-.2*t*t);
   row.push([u*w,y0+.004+dy-.028*t*t-.018*u*u,z1-.045+t*.17-.035*u*u*t]);}Q.push(row);}surface(Q,false,()=>col,toHead);return Q;};
  const Tp=peak(.004,red);peak(-.002,under);
  surface([Tp.at(-1),Tp.at(-1).map(p=>[p[0],p[1]-.006,p[2]+.002])],false,()=>shadeOf(red,.8),toHead);
 }
 if(head==='hatt'){
  // A top hat resting on the crown of the head: slightly flared crown, red silk band with a gold buckle,
  // a brim that curls up at the sides with a rolled edge. Glossy.
  const black=C('#141518'),felt=C('#1f2024'),silk=C('#a3222a'),gold=C('#e0b23a'),cx=0,cz=.322,yb=.392,n=56;
  const R=(y)=>.088+.009*Math.max(0,(y-yb-.03)/.11);
  const crown=[];for(const y of [yb-.012,yb,yb+.005,yb+.03,yb+.031,yb+.07,yb+.11,yb+.14,yb+.145]){
   const r=y>=yb+.143?.06:R(y);crown.push(Array.from({length:n},(_,i)=>{const a=i/n*tau;return [cx+Math.cos(a)*r,y,cz+Math.sin(a)*r];}));}
  crown.push(Array.from({length:n},()=>[cx,yb+.148,cz]));
  surface(crown,true,(j)=>j>=2&&j<=3?silk:j>=7?black:felt,toHead);
  const brim=[];for(let j=0;j<=9;j++){const t=j/9,r=mix(.088,.172,t),row=[];
   for(let i=0;i<n;i++){const a=i/n*tau,curl=.03*Math.cos(a)**2*t*t;row.push([cx+Math.cos(a)*r,yb+.004+curl+(j===9?-.006:0),cz+Math.sin(a)*r*1.02]);}brim.push(row);}
  brim.push(brim.at(-1).map(p=>[p[0],p[1]-.008,p[2]]));brim.push(brim[0].map(p=>[p[0],p[1]-.006,p[2]]));
  surface(brim,true,()=>felt,toHead);
  const bz=cz+R(yb+.017)+.002,frame=(x0,x1,y0,y1)=>surface([[[x0,y0,bz],[x1,y0,bz]],[[x0,y1,bz],[x1,y1,bz]]],false,()=>gold,toHead,goo);
  frame(-.022,.022,yb+.026,yb+.032);frame(-.022,.022,yb+.003,yb+.009);frame(-.022,-.016,yb+.003,yb+.032);frame(.016,.022,yb+.003,yb+.032);
 }
 if(head==='krona'){
  // A gold crown that follows the shape of the head: a band with rolled rims and jewels in gold settings,
  // six points topped with pearls, and red velvet rising inside.
  const gold=C('#e6b33a'),deep=C('#b8862a'),velvet=C('#7d0f1e'),gems=['#d01f26','#2f6fbf','#2e9b5a'].map(C),n=60,y0=.384;
  const ring=(y,off)=>Array.from({length:n},(_,i)=>{const p=rimPt(y0,i/n*tau,off,.322);return [p[0],y,p[2]];});
  surface([ring(y0-.006,.007),ring(y0,.014),ring(y0+.004,.015),ring(y0+.036,.015),ring(y0+.04,.012),ring(y0+.042,.006)],true,(j)=>j===1||j===4?gold:j===0||j===5?deep:shadeOf(gold,.92),toHead,goo);
  const dome=[];for(let k=0;k<=6;k++){const t=k/6;dome.push(ring(y0+.04+.05*Math.sin(t*Math.PI/2),.012*(1-t*t)).map(p=>[mix(p[0],0,t*t),p[1],mix(p[2],.322,t*t)]));}
  surface(dome,true,()=>velvet,toHead);
  for(let k=0;k<6;k++){
   const phi=k/6*tau+.0,L=rimPt(y0,phi-.42,.015,.322),Rr=rimPt(y0,phi+.42,.015,.322),M=rimPt(y0,phi,.02,.322),tip=[M[0]*1.08,y0+.105,mix(M[2],.322,-.08)];
   const pts=[];for(let j=0;j<=6;j++){const t=j/6,row=[];for(let i=0;i<=8;i++){const u=i/8,b=[mix(L[0],Rr[0],u),y0+.04,mix(L[2],Rr[2],u)],w=Math.pow(1-Math.abs(u*2-1),.6);
    row.push([mix(b[0],tip[0],t*w+(1-w)*t*.2),mix(b[1],tip[1],t*w),mix(b[2],tip[2],t*w+(1-w)*t*.2)]);}pts.push(row);}
   surface(pts,false,(j)=>shadeOf(gold,.85+.15*j/6),toHead,goo);
   ball([tip[0],tip[1]+.01,tip[2]],.011,C('#f6f1e6'),toHead,goo);
   const g=rimPt(y0,phi,.018,.322);ball([g[0],y0+.02,g[2]],.0125,gems[k%3],toHead,goo);
   lathe([[.0165,.003],[.0175,0],[.0165,-.003]],[0,0,0],()=>gold,p=>toHead([g[0]+p[0]*Math.cos(phi),y0+.02+p[2],g[2]-p[0]*Math.sin(phi)]),{n:14,batch:goo});
  }
 }
 if(head==='pannband'){
  // A red ninja headband tied round the head just above the eyes: a cloth band with soft folded edges that follows
  // the head all the way round, a knot at the back and two long tails streaming in the wind.
  const red=C('#d01f26'),dark=C('#9a141a'),n=72,yc=phi=>.352+.006*Math.cos(phi);
  const row=(dy,off)=>Array.from({length:n},(_,i)=>{const phi=i/n*tau;return rimPt(yc(phi)+dy,phi,off);});
  surface([row(-.017,.007),row(-.014,.012),row(0,.014),row(.014,.012),row(.017,.007)],true,(j)=>j===0||j===4?dark:red,toHead);
  const back=rimPt(yc(Math.PI),Math.PI,.018);
  lathe(Array.from({length:7},(_,k)=>{const a=k/6*Math.PI;return [Math.sin(a)*.02,Math.cos(a)*.018];}),back,()=>red,toHead,{n:14,sz:.8});
  for(const s of [-1,1])ribbonEnd('band'+s,toHead([back[0]+s*.012,back[1],back[2]-.01]),12,.026,.022,red,dark);
 }
 if(wearing('eyes')==='brillor'){
  // Ordinary black sunglasses: a thick frame across the face just above the beak, two dark glossy lenses
  // that wrap a little round the sides, a bridge, and arms running back over the head's sides.
  const frame=C('#111214'),lens=C('#16202a'),glint=C('#55667c'),y=.338,off=.016;
  const at=(phi,dy,o)=>{const p=rimPt(y,phi,o,.33);return [p[0],y+dy,p[2]];};
  // Lens outline in (u across 0..1 from the nose outwards, v up -1..1): a wayfarer, straight on top, rounded below.
  const top=u=>.024+.003*u,bot=u=>-.02-.006*Math.sin(Math.PI*Math.min(1,u*1.1)),rnd=u=>Math.min(1,Math.sin(Math.PI*u)*2.4);
  for(const s of [-1,1]){
   const N=16,phis=Array.from({length:N+1},(_,i)=>s*mix(.07,.66,i/N));
   const grid=(o,grow)=>{const G=[];for(let k=0;k<=6;k++){const v=k/6;G.push(phis.map((phi,i)=>{const u=i/N,r=rnd(u),h=mix(top(u)+grow,bot(u)-grow,v);return at(phi,h*(.35+.65*r)+(1-r)*.002,o);}));}return G;};
   surface(grid(off,.006),false,()=>frame,toHead,goo);                     // the frame, a little bigger than the lens
   surface(grid(off+.004,-.001),false,(k,i)=>k===1&&i>2&&i<9?glint:k<=2?C('#22303e'):lens,toHead,goo); // the lens, with a sheen across the top
   surface([phis.map(phi=>at(phi,top(0)+.008,off+.007)),phis.map(phi=>at(phi,top(0)+.008,off-.002)),phis.map(phi=>at(phi,top(0)-.002,off+.007))],false,()=>frame,toHead,goo); // heavy top bar
   const arm=[];for(let k=0;k<=10;k++){const phi=s*mix(.66,2.2,k/10);arm.push([at(phi,.027,.009),at(phi,.017,.009)]);}surface(arm,false,()=>frame,toHead,goo);
  }
  surface([[at(-.08,.022,off+.005),at(.08,.022,off+.005)],[at(-.08,.013,off+.004),at(.08,.013,off+.004)]],false,()=>frame,toHead,goo); // the bridge over the nose
 }
 if(wearing('neck')==='halsduk'){
  // A chunky knitted scarf wrapped twice round the neck, fitted to it, striped blue and cream,
  // with one end hanging down the chest, swinging, finished with a fringe.
  const blue=C('#2f6fbf'),cream=C('#ece6d6'),n=48;
  for(const [k,z,tilt] of [[0,.19,.02],[1,.232,-.015]]){
   const P=[];for(let c=0;c<=8;c++){const q=c/8*tau,dz=Math.cos(q)*.02,doff=.018+Math.sin(q)*.016,row=[];
    for(let i=0;i<n;i++){const a=i/n*tau;row.push(headPt(z+dz+tilt*Math.sin(a),a,doff));}P.push(row);}
   surface(P.map(r=>r),true,(c,i)=>(Math.floor(i/4)+k)%2?cream:blue,toBody);
  }
  for(const [n,side] of [[0,.42],[1,.62]]){const pin=toBody(headPt(.205,-Math.PI/2+side,.035));ribbonEnd('scarf'+n,pin,13,.036,.034,n?cream:blue,n?blue:cream,true);}
 }
}
// Small pictures for the menu.
const lookIcon={
 keps:'<path d="M8 30c0-10 7-16 16-16s16 6 16 16z" fill="#d23b2f"/><path d="M30 29h16l-4 4H28z" fill="#a82a24"/>',
 halsduk:'<path d="M10 16h28v8H10z" fill="#2f6fbf"/><path d="M14 16h4v8h-4zM22 16h4v8h-4zM30 16h4v8h-4z" fill="#e8e4da"/><path d="M28 24h7l2 16h-7z" fill="#2f6fbf"/>',
 brillor:'<ellipse cx="15" cy="24" rx="9" ry="7" fill="#111318"/><ellipse cx="33" cy="24" rx="9" ry="7" fill="#111318"/><path d="M22 22h4v3h-4z" fill="#111318"/>',
 pannband:'<path d="M6 20h32v8H6z" fill="#d01f26"/><path d="M38 22l8-6 2 4-6 6zM38 26l9 3-1 4-9-3z" fill="#a8161c"/>',
 hatt:'<path d="M14 8h20v26H14z" fill="#1d1e22"/><path d="M14 26h20v4H14z" fill="#a8252b"/><path d="M6 34h36v4H6z" fill="#16171a"/>',
 rosa:'<ellipse cx="22" cy="28" rx="15" ry="11" fill="#e0a8c8"/><circle cx="34" cy="17" r="8" fill="#c98bb0"/><path d="M41 17l6 2-6 2z" fill="#58445a"/>',
 krona:'<path d="M8 36V16l8 8 8-14 8 14 8-8v20z" fill="#e8b830"/><circle cx="24" cy="10" r="3" fill="#e8323a"/>',
 mantel:'<path d="M14 8h20l8 34c-6-3-11 2-18-2-7 4-12-1-18 2z" fill="#c8102e"/><path d="M14 8h20v4H14z" fill="#e8b830"/>',
 guld:'<path d="M14 38c-6 0-6-8 1-8-3-6 4-9 7-6 1-6 9-5 9 1 7-1 8 8 2 9z" fill="#e8b830"/><circle cx="21" cy="31" r="2" fill="#fff6c8"/>',
};
function lookView(){return ['Utseende','<div class="looks">'+lookList.map(l=>{
 const [a,b]=l.have(),open=unlocked(l),on=worn[l.slot]===l.id&&open;
 return '<div class="look'+(open?'':' locked')+(on?' on':'')+'"><svg viewBox="0 0 48 48">'+lookIcon[l.id]+'</svg><b>'+l.name+'</b>'+
  (open?'<button data-look="'+l.id+'">'+(on?'Ta av':'Ta på')+'</button>':'<small>🔒 '+l.need+'</small>'+(b>1?'<i><em style="width:'+Math.min(100,100*a/b)+'%"></em></i><small>'+number(Math.min(a,b))+' / '+number(b)+'</small>':''))+'</div>';
}).join('')+'</div><p class="cause">Sparas på den här enheten.</p>'+(testSite?'<button class="back" data-unlockall="1">'+(unlockAll?'Testläge: lås igen':'Testläge: lås upp allt')+'</button>':'')];}
document.querySelector('.panel').addEventListener('click',e=>{const b=e.target.closest('button[data-look]');if(b){wear(b.dataset.look);openView('looks');}});
document.querySelector('.panel').addEventListener('click',e=>{if(!e.target.closest('button[data-unlockall]'))return;unlockAll=!unlockAll;try{localStorage.setItem('fagelbajs.unlockAll',unlockAll?'yes':'no');}catch{}applyLook();openView('looks');});
if(looksLive){const b=document.createElement('button');b.dataset.view='looks';b.textContent='Utseende';$('nav').append(b);}
// Progress is counted at the end of every flight, and when an event is completed.
function countFlight(){stats.total+=points;stats.maxStars=Math.max(stats.maxStars,wanted);saveStats();}

// ---- Röd mantel: a cape that is real cloth. A grid of points joined by springs (Verlet), pinned across the
// shoulders, pulled by gravity and by the air streaming past the bird, with a little flutter that grows with speed.
// Points that end up inside the bird's body are pushed back out, so the cape drapes over the back and tail.
const cape={cols:8,rows:17,pts:null,acc:0,pins:null};
function toBirdLocal([X,Y,Z]){ // the inverse of birdPoint()
 const b=bird,bank=(b.vb??b.bank)*1.02,pitch=flightPitch(),sy=Math.sin(b.angle),cy=Math.cos(b.angle),sb=Math.sin(bank),cb=Math.cos(bank),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const dx=X-b.x,dy=Y-b.y,dz=Z-b.z,bx=dx*cy-dz*sy,bz=dx*sy+dz*cy,by=dy*cp-bz*sp,z=dy*sp+bz*cp;
 return [bx*cb-by*sb,bx*sb+by*cb,z];
}
function capePin(i){const t=i/(cape.cols-1),a=mix(.62,Math.PI-.62,t);return birdPoint(headPt(.08,a,.022));}
function resetCape(){
 cape.pts=[];for(let j=0;j<cape.rows;j++)for(let i=0;i<cape.cols;i++){const p=capePin(i),q=toBirdLocal(p),w=birdPoint([q[0]*(1+j*.022),q[1]+.03,q[2]-j*.075]);cape.pts.push({p:w,o:w.slice()});}
 cape.rest=[];for(let i=0;i<cape.cols-1;i++){const a=capePin(i),b=capePin(i+1);cape.rest.push(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));}
}
function updateCape(dt){
 if(wearing('back')!=='mantel'){cape.pts=null;return;}
 const pins=Array.from({length:cape.cols},(_,i)=>capePin(i));
 if(!cape.pts||Math.hypot(...[0,1,2].map(k=>cape.pts[0].p[k]-pins[0][k]))>3){resetCape();cape.pins=pins;}
 const C=cape.cols,R=cape.rows,P=cape.pts,seg=.075,h=1/240,speed=Math.hypot(forwardSpeed(),bird.vy),air=airAt(),from=cape.pins||pins;
 cape.acc=Math.min(cape.acc+dt,.06);const steps=Math.floor(cape.acc/h);cape.acc-=steps*h;
 for(let s=1;s<=steps;s++){const f=s/steps;
  for(let j=0;j<R;j++)for(let i=0;i<C;i++){
   const q=P[j*C+i];if(j===0){q.o=q.p;q.p=[0,1,2].map(k=>mix(from[i][k],pins[i][k],f));q.pin=true;continue;} // the shoulders glide with the bird between frames
   const v=[(q.p[0]-q.o[0])/h,(q.p[1]-q.o[1])/h,(q.p[2]-q.o[2])/h];
   // gusts vary smoothly over the cloth, so it billows in waves instead of shivering point by point
   const t=performance.now()/1000*4-j*.35,g=.4+.1*speed,w=[air[0]+g*Math.sin(t+i*.25),air[1]+g*.8*Math.sin(t*1.2+i*.2),air[2]+g*Math.cos(t*.8)];
   const k=5,a=[(w[0]-v[0])*k,(w[1]-v[1])*k-9.8,(w[2]-v[2])*k];
   q.o=q.p;q.p=[q.p[0]+v[0]*h*.996+a[0]*h*h,q.p[1]+v[1]*h*.996+a[1]*h*h,q.p[2]+v[2]*h*.996+a[2]*h*h];
  }
  const link=(A,B,L)=>{const d=[B.p[0]-A.p[0],B.p[1]-A.p[1],B.p[2]-A.p[2]],l=Math.hypot(...d)||1e-6,c=(l-L)/l,wa=A.pin?0:B.pin?1:.5;
   for(let k=0;k<3;k++){A.p[k]+=d[k]*c*wa;B.p[k]-=d[k]*c*(1-wa);}};
  for(let it=0;it<5;it++){
   for(let j=0;j<R;j++)for(let i=0;i<C;i++){const q=P[j*C+i],w=cape.rest[Math.min(i,C-2)]*(1+j*.022);
    if(i<C-1)link(q,P[j*C+i+1],w);if(j<R-1)link(q,P[(j+1)*C+i],seg);if(j<R-1&&i<C-1)link(q,P[(j+1)*C+i+1],Math.hypot(w,seg));if(j<R-2)link(q,P[(j+2)*C+i],seg*2);}
   for(let j=1;j<R;j++)for(let i=0;i<C;i++){const q=P[j*C+i];pushOutOfBird(q,.04);if(q.p[1]<.03)q.p[1]=.03;}
  }
 }
 cape.pins=pins;
}
function drawCape(){
 if(wearing('back')!=='mantel'||!cape.pts)return;
 const C=cape.cols,R=cape.rows,red=rgb('#c0122c'),deep=rgb('#7e0a1c'),gold=rgb('#e0b23a');
 const grid=[];for(let j=0;j<R;j++)grid.push(cape.pts.slice(j*C,j*C+C).map(q=>q.p));
 surface(grid,false,(j)=>j===R-1?gold:j===0?deep:red,p=>p);
 const collar=[grid[0],grid[0].map((p,i)=>{const l=toBirdLocal(p);return birdPoint([l[0]*1.05,l[1]+.03,l[2]+.015]);})];surface(collar,false,()=>gold,p=>p,goo);
}

// ---- Loose cloth ends (scarf ends, headband tails): a chain of points hanging from a pin, simulated like the cape:
// gravity, drag against the air the bird flies through, gusts that grow with speed, and kept out of the body.
const chains={};let clothDt=1/60; // set every frame by the main loop: game time while flying, real time in the menus
function airAt(){ // the air's velocity: still while flying (the bird moves through it), a steady breeze in the menu preview
 return state==='play'||state==='crash'?[0,0,0]:[-Math.sin(bird.angle)*9,0,-Math.cos(bird.angle)*9];
}
function pushOutOfBird(q,margin){
 const l=toBirdLocal(q.p);let out=null;
 if(l[2]>=-.49&&l[2]<=.444){const [,cy,w,h]=ringAt(l[2]),e=(l[0]/(w+margin))**2+((l[1]-cy)/(h+margin))**2;if(e<1){const k=1/Math.sqrt(Math.max(e,1e-4));out=[l[0]*k,cy+(l[1]-cy)*k,l[2]];}}
 else if(l[2]<-.49&&l[2]>-.8&&Math.abs(l[0])<.22&&l[1]<.06+margin&&l[1]>-.04)out=[l[0],.06+margin,l[2]]; // the tail fan
 if(out){const n=birdPoint(out),d=[n[0]-q.p[0],n[1]-q.p[1],n[2]-q.p[2]];for(let k=0;k<3;k++){q.p[k]+=d[k];q.o[k]+=d[k]*.85;}} // move it out without kicking it
}
function stepChain(ch,pin,seg,dt,speed){
 const n=ch.p.length,h=1/240,air=airAt();ch.acc=Math.min(ch.acc+dt,.06);const from=ch.pin||pin;let steps=Math.floor(ch.acc/h);ch.acc-=steps*h;
 for(let s=1;s<=steps;s++){const f=s/steps,P=[mix(from[0],pin[0],f),mix(from[1],pin[1],f),mix(from[2],pin[2],f)];
  for(let i=1;i<n;i++){const q=ch.p[i],v=[(q.p[0]-q.o[0])/h,(q.p[1]-q.o[1])/h,(q.p[2]-q.o[2])/h];
   const t=performance.now()/1000*5+i*.45+ch.seed,g=.5+.12*speed,w=[air[0]+g*Math.sin(t),air[1]+g*.7*Math.sin(t*1.3),air[2]+g*Math.cos(t*.9)],k=6;
   const a=[(w[0]-v[0])*k,(w[1]-v[1])*k-9.8,(w[2]-v[2])*k];q.o=q.p;q.p=[q.p[0]+v[0]*h*.997+a[0]*h*h,q.p[1]+v[1]*h*.997+a[1]*h*h,q.p[2]+v[2]*h*.997+a[2]*h*h];}
  ch.p[0].o=ch.p[0].p;ch.p[0].p=P;
  for(let it=0;it<5;it++){for(let i=0;i<n-1;i++){const A=ch.p[i],B=ch.p[i+1],d=[B.p[0]-A.p[0],B.p[1]-A.p[1],B.p[2]-A.p[2]],l=Math.hypot(...d)||1e-6,c=(l-seg)/l,wa=i===0?0:.5;
    for(let k=0;k<3;k++){A.p[k]+=d[k]*c*wa;B.p[k]-=d[k]*c*(1-wa);}}
   for(let i=1;i<n;i++){pushOutOfBird(ch.p[i],.022);if(ch.p[i].p[1]<.03)ch.p[i].p[1]=.03;}}
 }
 ch.pin=pin;
}
function ribbonEnd(id,pin,n,seg,width,col,edge,flat){
 let ch=chains[id];
 if(!ch||Math.hypot(ch.p[0].p[0]-pin[0],ch.p[0].p[1]-pin[1],ch.p[0].p[2]-pin[2])>1){ch=chains[id]={p:Array.from({length:n},(_,i)=>{const p=[pin[0],pin[1]-i*seg,pin[2]];return {p,o:p.slice()};}),acc:0,seed:Math.random()*9};}
 stepChain(ch,pin,seg,clothDt,Math.hypot(forwardSpeed(),bird.vy));
 const o=birdPoint([0,0,0]),up=birdPoint([0,1,0]).map((v,i)=>v-o[i]),right=birdPoint([1,0,0]).map((v,i)=>v-o[i]),G=[];
 for(let i=0;i<n;i++){const a=ch.p[Math.max(0,i-1)].p,b=ch.p[Math.min(n-1,i+1)].p,d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  let w=flat?right:[d[1]*up[2]-d[2]*up[1],d[2]*up[0]-d[0]*up[2],d[0]*up[1]-d[1]*up[0]];const l=Math.hypot(...w)||1,s=width*(1-.25*i/n)/l,p=ch.p[i].p;
  G.push([[p[0]-w[0]*s,p[1]-w[1]*s,p[2]-w[2]*s],[p[0]+w[0]*s,p[1]+w[1]*s,p[2]+w[2]*s]]);}
 surface(G,false,(j)=>j>=n-1||(flat&&j>=n-2)?edge:col,p=>p);
 if(flat){const last=G.at(-1),dn=[0,-.045,0];for(let f=0;f<=5;f++){const t=f/5,p=[mix(last[0][0],last[1][0],t),mix(last[0][1],last[1][1],t),mix(last[0][2],last[1][2],t)];
  surface([[p,[p[0]+.004,p[1],p[2]]],[[p[0],p[1]-.045,p[2]],[p[0]+.004,p[1]-.045,p[2]]]],false,()=>edge,q=>q);}} // fringe
}
