'use strict';
// ---- Garderoben: things for the dove to wear, unlocked by playing and kept in this browser.
const looksLive=true; // false hides the wardrobe and everything worn
// On the test site (raw.githack.com) there is a button that unlocks everything, for trying the looks out.
let unlockAll=false;try{unlockAll=testSite&&localStorage.getItem('fagelbajs.unlockAll')==='yes';}catch{}
// Lifetime progress, saved on this device: points over all flights, the most stars reached, events completed, and (added
// as they are first counted) people hit, cars crashed, chilis eaten and the best score reached with every feather left.
let stats={total:0,maxStars:0,events:0};
try{Object.assign(stats,JSON.parse(localStorage.getItem('fagelbajs.stats')||'{}'));}catch{}
function saveStats(){try{localStorage.setItem('fagelbajs.stats',JSON.stringify(stats));}catch{}}
// rarity: 1 vanlig, 2 ovanlig, 3 sällsynt, 4 episk, 5 legendarisk. have() gives how far along the requirement is: [now, needed].
const lookList=[
 {id:'keps',name:'Röd keps',slot:'head',rarity:1,about:'Sex paneler, broderat märke och styv skärm.',need:'Flyg en gång',have:()=>[Math.min(flights,1),1]},
 {id:'mossa',name:'Stickad mössa',slot:'head',rarity:1,about:'Ribbstickad med uppvikt kant, rand och en fluffig tofs.',need:'Träffa 50 fotgängare totalt',have:()=>[stats.hits||0,50]},
 {id:'party',name:'Partyhatt',slot:'head',rarity:2,about:'Blank strut i glada färger med tofs och gummiband.',need:'Klara en händelse på torget',have:()=>[Math.min(stats.events,1),1]},
 {id:'kock',name:'Kockmössa',slot:'head',rarity:2,about:'Hög, vit och veckad. För den som lagar med mycket chili.',need:'Ät tre chili',have:()=>[Math.min(stats.chilis||0,3),3]},
 {id:'pannband',name:'Ninjapannband',slot:'head',rarity:3,about:'Rött tyg med knut och två långa band som fladdrar.',need:'Bedriften Kombokung (kombo ×8)',have:()=>[+done.has('combo'),1]},
 {id:'cowboy',name:'Cowboyhatt',slot:'head',rarity:3,about:'Brun filt, veckad kulle, silverspänne och brett brätte.',need:'Krocka 50 bilar totalt',have:()=>[stats.cars||0,50]},
 {id:'hatt',name:'Hög hatt',slot:'head',rarity:4,about:'Svart filt, sidenband och guldspänne. Bärs på sniskan.',need:'Bedriften Objuden gäst',have:()=>[+done.has('wedding'),1]},
 {id:'viking',name:'Vikingahjälm',slot:'head',rarity:4,about:'Stål, mässing, nitar, nässkydd och två rejäla horn.',need:'Bedriften Pansarknäckare (slå ut en stridsvagn)',have:()=>[+done.has('tank'),1]},
 {id:'krona',name:'Krona',slot:'head',rarity:5,about:'Hermelin, guld, ädelstenar och pärlor. För stadens härskare.',need:'Nå fem stjärnor',have:()=>[Math.min(stats.maxStars,5),5]},
 {id:'gloria',name:'Gloria',slot:'head',rarity:5,about:'En ring av ljus. Bara för den som flyger felfritt.',need:'300 poäng i en flygning innan du tappar en fjäder',have:()=>[Math.min(stats.clean||0,300),300]},
 {id:'bio',name:'3D-glasögon',slot:'eyes',rarity:2,about:'Pappbågar från bion. Ett rött glas och ett blått.',need:'Flyg fem gånger',have:()=>[Math.min(flights,5),5]},
 {id:'lapp',name:'Ögonlapp',slot:'eyes',rarity:3,about:'Svart läder på sned rem. Höken var nära den gången.',need:'Bedriften Hökdansen (få höken att missa)',have:()=>[+done.has('hawk'),1]},
 {id:'brillor',name:'Pilotglasögon',slot:'eyes',rarity:3,about:'Guldbågar och mörka glas som döljer blicken.',need:'Nå tre stjärnor',have:()=>[Math.min(stats.maxStars,3),3]},
 {id:'monokel',name:'Monokel',slot:'eyes',rarity:4,about:'Guldbåge i ena ögat och en tunn kedja som dinglar.',need:'Nå fyra stjärnor',have:()=>[Math.min(stats.maxStars,4),4]},
 {id:'halsduk',name:'Halsduk',slot:'neck',rarity:2,about:'Tjock, stickad och randig, med två ändar som fladdrar.',need:'1 000 poäng totalt',have:()=>[stats.total,1000]},
 {id:'fluga',name:'Fluga',slot:'neck',rarity:2,about:'Röd och pösig. Fin nog för en kulturkväll.',need:'Bedriften Kulturfiende (pricka statyn)',have:()=>[+done.has('statue'),1]},
 {id:'slips',name:'Slips',slot:'neck',rarity:3,about:'Vit krage och randig slips som fladdrar i fartvinden.',need:'Klara fem händelser på torget',have:()=>[Math.min(stats.events,5),5]},
 {id:'kedja',name:'Guldkedja',slot:'neck',rarity:4,about:'Tung guldlänk med medaljong och röd sten.',need:'5 000 poäng totalt',have:()=>[stats.total,5000]},
 {id:'ryggsack',name:'Ryggsäck',slot:'back',rarity:2,about:'Röd skolväska med fickor, blixtlås och bärhandtag.',need:'Bedriften Plåtskadan (fem bilar på en flygning)',have:()=>[+done.has('cars'),1]},
 {id:'mantel',name:'Röd mantel',slot:'back',rarity:4,about:'Sammet med guldkant, guldfoder och ett stolt emblem.',need:'Flyg tio gånger',have:()=>[Math.min(flights,10),10]},
 {id:'jetpack',name:'Jetpack',slot:'back',rarity:5,about:'Två ståltankar och lågor som växer med farten. Bara för syns skull.',need:'25 000 poäng totalt',have:()=>[stats.total,25000]},
 {id:'gift',name:'Giftgrönt',slot:'poop',rarity:2,about:'Självlysande grönt. Ser farligare ut än det är.',need:'Bedriften Halkbana (få en bil att halka)',have:()=>[+done.has('slip'),1]},
 {id:'blabar',name:'Blåbärsbajs',slot:'poop',rarity:2,about:'Lila efter en dag i blåbärsskogen.',need:'Träffa 200 fotgängare totalt',have:()=>[stats.hits||0,200]},
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
const gooKinds={none:['#efe9d2','#e2dbb4','#d3cf9a','#f4f0e2','#c9c08a'],guld:['#f6cf4a','#e8b830','#ffd85e','#d9a520','#f2c84a'],regnbage:['#f0453a','#f59a2a','#f2d92e','#44b85a','#3d8fe0','#9a5bd0'],
 gift:['#8fe04a','#6fcf3a','#aaf060','#58b82e','#c4f77c'],blabar:['#6a5fd8','#5148ba','#8577ea','#3f3a9c','#9a90f2']},
 gooSplat={guld:'#f2c84a',gift:'#d9f7a6',blabar:'#c6c1f8'}; // the pale flecks that are flung from a splat
function applyLook(){
 const kind=wearing('poop')||'none',gold=kind==='guld';gooShade.splice(0,gooShade.length,...(gooKinds[kind]||gooKinds.none).map(rgb));
 gooMat=gold?-2:-1;splatCol.splice(0,3,...rgb(gooSplat[kind]||'#f4f1e6'));
}
// ---- Building shapes -----------------------------------------------------------------------------------------------
// make(emit) gives the tools the models are built with. Everything ends up as a grid of points handed to surface(), which
// works out smooth normals and passes the triangles on, corner by corner, to emit(batch, point, normal, colour).
// The batch decides the material: dyn is matt, cloth has a soft sheen, gloss shines and metal mirrors the sky.
function make(emit,q=1){
 const seg=n=>Math.max(3,Math.round(n*q)); // how many sides something round gets at this level of detail
 const S={
  q,seg,map:null, // set to move every point of what is being built (a hat worn at an angle)
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
   n=seg(n);return S.surface(prof.map(([r,y])=>Array.from({length:n},(_,i)=>{const a=i/n*tau;return [c[0]+r*Math.cos(a)*sx,c[1]+y,c[2]+r*Math.sin(a)*sz];})),true,col,batch);
  },
  ball(c,r,col,batch,n=8,sy=1){const m=q<1?3:5;return S.lathe(Array.from({length:m+1},(_,k)=>{const a=k/m*Math.PI;return [Math.max(1e-4,Math.sin(a))*r,Math.cos(a)*r*sy];}),c,col,batch,n);},
  // A round tube along a path of points. r is its radius, or a function of how far along (0..1) it is.
  tube(path,r,col,batch,n=6){
   if(q<1&&path.length>6)path=path.filter((_,k)=>k%2===0||k===path.length-1); // a long path needs fewer joints from afar
   n=seg(n);const R=typeof r==='function'?r:()=>r,m=path.length,rows=[];
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
const emitLive=(batch,p,n,c)=>batch.vert(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2]),live=make(emitLive),liveFar=make(emitLive,.5);
// In the wardrobe, the menu and the replay the bird is seen up close and everything is built in full detail. In flight it
// is a few centimetres across on the screen, and a version with a quarter of the triangles looks the same.
const lookDetail=()=>state==='play'?.5:1;
// Hats, glasses and the crown never change shape. Their triangles are worked out once, in the bird's own space, and are
// after that only carried along each frame. into() is the bird's own way of placing a point of its body in the world (see
// renderBird); still means a part that does not turn with the head. The head carries what sits on it as one stiff piece,
// so where its origin and three axes end up is asked for once, and every corner is then placed by plain arithmetic.
// Only a soft thing (a cap, a headband) lets the corners that lie on the neck, behind z = .27, follow the skin there
// as it twists: those few are placed one by one.
const rigidCache=new Map(),carry=new Float64Array(12);
function rigid(id,into,still,soft,build){
 const q=lookDetail(),key=id+q;let R=rigidCache.get(key);
 if(!R){
  const rec=new Map();
  build(make((batch,p,n,c)=>{let a=rec.get(batch);if(!a)rec.set(batch,a=[]);a.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2]);},q));
  R=[...rec].map(([batch,a])=>({batch,d:new Float32Array(a)}));rigidCache.set(key,R);
 }
 into(0,0,.3,carry,0,still);into(1,0,.3,carry,3,still);into(0,1,.3,carry,6,still);into(0,0,1.3,carry,9,still);
 const ox=carry[0],oy=carry[1],oz=carry[2],ax=carry[3]-ox,ay=carry[4]-oy,az=carry[5]-oz,bx=carry[6]-ox,by=carry[7]-oy,bz=carry[8]-oz,cx=carry[9]-ox,cy=carry[10]-oy,cz=carry[11]-oz;
 for(const {batch,d} of R){
  batch.reserve(d.length/9);const out=batch.data;let o=batch.n*STRIDE;batch.n+=d.length/9;
  for(let k=0;k<d.length;k+=9,o+=STRIDE){
   const x=d[k],y=d[k+1],z=d[k+2],nx=d[k+3],ny=d[k+4],nz=d[k+5];
   if(soft&&z<.27){
    into(x,y,z,carry,0,still);into(x+nx*.02,y+ny*.02,z+nz*.02,carry,3,still); // the point, and one just off the surface for its normal
    const ux=carry[3]-carry[0],uy=carry[4]-carry[1],uz=carry[5]-carry[2],l=Math.hypot(ux,uy,uz)||1;
    out[o]=carry[0];out[o+1]=carry[1];out[o+2]=carry[2];out[o+3]=ux/l;out[o+4]=uy/l;out[o+5]=uz/l;
   }else{
    const w=z-.3;out[o]=ox+ax*x+bx*y+cx*w;out[o+1]=oy+ay*x+by*y+cy*w;out[o+2]=oz+az*x+bz*y+cz*w;
    out[o+3]=ax*nx+bx*ny+cx*nz;out[o+4]=ay*nx+by*ny+cy*nz;out[o+5]=az*nx+bz*ny+cz*nz;
   }
   out[o+6]=d[k+6];out[o+7]=d[k+7];out[o+8]=d[k+8];out[o+9]=0;out[o+10]=0;out[o+11]=0;
  }
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
 const red=rgb('#cf3a2e'),seam=rgb('#8a1e16'),under=rgb('#30333a'),white=rgb('#f1ece2'),J=S.seg(18),I=S.seg(40),z0=.222,z1=.43,zb=.318;
 const cut=z=>mix(.318,.352,(z-z0)/(z1-z0)),lo=z=>{const [,cy,,h]=ringAt(z);return Math.asin(clamp((cut(z)-cy)/(h+.01),-1,.97));};
 const puff=(z,a)=>.012+.026*Math.sin(a)**2*Math.sin(Math.PI*clamp((z-z0+.02)/(z1-z0+.03),0,1)),skin=(z,a,lift=0)=>headPt(z,a,puff(z,a)+lift);
 const P=[];for(let j=0;j<=J;j++){const z=z0+(z1-z0)*j/J,row=[];for(let i=0;i<=I;i++)row.push(skin(z,mix(lo(z),Math.PI-lo(z),i/I)));P.push(row);}
 S.surface(P,false,(j,i)=>tint(red,.9+.1*Math.sin(Math.PI*i/I)),cloth);
 // where the cap's surface is, straight above a point seen from above; null outside the cap
 const over=(x,z,lift)=>{if(z<z0||z>z1)return null;const [,,w]=ringAt(z);let a=Math.acos(clamp(x/(w+.03),-1,1));a=Math.acos(clamp(x/(w+puff(z,a)),-1,1));return a<lo(z)||a>Math.PI-lo(z)?null:skin(z,a,lift);};
 for(let k=0;k<6;k++){ // six seams run from the button to the edge, as fine raised cords
  const ps=k*Math.PI/3,cord=[];for(let r=.012;r<.2;r+=.008/S.q){const p=over(r*Math.sin(ps),zb+r*Math.cos(ps),.0012);if(!p)break;cord.push(p);}
  if(cord.length>1)S.tube(cord,S.q<1?.003:.0021,seam,cloth,S.q<1?6:4);
  const e=S.q<1?null:over(.06*Math.sin(ps+Math.PI/6),zb+.06*Math.cos(ps+Math.PI/6),.0005);if(e)S.ball(e,.0034,under,gloss,6,.5); // an eyelet in the middle of each panel
 }
 S.tube([...P.map(r=>r[0]).reverse(),...P[0],...P.map(r=>r[I])],.0042,seam,cloth,5); // the rolled edge: down one side, round the back, up the other
 S.ball(skin(zb,Math.PI/2,.006),.011,seam,cloth);
 // the badge: a small oval of white embroidery with a red rim, sewn to the front
 const badge=[];for(let r=0;r<=4;r++){const row=[];for(let q=0;q<16;q++){const t=q/16*tau,k=r/4;row.push(skin(.396+.015*k*Math.sin(t),Math.PI/2+.27*k*Math.cos(t),.0035-.0025*k*k));}badge.push(row);}
 S.surface(badge,true,(j)=>j===4?seam:white,cloth);
 // the peak: a top and an underside with a rounded edge round them
 const y0=cut(z1)-.004,pk=(t,u,dy)=>{const w=.114*(1-.22*t*t);return [u*w,y0+dy-.03*t*t-.02*u*u,z1-.05+t*.175-.036*u*u*t];};
 const pj=S.seg(8),pi=S.seg(16),skinOf=(dy)=>Array.from({length:pj+1},(_,j)=>Array.from({length:pi+1},(_,i)=>pk(j/pj,i/pi*2-1,dy)));
 S.surface(skinOf(.004),false,(j)=>j%2?tint(red,.86):red,cloth);S.surface(skinOf(-.004),false,under,cloth);
 const edge=[];for(let j=0;j<=8;j++)edge.push(pk(j/8,-1,0));for(let i=1;i<=16;i++)edge.push(pk(1,i/16*2-1,0));for(let j=7;j>=0;j--)edge.push(pk(j/8,1,0));
 S.tube(edge,.005,tint(red,.8),cloth,5);
}
// Hög hatt: a felt top hat worn at a jaunty angle. A waisted crown with a bevelled top, a brim that curls up at the sides
// with a bound edge, a silk band and a gold buckle.
function buildTopHat(S){
 const felt=rgb('#1c1d22'),black=rgb('#0e0f12'),silk=rgb('#9c1f28'),gold=rgb('#e0b23a'),n=S.seg(40),c=[0,.39,.322],cr=Math.cos(.14),sr=Math.sin(.14),cx=Math.cos(-.08),sx=Math.sin(-.08);
 S.map=p=>{const x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2],x1=x*cr-y*sr,y1=x*sr+y*cr;return [c[0]+x1,c[1]+y1*cx-z*sx,c[2]+y1*sx+z*cx];}; // tipped to one side and a little back
 S.lathe([[1e-4,.157],[.05,.1565],[.08,.154],[.0905,.148],[.0925,.139],[.0885,.1],[.0858,.062],[.0868,.03],[.0885,0]],c,(j)=>j<3?black:felt,cloth,40);
 S.lathe([[.0888,.037],[.0912,.034],[.0912,.007],[.0895,.004]],c,silk,gloss,40);
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
 const n=S.seg(48),y0=.378,cz=.322,at=(phi,off,y)=>{const p=rimPt(y0,phi,off,cz);return [p[0],y,p[2]];},ring=(y,off,lump=0)=>Array.from({length:n},(_,i)=>at(i/n*tau,off*(1+lump*Math.sin(i*2.3)*Math.sin(i*.9)),y));
 S.surface([ring(y0-.009,.005),ring(y0-.005,.017,.12),ring(y0+.007,.022,.12),ring(y0+.019,.018,.12),ring(y0+.024,.012)],true,fur,cloth);
 for(let k=0;k<10;k++)S.ball(at((k+.5)/10*tau,.0225,y0+.006+(k%2?.004:-.003)),S.q<1?.007:.0052,spot,cloth,6,1.7); // the black tails of the ermine
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
  S.tube(arch,.0052,gold,metal,6);for(let q=1;q<8;q+=S.q<1?4:2)S.ball([arch[q][0],arch[q][1]+.006,arch[q][2]],.0062,pearl,gloss,6);
 }
 const top=y0+.166;S.ball([0,top,cz],.0155,gold,metal,10);S.tube([[0,top+.012,cz],[0,top+.05,cz]],.0042,gold,metal,5);S.tube([[-.015,top+.035,cz],[.015,top+.035,cz]],.0042,gold,metal,5);
}
// Ninjapannband: a strip of red cloth tied round the head above the eyes, folded along the middle, with a tight knot and two
// small loops at the back. Its two long tails are loose cloth (see ribbonEnd).
function buildHeadband(S){
 const red=rgb('#d01f26'),dark=rgb('#96131a'),n=S.seg(48),yc=phi=>.352+.006*Math.cos(phi),row=(dy,off)=>Array.from({length:n},(_,i)=>{const phi=i/n*tau;return rimPt(yc(phi)+dy,phi,off);});
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
  const lr=S.seg(5),li=S.seg(24),lens=[];for(let r=0;r<=lr;r++){const k=r/lr,row=[];for(let i=0;i<li;i++){const [phi,dy]=out(i/li*tau);row.push(at(s*.9+(phi-s*.9)*k,.006+(dy-.006)*k,.0135+.006*(1-k*k)));}lens.push(row);}
  S.surface(lens,true,(j,i)=>blend(warm,dark,clamp((lens[j][i][1]-y+.045)/.06,0,1)),gloss);
  S.tube(Array.from({length:li+1},(_,i)=>{const [phi,dy]=out(i/li*tau);return at(phi,dy,.0135);}),.0042,frame,metal,6);
  if(S.q===1)for(const [p0,w] of [[.52,.05],[.64,.022]]){ // two strokes of light across the glass
   const g=[];for(let k=0;k<=4;k++){const t=k/4;g.push([at(s*(p0+.2*t),.03-.045*t,.0205),at(s*(p0+w+.2*t),.03-.045*t,.0205)]);}S.surface(g,false,glint,gloss);}
  const arm=[];for(let k=0;k<=9;k++){const t=k/9;arm.push(at(s*mix(1.58,2.3,t),.03-.004*t-.03*Math.max(0,t-.75)**2*16,.011-.003*t));}S.tube(arm,.0033,frame,metal,5);
 }
 S.tube([at(-.2,.012,.016),at(0,.02,.02),at(.2,.012,.016)],.0036,frame,metal,5);S.tube([at(-.24,.034,.015),at(0,.04,.018),at(.24,.034,.015)],.003,frame,metal,5);
}
// Halsduk: a thick knitted scarf wrapped twice round the neck: ribbed, striped along its length in blue and cream, with a
// knot at the front. Its two ends hang loose (see ribbonEnd).
function buildScarf(S){
 const blue=rgb('#2f6fbf'),navy=rgb('#255596'),n=S.seg(44),Q=S.q<1?8:16;
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
// ---- More things to wear ---------------------------------------------------------------------------------------------
// Rule of thumb for which way a surface faces: rings laid out with brow() or circ() (x = sin, z = cos) go from the
// bottom up; rings round the neck with headPt() go from the tail towards the beak; tubes always face outwards.
// A map that tips whatever is being built round the point c: rz to the side (round the beak axis), rx forwards or back.
const tip=(c,rz,rx)=>{const cr=Math.cos(rz),sr=Math.sin(rz),cx=Math.cos(rx),sx=Math.sin(rx);
 return p=>{const x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2],x1=x*cr-y*sr,y1=x*sr+y*cr;return [c[0]+x1,c[1]+y1*cx-z*sx,c[2]+y1*sx+z*cx];};};
// The outline of the head where a horizontal slice at height y0 cuts it: (phi, off, y) is the point off outside it in the
// direction phi (0 = towards the beak), moved to the height y. Hats are built on it, so they follow the head's shape.
const brow=(y0,cz=.322)=>(phi,off,y=y0)=>{const p=rimPt(y0,phi,off,cz);return [p[0],y,p[2]];};
// A circle of n points round c at the height y (sz stretches it along the beak axis; lift(a) raises each point).
const circ=(c,n,r,y,sz=1,lift)=>Array.from({length:n},(_,i)=>{const a=i/n*tau;return [c[0]+r*Math.sin(a),c[1]+y+(lift?lift(a,r*Math.sin(a)):0),c[2]+r*Math.cos(a)*sz];});
// A rounded box: half-sizes a, b, d; e towards 0 is boxier, 1 is a ball.
function roundBox(S,c,[a,b,d],e,col,batch,J=10,I=20){
 const sp=v=>Math.sign(v)*Math.abs(v)**e,P=[];J=S.seg(J);I=S.seg(I);
 for(let j=0;j<=J;j++){const th=(.5-j/J)*Math.PI*.999,row=[];for(let i=0;i<I;i++){const ph=i/I*tau;row.push([c[0]+a*sp(Math.cos(th))*sp(Math.cos(ph)),c[1]+b*sp(Math.sin(th)),c[2]+d*sp(Math.cos(th))*sp(Math.sin(ph))]);}P.push(row);}
 return S.surface(P,true,col,batch);
}
// Stickad mössa: a knitted hat pulled down over the head, with a ribbed, turned-up cuff, a stripe and a fluffy pom-pom.
function buildBeanie(S){
 const green=rgb('#2c8c6a'),dark=rgb('#1f6a50'),cream=rgb('#efe8d8'),n=S.seg(48),y0=.348,cz=.322,at=brow(y0,cz),top=y0+.034;
 const ring=(y,off,s=1,back=0,rib=0)=>Array.from({length:n},(_,i)=>{const p=at(i/n*tau,off*(1+rib*(i%2?1:-1)),y);return [p[0]*s,y,cz+(p[2]-cz)*s-back];});
 S.surface([ring(y0-.014,.004),ring(y0-.011,.02,1,0,.14),ring(y0+.01,.024,1,0,.14),ring(y0+.03,.021,1,0,.14),ring(top,.012)],true,dark,cloth);
 const dome=[];for(let k=0;k<=9;k++){const t=k/9,th=t*Math.PI/2;dome.push(ring(top+.078*Math.sin(th),.013,Math.max(.004,Math.cos(th)**.8),.03*t*t,.06*(1-t)));}
 S.surface(dome,true,(j)=>j===2||j===3?cream:green,cloth);
 const pom=[0,top+.094,cz-.03];S.ball(pom,.031,cream,cloth,10);
 if(S.q===1)for(let k=0;k<9;k++){const a=k*2.4,e=.3+1.1*((k*7)%5)/5;S.ball([pom[0]+.022*Math.cos(a)*Math.cos(e),pom[1]+.022*Math.sin(e),pom[2]+.022*Math.sin(a)*Math.cos(e)],.015,tint(cream,.92+.08*(k%2)),cloth,6);}
}
// Partyhatt: a shiny paper cone in bright bands, with a fluffy rim, a pom-pom on the tip and an elastic under the chin.
function buildPartyHat(S){
 const cols=['#ffd23f','#e83e8c','#3fa9f5','#7bd44a'].map(rgb),white=rgb('#f6f2ea'),n=S.seg(28),c=[0,.38,.318],H=.2,R=.074,bands=8;
 S.map=tip(c,-.15,-.12);
 for(let k=0;k<bands;k++)S.surface([circ(c,n,R*(1-k/bands),H*k/bands),circ(c,n,Math.max(1e-4,R*(1-(k+1)/bands)),H*(k+1)/bands)],true,cols[k%4],gloss);
 S.tube(Array.from({length:n+1},(_,i)=>{const a=i/n*tau;return [c[0]+(R+.003)*Math.sin(a),c[1]+.002,c[2]+(R+.003)*Math.cos(a)];}),.0095,white,cloth,6);
 S.ball([c[0],c[1]+H+.012,c[2]],.021,white,cloth,8);
 S.map=null;
 S.tube(Array.from({length:25},(_,k)=>headPt(.305,1-k/24*5.14,.003)),.0028,white,cloth,4);
}
// Kockmössa: a chef's toque. A tall stiff band and a pleated top that billows out over it.
function buildChefHat(S){
 const white=rgb('#f6f3ec'),shade=rgb('#d3cdbf'),n=S.seg(48),y0=.37,cz=.322,at=brow(y0,cz);
 S.map=tip([0,y0,cz],-.1,-.08);
 const ring=(y,off,grow=1,pleat=0)=>Array.from({length:n},(_,i)=>{const p=at(i/n*tau,off,y),k=grow*(1+pleat*Math.cos(i/n*tau*12));return [p[0]*k,y,cz+(p[2]-cz)*k];});
 S.surface([ring(y0-.01,.003),ring(y0-.006,.015),ring(y0+.052,.015),ring(y0+.056,.009)],true,white,cloth);
 S.surface([[.054,1,0],[.066,1.2,.05],[.092,1.42,.07],[.125,1.5,.06],[.152,1.4,.05],[.172,1.1,.035],[.183,.6,.02],[.187,.01,0]].map(([dy,g,pl])=>ring(y0+dy,.009,g,pl)),true,(j,i)=>blend(shade,white,.55+.45*Math.cos(i/n*tau*12)),cloth);
 S.map=null;
}
// Vikingahjälm: a steel dome with a brass rim, rivets, a ridge over the top, a nose guard and two curved horns.
function buildViking(S){
 const steel=rgb('#aab3be'),brass=rgb('#c99a3a'),ivory=rgb('#f0e7d0'),bone=rgb('#b9a77c'),n=S.seg(40),y0=.346,cz=.322,at=brow(y0,cz),base=y0+.014;
 const ring=(y,off,s=1)=>Array.from({length:n},(_,i)=>{const p=at(i/n*tau,off,y);return [p[0]*s,y,cz+(p[2]-cz)*s];});
 const dome=[];for(let k=0;k<=8;k++){const th=k/8*Math.PI/2;dome.push(ring(base+.074*Math.sin(th),.012,Math.max(.004,Math.cos(th)**.9)));}
 S.surface(dome,true,steel,metal);
 S.surface([ring(y0-.014,.006),ring(y0-.01,.02),ring(base,.02),ring(base+.004,.013)],true,brass,metal);
 for(let k=0;k<12;k++)S.ball(at((k+.5)/12*tau,.021,y0+.002),.0072,steel,metal,6);
 const ridge=[];for(let k=0;k<=14;k++){const e=k/14*Math.PI,th=Math.min(e,Math.PI-e),p=at(e<Math.PI/2?0:Math.PI,.016),s=Math.max(.004,Math.cos(th)**.9);ridge.push([0,base+.076*Math.sin(th),cz+(p[2]-cz)*s]);}
 S.tube(ridge,.0085,brass,metal,6);
 const f=at(0,.02);S.tube([[0,y0-.006,f[2]],[0,y0-.026,f[2]+.004],[0,y0-.042,f[2]+.002]],t=>.011-.005*t,brass,metal,6);
 for(const s of [-1,1]){const horn=[];for(let k=0;k<=10;k++){const t=k/10;horn.push([s*(.1+.105*Math.sin(t*1.45)),y0+.04+.025*t+.115*t*t,cz-.004-.03*t*t]);}
  S.tube(horn,t=>.028*(1-t)**.7+.0025,(j)=>j<(S.q<1?1:2)?brass:blend(ivory,bone,.3*(j%2)),gloss,10);}
}
// Cowboyhatt: brown felt with a creased crown, a dark band with a silver concho, and a wide brim rolled up at the sides.
function buildCowboy(S){
 const felt=rgb('#a06f3c'),dark=rgb('#7a5229'),band=rgb('#33200f'),silver=rgb('#d5dae0'),n=S.seg(40),c=[0,.386,.322],sz=1.14;
 S.map=tip(c,-.1,-.1);
 S.surface([[.09,0,0],[.088,.03,0],[.084,.066,0],[.079,.094,.15],[.068,.108,.6],[.048,.114,.9],[.024,.115,1],[1e-4,.115,1]].map(([r,y,d])=>circ(c,n,r,y,sz,(a,x)=>-d*.03*Math.exp(-((x/.03)**2)))),true,felt,cloth);
 S.surface([[.0885,.003],[.0925,.006],[.0915,.027],[.087,.03]].map(([r,y])=>circ(c,n,r,y,sz)),true,band,cloth);
 S.ball([c[0],c[1]+.0165,c[2]+.0925*sz+.002],.012,silver,metal,8,.85);
 const curl=(a,t)=>.08*Math.sin(a)**2*t*t-.02*Math.cos(a)**2*t,rows=dy=>Array.from({length:8},(_,j)=>{const t=j/7;return circ(c,n,mix(.086,.19,t),.003+dy,sz,a=>curl(a,t));});
 S.surface(rows(.003).reverse(),true,felt,cloth);S.surface(rows(-.004),true,dark,cloth);
 S.tube(Array.from({length:n+1},(_,i)=>{const a=i/n*tau;return [c[0]+.191*Math.sin(a),c[1]+.003+curl(a,1),c[2]+.191*Math.cos(a)*sz];}),.006,dark,cloth,5);
 S.map=null;
}
// Gloria: a ring of light floating over the head. The ring shines by itself, and a wider, faint one is added as light round it.
function buildHalo(S){
 const gold=rgb('#ffd75a'),n=S.seg(40),c=[0,.53,.31],R=.092;S.map=tip(c,-.1,-.2);
 const loop=Array.from({length:n+1},(_,i)=>{const a=i/n*tau;return [c[0]+R*Math.sin(a),c[1],c[2]+R*Math.cos(a)];});
 S.tube(loop,.0115,gold,aglow,8);S.tube(loop,.026,[.003,.002,.0004],glow,6);S.map=null;
}
// The right eye, for what is worn over only one: the head's outline at its height, and the direction it lies in.
const eyeAt=(phi,dy,o)=>{const p=rimPt(.308+dy,phi,o,.33);return [p[0],.308+dy,p[2]];},eyePhi=1.425;
// Ögonlapp: a black leather patch over the right eye, on a strap that runs slanting round the head.
function buildPatch(S){
 const black=rgb('#16171b'),edge=rgb('#30333b'),m=S.seg(20),R=S.seg(4),P=[];
 for(let r=R;r>=0;r--){const k=r/R,row=[];for(let i=0;i<m;i++){const q=i/m*tau;row.push(eyeAt(eyePhi+.34*k*Math.cos(q),.043*k*Math.sin(q)*(Math.sin(q)<0?1.2:1),.007+.005*(1-k*k)));}P.push(row);}
 S.surface(P,true,(j)=>j===0?edge:black,gloss);
 const n=S.seg(40),strap=d=>Array.from({length:n},(_,i)=>{const phi=i/n*tau,y=.345-.037*Math.cos(phi-eyePhi)+d,p=rimPt(y,phi,d?.003:.0075,.33);return [p[0],y,p[2]];});
 S.surface([strap(-.0065),strap(0),strap(.0065)],true,edge,cloth);
}
// 3D-glasögon: the paper kind from the cinema. A white card frame that wraps round the head, one red lens and one cyan.
function buildMovieGlasses(S){
 const paper=rgb('#f4f1ea'),red=rgb('#e3262e'),cyan=rgb('#17bfd3'),at=brow(.326,.33),m=S.seg(28);
 const band=(p0,p1,d0,d1,o,col,batch)=>S.surface([d0,d1].map(d=>Array.from({length:m+1},(_,i)=>at(mix(p0,p1,i/m),o,.326+d))),false,col,batch);
 band(-1.62,1.62,-.03,.036,.011,paper,cloth);band(.2,1.5,-.021,.027,.0135,cyan,gloss);band(-1.5,-.2,-.021,.027,.0135,red,gloss);
 band(1.62,2.45,.008,.036,.008,paper,cloth);band(-2.45,-1.62,.008,.036,.008,paper,cloth);
}
// Monokel: a gold-rimmed eyeglass held in the right eye, with a fine cord that hangs loose from it (see ribbonEnd).
function buildMonocle(S){
 const gold=rgb('#e6b83e'),glint=rgb('#d6e6f2'),m=S.seg(24),ring=(q,o)=>eyeAt(eyePhi+.3*Math.cos(q),.039*Math.sin(q),o);
 S.tube(Array.from({length:m+1},(_,i)=>ring(i/m*tau,.012)),.0058,gold,metal,6);
 if(S.q===1)for(const [p0,w] of [[-.14,.05],[-.02,.02]]){const g=[];for(let k=3;k>=0;k--){const t=k/3;g.push([eyeAt(eyePhi+p0+.12*t,.022-.04*t,.0125),eyeAt(eyePhi+p0+w+.12*t,.022-.04*t,.0125)]);}S.surface(g,false,glint,gloss);}
 S.ball(monoclePin(),.0085,gold,metal,6);
}
const monoclePin=()=>eyeAt(eyePhi,-.046,.013);
// The top of the breast, just under the chin, where a bow tie or the knot of a tie sits: the point, the direction up
// along the breast and the direction straight out from it.
const throat=()=>{const p=headPt(.23,-Math.PI/2,0),n=[0,-.35,.94];return {c:[p[0],p[1]+n[1]*.018,p[2]+n[2]*.018],u:[0,.94,.35],n};};
const neckRing=(S,off,dz=0,m=S.seg(36))=>Array.from({length:m},(_,i)=>{const a=i/m*tau;return headPt(.205-.022*Math.sin(a)+dz,a,off);});
// Fluga: a red bow tie on a band round the neck. Two puffed wings pinched together by a knot.
function buildBowTie(S){
 const red=rgb('#c8202c'),dark=rgb('#8c141e'),{c,u,n}=throat(),Q=S.seg(12),L=S.seg(8);
 for(const s of [-1,1]){const P=[];
  for(let a=0;a<=L+1;a++){const t=Math.min(1,a/L),cap=a>L?.05:1,cx=s*(.012+.07*t),hh=(.009+.033*t**.8)*cap,th=(.006+.011*Math.sin(Math.PI*t)+.004*t)*cap,row=[];
   for(let i=0;i<Q;i++){const q=i/Q*tau,a1=hh*Math.cos(q),a2=th*Math.sin(q)*s+.006-cx*cx*1.4;row.push([c[0]+cx,c[1]+u[1]*a1+n[1]*a2,c[2]+u[2]*a1+n[2]*a2]);}P.push(row);}
  S.surface(P,true,(j)=>j<2||j>L?dark:red,cloth);}
 S.ball([c[0],c[1]+n[1]*.008,c[2]+n[2]*.008],.018,dark,cloth,8,.9);
 const r=neckRing(S,.004);S.tube([...r,r[0]],.006,dark,cloth,5);
}
// Slips: a white collar and the knot of a tie. The tie itself is loose cloth (see ribbonEnd).
function buildTie(S){
 const navy=rgb('#22386b'),white=rgb('#f3f0ea'),{c,n}=throat();
 S.surface([neckRing(S,.003,-.017),neckRing(S,.012,-.013),neckRing(S,.012,.013),neckRing(S,.003,.017)],true,white,cloth);
 roundBox(S,[c[0],c[1]+n[1]*.006,c[2]+n[2]*.006],[.021,.021,.015],.7,navy,cloth,6,10);
}
// Guldkedja: a heavy gold chain that sags under the neck, with a round medallion set with a red stone.
function buildChain(S){
 const gold=rgb('#f2c544'),deep=rgb('#b98a28'),ruby=rgb('#c8202c'),{u,n}=throat(),m=S.q<1?30:60,path=[];
 for(let i=0;i<=m;i++){const a=i/m*tau+Math.PI/2,sag=Math.max(0,-Math.sin(a));path.push(headPt(.2-.024*Math.sin(a),a,.009+.03*sag**3));}
 S.tube(path,t=>.009*(1+.28*Math.cos(t*m*Math.PI)),(j)=>j%2?gold:deep,metal,6);
 let z=.14;while(z<.23&&ringAt(z)[1]-ringAt(z)[3]<.03)z+=.004; // where the breast is at the height the medallion hangs
 const M=[0,.03,z+.022],low=path[m/2];
 S.tube([low,[M[0],M[1]+u[1]*.04,M[2]+u[2]*.04]],.004,gold,metal,4);
 S.map=p=>[M[0]+p[0],M[1]-p[2]*u[1]+p[1]*n[1],M[2]-p[2]*u[2]+p[1]*n[2]];
 S.lathe([[1e-4,.009],[.031,.009],[.041,.005],[.044,0],[.041,-.005],[1e-4,-.006]],[0,0,0],(j)=>j===2||j===3?deep:gold,metal,20);
 S.ball([0,.011,0],.015,ruby,gloss,8,.7);S.map=null;
}
// What is carried on the back lies along its slope, between the wings, held by two straps over the shoulders.
const onBack=tip([0,.25,.02],0,-.27);
function packStraps(S,col){for(const s of [-1,1]){const st=[];for(let k=0;k<=8;k++){const t=k/8;st.push(headPt(.125-.05*t,Math.PI/2-s*mix(.42,1.95,t),.011));}S.tube(st,.0105,col,cloth,5);}}
// Ryggsäck: a small red school bag with a front pocket, side pockets, zips and a carrying handle.
function buildBackpack(S){
 const red=rgb('#d8452f'),dark=rgb('#a52f1f'),grey=rgb('#3b3f47'),yellow=rgb('#f2c544'),y=.25,z=.02;
 S.map=onBack;
 roundBox(S,[0,y+.058,z-.005],[.09,.056,.105],.5,red,cloth,10,20);
 roundBox(S,[0,y+.108,z-.04],[.064,.022,.05],.55,dark,cloth,6,14);
 for(const s of [-1,1])roundBox(S,[s*.094,y+.05,z-.03],[.02,.035,.045],.6,dark,cloth,6,10);
 S.tube([[-.07,y+.113,z+.035],[0,y+.119,z+.04],[.07,y+.113,z+.035]],.0045,grey,cloth,4);
 S.tube([[-.045,y+.129,z-.02],[.045,y+.129,z-.02]],.004,yellow,metal,4);
 const h=[];for(let k=0;k<=6;k++){const t=k/6*Math.PI;h.push([.03*Math.cos(t),y+.075+.018*Math.sin(t),z+.1+.028*Math.sin(t)]);}S.tube(h,.007,grey,cloth,5);
 S.map=null;packStraps(S,grey);
}
// Jetpack: two steel tanks with a red stripe, joined by a block and a brass pipe, each ending in a dark nozzle that glows
// inside. The flames are drawn afresh every frame (see drawLook).
const jetNozzle=s=>[s*.06,.314,-.155];
function buildJetpack(S){
 const silver=rgb('#c9d0d8'),red=rgb('#d8452f'),dark=rgb('#3a3f47'),brass=rgb('#c99a3a'),hot=rgb('#ffb347'),y=.314,z=.02;
 S.map=onBack;
 for(const s of [-1,1]){const x=s*.06,P=[];for(let k=0;k<=14;k++)P.push([x,y,z-.12+.23*k/14]);
  S.tube(P,t=>.052*Math.sqrt(Math.max(.02,1-Math.max(0,Math.abs(2*t-1)-.72)**2/.0784)),(j)=>(S.q<1?j===5:j===9||j===10)?red:silver,metal,14);
  S.tube([[x,y,z-.11],[x,y,z-.14],[x,y,z-.175]],t=>.02+.018*t,dark,metal,10);
  S.ball([x,y,z-.166],.027,hot,aglow,8,.6);}
 roundBox(S,[0,y-.014,z],[.035,.03,.075],.5,dark,metal,6,10);
 S.tube([[-.06,y+.036,z+.04],[0,y+.05,z+.04],[.06,y+.036,z+.04]],.011,brass,metal,6);
 S.ball([0,y+.02,z-.02],.014,brass,metal,8);
 S.map=null;packStraps(S,dark);
}
function drawLook(into,toHead,toBody){
 const head=wearing('head');
 if(head==='keps')rigid('keps',into,false,true,buildCap);
 if(head==='hatt')rigid('hatt',into,false,false,buildTopHat);
 if(head==='krona')rigid('krona',into,false,false,buildCrown);
 if(head==='pannband'){
  rigid('pannband',into,false,true,buildHeadband);
  const b=headbandKnot(),red=rgb('#d01f26'),dark=rgb('#96131a');
  for(const s of [-1,1])ribbonEnd('band'+s,toHead([b[0]+s*.012,b[1]-.006,b[2]-.012]),13,.027,.02,(i)=>i===1?tint(red,.85):red,dark);
 }
 if(head==='mossa')rigid('mossa',into,false,true,buildBeanie);
 if(head==='party')rigid('party',into,false,false,buildPartyHat);
 if(head==='kock')rigid('kock',into,false,false,buildChefHat);
 if(head==='viking')rigid('viking',into,false,false,buildViking);
 if(head==='cowboy')rigid('cowboy',into,false,false,buildCowboy);
 if(head==='gloria')rigid('gloria',into,false,false,buildHalo);
 const eyes=wearing('eyes'),neck=wearing('neck'),back=wearing('back');
 if(eyes==='brillor')rigid('brillor',into,false,false,buildShades);
 if(eyes==='lapp')rigid('lapp',into,false,true,buildPatch);
 if(eyes==='bio')rigid('bio',into,false,false,buildMovieGlasses);
 if(eyes==='monokel'){rigid('monokel',into,false,false,buildMonocle);const gold=rgb('#e6b83e');ribbonEnd('monokel',toHead(monoclePin()),10,.024,.0035,()=>gold,gold);}
 if(neck==='fluga')rigid('fluga',into,true,false,buildBowTie);
 if(neck==='kedja')rigid('kedja',into,true,false,buildChain);
 if(neck==='slips'){
  rigid('slips',into,true,false,buildTie);
  const {c,u,n}=throat(),navy=rgb('#22386b'),red=rgb('#c8202c');
  ribbonEnd('slips',toBody([c[0],c[1]-u[1]*.014+n[1]*.012,c[2]-u[2]*.014+n[2]*.012]),11,.03,t=>t>.84?.002+.034*(1-t)/.16:.013+.025*t,(i,j)=>j%3===1?red:navy,navy,1);
 }
 if(back==='ryggsack')rigid('ryggsack',into,true,false,buildBackpack);
 if(back==='jetpack'){
  rigid('jetpack',into,true,false,buildJetpack);
  // the flames: longer the faster the bird flies, flickering, white-hot at the nozzle; a wider faint one is the light round them
  const t=performance.now()/1000,power=clamp(Math.hypot(forwardSpeed(),bird.vy)/30,.35,1.2),S=lookDetail()<1?liveFar:live,white=rgb('#fff6d8'),yellow=rgb('#ffd24a'),orange=rgb('#ff7a1f');
  for(const s of [-1,1]){const len=(.16+.16*power)*(1+.18*Math.sin(t*41+s)+.1*Math.sin(t*67+2*s)),f=jetNozzle(s),path=[];
   for(let k=0;k<=5;k++)path.push(toBody(onBack([f[0],f[1],f[2]-len*k/5])));
   S.tube(path,q=>.027*(1-q)**.8+.002,(j)=>j<2?white:j<4?yellow:orange,aglow,8);S.tube(path,q=>.06*(1-q*.8),[.02,.008,.001],glow,6);}
 }
 if(neck==='halsduk'){
  rigid('halsduk',into,true,false,buildScarf);
  const k=scarfKnot(),blue=rgb('#2f6fbf'),navy=rgb('#255596'),cream=rgb('#ece6d6');
  for(const [n,dx] of [[0,-.03],[1,.03]])ribbonEnd('scarf'+n,toBody([k[0]+dx,k[1]-.02,k[2]+.01*n]),13,.036,.04,(i,j)=>j===9||j===10?cream:i===1?blue:navy,cream,true); // two cream stripes near the end
 }
 drawCape(toBody);
}
// ---- Garderoben: the wardrobe ------------------------------------------------------------------------------------------
// A screen of its own: the bird on show up in the sky, to be turned by dragging, and beside it a tab for each part of the
// body with a tile for every thing there is. A tile carries a real picture of the thing (see makeThumb), the colour of its
// rarity, and a lock with what it takes until it has been earned. Picking a tile puts the thing on the bird at once:
// for good if it is unlocked, otherwise only to look at.
const W={slot:'head',pick:{},yaw:.95,tilt:.2,dist:1.1,span:.8,aim:[0,.33,.3],lastDrag:-9,thumbs:{},queue:[],fresh:new Set(),told:new Set(),box:null};
try{W.told=new Set(JSON.parse(localStorage.getItem('fagelbajs.lookTold')||'[]'));W.fresh=new Set(JSON.parse(localStorage.getItem('fagelbajs.lookNew')||'[]'));}catch{}
function saveNews(){try{localStorage.setItem('fagelbajs.lookTold',JSON.stringify([...W.told]));localStorage.setItem('fagelbajs.lookNew',JSON.stringify([...W.fresh]));}catch{}markNav();}
// How the bird is looked at for each part of the body: from which side, how steeply, and how many metres fit across the picture.
const stageView={
 head:{yaw:.95,tilt:.07,dist:1.3,span:1,aim:[0,.37,.28]},eyes:{yaw:.62,tilt:.03,dist:1.2,span:.72,aim:[0,.31,.33]},neck:{yaw:1,tilt:.06,dist:1.5,span:1.05,aim:[0,.2,.2]},
 back:{yaw:2.5,tilt:.4,dist:3,span:2.5,aim:[0,.05,-.5]},poop:{yaw:1.7,tilt:-.04,dist:3.2,span:2.3,aim:[0,-.45,-.5]}};
// The same for the small pictures on the tiles, thing by thing.
const thumbView={keps:{yaw:.9,tilt:.22,dist:1.1,span:.5,aim:[0,.36,.34]},pannband:{yaw:2.05,tilt:.25,dist:1.2,span:.62,aim:[0,.31,.2]},hatt:{yaw:.9,tilt:.12,dist:1.2,span:.56,aim:[0,.43,.32]},
 krona:{yaw:.9,tilt:.16,dist:1.2,span:.5,aim:[0,.44,.32]},brillor:{yaw:.55,tilt:.08,dist:1,span:.42,aim:[0,.32,.36]},halsduk:{yaw:1,tilt:.12,dist:1.3,span:.7,aim:[0,.18,.22]},
 mantel:{yaw:2.55,tilt:.5,dist:2.8,span:1.9,aim:[0,.05,-.55]},regnbage:{yaw:1.7,tilt:0,dist:3,span:1.5,aim:[0,-.5,-.5]},guld:{yaw:1.7,tilt:0,dist:3,span:1.5,aim:[0,-.5,-.5]},
 gift:{yaw:1.7,tilt:0,dist:3,span:1.5,aim:[0,-.5,-.5]},blabar:{yaw:1.7,tilt:0,dist:3,span:1.5,aim:[0,-.5,-.5]},
 mossa:{yaw:.9,tilt:.2,dist:1.1,span:.52,aim:[0,.39,.32]},party:{yaw:.9,tilt:.1,dist:1.2,span:.62,aim:[0,.45,.32]},kock:{yaw:.9,tilt:.1,dist:1.2,span:.66,aim:[0,.45,.32]},
 viking:{yaw:.7,tilt:.12,dist:1.2,span:.72,aim:[0,.42,.32]},cowboy:{yaw:.9,tilt:.16,dist:1.2,span:.7,aim:[0,.41,.32]},gloria:{yaw:.9,tilt:.2,dist:1.2,span:.62,aim:[0,.43,.32]},
 bio:{yaw:.55,tilt:.08,dist:1,span:.42,aim:[0,.32,.36]},lapp:{yaw:1.05,tilt:.08,dist:1,span:.44,aim:[.04,.32,.34]},monokel:{yaw:1.05,tilt:.04,dist:1,span:.44,aim:[.04,.3,.34]},
 fluga:{yaw:.6,tilt:-.2,dist:1.2,span:.56,aim:[0,.13,.25]},slips:{yaw:.75,tilt:-.12,dist:1.3,span:.74,aim:[0,.06,.18]},kedja:{yaw:.65,tilt:-.18,dist:1.2,span:.6,aim:[0,.1,.23]},
 ryggsack:{yaw:2.35,tilt:.5,dist:1.6,span:.9,aim:[0,.27,0]},jetpack:{yaw:2.45,tilt:.42,dist:1.7,span:1.05,aim:[0,.27,-.06]}};
// Some things are too small for the view of their part of the body, or sit where it does not look: these get their own.
const itemView={fluga:{yaw:.7,tilt:-.14,dist:1.4,span:.9,aim:[0,.16,.24]},slips:{yaw:.85,tilt:-.08,dist:1.5,span:1.1,aim:[0,.08,.16]},kedja:{yaw:.7,tilt:-.14,dist:1.4,span:.9,aim:[0,.14,.22]},
 ryggsack:{yaw:2.3,tilt:.42,dist:2,span:1.5,aim:[0,.22,-.05]},jetpack:{yaw:2.4,tilt:.38,dist:2.1,span:1.7,aim:[0,.2,-.15]}};
const wardrobeOpen=()=>!$('wardrobe').hidden;
const wornNow=slot=>{const l=lookList.find(l=>l.id===worn[slot]);return l&&unlocked(l)?l.id:null;};
function markNav(){const b=document.querySelector('#nav [data-view=looks]');if(b)b.classList.toggle('news',W.fresh.size>0&&!unlockAll);}
function openWardrobe(){
 if(!looksLive)return;
 W.pick={};for(const [slot] of lookSlots)W.pick[slot]=wornNow(slot);
 W.queue=lookList.filter(l=>!W.thumbs[l.id]);W.box=null;W.lastDrag=-9;
 $('wardrobe').hidden=false;document.body.classList.add('wardrobe');pausedDrawn=false;drawWardrobeUI();showPicks();
}
function closeWardrobe(){
 $('wardrobe').hidden=true;document.body.classList.remove('wardrobe');tryOn=null;applyLook();pausedDrawn=false;
 const b=document.querySelector('#nav [data-view=looks]');if(b)b.focus();
}
// What the bird on show is wearing: the picked thing in every slot, earned or not.
function showPicks(){tryOn={};for(const [slot] of lookSlots)tryOn[slot]=W.pick[slot]||null;applyLook();}
function pickLook(slot,id){
 const l=lookList.find(l=>l.id===id);W.pick[slot]=id||null;
 if(!id||unlocked(l)){worn[slot]=id||null;saveWorn();} // earned: it is worn from now on; locked: only tried on here
 if(id&&W.fresh.delete(id))saveNews();
 showPicks();drawWardrobeUI();
}
const lockSign='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1.6 0h3.8V5a1.9 1.9 0 0 0-3.8 0z"/></svg>';
function drawWardrobeUI(){
 const of=slot=>lookList.filter(l=>l.slot===slot),got=lookList.filter(unlocked).length;
 $('w-count').textContent=got+' / '+lookList.length+' upplåsta';
 $('w-tabs').innerHTML=lookSlots.map(([slot,name])=>'<button data-slot="'+slot+'" class="'+(slot===W.slot?'on':'')+(of(slot).some(l=>W.fresh.has(l.id))&&!unlockAll?' news':'')+'" aria-pressed="'+(slot===W.slot)+'">'+name+
  '<small>'+of(slot).filter(unlocked).length+'/'+of(slot).length+'</small></button>').join('');
 const pick=W.pick[W.slot]||'';
 $('w-grid').innerHTML='<button class="tile none'+(pick?'':' on')+'" data-item=""><i></i><b>Inget</b></button>'+of(W.slot).map(l=>{
  const open=unlocked(l),[a,b]=l.have();
  return '<button class="tile r'+l.rarity+(open?'':' locked')+(pick===l.id?' on':'')+'" data-item="'+l.id+'" title="'+esc(l.name)+'">'+
   '<img alt="" '+(W.thumbs[l.id]?'src="'+W.thumbs[l.id]+'"':'')+'>'+(open?(wornNow(l.slot)===l.id?'<em class="worn">✓</em>':W.fresh.has(l.id)&&!unlockAll?'<em class="new">NY</em>':''):'<em class="lock">'+lockSign+'</em>')+
   (open||b<=1?'':'<u><s style="width:'+Math.min(100,100*a/b)+'%"></s></u>')+'<b>'+esc(l.name)+'</b></button>';}).join('');
 const l=lookList.find(l=>l.id===pick),info=$('w-info');
 if(!l)info.innerHTML='<h3>Inget</h3><p>'+({head:'Barhuvad, som naturen tänkt.',eyes:'Blicken fri.',neck:'Halsen bar.',back:'Ryggen fri.',poop:'Det vanliga vita.'})[W.slot]+'</p>';
 else{const open=unlocked(l),[a,b]=l.have();
  info.innerHTML='<h3>'+esc(l.name)+'<span class="rar r'+l.rarity+'">'+rarityNames[l.rarity]+'</span></h3><p>'+esc(l.about)+'</p>'+
   (open?'<p class="state ok">✓ Används'+(wornNow(l.slot)===l.id?'':' inte')+'</p>':'<p class="state">'+lockSign+' '+esc(l.need)+(b>1?' <span>'+number(Math.min(a,b))+' / '+number(b)+'</span>':'')+'</p>'+
    (b>1?'<u><s style="width:'+Math.min(100,100*a/b)+'%"></s></u>':'')+'<p class="hint">Du provar den bara. Lås upp den för att flyga med den.</p>');}
 $('w-note').innerHTML='Sparas på den här enheten.'+(testSite?' <button data-unlockall="1">'+(unlockAll?'Testläge: lås igen':'Testläge: lås upp allt')+'</button>':'');
}
$('wardrobe').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='w-back')closeWardrobe();
 else if(b.dataset.slot){W.slot=b.dataset.slot;W.lastDrag=-9;drawWardrobeUI();}
 else if(b.classList.contains('tile'))pickLook(W.slot,b.dataset.item);
 else if(b.id==='w-clear'){for(const [slot] of lookSlots){W.pick[slot]=null;worn[slot]=null;}saveWorn();showPicks();drawWardrobeUI();}
 else if(b.id==='w-random'){ // one earned thing, or nothing, in every slot
  for(const [slot] of lookSlots){const mine=lookList.filter(l=>l.slot===slot&&unlocked(l)),l=mine[Math.floor(Math.random()*(mine.length+(slot==='head'?0:1)))];W.pick[slot]=worn[slot]=l?l.id:null;}
  saveWorn();showPicks();drawWardrobeUI();}
 else if(b.dataset.unlockall){unlockAll=!unlockAll;try{localStorage.setItem('fagelbajs.unlockAll',unlockAll?'yes':'no');}catch{}for(const [slot] of lookSlots)if(W.pick[slot]&&!unlocked(lookList.find(l=>l.id===W.pick[slot])))W.pick[slot]=wornNow(slot);showPicks();drawWardrobeUI();markNav();}
});
// Dragging on the bird turns it; left alone for a few seconds it goes back to swaying gently.
{const st=$('w-stage');let from=null;
 st.onpointerdown=e=>{st.setPointerCapture(e.pointerId);from=[e.clientX,e.clientY];st.classList.add('held','used');};
 st.onpointermove=e=>{if(!from)return;W.yaw-=(e.clientX-from[0])*.011;W.tilt=clamp(W.tilt+(e.clientY-from[1])*.007,-.45,1.1);from=[e.clientX,e.clientY];W.lastDrag=performance.now()/1000;};
 st.onpointerup=st.onpointercancel=()=>{from=null;st.classList.remove('held');};}
addEventListener('resize',()=>{W.box=null;});
if(looksLive){const b=document.createElement('button');b.dataset.view='looks';b.textContent='Garderob';$('nav').append(b);markNav();}
// What has been earned since last time: said once on the end screen, and marked as new in the wardrobe until it has been looked at.
function lookNews(){
 if(unlockAll)return '';
 const fresh=lookList.filter(l=>unlocked(l)&&!W.told.has(l.id));if(!fresh.length)return '';
 for(const l of fresh){W.told.add(l.id);W.fresh.add(l.id);}saveNews();
 return '<p class="unlock"><b>Nytt i garderoben</b> '+fresh.map(l=>esc(l.name)).join(' · ')+'</p>';
}
// ---- The bird on show. It is not the bird of the game (which may be lying dead in a street) but one of its own, gliding
// high above the same spot. While it is drawn it stands in for the real one, so that everything that draws a bird just works.
const stageBird={x:0,y:0,z:0,angle:0,bank:0,turn:0,spread:1,speed:14,vy:0,fold:0,steep:0,climb:0,flare:0,effort:.22,brake:0,snare:0,lookYaw:0,lookPitch:-.04,squirm:0,vb:0,vp:.03};
function onStage(draw,pooping){
 const real={bird,crash,drops,thrown,hawk,splash,mist,plume};
 stageBird.x=bird.x;stageBird.z=bird.z;stageBird.y=76;
 bird=stageBird;crash=null;thrown=[];hawk=null;splash=[];mist=[];plume=[];drops=pooping?demoDrops():[];fogBoost=3;
 try{draw();}finally{({bird,crash,drops,thrown,hawk,splash,mist,plume}=real);fogBoost=1;}
}
// A steady trickle to show what the droppings look like: drops born one after another at the vent, falling behind.
function demoDrops(){
 const v=ventPoint(),t=performance.now()/1000,gap=.055,first=Math.floor(t/gap),out=[];
 for(let k=15;k>=0;k--){const n=first-k,age=t-n*gap;
  out.push({x:v[0],y:v[1],z:v[2],vx:.5*Math.sin(n*.73),vy:-3,vz:-3.2+.4*Math.sin(n*2.1),age,r:n%7===0?.15:.06+.05*hash(n,2,6),seed:n,big:n%7===0,dark:n%4===0,hot:false});}
 return out;
}
// Aims the camera at a point of the bird (aim, in its own space) from the side yaw and the height tilt, so that the point
// lands at the pixel px,py and `span` metres at its distance fill `size` pixels.
function stageCamera(aim,yaw,tilt,dist,span,px,py,size){
 const T=birdPoint(aim),a=bird.angle+yaw,flat=dist*Math.cos(tilt),cx=T[0]+Math.sin(a)*flat,cz=T[2]+Math.cos(a)*flat,cy=T[1]+dist*Math.sin(tilt);
 scale=size/span*dist;
 const turn=Math.atan2(T[0]-cx,T[2]-cz)-Math.atan((px-width/2)/scale),pitch=tilt+Math.atan((height*.43-py)/scale);
 camera={x:cx,y:cy,z:cz,s:Math.sin(turn),c:Math.cos(turn),cp:Math.cos(pitch),sp:Math.sin(pitch),cr:1,sr:0,near:.05};
}
function drawWardrobe(dt){
 const v=itemView[W.pick[W.slot]]||stageView[W.slot],t=performance.now()/1000,k=1-Math.exp(-dt*5);
 if(t-W.lastDrag>3.5){W.yaw=mix(W.yaw,v.yaw+.4*Math.sin(t*.45),k*.35);W.tilt=mix(W.tilt,v.tilt,k*.35);}
 W.dist=mix(W.dist,v.dist,k);W.span=mix(W.span,v.span,k);for(let i=0;i<3;i++)W.aim[i]=mix(W.aim[i],v.aim[i],k);
 if(W.queue.length)makeThumb(W.queue.shift()); // one small picture a frame until every tile has its own
 if(!W.box){const r=$('w-stage').getBoundingClientRect();W.box=[r.left+r.width/2,r.top+r.height*.5,Math.min(r.width,r.height*1.2)];}
 onStage(()=>{
  stageBird.lookYaw=.25*Math.sin(t*.8);stageBird.lookPitch=-.04+.05*Math.sin(t*.5);clothDt=Math.min(dt||1/60,.05);updateCape(clothDt);
  stageCamera(W.aim,W.yaw,W.tilt,W.dist,W.span,W.box[0],W.box[1],W.box[2]);draw3D();
 },W.slot==='poop');
}
// The picture on a tile: the bird wearing only that thing, drawn in the middle of the screen and copied from there.
// (The frame that is shown is drawn afterwards, on top, so this one is never seen.)
function makeThumb(l){
 const size=Math.round(128*Math.min(devicePixelRatio||1,2)),side=Math.min(width,height)*.5,v=thumbView[l.id],was=tryOn,phase=wingPhase;
 tryOn={head:null,eyes:null,neck:null,back:null,poop:null,[l.slot]:l.id};applyLook();wingPhase=1.15;
 onStage(()=>{
  stageBird.lookYaw=0;stageBird.lookPitch=-.04;clothDt=1/60;
  if(['mantel','pannband','halsduk','slips','monokel'].includes(l.id))for(let i=0;i<45;i++){updateCape(1/60);dyn.n=0;goo.n=0;glow.n=0;for(const b of extraBatches)b.n=0;renderBird();} // let the cloth settle in the wind first
  stageCamera(v.aim,v.yaw,v.tilt,v.dist,v.span,width/2,height*.43,side);draw3D();
  const c=document.createElement('canvas'),px=side*density;c.width=c.height=size;
  c.getContext('2d').drawImage(glCanvas,width/2*density-px/2,height*.43*density-px/2,px,px,0,0,size,size);W.thumbs[l.id]=c.toDataURL('image/jpeg',.88);
 },l.slot==='poop');
 tryOn=was;applyLook();wingPhase=phase;
 const img=document.querySelector('#w-grid [data-item="'+l.id+'"] img');if(img)img.src=W.thumbs[l.id];
}
// Progress is counted at the end of every flight, and when an event is completed.
function countFlight(){
 stats.total+=points;stats.maxStars=Math.max(stats.maxStars,wanted);stats.hits=(stats.hits||0)+hits;stats.cars=(stats.cars||0)+carsHit;
 stats.clean=Math.max(stats.clean||0,run.cleanPts??points); // the score when the first feather was lost, or all of it
 saveStats();
}

// ---- Röd mantel: a cape that is real cloth. A grid of points joined by springs (Verlet), pinned across the
// shoulders, pulled by gravity and by the air streaming past the bird, with a little flutter that grows with speed.
// Points that end up inside the bird's body are pushed back out, so the cape drapes over the back and tail.
const cape={cols:8,rows:17,pts:null,acc:0,pins:null},capeFlare=.07; // how much wider each row is than the one before
function toBirdLocal([X,Y,Z]){ // the inverse of birdPoint()
 const b=bird,bank=(b.vb??b.bank)*1.02,pitch=flightPitch(),sy=Math.sin(b.angle),cy=Math.cos(b.angle),sb=Math.sin(bank),cb=Math.cos(bank),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const dx=X-b.x,dy=Y-b.y,dz=Z-b.z,bx=dx*cy-dz*sy,bz=dx*sy+dz*cy,by=dy*cp-bz*sp,z=dy*sp+bz*cp;
 return [bx*cb-by*sb,bx*sb+by*cb,z];
}
// The cloth asks thousands of times a frame whether a point is inside the bird. So the bird's place and its three axes
// are noted once per step (noteBird), and the body's cross-sections are read from a table instead of being worked out.
const B={ox:0,oy:0,oz:0,x:[1,0,0],y:[0,1,0],z:[0,0,1]},ringZ0=-.49,ringZ1=.444,ringN=96;
const ringTable=(()=>{const t=new Float32Array((ringN+1)*3);for(let k=0;k<=ringN;k++){const r=ringAt(mix(ringZ0,ringZ1,k/ringN));t[k*3]=r[1];t[k*3+1]=r[2];t[k*3+2]=r[3];}return t;})();
function noteBird(){
 const o=birdPoint([0,0,0]),x=birdPoint([1,0,0]),y=birdPoint([0,1,0]),z=birdPoint([0,0,1]);
 B.ox=o[0];B.oy=o[1];B.oz=o[2];B.x=[x[0]-o[0],x[1]-o[1],x[2]-o[2]];B.y=[y[0]-o[0],y[1]-o[1],y[2]-o[2]];B.z=[z[0]-o[0],z[1]-o[1],z[2]-o[2]];
}
function capePin(i){const t=i/(cape.cols-1),a=mix(.62,Math.PI-.62,t);return birdPoint(headPt(.08,a,.022));}
function resetCape(){
 cape.pts=[];for(let j=0;j<cape.rows;j++)for(let i=0;i<cape.cols;i++){const p=capePin(i),q=toBirdLocal(p),w=birdPoint([q[0]*(1+j*capeFlare),q[1]+.03,q[2]-j*.075]);cape.pts.push({p:w,o:w.slice()});}
 cape.rest=[];for(let i=0;i<cape.cols-1;i++){const a=capePin(i),b=capePin(i+1);cape.rest.push(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));}
}
function updateCape(dt){
 if(wearing('back')!=='mantel'){cape.pts=null;return;}
 noteBird();const pins=Array.from({length:cape.cols},(_,i)=>capePin(i));
 if(!cape.pts||Math.hypot(...[0,1,2].map(k=>cape.pts[0].p[k]-pins[0][k]))>3){resetCape();cape.pins=pins;}
 const C=cape.cols,R=cape.rows,P=cape.pts,seg=.075,h=1/240,speed=Math.hypot(forwardSpeed(),bird.vy),air=airAt(),from=cape.pins||pins;
 const side=[pins[C-1][0]-pins[0][0],pins[C-1][1]-pins[0][1],pins[C-1][2]-pins[0][2]],sl=Math.hypot(...side)||1;side[0]/=sl;side[1]/=sl;side[2]/=sl; // across the shoulders
 cape.acc=Math.min(cape.acc+dt,.06);const steps=Math.floor(cape.acc/h);cape.acc-=steps*h;
 const now=performance.now()/1000*5,wind=Math.hypot(air[0],air[2]),diag=cape.rest.map(w=>Array.from({length:R},(_,j)=>Math.hypot(w*(1+j*capeFlare),seg)));
 for(let s=1;s<=steps;s++){const f=s/steps;
  for(let j=0;j<R;j++)for(let i=0;i<C;i++){
   const q=P[j*C+i];if(j===0){q.o=q.p;q.p=[mix(from[i][0],pins[i][0],f),mix(from[i][1],pins[i][1],f),mix(from[i][2],pins[i][2],f)];q.pin=true;continue;} // the shoulders glide with the bird between frames
   const v=[(q.p[0]-q.o[0])/h,(q.p[1]-q.o[1])/h,(q.p[2]-q.o[2])/h];
   // gusts vary smoothly over the cloth, so it billows in waves instead of shivering point by point
   const t=now-j*.42,g=.4+.1*Math.max(speed,wind),w=[air[0]+g*Math.sin(t+i*.25),air[1]+g*2.2*Math.sin(t*1.15+i*.2),air[2]+g*Math.cos(t*.8)];
   // the air that fills a cape also holds it open: each side is pushed outwards, more the further down the cape it is
   const open=(i/(C-1)-.5)*(3+.5*speed)*Math.min(1,j/5),k=5,a=[(w[0]-v[0])*k+side[0]*open,(w[1]-v[1])*k-9.8+side[1]*open,(w[2]-v[2])*k+side[2]*open];
   q.o=q.p;q.p=[q.p[0]+v[0]*h*.996+a[0]*h*h,q.p[1]+v[1]*h*.996+a[1]*h*h,q.p[2]+v[2]*h*.996+a[2]*h*h];
  }
  const link=(A,B,L)=>{const a=A.p,b=B.p,dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6,c=(l-L)/l,wa=A.pin?0:B.pin?1:.5,wb=1-wa;
   a[0]+=dx*c*wa;a[1]+=dy*c*wa;a[2]+=dz*c*wa;b[0]-=dx*c*wb;b[1]-=dy*c*wb;b[2]-=dz*c*wb;};
  for(let it=0;it<5;it++){
   for(let j=0;j<R;j++)for(let i=0;i<C;i++){const q=P[j*C+i],w=cape.rest[Math.min(i,C-2)]*(1+j*capeFlare);
    if(i<C-1)link(q,P[j*C+i+1],w);if(j<R-1)link(q,P[(j+1)*C+i],seg);if(j<R-1&&i<C-1)link(q,P[(j+1)*C+i+1],diag[i][j]);if(j<R-2)link(q,P[(j+2)*C+i],seg*2);}
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
 const far=lookDetail()<1,S=far?liveFar:live,bw=far?0:1,G=far?raw:refine(raw),J=G.length,I=G[0].length,nor=(j,i)=>{ // which way the cloth faces at a point; the side away from this is the outside
  const a=G[j][Math.min(I-1,i+1)],b=G[j][Math.max(0,i-1)],c=G[Math.min(J-1,j+1)][i],d=G[Math.max(0,j-1)][i],u=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],v=[c[0]-d[0],c[1]-d[1],c[2]-d[2]];
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return [n[0]/l,n[1]/l,n[2]/l];};
 const N=G.map((row,j)=>row.map((_,i)=>nor(j,i))),lift=(k)=>G.map((row,j)=>row.map((p,i)=>[p[0]+N[j][i][0]*k,p[1]+N[j][i][1]*k,p[2]+N[j][i][2]*k]));
 S.surface(lift(-.004),false,(j,i)=>i<=bw||i>=I-1-bw||j>=J-2-bw?gold:j<1+bw?deep:tint(red,.88+.12*Math.sin(i*(far?1.8:.9))),cloth);
 S.surface(lift(.004),false,lining,cloth);
 // the emblem: three heaped coils and a tip, laid on the cloth wherever it happens to be
 const at=(u,v)=>{const x=clamp(u,0,1)*(I-1),y=clamp(v,0,1)*(J-1),i=Math.min(I-2,Math.floor(x)),j=Math.min(J-2,Math.floor(y)),fx=x-i,fy=y-j,p=[0,0,0];
  for(let k=0;k<3;k++)p[k]=mix(mix(G[j][i][k],G[j][i+1][k],fx),mix(G[j+1][i][k],G[j+1][i+1][k],fx),fy)-N[j][i][k]*.0075;return p;};
 for(const [v0,ru,rv] of [[.57,.25,.062],[.485,.185,.054],[.41,.125,.046],[.35,.06,.036]]){ // (how far down the cape, half its width, half its height)
  const n=N[Math.round(v0*(J-1))][I>>1],out=[-n[0],-n[1],-n[2]],c=at(.5,v0);let prev=at(.5+ru,v0);
  for(let q=1,m=far?8:12;q<=m;q++){const a=q/m*tau,p=at(.5+ru*Math.cos(a),v0+rv*Math.sin(a));metal.vert(c[0],c[1],c[2],out[0],out[1],out[2],gold[0],gold[1],gold[2]);
   metal.vert(prev[0],prev[1],prev[2],out[0],out[1],out[2],gold[0],gold[1],gold[2]);metal.vert(p[0],p[1],p[2],out[0],out[1],out[2],gold[0],gold[1],gold[2]);prev=p;}
 }
 // collar, clasps and chain
 const collar=[raw[0],raw[0].map(p=>{const l=toBirdLocal(p);return birdPoint([l[0]*1.06,l[1]+.032,l[2]+.02]);})];S.surface(collar,false,gold,metal);
 for(const a of [.62,Math.PI-.62])S.ball(toBody(headPt(.095,a,.03)),.024,gold,metal,8,.6);
 S.tube(Array.from({length:15},(_,k)=>toBody(headPt(.115,.62-k/14*(Math.PI+1.24),.012+.012*Math.sin(k/14*Math.PI)))),.0055,(j)=>j%2?gold:tint(gold,.7),metal,5);
}

// ---- Loose cloth ends (scarf ends, headband tails): a chain of points hanging from a pin, simulated like the cape:
// gravity, drag against the air the bird flies through, gusts that grow with speed, and kept out of the body.
const chains={};let clothDt=1/60; // set every frame by the main loop: game time while flying, real time in the menus
function airAt(){ // the air's velocity: still while flying (the bird moves through it), a steady breeze in the menu preview
 return state==='play'||state==='crash'?[0,0,0]:[-Math.sin(bird.angle)*9,0,-Math.cos(bird.angle)*9];
}
function pushOutOfBird(q,margin){
 const p=q.p,dx=p[0]-B.ox,dy=p[1]-B.oy,dz=p[2]-B.oz,lz=dx*B.z[0]+dy*B.z[1]+dz*B.z[2];
 if(lz<-.8||lz>ringZ1)return;
 const lx=dx*B.x[0]+dy*B.x[1]+dz*B.x[2],ly=dx*B.y[0]+dy*B.y[1]+dz*B.y[2];let nx=lx,ny=ly;
 if(lz>=ringZ0){
  const k=Math.round((lz-ringZ0)/(ringZ1-ringZ0)*ringN)*3,cy=ringTable[k],e=(lx/(ringTable[k+1]+margin))**2+((ly-cy)/(ringTable[k+2]+margin))**2;
  if(e>=1)return;const s=1/Math.sqrt(Math.max(e,1e-4));nx=lx*s;ny=cy+(ly-cy)*s;
 }else{if(Math.abs(lx)>=.22||ly>=.06+margin||ly<=-.04)return;ny=.06+margin;} // the tail fan
 const ex=nx-lx,ey=ny-ly,mx=B.x[0]*ex+B.y[0]*ey,my=B.x[1]*ex+B.y[1]*ey,mz=B.x[2]*ex+B.y[2]*ey; // out to the surface, without kicking it
 p[0]+=mx;p[1]+=my;p[2]+=mz;q.o[0]+=mx*.85;q.o[1]+=my*.85;q.o[2]+=mz*.85;
}
function stepChain(ch,pin,seg,dt,speed){
 const n=ch.p.length,h=1/240,air=airAt(),now=performance.now()/1000*5;ch.acc=Math.min(ch.acc+dt,.06);const from=ch.pin||pin;let steps=Math.floor(ch.acc/h);ch.acc-=steps*h;
 for(let s=1;s<=steps;s++){const f=s/steps,P=[mix(from[0],pin[0],f),mix(from[1],pin[1],f),mix(from[2],pin[2],f)];
  for(let i=1;i<n;i++){const q=ch.p[i],v=[(q.p[0]-q.o[0])/h,(q.p[1]-q.o[1])/h,(q.p[2]-q.o[2])/h];
   const t=now+i*.45+ch.seed,g=.5+.12*Math.max(speed,Math.hypot(air[0],air[2])),w=[air[0]+g*Math.sin(t),air[1]+g*.7*Math.sin(t*1.3),air[2]+g*Math.cos(t*.9)],k=6;
   const a=[(w[0]-v[0])*k,(w[1]-v[1])*k-9.8,(w[2]-v[2])*k];q.o=q.p;q.p=[q.p[0]+v[0]*h*.997+a[0]*h*h,q.p[1]+v[1]*h*.997+a[1]*h*h,q.p[2]+v[2]*h*.997+a[2]*h*h];}
  ch.p[0].o=ch.p[0].p;ch.p[0].p=P;
  for(let it=0;it<5;it++){for(let i=0;i<n-1;i++){const a=ch.p[i].p,b=ch.p[i+1].p,dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6,c=(l-seg)/l,wa=i===0?0:.5,wb=1-wa;
    a[0]+=dx*c*wa;a[1]+=dy*c*wa;a[2]+=dz*c*wa;b[0]-=dx*c*wb;b[1]-=dy*c*wb;b[2]-=dz*c*wb;}
   for(let i=1;i<n;i++){pushOutOfBird(ch.p[i],.022);if(ch.p[i].p[1]<.03)ch.p[i].p[1]=.03;}}
 }
 ch.pin=pin;
}
// A loose end of cloth hanging from pin: n points long, drawn three points wide with a slight fold along the middle.
// col(i) colours the three strips across it; edge is the colour of the last bit and, on a flat end, of its fringe.
// width may be a function of how far along it is (0..1); flat = true lies flat and ends in a fringe, 1 lies flat without one.
function ribbonEnd(id,pin,n,seg,width,col,edge,flat){
 let ch=chains[id];
 if(!ch||Math.hypot(ch.p[0].p[0]-pin[0],ch.p[0].p[1]-pin[1],ch.p[0].p[2]-pin[2])>1){ch=chains[id]={p:Array.from({length:n},(_,i)=>{const p=[pin[0],pin[1]-i*seg,pin[2]];return {p,o:p.slice()};}),acc:0,seed:Math.random()*9};}
 noteBird();stepChain(ch,pin,seg,clothDt,Math.hypot(forwardSpeed(),bird.vy));
 const o=birdPoint([0,0,0]),up=birdPoint([0,1,0]).map((v,i)=>v-o[i]),right=birdPoint([1,0,0]).map((v,i)=>v-o[i]),G=[];
 for(let i=0;i<n;i++){const a=ch.p[Math.max(0,i-1)].p,b=ch.p[Math.min(n-1,i+1)].p,d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],dl=Math.hypot(...d)||1;
  let w=flat?right:[d[1]*up[2]-d[2]*up[1],d[2]*up[0]-d[0]*up[2],d[0]*up[1]-d[1]*up[0]];const l=Math.hypot(...w)||1,s=(typeof width==='function'?width(i/(n-1)):width*(flat?1:1-.25*i/n))/l,p=ch.p[i].p;
  const f=[(d[1]*w[2]-d[2]*w[1])/dl/l*.006,(d[2]*w[0]-d[0]*w[2])/dl/l*.006,(d[0]*w[1]-d[1]*w[0])/dl/l*.006]; // the fold stands a little proud
  G.push([-1,-.34,.34,1].map(k=>[p[0]+w[0]*s*k+f[0]*(1-k*k),p[1]+w[1]*s*k+f[1]*(1-k*k),p[2]+w[2]*s*k+f[2]*(1-k*k)]));}
 const S=lookDetail()<1?liveFar:live;S.surface(G,false,(j,i)=>j>=n-2?edge:col(Math.min(i,2),j),cloth);
 if(flat===true){const last=G.at(-1),prev=G.at(-2),d=[last[1][0]-prev[1][0],last[1][1]-prev[1][1],last[1][2]-prev[1][2]],dl=Math.hypot(...d)||1; // a fringe of tassels
  for(let f=0,m=S.q<1?3:6;f<=m;f++){const t=f/m,k=t*3,i=Math.min(2,Math.floor(k)),u=k-i,p=[0,1,2].map(q=>mix(last[i][q],last[i+1][q],u));
   S.tube([p,[p[0]+d[0]/dl*.03,p[1]+d[1]/dl*.03-.012,p[2]+d[2]/dl*.03]],S.q<1?.007:.0045,edge,cloth,4);}}
}
