'use strict';
// Shared helpers and game state. The scripts are plain (non-module) files that share one global scope.
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), mix=(a,b,t)=>a+(b-a)*t, tau=2*Math.PI;
function hash(i,j,k){const n=Math.sin(i*127.1+j*311.7+k*74.7)*43758.5453;return n-Math.floor(n);}
function wrap(n,length){return ((n%length)+length)%length;}
const keys=new Set(), gravity=16, tile=42;
const colors=['#c8443a','#2f6f9f','#e0b23a','#3d8f6f','#8a5ca8','#e8e4da','#30343c','#d97b3a'];
let state='menu', bird, elapsed=0, hits=0, drops=[], stains=[], scored=new Set(), cooldown=0, messageTime=0;
let camView=0, above=false, muted=false, sound, people=[], camera={}, wingPhase=0, width,height,scale;
let reversePitch=false, rig=null, crash=null, slowmo=0, shake=0;
try { reversePitch=localStorage.getItem('fagelbajs.upClimbs')==='yes'; } catch {}
