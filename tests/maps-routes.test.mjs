import assert from 'node:assert/strict';
import {MAPS, terrain} from '../engine/model.js';
import {makeGame, at, T, PRESETS} from './combat-harness.mjs';

let seed=176153;
Math.random=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
const summaries=[];
assert.equal(MAPS.length,7);
assert.equal(new Set(MAPS.map(m=>m.id)).size,7);
function charge(g,point){
 Object.assign(g,{hp:40,energy:35,heat:60,dead:0,lastHit:-100,keys:{KeyE:true},wptHeld:false,wptProgress:0,moving:false,fire:false,reload:0,eyeHeight:1.72});
 at(g,point.x,point.z);
 for(let i=0;i<25;i++){g.time+=.05;g.updateWPT(.05);}
 assert(g.hp>40,`${g.map} ${point.id} WPT status ${g.wptState.status}`);
}
function canTravel(g,a,b){
 const p=new T.Vector3(a.x,g.ground(a.x,a.z),a.z),distance=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(distance/.45);
 for(let i=0;i<n;i++){
  const dx=(b.x-a.x)/n,dz=(b.z-a.z)/n,expectedX=p.x+dx,expectedZ=p.z+dz;
  g.move(p,dx,dz,.5);
  if(Math.abs(p.x-expectedX)>.0001||Math.abs(p.z-expectedZ)>.0001)return false;
  p.y=g.ground(p.x,p.z);
 }
 return true;
}
function reachable(g,from,targets){
 const step=2,low=-84,span=85,key=(x,z)=>z*span+x;
 const coords=(x,z)=>({x:low+x*step,z:low+z*step});
 const nearest=p=>({x:Math.round((p.x-low)/step),z:Math.round((p.z-low)/step)});
 const start=nearest(from),queue=[start],seen=new Set([key(start.x,start.z)]);
 for(let i=0;i<queue.length;i++){
  const a=queue[i],ap=coords(a.x,a.z);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const b={x:a.x+dx,z:a.z+dz};if(b.x<0||b.z<0||b.x>=span||b.z>=span||seen.has(key(b.x,b.z)))continue;
   if(!canTravel(g,ap,coords(b.x,b.z)))continue;
   seen.add(key(b.x,b.z));queue.push(b);
  }
 }
 for(const target of targets){
  const n=nearest(target);let found=false;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(seen.has(key(n.x+dx,n.z+dz))&&canTravel(g,coords(n.x+dx,n.z+dz),target))found=true;
  assert(found,`${g.map}: ${JSON.stringify(from)} cannot walk to ${JSON.stringify(target)}`);
 }
 return seen.size;
}
for(const map of MAPS){
 const g=makeGame(PRESETS[0],map.id);g.beam=()=>{};g.spark=()=>{};g.gunshot=()=>{};
 let min=Infinity,max=-Infinity,vertices=0;
 for(let x=-85;x<=85;x+=2)for(let z=-85;z<=85;z+=2){const y=terrain(map.id,x,z);assert(Number.isFinite(y));min=Math.min(min,y);max=Math.max(max,y);}
 assert(max-min>3,`${map.id} insufficient elevation ${max-min}`);
 g.world.traverse(o=>{const p=o.geometry?.attributes?.position;if(p){assert([...p.array].every(Number.isFinite));vertices+=p.count;}});
 assert(vertices>10000);
 assert.equal(g.objectives.length,3);
 assert(!g.blocked(g.player.x,g.player.z,.5,g.ground(g.player.x,g.player.z)+.1),`${map.id} player spawns inside block`);
 for(const actor of [...g.allies,...g.enemies])if(actor.kind!=='drone')assert(!g.blocked(actor.g.position.x,actor.g.position.z,.5),`${map.id} ${actor.team} ${actor.index} spawn blocked`);
 const base={...g.baseStation},objectives=g.objectives.map(o=>({id:o.id,x:o.x,z:o.z})),enemySpawn=g.enemies.find(e=>e.kind==='soldier').g.position.clone();
 const fingerprint=JSON.stringify({base:[base.x,base.z],objectives,blocks:g.blocks.map(b=>[b.x,b.z,b.w,b.d,b.top-b.bottom])});
 const accessible=reachable(g,base,[...objectives,{x:enemySpawn.x,z:enemySpawn.z}]);
 const ai=g.updateAI;g.updateAI=()=>{};g.enemies=[];g.allies=[];charge(g,base);
 for(const objective of g.objectives){
  at(g,objective.x,objective.z);g.keys={};g.wptHeld=false;g.fire=false;objective.owner='neutral';objective.progress=0;g.remaining=300;g.blue=0;g.red=0;
  for(let i=0;i<175;i++)g.update(.05);
  assert.equal(objective.owner,'blue',`${map.id} objective ${objective.id} cannot capture at center`);
  charge(g,objective);
 }
 g.dead=.01;g.keys={};g.update(.05);
 assert(Math.hypot(g.player.x-base.x,g.player.z-base.z)<.01,`${map.id} respawn differs from BASE`);
 assert(Math.abs(g.player.y-g.ground(g.player.x,g.player.z)-1.72)<.01);
 summaries.push({fingerprint});console.log('PASS '+map.id+': walking routes, capture, WPT, spawn, respawn and terrain');g.clearWorld();
}
assert.equal(new Set(summaries.map(s=>s.fingerprint)).size,7,'Map footprints repeat');
console.log('PASS: all seven distinct layouts, actual walking connectivity, capture, WPT and respawn.');
