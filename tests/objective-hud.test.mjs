import assert from 'node:assert/strict';
import {makeGame,quiet,T} from './combat-harness.mjs';
import {MAPS} from '../engine/maps.js';
let checked=0;
for (const map of MAPS) {
 const g=quiet(makeGame(undefined,map.id));
 for(const o of g.objectives){assert.equal(o.beacon.material.type,'MeshBasicMaterial');o.progress=100;o.owner='blue';}
 for(let frame=0;frame<6;frame++)g.update(1/60);
 g.emit();
 assert.equal(g.state.objectiveMarkers.length,3);
 assert.deepEqual(g.state.objectiveMarkers.map(o=>o.id),['A','B','C']);
 assert.deepEqual(g.state.objectiveMarkers.map(o=>o.owner),['blue','blue','blue']);
 for(const m of g.state.objectiveMarkers){assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y));assert.ok(m.x>=0&&m.x<=100&&m.y>=0&&m.y<=100);}
 for(const o of g.objectives)assert.equal(o.beacon.material.color.getHexString(),new T.Color('#7bead2').getHexString());
 const middle=g.objectives[1];g.player.set(middle.x,middle.y+1.72,middle.z);g.update(1/60);g.emit();
 assert.equal(g.state.objectiveMarkers.find(o=>o.id==='B').inside,true);
 g.clearWorld();checked++;
 console.log('PASS '+map.id+' projected HUD and BasicMaterial owner update');
}
console.log(JSON.stringify({maps:checked,frames:checked*7}));
