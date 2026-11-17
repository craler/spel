'use strict';
// Everything that lives in the city: pedestrians, traffic, food, the hawk.
function pavement(i,j,distance){
 const L=sidewalkLength,t=wrap(distance,4*L),corner=Math.floor(t/L),u=t%L;
 const x=i*tile+sidewalkEdge,z=j*tile+sidewalkEdge;
 if(corner===0)return [x+u,z];
 if(corner===1)return [x+L,z+u];
 if(corner===2)return [x+L-u,z+L];
 return [x,z+L-u];
}
function closestPavement(i,j,x,z){
 const L=sidewalkLength,a=x-i*tile-sidewalkEdge,b=z-j*tile-sidewalkEdge;
 const cx=clamp(a,0,L),cz=clamp(b,0,L);
 const options=[[cx,0,cx],[L,cz,L+cz],[cx,L,3*L-cx],[0,cz,4*L-cz]];
 let best=options[0],min=Infinity;
 for(const opt of options){const dist=(opt[0]-a)**2+(opt[1]-b)**2;if(dist<min){min=dist;best=opt;}}
 return best[2];
}
function walkToward(r,dest,step){
 const L=sidewalkLength*4,diff=wrap(dest-r.route+L/2,L)-L/2;
 r.route+=clamp(diff,-step,step);return Math.abs(diff)<=step;
}
function pedestrian(i,j,k,dt){
 const id=i+','+j+','+k,phase=hash(i,j,k)*tau,perimeter=4*sidewalkLength;
 const home=k*perimeter/8+phase,walk=(k%2?1.15:-.95)*(jogger(i,j,k)?3.6:1);
 const when=fallen.get(id)??elapsed;
 let route=home+walk*when,y=0,[x,z]=pavement(i,j,route),climbing=false,running=false;
 const side=Math.floor(wrap(route,perimeter)/sidewalkLength);
 let yaw=[Math.PI/2,0,-Math.PI/2,Math.PI][side]+(walk<0?Math.PI:0);
 if(wanted){
  let r=runners.get(id);
  if(!r){r={route,x,z};runners.set(id,r);}
  if(!scored.has(id)){
   // Everyone runs after the bird along the pavement; nobody climbs the walls.
   const step=dt*(2.75+.55*wanted),ox=r.x,oz=r.z;
   walkToward(r,closestPavement(i,j,bird.x,bird.z),step);
   [r.x,r.z]=pavement(i,j,r.route);
   if(Math.hypot(r.x-ox,r.z-oz)>1e-4){r.yaw=Math.atan2(r.x-ox,r.z-oz);r.moving=elapsed;}
  }
  x=r.x;z=r.z;route=r.route;yaw=r.yaw??yaw;running=elapsed-(r.moving??-9)<.2;
 }
 return {x,y,z,id,i,j,route,walk,climbing,yaw,running,c:colors[Math.floor(hash(i,j,k+8)*colors.length)],phase,
  umb:wanted>=3&&hash(i,j,k+20)<.3&&!brokeUmb.has(id)};
}

const brokeUmb=new Set(), eaten=new Map(), alarms=new Map();
let hawk=null;
// ---- High-value targets (gold stars): they move, which is what makes them worth more.
function jogger(i,j,k){return k===7&&hash(i,j,91)<.4;}
// Boats drift down the canal, under the bridges and on into the next block.
// Two lanes, one each way, with their own speed and spacing per canal. The same formula in every block, so a boat
// that slips under a bridge comes out on the other side.
function boatsAt(b){
 const a=hash(b.i,1,3),c=hash(b.i,2,3);
 return [{x:b.x+19+.6*Math.sin(elapsed*.4+b.j),z:b.z+wrap(elapsed*(1.6+a)+a*tile,tile),yaw:0},
         {x:b.x+23+.6*Math.sin(elapsed*.3+b.j),z:b.z+tile-wrap(elapsed*(1.3+c)+c*tile,tile),yaw:Math.PI}];
}
function balloons(){
 const out=[],S=168,ci=Math.round(bird.x/S),cj=Math.round(bird.z/S);
 for(let i=ci-1;i<=ci+1;i++)for(let j=cj-1;j<=cj+1;j++){
  const h=hash(i,j,55);if(h<.45)continue;const s=h*40;
  out.push({id:'bal'+i+','+j,hue:h,x:i*S+84+30*Math.sin(elapsed*.06+s),y:44+7*Math.sin(elapsed*.1+s),z:j*S+84+30*Math.cos(elapsed*.05+s)});
 }
 return out;
}
function gather(dt=0){
 people=[];const ix=Math.floor(bird.x/tile),iz=Math.floor(bird.z/tile);
 for(let i=ix-2;i<=ix+2;i++)for(let j=iz-2;j<=iz+2;j++){
  for(let k=0;k<8;k++){
   const h=pedestrian(i,j,k,dt);
   if(jogger(i,j,k)){h.base=30;h.label='JOGGAREN';h.shout='MITT VARVREKORD!';h.star=true;h.c='#d9f03a';h.running=!scored.has(h.id);}
   people.push(h);
  }
  const b=block(i,j),extra=(id,x,y,z,yaw,c,base,label,shout)=>people.push({x,y,z,id,i,j,route:0,walk:0,climbing:false,yaw,running:false,c,phase:i+j,fixed:true,base,label,shout,star:true,umb:false});
  if(b.cleaner){const [cx,cz,top,s]=b.cleaner;extra('win'+i+','+j,cx,2+(top-6)*(.5+.5*Math.sin(elapsed*.4+s)),cz,0,'#e87a1e',60,'FÖNSTERPUTSAREN','MIN HINK!');} // rides a lift up and down the facade
  if(b.type===3)for(const [n,q] of boatsAt(b).entries())extra('boat'+n+','+i+','+j,q.x,WATER+.3,q.z,q.yaw,n?'#3f7fa8':'#e8e4da',45,'BÅTTUREN','MAN ÖVER BORD!');
  // People who stay put: café guests, picnickers, the wedding party.
  for(const [n,f] of block(i,j).folk.entries())people.push({x:f.x,y:0,z:f.z,id:'f'+i+','+j+','+n,i,j,route:0,walk:0,climbing:false,
   yaw:hash(i,j,n+300)*tau,running:false,c:f.c,phase:n,fixed:true,base:f.base,label:f.label,shout:f.shout,bride:f.bride,umb:false});
 }
 if(runners.size>520){for(const [id,r] of runners)if(Math.hypot(r.x-bird.x,r.z-bird.z)>145)runners.delete(id);}
}
// How far each car has fallen behind its place in the stream because it had to stop.
const lag=new Map();let lastClock=0;
function traffic(){
 const moved=Math.max(0,trafficClock-lastClock)*5.2;lastClock=trafficClock;
 cars=[];
 // Each car owns a persistent lane and identity as the visible blocks scroll.
 for(const across of [false,true]){
  const sidePos=across?bird.z:bird.x,alongPos=across?bird.x:bird.z;
  for(let lane=Math.round(sidePos/tile)-2;lane<=Math.round(sidePos/tile)+2;lane++){
   // All lanes run at one speed with one car per block, and the two directions of travel are half a block out of step,
   // so streams of cars cross each junction in turn (as if on green lights) and never drive through each other.
   const direction=lane%2===0?1:-1,speed=direction*5.2;
   const offset=(across?0:21)+speed*trafficClock,spacing=tile;
   const first=Math.floor((alongPos-100-offset)/spacing);
   for(let n=first;n<=first+5;n++){
    const id='car:'+across+','+lane+','+n;if(wrecks.has(id))continue;
    const along=n*spacing+offset+6*hash(lane,n,5+across)-3-direction*(lag.get(id)||0),side=lane*tile+direction*1.45;
    cars.push({id,across,lane,along,direction,x:across?along:side,z:across?side:along,yaw:(across?Math.PI/2:0)+(direction<0?Math.PI:0),
     speed:Math.abs(speed)*trafficFactor,bus:hash(lane,n,11)<.09,cab:hash(lane,n,11)>=.09&&hash(lane,n,7+across)<.16,hatch:hash(lane,n,3)<.45,color:carPaint[Math.floor(hash(lane,n,+across)*carPaint.length)]});
   }
  }
 }
 // Parked cars: they do not move, but they can be hit (the alarm goes off) and flown into.
 const px=Math.floor(bird.x/tile),pz=Math.floor(bird.z/tile);
 for(let i=px-2;i<=px+2;i++)for(let j=pz-2;j<=pz+2;j++)for(const [n,p] of block(i,j).parked.entries()){
  const id='park:'+i+','+j+','+n;if(!wrecks.has(id))cars.push({id,parked:true,x:p.x,z:p.z,yaw:p.yaw,speed:0,cab:false,hatch:n%2===0,color:p.c});
 }
 // Drivers brake: a car stops behind a wreck or a stopped car, and gives way to cross traffic already in the junction.
 // Once the way is clear it drives a little faster until it is back in its place. Only a car that had no room to stop crashes.
 const moving=cars.filter(c=>!c.parked),blockers=[...moving,...wrecks.values()];
 for(const c of moving){
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),held=lag.get(c.id)||0;let stop=false;
  for(const o of blockers){
   if(o===c)continue;
   const dx=o.x-c.x,dz=o.z-c.z,ahead=dx*fx+dz*fz;
   if(ahead<=0||ahead>(o.bus||c.bus?13:8.5)||Math.abs(dx*fz-dz*fx)>2.1)continue;
   if(wrecks.has(o.id)||o.stopped||(o.across===c.across&&o.lane===c.lane)||(c.across&&!o.across)){stop=true;break;}
  }
  c.stopped=stop;
  if(stop)lag.set(c.id,held+moved);else if(held>0){const left=held-moved*.6;if(left>0)lag.set(c.id,left);else lag.delete(c.id);}
 }
 if(lag.size>300)for(const id of lag.keys())if(!moving.some(c=>c.id===id))lag.delete(id);
 // Wrecks are towed after a while.
 for(const w of [...wrecks.values()]){
  if(elapsed-w.pileTime>24){wrecks.delete(w.id);continue;}
  if(w.parked)continue;
  for(const c of cars){ // anything that drives into a wreck, from any direction, crashes into it
   if(c.parked||wrecks.has(c.id)||Math.abs(c.x-w.x)>9||Math.abs(c.z-w.z)>9)continue;
   if(carContact(w,c.x,1,c.z,c.bus?1.6:1.15))crashCar(c,w);
  }
 }
 cars=cars.filter(c=>!wrecks.has(c.id));
 for(const c of wrecks.values()){
  const t=clamp((elapsed-c.hitTime)/.65,0,1),travel=c.speed*.33*(1-(1-t)**2);
  c.yaw=c.startYaw+c.spin*t*(c.chain>1?.35:1);
  c.x=c.startX+travel*Math.sin(c.startYaw)+.85*t*c.spin*Math.cos(c.startYaw);
  c.z=c.startZ+travel*Math.cos(c.startYaw)-.85*t*c.spin*Math.sin(c.startYaw);
  if(Math.abs(c.x-bird.x)<110&&Math.abs(c.z-bird.z)<110)cars.push(c);
 }
}
function crashCar(c,parent){
 if(wrecks.has(c.id))return;
 Object.assign(c,{startX:c.x,startZ:c.z,startYaw:c.yaw,hitTime:elapsed,spin:hash(c.x,c.z,2)>.5?1:-1,
  pileTime:parent?parent.pileTime:elapsed,chain:parent?parent.chain+1:1});
 wrecks.set(c.id,c);crunch();if(Math.hypot(c.x-bird.x,c.z-bird.z)<30)shake=Math.max(shake,.4);
 if(parent){carsHit++;run.chain=Math.max(run.chain,c.chain);award(15*c.chain,'KEDJEKROCK ×'+c.chain,null,0,[c.x,2.5,c.z]);}
}
// The tank refills by itself as soon as the bird stops spraying.
function recharge(dt,pressed){
 if(!pressed||emptyTank){
  refillWait-=dt;
  if(refillWait<=0){tank=Math.min(1,tank+dt*.26);if(tank>=.25)emptyTank=false;}
 }
}
// Fresh droppings on the ground are slippery: cars spin out on a big patch, people on a small one.
function slips(){
 const fresh=stains.filter(s=>!s.used&&s.wall===undefined&&s.y<.3&&elapsed-s.t<25);if(fresh.length<2)return;
 const near=(x,z,r)=>fresh.filter(s=>!s.used&&(s.x-x)**2+(s.z-z)**2<r*r);
 for(const c of cars){
  if(c.parked||wrecks.has(c.id))continue;
  const patch=near(c.x,c.z,1.8);if(patch.length<6)continue;
  for(const s of patch)s.used=true;
  crashCar(c);carsHit++;run.carSlips++;award(20,'BAJSHALKA',null,0,[c.x,2.5,c.z]);bubble(c.x,2.3,c.z,'JAG HALKAR!');
 }
 for(const h of people){
  if(h.fixed||h.climbing||h.y>.1||scored.has(h.id))continue;
  const patch=near(h.x,h.z,.9);if(patch.length<2)continue;
  for(const s of patch)s.used=true;
  scored.add(h.id);fallen.set(h.id,elapsed);hits++;feedLine('HALKADE',5);addPoints(5);
  popups.push({x:h.x,y:2.2,z:h.z,text:'+5',t:elapsed});bubble(h.x,2.1,h.z,'HOPPSAN!');yelp();
 }
}
// One hit from fruit or the hawk costs a feather; only the last one brings the bird down.
function hurt(text,surface){
 if(shield>0||state!=='play')return;
 if(--feathers>0){
  shield=1.5;bird.vy-=7;bird.speed=Math.max(10,bird.speed*.7);combo=0;comboTime=0;shake=1;
  banner(text,feathers===1?'Sista fjädern':feathers+' fjädrar kvar','hurt',1.9);tone(260,90,.25,'sawtooth',.06);
  const fl=$('flash');fl.classList.remove('on');void fl.offsetWidth;fl.classList.add('on');return;
 }
 startCrash(surface);
}
// From four stars a hawk circles overhead and attacks out of the sun. Its shadow is the warning:
// it circles the spot you are aiming at, slides in over it, and then the hawk stoops.
// A hard turn, a dive to street level or a building in between makes it miss.
function updateHawk(dt){
 if(wanted<4){hawk=null;return;}
 const L=sky.dir,b=bird,fierce=wanted>=5;
 if(!hawk){
  hawk={x:b.x+L[0]*120,y:b.y+80,z:b.z+L[2]*120,vx:0,vy:0,vz:1,mode:'circle',t:fierce?5:7,orbit:0,flap:0,miss:99,tuck:0,dread:0,beat:0,size:2.3,bank:0,yaw:0};
  banner('HÖKEN','Sväng när skuggan når siktet','alert',3.6);screech();
 }
 const h=hawk,ox=h.x,oy=h.y,oz=h.z,ease=rate=>1-Math.exp(-dt*rate);
 const steer=(tx,ty,tz,rate)=>{ // turn the velocity towards a direction by at most `rate` radians per second
  const speed=Math.hypot(h.vx,h.vy,h.vz)||1,ux=h.vx/speed,uy=h.vy/speed,uz=h.vz/speed;
  const cos=clamp(ux*tx+uy*ty+uz*tz,-1,1),f=Math.min(1,rate*dt/Math.max(1e-4,Math.acos(cos)));
  const nx=mix(ux,tx,f),ny=mix(uy,ty,f),nz=mix(uz,tz,f),l=Math.hypot(nx,ny,nz)||1;
  h.vx=nx/l*speed;h.vy=ny/l*speed;h.vz=nz/l*speed;return cos;
 };
 const leave=()=>{h.mode='climb';h.t=2.4;};
 h.t-=dt;
 if(h.mode==='circle'||h.mode==='lock'){
  const lock=h.mode==='lock',p=payload(),aim=at(p,Math.max(0,flightTime(p,0)));
  const k=lock?clamp(h.t/1.6,0,1):1,r=(15+4*Math.sin(h.orbit*.37))*k*k;
  h.orbit+=dt*(lock?1.7:.75);
  // Stand between the sun and the ground point where the shadow should fall.
  const gx=aim[0]+Math.cos(h.orbit)*r,gz=aim[2]+Math.sin(h.orbit)*r,alt=clamp(b.y+26,40,104),s=alt/L[1],f=ease(lock?4.5:1.6);
  h.x+=(gx+L[0]*s-h.x)*f;h.y+=(alt-h.y)*f;h.z+=(gz+L[2]*s-h.z)*f;
  const g=ease(6);h.vx=mix(h.vx,(h.x-ox)/dt,g);h.vy=mix(h.vy,(h.y-oy)/dt,g);h.vz=mix(h.vz,(h.z-oz)/dt,g);
  h.tuck=mix(h.tuck,0,ease(4));h.size=mix(h.size,lock?3.4:2.3,ease(2.2));h.dread=mix(h.dread,lock?1-.55*k:.14,ease(5));h.flap+=dt*3.4;
  if(!lock&&h.t<=0&&b.y>15){h.mode='lock';h.t=1.6-.5*clamp((b.y-45)/30,0,1);screech(true);} // high up there is less warning
  else if(lock&&b.y<13){h.mode='circle';h.t=3;}
  else if(lock&&h.t<=0){
   // Commit to an intercept point. From here it can only bend its line a little.
   const speed=(fierce?50:44)+8*clamp((b.y-45)/30,0,1),T=Math.hypot(b.x-h.x,b.y-h.y,b.z-h.z)/speed,v=forwardSpeed();
   const tx=b.x+Math.sin(b.angle)*v*T-h.x,ty=b.y+b.vy*T*.5-h.y,tz=b.z+Math.cos(b.angle)*v*T-h.z,l=Math.hypot(tx,ty,tz)||1;
   h.vx=tx/l*speed;h.vy=ty/l*speed;h.vz=tz/l*speed;h.mode='stoop';h.t=4.5;h.miss=99;whoosh();
  }
 }else if(h.mode==='stoop'){
  const speed=Math.hypot(h.vx,h.vy,h.vz),d=Math.hypot(b.x-h.x,b.y-h.y,b.z-h.z),T=d/speed,v=forwardSpeed();
  const tx=b.x+Math.sin(b.angle)*v*T-h.x,ty=b.y+b.vy*T*.5-h.y,tz=b.z+Math.cos(b.angle)*v*T-h.z,l=Math.hypot(tx,ty,tz)||1;
  // In the last half second it is committed: a bird that is turning hard when it arrives slips past.
  const cos=steer(tx/l,ty/l,tz/l,T<(fierce?.4:.55)?0:(fierce?.3:.22)+.14*clamp((b.y-45)/30,0,1));
  h.x+=h.vx*dt;h.y+=h.vy*dt;h.z+=h.vz*dt;h.tuck=mix(h.tuck,1,ease(6));h.dread=1;h.size=mix(h.size,2.6,ease(3));h.miss=Math.min(h.miss,d);
  if(d<1.9&&shield<=0){hurt('HÖKEN SLOG TILL',{n:[h.vx/speed,h.vy/speed,h.vz/speed],depth:0,cause:'Höken tog dig.'});leave();}
  else if((cos<0&&d>3)||h.y<14||h.t<=0||solid(h.x,h.y,h.z)){
   if(h.miss<9&&state==='play'){run.dodges++;addPoints(30);feedLine('HÖKEN MISSADE',30);popups.push({x:b.x,y:b.y+1.2,z:b.z,text:'+30',t:elapsed,gold:true});whoosh();}
   leave();
  }
 }else{ // climb away, then start circling again
  const flat=Math.hypot(h.vx,h.vz)||1;steer(h.vx/flat*.72,.69,h.vz/flat*.72,2.6);
  const speed=Math.hypot(h.vx,h.vy,h.vz),slow=Math.max(24,speed*Math.exp(-dt*1.3))/speed;
  h.vx*=slow;h.vy*=slow;h.vz*=slow;h.x+=h.vx*dt;h.y+=h.vy*dt;h.z+=h.vz*dt;
  h.tuck=mix(h.tuck,0,ease(3));h.dread=mix(h.dread,0,ease(2));h.size=mix(h.size,2.3,ease(2));h.flap+=dt*8;
  if(h.t<=0){h.mode='circle';h.t=fierce?4:6;}
 }
 const yaw=Math.atan2(h.vx,h.vz),turn=wrap(yaw-h.yaw+Math.PI,tau)-Math.PI;
 h.bank=mix(h.bank,clamp(turn/dt*.5,-1,1),ease(4));h.yaw=yaw;
 h.beat-=dt;if(h.dread>.3&&h.beat<=0){heartbeat(h.dread);h.beat=mix(1,.36,h.dread);}
}

// ---- Five stars: tanks roll in along the streets and fire shells that burst into wide nets.
let tanks=[],tankWait=0;
function tankContact(t,x,y,z,r=0){
 if(y>2.7+r)return false;
 const dx=x-t.x,dz=z-t.z,s=Math.sin(t.yaw),c=Math.cos(t.yaw);
 return Math.abs(dx*c-dz*s)<1.9+r&&Math.abs(dx*s+dz*c)<3.5+r;
}
function updateTanks(dt){
 if(wanted<5){tanks=[];return;}
 tankWait-=dt;
 if(tankWait<=0&&tanks.filter(t=>t.hp>0).length<2){
  // Arrive at a crossing a couple of blocks ahead of the bird, so flying straight on does not shake them off.
  const tx=Math.round((bird.x+Math.sin(bird.angle)*105)/tile)*tile,tz=Math.round((bird.z+Math.cos(bird.angle)*105)/tile)*tile,sx=Math.sign(tx-bird.x)||1;
  tanks.push({x:tx,z:tz,ax:0,dir:-sx,yaw:-sx*Math.PI/2,turret:0,hp:14,cool:3,aim:0,dead:0,splats:[],id:Math.random()});
  if(tankWait>-90)banner('STRIDSVAGNAR','Sväng när de siktar','alert',3.2);
  tankWait=9;
 }
 for(const t of tanks){
  if(t.hp<=0){t.dead+=dt;continue;}
  // Drive along the street; at each crossing turn towards the bird if that is the shorter way.
  const along=t.ax?'z':'x',cross=t.ax?'x':'z',before=t[along],node=Math.round(before/tile)*tile;
  t[along]+=t.dir*9*dt;
  if((before-node)*(t[along]-node)<=0){
   const ahead=bird[along]-node,side=bird[cross]-t[cross];
   if(Math.abs(side)>Math.abs(ahead)||ahead*t.dir<-8){t[along]=node;t.ax=1-t.ax;t.dir=Math.sign(side)||1;}
  }
  const heading=t.ax?(t.dir>0?0:Math.PI):t.dir*Math.PI/2;
  t.yaw+=clamp(wrap(heading-t.yaw+Math.PI,tau)-Math.PI,-dt*1.6,dt*1.6);
  for(const c of cars)if(!c.parked&&!wrecks.has(c.id)&&tankContact(t,c.x,1,c.z,1))crashCar(c); // nothing stops a tank
  const dx=bird.x-t.x,dz=bird.z-t.z,far=Math.hypot(dx,dz);
  t.turret+=clamp(wrap(Math.atan2(dx,dz)-t.turret+Math.PI,tau)-Math.PI,-dt*2.2,dt*2.2);
  t.cool-=dt;
  if(t.aim>0){
   t.aim-=dt;
   if(t.aim<=0){ // fire at where the bird will be; the shell cannot turn
    const speed=62,T=Math.hypot(far,bird.y-2.8)/speed,v=forwardSpeed();
    const tx=bird.x+Math.sin(bird.angle)*v*T-t.x,ty=bird.y+bird.vy*T*.5-2.8,tz=bird.z+Math.cos(bird.angle)*v*T-t.z,l=Math.hypot(tx,ty,tz)||1;
    thrown.push({kind:'shell',x:t.x+tx/l*3.5,y:2.8+ty/l*3.5,z:t.z+tz/l*3.5,vx:tx/l*speed,vy:ty/l*speed,vz:tz/l*speed,age:0,windup:0,fuse:Math.max(.15,T-.13),spin:0});
    cannon(far);
    if(far<60)shake=Math.max(shake,.35);
   }
  }else if(t.cool<=0&&far<140&&bird.y>4){t.aim=1.2;t.cool=5.5;}
 }
 tanks=tanks.filter(t=>(t.hp>0||t.dead<25)&&Math.hypot(t.x-bird.x,t.z-bird.z)<210);
}
