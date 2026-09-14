import assert from 'node:assert/strict';
import {MAPS, terrain, playable} from '../engine/model.js';
import {makeGame, at, T, PRESETS} from './combat-harness.mjs';

let seed=819427;
Math.random=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
const requested=process.argv.slice(2);
const maps=requested.length?MAPS.filter(m=>requested.includes(m.id)):MAPS;
assert(maps.length>0);
let checks=0;
const ok=(condition,message)=>{assert(condition,message);checks++;};
function canTravel(g,a,b){
 const p=new T.Vector3(a.x,g.ground(a.x,a.z),a.z),distance=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(distance/.45));
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
  ok(found,`${g.map}: base cannot actually walk to ${JSON.stringify(target)}`);
 }
 return seen.size;
}
function charge(g,station,x=station.x,z=station.z){
 Object.assign(g,{hp:40,energy:35,heat:60,dead:0,lastHit:-100,keys:{KeyE:true},wptHeld:false,wptProgress:0,moving:false,fire:false,reload:0,eyeHeight:1.72});
 at(g,x,z);
 for(let i=0;i<25;i++){g.time+=.05;g.updateWPT(.05);}
 ok(g.hp>40,`${g.map} ${station.id} WPT failed at ${x},${z}: ${g.wptState.status}`);
}
for(const map of maps){
 const started=Date.now(),g=makeGame(PRESETS[0],map.id);g.beam=()=>{};g.spark=()=>{};g.gunshot=()=>{};
 ok(g.objectives.length===3,`${map.id} expected 3 objectives`);
 let min=Infinity,max=-Infinity;
 for(let x=-84;x<=84;x+=2)for(let z=-84;z<=84;z+=2)if(playable(map.id,x,z)){const h=terrain(map.id,x,z);ok(Number.isFinite(h),`${map.id} finite terrain`);min=Math.min(min,h);max=Math.max(max,h);}
 ok(max-min>3,`${map.id} insufficient playable elevation ${max-min}`);
 const stations=[g.baseStation,...g.objectives],army=[...g.allies,...g.enemies].filter(e=>e.kind!=='drone');
 for(const actor of army){
  const p=actor.g.position;ok(!g.blocked(p.x,p.z,.5),`${map.id} ${actor.team} spawn blocked`);
  const index=g.nearestNav(p.x,p.z);ok(index>=0,`${map.id} ${actor.team} spawn has no navigation node`);
  for(let j=0;j<3;j++)ok(g.navigation.fields[j][index]>=0,`${map.id} ${actor.team} cannot navigate to ${'ABC'[j]}`);
 }
 for(const objective of g.objectives){
  const walls=g.blocks.filter(b=>Math.hypot(b.x-objective.x,b.z-objective.z)<6.5 && Math.min(b.w,b.d)<.85);
  ok(walls.length>=2,`${map.id} ${objective.id} missing capture-circle cover`);
  const low=walls.filter(b=>b.top-b.bottom<1.5),high=walls.filter(b=>b.top-b.bottom>1.7);
  ok(low.length>0,`${map.id} ${objective.id} missing low cover`);ok(high.length>0,`${map.id} ${objective.id} missing high cover`);
  ok(!g.blocked(objective.x,objective.z,.75),`${map.id} ${objective.id} center blocked`);
  ok(g.nearestNav(objective.x,objective.z)>=0,`${map.id} ${objective.id} center cut off from navigation`);
  for(const b of walls){
   for(const dx of [-b.w,b.w])for(const dz of [-b.d,b.d])ok(Math.hypot(b.x+dx-objective.x,b.z+dz-objective.z)<6.5,`${map.id} ${objective.id} cover extends outside circle`);
   const nx=b.w<b.d?1:0,nz=b.w<b.d?0:1,side=Math.min(b.w,b.d)+.6,h=b.top-b.bottom<1.5?.7:1.6;
   const a=new T.Vector3(b.x-nx*side,b.bottom+h,b.z-nz*side),z=new T.Vector3(b.x+nx*side,b.bottom+h,b.z+nz*side);
   ok(!g.line(a,z),`${map.id} ${objective.id} wall is visually present but fails shot occlusion`);
   ok(g.blocked(b.x,b.z,.5),`${map.id} ${objective.id} wall fails movement collision`);
  }
 }
 const targetPoints=[...g.objectives,{x:g.layout.enemySpawn[0],z:g.layout.enemySpawn[1]}];
 const accessible=reachable(g,g.baseStation,targetPoints);
 g.enemies=[];g.allies=[];g.updateAI=()=>{};
 for(const o of g.objectives)o.owner='blue';
 for(const s of stations)charge(g,s);
 // Cover must still leave multiple unblocked interior healing positions.
 for(const s of g.objectives){let count=0;for(let i=0;i<16;i++){const a=i*Math.PI/8,x=s.x+Math.sin(a)*4.7,z=s.z+Math.cos(a)*4.7;if(g.blocked(x,z,.5))continue;const source=new T.Vector3(s.x,s.y+6.8,s.z),receiver=new T.Vector3(x,g.ground(x,z)+1.37,z);if(g.line(source,receiver))count++;}ok(count>=4,`${map.id} ${s.id}: insufficient free interior WPT positions (${count})`);}
 console.log(JSON.stringify({map:map.id,relief:+(max-min).toFixed(2),accessibleGridCells:accessible,cover:g.blocks.filter(b=>g.objectives.some(o=>Math.hypot(b.x-o.x,b.z-o.z)<6.5)).length,seconds:(Date.now()-started)/1000}));
 g.clearWorld();
}
console.log(`PASS ${checks} assertions across ${maps.length} maps: cover collision/LOS, walking + AI routes, safe spawns, elevation, WPT.`);
