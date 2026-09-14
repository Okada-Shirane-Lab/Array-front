import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGame,quiet,at,target,PRESETS} from './combat-harness.mjs';
import {stats} from '../engine/model.js';
function run(rate,fps,seconds=2){
 const s={...PRESETS[0],fireRate:rate,bits:6,width:12,steering:0,scanWidth:0,beamCount:1};
 const g=quiet(at(makeGame(s))),e=target(g);g.fire=true;let beams=0,energySpent=0,heatGenerated=0;
 // Isolate cadence from frame-sampled sway now that exact surface distance and
 // head/body regions affect damage. Every pulse follows the same torso ray.
 const direction=g.actorPoint(e).sub(g.player).normalize();g.shotDirections=()=>[direction.clone()];
 g.beam=()=>beams++;
 for(let frame=0;frame<seconds*fps;frame++){
  g.time=frame/fps;g.energy=1e6;g.heat=0;g.overheat=false;g.reload=0;
  g.fireWeapon(1/fps);energySpent+=1e6-g.energy;heatGenerated+=g.heat;
 }
 return {beams,energySpent,heatGenerated,damage:1e6-e.hp,stats:stats(s)};
}
for(const rate of [2,6,12,16])test(`Cadence ${rate} Hz is consistent at 20, 30, 60 and 144 FPS`,()=>{
 const runs=[20,30,60,144].map(fps=>({fps,...run(rate,fps)}));
 for(const r of runs){assert.equal(r.beams,rate*2,JSON.stringify(r));assert(Math.abs(r.energySpent-r.stats.drain*2)<1e-6);assert(Math.abs(r.heatGenerated-r.stats.heat*2)<1e-6);}
 assert(Math.max(...runs.map(r=>r.damage))-Math.min(...runs.map(r=>r.damage))<1e-6,JSON.stringify(runs));
});
test('Trigger tapping faster than configured cadence does not create extra shots',()=>{
 const g=quiet(at(makeGame({...PRESETS[0],fireRate:2})));let count=0;g.beam=()=>count++;
 for(let frame=0;frame<120;frame++){g.time=frame/60;g.energy=1e6;g.heat=0;g.fire=frame%2===0;g.fireWeapon(1/60);}
 assert(count<=4,`fired ${count} shots at 2 Hz in 2 seconds`);
});
test('Switching equipped setups preserves the current next-shot limit',()=>{
 const setups=[{...PRESETS[0],id:'slow',fireRate:2},{...PRESETS[0],id:'fast',fireRate:12}];
 const g=quiet(at(makeGame(setups)));let count=0;g.beam=()=>count++;
 g.time=0;g.fire=true;g.fireWeapon(1/60);assert.equal(count,1);
 g.time=.01;g.setSlot(1);g.fire=true;g.fireWeapon(1/60);assert.equal(count,1,'switch granted free immediate shot');
 for(let i=1;i<10;i++){g.time=.01+i*.01;g.setSlot(i%2);g.fire=true;g.fireWeapon(1/60);}
 assert.equal(count,1,'switch tapping bypassed cooldown');
});
test('Focus beam blocked by line of sight does not damage target',()=>{
 const g=quiet(at(makeGame()));const e=target(g),hp=e.hp;g.fire=true;g.line=()=>false;g.fireWeapon(.05);assert.equal(e.hp,hp);
});
