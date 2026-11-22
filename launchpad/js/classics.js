'use strict';
// Classic board games on the Launchpad. Same shape as the games in games.js (start/update/draw/input/hud/demo).

// =====================================================================
// FYRA I RAD – drop pieces into the 7 columns; four of your colour in a row (across, up or diagonally) wins.
// The pieces fall down through the rows as light. You are yellow. Against the computer (red) every win makes
// it think one move further ahead (C4_LEVELS); losing ends the run (record = wins in a row).
// Keys on the top row switches between the computer and two players taking turns on the same pad.
// The far-right column of pads glows in the colour of whoever's turn it is.
// Board: columns x 0..6, rows y 2..7 (r 0..5 in the code, 0 = top). The pieces start at the top row and fall.
// =====================================================================
const C4_W=7,C4_H=6,C4_TOP=2,C4_ORDER=[3,2,4,1,5,0,6];
const C4_COL=[null,[1,.72,0],[1,0,0]],C4_BOARD=[0,.15,.7];
const C4_LEVELS=[{depth:1,miss:.4},{depth:2,miss:.25},{depth:2,miss:.1},{depth:3,miss:.05},{depth:4,miss:0},{depth:5,miss:0},{depth:6,miss:0},{depth:7,miss:0}];
const c4Row=(b,c)=>{for(let r=C4_H-1;r>=0;r--)if(!b[c*C4_H+r])return r;return -1;}; // lowest free row, -1 = full
function c4Line(b,c,r,p){ // the four (or more) through (c,r) for player p, or null
 for(const [dc,dr] of [[1,0],[0,1],[1,1],[1,-1]]){
  const cells=[[c,r]];
  for(const s of [1,-1]){let x=c+dc*s,y=r+dr*s;while(x>=0&&x<C4_W&&y>=0&&y<C4_H&&b[x*C4_H+y]===p){cells.push([x,y]);x+=dc*s;y+=dr*s;}}
  if(cells.length>=4)return cells;
 }
 return null;
}
// How good the board looks for p: every line of four with only p's pieces in it counts, the middle column extra.
function c4Eval(b,p){
 const o=3-p;let s=0;
 for(let r=0;r<C4_H;r++){const v=b[3*C4_H+r];if(v===p)s+=3;else if(v===o)s-=3;}
 for(const [dc,dr] of [[1,0],[0,1],[1,1],[1,-1]])for(let c=0;c<C4_W;c++)for(let r=0;r<C4_H;r++){
  const ec=c+dc*3,er=r+dr*3;if(ec<0||ec>=C4_W||er<0||er>=C4_H)continue;
  let m=0,t=0;for(let i=0;i<4;i++){const v=b[(c+dc*i)*C4_H+r+dr*i];if(v===p)m++;else if(v===o)t++;}
  if(!t)s+=m===3?6:m===2?2:0;else if(!m)s-=t===3?8:t===2?2:0;
 }
 return s;
}
// Negamax with alpha-beta: the best score p can get looking `depth` moves ahead.
function c4Search(b,depth,alpha,beta,p){
 let best=-1e9,any=false;
 for(const c of C4_ORDER){
  const r=c4Row(b,c);if(r<0)continue;any=true;
  b[c*C4_H+r]=p;
  const v=c4Line(b,c,r,p)?1000+depth:depth<=1?c4Eval(b,p):-c4Search(b,depth-1,-beta,-alpha,3-p);
  b[c*C4_H+r]=0;
  if(v>best)best=v;if(v>alpha)alpha=v;if(alpha>=beta)break;
 }
 return any?best:0; // a full board is a draw
}
function c4Best(b,depth,p){
 let best=-1e9,cols=[];
 for(const c of C4_ORDER){
  const r=c4Row(b,c);if(r<0)continue;
  b[c*C4_H+r]=p;
  const v=c4Line(b,c,r,p)?1e6:depth<=1?c4Eval(b,p):-c4Search(b,depth-1,-1e9,1e9,3-p);
  b[c*C4_H+r]=0;
  if(v>best){best=v;cols=[c];}else if(v===best)cols.push(c);
 }
 return cols[rnd(cols.length)];
}
const FyraIRad={
 id:'fyraIRad',name:'Fyra i rad',color:[1,.05,.05],
 how:'Släpp brickor i de sju kolumnerna genom att trycka var som helst i en kolumn – brickan faller ner genom raderna. Först med fyra i rad vågrätt, lodrätt eller snett vinner. Du är gul. Mot datorn (röd) blir den smartare för varje gång du vinner, och förlorar du är det slut. Keys på översta raden växlar mellan en spelare mot datorn och två spelare på samma platta. Kolumnen längst till höger på plattan lyser i färgen för den som ska lägga.',
 legend:[[C4_COL[1],'Gul – du (spelare 1)'],[C4_COL[2],'Röd – datorn eller spelare 2'],[C4_BOARD,'Tomma hål']],
 start(now){
  this.phase='play';this.mode=this.mode||'cpu';this.streak=0;this.score=[0,0,0];this.starter=1;this.newRound(now);
 },
 newRound(now){
  this.b=new Uint8Array(C4_W*C4_H);this.turn=this.starter;this.state='turn';this.anim=null;this.line=null;this.winner=0;
  this.thinkAt=now+.6;
 },
 level(){return C4_LEVELS[Math.min(this.streak,C4_LEVELS.length-1)];},
 cpuTurn(){return this.mode==='cpu'&&this.turn===2;},
 drop(c,now){
  const r=c4Row(this.b,c);if(r<0){tone(140,140,.07,'square',.05);return;}
  this.anim={c,r,p:this.turn,y:0,vy:5,row:0};this.state='drop';
 },
 land(now){
  const {c,r,p}=this.anim;this.b[c*C4_H+r]=p;this.anim=null;
  tone(260-r*12,120,.08,'square',.09);noise(.05,1800,.07,0,'bandpass');
  const line=c4Line(this.b,c,r,p);
  if(line){
   this.line=line;this.winner=p;this.state='won';this.endAt=now;
   if(this.mode==='cpu'){if(p===1){this.streak++;sfx.win();}else sfx.over();}
   else{this.score[p]++;sfx.win();}
   return;
  }
  if(this.b.every(v=>v)){this.state='draw';this.endAt=now;sfx.over();return;}
  this.turn=3-p;this.state='turn';this.thinkAt=now+.5;
 },
 update(dt,now){
  if(this.phase==='over')return;
  if(this.state==='drop'){
   const a=this.anim;a.vy+=40*dt;a.y+=a.vy*dt;
   const target=C4_TOP+a.r,row=Math.floor(a.y);
   if(row>a.row&&row<target){a.row=row;tone(900-row*60,900-row*60,.025,'triangle',.04);}
   if(a.y>=target){a.y=target;this.land(now);}
   return;
  }
  if(this.state==='turn'&&this.cpuTurn()&&now>=this.thinkAt){
   const L=this.level();let c;
   const free=C4_ORDER.filter(x=>c4Row(this.b,x)>=0);
   c=Math.random()<L.miss?free[rnd(free.length)]:c4Best(this.b,L.depth,2);
   this.drop(c,now);
   return;
  }
  if((this.state==='won'&&now-this.endAt>2.6)||(this.state==='draw'&&now-this.endAt>1.6)){
   if(this.mode==='cpu'&&this.winner===2){const s=this.streak;saveBest(this.id,s);gameOver(this,s,COL.yellow,now);return;}
   this.state='clear';this.clearAt=now;tone(500,90,.6,'sawtooth',.05);
  }
  if(this.state==='clear'&&now-this.clearAt>.8){this.starter=3-this.starter;this.newRound(now);}
 },
 input(ev,now){
  if(playersInput(this,ev,now))return;
  if(this.phase==='over')return overInput(this,ev,now);
  if(!ev.down)return;
  if(ev.kind==='pad'&&this.state==='turn'&&!this.cpuTurn()&&ev.x<C4_W)this.drop(ev.x,now);
 },
 drawBoard(b,now,line,anim,shift=0){
  for(let c=0;c<C4_W;c++)for(let r=0;r<C4_H;r++){
   const p=b[c*C4_H+r],y=C4_TOP+r;
   if(!shift)px(c,y,C4_BOARD,.1);
   if(!p)continue;
   const inLine=line&&line.some(([x,yy])=>x===c&&yy===r);
   if(line)px(c,y+shift,inLine?(Math.sin(now*14)>0?COL.white:C4_COL[p]):C4_COL[p],inLine?1:.25);
   else px(c,Math.floor(y+shift),C4_COL[p],.85);
  }
  if(anim){ // the falling piece, with a fading trail of light above it
   const y=Math.floor(anim.y);
   for(let k=1;k<=3;k++)px(anim.c,y-k,C4_COL[anim.p],.35/k);
   px(anim.c,y,mix(C4_COL[anim.p],COL.white,.3));
  }
 },
 draw(now){
  if(drawPlayers(this,now))return;
  if(this.phase==='over')return drawOver(this,now);
  const shift=this.state==='clear'?Math.pow((now-this.clearAt)/.8,2)*8:0;
  this.drawBoard(this.b,now,this.state==='won'?this.line:null,this.anim,shift);
  // Whose turn: the far-right column of pads
  if(this.state==='turn'||this.state==='drop'){
   const thinking=this.cpuTurn()&&this.state==='turn';
   for(let y=0;y<8;y++)px(7,y,C4_COL[this.turn],.15+.2*pulse(now+y*.08,thinking?4:1.2));
  }
  if(this.mode==='cpu')for(let i=0;i<6;i++)topLed(i,COL.gold,i<this.streak?.8:.04);
  else for(let i=0;i<3;i++){topLed(i,C4_COL[1],i<this.score[1]?.8:.05);topLed(3+i,C4_COL[2],i<this.score[2]?.8:.05);}
 },
 hud(){
  if(this.phase==='over')return `Datorn vann. Du vann ${this.streak} ${this.streak===1?'gång':'gånger'} i rad – tryck på plattan för att spela igen.`;
  if(this.mode==='cpu'){
   const lv=`vinster i rad: ${this.streak} · datorns nivå ${Math.min(this.streak,C4_LEVELS.length-1)+1}`;
   if(this.state==='won')return this.winner===1?`Fyra i rad – du vann! ${lv}`:'Datorn fick fyra i rad.';
   if(this.state==='draw')return `Oavgjort – ny omgång. ${lv}`;
   return `1 spelare · du är gul · ${this.cpuTurn()?'datorn tänker…':'din tur'} · ${lv}`;
  }
  const s=`Gul ${this.score[1]} – Röd ${this.score[2]}`;
  if(this.state==='won')return `${this.winner===1?'Gul':'Röd'} fick fyra i rad! ${s}`;
  if(this.state==='draw')return `Oavgjort. ${s}`;
  return `2 spelare · ${s} · ${this.turn===1?'gul':'röd'} lägger`;
 },
 demo(t){
  const moves=[3,2,3,2,3,4,3],step=.6,cyc=moves.length*step+1.8,k=t%cyc,n=Math.min(moves.length,Math.floor(k/step));
  const b=new Uint8Array(C4_W*C4_H);let last=null;
  for(let i=0;i<n;i++){const c=moves[i],r=c4Row(b,c);b[c*C4_H+r]=i%2?2:1;last=[c,r,i%2?2:1];}
  let anim=null;
  if(n<moves.length){const c=moves[n],r=c4Row(b,c),f=(k-n*step)/step;if(f<.5)anim={c,p:n%2?2:1,y:Math.min(C4_TOP+r,(f/.5)**2*(C4_TOP+r))};}
  const line=n===moves.length&&last?c4Line(b,last[0],last[1],last[2]):null;
  this.drawBoard(b,t,line,anim);
 }
};

// =====================================================================
// SLÄCK ALLT – a lights-out puzzle. Pressing a lamp switches it and the four next to it (up, down, left,
// right). Put every lamp out. The board grows from 3 × 3 to 8 × 8 (LO_LEVELS: size, random presses).
// Every puzzle is made by pressing random lamps on a dark board, so it can always be solved.
// par = the fewest presses that solve it (loSolve()). Gold lights on the top row = presses left for ★★★.
// Right column: 1 = hint (one pad of the shortest way blinks; a level with hints gives at most ★★),
// 8 = start the level over.
// =====================================================================
const LO_LEVELS=[[3,2],[3,3],[4,3],[4,4],[5,4],[5,5],[6,5],[6,6],[7,6],[7,7],[8,8],[8,10]];
const LO_ON=[1,.75,.25],LO_OFF=[.1,.3,1];
function loToggle(n,lit,k){
 const x=k%n,y=k/n|0;
 for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X>=0&&X<n&&Y>=0&&Y<n)lit[X+Y*n]^=1;}
}
// The shortest set of presses that puts out every lamp in `lit` (n × n). Gauss–Jordan elimination over GF(2)
// (presses are xor); when there is more than one answer, all of them are tried. null = can't be solved.
function loSolve(n,lit){
 const N=n*n,A=[];
 for(let i=0;i<N;i++){const row=new Uint8Array(N+1),probe=new Uint8Array(N);loToggle(n,probe,i);for(let j=0;j<N;j++)row[j]=probe[j];row[N]=lit[i];A.push(row);}
 const piv=[];let r=0;
 for(let c=0;c<N&&r<N;c++){
  let p=-1;for(let i=r;i<N;i++)if(A[i][c]){p=i;break;}
  if(p<0)continue;
  [A[r],A[p]]=[A[p],A[r]];
  for(let i=0;i<N;i++)if(i!==r&&A[i][c])for(let k=c;k<=N;k++)A[i][k]^=A[r][k];
  piv.push(c);r++;
 }
 for(let i=r;i<N;i++)if(A[i][N])return null;
 const isPiv=new Uint8Array(N);for(const c of piv)isPiv[c]=1;
 const free=[];for(let c=0;c<N;c++)if(!isPiv[c])free.push(c);
 let best=null,bestN=1e9;
 for(let m=0;m<1<<free.length;m++){
  const x=new Uint8Array(N);free.forEach((c,i)=>{x[c]=(m>>i)&1;});
  for(let i=0;i<r;i++){let v=A[i][N];for(const c of free)if(A[i][c]&&x[c])v^=1;x[piv[i]]=v;}
  const cnt=x.reduce((a,b)=>a+b,0);if(cnt<bestN){bestN=cnt;best=x;}
 }
 return best;
}
function loMake(i){
 const [n,k]=LO_LEVELS[i];
 for(let tries=0;;tries++){
  const lit=new Uint8Array(n*n),cells=[...Array(n*n).keys()].sort(()=>Math.random()-.5).slice(0,k);
  for(const c of cells)loToggle(n,lit,c);
  const par=loSolve(n,lit).reduce((a,b)=>a+b,0);
  if(par>=Math.max(2,k-1)||tries>40)return {n,lit,par};
 }
}
const SlackAllt={
 id:'slackallt',name:'Släck allt',color:[.6,1,0],
 how:'Ett ljuspussel. När du trycker på en lampa slås den och de fyra bredvid (upp, ner, vänster, höger) om – tända släcks och släckta tänds. Släck alla lampor! Brädet växer från 3 × 3 till hela plattan. Guldljusen på översta raden visar hur många tryck du har kvar för tre stjärnor. Översta knappen i högerkolumnen ger ett tips (då blir det högst två stjärnor), den nedersta börjar om nivån.',
 legend:[[LO_ON,'Tänd lampa'],[LO_OFF,'Släckt lampa'],[COL.cyan,'Tips']],
 start(now){this.phase='play';this.lv=0;this.stars=0;this.go(now);},
 go(now){
  const P=loMake(this.lv);this.n=P.n;this.par=P.par;this.startLit=P.lit;this.lit=P.lit.slice();
  this.moves=0;this.hints=0;this.state='play';this.stepAt=now;this.flashes=[];this.hint=null;
 },
 off(){return Math.floor((8-this.n)/2);},
 starsFor(){const s=this.moves<=this.par?3:this.moves<=this.par+3?2:1;return this.hints?Math.min(2,s):s;},
 update(dt,now){
  if(this.phase==='over')return;
  if(this.state==='win'&&now-this.stepAt>2.2){
   this.lv++;
   if(this.lv>=LO_LEVELS.length){saveBest(this.id,this.stars);gameOver(this,this.stars,COL.gold,now);sfx.win();}
   else this.go(now);
  }
 },
 input(ev,now){
  if(this.phase==='over')return overInput(this,ev,now);
  if(!ev.down||this.state!=='play')return;
  if(ev.kind==='pad'&&!this.moves&&now-this.stepAt<.6)return; // the level number is still showing
  if(ev.kind==='side'&&ev.i===7){this.lit=this.startLit.slice();this.moves=0;this.hint=null;sfx.menu();return;}
  if(ev.kind==='side'&&ev.i===0){
   const sol=loSolve(this.n,this.lit),k=sol?sol.indexOf(1):-1;
   if(k>=0){this.hint={k,at:now};this.hints++;sfx.tick();}
   return;
  }
  if(ev.kind!=='pad')return;
  const o=this.off(),x=ev.x-o,y=ev.y-o,n=this.n;
  if(x<0||x>=n||y<0||y>=n){tone(140,140,.05,'square',.04);return;}
  const k=x+y*n;loToggle(n,this.lit,k);this.moves++;this.lastK=k;
  if(this.hint&&this.hint.k===k)this.hint=null;
  this.flashes.push({k,at:now});
  const left=this.lit.reduce((a,b)=>a+b,0);
  if(!left){this.state='win';this.stepAt=now;this.got=this.starsFor();this.stars+=this.got;sfx.win();}
  else tone(scaleHz(Math.min(14,left)),scaleHz(Math.min(14,left)),.09,'triangle',.08);
 },
 drawBoard(n,lit,now){
  const o=Math.floor((8-n)/2);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const on=lit[x+y*n];px(o+x,o+y,on?LO_ON:LO_OFF,on?.85:.08);
  }
 },
 draw(now){
  if(this.phase==='over')return drawOver(this,now);
  const n=this.n,o=this.off(),t=now-this.stepAt;
  if(this.state==='play'&&t<.7&&this.moves===0){drawBigNumber(this.lv+1,LO_ON,Math.min(1,t/.2),0);return;}
  this.drawBoard(n,this.lit,now);
  // The pressed pad and its neighbours flash white for a moment
  this.flashes=this.flashes.filter(f=>now-f.at<.18);
  for(const f of this.flashes){const a=1-(now-f.at)/.18,x=f.k%n,y=f.k/n|0;
   for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X>=0&&X<n&&Y>=0&&Y<n)px(o+X,o+Y,COL.white,a*.7);}}
  if(this.hint&&this.state==='play')px(o+this.hint.k%n,o+(this.hint.k/n|0),COL.cyan,Math.sin(now*12)>0?1:.25);
  if(this.state==='win'){ // a rainbow ring spreading out from the last press
   const lx=o+this.lastK%n,ly=o+(this.lastK/n|0);
   for(let y=0;y<8;y++)for(let x=0;x<8;x++){const d=Math.hypot(x-lx,y-ly),b=Math.max(0,1-Math.abs(d-t*7)/1.2)*Math.max(0,1-t/1.5);if(b>0)px(x,y,hue(wrap01(d/10+t)),b);}
   for(let i=0;i<3;i++)topLed(i,COL.gold,i<this.got?1:.08);
  }
  else for(let i=0;i<7;i++)topLed(i,COL.gold,i<this.par-this.moves?.6:.04);
  sideLed(0,COL.cyan,.4);sideLed(7,COL.red,.35);
 },
 hud(){
  const L=LO_LEVELS.length;
  if(this.phase==='over')return `Alla ${L} nivåer klara! ${this.stars} av ${L*3} stjärnor`;
  if(this.state==='win')return `Släckt! ${'★'.repeat(this.got)}${'☆'.repeat(3-this.got)} – ${this.moves} tryck (bästa möjliga ${this.par})`;
  return `Nivå ${this.lv+1} av ${L} · ${this.n} × ${this.n} · ${this.moves} tryck (${this.par} ger ★★★)${this.hints?' · tips använt':''} · stjärnor ${this.stars}`;
 },
 demo(t){
  const n=5,presses=[6,12,18,8],cyc=presses.length*.7+2.2,k=t%cyc,done=Math.min(presses.length,Math.floor(k/.7));
  const lit=new Uint8Array(25);for(const p of presses)loToggle(n,lit,p);
  for(let i=0;i<done;i++)loToggle(n,lit,presses[i]);
  this.drawBoard(n,lit,t);
  if(done<presses.length){const p=presses[done],f=(k-done*.7)/.7;if(f>.6)px(1+p%5,1+(p/5|0),COL.white,(f-.6)*2.5);}
  else{const w=k-presses.length*.7;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const d=Math.hypot(x-3,y-3),b=Math.max(0,1-Math.abs(d-w*7)/1.2)*Math.max(0,1-w/1.5);if(b>0)px(x,y,hue(wrap01(d/10+w)),b);}}
 }
};

// =====================================================================
// SÄNKA SKEPP – battleships. The pad is the sea you shoot at: press a pad to fire. Blue = miss, orange = hit,
// red = sunk. The water around a sunk ship gets marked too (ships never touch, not even corner to corner).
// A hit gives you another shot. 1 player: you against the computer, which shoots back at your fleet (shown in
// white while it is the computer's turn). Before the battle you see your fleet; the bottom button of the right
// column deals a new one. 2 players: take turns on the same pad, which always shows the sea being shot at.
// Keys on the top row switches between 1 and 2 players.
// Top row 0..4: the ships you are shooting at (lit = still afloat). Right column 0..4: your own ships.
// =====================================================================
const BS_SLOPPY=.7,BS_FLEET=[4,3,3,2,2],BS_NAMES={4:'slagskeppet',3:'kryssaren',2:'jagaren'};
const BS_MISS=[0,.35,1],BS_HIT=[1,.45,0],BS_SUNK=[1,0,0],BS_SHIP=[.75,.8,.85],BS_PCOL=[null,[1,.8,0],[.2,1,.6]];
function bsNear(occ,k){const x=k&7,y=k>>3;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X>=0&&X<8&&Y>=0&&Y<8&&occ[X+Y*8])return true;}return false;}
function bsFleet(){ // a random fleet where no ship touches another
 for(;;){
  const occ=new Uint8Array(64),ships=[];
  for(const len of BS_FLEET){
   for(let t=0;t<200;t++){
    const hor=Math.random()<.5,x0=rnd(hor?9-len:8),y0=rnd(hor?8:9-len),cells=[];
    for(let i=0;i<len;i++)cells.push(hor?(x0+i)+y0*8:x0+(y0+i)*8);
    if(cells.every(k=>!bsNear(occ,k))){cells.forEach(k=>occ[k]=1);ships.push({len,cells,hits:0,sunk:false});break;}
   }
  }
  if(ships.length===BS_FLEET.length)return ships;
 }
}
// A sea: the ships in it and the shots fired at it. shot: 0 not yet, 1 miss, 2 hit, 3 sunk, 4 water next to a sunk ship.
const bsBoard=()=>({ships:bsFleet(),shot:new Uint8Array(64)});
function bsFire(B,k){ // → 'miss' | 'hit' | 'sunk' | 'win', or null when that pad has been shot already
 if(B.shot[k])return null;
 const s=B.ships.find(s=>s.cells.includes(k));
 if(!s){B.shot[k]=1;return 'miss';}
 B.shot[k]=2;s.hits++;
 if(s.hits<s.len)return 'hit';
 s.sunk=true;
 for(const c of s.cells){
  B.shot[c]=3;const x=c&7,y=c>>3;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy,n=X+Y*8;if(X>=0&&X<8&&Y>=0&&Y<8&&!B.shot[n])B.shot[n]=4;}
 }
 return B.ships.every(s=>s.sunk)?'win':'sunk';
}
// The computer's aim: count, for every pad, how many ways the ships still afloat could lie across it.
// Once it has a hit it only counts the ways through that hit (much more for two hits in a line), so it
// finishes the ship off. To give people a chance it often shoots somewhere at random while hunting
// (BS_SLOPPY) and sometimes misjudges which way a found ship lies.
function bsAim(B){
 const free=[];for(let k=0;k<64;k++)if(!B.shot[k])free.push(k);
 const hunting=!B.shot.some(v=>v===2);
 if(Math.random()<(hunting?BS_SLOPPY:BS_SLOPPY*.4))return free[rnd(free.length)];
 const score=new Float32Array(64);
 for(const s of B.ships){if(s.sunk)continue;const len=s.len;
  for(const hor of [true,false])for(let y0=0;y0<(hor?8:9-len);y0++)for(let x0=0;x0<(hor?9-len:8);x0++){
   let hits=0,bad=false;const cells=[];
   for(let i=0;i<len;i++){const k=hor?(x0+i)+y0*8:x0+(y0+i)*8,v=B.shot[k];if(v===1||v===3||v===4){bad=true;break;}if(v===2)hits++;cells.push(k);}
   if(bad||(!hunting&&!hits))continue;
   const w=hunting?1:Math.pow(Math.random()<.25?2:20,hits);
   for(const k of cells)if(!B.shot[k])score[k]+=w;
  }
 }
 let best=-1,cand=[];
 for(const k of free){if(score[k]>best){best=score[k];cand=[k];}else if(score[k]===best)cand.push(k);}
 return cand[rnd(cand.length)];
}
const SankaSkepp={
 id:'sankaskepp',name:'Sänka skepp',color:[0,.45,1],
 how:'Plattan är havet du skjuter på – tryck på en ruta för att skjuta. Blått är miss, orange träff och rött ett sänkt skepp. Vattnet runt ett sänkt skepp markeras också, för skeppen ligger aldrig kant i kant. Träffar du får du skjuta igen. Mot datorn ser du först din egen flotta: den nedersta knappen i högerkolumnen ger en ny, och ett tryck på plattan startar. När datorn skjuter visas din flotta i vitt. Två spelare turas om på samma platta. Keys på översta raden växlar mellan 1 och 2 spelare. Översta raden visar skeppen du skjuter på, högerkolumnen dina egna.',
 legend:[[BS_MISS,'Miss'],[BS_HIT,'Träff'],[BS_SUNK,'Sänkt skepp'],[BS_SHIP,'Din flotta'],[BS_PCOL[1],'Spelare 1'],[BS_PCOL[2],'Spelare 2']],
 start(now){
  this.mode=this.mode||'cpu';this.phase='play';
  this.boards=[null,bsBoard(),bsBoard()]; // boards[p] = player p's own sea
  this.turn=1;this.shots=[0,0,0];this.hits=[0,0,0];this.fx=null;this.msg='';
  this.state=this.mode==='cpu'?'place':'aim';this.at=now;
 },
 cpuTurn(){return this.mode==='cpu'&&this.turn===2;},
 target(){return this.boards[3-this.turn];},
 fire(k,now){this.fx={k,at:now,res:null};this.state='fire';this.at=now;tone(1300,350,.32,'sine',.035);},
 update(dt,now){
  if(this.phase==='over')return;
  const t=now-this.at;
  if(this.state==='fire'&&t>=.35){
   const B=this.target(),res=bsFire(B,this.fx.k);
   this.fx.res=res;this.fx.at=now;this.shots[this.turn]++;if(res!=='miss')this.hits[this.turn]++;
   if(res==='miss'){sea.splash();this.msg='Miss.';}
   else{tone(90,35,.45,'sine',.45);noise(.4,700,.2,0,'lowpass');}
   if(res==='hit')this.msg='Träff! Skjut igen.';
   if(res==='sunk'||res==='win'){const s=B.ships.find(s=>s.cells.includes(this.fx.k));this.msg=`Sänkte ${BS_NAMES[s.len]}!`;sea.bubbles();}
   this.state=res==='win'?'won':'result';this.at=now;
   if(res==='win')(this.cpuTurn()?sfx.over:sfx.win)();
   return;
  }
  if(this.state==='result'&&t>=(this.fx.res==='miss'?.8:this.fx.res==='sunk'?1.3:.6)){
   if(this.fx.res==='miss'){this.turn=3-this.turn;this.state='switch';}
   else this.state=this.cpuTurn()?'cpuAim':'aim';
   this.at=now;return;
  }
  if(this.state==='switch'&&t>=(this.mode==='two'?1:.5)){this.state=this.cpuTurn()?'cpuAim':'aim';this.at=now;return;}
  if(this.state==='cpuAim'&&t>=.8){this.fire(bsAim(this.boards[1]),now);return;}
  if(this.state==='won'&&t>=3.2){
   if(this.mode==='cpu'){
    if(this.turn===1){const pct=Math.round(100*this.hits[1]/this.shots[1]);saveBest(this.id,pct);gameOver(this,`${pct}`,COL.gold,now);}
    else gameOver(this,'DATORN VANN',COL.red,now);
   }else gameOver(this,`SPELARE ${this.turn} VANN`,BS_PCOL[this.turn],now);
  }
 },
 input(ev,now){
  if(playersInput(this,ev,now))return;
  if(this.phase==='over')return overInput(this,ev,now);
  if(!ev.down)return;
  if(this.state==='place'){
   if(ev.kind==='side'&&ev.i===7){this.boards[1]=bsBoard();sfx.tick();}
   else if(ev.kind==='pad'){this.state='aim';this.at=now;sfx.menu();}
   return;
  }
  if(ev.kind!=='pad'||this.state!=='aim'||this.cpuTurn())return;
  const k=ev.x+ev.y*8;
  if(this.target().shot[k]){tone(140,140,.06,'square',.04);return;}
  this.fire(k,now);
 },
 drawSea(B,ships,now){
  for(let k=0;k<64;k++){
   const x=k&7,y=k>>3,v=B.shot[k];
   if(v===1)px(x,y,BS_MISS,.55);
   else if(v===2)px(x,y,BS_HIT,.8+.2*pulse(now+k*.1,2));
   else if(v===3)px(x,y,BS_SUNK,.75);
   else if(v===4)px(x,y,BS_MISS,.14);
   else{
    px(x,y,[0,.2,.6],.05+.04*Math.sin(now*1.6+x*.8+y*1.1)); // the waves
    if(ships&&B.ships.some(s=>s.cells.includes(k)))px(x,y,BS_SHIP,.45);
   }
  }
 },
 drawFx(now){
  const f=this.fx;if(!f)return;
  const x=f.k&7,y=f.k>>3,t=now-f.at;
  if(this.state==='fire'){ // the shell coming down the column
   const yy=Math.min(y,Math.floor(t/.35*(y+1)));px(x,yy,COL.white);if(yy>0)px(x,yy-1,COL.white,.3);px(x,y,COL.white,.25+.25*pulse(now,8));return;
  }
  if(t>.7)return;
  const c=f.res==='miss'?BS_MISS:f.res==='hit'?BS_HIT:BS_SUNK;
  for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const d=Math.hypot(xx-x,yy-y),a=Math.max(0,1-Math.abs(d-t*7)/1)*(1-t/.7);if(a>0)px(xx,yy,c,a*.7);}
  if(t<.15)px(x,y,COL.white,1-t/.15);
  if(f.res==='sunk'||f.res==='win'){const s=this.target().ships.find(s=>s.cells.includes(f.k));if(s&&t<.5)for(const k of s.cells)px(k&7,k>>3,COL.white,(1-t/.5)*(Math.sin(t*40)>0?1:.4));}
 },
 draw(now){
  if(drawPlayers(this,now))return;
  if(this.phase==='over')return drawOver(this,now);
  const t=now-this.at;
  if(this.state==='place'){this.drawSea(this.boards[1],true,now);sideLed(7,COL.white,.4+.5*pulse(now,2));}
  else if(this.state==='switch'&&this.mode==='two'){drawBigNumber(this.turn,BS_PCOL[this.turn],Math.min(1,t/.15));}
  else if(this.state==='won'){const B=this.target();this.drawSea(B,true,now);this.drawFx(now);}
  else{
   // The computer shooting: your own sea with your ships. Otherwise the sea you are shooting at.
   const mine=this.cpuTurn();
   this.drawSea(mine?this.boards[1]:this.target(),mine,now);
   this.drawFx(now);
   if(this.state==='aim'&&t<.3)fill(this.mode==='two'?BS_PCOL[this.turn]:COL.white,.12*(1-t/.3));
  }
  // Top row: the ships being shot at. Right column: the shooter's own (in 1 player: always yours).
  const enemy=this.state==='place'?this.boards[2]:this.target(),own=this.boards[this.mode==='cpu'?1:this.turn];
  enemy.ships.forEach((s,i)=>topLed(i,s.sunk?BS_SUNK:BS_HIT,s.sunk?.08:.5));
  if(this.state!=='place')own.ships.forEach((s,i)=>sideLed(i,s.sunk?BS_SUNK:BS_SHIP,s.sunk?.25:.4));
 },
 hud(){
  if(this.phase==='over'){
   if(this.mode==='two')return `Spelare ${this.turn} sänkte hela flottan på ${this.shots[this.turn]} skott! Tryck på plattan för en ny match.`;
   return this.turn===1?`Du vann! ${this.hits[1]} träffar på ${this.shots[1]} skott (${Math.round(100*this.hits[1]/this.shots[1])} %).`:'Datorn sänkte din flotta. Tryck på plattan för att spela igen.';
  }
  const who=this.mode==='two'?`Spelare ${this.turn}`:this.cpuTurn()?'Datorn':'Du';
  if(this.state==='place')return '1 spelare · Det här är din flotta. Nedersta knappen i högerkolumnen ger en ny – tryck på plattan för att börja.';
  if(this.state==='won')return this.mode==='two'?`Spelare ${this.turn} vann!`:this.turn===1?'Du sänkte hela flottan!':'Datorn sänkte hela din flotta.';
  if(this.state==='switch')return this.mode==='two'?`Spelare ${this.turn}s tur – den andra tittar bort.`:this.cpuTurn()?'Datorns tur.':'Din tur.';
  const left=this.target().ships.filter(s=>!s.sunk).length;
  const tail=`${this.hits[this.turn]} träffar på ${this.shots[this.turn]} skott · ${left} skepp kvar att sänka`;
  if(this.state==='result')return `${who}: ${this.msg} · ${tail}`;
  if(this.cpuTurn())return `${playersText(this)} · Datorn skjuter på din flotta…`;
  return `${playersText(this)} · ${who==='Du'?'Din tur att skjuta':`${who} skjuter`} · ${tail}`;
 },
 demo(t){
  const shots=[[2,2],[5,1],[3,5],[4,5],[5,5],[6,5],[1,6],[6,2],[0,0]],ship=[3,4,5,6].map(x=>x+5*8);
  const n=Math.floor(t/.5)%(shots.length+4);
  const B={ships:[{len:4,cells:ship,hits:0,sunk:false}],shot:new Uint8Array(64)};
  for(let i=0;i<Math.min(n,shots.length);i++){const k=shots[i][0]+shots[i][1]*8;bsFire(B,k);}
  this.drawSea(B,false,t);
 }
};
