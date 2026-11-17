'use strict';
// Sound. Everything is synthesised with WebAudio except a small sample bank
// (crash tail and eight wing strokes) in audio/samples.mp3.
const sampleCuts=[[0.0, 5.4], [5.45, 0.19], [5.69, 0.19], [5.93, 0.19], [6.17, 0.19], [6.41, 0.19], [6.65, 0.19], [6.89, 0.19], [7.13, 0.19]];
let bank=null,bankLoading=false,lastWing=0,wind=null,master=null,crashVoice=null;
let noiseBuf=null,sprayNodes=null,droneNodes=null,humNodes=null,lastSplat=0,lastYelp=0,nextHorn=6;
const sfx={};let sfxAsked=false,pooping=null,cityNodes=null,lastLand=0;
function play(name,volume=1,rate=1,loop=false){
 if(!sfx[name]||!master||muted)return null;
 const src=sound.createBufferSource(),gain=sound.createGain();
 src.buffer=sfx[name];src.playbackRate.value=rate;src.loop=loop;gain.gain.value=volume;src.connect(gain);gain.connect(master);src.start();
 return {src,gain};
}
function tone(from,to,duration,type='sine',gain=.08,delay=0){
 if(!sound||muted)return;
 const t=sound.currentTime+delay, osc=sound.createOscillator(), vol=sound.createGain();
 osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);
 vol.gain.setValueAtTime(.001,t);vol.gain.exponentialRampToValueAtTime(gain,t+Math.min(.012,duration*.4));vol.gain.exponentialRampToValueAtTime(.001,t+duration);
 osc.connect(vol);vol.connect(sound.destination);osc.start(t);osc.stop(t+duration);
}
function setupAudio(){
 if(!sound)return;
 if(!master){
  master=sound.createGain();master.gain.value=muted?0:.85;master.connect(sound.destination);
  noiseBuf=sound.createBuffer(1,sound.sampleRate*2,sound.sampleRate);const data=noiseBuf.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=sound.createBufferSource(),filter=sound.createBiquadFilter(),gain=sound.createGain();
  source.buffer=noiseBuf;source.loop=true;filter.type='bandpass';filter.Q.value=.7;gain.gain.value=0;
  source.connect(filter);filter.connect(gain);gain.connect(master);source.start();wind={gain,filter};
 }
 // Recorded effects: poop, splats, the hawk and the city. Until they have loaded (or if they fail to), the synthesised versions are used.
 if(!sfxAsked){sfxAsked=true;for(const name of ['poop1','poop2','poop3','poop4','poop5','poop6','poop7','splat1','splat2','splat3','hawk1','hawk2','city'])
  fetch('./audio/'+name+'.mp3').then(r=>r.arrayBuffer()).then(b=>sound.decodeAudioData(b)).then(b=>{sfx[name]=b;}).catch(()=>{});}
 if(!bank&&!bankLoading){
  bankLoading=true;
  fetch('./audio/samples.mp3').then(r=>r.arrayBuffer()).then(b=>sound.decodeAudioData(b)).then(b=>{bank=b;}).catch(()=>{}).finally(()=>{bankLoading=false;});
 }
}
function voice(index,volume,rate=1){
 if(!bank||muted)return null;
 const source=sound.createBufferSource(),gain=sound.createGain(),[offset,duration]=sampleCuts[index];
 source.buffer=bank;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(master);
 source.start(0,offset,duration);return source;
}
function wingBeat(){
 if(!bank)return;
 const next=lastWing?1+((lastWing-1+1+Math.floor(Math.random()*7))%8):1+Math.floor(Math.random()*8);
 lastWing=next;voice(next,.43,.94+.12*Math.random());
}
function windLevel(){
 if(!wind)return;
 const rush=clamp((Math.hypot(bird.vy,forwardSpeed())-8)/45,.12,1);
 const v=state==='play'?Math.max(bird.fold*rush,bird.steep*(.17+.42*rush)):0;
 wind.gain.gain.setTargetAtTime(v*.145,sound.currentTime,.1);
 wind.filter.frequency.setTargetAtTime(280+v*1900,sound.currentTime,.13);
}
// A short burst of filtered noise whose filter sweeps from one frequency to another:
// the building block for splats, ticks, crunches and whooshes.
function burst({type='lowpass',from=2000,to=from,q=1,gain=.2,attack=.004,dur=.12,delay=0}){
 if(!master||muted)return;
 const t=sound.currentTime+delay,src=sound.createBufferSource(),f=sound.createBiquadFilter(),g=sound.createGain();
 src.buffer=noiseBuf;f.type=type;f.Q.value=q;
 f.frequency.setValueAtTime(from,t);f.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+dur);
 g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 src.connect(f);f.connect(g);g.connect(master);src.start(t,Math.random()*1.5,dur+.05);
}
// The spray itself: a raspberry (an unsteady low pulse) under a wet hiss, running for as long as it flows.
function sprayVoice(on){
 if(!master)return;
 if(sfx.poop1){ // recorded: one long squirt after another for as long as it flows, cut off quickly when it stops
  if(on&&(!pooping||pooping.done)){
   const name=!pooping?'poop'+(1+Math.floor(Math.random()*5)):'poop'+(1+Math.floor(Math.random()*4));
   pooping=play(name,.75,.94+.14*Math.random());if(pooping)pooping.src.onended=()=>{if(pooping)pooping.done=true;};
  }else if(!on&&pooping){
   const t=sound.currentTime;pooping.gain.gain.setTargetAtTime(0,t,.035);pooping.src.stop(t+.2);pooping=null;
  }
  return;
 }
 if(!sprayNodes){
  const osc=sound.createOscillator(),lp=sound.createBiquadFilter(),og=sound.createGain();
  const src=sound.createBufferSource(),bp=sound.createBiquadFilter(),ng=sound.createGain();
  osc.type='sawtooth';osc.frequency.value=72;lp.type='lowpass';lp.frequency.value=480;lp.Q.value=5;og.gain.value=0;
  osc.connect(lp);lp.connect(og);og.connect(master);osc.start();
  src.buffer=noiseBuf;src.loop=true;bp.type='bandpass';bp.frequency.value=1500;bp.Q.value=1.6;ng.gain.value=0;
  src.connect(bp);bp.connect(ng);ng.connect(master);src.start();
  sprayNodes={osc,lp,og,bp,ng,on:false};
 }
 const n=sprayNodes,t=sound.currentTime;
 if(on&&!n.on){tone(360,95,.1,'sine',.17);burst({type:'bandpass',from:950,to:280,q:2.2,gain:.22,dur:.1});} // the opening "plopp"
 n.on=on;
 // The level jumps about from frame to frame, which is what makes it splutter instead of drone.
 n.og.gain.setTargetAtTime(on?.05+.17*Math.random():0,t,on?.012:.045);n.ng.gain.setTargetAtTime(on?.05+.07*Math.random():0,t,on?.02:.06);
 if(on){
  if(Math.random()<.35)tone(260+520*Math.random(),110,.035+.03*Math.random(),'sine',.05); // bubbles
  if(Math.random()<.1)burst({type:'bandpass',from:500,to:1500,q:4,gain:.12,dur:.06});     // squelches
  n.osc.frequency.setTargetAtTime(50+42*Math.random()+14*Math.sin(t*31),t,.018);
  n.lp.frequency.setTargetAtTime(300+640*Math.random(),t,.03);
  n.bp.frequency.setTargetAtTime(900+1900*Math.random(),t,.035);
 }
}
// A wet slap where it lands, quieter with distance.
function splat(x,y,z,big){
 if(!master||muted)return;
 if(sfx.splat3){
  const t=sound.currentTime;if(t-lastLand<.11)return;lastLand=t;
  play('splat3',.3*clamp(1.25-Math.hypot(x-bird.x,y-bird.y,z-bird.z)/55,.12,1)*(big?1.5:1),1+.35*Math.random());return;
 }
 const t=sound.currentTime;if(t-lastSplat<.045)return;lastSplat=t;
 const vol=clamp(1.25-Math.hypot(x-bird.x,y-bird.y,z-bird.z)/55,.12,1)*(big?1.5:1);
 burst({from:2600+900*Math.random(),to:260,gain:.36*vol,dur:.17+.06*Math.random()});
 burst({type:'bandpass',from:700,to:180,q:3,gain:.3*vol,dur:.11,delay:.012});
 tone(150,52,.1,'sine',.14*vol);
}
// A dry double tick in the spirit of a shooter's hit marker; big hits add a low thump.
// A hit sounds like what it is: a fat wet splat, heavier for the big ones.
function hitTick(strong,pitch=1){
 if(!master||muted)return;
 if(sfx.splat1){play(strong?'splat1':'splat2',strong?.95:.8,pitch*(.95+.1*Math.random()));return;}
 const k=strong?1.35:1;
 burst({from:2100*pitch,to:170,gain:.5*k,attack:.003,dur:.2});
 burst({type:'bandpass',from:950*pitch,to:230,q:2.2,gain:.42*k,dur:.15,delay:.018});
 burst({type:'bandpass',from:320,to:1300*pitch,q:3.5,gain:.2*k,dur:.07,delay:.05}); // the squelch after the slap
 tone(175*pitch,52,.13,'sine',.26*k);
}
function crunch(){burst({from:2400,to:160,gain:.55,dur:.34});burst({type:'bandpass',from:1800,to:700,q:6,gain:.34,dur:.2,delay:.02});tone(310,63,.26,'sawtooth',.045);}
function whoosh(){burst({type:'bandpass',from:420,to:2400,q:1.1,gain:.65,attack:.09,dur:.4});}
// The hawk: a falling cry with a fast vibrato, a heartbeat, and a low drone that swells as it locks on.
function screech(attack){
 if(!master||muted)return;
 if(sfx.hawk1){play(attack?'hawk2':'hawk1',.8);return;}
 const t=sound.currentTime;
 for(const [delay,dur,f0] of [[0,.75,2500],[.9,.5,2300]]){
  const osc=sound.createOscillator(),lfo=sound.createOscillator(),lg=sound.createGain(),bp=sound.createBiquadFilter(),g=sound.createGain(),s=t+delay;
  osc.type='sawtooth';osc.frequency.setValueAtTime(f0,s);osc.frequency.exponentialRampToValueAtTime(f0*.55,s+dur);
  lfo.frequency.value=31;lg.gain.value=140;lfo.connect(lg);lg.connect(osc.frequency);
  bp.type='bandpass';bp.frequency.value=2100;bp.Q.value=3;
  g.gain.setValueAtTime(.0001,s);g.gain.linearRampToValueAtTime(.45,s+.04);g.gain.exponentialRampToValueAtTime(.0001,s+dur);
  osc.connect(bp);bp.connect(g);g.connect(master);osc.start(s);lfo.start(s);osc.stop(s+dur+.05);lfo.stop(s+dur+.05);
 }
}
function heartbeat(v){tone(84,40,.14,'triangle',.5*v);tone(76,38,.13,'triangle',.34*v,.17);}
function dread(level){
 if(!master)return;
 if(!droneNodes){
  const g=sound.createGain(),lp=sound.createBiquadFilter();g.gain.value=0;lp.type='lowpass';lp.frequency.value=170;lp.connect(g);g.connect(master);
  for(const f of [49,49.6,73.7]){const o=sound.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(lp);o.start();}
  droneNodes={g,lp};
 }
 droneNodes.g.gain.setTargetAtTime(.085*level,sound.currentTime,.25);droneNodes.lp.frequency.setTargetAtTime(150+280*level,sound.currentTime,.3);
}
// A startled yelp: a voice-like sweep through a vowel filter, pitched differently every time.
function yelp(){
 if(!master||muted)return;
 const t=sound.currentTime;if(t-lastYelp<.22)return;lastYelp=t;
 const f=330+380*Math.random(),osc=sound.createOscillator(),bp=sound.createBiquadFilter(),g=sound.createGain();
 osc.type='sawtooth';osc.frequency.setValueAtTime(f,t);osc.frequency.linearRampToValueAtTime(f*1.55,t+.07);osc.frequency.linearRampToValueAtTime(f*.8,t+.24);
 bp.type='bandpass';bp.frequency.value=900+500*Math.random();bp.Q.value=2.2;
 g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.2,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.26);
 osc.connect(bp);bp.connect(g);g.connect(master);osc.start(t);osc.stop(t+.3);
}
// A car alarm: the horn going on and off. Its level follows the distance to the car, so it fades as you fly away.
let hornNodes=null;
function alarmHorn(level){
 if(!master)return;
 if(!hornNodes){
  const g=sound.createGain(),lp=sound.createBiquadFilter();g.gain.value=0;lp.type='lowpass';lp.frequency.value=1700;lp.connect(g);g.connect(master);
  for(const f of [415,523]){const o=sound.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(lp);o.start();}
  hornNodes={g,lp};
 }
 hornNodes.g.gain.setTargetAtTime(level,sound.currentTime,.012);
 hornNodes.lp.frequency.setTargetAtTime(500+1400*Math.min(1,level*12),sound.currentTime,.05); // far away it is also duller
}
// The dive: a thin whistle that climbs and swells with speed while the wings are tucked.
let whistleNodes=null;
function whistle(level){
 if(!master)return;
 if(!whistleNodes){
  const a=sound.createOscillator(),b=sound.createOscillator(),g=sound.createGain(),bg=sound.createGain();
  a.type='sine';b.type='triangle';g.gain.value=0;bg.gain.value=.25;a.connect(g);b.connect(bg);bg.connect(g);g.connect(master);a.start();b.start();
  whistleNodes={a,b,g};
 }
 const t=sound.currentTime,f=480+1700*level;
 whistleNodes.a.frequency.setTargetAtTime(f,t,.07);whistleNodes.b.frequency.setTargetAtTime(f*1.503,t,.07);
 whistleNodes.g.gain.setTargetAtTime(.13*level*level,t,.06);
}
// The city itself: a low hum that fades with altitude and the odd car horn somewhere below.
function ambience(playing,dt){
 if(!master)return;
 if(sfx.city){ // a recorded street, looping, quieter the higher the bird flies
  if(!cityNodes){cityNodes=play('city',0,1,true);if(humNodes)humNodes.g.gain.setTargetAtTime(0,sound.currentTime,.3);}
  if(cityNodes)cityNodes.gain.gain.setTargetAtTime(playing?.5*clamp(1.1-bird.y/75,.3,1):0,sound.currentTime,.5);
  return;
 }
 if(!humNodes){
  const src=sound.createBufferSource(),lp=sound.createBiquadFilter(),g=sound.createGain();
  src.buffer=noiseBuf;src.loop=true;lp.type='lowpass';lp.frequency.value=210;g.gain.value=0;
  src.connect(lp);lp.connect(g);g.connect(master);src.start();humNodes={g};
 }
 const near=clamp(1.1-bird.y/75,.25,1);
 humNodes.g.gain.setTargetAtTime(playing?.11*near:0,sound.currentTime,.4);
 if(!playing)return;
 nextHorn-=dt;
 if(nextHorn<=0){
  nextHorn=6+10*Math.random();const f=370+90*Math.random(),len=.18+.3*Math.random(),vol=.022*near;
  tone(f,f*1.001,len,'sawtooth',vol);tone(f*1.26,f*1.261,len,'sawtooth',vol);
 }
}
