'use strict';
// Everything that lives in the city: pedestrians, traffic, the hawk, the helicopter and the tanks.
// Where a walk of `distance` round block i,j's pavement ends up. pavePoint() leaves the answer in paveX and paveZ:
// it is called for every pedestrian every frame, so it must not create anything.
let paveX=0,paveZ=0;
function pavePoint(i,j,distance){
 const L=sidewalkLength,t=wrap(distance,4*L),corner=Math.floor(t/L),u=t%L;
 const x=i*tile+sidewalkEdge,z=j*tile+sidewalkEdge;
 if(corner===0){paveX=x+u;paveZ=z;}
 else if(corner===1){paveX=x+L;paveZ=z+u;}
 else if(corner===2){paveX=x+L-u;paveZ=z+L;}
 else{paveX=x;paveZ=z+L-u;}
}
function pavement(i,j,distance){pavePoint(i,j,distance);return [paveX,paveZ];}
// How far round the pavement the point nearest to x,z lies: the nearest point on each of the four sides, the first one winning a tie.
function closestPavement(i,j,x,z){
 const L=sidewalkLength,a=x-i*tile-sidewalkEdge,b=z-j*tile-sidewalkEdge,cx=clamp(a,0,L),cz=clamp(b,0,L);
 const d0=(cx-a)**2+b*b,d1=(L-a)**2+(cz-b)**2,d2=(cx-a)**2+(L-b)**2,d3=a*a+(cz-b)**2,least=Math.min(d0,d1,d2,d3);
 return least===d0?cx:least===d1?L+cz:least===d2?3*L-cx:4*L-cz;
}
function walkToward(r,dest,step){
 const L=sidewalkLength*4,diff=wrap(dest-r.route+L/2,L)-L/2;
 r.route+=clamp(diff,-step,step);return Math.abs(diff)<=step;
}
// The people of a block are made once and kept: who they are (colour, pace, where on the pavement they started) never
// changes, so every frame only moves them. Making a couple of hundred new objects sixty times a second was pure waste.
const sideYaw=[Math.PI/2,0,-Math.PI/2,Math.PI];
function walkersOf(b){
 if(b.walkers)return b.walkers;
 const {i,j}=b,perimeter=4*sidewalkLength;b.walkers=[];
 for(let k=0;k<8;k++){
  const jog=jogger(i,j,k);
  if(!jog&&hash(i,j,k+77)<.2)continue; // a fifth of the pedestrians stay at home, which saves drawing them
  const phase=hash(i,j,k)*tau;
  const h={id:i+','+j+','+k,i,j,phase,home:k*perimeter/8+phase,walk:(k%2?1.15:-.95)*(jog?3.6:1),jog,umbRoll:hash(i,j,k+20),
   c:jog?'#d9f03a':colors[Math.floor(hash(i,j,k+8)*colors.length)],x:0,y:0,z:0,route:0,yaw:0,running:false,umb:false,chase:-1,run:null};
  // Joggers are worth more but get no star: they are everywhere, and the stars are for the rarer targets.
  if(jog){h.base=30;h.label='JOGGAREN';h.shout='MITT VARVREKORD!';h.star=false;}
  b.walkers.push(h);
 }
 return b.walkers;
}
let chaseSerial=0; // goes up with every new flight, which sends everyone back to their own walk
function moveWalker(h,dt){
 const perimeter=4*sidewalkLength,when=fallen.get(h.id)??elapsed;
 let route=h.home+h.walk*when;pavePoint(h.i,h.j,route);
 let x=paveX,z=paveZ,yaw=sideYaw[Math.floor(wrap(route,perimeter)/sidewalkLength)]+(h.walk<0?Math.PI:0),running=false;
 if(wanted){
  // Once the hunt is on, everyone runs after the bird along the pavement.
  let r=h.run;if(!r||h.chase!==chaseSerial){r=h.run={route,x,z,yaw:undefined,moving:-9};h.chase=chaseSerial;}
  if(!scored.has(h.id)){
   const step=dt*(2.75+.55*wanted),ox=r.x,oz=r.z;
   walkToward(r,closestPavement(h.i,h.j,bird.x,bird.z),step);
   pavePoint(h.i,h.j,r.route);r.x=paveX;r.z=paveZ;
   if(Math.hypot(r.x-ox,r.z-oz)>1e-4){r.yaw=Math.atan2(r.x-ox,r.z-oz);r.moving=elapsed;}
  }
  x=r.x;z=r.z;route=r.route;yaw=r.yaw??yaw;running=elapsed-r.moving<.2;
 }
 h.x=x;h.z=z;h.route=route;h.yaw=yaw;h.running=h.jog?!scored.has(h.id):running;
 h.umb=wanted>=3&&h.umbRoll<.3&&!brokeUmb.has(h.id);
}
// Those who stay put: café guests, picnickers, the wedding party. Also made once per block.
function folkOf(b){
 if(b.folkPeople)return b.folkPeople;
 const {i,j}=b;
 return b.folkPeople=b.folk.map((f,n)=>({x:f.x,y:0,z:f.z,id:'f'+i+','+j+','+n,i,j,route:0,walk:0,yaw:0,yaw0:hash(i,j,n+300)*tau,
  running:false,c:f.c,phase:n,fixed:true,base:f.base,label:f.label,shout:f.shout,bride:f.bride,umb:false}));
}
// The two rowers on a canal block.
function rowersOf(b){
 if(!b.rowers)b.rowers=[0,1].map(n=>({x:0,y:WATER+.3,z:0,id:'boat'+n+','+b.i+','+b.j,i:b.i,j:b.j,route:0,walk:0,yaw:0,running:false,
  c:n?'#3f7fa8':'#e8e4da',phase:b.i+b.j,fixed:true,base:45,label:'BÅTTUREN',shout:'MAN ÖVER BORD!',star:true,umb:false}));
 const at=boatsAt(b);for(const [n,h] of b.rowers.entries()){h.x=at[n].x;h.z=at[n].z;h.yaw=at[n].yaw;}
 return b.rowers;
}

const brokeUmb=new Set(), alarms=new Map();
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
 people.length=0;const ix=Math.floor(bird.x/tile),iz=Math.floor(bird.z/tile);
 for(let i=ix-2;i<=ix+2;i++)for(let j=iz-2;j<=iz+2;j++){
  const b=block(i,j);
  for(const h of walkersOf(b)){moveWalker(h,dt);people.push(h);}
  if(b.type===3)for(const h of rowersOf(b))people.push(h);
  if(!onEventSquare(i,j))for(const h of folkOf(b)){h.yaw=h.yaw0;people.push(h);}
 }
 eventPeople();
}
// How far each car has fallen behind its place in the stream because it had to stop.
const lag=new Map();let lastClock=0;
// A car's id, kind and colour never change, so they are worked out once and the same object is handed out every frame.
const carPool=new Map();
function carFor(across,lane,n){
 const key=((lane+50000)*200000+n+100000)*2+(across?1:0);let c=carPool.get(key);if(c)return c;
 const kind=hash(lane,n,11),direction=lane%2===0?1:-1;
 c={id:'car:'+across+','+lane+','+n,across,lane,direction,jitter:6*hash(lane,n,5+across)-3,x:0,z:0,along:0,speed:0,stopped:false,
  yaw:(across?Math.PI/2:0)+(direction<0?Math.PI:0),bus:kind<.09,cab:kind>=.09&&hash(lane,n,7+across)<.16,hatch:hash(lane,n,3)<.45,color:carPaint[Math.floor(hash(lane,n,+across)*carPaint.length)]};
 if(carPool.size>4000)carPool.clear(); // a very long flight: start over rather than grow for ever
 carPool.set(key,c);return c;
}
function parkedOf(b){
 return b.parkedCars||(b.parkedCars=b.parked.map((p,n)=>({id:'park:'+b.i+','+b.j+','+n,parked:true,x:p.x,z:p.z,yaw:p.yaw,speed:0,cab:false,hatch:n%2===0,color:p.c,spot:p})));
}
function traffic(){
 const moved=Math.max(0,trafficClock-lastClock)*5.2;lastClock=trafficClock;
 cars.length=0;
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
    const c=carFor(across,lane,n);if(wrecks.has(c.id))continue;
    const along=n*spacing+offset+c.jitter-direction*(lag.get(c.id)||0),side=lane*tile+direction*1.45;
    c.along=along;c.x=across?along:side;c.z=across?side:along;c.yaw=(across?Math.PI/2:0)+(direction<0?Math.PI:0);c.speed=Math.abs(speed)*trafficFactor;
    cars.push(c);
   }
  }
 }
 // Parked cars: they do not move, but they can be hit (the alarm goes off) and flown into.
 const px=Math.floor(bird.x/tile),pz=Math.floor(bird.z/tile);
 for(let i=px-2;i<=px+2;i++)for(let j=pz-2;j<=pz+2;j++)for(const c of parkedOf(block(i,j))){
  if(wrecks.has(c.id))continue;
  c.x=c.spot.x;c.z=c.spot.z;c.yaw=c.spot.yaw;cars.push(c); // back in its bay, in case it has been knocked about and towed
 }
 eventCars();
 // Drivers brake: a car stops behind a wreck or a stopped car, and gives way to cross traffic already in the junction.
 // Once the way is clear it drives a little faster until it is back in its place. Only a car that had no room to stop crashes.
 const moving=cars.filter(c=>!c.parked),blockers=[...moving,...wrecks.values()];
 // Only vehicles in the neighbouring 14 m squares can be in the way, so each car checks those instead of all of them.
 // (Any one vehicle in the way is enough to stop, so the order they are looked at in makes no difference.)
 const grid=new Map(),cellKey=(gx,gz)=>(gx+50000)*100000+gz+50000;
 for(const o of blockers){const key=cellKey(Math.floor(o.x/14),Math.floor(o.z/14));let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(o);}
 for(const c of moving){
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),held=lag.get(c.id)||0,gx=Math.floor(c.x/14),gz=Math.floor(c.z/14);let stop=false;
  for(let i=gx-1;i<=gx+1&&!stop;i++)for(let j=gz-1;j<=gz+1&&!stop;j++){
   const l=grid.get(cellKey(i,j));if(!l)continue;
   for(const o of l){
    if(o===c)continue;
    const dx=o.x-c.x,dz=o.z-c.z,ahead=dx*fx+dz*fz;
    if(ahead<=0||ahead>(o.bus||c.bus?13:8.5)||Math.abs(dx*fz-dz*fx)>2.1)continue;
    if(wrecks.has(o.id)||o.stopped||(o.across===c.across&&o.lane===c.lane)||(c.across&&!o.across)){stop=true;break;}
   }
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
 // The fresh puddles on the ground go into 2 m squares, so that each car and person only looks at the few beside it.
 const cells=new Map(),cellKey=(gx,gz)=>(gx+50000)*100000+gz+50000;let fresh=0;
 for(const s of stains){
  if(s.used||s.wall!==undefined||s.y>=.3||elapsed-s.t>=25)continue;
  const key=cellKey(Math.floor(s.x/2),Math.floor(s.z/2));let l=cells.get(key);if(!l)cells.set(key,l=[]);l.push(s);fresh++;
 }
 if(fresh<2)return;
 const near=(x,z,r)=>{
  const patch=[],r2=r*r;
  for(let i=Math.floor((x-r)/2);i<=Math.floor((x+r)/2);i++)for(let j=Math.floor((z-r)/2);j<=Math.floor((z+r)/2);j++){
   const l=cells.get(cellKey(i,j));if(l)for(const s of l)if(!s.used&&(s.x-x)**2+(s.z-z)**2<r2)patch.push(s);
  }
  return patch;
 };
 for(const c of cars){
  if(c.parked||wrecks.has(c.id))continue;
  const patch=near(c.x,c.z,1.8);if(patch.length<6)continue;
  for(const s of patch)s.used=true;
  crashCar(c);carsHit++;run.carSlips++;award(20,'BAJSHALKA',null,0,[c.x,2.5,c.z]);bubble(c.x,2.3,c.z,'JAG HALKAR!');
 }
 for(const h of people){
  if(h.fixed||h.event||h.y>.1||scored.has(h.id))continue;
  const patch=near(h.x,h.z,.9);if(patch.length<2)continue;
  for(const s of patch)s.used=true;
  scored.add(h.id);fallen.set(h.id,elapsed);hits++;feedLine('HALKADE',5);addPoints(5);
  popups.push({x:h.x,y:2.2,z:h.z,text:'+5',t:elapsed});bubble(h.x,2.1,h.z,'HOPPSAN!');yelp();
 }
}
// One hit from fruit or the hawk costs a feather; only the last one brings the bird down.
function hurt(text,surface){
 if(shield>0||state!=='play')return;
 if(run.cleanPts===undefined)run.cleanPts=points; // how far the flight got with every feather left (see countFlight)
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
 if(wanted<3){hawk=null;return;}
 const L=sky.dir,b=bird,fierce=wanted>=4;
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
  if(d<1.9&&shield<=0){hawkStrike();hurt('HÖKEN SLOG TILL',{n:[h.vx/speed,h.vy/speed,h.vz/speed],depth:0,cause:'Höken tog dig.'});leave();}
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
  tanks.push({x:tx,z:tz,ax:0,dir:-sx,yaw:-sx*Math.PI/2,turret:0,hp:14,cool:3,aim:0,dead:0,splats:[],id:Math.random(),speed:0,mode:'drive',plan:null,pitch:0,roll:0,recoil:0,fired:-9,muzzle:null,exhaust:0});
  if(tankWait>-90)banner('STRIDSVAGNAR','Sväng när de siktar','alert',3.2);
  tankWait=9;
 }
 for(const t of tanks){
  t.recoil*=Math.exp(-dt*3.5);
  if(t.hp<=0){t.dead+=dt;t.speed=Math.max(0,t.speed-6*dt);t.pitch=mix(t.pitch,0,1-Math.exp(-dt*3));continue;}
  // Forty tonnes do not turn on a coin: the tank brakes before a crossing where it means to turn,
  // stops, pivots on its tracks to the new street and then pulls away again. Straight on it keeps its speed.
  const top=9,accel=3.2,brake=5.5,before=t.speed;
  if(t.mode==='pivot'){
   const d=wrap(t.goalYaw-t.yaw+Math.PI,tau)-Math.PI,turn=clamp(d,-1.05*dt,1.05*dt)*clamp(Math.abs(d)/.25,.35,1);
   t.yaw+=turn;t.roll=mix(t.roll,-turn/dt*.03,1-Math.exp(-dt*6));
   if(Math.abs(d)<.015){t.yaw=t.goalYaw;t.mode='drive';t.roll=0;}
  }else{
   const along=t.ax?'z':'x',cross=t.ax?'x':'z',pos=t[along];
   const node=t.dir>0?(Math.floor((pos+.01)/tile)+1)*tile:(Math.ceil((pos-.01)/tile)-1)*tile,dist=(node-pos)*t.dir;
   if(!t.plan||t.plan.node!==node){ // decide what to do at the next crossing: turn towards the bird if that is the shorter way
    const ahead=bird[along]-node,side=bird[cross]-t[cross];
    t.plan=Math.abs(side)>Math.abs(ahead)+6||ahead*t.dir<-8?{node,turn:true,ax:1-t.ax,dir:Math.sign(side)||1}:{node,turn:false};
   }
   const target=t.plan.turn?Math.min(top,Math.max(.9,Math.sqrt(2*brake*Math.max(0,dist-.4)))):top;
   t.speed=t.speed<target?Math.min(target,t.speed+accel*dt):Math.max(target,t.speed-brake*dt);
   const step=t.speed*dt;
   if(t.plan.turn&&dist<=step+.02){
    t[along]=node;t.speed=0;t.ax=t.plan.ax;t.dir=t.plan.dir;t.plan=null;t.mode='pivot';
    t.goalYaw=t.ax?(t.dir>0?0:Math.PI):t.dir*Math.PI/2;
   }else t[along]+=t.dir*step;
   t.yaw+=clamp(wrap((t.ax?(t.dir>0?0:Math.PI):t.dir*Math.PI/2)-t.yaw+Math.PI,tau)-Math.PI,-dt*.8,dt*.8);
   t.roll=mix(t.roll,0,1-Math.exp(-dt*4));
  }
  // The hull squats back when it pulls away and dips forward when it brakes; firing rocks it back.
  const a=(t.speed-before)/Math.max(dt,1e-4);t.pitch=mix(t.pitch,clamp(-a*.009,-.05,.05),1-Math.exp(-dt*5));
  t.exhaust=a>.5||t.mode==='pivot'?Math.min(1,t.exhaust+dt*3):Math.max(0,t.exhaust-dt*1.2);
  for(const c of cars)if(!c.parked&&!wrecks.has(c.id)&&tankContact(t,c.x,1,c.z,1))crashCar(c); // nothing stops a tank
  const dx=bird.x-t.x,dz=bird.z-t.z,far=Math.hypot(dx,dz);
  t.turret+=clamp(wrap(Math.atan2(dx,dz)-t.turret+Math.PI,tau)-Math.PI,-dt*2.2,dt*2.2);
  t.cool-=dt;
  if(t.aim>0){
   t.aim-=dt;
   if(t.aim<=0){ // fire at where the bird will be; the shell cannot turn
    // Lead the bird along the curve it is actually flying, including its turn and its climb or sink.
    const speed=78,v=forwardSpeed();let T=Math.hypot(far,bird.y-2.8)/speed,px=0,pz=0;
    for(let k=0;k<3;k++){const a=bird.angle+(bird.turn||0)*T*.85;px=bird.x+(Math.abs(bird.turn||0)>.05?(Math.cos(bird.angle)-Math.cos(a))/(bird.turn)*v*.85+Math.sin(bird.angle)*v*T*.15:Math.sin(bird.angle)*v*T);
     pz=bird.z+(Math.abs(bird.turn||0)>.05?(Math.sin(a)-Math.sin(bird.angle))/(bird.turn)*v*.85+Math.cos(bird.angle)*v*T*.15:Math.cos(bird.angle)*v*T);T=Math.hypot(px-t.x,bird.y-2.8,pz-t.z)/speed;}
    const tx=px-t.x,ty=bird.y+bird.vy*T*.8-2.8,tz=pz-t.z,l=Math.hypot(tx,ty,tz)||1;
    thrown.push({kind:'shell',x:t.x+tx/l*3.5,y:2.8+ty/l*3.5,z:t.z+tz/l*3.5,vx:tx/l*speed,vy:ty/l*speed,vz:tz/l*speed,age:0,windup:0,fuse:Math.max(.15,T-.13),spin:0});
    cannon(far);t.recoil=1;t.fired=elapsed;t.muzzle=[t.x+tx/l*4.4,2.8+ty/l*4.4,t.z+tz/l*4.4];
    if(far<60)shake=Math.max(shake,.35);
   }
  }else if(t.cool<=0&&far<150&&bird.y>4){t.aim=.85;t.cool=4.2;}
 }
 tanks=tanks.filter(t=>(t.hp>0||t.dead<25)&&Math.hypot(t.x-bird.x,t.z-bird.z)<210);
}

// ---- Four stars: a police helicopter. It follows the bird above the rooftops and sweeps a searchlight after it.
// The beam turns slowly, so hard turns shake it off, and a building between the bird and the helicopter hides it.
// Held in the light long enough, the bird gets a net fired at it from the open side door.
let heli=null,heliEnabled=false; // switched off for now: set heliEnabled to true to bring it back at four stars
function heliSees(h){
 const dx=bird.x-h.x,dy=bird.y-h.y,dz=bird.z-h.z;
 for(let k=1;k<12;k++){const f=k/12;if(solid(h.x+dx*f,h.y+dy*f,h.z+dz*f))return false;}
 return true;
}
function updateHeli(dt){
 if(wanted<4||!heliEnabled){heli=null;return;}
 const b=bird;
 if(!heli){
  heli={x:b.x-Math.sin(b.angle)*160,y:62,z:b.z-Math.cos(b.angle)*160,vx:0,vy:0,vz:0,yaw:b.angle,tilt:0,roll:0,rotor:0,
   beam:[0,-1,0],lock:0,cool:3,lit:false,seen:false};
  banner('POLISHELIKOPTERN','Göm dig från strålkastaren','alert',3.2);
 }
 const h=heli,v=forwardSpeed();
 // Hang behind and above the bird, never below the rooftops.
 const tx=b.x-Math.sin(b.angle)*20,tz=b.z-Math.cos(b.angle)*20,ty=Math.max(b.y+17,50);
 const ax=clamp((tx-h.x)*.9-h.vx*1.5,-13,13),ay=clamp((ty-h.y)*1.2-h.vy*2,-8,8),az=clamp((tz-h.z)*.9-h.vz*1.5,-13,13);
 h.vx+=ax*dt;h.vy+=ay*dt;h.vz+=az*dt;const sp=Math.hypot(h.vx,h.vz),max=30;if(sp>max){h.vx*=max/sp;h.vz*=max/sp;}
 h.x+=h.vx*dt;h.y+=h.vy*dt;h.z+=h.vz*dt;h.rotor+=dt*38;
 // The nose points where it is going when it is fast, and at the bird when it hovers. It leans into its acceleration.
 const want=sp>6?Math.atan2(h.vx,h.vz):Math.atan2(b.x-h.x,b.z-h.z),turn=wrap(want-h.yaw+Math.PI,tau)-Math.PI;
 h.yaw+=clamp(turn,-dt*1.2,dt*1.2);
 const fwd=ax*Math.sin(h.yaw)+az*Math.cos(h.yaw),side=ax*Math.cos(h.yaw)-az*Math.sin(h.yaw);
 h.tilt=mix(h.tilt,clamp(fwd*.025,-.3,.3),1-Math.exp(-dt*3));h.roll=mix(h.roll,clamp(side*.025,-.3,.3),1-Math.exp(-dt*3));
 // The searchlight swings towards the bird at a limited rate.
 const dx=b.x-h.x,dy=b.y-h.y,dz=b.z-h.z,d=Math.hypot(dx,dy,dz)||1,goal=[dx/d,dy/d,dz/d];
 const cos=clamp(h.beam[0]*goal[0]+h.beam[1]*goal[1]+h.beam[2]*goal[2],-1,1),ang=Math.acos(cos),f=Math.min(1,.9*dt/Math.max(1e-4,ang));
 h.beam=h.beam.map((q,i)=>mix(q,goal[i],f));const bl=Math.hypot(...h.beam)||1;h.beam=h.beam.map(q=>q/bl);
 h.seen=heliSees(h);h.lit=h.seen&&ang<.16&&d<140;
 h.lock=clamp(h.lock+(h.lit?dt/1.8:-dt/1.2),0,1);h.cool-=dt;
 if(h.lock>=1&&h.cool<=0&&state==='play'){ // fire a net at where the bird will be
  const speed=48,T=d/speed,px=b.x+Math.sin(b.angle)*v*T-h.x,py=b.y+b.vy*T*.5-h.y,pz=b.z+Math.cos(b.angle)*v*T-h.z,l=Math.hypot(px,py,pz)||1;
  thrown.push({kind:'shell',x:h.x,y:h.y-1.2,z:h.z,vx:px/l*speed,vy:py/l*speed,vz:pz/l*speed,age:0,windup:0,fuse:Math.max(.15,T-.15),spin:0});
  burst({type:'bandpass',from:1800,to:300,q:1.4,gain:.35,dur:.25});h.lock=.35;h.cool=4;
 }
 if(state==='play'&&Math.hypot(b.x-h.x,b.y-h.y+.6,b.z-h.z)<3.4)startCrash({n:[0,1,0],depth:0,cause:'Helikoptern vann.'});
}
