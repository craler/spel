'use strict';
// Sound, all synthesised. Browsers only allow sound after a click or key press on the page
// (pressing the Launchpad doesn't count), so main.js shows a hint until audioReady() is true.

let ctx=null,master=null,noiseBuf=null,muted=false;
try{muted=localStorage.getItem('legends.muted')==='1';}catch{}

function audioInit(){
 if(!ctx){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ctx=new AC();master=ctx.createGain();master.gain.value=muted?0:.8;master.connect(ctx.destination);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 }
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});
}
const audioReady=()=>!!ctx&&ctx.state==='running';
function setMuted(m){muted=m;try{localStorage.setItem('legends.muted',m?'1':'0');}catch{}if(master)master.gain.setTargetAtTime(m?0:.8,ctx.currentTime,.02);}
const audioNow=()=>ctx?ctx.currentTime:0;

// A note: frequency glide from→to over dur seconds, at time `at` (audio clock, default now).
function tone(from,to,dur,type='square',gain=.12,at=0){
 if(!audioReady())return;
 const t=Math.max(at,ctx.currentTime),o=ctx.createOscillator(),g=ctx.createGain();
 o.type=type;o.frequency.setValueAtTime(from,t);if(to!==from)o.frequency.exponentialRampToValueAtTime(to,t+dur);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);
}
function noise(dur,freq,gain=.15,at=0,type='highpass'){
 if(!audioReady())return;
 const t=Math.max(at,ctx.currentTime),s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
 s.buffer=noiseBuf;f.type=type;f.frequency.value=freq;
 g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+.02);
}
// Drum kit for the rhythm game.
const drum={
 kick:at=>tone(150,40,.28,'sine',.5,at),
 snare:at=>{noise(.16,1500,.22,at);tone(220,140,.08,'triangle',.12,at);},
 hat:at=>noise(.04,7000,.07,at),
 bass:(f,at)=>tone(f,f,.22,'sawtooth',.07,at)
};
// Pentatonic scale for melodic feedback: note n steps up from A3.
const PENTA=[0,2,4,7,9];
const scaleHz=n=>220*Math.pow(2,(PENTA[((n%5)+5)%5]+12*Math.floor(n/5))/12);

const sfx={
 menu:()=>tone(660,880,.08,'square',.07),
 start:()=>{tone(440,440,.08,'square',.08);tone(660,660,.08,'square',.08,audioNow()+.09);tone(880,880,.14,'square',.08,audioNow()+.18);},
 hit:(n=0)=>tone(scaleHz(n+5),scaleHz(n+5),.12,'square',.09),
 gold:()=>{for(let i=0;i<4;i++)tone(scaleHz(8+i*2),scaleHz(8+i*2),.1,'square',.08,audioNow()+i*.05);},
 bad:()=>tone(220,90,.3,'sawtooth',.12),
 tick:()=>tone(1200,1200,.03,'square',.04),
 win:()=>{[0,2,4,7].forEach((n,i)=>tone(scaleHz(n+5),scaleHz(n+5),.18,'square',.08,audioNow()+i*.1));},
 over:()=>{[4,2,0].forEach((n,i)=>tone(scaleHz(n+3),scaleHz(n+3),.2,'triangle',.12,audioNow()+i*.14));},
 pong:n=>tone(300+n*40,300+n*40,.06,'square',.09),
 wall:()=>tone(180,180,.04,'square',.05)
};
