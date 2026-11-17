'use strict';
// City layout. Every 42 m tile is one block: roads on the tile lines, a sidewalk ring, then the block itself.
// Block types: 0 houses, 1 park, 2 square. The type table repeats every 64 blocks and is also sent to the ground shader.
const CITY=64, cityType=new Uint8Array(CITY*CITY);
for(let j=0;j<CITY;j++)for(let i=0;i<CITY;i++){const h=hash(i,j,41);cityType[i+j*CITY]=(i&31)===5?3:h<.13?1:h<.27?2:0;} // one column of blocks in thirty-two is a canal street
const setType=(i,j,t)=>{cityType[(i&63)+(j&63)*CITY]=t;};
// The first thing the player sees: a park on the left, a square ahead on the right.
setType(0,0,0);setType(-1,0,1);setType(0,1,2);setType(-1,1,0);setType(0,-1,0);setType(-1,-1,0);
function blockType(i,j){return cityType[(i&63)+(j&63)*CITY];}
const wallPaint=['#a8483a','#c58a4e','#e2d2b0','#d4b07a','#9aa3a0','#c9c2b4','#8a4636','#b4c2ac','#d09a74','#ebe3d2','#7d8790','#c46a4a'];
const parkedPaint=['#2b3038','#c9ccd1','#7c2420','#27507a','#e9e6df','#5f7a4c','#8a8f96','#b98a2e'];
const parasolPaint=['#d4443c','#e8b23a','#2f7fa8','#3f9a6f','#e8e4da'];
const blockCache=new Map();
function block(i,j){
 const key=i+','+j;let b=blockCache.get(key);if(b)return b;
 const x=i*tile,z=j*tile,type=blockType(i,j),R=n=>hash(i,j,n);
 b={key,i,j,x,z,type,blds:[],trees:[],lamps:[],tables:[],stalls:[],benches:[],food:[],folk:[],parked:[],statue:null,cleaner:null};
 // Heights follow whole 3.1 m storeys so the window rows line up with the roof.
 const storeys=(n,lo,hi)=>3.1*(lo+Math.floor(R(n)*(hi-lo+1)))+.8;
 const add=(a,c,w,d,h,n)=>b.blds.push([x+a,z+c,w,d,h,Math.floor(R(n)*wallPaint.length),R(n+1)]);
 const food=(fx,fy,fz)=>b.food.push({id:key+':'+b.food.length,x:x+fx,y:fy,z:z+fz});
 if(type===0){
  const v=Math.floor(R(5)*6);
  if(v===0){add(10,10,11,10,storeys(3,1,8),30);add(24,22,9,12,storeys(6,2,12),32);
   b.trees.push([x+28,z+14,1+R(9)*.4,R(10)],[x+14,z+28,1.1+R(11)*.4,R(12)]);}
  else if(v===1){add(9,9,24,8,storeys(3,2,7),30);add(9,25,24,8,storeys(6,2,9),32);}
  else if(v===2){add(11,11,20,20,storeys(3,5,12),30);}
  else if(v===4){add(9,9,24,24,storeys(3,1,2),30);add(15,15,12,12,storeys(6,7,12),32);} // a tower on a podium
  else if(v===5){add(9,9,15,24,storeys(3,3,6),30);add(26,13,7,16,storeys(6,6,11),32);}
  else{add(9,9,10,10,storeys(3,1,6),30);add(23,9,10,10,storeys(6,2,9),32);add(9,23,10,10,storeys(7,2,10),34);add(23,23,10,10,storeys(8,1,5),36);}
  const tall=b.blds.find(q=>q[4]>18&&q[1]-z<12);
  if(tall&&R(160)<.6)b.cleaner=[tall[0]+tall[2]/2,tall[1]-.75,tall[4],R(161)*9];
  if(R(13)<.55)for(let n=0;n<4;n++){ // street trees along two sides
   b.trees.push([x+11+n*6.8,z+5.9,.62+R(14+n)*.2,R(18+n)],[x+5.9,z+11+n*6.8,.62+R(22+n)*.2,R(26+n)]);}
 }else if(type===1){
  for(let n=0;n<13;n++){const a=n*tau/13+R(50+n)*.3,r=10.5+R(70+n)*3.2;
   b.trees.push([x+21+Math.cos(a)*r,z+21+Math.sin(a)*r,1+R(90+n)*.8,R(110+n)]);}
  for(let n=0;n<4;n++){const a=n*tau/4+.6;b.benches.push([x+21+Math.cos(a)*7.4,z+21+Math.sin(a)*7.4,a+Math.PI/2]);}
  // Picnics on the lawn: the food sits low, so you have to skim the grass.
  for(let n=0;n<3;n++){const a=n*tau/3+R(40)*tau,fx=21+Math.cos(a)*3.8,fz=21+Math.sin(a)*3.8;food(fx,.75,fz);
   b.folk.push({x:x+fx+1.2,z:z+fz+.5,c:colors[n+1],base:15,label:'PICKNICK',shout:'MIN MACKA!'});}
 }else if(type===3){
  // Amsterdam-style: a row of narrow gabled houses on each side, a tree-lined quay, and the water in between.
  b.gables=[];
  for(let n=0;n<5;n++)for(const [side,a] of [[0,9],[1,27.5]]){
   const h=storeys(170+n*2+side,3,5),paint=Math.floor(R(180+n*2+side)*wallPaint.length);
   b.blds.push([x+a,z+8.5+n*5,5.5,5,h,paint,R(190+n*2+side)]);b.gables.push([x+a+2.75,z+11+n*5,h,R(200+n*2+side)]);
  }
  for(let n=0;n<4;n++)b.trees.push([x+15.4,z+11.5+n*6.4,.5+R(210+n)*.12,R(214+n)],[x+26.6,z+14+n*6.4,.5+R(218+n)*.12,R(222+n)]);
 }else if(type===2){
  b.statue=[x+21,z+21];b.blds.push([x+20.1,z+20.1,1.8,1.8,5.6,-1,0]); // the plinth is solid, drawn as a statue
  const spots=[[12,12],[30,12],[12,30],[30,30],[21,10.5],[21,31.5]];
  for(const [n,[sx,sz]] of spots.entries()){
   if(n<4){b.tables.push([x+sx,z+sz,Math.floor(R(60+n)*parasolPaint.length)]);food(sx,1.15,sz);
    b.folk.push({x:x+sx+1.15,z:z+sz+.3,c:colors[(n+2)%colors.length],base:15,label:'FIKAPAUS',shout:'MIN LATTE!'},{x:x+sx-1.1,z:z+sz-.4,c:colors[(n+5)%colors.length],base:15,label:'FIKAPAUS',shout:'MIN BULLE!'});}
   else{b.stalls.push([x+sx,z+sz,Math.floor(R(66+n)*parasolPaint.length)]);food(sx,1.35,sz+(n===4?1.3:-1.3));}
  }
  if(R(61)<.5||(i===0&&j===1)){ // a wedding party in front of the statue
   b.folk.push({x:x+20.3,z:z+16.2,c:'#f4f1ea',base:60,label:'BRÖLLOPSKAOS',shout:'MIN KLÄNNING!',bride:true},{x:x+21.6,z:z+16.2,c:'#1d2026',base:60,label:'BRÖLLOPSKAOS',shout:'MIN KOSTYM!'});
   for(let n=0;n<5;n++)b.folk.push({x:x+18.4+n*1.3,z:z+13.6-.5*(n%2),c:colors[(n*3)%colors.length],base:15,label:'BRÖLLOPSGÄST'});
  }
 }
 for(const [lx,lz] of [[5.5,5.5],[36.5,5.5],[5.5,36.5],[36.5,36.5]])b.lamps.push([x+lx,z+lz]);
 // Cars parked along two kerbs, facing the way the lane beside them runs.
 for(let n=0;n<4;n++){
  if(R(120+n)<.2)b.parked.push({x:x+12.5+n*5.6,z:z+3.9,yaw:j%2===0?Math.PI/2:-Math.PI/2,c:parkedPaint[Math.floor(R(130+n)*parkedPaint.length)]});
  if(R(140+n)<.2)b.parked.push({x:x+3.9,z:z+12.5+n*5.6,yaw:i%2===0?0:Math.PI,c:parkedPaint[Math.floor(R(150+n)*parkedPaint.length)]});
 }
 if(blockCache.size>=600)blockCache.delete(blockCache.keys().next().value);
 blockCache.set(key,b);return b;
}
function buildings(i,j){return block(i,j).blds;}
// The canal runs down the middle of its blocks, a storey below street level. The cross streets pass over it as bridges.
const WATER=-1.5;
function inCanal(x,z){
 const i=Math.floor(x/tile);if(blockType(i,Math.floor(z/tile))!==3)return false;
 const qx=x-i*tile,qz=wrap(z,tile);return qx>16.5&&qx<25.5&&qz>8&&qz<34;
}
function solid(x,y,z,r=0){
 if(y<=r+(y<1.5&&inCanal(x,z)?WATER:0))return true;
 return buildings(Math.floor(x/tile),Math.floor(z/tile)).some(([a,b,w,d,h])=>
 x>=a-r&&x<=a+w+r&&z>=b-r&&z<=b+d+r&&y<=h+r);
}
