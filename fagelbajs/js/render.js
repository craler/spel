'use strict';
// Camera, bird mesh, scene assembly for the WebGL renderer and the 2D overlay (sight, warnings, HUD).
function setCamera(dt){
 // A roof entering the reticle must not move the camera. Frame a virtual
 // unobstructed trajectory, easing both look angle and overhead distance.
 const p=payload(),aim=at(p,Math.max(0,flightTime(p,0)));
 const blend=1-Math.exp(-dt*7);
 const a=rig?mix(rig.yaw,bird.angle,1-Math.exp(-dt*11)):bird.angle;
 const s=Math.sin(a),c=Math.cos(a);
 const forward=(aim[0]-bird.x)*s+(aim[2]-bird.z)*c;
 const fall=bird.y-aim[1];
 // Fit the pigeon and the projected impact together, also from high altitude.
 const back=above?0:6.8;
 const rise=above?Math.max(14,1.3*forward-fall*.5):3.8;
 const toBird=Math.atan2(rise,back);
 const toAim=Math.atan2(rise+fall,Math.max(.35,back+forward));
 const desiredPitch=above?Math.PI/2:mix(toBird,toAim,.52);
 const shoulder=above?0:1.05;
 const focusAhead=above?forward*rise/(2*rise+fall):0;
 if(!rig)rig={yaw:a,pitch:desiredPitch,rise,ahead:focusAhead};
 rig.yaw=a;rig.pitch=mix(rig.pitch,desiredPitch,blend);rig.rise=mix(rig.rise,rise,blend);rig.ahead=mix(rig.ahead,focusAhead,blend);
 camera={x:bird.x+s*(rig.ahead-back)+c*shoulder,y:bird.y+rig.rise,z:bird.z+c*(rig.ahead-back)-s*shoulder,s,c,cp:Math.cos(rig.pitch),sp:Math.sin(rig.pitch)};
 const rush=bird.fold*clamp((Math.hypot(forwardSpeed(),bird.vy)-9)/40,.2,1);
 const shake=.013*rush*Math.sin(elapsed*33)+.006*rush*Math.sin(elapsed*48);
 camera.x+=c*shake;camera.z-=s*shake;camera.y+=.009*rush*Math.sin(elapsed*39);
 scale=Math.min(width*.88,height*(above?.85:.97))*(1-.085*bird.fold-.064*rush);
}
function cameraPoint([x,y,z]){
 const c=camera,dx=x-c.x,dy=y-c.y,dz=z-c.z,f=dx*c.s+dz*c.c;
 return [dx*c.c-dz*c.s,dy*c.cp+f*c.sp,f*c.cp-dy*c.sp];
}
function screen(p){return [width/2+p[0]*scale/p[2],height*.43-p[1]*scale/p[2]];}
function point(p){const v=cameraPoint(p);return v[2]>.6?screen(v):null;}
// Connected cross-sections from rump to forehead. Units are local bird metres.
const pigeonSections=[
 [-.49,.018,.045,.046],[-.38,.024,.133,.092],[-.21,.046,.175,.144],
 [0,.073,.187,.174],[.14,.115,.162,.172],[.208,.197,.127,.142],
 [.25,.27,.126,.126],[.335,.292,.129,.12],[.412,.285,.084,.083],[.444,.278,.032,.043]
];
function bodyMesh(){
 const rings=pigeonSections.map(([z,y,w,h])=>Array.from({length:12},(_,i)=>{
  const a=i*tau/12;return [w*Math.cos(a),y+h*Math.sin(a),z];
 }));
 const faces=[];
 for(let n=1;n<rings.length;n++)for(let i=0;i<12;i++){
  const j=(i+1)%12,light=Math.sin((i+.5)*tau/12)*.7-Math.cos((i+.5)*tau/12)*.3;
  const neck=n===5||n===6;
  const hue=neck?(light>.25?169:266):n>=7?232:222;
  const l=(neck?45:n>=7?47:63)+light*(neck?20:16);
  faces.push({pts:[rings[n-1][i],rings[n-1][j],rings[n][j],rings[n][i]],color:'hsl('+hue+' '+(neck?43:20)+'% '+l+'%)'});
 }
 return faces;
}
const plumage=bodyMesh();
function flightPitch(){
 // At low airspeed the beak can still point up even as lift fades.
 const pathAngle=Math.atan2(bird.vy,forwardSpeed());
 if(pathAngle<0)return pathAngle;
 return Math.max(pathAngle*.82,
  bird.climb>.01?1.33*bird.climb:-Math.PI/2);
}
function renderBird(){
 const b=bird,fl=b.fold*(crash?Math.exp(-crash.age*2):1),bank=b.bank*.62+(crash?.roll??0),pitch=flightPitch()+(crash?.pitch??0);
 const sy=Math.sin(b.angle),cy=Math.cos(b.angle),sb=Math.sin(bank),cb=Math.cos(bank),sp=Math.sin(pitch),cp=Math.cos(pitch);
 function world([x,y,z]){
  const bx=x*cb+y*sb,by=y*cb-x*sb,bz=z*cp-by*sp;
  const offset=[bx*cy+bz*sy,by*cp+z*sp,-bx*sy+bz*cy];
  return [b.x+offset[0],b.y+offset[1],b.z+offset[2]];
 }
 const face=(pts,color)=>poly(pts.map(world),color,1);
 for(const patch of plumage)face(patch.pts,patch.color);
 // Wedge bill, pale cere, and lateral amber eyes.
 for(const side of [-1,1]){
  face([[0,.316,.411],[side*.052,.264,.406],[0,.245,.565]],'#58445a');
  face([[0,.316,.411],[side*.044,.279,.444],[0,.271,.49]],'#eee2d6');
  const eye=(radius,color,offset)=>{
   const pts=Array.from({length:8},(_,i)=>[side*(.123+offset),.308+radius*Math.sin(i*tau/8),.348+radius*Math.cos(i*tau/8)]);
   face(pts,color);
  };eye(.024,'#ffbf56',0);eye(.012,'#362c49',.0015);
 }
 // Separate overlapping tail feathers with a dark terminal band and pale tips.
 const spread=.17+.07*Math.abs(b.bank)+.06*b.effort-.09*fl;
 for(let k=-3;k<=3;k++){
  const t=k/3,root=[t*.055,.051,-.33],tx=t*spread,tz=-.73+.09*t*t;
  const end=[tx,.037-.029*t*t,tz],w=.042;
  const mid=[mix(root[0],tx,.66),.049-.024*t*t,mix(root[2],tz,.66)];
  face([root,[mid[0]-w,mid[1],mid[2]],[tx-w*.62,end[1],tz],end,[tx+w*.62,end[1],tz],[mid[0]+w,mid[1],mid[2]]],'#687695');
  face([[mid[0]-w,mid[1]+.002,mid[2]],[mid[0]+w,mid[1]+.002,mid[2]],[tx+w*.65,end[1]+.002,tz+.02],[tx-w*.65,end[1]+.002,tz+.02]],'#424a67');
 }
 // The hand lags the arm on the downstroke. Sweeping both joints aft folds the wing.
 const amplitude=.15+.93*b.effort;
 const beat=Math.sin(wingPhase),arm=(.24+amplitude*beat)*(1-fl);
 const wrist=(-.16+amplitude*.92*Math.sin(wingPhase-.65))*(1-fl);
 for(const side of [-1,1]){
  const joint=crash?.wings[side<0?0:1];
  const elbowAngle=joint?.arm??arm,tipAngle=joint?.wrist??wrist;
  function wing(u,chord,y=0){
   const upper=Math.min(.43,u),outer=Math.max(0,u-.43);
   const flexible=joint?Math.max(0,outer-.22):0;
   const reach=upper*Math.cos(elbowAngle)+(outer-flexible)*Math.cos(tipAngle)+flexible*Math.cos(joint?.tip??tipAngle);
   return [side*(.089+reach*(1-.82*fl)),
    .101+upper*Math.sin(elbowAngle)+(outer-flexible)*Math.sin(tipAngle)+flexible*Math.sin(joint?.tip??tipAngle)+y,
    .095+chord+.14*Math.sin(u*Math.PI)-.27*u*u-.59*u*fl];
  }
  const patch=(pts,color)=>face(pts.map(v=>wing(...v)),color);
  // Rounded secondary feathers broaden the trailing edge near the body.
  for(let i=0;i<6;i++){
   const u=.047+i*.074;
   patch([[u-.034,.065],[u+.064,.063],[u+.093,-.204],[u+.053,-.31],[u+.016,-.323],[u-.02,-.278]],i===3||i===5?'#485675':i%2?'#899abd':'#afbad1');
  }
  // Staggered primaries end in distinct pointed tips.
  for(let i=0;i<6;i++){
   const u=.35+i*.067,tip=.59+i*.091,sweep=-.275+i*.038;
   patch([[u,.06],[u+.11,.044],[tip+.012,sweep+.043],[tip,sweep],[tip-.047,sweep-.016],[u-.035,-.105]],i%2?'#455072':'#596a8f');
  }
  patch([[0,.12],[.22,.143],[.44,.098],[.72,.031],[.85,-.019],[.60,-.106],[.32,-.159],[.08,-.165],[0,-.134]],'#aebdd9');
  patch([[.04,.116,.009],[.22,.129,.009],[.42,.086,.009],[.29,.039,.009],[.08,.048,.009]],'#c8d5e6');
  for(const u of [.32,.46])patch([[u+.018,.056,.012],[u+.065,.044,.012],[u-.009,-.177,.012],[u-.069,-.20,.012]],'#485779');
 }
 paint();
}
function crashFeathers(){
 const t=crash.age*.42;
 for(let i=0;i<12;i++){
  const a=tau*i/12,reach=t*(1.1+hash(i,1,1)*3);
  const [x,y,z]=crash.origin;const pos=point([x+reach*Math.cos(a),y+.2+Math.sin(Math.min(1,t)*Math.PI)*(.7+hash(i,2,2)),z+reach*Math.sin(a)]);
  if(!pos)continue;
  ctx.save();ctx.translate(...pos);ctx.rotate(a+t*(i%2?4:-5));ctx.fillStyle=i%3?'#f7edf5':'#7382a2';
  ctx.beginPath();ctx.ellipse(0,0,3,7,0,0,tau);ctx.fill();ctx.restore();
 }
}
function drawSight([x,y],target){
 ctx.save();ctx.translate(x,y);
 const r=target?12:15;
 ctx.beginPath();
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2;
  ctx.moveTo(Math.cos(a)*(r-4),Math.sin(a)*(r-4));
  ctx.lineTo(Math.cos(a)*(r+6),Math.sin(a)*(r+6));
  ctx.moveTo(r*Math.cos(a+.28),r*Math.sin(a+.28));ctx.arc(0,0,r,a+.28,a+1.29);
 }
 ctx.lineCap='round';
 ctx.lineWidth=5;ctx.strokeStyle='#362144';ctx.stroke();
 ctx.lineWidth=2.5;ctx.strokeStyle=target?'#6dff85':'#ffed70';ctx.stroke();
 ctx.fillStyle='#38283d';ctx.fillRect(-2.5,-2.5,5,5);ctx.fillStyle='#fff';ctx.fillRect(-1,-1,2,2);
 if(target){ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#293c36';ctx.fillRect(-36,-38,72,16);ctx.fillStyle='#99ffac';ctx.fillText('TRÄFFLÄGE',0,-26);}
 ctx.restore();
}
function impactView(aim){
 const last=stains.at(-1),focus=last&&elapsed-last.t<1?[last.x,last.y,last.z]:aim;
 const size=Math.min(154,width*.21,height*.26),x=width-size-18,y=height-size-72,k=size/28;
 ctx.save();ctx.translate(x,y);ctx.fillStyle='#4c315c';ctx.fillRect(-3,-22,size+6,size+25);
 ctx.fillStyle='#fff5c7';ctx.font='bold 12px system-ui';ctx.fillText('NEDSLAG',7,-6);
 ctx.beginPath();ctx.rect(0,0,size,size);ctx.clip();ctx.fillStyle='#a974aa';ctx.fillRect(0,0,size,size);
 const px=n=>size/2+(n-focus[0])*k,pz=n=>size/2-(n-focus[2])*k;
 const dot=(x,z,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(px(x),pz(z),r,0,tau);ctx.fill();};
 const i=Math.floor(focus[0]/tile),j=Math.floor(focus[2]/tile);
 for(let u=i-1;u<=i+1;u++)for(let v=j-1;v<=j+1;v++)for(const [a,b,w,d] of buildings(u,v)){
 ctx.fillStyle='#efbc69';ctx.fillRect(px(a),pz(b+d),w*k,d*k);}
 for(const h of people)if(Math.abs(h.x-focus[0])<15 && Math.abs(h.z-focus[2])<15)dot(h.x,h.z,k*.7,scored.has(h.id)?'#fff':'#432942');
 for(const h of stains)if(Math.abs(h.x-focus[0])<15 && Math.abs(h.z-focus[2])<15){dot(h.x,h.z,k*.86,'#fff');if(elapsed-h.t<.28){ctx.strokeStyle='#ffd844';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px(h.x),pz(h.z),(1+8*(elapsed-h.t))*k,0,tau);ctx.stroke();}}
 ctx.strokeStyle='#ffdf38';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px(aim[0]),pz(aim[2]),6,0,tau);ctx.stroke();ctx.restore();
}
function hud(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value;}
// ---- 3D scene -------------------------------------------------------------
const overlay=$('overlay2d'), ctx=overlay.getContext('2d');
// The bird code above describes its feathers as polygons; they go straight into the per-frame triangle batch.
function poly(points,color){dyn.fan(points,rgb(color));}
function paint(){}
const M={
 cube:new Mesh().box(0,0,0,1,1,1,WHITE,1).build(),
 ball:new Mesh().ball(0,0,0,1,1,1,WHITE,1,0,0,10,6).build(),
 disc:(()=>{const m=new Mesh();for(let i=0;i<14;i++){const a=i*tau/14,b=(i+1)*tau/14;m.tri([0,0,0],[Math.cos(b),0,Math.sin(b)],[Math.cos(a),0,Math.sin(a)],WHITE,1);}return m.build();})(),
 person:(()=>{const m=new Mesh(),pants=rgb('#2b323d'),skin=rgb('#dba27e'),hair=rgb('#33271f');
  m.tube(-.1,0,.86,0,.075,.095,pants,0,1,.86,6);m.tube(.1,0,.86,0,.075,.095,pants,0,2,.86,6);
  m.ball(0,1.2,0,.21,.38,.15,WHITE,1,0,0,8,5);
  m.tube(-.27,.92,1.45,0,.05,.065,WHITE,1,3,1.45,6);m.tube(.27,.92,1.45,0,.05,.065,WHITE,1,4,1.45,6);
  m.ball(0,1.68,0,.125,.14,.13,skin,0,0,0,8,5);m.ball(0,1.73,-.025,.132,.115,.135,hair,0,0,0,8,4);return m.build();})(),
 umbrella:new Mesh().tube(0,2.02,2.42,0,.85,.03,WHITE,1,0,0,10,false).tube(.2,1.15,2.4,.1,.014,.014,rgb('#22252a'),0,0,0,5).build(),
 car:(()=>{const m=new Mesh(),tyre=rgb('#131417'),glass=rgb('#141c26'),dark=rgb('#1c1d21');
  m.box(-.92,.3,-2.05,.92,.93,2.05,WHITE,1,0,0,.95);m.box(-.82,.93,-1.2,.82,1.42,.95,glass,0,0,0,.8);m.box(-.68,1.42,-1.0,.68,1.48,.8,WHITE,1);
  for(const sx of [-1,1])for(const z of [-1.28,1.23])m.box(sx*.97-.13,0,z-.34,sx*.97+.13,.68,z+.34,tyre);
  m.box(-.9,.34,2.0,.9,.52,2.1,dark);m.box(-.9,.34,-2.1,.9,.52,-2.0,dark);
  for(const sx of [-1,1]){m.box(sx*.62-.17,.6,2.02,sx*.62+.17,.78,2.07,rgb('#fff2c4'));m.box(sx*.62-.17,.62,-2.07,sx*.62+.17,.78,-2.02,rgb('#b3201c'));}
  return m.build();})(),
 cab:(()=>{const m=new Mesh(),tyre=rgb('#131417'),glass=rgb('#141c26'),dark=rgb('#1c1d21'),skin=rgb('#dba27e');
  m.box(-.92,.3,-2.05,.92,.95,2.05,WHITE,1,0,0,.95);m.box(-.74,.72,-1.25,.74,.97,.45,rgb('#5a3a28'));
  m.box(-.78,.95,.5,.78,1.34,.58,glass);
  for(const sx of [-1,1]){m.ball(sx*.36,1.27,-.15,.14,.15,.14,skin,0,0,0,8,5);m.ball(sx*.36,1.02,-.2,.2,.24,.15,sx<0?rgb('#c8443a'):rgb('#e8e4da'),0,0,0,8,4);}
  for(const sx of [-1,1])for(const z of [-1.28,1.23])m.box(sx*.97-.13,0,z-.34,sx*.97+.13,.68,z+.34,tyre);
  m.box(-.9,.34,2.0,.9,.52,2.1,dark);m.box(-.9,.34,-2.1,.9,.52,-2.0,dark);
  for(const sx of [-1,1]){m.box(sx*.62-.17,.6,2.02,sx*.62+.17,.78,2.07,rgb('#fff2c4'));m.box(sx*.62-.17,.62,-2.07,sx*.62+.17,.78,-2.02,rgb('#b3201c'));}
  return m.build();})(),
 tree:new Mesh().tube(0,0,2.6,0,.24,.15,rgb('#463222'),0,0,0,6).ball(0,4.3,0,2.3,2.1,2.3,WHITE,1,0,0,9,6).ball(1.25,3.3,.55,1.5,1.3,1.5,[.85,.9,.85],1,0,0,8,5).ball(-1,3.5,-.8,1.65,1.45,1.6,[.92,1.08,.9],1,0,0,8,5).build(),
 lamp:new Mesh().tube(0,0,5.4,0,.08,.05,rgb('#24272b'),0,0,0,6).box(-.05,5.3,-.05,.05,5.4,.9,rgb('#24272b')).ball(0,5.28,.85,.2,.1,.26,rgb('#fff1c0'),0,0,0,6,4).build(),
 table:new Mesh().tube(0,0,.98,0,.05,.05,rgb('#5a5d60'),0,0,0,6).tube(0,.98,1.04,0,.62,.62,rgb('#d8d0c0'),0,0,0,10).tube(0,1.04,2.55,0,.03,.03,rgb('#3a3d40'),0,0,0,5)
  .tube(0,2.2,2.8,0,1.55,.03,WHITE,1,0,0,10,false).build(),
 stall:(()=>{const m=new Mesh(),wood=rgb('#7d5d3f');m.box(-1.7,0,-.7,1.7,1.05,.7,wood);
  for(const sx of [-1.75,1.75])for(const sz of [-1,1])m.tube(sx,0,2.3,sz,.05,.05,wood,0,0,0,5);
  m.box(-2,2.25,-1.25,2,2.42,1.25,WHITE,1);
  for(const [n,c] of ['#c8362c','#e89a2a','#7aa83a','#d9c23a'].entries())m.box(-1.5+n*.8,1.05,-.4,-.9+n*.8,1.3,.4,rgb(c));return m.build();})(),
 bench:new Mesh().box(-.9,.4,-.24,.9,.48,.24,rgb('#70502f')).box(-.9,.48,-.26,.9,.95,-.19,rgb('#70502f')).box(-.82,0,-.2,-.72,.4,.2,rgb('#2a2d30')).box(.72,0,-.2,.82,.4,.2,rgb('#2a2d30')).build(),
 statue:(()=>{const m=new Mesh(),stone=rgb('#8e897e'),bronze=rgb('#3d6b5b');
  m.box(-.9,0,-.9,.9,2.3,.9,stone,0,0,0,.86).box(-1.15,0,-1.15,1.15,.35,1.15,stone);
  m.ball(0,3.55,0,.44,1.15,.38,bronze,0,0,0,8,6).ball(0,4.95,0,.27,.3,.27,bronze,0,0,0,8,5).tube(.5,3.9,5.5,.1,.1,.07,bronze,0,0,0,6).tube(-.2,2.3,3,0,.2,.16,bronze,0,0,0,6).tube(.2,2.3,3,0,.2,.16,bronze,0,0,0,6);return m.build();})(),
 food:new Mesh().ball(0,0,0,.34,.2,.34,rgb('#c9862e'),0,0,0,8,5).ball(0,.1,0,.2,.14,.2,rgb('#e8c98a'),0,0,0,8,4).build(),
};
const statics=[M.cube,M.tree,M.lamp,M.table,M.stall,M.bench,M.statue];
const moving=[M.person,M.umbrella,M.car,M.cab,M.ball,M.food];
const leaf=['#3f6b2a','#4d7a2c','#5a7f33','#6b8a36','#3b6034'], roofKit=rgb('#8b8f92');
let staticKey='';
// Buildings, trees and street furniture only change when the bird crosses into a new block.
function buildStatics(){
 const ix=Math.round(bird.x/tile),iz=Math.round(bird.z/tile),key=ix+','+iz;if(key===staticKey)return;staticKey=key;
 for(const m of statics)m.clear();
 for(let i=ix-6;i<=ix+5;i++)for(let j=iz-6;j<=iz+5;j++){
  const b=block(i,j);
  for(const [a,c,w,d,h,paint,seed] of b.blds){
   if(paint<0)continue;
   M.cube.add(a,0,c,0,w,h,d,rgb(wallPaint[paint]),1,seed);
   // Roof plant: purely for looks, kept low.
   M.cube.add(a+w*.25+seed*2,h,c+d*.3,0,1.8,.8,1.3,roofKit);if(w*d>150)M.cube.add(a+w*.62,h,c+d*.6,0,2.4,1,2.2,roofKit);
  }
  for(const [x,z,s,seed] of b.trees)M.tree.add(x,0,z,seed*tau,s,s*(.9+.25*seed),s,rgb(leaf[Math.floor(seed*leaf.length)]));
  for(const [n,[x,z]] of b.lamps.entries())M.lamp.add(x,0,z,[.8,-.8,2.4,-2.4][n]);
  for(const [x,z,p] of b.tables)M.table.add(x,0,z,0,1,1,1,rgb(parasolPaint[p]));
  for(const [x,z,p] of b.stalls)M.stall.add(x,0,z,0,1,1,1,rgb(parasolPaint[p]));
  for(const [x,z,yaw] of b.benches)M.bench.add(x,0,z,yaw);
  if(b.statue)M.statue.add(b.statue[0],0,b.statue[1],.6);
 }
 for(const m of statics)m.upload();
}
const splat=rgb('#f4f1e6'), smoke=rgb('#6c6a70');
function buildMoving(){
 for(const m of moving)m.clear();M.disc.clear();dyn.n=0;
 const winding=new Set(thrown.filter(o=>o.windup>0).map(o=>o.owner));
 for(const h of people){
  if(Math.abs(h.x-camera.x)>130||Math.abs(h.z-camera.z)>130)continue;
  const down=scored.has(h.id),size=.93+.14*hash(h.phase,3,7);
  const t=down?clamp((elapsed-fallen.get(h.id))/.43,0,1):0,lean=t*t*Math.PI*.49;
  const stride=down||h.fixed?0:h.running?.95:h.climbing?.5:.55,pace=h.running?11:h.climbing?9:6.2;
  M.person.add(h.x,h.y+(down?.13*t:0),h.z,h.yaw,size,size,size,rgb(h.c),0,elapsed*pace+h.phase,stride,lean,h.climbing||winding.has(h.id)?1:0);
  if(down)M.ball.add(h.x+Math.sin(h.yaw)*1.7*Math.sin(lean),h.y+.2+1.74*Math.cos(lean),h.z+Math.cos(h.yaw)*1.7*Math.sin(lean),0,.2,.13,.2,splat);
  else if(h.umb)M.umbrella.add(h.x,h.y,h.z,h.phase,1,1,1,rgb(parasolPaint[Math.floor(h.phase*7)%parasolPaint.length]));
  if(h.bride&&!down)M.ball.add(h.x,h.y+.55,h.z,0,.42,.55,.42,splat);
 }
 for(const c of cars){
  (c.cab?M.cab:M.car).add(c.x,0,c.z,c.yaw,1,1,1,rgb(c.color),-1);
  if(wrecks.has(c.id)){
   M.ball.add(c.x,1.5,c.z,0,.55,.07,.55,splat);
   for(let i=0;i<3;i++){const t=((elapsed-c.hitTime)*.6+i/3)%1;
    M.ball.add(c.x+Math.sin(c.yaw)*1.7+.25*Math.sin(t*5+i),1+t*3,c.z+Math.cos(c.yaw)*1.7,0,.25+.5*t,.25+.5*t,.25+.5*t,smoke);}
  }
 }
 for(const f of nearbyFood())M.food.add(f.x,f.y+.25+.12*Math.sin(elapsed*3+f.x),f.z,elapsed*1.5,1.5,1.5,1.5,WHITE,2);
 for(const o of thrown){
  if(o.windup>0)M.ball.add(o.x,o.y+.45,o.z,0,.2,.2,.2,rgb(o.kind));
  else M.ball.add(o.x,o.y,o.z,0,.3,.3,.3,rgb(o.kind),-1);
 }
 for(const m of mist){const a=1-m.age/m.life,r=.035+.05*a;M.ball.add(m.x,m.y,m.z,0,r,r,r,splat);}
 // The spray: droplets joined by a thin ribbon that always faces the camera.
 let prior=null;
 for(const d of drops){
  const p=at(d,d.age);M.ball.add(p[0],p[1],p[2],0,.07,.09,.07,splat);
  if(prior&&prior.age-d.age<.095){
   const q=at(prior,prior.age),ax=q[0]-p[0],ay=q[1]-p[1],az=q[2]-p[2],ex=camera.x-p[0],ey=camera.y-p[1],ez=camera.z-p[2];
   let sx=ay*ez-az*ey,sy=az*ex-ax*ez,sz=ax*ey-ay*ex;const l=.055/(Math.hypot(sx,sy,sz)||1);sx*=l;sy*=l;sz*=l;
   dyn.fan([[p[0]-sx,p[1]-sy,p[2]-sz],[p[0]+sx,p[1]+sy,p[2]+sz],[q[0]+sx,q[1]+sy,q[2]+sz],[q[0]-sx,q[1]-sy,q[2]-sz]],splat);
  }
  prior=d;
 }
 for(const s of stains){
  if(s.person||Math.abs(s.x-camera.x)>120||Math.abs(s.z-camera.z)>120)continue;
  const grow=Math.min(1,.45+(elapsed-s.t)*5);
  M.disc.add(s.x,s.y+.04,s.z,s.x,.95*grow,1,.95*grow,splat);M.disc.add(s.x+.8,s.y+.04,s.z+.45,0,.36*grow,1,.36*grow,splat);
 }
 for(let i=Math.floor(bird.x/tile)-2;i<=Math.floor(bird.x/tile)+2;i++)for(let j=Math.floor(bird.z/tile)-2;j<=Math.floor(bird.z/tile)+2;j++){
  const b=block(i,j);if(b.statue&&scored.has('st'+b.key))M.ball.add(b.statue[0],5.2,b.statue[1],0,.34,.2,.34,splat);
 }
 if(hawk)drawHawk();
 renderBird();
 for(const m of moving)m.upload();M.disc.upload();dyn.upload();
}
function drawHawk(){
 const h=hawk,s=Math.sin(h.angle),c=Math.cos(h.angle),k=1.7,roll=(h.bank||0)*.6,sr=Math.sin(roll),cr=Math.cos(roll);
 const w=([x,y,z])=>{const bx=x*cr+y*sr,by=y*cr-x*sr;return [h.x+(bx*c+z*s)*k,h.y+by*k,h.z+(-bx*s+z*c)*k];};
 const brown=rgb('#6a4a2e'),dark=rgb('#43301f'),pale=rgb('#cdb48c'),f=Math.sin(h.flap),f2=Math.sin(h.flap-.6);
 const nose=[0,0,.8],tail=[0,0,-.7],ring=[[0,.17,0],[.17,0,0],[0,-.13,0],[-.17,0,0]];
 for(let i=0;i<4;i++){const a=ring[i],b=ring[(i+1)%4],col=i===1||i===2?pale:brown;dyn.tri(w(nose),w(a),w(b),col);dyn.tri(w(tail),w(b),w(a),col);}
 dyn.tri(w([0,0,-.55]),w([-.32,0,-1.2]),w([.32,0,-1.2]),dark);
 for(const sd of [-1,1]){
  const a=[sd*.14,.05,.32],b=[sd*.14,.05,-.3],m1=[sd*.95,.05+f*.38,.3],m2=[sd*.95,.05+f*.38,-.28],tip=[sd*1.65,.05+f*.38+f2*.45,-.12];
  dyn.fan([w(a),w(m1),w(m2),w(b)],brown);dyn.tri(w(m1),w(tip),w(m2),dark);
 }
}
function render(dt=1/60){
 const p=payload(),tt=landingTime(p),aim=at(p,tt);
 if(!crash||!rig)setCamera(dt);
 buildStatics();buildMoving();
 drawFrame([...statics,M.person,M.umbrella,M.car,M.cab,dyn],[...statics,...moving,dyn],[M.disc]);
 ctx.clearRect(0,0,width,height);
 if(!crash&&state!=='menu'){
  // Warnings: a marker over anyone winding up, a shout when fruit is close.
  let danger=false;
  for(const o of thrown){
   if(o.windup>0){const m=point([o.x,o.y+1.3,o.z]);if(!m)continue;
    ctx.fillStyle='#fff4ab';ctx.strokeStyle='#792c51';ctx.lineWidth=3;ctx.beginPath();ctx.arc(...m,8,0,tau);ctx.fill();ctx.stroke();
    ctx.fillStyle='#722347';ctx.textAlign='center';ctx.font='bold 13px system-ui';ctx.fillText('!',m[0],m[1]+4.5);}
   else if(Math.hypot(o.x-bird.x,o.y-bird.y,o.z-bird.z)<10)danger=true;
  }
  const hunted=hawk&&hawk.hunting&&Math.hypot(hawk.x-bird.x,hawk.z-bird.z)<70;
  if(danger||hunted){
   ctx.save();ctx.textAlign='center';ctx.font='bold 18px system-ui';ctx.lineWidth=4;ctx.strokeStyle='#5b1f33';ctx.fillStyle=hunted?'#ff9c8a':'#fff0a8';
   const text=hunted?'HÖKEN JAGAR – DYK NER MELLAN HUSEN!':'Se upp!';ctx.strokeText(text,width/2,height*.31);ctx.fillText(text,width/2,height*.31);ctx.restore();
  }
  // Food markers, most visible when the tank is running low.
  for(const f of nearbyFood()){
   const m=point([f.x,f.y+1.5+.15*Math.sin(elapsed*3+f.x),f.z]);if(!m||m[0]<0||m[0]>width||m[1]<0||m[1]>height)continue;
   const r=tank<.4?9:6;ctx.save();ctx.translate(...m);ctx.globalAlpha=tank<.4?1:.75;ctx.beginPath();ctx.moveTo(0,r);ctx.lineTo(r,-r*.6);ctx.lineTo(-r,-r*.6);ctx.closePath();
   ctx.lineWidth=3;ctx.strokeStyle='#4a2f12';ctx.stroke();ctx.fillStyle='#ffd24a';ctx.fill();ctx.restore();
  }
  const target=people.find(h=>{
   if(scored.has(h.id))return false;
   const t=flightTime(p,h.y+1.8);if(t<0||t>tt)return false;
   const [hx,,hz]=at(p,t);
   if(wanted||h.fixed)return Math.hypot(h.x-hx,h.z-hz)<1.65;
   const [px,pz]=pavement(h.i,h.j,h.route+h.walk*t);
   return Math.hypot(px-hx,pz-hz)<1.65;
  })||(()=>{
   const t=flightTime(p,1.48);if(t<0||t>tt)return null;
   const [x,,z]=at(p,t);return cars.find(c=>!wrecks.has(c.id)&&carContact(c,x-Math.sin(c.yaw)*c.speed*t,1.47,z-Math.cos(c.yaw)*c.speed*t));
  })();
  // Dashes run down the predicted arc at a fixed pixel size.
  for(let i=0;i<12;i++){
   const t=tt*(i+(elapsed*4%1))/12,pos=point(at(p,t));
   if(pos){ctx.fillStyle='#2b2233';ctx.beginPath();ctx.arc(...pos,2.8,0,tau);ctx.fill();ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.arc(...pos,1.6,0,tau);ctx.fill();}
  }
  const ring=point(aim);if(ring)drawSight(ring,target);
  const last=stains.at(-1);
  if(last&&elapsed-last.t<.7){
   const hitPoint=point([last.x,last.y+.12,last.z]);
   if(hitPoint){const age=elapsed-last.t;ctx.save();ctx.globalAlpha=1-age/.7;
    ctx.strokeStyle='#2b2233';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(...hitPoint,12+age*24,7+age*12,0,0,tau);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();ctx.restore();}
  }
  if(drops.length||(stains.length&&elapsed-stains.at(-1).t<1.2))impactView(aim);
 }
 if(crash)crashFeathers();
 const lo=thresholds[wanted-1]||0,hi=thresholds[wanted],fill=wanted===maxWanted?100:Math.round(100*(points-lo)/(hi-lo));
 const meter=$('meter');if(meter.getAttribute('aria-valuenow')!==String(fill)){
  meter.setAttribute('aria-valuenow',String(fill));$('meter-fill').style.width=fill+'%';
 }
 hud('meter-label',wanted===maxWanted?'MAXKAOS · '+points+' P':'KAOS · '+points+' / '+hi);
 hud('stars','★'.repeat(wanted)+'☆'.repeat(maxWanted-wanted));$('ammo').value=tank;
 $('reserve').classList.toggle('low',tank<.3);
 windLevel();
 hud('feathers','🪶'.repeat(feathers));hud('combo',combo>1?'kombo ×'+combo:'');
 hud('time',wanted?'Jakt!':Math.max(0,Math.ceil(60-elapsed))+' s');
 hud('mode',bird.fold>.5||bird.vy<-14?'Störtdyk ×2':bird.y<14?'Lågflyg ×2':bird.climb>.9?'Nära stall':'Glidflykt');
 $('mode').classList.toggle('hot',bird.fold>.5||bird.vy<-14||bird.y<14);
}
