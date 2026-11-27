'use strict';
// Input, menus and the frame loop.
// ---- Start menu: the controls as a picture, and sub-pages for the high scores, feats, settings and rules.
// Switch fast graphics on or off while running: smaller and simpler shadows, fewer blocks drawn, cheaper shaders,
// lower resolution and fewer old stains. Edge smoothing follows on the next page load.
function topDensity(){const d=devicePixelRatio||1;return fastest?Math.min(d,1)*.7:fast?Math.min(d,1)*.85:Math.min(d,1.5);}
function setLevel(n){
 if(n===gfx)return;gfx=n;fast=n>=1;fastest=n>=2;shadowSize(fastest?512:fast?1024:2048);density=topDensity();fit();
 lastTune=paceNow||performance.now();quickFor=0; // let the frame times settle at the new level before the resolution is judged
}
const qualityNames={auto:'Auto',high:'Snygg',fast:'Snabb',fastest:'Snabbast'};
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
 volumes:()=>['Ljudnivåer','<div class="vols">'+volKinds.map(([k,name])=>'<label><span>'+name+'</span><input type="range" min="0" max="2" step="0.05" value="'+vol[k]+'" data-vol="'+k+'"><b>'+Math.round(vol[k]*100)+'%</b></label>').join('')+
  '</div><p class="cause">Dra i reglaget så hörs ett exempel. Skicka raden nedan till Claude när det låter bra:</p><code id="volcode">'+volLine()+'</code><button class="back" data-volreset="1">Återställ till standard</button>'],
 scores:()=>{if(Date.now()-sharedAt>10000)fetchScores().then(()=>{if($('view').dataset.name==='scores'&&!$('view').hidden)openView('scores');});
  return ['Topplista',board().length?scoreList():'<p class="cause">Inga flygningar än.</p>'];},
 feats:()=>['Bedrifter',featList(true)],
 settings:()=>['Inställningar',setting('Invertera upp/ner',reversePitch?'↑ stiger':'↓ stiger','pitch')+setting('Ljud',muted?'Av':'På','sound')+(testSite?setting('Ljudnivåer','Ställ in →','volumes'):'')+setting('Kamera',viewNames[camView][0].toUpperCase()+viewNames[camView].slice(1),'camera')+setting('Grafik',qualityNames[quality]+(quality==='auto'?' (just nu '+['snygg','snabb','snabbast'][gfx]+')':''),'graphics')+(smoothEdges===fast?'<p class="cause">Kantutjämningen ändras när sidan laddas om.</p>':'')],
 help:()=>['Så spelar du','<ul><li><b>Pricka folk och bilar.</b> 100 poäng på en minut startar jakten.</li><li><b>Lågt och i störtdyk ger dubbelt.</b> Högt upp ger hälften.</li><li><b>Guldstjärnor</b> är värda mest.</li><li><b>Bajset</b> fylls på när du slutar spruta.</li><li><b>Tre fjädrar = tre liv.</b> Frukt och hökar tar en, väggar och träd tar alla.</li><li><b>Nät</b> drar ner dig – håll upp nosen.</li><li><b>Röd chili</b> över vissa tak: flyg in i den och få obegränsat bajs i tio sekunder.</li></ul>'+controlsPicture()],
};
function openView(name){
 if(name==='looks'){openWardrobe();return;} // the wardrobe is a screen of its own
 const [title,body]=views[name](),v=$('view');
 $('brief').hidden=true;v.hidden=false;v.dataset.name=name;
 v.innerHTML='<h2>'+title+'</h2>'+body+'<button class="back" data-view="back">← Tillbaka</button>';
}
function setAudio(){if(master)master.gain.setTargetAtTime(muted?0:.85*vol.master,sound.currentTime,.035);$('audio').textContent=muted?'Ljud av':'Ljud på';}
document.querySelector('.panel').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view==='back'){$('view').hidden=true;$('brief').hidden=false;if(state==='menu')homeMenu();}
 else if(b.dataset.view)openView(b.dataset.view);
 else if(b.dataset.set){
  const what=b.dataset.set;
  if(what==='volumes'){openView('volumes');return;}
  if(what==='pitch'){reversePitch=!reversePitch;try{localStorage.setItem('fagelbajs.upClimbs',reversePitch?'yes':'no');}catch{}}
  if(what==='sound'){muted=!muted;setAudio();}
  if(what==='camera')view();
  if(what==='graphics'){quality={auto:'high',high:'fast',fast:'fastest',fastest:'auto'}[quality];try{localStorage.setItem('fagelbajs.quality',quality);}catch{}setLevel(levelOf(quality));Object.assign(pace,{clock:0,calm:0,trial:null,capped:false,resTrial:null,resLocked:false});pace.triedUp.clear();}
  openView('settings');
 }
});
$('go').onclick=start;$('pause').onclick=togglePause;$('camera').onclick=view;
$('audio').onclick=()=>{muted=!muted;setAudio();};
onblur=()=>{keys.clear();if(state==='play')togglePause();};
const gameKeys=['ShiftLeft','ShiftRight','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyS','KeyW','KeyC','KeyX','Escape','KeyQ'];
onkeydown=e=>{
 if(state!=='play'){
  if(previewLooks()){if(e.code==='Escape')closeWardrobe();return;}
  if(e.code==='Escape'&&state==='pause')togglePause();
  else if(e.code==='KeyX'&&!e.repeat&&!(e.target instanceof HTMLInputElement))flipPitch();
  // Enter or Space flies again from the wasted screen, the menu and the pause, unless a name is being typed.
  else if((e.code==='Enter'||e.code==='Space'||e.code==='NumpadEnter')&&!e.repeat&&state!=='crash'&&performance.now()-shownAt>500&&!(e.target instanceof HTMLInputElement)&&!(e.target.closest&&e.target.closest('button:not(#go),a,summary'))){e.preventDefault();start();}
  return;
 }
 if(!gameKeys.includes(e.code))return;
 e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='Space')drop();if(e.code==='KeyC')view();if(e.code==='KeyB'&&testSite&&!e.repeat){povCheek=!povCheek;rig=null;feedLine('POV: '+(povCheek?'bredvid kinden':'original'));}
  if(e.code==='KeyV'&&testSite&&!e.repeat){camTry=(camTry+1)%camTries.length;feedLine('KAMERA '+(camTry+1)+': '+camTries[camTry][0]);}if(e.code==='KeyX')flipPitch();if(e.code==='Escape')togglePause();
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
let density=topDensity(),frameTime=1/60,lastTune=0;
let pausedDrawn=false,quickFor=0;
function fit(){
 pausedDrawn=false;textCache.clear();width=innerWidth;height=innerHeight;
 for(const c of [glCanvas,overlay]){c.width=Math.round(width*density);c.height=Math.round(height*density);}
 ctx.setTransform(density,0,0,density,0,0);
}
onresize=fit;fit();
reset();gather();traffic();let prev=0;
applyLook();homeMenu();
// ---- Keeping the pace. Two things can be traded for speed: the graphics level (when Grafik is on Auto) and the resolution.
// A change is only kept if it really made the frames come faster. On a screen that is held at 30 pictures a second
// (a phone in power-saving mode, say) nothing helps, and then the game should at least stay sharp and good-looking.
// Only flying counts: a menu or a hidden tab says nothing about how the game itself runs.
let paceNow=0; // the time of the frame being judged
const pace={clock:0,calm:0,trial:null,capped:null,resTrial:null,resLocked:false,triedUp:new Set()};
function setAuto(n){autoLevel=n;try{localStorage.setItem('fagelbajs.autoLevel',String(n));}catch{}setLevel(n);}
// A step up that proved too much is remembered for a week, so it is not tried again on every visit.
function cappedLately(){try{return Date.now()-(+localStorage.getItem('fagelbajs.paceCap')||0)<864e5;}catch{return false;}}
function ceilingAllows(n){try{const c=JSON.parse(localStorage.getItem('fagelbajs.autoCeil')||'null');return !(c&&n<=c.level&&Date.now()-c.at<6048e5);}catch{return true;}}
function keepPace(real,now){
 paceNow=now;frameTime=mix(frameTime,real,.04);quickFor=frameTime<1/52?quickFor+real:0;
 if(navigator.webdriver)return;
 if(pace.capped===null)pace.capped=quality==='auto'&&cappedLately();
 const slow=frameTime>1/40;pace.clock+=real;pace.calm=frameTime<1/55?pace.calm+real:0;
 if(quality==='auto'&&!pace.capped){
  if(pace.trial){ // four seconds after a change: keep it, or take it back
   if(pace.clock<4)return;
   const t=pace.trial;pace.trial=null;pace.clock=0;
   if(t.down&&frameTime>t.before*.87){pace.capped=true;setAuto(t.from);try{localStorage.setItem('fagelbajs.paceCap',String(Date.now()));}catch{}}        // no faster even on the lightest graphics: the screen sets the pace
   else if(!t.down&&slow){setAuto(t.from);try{localStorage.setItem('fagelbajs.autoCeil',JSON.stringify({level:t.to,at:Date.now()}));}catch{}} // the step up was too much
   return;
  }
  // Too slow: go straight to the lightest graphics. If that helps, the levels above are tried one at a time once things are calm.
  if(pace.clock>4&&slow&&gfx<2){pace.trial={down:true,before:frameTime,from:gfx};pace.clock=0;setAuto(2);return;}
  if(pace.calm>15&&gfx>0&&!pace.triedUp.has(gfx-1)&&ceilingAllows(gfx-1)){pace.triedUp.add(gfx-1);pace.trial={down:false,from:gfx,to:gfx-1};pace.clock=0;pace.calm=0;setAuto(gfx-1);return;}
  if(gfx<2)return; // the resolution is only touched once the graphics level cannot go any lower
 }
 if(pace.capped||pace.resLocked)return;
 const top=topDensity(),floor=fastest?.5:.75;
 if(pace.resTrial){ // the same test for a step down in resolution
  if(now-lastTune<2500)return;
  const t=pace.resTrial;pace.resTrial=null;lastTune=now;
  if(frameTime>t.before*.9){density=t.from;pace.resLocked=true;fit();}
  return;
 }
 if(now-lastTune>2500&&frameTime>1/38&&density>floor){pace.resTrial={before:frameTime,from:density};density=Math.max(floor,density-.25);lastTune=now;quickFor=0;fit();}
 else if(quickFor>8&&density<top){density=Math.min(top,density+.25);lastTune=now;quickFor=0;fit();}
}
function frame(now){
 const since=(now-prev)/1000,real=Math.min(.05,since),dt=real*(slowmo>0?.35:1);prev=now;slowmo=Math.max(0,slowmo-real);
 // While paused the picture stands still, so it is drawn once and then left alone.
 if(state==='pause'&&pausedDrawn&&!previewLooks()){requestAnimationFrame(frame);return;}
 if(state==='pause')pausedDrawn=true;
 if(state==='play')keepPace(Math.min(.25,since),now); // the true time between frames: the game itself never steps more than a twentieth of a second
 if(state==='play'){halfStep=true;simulate(dt/2);halfStep=false;if(state==='play')simulate(dt/2);if(state==='play')record();} // people and traffic move once per frame, on the second step
 else if(state==='crash')advanceCrash(dt);
 else if(state==='menu'||previewLooks())wingPhase+=dt*3;
 clothDt=state==='play'||state==='crash'?dt:real;
 if(looksLive&&state!=='pause'&&!previewLooks())updateCape(clothDt); // (in the wardrobe the bird on show has its own cloth, see drawWardrobe)
 if(state==='end'&&killClip&&!previewLooks())renderReplay(real);else render(dt);showTips();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- Ljudnivåer: one slider per kind of sound. Moving one plays an example of it.
function volLine(){return volKinds.map(([k])=>k+' '+Math.round(vol[k]*100)).join(' · ');}
const volSample={bajs:()=>play('poop1',.75),traff:()=>play('hitsplat1',.85),hitmarker:()=>play('hit1',.16),nedslag:()=>play('landsplat1',.35),hok:()=>play('hawk1',.8),
 kanon:()=>cannon(30),vingar:()=>wingBeat(),billarm:()=>tone(415,416,.4,'sawtooth',.05*vol.billarm),ovrigt:()=>crunch(),master:()=>play('hitsplat2',.8)};
let volPlayed=0,volQuiet=null;
function audition(k){
 try{sound ||= new AudioContext();sound.resume().catch(()=>{});setupAudio();}catch{}
 if(performance.now()-volPlayed<250)return;volPlayed=performance.now();
 if(volSample[k])volSample[k]();
 if(k==='stad'||k==='trafik'||k==='vind'){ // continuous sounds: a two second taste at this level
  const n=k==='stad'?(cityNodes||(sfx.city&&(cityNodes=play('city',0,1,true)))):null;
  if(n){setParam(n.gain.gain,.5*vol.stad,.1);clearTimeout(volQuiet);volQuiet=setTimeout(()=>setParam(n.gain.gain,0,.4),2000);}
  if(k==='vind'&&wind){setParam(wind.gain.gain,.1*vol.vind,.1);clearTimeout(volQuiet);volQuiet=setTimeout(()=>setParam(wind.gain.gain,0,.3),1500);}
  if(k==='trafik')tone(55,60,.8,'sawtooth',.06*vol.trafik);
 }
}
document.querySelector('.panel').addEventListener('input',e=>{
 const r=e.target.closest('input[data-vol]');if(!r)return;const k=r.dataset.vol;vol[k]=+r.value;saveVol();
 r.nextElementSibling.textContent=Math.round(vol[k]*100)+'%';$('volcode').textContent=volLine();
});
document.querySelector('.panel').addEventListener('change',e=>{const r=e.target.closest('input[data-vol]');if(r)audition(r.dataset.vol);});
document.querySelector('.panel').addEventListener('click',e=>{if(!e.target.closest('button[data-volreset]'))return;Object.assign(vol,volDefault);saveVol();openView('volumes');});
