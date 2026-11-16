'use strict';
// Sound: synthesised tones plus a sample bank (crash tail and eight wing strokes) in audio/samples.mp3.
const sampleCuts=[[0.0, 5.4], [5.45, 0.19], [5.69, 0.19], [5.93, 0.19], [6.17, 0.19], [6.41, 0.19], [6.65, 0.19], [6.89, 0.19], [7.13, 0.19]];
function tone(from,to,duration,type='sine',gain=.08,delay=0){
 if(!sound||muted)return;
 const t=sound.currentTime+delay, osc=sound.createOscillator(), vol=sound.createGain();
 osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);
 vol.gain.setValueAtTime(.001,t);vol.gain.exponentialRampToValueAtTime(gain,t+.012);vol.gain.exponentialRampToValueAtTime(.001,t+duration);
 osc.connect(vol);vol.connect(sound.destination);osc.start(t);osc.stop(t+duration);
}
let rig=null,crash=null;
let bank=null,bankLoading=false,lastWing=0,wind=null,master=null,crashVoice=null,lastPuff=-2;
function setupAudio(){
 if(!sound)return;
 if(!master){
  master=sound.createGain();master.gain.value=muted?0:.85;master.connect(sound.destination);
  const noise=sound.createBuffer(1,sound.sampleRate*2,sound.sampleRate),data=noise.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  const source=sound.createBufferSource(),filter=sound.createBiquadFilter(),gain=sound.createGain();
  source.buffer=noise;source.loop=true;filter.type='bandpass';filter.Q.value=.7;gain.gain.value=0;
  source.connect(filter);filter.connect(gain);gain.connect(master);source.start();wind={gain,filter};
 }
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
function puff(){
 if(!sound||muted||elapsed-lastPuff<.14)return;lastPuff=elapsed;
 const t=sound.currentTime,osc=sound.createOscillator(),f=sound.createBiquadFilter(),g=sound.createGain();
 osc.type='sawtooth';osc.frequency.setValueAtTime(80+Math.random()*28,t);osc.frequency.exponentialRampToValueAtTime(34,t+.15);
 f.type='lowpass';f.frequency.value=390;g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.13,t+.018);g.gain.exponentialRampToValueAtTime(.001,t+.17);
 osc.connect(f);f.connect(g);g.connect(master);osc.start(t);osc.stop(t+.18);
}
