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
// The things it wears, built in the head's own frame (face) or the body's (plain).
function drawLook(face,plain){
 if(!looksLive)return;
 const ring=(cx,cy,cz,rx,rz,n=14)=>Array.from({length:n},(_,i)=>{const a=i/n*tau;return [cx+Math.cos(a)*rx,cy,cz+Math.sin(a)*rz];});
 const band=(f,lo,hi,col)=>{for(let i=0;i<lo.length;i++){const k=(i+1)%lo.length;f([lo[i],lo[k],hi[k],hi[i]],col);}};
 const head=wearing('head');
 if(head==='keps'){const lo=ring(0,.375,.32,.12,.125),mid=ring(0,.42,.32,.1,.105),hi=ring(0,.445,.31,.055,.06);band(face,lo,mid,'#d23b2f');band(face,mid,hi,'#d23b2f');face(hi,'#d23b2f');
  face([[-.11,.38,.4],[.11,.38,.4],[.1,.36,.6],[0,.355,.63],[-.1,.36,.6]],'#a82a24');face([[0,.445,.31],[.014,.452,.31],[0,.452,.326]],'#ffffff');}
 if(head==='hatt'){const brim=ring(0,.39,.33,.17,.17),b2=ring(0,.40,.33,.17,.17);band(face,brim,b2,'#16171a');face(b2,'#16171a');
  const lo=ring(0,.40,.33,.095,.095),mid=ring(0,.43,.33,.097,.097),hi=ring(0,.58,.33,.1,.1);band(face,lo,mid,'#a8252b');band(face,mid,hi,'#1d1e22');face(hi,'#1d1e22');}
 if(head==='krona'){const lo=ring(0,.39,.33,.1,.1,10),hi=ring(0,.46,.33,.105,.105,10);band(face,lo,hi,'#e8b830');
  for(let i=0;i<10;i+=2){const a=hi[i],b=hi[(i+1)%10],m=[(a[0]+b[0])/2,.53,(a[2]+b[2])/2];face([a,b,m],'#f2c84a');face([m,[m[0]*.9,.535,m[2]],[m[0]*1.1,.535,m[2]]],'#e8323a');}}
 if(head==='pannband'){ // a red band round the forehead, knotted at the back with two tails that stream in the wind
  const lo=ring(0,.335,.33,.128,.13,16),hi=ring(0,.37,.33,.122,.124,16);band(face,lo,hi,'#d01f26');
  const k=[0,.35,.2],wave=s=>.02*Math.sin(elapsed*14+s*3);face([[k[0]-.025,k[1]-.02,k[2]],[k[0]+.025,k[1]-.02,k[2]],[k[0]+.025,k[1]+.02,k[2]],[k[0]-.025,k[1]+.02,k[2]]],'#a8161c');
  for(const sx of [-1,1])face([[k[0]+sx*.01,k[1]+.012,k[2]],[k[0]+sx*.035,k[1]-.012,k[2]],[k[0]+sx*.07+wave(sx),k[1]-.06,k[2]-.22],[k[0]+sx*.05+wave(sx),k[1]-.03,k[2]-.24]],'#d01f26');}
 if(wearing('eyes')==='brillor'){for(const sx of [-1,1]){const pts=Array.from({length:10},(_,i)=>{const a=i/10*tau;return [sx*.135,.31+.04*Math.sin(a),.36+.05*Math.cos(a)];});face(pts,'#111318');}
  face([[-.135,.335,.41],[.135,.335,.41],[.135,.345,.41],[-.135,.345,.41]],'#111318');}
 if(wearing('neck')==='halsduk'){for(let k=0;k<2;k++){const y=.2+k*.035,lo=ring(0,y-.01,.21,.155,.16,16),hi=ring(0,y+.035,.22,.15,.155,16);for(let i=0;i<16;i++){const j=(i+1)%16;plain([lo[i],lo[j],hi[j],hi[i]],(i+k)%2?'#e8e4da':'#2f6fbf');}}
  plain([[-.04,.2,.09],[.04,.2,.09],[.06,0,-.05],[-.02,-.02,-.05]],'#2f6fbf');}
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
