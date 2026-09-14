import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const source=file=>import(pathToFileURL(`${root}/${file}`).href);
const [{SurvivalGame},{getSurvivalItem},{makeSurvivalShell,dispose,T}]=await Promise.all([source('engine/survival.js'),source('engine/survival-items.js'),source('tests/survival-harness.mjs')]);
const segmentDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
for(const map of ['tidal','uplink','urban','metro']){
 const started=performance.now(),g=makeSurvivalShell(SurvivalGame,map);g.start(undefined,undefined,{mapId:map});
 const categories={},rarities={},categoryRarities={};
 for(const l of g.loot){const item=getSurvivalItem(l.itemId);categories[item.category]=(categories[item.category]||0)+1;rarities[item.rarity]=(rarities[item.rarity]||0)+1;(categoryRarities[item.category]??={})[item.rarity]=(categoryRarities[item.category][item.rarity]||0)+1;assert(!g.blocked(l.x,l.z,.6),`${map} loot ${l.id} blocked`);}
 assert.equal(g.loot.length,300);assert.equal(g.lootCapacity,450);assert.equal(g.layout.routeCover.length,150);assert.equal(g.routeCoverMeshes.length,2);
 for(const cat of ['elements','bits','beamCount','scope'])assert(categories[cat]>=28,`${map} category ${cat} count ${categories[cat]}`);
 let minRoadShoulder=Infinity,occluded=0;
 const segments=g.layout.roads.flatMap(r=>r.slice(1).map((b,i)=>[r[i],b]));
 for(const kind of ['barrier','equipment']){
  const props=g.layout.routeCover.filter(p=>p[5]===kind),mesh=g.routeCoverMeshes.find(m=>m.count===props.length);
  for(const [i,[x,z,w,d,h]] of props.entries()){
   assert(g.blocked(x,z,.5),`${map} routeCover ${kind}/${i} fails movement collision`);
   const y=g.ground(x,z)+h*.6,a=new T.Vector3(x-w/2-1,y,z),b=new T.Vector3(x+w/2+1,y,z),ray=new T.Raycaster(a,b.clone().sub(a).normalize(),0,a.distanceTo(b));
   assert(ray.intersectObject(mesh,false).some(hit=>hit.instanceId===i),`${map} routeCover ${kind}/${i} fails beam occlusion`);occluded++;
   const shoulder=Math.min(...segments.map(([a,b])=>segmentDistance(x,z,a,b)))-Math.hypot(w,d)/2;minRoadShoulder=Math.min(minRoadShoulder,shoulder);assert(shoulder>=10,`${map} routeCover encroaches on 18 m road`);
  }
 }
 for(const [index,[x,z]] of g.layout.spawns.entries()){assert(!g.blocked(x,z,.6));const starter=g.loot.filter(l=>l.spawnIndex===index);assert.equal(starter.length,2);for(const l of starter)assert(g.walkableSegment(x,z,l.x,l.z,.6),`${map} starter ${index}/${l.starter}`);}
 for(const b of g.layout.compounds)for(const [x,z] of b.entrances)assert(!g.blocked(x,z,.6),`${map} entrance ${b.id}`);
 const nav=g.survivalNav,seen=new Uint8Array(nav.nodes.length),queue=[g.navIndex(...g.layout.spawn)];assert(queue[0]>=0);seen[queue[0]]=1;for(let head=0;head<queue.length;head++)for(const n of nav.nodes[queue[head]].links)if(!seen[n]){seen[n]=1;queue.push(n);}
 const connected=(x,z)=>{const i=g.navIndex(x,z);return i>=0&&seen[i];};
 for(const [i,[x,z]] of g.layout.spawns.entries())assert(connected(x,z),`${map} spawn ${i} lost navigation`);
 let navLoot=0;const navMiss=[];for(const l of g.loot){if(connected(l.x,l.z))navLoot++;else navMiss.push(l.id);}
 assert.equal(navLoot,300,`${map} unreachable loot: ${navMiss.join(', ')}`);
 let wptPositions=0;for(const station of g.stations){let usable=0;for(let n=0;n<24;n++){const a=n*Math.PI/12,x=station.x+4*Math.cos(a),z=station.z+4*Math.sin(a);if(!g.blocked(x,z,.6)&&g.line(station.emitter,new T.Vector3(x,g.ground(x,z)+1.72,z))&&connected(x,z))usable++;}assert(usable>0,`${map} WPT ${station.id} inaccessible`);wptPositions+=usable;}
 console.log(JSON.stringify({map,loot:g.loot.length,categories,categoryRarities,rarities,routeCover:g.layout.routeCover.length,coverDraws:g.routeCoverMeshes.length,occluded,minRoadShoulder,blocks:g.blocks.length,navigationConnectedSpawns:51,navigationConnectedLoot:navLoot,wptPositions,elapsedMs:Math.round(performance.now()-started)}));
 dispose(g);
}
