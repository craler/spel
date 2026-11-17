'use strict';
// ---- Events: now and then something happens on one of the squares nearby: an outdoor concert, a parade or a car show.
// It lasts a little while; an arrow points the way, and hitting enough of it before the time runs out pays a big bonus.
// While it is on, the square's usual tables, stalls and guests make room for it.
const eventKinds={
 konsert:{title:'KONSERT PÅ TORGET',goal:8,bonus:250},
 parad:{title:'PARAD PÅ TORGET',goal:8,bonus:250},
 bilsalong:{title:'BILSALONG PÅ TORGET',goal:6,bonus:300},
};
let event=null,eventWait=28,eventSerial=0;
function resetEvents(){if(event)staticKey='';event=null;eventWait=28;}
function startEvent(){
 // A square two to five blocks away, preferably ahead of the bird.
 const bi=Math.floor(bird.x/tile),bj=Math.floor(bird.z/tile),fx=Math.sin(bird.angle),fz=Math.cos(bird.angle);let best=null,score=-1e9;
 for(let i=bi-5;i<=bi+5;i++)for(let j=bj-5;j<=bj+5;j++){
  const d=Math.max(Math.abs(i-bi),Math.abs(j-bj));if(d<2||blockType(i,j)!==2)continue;
  const dx=(i+.5)*tile-bird.x,dz=(j+.5)*tile-bird.z,s=(dx*fx+dz*fz)/Math.hypot(dx,dz)-d*.15;
  if(s>score){score=s;best=[i,j];}
 }
 if(!best){eventWait=8;return;}
 const keys=Object.keys(eventKinds),kind=keys[eventSerial%keys.length],[i,j]=best;
 event={kind,i,j,x:i*tile+21,z:j*tile+21,left:kind==='bilsalong'?40:48,hits:0,serial:++eventSerial,done:false,...eventKinds[kind]};
 staticKey='';banner(event.title,'Hinn dit! '+event.goal+' träffar ger +'+event.bonus,'alert',3.4);tone(520,780,.18,'triangle',.07);tone(780,1040,.2,'triangle',.07,.16);
}
function updateEvent(dt){
 if(!event){if(state==='play'&&(eventWait-=dt)<=0)startEvent();return;}
 event.left-=dt;
 if(event.left<=0){
  if(!event.done)feedLine(event.title.split(' ')[0]+' ÖVER');
  staticKey='';event=null;eventWait=35+20*Math.random();
 }
}
// Called for every hit on a person or a vehicle; counts it if it belongs to the event.
function eventHit(id){
 if(!event||event.done||!String(id).startsWith('ev'+event.serial+':'))return;
 event.hits++;
 if(event.hits>=event.goal){
  event.done=true;event.left=Math.min(event.left,5);addPoints(event.bonus);feedLine(event.title.split(' ')[0]+' KLARAD',event.bonus);
  banner('+'+event.bonus,event.title.split(' ')[0].toLowerCase()+' i spillror','alert',2.4);tone(660,990,.12,'triangle',.08);tone(990,1320,.25,'triangle',.08,.12);
  popups.push({x:event.x,y:8,z:event.z,text:'+'+event.bonus,t:elapsed,gold:true});
 }
}
function onEventSquare(i,j){return event&&event.i===i&&event.j===j;}
// The people of the event, added to the crowd every frame.
function eventPeople(){
 if(!event)return;
 const e=event,id=n=>'ev'+e.serial+':'+n,add=(n,x,y,z,yaw,c,base,label,shout,extra={})=>people.push({x,y,z,id:id(n),i:e.i,j:e.j,route:0,walk:0,climbing:false,yaw,running:false,c,phase:n*1.7,fixed:true,event:true,base,label,shout,star:base>=80,umb:false,...extra});
 const t=elapsed;
 if(e.kind==='konsert'){
  // The band on the stage at the north side, the crowd in front of it jumping to the beat.
  const stageZ=e.z-12.5;
  add(0,e.x,1.25,stageZ,0,'#e8323a',100,'SÅNGAREN','MIN LÅT!');
  for(const [n,dx] of [[1,-3.2],[2,3.2],[3,-1.4]])add(n,e.x+dx,1.25,stageZ-1.6,0,['#30343c','#8a5ca8','#2f6f9f'][n-1],50,'BANDET','VÅR SPELNING!');
  for(let n=0;n<16;n++){const r=n%8,row=Math.floor(n/8),x=e.x-7+r*2+(row?1:0),z=stageZ+5+row*2.2,beat=Math.max(0,Math.sin(t*7.5+n*1.3));
   add(4+n,x,.3*beat,z,Math.PI,colors[(n*3)%colors.length],25,'KONSERTPUBLIK',['MIN NYA TRÖJA!','MITT I ALLSÅNGEN!','FY!'][n%3]);}
 }else if(e.kind==='parad'){
  // A marching band going round the statue: a drum major in front, then the band two by two.
  for(let n=0;n<12;n++){const a=t*.16-n*.19,r=9.5+(n%2?0:1.1),x=e.x+Math.cos(a)*r,z=e.z+Math.sin(a)*r;
   add(n,x,0,z,Math.atan2(-Math.sin(a),Math.cos(a))+Math.PI,n===0?'#f2c230':n%3?'#c8443a':'#f4f1ea',n===0?80:30,n===0?'TAMBURMAJOREN':'PARADEN',n===0?'MIN STAV!':'TAKTEN!',{fixed:false,walkPace:1});}
 }
}
// The show cars, parked in a ring round the statue facing out, polished to a shine.
const showPaint=['#c8102e','#f2c230','#1f3f9a','#111316','#e8e4da','#2e8b57'];
function eventCars(){
 if(!event||event.kind!=='bilsalong')return;
 for(let n=0;n<6;n++){const a=n/6*tau+.3,x=event.x+Math.cos(a)*9,z=event.z+Math.sin(a)*9,id='ev'+event.serial+':'+n;
  if(!wrecks.has(id))cars.push({id,parked:true,show:true,x,z,yaw:Math.atan2(Math.cos(a),Math.sin(a)),speed:0,cab:false,hatch:n%2===1,color:showPaint[n]});}
}
// Props: the stage with speakers and lights, flags and drums for the parade, a red carpet and spotlights for the cars.
function drawEvent(){
 if(!event)return;
 const e=event,box=(x,y,z,w,h,d,col,mat=0)=>M.box.add(x-w/2,y,z-d/2,0,w,h,d,rgb(col),mat);
 if(e.kind==='konsert'){
  const sz=e.z-13.5;box(e.x,0,sz,11,1.2,5.5,'#2a2d31');box(e.x,1.2,sz-2.6,11,.08,.3,'#c8102e');
  for(const sx of [-5.3,5.3]){box(e.x+sx,0,sz-2.5,.25,6,.25,'#5a5d62');box(e.x+sx,0,sz+2.5,.25,6,.25,'#5a5d62');box(e.x+sx*1.12,0,sz+1.8,1.2,2.6,1,'#141518');}
  box(e.x,6,sz,11,.3,5.5,'#5a5d62');box(e.x,4.2,sz-2.7,9,1.8,.1,'#1f3f9a');
  for(let n=0;n<6;n++){const on=Math.sin(elapsed*6+n*2)>0;M.ball.add(e.x-4.5+n*1.8,5.8,sz+2.4,0,.25,.2,.25,rgb(['#ff3a3a','#3a8bff','#ffd23a'][n%3]),on?2:0);}
  if(sky.night)pool(e.x,.06,sz+4,0,8,5,[.06,.045,.07]);
 }else if(e.kind==='parad'){
  for(const h of people)if(h.event&&h.label==='TAMBURMAJOREN'){ribbon([h.x,1.2,h.z],[h.x,3.3,h.z],.03,rgb('#c9a56a'));M.box.add(h.x,2.6,h.z,h.yaw,.04,.7,1.1,rgb('#1f3f9a'));}
  else if(h.event&&h.label==='PARADEN'&&h.phase%3<1)M.ball.add(h.x+Math.sin(h.yaw)*.35,1.05,h.z+Math.cos(h.yaw)*.35,0,.22,.18,.22,rgb('#e8e4da'));
 }else{
  for(let n=0;n<6;n++){const a=n/6*tau+.3;M.box.add(e.x+Math.cos(a)*9-1.1,.02,e.z+Math.sin(a)*9-1.1,0,2.2,.03,2.2,rgb('#a8102a'));}
  for(let n=0;n<4;n++){const a=n/4*tau+elapsed*.5;M.ball.add(e.x+Math.cos(a)*13,.4,e.z+Math.sin(a)*13,0,.3,.3,.3,rgb('#fff4d6'),2);}
  if(sky.night)pool(e.x,.06,e.z,0,12,12,[.05,.05,.045]);
 }
}
// On the 2D layer: what is on, how far along it is and how long is left, and an arrow towards it when it is out of view.
function drawEventHud(){
 if(!event)return;
 const e=event,line=e.title+' · '+e.hits+'/'+e.goal+' · '+Math.ceil(e.left)+' s';
 text(line,width/2,96,15,e.done?'#6dff85':'#ffd24a','center',900);
 const v=cameraPoint([e.x,4,e.z]),far=Math.hypot(e.x-bird.x,e.z-bird.z),m=v[2]>.6&&screen(v),seen=m&&m[0]>40&&m[0]<width-40&&m[1]>60&&m[1]<height-60;
 if(seen){if(far>30)text('▼ '+Math.round(far)+' m',m[0],m[1],14,'#ffd24a','center',900);return;}
 const l=Math.hypot(v[0],v[1])||1,dx=(v[2]<0?-1:1)*v[0]/l,dy=-(v[2]<0?-1:1)*v[1]/l,reach=Math.min(width,height);
 ctx.save();ctx.translate(width/2+dx*reach*.4,height*.46+dy*reach*.36);ctx.rotate(Math.atan2(dy,dx));
 ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(-10,-12);ctx.lineTo(-4,0);ctx.lineTo(-10,12);ctx.closePath();
 ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#0b0e14';ctx.stroke();ctx.fillStyle='#ffd24a';ctx.fill();ctx.restore();
}
