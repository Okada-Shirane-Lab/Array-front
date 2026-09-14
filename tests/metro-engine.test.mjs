import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.argv[2]||fileURLToPath(new URL('..',import.meta.url));
const source=file=>import(pathToFileURL(`${root}/${file}`).href);
const [{SurvivalGame,survivalZone},{getSurvivalItem},{makeSurvivalShell,at,dispose,T,seeded}]=await Promise.all([source('engine/survival.js'),source('engine/survival-items.js'),source('tests/survival-harness.mjs')]);
const g=makeSurvivalShell(SurvivalGame,'metro');g.start(undefined,'bachelor',{mapId:'metro'});
assert.equal(g.map,'metro');assert.equal(g.enemies.length,50);assert.equal(g.state.remainingAlive,51);assert.equal(g.loot.length,300);assert.equal(g.layout.compounds.length,36);assert.equal(g.layout.interiorCover.length,120);assert.equal(g.layout.routeCover.length,150);assert.equal(g.state.enemyMarkers.length,0);
assert.equal(new Set(g.matchSpawnIndices).size,51);assert.equal(g.playerSpawnIndex,g.matchSpawnIndices[0]);assert.equal(new Set([g.playerSpawnIndex,...g.enemies.map(e=>e.spawnIndex)]).size,51);const previousSpawn=g.playerSpawnIndex;
const nav=g.survivalNav,seen=new Uint8Array(nav.nodes.length),queue=[g.navIndex(...g.layout.spawn)];assert(queue[0]>=0);seen[queue[0]]=1;for(let h=0;h<queue.length;h++)for(const n of nav.nodes[queue[h]].links)if(!seen[n]){seen[n]=1;queue.push(n);}
const connected=(x,z)=>{const i=g.navIndex(x,z);return i>=0&&seen[i];};
const eye=(x,z,dy=1.72)=>new T.Vector3(x,g.ground(x,z)+dy,z);
let portals=0;
for(const b of g.layout.compounds){
 assert(connected(b.x,b.z),`${b.id} interior nav`);assert(!g.blocked(b.x,b.z,.6),`${b.id} interior floor`);
 for(const [x,z] of b.entrances){
  const dx=b.axis==='ew'?Math.sign(x-b.x):0,dz=b.axis==='ns'?Math.sign(z-b.z):0;
  const outer=[x+dx*5,z+dz*5],inner=[x-dx*5,z-dz*5];
  assert(!g.blocked(x,z,.6),`${b.id} entrance blocked`);
  assert(g.walkableSegment(...outer,...inner,.6),`${b.id} entering not walkable`);
  assert(g.walkableSegment(...inner,...outer,.6),`${b.id} exiting not walkable`);
  assert(connected(...outer)&&connected(...inner),`${b.id} portal not nav-connected`);
  assert(g.line(eye(...outer),eye(...inner)),`${b.id} open entrance blocks beams`);
  for(const [a,end] of [[outer,inner],[inner,outer]]){
   at(g,...a);for(let step=0;step<40;step++){g.move(g.player,(end[0]-a[0])/40,(end[1]-a[1])/40);g.player.y=g.ground(g.player.x,g.player.z)+1.72;}
   assert(Math.hypot(g.player.x-end[0],g.player.z-end[1])<.001,`${b.id} physical portal movement fails ${a}`);
  }
  portals++;
 }
 const y=g.ground(b.x,b.z);
 assert(!g.line(new T.Vector3(b.x,y+1.72,b.z),new T.Vector3(b.x,y+b.facadeHeight+5,b.z)),`${b.id} roof leaks beams`);
 assert(!g.line(new T.Vector3(b.x-b.w/2-5,y+(b.h+b.facadeHeight)/2,b.z),new T.Vector3(b.x+b.w/2+5,y+(b.h+b.facadeHeight)/2,b.z)),`${b.id} upper volume leaks beams`);
 const wx=b.axis==='ns'?b.x-b.w/2:b.x,wz=b.axis==='ew'?b.z-b.d/2:b.z,dx=b.axis==='ns'?1:0,dz=b.axis==='ew'?1:0;
 assert(!g.line(eye(wx-dx*3,wz-dz*3),eye(wx+dx*3,wz+dz*3)),`${b.id} solid wall leaks beams`);
}
assert.equal(portals,72);
for(const [i,[x,z]] of g.layout.spawns.entries()){
 assert(!g.blocked(x,z,.6),`spawn ${i} blocked`);assert(connected(x,z),`spawn ${i} not nav-connected`);
 assert(Math.hypot(x,z)<survivalZone(0,'metro').radius,`spawn ${i} outside initial zone`);
 const starter=g.loot.filter(l=>l.spawnIndex===i);assert.equal(starter.length,2);
 for(const l of starter)assert(g.walkableSegment(x,z,l.x,l.z,.6),`starter ${i}/${l.starter} unreachable`);
}
const categories={};let indoors=0;
for(const l of g.loot){
 assert(!g.blocked(l.x,l.z,.6),`${l.id} blocked`);assert(connected(l.x,l.z),`${l.id} not nav-connected`);
 if(l.interior)indoors++;
 const item=getSurvivalItem(l.itemId);categories[item.category]=(categories[item.category]||0)+1;
}
assert.equal(indoors,108);for(const b of g.layout.compounds)assert.equal(g.loot.filter(l=>l.buildingId===b.id).length,3);
for(const c of ['elements','bits','beamCount','scope'])assert(categories[c]>=28,`${c} insufficient`);
let wptCount=0;const enemies=g.enemies;g.enemies=[];g.keys={KeyE:true};g.moving=false;g.time=10;
for(const station of g.stations){
 let pos=null;for(let i=0;i<24;i++){const a=i*Math.PI/12,x=station.x+4*Math.cos(a),z=station.z+4*Math.sin(a);if(!g.blocked(x,z,.6)&&connected(x,z)&&g.line(station.emitter,eye(x,z))){pos=[x,z];break;}}
 assert(pos,`${station.id} no reachable WPT point`);at(g,...pos);g.lastHit=-10;g.shield=10;g.energy=30;g.wptProgress=0;
 for(let i=0;i<12;i++)g.updateWPT(.1);assert(g.shield>10&&g.energy>30,`${station.id} does not charge`);assert.equal(g.wptState.status,'charging');wptCount++;
}
assert.equal(wptCount,9);g.enemies=enemies;
console.log(JSON.stringify({map:'metro',competitors:51,buildings:36,portals,connectedLoot:g.loot.length,interiorLoot:indoors,categories,wptCount,blocks:g.blocks.length,navConnectedNodes:queue.length,urbanDetails:g.urbanDetails}));
// A real update loop exercises AI/loot/storm/result together, including rooftops
// and new city navigation. Leave the player at spawn as an ordinary idle player.
g.start(undefined,'bachelor',{mapId:'metro'});assert.notEqual(g.playerSpawnIndex,previousSpawn,'restart must not repeat player start');const originalRandom=Math.random;Math.random=seeded(38741);let ticks=0;
try{while(g.mode==='playing'&&g.time<700){g.update(.1);ticks++;assert(Number.isFinite(g.player.x)&&Number.isFinite(g.player.y)&&Number.isFinite(g.player.z));for(const e of g.enemies)assert(Number.isFinite(e.g.position.x)&&Number.isFinite(e.g.position.y)&&Number.isFinite(e.g.position.z));}}
finally{Math.random=originalRandom;}
assert.equal(g.mode,'result','metro match never terminates');assert.equal(g.result.gameMode,'survival');assert.equal(g.result.mapId,'metro');assert(Object.isFrozen(g.result));assert(g.result.placement>=1&&g.result.placement<=51);g.emit();assert.deepEqual(g.state.enemyMarkers,[]);const result=g.result;g.update(10);assert.equal(g.result,result);
console.log(JSON.stringify({terminal:g.result.outcome,placement:g.result.placement,elapsed:g.result.elapsed,ticks,remainingAlive:g.state.remainingAlive}));dispose(g);
