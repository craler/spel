'use strict';
// Game rules and simulation: flight, spray, scoring, threats, crash.
const thresholds=[100,400,1000,2000,3500], fallen=new Map(), wrecks=new Map();
let combo=0,comboTime=0,bestCombo=0,feathers=3,shield=0,carsHit=0,foodEaten=0,best=0;
try{best=+localStorage.getItem('fagelbajs.best')||0;}catch{}
const ranks=[[0,'Blyg sparv'],[100,'Parkens busfrö'],[400,'Torgets skräck'],[1000,'Stadens plåga'],[2000,'Efterlyst legend'],[3500,'Himlens härskare'],[6000,'Stadens mardröm']];
const number=n=>n.toLocaleString('sv-SE');
function rankOf(score){return ranks.filter(r=>score>=r[0]).at(-1)[1];}
function finish(heading,cause,action){
 state='end';keys.clear();
 const record=points>best;if(record){best=points;try{localStorage.setItem('fagelbajs.best',String(best));}catch{}}
 const row=(k,v)=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>',mins=Math.floor(elapsed/60),secs=String(Math.floor(elapsed%60)).padStart(2,'0');
 panel(heading,'<p class="cause">'+cause+'</p><p class="score">'+number(points)+'<small> poäng</small>'+(record?'<em>NYTT REKORD</em>':'')+'</p>'+
  '<dl class="stats">'+row('Stjärnor','★'.repeat(wanted)||'–')+row('Träffar',hits)+row('Bilar',carsHit)+row('Bästa kombo','×'+bestCombo)+row('Snodd mat',foodEaten)+row('I luften',mins+':'+secs)+'</dl>'+
  '<p class="rank">Titel: <b>'+rankOf(points)+'</b>'+(record?'':' · rekord '+number(best))+'</p>',action);
}
let points=0,cars=[],sprayCount=0;
const carPaint=['#ff715f','#37b9ca','#ffd950','#7ea3f5','#e682c2'];
const maxWanted=5, sidewalkEdge=6.45, sidewalkLength=tile-2*sidewalkEdge;
let wanted=0,trafficClock=0,trafficFactor=1,throwWait=1,thrown=[],mist=[],tank=1,refillWait=0,emptyTank=false;
const runners=new Map();
function resetChase(){
 wanted=0;trafficClock=0;trafficFactor=1;throwWait=1;thrown=[];mist=[];tank=1;refillWait=0;emptyTank=false;runners.clear();
}
function updateThreats(dt){
 if(!wanted)return;
 throwWait-=dt;
 if(throwWait<=0){
  const reach=27+3*wanted;
  const candidates=people.filter(h=>!h.climbing&&!h.fixed&&!scored.has(h.id)&&bird.y-h.y<reach&&Math.hypot(h.x-bird.x,h.z-bird.z)<reach);
  if(candidates.length){
   const h=candidates[Math.floor(Math.random()*candidates.length)],t=.9+.4*Math.random();
   // Commit to a single aim point during the wind-up so turning dodges the fruit.
   const lead=(t+.45)*(.962+.007*wanted),v=forwardSpeed();
   const x=bird.x+Math.sin(bird.angle)*v*lead,z=bird.z+Math.cos(bird.angle)*v*lead;
   thrown.push({x:h.x,y:h.y+1.7,z:h.z,vx:(x-h.x)/t,vz:(z-h.z)/t,
    vy:(bird.y+bird.vy*lead-h.y-1.7)/t+gravity*t/2,age:0,windup:.45,owner:h.id,kind:Math.random()<.5?'#f44d47':'#ffb932'});
   throwWait=1.9/(.65+wanted*.52);
  }else throwWait=.23;
 }
 thrown=thrown.filter(o=>{
  if(o.windup>0){
   const h=people.find(h=>h.id===o.owner);if(!h||scored.has(h.id))return false;
   o.windup-=dt;return true;
  }
  o.age+=dt;o.x+=o.vx*dt;o.z+=o.vz*dt;o.y+=o.vy*dt-gravity*dt*dt/2;o.vy-=gravity*dt;
  if(solid(o.x,o.y,o.z)||o.age>3.8)return false;
  if(state==='play'&&Math.hypot(o.x-bird.x,o.y-bird.y,o.z-bird.z)<.83){
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
 const depths=[.92+r-Math.abs(side),2.05+r-Math.abs(along),1.48+r-y];
 const depth=Math.min(...depths);if(depth<0)return null;
 const sign=Math.sign;
 const n=depth===depths[2]?[0,1,0]:depth===depths[0]?[sign(side)*cs,0,-sign(side)*sn]:[sign(along)*sn,0,sign(along)*cs];
 return {n,depth,car:true};
}
// ---- Feedback: banner for big moments, a score feed by the sight, numbers and speech bubbles in the world.
let popups=[],feed=[],bubbles=[],splash=[],marker=-9,markerGold=false,bannerUntil=0,lastDrop=-9,lastBubble=-9;
const wantedNote=['','Nu kastar de frukt – väj undan','De klättrar upp på taken efter dig','Paraplyerna åker fram','En hök har fått syn på dig','Maxkaos – hela staden är efter dig'];
const shouts=['USCH!','ÄSCH!','MEN VA?!','MIN FRISYR!','FY BUBBLAN!','NEEEJ!','MITT I NYLLET!','BLÄ!','DUVJÄKEL!','INTE IGEN!'];
function banner(title,sub='',kind='',time=2.2){
 const el=$('feedback'),big=document.createElement('strong');el.className=kind;el.textContent='';big.textContent=title;el.append(big);
 if(sub){const line=document.createElement('span');line.textContent=sub;el.append(line);}
 void el.offsetWidth;el.classList.add('on');bannerUntil=elapsed+time;
}
function feedLine(label,amount=0,tags=''){feed.unshift({label:label.replace(/!+$/,''),amount,tags,t:elapsed});if(feed.length>5)feed.length=5;}
function bubble(x,y,z,text){if(elapsed-lastBubble<.2)return;lastBubble=elapsed;bubbles.push({x,y,z,text,t:elapsed});if(bubbles.length>8)bubbles.shift();}
// The spray fans out on the way down, so the area it can hit grows with the fall.
function hitRadius(fall){return clamp(1.65+(fall-10)*.0325,1.65,3.6);}
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
 if(p){if(p.dive){mult*=2;tags.push('STÖRTDYK ×2');}if(p.alt-targetY<14){mult*=2;tags.push('LÅGFLYG ×2');}}
 combo=comboTime>0?combo+1:1;comboTime=2.6;bestCombo=Math.max(bestCombo,combo);
 const amount=Math.round(base*mult*(1+.25*Math.min(8,combo-1)));
 hits++;feedLine(label,amount,tags.join(' · '));
 if(pos)popups.push({x:pos[0],y:pos[1],z:pos[2],text:'+'+amount,t:elapsed,gold:mult>1});
 marker=elapsed;markerGold=mult>1;hitTick(base>=25||mult>1,1+.035*Math.min(10,combo-1));
 if(base>=40){slowmo=.35;shake=Math.max(shake,.35);} // the big ones get a beat of slow motion
 addPoints(amount);
}
function reset(){
 resetChase();points=0;combo=comboTime=bestCombo=carsHit=foodEaten=shield=0;feathers=3;hawk=null;brokeUmb.clear();eaten.clear();sprayCount=0;fallen.clear();
 popups=[];feed=[];bubbles=[];splash=[];marker=lastDrop=lastBubble=-9;bannerUntil=0;$('feedback').classList.remove('on');wrecks.clear();cars=[];
 if(crashVoice){try{crashVoice.stop();}catch{}crashVoice=null;}
 rig=null;crash=null;document.body.classList.remove('crashed');$('crash-banner').hidden=true;
 bird={x:0,z:0,y:21,angle:0,bank:0,speed:14,vy:0,fold:0,steep:0,climb:0,flare:0,effort:0,skim:0,lastSkim:-9};slowmo=shake=0;elapsed=hits=cooldown=0;drops=[];stains=[];scored.clear();
}
// body is HTML built from the game's own strings and numbers.
function panel(heading,body,action){$('title').textContent=heading;$('brief').innerHTML=body;$('record').textContent='';$('go').textContent=action;$('overlay').hidden=false;$('go').focus();}
function togglePause(){if(state==='play'){state='pause';keys.clear();panel('Flygpaus','<p class="cause">Duvan väntar där du lämnade den.</p>','Fortsätt flyga →');}else if(state==='pause')start();}
function start(){if(state!=='pause'){reset();setSky(flights);flights++;try{localStorage.setItem('fagelbajs.flights',String(flights));}catch{}}state='play';$('overlay').hidden=true;$('go').blur();try{sound ||= new AudioContext();sound.resume().catch(()=>{});setupAudio();}catch{}}
function view(){if(crash)return;above=!above;rig=null;$('camera').textContent=above?'Vy: ovanifrån':'Vy: bakom';}
// Convert the stored dive speed into horizontal travel as the nose tips down.
function forwardSpeed(){
 // As the dive develops, the speed gained from falling goes mostly downwards.
 const tuckDive=bird.fold*clamp(-bird.vy/25,0,1);
 const horizontalFraction=1-Math.max(.925*bird.steep,.94*tuckDive);
 return bird.speed*horizontalFraction*Math.cos(bird.climb*1.31);
}
function payload(){return {x:bird.x-.45*Math.sin(bird.angle),z:bird.z-.45*Math.cos(bird.angle),y:bird.y-.22,vx:Math.sin(bird.angle)*forwardSpeed(),vz:Math.cos(bird.angle)*forwardSpeed(),vy:bird.vy-6};}
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
 p.end=landingTime(p);p.age=0;p.seed=n;p.alt=bird.y;p.dive=bird.fold>.5||bird.vy<-14;drops.push(p);cooldown+=.05;tank=Math.max(0,tank-1/60);refillWait=.5;
 if(tank<1/60-1e-8){emptyTank=true;banner('TANKEN ÄR TOM','Sno mat vid de gula pilarna','hurt',2);}
 for(let k=0;k<2;k++){const a=(n*2+k)*2.39996,drift=.65+hash(n,k,1)*1.5;
  mist.push({x:p.x,y:p.y,z:p.z,vx:p.vx+Math.cos(a)*drift,vy:p.vy*.85+Math.sin(a),vz:p.vz+Math.sin(a)*drift,age:0,life:.65+hash(k,n,3)*.8});}
}
function simulate(dt){
 const b=bird,held=(...codes)=>codes.some(c=>keys.has(c)),dive=held('ShiftLeft','ShiftRight');
 const steer=+held('KeyD','ArrowRight')-+held('KeyA','ArrowLeft'), pitch=(+held('KeyS','ArrowDown')-+held('KeyW','ArrowUp'))*(reversePitch?-1:1);
 if(!dive&&b.fold>.65&&b.wasDiving){b.flare=Math.max(0,b.speed-14)*.95;tone(200,430,.2,'sine',.035);}
 b.wasDiving=dive;b.fold=mix(b.fold,+dive,1-Math.exp(-dt*10));b.bank=mix(b.bank,steer,1-Math.exp(-dt*5));b.angle+=b.bank*dt*(1.52-.44*b.fold);
 // Ramp into the dive. A short tap makes a small range adjustment.
 const desiredSteep=pitch<0?1:0;
 b.steep+=clamp(desiredSteep-b.steep,-dt*(pitch>0?2.4:1.45),dt*1.1);
 const diveCurve=b.steep*(.62+.38*b.steep);
 const upLimit=clamp((82-b.y)/9,0,1);
 const targetClimb=pitch>0&&!dive?1:0;
 b.climb=mix(b.climb,targetClimb,1-Math.exp(-dt*(targetClimb?.92:2.7)));
 const stallSoftness=clamp((b.climb-.87)/.13,0,1);
 const wantedVy=19*Math.sin(1.31*b.climb)*upLimit*(1-.60*stallSoftness)-40*diveCurve+b.flare*.82;
 const acceleration=dive?-40-b.vy*.19:(wantedVy-b.vy)*2.7;
 b.vy=clamp(b.vy+acceleration*dt,-51,27);b.y+=b.vy*dt;
 b.flare*=Math.exp(-dt*1.2);
 b.effort=mix(b.effort,dive?0:pitch>0?1:pitch<0?0:.28,1-Math.exp(-6*dt));
 b.speed=clamp(b.speed+(Math.max(0,-b.vy)*1.65+(14-b.speed)*(dive?.18:.55)-Math.max(0,b.vy)*.19)*dt,10,58);
 b.x+=Math.sin(b.angle)*forwardSpeed()*dt;b.z+=Math.cos(b.angle)*forwardSpeed()*dt;
 trafficFactor=mix(trafficFactor,1+.61*wanted,1-Math.exp(-dt*1.5));trafficClock+=dt*trafficFactor;traffic();
 if(solid(b.x,b.y,b.z,.28)){startCrash();return;}
 if(b.y<1.77){const vehicle=cars.find(c=>carContact(c,b.x,b.y,b.z,.28));if(vehicle){const surface=carContact(vehicle,b.x,b.y,b.z,.28);crashCar(vehicle);startCrash(surface);return;}}
 // Skimming a wall, a roof edge or the ground at speed without touching pays a little.
 if(solid(b.x,b.y,b.z,1.15)&&Math.hypot(forwardSpeed(),b.vy)>12)b.skim+=dt;
 else{if(b.skim>.12&&elapsed-b.lastSkim>2){b.lastSkim=elapsed;feedLine('NÄRA ÖGAT',10);addPoints(10);tone(900,1300,.07,'triangle',.04);}b.skim=0;}
 const wingCycle=Math.floor(wingPhase/tau);
 elapsed+=dt;shield=Math.max(0,shield-dt);if(comboTime>0&&(comboTime-=dt)<=0)combo=0;cooldown=held('Space')?Math.max(-dt,cooldown-dt):Math.max(0,cooldown-dt);recharge(dt,held('Space'));wingPhase+=dt*(1.4+23*b.effort);
 if(pitch>0&&!dive&&Math.floor(wingPhase/tau)>wingCycle)wingBeat();
 if(held('Space'))drop();
 gather(dt);updateMist(dt);updateSplash(dt);updateThreats(dt);updateHawk(dt);updateFood();if(state!=='play')return;
 drops=drops.filter(p=>{
  const prev=p.age;p.age+=dt;const end=p.end;
  const [x0,y0,z0]=at(p,prev),[x1,y1,z1]=at(p,Math.min(end,p.age));
  if(y1<y0){
   const victim=people.find(h=>{
    const head=h.y+1.8;if(head>y0||head<y1||scored.has(h.id))return false;
    const f=(y0-head)/(y0-y1);return Math.hypot(h.x-mix(x0,x1,f),h.z-mix(z0,z1,f))<hitRadius(p.alt-head)+(p.big?.4:0);
   });
   if(victim&&victim.umb){
    brokeUmb.add(victim.id);feedLine('PARAPLYET TOG SMÄLLEN');bubble(victim.x,victim.y+2.7,victim.z,'HA! MISS!');
    splashAt(victim.x,victim.y+2.4,victim.z,5);splat(victim.x,victim.y,victim.z);return false;
   }
   if(victim){
    scored.add(victim.id);fallen.set(victim.id,elapsed);
    award(victim.base||10,victim.label||'SPLATT',p,victim.y,[victim.x,victim.y+2.4,victim.z]);
    bubble(victim.x,victim.y+2.1,victim.z,victim.shout||shouts[Math.floor(Math.random()*shouts.length)]);
    splashAt(victim.x,victim.y+1.8,victim.z,6);splat(victim.x,victim.y,victim.z,true);return false;
   }
  }
  const extra=hitRadius(p.alt-1.5)-1.65,carTime=flightTime(p,1.48);
  if(carTime>=0&&carTime<=end&&prev<=carTime&&p.age>=carTime){
   const [x,,z]=at(p,carTime),vehicle=cars.find(c=>carContact(c,x,1.47,z,extra));
   if(vehicle){
    if(!wrecks.has(vehicle.id)){
     crashCar(vehicle);carsHit++;award(vehicle.cab?50:25,vehicle.cab?'CABBEN':'PLÅTSMÄLL',p,0,[vehicle.x,2.5,vehicle.z]);
     bubble(vehicle.x,2.3,vehicle.z,vehicle.cab?'MIN FRISYR!':'MIN LACK!');
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
   stains.push(stain);splat(x,y,z,p.big);
   const sq=block(Math.floor(x/tile),Math.floor(z/tile));
   if(sq.statue&&y>.5&&!scored.has('st'+sq.key)&&Math.hypot(x-sq.statue[0],z-sq.statue[1])<1.9+extra){scored.add('st'+sq.key);award(40,'KULTURSKYMF',p,0,[sq.statue[0],6.4,sq.statue[1]]);}
   return false;
  }
  return true;
 });
 if(elapsed>bannerUntil)$('feedback').classList.remove('on');
 popups=popups.filter(p=>elapsed-p.t<1.1);bubbles=bubbles.filter(b=>elapsed-b.t<1.5);
 if(stains.length>650)stains.splice(0,stains.length-600);
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
 if(!rig)setCamera(1/60);
 bounce(surface,true);state='crash';keys.clear();crashVoice=voice(0,.8);if(!crashVoice)tone(155,35,.34,'triangle');document.body.classList.add('crashed');
}
// A wingtip hitting pavement or a facade kicks the wrist and the shoulder
// separately. Latch each contact until the feathers clear the surface.
function tipContact(w,side,c){
 const roll=bird.bank*.62+c.roll,pitch=flightPitch()+c.pitch;
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
function advanceCrash(dt){
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
