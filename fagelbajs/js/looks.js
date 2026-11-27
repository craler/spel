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
// rarity: 1 vanlig, 2 ovanlig, 3 sällsynt, 4 episk, 5 legendarisk. have() gives how far along the requirement is: [now, needed].
const lookList=[
 {id:'keps',name:'Röd keps',slot:'head',rarity:1,about:'Sex paneler, broderat märke och styv skärm.',need:'Flyg en gång',have:()=>[Math.min(flights,1),1]},
 {id:'pannband',name:'Ninjapannband',slot:'head',rarity:3,about:'Rött tyg med knut och två långa band som fladdrar.',need:'Bedriften Kombokung (kombo ×8)',have:()=>[+done.has('combo'),1]},
 {id:'hatt',name:'Hög hatt',slot:'head',rarity:4,about:'Svart filt, sidenband och guldspänne. Bärs på sniskan.',need:'Bedriften Objuden gäst',have:()=>[+done.has('wedding'),1]},
 {id:'krona',name:'Krona',slot:'head',rarity:5,about:'Hermelin, guld, ädelstenar och pärlor. För stadens härskare.',need:'Nå fem stjärnor',have:()=>[Math.min(stats.maxStars,5),5]},
 {id:'brillor',name:'Pilotglasögon',slot:'eyes',rarity:3,about:'Guldbågar och mörka glas som döljer blicken.',need:'Nå tre stjärnor',have:()=>[Math.min(stats.maxStars,3),3]},
 {id:'halsduk',name:'Halsduk',slot:'neck',rarity:2,about:'Tjock, stickad och randig, med två ändar som fladdrar.',need:'1 000 poäng totalt',have:()=>[stats.total,1000]},
 {id:'mantel',name:'Röd mantel',slot:'back',rarity:4,about:'Sammet med guldkant, guldfoder och ett stolt emblem.',need:'Flyg tio gånger',have:()=>[Math.min(flights,10),10]},
 {id:'regnbage',name:'Regnbågsbajs',slot:'poop',rarity:3,about:'Allt som kommer ut skiftar i regnbågens färger.',need:'Ät fem chili',have:()=>[Math.min(stats.chilis||0,5),5]},
 {id:'guld',name:'Guldbajs',slot:'poop',rarity:5,about:'Blankt, tungt och dyrbart. Även fläckarna blir guld.',need:'10 000 poäng totalt',have:()=>[stats.total,10000]},
];
const lookSlots=[['head','Huvud'],['eyes','Ögon'],['neck','Hals'],['back','Rygg'],['poop','Bajs']];
const rarityNames=['','Vanlig','Ovanlig','Sällsynt','Episk','Legendarisk'];
let worn={};try{worn=JSON.parse(localStorage.getItem('fagelbajs.look')||'{}');}catch{}
const unlocked=l=>{if(unlockAll)return true;const [a,b]=l.have();return a>=b;};
// tryOn is what the wardrobe is showing on the bird right now, slot by slot: it also lets a locked thing be looked at.
let tryOn=null;
function wearing(slot){
 if(!looksLive)return null;
 if(tryOn&&slot in tryOn)return tryOn[slot];
 const id=worn[slot],l=lookList.find(l=>l.id===id);return l&&unlocked(l)?id:null;
}
function wear(id){
 const l=lookList.find(l=>l.id===id);if(!l||!unlocked(l))return;
 worn[l.slot]=worn[l.slot]===id?null:id;saveWorn();
}
function saveWorn(){try{localStorage.setItem('fagelbajs.look',JSON.stringify(worn));}catch{}applyLook();}
// Colours that follow the look: golden droppings, or all the colours of the rainbow.
const gooKinds={none:['#efe9d2','#e2dbb4','#d3cf9a','#f4f0e2','#c9c08a'],guld:['#f6cf4a','#e8b830','#ffd85e','#d9a520','#f2c84a'],regnbage:['#f0453a','#f59a2a','#f2d92e','#44b85a','#3d8fe0','#9a5bd0']};
function applyLook(){
 const kind=wearing('poop')||'none',gold=kind==='guld';gooShade.splice(0,gooShade.length,...(gooKinds[kind]||gooKinds.none).map(rgb));
 gooMat=gold?-2:-1;splatCol.splice(0,3,...rgb(gold?'#f2c84a':'#f4f1e6'));
}
// ---- Building shapes -----------------------------------------------------------------------------------------------
// make(emit) gives the tools the models are built with. Everything ends up as a grid of points handed to surface(), which
// works out smooth normals and passes the triangles on, corner by corner, to emit(batch, point, normal, colour).
// The batch decides the material: dyn is matt, cloth has a soft sheen, gloss shines and metal mirrors the sky.
function make(emit){
 const S={
  map:null, // set to move every point of what is being built (a hat worn at an angle)
  surface(P,closed,col,batch=dyn){
   if(S.map)P=P.map(row=>row.map(S.map));
   const J=P.length,I=P[0].length,at=(j,i)=>P[clamp(j,0,J-1)][closed?((i%I)+I)%I:clamp(i,0,I-1)],N=[];
   for(let j=0;j<J;j++){const row=[];for(let i=0;i<I;i++){
    const a=at(j,i+1),b=at(j,i-1),c=at(j+1,i),d=at(j-1,i),ux=a[0]-b[0],uy=a[1]-b[1],uz=a[2]-b[2],vx=c[0]-d[0],vy=c[1]-d[1],vz=c[2]-d[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);row.push(l>1e-12?[nx/l,ny/l,nz/l]:null);}N.push(row);}
   // where the grid shrinks to a point (the top of a dome) the normal is borrowed from the row beside it
   for(let j=0;j<J;j++)for(let i=0;i<I;i++)if(!N[j][i])N[j][i]=N[j?j-1:1]?.[i]||[0,1,0];
   const C=typeof col==='function'?col:()=>col;
   for(let j=0;j<J-1;j++)for(let i=0;i<(closed?I:I-1);i++){const k=(i+1)%I;
    emit(batch,P[j][i],N[j][i],C(j,i));emit(batch,P[j+1][i],N[j+1][i],C(j+1,i));emit(batch,P[j+1][k],N[j+1][k],C(j+1,k));
    emit(batch,P[j][i],N[j][i],C(j,i));emit(batch,P[j+1][k],N[j+1][k],C(j+1,k));emit(batch,P[j][k],N[j][k],C(j,k));}
   return S;
  },
  // Turned on a lathe round a vertical axis through c: prof is rows of [radius, height]. sx and sz squash it.
  lathe(prof,c,col,batch,n=20,sx=1,sz=1){
   return S.surface(prof.map(([r,y])=>Array.from({length:n},(_,i)=>{const a=i/n*tau;return [c[0]+r*Math.cos(a)*sx,c[1]+y,c[2]+r*Math.sin(a)*sz];})),true,col,batch);
  },
  ball(c,r,col,batch,n=8,sy=1){return S.lathe(Array.from({length:6},(_,k)=>{const a=k/5*Math.PI;return [Math.max(1e-4,Math.sin(a))*r,Math.cos(a)*r*sy];}),c,col,batch,n);},
  // A round tube along a path of points. r is its radius, or a function of how far along (0..1) it is.
  tube(path,r,col,batch,n=6){
   const R=typeof r==='function'?r:()=>r,m=path.length,rows=[];
   for(let k=0;k<m;k++){
    const a=path[Math.max(0,k-1)],b=path[Math.min(m-1,k+1)],t=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],tl=Math.hypot(...t)||1;t[0]/=tl;t[1]/=tl;t[2]/=tl;
    const up=Math.abs(t[1])>.9?[1,0,0]:[0,1,0];let u=[t[1]*up[2]-t[2]*up[1],t[2]*up[0]-t[0]*up[2],t[0]*up[1]-t[1]*up[0]];const ul=Math.hypot(...u)||1;u=u.map(q=>q/ul);
    const v=[t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0]],rad=R(k/(m-1)),p=path[k];
    rows.push(Array.from({length:n},(_,i)=>{const q=i/n*tau,c=Math.cos(q)*rad,s=Math.sin(q)*rad;return [p[0]+u[0]*c+v[0]*s,p[1]+u[1]*c+v[1]*s,p[2]+u[2]*c+v[2]*s];}));
   }
   return S.surface(rows,true,col,batch);
  },
 };
 return S;
}
// For what changes shape every frame (cloth): built and drawn in one go, in world space.
const live=make((batch,p,n,c)=>batch.vert(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2]));
// Hats, glasses and the crown never change shape. Their triangles are worked out once, in the bird's own space, and are
// after that only carried along with the head each frame: into() is the bird's own way of placing a point of its body
// in the world (see renderBird), and still means a part that does not turn with the head.
const rigidCache=new Map(),carry=new Float64Array(6);
function rigid(id,into,still,build){
 let R=rigidCache.get(id);
 if(!R){
  const rec=new Map();
  build(make((batch,p,n,c)=>{let a=rec.get(batch);if(!a)rec.set(batch,a=[]);a.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2]);}));
  R=[...rec].map(([batch,a])=>({batch,d:new Float32Array(a)}));rigidCache.set(id,R);
 }
 for(const {batch,d} of R)for(let k=0;k<d.length;k+=9){
  into(d[k],d[k+1],d[k+2],carry,0,still);into(d[k]+d[k+3]*.02,d[k+1]+d[k+4]*.02,d[k+2]+d[k+5]*.02,carry,3,still); // the point, and a point just off the surface for its normal
  const nx=carry[3]-carry[0],ny=carry[4]-carry[1],nz=carry[5]-carry[2],l=Math.hypot(nx,ny,nz)||1;
  batch.vert(carry[0],carry[1],carry[2],nx/l,ny/l,nz/l,d[k+6],d[k+7],d[k+8]);
 }
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
const tint=(c,k)=>[c[0]*k,c[1]*k,c[2]*k],blend=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
// ---- The models ------------------------------------------------------------------------------------------------------
// Röd keps: a six-panel baseball cap moulded over the skull. Seams run from the button on top, each panel has an eyelet,
// the edge is rolled, there is an embroidered badge on the front, and the stiff peak has rows of stitching and a dark underside.
function buildCap(S){
 const red=rgb('#cf3a2e'),seam=rgb('#8a1e16'),under=rgb('#30333a'),white=rgb('#f1ece2'),J=18,I=40,z0=.222,z1=.43,zb=.318;
 const cut=z=>mix(.318,.352,(z-z0)/(z1-z0)),lo=z=>{const [,cy,,h]=ringAt(z);return Math.asin(clamp((cut(z)-cy)/(h+.01),-1,.97));};
 const puff=(z,a)=>.012+.026*Math.sin(a)**2*Math.sin(Math.PI*clamp((z-z0+.02)/(z1-z0+.03),0,1)),skin=(z,a,lift=0)=>headPt(z,a,puff(z,a)+lift);
 const P=[];for(let j=0;j<=J;j++){const z=z0+(z1-z0)*j/J,row=[];for(let i=0;i<=I;i++)row.push(skin(z,mix(lo(z),Math.PI-lo(z),i/I)));P.push(row);}
 S.surface(P,false,(j,i)=>tint(red,.9+.1*Math.sin(Math.PI*i/I)),cloth);
 // where the cap's surface is, straight above a point seen from above; null outside the cap
 const over=(x,z,lift)=>{if(z<z0||z>z1)return null;const [,,w]=ringAt(z);let a=Math.acos(clamp(x/(w+.03),-1,1));a=Math.acos(clamp(x/(w+puff(z,a)),-1,1));return a<lo(z)||a>Math.PI-lo(z)?null:skin(z,a,lift);};
 for(let k=0;k<6;k++){ // six seams run from the button to the edge, as fine raised cords
  const ps=k*Math.PI/3,cord=[];for(let r=.012;r<.2;r+=.008){const p=over(r*Math.sin(ps),zb+r*Math.cos(ps),.0012);if(!p)break;cord.push(p);}
  if(cord.length>1)S.tube(cord,.0021,seam,cloth,4);
  const e=over(.06*Math.sin(ps+Math.PI/6),zb+.06*Math.cos(ps+Math.PI/6),.0005);if(e)S.ball(e,.0034,under,gloss,6,.5); // an eyelet in the middle of each panel
 }
 S.tube([...P.map(r=>r[0]).reverse(),...P[0],...P.map(r=>r[I])],.0042,seam,cloth,5); // the rolled edge: down one side, round the back, up the other
 S.ball(skin(zb,Math.PI/2,.006),.011,seam,cloth);
 // the badge: a small oval of white embroidery with a red rim, sewn to the front
 const badge=[];for(let r=0;r<=4;r++){const row=[];for(let q=0;q<16;q++){const t=q/16*tau,k=r/4;row.push(skin(.396+.015*k*Math.sin(t),Math.PI/2+.27*k*Math.cos(t),.0035-.0025*k*k));}badge.push(row);}
 S.surface(badge,true,(j)=>j===4?seam:white,cloth);
 // the peak: a top and an underside with a rounded edge round them
 const y0=cut(z1)-.004,pk=(t,u,dy)=>{const w=.114*(1-.22*t*t);return [u*w,y0+dy-.03*t*t-.02*u*u,z1-.05+t*.175-.036*u*u*t];};
 const skinOf=(dy)=>Array.from({length:9},(_,j)=>Array.from({length:17},(_,i)=>pk(j/8,i/16*2-1,dy)));
 S.surface(skinOf(.004),false,(j)=>j%2?tint(red,.86):red,cloth);S.surface(skinOf(-.004),false,under,cloth);
 const edge=[];for(let j=0;j<=8;j++)edge.push(pk(j/8,-1,0));for(let i=1;i<=16;i++)edge.push(pk(1,i/16*2-1,0));for(let j=7;j>=0;j--)edge.push(pk(j/8,1,0));
 S.tube(edge,.005,tint(red,.8),cloth,5);
}
// Hög hatt: a felt top hat worn at a jaunty angle. A waisted crown with a bevelled top, a brim that curls up at the sides
// with a bound edge, a silk band and a gold buckle.
function buildTopHat(S){
 const felt=rgb('#1c1d22'),black=rgb('#0e0f12'),silk=rgb('#9c1f28'),gold=rgb('#e0b23a'),n=40,c=[0,.39,.322],cr=Math.cos(.14),sr=Math.sin(.14),cx=Math.cos(-.08),sx=Math.sin(-.08);
 S.map=p=>{const x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2],x1=x*cr-y*sr,y1=x*sr+y*cr;return [c[0]+x1,c[1]+y1*cx-z*sx,c[2]+y1*sx+z*cx];}; // tipped to one side and a little back
 S.lathe([[1e-4,.157],[.05,.1565],[.08,.154],[.0905,.148],[.0925,.139],[.0885,.1],[.0858,.062],[.0868,.03],[.0885,0]],c,(j)=>j<3?black:felt,cloth,n);
 S.lathe([[.0888,.037],[.0912,.034],[.0912,.007],[.0895,.004]],c,silk,gloss,n);
 const curl=(a,t)=>.03*Math.cos(a)**2*t*t,brim=(dy,col)=>S.surface(Array.from({length:8},(_,j)=>{const t=j/7,r=mix(.086,.172,t);
  return Array.from({length:n},(_,i)=>{const a=i/n*tau;return [c[0]+Math.cos(a)*r,c[1]+.003+dy+curl(a,t),c[2]+Math.sin(a)*r*1.04];});}),true,col,cloth);
 brim(.003,felt);brim(-.004,black);
 S.tube(Array.from({length:n+1},(_,i)=>{const a=i/n*tau;return [c[0]+Math.cos(a)*.173,c[1]+.003+curl(a,1),c[2]+Math.sin(a)*.173*1.04];}),.0055,black,gloss,5); // the bound edge
 const bz=c[2]+.0935,by=c[1]+.0205,bar=(a,b)=>S.tube([a,b],.0032,gold,metal,5);
 bar([-.02,by+.014,bz],[.02,by+.014,bz]);bar([-.02,by-.014,bz],[.02,by-.014,bz]);bar([-.02,by-.014,bz],[-.02,by+.014,bz]);bar([.02,by-.014,bz],[.02,by+.014,bz]);bar([0,by-.014,bz+.002],[0,by+.014,bz+.002]);
 S.map=null;
}
// Krona: a king's crown that follows the shape of the head. An ermine band, a gold circlet set with jewels, eight points,
// four beaded arches that meet under an orb with a cross, and a cap of red velvet inside.
function buildCrown(S){
 const gold=rgb('#edb93a'),deep=rgb('#b8892a'),velvet=rgb('#8c1022'),fur=rgb('#f3efe6'),spot=rgb('#18171a'),pearl=rgb('#f7f2e8'),gems=['#d01f26','#2f6fbf','#2e9b5a'].map(rgb);
 const n=48,y0=.378,cz=.322,at=(phi,off,y)=>{const p=rimPt(y0,phi,off,cz);return [p[0],y,p[2]];},ring=(y,off,lump=0)=>Array.from({length:n},(_,i)=>at(i/n*tau,off*(1+lump*Math.sin(i*2.3)*Math.sin(i*.9)),y));
 S.surface([ring(y0-.009,.005),ring(y0-.005,.017,.12),ring(y0+.007,.022,.12),ring(y0+.019,.018,.12),ring(y0+.024,.012)],true,fur,cloth);
 for(let k=0;k<10;k++)S.ball(at((k+.5)/10*tau,.0225,y0+.006+(k%2?.004:-.003)),.0052,spot,cloth,6,1.7); // the black tails of the ermine
 S.surface([ring(y0+.022,.012),ring(y0+.026,.0165),ring(y0+.05,.0165),ring(y0+.054,.012)],true,(j)=>j===1||j===2?gold:deep,metal);
 const cap=[];for(let k=0;k<=6;k++){const t=k/6;cap.push(ring(y0+.05+.062*Math.sin(t*Math.PI/2),.01*(1-t*t)).map(p=>[mix(p[0],0,t*t*.97),p[1],mix(p[2],cz,t*t*.97)]));}
 S.surface(cap,true,velvet,cloth);
 for(let k=0;k<8;k++){
  const phi=k/8*tau,tall=k%2===0,spread=tall?.3:.2,L=at(phi-spread,.0165,y0+.052),R=at(phi+spread,.0165,y0+.052),M=at(phi,.02,y0+.052),tip=[M[0]*1.05,y0+(tall?.108:.086),cz+(M[2]-cz)*1.05];
  const leaf=[];for(let j=0;j<=5;j++){const t=j/5,row=[];for(let i=0;i<=6;i++){const u=i/6,w=Math.pow(1-Math.abs(u*2-1),.6),f=t*w+(1-w)*t*.2;
   row.push([mix(mix(L[0],R[0],u),tip[0],f),mix(L[1],tip[1],t*w),mix(mix(L[2],R[2],u),tip[2],f)]);}leaf.push(row);}
  S.surface(leaf,false,(j)=>tint(gold,.86+.14*j/5),metal);
  const g=at(phi,.0185,y0+.038);S.ball(g,.0095,gems[k%3],gloss,8);S.ball(at(phi,.017,y0+.038),.0125,deep,metal,8,.9); // a jewel in its setting
  if(!tall){S.ball([tip[0],tip[1]+.009,tip[2]],.0085,pearl,gloss,8);continue;}
  const arch=[];for(let q=0;q<=8;q++){const t=q/8,cq=Math.cos(t*Math.PI/2);arch.push([tip[0]*cq,tip[1]+.052*Math.sin(t*Math.PI/2),cz+(tip[2]-cz)*cq]);}
  S.tube(arch,.0052,gold,metal,6);for(let q=1;q<8;q+=2)S.ball([arch[q][0],arch[q][1]+.006,arch[q][2]],.0062,pearl,gloss,6);
 }
 const top=y0+.166;S.ball([0,top,cz],.0155,gold,metal,10);S.tube([[0,top+.012,cz],[0,top+.05,cz]],.0042,gold,metal,5);S.tube([[-.015,top+.035,cz],[.015,top+.035,cz]],.0042,gold,metal,5);
}
// Ninjapannband: a strip of red cloth tied round the head above the eyes, folded along the middle, with a tight knot and two
// small loops at the back. Its two long tails are loose cloth (see ribbonEnd).
function buildHeadband(S){
 const red=rgb('#d01f26'),dark=rgb('#96131a'),n=48,yc=phi=>.352+.006*Math.cos(phi),row=(dy,off)=>Array.from({length:n},(_,i)=>{const phi=i/n*tau;return rimPt(yc(phi)+dy,phi,off);});
 S.surface([row(-.021,.004),row(-.018,.011),row(-.007,.0145),row(0,.012),row(.007,.0145),row(.018,.011),row(.021,.004)],true,(j)=>j===0||j===6?dark:j===3?tint(red,.8):red,cloth);
 const b=headbandKnot();S.ball(b,.021,tint(red,.92),cloth,10,.85);
 for(const s of [-1,1]){const loop=[];for(let q=0;q<=8;q++){const t=q/8*Math.PI;loop.push([b[0]+s*(.012+.03*Math.sin(t)),b[1]+.01+.026*Math.sin(t)*(1-.5*Math.cos(t)),b[2]-.008-.016*Math.sin(t)]);}S.tube(loop,.0075,(j)=>j%2?red:dark,cloth,6);}
}
const headbandKnot=()=>rimPt(.346,Math.PI,.02);
// Solglasögon: gold-rimmed aviators. Two teardrop lenses of dark glass that wrap round to cover the eyes, each in a thin
// metal rim, joined by a double bridge over the beak, with arms that run back along the head.
function buildShades(S){
 const frame=rgb('#dcae3a'),dark=rgb('#0b0e12'),warm=rgb('#2b1d14'),glint=rgb('#7f93a8'),y=.326,at=(phi,dy,o)=>{const p=rimPt(y,phi,o,.33);return [p[0],y+dy,p[2]];};
 for(const s of [-1,1]){
  // the outline of a lens: q goes round it, 0 at the outer end; flat-ish on top, hanging lower towards the outside
  const out=q=>{const cq=Math.cos(q),sq=Math.sin(q);return [s*(.9-.7*cq*(1-.08*sq)),.006+(sq>0?.031*sq:.045*sq*(1+.22*cq))];};
  const lens=[];for(let r=0;r<=5;r++){const k=r/5,row=[];for(let i=0;i<24;i++){const [phi,dy]=out(i/24*tau);row.push(at(s*.9+(phi-s*.9)*k,.006+(dy-.006)*k,.0135+.006*(1-k*k)));}lens.push(row);}
  S.surface(lens,true,(j,i)=>blend(warm,dark,clamp((lens[j][i][1]-y+.045)/.06,0,1)),gloss);
  S.tube(Array.from({length:25},(_,i)=>{const [phi,dy]=out(i/24*tau);return at(phi,dy,.0135);}),.0042,frame,metal,6);
  for(const [p0,w] of [[.52,.05],[.64,.022]]){ // two strokes of light across the glass
   const g=[];for(let k=0;k<=4;k++){const t=k/4;g.push([at(s*(p0+.2*t),.03-.045*t,.0205),at(s*(p0+w+.2*t),.03-.045*t,.0205)]);}S.surface(g,false,glint,gloss);}
  const arm=[];for(let k=0;k<=9;k++){const t=k/9;arm.push(at(s*mix(1.58,2.5,t),.03-.004*t-.03*Math.max(0,t-.75)**2*16,.011-.003*t));}S.tube(arm,.0033,frame,metal,5);
 }
 S.tube([at(-.2,.012,.016),at(0,.02,.02),at(.2,.012,.016)],.0036,frame,metal,5);S.tube([at(-.24,.034,.015),at(0,.04,.018),at(.24,.034,.015)],.003,frame,metal,5);
}
// Halsduk: a thick knitted scarf wrapped twice round the neck: ribbed, striped along its length in blue and cream, with a
// knot at the front. Its two ends hang loose (see ribbonEnd).
function buildScarf(S){
 const blue=rgb('#2f6fbf'),navy=rgb('#255596'),n=44,Q=16;
 for(const [k,z,lean,size] of [[0,.178,.034,1],[1,.232,-.026,.9]]){
  const P=[];for(let c=0;c<=Q;c++){const q=c/Q*tau-Math.PI/2,rib=1+.075*Math.cos(q*8),row=[]; // eight knitted ribs run along it
   for(let i=0;i<n;i++){const a=i/n*tau,soft=1+.1*Math.sin(a*3+k*2)+.06*Math.sin(a*5+1.3*k); // a soft thing is never quite even
    row.push(headPt(z+Math.cos(q)*.034*size*rib*soft+lean*Math.sin(a)+.006*Math.sin(a*2+k),a,(.026+Math.sin(q)*.024*rib)*size*soft));}
   P.push(row);}
  S.surface(P,true,(c)=>Math.floor(c*8/Q)%2?navy:blue,cloth);
 }
 S.ball(scarfKnot(),.04,blue,cloth,10,.8);
}
const scarfKnot=()=>headPt(.214,-Math.PI/2+.5,.04);
function drawLook(into,toHead,toBody){
 const head=wearing('head');
 if(head==='keps')rigid('keps',into,false,buildCap);
 if(head==='hatt')rigid('hatt',into,false,buildTopHat);
 if(head==='krona')rigid('krona',into,false,buildCrown);
 if(head==='pannband'){
  rigid('pannband',into,false,buildHeadband);
  const b=headbandKnot(),red=rgb('#d01f26'),dark=rgb('#96131a');
  for(const s of [-1,1])ribbonEnd('band'+s,toHead([b[0]+s*.012,b[1]-.006,b[2]-.012]),13,.027,.02,(i)=>i===1?tint(red,.85):red,dark);
 }
 if(wearing('eyes')==='brillor')rigid('brillor',into,false,buildShades);
 if(wearing('neck')==='halsduk'){
  rigid('halsduk',into,true,buildScarf);
  const k=scarfKnot(),blue=rgb('#2f6fbf'),navy=rgb('#255596'),cream=rgb('#ece6d6');
  for(const [n,dx] of [[0,-.03],[1,.03]])ribbonEnd('scarf'+n,toBody([k[0]+dx,k[1]-.02,k[2]+.01*n]),13,.036,.04,(i,j)=>j===9||j===10?cream:i===1?blue:navy,cream,true); // two cream stripes near the end
 }
 drawCape(toBody);
}
// Small pictures for the menu.
const lookIcon={
 keps:'<path d="M8 30c0-10 7-16 16-16s16 6 16 16z" fill="#d23b2f"/><path d="M30 29h16l-4 4H28z" fill="#a82a24"/>',
 halsduk:'<path d="M10 16h28v8H10z" fill="#2f6fbf"/><path d="M14 16h4v8h-4zM22 16h4v8h-4zM30 16h4v8h-4z" fill="#e8e4da"/><path d="M28 24h7l2 16h-7z" fill="#2f6fbf"/>',
 brillor:'<ellipse cx="15" cy="24" rx="9" ry="7" fill="#111318"/><ellipse cx="33" cy="24" rx="9" ry="7" fill="#111318"/><path d="M22 22h4v3h-4z" fill="#111318"/>',
 pannband:'<path d="M6 20h32v8H6z" fill="#d01f26"/><path d="M38 22l8-6 2 4-6 6zM38 26l9 3-1 4-9-3z" fill="#a8161c"/>',
 hatt:'<path d="M14 8h20v26H14z" fill="#1d1e22"/><path d="M14 26h20v4H14z" fill="#a8252b"/><path d="M6 34h36v4H6z" fill="#16171a"/>',
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
const cape={cols:8,rows:17,pts:null,acc:0,pins:null},capeFlare=.07; // how much wider each row is than the one before
function toBirdLocal([X,Y,Z]){ // the inverse of birdPoint()
 const b=bird,bank=(b.vb??b.bank)*1.02,pitch=flightPitch(),sy=Math.sin(b.angle),cy=Math.cos(b.angle),sb=Math.sin(bank),cb=Math.cos(bank),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const dx=X-b.x,dy=Y-b.y,dz=Z-b.z,bx=dx*cy-dz*sy,bz=dx*sy+dz*cy,by=dy*cp-bz*sp,z=dy*sp+bz*cp;
 return [bx*cb-by*sb,bx*sb+by*cb,z];
}
function capePin(i){const t=i/(cape.cols-1),a=mix(.62,Math.PI-.62,t);return birdPoint(headPt(.08,a,.022));}
function resetCape(){
 cape.pts=[];for(let j=0;j<cape.rows;j++)for(let i=0;i<cape.cols;i++){const p=capePin(i),q=toBirdLocal(p),w=birdPoint([q[0]*(1+j*capeFlare),q[1]+.03,q[2]-j*.075]);cape.pts.push({p:w,o:w.slice()});}
 cape.rest=[];for(let i=0;i<cape.cols-1;i++){const a=capePin(i),b=capePin(i+1);cape.rest.push(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));}
}
function updateCape(dt){
 if(wearing('back')!=='mantel'){cape.pts=null;return;}
 const pins=Array.from({length:cape.cols},(_,i)=>capePin(i));
 if(!cape.pts||Math.hypot(...[0,1,2].map(k=>cape.pts[0].p[k]-pins[0][k]))>3){resetCape();cape.pins=pins;}
 const C=cape.cols,R=cape.rows,P=cape.pts,seg=.075,h=1/240,speed=Math.hypot(forwardSpeed(),bird.vy),air=airAt(),from=cape.pins||pins;
 const side=[pins[C-1][0]-pins[0][0],pins[C-1][1]-pins[0][1],pins[C-1][2]-pins[0][2]],sl=Math.hypot(...side)||1;side[0]/=sl;side[1]/=sl;side[2]/=sl; // across the shoulders
 cape.acc=Math.min(cape.acc+dt,.06);const steps=Math.floor(cape.acc/h);cape.acc-=steps*h;
 for(let s=1;s<=steps;s++){const f=s/steps;
  for(let j=0;j<R;j++)for(let i=0;i<C;i++){
   const q=P[j*C+i];if(j===0){q.o=q.p;q.p=[0,1,2].map(k=>mix(from[i][k],pins[i][k],f));q.pin=true;continue;} // the shoulders glide with the bird between frames
   const v=[(q.p[0]-q.o[0])/h,(q.p[1]-q.o[1])/h,(q.p[2]-q.o[2])/h];
   // gusts vary smoothly over the cloth, so it billows in waves instead of shivering point by point
   const t=performance.now()/1000*5-j*.42,g=.4+.1*speed,w=[air[0]+g*Math.sin(t+i*.25),air[1]+g*2.2*Math.sin(t*1.15+i*.2),air[2]+g*Math.cos(t*.8)];
   // the air that fills a cape also holds it open: each side is pushed outwards, more the further down the cape it is
   const open=(i/(C-1)-.5)*(3+.5*speed)*Math.min(1,j/5),k=5,a=[(w[0]-v[0])*k+side[0]*open,(w[1]-v[1])*k-9.8+side[1]*open,(w[2]-v[2])*k+side[2]*open];
   q.o=q.p;q.p=[q.p[0]+v[0]*h*.996+a[0]*h*h,q.p[1]+v[1]*h*.996+a[1]*h*h,q.p[2]+v[2]*h*.996+a[2]*h*h];
  }
  const link=(A,B,L)=>{const d=[B.p[0]-A.p[0],B.p[1]-A.p[1],B.p[2]-A.p[2]],l=Math.hypot(...d)||1e-6,c=(l-L)/l,wa=A.pin?0:B.pin?1:.5;
   for(let k=0;k<3;k++){A.p[k]+=d[k]*c*wa;B.p[k]-=d[k]*c*(1-wa);}};
  for(let it=0;it<5;it++){
   for(let j=0;j<R;j++)for(let i=0;i<C;i++){const q=P[j*C+i],w=cape.rest[Math.min(i,C-2)]*(1+j*capeFlare);
    if(i<C-1)link(q,P[j*C+i+1],w);if(j<R-1)link(q,P[(j+1)*C+i],seg);if(j<R-1&&i<C-1)link(q,P[(j+1)*C+i+1],Math.hypot(w,seg));if(j<R-2)link(q,P[(j+2)*C+i],seg*2);}
   for(let j=1;j<R;j++)for(let i=0;i<C;i++){const q=P[j*C+i];pushOutOfBird(q,.04);if(q.p[1]<.03)q.p[1]=.03;}
  }
 }
 cape.pins=pins;
}
// Twice as many points each way, on smooth curves through the ones that are simulated: soft folds instead of facets.
function refine(G){
 const cr=(a,b,c,d,t)=>.5*(2*b+(c-a)*t+(2*a-5*b+4*c-d)*t*t+(3*b-a-3*c+d)*t*t*t),J=G.length,I=G[0].length,g=(j,i)=>G[clamp(j,0,J-1)][clamp(i,0,I-1)],out=[];
 for(let j=0;j<=2*(J-1);j++){const j0=j>>1,tj=(j&1)/2,row=[];
  for(let i=0;i<=2*(I-1);i++){const i0=i>>1,ti=(i&1)/2,p=[0,0,0];
   for(let k=0;k<3;k++){const col=q=>cr(g(q,i0-1)[k],g(q,i0)[k],g(q,i0+1)[k],g(q,i0+2)[k],ti);p[k]=cr(col(j0-1),col(j0),col(j0+1),col(j0+2),tj);}
   row.push(p);}
  out.push(row);}
 return out;
}
// The cape as it is drawn: crimson velvet outside with a gold border, a gold lining inside, a gold collar with a clasp on
// each shoulder and a chain across the chest, and on the back, in gold, the emblem of the trade.
function drawCape(toBody){
 if(wearing('back')!=='mantel'||!cape.pts)return;
 const C=cape.cols,R=cape.rows,red=rgb('#b8102a'),deep=rgb('#7a0a1b'),gold=rgb('#e6b33a'),lining=rgb('#d9a52e');
 const raw=[];for(let j=0;j<R;j++)raw.push(cape.pts.slice(j*C,j*C+C).map(q=>q.p));
 const G=refine(raw),J=G.length,I=G[0].length,nor=(j,i)=>{ // which way the cloth faces at a point; the side away from this is the outside
  const a=G[j][Math.min(I-1,i+1)],b=G[j][Math.max(0,i-1)],c=G[Math.min(J-1,j+1)][i],d=G[Math.max(0,j-1)][i],u=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],v=[c[0]-d[0],c[1]-d[1],c[2]-d[2]];
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return [n[0]/l,n[1]/l,n[2]/l];};
 const N=G.map((row,j)=>row.map((_,i)=>nor(j,i))),lift=(k)=>G.map((row,j)=>row.map((p,i)=>[p[0]+N[j][i][0]*k,p[1]+N[j][i][1]*k,p[2]+N[j][i][2]*k]));
 live.surface(lift(-.004),false,(j,i)=>i<=1||i>=I-2||j>=J-3?gold:j<2?deep:tint(red,.88+.12*Math.sin(i*.9)),cloth);
 live.surface(lift(.004),false,lining,cloth);
 // the emblem: three heaped coils and a tip, laid on the cloth wherever it happens to be
 const at=(u,v)=>{const x=clamp(u,0,1)*(I-1),y=clamp(v,0,1)*(J-1),i=Math.min(I-2,Math.floor(x)),j=Math.min(J-2,Math.floor(y)),fx=x-i,fy=y-j,p=[0,0,0];
  for(let k=0;k<3;k++)p[k]=mix(mix(G[j][i][k],G[j][i+1][k],fx),mix(G[j+1][i][k],G[j+1][i+1][k],fx),fy)-N[j][i][k]*.0075;return p;};
 for(const [v0,ru,rv] of [[.53,.27,.036],[.474,.195,.032],[.424,.125,.028],[.384,.055,.022]]){
  const n=N[Math.round(v0*(J-1))][I>>1],out=[-n[0],-n[1],-n[2]],c=at(.5,v0);let prev=at(.5+ru,v0);
  for(let q=1;q<=12;q++){const a=q/12*tau,p=at(.5+ru*Math.cos(a),v0+rv*Math.sin(a));metal.vert(c[0],c[1],c[2],out[0],out[1],out[2],gold[0],gold[1],gold[2]);
   metal.vert(prev[0],prev[1],prev[2],out[0],out[1],out[2],gold[0],gold[1],gold[2]);metal.vert(p[0],p[1],p[2],out[0],out[1],out[2],gold[0],gold[1],gold[2]);prev=p;}
 }
 // collar, clasps and chain
 const collar=[raw[0],raw[0].map(p=>{const l=toBirdLocal(p);return birdPoint([l[0]*1.06,l[1]+.032,l[2]+.02]);})];live.surface(collar,false,gold,metal);
 for(const a of [.62,Math.PI-.62])live.ball(toBody(headPt(.095,a,.03)),.024,gold,metal,8,.6);
 live.tube(Array.from({length:15},(_,k)=>toBody(headPt(.115,.62-k/14*(Math.PI+1.24),.012+.012*Math.sin(k/14*Math.PI)))),.0055,(j)=>j%2?gold:tint(gold,.7),metal,5);
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
// A loose end of cloth hanging from pin: n points long, drawn three points wide with a slight fold along the middle.
// col(i) colours the three strips across it; edge is the colour of the last bit and, on a flat end, of its fringe.
function ribbonEnd(id,pin,n,seg,width,col,edge,flat){
 let ch=chains[id];
 if(!ch||Math.hypot(ch.p[0].p[0]-pin[0],ch.p[0].p[1]-pin[1],ch.p[0].p[2]-pin[2])>1){ch=chains[id]={p:Array.from({length:n},(_,i)=>{const p=[pin[0],pin[1]-i*seg,pin[2]];return {p,o:p.slice()};}),acc:0,seed:Math.random()*9};}
 stepChain(ch,pin,seg,clothDt,Math.hypot(forwardSpeed(),bird.vy));
 const o=birdPoint([0,0,0]),up=birdPoint([0,1,0]).map((v,i)=>v-o[i]),right=birdPoint([1,0,0]).map((v,i)=>v-o[i]),G=[];
 for(let i=0;i<n;i++){const a=ch.p[Math.max(0,i-1)].p,b=ch.p[Math.min(n-1,i+1)].p,d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],dl=Math.hypot(...d)||1;
  let w=flat?right:[d[1]*up[2]-d[2]*up[1],d[2]*up[0]-d[0]*up[2],d[0]*up[1]-d[1]*up[0]];const l=Math.hypot(...w)||1,s=width*(flat?1:1-.25*i/n)/l,p=ch.p[i].p;
  const f=[(d[1]*w[2]-d[2]*w[1])/dl/l*.006,(d[2]*w[0]-d[0]*w[2])/dl/l*.006,(d[0]*w[1]-d[1]*w[0])/dl/l*.006]; // the fold stands a little proud
  G.push([-1,-.34,.34,1].map(k=>[p[0]+w[0]*s*k+f[0]*(1-k*k),p[1]+w[1]*s*k+f[1]*(1-k*k),p[2]+w[2]*s*k+f[2]*(1-k*k)]));}
 live.surface(G,false,(j,i)=>j>=n-2?edge:col(Math.min(i,2),j),cloth);
 if(flat){const last=G.at(-1),prev=G.at(-2),d=[last[1][0]-prev[1][0],last[1][1]-prev[1][1],last[1][2]-prev[1][2]],dl=Math.hypot(...d)||1; // a fringe of tassels
  for(let f=0;f<=6;f++){const t=f/6,k=t*3,i=Math.min(2,Math.floor(k)),u=k-i,p=[0,1,2].map(q=>mix(last[i][q],last[i+1][q],u));
   live.tube([p,[p[0]+d[0]/dl*.03,p[1]+d[1]/dl*.03-.012,p[2]+d[2]/dl*.03]],.0045,edge,cloth,4);}}
}
