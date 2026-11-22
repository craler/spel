'use strict';
// The small games. Each one is an object with:
//   id, name, color, how (rules shown on screen)
//   start(now)            – new round
//   update(dt, now)       – simulation, called every tick
//   draw(now)             – paint the Launchpad with px()/topLed()/sideLed()
//   input(ev, now)        – a pad or button went down/up: {kind:'pad',x,y,down} / {kind:'top'|'side',i,down}
//   hud()                 – one or two lines for the screen
//   demo(t)               – the looping animation the menu shows on the whole grid while the game is selected
//   isNew, legend         – optional: blink as new in the menu; [[colour, text], …] shown on screen under the rules
// Top row button 7 (User) is reserved for "hold to go back to the menu" (main.js), so games use top 0..6.

const COL={
 white:[1,1,1],red:[1,0,0],green:[0,1,.1],blue:[0,.3,1],yellow:[1,.75,0],orange:[1,.35,0],
 purple:[.55,0,1],cyan:[0,.85,1],pink:[1,.1,.55],gold:[1,.55,0],grey:[.25,.25,.3]
};
const rnd=n=>Math.floor(Math.random()*n);
const lerp=(a,b,k)=>a+(b-a)*Math.max(0,Math.min(1,k));
const pulse=(t,speed=3)=>.55+.45*Math.sin(t*speed*Math.PI);

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
 'V':['101','101','101','101','010'],'Ä':['101','010','101','111','101']
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
// Countdown/progress on the top row (0..6). k = 1 full, 0 empty.
function topBar(k,c){const n=k*7;for(let i=0;i<7;i++){const a=Math.max(0,Math.min(1,n-i));if(a>0)topLed(i,c,a);}}


// =====================================================================
// TAKT – the rhythm game. Notes fall down four lanes (two pads wide) in time with the beat.
// Hit any of the two bottom pads in a lane as the note reaches the bottom row.
// =====================================================================
const LANE_COL=[COL.cyan,COL.pink,COL.yellow,COL.green];
const Takt={
 id:'takt',name:'Takt',color:COL.pink,
 how:'Ljusen faller i takt med musiken. Tryck på de två nedersta raderna i rätt fil precis när ljuset når botten. Träffa många i rad för dubbla, tredubbla och fyrdubbla poäng.',
 bpm:112,
 start(now){
  this.phase='play';
  this.row=60/this.bpm/2;            // one row per eighth note
  this.t0=now+1.2;                   // when beat 0 hits the bottom row
  this.notes=this.makeSong();
  this.score=0;this.combo=0;this.maxCombo=0;this.hits=0;this.flash=[];this.missFlash=[0,0,0,0];this.laneHit=[0,0,0,0];
  this.nextEvent=0;this.events=this.makeBacking();this.audioOff=null;
  this.end=this.t0+this.bars*8*this.row+1.2;
 },
 bars:24,
 // Seeded-feeling but fresh every time: a walking melody across the lanes, getting busier as the song goes on.
 makeSong(){
  const notes=[];let lane=rnd(4);
  for(let bar=1;bar<this.bars;bar++){
   const busy=bar<4?0:bar<10?.25:bar<18?.45:.6;
   for(let e=0;e<8;e++){
    const onBeat=e%2===0;
    if(!onBeat&&Math.random()>busy)continue;
    if(onBeat&&bar<4&&e%4!==0)continue;           // first bars: only beats 1 and 3
    if(onBeat&&Math.random()<.12)continue;          // a little air
    lane=Math.max(0,Math.min(3,lane+[-1,-1,0,1,1,2,-2][rnd(7)]));
    const time=this.t0+(bar*8+e)*this.row;
    notes.push({lane,time,done:false});
    if(bar>=12&&onBeat&&Math.random()<.18){ // a chord: two lanes at once
     const other=(lane+1+rnd(3))%4;notes.push({lane:other,time,done:false});
    }
   }
  }
  return notes;
 },
 // Drums and bass on the audio clock, scheduled a little ahead in update().
 makeBacking(){
  const ev=[],roots=[110,87.3,130.8,98];
  for(let bar=0;bar<this.bars;bar++)for(let e=0;e<8;e++){
   const time=this.t0+(bar*8+e)*this.row; // lands together with the notes
   if(e%4===0||(bar>=12&&e%2===0))ev.push([time,'kick']);
   if(e===2||e===6)ev.push([time,'snare']);
   ev.push([time,'hat']);
   if(e%2===0&&bar>=2)ev.push([time,'bass',roots[Math.floor(bar/2)%4]*(e===4?1.5:1)]);
  }
  return ev;
 },
 update(dt,now){
  if(this.phase==='over')return;
  // Music
  if(audioReady()){
   if(this.audioOff===null)this.audioOff=audioNow()-now;
   while(this.nextEvent<this.events.length&&this.events[this.nextEvent][0]<now+.15){
    const [time,kind,f]=this.events[this.nextEvent++],at=time+this.audioOff;
    if(time>=now-.02){if(kind==='bass')drum.bass(f,at);else drum[kind](at);}
   }
  }
  // Missed notes
  for(const n of this.notes)if(!n.done&&now-n.time>.16){n.done=true;n.missed=true;this.combo=0;this.missFlash[n.lane]=now;}
  if(now>this.end){
   const best=saveBest(this.id,this.score);
   gameOver(this,this.score,best?COL.gold:COL.pink,now);best?sfx.win():sfx.over();
  }
 },
 mult(){return Math.min(4,1+Math.floor(this.combo/8));},
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(ev.kind!=='pad'||!ev.down||ev.y<6)return;
  const lane=ev.x>>1;
  let best=null,bd=.16;
  for(const n of this.notes){if(n.done||n.lane!==lane)continue;const d=Math.abs(n.time-now);if(d<bd){bd=d;best=n;}}
  this.laneHit[lane]=now;
  if(!best){this.combo=0;tone(110,90,.06,'square',.05);return;}
  best.done=true;this.combo++;this.hits++;this.maxCombo=Math.max(this.maxCombo,this.combo);
  const perfect=bd<.07;
  this.score+=(perfect?100:50)*this.mult();
  this.flash.push({lane,at:now,perfect});
  sfx.hit(lane*2+(perfect?2:0));
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  // Lanes: faint guide at the bottom, brighter where you press
  for(let l=0;l<4;l++){
   const c=LANE_COL[l],pressed=now-this.laneHit[l]<.12,miss=now-this.missFlash[l]<.25;
   for(let k=0;k<2;k++){
    px(l*2+k,7,miss?COL.red:c,miss?.8:pressed?.7:.18);
    px(l*2+k,6,c,pressed?.35:.06);
   }
  }
  // Falling notes: y = 7 when it is time to hit
  for(const n of this.notes){
   if(n.done)continue;
   const y=7-(n.time-now)/this.row;
   if(y<-1||y>7.6)continue;
   const yi=Math.round(y),c=LANE_COL[n.lane];
   for(let k=0;k<2;k++){px(n.lane*2+k,yi,c);px(n.lane*2+k,yi-1,c,.25);}
  }
  // Hit sparkles
  this.flash=this.flash.filter(f=>now-f.at<.3);
  for(const f of this.flash){
   const a=1-(now-f.at)/.3;
   for(let k=0;k<2;k++){px(f.lane*2+k,7,COL.white,a);px(f.lane*2+k,6,f.perfect?COL.white:LANE_COL[f.lane],a*.6);}
   if(f.perfect){px(f.lane*2-1,7,LANE_COL[f.lane],a*.5);px(f.lane*2+2,7,LANE_COL[f.lane],a*.5);}
  }
  // Song progress on top, combo meter on the right (fills from the bottom, colour shows the multiplier)
  topBar(Math.max(0,Math.min(1,(now-this.t0)/(this.end-this.t0))),COL.purple);
  const m=this.mult(),mc=[COL.cyan,COL.green,COL.yellow,COL.pink][m-1];
  const fillN=m===4?8:this.combo%8;
  for(let i=0;i<fillN;i++)sideLed(7-i,mc);
  // Before the first note: count-in pulse on the bottom row
  if(now<this.t0)for(let x=0;x<8;x++)px(x,7,COL.white,.15+.25*pulse(now,2));
 },
 hud(){
  if(this.phase==='over'){const total=this.notes.length||1;return `Poäng ${this.score} · träffar ${Math.round(100*this.hits/total)} % · längsta serie ${this.maxCombo}`;}
  return `Poäng ${this.score} · serie ${this.combo} · ×${this.mult()}`;
 },
 demo(t){
  for(let l=0;l<4;l++){
   const c=LANE_COL[l];for(let k=0;k<2;k++)px(l*2+k,7,c,.25);
   for(let j=0;j<2;j++){const y=Math.floor((t*3.7+l*2.3+j*4)%9)-1;for(let k=0;k<2;k++){px(l*2+k,y,c);px(l*2+k,y-1,c,.25);}if(y===7)for(let k=0;k<2;k++)px(l*2+k,7,COL.white);}
  }
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
// PAD-PONG – two players. Red owns the bottom row, blue the top row. Press the pad (or one next to it)
// where the ball arrives, just in time. Pressing too early wastes your swing for a moment. First to 4.
// =====================================================================
const PONG_COL=[COL.red,COL.blue];
const PadPong={
 id:'pong',name:'Pad-pong',color:COL.blue,
 how:'Två spelare. Röd har nedersta raden, blå översta. Tryck på knappen där bollen kommer fram – precis när den är där. Kantknappen skickar bollen snett. Trycker du för tidigt hinner du inte igen. Först till 4.',
 window:.4,cool:.3,
 start(now){this.phase='play';this.score=[0,0];this.swings=[[],[]];this.coolUntil=[0,0];this.trail=[];this.serve(rnd(2),now);},
 serve(toward,now){
  this.ball={x:2+rnd(4),y:toward===0?3:4,dx:Math.random()<.5?-1:1,dy:toward===0?1:-1};
  this.interval=.3;this.acc=0;this.step='serve';this.stepAt=now;this.hits=0;this.trail=[];
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
  this.acc+=dt;
  while(this.acc>=this.interval&&this.step==='play'){this.acc-=this.interval;this.move(now);}
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
  if(this.phase==='over')return overInput(this,ev,now);
  if(ev.kind!=='pad'||!ev.down)return;
  const p=ev.y===7?0:ev.y===0?1:-1;if(p<0)return;
  if(now<this.coolUntil[p])return;
  this.swings[p].push({x:ev.x,at:now});
 },
 draw(now){
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
  const s=`Röd ${this.score[0]} – ${this.score[1]} Blå`;
  return this.phase==='over'?`${this.winner===0?'Röd':'Blå'} vann! ${s}`:s;
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
 id:'fargminne',name:'Färgminne',color:COL.yellow,isNew:true,
 how:'Plattan är fyra färgade fält. De lyser upp ett i taget i en viss ordning. Tryck sedan på fälten i samma ordning. Varje nivå blir ordningen ett steg längre.',
 legend:[[COL.green,'Grön'],[COL.red,'Röd'],[COL.yellow,'Gul'],[COL.blue,'Blå']],
 start(now){this.phase='play';this.seq=[];this.level=0;this.press=null;this.next(now);},
 next(now){
  this.level++;this.seq.push(rnd(4));this.pos=0;this.wrong=-1;this.shown=-1;
  this.step='level';this.stepAt=now;
  [0,2,4].forEach((n,i)=>tone(scaleHz(n+5+this.level%5),scaleHz(n+5+this.level%5),.16,'square',.07,audioNow()+.08+i*.12));
 },
 timing(){return {on:Math.max(.28,.6-this.level*.025),gap:Math.max(.1,.2-this.level*.007)};},
 beep(q,dur=.3){tone(FM_HZ[q],FM_HZ[q],dur,'square',.09);},
 update(dt,now){
  if(this.phase==='over')return;
  const t=now-this.stepAt;
  if(this.step==='level'&&t>1.8){this.step='pause';this.stepAt=now;}
  else if(this.step==='pause'&&t>.4){this.step='show';this.stepAt=now;}
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
  for(let q=0;q<4;q++)fmFill(q,FM_COL[q],this.step==='level'?.07:.14);
  if(this.step==='level'){
   // The level number lights up from the left in white, clearly over the four boards
   drawBigNumber(this.level,COL.white,Math.min(1,t/.5),0);
   for(let x=0;x<8;x++)px(x,7,FM_COL[fmQuad(x,7)],Math.min(1,t/.5)*.6);
  }else if(this.step==='show'){
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

const GAMES=[Fargminne,Takt,Mullvad,Minne,PadPong];
