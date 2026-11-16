'use strict';
// Input, menus and the frame loop.
function syncPitch(){
 const short=reversePitch?'↑ stiger':'↓ stiger';
 $('pitch-guide').textContent=reversePitch?'↑/W stig · ↓/S sjunk':'↓/S stig · ↑/W sjunk';
 for(const id of ['invert','invert-menu']){
  const button=$(id);
  button.textContent='Byt höjdroder · '+short;
  button.setAttribute('aria-pressed',String(reversePitch));
  button.onclick=()=>{
   reversePitch=!reversePitch;syncPitch();
   try{localStorage.setItem('fagelbajs.upClimbs',reversePitch?'yes':'no');}catch{}
   if(state==='play')button.blur();
  };
 }
}
syncPitch();
$('go').onclick=start;$('pause').onclick=togglePause;$('camera').onclick=view;
$('audio').onclick=()=>{muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:.85,sound.currentTime,.035);$('audio').textContent=muted?'Ljud av':'Ljud på';};
onblur=()=>{keys.clear();if(state==='play')togglePause();};
const gameKeys=['ShiftLeft','ShiftRight','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyS','KeyW','KeyC','Escape'];
onkeydown=e=>{
 if(state!=='play'){if(e.code==='Escape'&&state==='pause')togglePause();return;}
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
 [1,7,'A/D eller ←/→ svänger · S och W ändrar höjden','Dra spaken åt sidan för att svänga, upp och ner för höjden'],
 [7,13,'Håll Space för att bajsa – ringen visar var det landar','Håll BAJSA – ringen visar var det landar'],
 [13,20,'Shift = störtdyk. Träffar i dyk och lågflyg ger dubbla poäng','Håll DYK för störtdyk. Träffar i dyk och lågflyg ger dubbla poäng'],
 [20,28,'Tanken tar slut! Sno mat vid de gula pilarna på torg och i parker','Tanken tar slut! Sno mat vid de gula pilarna på torg och i parker']
];
function showTips(){
 const tip=state==='play'&&flights<=3?tips.find(t=>elapsed>=t[0]&&elapsed<t[1]):null,text=tip?tip[touchMode?3:2]:'';
 const el=$('tip');if(el.textContent!==text){el.textContent=text;el.classList.toggle('on',!!text);}
}
function fit(){
 width=innerWidth;height=innerHeight;const density=Math.min(devicePixelRatio||1,1.5);
 for(const c of [glCanvas,overlay]){c.width=Math.round(width*density);c.height=Math.round(height*density);}
 ctx.setTransform(density,0,0,density,0,0);
}
onresize=fit;fit();
reset();gather();traffic();let prev=0;
function frame(now){
 const dt=Math.min(.05,(now-prev)/1000);prev=now;
 if(state==='play'){for(let i=0;i<2&&state==='play';i++)simulate(dt/2);}
 else if(state==='crash')advanceCrash(dt);
 else if(state==='menu')wingPhase+=dt*3;
 render(dt);showTips();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
