'use strict';
// The Launchpad Mini MK3 and its on-screen mirror.
//
// Coordinates: the 8 × 8 grid is x 0..7 (left → right) and y 0..7 (top → bottom), like a screen.
// Extra buttons: top row 0..7 (▲ ▼ ◀ ▶ Session Drums Keys User), right column 0..7 (top → bottom), and the logo LED.
// In Programmer mode every LED has an index (the same number as its note/CC):
//   grid (x,y) = (8-y)*10 + x+1   (bottom-left is 11, top-right is 88)
//   right column i = (8-i)*10 + 9, top row i = 91+i, logo = 99.
//
// Games draw a whole frame every tick with px()/top()/side()/logo(). flush() sends only the LEDs that
// changed, as one RGB SysEx message, and updates the mirror on the page.

const BLACK=[0,0,0];
// LEDs look much brighter than the numbers say, so dim values are bent down a little. Trim if colours look washed out.
const GAMMA=1.6;

const gridIdx=(x,y)=>(8-y)*10+x+1;
const sideIdx=i=>(8-i)*10+9;
const topIdx=i=>91+i;
const LOGO=99;
const LED_LIST=[];
for(let y=0;y<8;y++)for(let x=0;x<8;x++)LED_LIST.push(gridIdx(x,y));
for(let i=0;i<8;i++){LED_LIST.push(sideIdx(i));LED_LIST.push(topIdx(i));}
LED_LIST.push(LOGO);

const LP={
 frame:new Float32Array(100*3),  // what the game draws this tick, 0..1 per channel
 sent:new Int16Array(100*3).fill(-1), // what the hardware is showing (-1 = unknown)
 shown:new Int16Array(100*3).fill(-1),// what the mirror is showing
 input:null, output:null, midi:null,
 onInput:()=>{}, onStatus:()=>{}, onConnect:()=>{},
 status:'idle'
};

// ---- Drawing
function clearFrame(){LP.frame.fill(0);}
function setLed(i,c,a=1){
 const f=LP.frame,o=i*3;
 if(a>=1){f[o]=c[0];f[o+1]=c[1];f[o+2]=c[2];return;}
 if(a<=0)return;
 f[o]+=(c[0]-f[o])*a;f[o+1]+=(c[1]-f[o+1])*a;f[o+2]+=(c[2]-f[o+2])*a;
}
function px(x,y,c,a=1){if(x>=0&&x<8&&y>=0&&y<8)setLed(gridIdx(x|0,y|0),c,a);}
function topLed(i,c,a=1){if(i>=0&&i<8)setLed(topIdx(i),c,a);}
function sideLed(i,c,a=1){if(i>=0&&i<8)setLed(sideIdx(i),c,a);}
function logoLed(c,a=1){setLed(LOGO,c,a);}
function fill(c,a=1){for(let y=0;y<8;y++)for(let x=0;x<8;x++)px(x,y,c,a);}

// ---- Colour helpers
const dim=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
const mix=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
function hue(h){ // h 0..1 → bright RGB
 const k=n=>(n+h*6)%6, f=n=>1-Math.max(0,Math.min(k(n),4-k(n),1));
 return [f(5),f(3),f(1)];
}

// ---- Sending
const SYSEX_HEAD=[0xF0,0x00,0x20,0x29,0x02,0x0D];
function sysex(body){if(!LP.output)return;try{LP.output.send([...SYSEX_HEAD,...body,0xF7]);}catch(e){console.warn('MIDI send',e);}}
const toLed=v=>Math.round(127*Math.pow(Math.max(0,Math.min(1,v)),GAMMA));

function flush(){
 const f=LP.frame;
 if(LP.output){
  const changes=[];
  for(const i of LED_LIST){
   const o=i*3,r=toLed(f[o]),g=toLed(f[o+1]),b=toLed(f[o+2]);
   if(LP.sent[o]!==r||LP.sent[o+1]!==g||LP.sent[o+2]!==b){
    LP.sent[o]=r;LP.sent[o+1]=g;LP.sent[o+2]=b;changes.push(3,i,r,g,b);
   }
  }
  // One message per 80 LEDs (the device takes up to 81 per message).
  for(let k=0;k<changes.length;k+=400)sysex([0x03,...changes.slice(k,k+400)]);
 }
 mirrorPaint();
}

// ---- MIDI
function setStatus(s,detail=''){LP.status=s;LP.onStatus(s,detail);}

async function connectMidi(){
 if(!navigator.requestMIDIAccess){setStatus('nomidi');return;}
 setStatus('asking');
 try{LP.midi=await navigator.requestMIDIAccess({sysex:true});}
 catch(e){console.warn(e);setStatus('denied');return;}
 LP.midi.onstatechange=()=>pickPorts();
 pickPorts();
}

// Mac: "Launchpad Mini MK3 LPMiniMK3 MIDI" (+ a "DAW" port). Windows/Chromebook: "LPMiniMK3 MIDI" / "MIDIIN2 (LPMiniMK3 MIDI)".
function bestPort(map){
 let best=null,score=-1;
 for(const p of map.values()){
  if(p.state==='disconnected')continue;
  const n=(p.name||'')+' '+(p.manufacturer||'');
  if(!/lpminimk3|launchpad mini/i.test(n))continue;
  const s=(/daw|midiin2|midiout2/i.test(n)?0:2)+(/midi/i.test(p.name)?1:0);
  if(s>score){score=s;best=p;}
 }
 return best;
}

function pickPorts(){
 const out=bestPort(LP.midi.outputs),inp=bestPort(LP.midi.inputs);
 const changed=out!==LP.output||inp!==LP.input;
 if(LP.input&&LP.input!==inp)LP.input.onmidimessage=null;
 LP.output=out;LP.input=inp;
 if(!out||!inp){setStatus('waiting');return;}
 if(!changed)return;
 inp.onmidimessage=onMidi;
 sysex([0x0E,0x01]); // Programmer mode: every pad is ours
 LP.sent.fill(-1);   // repaint everything
 setStatus('connected',out.name);
 LP.onConnect();
}

function onMidi(e){
 const [st,d1,d2]=e.data,type=st&0xF0;
 if(type===0x90||type===0x80){
  const x=d1%10-1,y=8-Math.floor(d1/10),down=type===0x90&&d2>0;
  if(x>=0&&x<8&&y>=0&&y<8)LP.onInput({kind:'pad',x,y,down});
 }else if(type===0xB0){
  const down=d2>0;
  if(d1>=91&&d1<=98)LP.onInput({kind:'top',i:d1-91,down});
  else if(d1%10===9&&d1>=19&&d1<=89)LP.onInput({kind:'side',i:8-Math.floor(d1/10),down});
 }
}

// Leave the Launchpad dark and back in its normal mode when the page closes.
function releasePad(){
 if(!LP.output)return;
 const all=[];for(const i of LED_LIST)all.push(3,i,0,0,0);
 sysex([0x03,...all.slice(0,400)]);sysex([0x03,...all.slice(400)]);
 sysex([0x0E,0x00]);
}
addEventListener('pagehide',releasePad);

// ---- The mirror on the page (9 × 9: top row + logo, then 8 rows of grid + right column). Clickable.
const mirrorCells=new Map();
function buildMirror(root){
 const add=(cls,idx,ev,label)=>{
  const b=document.createElement('button');
  b.className='led '+cls;b.type='button';b.tabIndex=-1;if(label)b.setAttribute('aria-label',label);
  if(ev){
   let held=false;
   const down=e=>{e.preventDefault();if(held)return;held=true;b.classList.add('held');LP.onInput({...ev,down:true});};
   const up=()=>{if(!held)return;held=false;b.classList.remove('held');LP.onInput({...ev,down:false});};
   b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up);
  }else b.disabled=true;
  root.append(b);mirrorCells.set(idx,b);
 };
 const arrows=['▲','▼','◀','▶','S','D','K','U'];
 for(let i=0;i<8;i++)add('round',topIdx(i),{kind:'top',i},arrows[i]);
 add('logo',LOGO,null);
 for(let y=0;y<8;y++){
  for(let x=0;x<8;x++)add('pad',gridIdx(x,y),{kind:'pad',x,y});
  add('round',sideIdx(y),{kind:'side',i:y},'►');
 }
}
function mirrorPaint(){
 const f=LP.frame;
 for(const [i,el] of mirrorCells){
  const o=i*3,r=Math.round(f[o]*255),g=Math.round(f[o+1]*255),b=Math.round(f[o+2]*255);
  if(LP.shown[o]===r&&LP.shown[o+1]===g&&LP.shown[o+2]===b)continue;
  LP.shown[o]=r;LP.shown[o+1]=g;LP.shown[o+2]=b;
  const lit=r+g+b>20;
  el.style.setProperty('--c',lit?`rgb(${r},${g},${b})`:'');
  el.classList.toggle('lit',lit);
 }
}
