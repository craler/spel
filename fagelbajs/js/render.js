'use strict';
// Camera, bird mesh, scene assembly for the WebGL renderer and the 2D overlay (sight, warnings, HUD).
function setCamera(dt){
 // Through the bird's eyes: the view follows the flight path and leans into the turns.
 // In a crash the camera steps back out so the tumble can be seen.
 const mode=crash&&camView===2?0:camView,above=mode===1;
 if(mode===2){
  const a=bird.angle,s=Math.sin(a),c=Math.cos(a),k=1-Math.exp(-dt*6);
  const look=clamp(.2-flightPitch()*.85+(keys.has('Space')?.18:0),-.45,1.35);
  if(!rig||rig.pov===undefined)rig={pov:true,yaw:a,pitch:look,roll:0,rise:0,ahead:0};
  rig.yaw=a;rig.pitch=mix(rig.pitch,look,k);rig.roll=mix(rig.roll,-bird.bank*.42,k);
  camera={x:bird.x+s*.38,y:bird.y+.34,z:bird.z+c*.38,s,c,cp:Math.cos(rig.pitch),sp:Math.sin(rig.pitch),cr:Math.cos(rig.roll),sr:Math.sin(rig.roll)};
  const rush=bird.fold*clamp((Math.hypot(forwardSpeed(),bird.vy)-9)/40,.2,1),tremble=(.01+.05*rush*rush)*rush;
  camera.x+=c*tremble*Math.sin(elapsed*33);camera.z-=s*tremble*Math.sin(elapsed*33);camera.y+=tremble*.8*Math.sin(elapsed*47);
  scale=Math.min(width*.6,height*.72)*(1-.14*bird.fold-.12*rush);
  if(shake>.01){const q=shake*.12;camera.x+=q*Math.sin(elapsed*71);camera.y+=q*.6*Math.sin(elapsed*97+1);shake*=Math.exp(-dt*7);}
  return;
 }
 if(rig&&rig.pov)rig=null;
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
 rig.yaw=a;rig.pitch=mix(rig.pitch,desiredPitch,blend);
 if(!above)rig.pitch=Math.min(rig.pitch,Math.atan2(rig.rise,back)+.24); // never tilt so far down that the bird leaves the top of the picture
 rig.rise=mix(rig.rise,rise,blend);rig.ahead=mix(rig.ahead,focusAhead,blend);
 camera={x:bird.x+s*(rig.ahead-back)+c*shoulder,y:bird.y+rig.rise,z:bird.z+c*(rig.ahead-back)-s*shoulder,s,c,cp:Math.cos(rig.pitch),sp:Math.sin(rig.pitch),cr:1,sr:0};
 const rush=bird.fold*clamp((Math.hypot(forwardSpeed(),bird.vy)-9)/40,.2,1);
 // The faster the dive, the harder the picture trembles and the wider the view.
 const tremble=(.02+.1*rush*rush)*rush;
 camera.x+=c*tremble*Math.sin(elapsed*33)+tremble*.5*Math.sin(elapsed*61);camera.z-=s*tremble*Math.sin(elapsed*33);camera.y+=tremble*.8*Math.sin(elapsed*47);
 scale=Math.min(width*.88,height*(above?.85:.97))*(1-.085*bird.fold-.1*rush);
 if(shake>.01){const k=shake*.3;camera.x+=k*Math.sin(elapsed*71);camera.y+=k*.6*Math.sin(elapsed*97+1);camera.z+=k*Math.cos(elapsed*83);shake*=Math.exp(-dt*7);}
}
function cameraPoint([x,y,z]){
 const c=camera,dx=x-c.x,dy=y-c.y,dz=z-c.z,f=dx*c.s+dz*c.c,X=dx*c.c-dz*c.s,Y=dy*c.cp+f*c.sp;
 return [X*c.cr+Y*c.sr,Y*c.cr-X*c.sr,f*c.cp-dy*c.sp];
}
function screen(p){return [width/2+p[0]*scale/p[2],height*.43-p[1]*scale/p[2]];}
function point(p){const v=cameraPoint(p);return v[2]>.6?screen(v):null;}
// Connected cross-sections from rump to forehead. Units are local bird metres.
const pigeonSections=[
 [-.49,.018,.045,.046],[-.38,.024,.133,.092],[-.21,.046,.175,.144],
 [0,.073,.187,.174],[.14,.115,.162,.172],[.208,.197,.127,.142],
 [.25,.27,.126,.126],[.335,.292,.129,.12],[.412,.285,.084,.083],[.444,.278,.032,.043]
];
// The body is a smooth skin: the cross-sections are interpolated along the bird (Catmull-Rom), every ring has
// eighteen points, and the shading uses normals averaged over the skin, so it reads as soft plumage, not facets.
// Colours blend from the pale belly to the blue-grey back, through an iridescent green and purple neck to the head.
const bodyRings=(()=>{
 const S=pigeonSections,out=[],cr=(a,b,c,d,t)=>.5*(2*b+(c-a)*t+(2*a-5*b+4*c-d)*t*t+(3*b-a-3*c+d)*t*t*t);
 for(let i=0;i<S.length-1;i++)for(let k=0;k<(i>=4&&i<=7?4:3);k++){
  const t=k/(i>=4&&i<=7?4:3),q=n=>S[clamp(n,0,S.length-1)];
  out.push([0,1,2,3].map(c=>cr(q(i-1)[c],q(i)[c],q(i+1)[c],q(i+2)[c],t)));
 }
 out.push(S.at(-1));return out;
})();
const plumeCol={back:rgb('#7c8aab'),belly:rgb('#a9b3c9'),green:rgb('#3f8a74'),purple:rgb('#7b5a98'),head:rgb('#6a7697'),rump:rgb('#9aa6c0')};
const SEG=18;
function plumageColor(z,a){
 const up=Math.sin(a),side=Math.abs(Math.cos(a)),lerp=(p,q,t)=>[mix(p[0],q[0],t),mix(p[1],q[1],t),mix(p[2],q[2],t)];
 let c=lerp(plumeCol.belly,plumeCol.back,clamp(up*.9+.55,0,1));
 if(z<-.3)c=lerp(c,plumeCol.rump,clamp((-.3-z)/.15,0,1)*.6);
 const neck=clamp(1-Math.abs(z-.22)/.1,0,1);
 if(neck>0)c=lerp(c,lerp(plumeCol.purple,plumeCol.green,side),neck*.85); // green on the sides, purple at the throat and nape
 if(z>.3)c=lerp(c,plumeCol.head,clamp((z-.3)/.04,0,1));
 return c;
}
function smoothBody(toWorld){
 const R=bodyRings,grid=R.map(([z,y,w,h],j)=>Array.from({length:SEG},(_,i)=>{const a=i*tau/SEG;return toWorld([w*Math.cos(a),y+h*Math.sin(a),z]);}));
 const cols=R.map(([z])=>Array.from({length:SEG},(_,i)=>plumageColor(z,i*tau/SEG)));
 const tip=toWorld([0,R.at(-1)[1],R.at(-1)[0]+.012]),tail=toWorld([0,R[0][1],R[0][0]-.02]);
 const norm=(j,i)=>{ // across the ring and along the body, from the neighbouring points
  const g=grid,a=g[j][(i+1)%SEG],b=g[j][(i+SEG-1)%SEG],c=g[Math.min(R.length-1,j+1)][i],d=g[Math.max(0,j-1)][i];
  const u=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],v=[c[0]-d[0],c[1]-d[1],c[2]-d[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
  return [n[0]/l,n[1]/l,n[2]/l];
 };
 const N=grid.map((r,j)=>r.map((_,i)=>norm(j,i)));
 for(let j=1;j<R.length;j++)for(let i=0;i<SEG;i++){
  const k=(i+1)%SEG,A=[j-1,i],B=[j-1,k],C=[j,k],D=[j,i],P=([a,b])=>grid[a][b],Nn=([a,b])=>N[a][b],Cc=([a,b])=>cols[a][b];
  dyn.smooth([P(A),P(B),P(C)],[Nn(A),Nn(B),Nn(C)],[Cc(A),Cc(B),Cc(C)]);dyn.smooth([P(A),P(C),P(D)],[Nn(A),Nn(C),Nn(D)],[Cc(A),Cc(C),Cc(D)]);
 }
 const last=R.length-1,end=(pt,j,flip)=>{const n=[pt[0]-grid[j][0][0],0,0];for(let i=0;i<SEG;i++){const k=(i+1)%SEG;
  dyn.smooth(flip?[pt,grid[j][k],grid[j][i]]:[pt,grid[j][i],grid[j][k]],[N[j][i],N[j][flip?k:i],N[j][flip?i:k]],[cols[j][i],cols[j][i],cols[j][k]]);}};
 end(tip,last,false);end(tail,0,true);
}
function flightPitch(){
 // At low airspeed the beak can still point up even as lift fades.
 const pathAngle=Math.atan2(bird.vy,forwardSpeed());
 if(pathAngle<0)return pathAngle;
 return Math.max(pathAngle*.82,
  bird.climb>.01?1.33*bird.climb:-Math.PI/2);
}
function renderBird(){
 const b=bird,fl=Math.max(b.fold*(crash?Math.exp(-crash.age*2):1),b.snare>0&&!crash?.96:0),bank=b.bank*.62+(crash?.roll??0),pitch=flightPitch()+(crash?.pitch??0);
 const sy=Math.sin(b.angle),cy=Math.cos(b.angle),sb=Math.sin(bank),cb=Math.cos(bank),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const bob=-.03*Math.sin(wingPhase)*b.effort; // the body rides up on each downstroke
 function world([x,y,z]){
  y+=bob;const bx=x*cb+y*sb,by=y*cb-x*sb,bz=z*cp-by*sp;
  const offset=[bx*cy+bz*sy,by*cp+z*sp,-bx*sy+bz*cy];
  return [b.x+offset[0],b.y+offset[1],b.z+offset[2]];
 }
 // The head turns on the neck: into a turn, down at the target while spraying, and in small glances of its own.
 const hy=crash?.9*Math.sin(crash.age*7)*Math.exp(-crash.age*.7):b.lookYaw,hp=crash?-.5:b.lookPitch; // in a crash the head lolls
 function head([x,y,z]){
  const w=clamp((z-.2)/.07,0,1);if(!w)return [x,y,z];
  const a=hy*w,e=hp*w,py=y-.2,pz=z-.2,x1=x*Math.cos(a)+pz*Math.sin(a),z1=-x*Math.sin(a)+pz*Math.cos(a);
  return [x1,py*Math.cos(e)+z1*Math.sin(e)+.2,z1*Math.cos(e)-py*Math.sin(e)+.2];
 }
 const face=(pts,color)=>poly(pts.map(p=>world(head(p))),color,1),plain=(pts,color)=>poly(pts.map(world),color,1);
 // Every flight feather flutters by itself in the airstream, harder the faster the bird goes.
 const wind=clamp(Math.hypot(forwardSpeed(),b.vy)/30,.3,1.7)*(1+2*fl),flutter=(i,rate)=>wind*Math.sin(elapsed*rate+i*2.1);
 smoothBody(p=>world(head(p)));
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
  if(hash(k,5,31)<(3-feathers)*.25)continue; // lost feathers leave gaps
  const t=k/3,root=[t*.055,.051,-.33],tx=t*spread,tz=-.73+.09*t*t;
  const end=[tx,.037-.029*t*t+.014*flutter(k,23+k),tz],w=.042;
  const mid=[mix(root[0],tx,.66),.049-.024*t*t,mix(root[2],tz,.66)];
  plain([root,[mid[0]-w,mid[1],mid[2]],[tx-w*.62,end[1],tz],end,[tx+w*.62,end[1],tz],[mid[0]+w,mid[1],mid[2]]],'#687695');
  plain([[mid[0]-w,mid[1]+.002,mid[2]],[mid[0]+w,mid[1]+.002,mid[2]],[tx+w*.65,end[1]+.002,tz+.02],[tx-w*.65,end[1]+.002,tz+.02]],'#424a67');
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
   return [side*(.089+reach*(1-.93*fl)),
    .101+upper*Math.sin(elbowAngle)+(outer-flexible)*Math.sin(tipAngle)+flexible*Math.sin(joint?.tip??tipAngle)+y,
    .095+chord+.14*Math.sin(u*Math.PI)-.27*u*u-.78*u*fl];
  }
  const patch=(pts,color)=>plain(pts.map(v=>wing(...v)),color);
  // Rounded secondary feathers broaden the trailing edge near the body.
  for(let i=0;i<6;i++){
   if(hash(i,side+2,31)<(3-feathers)*.3)continue;
   const u=.047+i*.074;
   const f=.028*flutter(i+side,17+2.7*i);
   patch([[u-.034,.065],[u+.064,.063],[u+.093,-.204,f*.6],[u+.053,-.31,f],[u+.016,-.323,f],[u-.02,-.278,f*.8]],i===3||i===5?'#5b6a8c':i%2?'#8d9dbf':'#a7b3cc');
  }
  // Staggered primaries end in distinct pointed tips.
  for(let i=0;i<6;i++){
   if(hash(i,side+5,37)<(3-feathers)*.3)continue;
   const u=.35+i*.067,tip=.59+i*.091,sweep=-.275+i*.038;
   const f=.04*flutter(i-side,21+3.3*i)+.03*beat*(i-2.5)/2.5; // tips also splay with the beat
   patch([[u,.06],[u+.11,.044],[tip+.012,sweep+.043,f],[tip,sweep,f*1.2],[tip-.047,sweep-.016,f],[u-.035,-.105]],i%2?'#4d5a7d':'#5a6a8d');
  }
  patch([[0,.12],[.22,.143],[.44,.098],[.72,.031],[.85,-.019],[.60,-.106],[.32,-.159],[.08,-.165],[0,-.134]],'#aebdd9');
  patch([[.04,.116,.009],[.22,.129,.009],[.42,.086,.009],[.29,.039,.009],[.08,.048,.009]],'#c8d5e6');
  for(const u of [.32,.46])patch([[u+.018,.056,.012],[u+.065,.044,.012],[u-.009,-.177,.012],[u-.069,-.20,.012]],'#56658a');
 }
 paint();
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
function hud(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value;}
// ---- 3D scene -------------------------------------------------------------
const overlay=$('overlay2d'), ctx=overlay.getContext('2d');
// The bird code above describes its feathers as polygons; they go straight into the per-frame triangle batch.
// Each feather is shaded as if gently domed: the normals lean outwards towards its edges, so the light rolls
// over it instead of the whole patch turning one flat colour.
function poly(points,color){
 const col=rgb(color),n=points.length,a=points[0],b=points[1],c=points[n-1];
 const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
 let f=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];const fl=Math.hypot(...f)||1;f=f.map(q=>q/fl);
 const m=[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/n);
 const nrm=points.map(p=>{const d=[p[0]-m[0],p[1]-m[1],p[2]-m[2]],l=Math.hypot(...d)||1,q=[f[0]+.55*d[0]/l,f[1]+.55*d[1]/l,f[2]+.55*d[2]/l],ql=Math.hypot(...q)||1;return [q[0]/ql,q[1]/ql,q[2]/ql];});
 for(let i=2;i<n;i++)dyn.smooth([points[0],points[i-1],points[i]],[nrm[0],nrm[i-1],nrm[i]],[col,col,col]);
}
function paint(){}
const M={
 cube:new Mesh().box(0,0,0,1,1,1,WHITE,1).build(),
 ball:new Mesh().ball(0,0,0,1,1,1,WHITE,1,0,0,10,6).build(),
 disc:(()=>{const m=new Mesh();for(let i=0;i<14;i++){const a=i*tau/14,b=(i+1)*tau/14;m.tri([0,0,0],[Math.cos(b),0,Math.sin(b)],[Math.cos(a),0,Math.sin(a)],WHITE,1);}return m.build();})(),
 people:[['#dba27e','#33271f','#2b323d',0],['#8a5a3c','#1d1612','#3a4a66',1],['#f0c4a4','#b9853e','#4a4038',1],['#c68a5e','#2a2019','#5c5f66',0],['#e6b08c','#7a3b1e','#2f3d55',0]].map(([skin,hair,pants,long])=>personMesh(rgb(skin),rgb(hair),rgb(pants),long)),
 umbrella:new Mesh().tube(0,2.02,2.42,0,.85,.03,WHITE,1,0,0,10,false).tube(.2,1.15,2.4,.1,.014,.014,rgb('#22252a'),0,0,0,5).build(),
 car:carMesh('sedan'),hatch:carMesh('hatch'),cab:carMesh('cab'),
 bus:(()=>{const m=new Mesh(),glass=rgb('#17212d'),tyre=rgb('#141518'),hub=rgb('#aeb3b8');
  m.loft([[-5.2,.45,3,1.2,1.15],[5,.45,3,1.2,1.15],[5.2,.55,2.3,1.15,1.1]],WHITE,1);
  m.box(-1.22,1.55,-4.8,1.22,2.55,4.5,glass).box(-1.05,1.5,5.0,1.05,2.6,5.22,glass).box(-1.21,.45,-5.21,1.21,.75,5.21,rgb('#1c1d21'));
  for(const sx of [-1,1]){for(const z of [-3.4,3.3])m.wheel(sx*1.15,.5,z,.5,.3,sx,tyre,hub);m.box(sx*.8-.2,.8,5.2,sx*.8+.2,1,5.24,rgb('#fff2c4'));m.box(sx*.8-.2,.8,-5.24,sx*.8+.2,1.05,-5.2,rgb('#b3201c'));}
  return m.build();})(),
 box:new Mesh().box(0,0,0,1,1,1,WHITE,1).build(),
 gable:new Mesh().loft([[-.5,0,.02,.5,.5],[0,0,1,.5,.5],[.5,0,.02,.5,.5]],WHITE,1).build(),
 // A hot-air balloon: a teardrop envelope in alternating coloured and cream gores, with a skirt at the mouth.
 balloon:(()=>{const m=new Mesh(),cream=rgb('#efe6d2'),prof=[[.16,-1],[.2,-.9],[.34,-.74],[.66,-.36],[.9,0],[1,.36],[.93,.66],[.66,.9],[.3,.985],[0,1]],n=16;
  const at=(k,i)=>{const a=i*tau/n;return [prof[k][0]*Math.cos(a),prof[k][1],prof[k][0]*Math.sin(a)];};
  for(let i=0;i<n;i++)for(let k=1;k<prof.length;k++){const tint=(i%2===0)!==(k>6);m.quad(at(k-1,i),at(k-1,i+1),at(k,i+1),at(k,i),tint?WHITE:cream,tint?1:0);}
  for(let i=0;i<n;i++)m.quad(at(0,i),at(0,i+1),[at(0,i+1)[0]*.9,-1.07,at(0,i+1)[2]*.9],[at(0,i)[0]*.9,-1.07,at(0,i)[2]*.9],WHITE,1);
  return m.build();})(),
 big:new Mesh().ball(0,0,0,1,1,1,WHITE,1,0,0,14,8).build(),
 boat:new Mesh().loft([[-1.7,.02,.5,.2,.4],[-.9,0,.52,.55,.78],[.9,0,.52,.55,.78],[1.8,.12,.58,.08,.16]],WHITE,1).box(-.6,.3,-.2,.6,.36,.1,[.6,.6,.6],1).build(),
 tank:(()=>{const m=new Mesh(),track=[.22,.22,.2],steel=[.5,.5,.48];
  m.loft([[-3.3,.6,1.15,1.45,1.3],[-3,.5,1.55,1.55,1.4],[2.3,.5,1.55,1.55,1.4],[3.3,.65,1.1,1.45,1.3]],WHITE,1);
  for(const sd of [-1,1]){m.box(sd*1.55-.38,0,-3.35,sd*1.55+.38,.95,3.35,track,0,0,0,.9);for(let i=0;i<5;i++)m.wheel(sd*1.95,.48,-2.5+i*1.25,.44,.12,sd,track,steel);}
  m.box(-1.2,1.55,-3.1,1.2,1.7,-2.2,[.8,.8,.8],1);return m.build();})(),
 turret:(()=>{const m=new Mesh();
  m.loft([[-1.3,1.55,2.2,1.05,.8],[-.9,1.55,2.3,1.1,.85],[.9,1.55,2.3,1.1,.85],[1.4,1.6,2.1,.9,.7]],[.92,.92,.92],1);
  m.beam([0,2,1.2],[0,3.25,3.9],.13,[.6,.6,.6],1).beam([0,3.2,3.8],[0,3.4,4.2],.2,[.45,.45,.45],1);
  m.ball(.45,2.32,-.3,.32,.14,.32,[.75,.75,.75],1,0,0,8,4);return m.build();})(),
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
// Splatter shapes: an uneven blob with a few long rays (flat for the ground, upright for walls) and a drip.
 splat:splatMesh(false),splatWall:splatMesh(true),
 dome:(()=>{const m=new Mesh();for(let j=0;j<3;j++)for(let i=0;i<9;i++){const q=(a,b)=>{const t=a*tau/9,u=b*Math.PI/6,n=[Math.sin(u)*Math.cos(t),Math.cos(u),Math.sin(u)*Math.sin(t)];return [n,n];};
  const c=[q(i,j),q(i+1,j),q(i+1,j+1),q(i,j+1)];for(const k of [0,1,2,0,2,3])m.v(c[k][0],c[k][1],WHITE,1);}return m.build();})(),
 drip:(()=>{const m=new Mesh(),pts=[[-.5,0,0],[-.5,-.8,0]];
  for(let i=1;i<6;i++){const a=Math.PI+i*Math.PI/6;pts.push([.5*Math.cos(a),-.8+.2*Math.sin(a),0]);}
  pts.push([.5,-.8,0],[.5,0,0]);for(let i=2;i<pts.length;i++)m.tri(pts[0],pts[i-1],pts[i],WHITE,1);return m.build();})(),
};
function personMesh(skin,hair,pants,long){
 const m=new Mesh(),shoe=rgb('#1c1a19');
 for(const [sx,part] of [[-.1,1],[.1,2]]){
  m.tube(sx,.07,.88,0,.07,.1,pants,0,part,.88,6);m.box(sx-.07,0,-.08,sx+.07,.09,.17,shoe,0,part,.88);
 }
 m.ball(0,1.08,0,.19,.26,.14,WHITE,1,0,0,8,5).ball(0,1.32,0,.24,.17,.15,WHITE,1,0,0,8,4); // waist and shoulders
 for(const [sx,part] of [[-.29,3],[.29,4]]){
  m.tube(sx,.96,1.43,0,.045,.062,WHITE,1,part,1.43,6);m.ball(sx,.92,0,.05,.06,.05,skin,0,part,1.43,6,4);
 }
 m.tube(0,1.44,1.58,0,.05,.05,skin,0,0,0,6,false);
 m.ball(0,1.69,0,.122,.14,.128,skin,0,0,0,8,5).ball(0,1.745,-.025,.13,.11,.134,hair,0,0,0,8,4);
 if(long)m.ball(0,1.6,-.07,.13,.2,.09,hair,0,0,0,8,4);
 return m.build();
}
// Cars are lofted through a handful of cross-sections so they get a bonnet, a raked windscreen and a boot,
// with round wheels, lights, bumpers and mirrors. Around 300 triangles each.
function carMesh(kind){
 const m=new Mesh(),tyre=rgb('#141518'),hub=rgb('#aeb3b8'),glass=rgb('#17212d'),dark=rgb('#1c1d21'),skin=rgb('#dba27e');
 m.loft([[-2.05,.4,.68,.8,.78],[-1.9,.3,.86,.9,.88],[-1.1,.3,.95,.92,.9],[.8,.3,.94,.92,.9],[1.7,.3,.82,.9,.86],[2.05,.38,.62,.8,.76]],WHITE,1);
 if(kind==='cab'){
  m.box(-.74,.72,-1.25,.74,.97,.45,rgb('#5a3a28'));m.loft([[.5,.94,1.34,.8,.72],[.62,.94,.96,.82,.8]],glass);
  for(const sx of [-1,1]){m.ball(sx*.36,1.27,-.15,.14,.15,.14,skin,0,0,0,8,5);m.ball(sx*.36,1.02,-.2,.2,.24,.15,sx<0?rgb('#c8443a'):rgb('#e8e4da'),0,0,0,8,4);}
 }else{
  const back=kind==='hatch'?[[-1.95,.93,1,.86,.82],[-1.72,.93,1.4,.85,.68]]:[[-1.5,.93,.97,.86,.84],[-.98,.93,1.42,.84,.66]];
  m.loft([...back,[.3,.93,1.44,.84,.68],[1.02,.93,.97,.86,.84]],glass);
  m.box(-.66,1.43,back[1][0]+.03,.66,1.475,.28,WHITE,1);
  for(const sx of [-1,1])for(const z of [back[1][0],.3])m.beam([sx*.845,.95,z],[sx*.675,1.44,z],.035,WHITE,1); // pillars
 }
 for(const sx of [-1,1]){
  for(const z of [-1.28,1.25])m.wheel(sx*.9,.34,z,.34,.22,sx,tyre,hub);
  m.box(sx*.62-.19,.6,2.0,sx*.62+.19,.76,2.07,rgb('#fff2c4'));m.box(sx*.62-.19,.62,-2.07,sx*.62+.19,.8,-2.0,rgb('#b3201c'));
  m.box(sx*.93,.93,.72,sx*1.06,1.03,.86,WHITE,1); // mirror
 }
 m.box(-.86,.36,2.02,.86,.5,2.1,dark).box(-.86,.38,-2.1,.86,.52,-2.02,dark).box(-.22,.52,-2.08,.22,.64,-2.06,rgb('#e8e6dc'));
 return m.build();
}
// A splatter: a dark wet core, a paler body with four rounded fingers, and a cream rim. The vertex colours
// multiply the instance colour, so one mesh serves every stain.
function splatMesh(upright){
 const m=new Mesh(),n=36,P=(x,y)=>upright?[x,y,0]:[x,0,y],N=upright?[0,0,1]:[0,1,0];
 const core=[.6,.56,.34],body=[.86,.83,.64],rim=[1,1,1];
 const ring=Array.from({length:n},(_,i)=>{
  const a=i*tau/n;let r=.66+.16*Math.sin(a*3+1)+.09*Math.sin(a*7+2.4);
  for(const ray of [.4,1.9,3.3,4.9]){const d=Math.atan2(Math.sin(a-ray),Math.cos(a-ray))/.17;r+=.5*Math.exp(-d*d);}
  return [a,r];
 });
 const pt=(a,r)=>P(Math.cos(a)*r,Math.sin(a)*r);
 for(let i=0;i<n;i++){
  const [a0,r0]=ring[i],[a1,r1]=ring[(i+1)%n],k0=.34+.08*Math.sin(a0*5),k1=.34+.08*Math.sin(a1*5);
  m.v(P(.04,-.03),N,core,1);m.v(pt(a0,r0*k0),N,core,1);m.v(pt(a1,r1*k1),N,core,1);
  for(const [p,c] of [[pt(a0,r0*k0),core],[pt(a0,r0*.8),body],[pt(a1,r1*.8),body],[pt(a0,r0*k0),core],[pt(a1,r1*.8),body],[pt(a1,r1*k1),core],
   [pt(a0,r0*.8),body],[pt(a0,r0),rim],[pt(a1,r1),rim],[pt(a0,r0*.8),body],[pt(a1,r1),rim],[pt(a1,r1*.8),body]])m.v(p,N,c,1);
 }
 return m.build();
}
M.cube.cull=true;
const statics=[M.cube,M.tree,M.lamp,M.table,M.stall,M.bench,M.statue,M.gable];
const moving=[...M.people,M.umbrella,M.car,M.hatch,M.cab,M.bus,M.tank,M.turret,M.box,M.big,M.balloon,M.boat,M.ball,M.dome];
const decals=[M.splat,M.splatWall,M.drip,M.disc];
const leaf=['#3f6b2a','#4d7a2c','#5a7f33','#6b8a36','#3b6034'], roofKit=rgb('#8b8f92');
let staticKey='';
// Buildings, trees and street furniture only change when the bird crosses into a new block.
function buildStatics(){
 const ix=Math.round(bird.x/tile),iz=Math.round(bird.z/tile),key=ix+','+iz;if(key===staticKey)return;staticKey=key;
 for(const m of statics)m.clear();
 // Nearest blocks first, so the shadow pass can stop after the ones its map covers (see Mesh.drawShadow).
 // Fast graphics draw 9 x 9 blocks instead of 14 x 14 and let the haze close in a little sooner.
 const reach=fast?4.5:7,list=[];
 for(let i=Math.ceil(ix-.5-reach);i<=Math.floor(ix-.5+reach);i++)for(let j=Math.ceil(iz-.5-reach);j<=Math.floor(iz-.5+reach);j++)list.push([i,j,Math.max(Math.abs(i-ix+.5),Math.abs(j-iz+.5))]);
 list.sort((a,b)=>a[2]-b[2]);let marked=false;
 for(const [i,j,d] of list){
  if(!marked&&d>4.5){marked=true;for(const m of statics)m.near=m.n;}
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
  if(b.type===3){ // canal: quay walls down to the water, bridge edges and railings, gabled roofs
   const {x,z}=b,stone=rgb('#5d5850'),iron=rgb('#1e2124');
   for(const wx of [16.2,25.5]){M.cube.add(x+wx,WATER-.2,z+8,0,.3,.2-WATER,26,stone);M.cube.add(x+wx-.05,0,z+8,0,.4,.28,26,stone);}
   for(const wz of [7.6,34]){M.cube.add(x+16.5,-.7,z+wz,0,9,.7,.4,stone);M.cube.add(x+16.4,.0,z+wz+.1,0,9.2,.16,.2,stone);
    M.cube.add(x+16.4,.95,z+wz+.14,0,9.2,.08,.1,iron);for(let n=0;n<=9;n++)M.cube.add(x+16.45+n,.16,z+wz+.15,0,.07,.8,.07,iron);}
   for(const [gx,gz,h,seed] of b.gables)M.gable.add(gx,h,gz,0,5.5,1.6+1.6*seed,5,rgb(seed<.5?'#5a2f26':'#3a3d42'));
  }
 }
 for(const m of statics)m.upload();
}
const gooShade=['#efe9d2','#e2dbb4','#d3cf9a','#f4f0e2','#c9c08a'].map(rgb);
// A thick, tapering strand of goo between two points, turned to face the camera and shaded as wet.
function strand(p,q,w0,w1,col){
 const ax=q[0]-p[0],ay=q[1]-p[1],az=q[2]-p[2],ex=camera.x-p[0],ey=camera.y-p[1],ez=camera.z-p[2];
 const sx=ay*ez-az*ey,sy=az*ex-ax*ez,sz=ax*ey-ay*ex,l=Math.hypot(sx,sy,sz)||1;if(w0<=.004&&w1<=.004)return;
 const u=[sx/l,sy/l,sz/l],a=Math.max(0,w0),b=Math.max(0,w1),m=[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2],c=Math.min(a,b)*.6; // pinched in the middle
 goo.fan([[p[0]-u[0]*a,p[1]-u[1]*a,p[2]-u[2]*a],[p[0]+u[0]*a,p[1]+u[1]*a,p[2]+u[2]*a],[m[0]+u[0]*c,m[1]+u[1]*c,m[2]+u[2]*c],[m[0]-u[0]*c,m[1]-u[1]*c,m[2]-u[2]*c]],col);
 goo.fan([[m[0]-u[0]*c,m[1]-u[1]*c,m[2]-u[2]*c],[m[0]+u[0]*c,m[1]+u[1]*c,m[2]+u[2]*c],[q[0]+u[0]*b,q[1]+u[1]*b,q[2]+u[2]*b],[q[0]-u[0]*b,q[1]-u[1]*b,q[2]-u[2]*b]],col);
}
const splatCol=rgb('#f4f1e6'), smoke=rgb('#6c6a70'), bits=rgb('#4f4a26'), amber=rgb('#ffb020'), balloonPaint=['#d8362c','#f0b828','#2f7fc0','#3fa060','#e8742a'], rope=rgb('#c9a56a'), olive=rgb('#56633c'), charred=rgb('#2e302c');
function buildMoving(){
 for(const m of moving)m.clear();for(const m of decals)m.clear();dyn.n=0;omen.n=0;goo.n=0;
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
   M.ball.add(h.x+fx*1.72,h.y+.2+1.76*up,h.z+fz*1.72,0,.21,.14,.21,splatCol,-1);
   M.ball.add(h.x+fx*1.4,h.y+.24+1.42*up,h.z+fz*1.4,h.yaw,.3,.09,.17,splatCol,-1);
  }else if(h.umb)M.umbrella.add(h.x,h.y,h.z,h.phase,1,1,1,rgb(parasolPaint[Math.floor(h.phase*7)%parasolPaint.length]));
  if(h.bride&&!down)M.ball.add(h.x,h.y+.55,h.z,0,.42,.55,.42,splatCol,-1);
 }
 for(const c of cars){
  (c.bus?M.bus:c.cab?M.cab:c.hatch?M.hatch:M.car).add(c.x,0,c.z,c.yaw,1,1,1,rgb(c.color),-1);
  if(c.bus&&wrecks.has(c.id))M.ball.add(c.x,3.02,c.z,c.yaw,.9,.07,1.6,splatCol,-1);
  const alarm=alarms.get(c.id);
  if(alarm!==undefined){ // hit while parked: a white cap on the roof and, for a while, flashing indicators
   M.ball.add(c.x,1.5,c.z,0,.6,.07,.5,splatCol,-1);
   if(elapsed-alarm<9&&(elapsed-alarm)%.9<.5)for(const sx of [-1,1])for(const sz of [-1,1]){
    const lx=sx*.8,lz=sz*1.95,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);M.ball.add(c.x+lx*cs+lz*sn,.72,c.z-lx*sn+lz*cs,0,.14,.1,.14,amber,2);}
  }
  if(wrecks.has(c.id)){
   M.ball.add(c.x,1.5,c.z,0,.6,.07,.5,splatCol,-1);M.ball.add(c.x+Math.sin(c.yaw)*.9,1.2,c.z+Math.cos(c.yaw)*.9,c.yaw,.4,.25,.1,splatCol,-1);
   for(let i=0;i<3;i++){const t=((elapsed-c.hitTime)*.6+i/3)%1;
    M.ball.add(c.x+Math.sin(c.yaw)*1.7+.25*Math.sin(t*5+i),1+t*3,c.z+Math.cos(c.yaw)*1.7,0,.25+.5*t,.25+.5*t,.25+.5*t,smoke);}
  }
 }
 for(const o of thrown){
  const held=o.windup>0,x=o.x,y=o.y+(held?.5:0),z=o.z,k=held?.75:1.25,turn=o.spin+o.age*9;
  if(o.kind==='net'||o.kind==='bignet'){if(held)M.ball.add(x,y,z,0,.2,.16,.2,rope);else drawNet(x,y,z,o.r||.3,false,[o.vx,o.vy,o.vz]);continue;}
  if(o.kind==='shell'){M.ball.add(x,y,z,0,.3,.3,.3,rgb('#2a2c2e'),-1);for(let i=1;i<5;i++)M.ball.add(x-o.vx*i*.012,y-o.vy*i*.012,z-o.vz*i*.012,0,.2+.08*i,.2+.08*i,.2+.08*i,smoke);continue;}
  // Recognisable groceries, a size bigger than life, each leaving a short trail so it can be seen coming.
  if(o.kind==='tomato'){M.ball.add(x,y,z,0,.26*k,.23*k,.26*k,rgb('#d8261c'),-1);M.ball.add(x,y+.2*k,z,turn,.12*k,.05*k,.12*k,rgb('#3f8a2c'));}
  else if(o.kind==='banana'){for(const s of [-1,0,1])M.ball.add(x+Math.sin(turn+s*.5)*s*.2*k,y-Math.abs(s)*.07*k,z+Math.cos(turn+s*.5)*s*.2*k,turn+s*.5,.085*k,.085*k,.2*k,rgb('#f2d024'));}
  else if(o.kind==='egg')M.ball.add(x,y,z,turn,.19*k,.25*k,.19*k,rgb('#f6efe2'),-1);
  else if(o.kind==='cabbage'){M.ball.add(x,y,z,turn,.32*k,.29*k,.32*k,rgb('#7fb04a'));M.ball.add(x+.08,y+.1,z,turn,.24*k,.2*k,.26*k,rgb('#a9d06a'));}
  else{M.ball.add(x,y,z,turn,.13*k,.1*k,.3*k,rgb('#6a3f24'));M.ball.add(x,y-.08*k,z,turn,.14*k,.04*k,.32*k,rgb('#1c1a19'));M.ball.add(x-Math.sin(turn)*.2*k,y+.1*k,z-Math.cos(turn)*.2*k,turn,.12*k,.13*k,.12*k,rgb('#6a3f24'));}
  if(!held)for(let i=1;i<4;i++){const q=.09*(1-i/4);M.ball.add(x-o.vx*i*.03,y-o.vy*i*.03,z-o.vz*i*.03,0,q,q,q,splatCol,-1);}
 }
 if(bird.snare>0)drawNet(bird.x,bird.y+.25,bird.z,1,true);
 // Star targets with their props: window cleaners on a lift, rowing boats on the canal, hot-air balloons.
 for(let i=Math.floor(bird.x/tile)-3;i<=Math.floor(bird.x/tile)+3;i++)for(let j=Math.floor(bird.z/tile)-3;j<=Math.floor(bird.z/tile)+3;j++){
  const b=block(i,j);
  if(b.cleaner){const [cx,cz,top,s]=b.cleaner,y=2+(top-6)*(.5+.5*Math.sin(elapsed*.4+s));M.box.add(cx-1.3,y-.14,cz-.5,0,2.6,.14,1.1,rgb('#8a8d90'));
   for(const sx of [-1.25,1.25])ribbon([cx+sx,y,cz+.5],[cx+sx,top,cz+.6],.025);}
  if(b.type===3)for(const [n,q] of boatsAt(b).entries())M.boat.add(q.x,WATER+.04,q.z,q.yaw,1,1,1,rgb(n?'#2f5d7a':'#8a5a34'));
 }
 for(const q of balloons()){
  const paint=rgb(balloonPaint[Math.floor(q.hue*40)%balloonPaint.length]),sway=.2*Math.sin(elapsed*.5+q.hue*9);
  M.balloon.add(q.x,q.y+7,q.z,q.hue*9+elapsed*.05,5.5,6.6,5.5,paint);
  // Wicker basket with a rim, two passengers and a burner that flares now and then.
  M.box.add(q.x-.8+sway,q.y-2.3,q.z-.8,0,1.6,1.15,1.6,rgb('#8a6436'));M.box.add(q.x-.88+sway,q.y-1.2,q.z-.88,0,1.76,.12,1.76,rgb('#4a3520'));
  for(const sx of [-.35,.35])M.ball.add(q.x+sx+sway,q.y-.85,q.z+.1*sx,0,.17,.19,.17,rgb(sx<0?'#dba27e':'#8a5a3c'));
  if((elapsed*.35+q.hue*5)%1<.35)M.ball.add(q.x+sway*.5,q.y+.1,q.z,0,.22,.5+.2*Math.sin(elapsed*30),.22,amber,2);
  for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])ribbon([q.x+sx*.8+sway,q.y-1.1,q.z+sz*.8],[q.x+sx*.62,q.y+.45,q.z+sz*.62],.03);
  if(scored.has(q.id))M.ball.add(q.x,q.y+13.2,q.z,0,3,.5,3,splatCol,-1);
 }
 for(const t of tanks){
  const alive=t.hp>0,paint=alive?olive:charred;
  const kick=t.recoil*t.recoil,bob=alive?.025*Math.sin(elapsed*13+t.id*9)*Math.min(1,t.speed/4):0,rel=t.turret-t.yaw;
  const pitch=t.pitch-.06*kick*Math.cos(rel),tx=t.x-Math.sin(t.turret)*.3*kick,tz=t.z-Math.cos(t.turret)*.3*kick;
  M.tank.add(t.x,bob,t.z,t.yaw,1,1,1,paint,0,0,0,pitch);M.turret.add(tx,bob,tz,alive?t.turret:t.turret+.5,1,1,1,paint,0,0,0,pitch*Math.cos(rel));
  const since=elapsed-t.fired;
  if(t.muzzle&&since<1.6){const [mx,my,mz]=t.muzzle; // flash, then a cloud of smoke that rolls away from the muzzle
   if(since<.09)M.ball.add(mx,my,mz,t.turret,.9,.6,1.3,amber,2);
   for(let i=0;i<5;i++){const f=since/1.6,q=(.4+1.6*f)*(1-.12*i);M.ball.add(mx+Math.sin(t.turret)*i*.5*(1+f),my+f*1.8+i*.1,mz+Math.cos(t.turret)*i*.5*(1+f),0,q,q,q,smoke);}
  }
  if(alive&&t.exhaust>.05)for(let i=0;i<3;i++){const f=(elapsed*1.4+i/3)%1,q=(.25+.5*f)*t.exhaust; // diesel smoke from the back deck
   M.ball.add(t.x-Math.sin(t.yaw)*3.1+.4*Math.sin(i*2),1.6+f*2.4,t.z-Math.cos(t.yaw)*3.1,0,q,q,q,charred);}
  for(const [dx,dz] of t.splats)M.ball.add(t.x+clamp(dx,-1.4,1.4),Math.hypot(dx,dz)<1.2?2.32:1.6,t.z+clamp(dz,-3,3),0,.34,.07,.3,splatCol,-1);
  if(!alive)for(let i=0;i<4;i++){const f=(t.dead*.5+i/4)%1,q=.5+1.2*f;M.ball.add(t.x+.5*Math.sin(f*6+i),2.4+f*6,t.z,0,q,q,q,smoke);}
 }
 for(const m of mist){const a=1-m.age/m.life,r=.02+.035*a;M.ball.add(m.x,m.y,m.z,0,r,r,r,splatCol,-1);}
 // The spray: wet, glossy blobs stretched along their fall, in mixed shades with darker bits,
 // joined by thick strands that thin out and snap as they fall apart. While it flows, a strand hangs from the vent.
 let prior=null;
 const vent=birdPoint([0,-.07,-.43]),flowing=state==='play'&&elapsed-lastDrop<.09;
 for(const d of drops){
  const p=at(d,d.age),vx=d.vx,vy=d.vy-gravity*d.age,vz=d.vz,sp=Math.hypot(vx,vy,vz)||1;
  const stretch=1+clamp(sp*.035,0,1.6)*(d.big?.6:1),wob=1+.22*Math.sin(d.age*26+d.seed),tilt=Math.atan2(-vy,Math.hypot(vx,vz)||1e-3);
  M.ball.add(p[0],p[1],p[2],Math.atan2(vx,vz),d.r*wob,d.r/wob,d.r*stretch,gooShade[d.seed%gooShade.length],-1,0,0,tilt);
  if(d.dark)M.ball.add(p[0]+.4*d.r,p[1]+.2*d.r,p[2]+.3*d.r,d.seed,d.r*.5,d.r*.45,d.r*.6,bits,-1);
  if(prior&&prior.age-d.age<.1&&d.age<1.1)strand(at(prior,prior.age),p,prior.r*.75*(1-prior.age*.8),d.r*.75*(1-d.age*.8),gooShade[d.seed%gooShade.length]);
  prior=d;
 }
 if(flowing&&drops.length){const d=drops.at(-1);strand(vent,at(d,d.age),.07,d.r*.7,gooShade[0]);M.ball.add(vent[0],vent[1],vent[2],0,.06,.06,.06,gooShade[0],-1);}
 for(const s of splash){const r=.05*(1-.5*s.age/s.life);M.ball.add(s.x,s.y,s.z,0,r,r*1.5,r,gooShade[Math.floor(s.life*20)%gooShade.length],-1);}
 for(const s of stains){
  if(Math.abs(s.x-camera.x)>130||Math.abs(s.z-camera.z)>130)continue;
  const age=elapsed-s.t,r=s.r*Math.min(1,.4+age*6),turn=s.seed*tau,col=gooShade[Math.floor(s.seed*97)%gooShade.length];
  if(s.wall!==undefined){
   M.splatWall.add(s.x,s.y,s.z,s.wall,r,r,1,col,-1);
   const len=Math.min(s.drip,age*.45,s.y-.1),off=r*.5*(s.seed-.5);
   if(len>.05){const dx=s.x+Math.cos(s.wall)*off,dz=s.z-Math.sin(s.wall)*off,w=.09+.09*s.seed;
    M.drip.add(dx,s.y-r*.3,dz,s.wall,w,len,1,col,-1);
    M.dome.add(dx+Math.sin(s.wall)*.02,s.y-r*.3-len*.8-.05,dz+Math.cos(s.wall)*.02,s.wall,w*.55,w*.7,w*.45,col,-1);} // a fat drop at the end of the run
  }else{
   M.splat.add(s.x,s.y+.04,s.z,turn,r,1,r*(.8+.4*s.seed),col,-1);
   // A raised, glistening heap in the middle, a dark streak through it, and a few droplets flung out around it.
   const heap=Math.min(1,age*9)*r;
   M.dome.add(s.x+.08*r*Math.cos(turn),s.y+.03,s.z+.08*r*Math.sin(turn),turn,heap*.34,heap*(.07+.06*s.seed),heap*.27,col,-1);
   M.dome.add(s.x+.15*r*Math.cos(turn+1),s.y+.05,s.z+.15*r*Math.sin(turn+1),turn,heap*.2,heap*.08,heap*.09,bits,-1);M.dome.add(s.x-.2*r*Math.cos(turn+2),s.y+.04,s.z-.2*r*Math.sin(turn+2),turn+1,heap*.12,heap*.05,heap*.06,bits,-1);
   if(r>.4&&!fast)for(let k=0;k<3;k++){const a=turn+k*2.1+s.seed*3,dd=r*(1.25+.5*hash(k,s.seed,3));
    M.dome.add(s.x+Math.cos(a)*dd,s.y+.03,s.z+Math.sin(a)*dd,0,r*.07,r*.05,r*.07,col,-1);}
  }
 }
 for(let i=Math.floor(bird.x/tile)-2;i<=Math.floor(bird.x/tile)+2;i++)for(let j=Math.floor(bird.z/tile)-2;j<=Math.floor(bird.z/tile)+2;j++){
  const b=block(i,j);if(b.statue&&scored.has('st'+b.key)){M.ball.add(b.statue[0],5.2,b.statue[1],0,.36,.2,.36,splatCol,-1);M.ball.add(b.statue[0],4.3,b.statue[1]+.3,0,.3,.5,.12,splatCol,-1);}
 }
 // The hawk is drawn at its real size; a much larger copy goes only into the shadow map.
 if(hawk){drawHawk(dyn,2.3);hawkShadow();}
 for(const f of plume)drawFeather(f); // loose feathers from a crash
 if(camView!==2||crash)renderBird();
 for(const m of moving)m.upload();for(const m of decals)m.upload();dyn.upload();omen.upload();goo.upload();
}
// One loose feather: a quill with two curved vanes, the outer one narrower, darker towards the tip.
const featherShades=[['#eef1f6','#c7cfdd'],['#9aa7c2','#5d6a8c'],['#7f8cab','#454f6e'],['#d9dfe9','#8f9bb6']].map(p=>p.map(rgb));
function drawFeather(f){
 const calm=1-Math.exp(-f.age*1.6),grounded=f.y<=.04;
 const roll=grounded?0:mix(f.tumble[0],.75*Math.sin(f.sway),calm),pitch=grounded?0:mix(f.tumble[1],.25*Math.cos(f.sway),calm);
 const yaw=f.heading,sr=Math.sin(roll),cr=Math.cos(roll),sp=Math.sin(pitch),cp=Math.cos(pitch),sy=Math.sin(yaw),cy=Math.cos(yaw),L=f.len;
 const w=([x,y,z])=>{x*=L;y*=L;z*=L;const x1=x*cr-y*sr,y1=x*sr+y*cr,y2=y1*cp-z*sp,z2=y1*sp+z*cp;return [f.x+x1*cy+z2*sy,f.y+y2,f.z-x1*sy+z2*cy];};
 const [base,tip]=featherShades[f.shade],n=6;
 for(const side of [-1,1]){
  const reach=f.wide*(side<0?1:.62);
  for(let i=0;i<n;i++){
   const t0=i/n,t1=(i+1)/n,curve=t=>-.12*t*t+f.curl*t*t*.3,width=t=>reach*Math.sin(Math.PI*Math.pow(t,.75))*(1-.25*t);
   const a=[0,curve(t0),t0-.5],b=[0,curve(t1),t1-.5],c=[side*width(t1),curve(t1)-.04,t1-.5-.06],d=[side*width(t0),curve(t0)-.04,t0-.5-.06];
   const col=t1>.7?tip:base;dyn.tri(w(a),w(b),w(c),col);dyn.tri(w(a),w(c),w(d),col);
  }
 }
 const q=featherShades[0][0];ribbon(w([0,.01,-.62]),w([0,-.11,.5]),.006*(L/.2),q); // the quill
}
function drawHawk(batch,k){
 const h=hawk,yaw=Math.atan2(h.vx,h.vz),pitch=Math.atan2(h.vy,Math.max(.01,Math.hypot(h.vx,h.vz))),roll=h.bank*.7;
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),sr=Math.sin(roll),cr=Math.cos(roll);
 const w=([x,y,z])=>{ // roll, then nose up or down, then heading
  const bx=x*cr+y*sr,by=y*cr-x*sr,py=by*cp+z*sp,pz=z*cp-by*sp;
  return [h.x+(bx*cy+pz*sy)*k,h.y+py*k,h.z+(-bx*sy+pz*cy)*k];
 };
 const top=rgb('#3a2a1c'),mid=rgb('#5e4630'),pale=rgb('#d8c4a0'),bar=rgb('#7a5a3c'),dark=rgb('#1c140d'),yellow=rgb('#e8b830'),white=rgb('#efe8da');
 const tri=(a,b,c,col)=>batch.tri(w(a),w(b),w(c),col),t=h.tuck,flap=Math.sin(h.flap)*(1-t),tip=Math.sin(h.flap-.6)*(1-t);
 // Body in three rings so it reads as chest, belly and rump, dark above and barred pale below.
 const rings=[[.62,.1,.09],[.3,.2,.17],[0,.23,.19],[-.35,.17,.14],[-.6,.07,.06]].map(([z,rx,ry])=>[[0,ry,z],[rx,.02,z],[0,-ry*.85,z],[-rx,.02,z]]);
 for(let n=1;n<rings.length;n++)for(let i=0;i<4;i++){const a=rings[n-1],b=rings[n],j=(i+1)%4,col=i===1||i===2?(n%2?pale:bar):top;tri(a[i],a[j],b[j],col);tri(a[i],b[j],b[i],col);}
 // Head: pale brow, hooked yellow beak, dark eyes.
 const nose=[0,.03,.86];for(let i=0;i<4;i++)tri(nose,rings[0][i],rings[0][(i+1)%4],i<1||i>2?white:top);
 tri([0,.05,.84],[.05,-.01,.74],[0,-.09,.96],yellow);tri([0,.05,.84],[-.05,-.01,.74],[0,-.09,.96],yellow);
 for(const sd of [-1,1])tri([sd*.085,.07,.7],[sd*.1,.03,.66],[sd*.09,.07,.62],dark);
 // Tail: a fan of feathers with a dark band and a white tip.
 for(let i=-3;i<3;i++){const s=.11*(1.5-t*.8),a=i*s,b=(i+1)*s;
  tri([0,0,-.5],[a,0,-1.05],[b,0,-1.05],i%2?mid:top);tri([a,0,-1.05],[a*1.08,0,-1.2],[b*1.08,0,-1.2],dark);tri([a,0,-1.05],[b*1.08,0,-1.2],[b,0,-1.05],dark);
  tri([a*1.08,0,-1.2],[a*1.1,0,-1.27],[b*1.1,0,-1.27],white);tri([a*1.08,0,-1.2],[b*1.1,0,-1.27],[b*1.08,0,-1.2],white);}
 // Legs: tucked in flight, thrown forward with open talons in the stoop.
 for(const sd of [-1,1]){const foot=[sd*.1,-.22-.1*t,mix(-.3,.45,t)];tri([sd*.08,-.12,-.1],[sd*.13,-.12,-.05],foot,yellow);
  for(const c of [-.07,0,.07])tri(foot,[foot[0]+c,foot[1]-.09*t-.02,foot[2]+.1],[foot[0]+c*.5,foot[1],foot[2]+.03],dark);}
 // Wings: arm, hand and six separate finger feathers; barred underneath. They sweep back when it stoops.
 for(const sd of [-1,1]){
  const root1=[sd*.18,.07,.36],root2=[sd*.18,.07,-.34],lift=.07+flap*.42;
  const el1=[sd*mix(1,.5,t),lift,mix(.34,.08,t)],el2=[sd*mix(1,.46,t),lift,mix(-.34,-.52,t)];
  const hx=sd*mix(1.7,.62,t),hy=lift+tip*.5,hz=mix(-.08,-1,t);
  batch.fan([w(root1),w(el1),w(el2),w(root2)],top);
  for(let n=0;n<4;n++){const a=n/4,b=(n+1)/4,p=q=>[mix(root2[0],el2[0],q),mix(root2[1],el2[1],q)-.004,mix(root2[2],el2[2],q)];
   tri(p(a),p(b),[mix(root1[0],el1[0],b),lift*b+.066*(1-b),mix(.36,el1[2],b)-.3],n%2?bar:mid);}
  tri(el1,[hx,hy,hz+.24],el2,mid);tri(el2,[hx,hy,hz+.24],[hx*.84,hy,hz-.22],mid);
  for(let f=0;f<6;f++){const s=f/5,fx=hx+sd*(.3-.2*s)*(1-t),fz=hz+.3-s*.62;
   tri([hx*.9,hy,hz+.24-s*.4],[fx,hy+tip*.14*(1-s),fz],[hx*.9,hy,hz+.13-s*.4],f%2?dark:top);}
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
// A thin strip between two points that always faces the camera.
function ribbon(p,q,w,col){
 const ax=q[0]-p[0],ay=q[1]-p[1],az=q[2]-p[2],ex=camera.x-p[0],ey=camera.y-p[1],ez=camera.z-p[2];
 let sx=ay*ez-az*ey,sy=az*ex-ax*ez,sz=ax*ey-ay*ex;const l=w/(Math.hypot(sx,sy,sz)||1);sx*=l;sy*=l;sz*=l;
 dyn.fan([[p[0]-sx,p[1]-sy,p[2]-sz],[p[0]+sx,p[1]+sy,p[2]+sz],[q[0]+sx,q[1]+sy,q[2]+sz],[q[0]-sx,q[1]-sy,q[2]-sz]],col||rope);
}
// A net in flight: a diamond mesh with knots, a thicker edge rope and lead weights at the corners,
// opened like a parachute with the weights leading. It ripples as it flies.
const knot=rgb('#5e4c30'),snareRope=rgb('#a88a58'),lead=rgb('#2c2f33');
function drawNet(x,y,z,r,wrap,dir){
 if(wrap)return drawSnare();
 let u=[1,0,0],v=[0,0,1],f=[0,-1,0];
 if(dir){
  const l=Math.hypot(...dir)||1;f=dir.map(q=>q/l);
  u=[f[2],0,-f[0]];const ul=Math.hypot(u[0],u[2])||1;u=[u[0]/ul,0,u[2]/ul];
  v=[f[1]*u[2]-f[2]*u[1],f[2]*u[0]-f[0]*u[2],f[0]*u[1]-f[1]*u[0]];
 }
 const n=r>2?9:6,bag=dir?-.6:.45,rip=elapsed*9+x;
 const at=(i,j)=>{const a=i/n*2-1,b=j/n*2-1,c=(a+b)/2,e=(a-b)/2; // turned 45 degrees: diamonds, corners at the four weights
  const d=(a*a+b*b)/2-.5,w=.06*r*Math.sin(rip+a*3)*Math.cos(rip*.8+b*3);
  return [x+(u[0]*c+v[0]*e)*r*1.2-f[0]*(bag*r*d+w),y+(u[1]*c+v[1]*e)*r*1.2-(dir?f[1]:1)*(bag*r*d+w),z+(u[2]*c+v[2]*e)*r*1.2-f[2]*(bag*r*d+w)];};
 const thin=.008+.005*r;
 for(let i=0;i<=n;i++)for(let j=0;j<n;j++){
  const edge=i===0||i===n;
  ribbon(at(i,j),at(i,j+1),edge?thin*2.6:thin,rope);ribbon(at(j,i),at(j+1,i),edge?thin*2.6:thin,rope);
 }
 if(r<2.5)for(let i=1;i<n;i++)for(let j=1;j<n;j++){const k=at(i,j),q=thin*1.6;M.ball.add(k[0],k[1],k[2],0,q,q,q,knot);}
 for(const [i,j] of [[0,0],[0,n],[n,0],[n,n]]){const c=at(i,j),q=.08+.04*r;M.ball.add(c[0],c[1],c[2],0,q,q*1.3,q,lead,-1);}
}
// Snared: the mesh is pulled tight around the bird's body (the wings are pinned inside it, see renderBird),
// bunched up under the belly, with the weighted corners hanging below on short lines that trail behind.
function drawSnare(){
 const b=bird,t=elapsed,M_=11,L_=7,v=forwardSpeed();
 const P=(i,k)=>{
  const lon=i/M_*tau,lat=-1.25+2.5*k/(L_-1),bulge=1+.07*Math.sin(lon*4+k*2+t*7)+.05*Math.sin(t*13+i);
  return birdPoint([Math.cos(lat)*Math.cos(lon)*.34*bulge,.11+Math.sin(lat)*.27*bulge+(lat<0?-.06*Math.cos(lon)**2:0),-.2+Math.cos(lat)*Math.sin(lon)*.86*bulge]);
 };
 for(let i=0;i<M_;i++)for(let k=0;k<L_;k++){
  const p=P(i,k);
  if(k<L_-1)ribbon(p,P(i,k+1),.0065,snareRope);
  ribbon(p,P((i+1)%M_,k),.0065,snareRope);
  if(camView!==2||crash)M.ball.add(p[0],p[1],p[2],0,.011,.011,.011,knot);
 }
 // Four lines from the bottom of the bag down to the weights, swinging and dragged back by the airflow.
 const back=[-Math.sin(b.angle),0,-Math.cos(b.angle)];
 for(let n=0;n<4;n++){
  const top=P(n*3%M_,0),len=.32+.1*(n%2),swing=.12*Math.sin(t*5+n*1.7),drag=clamp(v/30,.2,1)*.5;
  const end=[top[0]+back[0]*len*drag+Math.cos(b.angle)*swing,top[1]-len*(1-.4*drag),top[2]+back[2]*len*drag-Math.sin(b.angle)*swing];
  ribbon(top,end,.008,snareRope);M.ball.add(end[0],end[1],end[2],0,.03,.04,.03,lead,-1);
 }
}
function drawThreats(){
 let danger=false;
 for(const o of thrown){
  if(o.windup>0){const m=point([o.x,o.y+1.3,o.z]);if(!m)continue;
   ctx.fillStyle='#fff4ab';ctx.strokeStyle='#792c51';ctx.lineWidth=3;ctx.beginPath();ctx.arc(...m,8,0,tau);ctx.fill();ctx.stroke();
   ctx.fillStyle='#722347';ctx.textAlign='center';ctx.font='bold 13px system-ui';ctx.fillText('!',m[0],m[1]+4.5);}
  else{ // a red ring follows everything that is in the air
   const far=Math.hypot(o.x-bird.x,o.y-bird.y,o.z-bird.z),m=far<70&&point([o.x,o.y,o.z]);if(far<10)danger=true;
   if(m){ctx.beginPath();ctx.arc(m[0],m[1],o.kind==='shell'||o.kind==='bignet'?16:10,0,tau);ctx.lineWidth=4;ctx.strokeStyle='#0b0e14aa';ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#ff5d4f';ctx.stroke();}
  }
 }
 for(const t of tanks){ // tanks show how much more they can take, and flash while they aim
  if(t.hp<=0)continue;const m=point([t.x,5,t.z]);if(!m||Math.hypot(t.x-bird.x,t.z-bird.z)>170)continue;
  ctx.fillStyle='#0b0e14cc';ctx.fillRect(m[0]-22,m[1]-4,44,7);ctx.fillStyle='#ff5d4f';ctx.fillRect(m[0]-21,m[1]-3,42*t.hp/14,5);
  if(t.aim>0&&Math.sin(elapsed*22)>0)text('SIKTAR',m[0],m[1]-10,13,'#ff8a7a','center',900);
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
 drawFrame([...statics,...M.people,M.umbrella,M.car,M.hatch,M.cab,M.bus,M.tank,M.turret,M.box,M.balloon,M.boat,dyn,omen,goo],[...statics,...moving,dyn,goo],decals);
 ctx.clearRect(0,0,width,height);
 if(!crash&&state!=='menu'){
  drawThreats();
  // Gold stars mark the targets that are worth going out of your way for.
  const star=(x,y,z)=>{const far=Math.hypot(x-bird.x,z-bird.z);if(far>150)return;const m=point([x,y,z]);if(m)text('★',m[0],m[1],14+7*clamp(1-far/90,0,1),'#ffd24a');};
  for(const h of people)if((h.star||h.base>=60)&&!scored.has(h.id))star(h.x,h.y+2.9,h.z);
  for(const c of cars)if((c.cab||c.bus)&&!wrecks.has(c.id))star(c.x,c.bus?4.2:2.7,c.z);
  for(const q of balloons())if(!scored.has(q.id))star(q.x,q.y+15,q.z);
  for(let i=Math.floor(bird.x/tile)-3;i<=Math.floor(bird.x/tile)+3;i++)for(let j=Math.floor(bird.z/tile)-3;j<=Math.floor(bird.z/tile)+3;j++){
   const b=block(i,j);if(b.statue&&!scored.has('st'+b.key))star(b.statue[0],6.7,b.statue[1]);
  }
  const R=hitRadius(bird.y-aim[1])*(bird.spread||1);
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
  if(tank<.995||emptyTank){ // how much is left, right under the bird where the eyes already are
   const m=point([bird.x,bird.y-.9,bird.z]);
   if(m){const wide=64,x=m[0]-wide/2,y=Math.min(height-30,m[1]+14);
    ctx.fillStyle='#0b0e14cc';ctx.beginPath();(ctx.roundRect||ctx.rect).call(ctx,x-2,y-2,wide+4,10,5);ctx.fill();
    ctx.fillStyle=tank<.3||emptyTank?'#ffd24a':'#f4f1e6';ctx.beginPath();(ctx.roundRect||ctx.rect).call(ctx,x,y,Math.max(3,wide*tank),6,3);ctx.fill();}
  }
  // Streaks at the edges of the picture sell the speed of a dive.
  // Fast level flight (speed carried out of a dive) keeps a few thinner lines going.
  const airspeed=Math.hypot(forwardSpeed(),bird.vy),rush=Math.max(bird.fold*clamp((airspeed-12)/36,0,1),.5*clamp((airspeed-22)/20,0,1));
  if(rush>.12){
   ctx.save();ctx.translate(width/2,height*.43);ctx.strokeStyle='#fff';ctx.lineCap='round';const reach=Math.hypot(width,height)/2;
   for(let i=0;i<36;i++){
    const a=i*tau/36+hash(i,4,1),f=(elapsed*(2.6+2*rush)+hash(i,2,5))%1,r0=reach*(.42+.5*f),r1=r0+reach*.2*rush;
    ctx.globalAlpha=.5*rush*(1-f);ctx.lineWidth=1.5+2*hash(i,6,3);ctx.beginPath();ctx.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);ctx.lineTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.stroke();
   }
   ctx.restore();
  }
 }
 // HUD
 const lo=thresholds[wanted-1]||0,hi=thresholds[wanted],fill=wanted===maxWanted?100:Math.round(100*(points-lo)/(hi-lo));
 const meter=$('meter');if(meter.getAttribute('aria-valuenow')!==String(fill)){
  meter.setAttribute('aria-valuenow',String(fill));$('meter-fill').style.width=fill+'%';
 }
 hud('meter-label',wanted===maxWanted?'MAXKAOS':'KAOS '+number(points)+' / '+number(hi));
 hud('stars','★'.repeat(wanted)+'☆'.repeat(maxWanted-wanted));hud('points',number(points));
 const level=Math.round(tank*100)+'%',bar=$('tank-fill');if(bar.style.width!==level)bar.style.width=level;
 $('reserve').classList.toggle('low',tank<.3||emptyTank);hud('tank-label',emptyTank?'SLUT PÅ BAJS':'BAJS');
 for(const [i,el] of [...$('feathers').children].entries())el.classList.toggle('lost',i>=feathers);
 if(wanted){hud('time',Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0'));hud('time-label','JAKT PÅGÅR');}
 else{hud('time',String(Math.max(0,Math.ceil(60-elapsed))));hud('time-label','SEKUNDER KVAR');}
 $('clock').classList.toggle('hurry',!wanted&&elapsed>50&&playing);
 const diving=bird.fold>.5||bird.vy<-14,low=bird.y<14,stall=!diving&&!low&&bird.climb>.9;
 hud('chip',diving&&low?'×4 LÅGT STÖRTDYK':diving?'×2 STÖRTDYK':low?'×2 LÅGFLYG':stall?'NÄRA STALL':'');
 $('chip').classList.toggle('warn',stall);
 // Sound and mood that follow the frame.
 windLevel();
 if(sound){whistle(playing?bird.fold*clamp((Math.hypot(forwardSpeed(),bird.vy)-14)/38,0,1):0);sprayVoice(playing&&elapsed-lastDrop<.09);dread(playing&&hawk?hawk.dread:0);ambience(playing,dt);carEngines(playing);
  // The nearest ringing car alarm: horn on, horn off, quieter and duller with distance.
  let horn=0;
  if(playing)for(const c of cars){const since=elapsed-(alarms.get(c.id)??-99);
   if(since<9&&since%.9<.5){const near=clamp(1-Math.hypot(c.x-bird.x,bird.y,c.z-bird.z)/95,0,1);horn=Math.max(horn,.055*near*near*near);}}
  alarmHorn(horn);}
 const fear=playing&&hawk?hawk.dread*(.8+.2*Math.sin(elapsed*9)):0,veil=$('dread');
 if(Math.abs(fear-(+veil.style.opacity||0))>.01)veil.style.opacity=fear.toFixed(2);
}
