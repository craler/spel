'use strict';
// The small games. Each one is an object with:
//   id, name, color, how (rules shown on screen)
//   start(now)            – new round
//   update(dt, now)       – simulation, called every tick
//   draw(now)             – paint the Launchpad with px()/topLed()/sideLed()
//   input(ev, now)        – a pad or button went down/up: {kind:'pad',x,y,down} / {kind:'top'|'side',i,down}
//   hud()                 – one or two lines for the screen
//   demo(t)               – the looping animation the menu shows on the whole grid while the game is selected
//   legend                – optional: [[colour, text], …] shown on screen under the rules
// Top row button 7 (User) is reserved for "hold to go back to the menu" (main.js), so games use top 0..6.

const COL={
 white:[1,1,1],red:[1,0,0],green:[0,1,.1],blue:[0,.3,1],yellow:[1,.75,0],orange:[1,.35,0],
 purple:[.55,0,1],cyan:[0,.85,1],pink:[1,.1,.55],gold:[1,.55,0],grey:[.25,.25,.3]
};
const rnd=n=>Math.floor(Math.random()*n);
const lerp=(a,b,k)=>a+(b-a)*Math.max(0,Math.min(1,k));
const pulse=(t,speed=3)=>.55+.45*Math.sin(t*speed*Math.PI);
const wrap01=v=>((v%1)+1)%1;

// ---- 3 × 5 font (M and N are wider). Text colour can be a function of the letter index.
const GLYPHS={
 '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],
 '3':['111','001','111','001','111'],'4':['101','101','111','001','001'],'5':['111','100','111','001','111'],
 '6':['111','100','111','101','111'],'7':['111','001','001','010','010'],'8':['111','101','111','101','111'],
 '9':['111','101','111','001','111'],'-':['000','000','111','000','000'],'+':['000','010','111','010','000'],' ':['00','00','00','00','00'],
 'A':['010','101','111','101','101'],'D':['110','101','101','101','110'],'E':['111','100','110','100','111'],
 'F':['111','100','110','100','100'],'G':['011','100','101','101','011'],'I':['111','010','010','010','111'],
 'K':['101','101','110','101','101'],'L':['100','100','100','100','111'],'M':['10001','11011','10101','10001','10001'],
 'N':['1001','1101','1011','1001','1001'],'O':['010','101','101','101','010'],'P':['110','101','110','100','100'],
 'R':['110','101','110','101','101'],'T':['111','010','010','010','010'],'U':['101','101','101','101','111'],
 'V':['101','101','101','101','010'],'Ä':['101','010','101','111','101'],
 'S':['011','100','010','001','110'],'Y':['101','101','010','010','010'],'Ö':['101','000','111','101','111'],
 'B':['110','101','110','101','110'],'C':['011','100','100','100','011'],'H':['101','101','111','101','101'],'J':['001','001','001','101','010']
};
const glyph=ch=>GLYPHS[ch]||GLYPHS[ch.toUpperCase()]||GLYPHS[' '];
function drawGlyph(g,ox,oy,c,a=1){for(let r=0;r<g.length;r++)for(let k=0;k<g[r].length;k++)if(g[r][k]==='1')px(ox+k,oy+r,c,a);}
function drawText(str,ox,oy,c,a=1){
 let x=ox,i=0;
 for(const ch of str){const g=glyph(ch);drawGlyph(g,x,oy,typeof c==='function'?c(i):c,a);x+=g[0].length+1;i++;}
}
const textWidth=s=>[...s].reduce((w,ch)=>w+glyph(ch)[0].length+1,0)-1;
// Centred if it fits, otherwise scrolling right → left.
function drawTextFit(str,c,t,oy=1){
 const w=textWidth(str);
 if(w<=8){drawText(str,Math.floor((8-w)/2),oy,c);return;}
 const span=w+12;drawText(str,8-Math.floor((t*9)%span),oy,c);
}
// One pass from right to left; returns false when it has scrolled past.
function scrollOnce(str,c,t,oy=1,speed=10){const x=8-Math.floor(t*speed);if(x<-textWidth(str))return false;drawText(str,x,oy,c);return true;}
// Big numbers 7 pads tall: one digit 5 wide, two digits 3 wide each. reveal 0..1 lights them up from the left.
function stretch(g,cols,rows){return rows.map(r=>cols.map(c=>g[r][c]).join(''));}
function drawBigNumber(n,c,reveal=1,oy=0){
 const str=String(n).slice(-2),one=str.length===1;
 const gl=[...str].map(ch=>stretch(GLYPHS[ch],one?[0,1,1,1,2]:[0,1,2],[0,1,1,2,3,3,4]));
 const w=one?5:7,ox=Math.floor((8-w)/2),edge=reveal*(w+1);
 gl.forEach((g,i)=>{for(let r=0;r<7;r++)for(let k=0;k<g[r].length;k++){
  const x=ox+i*4+k;if(g[r][k]==='1'&&x-ox<edge)px(x,oy+r,typeof c==='function'?c(x,oy+r):c);
 }});
}

// ---- Best scores, kept in this browser
function getBest(id){try{return +localStorage.getItem('legends.best.'+id)||0;}catch{return 0;}}
function saveBest(id,v){const b=getBest(id);if(v>b){try{localStorage.setItem('legends.best.'+id,v);}catch{}return true;}return false;}

// ---- Shared game-over screen: the result scrolls, the bottom row pulses green, any pad plays again.
function gameOver(g,text,color,now){g.phase='over';g.overAt=now;g.overText=String(text);g.overColor=color;}
function drawOver(g,now){
 const t=now-g.overAt;
 drawTextFit(g.overText,g.overColor,t,1);
 if(t>1)for(let x=0;x<8;x++)px(x,7,COL.green,.25+.35*pulse(now,1.5));
}
function overInput(g,ev,now){if(ev.kind==='pad'&&ev.down&&now-g.overAt>1){g.start(now);sfx.start();}}
// ---- 1 or 2 players. In every game with a computer opponent the Keys button (7th on the top row) switches
// between playing the computer (1) and two players on the same pad (2). The big number shows for a moment.
const PLAYERS_BTN=6,PLAYERS_COL={cpu:COL.cyan,two:COL.pink};
function playersInput(g,ev,now){
 if(ev.kind!=='top'||ev.i!==PLAYERS_BTN||!ev.down)return false;
 g.mode=g.mode==='cpu'?'two':'cpu';g.modeAt=now;g.start(now);sfx.menu();return true;
}
function drawPlayers(g,now){ // the button, and the big 1 or 2 just after a switch; true = nothing else to draw
 topLed(PLAYERS_BTN,PLAYERS_COL[g.mode],.45+.35*pulse(now,.8));
 if(g.modeAt&&now-g.modeAt<.9){drawBigNumber(g.mode==='two'?2:1,PLAYERS_COL[g.mode],Math.min(1,(now-g.modeAt)/.15));return true;}
 return false;
}
const playersText=g=>g.mode==='two'?'2 spelare':'1 spelare mot datorn';

// Countdown/progress on the top row (0..6). k = 1 full, 0 empty.
function topBar(k,c){const n=k*7;for(let i=0;i<7;i++){const a=Math.max(0,Math.min(1,n-i));if(a>0)topLed(i,c,a);}}


// =====================================================================
// TAKT – the rhythm game, Guitar Hero style, to "I bergakungens sal" (In the Hall of the Mountain King,
// Edvard Grieg 1875 – free to use) as a rock song that speeds up towards the end, like the original.
// Coloured notes fall down the lanes in the middle of the grid. Press the lane's pad on the bottom two rows
// as a note reaches the bottom row: that plays the melody note on the lead guitar. Long notes have a tail –
// keep the pad held until the tail has passed (letting go early breaks your streak).
// The lanes follow the melody: higher notes further right, and the same tune always has the same shape.
// A miss makes the guitar clunk and breaks your streak. The longer the streak, the more of the band plays
// (×2 open guitar chords, ×3 crashes and fast hi-hats, ×4 sparkling arpeggios).
// Levels: 1 = 4 lanes, only the notes on the beat (the band plays the rest) and only the longest notes held; 2 = 6 lanes, every
// note; 3 = 8 lanes, every note, faster. Hit 70 % of the notes to go up a level.
// The columns outside the lanes are speakers that pump with the beat and burn brighter with the multiplier.
// =====================================================================
const TAKT_LEVELS=[
 {lanes:4,x0:2,bpm:96,beatsOnly:true,cols:[COL.green,COL.red,COL.yellow,COL.blue]},
 {lanes:6,x0:1,bpm:104,beatsOnly:false,cols:[COL.purple,COL.green,COL.red,COL.yellow,COL.blue,COL.orange]},
 {lanes:8,x0:0,bpm:114,beatsOnly:false,cols:[COL.cyan,COL.purple,COL.green,COL.red,COL.yellow,COL.blue,COL.orange,COL.pink]}
];
// The tune: 4 bars of [eighth in the bar, semitones above A3 (220 Hz), length in eighths].
const TAKT_THEME=[
 [[0,0,1],[1,2,1],[2,3,1],[3,5,1],[4,7,1],[5,3,1],[6,7,2]],          // A B C D E C E–
 [[0,6,1],[1,2,1],[2,6,2],[4,5,1],[5,1,1],[6,5,2]],                   // D# B D#–  D Bb D–
 [[0,0,1],[1,2,1],[2,3,1],[3,5,1],[4,7,1],[5,3,1],[6,7,1],[7,12,1]],  // A B C D E C E A
 [[0,10,1],[1,7,1],[2,3,1],[3,7,1],[4,10,4]]                          // G E C E G–––
];
// Power chords under it, two per bar, in semitones above A2 (110 Hz): A A | B Bb | A A | C G
const TAKT_ROOTS=[[0,0],[2,1],[0,0],[3,-2]];
const TAKT_OUTRO=[[[0,12,3],[4,7,3]],[[0,0,8]]],TAKT_OUTRO_ROOTS=[[0,-5],[0,0]]; // two big hits, then the last long A
// [section, key (0 = A minor, 7 = E minor), tempo × at the start, tempo × at the end] – one 4-bar theme each
const TAKT_SONG=[
 ['verse',0,1,1],['verse',0,1,1],['chorus',7,1.04,1.04],['chorus',0,1.04,1.06],['fast',0,1.08,1.17],['fast',7,1.19,1.3]
];
const taktHz=s=>220*Math.pow(2,s/12);
// Lanes go by the note's rank among the tune's notes (low → left), so every lane gets used.
const TAKT_RANK=[...new Set(TAKT_THEME.flat().map(n=>n[1]))].sort((a,b)=>a-b);
const taktRoot=r=>{r=((r+5)%12+12)%12-5;return 110*Math.pow(2,r/12);}; // keep the bass between E2 and D#3
const Takt={
 id:'takt',name:'Takt',color:COL.pink,
 how:'Som Guitar Hero, till "I bergakungens sal" i rockversion – den går fortare och fortare mot slutet. Färgade ljus faller ner i filerna i mitten. Tryck på filens knapp längst ner (de två nedersta raderna) precis när ljuset når botten – då spelar du melodin på gitarren. Långa toner har en svans: håll knappen intryckt tills svansen har passerat, annars bryts serien. Ju längre serie, desto mer av bandet spelar med. Nivå 1 har fyra filer och bara tonerna på taktslagen, lätt att spela med en hand. Träffa 70 % av tonerna för att gå upp en nivå.',
 carry:0,
 start(now){
  this.lv=this.carry;this.carry=0;
  const L=this.L=TAKT_LEVELS[this.lv];
  this.phase='play';
  this.speed=L.bpm*2/60;              // rows per second the notes fall (one row = an eighth at the starting tempo)
  this.t0=now+.6;                     // when the song starts (two bars of count-in and drums)
  this.makeSong();
  this.score=0;this.combo=0;this.maxCombo=0;this.hits=0;this.flash=[];this.missAt=new Array(8).fill(-9);this.laneAt=new Array(8).fill(-9);
  this.holding=new Array(8).fill(null);this.down=[...Array(8)].map(()=>new Set());
  this.nextSlot=0;this.visSlot=0;this.beatAt=-9;this.beatRow=.3;this.audioOff=null;this.passed=false;
 },
 // The chart and the band's slots (one per eighth note). Each bar can have its own tempo, so times add up.
 makeSong(){
  const L=this.L,notes=[],slots=[];let t=this.t0;this._first=null;
  const addBar=(sec,mul,roots,tune,lo,last)=>{
   const row=60/(L.bpm*mul)/2,start=t;
   for(let e=0;e<8;e++){slots.push({time:t,row,sec,e,roots,last,auto:[]});t+=row;}
   for(const [e,s,len] of tune||[]){
    const time=start+e*row,f=taktHz(s),slot=slots[slots.length-8+e];
    if(L.beatsOnly&&e%2&&sec!=='outro'){slot.auto.push({f,len:len*row});continue;} // the band plays it
    const lane=Math.min(L.lanes-1,Math.floor(TAKT_RANK.indexOf(s-lo)*L.lanes/TAKT_RANK.length));
    notes.push({lane,time,f,hold:len>=(L.beatsOnly?3:2),end:time+len*row-.06,done:false});
   }
  };
  addBar('intro',1,[0,0],null,0);addBar('intro',1,[0,0],null,0);
  for(const [sec,key,m0,m1] of TAKT_SONG)for(let b=0;b<4;b++)
   addBar(sec,m0+(m1-m0)*b/3,TAKT_ROOTS[b].map(r=>r+key),TAKT_THEME[b].map(([e,s,l])=>[e,s+key,l]),key,b===3);
  const mEnd=TAKT_SONG[TAKT_SONG.length-1][3];
  for(let b=0;b<2;b++)addBar('outro',mEnd,TAKT_OUTRO_ROOTS[b],TAKT_OUTRO[b],0,b===1);
  this.notes=notes;this.slots=slots;this.end=t+.8;
 },
 // The band, one eighth note at a time, scheduled a little ahead on the audio clock.
 playSlot(s,at){
  const m=this.mult(),r=s.row,root=taktRoot(s.roots[s.e<4?0:1]);
  for(const a of s.auto)lead(a.f,Math.max(.2,a.len*.9),at,.14); // tune notes the band plays for you (level 1)
  if(s.sec==='intro'){
   if(s===this.slots[s.e]){if(s.e%2===0)drum.stick(at);return;}   // count-in: 1, 2, 3, 4 on the sticks
   if(s.e===0||s.e===4)drum.kick(at);if(s.e===2||s.e===6)drum.snare(at);
   if(s.e>=5)drum.snare(at,.14+.04*(s.e-5));
   drum.hat(at);chug(root,at,r*.85,true);bassNote(root,at,r*.85);
   return;
  }
  if(s.sec==='outro'){
   if(s.e===0||(s.e===4&&!s.last)){
    const len=s.last?r*16:r*3.5;
    drum.crash(at);drum.kick(at);chug(root,at,len,false);bassNote(root,at,len);
   }
   if(!s.last&&s.e===6)drum.snare(at);
   return;
  }
  const loud=s.sec!=='verse',fast=s.sec==='fast';
  // Drums
  if(s.e===0||s.e===4||(loud&&s.e===3)||(m>=4&&s.e===7))drum.kick(at);
  if(s.e===2||s.e===6)drum.snare(at);
  if(s.last&&s.e>=4){drum.tom([330,262,196,147][s.e-4],at);if(m>=3)drum.snare(at+r/2,.12);}
  else if(loud&&s.e%2===1)drum.open(at);else drum.hat(at);
  if(m>=3)drum.hat(at+r/2,.04);
  if(s.e===0&&(fast||(m>=3&&loud)||s===this.firstOf(s.sec)))drum.crash(at);
  // Bass: eighths on the root, octave jumps when the band is going hard
  bassNote((fast||m>=3)&&s.e%2===1?root*2:root,at,r*.85);
  // Rhythm guitar: palm-muted chugs, ringing power chords when it gets loud (the chord changes every half bar)
  if(loud&&m>=2){if(s.e===0||s.e===4)chug(root,at,r*3.8,false);}
  else chug(root,at,r*.8,true);
  // ×4: a sparkling arpeggio on top
  if(m>=4){for(let k=0;k<2;k++){const f=root*4*Math.pow(2,[0,7,12,7][(s.e*2+k)%4]/12);tone(f,f,r*.45,'triangle',.03,at+k*r/2);}}
 },
 firstOf(sec){if(!this._first){this._first={};for(const s of this.slots)if(!this._first[s.sec])this._first[s.sec]=s;}return this._first[sec];},
 update(dt,now){
  if(this.phase==='over')return;
  if(audioReady()){
   // Line the audio clock up with the game clock, minus the speaker delay so the sound lands with the lights.
   if(this.audioOff===null)this.audioOff=audioNow()-now-(ctx.outputLatency||ctx.baseLatency||0);
   while(this.nextSlot<this.slots.length&&this.slots[this.nextSlot].time<now+.12){
    const s=this.slots[this.nextSlot++];
    if(s.time>=now-.03)this.playSlot(s,s.time+this.audioOff);
   }
  }
  while(this.visSlot<this.slots.length&&this.slots[this.visSlot].time<=now){const s=this.slots[this.visSlot++];if(s.e%2===0){this.beatAt=s.time;this.beatRow=s.row;}}
  for(const n of this.notes)if(!n.done&&now-n.time>.15){n.done=true;this.combo=0;this.missAt[n.lane]=now;clunk();}
  // Long notes being held
  for(let l=0;l<8;l++){
   const n=this.holding[l];if(!n)continue;
   this.score+=dt*60*this.mult();
   if(now>=n.end){n.stop();n.held=true;this.holding[l]=null;this.flash.push({lane:l,at:now,perfect:true});this.score+=50*this.mult();}
  }
  if(now>this.end){
   this.score=Math.round(this.score);
   const total=this.notes.length||1;this.passed=this.hits/total>=.7;
   const best=saveBest(this.id,this.score);
   gameOver(this,this.score,best?COL.gold:this.passed?COL.green:COL.pink,now);this.passed||best?sfx.win():sfx.over();
  }
 },
 mult(){return Math.min(4,1+Math.floor(this.combo/8));},
 input(ev,now){
  if(this.phase==='over'){
   if(ev.kind==='pad'&&ev.down&&now-this.overAt>1){this.carry=this.passed?Math.min(this.lv+1,TAKT_LEVELS.length-1):this.lv;this.start(now);sfx.start();}
   return;
  }
  if(ev.kind!=='pad'||ev.y<6)return;
  const lane=ev.x-this.L.x0;
  if(lane<0||lane>=this.L.lanes)return;
  if(!ev.down){ // letting go: a long note let go of too early breaks the streak
   this.down[lane].delete(ev.y);
   const n=this.holding[lane];
   if(n&&!this.down[lane].size){n.stop();this.holding[lane]=null;if(now<n.end-.12){n.broken=true;this.combo=0;this.missAt[lane]=now;}else n.held=true;}
   return;
  }
  this.down[lane].add(ev.y);
  if(this.holding[lane])return;
  this.laneAt[lane]=now;
  let best=null,bd=.15;
  for(const n of this.notes){if(n.done||n.lane!==lane)continue;const d=Math.abs(n.time-now);if(d<bd){bd=d;best=n;}}
  if(!best){this.combo=0;clunk();return;}
  best.done=true;this.combo++;this.hits++;this.maxCombo=Math.max(this.maxCombo,this.combo);
  const perfect=bd<.06;
  this.score+=(perfect?100:50)*this.mult();
  this.flash.push({lane,at:now,perfect});
  if(best.hold){best.stop=leadHold(best.f);best.holdAt=now;this.holding[lane]=best;}
  else lead(best.f,.35);
 },
 draw(now){
  if(this.phase==='over'){
   drawOver(this,now);
   // Up a level: the new number of lanes lights up on the top row
   if(this.passed&&now-this.overAt>1){const n=TAKT_LEVELS[Math.min(this.lv+1,TAKT_LEVELS.length-1)].lanes;for(let i=0;i<Math.min(7,n);i++)topLed(i,COL.gold,.5+.5*pulse(now,2));}
   return;
  }
  const L=this.L,m=this.mult(),beat=now>this.end-.8?0:Math.max(0,1-(now-this.beatAt)/(2*this.beatRow)*1.6); // 1 on every beat, fading
  // Speakers outside the lanes: pump with the beat, taller and hotter with the multiplier, rainbow flames at ×4
  const mc=[COL.cyan,COL.green,COL.yellow,COL.pink][m-1];
  for(let x=0;x<8;x++){
   if(x>=L.x0&&x<L.x0+L.lanes)continue;
   const h=(m*2)*(.35+.65*beat);
   for(let j=0;j<8;j++){const a=Math.max(0,Math.min(1,h-j));if(a>0)px(x,7-j,m===4?hue(wrap01(j/10+now*.6+x*.1)):mc,a*(.25+.55*beat));}
  }
  // Frets on the bottom row (always faintly lit), brighter where you press
  for(let l=0;l<L.lanes;l++){
   const x=L.x0+l,c=L.cols[l],pressed=now-this.laneAt[l]<.12||this.down[l].size>0,miss=now-this.missAt[l]<.25;
   px(x,7,miss?COL.red:c,miss?.9:pressed?.8:.3+.15*beat);
   px(x,6,c,pressed?.3:.05);
  }
  // Falling notes: y = 7 when it is time to hit. Long notes have a tail up to where they end.
  const yAt=time=>7-(time-now)*this.speed;
  for(const n of this.notes){
   const x=L.x0+n.lane,c=L.cols[n.lane],holding=this.holding[n.lane]===n;
   if(n.hold&&(!n.done||holding)){
    const top=Math.max(-1,Math.round(yAt(n.end))),bottom=holding?7:Math.round(yAt(n.time))-1;
    for(let y=top;y<=Math.min(7,bottom);y++)px(x,y,c,holding?.55+.25*pulse(now+y*.1,4):.38);
    if(holding){px(x,7,mix(c,COL.white,.5+.5*pulse(now,6)));continue;}
   }
   if(n.done)continue;
   const y=yAt(n.time);
   if(y<-1||y>7.6)continue;
   const yi=Math.round(y);px(x,yi,c);if(!n.hold)px(x,yi-1,c,.2);
  }
  // Hits: the fret flashes white and a spark shoots up the lane
  this.flash=this.flash.filter(f=>now-f.at<.35);
  for(const f of this.flash){
   const k=(now-f.at)/.35,a=1-k,x=L.x0+f.lane,c=L.cols[f.lane];
   px(x,7,COL.white,a);px(x,Math.round(6-k*6),f.perfect?COL.white:c,a*.8);
   if(f.perfect){px(x-1,7,c,a*.6);px(x+1,7,c,a*.6);}
  }
  // Song progress on top, streak meter on the right (fills from the bottom, colour shows the multiplier)
  topBar(Math.max(0,Math.min(1,(now-this.t0)/(this.end-this.t0))),COL.purple);
  const fillN=m===4?8:this.combo%8;
  for(let i=0;i<fillN;i++)sideLed(7-i,mc,m===4?.6+.4*pulse(now,4):1);
 },
 hud(){
  const lvl=`Nivå ${this.lv+1} (${this.L.lanes} filer)`;
  if(this.phase==='over'){
   const total=this.notes.length||1,pct=Math.round(100*this.hits/total);
   const next=this.passed?(this.lv+1<TAKT_LEVELS.length?` Klarat! Tryck på plattan för nivå ${this.lv+2}.`:' Klarat högsta nivån!'):' Träffa 70 % för nästa nivå – tryck för att försöka igen.';
   return `${lvl} · poäng ${this.score} · träffar ${pct} % · längsta serie ${this.maxCombo}.${next}`;
  }
  const held=this.holding.some(n=>n)?' · håll kvar!':'';
  return `I bergakungens sal · ${lvl} · poäng ${Math.round(this.score)} · serie ${this.combo} · ×${this.mult()}${held}`;
 },
 demo(t){
  const L=TAKT_LEVELS[0],beat=Math.max(0,1-(t%.6)/.6*1.6);
  for(const x of [0,1,6,7])for(let j=0;j<4;j++){const a=Math.max(0,Math.min(1,4*(.35+.65*beat)-j));if(a>0)px(x,7-j,COL.cyan,a*(.25+.5*beat));}
  // The first bar of the tune falling down the four lanes, the last note with a tail
  const tune=TAKT_THEME[0],cyc=(t*3.2)%14;
  for(const [e,s,len] of tune){
   const l=Math.floor(TAKT_RANK.indexOf(s)*4/TAKT_RANK.length),x=L.x0+l,c=L.cols[l],y=Math.round(cyc-e);
   if(len>1)for(let k=1;k<=len*1.5;k++)if(y-k>=0&&y-k<=7)px(x,y-k,c,.38);
   if(y>=0&&y<=7)px(x,y,y===7?COL.white:c);
  }
  for(let l=0;l<4;l++)px(L.x0+l,7,L.cols[l],.3);
 }
};


// =====================================================================
// MULLVAD – whack-a-mole. 30 seconds. Green +1, gold +5, red −3.
// =====================================================================
const Mullvad={
 id:'mullvad',name:'Mullvad',color:COL.green,
 how:'Slå på mullvadarna innan de slocknar. Du har 30 sekunder.',
 legend:[[COL.green,'Grön = 1 poäng'],[COL.gold,'Guld = 5 poäng'],[COL.red,'Röd = minus 3 poäng – rör inte!']],
 length:30,
 // Before every round the pads show what each colour is worth: green 1, gold 5, red −3, then 3-2-1.
 intro:[[COL.green,'1'],[COL.gold,'5'],[COL.red,'-3']],introCard:1.3,
 start(now){this.phase='intro';this.introAt=now;this.score=0;this.moles=[];this.fx=[];this.redAt=-9;this.lastCard=-1;},
 introLength(){return this.intro.length*this.introCard+1.8;},
 spawn(now){
  const k=(now-this.t0)/this.length;
  const free=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!this.moles.some(m=>m.x===x&&m.y===y))free.push([x,y]);
  if(!free.length)return;
  const [x,y]=free[rnd(free.length)],r=Math.random(),el=now-this.t0;
  const type=el>4&&r<.07?'gold':el>7&&r<.07+.2*Math.min(1,(el-7)/10)?'red':'green';
  const life=lerp(1.7,.85,k)*(type==='red'?1.6:type==='gold'?.7:1);
  this.moles.push({x,y,type,born:now,life});
 },
 update(dt,now){
  if(this.phase==='over')return;
  if(this.phase==='intro'){
   const t=now-this.introAt,card=Math.floor(t/this.introCard),cd=Math.floor((t-this.intro.length*this.introCard)/.6);
   const step=card<this.intro.length?card:this.intro.length+cd;
   if(step!==this.lastCard){this.lastCard=step;if(card<this.intro.length)this.intro[card][1]==='-3'?sfx.bad():sfx.hit(card*3);else if(cd<3)sfx.tick();}
   if(t>=this.introLength()){this.phase='play';this.t0=now;this.spawnAt=now+.3;sfx.start();}
   return;
  }
  const k=(now-this.t0)/this.length;
  if(now>=this.spawnAt){
   this.spawn(now);if(k>.5&&Math.random()<.35)this.spawn(now);
   this.spawnAt=now+lerp(.8,.33,k)*(.7+Math.random()*.6);
  }
  this.moles=this.moles.filter(m=>now-m.born<m.life);
  if(k>=1){
   const best=saveBest(this.id,this.score);
   gameOver(this,this.score,best?COL.gold:COL.green,now);best?sfx.win():sfx.over();
  }
 },
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(ev.kind!=='pad'||!ev.down||this.phase!=='play')return;
  const i=this.moles.findIndex(m=>m.x===ev.x&&m.y===ev.y);if(i<0)return;
  const m=this.moles[i];this.moles.splice(i,1);
  if(m.type==='red'){this.score=Math.max(0,this.score-3);this.redAt=now;sfx.bad();}
  else{this.score+=m.type==='gold'?5:1;m.type==='gold'?sfx.gold():sfx.hit(this.score%10);}
  this.fx.push({x:m.x,y:m.y,at:now,type:m.type});
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  if(this.phase==='intro'){
   const t=now-this.introAt,card=Math.floor(t/this.introCard);
   if(card<this.intro.length){
    // The points in big digits on top, a bar of that colour along the bottom
    const [c,pts]=this.intro[card],lt=t-card*this.introCard,a=Math.min(1,lt/.15);
    drawText(pts,Math.floor((8-textWidth(pts))/2),0,c,a);
    for(let y=6;y<8;y++)for(let x=0;x<8;x++)px(x,y,c,a*(.55+.45*pulse(now,3)));
    for(let i=0;i<this.intro.length;i++)topLed(i,this.intro[i][0],i===card?1:.15);
   }else{
    const cd=Math.floor((t-this.intro.length*this.introCard)/.6);
    if(cd<3)drawBigNumber(3-cd,COL.white,1,0);
   }
   return;
  }
  if(now-this.redAt<.3)fill(COL.red,.35*(1-(now-this.redAt)/.3));
  for(const m of this.moles){
   const age=(now-m.born)/m.life,a=Math.min(1,(now-m.born)/.08)*(age>.65?1-(age-.65)/.35*.8:1);
   const c=m.type==='gold'?COL.gold:m.type==='red'?COL.red:COL.green;
   px(m.x,m.y,c,a);
  }
  this.fx=this.fx.filter(f=>now-f.at<.35);
  for(const f of this.fx){
   const a=1-(now-f.at)/.35,c=f.type==='gold'?COL.gold:f.type==='red'?COL.red:COL.white;
   px(f.x,f.y,COL.white,a);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])px(f.x+dx,f.y+dy,c,a*.5);
  }
  const left=1-(now-this.t0)/this.length;
  topBar(left,left<.25?COL.red:left<.5?COL.yellow:COL.green);
 },
 hud(){return this.phase==='over'?`Du fick ${this.score} poäng`:this.phase==='intro'?'Grön 1 · guld 5 · röd minus 3. Snart kör vi!':`Poäng ${this.score}`;},
 demo(t){
  for(let i=0;i<5;i++){
   const s=Math.floor(t*2+i*.37)*5+i,age=(t*2+i*.37)%1,h=(s*2654435761)>>>0;
   px(h%8,(h>>>5)%8,s%11===0?COL.gold:s%7===0?COL.red:COL.green,1-age*.85);
  }
 }
};


// =====================================================================
// MINNE – a pattern lights up, then goes dark. Press the same pads. One more pad every level.
// =====================================================================
const Minne={
 id:'minne',name:'Minne',color:COL.purple,
 how:'Ett mönster lyser en kort stund. Tryck sedan på samma knappar. Varje nivå blir ett ljus större. Ett fel och det är slut.',
 start(now){this.phase='play';this.level=1;this.round(now);},
 round(now){
  const n=Math.min(2+this.level,24),cells=new Set();
  while(cells.size<n)cells.add(rnd(8)+rnd(8)*8);
  this.cells=cells;this.found=new Set();this.step='show';this.stepAt=now;
  this.showFor=Math.max(.9,1.1+n*.12-(this.level>6?(this.level-6)*.08:0));
  this.wrong=null;
 },
 update(dt,now){
  if(this.phase==='over')return;
  const t=now-this.stepAt;
  if(this.step==='show'&&t>this.showFor){this.step='gap';this.stepAt=now;}
  else if(this.step==='gap'&&t>.35){this.step='input';this.stepAt=now;}
  else if(this.step==='good'&&t>1){this.level++;this.round(now);}
  else if(this.step==='bad'&&t>1.6){
   const reached=this.level-1,best=saveBest(this.id,reached);
   gameOver(this,reached,best?COL.gold:COL.purple,now);best?sfx.win():sfx.over();
  }
 },
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(ev.kind!=='pad'||!ev.down||this.step!=='input')return;
  const k=ev.x+ev.y*8;
  if(this.found.has(k))return;
  if(this.cells.has(k)){
   this.found.add(k);sfx.hit(this.found.size);
   if(this.found.size===this.cells.size){this.step='good';this.stepAt=now;setTimeout(sfx.win,120);}
  }else{this.wrong=k;this.step='bad';this.stepAt=now;sfx.bad();}
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  const t=now-this.stepAt,each=(fn)=>{for(const k of this.cells)fn(k%8,Math.floor(k/8),k);};
  if(this.step==='show'){
   const a=Math.min(1,t/.12);each((x,y)=>px(x,y,COL.cyan,a));
   topBar(1-t/this.showFor,COL.cyan);
  }else if(this.step==='input'){
   each((x,y,k)=>{if(this.found.has(k))px(x,y,COL.purple);});
  }else if(this.step==='good'){
   each((x,y)=>px(x,y,COL.green,1-Math.max(0,t-.6)/.4));
   const r=t*12;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const d=Math.hypot(x-3.5,y-3.5);if(Math.abs(d-r)<.8)px(x,y,COL.green,.5);}
  }else if(this.step==='bad'){
   each((x,y,k)=>px(x,y,this.found.has(k)?COL.purple:COL.cyan,this.found.has(k)?1:.35));
   if(this.wrong!==null)px(this.wrong%8,Math.floor(this.wrong/8),COL.red,pulse(now,4));
  }
  for(let i=0;i<Math.min(8,this.level-1);i++)sideLed(7-i,COL.purple,.8);
 },
 hud(){
  if(this.phase==='over')return `Du klarade ${this.level-1} nivåer`;
  return `Nivå ${this.level} · ${this.cells.size} ljus att komma ihåg`;
 },
 demo(t){
  const s=Math.floor(t/2.2),k=t%2.2;
  for(let i=0;i<6;i++){const h=((s*7+i*13)*2654435761)>>>0,x=h%8,y=(h>>>4)%8;
   if(k<1)px(x,y,COL.cyan);else if(k>1.3&&k-1.3>i*.12)px(x,y,COL.purple);}
 }
};


// =====================================================================
// PAD-PONG – two players, or you against the computer (Keys on the top row switches). Red owns the bottom
// row, blue the top row. Press the pad (or one next to it) where the ball arrives, just in time. Pressing too
// early wastes your swing for a moment. First to 4. The computer misses more often the faster the ball goes.
// =====================================================================
const PONG_COL=[COL.red,COL.blue];
const PadPong={
 id:'pong',name:'Pad-pong',color:COL.blue,
 how:'Röd har nedersta raden, blå översta. Tryck på knappen där bollen kommer fram – precis när den är där. Knappen bredvid skickar bollen snett. Trycker du för tidigt hinner du inte igen. Först till 4. Keys på översta raden växlar mellan två spelare och en spelare mot datorn (då spelar datorn blå).',
 window:.4,cool:.3,
 start(now){this.mode=this.mode||'two';this.phase='play';this.score=[0,0];this.swings=[[],[]];this.coolUntil=[0,0];this.trail=[];this.serve(rnd(2),now);},
 serve(toward,now){
  this.ball={x:2+rnd(4),y:toward===0?3:4,dx:Math.random()<.5?-1:1,dy:toward===0?1:-1};
  this.interval=.3;this.acc=0;this.step='serve';this.stepAt=now;this.hits=0;this.trail=[];this.cpuSwung=false;
 },
 update(dt,now){
  if(this.phase==='over')return;
  for(let p=0;p<2;p++){ // swings that missed put you on a short cooldown
   const keep=[];for(const s of this.swings[p]){if(now-s.at<=this.window)keep.push(s);else this.coolUntil[p]=now+this.cool;}
   this.swings[p]=keep;
  }
  if(this.step==='serve'){if(now-this.stepAt>.9){this.step='play';this.acc=0;}return;}
  if(this.step==='goal'){
   if(now-this.stepAt>1.2){
    const w=this.score[0]>=4?0:this.score[1]>=4?1:-1;
    if(w>=0){gameOver(this,`${this.score[0]}-${this.score[1]}`,PONG_COL[w],now);this.winner=w;sfx.win();}
    else this.serve(this.scoredBy===0?1:0,now);
   }
   return;
  }
  this.cpu(now);
  this.acc+=dt;
  while(this.acc>=this.interval&&this.step==='play'){this.acc-=this.interval;this.move(now);}
 },
 // The computer (blue): when the ball is one step from the top row it swings where the ball will land –
 // or, now and then, a little off. The faster the rally, the more often it misses.
 cpu(now){
  const b=this.ball;
  if(this.mode!=='cpu'||b.dy>0){this.cpuSwung=false;return;}
  if(this.cpuSwung||b.y!==1)return;
  this.cpuSwung=true;
  let nx=b.x+b.dx;if(nx<0||nx>7)nx=b.x-b.dx;
  const miss=Math.random()<Math.min(.5,.06+this.hits*.025);
  const x=miss?(nx<4?nx+2+rnd(2):nx-2-rnd(2)):Math.max(0,Math.min(7,nx+[-1,0,0,1][rnd(4)]));
  this.swings[1].push({x,at:now});
 },
 move(now){
  const b=this.ball;
  let nx=b.x+b.dx;
  if(nx<0||nx>7){b.dx=-b.dx;nx=b.x+b.dx;sfx.wall();}
  const ny=b.y+b.dy,p=ny===7?0:ny===0?1:-1;
  if(p>=0){
   const i=this.swings[p].findIndex(s=>Math.abs(s.x-nx)<=1);
   if(i>=0){
    const s=this.swings[p][i];this.swings[p].splice(i,1);
    b.dy=-b.dy;b.dx=s.x<nx?1:s.x>nx?-1:(b.dx===0?0:Math.random()<.5?0:b.dx);
    this.trail.push([b.x,b.y]);if(this.trail.length>3)this.trail.shift();b.x=nx;
    this.hits++;this.interval=Math.max(.075,this.interval*.92);this.hitAt=now;this.hitPad=[s.x,ny,p];
    sfx.pong(this.hits%8);return;
   }
   // Goal for the other player
   b.x=nx;b.y=ny;this.scoredBy=1-p;this.score[1-p]++;this.step='goal';this.stepAt=now;sfx.bad();
   return;
  }
  this.trail.push([b.x,b.y]);if(this.trail.length>3)this.trail.shift();
  b.x=nx;b.y=ny;
 },
 input(ev,now){
  if(playersInput(this,ev,now))return;
  if(this.phase==='over')return overInput(this,ev,now);
  if(ev.kind!=='pad'||!ev.down)return;
  const p=ev.y===7?0:ev.y===0?1:-1;if(p<0||(p===1&&this.mode==='cpu'))return;
  if(now<this.coolUntil[p])return;
  this.swings[p].push({x:ev.x,at:now});
 },
 draw(now){
  if(drawPlayers(this,now))return;
  if(this.phase==='over'){
   drawOver(this,now);
   return;
  }
  for(let p=0;p<2;p++){
   const row=p===0?7:0,cool=now<this.coolUntil[p];
   for(let x=0;x<8;x++)px(x,row,cool?COL.grey:PONG_COL[p],cool?.25:.12);
   for(const s of this.swings[p])px(s.x,row,PONG_COL[p],1-(now-s.at)/this.window*.6);
  }
  if(this.hitAt&&now-this.hitAt<.2)px(this.hitPad[0],this.hitPad[1],COL.white,1-(now-this.hitAt)/.2);
  const b=this.ball;
  if(this.step==='goal'){
   const c=PONG_COL[this.scoredBy],row=this.scoredBy===0?0:7,a=pulse(now,5);
   for(let x=0;x<8;x++)px(x,row,c,a);
   px(b.x,b.y,COL.white,a);
  }else{
   this.trail.forEach(([x,y],i)=>px(x,y,COL.white,.08+.1*i));
   px(b.x,b.y,COL.white,this.step==='serve'?pulse(now,4):1);
  }
  // Score: blue from the top of the right column, red from the bottom
  for(let i=0;i<4;i++){
   sideLed(i,COL.blue,i<this.score[1]?1:.06);
   sideLed(7-i,COL.red,i<this.score[0]?1:.06);
  }
 },
 hud(){
  const s=`Röd ${this.score[0]} – ${this.score[1]} Blå${this.mode==='cpu'?' (datorn)':''}`;
  return this.phase==='over'?`${this.winner===0?'Röd':'Blå'} vann! ${s}`:`${playersText(this)} · ${s}`;
 },
 demo(t){
  const k=(t*5)%10,y=1+(k<5?k:10-k),x=Math.floor(t*3.4)%14,bx=x<8?x:14-x;
  for(let i=0;i<8;i++){px(i,0,COL.blue,.12);px(i,7,COL.red,.12);}
  px(bx,Math.round(y),COL.white);
  if(y<1.3)px(bx,0,COL.blue);if(y>5.7)px(bx,7,COL.red);
 }
};

// =====================================================================
// FÄRGMINNE – the grid is four coloured boards (like the old Simon game). They light up in an order;
// press them back in the same order. Before each level the level number lights up big on the pads.
// =====================================================================
const FM_COL=[COL.green,COL.red,COL.yellow,COL.blue];   // top-left, top-right, bottom-left, bottom-right
const FM_HZ=[329.6,440,277.2,220];
const fmQuad=(x,y)=>(y<4?0:2)+(x<4?0:1);
function fmFill(q,c,a){const ox=(q%2)*4,oy=q<2?0:4;for(let y=0;y<4;y++)for(let x=0;x<4;x++)px(ox+x,oy+y,c,a);}
const Fargminne={
 id:'fargminne',name:'Färgminne',color:COL.yellow,
 how:'Plattan är fyra färgade fält. De lyser upp ett i taget i en viss ordning. Tryck sedan på fälten i samma ordning. Första nivån är tre färger, och varje nivå blir ordningen ett steg längre.',
 legend:[[COL.green,'Grön'],[COL.red,'Röd'],[COL.yellow,'Gul'],[COL.blue,'Blå']],
 start(now){this.phase='play';this.seq=[rnd(4),rnd(4)];this.level=0;this.press=null;this.next(now);},
 levelFor:.85, // how long the level number is shown (it lights up in .2 s and fades out the last .2 s)
 next(now){
  this.level++;this.seq.push(rnd(4));this.pos=0;this.wrong=-1;this.shown=-1;
  this.step='level';this.stepAt=now;
  [0,2,4].forEach((n,i)=>tone(scaleHz(n+5+this.level%5),scaleHz(n+5+this.level%5),.16,'square',.07,audioNow()+.08+i*.12));
 },
 timing(){return {on:.8*Math.max(.28,.6-this.level*.025),gap:.8*Math.max(.1,.2-this.level*.007)};}, // 20 % faster than the first version
 beep(q,dur=.3){tone(FM_HZ[q],FM_HZ[q],dur,'square',.09);},
 update(dt,now){
  if(this.phase==='over')return;
  const t=now-this.stepAt;
  if(this.step==='level'&&t>this.levelFor){this.step='pause';this.stepAt=now;}
  else if(this.step==='pause'&&t>.2){this.step='show';this.stepAt=now;}
  else if(this.step==='show'){
   const {on,gap}=this.timing(),i=Math.floor(t/(on+gap));
   if(i>=this.seq.length){this.step='input';this.stepAt=now;}
   else if(i!==this.shown&&t-i*(on+gap)<on){this.shown=i;this.beep(this.seq[i],on);}
  }
  else if(this.step==='good'&&t>.8)this.next(now);
  else if(this.step==='bad'&&t>1.8){
   const reached=this.level-1,best=saveBest(this.id,reached);
   gameOver(this,reached,best?COL.gold:COL.yellow,now);best?sfx.win():sfx.over();
  }
 },
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(ev.kind!=='pad'||!ev.down||this.step!=='input')return;
  const q=fmQuad(ev.x,ev.y);this.press={q,at:now};
  if(q===this.seq[this.pos]){
   this.beep(q,.25);this.pos++;
   if(this.pos===this.seq.length){this.step='good';this.stepAt=now;}
  }else{this.wrong=q;this.step='bad';this.stepAt=now;sfx.bad();}
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  const t=now-this.stepAt;
  if(this.step==='level'){
   // Only the level number, white on black: lights up from the left, then fades out quickly
   const out=Math.max(0,Math.min(1,(this.levelFor-t)/.2));
   drawBigNumber(this.level,COL.white,Math.min(1,t/.2),0);
   if(out<1)fill(BLACK,1-out);
   return;
  }
  for(let q=0;q<4;q++)fmFill(q,FM_COL[q],this.step==='pause'?.14*Math.min(1,t/.2):.14);
  if(this.step==='show'){
   const {on,gap}=this.timing(),i=Math.floor(t/(on+gap)),lt=t-i*(on+gap);
   if(i<this.seq.length&&lt<on)fmFill(this.seq[i],FM_COL[this.seq[i]],1);
  }else if(this.step==='good'){
   for(let q=0;q<4;q++)fmFill(q,FM_COL[q],.25+.5*pulse(now,4));
  }else if(this.step==='bad'){
   fmFill(this.wrong,COL.red,pulse(now,5));
   const want=this.seq[this.pos];if(want!==this.wrong)fmFill(want,FM_COL[want],.5+.5*pulse(now,2.5));
  }
  if(this.press&&now-this.press.at<.25&&this.step!=='bad')fmFill(this.press.q,FM_COL[this.press.q],1-(now-this.press.at)/.25*.6);
  // Right column: how far into the order you are
  if(this.step==='input'||this.step==='good'){const n=Math.min(8,this.seq.length);for(let i=0;i<n;i++)sideLed(7-i,COL.white,i<this.pos*n/this.seq.length?.9:.08);}
 },
 hud(){
  if(this.phase==='over')return `Du klarade ${this.level-1} nivåer`;
  if(this.step==='input')return `Nivå ${this.level} · din tur: ${this.pos} av ${this.seq.length}`;
  return `Nivå ${this.level} · titta noga…`;
 },
 demo(t){
  for(let q=0;q<4;q++)fmFill(q,FM_COL[q],.14);
  const order=[0,3,1,2,1,0],k=t%(order.length*.6+1.2),i=Math.floor(k/.6);
  if(i<order.length&&k-i*.6<.42)fmFill(order[i],FM_COL[order[i]],1);
 }
};

// =====================================================================
// RYMDFÖRSVAR – shoot the things coming down at you. Press a pad on the bottom row to fire up that column.
// The round buttons on the right are your weapons, each in its own colour (the shots have the same colour).
// A new weapon unlocks at the start of waves 2–5; it blinks white until you pick it.
// Something reaching the bottom row costs a life (red lights top left). Three lives.
// =====================================================================
const RF_WEAPONS=[
 {name:'Laser',col:COL.green,cool:.16,speed:.045,shots:[[0,0]],dmg:1,info:'ett snabbt skott rakt upp'},
 {name:'Trippel',col:COL.cyan,cool:.3,speed:.05,shots:[[-1,0],[0,0],[1,0]],dmg:1,info:'tre skott bredvid varandra'},
 {name:'Solfjäder',col:COL.yellow,cool:.32,speed:.06,shots:[[0,-1],[0,0],[0,1]],dmg:1,info:'tre skott som sprids snett'},
 {name:'Raket',col:COL.orange,cool:.7,speed:.09,shots:[[0,0]],dmg:2,blast:1,info:'långsam, sprängs över en ruta åt alla håll'},
 {name:'Blixt',col:COL.purple,cool:1.4,beam:true,dmg:3,info:'träffar hela kolumnen på en gång'}
];
// The things coming at you: colour shows what they are.
const RF_FOES={
 drone:{col:COL.red,hp:1,pts:10,step:1},
 tank:{col:COL.pink,hp:3,pts:30,step:1.3},   // gets dimmer for every hit
 dart:{col:COL.white,hp:1,pts:20,step:.5}     // fast
};
const Rymd={
 id:'rymd',name:'Rymdförsvar',color:COL.cyan,
 how:'Saker kommer ner mot dig. Tryck på en knapp i nedersta raden för att skjuta uppåt i den kolumnen. Knapparna i högerkolumnen är vapnen – ett nytt låses upp varje våg och blinkar vitt tills du väljer det. Kommer något ända ner förlorar du ett liv. Du har tre.',
 legend:[[COL.red,'Röd = vanlig (1 träff)'],[COL.pink,'Rosa = pansar (3 träffar)'],[COL.white,'Vit = snabb'],
  ...RF_WEAPONS.map(w=>[w.col,`${w.name}: ${w.info}`])],
 start(now){
  this.phase='play';this.score=0;this.lives=3;this.wave=0;this.weapon=0;this.unlocked=1;this.fresh=-1;
  this.foes=[];this.shots=[];this.fx=[];this.beams=[];this.coolUntil=0;this.hurtAt=-9;this.fireAt=-9;this.fireX=0;
  this.nextWave(now);
 },
 nextWave(now){
  this.wave++;
  if(this.wave>=2&&this.unlocked<RF_WEAPONS.length){this.fresh=this.unlocked;this.unlocked++;}
  this.toSpawn=5+this.wave*3;this.step='wave';this.stepAt=now;this.spawnAt=now+1.4;
  sfx.start();
 },
 spawn(now){
  const w=this.wave,r=Math.random();
  const kind=w>=3&&r<.2?'dart':w>=2&&r<.42?'tank':'drone',f=RF_FOES[kind];
  const free=[...Array(8).keys()].filter(x=>!this.foes.some(e=>e.x===x&&e.y<1));
  if(!free.length)return false;
  this.foes.push({kind,x:free[rnd(free.length)],y:0,hp:f.hp,moveAt:now+this.stepTime()*f.step,hitAt:-9});
  return true;
 },
 stepTime(){return Math.max(.32,1.05-this.wave*.08);},
 hit(e,dmg,now){
  e.hp-=dmg;e.hitAt=now;
  if(e.hp<=0){
   this.foes.splice(this.foes.indexOf(e),1);this.score+=RF_FOES[e.kind].pts;
   this.fx.push({x:e.x,y:e.y,at:now,col:RF_FOES[e.kind].col});sfx.hit(this.score/10%10);
  }else tone(500,400,.05,'square',.06);
 },
 foeAt(x,y){return this.foes.find(e=>e.x===x&&e.y===y);},
 fire(x,now){
  const w=RF_WEAPONS[this.weapon];
  if(now<this.coolUntil)return;
  this.coolUntil=now+w.cool;this.fireAt=now;this.fireX=x;
  if(w.beam){
   this.beams.push({x,at:now});tone(1200,200,.35,'sawtooth',.1);
   for(const e of this.foes.filter(e=>e.x===x))this.hit(e,w.dmg,now);
   return;
  }
  for(const [dx,vx] of w.shots){const sx=x+dx;if(sx<0||sx>7)continue;this.shots.push({x:sx,y:7,vx,w:this.weapon,moveAt:now});}
  w.blast?tone(180,90,.25,'sawtooth',.1):tone(1400,700,.07,'square',.06);
 },
 update(dt,now){
  if(this.phase==='over')return;
  if(this.step==='wave'){if(now-this.stepAt>1.4)this.step='play';else return;}
  // New foes
  if(this.toSpawn>0&&now>=this.spawnAt&&this.spawn(now)){this.toSpawn--;this.spawnAt=now+Math.max(.45,1.5-this.wave*.12)*(.6+Math.random()*.8);}
  // Shots fly up one row at a time and hit whatever is in the pad they enter
  for(const s of [...this.shots]){
   const w=RF_WEAPONS[s.w];
   while(now>=s.moveAt&&this.shots.includes(s)){
    s.moveAt+=w.speed;s.y--;s.x+=s.vx;
    if(s.y<0||s.x<0||s.x>7){this.shots.splice(this.shots.indexOf(s),1);break;}
    const e=this.foeAt(s.x,s.y);
    if(e){
     this.shots.splice(this.shots.indexOf(s),1);
     if(w.blast){
      this.fx.push({x:s.x,y:s.y,at:now,col:w.col,big:true});noise(.3,300,.2,0,'lowpass');
      for(const o of this.foes.filter(o=>Math.abs(o.x-s.x)<=1&&Math.abs(o.y-s.y)<=1))this.hit(o,w.dmg,now);
     }else this.hit(e,w.dmg,now);
    }
   }
  }
  // Foes step down
  for(const e of [...this.foes]){
   if(now<e.moveAt)continue;
   e.moveAt=now+this.stepTime()*RF_FOES[e.kind].step;e.y++;
   const s=this.shots.find(s=>s.x===e.x&&s.y===e.y);
   if(s){this.shots.splice(this.shots.indexOf(s),1);this.hit(e,RF_WEAPONS[s.w].dmg,now);continue;}
   if(e.y>=7){
    this.foes.splice(this.foes.indexOf(e),1);this.lives--;this.hurtAt=now;sfx.bad();
    if(this.lives<=0){const best=saveBest(this.id,this.score);gameOver(this,this.score,best?COL.gold:COL.cyan,now);best?sfx.win():sfx.over();return;}
   }
  }
  if(this.toSpawn===0&&!this.foes.length){this.shots=[];this.nextWave(now);}
 },
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(!ev.down)return;
  if(ev.kind==='side'){
   if(ev.i<this.unlocked){this.weapon=ev.i;if(this.fresh===ev.i)this.fresh=-1;sfx.menu();}
   else tone(150,150,.08,'square',.05);
   return;
  }
  if(ev.kind==='pad'&&ev.y===7&&this.step==='play')this.fire(ev.x,now);
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  const w=RF_WEAPONS[this.weapon];
  // Weapons on the right: locked = dark, unlocked = dim in its colour, chosen = bright, new = blinks white
  RF_WEAPONS.forEach((v,i)=>{
   if(i>=this.unlocked)return;
   if(i===this.fresh&&Math.floor(now*3)%2)sideLed(i,COL.white);
   else sideLed(i,v.col,i===this.weapon?1:.2);
  });
  // Lives on the top row (red), then how many are left in the wave (dim)
  for(let i=0;i<3;i++)topLed(i,COL.red,i<this.lives?1:.06);
  if(this.step==='wave'){
   const t=now-this.stepAt;
   drawBigNumber(this.wave,COL.cyan,Math.min(1,t/.25),0);
   if(this.fresh>=0){const c=RF_WEAPONS[this.fresh].col;for(let x=0;x<8;x++)px(x,7,c,.5+.5*pulse(now,4));}
   return;
  }
  // Bottom row: your cannons, in the weapon's colour. Dimmer while reloading.
  const ready=now>=this.coolUntil;
  for(let x=0;x<8;x++)px(x,7,w.col,ready?.35:.1);
  if(now-this.fireAt<.12)px(this.fireX,7,COL.white,1-(now-this.fireAt)/.12);
  // Foes
  for(const e of this.foes){
   const f=RF_FOES[e.kind],a=e.kind==='tank'?.35+.65*e.hp/f.hp:1;
   px(e.x,e.y,now-e.hitAt<.08?COL.white:f.col,a);
   if(e.y>=5)px(e.x,e.y,COL.red,.3*pulse(now,6)); // close to the bottom: warning
  }
  // Shots, with a short tail
  for(const s of this.shots){const c=RF_WEAPONS[s.w].col;px(s.x,s.y,c);px(s.x-s.vx,s.y+1,c,.25);}
  // Lightning beams
  this.beams=this.beams.filter(b=>now-b.at<.3);
  for(const b of this.beams)for(let y=0;y<7;y++)px(b.x,y,Math.random()<.5?COL.white:COL.purple,1-(now-b.at)/.3);
  // Explosions
  this.fx=this.fx.filter(f=>now-f.at<(f.big?.45:.3));
  for(const f of this.fx){
   const k=(now-f.at)/(f.big?.45:.3),a=1-k;
   px(f.x,f.y,COL.white,a);
   const r=f.big?1:0;
   for(let dy=-1-r;dy<=1+r;dy++)for(let dx=-1-r;dx<=1+r;dx++)if(dx||dy)px(f.x+dx,f.y+dy,f.col,a*(f.big?.7:.4)*(Math.abs(dx)+Math.abs(dy)<=1+r?1:.5));
  }
  if(now-this.hurtAt<.35)fill(COL.red,.4*(1-(now-this.hurtAt)/.35));
 },
 hud(){
  if(this.phase==='over')return `Du nådde våg ${this.wave} och fick ${this.score} poäng`;
  const w=RF_WEAPONS[this.weapon];
  if(this.step==='wave')return `Våg ${this.wave}`+(this.fresh>=0?` · nytt vapen: ${RF_WEAPONS[this.fresh].name} (${RF_WEAPONS[this.fresh].info}) – tryck på den blinkande knappen till höger`:'');
  return `Våg ${this.wave} · poäng ${this.score} · liv ${this.lives} · vapen: ${w.name}`;
 },
 demo(t){
  for(let x=0;x<8;x++)px(x,7,COL.green,.3);
  for(let i=0;i<4;i++){
   const cyc=2.4,k=((t+i*.6)%cyc)/cyc,x=[1,5,3,6][i],hy=Math.floor(k*5);
   if(k<.7){px(x,Math.floor(k/.7*4),RF_FOES[i===2?'tank':'drone'].col);const sy=7-Math.floor(Math.max(0,k-.4)/.3*4);if(k>.4)px(x,sy,COL.green);}
   else{const a=1-(k-.7)/.3;px(x,3,COL.white,a);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])px(x+dx,3+dy,COL.red,a*.5);}
  }
  RF_WEAPONS.forEach((v,i)=>sideLed(i,v.col,Math.floor(t*1.5)%RF_WEAPONS.length===i?1:.2));
 }
};

// =====================================================================
// Mazes, shared by Ficklampan and Minneslabyrinten. 1 = wall, 0 = floor.
// =====================================================================
const DIR4=[[1,0],[-1,0],[0,1],[0,-1]];
// A perfect maze of cw × ch rooms on a (2cw+1) × (2ch+1) tile grid: exactly one way between any two tiles.
function carveMaze(cw,ch){
 const W=cw*2+1,H=ch*2+1,g=new Uint8Array(W*H).fill(1),seen=new Uint8Array(cw*ch),stack=[[0,0]];
 seen[0]=1;g[W+1]=0;
 while(stack.length){
  const [cx,cy]=stack[stack.length-1];
  const n=DIR4.map(([dx,dy])=>[cx+dx,cy+dy,dx,dy]).filter(([x,y])=>x>=0&&y>=0&&x<cw&&y<ch&&!seen[y*cw+x]);
  if(!n.length){stack.pop();continue;}
  const [nx,ny,dx,dy]=n[rnd(n.length)];seen[ny*cw+nx]=1;
  g[(cy*2+1+dy)*W+cx*2+1+dx]=0;g[(ny*2+1)*W+nx*2+1]=0;stack.push([nx,ny]);
 }
 return {W,H,g};
}
// Distances from (sx,sy) over floor tiles; block(i) can close extra tiles (doors).
function mazeDist(m,sx,sy,block){
 const {W,H,g}=m,dist=new Int32Array(W*H).fill(-1),prev=new Int32Array(W*H).fill(-1),q=[sy*W+sx];dist[q[0]]=0;
 for(let h=0;h<q.length;h++){
  const i=q[h],x=i%W,y=i/W|0;
  for(const [dx,dy] of DIR4){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;
   const j=ny*W+nx;if(g[j]||dist[j]>=0||(block&&block(j)))continue;
   dist[j]=dist[i]+1;prev[j]=i;q.push(j);
  }
 }
 return {dist,prev};
}
// Which way a press at (x,y) points from (px,py): one step along the bigger difference. Same pad or exact diagonal: null.
function stepToward(px,py,x,y){const dx=x-px,dy=y-py;if(Math.abs(dx)===Math.abs(dy))return null;return Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)];}


// =====================================================================
// FICKLAMPAN – you are a white dot in a dark maze bigger than the pad. The pad is a window that follows you.
// Press a pad next to the dot (or anywhere in that direction) to take one step. Only the walls close to you
// are lit, like a torch. The exit pulses green; when it is outside the window a faint green glow at the edge
// shows which way it is. From level 3 there are coloured keys that open doors of the same colour.
// =====================================================================
const FL_WARM=[1,.78,.42],FL_KEYS=[COL.yellow,COL.blue,COL.red],FL_KEY_NAMES=['gul','blå','röd'];
const FL_OX=3,FL_OY=3; // where you are on the pad
const Ficklampan={
 id:'ficklampan',name:'Ficklampan',color:FL_WARM,
 how:'Du är den vita pricken i en mörk labyrint. Tryck på rutan bredvid pricken för att gå dit. Ficklampan lyser bara upp väggarna närmast dig. Hitta utgången som pulserar grönt – när den är utanför plattan visar ett svagt grönt sken vid kanten åt vilket håll den ligger. Från nivå 3 finns färgade nycklar som öppnar dörrar i samma färg.',
 legend:[[COL.white,'Du'],[COL.green,'Utgången'],[FL_WARM,'Väggar i ficklampans sken'],[COL.yellow,'Nyckel och dörr i samma färg']],
 start(now){this.phase='play';this.level=0;this.next(now);},
 next(now){
  this.level++;
  const c=Math.min(4+this.level,10),m=this.m=carveMaze(c,c); // 11 × 11 pads, growing to 21 × 21
  this.px=1;this.py=1;
  const {dist,prev}=mazeDist(m,1,1);let ex=0;for(let i=0;i<dist.length;i++)if(dist[i]>dist[ex])ex=i;
  this.exit=ex;this.doors=new Map();this.keys=new Map();this.have=new Set();this.opened=[];
  // Doors on the way to the exit (on the tiles between rooms), each key somewhere you can reach before its door
  const nDoors=this.level<3?0:this.level<5?1:this.level<7?2:3,path=[];
  for(let i=ex;i>=0;i=prev[i])path.unshift(i);
  for(let k=0;k<nDoors;k++){
   let j=Math.floor(path.length*(.3+.6*(k+1)/(nDoors+1)));
   while(j<path.length-2&&(this.doors.has(path[j])||(path[j]%m.W)%2&&((path[j]/m.W|0)%2)))j++;
   this.doors.set(path[j],k);
  }
  for(let k=0;k<nDoors;k++){
   const reach=mazeDist(m,1,1,j=>this.doors.has(j)&&this.doors.get(j)>=k).dist,cand=[];
   for(let i=0;i<reach.length;i++)if(reach[i]>3&&!this.doors.has(i)&&!this.keys.has(i))cand.push(i);
   cand.sort((a,b)=>reach[b]-reach[a]);
   this.keys.set(cand[rnd(Math.max(1,Math.ceil(cand.length/3)))],k);
  }
  this.step='in';this.stepAt=now;this.bump=null;this.moves=0;this.beatAt=now+1.5;
  if(this.level>1)sfx.start();
 },
 update(dt,now){
  const t=now-this.stepAt;
  if(this.step==='in'&&t>1.2){this.step='play';this.stepAt=now;}
  else if(this.step==='out'&&t>1.6)this.next(now);
  // A slow, soft heartbeat in the dark
  if(this.step==='play'&&now>=this.beatAt){this.beatAt=now+1.6;const a=audioNow();tone(62,40,.14,'sine',.16,a);tone(58,38,.12,'sine',.11,a+.2);}
 },
 input(ev,now){
  if(ev.kind!=='pad'||!ev.down||this.step!=='play')return;
  const d=stepToward(FL_OX,FL_OY,ev.x,ev.y);if(!d)return;
  const {W,H,g}=this.m,nx=this.px+d[0],ny=this.py+d[1],i=ny*W+nx;
  const hitWall=()=>{this.bump={x:nx,y:ny,at:now};tone(90,60,.1,'square',.08);};
  if(nx<0||ny<0||nx>=W||ny>=H||g[i])return hitWall();
  if(this.doors.has(i)){
   const k=this.doors.get(i);
   if(!this.have.has(k))return hitWall();
   this.doors.delete(i);this.have.delete(k);this.opened.push({i,k,at:now});
   [0,4,7].forEach((n,j)=>tone(scaleHz(n+3),scaleHz(n+3),.14,'triangle',.1,audioNow()+j*.07));
  }
  this.px=nx;this.py=ny;this.moves++;noise(.03,1800,.035,0,'bandpass');
  if(this.keys.has(i)){this.have.add(this.keys.get(i));this.keys.delete(i);sfx.gold();}
  if(i===this.exit){this.step='out';this.stepAt=now;sfx.win();saveBest(this.id,this.level);}
 },
 // The window around (px,py). k = how much light there is (0..1).
 view(m,cx,cy,now,k,extra){
  const {W,H,g}=m,R=2.9+.15*Math.sin(now*7.3)*Math.sin(now*2.1);
  for(let sy=0;sy<8;sy++)for(let sx=0;sx<8;sx++){
   const wx=cx+sx-FL_OX,wy=cy+sy-FL_OY;if(wx<0||wy<0||wx>=W||wy>=H)continue;
   const i=wy*W+wx,a=k*Math.pow(Math.max(0,1-Math.hypot(sx-FL_OX,sy-FL_OY)/R),1.2);
   if(g[i]){if(a>0)px(sx,sy,FL_WARM,a);}
   else if(extra&&extra(i,sx,sy,a));
   else if(a>0)px(sx,sy,FL_WARM,a*.07); // the floor in the light pool
  }
 },
 draw(now){
  const t=now-this.stepAt,m=this.m;
  if(this.step==='in'&&t<.8){drawBigNumber(this.level,FL_WARM,Math.min(1,t/.2),0);return;}
  const k=this.step==='in'?Math.min(1,(t-.8)/.4):1;
  this.view(m,this.px,this.py,now,k,(i,sx,sy,a)=>{
   if(this.doors.has(i)){px(sx,sy,FL_KEYS[this.doors.get(i)],Math.max(a,.06));return true;}
   if(this.keys.has(i)){px(sx,sy,FL_KEYS[this.keys.get(i)],Math.max(a,.12+.2*pulse(now,2)));return true;}
   if(i===this.exit){px(sx,sy,COL.green,.35+.65*pulse(now,1.4));return true;}
   const o=this.opened.find(o=>o.i===i&&now-o.at<.5);
   if(o){px(sx,sy,FL_KEYS[o.k],1-(now-o.at)/.5);return true;}
   return false;
  });
  // Bumped into a wall: it flashes red
  if(this.bump&&now-this.bump.at<.3)px(this.bump.x-this.px+FL_OX,this.bump.y-this.py+FL_OY,COL.red,1-(now-this.bump.at)/.3);
  // Which way the exit is, when it is outside the window
  const ex=this.exit%m.W,ey=this.exit/m.W|0,dx=ex-this.px,dy=ey-this.py;
  if(dx<-FL_OX||dx>7-FL_OX||dy<-FL_OY||dy>7-FL_OY){
   const s=Math.min(dx?(dx>0?7-FL_OX:FL_OX)/Math.abs(dx):9,dy?(dy>0?7-FL_OY:FL_OY)/Math.abs(dy):9);
   px(Math.round(FL_OX+dx*s),Math.round(FL_OY+dy*s),COL.green,k*(.1+.25*pulse(now,1.2)));
  }
  px(FL_OX,FL_OY,COL.white);
  // Keys you carry, on the top row
  [...this.have].forEach((key,j)=>topLed(j,FL_KEYS[key],.6+.4*pulse(now,2)));
  if(this.step==='out')fill(COL.green,Math.max(0,.6-t*.4));
 },
 hud(){
  if(this.step==='out')return `Du hittade ut på nivå ${this.level}!`;
  const keys=[...this.have].map(k=>FL_KEY_NAMES[k]),doors=this.doors.size;
  return `Nivå ${this.level} · steg ${this.moves}`+(keys.length?` · du har nyckel: ${keys.join(', ')}`:doors?` · ${doors} ${doors>1?'dörrar':'dörr'} på vägen – leta nyckel`:'');
 },
 demo(t){
  if(!this.dm){const m=carveMaze(5,5),{dist,prev}=mazeDist(m,1,1);let ex=0;for(let i=0;i<dist.length;i++)if(dist[i]>dist[ex])ex=i;const p=[];for(let i=ex;i>=0;i=prev[i])p.unshift(i);this.dm={m,p,ex};}
  const {m,p,ex}=this.dm,i=p[Math.floor(t*3)%p.length],x=i%m.W,y=i/m.W|0;
  this.view(m,x,y,t,1,(j,sx,sy)=>{if(j===ex){px(sx,sy,COL.green,.35+.65*pulse(t,1.4));return true;}return false;});
  px(FL_OX,FL_OY,COL.white);
 }
};


// =====================================================================
// MINNESLABYRINTEN – the maze lights up for three seconds, then goes dark. Walk from start (white, bottom left)
// to the goal (green, top right) from memory. Walk into a wall and it flashes red and you go back to the
// start – but that wall keeps glowing faintly so you don't hit it again.
// =====================================================================
// A winding corridor from (0,7) to (7,0) that never touches itself, plus a few dead ends.
function memoryMaze(len,branches){
 const ok=(o,x,y,fx,fy)=>x>=0&&y>=0&&x<8&&y<8&&!o[y*8+x]&&DIR4.every(([dx,dy])=>{const ax=x+dx,ay=y+dy;return (ax===fx&&ay===fy)||ax<0||ay<0||ax>7||ay>7||!o[ay*8+ax];});
 let best=null;
 for(let tries=0;tries<600;tries++){
  const o=new Uint8Array(64);let x=0,y=7,n=1;o[56]=1;
  while(!(x===7&&y===0)){
   const opts=DIR4.map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>(nx===7&&ny===0)||ok(o,nx,ny,x,y));
   if(!opts.length)break;
   // A little pull towards the goal so it gets there, but plenty of wandering
   opts.sort((a,b)=>(a[0]-a[1])-(b[0]-b[1]));
   const [nx,ny]=Math.random()<.35?opts[opts.length-1]:opts[rnd(opts.length)];
   x=nx;y=ny;o[y*8+x]=1;n++;
  }
  if(!(x===7&&y===0))continue;
  const score=Math.abs(n-len);
  if(!best||score<best.score)best={o,score};
  if(score<=2)break;
 }
 const o=best.o;
 // Dead ends: short side corridors that also never touch the rest
 for(let b=0,tries=0;b<branches&&tries<200;tries++){
  const open=[];for(let i=0;i<64;i++)if(o[i])open.push(i);
  let i=open[rnd(open.length)],x=i%8,y=i/8|0,made=0;
  for(let s=0;s<3;s++){
   const opts=DIR4.map(([dx,dy])=>[x+dx,y+dy]).filter(([nx,ny])=>ok(o,nx,ny,x,y));
   if(!opts.length)break;[x,y]=opts[rnd(opts.length)];o[y*8+x]=1;made++;
  }
  if(made)b++;
 }
 return o; // 1 = floor
}
const MemLab={
 id:'minneslab',name:'Minneslabyrinten',color:COL.blue,
 how:'Labyrinten lyser i tre sekunder och blir sedan svart. Gå från den vita starten nere till vänster till det gröna målet uppe till höger – på minnet. Tryck på rutan bredvid pricken för att gå. Går du in i en vägg blinkar den rött och du åker tillbaka till start, men väggen fortsätter att lysa svagt.',
 legend:[[COL.blue,'Väggar (syns bara i början)'],[COL.white,'Du och starten'],[COL.green,'Målet'],[COL.red,'Väggar du har gått in i']],
 showFor:3,
 start(now){this.phase='play';this.level=0;this.total=0;this.next(now);},
 next(now){
  this.level++;
  this.open=memoryMaze(Math.min(13+this.level*2,30),Math.min(1+Math.floor(this.level/2),5));
  this.found=new Set();this.px=0;this.py=7;this.bumps=0;this.trail=[];this.bumpAt=0;
  this.step='show';this.stepAt=now;sfx.start();
 },
 update(dt,now){
  const t=now-this.stepAt;
  if(this.step==='show'&&t>this.showFor){this.step='play';this.stepAt=now;tone(330,165,.3,'triangle',.08);}
  else if(this.step==='good'&&t>1.3)this.next(now);
 },
 input(ev,now){
  if(ev.kind!=='pad'||!ev.down||this.step!=='play')return;
  const d=stepToward(this.px,this.py,ev.x,ev.y);if(!d)return;
  const nx=this.px+d[0],ny=this.py+d[1];
  if(nx<0||ny<0||nx>7||ny>7)return;
  if(!this.open[ny*8+nx]){
   this.found.add(ny*8+nx);this.bumpAt=now;this.bumpAt2=[nx,ny];this.bumps++;this.total++;
   this.px=0;this.py=7;this.trail=[];sfx.bad();return;
  }
  this.trail.push({x:this.px,y:this.py,at:now});
  this.px=nx;this.py=ny;sfx.hit(nx+(7-ny));
  if(nx===7&&ny===0){this.step='good';this.stepAt=now;sfx.win();saveBest(this.id,this.level);}
 },
 draw(now){
  const t=now-this.stepAt;
  if(this.step==='show'){
   const a=Math.min(1,t/.2);
   for(let i=0;i<64;i++)if(!this.open[i])px(i%8,i/8|0,COL.blue,a*.75);
   topBar(1-t/this.showFor,COL.blue);
  }
  for(const i of this.found)px(i%8,i/8|0,COL.red,.18);
  if(this.bumpAt&&now-this.bumpAt<.5)px(this.bumpAt2[0],this.bumpAt2[1],COL.red,pulse(now,8));
  this.trail=this.trail.filter(s=>now-s.at<.4);
  for(const s of this.trail)px(s.x,s.y,COL.white,.3*(1-(now-s.at)/.4));
  px(0,7,COL.white,.25);
  px(7,0,COL.green,.5+.5*pulse(now,1.5));
  px(this.px,this.py,COL.white);
  if(this.step==='good'){
   for(let i=0;i<64;i++)if(this.open[i])px(i%8,i/8|0,COL.green,Math.max(0,.7-t*.5));
  }
 },
 hud(){
  if(this.step==='show')return `Nivå ${this.level} · titta noga – snart blir det mörkt!`;
  if(this.step==='good')return `Nivå ${this.level} klar med ${this.bumps} väggträffar!`;
  return `Nivå ${this.level} · väggträffar ${this.bumps}`;
 },
 demo(t){
  if(!this.dm){ // the way from start to goal
   const o=memoryMaze(17,1),{prev}=mazeDist({W:8,H:8,g:o.map(v=>v?0:1)},0,7),p=[];
   for(let j=7;j>=0;j=prev[j])p.unshift(j);
   this.dm={o,p};
  }
  const {o,p}=this.dm,cyc=1.5+p.length*.3,k=t%cyc;
  if(k<1.5)for(let i=0;i<64;i++){if(!o[i])px(i%8,i/8|0,COL.blue,.75);}
  const i=p[Math.max(0,Math.min(p.length-1,Math.floor((k-1.5)/.3)))];
  px(7,0,COL.green,.5+.5*pulse(t,1.5));px(i%8,i/8|0,COL.white);
 }
};

// =====================================================================
// PORTALHOPP – a little runner (white) walks on its own and turns around at walls. Press an empty pad to put
// a portal there: first blue, then orange, then blue again (moving it), and so on. Walking or falling into one
// portal takes the runner out of the other, still going the same way. Get it past pits and spikes to the
// green goal. Portals stay where they are when you fail, so you can adjust them and try again.
// Fewer portal moves = more stars. The bottom button of the right column starts the level over without portals.
// ◀ ▶ on the top row pick a level (the ones you have reached). Stars are kept in the browser.
// Map: '#' ground, '^' spikes, 'S' start (walking right), 's' start walking left, 'G' goal, '.' air,
//      'b' button: the runner walking over it opens every door 'D' (until it dies),
//      't' timed button: opens the doors for PH_TIMER steps only (a door stays open while the runner is in it),
//      '|' portal cleaner: the runner passing through it removes both portals (no portals can go on it),
//      'J' jump pad (ground): launches the runner up and forward for PH_JUMP steps. Jumping into a portal,
//      the jump goes on out of the other one ("speedy thing in, speedy thing out").
// Falling off the bottom of the pad is the end of the runner. No fall damage.
// =====================================================================
const PH_BLUE=[0,.35,1],PH_ORANGE=[1,.4,0],PH_GROUND=[.32,.27,.48],PH_DOOR=[1,.75,0],PH_GRILL=[.45,.85,1],PH_PAD=[1,.15,.75];
const PH_JUMP=3,PH_TIMER=8;
// par: portal moves for 3 stars (2 more for 2 stars). hint: shown on the screen until the first portal goes down.
const PH_LEVELS=[
 {name:'Glappet',map:['........','........','........','........','........','........','S.....G.','###..###']},
 {name:'Muren',map:['........','........','......G.','....###.','........','........','S..#....','########']},
 {name:'Fånga fallet',map:['S.......','####....','........','........','........','........','......G.','^^^^^###']},
 {name:'Rätt sida',map:['........','........','........','...G....','..###...','........','S......#','########']},
 {name:'Schaktet',map:['......S.','....####','........','G.......','##......','........','........','..^^^^^^']},
 {name:'Över gropen',map:['S.......','##......','........','........','.....#G.','.....###','........','^^^^^^^^']},
 {name:'Instängd',map:['........','.G#.....','###.....','........','.....#..','S....#..','###..###','........']},
 {name:'Hörnet',map:['.......G','......##','........','s.......','####..#.','...#..#.','...#..#.','^^^#^^#^']},
 {name:'Knappen',hint:'Ny sak: den gula knappen öppnar den gula dörren. Få figuren att gå över knappen först.',
  map:['........','........','.b......','###.....','........','......##','S.....DG','########']},
 {name:'Rensaren',hint:'Ny sak: den ljusblå portalrensaren tar bort båda portalerna när figuren går igenom. Sätt dem när den har passerat.',
  map:['........','........','.....G..','....###.','........','........','S|......','########']},
 {name:'Hoppplattan',hint:'Ny sak: den rosa hoppplattan skjuter upp figuren snett framåt. Hoppar den in i en portal fortsätter hoppet ut ur den andra – fart in, fart ut!',
  map:['......#.','......G.','........','........','........','........','S.......','#J######']},
 {name:'Knapp i taket',hint:'Knappen sitter uppe under taket. Bara ett hopp når dit.',
  map:['#.......','b.......','........','........','........','......##','...s..DG','#J######']},
 {name:'Bråttom',hint:'Portalrensaren tar bort portalerna varje gång figuren går förbi. Var snabb!',
  map:['........','.b......','###.....','........','........','......##','S|....DG','########']},
 {name:'Språngbrädan',hint:'Hoppplattan står på en ö mitt bland taggarna. Få figuren dit, åt rätt håll.',
  map:['S..#....','####....','......#.','......G.','......#.','........','........','^^^J^^^^']},
 {name:'Tidsknappen',hint:'Ny sak: tidsknappen öppnar dörren bara en kort stund. Hinner figuren inte fram stängs den igen.',
  map:['........','.t....s.','#######.','........','........','##......','GD......','########']},
 {name:'Finalen',par:4,hint:'Allt på en gång. Tryck på knappen, och flytta sedan portalerna innan figuren hamnar i taggarna.',
  map:['#.......','b.......','........','........','........','......##','...s..DG','#J##^###']}
];
// One step of the runner. Returns 'win', 'dead', 'port', 'button', 'grill' or null. portals may be cleared.
// Shared with the menu demo and phCheck().
function phStep(L,r,portals){
 const at=(x,y)=>x<0||x>7||y<0?'#':y>7?'.':L[y][x];
 const solid=(x,y)=>{const t=at(x,y);return t==='#'||t==='J'||(t==='D'&&!r.open);};
 if(r.open>0&&r.open<Infinity&&at(r.x,r.y)!=='D')r.open--; // a timed door counts down (not with the runner in it)
 r.falling=false;r.flying=false;
 if(r.arc===0&&r.y<7&&at(r.x,r.y+1)==='J'){r.arc=PH_JUMP;r.jumpAt=r.x+r.y*8;} // standing on a jump pad: off we go
 if(r.arc>0){
  r.arc--;r.flying=true;
  if(!solid(r.x+r.dir,r.y-1)){r.x+=r.dir;r.y--;}
  else if(!solid(r.x,r.y-1))r.y--;   // a wall in front: straight up along it
  else r.arc=0;                      // boxed in: the jump stops
 }
 else if(r.y>=7||!solid(r.x,r.y+1)){r.y++;r.falling=true;}
 else{const nx=r.x+r.dir;if(solid(nx,r.y))r.dir=-r.dir;else r.x=nx;}
 if(r.y>7)return 'dead';
 const tile=at(r.x,r.y),k=r.x+r.y*8;
 if(r.portedTo!==k)r.portedTo=-1; // moved off the portal it came out of
 if(tile==='^')return 'dead';
 if(tile==='G')return 'win';
 if(tile==='b'&&r.open!==Infinity){r.open=Infinity;return 'button';}
 if(tile==='t'){const was=r.open;r.open=PH_TIMER;return was?null:'button';}
 if(tile==='|'){if(portals[0]>=0||portals[1]>=0){portals[0]=portals[1]=-1;return 'grill';}return null;}
 const [b,o]=portals;
 if(r.portedTo<0&&b>=0&&o>=0&&(k===b||k===o)){const to=k===b?o:b;r.x=to%8;r.y=to/8|0;r.portedTo=to;return 'port';}
 return null;
}
function phRunner(L){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(L[y][x]==='S'||L[y][x]==='s')return {x,y,dir:L[y][x]==='S'?1:-1,portedTo:-1,falling:false,flying:false,arc:0,open:0};}
const phFree=t=>t==='.'||t==='S'||t==='s'; // where portals can go
// For making levels: plays every pair of portals placed before the start. A good level can't be won without
// portals (none: false) and has a few winning pairs. Portal cleaners make you place new portals while it runs,
// which this doesn't try – play those yourself. Example in the console: phCheck(PH_LEVELS[8].map)
function phCheck(L,limit=500){
 const run=(b,o)=>{
  const r=phRunner(L),p=[b,o],seen=new Set();
  for(let i=0;i<limit;i++){
   const key=[r.x,r.y,r.dir,r.arc,r.open,r.portedTo,p[0],p[1]].join();if(seen.has(key))return false;seen.add(key);
   const s=phStep(L,r,p);if(s==='win')return true;if(s==='dead')return false;
  }
  return false;
 };
 const s=phRunner(L),cells=[];
 for(let k=0;k<64;k++)if(phFree(L[k>>3][k&7])&&k!==s.x+s.y*8)cells.push(k);
 const wins=[];for(const b of cells)for(const o of cells)if(b<o&&run(b,o))wins.push([b,o]);
 return {none:run(-1,-1),pairs:wins.length,wins};
}
const PH_SAVE='legends.portalhopp.stars';
const Portalhopp={
 id:'portalhopp',name:'Portalhopp',color:PH_ORANGE,
 how:'Den vita figuren springer av sig själv och vänder vid väggar. Tryck på en tom ruta för att sätta en portal: först blå, sedan orange, sedan flyttas den blå igen och så vidare. Springer eller faller figuren in i den ena portalen kommer den ut ur den andra – åt samma håll som den var på väg. Få den förbi stup och taggar till det gröna målet. Senare banor har knappar och dörrar, tidsknappar, portalrensare och hoppplattor. Misslyckas du ligger portalerna kvar så du kan ändra dem. Färre portalflyttar ger fler stjärnor. ◀ ▶ på översta raden byter bana, den nedersta knappen i högerkolumnen (Stop Solo Mute) börjar om banan utan portaler.',
 legend:[[COL.white,'Figuren'],[PH_BLUE,'Blå portal'],[PH_ORANGE,'Orange portal'],[COL.green,'Målet'],[COL.red,'Taggar'],[PH_GROUND,'Mark och väggar'],[PH_DOOR,'Knapp, tidsknapp och dörr'],[PH_GRILL,'Portalrensare'],[PH_PAD,'Hoppplatta']],
 loadStars(){let s=[];try{s=JSON.parse(localStorage.getItem(PH_SAVE))||[];}catch{}return PH_LEVELS.map((_,i)=>+s[i]||0);},
 saveStars(){try{localStorage.setItem(PH_SAVE,JSON.stringify(this.best));}catch{}},
 total(){return this.best.reduce((a,b)=>a+b,0);},
 unlocked(){const i=this.best.findIndex(s=>!s);return i<0?PH_LEVELS.length-1:i;}, // the furthest level you may pick
 start(now){
  this.phase='play';this.best=this.loadStars();
  const u=this.unlocked();this.go(this.best[u]?0:u,now); // carry on where you were (from the start once all are done)
 },
 go(i,now){
  this.lv=i;this.def=PH_LEVELS[i];this.L=this.def.map;this.par=this.def.par||2;
  this.portals=[-1,-1];this.placed=0;this.nextP=0;this.intro=true;this.reset(now);
 },
 reset(now){
  this.r=phRunner(this.L);this.step='ready';this.stepAt=now;this.moveAt=now+(this.intro?3:1.6);this.trail=[];this.fizz=null;
 },
 starsFor(){return this.placed<=this.par?3:this.placed<=this.par+2?2:1;},
 won(now){
  const s=this.starsFor();this.gotStars=s;
  if(s>this.best[this.lv]){this.best[this.lv]=s;this.saveStars();}
  this.step='win';this.stepAt=now;sfx.win();
 },
 update(dt,now){
  if(this.phase==='over')return;
  const t=now-this.stepAt;
  if(this.step==='dead'&&t>1){this.intro=false;this.reset(now);return;}
  if(this.step==='win'&&t>1.8){
   if(this.lv+1<PH_LEVELS.length)this.go(this.lv+1,now);
   else{const total=this.total();saveBest(this.id,total);gameOver(this,`${total}`,COL.gold,now);}
   return;
  }
  if(this.step==='ready'&&now>=this.moveAt){this.step='run';this.intro=false;}
  if(this.step!=='run')return;
  let guard=0;
  while(now>=this.moveAt&&this.step==='run'&&guard++<4){
   this.trail.push({x:this.r.x,y:this.r.y,at:now});
   const old=[...this.portals],res=phStep(this.L,this.r,this.portals);
   this.moveAt+=this.r.falling?.13:this.r.flying?.16:.32;
   if(this.r.open>0&&this.r.open<Infinity)tone(1500,1500,.03,'square',.04); // the timed door ticking
   if(res==='port'){this.portAt=now;tone(300,900,.18,'sine',.1);}
   else if(res==='button'){this.openAt=now;tone(180,180,.06,'square',.1);tone(520,1040,.3,'triangle',.09,audioNow()+.06);}
   else if(res==='grill'){this.fizz={at:now,cells:old.filter(k=>k>=0)};this.nextP=0;noise(.35,2500,.12,0,'bandpass');tone(900,200,.3,'sine',.06);}
   else if(res==='dead'){this.step='dead';this.stepAt=now;this.deadAt={x:this.r.x,y:Math.min(7,this.r.y)};sfx.bad();}
   else if(res==='win')this.won(now);
   if(this.r.flying&&this.r.arc===PH_JUMP-1&&res!=='port')tone(260,780,.2,'triangle',.08); // launched
  }
 },
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(!ev.down)return;
  if(ev.kind==='side'&&ev.i===7&&this.step!=='win'){this.portals=[-1,-1];this.placed=0;this.nextP=0;this.intro=false;this.reset(now);sfx.menu();return;}
  if(ev.kind==='top'&&(ev.i===2||ev.i===3)){
   const to=this.lv+(ev.i===2?-1:1);
   if(to>=0&&to<=this.unlocked()&&to<PH_LEVELS.length){this.go(to,now);sfx.menu();}else tone(140,140,.07,'square',.05);
   return;
  }
  if(ev.kind!=='pad'||this.step==='win')return;
  const k=ev.x+ev.y*8,tile=this.L[ev.y][ev.x];
  if(!phFree(tile)){tone(140,140,.07,'square',.05);return;}
  if(k===this.r.x+this.r.y*8)return;
  const which=this.nextP;
  if(this.portals[1-which]===k)return;
  this.portals[which]=k;this.placed++;this.nextP=1-which;this.placeAt=now;this.placeK=k;
  tone(which?520:390,which?780:585,.12,'sine',.09);
 },
 drawLevel(L,portals,r,now,alive=true){
  const open=r&&r.open;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const c=L[y][x];
   if(c==='#')px(x,y,PH_GROUND,.8);
   else if(c==='^')px(x,y,COL.red,.45+.35*pulse(now+x*.2,1.2));
   else if(c==='G')px(x,y,COL.green,.5+.5*pulse(now,1.5));
   else if(c==='D')px(x,y,PH_DOOR,!open?.75:open<Infinity&&open<=3?.07+.5*(Math.sin(now*30)>0):.07);
   else if(c==='b')px(x,y,PH_DOOR,open?.2:.35+.4*pulse(now,2.5));
   else if(c==='t')px(x,y,PH_DOOR,open?.25+.75*(Math.sin(now*12)>0):.35+.4*pulse(now,2.5));
   else if(c==='|')px(x,y,PH_GRILL,.2+.18*pulse(now*1.7+y*.35,2));
   else if(c==='J')px(x,y,PH_PAD,.45+.4*Math.max(0,Math.sin(now*5)));
  }
  portals.forEach((k,i)=>{if(k>=0)px(k%8,k/8|0,i?PH_ORANGE:PH_BLUE,.6+.4*pulse(now+i*.5,2.2));});
  if(alive&&r)px(r.x,r.y,COL.white);
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  const t=now-this.stepAt;
  if(this.step==='ready'&&this.intro&&t<.8){drawBigNumber(this.lv+1,PH_ORANGE,Math.min(1,t/.2),0);return;}
  this.drawLevel(this.L,this.portals,this.r,now,this.step!=='dead');
  this.trail=this.trail.filter(s=>now-s.at<.3);
  for(const s of this.trail)px(s.x,s.y,COL.white,.25*(1-(now-s.at)/.3));
  if(this.step==='ready'){px(this.r.x,this.r.y,COL.white,pulse(now,4));topBar(Math.max(0,(this.moveAt-now)/(this.intro?2.2:1.6)),COL.white);}
  if(this.placeAt&&now-this.placeAt<.25)px(this.placeK%8,this.placeK/8|0,COL.white,1-(now-this.placeAt)/.25);
  if(this.portAt&&now-this.portAt<.2)for(const k of this.portals)if(k>=0)px(k%8,k/8|0,COL.white,1-(now-this.portAt)/.2);
  if(this.openAt&&now-this.openAt<.4&&this.r.open)for(let k=0;k<64;k++)if(this.L[k>>3][k&7]==='D')px(k%8,k>>3,COL.white,1-(now-this.openAt)/.4);
  if(this.fizz&&now-this.fizz.at<.5){const a=1-(now-this.fizz.at)/.5;for(const k of this.fizz.cells)px(k%8,k>>3,Math.random()<.5?PH_GRILL:COL.white,a);}
  if(this.step==='dead'){px(this.deadAt.x,this.deadAt.y,COL.red,pulse(now,6));fill(COL.red,.25*Math.max(0,1-t*2));}
  if(this.step==='win'){fill(COL.green,Math.max(0,.5-t*.5));for(let i=0;i<3;i++)topLed(i,COL.gold,i<this.gotStars?1:.08);}
  else{ // which portal comes next, on the top row: blue (0) and orange (1)
   const nx=this.nextP;topLed(0,PH_BLUE,nx===0?.6+.4*pulse(now,3):.2);topLed(1,PH_ORANGE,nx===1?.6+.4*pulse(now,3):.2);
  }
  topLed(2,COL.white,this.lv>0?.35:.05);topLed(3,COL.white,this.lv<this.unlocked()?.35:.05);
  sideLed(7,COL.red,.35);
 },
 hud(){
  const n=PH_LEVELS.length;
  if(this.phase==='over')return `Alla ${n} banor klara! ${this.total()} av ${n*3} stjärnor`;
  const next=this.nextP?'orange':'blå',name=`Bana ${this.lv+1} av ${n} – ${this.def.name}`;
  if(this.step==='win')return `${name} klar – ${'★'.repeat(this.gotStars)}${'☆'.repeat(3-this.gotStars)} (${this.placed} portalflyttar)`;
  if(this.step==='dead')return `Aj! Portalerna ligger kvar – flytta dem och försök igen.`;
  if(this.fizz&&this.step==='run'&&!this.portals.some(k=>k>=0))return `${name} · Portalrensaren tog bort portalerna – sätt nya! Nästa: blå`;
  if(this.def.hint&&!this.placed)return `${name} · ${this.def.hint}`;
  return `${name} · nästa portal: ${next} · portalflyttar ${this.placed} (${this.par} ger ★★★) · stjärnor ${this.total()}`;
 },
 demo(t){
  const L=PH_LEVELS[0].map,portals=[3+6*8,5+6*8],n=Math.floor(t/.32)%12,r=phRunner(L);
  for(let i=0;i<n;i++)if(phStep(L,r,portals)==='win')break;
  this.drawLevel(L,portals,r,t);
 }
};

// =====================================================================
// SJUNKBOMB – hunt submarines with depth charges. Your ship sails on the top row, the waves are row 1 and
// the sea is below. Submarines cross at different depths. Press a pad to drop a charge in that column: it sinks
// and goes off at the depth you pressed (the top two rows send it all the way to the bottom). The blast reaches
// one pad to each side and up and down. The ship sails to where you last dropped. Subs send up red mines – one
// reaching the surface under the ship costs a life (3, on the top row). Charges blow up mines too.
// At most SB_MAX charges in the water at once (shown in the right column). Every wave is faster and meaner.
// =====================================================================
const SB_SUBS=[ // length, speed (pads/s), colour, points, mines per second, first wave
 {len:3,speed:1,c:[.45,.6,.75],pts:10,mines:.22,from:1},
 {len:2,speed:2,c:[1,.8,0],pts:25,mines:.1,from:2},
 {len:4,speed:.6,c:[.7,.3,1],pts:40,mines:.45,from:3}
];
const SB_MAX=3,SB_SINK=5,SB_SHIP=[1,1,1],SB_WAVE=[0,.55,1];
const Sjunkbomb={
 id:'sjunkbomb',name:'Sjunkbomb',color:[0,.6,.9],
 how:'Ubåtsjakt! Ditt fartyg ligger på översta raden och vågorna på raden under. Ubåtar åker förbi på olika djup. Tryck på en ruta för att släppa en sjunkbomb i den kolumnen – den sjunker och smäller på det djup du tryckte (de två översta raderna skickar den ända till botten). Smällen når en ruta åt varje håll. Fartyget åker dit du senast släppte. Ubåtarna skickar upp röda minor: når en mina ytan under fartyget förlorar du ett liv. Bomber spränger minor också. Högst tre bomber i vattnet samtidigt (högerkolumnen).',
 legend:[[SB_SHIP,'Ditt fartyg'],[SB_SUBS[0].c,'Ubåt 10 p'],[SB_SUBS[1].c,'Snabb ubåt 25 p'],[SB_SUBS[2].c,'Stor ubåt 40 p'],[COL.red,'Mina'],[COL.yellow,'Sjunkbomb']],
 start(now){
  this.phase='play';this.score=0;this.lives=3;this.wave=0;this.shipX=3;this.shipTo=3;
  this.charges=[];this.subs=[];this.mines=[];this.booms=[];this.bubbles=[];this.hurtAt=-9;this.nextWave(now);
 },
 nextWave(now){this.wave++;this.toSpawn=3+this.wave*2;this.spawnAt=now+2.2;this.waveAt=now;sea.sonar();},
 spawn(now){
  const kinds=SB_SUBS.filter(k=>k.from<=this.wave),kind=kinds[rnd(kinds.length)],fast=1+(this.wave-1)*.15;
  const busy=new Set(this.subs.map(s=>s.y)),rows=[2,3,4,5,6,7].filter(y=>!busy.has(y));
  if(!rows.length)return false;
  const dir=Math.random()<.5?1:-1;
  this.subs.push({kind,y:rows[rnd(rows.length)],dir,x:dir>0?-kind.len:8,speed:kind.speed*fast*(.85+Math.random()*.3),mineAt:now+1+Math.random()*2});
  if(Math.random()<.3)sea.sonar();
  return true;
 },
 cells(s){const x0=Math.round(s.x),out=[];for(let i=0;i<s.kind.len;i++)out.push(x0+i);return out;},
 blast(x,y,now){
  this.booms.push({x,y,at:now});sea.boom();
  const hit=(cx,cy)=>Math.abs(cx-x)+Math.abs(cy-y)<=1;
  let n=0;
  for(const s of this.subs)if(!s.dead&&this.cells(s).some(cx=>hit(cx,s.y))){s.dead=true;n++;this.score+=s.kind.pts*this.wave;
   for(const cx of this.cells(s))this.bubbles.push({x:cx,y:s.y,at:now,c:s.kind.c});}
  if(n){sea.bubbles();if(n>1){this.score+=50*n;sfx.gold();}else sfx.hit(3);}
  for(const m of this.mines)if(!m.dead&&hit(m.x,Math.round(m.y))){m.dead=true;this.score+=5;}
 },
 update(dt,now){
  if(this.phase==='over')return;
  this.shipX+=Math.sign(this.shipTo-this.shipX)*Math.min(Math.abs(this.shipTo-this.shipX),dt*6);
  if(this.toSpawn>0&&now>=this.spawnAt){if(this.spawn(now))this.toSpawn--;this.spawnAt=now+Math.max(.7,2.4-this.wave*.2)*(.6+Math.random()*.8);}
  for(const s of this.subs){
   s.x+=s.dir*s.speed*dt;
   if(s.dir>0?s.x>8:s.x<-s.kind.len)s.gone=true;
   const inside=s.x>=0&&s.x+s.kind.len<=8;
   if(inside&&now>=s.mineAt){
    this.mines.push({x:Math.round(s.x+s.kind.len/2-.5),y:s.y-.5,speed:1.1+this.wave*.12});sea.mine();
    s.mineAt=now+(1/s.kind.mines)*(.6+Math.random()*.8)/(1+(this.wave-1)*.12);
   }
  }
  this.subs=this.subs.filter(s=>!s.dead&&!s.gone);
  for(const m of this.mines){
   m.y-=m.speed*dt;
   if(m.y<=1&&!m.dead){
    m.dead=true;
    if(Math.abs(m.x-Math.round(this.shipX))<=1){this.lives--;this.hurtAt=now;sfx.bad();sea.boom(1.3);
     if(this.lives<=0){const best=saveBest(this.id,this.score);gameOver(this,this.score,best?COL.gold:COL.cyan,now);sfx.over();return;}}
    else noise(.1,2000,.05,0,'bandpass');
   }
  }
  this.mines=this.mines.filter(m=>!m.dead);
  for(const c of this.charges){c.y+=SB_SINK*dt;if(c.y>=c.to){c.done=true;this.blast(c.x,c.to,now);}}
  this.charges=this.charges.filter(c=>!c.done);
  this.booms=this.booms.filter(b=>now-b.at<.4);this.bubbles=this.bubbles.filter(b=>now-b.at<1.2);
  if(this.toSpawn===0&&!this.subs.length&&now-this.waveAt>3){this.score+=25*this.wave;sfx.win();this.nextWave(now);}
 },
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(ev.kind!=='pad'||!ev.down)return;
  if(this.charges.length>=SB_MAX){tone(140,140,.06,'square',.04);return;}
  this.charges.push({x:ev.x,y:1,to:ev.y<=1?7:ev.y});this.shipTo=ev.x;sea.splash();
 },
 drawScene(now,subs,mines,charges,shipX){
  // Sea: darker the deeper, waves rolling along row 1
  for(let y=2;y<8;y++)for(let x=0;x<8;x++)px(x,y,[0,.12,.45],.07-(y-2)*.008);
  for(let x=0;x<8;x++)px(x,1,SB_WAVE,.12+.14*(.5+.5*Math.sin(now*2.2-x*.9)));
  for(const s of subs){
   const xs=this.cells(s),nose=s.dir>0?xs[xs.length-1]:xs[0];
   for(const x of xs)px(x,s.y,s.kind.c,x===nose?1:.55);
  }
  for(const m of mines)px(m.x,Math.round(m.y),COL.red,.6+.4*pulse(now,5));
  for(const c of charges){px(c.x,c.to,COL.yellow,.12+.1*pulse(now,6));px(c.x,Math.floor(c.y),COL.yellow);}
  const sx=Math.round(shipX);
  for(let i=-1;i<=1;i++)px(sx+i,0,SB_SHIP,i?.5:1);
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  if(now-this.waveAt<.9){drawBigNumber(this.wave,SB_WAVE,Math.min(1,(now-this.waveAt)/.2));for(let i=0;i<3;i++)topLed(i,SB_SHIP,i<this.lives?.6:.05);return;}
  this.drawScene(now,this.subs,this.mines,this.charges,this.shipX);
  for(const b of this.bubbles){const t=now-b.at,y=Math.round(b.y-t*3);if(y>=2)px(b.x,y,COL.white,.35*(1-t/1.2));}
  for(const b of this.booms){const a=1-(now-b.at)/.4;for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])px(b.x+dx,b.y+dy,dx||dy?COL.orange:COL.white,a);}
  if(now-this.hurtAt<.5){const a=1-(now-this.hurtAt)/.5;for(let x=0;x<8;x++){px(x,0,COL.red,a);px(x,1,COL.red,a*.6);}}
  for(let i=0;i<3;i++)topLed(i,SB_SHIP,i<this.lives?.6:.05);
  for(let i=0;i<SB_MAX;i++)sideLed(i,COL.yellow,i<SB_MAX-this.charges.length?.6:.06);
 },
 hud(){
  if(this.phase==='over')return `Fartyget sjönk i våg ${this.wave}. ${this.score} poäng – tryck på plattan för att spela igen.`;
  return `Våg ${this.wave} · poäng ${this.score} · liv ${this.lives} · bomber ${SB_MAX-this.charges.length}`;
 },
 demo(t){
  const s={kind:SB_SUBS[0],y:5,dir:1,x:(t*1.3)%11-3},k=(t%2.2)/2.2,cx=4;
  const charges=k<.6?[{x:cx,y:1+k/.6*4,to:5}]:[];
  const mines=[{x:2,y:7-(t*1.2)%6}];
  this.drawScene(t,[s],mines,charges,cx);
  if(k>=.6&&k<.75)for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])px(cx+dx,5+dy,dx||dy?COL.orange:COL.white,1-(k-.6)/.15);
 }
};
