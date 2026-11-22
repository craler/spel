'use strict';
// Sound, all synthesised. Browsers only allow sound after a click or key press on the page
// (pressing the Launchpad doesn't count), so main.js shows a hint until audioReady() is true.

let ctx=null,master=null,noiseBuf=null,muted=false;
try{muted=localStorage.getItem('legends.muted')==='1';}catch{}

// Everything goes through `master` and then a limiter, so many sounds at once (a firework finale, a full
// drum machine) get squeezed instead of crackling.
function masterChain(c){
 const g=c.createGain(),lim=c.createDynamicsCompressor();
 g.gain.value=muted?0:.8;
 lim.threshold.value=-3;lim.knee.value=2;lim.ratio.value=20;lim.attack.value=.002;lim.release.value=.15;
 g.connect(lim);lim.connect(c.destination);
 return g;
}
function audioInit(){
 if(!ctx){
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ctx=new AC();master=masterChain(ctx);
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
 s.buffer=noiseBuf;s.loop=true;f.type=type;f.frequency.value=freq;
 g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+.02);
 return g;
}
// ---- The rock band for Takt: drums, bass, a distorted rhythm guitar and a lead guitar with echo.
const drum={
 kick:(at,g=.55)=>{tone(160,42,.3,'sine',g,at);tone(900,200,.02,'square',.05,at);},
 snare:(at,g=.24)=>{noise(.18,1400,g,at);tone(230,150,.09,'triangle',.14,at);},
 hat:(at,g=.06)=>noise(.035,8000,g,at),
 open:at=>noise(.22,6500,.05,at),
 crash:at=>noise(1.6,4500,.11,at),
 stick:at=>tone(2400,2400,.03,'square',.05,at),
 tom:(f,at)=>tone(f,f*.6,.22,'sine',.35,at),
 // For Trummaskin
 clap:at=>{for(let i=0;i<3;i++)noise(.012,1200,.22,(at||audioNow())+i*.011,'bandpass');noise(.16,1200,.15,(at||audioNow())+.033,'bandpass');},
 cowbell:at=>{tone(560,560,.14,'square',.045,at);tone(845,845,.14,'square',.035,at);}
};
let leadIn=null,rhythmIn=null;
// Input → overdrive → speaker-like lowpass → level. Returns the input node.
function overdrive(drive,cutoff,level){
 const sh=ctx.createWaveShaper(),c=new Float32Array(2048);
 for(let i=0;i<2048;i++){const x=i/1023.5-1;c[i]=Math.tanh(x*drive)/Math.tanh(drive);}
 sh.curve=c;sh.oversample='2x';
 const cab=ctx.createBiquadFilter();cab.type='lowpass';cab.frequency.value=cutoff;cab.Q.value=.8;
 const out=ctx.createGain();out.gain.value=level;
 sh.connect(cab);cab.connect(out);out.connect(master);
 return {input:sh,out};
}
function bandInit(){
 if(rhythmIn||!ctx)return;
 rhythmIn=overdrive(7,2600,.2).input;
 const lead=overdrive(10,3800,.22);leadIn=lead.input;
 // Echo on the lead: a quarter-ish delay that fades out
 const d=ctx.createDelay(1),fb=ctx.createGain(),lp=ctx.createBiquadFilter(),wet=ctx.createGain();
 d.delayTime.value=.27;fb.gain.value=.32;lp.type='lowpass';lp.frequency.value=2200;wet.gain.value=.35;
 lead.out.connect(d);d.connect(lp);lp.connect(fb);fb.connect(d);lp.connect(wet);wet.connect(master);
}
// Power chord (root, fifth, octave). Palm-muted = short and dark.
function chug(root,at,dur,muted){
 if(!audioReady())return;bandInit();
 const t=Math.max(at,ctx.currentTime),g=ctx.createGain(),lp=ctx.createBiquadFilter();
 lp.type='lowpass';lp.frequency.value=muted?650:3200;
 const peak=muted?.22:.3;
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.006);
 if(dur>.2)g.gain.exponentialRampToValueAtTime(peak*.45,t+.15);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 for(const [m,det] of [[1,-5],[1.5,4],[2,0]]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=root*m;o.detune.value=det;o.connect(lp);o.start(t);o.stop(t+dur+.03);}
 lp.connect(g);g.connect(rhythmIn);
}
function bassNote(f,at,dur){
 if(!audioReady())return;
 const t=Math.max(at,ctx.currentTime),g=ctx.createGain(),lp=ctx.createBiquadFilter();
 lp.type='lowpass';lp.frequency.value=420;
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.26,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 for(const [type,m] of [['sawtooth',1],['sine',.5]]){const o=ctx.createOscillator();o.type=type;o.frequency.value=f*m;o.connect(lp);o.start(t);o.stop(t+dur+.03);}
 lp.connect(g);g.connect(master);
}
// The lead guitar note you play when you hit a note: a small slide up into the note, then vibrato.
function lead(f,dur=.4,at=0,gain=.32){
 if(!audioReady())return;bandInit();
 const t=Math.max(at,ctx.currentTime),g=ctx.createGain(),vib=ctx.createOscillator(),vd=ctx.createGain();
 vib.frequency.value=5.8;vd.gain.setValueAtTime(0,t);vd.gain.linearRampToValueAtTime(f*.012,t+dur*.6);vib.connect(vd);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.01);g.gain.exponentialRampToValueAtTime(gain*.56,t+.12);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 for(const [type,m] of [['sawtooth',1],['square',2.003]]){
  const o=ctx.createOscillator();o.type=type;
  o.frequency.setValueAtTime(f*m*.944,t);o.frequency.exponentialRampToValueAtTime(f*m,t+.045);
  vd.connect(o.frequency);o.connect(g);o.start(t);o.stop(t+dur+.03);
 }
 vib.start(t);vib.stop(t+dur+.03);
 g.connect(leadIn);
}
// A synth pluck with an echo, for the melody in Trummaskin and the cells in Livet.
let keysIn=null,keysEcho=null;
function keysInit(){
 if(keysIn||!ctx)return;
 keysIn=ctx.createGain();keysIn.connect(master);
 const d=ctx.createDelay(1),fb=ctx.createGain(),lp=ctx.createBiquadFilter(),wet=ctx.createGain();
 d.delayTime.value=.3;fb.gain.value=.3;lp.type='lowpass';lp.frequency.value=2400;wet.gain.value=.28;
 keysIn.connect(d);d.connect(lp);lp.connect(fb);fb.connect(d);lp.connect(wet);wet.connect(master);keysEcho=d;
}
function setEcho(sec){if(keysEcho)keysEcho.delayTime.setTargetAtTime(Math.min(.9,sec),ctx.currentTime,.05);}
function pluck(f,at=0,dur=.35,gain=.09){
 if(!audioReady())return;keysInit();
 const t=Math.max(at,ctx.currentTime),g=ctx.createGain(),lp=ctx.createBiquadFilter();
 lp.type='lowpass';lp.Q.value=3;lp.frequency.setValueAtTime(Math.min(12000,f*9),t);lp.frequency.exponentialRampToValueAtTime(f*1.4,t+dur);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 for(const det of [-8,8]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=det;o.connect(lp);o.start(t);o.stop(t+dur+.03);}
 lp.connect(g);g.connect(keysIn);
}
// Fireworks: the whistle going up, the bang (with a softer echo off the houses) and the crackle.
const boom={
 launch:()=>{tone(420,1500+Math.random()*500,.5,'sine',.025);noise(.4,3500,.02);},
 bang:(big=1)=>{
  const t=audioNow();boom.recent=(boom.recent||[]).filter(x=>t-x<.25);boom.recent.push(t);
  big/=Math.sqrt(boom.recent.length); // several bangs at once: each one a bit softer
  noise(.9,700,.3*big,t,'lowpass');tone(110,32,.55,'sine',.38*big,t);noise(.7,350,.1*big,t+.13,'lowpass');
 },
 crackle:(delay=0,n=12)=>{const t=audioNow()+delay;for(let i=0;i<n;i++)noise(.014,3500+Math.random()*3000,.05,t+Math.random()*.7);},
 fizz:()=>noise(1.6,5000,.045)
};

// A lead guitar note that rings for as long as you hold the pad (Takt's long notes). Returns stop().
function leadHold(f){
 if(!audioReady())return ()=>{};bandInit();
 const t=ctx.currentTime,g=ctx.createGain(),vib=ctx.createOscillator(),vd=ctx.createGain(),oscs=[];
 vib.frequency.value=5.5;vd.gain.setValueAtTime(0,t);vd.gain.linearRampToValueAtTime(f*.015,t+.5);vib.connect(vd);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.32,t+.01);g.gain.exponentialRampToValueAtTime(.2,t+.15);g.gain.setTargetAtTime(.14,t+.15,.8);
 for(const [type,m] of [['sawtooth',1],['square',2.003]]){
  const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f*m*.944,t);o.frequency.exponentialRampToValueAtTime(f*m,t+.045);
  vd.connect(o.frequency);o.connect(g);o.start(t);oscs.push(o);
 }
 vib.start(t);oscs.push(vib);g.connect(leadIn);
 let done=false;
 return ()=>{if(done)return;done=true;const e=ctx.currentTime;g.gain.cancelScheduledValues(e);g.gain.setTargetAtTime(.0001,e,.04);for(const o of oscs)o.stop(e+.3);};
}

// ---- Trumset: two drum kits to play live (0 = rock, 1 = electro / 808-style). KIT[name](kit) plays now.
// Metal sounds (hi-hats, cymbals, cowbell) are six square waves at odd frequencies through a high filter.
function metal(dur,gain,hp=7000,mult=1){
 if(!audioReady())return null;
 const t=ctx.currentTime,g=ctx.createGain(),bp=ctx.createBiquadFilter(),hf=ctx.createBiquadFilter();
 bp.type='bandpass';bp.frequency.value=10000;bp.Q.value=.6;hf.type='highpass';hf.frequency.value=hp;
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 for(const f of [205.3,304.4,369.6,522.7,540,800]){const o=ctx.createOscillator();o.type='square';o.frequency.value=f*mult;o.connect(bp);o.start(t);o.stop(t+dur+.05);}
 bp.connect(hf);hf.connect(g);g.connect(master);return g;
}
let openHat=null; // the ringing open hi-hat, cut short by the closed one (like a real foot pedal)
function chokeHat(){if(openHat&&ctx){openHat.gain.cancelScheduledValues(ctx.currentTime);openHat.gain.setTargetAtTime(.0001,ctx.currentTime,.01);}openHat=null;}
const KIT={
 kick:k=>{if(k){tone(75,44,.9,'sine',.7);tone(1200,300,.012,'square',.04);}else{tone(150,48,.35,'sine',.62);noise(.012,2500,.12);}},
 snare:k=>{if(k){noise(.16,2600,.24);tone(250,180,.08,'triangle',.14);}else{noise(.22,1300,.3);tone(210,160,.12,'triangle',.2);}},
 rim:k=>{tone(1750,1750,.03,'square',.05);tone(480,470,.05,'triangle',.12);noise(.02,5000,.05);},
 clap:k=>{drum.clap();if(k)noise(.4,1200,.045,audioNow()+.04,'bandpass');},
 hat:k=>{chokeHat();if(k)metal(.06,.1);else noise(.045,8500,.1);},
 open:k=>{chokeHat();openHat=k?metal(.5,.08):noise(.5,7000,.07);},
 shaker:k=>noise(.09,5500,.07,0,'bandpass'),
 tamb:k=>{noise(.2,9000,.06);metal(.18,.03,9000,1.7);},
 tom1:k=>k?tone(330,190,.32,'sine',.5):(tone(270,200,.3,'sine',.45),noise(.04,900,.05,0,'lowpass')),
 tom2:k=>k?tone(250,140,.36,'sine',.5):(tone(205,150,.34,'sine',.45),noise(.04,800,.05,0,'lowpass')),
 tom3:k=>k?tone(185,100,.42,'sine',.52):(tone(155,110,.38,'sine',.48),noise(.05,700,.05,0,'lowpass')),
 tom4:k=>k?tone(130,70,.5,'sine',.55):(tone(112,80,.45,'sine',.5),noise(.05,600,.06,0,'lowpass')),
 crash:k=>{noise(k?1.2:1.8,k?7000:5000,.13);metal(k?1:1.5,.035,6000,1.3);},
 ride:k=>{metal(1.3,.045,4500,1.9);tone(3100,3100,.7,'sine',.018);},
 cowbell:k=>drum.cowbell(),
 bongo:k=>{tone(520,430,.13,'sine',.38);noise(.012,2500,.05);},
 // Extras on the right column
 triangle:k=>{tone(2400,2400,1.6,'sine',.06);tone(7200,7200,.8,'sine',.015);},
 claves:k=>tone(2500,2500,.06,'sine',.2),
 splash:k=>{noise(.6,6500,.1);metal(.5,.03,7000,1.6);},
 laser:k=>tone(2400,90,.35,'sawtooth',.07),
 boom:k=>{tone(55,30,1.6,'sine',.6);noise(.3,200,.15,0,'lowpass');},
 scratch:k=>{tone(300,1100,.08,'sawtooth',.06);noise(.08,1800,.08,0,'bandpass');tone(900,250,.1,'sawtooth',.05,audioNow()+.09);noise(.1,1500,.07,audioNow()+.09,'bandpass');},
 whistle:k=>{tone(2100,2100,.12,'sine',.08);tone(2100,2100,.3,'sine',.08,audioNow()+.16);},
 applause:k=>{const t=audioNow();for(let i=0;i<24;i++)noise(.03,1000+Math.random()*1500,.06,t+Math.random()*1.4,'bandpass');}
};

// ---- Under water (Sjunkbomb): sonar ping with an echo, splash, depth charge boom, bubbles.
const sea={
 sonar:()=>{tone(1350,1350,.7,'sine',.07);tone(1350,1350,.6,'sine',.025,audioNow()+.55);},
 splash:()=>{noise(.18,1800,.09,0,'bandpass');tone(520,230,.14,'sine',.06);},
 boom:(big=1)=>{tone(95,28,.6,'sine',.5*big);noise(.7,350,.25*big,0,'lowpass');},
 bubbles:()=>{const t=audioNow();for(let i=0;i<6;i++){const f=350+Math.random()*500;tone(f,f*1.8,.06,'sine',.04,t+Math.random()*.5);}},
 mine:()=>tone(320,640,.09,'triangle',.04)
};

// The muted string scrape when you miss
function clunk(){tone(98,70,.09,'sawtooth',.09);noise(.06,900,.06,0,'bandpass');}
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
