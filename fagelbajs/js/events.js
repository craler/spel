'use strict';
// ---- Events: now and then something happens on one of the squares nearby: an outdoor concert, a parade or a car show.
// It lasts a little while; for its first seconds an arrow points the way, and hitting enough of it before the time runs out pays a big bonus.
// While it is on, the square's usual tables, stalls and guests make room for it.
const eventKinds={
 konsert:{title:'KONSERT PÅ TORGET',goal:10,bonus:300},
 parad:{title:'PARAD PÅ TORGET',goal:10,bonus:300},
 bilsalong:{title:'BILSALONG PÅ TORGET',goal:8,bonus:300},
};
// Events come up at random as the bird gets about the city: once it has flown far enough from where the last one
// appeared, a new one starts on a square ahead, of a random kind, and never close to one that is already on.
// Up to two can be running at once. Each shows an arrow for its first seconds; after that you have to remember where it was.
let events=[],eventSerial=0,lastEventAt=null,eventGap=0,lastKind='';
function resetEvents(){if(events.length)shadowDirty=true;events=[];lastEventAt=null;eventGap=150;}
function startEvent(){
 const bi=Math.floor(bird.x/tile),bj=Math.floor(bird.z/tile),fx=Math.sin(bird.angle),fz=Math.cos(bird.angle),cands=[];
 for(let i=bi-7;i<=bi+7;i++)for(let j=bj-7;j<=bj+7;j++){
  const d=Math.max(Math.abs(i-bi),Math.abs(j-bj));if(d<2||blockType(i,j)!==2)continue;
  const x=i*tile+21,z=j*tile+21;if(events.some(e=>Math.hypot(e.x-x,e.z-z)<220))continue; // keep well away from the others
  if(inSight(x,z))continue; // it sets up where you cannot see it happen
  const dx=x-bird.x,dz=z-bird.z,ahead=(dx*fx+dz*fz)/Math.hypot(dx,dz);if(ahead<-.2)continue;
  cands.push([i,j,ahead-d*.1+Math.random()*.8]);
 }
 if(!cands.length)return false;
 cands.sort((a,b)=>b[2]-a[2]);const [i,j]=cands[0],keys=Object.keys(eventKinds).filter(k=>k!==lastKind),kind=keys[Math.floor(Math.random()*keys.length)];lastKind=kind; // random, but never the same kind twice in a row
 const e={kind,i,j,x:i*tile+21,z:j*tile+21,left:kind==='bilsalong'?40:48,age:0,hits:0,serial:++eventSerial,done:false,...eventKinds[kind]};
 events.push(e);shadowDirty=true; // its tables and stalls go, and so do their shadows
 banner(e.title,'Hinn dit! '+e.goal+' träffar ger +'+e.bonus,'alert',3.4);tone(520,780,.18,'triangle',.07);tone(780,1040,.2,'triangle',.07,.16);
 return true;
}
// Is any part of this square on screen and near enough to make out? Far away the haze hides it.
function inSight(x,z){
 if(Math.hypot(x-camera.x,z-camera.z)>260)return false;
 for(const [dx,dz] of [[-15,-15],[15,-15],[-15,15],[15,15],[0,0]])for(const y of [0,8]){
  const v=cameraPoint([x+dx,y,z+dz]);if(v[2]<.6)continue;const m=screen(v);
  if(m[0]>-40&&m[0]<width+40&&m[1]>-40&&m[1]<height+40)return true;
 }
 return false;
}
function updateEvent(dt){
 if(state!=='play')return;
 if(!lastEventAt)lastEventAt=[bird.x,bird.z];
 if(events.filter(e=>!e.over).length<2&&Math.hypot(bird.x-lastEventAt[0],bird.z-lastEventAt[1])>=eventGap){
  if(startEvent()){lastEventAt=[bird.x,bird.z];eventGap=230+170*Math.random();}else eventGap+=40;
 }
 // When the time is up it counts as over at once, but the square only goes back to normal once it is out of sight.
 for(const e of events){e.left-=dt;e.age+=dt;if(e.left<=0&&!e.over){e.over=true;if(!e.done)feedLine(e.title.split(' ')[0]+' ÖVER');}}
 const gone=events.filter(e=>e.over&&!inSight(e.x,e.z));if(gone.length){shadowDirty=true;events=events.filter(e=>!gone.includes(e));}
}
// Called for every hit on a person or a vehicle; counts it for the event it belongs to.
function eventHit(id){
 const e=events.find(e=>String(id).startsWith('ev'+e.serial+':'));if(!e||e.done||e.over)return;
 e.hits++;
 if(e.hits>=e.goal){
  e.done=true;e.left=Math.min(e.left,5);stats.events++;saveStats();addPoints(e.bonus);feedLine(e.title.split(' ')[0]+' KLARAD',e.bonus);
  banner('+'+e.bonus,e.title.split(' ')[0].toLowerCase()+' i spillror','alert',2.4);tone(660,990,.12,'triangle',.08);tone(990,1320,.25,'triangle',.08,.12);
  popups.push({x:e.x,y:8,z:e.z,text:'+'+e.bonus,t:elapsed,gold:true});
 }
}
function onEventSquare(i,j){return events.some(e=>e.i===i&&e.j===j);}
// The people of the event, added to the crowd every frame.
function eventPeople(){for(const e of events)peopleOf(e);}
function peopleOf(e){
 const id=n=>'ev'+e.serial+':'+n,add=(n,x,y,z,yaw,c,base,label,shout,extra={})=>people.push({x,y,z,id:id(n),i:e.i,j:e.j,route:0,walk:0,climbing:false,yaw,running:false,c,phase:n*1.7,fixed:true,event:true,base,label,shout,star:base>=80,umb:false,...extra});
 const t=elapsed;
 const R=(n,k)=>hash(e.serial,n,k); // fixed per event, so the crowd keeps its places from frame to frame
 if(e.kind==='konsert'){
  // The band on the stage at the north side. In front of it a loose, uneven crowd that dances: some jump to the beat,
  // some sway with their arms in the air, some shuffle about on the spot. Denser near the stage.
  const stageZ=e.z-12.5;
  add(0,e.x+.4*Math.sin(t*1.7),1.25,stageZ,0,'#e8323a',100,'SÅNGAREN','MIN LÅT!',{dance:5,armsUp:.6+.4*Math.sin(t*3)});
  for(const [n,dx] of [[1,-3.2],[2,3.2],[3,-1.4]])add(n,e.x+dx,1.25,stageZ-1.6,0,['#30343c','#8a5ca8','#2f6f9f'][n-1],50,'BANDET','VÅR SPELNING!',{dance:4,armsUp:.35});
  for(let n=0;n<34;n++){
   const depth=Math.pow(R(n,1),1.6),x0=e.x+(R(n,2)-.5)*(9+depth*14),z0=stageZ+4.2+depth*14;
   if(Math.hypot(x0-e.x,z0-e.z)<2.2)continue; // not on the statue
   const style=Math.floor(R(n,3)*3),beat=t*(7+R(n,4)*1.5)+n,hop=style===0?Math.max(0,Math.sin(beat))*.45:style===1?.08*Math.abs(Math.sin(beat*.5)):0;
   const x=x0+(style===2?.35*Math.sin(t*1.3+n):.1*Math.sin(beat*.5)),z=z0+(style===2?.3*Math.cos(t*1.1+n*2):0);
   const yaw=Math.PI+.5*(R(n,5)-.5)+(style===2?.6*Math.sin(t*.9+n):.2*Math.sin(beat*.25));
   add(4+n,x,hop,z,yaw,colors[Math.floor(R(n,6)*colors.length)],25,'KONSERTPUBLIK',['MIN NYA TRÖJA!','MITT I ALLSÅNGEN!','FY!','MITT HÅR!'][n%4],
    {dance:style===2?5:9,armsUp:style===1?.85+.15*Math.sin(beat):style===0?.3+.5*Math.max(0,Math.sin(beat)):undefined});
  }
 }else if(e.kind==='parad'){
  // A big marching band going round the statue: drum major and flag bearers in front, then drummers and the band
  // three abreast, in red and white with a few in gold.
  for(let n=0;n<28;n++){
   const lead=n<3,row=lead?n:3+Math.floor((n-3)/3),col=lead?(n===0?0:n===1?-1:1):(n-3)%3-1;
   const a=t*.13-row*.13,r=11+col*1.05,x=e.x+Math.cos(a)*r,z=e.z+Math.sin(a)*r;
   const drum=!lead&&row<5,c=n===0?'#f2c230':lead?'#1f3f9a':drum?'#f4f1ea':row%3===0?'#f2c230':'#c8443a';
   add(n,x,0,z,Math.atan2(-Math.sin(a),Math.cos(a))+Math.PI,c,n===0?80:lead?50:30,n===0?'TAMBURMAJOREN':lead?'FANBÄRAREN':'PARADEN',n===0?'MIN STAV!':lead?'FANAN!':'TAKTEN!',{fixed:false,drum,flag:lead});
  }
 }else{
  // Car fans strolling between the cars, stopping to look, and a few crouching by the wheels.
  for(let n=0;n<16;n++){
   const a=R(n,1)*tau+t*(R(n,2)-.5)*.12,r=5.5+R(n,3)*8,x=e.x+Math.cos(a)*r,z=e.z+Math.sin(a)*r,moving=R(n,4)<.5;
   add(n+10,x,0,z,moving?a+Math.PI/2*(R(n,2)>.5?1:-1):Math.atan2(e.x-x,e.z-z),colors[Math.floor(R(n,5)*colors.length)],20,'BILNÖRDEN',['MIN BILTIDNING!','MIN KEPS!','INTE PÅ LACKEN!'][n%3],moving?{fixed:false}:{});
  }
 }
}
// The show cars, parked in a ring round the statue facing out, polished to a shine.
const showPaint=['#c8102e','#f2c230','#1f3f9a','#111316','#e8e4da','#2e8b57'];
function eventCars(){
 for(const e of events)if(e.kind==='bilsalong')for(let n=0;n<6;n++){const a=n/6*tau+.3,x=e.x+Math.cos(a)*9,z=e.z+Math.sin(a)*9,id='ev'+e.serial+':'+n;
  if(!wrecks.has(id))cars.push({id,parked:true,show:true,x,z,yaw:Math.atan2(Math.cos(a),Math.sin(a)),speed:0,cab:false,hatch:n%2===1,color:showPaint[n]});}
}
// Props: the stage with speakers and lights, flags and drums for the parade, a red carpet and spotlights for the cars.
function drawEvent(){for(const e of events)propsOf(e);}
function propsOf(e){
 const box=(x,y,z,w,h,d,col,mat=0)=>M.box.add(x-w/2,y,z-d/2,0,w,h,d,rgb(col),mat);
 if(e.kind==='konsert'){
  const sz=e.z-13.5;box(e.x,0,sz,11,1.2,5.5,'#2a2d31');box(e.x,1.2,sz-2.6,11,.08,.3,'#c8102e');
  for(const sx of [-5.3,5.3]){box(e.x+sx,0,sz-2.5,.25,6,.25,'#5a5d62');box(e.x+sx,0,sz+2.5,.25,6,.25,'#5a5d62');box(e.x+sx*1.12,0,sz+1.8,1.2,2.6,1,'#141518');}
  box(e.x,6,sz,11,.3,5.5,'#5a5d62');box(e.x,4.2,sz-2.7,9,1.8,.1,'#1f3f9a');
  for(let n=0;n<6;n++){const on=Math.sin(elapsed*6+n*2)>0;M.ball.add(e.x-4.5+n*1.8,5.8,sz+2.4,0,.25,.2,.25,rgb(['#ff3a3a','#3a8bff','#ffd23a'][n%3]),on?2:0);}
  if(sky.night)pool(e.x,.06,sz+4,0,8,5,[.06,.045,.07]);
 }else if(e.kind==='parad'){
  for(const h of people){
   if(!h.event||scored.has(h.id))continue;
   if(h.label==='TAMBURMAJOREN'){const up=1.6+.5*Math.abs(Math.sin(elapsed*3));ribbon([h.x,1.1,h.z],[h.x+.15,1.1+up,h.z],.025,rgb('#c9a56a'));M.ball.add(h.x+.15,1.15+up,h.z,0,.08,.08,.08,rgb('#f2c230'),-1);}
   else if(h.flag){ribbon([h.x,1,h.z],[h.x,3.6,h.z],.03,rgb('#5a3a22'));const w=Math.sin(elapsed*4+h.phase)*.15; // a waving flag
    M.box.add(h.x,2.75,h.z,h.yaw+Math.PI/2+w,.03,.8,1.25,rgb(h.c==='#1f3f9a'?'#1f3f9a':'#f2c230'));M.box.add(h.x,2.75,h.z,h.yaw+Math.PI/2+w,.035,.25,1.25,rgb('#f2c230'));}
   else if(h.drum){const fx=Math.sin(h.yaw)*.32,fz=Math.cos(h.yaw)*.32;M.ball.add(h.x+fx,1.0,h.z+fz,0,.26,.2,.26,rgb('#e8e4da'));M.ball.add(h.x+fx,1.0,h.z+fz,0,.27,.05,.27,rgb('#c8443a'));}
  }
 }else{
  for(let n=0;n<6;n++){const a=n/6*tau+.3;M.box.add(e.x+Math.cos(a)*9-1.1,.02,e.z+Math.sin(a)*9-1.1,0,2.2,.03,2.2,rgb('#a8102a'));}
  for(let n=0;n<4;n++){const a=n/4*tau+elapsed*.5;M.ball.add(e.x+Math.cos(a)*13,.4,e.z+Math.sin(a)*13,0,.3,.3,.3,rgb('#fff4d6'),2);}
  if(sky.night)pool(e.x,.06,e.z,0,12,12,[.05,.05,.045]);
 }
}
// On the 2D layer: what is on, how far along it is and how long is left, and an arrow towards it when it is out of view.
function drawEventHud(){for(const [n,e] of events.filter(e=>!e.over).entries())hudOf(e,n);}
function hudOf(e,row){
 const line=e.title+' · '+e.hits+'/'+e.goal+' · '+Math.ceil(e.left)+' s';
 text(line,width/2,96+row*20,15,e.done?'#6dff85':'#ffd24a','center',900);
 const v=cameraPoint([e.x,4,e.z]),far=Math.hypot(e.x-bird.x,e.z-bird.z),m=v[2]>.6&&screen(v),seen=m&&m[0]>40&&m[0]<width-40&&m[1]>60&&m[1]<height-60;
 if(seen){if(far>30&&e.age<12)text('▼ '+Math.round(far)+' m',m[0],m[1],14,'#ffd24a','center',900);return;}
 if(e.age>=12)return; // the arrow only shows for the first seconds
 const l=Math.hypot(v[0],v[1])||1,dx=(v[2]<0?-1:1)*v[0]/l,dy=-(v[2]<0?-1:1)*v[1]/l,reach=Math.min(width,height);
 ctx.save();ctx.translate(width/2+dx*reach*.4,height*.46+dy*reach*.36);ctx.rotate(Math.atan2(dy,dx));
 ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(-10,-12);ctx.lineTo(-4,0);ctx.lineTo(-10,12);ctx.closePath();
 ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#0b0e14';ctx.stroke();ctx.fillStyle='#ffd24a';ctx.fill();ctx.restore();
}
