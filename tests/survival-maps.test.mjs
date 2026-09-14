import assert from 'node:assert/strict';
import {SURVIVAL_MAPS,survivalLayout,survivalTerrain,survivalPlayable} from '../engine/survival-maps.js';
for(const meta of SURVIVAL_MAPS){
 const started=performance.now(),l=survivalLayout(meta.id),height=(x,z)=>survivalTerrain(meta.id,x,z);
 assert.equal(l.spawns.length,51);assert.equal(l.loot.length,300);assert.ok(l.buildings.length+l.rocks.length+l.routeCover.length+(l.interiorCover?.length||0)<=(meta.id==='metro'?490:meta.id==='urban'?330:250));assert.equal(l.pois.length,9);
 const blocked=(x,z,r=.8)=>[...l.buildings,...l.rocks,...l.routeCover,...(l.interiorCover||[])].some(([px,pz,w,d])=>Math.abs(x-px)<w/2+r&&Math.abs(z-pz)<d/2+r);
 for(const [i,p] of l.spawns.entries()){
  assert.ok(survivalPlayable(meta.id,...p,30));assert.ok(height(...p)>2);assert.ok(!blocked(...p,2));
  for(let j=0;j<i;j++)assert.ok(Math.hypot(p[0]-l.spawns[j][0],p[1]-l.spawns[j][1])>=79);
  assert.ok(l.loot.some(c=>Math.hypot(p[0]-c.x,p[1]-c.z)<14),'spawn cache within 14 m');
 }
 for(const p of l.loot){assert.ok(height(p.x,p.z)>1.5);assert.ok(!blocked(p.x,p.z,1.1));}
 let maxRoadSlope=0;
 for(const road of l.roads)for(let j=1;j<road.length;j++){
  const a=road[j-1],b=road[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(length/2);let last=height(...a);
  for(let i=1;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n,h=height(x,z);maxRoadSlope=Math.max(maxRoadSlope,Math.abs(h-last)/(length/n));assert.ok(h>1.5,'all road centerlines dry');assert.ok(!blocked(x,z,1),'road centerline clear');last=h;}
 }
 assert.ok(maxRoadSlope<.9,`road slope ${maxRoadSlope}`);
 // Flood fill a 4 m movement lattice, with the same 0.9 maximum climb as conquest AI.
 const step=4,n=259,origin=-516,walk=new Uint8Array(n*n),heights=new Float32Array(n*n),seen=new Uint8Array(n*n),queue=new Int32Array(n*n);
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const wx=origin+x*step,wz=origin+z*step,index=z*n+x;heights[index]=height(wx,wz);walk[index]=!blocked(wx,wz,1)&&heights[index]>1.1;}
 const indexFor=(x,z)=>Math.round((z-origin)/step)*n+Math.round((x-origin)/step);
 const start=indexFor(...l.spawn);assert.ok(walk[start]);seen[start]=1;queue[0]=start;let tail=1;
 for(let head=0;head<tail;head++){const current=queue[head],x=current%n,z=Math.floor(current/n);for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,nz=z+dz,next=nz*n+nx;if(nx<0||nz<0||nx>=n||nz>=n||!walk[next]||seen[next]||Math.abs(heights[next]-heights[current])>step*.9)continue;seen[next]=1;queue[tail++]=next;}}
 const reachable=(x,z)=>{const i=indexFor(x,z);return seen[i]||seen[i-1]||seen[i+1]||seen[i-n]||seen[i+n];};
 for(const p of l.spawns)assert.ok(reachable(...p),'all 51 spawns in same dry movement component');
 for(const p of [...l.loot,...l.stations])assert.ok(reachable(p.x,p.z),`reachable item/station ${p.id}`);
 let min=Infinity,max=-Infinity;for(const h of heights){min=Math.min(min,h);max=Math.max(max,h);}
 console.log(meta.id,JSON.stringify({spawns:l.spawns.length,loot:l.loot.length,colliders:l.buildings.length+l.rocks.length+l.routeCover.length,reachableCells:tail,terrainRange:[min,max],maxRoadSlope,elapsedMs:Math.round(performance.now()-started)}));
}
assert.notDeepEqual(survivalLayout('tidal').roads,survivalLayout('uplink').roads);
assert.notDeepEqual(survivalLayout('tidal').spawns,survivalLayout('uplink').spawns);
console.log('Four distinct deterministic maps: all route, spawn and cache checks passed.');

assert.notDeepEqual(survivalLayout('urban').roads,survivalLayout('tidal').roads);

assert.notDeepEqual(survivalLayout('metro').roads,survivalLayout('urban').roads);
