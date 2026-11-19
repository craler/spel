'use strict';
// Game rules and simulation: flight, spray, scoring, threats, crash.
const thresholds=[100,400,1000,2000,3500], fallen=new Map(), wrecks=new Map();
let combo=0,comboTime=0,bestCombo=0,feathers=3,shield=0,carsHit=0,foodEaten=0,best=0;
try{best=+localStorage.getItem('fagelbajs.best')||0;}catch{}
const ranks=[[0,'Blyg sparv'],[100,'Parkens busfrö'],[400,'Torgets skräck'],[1000,'Stadens plåga'],[2000,'Efterlyst legend'],[3500,'Himlens härskare'],[6000,'Stadens mardröm']];
const number=n=>n.toLocaleString('sv-SE');
function rankOf(score){return ranks.filter(r=>score>=r[0]).at(-1)[1];}
// ---- Topplista: one list for everybody, kept in Supabase. The browser keeps its own copy as well,
// which is what is shown if the shared list cannot be reached.
const scoreApi='https://lcnyzjuehtmqnbyyltqh.supabase.co/rest/v1/scores', scoreKey='sb_publishable_GNuIC6yLUsEjypuHn4mzGg_aVqgZODl';
let scores=[],lastName='',shared=null,sharedAt=0;
try{scores=JSON.parse(localStorage.getItem('fagelbajs.scores')||'[]');lastName=localStorage.getItem('fagelbajs.name')||'';}catch{}
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
function board(){return testSite?scores:shared||scores;} // the test site keeps its own list
function fetchScores(){
 sharedAt=Date.now();
 return fetch(scoreApi+'?select=name,points,stars&order=points.desc,created_at.asc&limit=20',{headers:{apikey:scoreKey}})
  .then(r=>r.ok?r.json():Promise.reject(r.status)).then(list=>{if(Array.isArray(list))shared=list;return shared;}).catch(()=>null);
}
fetchScores().then(()=>{if($('view').dataset.name==='scores'&&!$('view').hidden)openView('scores');});
function scoreList(mark=-1,count=10){
 return '<ol class="scores">'+board().slice(0,count).map((s,i)=>'<li class="'+(i===mark?'me':'')+'"><span>'+esc(s.name)+'</span><i>'+'★'.repeat(s.stars)+'</i><b>'+number(s.points)+'</b></li>').join('')+'</ol>'+
  (testSite?'<p class="cause">Testläge: topplistan sparas bara på den här enheten.</p>':shared?'':'<p class="cause">Den gemensamma topplistan gick inte att nå, så här visas bara den här datorns.</p>');
}
// Saves locally at once, then sends it to the shared list; done() is called with the place once the list is back.
function saveScore(name,done){
 const entry={name:name.trim().slice(0,12)||'Anonym duva',points,stars:wanted,date:Date.now()};
 scores.push(entry);scores.sort((a,b)=>b.points-a.points);scores=scores.slice(0,10);lastName=entry.name;
 try{localStorage.setItem('fagelbajs.scores',JSON.stringify(scores));localStorage.setItem('fagelbajs.name',lastName);}catch{}
 const place=list=>list.findIndex(s=>s.name===entry.name&&s.points===entry.points);
 if(testSite){if(done)setTimeout(()=>done(place(board())));return place(board());}
 fetch(scoreApi,{method:'POST',headers:{apikey:scoreKey,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({name:entry.name,points:entry.points,stars:entry.stars})})
  .then(r=>r.ok?fetchScores():null).catch(()=>null).then(()=>{if(done)done(place(board()));});
 return place(board());
}
function finish(heading,cause,action){
 state='end';closeClip();countFlight();$('feedback').classList.remove('on');if(killClip)document.body.classList.remove('crashed'); // the replay plays in colourkeys.clear();checkFeats();
 const record=points>best;if(record){best=points;try{localStorage.setItem('fagelbajs.best',String(best));}catch{}}
 const top=board().slice(0,10),listed=points>0&&(top.length<10||points>top.at(-1).points);if(Date.now()-sharedAt>20000)fetchScores();
 const row=(k,v)=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>',mins=Math.floor(elapsed/60),secs=String(Math.floor(elapsed%60)).padStart(2,'0');
 panel(heading,'<p class="cause">'+cause+'</p><p class="score">'+number(points)+'<small> poäng</small>'+(record?'<em>NYTT REKORD</em>':'')+'</p>'+
  '<dl class="stats">'+row('Stjärnor','★'.repeat(wanted)||'–')+row('Träffar',hits)+row('Bilar',carsHit)+row('Bästa kombo','×'+bestCombo)+row('Stjärnmål',run.stars)+row('I luften',mins+':'+secs)+'</dl>'+
  '<p class="rank">Titel: <b>'+rankOf(points)+'</b>'+(record?'':' · rekord '+number(best))+'</p>'+
  (listed?'<form id="save"><label for="name">Du kom in på '+(shared&&!testSite?'den gemensamma topplistan':'topplistan')+'! Skriv ditt namn:</label><div><input id="name" maxlength="12" autocomplete="off" spellcheck="false" value="'+esc(lastName)+'"><button>Spara</button></div></form>':'')+
  '<div id="board">'+(board().length?scoreList(-1,5):'')+'</div>'+featList(),action);
 const form=$('save');
 if(form){
  $('name').focus();$('name').select();
  form.onsubmit=e=>{e.preventDefault();const show=place=>{if($('board'))$('board').innerHTML=scoreList(place,Math.max(5,place+1));};show(saveScore($('name').value,show));form.remove();$('go').focus();};
 }
}
// ---- Killcam recording: a rolling record of the last couple of seconds around the bird. When a hit beats the
// flight's best, the record from two seconds before it to a second after becomes the clip shown at the end.
let replay=[],killClip=null,killPending=null,killBest=0;
function record(){
 const near=(o,r)=>Math.abs(o.x-bird.x)<r&&Math.abs(o.z-bird.z)<r;
 replay.push({elapsed,wingPhase,bird:{...bird},drops:drops.map(d=>({...d})),splash:splash.map(s=>({...s})),
  people:people.filter(h=>near(h,70)).map(h=>({...h,down:scored.has(h.id),fell:fallen.get(h.id)})),
  cars:cars.filter(c=>near(c,90)).map(c=>({...c,wrecked:wrecks.has(c.id),alarm:alarms.get(c.id)})),
  stains:stains.filter(s=>near(s,70)),popups:popups.slice(),bubbles:bubbles.slice(),thrown:thrown.map(o=>({...o})),
  hawk:hawk&&{...hawk},heli:heli&&{...heli,beam:heli.beam.slice()},tanks:tanks.map(t=>({...t}))});
 const keep=killPending?killPending.at-2.2:elapsed-2.2;
 while(replay.length&&replay[0].elapsed<keep)replay.shift();
 if(killPending&&elapsed-killPending.at>=1.1)closeClip();
}
function closeClip(){if(killPending&&replay.length>5){killClip={...killPending,frames:replay.slice()};}killPending=null;}
// Draw with the world as it was in a recorded frame, then put everything back.
function withSnapshot(f,draw){
 const saved={bird,elapsed,wingPhase,drops,splash,people,cars,stains,popups,bubbles,thrown,hawk,heli,tanks,crash,mist,plume,scored,
  fallen:new Map(fallen),wrecks:new Map(wrecks),alarms:new Map(alarms),camera,scale};
 bird=f.bird;elapsed=f.elapsed;wingPhase=f.wingPhase;drops=f.drops;splash=f.splash;people=f.people;cars=f.cars;stains=f.stains;popups=f.popups;bubbles=f.bubbles;
 thrown=f.thrown;hawk=f.hawk;heli=f.heli;tanks=f.tanks;crash=null;mist=[];plume=[];
 scored=new Set(f.people.filter(h=>h.down).map(h=>h.id));fallen.clear();for(const h of f.people)if(h.fell!==undefined)fallen.set(h.id,h.fell);
 wrecks.clear();alarms.clear();for(const c of f.cars){if(c.wrecked)wrecks.set(c.id,c);if(c.alarm!==undefined)alarms.set(c.id,c.alarm);}
 try{draw();}finally{
  ({bird,elapsed,wingPhase,drops,splash,people,cars,stains,popups,bubbles,thrown,hawk,heli,tanks,crash,mist,plume,scored,camera,scale}=saved);
  for(const [m,src] of [[fallen,saved.fallen],[wrecks,saved.wrecks],[alarms,saved.alarms]]){m.clear();for(const [k,v] of src)m.set(k,v);}
 }
}
let points=0,cars=[],sprayCount=0,halfStep=false,crowdTime=0;
const carPaint=['#c8382e','#2f8fa0','#e0b030','#4f74b8','#d9d6cf','#8a3f6a','#3f7a52'];
const maxWanted=5, sidewalkEdge=6.45, sidewalkLength=tile-2*sidewalkEdge;
let wanted=0,trafficClock=0,trafficFactor=1,throwWait=1,thrown=[],mist=[],tank=1,refillWait=0,emptyTank=false;
const runners=new Map();
function resetChase(){
 wanted=0;trafficClock=0;trafficFactor=1;throwWait=1;thrown=[];mist=[];tank=1;refillWait=0;emptyTank=false;runners.clear();
}
// People throw by hand, so what they throw obeys gravity: nothing leaves an arm faster than this,
// which with the game's gravity reaches roughly nine metres up. Height is safety from fruit, not from hawks or tanks.
const armSpeed=17, missiles=['tomato','banana','egg','cabbage','shoe'];
function snare(time){
 if(shield>0||state!=='play')return;
 bird.snare=time;shield=time+.9;shake=.7;combo=0;comboTime=0;
 banner('INSNÄRJD','Håll upp nosen','hurt',time);burst({from:1400,to:200,gain:.4,dur:.25});
}
function updateThreats(dt){
 if(wanted){
  throwWait-=dt;
  if(throwWait<=0){
   const v=forwardSpeed(),near=people.filter(h=>!h.climbing&&!h.fixed&&!h.event&&!scored.has(h.id)&&Math.abs(h.x-bird.x)<24&&Math.abs(h.z-bird.z)<24);
   throwWait=.23;
   for(let n=0;n<5&&near.length;n++){
    const h=near[Math.floor(Math.random()*near.length)],net=wanted>=3&&Math.random()<.3,t=.5+.55*Math.random();
    // Commit to a single aim point during the wind-up so turning dodges it.
    const lead=(t+.45)*(.962+.007*wanted),x=bird.x+Math.sin(bird.angle)*v*lead,z=bird.z+Math.cos(bird.angle)*v*lead;
    const vx=(x-h.x)/t,vz=(z-h.z)/t,vy=(bird.y+bird.vy*lead-h.y-1.7)/t+gravity*t/2;
    if(Math.hypot(vx,vy,vz)>(net?armSpeed*.85:armSpeed))continue; // out of reach for this thrower
    thrown.push({x:h.x,y:h.y+1.7,z:h.z,vx,vy,vz,age:0,windup:.45,owner:h.id,kind:net?'net':missiles[Math.floor(Math.random()*missiles.length)],spin:Math.random()*tau});
    throwWait=1.9/(.65+wanted*.52);break;
   }
  }
 }
 thrown=thrown.filter(o=>{
  if(o.windup>0){
   const h=people.find(h=>h.id===o.owner);if(!h||scored.has(h.id))return false;
   o.windup-=dt;return true;
  }
  o.age+=dt;
  if(o.kind==='shell'){ // a tank shell flies straight, then bursts into a wide net that keeps going and sinks
   o.x+=o.vx*dt;o.y+=o.vy*dt;o.z+=o.vz*dt;
   if(o.age>=o.fuse){o.kind='bignet';o.age=0;o.vx*=.45;o.vy*=.45;o.vz*=.45;burst({type:'bandpass',from:900,to:2600,q:1,gain:.3,dur:.2});}
   return !solid(o.x,o.y,o.z);
  }
  const drag=o.kind==='bignet'?.5:1;
  o.x+=o.vx*dt;o.z+=o.vz*dt;o.y+=o.vy*dt-gravity*drag*dt*dt/2;o.vy-=gravity*drag*dt;
  if(solid(o.x,o.y,o.z)||o.age>3.8)return false;
  if(state!=='play')return true;
  const flat=Math.hypot(o.x-bird.x,o.z-bird.z),dy=Math.abs(o.y-bird.y);
  if(o.kind==='net'||o.kind==='bignet'){
   o.r=o.kind==='net'?Math.min(1.6,.3+o.age*2.8):Math.min(4.6,1.4+o.age*14);
   if(Math.hypot(flat,dy)<o.r*(o.kind==='net'?1:.9)){snare(o.kind==='net'?1.4:2.3);return false;}
   return true;
  }
  if(Math.hypot(flat,dy)<.83){
   const len=Math.max(.01,Math.hypot(o.vx,o.vy,o.vz));
   hurt('AJ!',{n:[o.vx/len,o.vy/len,o.vz/len],depth:0,thrown:true});return false;
  }
  return true;
 });
}
function updateMist(dt){
 for(const m of mist){m.age+=dt;const drag=Math.exp(-dt*2.3);
  m.vx=m.vx*drag+(1-drag)*(2.8+Math.sin(m.z*.12+elapsed));m.vz*=drag;m.vy-=4*dt;
  m.x+=m.vx*dt;m.y+=m.vy*dt;m.z+=m.vz*dt;}
 mist=mist.filter(m=>m.age<m.life&&m.y>0);
}
function carContact(c,x,y,z,r=0){
 const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),dx=x-c.x,dz=z-c.z;
 const side=dx*cs-dz*sn,along=dx*sn+dz*cs;
 const [wide,long,high]=c.bus?[1.25,5.2,3]:[.92,2.05,1.48];
 const depths=[wide+r-Math.abs(side),long+r-Math.abs(along),high+r-y];
 const depth=Math.min(...depths);if(depth<0)return null;
 const sign=Math.sign;
 const n=depth===depths[2]?[0,1,0]:depth===depths[0]?[sign(side)*cs,0,-sign(side)*sn]:[sign(along)*sn,0,sign(along)*cs];
 return {n,depth,car:true};
}
// ---- Bedrifter: small goals that are remembered between flights.
let run={},slipTick=0;
const feats=[
 ['first','Premiärbajsaren','Träffa din första fotgängare',()=>hits>=1],
 ['star1','Efterlyst','Starta jakten',()=>wanted>=1],
 ['combo','Kombokung','Bygg en kombo ×8',()=>bestCombo>=8],
 ['cars','Plåtskadan','Krocka fem bilar på en flygning',()=>carsHit>=5],
 ['chain','Kedjereaktion','Orsaka en kedjekrock med tre bilar',()=>run.chain>=3],
 ['slip','Halkbana','Få en bil att halka i bajset',()=>run.carSlips>=1],
 ['alarm','Billarmet','Sätt igång tre billarm på en flygning',()=>run.alarms>=3],
 ['statue','Kulturfiende','Pricka statyn på torget',()=>run.statue>=1],
 ['wedding','Objuden gäst','Pricka både bruden och brudgummen',()=>run.wedding>=2],
 ['stars','Stjärnjägaren','Pricka fem stjärnmål på en flygning',()=>run.stars>=5],
 ['hawk','Hökdansen','Få höken att missa',()=>run.dodges>=1],
 ['max','Maxkaos','Nå fem stjärnor',()=>wanted>=5],
 ['tank','Pansarknäckare','Slå ut en stridsvagn',()=>run.tanks>=1],
];
let done=new Set();try{done=new Set(JSON.parse(localStorage.getItem('fagelbajs.feats')||'[]'));}catch{}
function checkFeats(){
 for(const [id,name,,test] of feats){
  if(done.has(id)||!test())continue;
  done.add(id);try{localStorage.setItem('fagelbajs.feats',JSON.stringify([...done]));}catch{}
  feedLine('BEDRIFT: '+name.toUpperCase());tone(660,990,.12,'triangle',.06);tone(990,1320,.18,'triangle',.06,.11);
 }
}
function featList(open){
 return '<details class="feats"'+(open?' open':'')+'><summary>Bedrifter '+done.size+' / '+feats.length+'</summary><ul>'+
  feats.map(([id,name,text])=>'<li class="'+(done.has(id)?'done':'')+'"><b>'+name+'</b> '+text+'</li>').join('')+'</ul></details>';
}
// ---- Feedback: banner for big moments, a score feed by the sight, numbers and speech bubbles in the world.
let popups=[],feed=[],bubbles=[],splash=[],marker=-9,markerGold=false,bannerUntil=0,lastDrop=-9,lastBubble=-9;
const wantedNote=['','De kastar frukt','Fler kastar, och snabbare','Höken, paraplyer och nät','Höken blir argare','Stridsvagnar'];
const shouts=['USCH!','ÄSCH!','MEN VA?!','MIN FRISYR!','FY BUBBLAN!','NEEEJ!','MITT I NYLLET!','BLÄ!','DUVJÄKEL!','INTE IGEN!'];
function banner(title,sub='',kind='',time=2.2){
 const el=$('feedback'),big=document.createElement('strong');el.className=kind;el.textContent='';big.textContent=title;el.append(big);
 if(sub){const line=document.createElement('span');line.textContent=sub;el.append(line);}
 void el.offsetWidth;el.classList.add('on');bannerUntil=elapsed+time;
}
function feedLine(label,amount=0,tags=''){feed.unshift({label:label.replace(/!+$/,''),amount,tags,t:elapsed});if(feed.length>5)feed.length=5;}
function bubble(x,y,z,text){if(elapsed-lastBubble<.2)return;lastBubble=elapsed;bubbles.push({x,y,z,text,t:elapsed});if(bubbles.length>8)bubbles.shift();}
// The spray fans out on the way down, so the area it can hit grows with the fall.
function hitRadius(fall){return clamp(1.4+(fall-6)*.075,1.4,6.5);}
function splashAt(x,y,z,n,nx=0,nz=0){
 for(let k=0;k<n;k++){const a=Math.random()*tau,s=1.2+2.6*Math.random();
  splash.push({x,y:y+.05,z,vx:Math.cos(a)*s+nx*2.5,vy:1.5+3*Math.random(),vz:Math.sin(a)*s+nz*2.5,age:0,life:.35+.3*Math.random()});}
 if(splash.length>260)splash.splice(0,splash.length-260);
}
function updateSplash(dt){
 for(const s of splash){s.age+=dt;s.vy-=gravity*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;}
 splash=splash.filter(s=>s.age<s.life&&s.y>0);
}
// Which wall, if any, a drop has just hit: returns the wall's facing and the point on its surface.
function wallAt(x,y,z){
 for(const [a,b,w,d,h] of buildings(Math.floor(x/tile),Math.floor(z/tile))){
  if(x<a-.4||x>a+w+.4||z<b-.4||z>b+d+.4||y>h-.15)continue;
  const gap=[x-a,a+w-x,z-b,b+d-z].map(Math.abs),k=gap.indexOf(Math.min(...gap));
  return {yaw:[-Math.PI/2,Math.PI/2,Math.PI,0][k],x:k===0?a-.03:k===1?a+w+.03:x,z:k===2?b-.03:k===3?b+d+.03:z};
 }
 return null;
}
// Every point goes through here so the wanted level always follows the score.
function addPoints(n){
 points+=n;let level=0;while(level<maxWanted&&points>=thresholds[level])level++;
 if(level>wanted){wanted=level;throwWait=1.1;banner('EFTERLYST '+'★'.repeat(level),wantedNote[level],'alert',2.8);tone(430,700,.22);}
}
function award(base,label,p,targetY=0,pos){
 // Risk pays: releasing low or in a dive doubles the hit, quick successive hits build a combo.
 let mult=1;const tags=[];
 // From high up the spray covers a wide area, so those hits are only worth half.
 if(p){if(p.dive){mult*=2;tags.push('STÖRTDYK ×2');}if(p.alt-targetY<14){mult*=2;tags.push('LÅGFLYG ×2');}else if(p.alt-targetY>38){mult*=.5;tags.push('HÖG HÖJD ×½');}}
 combo=comboTime>0?combo+1:1;comboTime=2.6;bestCombo=Math.max(bestCombo,combo);
 const amount=Math.max(1,Math.round(base*mult*(1+.25*Math.min(8,combo-1))));
 hits++;feedLine(label,amount,tags.join(' · '));
 if(p&&pos&&amount>killBest){killBest=amount;killPending={at:elapsed,amount,label,pos,dir:[Math.sin(bird.angle),Math.cos(bird.angle)]};}
 if(pos)popups.push({x:pos[0],y:pos[1],z:pos[2],text:'+'+amount,t:elapsed,gold:mult>1});
 marker=elapsed;markerGold=mult>1;hitTick(base>=25||mult>1,1+.035*Math.min(10,combo-1));
 if(base>=30&&p)run.stars++;
 if(base>=40&&p){slowmo=.35;shake=Math.max(shake,.35);} // the bird's own big hits get a beat of slow motion
 addPoints(amount);
}
function reset(){
 resetChase();points=0;combo=comboTime=bestCombo=carsHit=foodEaten=shield=0;feathers=3;hawk=null;heli=null;brokeUmb.clear();alarms.clear();sprayCount=0;fallen.clear();run={chain:0,carSlips:0,alarms:0,statue:0,wedding:0,dodges:0,tanks:0,stars:0};lag.clear();plume=[];tanks=[];tankWait=0;
 popups=[];feed=[];bubbles=[];splash=[];marker=lastDrop=lastBubble=-9;bannerUntil=0;$('feedback').classList.remove('on');wrecks.clear();cars=[];
 if(crashVoice){try{crashVoice.stop();}catch{}crashVoice=null;}
 resetEvents();replay=[];killClip=null;killPending=null;killBest=0;killPlay=0;
 rig=null;crash=null;document.body.classList.remove('crashed');$('crash-banner').hidden=true;
 bird={x:0,z:0,y:21,angle:0,bank:0,turn:0,spread:1,speed:14,vy:0,fold:0,steep:0,climb:0,flare:0,effort:0,skim:0,lastSkim:-9,nextFlap:2,burst:0,lookYaw:0,lookPitch:0,glance:0,nextGlance:1,snare:0};slowmo=shake=0;elapsed=hits=cooldown=0;drops=[];stains=[];scored.clear();
}
// body is HTML built from the game's own strings and numbers.
let shownAt=0;
function panel(heading,body,action){shownAt=performance.now();$('title').textContent=heading;$('brief').innerHTML=body;$('brief').hidden=false;$('view').hidden=true;$('go').textContent=action;$('overlay').hidden=false;document.body.classList.add('menu');$('go').focus();}
function togglePause(){if(state==='play'){state='pause';keys.clear();pausedDrawn=false;if(sound)sound.suspend().catch(()=>{});panel('Flygpaus','<p class="cause">Duvan väntar där du lämnade den.</p>','Fortsätt flyga →');}else if(state==='pause')start();}
function start(){if(state==='play')return;if(state!=='pause'){if($('save'))saveScore($('name').value); // starting again without pressing Spara still keeps the score
 reset();setSky(flights);flights++;try{localStorage.setItem('fagelbajs.flights',String(flights));}catch{}}state='play';$('overlay').hidden=true;document.body.classList.remove('menu');$('go').blur();try{sound ||= new AudioContext();sound.resume().catch(()=>{});setupAudio();}catch{}}
// C cycles the camera: behind the bird, then through the bird's own eyes, then straight down from above.
const viewNames=['bakom','ovanifrån','duvans ögon'];
function view(){if(crash)return;camView=[2,0,1][camView];above=camView===1;rig=null;$('camera').textContent='Vy: '+viewNames[camView];}
// Convert the stored dive speed into horizontal travel as the nose tips down.
function forwardSpeed(){
 // As the dive develops, the speed gained from falling goes mostly downwards.
 const tuckDive=bird.fold*clamp(-bird.vy/25,0,1);
 const horizontalFraction=1-Math.max(.925*bird.steep,.94*tuckDive);
 return bird.speed*horizontalFraction*Math.cos(bird.climb*1.31);
}
// A point on the bird, in the same body frame the renderer uses (x right, y up, z towards the beak).
function birdPoint([x,y,z]){
 const b=bird,bank=(b.vb??b.bank)*1.02,pitch=flightPitch(),sy=Math.sin(b.angle),cy=Math.cos(b.angle),sb=Math.sin(bank),cb=Math.cos(bank),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const bx=x*cb+y*sb,by=y*cb-x*sb,bz=z*cp-by*sp;
 return [b.x+bx*cy+bz*sy,b.y+by*cp+z*sp,b.z-bx*sy+bz*cy];
}
// It leaves from the vent under the tail. A hard turn slings it outwards: it keeps the sideways
// swing of the bird's rump, so the sight swings out of the turn too.
function payload(){
 const [x,y,z]=birdPoint([0,-.07,-.43]),v=forwardSpeed(),sling=clamp(-(bird.turn||0)*v*.21,-6,6);
 return {x,y,z,vx:Math.sin(bird.angle)*v+Math.cos(bird.angle)*sling,vz:Math.cos(bird.angle)*v-Math.sin(bird.angle)*sling,vy:bird.vy-6};
}
// Climbing scatters the spray, diving packs it tight: the hit area follows the bird's vertical speed.
function spreadNow(){return clamp(1+bird.vy*.011,.74,1.26);}
function at(p,t){return [p.x+p.vx*t,p.y+p.vy*t-gravity*t*t/2,p.z+p.vz*t];}
function flightTime(p,level){
 const discriminant=p.vy*p.vy+2*gravity*(p.y-level);
 return discriminant<0?-1:(p.vy+Math.sqrt(discriminant))/gravity;
}
function landingTime(p){
 const end=Math.max(0,flightTime(p,0));
 const steps=Math.max(1,Math.ceil(end*Math.max(20,Math.hypot(p.vx,p.vz))/1.1));
 for(let i=1;i<=steps;i++){let hi=end*i/steps;
  if(!solid(...at(p,hi)))continue;
  let lo=end*(i-1)/steps;
  for(let n=0;n<8;n++){const mid=(lo+hi)/2;if(solid(...at(p,mid)))hi=mid;else lo=mid;}
  return lo;
 }
 return end;
}
function drop(){
 if(cooldown>0||emptyTank||tank+1e-8<1/60)return;
 const p=payload(),n=++sprayCount,big=elapsed-lastDrop>.3;lastDrop=elapsed;
 if(!big){ // the stream wavers sideways and fans out; the opening blob flies true
  const lateral=.46*Math.sin(n*.73)+.22*Math.sin(n*2.11),fan=n*2.39996,wide=.55*Math.sqrt(hash(n,5,9));
  p.vx+=Math.cos(bird.angle)*lateral+Math.cos(fan)*wide;p.vz+=-Math.sin(bird.angle)*lateral+Math.sin(fan)*wide;p.vy+=.32*Math.sin(n*1.4);
 }
 p.big=big;p.r=big?.19:.055+.05*hash(n,2,6);p.dark=n%4===0;
 p.end=landingTime(p);p.age=0;p.seed=n;p.alt=bird.y;p.spread=bird.spread||1;p.dive=bird.fold>.5||bird.vy<-14;drops.push(p);cooldown+=.05;tank=Math.max(0,tank-1/60);refillWait=.3;
 if(tank<1/60-1e-8){emptyTank=true;banner('SLUT PÅ BAJS','Det fylls på av sig självt','hurt',1.6);}
 for(let k=0;k<2;k++){const a=(n*2+k)*2.39996,drift=.65+hash(n,k,1)*1.5;
  mist.push({x:p.x,y:p.y,z:p.z,vx:p.vx+Math.cos(a)*drift,vy:p.vy*.85+Math.sin(a),vz:p.vz+Math.sin(a)*drift,age:0,life:.65+hash(k,n,3)*.8});}
}
function simulate(dt){
 const b=bird,held=(...codes)=>codes.some(c=>keys.has(c)),dive=held('ShiftLeft','ShiftRight');
 // Secret air brake on Q: wings thrown forward and beating against the airflow, tail fanned, nose up.
 const braking=held('KeyQ')&&!dive&&!(b.snare>0);
 if(braking&&!(b.brake>.2))whoosh();
 b.brake=mix(b.brake||0,+braking,1-Math.exp(-dt*(braking?5:2.5)));
 let steer=+held('KeyD','ArrowRight')-+held('KeyA','ArrowLeft'), pitch=(+held('KeyS','ArrowDown')-+held('KeyW','ArrowUp'))*(reversePitch?-1:1);
 if(stickInput.on){steer=clamp(steer+stickInput.x*.85,-1,1);pitch=clamp(pitch+stickInput.y*(reversePitch?-1:1),-1,1);} // the thumb stick is analog
 // Caught in a net: barely any steering, no climbing, and the weight of it pulls the bird down. Holding the nose up shortens it.
 if(b.snare>0){b.snare-=dt*(pitch>0?1.6:1);steer*=.3;pitch=Math.min(pitch,0);b.vy-=13*dt;b.speed=Math.max(9,b.speed-9*dt);}
 if(!dive&&b.fold>.65&&b.wasDiving)tone(200,430,.25,'sine',.03);
 // The wings fold and open over a moment, not instantly.
 b.wasDiving=dive;b.fold=mix(b.fold,+dive,1-Math.exp(-dt*(dive?4.5:3)));
 // Every lost feather makes the bird harder to fly: it rolls about, turns slower and climbs worse.
 const ragged=3-feathers,wobble=ragged*(.16*Math.sin(elapsed*4.7)+.1*Math.sin(elapsed*11.3));
 b.bank=mix(b.bank,steer+wobble,1-Math.exp(-dt*5));b.turn=b.bank*(1.52-.44*b.fold)*(1-.12*ragged);b.angle+=b.turn*dt;
 b.spread=mix(b.spread||1,spreadNow(),1-Math.exp(-dt*3));
 // Ramp into the dive. A short tap makes a small range adjustment.
 const desiredSteep=clamp(-pitch,0,1);
 b.steep+=clamp(desiredSteep-b.steep,-dt*(pitch>0?2.4:1.45),dt*1.1);
 const diveCurve=b.steep*(.62+.38*b.steep);
 const upLimit=clamp((82-b.y)/9,0,1);
 const targetClimb=dive?0:clamp(pitch,0,1);
 b.climb=mix(b.climb,targetClimb,1-Math.exp(-dt*(targetClimb?.92:2.7)));
 const stallSoftness=clamp((b.climb-.87)/.13,0,1);
 const wantedVy=ragged*1.4*Math.sin(elapsed*6.1)+(19-2.6*ragged)*Math.sin(1.31*b.climb)*upLimit*(1-.60*stallSoftness)-40*diveCurve+b.flare*.82+b.brake*clamp(b.speed-8,0,30)*.3;
 // Tucked, the bird simply falls: gravity builds the speed up against air drag, towards about 50 m/s.
 // Opening the wings turns that fall into level flight in a smooth pull-out.
 // The steep dive (arrow) sinks about as fast as the tuck, not faster: its downward pull is capped like a fall,
 // and the brake (Q) takes much of the sink out of it.
 const sink=wantedVy-40*diveCurve*(-.04-.6*b.brake),pull=(sink-b.vy)*mix(2.7,3.4,clamp(-b.vy/30,0,1));
 const acceleration=dive?-27*b.fold-.53*b.vy:Math.max(pull,-21*(1-.5*b.brake));
 b.vy=clamp(b.vy+acceleration*dt,-51,27);
 b.y+=b.vy*dt;
 b.flare*=Math.exp(-dt*1.2);
 // Gliding is mostly still wings, broken now and then by a short burst of flapping. Climbing is hard work.
 b.nextFlap-=dt;b.burst=Math.max(0,b.burst-dt);
 if(b.nextFlap<=0){b.burst=.4+.55*Math.random();b.nextFlap=1.8+4*Math.random();}
 const effort=Math.max(b.brake*.95,dive?0:pitch>.05?Math.max(.4,pitch):pitch<-.05?0:b.burst>0?.8:.1);
 b.effort=mix(b.effort,effort,1-Math.exp(-(effort>b.effort?9:4)*dt));
 b.nextGlance-=dt;if(b.nextGlance<=0){b.glance=Math.random()<.35?0:(Math.random()-.5)*1.3;b.nextGlance=.7+2.6*Math.random();}
 b.lookYaw=mix(b.lookYaw,clamp(b.bank*.55+b.glance,-.9,.9),1-Math.exp(-dt*7));
 b.lookPitch=mix(b.lookPitch,held('Space')?-.45:-.06+.1*Math.sin(elapsed*1.3),1-Math.exp(-dt*6));
 // Speed won in a dive carries into the glide and bleeds off slowly; climbing spends it faster.
 b.speed=clamp(b.speed+(Math.max(0,-b.vy)*1.65*(1-b.brake)+(14-b.speed)*(dive?.18:b.speed>14?.13:.55)*(1-b.brake)-Math.max(0,b.vy)*.45-b.brake*24)*dt,10-6.5*b.brake,58);
 // Visual pitch and roll ride on critically damped springs: no sudden jerks when the controls change.
 {const k=26,d=2*Math.sqrt(k);b.vpv=(b.vpv||0)+((pitchTarget()-(b.vp??pitchTarget()))*k-(b.vpv||0)*d)*dt;b.vp=(b.vp??pitchTarget())+b.vpv*dt;
  const kb=40,db=2*Math.sqrt(kb);b.vbv=(b.vbv||0)+((b.bank-(b.vb??b.bank))*kb-(b.vbv||0)*db)*dt;b.vb=(b.vb??b.bank)+b.vbv*dt;}
 b.x+=Math.sin(b.angle)*forwardSpeed()*dt;b.z+=Math.cos(b.angle)*forwardSpeed()*dt;
 trafficFactor=mix(trafficFactor,1+.61*wanted,1-Math.exp(-dt*1.5));trafficClock+=dt*trafficFactor;if(!halfStep)traffic();
 if(solid(b.x,b.y,b.z,.28)){startCrash();return;}
 for(let i=Math.floor(b.x/tile)-1;i<=Math.floor(b.x/tile)+1;i++)for(let j=Math.floor(b.z/tile)-1;j<=Math.floor(b.z/tile)+1;j++)for(const [tx,tz,s,seed] of block(i,j).trees){
  const dx=b.x-tx,dz=b.z-tz;if(Math.abs(dx)>4.5||Math.abs(dz)>4.5)continue;
  const cy=4.3*s*(.9+.25*seed),d=Math.hypot(dx,b.y-cy,dz)||1; // the crown is roughly a ball; the trunk a post
  if(d<2.05*s+.2||(Math.hypot(dx,dz)<.3*s+.25&&b.y<2.6*s)){startCrash({n:[dx/d,(b.y-cy)/d,dz/d],depth:0,cause:'Trädet vann.'});return;}
 }
 if(b.y<3){const tank=tanks.find(t=>tankContact(t,b.x,b.y,b.z,.28));if(tank){startCrash({n:[0,1,0],depth:0,vehicle:true,cause:'Stridsvagnen vann.'});return;}}
 for(const q of balloons()){ // hot-air balloons are solid
  const d=Math.hypot(b.x-q.x,b.y-q.y-7,b.z-q.z);
  if(d<5.8||(Math.abs(b.x-q.x)<1.1&&Math.abs(b.z-q.z)<1.1&&b.y>q.y-2.6&&b.y<q.y-.7)){startCrash({n:[(b.x-q.x)/d,(b.y-q.y-7)/d,(b.z-q.z)/d],depth:0,cause:'Luftballongen vann.'});return;}
 }
 if(b.y<3.3){const vehicle=cars.find(c=>carContact(c,b.x,b.y,b.z,.28));if(vehicle){const surface=carContact(vehicle,b.x,b.y,b.z,.28);crashCar(vehicle);startCrash(surface);return;}}
 // Skimming a wall, a roof edge or the ground at speed without touching pays a little.
 if(solid(b.x,b.y,b.z,1.15)&&Math.hypot(forwardSpeed(),b.vy)>12)b.skim+=dt;
 else{if(b.skim>.12&&elapsed-b.lastSkim>2){b.lastSkim=elapsed;feedLine('NÄRA ÖGAT',10);addPoints(10);tone(900,1300,.07,'triangle',.04);}b.skim=0;}
 const wingCycle=Math.floor(wingPhase/tau);
 elapsed+=dt;shield=Math.max(0,shield-dt);if(comboTime>0&&(comboTime-=dt)<=0)combo=0;cooldown=held('Space')?Math.max(-dt,cooldown-dt):Math.max(0,cooldown-dt);recharge(dt,held('Space'));wingPhase+=dt*(1.4+20*b.effort+8*b.climb*b.effort+9*b.brake);
 if(b.effort>.5&&Math.floor(wingPhase/tau)>wingCycle)wingBeat();
 if(held('Space'))drop();
 crowdTime+=dt;if(!halfStep){gather(crowdTime);crowdTime=0;}updateMist(dt);updateSplash(dt);updateThreats(dt);updateHawk(dt);updateHeli(dt);updateEvent(dt);updateTanks(dt);if(state!=='play')return;
 const floating=balloons();
 drops=drops.filter(p=>{
  const prev=p.age;p.age+=dt;const end=p.end;
  const [x0,y0,z0]=at(p,prev),[x1,y1,z1]=at(p,Math.min(end,p.age));
  for(const q of floating)if(Math.hypot(x1-q.x,y1-q.y-7,z1-q.z)<5.7){
   if(!scored.has(q.id)){scored.add(q.id);award(80,'LUFTBALLONGEN',p,q.y+12,[q.x,q.y+14,q.z]);bubble(q.x,q.y+1.6,q.z,'VI SJUNKER!');splat(x1,y1,z1,true);}
   return false;
  }
  if(y1<y0){
   const victim=people.find(h=>{
    const head=h.y+1.8;if(head>y0||head<y1||scored.has(h.id))return false;
    const f=(y0-head)/(y0-y1);return Math.hypot(h.x-mix(x0,x1,f),h.z-mix(z0,z1,f))<hitRadius(p.alt-head)*p.spread+(p.big?.4:0);
   });
   if(victim&&victim.umb){
    brokeUmb.add(victim.id);feedLine('PARAPLYET TOG SMÄLLEN');bubble(victim.x,victim.y+2.7,victim.z,'HA! MISS!');
    splashAt(victim.x,victim.y+2.4,victim.z,5);splat(victim.x,victim.y,victim.z);return false;
   }
   if(victim){
    scored.add(victim.id);fallen.set(victim.id,elapsed);if(victim.label==='BRÖLLOPSKAOS')run.wedding++;yelp();eventHit(victim.id);
    award(victim.base||10,victim.label||'SPLATT',p,victim.y,[victim.x,victim.y+2.4,victim.z]);
    bubble(victim.x,victim.y+2.1,victim.z,victim.shout||shouts[Math.floor(Math.random()*shouts.length)]);
    splashAt(victim.x,victim.y+1.8,victim.z,6);splat(victim.x,victim.y,victim.z,true);return false;
   }
  }
  const extra=hitRadius(p.alt-1.5)*p.spread-1.65,carTime=flightTime(p,1.48),tankTime=flightTime(p,2.4);
  if(tankTime>=0&&tankTime<=end&&prev<=tankTime&&p.age>=tankTime){
   const [x,,z]=at(p,tankTime),tank=tanks.find(t=>t.hp>0&&tankContact(t,x,2.3,z,extra));
   if(tank){ // armour shrugs off a few drops; it takes a proper soaking
    tank.hp--;tank.splats.push([x-tank.x,z-tank.z]);splashAt(x,2.4,z,3);splat(x,2.4,z);
    if(tank.hp<=0){tank.dead=0;run.tanks++;crunch();shake=Math.max(shake,.6);award(150,'STRIDSVAGN UTSLAGEN',p,0,[tank.x,4,tank.z]);bubble(tank.x,3.6,tank.z,'VI SER INGET!');}
    else if(tank.hp%4===0)award(5,'PANSARTRÄFF',p,0,[tank.x,3.6,tank.z]);
    return false;
   }
  }
  if(carTime>=0&&carTime<=end&&prev<=carTime&&p.age>=carTime){
   const [x,,z]=at(p,carTime),vehicle=cars.find(c=>carContact(c,x,1.47,z,extra));
   if(vehicle){
    if(vehicle.parked){ // a parked car cannot crash, but its alarm goes off
     if(!alarms.has(vehicle.id)){alarms.set(vehicle.id,elapsed);run.alarms++;
      if(vehicle.show){award(60,'BILSALONGEN',p,0,[vehicle.x,2.5,vehicle.z]);bubble(vehicle.x,2.3,vehicle.z,'NYPOLERAD!');eventHit(vehicle.id);}
      else award(5,'BILLARM',p,0,[vehicle.x,2.5,vehicle.z]);}
    }else if(!wrecks.has(vehicle.id)){
     crashCar(vehicle);carsHit++;award(vehicle.bus?40:vehicle.cab?50:25,vehicle.bus?'BUSSEN':vehicle.cab?'CABBEN':'PLÅTSMÄLL',p,0,[vehicle.x,vehicle.bus?4:2.5,vehicle.z]);
     bubble(vehicle.x,vehicle.bus?3.8:2.3,vehicle.z,vehicle.bus?'ALLA AV!':vehicle.cab?'MIN FRISYR!':'MIN LACK!');
    }
    splashAt(vehicle.x,1.5,vehicle.z,4);splat(x,1.5,z);return false;
   }
  }
  if(p.age>=end){
   const [x,y,z]=at(p,end),fall=clamp(p.alt-y,0,80),stain={x,y,z,t:elapsed,seed:hash(p.seed,3,1),r:(p.big?1.15:.55)*(1+.011*fall)};
   const wall=y>.3?wallAt(x,y,z):null;
   if(wall){ // on a wall it sticks, then runs
    stain.x=wall.x;stain.z=wall.z;stain.wall=wall.yaw;stain.drip=.3+1.9*hash(p.seed,5,2);
    splashAt(wall.x,y,wall.z,p.big?5:2,Math.sin(wall.yaw),Math.cos(wall.yaw));
   }else splashAt(x,y,z,p.big?7:3);
   if(y>-.5)stains.push(stain);splat(x,y,z,p.big); // nothing sticks to water
   const sq=block(Math.floor(x/tile),Math.floor(z/tile));
   if(sq.statue&&y>.5&&!scored.has('st'+sq.key)&&Math.hypot(x-sq.statue[0],z-sq.statue[1])<1.9+extra){scored.add('st'+sq.key);run.statue++;award(40,'KULTURSKYMF',p,0,[sq.statue[0],6.4,sq.statue[1]]);}
   return false;
  }
  return true;
 });
 if(elapsed>bannerUntil)$('feedback').classList.remove('on');
 if(++slipTick%5===0)slips();if(slipTick%30===0)checkFeats();
 popups=popups.filter(p=>elapsed-p.t<1.1);bubbles=bubbles.filter(b=>elapsed-b.t<1.5);
 const maxStains=fastest?150:fast?250:650;if(stains.length>maxStains)stains.splice(0,stains.length-maxStains+50);
 if(!wanted&&elapsed>=60){finish('Tiden är ute!','Du hann inte starta jakten.','Flyg igen →');}
}
// Resolve the nearest contact plane for the tumbling body, including roof edges.
function contact(radius){
 const b=bird;
 if(b.y<=radius)return {n:[0,1,0],depth:radius-b.y,ground:true};
 for(const [x,z,w,d,h] of buildings(Math.floor(b.x/tile),Math.floor(b.z/tile))){
  const distances=[b.x-x+radius,x+w+radius-b.x,b.z-z+radius,z+d+radius-b.z,h+radius-b.y];
  const depth=Math.min(...distances);
  if(depth<0)continue;
  const normals=[[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,1,0]];
  return {n:normals[distances.indexOf(depth)],depth,ground:false};
 }
 return null;
}
function bounce(surface,first){
 const {n,depth}=surface,v=crash.velocity;
 bird.x+=n[0]*(depth+.001);bird.y+=n[1]*(depth+.001);bird.z+=n[2]*(depth+.001);
 const incoming=v.reduce((sum,value,i)=>sum+value*n[i],0);
 if(incoming>=0)return;
 const rebound=(Math.abs(incoming)>2?Math.abs(incoming)*(first?.17:.08):0);
 for(let i=0;i<3;i++)v[i]=(v[i]-incoming*n[i])*(first?.49:.64)+rebound*n[i];
 if(first && !surface.ground && n[1]===0)v[1]+=Math.min(1.2,-incoming*.06);
 if(!first){crash.spin*=.69;crash.rollSpeed*=.74;
  for(const [i,w] of crash.wings.entries()){const impulse=Math.min(7,-incoming*.65)*(i?1:-1);w.vw+=impulse;w.vt-=impulse*1.4;}
 }
}
// The height of whatever the bird would lie on here: a roof, a car roof or the street.
function supportAt(x,z){
 let h=0;for(const [a,b,w,d,top] of buildings(Math.floor(x/tile),Math.floor(z/tile)))if(x>a&&x<a+w&&z>b&&z<b+d&&top<bird.y+1)h=Math.max(h,top);
 for(const c of cars)if(carContact(c,x,.5,z))h=Math.max(h,c.bus?3:1.48);
 return h;
}
function startCrash(surface=contact(.28)){
 const b=bird;
 if(!surface)return;
 const speed=forwardSpeed(),force=Math.hypot(speed,b.vy),side=b.bank<0?-1:1;
 const amplitude=.15+.93*b.effort;
 const arm=(.24+amplitude*Math.sin(wingPhase))*(1-b.fold);
 const wrist=(-.16+amplitude*.92*Math.sin(wingPhase-.65))*(1-b.fold);
 crash={age:0,ground:surface.ground,thrown:surface.thrown,cause:surface.cause,vehicle:surface.car,origin:[b.x,b.y,b.z],follow:[b.x,b.y,b.z],
  velocity:[Math.sin(b.angle)*speed,b.vy,Math.cos(b.angle)*speed],
  spin:clamp(force*.20,2,11)*(surface.n[1]?1:-1),rollSpeed:side*clamp(force*.14,1.2,7),
  pitch:0,roll:0,wings:[-1,1].map(dir=>({arm,wrist,tip:wrist,vt:dir*side*force*.31,va:dir*side*force*.21,vw:-dir*side*force*.25}))};
 if(!rig||camView===2){rig=null;setCamera(1/60);}
 slowmo=.7;shake=1.2; // a beat of slow motion on impact, and a cloud of feathers
 for(let n=0;n<30;n++){const a=Math.random()*tau,u=Math.random()*2-1,q=Math.sqrt(1-u*u),v=2+7*Math.random(),big=n<8;
  plume.push({x:b.x,y:b.y,z:b.z,vx:Math.cos(a)*q*v+Math.sin(b.angle)*speed*.3,vy:u*v+2.5,vz:Math.sin(a)*q*v+Math.cos(b.angle)*speed*.3,age:0,
   len:big?.26+.1*Math.random():.11+.09*Math.random(),wide:big?.3:.42,curl:.4*Math.random()-.2,heading:Math.random()*tau,turnRate:(Math.random()-.5)*1.2,
   sway:Math.random()*tau,swayRate:2.6+1.8*Math.random(),fall:.75+.5*Math.random(),
   tumble:[Math.random()*tau,Math.random()*tau],tumbleRate:[(Math.random()-.5)*24,(Math.random()-.5)*30],
   shade:big?(n%2?2:1):Math.floor(Math.random()*4),seed:Math.random()*tau});}
 bounce(surface,true);state='crash';keys.clear();crashVoice=voice(0,.8);if(!crashVoice)tone(155,35,.34,'triangle');document.body.classList.add('crashed');
}
// A wingtip hitting pavement or a facade kicks the wrist and the shoulder
// separately. Latch each contact until the feathers clear the surface.
function tipContact(w,side,c){
 const roll=(bird.vb??bird.bank)*1.02+c.roll,pitch=flightPitch()+c.pitch;
 const wx=side*(.089+.43*Math.cos(w.arm)+.22*Math.cos(w.wrist)+.32*Math.cos(w.tip));
 const wy=.101+.43*Math.sin(w.arm)+.22*Math.sin(w.wrist)+.32*Math.sin(w.tip);
 const bx=wx*Math.cos(roll)+wy*Math.sin(roll),by=wy*Math.cos(roll)-wx*Math.sin(roll);
 const bz=-.24*Math.cos(pitch)-by*Math.sin(pitch);
 const atSurface=solid(bird.x+bx*Math.cos(bird.angle)+bz*Math.sin(bird.angle),
  bird.y+by*Math.cos(pitch)-.24*Math.sin(pitch),bird.z-bx*Math.sin(bird.angle)+bz*Math.cos(bird.angle));
 if(atSurface&&!w.touching){
  const kick=Math.sign(Math.cos(roll)*Math.cos(pitch))||1;
  w.vt+=kick*5.5;w.vw+=kick*3.2;w.va+=kick*1.6;c.rollSpeed+=side*.45;
 }
 w.touching=atSurface;
}
let plume=[];
// Loose feathers: thrown out fast and tumbling, the air stops them within a moment, and then they
// come down like leaves, swinging from side to side and tipping into each swing, slowly turning as they go.
function updatePlume(dt){
 for(const f of plume){
  f.age+=dt;
  if(f.y<=.04){f.y=.03;continue;} // resting on the ground
  const calm=1-Math.exp(-f.age*1.6),drag=Math.exp(-dt*4);
  f.vx*=drag;f.vz*=drag;f.vy=mix(f.vy,-f.fall*(.55+.45*Math.abs(Math.sin(f.sway))),1-Math.exp(-dt*3));
  f.sway+=dt*f.swayRate*calm;f.heading+=dt*f.turnRate;
  for(let k=0;k<2;k++){f.tumble[k]+=f.tumbleRate[k]*dt;f.tumbleRate[k]*=Math.exp(-dt*1.8);}
  const swing=.9*Math.cos(f.sway)*calm,side=f.heading+Math.PI/2;
  f.x+=(f.vx+swing*Math.cos(side)+.25*Math.sin(f.age*.7+f.seed))*dt;f.z+=(f.vz+swing*Math.sin(side))*dt;f.y=Math.max(.03,f.y+f.vy*dt);
 }
}
function advanceCrash(dt){
 updatePlume(dt);
 const c=crash;
 c.age+=dt;
 // Wall clock controls the titles; gravity and the loose joints use slowed time.
 const step=dt*.30/3;
 for(let sub=0;sub<3;sub++){
  const v=c.velocity;
  v[1]-=gravity*step;
  bird.x+=v[0]*step;bird.y+=v[1]*step;bird.z+=v[2]*step;
  const surface=contact(.19) || (bird.y<1.7&&cars.map(c=>carContact(c,bird.x,bird.y,bird.z,.19)).find(Boolean));
  if(surface)bounce(surface,false);
  c.pitch+=c.spin*step;c.roll+=c.rollSpeed*step;
  c.spin*=Math.exp(-.5*step);c.rollSpeed*=Math.exp(-.55*step);
  for(let i=0;i<2;i++){
   const w=c.wings[i],side=i?1:-1;
   const rest=-.85*Math.cos(c.pitch)*Math.cos(c.roll)-side*.88*Math.sin(c.roll)+side*.27*Math.sin(c.pitch)*c.spin;
   w.va+=((rest-w.arm)*23-3*w.va)*step;w.arm=clamp(w.arm+w.va*step,-1.25,1.3);
   w.vw+=((w.arm-.46-w.wrist)*21-1.55*w.vw)*step;w.wrist=clamp(w.wrist+w.vw*step,-1.9,1.72);
   w.vt+=((w.wrist-.31-w.tip)*16-1.5*w.vt)*step;w.tip=clamp(w.tip+w.vt*step,-2.2,1.97);tipContact(w,side,c);
  }
 }
 // Once it has hit the ground and slowed down, it settles: on its back, wings spread flat, resting on the
 // surface below (street, roof or car roof) instead of hovering or poking through it.
 const sp=Math.hypot(...c.velocity);
 if(!c.rest&&c.age>.9&&Math.abs(c.velocity[1])<2.5){const y=supportAt(bird.x,bird.z);if(bird.y-y<.6)c.rest={y};}
 if(c.rest){
  const k=1-Math.exp(-dt*5),near=(v,t)=>t+Math.round((v-t)/tau)*tau,bank=(bird.vb??bird.bank)*1.02,fp=flightPitch();
  c.roll=mix(c.roll,near(c.roll,Math.PI-bank),k);c.pitch=mix(c.pitch,near(c.pitch,-fp),k);
  c.spin=c.rollSpeed=0;c.velocity=[0,0,0];bird.y=mix(bird.y,c.rest.y+.25,k);
  for(const w of c.wings){w.arm=mix(w.arm,.3,k);w.wrist=mix(w.wrist,.12,k);w.tip=mix(w.tip,.02,k);w.va=w.vw=w.vt=0;}
 }
 const pos=[bird.x,bird.y,bird.z],blend=1-Math.exp(-dt*9);
 for(const [i,axis] of ['x','y','z'].entries()){
  const move=(pos[i]-c.follow[i])*blend;c.follow[i]+=move;camera[axis]+=move;
 }
 if(c.age>.9)$('crash-banner').hidden=false;
 if(c.age>=3.7){
  state='end';$('crash-banner').hidden=true;
  finish('wasted',c.cause?c.cause:c.thrown?'Träffad av frukt!':c.vehicle?'Bilen vann.':c.ground?'Marken vann.':'Huset vann.','Ta ny sats →');
 }
}
