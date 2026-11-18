'use strict';
// ---- Utseende: things for the dove to wear, unlocked by playing and kept in this browser.
// Not live yet: the menu page and the looks only appear with ?looks=1 in the address, for trying them out.
const looksLive=/[?&]looks=1/.test(location.search);
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
 {id:'rosa',name:'Rosa duva',slot:'body',need:'Klara en händelse',have:()=>[Math.min(stats.events,1),1]},
 {id:'krona',name:'Krona',slot:'head',need:'Nå fem stjärnor',have:()=>[Math.min(stats.maxStars,5),5]},
 {id:'guld',name:'Guldbajs',slot:'poop',need:'10 000 poäng totalt',have:()=>[stats.total,10000]},
];
let worn={};try{worn=JSON.parse(localStorage.getItem('fagelbajs.look')||'{}');}catch{}
const unlocked=l=>{const [a,b]=l.have();return a>=b;};
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
 const goo=(wearing('poop')==='guld'?goldGoo:normalGoo).map(rgb);gooShade.splice(0,gooShade.length,...goo);
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
function drawLook(face,plain,toHead,toBody){
 if(!looksLive)return;
 const C=s=>rgb(s),head=wearing('head');
 if(head==='keps'){ // a baseball cap: six panels with seams, a button on top, a curved peak and a small white badge
  const red=C('#d23b2f'),seam=C('#a52a22');
  lathe(Array.from({length:8},(_,k)=>{const a=k/7*Math.PI/2;return [.128*Math.sin(a)+.0001,.085*Math.cos(a)];}),[0,.37,.325],(j,i)=>i%5===0&&j>0?seam:red,toHead,{n:30});
  const peak=[];for(let j=0;j<=6;j++){const t=j/6,row=[];for(let i=0;i<=8;i++){const u=i/8*2-1,w=.115*(1-.25*t);row.push([u*w,.378-.02*t-.03*u*u,.43+t*.16-.04*u*u]);}peak.push(row);}
  surface(peak,false,()=>C('#b8302a'),toHead);
  ball([0,.458,.315],.013,C('#a52a22'),toHead);ball([0,.41,.425],.014,C('#f4f0e6'),toHead);
 }
 if(head==='hatt'){ // a top hat: curled brim, a slightly flared crown, a red silk band with a gold buckle
  const black=C('#17181b'),silk=C('#a8252b');
  lathe([[0,.235],[.098,.235],[.104,.228],[.1,.12],[.097,.07],[.099,.045],[.103,.03],[.165,.022],[.178,.03],[.18,.022],[.168,.01],[.1,.012]],[0,.385,.33],(j)=>j>=5&&j<=6?silk:black,toHead,{n:28,sz:1.05,batch:goo});
  surface([[[-.025,.075,.435],[.025,.075,.435]],[[-.025,.04,.437],[.025,.04,.437]]].map(r=>r.map(p=>[p[0],p[1]+.385,p[2]])),false,()=>C('#e8b830'),toHead,goo);
 }
 if(head==='krona'){ // a gold crown: a band set with jewels, five points with pearls, red velvet inside
  const gold=C('#e8b830'),jewel=['#d01f26','#2f6fbf','#2e8b57'];
  lathe([[.096,.07],[.099,.045],[.097,.0]],[0,.365,.33],()=>gold,toHead,{n:30,batch:goo});
  lathe([[0,.085],[.055,.078],[.083,.055],[.09,.03]],[0,.365,.33],()=>C('#8a1020'),toHead,{n:20});
  for(let k=0;k<5;k++){const a=k/5*tau+.3,x=Math.cos(a)*.097,z=.33+Math.sin(a)*.097;
   surface([[[x-Math.sin(a)*.03,.435,z+Math.cos(a)*.03],[x+Math.sin(a)*.03,.435,z-Math.cos(a)*.03]],[[x,.495,z],[x,.495,z]]],false,()=>gold,toHead,goo);
   ball([x,.5,z],.011,C('#f8f4ea'),toHead,goo);ball([Math.cos(a+.63)*.1,.39,.33+Math.sin(a+.63)*.1],.013,C(jewel[k%3]),toHead,goo);}
 }
 if(head==='pannband'){ // a red headband across the forehead, knotted behind with two long tails in the wind
  const red=C('#d01f26');
  lathe([[.131,.018],[.134,0],[.131,-.018]],[0,.345,.335],()=>red,toHead,{n:30,tilt:-.28});
  ball([0,.385,.205],.022,C('#a8161c'),toHead);
  for(const s of [-1,1])strip([s*.012,.385,.2],[s*.25,-.35,-.9].map(v=>v/1.0),[1,0,0],.26,.016,red,toHead,t=>[s*.03*t*Math.sin(elapsed*12+t*7),.025*t*Math.sin(elapsed*9+t*5+s),0]);
 }
 if(wearing('eyes')==='brillor'){ // aviator-style shades: curved dark lenses with a sheen, a thin gold frame, a bridge and arms
  for(const sx of [-1,1]){
   const lens=[];for(let j=0;j<=4;j++){const row=[];for(let i=0;i<=14;i++){const a=i/14*tau,rr=j/4;row.push([sx*(.138+.012*(1-rr*rr)),.31+.042*rr*Math.sin(a),.362+.055*rr*Math.cos(a)]);}lens.push(row);}
   surface(lens,false,(j)=>C(j<2?'#2a3340':'#11161d'),toHead,goo);
   lathe([[.004,.004],[.006,0],[.004,-.004]],[0,0,0],()=>C('#c9a04a'),p=>{const a=Math.atan2(p[2],p[0]);return toHead([sx*.139,.31+.044*Math.sin(a)+p[1]*.0,.362+.057*Math.cos(a)]);},{n:16});
   surface([[[sx*.139,.33,.31],[sx*.139,.336,.31]],[[sx*.128,.33,.22],[sx*.128,.336,.22]]],false,()=>C('#c9a04a'),toHead);
  }
 }
 if(wearing('neck')==='halsduk'){ // a chunky knitted scarf in blue and cream stripes, wrapped twice, one end hanging and swinging
  const blue=C('#2f6fbf'),cream=C('#ece6d6');
  for(const k of [0,1]){const y=.19+k*.042;
   lathe([[.15+.012*k,.026],[.168+.01*k,.0],[.15+.012*k,-.026]].map(([r,h])=>[r,h]),[0,y,.215-.01*k],(j,i)=>(Math.floor(i/3)+k)%2?cream:blue,toBody,{n:36,sz:1.05});}
  const sway=Math.sin(elapsed*5)*.02;
  strip([.07,.17,.33],[.15,-.8,-.25],[1,0,.2],.26,.03,blue,toBody,t=>[sway*t,0,.02*Math.sin(elapsed*7+t*4)*t]);
  for(let f=0;f<5;f++)surface([[[.1+f*.012,-.04,.27],[.104+f*.012,-.04,.27]],[[.1+f*.012,-.08,.26],[.104+f*.012,-.08,.26]]],false,()=>cream,toBody);
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
 guld:'<path d="M14 38c-6 0-6-8 1-8-3-6 4-9 7-6 1-6 9-5 9 1 7-1 8 8 2 9z" fill="#e8b830"/><circle cx="21" cy="31" r="2" fill="#fff6c8"/>',
};
function lookView(){return ['Utseende','<div class="looks">'+lookList.map(l=>{
 const [a,b]=l.have(),open=a>=b,on=worn[l.slot]===l.id&&open;
 return '<div class="look'+(open?'':' locked')+(on?' on':'')+'"><svg viewBox="0 0 48 48">'+lookIcon[l.id]+'</svg><b>'+l.name+'</b>'+
  (open?'<button data-look="'+l.id+'">'+(on?'Ta av':'Ta på')+'</button>':'<small>🔒 '+l.need+'</small>'+(b>1?'<i><em style="width:'+Math.min(100,100*a/b)+'%"></em></i><small>'+number(Math.min(a,b))+' / '+number(b)+'</small>':''))+'</div>';
}).join('')+'</div><p class="cause">Sparas på den här enheten.</p>'];}
document.querySelector('.panel').addEventListener('click',e=>{const b=e.target.closest('button[data-look]');if(b){wear(b.dataset.look);openView('looks');}});
if(looksLive){const b=document.createElement('button');b.dataset.view='looks';b.textContent='Utseende';$('nav').append(b);}
// Progress is counted at the end of every flight, and when an event is completed.
function countFlight(){stats.total+=points;stats.maxStars=Math.max(stats.maxStars,wanted);saveStats();}
