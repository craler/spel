'use strict';
// Input, menus and the frame loop.
// ---- Start menu: the controls as a picture, and sub-pages for the high scores, feats, settings and rules.
let lowGraphics=false;try{lowGraphics=localStorage.getItem('fagelbajs.low')==='yes';}catch{}
const keycap=(key,does,wide)=>'<div class="key'+(wide?' wide':'')+'"><kbd>'+key+'</kbd><span>'+does+'</span></div>';
function controlsPicture(){
 if(touchMode)return '<div class="pads"><div><i class="pad"></i><span>Spaken styr</span></div><div><i class="round">DYK</i><span>Störtdyk</span></div><div><i class="round">BAJSA</i><span>Bajsa</span></div></div>';
 return '<div class="keyboard"><div><div class="row">'+keycap('W',reversePitch?'stig':'sjunk')+'</div><div class="row">'+keycap('A','vänster')+keycap('S',reversePitch?'sjunk':'stig')+keycap('D','höger')+'</div></div>'+
  '<div>'+keycap('Shift','störtdyk',1)+keycap('Space','bajsa',1)+'</div></div><p class="hint">Pilarna fungerar också · C byter vy · Esc pausar</p>';
}
function homeMenu(){panel('Duv-Diarré',controlsPicture()+(best?'<p class="best">Rekord '+number(best)+' · '+rankOf(best)+'</p>':''),'Nytt spel →');}
const setting=(label,value,id)=>'<div class="setting"><span>'+label+'</span><button data-set="'+id+'">'+value+'</button></div>';
const views={
 scores:()=>['Topplista',scores.length?scoreList():'<p class="cause">Inga flygningar än.</p>'],
 feats:()=>['Bedrifter',featList(true)],
 settings:()=>['Inställningar',setting('Invertera upp/ner',reversePitch?'↑ stiger':'↓ stiger','pitch')+setting('Ljud',muted?'Av':'På','sound')+setting('Kamera',viewNames[camView][0].toUpperCase()+viewNames[camView].slice(1),'camera')+setting('Grafik',lowGraphics?'Snabb':'Auto','graphics')],
 help:()=>['Så spelar du','<ul><li><b>Pricka folk och bilar.</b> 100 poäng på en minut startar jakten.</li><li><b>Lågt och i störtdyk ger dubbelt.</b> Högt upp ger hälften.</li><li><b>Guldstjärnor</b> är värda mest.</li><li><b>Bajset</b> fylls på när du slutar spruta.</li><li><b>Tre fjädrar = tre liv.</b> Frukt och hökar tar en, väggar och träd tar alla.</li><li><b>Nät</b> drar ner dig – håll upp nosen.</li></ul>'+controlsPicture()],
};
function openView(name){
 const [title,body]=views[name](),v=$('view');
 $('brief').hidden=true;v.hidden=false;v.dataset.name=name;
 v.innerHTML='<h2>'+title+'</h2>'+body+'<button class="back" data-view="back">← Tillbaka</button>';
}
function setAudio(){if(master)master.gain.setTargetAtTime(muted?0:.85,sound.currentTime,.035);$('audio').textContent=muted?'Ljud av':'Ljud på';}
document.querySelector('.panel').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view==='back'){$('view').hidden=true;$('brief').hidden=false;if(state==='menu')homeMenu();}
 else if(b.dataset.view)openView(b.dataset.view);
 else if(b.dataset.set){
  const what=b.dataset.set;
  if(what==='pitch'){reversePitch=!reversePitch;try{localStorage.setItem('fagelbajs.upClimbs',reversePitch?'yes':'no');}catch{}}
  if(what==='sound'){muted=!muted;setAudio();}
  if(what==='camera')view();
  if(what==='graphics'){lowGraphics=!lowGraphics;try{localStorage.setItem('fagelbajs.low',lowGraphics?'yes':'no');}catch{}density=lowGraphics?.7:Math.min(devicePixelRatio||1,1.5);fit();}
  openView('settings');
 }
});
$('go').onclick=start;$('pause').onclick=togglePause;$('camera').onclick=view;
$('audio').onclick=()=>{muted=!muted;setAudio();};
onblur=()=>{keys.clear();if(state==='play')togglePause();};
const gameKeys=['ShiftLeft','ShiftRight','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyS','KeyW','KeyC','Escape'];
onkeydown=e=>{
 if(state!=='play'){
  if(e.code==='Escape'&&state==='pause')togglePause();
  // Enter or Space flies again from the wasted screen, the menu and the pause, unless a name is being typed.
  else if((e.code==='Enter'||e.code==='Space'||e.code==='NumpadEnter')&&!e.repeat&&state!=='crash'&&performance.now()-shownAt>500&&!(e.target instanceof HTMLInputElement)&&!(e.target.closest&&e.target.closest('button:not(#go),a,summary'))){e.preventDefault();start();}
  return;
 }
 if(!gameKeys.includes(e.code))return;
 e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='Space')drop();if(e.code==='KeyC')view();if(e.code==='Escape')togglePause();
};
onkeyup=e=>keys.delete(e.code);
// ---- Touch: a thumb stick on the left, dive and spray buttons on the right.
const touchUI=$('touch'), stick=$('stick'), knob=$('knob');
let touchMode=matchMedia('(pointer:coarse)').matches;
function showTouch(){touchMode=true;touchUI.hidden=false;document.body.classList.add('touch');}
if(touchMode)showTouch();
addEventListener('touchstart',showTouch,{once:true,passive:true});
function steer(e){
 const r=stick.getBoundingClientRect(),dx=clamp((e.clientX-r.left-r.width/2)/(r.width/2),-1,1),dy=clamp((e.clientY-r.top-r.height/2)/(r.height/2),-1,1);
 knob.style.transform='translate('+dx*34+'px,'+dy*34+'px)';
 for(const [code,on] of [['KeyA',dx<-.3],['KeyD',dx>.3],['KeyW',dy<-.35],['KeyS',dy>.35]])on?keys.add(code):keys.delete(code);
}
function release(){knob.style.transform='';for(const code of ['KeyA','KeyD','KeyW','KeyS'])keys.delete(code);}
stick.onpointerdown=e=>{stick.setPointerCapture(e.pointerId);steer(e);};
stick.onpointermove=e=>{if(stick.hasPointerCapture(e.pointerId))steer(e);};
stick.onpointerup=stick.onpointercancel=release;
for(const [id,code] of [['t-fire','Space'],['t-dive','ShiftLeft']]){
 const b=$(id);
 b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(state!=='play')return;keys.add(code);b.classList.add('held');if(code==='Space')drop();};
 b.onpointerup=b.onpointercancel=()=>{keys.delete(code);b.classList.remove('held');};
}
// ---- First flights: one short tip at a time instead of a wall of text.
let flights=0;try{flights=+localStorage.getItem('fagelbajs.flights')||0;}catch{}
const tips=[
 [1,7,'A/D svänger · S/W ändrar höjden','Dra spaken för att styra'],
 [7,13,'Håll Space för att bajsa','Håll BAJSA'],
 [13,20,'Shift = störtdyk. Lågt och i dyk ger dubbelt','DYK = störtdyk. Lågt och i dyk ger dubbelt'],
 [20,27,'Guldstjärnor = extra poäng','Guldstjärnor = extra poäng']
];
function showTips(){
 const tip=state==='play'&&flights<=3?tips.find(t=>elapsed>=t[0]&&elapsed<t[1]):null,text=tip?tip[touchMode?3:2]:'';
 const el=$('tip');if(el.textContent!==text){el.textContent=text;el.classList.toggle('on',!!text);}
}
// The picture is rendered at up to 1.5 device pixels. If the machine cannot keep up, the resolution steps down.
let density=lowGraphics?.7:Math.min(devicePixelRatio||1,1.5),frameTime=1/60,lastTune=0;
function fit(){
 width=innerWidth;height=innerHeight;
 for(const c of [glCanvas,overlay]){c.width=Math.round(width*density);c.height=Math.round(height*density);}
 ctx.setTransform(density,0,0,density,0,0);
}
onresize=fit;fit();
reset();gather();traffic();let prev=0;
homeMenu();
function frame(now){
 const real=Math.min(.05,(now-prev)/1000),dt=real*(slowmo>0?.35:1);prev=now;slowmo=Math.max(0,slowmo-real);
 frameTime=mix(frameTime,real,.04);
 if(!navigator.webdriver&&now-lastTune>2500&&frameTime>1/38&&density>.75){density=Math.max(.75,density-.25);lastTune=now;fit();}
 if(state==='play'){for(let i=0;i<2&&state==='play';i++)simulate(dt/2);}
 else if(state==='crash')advanceCrash(dt);
 else if(state==='menu')wingPhase+=dt*3;
 render(dt);showTips();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
