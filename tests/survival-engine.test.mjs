import assert from 'node:assert/strict';
import test from 'node:test';
import {SurvivalGame,survivalZone} from '../engine/survival.js';
import {getSurvivalItem} from '../engine/survival-items.js';
import {PRESETS} from '../engine/model.js';
import {makeSurvivalShell,at,advance,dispose,T} from './survival-harness.mjs';
function make(map='tidal'){const g=makeSurvivalShell(SurvivalGame,map);g.start(undefined,undefined,{mapId:map});return g;}
function noAI(g){g.updateAI=()=>{};return g;}

test('Both maps create exactly 51 separate combatants, real large world and clear loot',()=>{
 for(const map of ['tidal','uplink']){const g=make(map);
  assert.equal(g.enemies.length,50);assert.equal(g.allies.length,0);assert.equal(g.state.remainingAlive,51);
  assert(g.layout.size>=1000);assert.equal(new Set(g.enemies.map(e=>e.g)).size,50);
  assert.equal(new Set(g.enemies.map(e=>e.setup)).size,50);assert.equal(g.loot.length,300);
  for(const e of g.enemies){assert(!e.dead);assert(!g.blocked(e.g.position.x,e.g.position.z,.5),`spawn ${map} ${e.index}`);}
  for(const l of g.loot)assert(!g.blocked(l.x,l.z,.6),`loot ${l.id}`);
  assert(g.enemies.some(e=>Math.abs(e.g.position.x)>350));
  at(g,480,450);const before=g.player.clone();g.move(g.player,1,0);assert(g.player.x>400);assert(g.player.distanceTo(before)<2);
  dispose(g);
 }
});
test('Match initialization ignores and preserves saved arsenal; training always stays absent',()=>{
 const arsenal=structuredClone(PRESETS),snapshot=JSON.stringify(arsenal),g=makeSurvivalShell(SurvivalGame,'tidal');
 g.setProgress(['bachelor','master','doctor']);g.start(arsenal,'shirane',{mapId:'uplink'});
 assert.equal(JSON.stringify(arsenal),snapshot);assert.equal(g.loadouts.length,1);assert.equal(g.loadouts[0].elements,32);
 assert.equal(g.trainingReport(),null);g.recordWeaponUse('precision',1000,true,true);assert.equal(g.trainingReport(),null);assert.equal(g.hudExtras().weaponXP,0);
 dispose(g);
});
test('Actual pickup changes match weapon once and respects consumable capacity',()=>{
 const g=make(),l=g.loot.find(l=>l.starter==='module'&&l.spawnIndex===0),before=g.loadouts[0],snapshot=JSON.stringify(before);
 at(g,l.x,l.z);assert.equal(g.nearbyLoot().id,l.id);g.pickup();assert.equal(g.loadouts[0].elements,64);assert(!l.available);assert.equal(JSON.stringify(before),snapshot);
 const extra=g.addLoot({x:l.x,z:l.z,id:'test-shield'},getSurvivalItem('wpt-shield'));g.inventory.shield=3;
 g.pickup();assert(extra.available);assert.equal(g.inventory.shield,3);g.inventory.shield=2;g.pickup();assert(!extra.available);assert.equal(g.inventory.shield,3);
 assert.equal(g.trainingReport(),null);dispose(g);
});
test('Pickup cannot reach through a new physical wall',()=>{
 const g=make();for(const l of g.loot)l.available=false;
 const [x,z]=g.layout.spawn;at(g,x,z);const l=g.addLoot({x:x+2.5,z,id:'occluded-pickup'},getSurvivalItem('phase-6'));
 const wall=g.box(.3,4,4,x+1.25,g.ground(x,z)+2,z,g.mat('#666666'));g.occluders.push(wall);g.world.updateMatrixWorld(true);
 assert.equal(g.nearbyLoot(),null);g.pickup();assert(l.available);assert.equal(g.loadouts[0].bits,3);dispose(g);
});
test('WPT channel completes once and movement, damage, firing and pause preserve cell',()=>{
 const g=noAI(make());g.hp=30;g.inventory.heal=3;g.useCell('heal');advance(g,3.25,1/60);
 assert.equal(g.hp,75);assert.equal(g.inventory.heal,2);assert.equal(g.consume,null);
 for(const mode of ['move','fire','damage','pause']){
  g.keys={};g.fire=false;g.hp=30;g.inventory.heal=2;g.moving=false;g.useCell('heal');assert(g.consume,mode);
  if(mode==='move')g.keys.KeyW=true;
  if(mode==='fire')g.fire=true;
  if(mode==='damage')g.damageSurvivor(null,1,g.enemies[0]);
  if(mode==='pause'){g.pause();g.resume();}
  g.update(1/60);assert.equal(g.consume,null,mode);assert.equal(g.inventory.heal,2,mode);
 }
 dispose(g);
});
test('Player and bots use the same armor rule and zone bypasses it',()=>{
 const g=make(),e=g.enemies[0];g.shield=e.shield=40;
 g.damageSurvivor(e,65,g);g.damageSurvivor(null,65,e);assert.equal(e.hp,75);assert.equal(g.hp,75);assert.equal(g.shield,0);assert.equal(e.shield,0);
 g.shield=e.shield=100;g.damageSurvivor(e,30,null,true);g.damageSurvivor(null,30,null,true);assert.equal(e.hp,45);assert.equal(g.hp,45);assert.equal(e.shield,100);assert.equal(g.shield,100);dispose(g);
});
test('Physical headshots against optimized survivor meshes drain armor and credit one kill',()=>{
 const g=noAI(make()),e=g.enemies[0];g.enemies=[e];const [x,z]=g.layout.spawn;at(g,x,z);e.g.position.set(x,g.ground(x,z-8),z-8);e.hp=100;e.shield=50;g.loadouts[0]={...g.loadouts[0],bits:6,width:2.5,power:80};
 const aim=e.g.position.clone().add(new T.Vector3(0,1.84,0)).sub(g.player).normalize();g.shotDirections=()=>[aim];g.world.updateMatrixWorld(true);g.fire=true;assert(g.fireWeapon(.01));assert(g.headshots>0);assert.equal(e.hp,100);assert(e.shield<50);assert.equal(g.trainingReport(),null);
 e.shield=0;e.hp=.01;g.time+=1;g.fire=true;assert(g.fireWeapon(.01));assert.equal(g.kills,1);assert.equal(g.headshotKills,1);assert.equal(e.dead,1);
 g.time+=1;g.fireWeapon(.01);assert.equal(g.kills,1);dispose(g);
});
test('Dead bots stay removed permanently and result victory cannot respawn them',()=>{
 const g=noAI(make()),e=g.enemies[0];g.kill(e,true);advance(g,11);assert.equal(e.dead,1);assert.equal(e.hp,0);assert.equal(e.g.visible,false);assert.equal(g.kills,1);
 for(const bot of g.enemies)g.kill(bot,false);g.update(.01);assert.equal(g.mode,'result');assert.equal(g.result.outcome,'victory');assert.equal(g.result.placement,1);
 const result=g.result;advance(g,20);g.update(20);assert.equal(g.result,result);assert(g.enemies.every(b=>b.dead));dispose(g);
});
test('Player death reports survivors plus one, ends permanently and resets on next match',()=>{
 const g=make();for(let i=0;i<10;i++)g.kill(g.enemies[i],false);g.damageSurvivor(null,1000,g.enemies[12]);
 assert.equal(g.mode,'result');assert.equal(g.result.outcome,'defeat');assert.equal(g.result.placement,41);assert.equal(g.hp,0);assert.equal(g.state.remainingAlive,40);
 const id=g.matchId;g.update(30);assert.equal(g.hp,0);assert.equal(g.dead,1);assert.equal(g.deaths,1);
 g.start(undefined,undefined,{mapId:'uplink'});assert.notEqual(g.matchId,id);assert.equal(g.hp,100);assert.equal(g.dead,0);assert.equal(g.result,null);assert.equal(g.state.remainingAlive,51);dispose(g);
});
test('Zone is continuous, shrinks monotonically to zero and covers spawns initially',()=>{
 for(const map of ['tidal','uplink']){let previous=survivalZone(0,map);for(let time=.25;time<700;time+=.25){const z=survivalZone(time,map);assert(z.radius<=previous.radius+1e-8);assert(z.radius>=0);assert(Number.isFinite(z.damage));assert(z.remaining>=0);assert(Math.hypot(z.x-previous.x,z.z-previous.z)<1);previous=z;}assert.equal(survivalZone(700,map).radius,0);const g=make(map);for(const [x,z] of g.layout.spawns)assert(Math.hypot(x,z)<survivalZone(0,map).radius);dispose(g);}
});
test('Shelter roofs block beams while entrances and inside floor remain walkable',()=>{
 for(const map of ['tidal','uplink']){const g=make(map);for(const b of g.layout.compounds){const y=g.ground(b.x,b.z);assert(!g.blocked(b.x,b.z,.5,y),`${map} ${b.id} floor`);assert(!g.line(new T.Vector3(b.x,y+1.7,b.z),new T.Vector3(b.x,y+b.h+3,b.z)),`${map} ${b.id} roof`);for(const [x,z] of b.entrances)assert(!g.blocked(x,z,.5,g.ground(x,z)),`${map} ${b.id} entrance`);}dispose(g);}
});
test('Simultaneous final storm deaths resolve as a frozen draw with zero survivors',()=>{
 for(const map of ['tidal','uplink']){const g=noAI(make(map));for(const e of g.enemies.slice(1))g.kill(e,false);const e=g.enemies[0];g.time=621;g.hp=.01;e.hp=.01;g.shield=e.shield=100;at(g,400,400);e.g.position.set(-400,g.ground(-400,-400),-400);
  g.update(.05);assert.equal(g.mode,'result');assert.equal(g.result.outcome,'draw');assert.equal(g.result.placement,1);assert.equal(g.hp,0);assert.equal(e.dead,1);assert.equal(g.hudExtras().remainingAlive,0);assert(Object.isFrozen(g.result));const result=g.result;g.update(10);assert.equal(g.result,result);assert.equal(g.hp,0);dispose(g);
 }
});
test('Final storm tick distinguishes a surviving player from a surviving last bot',()=>{
 for(const playerSurvives of [true,false]){const g=noAI(make());for(const e of g.enemies.slice(1))g.kill(e,false);const e=g.enemies[0];g.time=621;g.hp=playerSurvives?100:.01;e.hp=playerSurvives?.01:100;at(g,400,400);e.g.position.set(-400,g.ground(-400,-400),-400);g.update(.05);
  assert.equal(g.result.outcome,playerSurvives?'victory':'defeat');assert.equal(g.result.placement,playerSurvives?1:2);assert.equal(g.hudExtras().remainingAlive,1);dispose(g);
 }
});
test('Manual backward movement cancels autorun and release leaves the player stationary',()=>{
 const g=noAI(make()),event=code=>({code,repeat:false,preventDefault(){}});g.keyDown(event('KeyZ'));advance(g,.2,.05);assert(g.autoRun);
 g.keyDown(event('KeyS'));advance(g,.1,.05);assert.equal(g.autoRun,false);g.keyUp(event('KeyS'));const before=g.player.clone();advance(g,.2,.05);
 assert(Math.hypot(g.player.x-before.x,g.player.z-before.z)<1e-8,'S release must not restart the prior synthetic W input');dispose(g);
});
test('Both starter caches remain walkably reachable from every spawn after POI cover additions',()=>{
 for(const map of ['tidal','uplink']){const g=make(map);for(let index=0;index<51;index++){
  const [x,z]=g.layout.spawns[index],cache=g.loot.filter(l=>l.spawnIndex===index);assert.equal(cache.length,2);
  for(const l of cache)assert(g.walkableSegment(x,z,l.x,l.z,.6),`${map} spawn ${index} to ${l.starter}`);
 }dispose(g);}
});
test('Every WPT station retains a usable ground position and stops charging when airborne',()=>{
 for(const map of ['tidal','uplink']){const g=noAI(make(map));g.enemies=[];g.keys={KeyE:true};g.moving=false;g.time=10;
  for(const station of g.stations){let point=null;for(let i=0;i<24;i++){const a=i/24*Math.PI*2,x=station.x+4*Math.cos(a),z=station.z+4*Math.sin(a);if(!g.blocked(x,z,.5)&&g.line(station.emitter,new T.Vector3(x,g.ground(x,z)+1.72,z))){point={x,z};break;}}
   assert(point,`${map} ${station.id} usable position`);at(g,point.x,point.z);g.lastHit=-10;g.shield=10;g.energy=30;g.wptProgress=0;for(let i=0;i<12;i++)g.updateWPT(.1);assert(g.shield>10,`${map} ${station.id} ground charging`);assert.equal(g.wptState.status,'charging');
   g.player.y+=2.5;const shield=g.shield;g.updateWPT(.1);assert.equal(g.shield,shield);assert.equal(g.wptActive,false);assert.equal(g.wptProgress,0);assert.equal(g.wptState.status,'moving');
  }dispose(g);
 }
});
