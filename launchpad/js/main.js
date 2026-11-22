'use strict';
// Launchpad Legends: the menu on the Launchpad, the game loop and the screen.
//
// Menu: the grid is split into four 4 × 4 tiles, one per game (GAMES in games.js, in order
// top-left, top-right, bottom-left, bottom-right). Press a tile to start that game.
// Anywhere: hold the top-right round button (User, lit red) for a moment to go back to the menu.

const $=s=>document.querySelector(s);
let current=null,clock=0,last=performance.now()/1000,introAt=-9,chosen=null,chosenAt=0;
let backDownAt=null;
const BACK_HOLD=.6;
const now=()=>clock;

// ---- Menu
function tileOf(x,y){return (y<4?0:2)+(x<4?0:1);}
function drawMenu(t){
 GAMES.forEach((g,i)=>{
  const ox=(i%2)*4,oy=i<2?0:4;
  const put=(x,y,c,a=1)=>{if(x>=0&&x<4&&y>=0&&y<4)px(ox+x,oy+y,c,a);};
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)put(x,y,g.color,.1);
  g.preview(put,t+i*.37);
  if(chosen===i){const a=1-(t-chosenAt)/.3;for(let y=0;y<4;y++)for(let x=0;x<4;x++)put(x,y,COL.white,a);}
 });
}
function menuInput(ev){
 if(ev.kind!=='pad'||!ev.down||chosen!==null)return;
 chosen=tileOf(ev.x,ev.y);chosenAt=clock;sfx.menu();
 setTimeout(()=>{startGame(GAMES[chosen]);chosen=null;},280);
}

function startGame(g){current=g;g.start(clock);sfx.start();showGameInfo();}
function toMenu(){current=null;sfx.menu();showGameInfo();}

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
 clearFrame();
 if(!drawIntro(clock)){if(current)current.draw(clock);else drawMenu(clock);}
 // Back button: red while in a game, flashing while held
 if(current)topLed(7,COL.red,backDownAt!==null?pulse(clock,8):.5);
 logoLed(current?current.color:hue((clock*.08)%1),.4+.3*pulse(clock,1));
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
 const g=current;
 $('#game-name').textContent=g?g.name:'Välj ett spel';
 $('#how').textContent=g?g.how:'Tryck på en av de fyra rutorna på din Launchpad. Håll in den röda runda knappen uppe till höger för att komma tillbaka hit.';
 $('#best').textContent=g?(getBest(g.id)?`Ditt rekord: ${getBest(g.id)}`:''):'';
 document.querySelectorAll('#list li').forEach((li,i)=>li.classList.toggle('on',GAMES[i]===g));
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
  li.innerHTML=`<b></b><span>${['Uppe till vänster','Uppe till höger','Nere till vänster','Nere till höger'][i]}</span>`;
  li.querySelector('b').textContent=g.name;
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
