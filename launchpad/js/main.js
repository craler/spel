'use strict';
// Launchpad Legends: the menu on the Launchpad, the game loop and the screen.
//
// Menu: the right column is the game list – one round button per game, in its colour. The selected one
// is bright, a new game blinks white. The grid first scrolls the selected game's name, then plays a demo.
// Press anywhere on the grid (or the same side button again) to play. ▲ ▼ on the top row also move.
// Nobody touching it for a while: it cycles through the games by itself.
// Anywhere: hold the top-right round button (User, lit red) for a moment to go back to the menu.

const $=s=>document.querySelector(s);
let current=null,clock=0,last=performance.now()/1000,introAt=-9;
let sel=0,selAt=0,lastTouch=0,starting=null,backDownAt=null;
const BACK_HOLD=.6;
const now=()=>clock;

// ---- Menu
const IDLE_CYCLE=30,CYCLE_EVERY=9;
function select(i,quiet=false){sel=(i+GAMES.length)%GAMES.length;selAt=clock;if(!quiet)sfx.menu();showGameInfo();}
function drawMenu(t){
 const g=GAMES[sel],nt=t-selAt;
 const nameCol=g===Fargminne?i=>FM_COL[i%4]:g.color;
 if(!scrollOnce(g.name.toUpperCase(),nameCol,nt-.15,1,11))g.demo(nt);
 GAMES.forEach((h,i)=>{
  if(i===sel)sideLed(i,h.color,.65+.35*pulse(t,2));
  else if(h.isNew&&Math.floor(t*2.5)%2)sideLed(i,COL.white,.8);
  else sideLed(i,h.color,.25);
 });
 topLed(0,COL.white,.2);topLed(1,COL.white,.2);
 if(starting!==null)fill(COL.white,Math.max(0,1-(t-starting)/.3));
}
function go(){if(starting!==null)return;starting=clock;sfx.menu();setTimeout(()=>{starting=null;startGame(GAMES[sel]);},280);}
function menuInput(ev){
 lastTouch=clock;
 if(!ev.down||starting!==null)return;
 if(ev.kind==='side'){if(ev.i<GAMES.length){if(ev.i===sel&&clock-selAt>.25)go();else select(ev.i);}return;}
 if(ev.kind==='top'){if(ev.i===0)select(sel-1);else if(ev.i===1)select(sel+1);return;}
 if(ev.kind==='pad')go();
}

function startGame(g){current=g;sel=GAMES.indexOf(g);lastTouch=clock;g.start(clock);sfx.start();showGameInfo();}
function toMenu(){current=null;selAt=clock;lastTouch=clock;sfx.menu();showGameInfo();}

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
 if(!current&&clock-lastTouch>IDLE_CYCLE&&clock-selAt>CYCLE_EVERY)select(sel+1,true);
 clearFrame();
 if(!drawIntro(clock)){if(current)current.draw(clock);else drawMenu(clock);}
 // Back button: red while in a game, flashing while held
 if(current)topLed(7,COL.red,backDownAt!==null?pulse(clock,8):.5);
 logoLed((current||GAMES[sel]).color,.4+.3*pulse(clock,1));
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
 const g=current,shown=g||GAMES[sel];
 $('#game-name').textContent=g?g.name:'Meny';
 $('#how').textContent=g?g.how:`Välj spel med de runda knapparna till höger på plattan (eller ▲ ▼). Tryck var som helst på plattan för att spela ${shown.name}. Håll in den röda runda knappen uppe till höger för att komma tillbaka hit.`;
 const legend=$('#legend');legend.replaceChildren();
 for(const [c,text] of (g&&g.legend)||[]){
  const li=document.createElement('li');li.textContent=text;li.style.setProperty('--c',`rgb(${c.map(v=>Math.round(v*255)).join(',')})`);legend.append(li);
 }
 $('#best').textContent=g&&getBest(g.id)?`Ditt rekord: ${getBest(g.id)}`:'';
 document.querySelectorAll('#list li').forEach((li,i)=>{li.classList.toggle('on',i===sel);li.classList.toggle('playing',GAMES[i]===g);});
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
  if(g.isNew){const n=document.createElement('em');n.className='new';n.textContent='Nytt';li.querySelector('b').append(n);}
  li.addEventListener('click',()=>{audioInit();startGame(g);});
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
