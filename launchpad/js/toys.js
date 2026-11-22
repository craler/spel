'use strict';
// The toys: things to play with, not to win. Same shape as the games in games.js (start/update/draw/input/hud/demo).

// =====================================================================
// TRUMMASKIN – a step sequencer. Every row is a sound and every column a step. The playhead sweeps from left
// to right and plays the lit pads it passes. A bar is 16 steps: ◀ ▶ show steps 1–8 or 9–16. Until you change
// something on 9–16 they play the same as 1–8 (shown a little dimmer).
// Three layers on the top row: Session = bass, Drums = drums, Keys = melody (both on a pentatonic scale, so
// anything sounds good). Hold a layer button to empty that layer. ▲ ▼ change the tempo.
// The round buttons on the right mute and unmute their row (red = muted). Hold one to empty the row.
// Everything is kept in the browser, so the beat is still there next time.
// =====================================================================
const TM_DRUMS=[ // top → bottom
 {name:'Öppen hihat',c:[1,.15,.75],play:at=>drum.open(at)},
 {name:'Hihat',c:[.6,.2,1],play:at=>drum.hat(at,.07)},
 {name:'Koskälla',c:[.15,.35,1],play:at=>drum.cowbell(at)},
 {name:'Hög tom',c:[0,.8,1],play:at=>drum.tom(220,at)},
 {name:'Låg tom',c:[0,1,.35],play:at=>drum.tom(130,at)},
 {name:'Handklapp',c:[1,.85,0],play:at=>drum.clap(at)},
 {name:'Virvel',c:[1,.4,0],play:at=>drum.snare(at)},
 {name:'Bastrumma',c:[1,0,0],play:at=>drum.kick(at)}
];
const TM_SCALE=[0,3,5,7,10,12,15,17]; // A minor pentatonic, bottom row first
const tmHz=(base,y)=>base*Math.pow(2,TM_SCALE[7-y]/12);
const TM_LAYERS=[
 {name:'Bas',top:4,c:[.15,.45,1],col:y=>hue(.5+y*.018),play:(y,at,step)=>bassNote(tmHz(55,y),at,step*1.8)},
 {name:'Trummor',top:5,c:[1,.3,.05],col:y=>TM_DRUMS[y].c,play:(y,at)=>TM_DRUMS[y].play(at)},
 {name:'Melodi',top:6,c:[.25,1,.3],col:y=>hue(wrap01((7-y)*.1)),play:(y,at,step)=>pluck(tmHz(220,y),at,Math.max(.25,step*2.5))}
];
const TM_SAVE='legends.trummaskin';
const Trummaskin={
 id:'trummaskin',name:'Trummaskin',color:[1,0,.75],
 how:'En leksak att göra takter med. Varje rad är ett ljud och varje kolumn ett steg. Ljuset sveper från vänster till höger och spelar knapparna som lyser – tryck för att tända eller släcka. En takt är 16 steg: ◀ ▶ visar steg 1–8 eller 9–16 (9–16 spelar samma som 1–8 tills du ändrar något där). Översta raden: Session = bas, Drums = trummor, Keys = melodi. Håll in en av dem för att tömma den. ▲ ▼ ändrar tempot. De runda knapparna till höger stänger av och sätter på sin rad (röd = av), håll in en för att tömma raden. Takten sparas till nästa gång.',
 legend:TM_DRUMS.map(d=>[d.c,d.name]),
 start(now){
  this.phase='play';this.layer=1;this.page=0;this.load();
  this.nextAt=now+.2;this.nextStep=0;this.queue=[];this.playStep=-1;this.playAt=0;this.audioOff=null;
  this.rowHit=[0,1,2].map(()=>new Array(8).fill(-9));this.layerHit=[-9,-9,-9];this.held={};this.flash=null;this.tempoAt=-9;
 },
 load(){
  let s=null;try{s=JSON.parse(localStorage.getItem(TM_SAVE));}catch{}
  const ok=s&&Array.isArray(s.pat)&&s.pat.length===3&&s.pat.every(l=>Array.isArray(l)&&l.length===8);
  this.tempo=ok?Math.max(60,Math.min(180,+s.tempo||100)):100;
  this.pat=ok?s.pat.map(l=>l.map(v=>v&0xFFFF)):this.starter();
  this.split=ok&&Array.isArray(s.split)?[0,1,2].map(i=>!!s.split[i]):[false,false,false];
  this.mute=[0,1,2].map(i=>new Array(8).fill(false).map((_,y)=>!!(ok&&s.mute&&s.mute[i]&&s.mute[i][y])));
 },
 save(){try{localStorage.setItem(TM_SAVE,JSON.stringify({tempo:this.tempo,pat:this.pat,split:this.split,mute:this.mute}));}catch{}},
 // A simple rock beat to start from: 'x' = on, 8 steps (9–16 play the same).
 starter(){
  const m=s=>[...s].reduce((v,ch,i)=>ch==='x'?v|1<<i:v,0);
  const bass=['........','........','........','........','........','......x.','........','x..x....'].map(m);
  const drums=['........','x.x.x.x.','........','........','........','........','....x...','x.....x.'].map(m);
  return [bass,drums,new Array(8).fill(0)];
 },
 on(l,y,s){const p=this.pat[l][y];return s>=8&&!this.split[l]?(p>>(s-8))&1:(p>>s)&1;},
 toggle(l,y,s){
  if(s>=8&&!this.split[l]){this.split[l]=true;this.pat[l]=this.pat[l].map(p=>(p&0xFF)|(p&0xFF)<<8);}
  this.pat[l][y]^=1<<s;this.save();
 },
 stepDur(){return 60/this.tempo/4;}, // sixteenth notes
 sound(s,at){
  const d=this.stepDur();
  for(let l=0;l<3;l++)for(let y=0;y<8;y++)if(this.on(l,y,s)&&!this.mute[l][y])TM_LAYERS[l].play(y,at,d);
 },
 clear(h,now){
  if(h.kind==='side'){this.pat[this.layer][h.i]=0;this.flash={row:h.i,at:now};}
  else{this.pat[h.l]=new Array(8).fill(0);this.split[h.l]=false;this.flash={row:-1,at:now};this.layer=h.l;}
  this.save();tone(600,150,.25,'sawtooth',.07);
 },
 update(dt,now){
  for(const k in this.held){const h=this.held[k];if(!h.done&&now-h.at>(h.kind==='side'?.5:.7)){h.done=true;this.clear(h,now);}}
  if(this.nextAt<now-.25)this.nextAt=now; // back from a pause (tab in the background): carry on from here
  const ready=audioReady();
  if(ready){
   // Audio clock = game clock + offset, minus the speaker delay. Re-line them up if they drift apart.
   const off=audioNow()-now-(ctx.outputLatency||ctx.baseLatency||0);
   if(this.audioOff===null||Math.abs(off-this.audioOff)>.03)this.audioOff=off;
   setEcho(this.stepDur()*3);
  }
  while(this.nextAt<now+.1){
   const s=this.nextStep,at=this.nextAt;
   if(ready)this.sound(s,at+this.audioOff);
   this.queue.push({s,at});
   this.nextAt+=this.stepDur();this.nextStep=(s+1)%16;
  }
  while(this.queue.length&&this.queue[0].at<=now){
   const q=this.queue.shift();this.playStep=q.s;this.playAt=q.at;
   for(let l=0;l<3;l++)for(let y=0;y<8;y++)if(this.on(l,y,q.s)&&!this.mute[l][y]){this.rowHit[l][y]=q.at;this.layerHit[l]=q.at;}
  }
 },
 input(ev,now){
  const l=this.layer;
  if(ev.kind==='pad'){
   if(!ev.down)return;
   const s=this.page*8+ev.x;this.toggle(l,ev.y,s);
   if(this.on(l,ev.y,s)&&!this.mute[l][ev.y])TM_LAYERS[l].play(ev.y,0,this.stepDur()); // hear what you put in
   return;
  }
  if(ev.kind==='side'){
   const key='s'+ev.i;
   if(ev.down){this.held[key]={kind:'side',i:ev.i,at:now,done:false};return;}
   const h=this.held[key];delete this.held[key];
   if(h&&!h.done){this.mute[l][ev.i]=!this.mute[l][ev.i];this.save();sfx.tick();}
   return;
  }
  if(ev.kind!=='top')return;
  if(ev.i>=4&&ev.i<=6){
   const li=ev.i-4,key='t'+li;
   if(ev.down){this.held[key]={kind:'top',l:li,at:now,done:false};if(l!==li){this.layer=li;sfx.menu();}}
   else delete this.held[key];
   return;
  }
  if(!ev.down)return;
  if(ev.i===0||ev.i===1){this.tempo=Math.max(60,Math.min(180,this.tempo+(ev.i===0?5:-5)));this.tempoAt=now;this.tempoKey=ev.i;this.save();sfx.tick();}
  else if(ev.i===2||ev.i===3){this.page=ev.i-2;sfx.menu();}
 },
 drawGrid(l,page,ps,age,now,muteRows){
  const L=TM_LAYERS[l],mirrored=page===1&&!this.split[l],head=ps>=0&&Math.floor(ps/8)===page?ps%8:-1;
  for(let y=0;y<8;y++){
   const c=L.col(y),muted=muteRows[y];
   for(let x=0;x<8;x++){
    const on=this.on(l,y,page*8+x);
    if(on){
     let a=muted?.1:mirrored?.35:.6,col=c;
     if(x===head&&!muted){const k=Math.max(0,1-age/.18);col=mix(c,COL.white,.8*k);a=Math.max(a,.6+.4*k);}
     px(x,y,col,a);
    }
    else if(x===head)px(x,y,COL.white,.13);
    else if(x%4===0)px(x,y,COL.white,.04); // the beats
   }
  }
 },
 draw(now){
  const l=this.layer,ps=this.playStep,age=now-this.playAt;
  this.drawGrid(l,this.page,ps,age,now,this.mute[l]);
  if(this.flash&&now-this.flash.at<.35){const a=1-(now-this.flash.at)/.35;for(let y=0;y<8;y++)if(this.flash.row<0||this.flash.row===y)for(let x=0;x<8;x++)px(x,y,COL.white,a*.8);}
  // Right column: mute buttons in the row's colour, flashing when the row plays
  for(let y=0;y<8;y++){
   const muted=this.mute[l][y],hit=Math.max(0,1-(now-this.rowHit[l][y])/.15);
   sideLed(y,muted?COL.red:TM_LAYERS[l].col(y),muted?.15:.3+.7*hit);
  }
  const tk=now-this.tempoAt<.2?.7:0;
  topLed(0,COL.white,.25+(this.tempoKey===0?tk:0));topLed(1,COL.white,.25+(this.tempoKey===1?tk:0));
  // ◀ ▶: the page you see is bright; the page the playhead is on blinks on every beat
  const beat=ps>=0&&ps%4===0?Math.max(0,1-age/.12):0;
  for(let p=0;p<2;p++)topLed(2+p,COL.white,(p===this.page?.6:.1)+(ps>=0&&Math.floor(ps/8)===p?.4*beat:0));
  TM_LAYERS.forEach((ly,i)=>topLed(ly.top,ly.c,(i===l?.7:.15)+.5*Math.max(0,1-(now-this.layerHit[i])/.12)));
 },
 hud(){
  const L=TM_LAYERS[this.layer],mirrored=this.page===1&&!this.split[this.layer];
  return `Tempo ${this.tempo} · ${L.name} · steg ${this.page?'9–16':'1–8'}${mirrored?' (spelar samma som 1–8 tills du ändrar något här)':''}`;
 },
 demo(t){
  if(!this.pat)this.pat=this.starter(),this.split=[false,false,false];
  const s=Math.floor(t/(60/110/4))%16;
  this.drawGrid(1,0,s%8,(t%(60/110/4)),t,new Array(8).fill(false));
 }
};

// =====================================================================
// FYRVERKERIET – a toy. Press anywhere: a rocket goes up from the bottom and bursts where you pressed.
// The bottom row makes a fountain instead. The round buttons on the right pick the kind of burst
// (FW_TYPES; the first one mixes them). ▲ fires a finale, ▼ starts/stops a show that runs by itself.
// Sparks are drawn between the pads (each spark lights the four nearest pads a little), added together.
// =====================================================================
const FW_TYPES=[
 {name:'Blandat',c:null},
 {name:'Boll',c:[1,.15,.15]},
 {name:'Ring',c:[.2,.55,1]},
 {name:'Guldregn',c:[1,.62,.12]},
 {name:'Färgbyte',c:[.2,1,.35]},
 {name:'Knaster',c:[1,1,1]},
 {name:'Palm',c:[1,.45,0]},
 {name:'Regnbåge',c:[.75,.25,1]}
];
const FW_COLS=[[1,.1,.1],[1,.45,0],[1,.85,.1],[.2,1,.2],[.1,.8,1],[.2,.3,1],[.7,.2,1],[1,.2,.7],[1,1,1]];
const fwPick=()=>FW_COLS[rnd(FW_COLS.length)];
function fwState(){return {rockets:[],parts:[],fountains:[],flashes:[],queue:[],buf:new Float32Array(64*3)};}
function fwLaunch(S,x,ty,type,loud){
 if(type===0)type=1+rnd(FW_TYPES.length-1);
 const c=type===3?FW_TYPES[3].c:type===5?[1,.95,.8]:fwPick(); // gold rain is gold, crackle white-ish, the rest any colour
 S.rockets.push({x:x+.5+(Math.random()-.5)*.2,y:8,ty:ty+.5,vy:-11-Math.random()*2,type,c,c2:fwPick()});
 if(loud)boom.launch();
}
function fwFountain(S,x,now,loud){S.fountains.push({x:x+.5,until:now+1.6,acc:0});if(loud)boom.fizz();}
function fwBurst(S,r,now,loud){
 const T=r.type,n=T===6?8:T===2?22:T===5?26:34,ring=T===2||T===6;
 for(let i=0;i<n&&S.parts.length<700;i++){
  const ang=ring?i/n*Math.PI*2+Math.random()*.15:Math.random()*Math.PI*2;
  const sp=T===2?3.6:T===6?3.3:T===3?2.7*(.5+.5*Math.random()):3.5*Math.sqrt(Math.random());
  S.parts.push({x:r.x,y:r.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-.4,age:0,
   life:T===3?2.4:T===6?1.6:T===4?1.5:1+Math.random()*.3,
   g:T===3?2:T===6?3:3.5,drag:T===3?1.6:T===6?.9:1.3,
   c:T===7?hue(Math.random()):r.c,c2:T===4?r.c2:null,trail:T===3||T===6?[]:null,crackle:T===5,glow:T===6?1.6:1});
 }
 S.flashes.push({x:r.x,y:r.y,c:T===7?COL.white:r.c,at:now,k:T===6?.3:.18});
 if(loud){boom.bang(T===6?1.3:1);if(T===5)boom.crackle(.5,16);}
}
function fwStep(S,dt,now,loud){
 for(const q of S.queue)if(now>=q.at){q.done=true;fwLaunch(S,q.x,q.ty,q.type,loud);}
 S.queue=S.queue.filter(q=>!q.done);
 for(const r of S.rockets){
  r.y+=r.vy*dt;r.vy*=Math.exp(-.6*dt);r.x+=Math.sin(r.y*3)*.02;
  if(S.parts.length<700)S.parts.push({x:r.x,y:r.y+.3,vx:(Math.random()-.5)*.6,vy:1.5,age:0,life:.3,g:2,drag:1,c:[1,.55,.15],glow:.6});
  if(r.y<=r.ty){r.done=true;fwBurst(S,r,now,loud);}
 }
 S.rockets=S.rockets.filter(r=>!r.done);
 for(const f of S.fountains){
  f.acc+=dt*45;
  while(f.acc>=1&&S.parts.length<700){f.acc--;S.parts.push({x:f.x+(Math.random()-.5)*.3,y:7.9,vx:(Math.random()-.5)*2.2,vy:-5.5-Math.random()*3,age:0,life:.7+Math.random()*.4,g:9,drag:.4,c:Math.random()<.3?COL.white:[1,.7,.2],glow:.9});}
 }
 S.fountains=S.fountains.filter(f=>now<f.until);
 const born=[];
 for(const p of S.parts){
  p.age+=dt;
  if(p.trail){p.trail.unshift([p.x,p.y]);if(p.trail.length>4)p.trail.pop();}
  const k=Math.exp(-p.drag*dt);p.vx*=k;p.vy=p.vy*k+p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
  if(p.crackle&&p.age>p.life*.55){p.age=p.life;for(let i=0;i<2;i++)born.push({x:p.x,y:p.y,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,age:0,life:.18+Math.random()*.15,g:1,drag:2,c:COL.white,glow:1.4,flicker:true});}
 }
 S.parts=S.parts.filter(p=>p.age<p.life&&p.y<9&&p.x>-1&&p.x<9).concat(born);
 S.flashes=S.flashes.filter(f=>now-f.at<.4);
}
function fwSplat(buf,x,y,c,b){
 const fx=x-.5,fy=y-.5,ix=Math.floor(fx),iy=Math.floor(fy),wx=fx-ix,wy=fy-iy;
 for(const [dx,dy,w] of [[0,0,(1-wx)*(1-wy)],[1,0,wx*(1-wy)],[0,1,(1-wx)*wy],[1,1,wx*wy]]){
  const X=ix+dx,Y=iy+dy;if(X<0||X>7||Y<0||Y>7)continue;
  const o=(X+Y*8)*3,a=w*b;buf[o]+=c[0]*a;buf[o+1]+=c[1]*a;buf[o+2]+=c[2]*a;
 }
}
function fwDraw(S,now){
 const buf=S.buf;buf.fill(0);
 for(const f of S.flashes){ // the sky lights up around a burst
  const a=f.k*(1-(now-f.at)/.4);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const d=Math.hypot(x+.5-f.x,y+.5-f.y),w=a*Math.max(0,1-d/6),o=(x+y*8)*3;buf[o]+=f.c[0]*w;buf[o+1]+=f.c[1]*w;buf[o+2]+=f.c[2]*w;}
 }
 for(const p of S.parts){
  const k=p.age/p.life;let b=Math.pow(1-k,1.3)*p.glow;if(p.flicker)b*=Math.random()<.5?1:.2;
  const c=p.c2&&k>.45?p.c2:p.c;
  fwSplat(buf,p.x,p.y,c,b);
  if(p.trail)p.trail.forEach(([x,y],i)=>fwSplat(buf,x,y,c,b*.45*Math.pow(.6,i)));
 }
 for(const r of S.rockets)fwSplat(buf,r.x,r.y,[1,.85,.6],1.2);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){const o=(x+y*8)*3;px(x,y,[Math.min(1,buf[o]),Math.min(1,buf[o+1]),Math.min(1,buf[o+2])]);}
}
const Fyrverkeriet={
 id:'fyrverkeri',name:'Fyrverkeriet',color:[1,.85,.3],
 how:'En leksak, inget spel. Tryck var som helst på plattan: en raket skjuts upp från botten och smäller där du tryckte. Nedersta raden ger en fontän. De runda knapparna till höger väljer sort (den översta blandar). ▲ skjuter en final med massor av raketer, ▼ startar eller stänger av en show som går av sig själv.',
 legend:FW_TYPES.slice(1).map(t=>[t.c,t.name]),
 start(now){this.phase='play';this.type=0;this.S=fwState();this.auto=false;this.autoAt=now+1;this.last=now;},
 update(dt,now){
  if(this.auto&&now>=this.autoAt){this.autoAt=now+.45+Math.random()*.9;fwLaunch(this.S,rnd(8),rnd(4),this.type,true);}
  fwStep(this.S,dt,now,true);
 },
 input(ev,now){
  if(!ev.down)return;
  if(ev.kind==='pad'){if(ev.y===7)fwFountain(this.S,ev.x,now,true);else fwLaunch(this.S,ev.x,ev.y,this.type,true);return;}
  if(ev.kind==='side'){this.type=ev.i;sfx.tick();return;}
  if(ev.kind==='top'&&ev.i===0){ // finale: a stream of rockets and then a big burst all at once
   for(let i=0;i<14;i++)this.S.queue.push({at:now+i*.2+Math.random()*.1,x:rnd(8),ty:rnd(4),type:this.type});
   for(let i=0;i<6;i++)this.S.queue.push({at:now+3.1+Math.random()*.1,x:i+1,ty:rnd(3),type:this.type});
   sfx.menu();
  }
  if(ev.kind==='top'&&ev.i===1){this.auto=!this.auto;this.autoAt=now+.2;sfx.menu();}
 },
 draw(now){
  fwDraw(this.S,now);
  for(let i=0;i<8;i++){const t=FW_TYPES[i];sideLed(i,t.c||hue(wrap01(now*.3)),i===this.type?.6+.4*pulse(now,2):.15);}
  topLed(0,COL.gold,this.S.queue.length?pulse(now,6):.45);
  topLed(1,COL.green,this.auto?.5+.5*pulse(now,1.5):.12);
 },
 hud(){return `Sort: ${FW_TYPES[this.type].name}${this.auto?' · showen går av sig själv (▼ stänger av)':''}${this.S.queue.length?' · final!':''}`;},
 demo(t){
  if(!this.D||t<this.Dt){this.D=fwState();this.Dt=t;this.Dn=t;}
  const dt=Math.min(.05,t-this.Dt);this.Dt=t;
  if(t>=this.Dn){this.Dn=t+.5+Math.random()*.5;fwLaunch(this.D,1+rnd(6),rnd(4),0,false);}
  fwStep(this.D,dt,t,false);fwDraw(this.D,t);
 }
};

// =====================================================================
// LIVET – Conway's Game of Life on the 8 × 8 grid, a toy. Edges wrap around (what leaves on one side
// comes back on the other). A cell with 2 or 3 neighbours lives on, an empty pad with exactly 3 is born,
// everything else dies. Colour = age: new cells are white, then cyan, green, yellow… old ones end up red.
// Pads toggle cells (also while it runs). Right column: known patterns (LIFE_PATTERNS). Top row:
// ▲ ▼ speed, ◀ ▶ one step back/forward (it keeps 200 steps of history), Session = run/pause,
// Drums = random, Keys = clear. Every birth plays a soft note: higher up = higher note.
// =====================================================================
const LIFE_PATTERNS=[
 {name:'Glidare',c:[.2,1,.6],cells:['.#.','..#','###'],at:[0,0]},
 {name:'Två glidare',c:[0,.85,.9],cells:['.#......','..#.....','###.....','........','........','.....###','.....#..','......#.'],at:[0,0]},
 {name:'Blinkare',c:[1,.8,.2],cells:['###']},
 {name:'Padda',c:[1,.45,.1],cells:['.###','###.']},
 {name:'Fyr',c:[1,.2,.3],cells:['##..','##..','..##','..##']},
 {name:'Klocka',c:[.8,.3,1],cells:['..#.','#.#.','.#.#','.#..']},
 {name:'Rymdskepp',c:[.2,.5,1],cells:['.#..#','#....','#...#','####.']},
 {name:'Kaos',c:[1,1,1],cells:['.##','##.','.#.']}
];
const LIFE_SPEEDS=[1,2,3,4,6,8,12,16];
function lifeNext(cells){
 const n=new Uint8Array(64);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  let c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)c+=cells[((x+dx)&7)+((y+dy)&7)*8];
  const k=x+y*8;n[k]=cells[k]?(c===2||c===3?1:0):(c===3?1:0);
 }
 return n;
}
const lifeCol=age=>hue(wrap01(.52-Math.min(age,13)*.037));
const Livet={
 id:'livet',name:'Livet',color:[.2,1,.75],
 how:'En leksak, inget spel. Tänd celler genom att trycka på plattan och se dem leva. En cell med två eller tre grannar lever vidare, en tom ruta med precis tre grannar får en ny cell, alla andra dör. Kanterna hänger ihop: det som går ut på ena sidan kommer in på den andra. Färgen visar hur gammal cellen är, från vit till röd. De runda knapparna till höger lägger in kända mönster. Översta raden: ▲ ▼ fart, ◀ ▶ ett steg bakåt eller framåt, Session = start och paus, Drums = slumpa, Keys = töm.',
 legend:LIFE_PATTERNS.map(p=>[p.c,p.name]),
 start(now){
  this.phase='play';this.cells=new Uint8Array(64);this.age=new Uint16Array(64);this.bornAt=new Float32Array(64).fill(-9);
  this.diedAt=new Float32Array(64).fill(-9);this.diedAge=new Uint16Array(64);this.hist=[];this.gen=0;this.speed=3;this.still=0;
  this.stamp(0,now);
 },
 setCells(next,now,age){
  for(let k=0;k<64;k++){
   if(next[k]&&!this.cells[k]){this.bornAt[k]=now;this.age[k]=age?age[k]:0;}
   else if(!next[k]&&this.cells[k]){this.diedAt[k]=now;this.diedAge[k]=this.age[k];}
   else if(next[k])this.age[k]=age?age[k]:this.age[k]+1;
  }
  this.cells=next;
 },
 step(now,loud=true){
  this.hist.push({cells:this.cells,age:this.age.slice(),gen:this.gen});if(this.hist.length>200)this.hist.shift();
  const prev=this.cells,next=lifeNext(prev),births=[];
  for(let k=0;k<64;k++)if(next[k]&&!prev[k])births.push(k);
  this.setCells(next,now);this.gen++;
  // Standing still or blinking back and forth?
  const h=this.hist,same=(a,b)=>a.every((v,i)=>v===b[i]);
  this.still=same(next,prev)?1:h.length>1&&same(next,h[h.length-2].cells)?2:0;
  if(loud&&births.length&&audioReady()){
   const pick=births.length<=3?births:[0,1,2].map(i=>births[Math.floor(i*births.length/3)]);
   const at=audioNow();pick.slice(0,LIFE_SPEEDS[this.speed]>6?1:3).forEach((k,i)=>pluck(scaleHz(7-(k>>3)+((k&7)>>2)*2),at+i*.01,.3,.05));
  }
 },
 back(now){const h=this.hist.pop();if(!h)return false;this.setCells(h.cells,now,h.age);this.gen=h.gen;this.still=0;return true;},
 stamp(i,now){
  const p=LIFE_PATTERNS[i],next=new Uint8Array(64),h=p.cells.length,w=p.cells[0].length;
  const [ox,oy]=p.at||[Math.floor((8-w)/2),Math.floor((8-h)/2)];
  p.cells.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='#')next[((ox+x)&7)+((oy+y)&7)*8]=1;}));
  this.setCells(next,now);for(let k=0;k<64;k++)if(next[k])this.age[k]=0;
  this.hist=[];this.gen=0;this.running=true;this.nextAt=now+.6;this.pattern=i;this.still=0;
 },
 update(dt,now){
  if(!this.running)return;
  if(this.nextAt<now-.5)this.nextAt=now;
  if(now>=this.nextAt){this.nextAt+=1/LIFE_SPEEDS[this.speed];this.step(now);}
 },
 input(ev,now){
  if(!ev.down)return;
  if(ev.kind==='pad'){
   const k=ev.x+ev.y*8,next=this.cells.slice();next[k]^=1;this.setCells(next,now);if(next[k])this.age[k]=0;
   if(next[k])pluck(scaleHz(7-ev.y+(ev.x>>2)*2),0,.25,.06);else tone(300,200,.06,'triangle',.05);
   this.still=0;return;
  }
  if(ev.kind==='side'){this.stamp(ev.i,now);sfx.menu();return;}
  if(ev.kind!=='top')return;
  const i=ev.i;
  if(i===0||i===1){this.speed=Math.max(0,Math.min(LIFE_SPEEDS.length-1,this.speed+(i===0?1:-1)));sfx.tick();}
  else if(i===2){this.running=false;if(this.back(now))sfx.tick();else tone(140,140,.07,'square',.05);}
  else if(i===3){this.running=false;this.step(now);}
  else if(i===4){this.running=!this.running;this.nextAt=now+.05;sfx.menu();}
  else if(i===5){const next=new Uint8Array(64);for(let k=0;k<64;k++)next[k]=Math.random()<.35?1:0;this.setCells(next,now);for(let k=0;k<64;k++)if(next[k])this.age[k]=0;this.hist=[];this.gen=0;this.running=true;this.nextAt=now+.4;sfx.menu();}
  else if(i===6){this.setCells(new Uint8Array(64),now);this.hist=[];this.gen=0;tone(500,120,.25,'sawtooth',.06);}
 },
 drawCells(cells,age,bornAt,diedAt,diedAge,now){
  for(let k=0;k<64;k++){
   const x=k&7,y=k>>3;
   if(cells[k]){const c=lifeCol(age[k]),f=Math.max(0,1-(now-bornAt[k])/.2);px(x,y,mix(c,COL.white,f),.65+.35*f);}
   else{const g=1-(now-diedAt[k])/.35;if(g>0)px(x,y,lifeCol(diedAge[k]),.4*g);}
  }
 },
 draw(now){
  this.drawCells(this.cells,this.age,this.bornAt,this.diedAt,this.diedAge,now);
  LIFE_PATTERNS.forEach((p,i)=>sideLed(i,p.c,i===this.pattern?.55:.15));
  topLed(0,COL.white,.25);topLed(1,COL.white,.25);
  topLed(2,COL.white,this.hist.length?.35:.06);topLed(3,COL.white,.35);
  topLed(4,this.running?COL.green:COL.yellow,this.running?.7:.3+.5*pulse(now,2));
  topLed(5,COL.purple,.45);topLed(6,COL.red,.35);
 },
 hud(){
  let pop=0;for(const v of this.cells)pop+=v;
  const state=this.running?`${LIFE_SPEEDS[this.speed]} steg/s`:'pausad (Session startar)';
  const note=!pop?' · allt har dött ut – tryck på plattan eller en sidoknapp':this.still===1?' · står still':this.still===2?' · blinkar fram och tillbaka':'';
  return `Generation ${this.gen} · ${pop} celler · ${state}${note}`;
 },
 demo(t){
  if(!this.demoGens){ // two gliders and a blinker, worked out once
   let c=new Uint8Array(64);for(const k of [1,10,16,17,18,45,46,47,60])c[k]=1;
   const gens=[],ages=[];let a=new Uint16Array(64);
   for(let i=0;i<64;i++){gens.push(c);ages.push(a);const n=lifeNext(c),na=new Uint16Array(64);for(let k=0;k<64;k++)if(n[k])na[k]=c[k]?a[k]+1:0;c=n;a=na;}
   this.demoGens=gens;this.demoAges=ages;
  }
  const g=Math.floor(t*4)%this.demoGens.length,f=(t*4)%1;
  const born=new Float32Array(64).fill(-9),prev=this.demoGens[(g+this.demoGens.length-1)%this.demoGens.length];
  for(let k=0;k<64;k++)if(this.demoGens[g][k]&&!prev[k])born[k]=t-f/4;
  this.drawCells(this.demoGens[g],this.demoAges[g],born,new Float32Array(64).fill(-9),new Uint16Array(64),t);
 }
};
