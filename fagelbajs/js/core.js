'use strict';
// Shared helpers and game state. The scripts are plain (non-module) files that share one global scope.
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), mix=(a,b,t)=>a+(b-a)*t, tau=2*Math.PI;
function hash(i,j,k){const n=Math.sin(i*127.1+j*311.7+k*74.7)*43758.5453;return n-Math.floor(n);}
function wrap(n,length){return ((n%length)+length)%length;}
const stickInput={x:0,y:0,on:false};
const keys=new Set(), gravity=16, tile=42;
const colors=['#c8443a','#2f6f9f','#e0b23a','#3d8f6f','#8a5ca8','#e8e4da','#30343c','#d97b3a'];
let state='menu', bird, elapsed=0, hits=0, drops=[], stains=[], scored=new Set(), cooldown=0, messageTime=0;
let camView=0, above=false, muted=false, sound, people=[], camera={}, wingPhase=0, width,height,scale;
let reversePitch=false, rig=null, crash=null, slowmo=0, shake=0;
// Graphics: 'auto' decides by itself, 'high' always looks its best, 'fast' is for weak computers.
// fast is what is in use right now. Edge smoothing can only be chosen when the page loads.
let quality='auto',autoFast=false;
try{quality=localStorage.getItem('fagelbajs.quality')||(localStorage.getItem('fagelbajs.low')==='yes'?'fast':'auto');autoFast=localStorage.getItem('fagelbajs.autoFast')==='yes';}catch{}
let fast=quality==='fast'||(quality==='auto'&&autoFast);
const smoothEdges=!fast;
// The test copy of the game (raw.githack.com, or run locally) shows things that are not live yet, keeps its high scores
// to itself and has a few testing tools. The live game is the same code on any other address.
const testSite=/githack|localhost|127\.0\.0\.1/.test(location.host);
try { reversePitch=localStorage.getItem('fagelbajs.upClimbs')==='yes'; } catch {}
