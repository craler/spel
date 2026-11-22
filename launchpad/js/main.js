'use strict';
// Launchpad Legends: the menu on the Launchpad, the game loop and the screen.
//
// Menu: the grid plays a rainbow light show. Pressing a pad sends coloured rings out from it.
// The right column is the game list – one round button per game, in its colour. Pressing one previews
// that game on the grid (its name scrolls by, then a demo). Press the same button again, or anywhere on
// the grid, to play. ▲ ▼ on the top row also step through the games. Holding the mouse over a game in the
// list on the screen previews it the same way. Nobody touching it for a while: back to the light show.
// Anywhere: hold the top-right round button (User, lit red) for a moment to go back to the menu.

const $=s=>document.querySelector(s);
let current=null,clock=0,last=performance.now()/1000,introAt=-9;
let sel=0,lastTouch=0,starting=null,backDownAt=null;
let preview=null,previewAt=0,previewBy=null; // the game shown on the grid in the menu, null = light show
const BACK_HOLD=.6,PREVIEW_IDLE=15;
const now=()=>clock;

// ---- Menu light show. Each show is a colour for every pad; they take turns and fade into each other.
const TAU=Math.PI*2,hash=n=>{n=Math.imul(n^n>>>15,0x2c1b3c6d);n=Math.imul(n^n>>>12,0x297a2d39);return (n^n>>>15)>>>0;};
const wrap1=v=>((v%1)+1)%1;
const SHOWS=[
 // Rainbow waves rolling diagonally across the grid
 (x,y,t)=>hue(wrap1((x+y)/14-t*.35)),
 // Plasma: soft rainbow blobs that drift around
 (x,y,t)=>{const v=Math.sin(x*.7+t*1.3)+Math.sin(y*.6-t*1.1)+Math.sin((x+y)*.45+t*.7)+Math.sin(Math.hypot(x-3.5,y-3.5)*.9-t*2);return hue(wrap1(v/8+t*.05));},
 // A spinning rainbow pinwheel
 (x,y,t)=>hue(wrap1(Math.atan2(y-3.5,x-3.5)/TAU+t*.3+Math.hypot(x-3.5,y-3.5)*.05)),
 // Rings pulsing out from the middle
 (x,y,t)=>{const d=Math.hypot(x-3.5,y-3.5),b=.5+.5*Math.sin((d*.9-t*2.6)*Math.PI);return dim(hue(wrap1(d/12-t*.12)),b*b);},
 // Equaliser: bars bouncing to an imaginary beat, green at the bottom, red at the top
 (x,y,t)=>{const h=1.5+6.5*Math.abs(Math.sin(t*(1.6+x*.31)+x*1.7)*Math.sin(t*.9+x)),j=7-y;return j<h?hue(Math.max(0,.33-j/7*.33)):BLACK;},
 // Fireworks: bursts of colour popping up all over
 (x,y,t)=>{let c=BLACK;for(let k=0;k<4;k++){const s=Math.floor(t/.45)-k,age=(t-s*.45)/1.5;if(age<0||age>1)continue;const h=hash(s+1),cx=h%8,cy=(h>>>3)%8,d=Math.hypot(x-cx,y-cy),r=age*5,b=Math.max(0,1-Math.abs(d-r)/.9)*(1-age);if(b>0)c=mix(c,hue((h>>>8)%360/360),Math.min(1,b*1.4));}return c;},
];
const SHOW_LEN=7,SHOW_FADE=1.2;
let ripples=[];
function drawShow(t){
 const n=SHOWS.length,i=Math.floor(t/SHOW_LEN)%n,k=t%SHOW_LEN,f=k>SHOW_LEN-SHOW_FADE?(k-(SHOW_LEN-SHOW_FADE))/SHOW_FADE:0;
 const A=SHOWS[i],B=SHOWS[(i+1)%n];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){let c=A(x,y,t);if(f>0)c=mix(c,B(x,y,t),f);px(x,y,dim(c,.7));}
 // Rings from the pads you press
 ripples=ripples.filter(r=>t-r.at<1.3);
 for(const r of ripples){
  const age=t-r.at,rad=age*7;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const d=Math.hypot(x-r.x,y-r.y),b=Math.max(0,1-Math.abs(d-rad)/1.1)*(1-age/1.3);
   if(b>0)px(x,y,hue(wrap1(r.h+d*.06)),b);
  }
  if(age<.15)px(r.x,r.y,COL.white,1-age/.15);
 }
 // Game buttons on the right: their colours with a wave running down; top row: a rainbow chase
 GAMES.forEach((g,j)=>sideLed(j,g.color,.25+.75*Math.max(0,Math.cos((j/8-t*.6)*TAU))**2));
 for(let j=0;j<8;j++)topLed(j,hue(wrap1(j/8-t*.5)),.5);
}
function drawPreview(t){
 const g=GAMES[preview],nt=t-previewAt;
 const nameCol=g===Fargminne?i=>FM_COL[i%4]:g.color;
 // Hovering on the screen: straight to the demo. Picked on the pad: the name scrolls by first.
 if(previewBy==='hover'||!scrollOnce(g.name.toUpperCase(),nameCol,nt-.1,1,14))g.demo(previewBy==='hover'?nt+2:nt);
 GAMES.forEach((h,i)=>sideLed(i,h.color,i===preview?.65+.35*pulse(t,2):.2));
 topLed(0,COL.white,.25);topLed(1,COL.white,.25);
}
function drawMenu(t){
 if(preview===null)drawShow(t);else drawPreview(t);
 if(starting!==null)fill(COL.white,Math.max(0,1-(t-starting)/.3));
}
function showPreview(i,by,quiet=false){
 i=(i+GAMES.length)%GAMES.length;
 if(preview===i&&by==='hover')return;
 preview=i;sel=i;previewAt=clock;previewBy=by;if(!quiet)sfx.menu();showGameInfo();
}
function endPreview(){preview=null;previewBy=null;showGameInfo();}
function go(){if(starting!==null)return;const g=GAMES[preview??sel];starting=clock;sfx.menu();setTimeout(()=>{starting=null;startGame(g);},280);}
function menuInput(ev){
 lastTouch=clock;
 if(!ev.down||starting!==null)return;
 if(ev.kind==='side'){if(ev.i<GAMES.length){if(ev.i===preview&&clock-previewAt>.25)go();else showPreview(ev.i,'pad');}return;}
 if(ev.kind==='top'){if(ev.i===0)showPreview((preview??sel+1)-1,'pad');else if(ev.i===1)showPreview(preview===null?sel:preview+1,'pad');return;}
 if(ev.kind==='pad'){
  if(preview!==null)return go();
  ripples.push({x:ev.x,y:ev.y,at:clock,h:Math.random()});
  const n=ev.x+(7-ev.y);tone(scaleHz(n),scaleHz(n),.25,'triangle',.1);
 }
}

function startGame(g){current=g;sel=GAMES.indexOf(g);preview=null;previewBy=null;lastTouch=clock;g.start(clock);sfx.start();showGameInfo();}
function toMenu(){current=null;preview=null;previewBy=null;lastTouch=clock;sfx.menu();showGameInfo();}

// ---- The rainbow sweep when the Launchpad is plugged in
function drawIntro(t){
 const k=(t-introAt)/1.1;if(k<0||k>1)return false;
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const d=(x+(7-y))/14,a=Math.max(0,1-Math.abs(d-k*1.6+.3)*3);
  if(a>0)px(x,y,hue((d+t*.3)%1),a);
 }
 return true;
}

// ---- Input from the Launchpad and from the mirror
LP.onInput=ev=>{
 audioInit(); // works when the mirror is clicked; ignored by the browser for real pad presses
 if(ev.kind==='top'&&ev.i===7){backDownAt=ev.down?clock:null;return;}
 if(current)current.input(ev,clock);else menuInput(ev);
};

// ---- Loop
function frame(){
 const t=performance.now()/1000,dt=Math.min(.05,t-last);last=t;clock+=dt;
 if(current)current.update(dt,clock);
 if(backDownAt!==null&&clock-backDownAt>=BACK_HOLD){backDownAt=null;if(current)toMenu();}
 if(!current&&previewBy==='pad'&&clock-lastTouch>PREVIEW_IDLE)endPreview();
 clearFrame();
 if(!drawIntro(clock)){if(current)current.draw(clock);else drawMenu(clock);}
 // Back button: red while in a game, flashing while held
 if(current)topLed(7,COL.red,backDownAt!==null?pulse(clock,8):.5);
 if(current||preview!==null)logoLed((current||GAMES[preview]).color,.4+.3*pulse(clock,1));else logoLed(hue(wrap1(clock*.2)),.8);
 flush();
 updateScreen();
 requestAnimationFrame(frame);
}

// ---- Screen
const STATUS={
 idle:'Klicka på knappen för att ansluta din Launchpad.',
 asking:'Webbläsaren frågar om lov att använda MIDI – svara Tillåt.',
 waiting:'Koppla in din Launchpad Mini MK3 med USB-kabeln.',
 connected:'Launchpad ansluten – spela på knapparna!',
 denied:'MIDI är blockerat. Klicka på symbolen till vänster om adressen, tillåt MIDI-enheter och ladda om sidan.',
 nomidi:'Den här webbläsaren kan inte prata med en Launchpad. Använd Chrome eller Edge på en dator. Du kan ändå testa med knapparna här på skärmen.'
};
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
LP.onStatus=s=>{
 $('#status').textContent=STATUS[s]+(s==='nomidi'&&isIOS?' (På iPhone och iPad går det tyvärr inte i någon webbläsare.)':'');
 $('#status').dataset.state=s;
 $('#connect').hidden=s!=='idle'&&s!=='denied';
};
LP.onConnect=()=>{introAt=clock;};

function showGameInfo(){
 const g=current,shown=g||(preview!==null?GAMES[preview]:null);
 $('#game-name').textContent=shown?shown.name:'Meny';
 let how;
 if(g)how=g.how;
 else if(shown)how=shown.how+(previewBy==='hover'?' Klicka för att spela.':' Tryck var som helst på plattan (eller samma runda knapp igen) för att spela.');
 else how='Plattan visar en ljusshow – tryck på knapparna så sprids färgade ringar. Välj spel med de runda knapparna till höger (eller ▲ ▼), eller håll musen över ett spel här nedanför så visas det på plattan. Håll in den röda runda knappen uppe till höger för att komma tillbaka hit.';
 $('#how').textContent=how;
 const legend=$('#legend');legend.replaceChildren();
 for(const [c,text] of (shown&&shown.legend)||[]){
  const li=document.createElement('li');li.textContent=text;li.style.setProperty('--c',`rgb(${c.map(v=>Math.round(v*255)).join(',')})`);legend.append(li);
 }
 $('#best').textContent=shown&&getBest(shown.id)?`Ditt rekord: ${getBest(shown.id)}`:'';
 document.querySelectorAll('#list li').forEach((li,i)=>{li.classList.toggle('on',!g&&i===preview);li.classList.toggle('playing',GAMES[i]===g);});
}
let lastHud='',lastSound=null;
function updateScreen(){
 const h=current?current.hud():'';
 if(h!==lastHud){lastHud=h;$('#hud').textContent=h;if(current&&current.phase==='over')showGameInfo();}
 const ready=audioReady();
 if(ready!==lastSound){lastSound=ready;$('#sound-hint').hidden=ready||muted;}
}

function setup(){
 buildMirror($('#mirror'));
 const list=$('#list');
 GAMES.forEach((g,i)=>{
  const li=document.createElement('li'),c=g.color.map(v=>Math.round(v*255)).join(',');
  li.style.setProperty('--c',`rgb(${c})`);
  li.innerHTML=`<b></b><span>Sidoknapp ${i+1}</span>`;
  li.querySelector('b').textContent=g.name;
  li.addEventListener('click',()=>{audioInit();startGame(g);});
  li.addEventListener('mouseenter',()=>{if(!current&&starting===null)showPreview(i,'hover',true);});
  li.addEventListener('mouseleave',()=>{if(!current&&previewBy==='hover'&&preview===i)endPreview();});
  list.append(li);
 });
 $('#connect').addEventListener('click',()=>{audioInit();connectMidi();});
 $('#menu-btn').addEventListener('click',()=>{audioInit();toMenu();});
 const mute=$('#mute');
 const showMute=()=>{mute.textContent=muted?'Ljud av':'Ljud på';mute.setAttribute('aria-pressed',String(!muted));};
 mute.addEventListener('click',()=>{audioInit();setMuted(!muted);showMute();lastSound=null;});showMute();
 addEventListener('pointerdown',audioInit);addEventListener('keydown',audioInit);
 showGameInfo();
 // Ask for MIDI straight away when the browser has already said yes before; otherwise wait for the button.
 if(!navigator.requestMIDIAccess)LP.onStatus('nomidi');
 else if(navigator.permissions)navigator.permissions.query({name:'midi',sysex:true}).then(p=>{p.state==='granted'?connectMidi():LP.onStatus(p.state==='denied'?'denied':'idle');}).catch(()=>LP.onStatus('idle'));
 else LP.onStatus('idle');
 requestAnimationFrame(frame);
}
setup();
