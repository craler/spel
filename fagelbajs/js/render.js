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
 // Near the streets the camera drops in behind the bird and looks further ahead, so the skyline comes into view.
 const low=above?0:clamp((24-bird.y)/14,0,1)*(1-bird.fold);
 const rise=above?Math.max(14,1.3*forward-fall*.5):mix(3.8,2.6,low);
 const toBird=Math.atan2(rise,back);
 const toAim=Math.atan2(rise+fall,Math.max(.35,back+forward));
 const chase=mix(toBird,toAim,.52);
 const desiredPitch=above?Math.PI/2:mix(chase,Math.min(chase,Math.max(.26,toAim-.38)),low);
 const shoulder=above?0:1.05;
 const focusAhead=above?forward*rise/(2*rise+fall):0;
 if(!rig)rig={yaw:a,pitch:desiredPitch,rise,ahead:focusAhead};
 rig.yaw=a;rig.pitch=mix(rig.pitch,desiredPitch,blend);rig.rise=mix(rig.rise,rise,blend);rig.ahead=mix(rig.ahead,focusAhead,blend);
 camera={x:bird.x+s*(rig.ahead-back)+c*shoulder,y:bird.y+rig.rise,z:bird.z+c*(rig.ahead-back)-s*shoulder,s,c,cp:Math.cos(rig.pitch),sp:Math.sin(rig.pitch)};
 const rush=bird.fold*clamp((Math.hypot(forwardSpeed(),bird.vy)-9)/40,.2,1);
 const shake=.013*rush*Math.sin(elapsed*33)+.006*rush*Math.sin(elapsed*48);
 camera.x+=c*shake;camera.z-=s*shake;camera.y+=.009*rush*Math.sin(elapsed*39);
 scale=Math.min(width*.88,height*(above?.85:.97))*(1-.085*bird.fold-.064*rush);
 if(shake>.01){const k=shake*.3;camera.x+=k*Math.sin(elapsed*71);camera.y+=k*.6*Math.sin(elapsed*97+1);camera.z+=k*Math.cos(elapsed*83);shake*=Math.exp(-dt*7);}
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
function text(str,x,y,size,fill='#fff',align='center',weight=800){
 ctx.font=weight+' '+size+'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';ctx.textAlign=align;ctx.lineJoin='round';
 ctx.lineWidth=Math.max(3,size*.22);ctx.strokeStyle='#0b0e14d9';ctx.strokeText(str,x,y);ctx.fillStyle=fill;ctx.fillText(str,x,y);
}
function drawSight([x,y],target){
 ctx.save();ctx.translate(x,y);ctx.lineCap='round';ctx.beginPath();
 for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(Math.cos(a)*12,Math.sin(a)*12);}
 ctx.lineWidth=4.5;ctx.strokeStyle='#0b0e14';ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle=target?'#6dff85':'#ffe45c';ctx.stroke();
 ctx.fillStyle='#fff';ctx.fillRect(-1,-1,2,2);ctx.restore();
}
// The ring lies on the ground and shows the real hit area, which grows with the height of the drop.
function drawRing(aim,R,target){
 ctx.beginPath();let started=false;
 for(let i=0;i<=32;i++){
  const a=i*tau/32,q=point([aim[0]+Math.cos(a)*R,aim[1]+.08,aim[2]+Math.sin(a)*R]);
  if(!q){started=false;continue;}
  if(started)ctx.lineTo(...q);else{ctx.moveTo(...q);started=true;}
 }
 ctx.lineJoin='round';ctx.fillStyle=target?'#6dff8526':'#ffe45c1c';ctx.fill();
 ctx.lineWidth=5;ctx.strokeStyle='#0b0e14b3';ctx.stroke();ctx.lineWidth=2.5;ctx.strokeStyle=target?'#6dff85':'#ffe45c';ctx.stroke();
}
function drawHitmarker([x,y]){
 const age=elapsed-marker;if(age<0||age>.2)return;
 const gap=6+age*30;ctx.save();ctx.translate(x,y);ctx.globalAlpha=1-age/.2;ctx.lineCap='round';ctx.beginPath();
 for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){ctx.moveTo(sx*gap,sy*gap);ctx.lineTo(sx*(gap+9),sy*(gap+9));}
 ctx.lineWidth=5;ctx.strokeStyle='#0b0e14';ctx.stroke();ctx.lineWidth=2.5;ctx.strokeStyle=markerGold?'#ffd24a':'#fff';ctx.stroke();ctx.restore();
}
function impactView(aim,R){
 const last=stains.at(-1),focus=last&&elapsed-last.t<1?[last.x,last.y,last.z]:aim;
 const size=Math.min(150,width*.2,height*.25),x=touchMode?18:width-size-18,y=touchMode?98:height-size-70,k=size/28; // clear of the thumb buttons on touch screens
 ctx.save();ctx.translate(x,y);ctx.beginPath();(ctx.roundRect||ctx.rect).call(ctx,0,0,size,size,10);ctx.fillStyle='#10141bd9';ctx.fill();ctx.clip();
 const px=n=>size/2+(n-focus[0])*k,pz=n=>size/2-(n-focus[2])*k;
 const dot=(x,z,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(px(x),pz(z),r,0,tau);ctx.fill();};
 const i=Math.floor(focus[0]/tile),j=Math.floor(focus[2]/tile);
 ctx.fillStyle='#ffffff26';
 for(let u=i-1;u<=i+1;u++)for(let v=j-1;v<=j+1;v++)for(const [a,b,w,d] of buildings(u,v))ctx.fillRect(px(a),pz(b+d),w*k,d*k);
 for(const h of stains)if(Math.abs(h.x-focus[0])<15&&Math.abs(h.z-focus[2])<15)dot(h.x,h.z,k*.5,'#f4f1e6');
 for(const h of people)if(Math.abs(h.x-focus[0])<15&&Math.abs(h.z-focus[2])<15)dot(h.x,h.z,k*.75,scored.has(h.id)?'#f4f1e6':'#ffd24a');
 ctx.strokeStyle='#ffe45c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px(aim[0]),pz(aim[2]),R*k,0,tau);ctx.stroke();
 ctx.fillStyle='#ffffffb3';ctx.font='800 10px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText('NEDSLAG',8,15);ctx.restore();
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
 people:[['#dba27e','#33271f'],['#8a5a3c','#1d1612'],['#f0c4a4','#b9853e'],['#c68a5e','#2a2019']].map(([skin,hair])=>personMesh(rgb(skin),rgb(hair))),
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
// Splatter shapes: an uneven blob with a few long rays (flat for the ground, upright for walls) and a drip.
 splat:splatMesh(false),splatWall:splatMesh(true),
 drip:(()=>{const m=new Mesh(),pts=[[-.5,0,0],[-.5,-.8,0]];
  for(let i=1;i<6;i++){const a=Math.PI+i*Math.PI/6;pts.push([.5*Math.cos(a),-.8+.2*Math.sin(a),0]);}
  pts.push([.5,-.8,0],[.5,0,0]);for(let i=2;i<pts.length;i++)m.tri(pts[0],pts[i-1],pts[i],WHITE,1);return m.build();})(),
};
function personMesh(skin,hair){
 const m=new Mesh(),pants=rgb('#2b323d');
 m.tube(-.1,0,.86,0,.075,.095,pants,0,1,.86,6);m.tube(.1,0,.86,0,.075,.095,pants,0,2,.86,6);
 m.ball(0,1.2,0,.21,.38,.15,WHITE,1,0,0,8,5);
 m.tube(-.27,.92,1.45,0,.05,.065,WHITE,1,3,1.45,6);m.tube(.27,.92,1.45,0,.05,.065,WHITE,1,4,1.45,6);
 m.ball(0,1.68,0,.125,.14,.13,skin,0,0,0,8,5);m.ball(0,1.73,-.025,.132,.115,.135,hair,0,0,0,8,4);return m.build();
}
function splatMesh(upright){
 const m=new Mesh(),n=36,pts=[];
 for(let i=0;i<n;i++){
  let a=i*tau/n,r=.66+.16*Math.sin(a*3+1)+.09*Math.sin(a*7+2.4);
  for(const ray of [.4,1.9,3.3,4.9]){const d=Math.atan2(Math.sin(a-ray),Math.cos(a-ray))/.17;r+=.5*Math.exp(-d*d);} // four rounded fingers
  pts.push(upright?[Math.cos(a)*r,Math.sin(a)*r,0]:[Math.cos(a)*r,0,Math.sin(a)*r]);
 }
 for(let i=0;i<n;i++)m.tri([0,0,0],pts[i],pts[(i+1)%n],WHITE,1);
 return m.build();
}
M.cube.cull=true;
const statics=[M.cube,M.tree,M.lamp,M.table,M.stall,M.bench,M.statue];
const moving=[...M.people,M.umbrella,M.car,M.cab,M.ball,M.food];
const decals=[M.splat,M.splatWall,M.drip,M.disc];
const leaf=['#3f6b2a','#4d7a2c','#5a7f33','#6b8a36','#3b6034'], roofKit=rgb('#8b8f92');
let staticKey='';
// Buildings, trees and street furniture only change when the bird crosses into a new block.
function buildStatics(){
 const ix=Math.round(bird.x/tile),iz=Math.round(bird.z/tile),key=ix+','+iz;if(key===staticKey)return;staticKey=key;
 for(const m of statics)m.clear();
 for(let i=ix-7;i<=ix+6;i++)for(let j=iz-7;j<=iz+6;j++){
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
const splatCol=rgb('#f4f1e6'), smoke=rgb('#6c6a70'), bits=rgb('#5e6b30'), amber=rgb('#ffb020');
function buildMoving(){
 for(const m of moving)m.clear();for(const m of decals)m.clear();dyn.n=0;omen.n=0;
 const winding=new Set(thrown.filter(o=>o.windup>0).map(o=>o.owner));
 for(const h of people){
  if(Math.abs(h.x-camera.x)>130||Math.abs(h.z-camera.z)>130)continue;
  const down=scored.has(h.id),size=.93+.14*hash(h.phase,3,7),since=down?elapsed-fallen.get(h.id):0;
  // A hit knocks them flat. After a few seconds they get up again, turn to the bird and shake a fist.
  const t=down?clamp(since/.43,0,1)*(1-clamp((since-4.5)/.9,0,1)):0,lean=t*t*Math.PI*.49,angry=down&&since>5.2;
  const stride=down||h.fixed?0:h.running?.95:h.climbing?.5:.55,pace=h.running?11:h.climbing?9:6.2;
  const arms=h.climbing||winding.has(h.id)?1:angry?.55+.4*Math.sin(elapsed*9+h.phase):0;
  if(angry)h.yaw=Math.atan2(bird.x-h.x,bird.z-h.z);
  M.people[Math.floor(hash(h.phase,9,2)*M.people.length)].add(h.x,h.y+(down?.13*t:0),h.z,h.yaw,size,size,size,rgb(h.c),0,elapsed*pace+h.phase,stride,lean,arms);
  if(down){ // a white cap of it on the head and shoulders
   const fx=Math.sin(h.yaw)*Math.sin(lean),fz=Math.cos(h.yaw)*Math.sin(lean),up=Math.cos(lean);
   M.ball.add(h.x+fx*1.72,h.y+.2+1.76*up,h.z+fz*1.72,0,.21,.14,.21,splatCol);
   M.ball.add(h.x+fx*1.4,h.y+.24+1.42*up,h.z+fz*1.4,h.yaw,.3,.09,.17,splatCol);
  }else if(h.umb)M.umbrella.add(h.x,h.y,h.z,h.phase,1,1,1,rgb(parasolPaint[Math.floor(h.phase*7)%parasolPaint.length]));
  if(h.bride&&!down)M.ball.add(h.x,h.y+.55,h.z,0,.42,.55,.42,splatCol);
 }
 for(const c of cars){
  (c.cab?M.cab:M.car).add(c.x,0,c.z,c.yaw,1,1,1,rgb(c.color),-1);
  const alarm=alarms.get(c.id);
  if(alarm!==undefined){ // hit while parked: a white cap on the roof and, for a while, flashing indicators
   M.ball.add(c.x,1.5,c.z,0,.6,.07,.5,splatCol);
   if(elapsed-alarm<6&&(elapsed*3.3)%1<.5)for(const sx of [-1,1])for(const sz of [-1,1]){
    const lx=sx*.8,lz=sz*1.95,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);M.ball.add(c.x+lx*cs+lz*sn,.72,c.z-lx*sn+lz*cs,0,.14,.1,.14,amber,2);}
  }
  if(wrecks.has(c.id)){
   M.ball.add(c.x,1.5,c.z,0,.6,.07,.5,splatCol);M.ball.add(c.x+Math.sin(c.yaw)*.9,1.2,c.z+Math.cos(c.yaw)*.9,c.yaw,.4,.25,.1,splatCol);
   for(let i=0;i<3;i++){const t=((elapsed-c.hitTime)*.6+i/3)%1;
    M.ball.add(c.x+Math.sin(c.yaw)*1.7+.25*Math.sin(t*5+i),1+t*3,c.z+Math.cos(c.yaw)*1.7,0,.25+.5*t,.25+.5*t,.25+.5*t,smoke);}
  }
 }
 for(const f of nearbyFood())M.food.add(f.x,f.y+.25+.12*Math.sin(elapsed*3+f.x),f.z,elapsed*1.5,1.5,1.5,1.5,WHITE,2);
 for(const o of thrown){
  if(o.windup>0)M.ball.add(o.x,o.y+.45,o.z,0,.2,.2,.2,rgb(o.kind));
  else M.ball.add(o.x,o.y,o.z,0,.3,.3,.3,rgb(o.kind),-1);
 }
 for(const m of mist){const a=1-m.age/m.life,r=.02+.035*a;M.ball.add(m.x,m.y,m.z,0,r,r,r,splatCol);}
 // The spray: wobbling blobs that stretch as they fall, some with dark bits, joined by a thin thread near the bird.
 let prior=null;
 for(const d of drops){
  const p=at(d,d.age),vy=d.vy-gravity*d.age,stretch=1+clamp(-vy*.03,0,1.3),wob=1+.2*Math.sin(d.age*26+d.seed);
  M.ball.add(p[0],p[1],p[2],0,d.r*wob,d.r*stretch,d.r/wob,splatCol);
  if(d.dark)M.ball.add(p[0]+.05,p[1]-.04,p[2]+.03,0,d.r*.55,d.r*.65,d.r*.55,bits);
  if(prior&&prior.age-d.age<.095&&d.age<.9){
   const q=at(prior,prior.age),ax=q[0]-p[0],ay=q[1]-p[1],az=q[2]-p[2],ex=camera.x-p[0],ey=camera.y-p[1],ez=camera.z-p[2];
   let sx=ay*ez-az*ey,sy=az*ex-ax*ez,sz=ax*ey-ay*ex;const l=.035*(1-d.age)/(Math.hypot(sx,sy,sz)||1);sx*=l;sy*=l;sz*=l;
   dyn.fan([[p[0]-sx,p[1]-sy,p[2]-sz],[p[0]+sx,p[1]+sy,p[2]+sz],[q[0]+sx,q[1]+sy,q[2]+sz],[q[0]-sx,q[1]-sy,q[2]-sz]],splatCol);
  }
  prior=d;
 }
 for(const s of splash){const r=.05*(1-.5*s.age/s.life);M.ball.add(s.x,s.y,s.z,0,r,r*1.5,r,splatCol);}
 for(const s of stains){
  if(Math.abs(s.x-camera.x)>130||Math.abs(s.z-camera.z)>130)continue;
  const age=elapsed-s.t,r=s.r*Math.min(1,.4+age*6),turn=s.seed*tau;
  if(s.wall!==undefined){
   M.splatWall.add(s.x,s.y,s.z,s.wall,r,r,1,splatCol);
   const len=Math.min(s.drip,age*.45,s.y-.1),off=r*.5*(s.seed-.5);
   if(len>.05)M.drip.add(s.x+Math.cos(s.wall)*off,s.y-r*.3,s.z-Math.sin(s.wall)*off,s.wall,.09+.09*s.seed,len,1,splatCol);
  }else{
   M.splat.add(s.x,s.y+.04,s.z,turn,r,1,r*(.8+.4*s.seed),splatCol);
   M.disc.add(s.x+.12*r*Math.cos(turn),s.y+.04,s.z+.12*r*Math.sin(turn),0,r*.2,1,r*.16,bits);
  }
 }
 for(let i=Math.floor(bird.x/tile)-2;i<=Math.floor(bird.x/tile)+2;i++)for(let j=Math.floor(bird.z/tile)-2;j<=Math.floor(bird.z/tile)+2;j++){
  const b=block(i,j);if(b.statue&&scored.has('st'+b.key)){M.ball.add(b.statue[0],5.2,b.statue[1],0,.36,.2,.36,splatCol);M.ball.add(b.statue[0],4.3,b.statue[1]+.3,0,.3,.5,.12,splatCol);}
 }
 // The hawk is drawn at its real size; a much larger copy goes only into the shadow map.
 if(hawk){drawHawk(dyn,1.9);hawkShadow();}
 renderBird();
 for(const m of moving)m.upload();for(const m of decals)m.upload();dyn.upload();omen.upload();
}
function drawHawk(batch,k){
 const h=hawk,yaw=Math.atan2(h.vx,h.vz),pitch=Math.atan2(h.vy,Math.max(.01,Math.hypot(h.vx,h.vz))),roll=h.bank*.7;
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),sr=Math.sin(roll),cr=Math.cos(roll);
 const w=([x,y,z])=>{ // roll, then nose up or down, then heading
  const bx=x*cr+y*sr,by=y*cr-x*sr,py=by*cp+z*sp,pz=z*cp-by*sp;
  return [h.x+(bx*cy+pz*sy)*k,h.y+py*k,h.z+(-bx*sy+pz*cy)*k];
 };
 const top=rgb('#33251a'),mid=rgb('#57402a'),pale=rgb('#c8b089'),tail=rgb('#241a12'),beak=rgb('#e8b830');
 const tri=(a,b,c,col)=>batch.tri(w(a),w(b),w(c),col),t=h.tuck,flap=Math.sin(h.flap)*(1-t),tip=Math.sin(h.flap-.6)*(1-t);
 // Body: nose, shoulders, rump.
 const nose=[0,.02,.72],rump=[0,0,-.62],ring=[[0,.19,.05],[.2,0,.05],[0,-.15,.05],[-.2,0,.05]];
 for(let i=0;i<4;i++){const a=ring[i],b=ring[(i+1)%4],col=i===1||i===2?pale:top;tri(nose,a,b,col);tri(rump,b,a,col);}
 tri([0,.03,.72],[.05,-.02,.6],[0,-.06,.86],beak);tri([0,.03,.72],[-.05,-.02,.6],[0,-.06,.86],beak);
 // Tail fan with a dark band.
 for(let i=-2;i<2;i++){const a=i*.17*(1.3-t*.6),b=(i+1)*.17*(1.3-t*.6);tri([0,0,-.5],[a,0,-1.18],[b,0,-1.18],i%2?tail:mid);}
 // Wings: an arm, a hand that lags the beat, and spread finger feathers. They sweep back when it stoops.
 for(const sd of [-1,1]){
  const root1=[sd*.16,.06,.34],root2=[sd*.16,.06,-.32];
  const el1=[sd*mix(.98,.5,t),.06+flap*.4,mix(.3,.05,t)],el2=[sd*mix(.98,.46,t),.06+flap*.4,mix(-.3,-.5,t)];
  const hx=sd*mix(1.72,.62,t),hy=.06+flap*.4+tip*.5,hz=mix(-.1,-1.02,t);
  batch.fan([w(root1),w(el1),w(el2),w(root2)],top);
  tri(el1,[hx,hy,hz+.22],el2,mid);tri(el2,[hx,hy,hz+.22],[hx*.86,hy,hz-.2],mid);
  for(let f=0;f<4;f++){const s=f/3,fx=hx+sd*(.18-.1*s)*(1-t),fz=hz+.26-s*.5;tri([hx*.9,hy,hz+.2-s*.34],[fx,hy+tip*.12,fz],[hx*.9,hy,hz+.08-s*.34],tail);}
 }
}
// The shadow caster: a flat, oversized bird-of-prey outline at the hawk's position. Because it lies level,
// the sun projects it onto the streets undistorted, so the shadow always reads as a hawk.
const hawkOutline=[[0,.42],[.06,.3],[.12,.22],[.55,.3],[.8,.26],[1,.2],[.88,.14],[.98,.08],[.86,.04],[.93,-.02],[.82,-.05],[.85,-.1],[.6,-.12],[.3,-.1],[.14,-.14],[.16,-.5],[0,-.56]];
function hawkShadow(){
 const h=hawk,yaw=Math.atan2(h.vx,h.vz),s=Math.sin(yaw),c=Math.cos(yaw),half=2.1*h.size;
 for(const side of [-1,1]){
  const pts=hawkOutline.map(([x,z])=>[h.x+(side*x*c+z*s)*half,h.y,h.z+(-side*x*s+z*c)*half]);
  for(let i=1;i<pts.length;i++)omen.tri([h.x,h.y,h.z],pts[i-1],pts[i],WHITE);
 }
}
// A compass-style arrow near the edge of the picture, pointing at something on the ground that is out of view.
function groundArrow(pos,label){
 const m=point(pos);if(m&&m[0]>40&&m[0]<width-40&&m[1]>60&&m[1]<height-40)return;
 const dx=pos[0]-bird.x,dz=pos[2]-bird.z,s=Math.sin(bird.angle),c=Math.cos(bird.angle),right=dx*c-dz*s,ahead=dx*s+dz*c,l=Math.hypot(right,ahead)||1;
 const ux=right/l,uy=-ahead/l,reach=Math.min(width,height),x=width/2+ux*reach*.4,y=height*.5+uy*reach*.36;
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(uy,ux));
 ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-9,-11);ctx.lineTo(-4,0);ctx.lineTo(-9,11);ctx.closePath();
 ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#0b0e14';ctx.stroke();ctx.fillStyle='#ffd24a';ctx.fill();ctx.restore();
 text(label+' '+Math.round(l)+' m',x,y+28,12,'#ffd24a','center',800);
}
function drawThreats(){
 let danger=false;
 for(const o of thrown){
  if(o.windup>0){const m=point([o.x,o.y+1.3,o.z]);if(!m)continue;
   ctx.fillStyle='#fff4ab';ctx.strokeStyle='#792c51';ctx.lineWidth=3;ctx.beginPath();ctx.arc(...m,8,0,tau);ctx.fill();ctx.stroke();
   ctx.fillStyle='#722347';ctx.textAlign='center';ctx.font='bold 13px system-ui';ctx.fillText('!',m[0],m[1]+4.5);}
  else if(Math.hypot(o.x-bird.x,o.y-bird.y,o.z-bird.z)<10)danger=true;
 }
 const h=hawk;
 if(h&&(h.mode==='lock'||h.mode==='stoop')){
  if(elapsed>bannerUntil&&Math.sin(elapsed*18)>-.3)text(h.mode==='lock'?'HÖKEN SIKTAR PÅ DIG':'HÖKEN STÖRTDYKER – SVÄNG!',width/2,height*.3,21,'#ff8a7a','center',900);
  // An arrow near the screen edge shows where it is coming from.
  const v=cameraPoint([h.x,h.y,h.z]),l=Math.hypot(v[0],v[1])||1,dx=v[0]/l,dy=-v[1]/l,reach=Math.min(width,height);
  ctx.save();ctx.translate(width/2+dx*reach*.38,height*.46+dy*reach*.34);ctx.rotate(Math.atan2(dy,dx));
  ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(-10,-12);ctx.lineTo(-4,0);ctx.lineTo(-10,12);ctx.closePath();
  ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#0b0e14';ctx.stroke();ctx.fillStyle='#ff5d4f';ctx.fill();ctx.restore();
 }else if(danger&&elapsed>bannerUntil)text('SE UPP!',width/2,height*.3,19,'#fff0a8','center',900);
}
// Numbers that rise from where the hit landed, and what the victims have to say about it.
function drawWorldText(){
 for(const q of popups){
  const age=elapsed-q.t,m=point([q.x,q.y+age*1.6,q.z]);if(!m)continue;
  ctx.globalAlpha=clamp(2.4-age*2.4,0,1);
  text(q.text,m[0],m[1],(q.gold?25:21)*(1+.5*Math.max(0,1-age*7)),q.gold?'#ffd24a':'#fff','center',900);
 }
 ctx.globalAlpha=1;
 for(const q of bubbles){
  const age=elapsed-q.t,m=point([q.x,q.y,q.z]);if(!m||cameraPoint([q.x,q.y,q.z])[2]>95)continue;
  const grow=Math.min(1,.4+age*8);
  ctx.save();ctx.globalAlpha=clamp((1.5-age)/.3,0,1);ctx.translate(m[0],m[1]);ctx.scale(grow,grow);
  ctx.font='800 12px system-ui,-apple-system,"Segoe UI",sans-serif';const wide=ctx.measureText(q.text).width+16;
  ctx.beginPath();(ctx.roundRect||ctx.rect).call(ctx,-wide/2,-35,wide,22,8);ctx.moveTo(-5,-13.5);ctx.lineTo(0,-4);ctx.lineTo(5,-13.5);
  ctx.lineJoin='round';ctx.lineWidth=2.5;ctx.strokeStyle='#0b0e14';ctx.stroke();ctx.fillStyle='#fff';ctx.fill();
  ctx.fillStyle='#0b0e14';ctx.textAlign='center';ctx.fillText(q.text,0,-19.5);ctx.restore();
 }
}
// The score feed beside the sight: newest line on top, with the combo and its timer above.
function drawFeed(){
 const x=width/2+Math.min(150,width*.17),y0=height*.4;
 if(combo>1){
  text('KOMBO ×'+combo,x,y0-30,17,'#ffd24a','left',900);
  ctx.fillStyle='#0b0e14aa';ctx.fillRect(x,y0-24,92,4);ctx.fillStyle='#ffd24a';ctx.fillRect(x,y0-24,92*clamp(comboTime/2.6,0,1),4);
 }
 let row=0;
 for(const f of feed){
  const age=elapsed-f.t;if(age>1.9)continue;
  ctx.globalAlpha=clamp((1.9-age)/.4,0,1);
  let cx=x+12*Math.max(0,1-age*8);const y=y0+row++*22;
  if(f.amount){text('+'+f.amount,cx,y,18,'#ffd24a','left',900);cx+=ctx.measureText('+'+f.amount).width+8;}
  text(f.label,cx,y,13,'#fff','left',800);
  if(f.tags){cx+=ctx.measureText(f.label).width+8;text(f.tags,cx,y,11,'#ffe9a3','left',800);}
 }
 ctx.globalAlpha=1;
}
function render(dt=1/60){
 const p=payload(),tt=landingTime(p),aim=at(p,tt),playing=state==='play';
 if(!crash||!rig)setCamera(dt);
 buildStatics();buildMoving();
 drawFrame([...statics,...M.people,M.umbrella,M.car,M.cab,dyn,omen],[...statics,...moving,dyn],decals);
 ctx.clearRect(0,0,width,height);
 if(!crash&&state!=='menu'){
  drawThreats();
  // Food markers, most visible when the tank is running low.
  const hungry=tank<.5;let foodInView=false;
  for(const f of nearbyFood()){
   const far=Math.hypot(f.x-bird.x,f.z-bird.z);if(far>(hungry?120:55))continue;
   const m=point([f.x,f.y+1.5+.15*Math.sin(elapsed*3+f.x),f.z]);if(!m||m[0]<0||m[0]>width||m[1]<0||m[1]>height)continue;
   foodInView=true;
   const r=hungry?9:6;ctx.save();ctx.translate(...m);ctx.globalAlpha=hungry?1:.7*clamp(1.6-far/40,0,1);ctx.beginPath();ctx.moveTo(0,r);ctx.lineTo(r,-r*.6);ctx.lineTo(-r,-r*.6);ctx.closePath();
   ctx.lineWidth=3;ctx.strokeStyle='#4a2f12';ctx.stroke();ctx.fillStyle='#ffd24a';ctx.fill();ctx.restore();
  }
  if(tank<.3&&!foodInView){const f=nearestFood();if(f)groundArrow([f.x,f.y,f.z],'MAT');}
  // Gold stars mark the targets that are worth going out of your way for.
  const star=(x,y,z)=>{const far=Math.hypot(x-bird.x,z-bird.z);if(far>150)return;const m=point([x,y,z]);if(m)text('★',m[0],m[1],14+7*clamp(1-far/90,0,1),'#ffd24a');};
  for(const h of people)if(h.base>=60&&!scored.has(h.id))star(h.x,h.y+2.9,h.z);
  for(const c of cars)if(c.cab&&!wrecks.has(c.id))star(c.x,2.7,c.z);
  for(let i=Math.floor(bird.x/tile)-3;i<=Math.floor(bird.x/tile)+3;i++)for(let j=Math.floor(bird.z/tile)-3;j<=Math.floor(bird.z/tile)+3;j++){
   const b=block(i,j);if(b.statue&&!scored.has('st'+b.key))star(b.statue[0],6.7,b.statue[1]);
  }
  const R=hitRadius(bird.y-aim[1]);
  const target=people.find(h=>{
   if(scored.has(h.id))return false;
   const t=flightTime(p,h.y+1.8);if(t<0||t>tt)return false;
   const [hx,,hz]=at(p,t);
   if(wanted||h.fixed)return Math.hypot(h.x-hx,h.z-hz)<R;
   const [px,pz]=pavement(h.i,h.j,h.route+h.walk*t);
   return Math.hypot(px-hx,pz-hz)<R;
  })||(()=>{
   const t=flightTime(p,1.48);if(t<0||t>tt)return null;
   const [x,,z]=at(p,t);return cars.find(c=>!wrecks.has(c.id)&&!alarms.has(c.id)&&carContact(c,x-Math.sin(c.yaw)*c.speed*t,1.47,z-Math.cos(c.yaw)*c.speed*t,R-1.65));
  })();
  // Dashes run down the predicted arc at a fixed pixel size.
  for(let i=0;i<12;i++){
   const t=tt*(i+(elapsed*4%1))/12,pos=point(at(p,t));
   if(pos){ctx.fillStyle='#0b0e14';ctx.beginPath();ctx.arc(...pos,2.8,0,tau);ctx.fill();ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.arc(...pos,1.6,0,tau);ctx.fill();}
  }
  drawRing(aim,R,target);
  const centre=point(aim);if(centre){drawSight(centre,target);drawHitmarker(centre);}
  drawWorldText();drawFeed();
  // Streaks at the edges of the picture sell the speed of a dive.
  const rush=bird.fold*clamp((Math.hypot(forwardSpeed(),bird.vy)-12)/36,0,1);
  if(rush>.15){
   ctx.save();ctx.translate(width/2,height*.43);ctx.strokeStyle='#fff';ctx.lineCap='round';const reach=Math.hypot(width,height)/2;
   for(let i=0;i<22;i++){
    const a=i*tau/22+hash(i,4,1),f=(elapsed*2.6+hash(i,2,5))%1,r0=reach*(.5+.45*f),r1=r0+reach*.12*rush;
    ctx.globalAlpha=.34*rush*(1-f);ctx.lineWidth=1.5+2*hash(i,6,3);ctx.beginPath();ctx.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);ctx.lineTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.stroke();
   }
   ctx.restore();
  }
  if(drops.length||(stains.length&&elapsed-stains.at(-1).t<1.2))impactView(aim,R);
 }
 if(crash)crashFeathers();
 // HUD
 const lo=thresholds[wanted-1]||0,hi=thresholds[wanted],fill=wanted===maxWanted?100:Math.round(100*(points-lo)/(hi-lo));
 const meter=$('meter');if(meter.getAttribute('aria-valuenow')!==String(fill)){
  meter.setAttribute('aria-valuenow',String(fill));$('meter-fill').style.width=fill+'%';
 }
 hud('meter-label',wanted===maxWanted?'MAXKAOS':'KAOS '+number(points)+' / '+number(hi));
 hud('stars','★'.repeat(wanted)+'☆'.repeat(maxWanted-wanted));hud('points',number(points));
 const level=Math.round(tank*100)+'%',bar=$('tank-fill');if(bar.style.width!==level)bar.style.width=level;
 $('reserve').classList.toggle('low',tank<.3||emptyTank);hud('tank-label',emptyTank?'TOMT – HITTA MAT':'BAJS');
 for(const [i,el] of [...$('feathers').children].entries())el.classList.toggle('lost',i>=feathers);
 if(wanted){hud('time',Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0'));hud('time-label','JAKT PÅGÅR');}
 else{hud('time',String(Math.max(0,Math.ceil(60-elapsed))));hud('time-label','SEKUNDER KVAR');}
 $('clock').classList.toggle('hurry',!wanted&&elapsed>50&&playing);
 const diving=bird.fold>.5||bird.vy<-14,low=bird.y<14,stall=!diving&&!low&&bird.climb>.9;
 hud('chip',diving&&low?'×4 LÅGT STÖRTDYK':diving?'×2 STÖRTDYK':low?'×2 LÅGFLYG':stall?'NÄRA STALL':'');
 $('chip').classList.toggle('warn',stall);
 // Sound and mood that follow the frame.
 windLevel();
 if(sound){sprayVoice(playing&&elapsed-lastDrop<.09);dread(playing&&hawk?hawk.dread:0);ambience(playing,dt);}
 const fear=playing&&hawk?hawk.dread*(.8+.2*Math.sin(elapsed*9)):0,veil=$('dread');
 if(Math.abs(fear-(+veil.style.opacity||0))>.01)veil.style.opacity=fear.toFixed(2);
}
