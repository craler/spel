'use strict';
// A small WebGL2 renderer with no dependencies: instanced lit meshes, one sun shadow map,
// and procedural shaders for the ground, the building facades and the sky.
const glCanvas=$('world'), gl=glCanvas.getContext('webgl2',{antialias:smoothEdges,alpha:false,powerPreference:'high-performance'});
if(!gl)$('brief').textContent='Din webbläsare saknar WebGL 2, som spelet behöver.';
const colorCache=new Map();
// '#rrggbb' or 'hsl(h s% l%)' to linear RGB.
function rgb(str){
 let c=colorCache.get(str);if(c)return c;
 if(str[0]==='#'){const n=parseInt(str.slice(1,7),16);c=[n>>16&255,n>>8&255,n&255].map(v=>(v/255)**2.2);}
 else{const [h,s,l]=str.match(/[\d.]+/g).map(Number),a=s/100*Math.min(l/100,1-l/100);
  c=[0,8,4].map(n=>{const k=(n+h/30)%12;return (l/100-a*Math.max(-1,Math.min(k-3,9-k,1)))**2.2;});}
 colorCache.set(str,c);return c;
}
const LIGHT=`
uniform vec3 uSun,uSunCol,uSkyCol,uGroundCol,uFogCol,uEye;uniform float uFogD,uTime,uFast,uTexel;
uniform highp sampler2DShadow uShadow;uniform mat4 uLight;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float shadow(vec3 wp,vec3 n){
 vec4 lp=uLight*vec4(wp+n*.12,1.);vec3 c=lp.xyz*.5+.5;
 if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.)return 1.;
 if(uFast>.5)return texture(uShadow,vec3(c.xy,c.z-.0009)); // fast: one sample
 float s=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=texture(uShadow,vec3(c.xy+vec2(x,y)*uTexel,c.z-.0006));
 return s/9.;
}
vec3 fogged(vec3 c,vec3 wp){float d=length((uEye-wp)*vec3(1.,.35,1.))*uFogD; // haze thickens with ground distance, not altitude
 return mix(c,uFogCol,1.-exp(-d*d));}
vec3 lit(vec3 alb,vec3 n,vec3 wp,float spec){
 float sh=shadow(wp,n);
 if(uFast<.5)sh*=mix(1.,.5,smoothstep(.52,.74,vnoise(wp.xz*.011+uTime*.012))); // drifting cloud shadows
 float d=max(dot(n,uSun),0.)*sh;
 vec3 c=alb*(mix(uGroundCol,uSkyCol,n.y*.5+.5)+uSunCol*d);
 vec3 h=normalize(normalize(uEye-wp)+uSun);
 c+=uSunCol*spec*pow(max(dot(n,h),1e-4),60.)*sh;
 return c;
}
vec3 tone(vec3 c){c=1.-exp(-max(c,0.)*1.25);return pow(max(c,vec3(1e-5)),vec3(1./2.2));} // pow(0,y) is undefined on some GPUs and showed up as black
`;
const VS=`#version 300 es
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNor;layout(location=2) in vec4 aCol;layout(location=3) in vec2 aAux;
layout(location=4) in vec4 iPos;layout(location=5) in vec3 iScale;layout(location=6) in vec4 iCol;layout(location=7) in vec4 iAnim;
uniform mat4 uVP;
out vec3 vW,vN,vL,vS;out vec4 vC;flat out float vSeed;
vec3 rotX(vec3 p,float a){float s=sin(a),c=cos(a);return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}
void main(){
 vec3 p=aPos*iScale,n=aNor;float part=aAux.x;
 if(part>.5){ // limbs swing around their own pivot height
  float a=((part<1.5||part>3.5)?1.:-1.)*sin(iAnim.x)*iAnim.y;
  if(part>2.5)a=a*.8-2.7*iAnim.w;
  p.y-=aAux.y;p=rotX(p,a);n=rotX(n,a);p.y+=aAux.y;
 }
 if(iAnim.z!=0.){p=rotX(p,iAnim.z);n=rotX(n,iAnim.z);}
 float s=sin(iPos.w),c=cos(iPos.w);
 vW=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c)+iPos.xyz;
 vN=vec3(n.x*c+n.z*s,n.y,-n.x*s+n.z*c);
 vL=aPos*iScale;vS=iScale;vSeed=iAnim.x;
 vC=vec4(aCol.a>.5?iCol.rgb*aCol.rgb:aCol.rgb,iCol.a);
 gl_Position=uVP*vec4(vW,1.);
}`;
const FS=`#version 300 es
precision highp float;
in vec3 vW,vN,vL,vS;in vec4 vC;flat in float vSeed;out vec4 o;uniform float uGlow;
${LIGHT}
vec3 facade(vec3 base,vec3 lp,vec3 n,vec3 size,float seed,out float spec,out vec3 em){
 spec=0.;em=vec3(0);
 if(n.y>.5){vec2 e=min(lp.xz,size.xz-lp.xz);
  return min(e.x,e.y)<.32?base*.5:vec3(.17,.17,.18)*(uFast>.5?1.:.8+.4*vnoise(lp.xz*1.7+seed*40.));}
 bool sideX=abs(n.x)>.5;float u=sideX?lp.z:lp.x,w=sideX?size.z:size.x,y=lp.y;
 if(fract(seed*17.)<.2){ // glass curtain wall
  vec2 g=vec2(fract(u/1.7),fract(y/3.1));spec=1.;
  if(g.x<.05||g.y<.07){spec=0.;return vec3(.2,.21,.22);}
  float r=h21(vec2(floor(u/1.7)+floor(n.x*3.+n.z*7.+.25)*17.,floor(y/3.1))+seed*53.);
  if(r>.8)em=vec3(1.,.72,.4)*(r-.6)*1.5*uGlow;
  return mix(vec3(.02,.05,.07),uSkyCol*.35,.35+.5*r);
 }
 float bay=2.3+fract(seed*7.)*.9,cnt=max(1.,floor((w-.9)/bay)),m=(w-cnt*bay)*.5;
 float fu=(u-m)/bay,fy=y/3.1;vec2 f=vec2(fract(fu),fract(fy));
 vec2 cell=vec2(floor(fu)+floor(n.x*3.+n.z*7.+.25)*17.,floor(fy));
 vec3 wall=base*(uFast>.5?1.:.86+.28*vnoise(vec2(u,y)*.8+seed*91.));
 wall*=1.-.3*step(1.,fy)*smoothstep(.05,.0,f.y);
 if(y>size.y-.75)return base*.58;
 if(u<m||u>w-m)return wall;
 bool shop=fy<1.;
 if(shop&&f.y>.88&&fract(seed*13.)<.6){ // a striped awning over the shop windows
  vec3 dye=.5+.5*cos(6.283*(seed*5.+vec3(0.,.33,.67)));
  return mix(vec3(.72,.7,.64),dye*.55+.06,step(.5,fract(u*1.3)));
 }
 vec2 lo=shop?vec2(.07,.13):vec2(.25,.27),hi=shop?vec2(.93,.86):vec2(.75,.81);
 if(f.x>lo.x&&f.x<hi.x&&f.y>lo.y&&f.y<hi.y){
  vec2 d=min(f-lo,hi-f)*vec2(bay,3.1);
  if(min(d.x,d.y)<.08||(!shop&&abs(f.x-.5)*bay<.035))return vec3(.62,.6,.56);
  float r=h21(cell+seed*53.);spec=1.;
  if(r>.72)em=vec3(1.,.66,.3)*(r-.5)*(shop?3.:2.)*uGlow;
  return mix(vec3(.012,.018,.03),uSkyCol*.22,.5+.5*h21(cell.yx+seed));
 }
 return shop?wall*.72:wall;
}
void main(){
 vec3 g=normalize(vN),n=dot(g,uEye-vW)<0.?-g:g,alb=vC.rgb,em=vec3(0);float spec=0.;
 if(vC.a>.5&&vC.a<1.5)alb=facade(vC.rgb,vL,g,vS,vSeed,spec,em);
 else if(vC.a>1.5){em=alb*1.6;alb=vec3(0);}
 else if(vC.a<-.5){spec=.8;}
 o=vec4(tone(fogged(lit(alb,n,vW,spec)+em,vW)),1.);
}`;
const DEPTH_FS=`#version 300 es
precision highp float;in vec3 vW,vN,vL,vS;in vec4 vC;flat in float vSeed;void main(){}`;
const GROUND_VS=`#version 300 es
layout(location=0) in vec2 aPos;uniform mat4 uVP;uniform vec3 uCentre;out vec3 vW;
void main(){vW=vec3(aPos.x*1700.+uCentre.x,0.,aPos.y*1700.+uCentre.z);gl_Position=uVP*vec4(vW,1.);}`;
const GROUND_FS=`#version 300 es
precision highp float;
in vec3 vW;out vec4 o;uniform sampler2D uCity;
${LIGHT}
void main(){
 vec2 p=vW.xz,cell=floor(p/42.),q=p-cell*42.;
 float type=floor(texture(uCity,(cell+.5)/64.).r*255.+.5);
 bool rx=q.x<5.||q.x>37.,rz=q.y<5.||q.y>37.;
 float n1=uFast>.5?.5:vnoise(p*3.),n2=vnoise(p*.31);vec3 c;float spec=0.;
 if(rx||rz){
  c=vec3(.038,.04,.045)*(.75+.3*n1+.3*n2);
  vec2 d=min(q,42.-q);
  if(rx!=rz){
   float across=rx?d.x:d.y,along=rx?p.y:p.x,into=rx?min(q.y-5.,37.-q.y):min(q.x-5.,37.-q.x);
   if(across<.1&&fract(along/6.)<.5&&into>4.)c=vec3(.5,.48,.4);
   if(into>.4&&into<2.9&&across<4.3&&fract((rx?p.x:p.y)/1.1)<.52)c=vec3(.55);
   if(abs(across-4.75)<.07)c=vec3(.3,.29,.27);
  }
 }else{
  vec2 e2=min(q-5.,37.-q);float e=min(e2.x,e2.y);
  vec3 grass=vec3(.05,.12,.022)*(.65+.5*n1)*(.75+.5*n2);
  vec3 gravel=vec3(.36,.3,.21)*(.75+.45*h21(floor(p*7.)));
  if(e<3.){
   vec2 t=fract(p/1.2);
   c=vec3(.3,.29,.27)*(.82+.26*h21(floor(p/1.2)))*mix(.7,1.,step(.035,t.x)*step(.035,t.y));
   if(e<.2)c=vec3(.4,.4,.38);
  }else if(type<.5){
   c=mix(grass,gravel*.8,smoothstep(.45,.6,vnoise(p*.22+7.)));
  }else if(type>2.5){ // canal street: brick quays, and a hole where the water shows through from below
   if(q.x>16.5&&q.x<25.5&&q.y>8.&&q.y<34.)discard;
   vec2 s=p*vec2(4.5,2.2);s.x+=.5*floor(s.y);vec2 t=fract(s);
   c=vec3(.2,.1,.075)*(.7+.5*h21(floor(s)))*mix(.6,1.,step(.08,t.x)*step(.12,t.y));
  }else if(type<1.5){
   vec2 r=q-21.;c=grass*1.15;
   if(min(abs(r.x-r.y),abs(r.x+r.y))<1.5||abs(length(r)-7.4)<1.||e<4.2)c=gravel;
  }else{
   vec2 s=p*2.4;s.x+=.5*floor(s.y);vec2 t=fract(s);
   c=vec3(.25,.235,.22)*(.7+.5*h21(floor(s)))*mix(.6,1.,step(.07,t.x)*step(.1,t.y));
   float ring=length(q-21.);if(abs(ring-4.)<.3||abs(ring-9.)<.2)c*=1.55;
  }
 }
 o=vec4(tone(fogged(lit(c,vec3(0,1,0),vW,spec),vW)),1.);
}`;
const WATER_VS=`#version 300 es
layout(location=0) in vec2 aPos;uniform mat4 uVP;uniform vec3 uCentre;out vec3 vW;
void main(){vW=vec3(aPos.x*1700.+uCentre.x,-2.6,aPos.y*1700.+uCentre.z);gl_Position=uVP*vec4(vW,1.);}`;
// Water: small moving waves bend the surface, which mirrors the sky more the flatter you look at it, with sun glints.
const WATER_FS=`#version 300 es
precision highp float;
in vec3 vW;out vec4 o;
${LIGHT}
float swell(vec2 q){return .6*vnoise(q*.55+vec2(uTime*.45,uTime*.25))+.3*vnoise(q*1.6-vec2(uTime*.6,uTime*.2))+.1*vnoise(q*4.4+uTime*.9);}
void main(){
 vec2 p=vW.xz;float h=swell(p),e=.3;
 vec3 n=normalize(vec3((h-swell(p+vec2(e,0.)))*1.5,1.,(h-swell(p+vec2(0.,e)))*1.5)),v=normalize(uEye-vW);
 float fres=pow(1.-max(dot(n,v),0.),3.),sh=shadow(vW,n);
 vec3 mirror=mix(uFogCol,uSkyCol*1.7,clamp(reflect(-v,n).y,0.,1.));
 vec3 c=mix(mix(vec3(.008,.04,.045),vec3(.03,.1,.085),h),mirror,.12+.8*fres)*(.4+.6*sh);
 c+=uSunCol*pow(max(dot(n,normalize(v+uSun)),1e-4),200.)*sh;
 o=vec4(tone(fogged(c,vW)),1.);
}`;
const SKY_VS=`#version 300 es
layout(location=0) in vec2 aPos;out vec2 vP;void main(){vP=aPos;gl_Position=vec4(aPos,1.,1.);}`;
const SKY_FS=`#version 300 es
precision highp float;
in vec2 vP;out vec4 o;uniform vec3 uR,uU,uF,uZenith;uniform vec2 uK;
${LIGHT}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){if(uFast>.5&&i>1){s+=a*.5*1.6;break;}s+=a*vnoise(p);p=p*2.03+17.;a*=.5;}return s;}
void main(){
 vec3 d=normalize(uF+uR*vP.x*uK.x+uU*(vP.y-.14)*uK.y);
 float t=clamp(d.y,1e-4,1.),s=max(dot(d,uSun),1e-4);
 vec3 c=mix(uFogCol,uZenith,pow(t,.55));
 c+=uSunCol*(.1*pow(s,6.)+.25*pow(s,60.)+6.*smoothstep(.9992,.9997,s));
 if(d.y>.015){
  float n=fbm(d.xz/(d.y+.12)*1.25+uTime*.006),cl=smoothstep(.4,.68,n)*smoothstep(.015,.16,d.y);
  if(uFast<.5)cl=max(cl,.65*smoothstep(.5,.72,fbm(d.xz/(d.y+.2)*3.1-uTime*.004+9.))*smoothstep(.04,.3,d.y)); // a higher, finer layer
  c=mix(c,mix(uFogCol*1.15,vec3(1.5,1.3,1.12),.35+.65*pow(s,3.))*(1.1-.45*smoothstep(.6,.85,n)),cl*.9);
 }
 o=vec4(tone(c),1.);
}`;
function program(vs,fs){
 const p=gl.createProgram();
 for(const [type,src] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
  const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));
  gl.attachShader(p,s);
 }
 gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(p));
 const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
 for(let i=0;i<n;i++){const name=gl.getActiveUniform(p,i).name;u[name]=gl.getUniformLocation(p,name);}
 return {p,u};
}
const progMesh=program(VS,FS), progDepth=program(VS,DEPTH_FS), progGround=program(GROUND_VS,GROUND_FS), progSky=program(SKY_VS,SKY_FS), progWater=program(WATER_VS,WATER_FS);
// ---- Geometry. Vertex: position 3, normal 3, colour 3, tint flag, limb id, limb pivot height.
const STRIDE=12, ISTRIDE=15;
class Mesh{
 constructor(){this.d=[];this.inst=new Float32Array(ISTRIDE*64);this.n=0;}
 v(p,n,c,t=0,part=0,piv=0){this.d.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],t,part,piv);}
 tri(a,b,c,col,t,part,piv){
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx],l=Math.hypot(...n)||1;n[0]/=l;n[1]/=l;n[2]/=l;
  this.v(a,n,col,t,part,piv);this.v(b,n,col,t,part,piv);this.v(c,n,col,t,part,piv);
 }
 quad(a,b,c,d,col,t,part,piv){this.tri(a,b,c,col,t,part,piv);this.tri(a,c,d,col,t,part,piv);}
 // Box with optional taper of the top face towards its centre.
 box(x0,y0,z0,x1,y1,z1,col,t=0,part=0,piv=0,taper=1){
  const cx=(x0+x1)/2,cz=(z0+z1)/2,tx=x=>cx+(x-cx)*taper,tz=z=>cz+(z-cz)*taper;
  const b=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],u=[[tx(x0),y1,tz(z0)],[tx(x1),y1,tz(z0)],[tx(x1),y1,tz(z1)],[tx(x0),y1,tz(z1)]];
  for(let i=0;i<4;i++){const j=(i+1)%4;this.quad(b[j],b[i],u[i],u[j],col,t,part,piv);} // outward normals
  this.quad(u[3],u[2],u[1],u[0],col,t,part,piv);this.quad(b[0],b[1],b[2],b[3],col,t,part,piv);
  return this;
 }
 // Smooth ellipsoid.
 ball(cx,cy,cz,rx,ry,rz,col,t=0,part=0,piv=0,seg=8,rings=5){
  const pt=(i,j)=>{const a=i*tau/seg,b=j*Math.PI/rings,s=Math.sin(b);
   const n=[s*Math.cos(a),Math.cos(b),s*Math.sin(a)];return [[cx+n[0]*rx,cy+n[1]*ry,cz+n[2]*rz],n];};
  for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){
   const q=[pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1)];
   for(const k of [0,1,2,0,2,3])this.v(q[k][0],q[k][1],col,t,part,piv);
  }
  return this;
 }
 // Smooth vertical cylinder or cone (r1 at the top).
 tube(cx,y0,y1,cz,r0,r1,col,t=0,part=0,piv=0,seg=8,cap=true){
  for(let i=0;i<seg;i++){
   const a=i*tau/seg,b=(i+1)*tau/seg,na=[Math.cos(a),0,Math.sin(a)],nb=[Math.cos(b),0,Math.sin(b)];
   const q=[[[cx+na[0]*r0,y0,cz+na[2]*r0],na],[[cx+nb[0]*r0,y0,cz+nb[2]*r0],nb],[[cx+nb[0]*r1,y1,cz+nb[2]*r1],nb],[[cx+na[0]*r1,y1,cz+na[2]*r1],na]];
   for(const k of [0,1,2,0,2,3])this.v(q[k][0],q[k][1],col,t,part,piv);
   if(cap&&r1>0)this.tri([cx,y1,cz],q[3][0],q[2][0],col,t,part,piv);
  }
  return this;
 }
 // A body lofted through cross-sections [z, yBottom, yTop, halfWidthBottom, halfWidthTop]: sides, top and end caps.
 loft(sec,col,t=0){
  const c=([z,y0,y1,wb,wt])=>[[-wb,y0,z],[wb,y0,z],[wt,y1,z],[-wt,y1,z]];
  for(let i=1;i<sec.length;i++){const a=c(sec[i-1]),b=c(sec[i]);
   this.quad(a[0],b[0],b[3],a[3],col,t);this.quad(a[1],a[2],b[2],b[1],col,t);this.quad(a[3],b[3],b[2],a[2],col,t);}
  for(const e of [c(sec[0]),c(sec.at(-1))])this.quad(e[0],e[1],e[2],e[3],col,t);
  return this;
 }
 // A wheel on a sideways axle, with a lighter hub on the outer face.
 wheel(x,y,z,r,w,out,tyre,hub){
  const n=10,p=(i,rad,dx)=>{const a=i*tau/n;return [x+dx,y+rad*Math.sin(a),z+rad*Math.cos(a)];};
  for(let i=0;i<n;i++){
   this.quad(p(i,r,-w/2),p(i+1,r,-w/2),p(i+1,r,w/2),p(i,r,w/2),tyre);
   this.quad(p(i,r,out*w/2),p(i+1,r,out*w/2),p(i+1,r*.55,out*w/2),p(i,r*.55,out*w/2),tyre);
   this.tri([x+out*(w/2+.01),y,z],p(i,r*.55,out*(w/2+.01)),p(i+1,r*.55,out*(w/2+.01)),hub);
  }
  return this;
 }
 // A square beam between two points.
 beam(a,b,r,col,t=0){
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],up=Math.abs(d[1])>Math.hypot(d[0],d[2])?[1,0,0]:[0,1,0];
  let u=[d[1]*up[2]-d[2]*up[1],d[2]*up[0]-d[0]*up[2],d[0]*up[1]-d[1]*up[0]],l=Math.hypot(...u);u=u.map(v=>v/l*r);
  let v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];l=Math.hypot(...v);v=v.map(n=>n/l*r);
  const ring=o=>[[1,1],[1,-1],[-1,-1],[-1,1]].map(([i,j])=>[o[0]+u[0]*i+v[0]*j,o[1]+u[1]*i+v[1]*j,o[2]+u[2]*i+v[2]*j]),p=ring(a),q=ring(b);
  for(let i=0;i<4;i++){const j=(i+1)%4;this.quad(p[i],p[j],q[j],q[i],col,t);}
  this.quad(q[0],q[1],q[2],q[3],col,t);this.quad(p[0],p[1],p[2],p[3],col,t);return this;
 }
 build(){
  this.count=this.d.length/STRIDE;this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  this.vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.d),gl.STATIC_DRAW);this.d=null;
  attribs([[0,3,0],[1,3,3],[2,4,6],[3,2,10]],STRIDE,0);
  this.ibo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.ibo);
  attribs([[4,4,0],[5,3,4],[6,4,7],[7,4,11]],ISTRIDE,1);
  gl.bindVertexArray(null);return this;
 }
 clear(){this.n=0;this.near=undefined;}
 // One instance: position, yaw, scale, colour, material (0 lit, 1 facade, 2 glowing, -1 glossy), four animation values.
 add(x,y,z,yaw=0,sx=1,sy=1,sz=1,col=WHITE,mat=0,a0=0,a1=0,a2=0,a3=0){
  if((this.n+1)*ISTRIDE>this.inst.length){const g=new Float32Array(this.inst.length*2);g.set(this.inst);this.inst=g;}
  this.inst.set([x,y,z,yaw,sx,sy,sz,col[0],col[1],col[2],mat,a0,a1,a2,a3],this.n++*ISTRIDE);
 }
 upload(){gl.bindBuffer(gl.ARRAY_BUFFER,this.ibo);gl.bufferData(gl.ARRAY_BUFFER,this.inst.subarray(0,this.n*ISTRIDE),gl.DYNAMIC_DRAW);}
 draw(){if(!this.n)return;gl.bindVertexArray(this.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,this.count,this.n);}
 drawShadow(){const k=this.near??this.n;if(!k)return;gl.bindVertexArray(this.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,this.count,k);}
}
const WHITE=[1,1,1];
function attribs(list,stride,divisor){
 for(const [loc,size,offset] of list){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride*4,offset*4);gl.vertexAttribDivisor(loc,divisor);}
}
// Triangles rebuilt every frame (the bird, the hawk, the spray ribbon). Instance attributes stay at their constants.
// mat is the material for the whole batch: 0 matt, -1 wet and glossy.
function triBatch(mat=0){
 const b={data:new Float32Array(STRIDE*3*2048),n:0,vao:gl.createVertexArray(),vbo:gl.createBuffer(),
  // A triangle with its own normal and colour at every corner, for smooth shading.
  smooth(p,nrm,col){
   if((this.n+3)*STRIDE>this.data.length){const g=new Float32Array(this.data.length*2);g.set(this.data);this.data=g;}
   for(let k=0;k<3;k++){const a=p[k],n=nrm[k],c=col[k];this.data.set([a[0],a[1],a[2],n[0],n[1],n[2],c[0],c[1],c[2],0,0,0],this.n++*STRIDE);}
  },
  tri(a,b,c,col){
   if((this.n+3)*STRIDE>this.data.length){const g=new Float32Array(this.data.length*2);g.set(this.data);this.data=g;}
   const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
   let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
   for(const p of [a,b,c]){this.data.set([p[0],p[1],p[2],nx,ny,nz,col[0],col[1],col[2],0,0,0],this.n++*STRIDE);}
  },
  fan(pts,col){for(let i=2;i<pts.length;i++)this.tri(pts[0],pts[i-1],pts[i],col);},
  upload(){gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,this.data.subarray(0,this.n*STRIDE),gl.DYNAMIC_DRAW);},
  draw(){if(!this.n)return;gl.bindVertexArray(this.vao);gl.vertexAttrib4f(4,0,0,0,0);gl.vertexAttrib3f(5,1,1,1);gl.vertexAttrib4f(6,1,1,1,mat);gl.vertexAttrib4f(7,0,0,0,0);gl.drawArrays(gl.TRIANGLES,0,this.n);}
 };
 gl.bindVertexArray(b.vao);gl.bindBuffer(gl.ARRAY_BUFFER,b.vbo);attribs([[0,3,0],[1,3,3],[2,4,6],[3,2,10]],STRIDE,0);gl.bindVertexArray(null);
 return b;
}
// dyn is drawn normally; omen only casts a shadow (the hawk's oversized silhouette).
const dyn=triBatch(), omen=triBatch(), goo=triBatch(-1);
// Fullscreen / ground quad.
const quadVao=gl.createVertexArray();gl.bindVertexArray(quadVao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);attribs([[0,2,0]],2,0);gl.bindVertexArray(null);
// Shadow map.
// Shadow map. Fast graphics use a quarter of the pixels.
let SHADOW=fast?1024:2048;const shadowTex=gl.createTexture(), shadowFbo=gl.createFramebuffer();
function shadowSize(n){SHADOW=n;gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,SHADOW,SHADOW,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);}
shadowSize(SHADOW);gl.bindTexture(gl.TEXTURE_2D,shadowTex);
for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE],[gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL]])gl.texParameteri(gl.TEXTURE_2D,k,v);
gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
// Block type table for the ground shader.
const cityTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,cityTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,CITY,CITY,0,gl.RED,gl.UNSIGNED_BYTE,cityType);
for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.REPEAT],[gl.TEXTURE_WRAP_T,gl.REPEAT]])gl.texParameteri(gl.TEXTURE_2D,k,v);
gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
// Times of day. Each flight gets the next one. The sun never drops below 30 degrees, so shadows stay readable.
const skies=[
 {name:'kvällssol',dir:[-.52,.6,.61],sun:[3.1,2.25,1.45],sky:[.3,.42,.66],ground:[.2,.17,.14],fog:[.78,.62,.48],zenith:[.14,.28,.62],fogD:.0058,glow:1},
 {name:'middag',dir:[.35,.86,.36],sun:[2.9,2.7,2.4],sky:[.4,.52,.78],ground:[.22,.2,.17],fog:[.62,.71,.82],zenith:[.1,.27,.68],fogD:.0044,glow:.2},
 {name:'morgon',dir:[.66,.52,-.54],sun:[2.5,2.15,1.9],sky:[.36,.44,.6],ground:[.17,.17,.18],fog:[.82,.77,.74],zenith:[.2,.36,.66],fogD:.0072,glow:.55},
 {name:'skymning',dir:[-.7,.5,-.5],sun:[2.6,1.45,.9],sky:[.22,.26,.5],ground:[.13,.1,.12],fog:[.7,.44,.42],zenith:[.09,.13,.38],fogD:.006,glow:1.7},
];
for(const s of skies){const l=Math.hypot(...s.dir);s.dir=s.dir.map(v=>v/l);}
let sky=skies[0];
function setSky(n){sky=skies[n%skies.length];}
const lightM=new Float32Array(16), viewM=new Float32Array(16);
function lightMatrix(cx,cy,cz){
 const R=125,D=260,L=sky.dir,rl=Math.hypot(L[2],L[0]),r=[L[2]/rl,0,-L[0]/rl];
 const u=[L[1]*r[2]-L[2]*r[1],L[2]*r[0]-L[0]*r[2],L[0]*r[1]-L[1]*r[0]];
 const texel=2*R/SHADOW,snap=(v)=>Math.round((cx*v[0]+cy*v[1]+cz*v[2])/texel)*texel;
 const sr=snap(r),su=snap(u),sl=cx*L[0]+cy*L[1]+cz*L[2];
 lightM.set([r[0]/R,u[0]/R,-L[0]/D,0, r[1]/R,u[1]/R,-L[1]/D,0, r[2]/R,u[2]/R,-L[2]/D,0, -sr/R,-su/R,sl/D,1]);
}
// View-projection that matches the 2D helpers cameraPoint() and screen() exactly.
function viewMatrix(){
 const {x,y,z,s,c,cp,sp}=camera,kx=2*scale/width,ky=2*scale/height,near=.4,far=2600,A=(far+near)/(far-near),B=-2*far*near/(far-near);
 const cr=camera.cr??1,sr=camera.sr??0,R=[c*cr+sp*s*sr,cp*sr,-s*cr+sp*c*sr],U=[sp*s*cr-c*sr,cp*cr,sp*c*cr+s*sr]; // right and up, turned by the roll
 const f=[cp*s,-sp,cp*c],rows=[[kx*R[0],kx*R[1],kx*R[2],0],[ky*U[0]+.14*f[0],ky*U[1]+.14*f[1],ky*U[2]+.14*f[2],0],[A*f[0],A*f[1],A*f[2],B],[f[0],f[1],f[2],0]];
 for(let r=0;r<4;r++){const [a,b,d,k]=rows[r];viewM[r]=a;viewM[4+r]=b;viewM[8+r]=d;viewM[12+r]=k-(a*x+b*y+d*z);}
}
function lightUniforms(prog){
 const u=prog.u;gl.useProgram(prog.p);
 gl.uniform3fv(u.uSun,sky.dir);if(u.uGlow)gl.uniform1f(u.uGlow,sky.glow);gl.uniform3fv(u.uSunCol,sky.sun);gl.uniform3fv(u.uSkyCol,sky.sky);gl.uniform3fv(u.uGroundCol,sky.ground);
 gl.uniform3fv(u.uFogCol,sky.fog);gl.uniform3f(u.uEye,camera.x,camera.y,camera.z);gl.uniform1f(u.uFogD,sky.fogD*(fast?1.35:1));if(u.uFast)gl.uniform1f(u.uFast,fast?1:0);if(u.uTexel)gl.uniform1f(u.uTexel,1/SHADOW);
 if(u.uVP)gl.uniformMatrix4fv(u.uVP,false,viewM);
 if(u.uLight)gl.uniformMatrix4fv(u.uLight,false,lightM);
 if(u.uShadow)gl.uniform1i(u.uShadow,0);
 if(u.uTime)gl.uniform1f(u.uTime,performance.now()/1000);
}
// Draws one frame. casters and scene are lists of Mesh (or dyn) objects that have been uploaded.
function drawFrame(casters,scene,decals){
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);
 lightMatrix(bird.x,12,bird.z);viewMatrix();
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,SHADOW,SHADOW);gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.useProgram(progDepth.p);gl.uniformMatrix4fv(progDepth.u.uVP,false,lightM);
 for(const m of casters)m.drawShadow?m.drawShadow():m.draw(); // statics: only the blocks the shadow map covers
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,cityTex);
 // Sky
 gl.depthMask(false);gl.disable(gl.DEPTH_TEST);lightUniforms(progSky);
 const {s,c,cp,sp}=camera,u=progSky.u;
 const cr=camera.cr??1,sr=camera.sr??0;gl.uniform3f(u.uR,c*cr+sp*s*sr,cp*sr,-s*cr+sp*c*sr);gl.uniform3f(u.uU,sp*s*cr-c*sr,cp*cr,sp*c*cr+s*sr);gl.uniform3f(u.uF,cp*s,-sp,cp*c);gl.uniform3fv(u.uZenith,sky.zenith);
 gl.uniform2f(u.uK,width/(2*scale),height/(2*scale));gl.uniform1f(u.uTime,performance.now()/1000);
 gl.bindVertexArray(quadVao);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
 // Ground
 lightUniforms(progGround);gl.uniform3f(progGround.u.uCentre,camera.x,0,camera.z);gl.uniform1i(progGround.u.uCity,1);
 gl.drawArrays(gl.TRIANGLES,0,6);
 lightUniforms(progWater);gl.uniform3f(progWater.u.uCentre,camera.x,0,camera.z);gl.drawArrays(gl.TRIANGLES,0,6); // seen only through the canal
 // Meshes, then flat decals pulled slightly towards the camera.
 lightUniforms(progMesh);
 for(const m of scene){
  // Buildings hide their inside faces, so a camera that ends up inside one sees straight through it.
  if(m.cull){gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);m.draw();gl.disable(gl.CULL_FACE);}else m.draw();
 }
 // Flat decals: pulled towards the camera, and not written to the depth buffer so they can overlap in order.
 gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-2,-2);gl.depthMask(false);
 for(const m of decals)m.draw();
 gl.depthMask(true);gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindVertexArray(null);
}
