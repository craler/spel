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
 const id=i+','+j+','+k,phase=hash(i,j,k)*tau,perimeter=4*sidewalkLength,blds=block(i,j).type?[]:buildings(i,j);
 const home=k*perimeter/8+phase,walk=k%2?1.15:-.95;
 const when=fallen.get(id)??elapsed;
 let route=home+walk*when,y=0,[x,z]=pavement(i,j,route),climbing=false,running=false;
 const side=Math.floor(wrap(route,perimeter)/sidewalkLength);
 let yaw=[Math.PI/2,0,-Math.PI/2,Math.PI][side]+(walk<0?Math.PI:0);
 if(wanted){
  let r=runners.get(id);
  if(!r){r={route,x,z,y:0,stage:0};runners.set(id,r);}
  if(!scored.has(id)){
   const climb=wanted>=2&&k<Math.min(3,wanted-1)&&blds.length>0,ox=r.x,oz=r.z;
   const step=dt*(2.75+.55*wanted);
   let tx=bird.x,tz=bird.z,roof;
   if(climb){roof=blds[k%blds.length];tx=roof[0]+roof[2]/2; // climb the wall that faces the street
    tz=roof[1]-j*tile<=(j+1)*tile-roof[1]-roof[3]?roof[1]-.24:roof[1]+roof[3]+.24;}
   if(r.stage===0){
    const arrived=walkToward(r,closestPavement(i,j,tx,tz),step);
    [r.x,r.z]=pavement(i,j,r.route);
    if(climb&&arrived)r.stage=1;
   }else if(r.stage===1){
    const dx=tx-r.x,dz=tz-r.z,dist=Math.hypot(dx,dz),f=Math.min(1,step/Math.max(.001,dist));
    r.x+=dx*f;r.z+=dz*f;if(dist<=step)r.stage=2;
   }else if(r.stage===2){
    r.y=Math.min(roof[4],r.y+dt*(2.9+wanted*.35));if(r.y>=roof[4])r.stage=3;
   }else{
    r.x+=clamp(clamp(bird.x,roof[0]+.8,roof[0]+roof[2]-.8)-r.x,-step,step);
    r.z+=clamp(clamp(bird.z,roof[1]+.8,roof[1]+roof[3]-.8)-r.z,-step,step);
   }
   if(Math.hypot(r.x-ox,r.z-oz)>1e-4){r.yaw=Math.atan2(r.x-ox,r.z-oz);r.moving=elapsed;}
   if(r.stage===2&&roof)r.yaw=Math.atan2(tx-r.x,(roof[1]+roof[3]/2)-r.z);
  }
  x=r.x;z=r.z;y=r.y;route=r.route;climbing=r.stage===2;yaw=r.yaw??yaw;running=elapsed-(r.moving??-9)<.2;
 }
 return {x,y,z,id,i,j,route,walk,climbing,yaw,running,c:colors[Math.floor(hash(i,j,k+8)*colors.length)],phase,
  umb:wanted>=3&&hash(i,j,k+20)<.3&&!brokeUmb.has(id)};
}

const brokeUmb=new Set(), eaten=new Map();
let hawk=null;
function gather(dt=0){
 people=[];const ix=Math.floor(bird.x/tile),iz=Math.floor(bird.z/tile);
 for(let i=ix-2;i<=ix+2;i++)for(let j=iz-2;j<=iz+2;j++){
  for(let k=0;k<8;k++)people.push(pedestrian(i,j,k,dt));
  // People who stay put: café guests, picnickers, the wedding party.
  for(const [n,f] of block(i,j).folk.entries())people.push({x:f.x,y:0,z:f.z,id:'f'+i+','+j+','+n,i,j,route:0,walk:0,climbing:false,
   yaw:hash(i,j,n+300)*tau,running:false,c:f.c,phase:n,fixed:true,base:f.base,label:f.label,bride:f.bride,umb:false});
 }
 if(runners.size>520){for(const [id,r] of runners)if(Math.hypot(r.x-bird.x,r.z-bird.z)>145)runners.delete(id);}
}
function traffic(){
 cars=[];
 // Each car owns a persistent lane and identity as the visible blocks scroll.
 for(const across of [false,true]){
  const sidePos=across?bird.z:bird.x,alongPos=across?bird.x:bird.z;
  for(let lane=Math.round(sidePos/tile)-2;lane<=Math.round(sidePos/tile)+2;lane++){
   const direction=lane%2===0?1:-1,speed=direction*(4+hash(lane,8,+across)*2.4);
   const offset=hash(lane,21,+across)*54+speed*trafficClock,spacing=53;
   const first=Math.floor((alongPos-100-offset)/spacing);
   for(let n=first;n<=first+4;n++){
    const id='car:'+across+','+lane+','+n;if(wrecks.has(id))continue;
    const along=n*spacing+offset,side=lane*tile+direction*1.45;
    cars.push({id,across,lane,along,direction,x:across?along:side,z:across?side:along,yaw:(across?Math.PI/2:0)+(direction<0?Math.PI:0),
     speed:Math.abs(speed)*trafficFactor,cab:hash(lane,n,7+across)<.16,color:carPaint[Math.floor(hash(lane,n,+across)*carPaint.length)]});
   }
  }
 }
 // Pile-ups: a car that reaches a wreck in its own lane joins it. Wrecks are towed after a while.
 for(const w of [...wrecks.values()]){
  if(elapsed-w.pileTime>24){wrecks.delete(w.id);continue;}
  for(const c of cars){
   if(c.lane!==w.lane||c.across!==w.across||wrecks.has(c.id))continue;
   const gap=((w.across?w.x:w.z)-c.along)*c.direction;
   if(gap>0&&gap<4.7)crashCar(c,w);
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
 wrecks.set(c.id,c);tone(310,63,.26,'sawtooth',.038);
 if(parent){carsHit++;award(15*c.chain,'KEDJEKROCK ×'+c.chain+'!');}
}
// The tank only trickles back by itself. Food on café tables, market stalls and picnic blankets fills it at once.
function recharge(dt,pressed){
 if(!pressed||emptyTank){
  refillWait-=dt;
  if(refillWait<=0){tank=Math.min(1,tank+dt*.085);if(tank>=.25)emptyTank=false;}
 }
}
function foodReady(f){return elapsed-(eaten.get(f.id)??-99)>25;}
function nearbyFood(){
 const ix=Math.floor(bird.x/tile),iz=Math.floor(bird.z/tile),list=[];
 for(let i=ix-2;i<=ix+2;i++)for(let j=iz-2;j<=iz+2;j++)for(const f of block(i,j).food)if(foodReady(f))list.push(f);
 return list;
}
function updateFood(){
 for(const f of nearbyFood()){
  if(Math.hypot(f.x-bird.x,f.z-bird.z)<2.3&&Math.abs(f.y-bird.y)<2.6){
   eaten.set(f.id,elapsed);tank=1;emptyTank=false;points+=5;foodEaten++;
   announce('MUMS! Full tank +5');tone(520,880,.12);tone(880,1320,.12,'sine',.05,.1);
  }
 }
}
// One hit from fruit or the hawk costs a feather; only the last one brings the bird down.
function hurt(text,surface){
 if(shield>0||state!=='play')return;
 if(--feathers>0){
  shield=1.5;bird.vy-=7;bird.speed=Math.max(10,bird.speed*.7);combo=0;comboTime=0;
  announce(text+' −1 fjäder');tone(260,90,.25,'sawtooth',.06);
  const fl=$('flash');fl.classList.remove('on');void fl.offsetWidth;fl.classList.add('on');return;
 }
 startCrash(surface);
}
// From four stars a hawk hunts anything that flies above the rooftops. Dive to street level to shake it off.
function updateHawk(dt){
 if(wanted<4){hawk=null;return;}
 if(!hawk){
  hawk={x:bird.x-Math.sin(bird.angle)*80,y:bird.y+30,z:bird.z-Math.cos(bird.angle)*80,angle:bird.angle,rest:4,flap:0};
  announce('HÖKEN KOMMER!');messageTime=1.8;tone(1500,800,.5,'sawtooth',.05);
 }
 const h=hawk;h.rest-=dt;h.hunting=h.rest<=0&&bird.y>15;h.flap+=dt*(h.hunting?10:5);
 let tx=bird.x,ty=bird.y+.3,tz=bird.z;
 if(!h.hunting){const a=elapsed*.45;tx+=Math.cos(a)*28;tz+=Math.sin(a)*28;ty=Math.max(50,bird.y+24);}
 if(Math.hypot(tx-h.x,tz-h.z)>150){h.x=tx-Math.sin(bird.angle)*110;h.z=tz-Math.cos(bird.angle)*110;}
 const turn=wrap(Math.atan2(tx-h.x,tz-h.z)-h.angle+Math.PI,tau)-Math.PI;
 h.bank=clamp(turn*2,-1,1);h.angle+=clamp(turn,-dt*1.2,dt*1.2);
 const speed=h.hunting?19+2.5*(wanted-4):17;
 h.x+=Math.sin(h.angle)*speed*dt;h.z+=Math.cos(h.angle)*speed*dt;h.y+=clamp(ty-h.y,-dt*15,dt*9);
 if(h.hunting&&Math.hypot(h.x-bird.x,h.y-bird.y,h.z-bird.z)<1.6&&shield<=0){
  h.rest=5;hurt('HÖKEN!',{n:[0,1,0],depth:0,cause:'Höken tog dig.'});
 }
}
