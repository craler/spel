'use strict';
// Input, menus and the frame loop.
// ---- Start menu: the controls as a picture, and sub-pages for the high scores, feats, settings and rules.
// Switch fast graphics on or off while running: smaller and simpler shadows, fewer blocks drawn, cheaper shaders,
// lower resolution and fewer old stains. Edge smoothing follows on the next page load.
function topDensity(){return fast?Math.min(devicePixelRatio||1,1)*.85:Math.min(devicePixelRatio||1,1.5);}
function setFast(on){
 if(on===fast)return;fast=on;shadowSize(on?1024:2048);staticKey='';density=Math.min(density,topDensity());if(!on)density=topDensity();fit();
}
const qualityNames={auto:'Auto',high:'Snygg',fast:'Snabb'};
const keycap=(key,does,wide)=>'<div class="key'+(wide?' wide':'')+'"><kbd>'+key+'</kbd><span>'+does+'</span></div>';
function controlsPicture(){
 if(touchMode)return '<div class="pads"><div><i class="pad"></i><span>Spaken styr</span></div><div><i class="round">DYK</i><span>Störtdyk</span></div><div><i class="round">BAJSA</i><span>Bajsa</span></div></div>';
 return '<div class="keyboard"><div><div class="row">'+keycap('↑',reversePitch?'stig':'sjunk')+'</div><div class="row">'+keycap('←','vänster')+keycap('↓',reversePitch?'sjunk':'stig')+keycap('→','höger')+'</div></div>'+
  '<div>'+keycap('Shift','störtdyk',1)+keycap('Space','bajsa',1)+'</div><div>'+keycap('C','kamera')+keycap('X','upp/ner')+keycap('Q','broms')+'</div></div><p class="hint">WASD fungerar också · Esc pausar</p>';
}
// X swaps which of W and S climbs, in the air or in the menus, and remembers the choice.
function flipPitch(){
 reversePitch=!reversePitch;try{localStorage.setItem('fagelbajs.upClimbs',reversePitch?'yes':'no');}catch{}
 if(state==='play')banner(reversePitch?'W STIGER':'S STIGER',reversePitch?'S sjunker · X ändrar tillbaka':'W sjunker · X ändrar tillbaka','',1.6);
 else if(!$('view').hidden&&$('view').dataset.name)openView($('view').dataset.name);
 else if(state==='menu')homeMenu();
}
function homeMenu(){panel('Duv-Diarré',controlsPicture()+(best?'<p class="best">Rekord '+number(best)+' · '+rankOf(best)+'</p>':''),'Nytt spel →');}
const setting=(label,value,id)=>'<div class="setting"><span>'+label+'</span><button data-set="'+id+'">'+value+'</button></div>';
const views={
 scores:()=>{if(Date.now()-sharedAt>10000)fetchScores().then(()=>{if($('view').dataset.name==='scores'&&!$('view').hidden)openView('scores');});
  return ['Topplista',board().length?scoreList():'<p class="cause">Inga flygningar än.</p>'];},
 feats:()=>['Bedrifter',featList(true)],
 settings:()=>['Inställningar',setting('Invertera upp/ner',reversePitch?'↑ stiger':'↓ stiger','pitch')+setting('Ljud',muted?'Av':'På','sound')+setting('Kamera',viewNames[camView][0].toUpperCase()+viewNames[camView].slice(1),'camera')+setting('Grafik',qualityNames[quality]+(quality==='auto'?(fast?' (snabb just nu)':' (snygg just nu)'):''),'graphics')+(smoothEdges===fast?'<p class="cause">Kantutjämningen ändras när sidan laddas om.</p>':'')],
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
  if(what==='graphics'){quality={auto:'high',high:'fast',fast:'auto'}[quality];try{localStorage.setItem('fagelbajs.quality',quality);}catch{}setFast(quality==='fast'||(quality==='auto'&&autoFast));}
  openView('settings');
 }
});
$('go').onclick=start;$('pause').onclick=togglePause;$('camera').onclick=view;
$('audio').onclick=()=>{muted=!muted;setAudio();};
onblur=()=>{keys.clear();if(state==='play')togglePause();};
const gameKeys=['ShiftLeft','ShiftRight','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyS','KeyW','KeyC','KeyX','Escape','KeyQ'];
onkeydown=e=>{
 if(state!=='play'){
  if(e.code==='Escape'&&state==='pause')togglePause();
  else if(e.code==='KeyX'&&!e.repeat&&!(e.target instanceof HTMLInputElement))flipPitch();
  // Enter or Space flies again from the wasted screen, the menu and the pause, unless a name is being typed.
  else if((e.code==='Enter'||e.code==='Space'||e.code==='NumpadEnter')&&!e.repeat&&state!=='crash'&&performance.now()-shownAt>500&&!(e.target instanceof HTMLInputElement)&&!(e.target.closest&&e.target.closest('button:not(#go),a,summary'))){e.preventDefault();start();}
  return;
 }
 if(!gameKeys.includes(e.code))return;
 e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='Space')drop();if(e.code==='KeyC')view();if(e.code==='KeyX')flipPitch();if(e.code==='Escape')togglePause();
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
 knob.style.transform='translate('+dx*40+'px,'+dy*40+'px)';
 // Analog, with a dead zone and a soft curve: small thumb movements make small corrections,
 // and only a push all the way out gives the full turn.
 const curve=v=>Math.sign(v)*Math.pow(clamp((Math.abs(v)-.12)/.88,0,1),1.7);
 stickInput.x=curve(dx);stickInput.y=curve(dy);stickInput.on=true;
}
function release(){knob.style.transform='';stickInput.x=stickInput.y=0;stickInput.on=false;}
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
 [1,7,'←/→ svänger · ↑/↓ ändrar höjden','Dra spaken för att styra'],
 [7,13,'Håll Space för att bajsa','Håll BAJSA'],
 [13,20,'Shift = störtdyk. Lågt och i dyk ger dubbelt','DYK = störtdyk. Lågt och i dyk ger dubbelt'],
 [20,27,'Guldstjärnor = extra poäng','Guldstjärnor = extra poäng']
];
function showTips(){
 const tip=state==='play'&&flights<=3?tips.find(t=>elapsed>=t[0]&&elapsed<t[1]):null,text=tip?tip[touchMode?3:2]:'';
 const el=$('tip');if(el.textContent!==text){el.textContent=text;el.classList.toggle('on',!!text);}
}
// The picture is rendered at up to 1.5 device pixels. If the machine cannot keep up, the resolution steps down.
let density=topDensity(),frameTime=1/60,lastTune=0,judged=0;
let pausedDrawn=false,quickFor=0;
function fit(){
 pausedDrawn=false;width=innerWidth;height=innerHeight;
 for(const c of [glCanvas,overlay]){c.width=Math.round(width*density);c.height=Math.round(height*density);}
 ctx.setTransform(density,0,0,density,0,0);
}
onresize=fit;fit();
reset();gather();traffic();let prev=0;
homeMenu();
function frame(now){
 const real=Math.min(.05,(now-prev)/1000),dt=real*(slowmo>0?.35:1);prev=now;slowmo=Math.max(0,slowmo-real);
 // While paused the picture stands still, so it is drawn once and then left alone.
 if(state==='pause'&&pausedDrawn){requestAnimationFrame(frame);return;}
 if(state==='pause')pausedDrawn=true;
 // The resolution steps down when frames are slow and back up after a long run of quick ones.
 // Only flying counts: a menu or a hidden tab says nothing about how the game itself runs.
 if(state==='play'){
  frameTime=mix(frameTime,real,.04);quickFor=frameTime<1/52?quickFor+real:0;
  const top=topDensity();
  // Auto: watch the first seconds of flight. A computer that cannot keep up gets the fast graphics, now and on later visits.
  if(quality==='auto'&&!fast&&!navigator.webdriver){judged+=real;if(judged>4&&frameTime>1/40){autoFast=true;try{localStorage.setItem('fagelbajs.autoFast','yes');}catch{}setFast(true);feedLine('SNABB GRAFIK PÅ');}}
  if(!navigator.webdriver&&now-lastTune>2500&&frameTime>1/38&&density>.75){density=Math.max(.75,density-.25);lastTune=now;quickFor=0;fit();}
  else if(quickFor>8&&density<top){density=Math.min(top,density+.25);lastTune=now;quickFor=0;fit();}
 }
 if(state==='play'){halfStep=true;simulate(dt/2);halfStep=false;if(state==='play')simulate(dt/2);if(state==='play')record();} // people and traffic move once per frame, on the second step
 else if(state==='crash')advanceCrash(dt);
 else if(state==='menu')wingPhase+=dt*3;
 if(state==='end'&&killClip)renderReplay(real);else render(dt);showTips();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
