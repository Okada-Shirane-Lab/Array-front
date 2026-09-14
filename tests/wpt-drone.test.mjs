import assert from 'node:assert/strict';
import * as T from '../engine/three.module.js';
import {Game} from '../engine/game.js';
import {MAPS,PRESETS,stats,terrain,riverCenter,WATER_LEVEL,layoutFor} from '../engine/model.js';

globalThis.document={pointerLockElement:null};
let passes=0,failures=0;
function test(name,fn){try{fn();passes++;console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.stack);}}
const near=(actual,expected,tol=1e-6)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);
function makeGame(map='base'){
 const g=Object.create(Game.prototype);
 Object.assign(g,{map,mode:'menu',keys:{},enemies:[],allies:[],fx:[],time:0,acc:0,yaw:0,pitch:0,fire:false,aim:false,lastHit:-10,slot:0,scan:0,scanCooldown:0,velocityY:0,energy:100,heat:0,overheat:false,reload:0,reloadTotal:0,wptHeld:false,wptProgress:0,wptActive:false,currentSpeed:0,touchMove:{x:0,y:0},player:new T.Vector3(0,1.72,49),ray:new T.Raycaster(),scene:new T.Scene(),camera:new T.PerspectiveCamera(72,1,.06,650),weapon:new T.Group(),world:new T.Group(),sharedGeo:{box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)},onState:s=>{g.state=s;},sound:()=>{},initAudio:()=>{},lock:()=>{}});
 g.scene.add(g.world);g.start(PRESETS);return g;
}
function quiet(g){g.enemies=[];g.allies=[];return g;}
function at(g,x,z){g.player.set(x,g.ground(x,z)+1.72,z);g.eyeHeight=1.72;g.velocityY=0;g.moving=false;g.yaw=0;return g;}
function charge(g,seconds=1.2){for(let t=0;t<seconds-.001;t+=.05){g.time+=.05;g.updateWPT(.05);}}
function restoreWpt(g){Object.assign(g,{hp:40,energy:35,heat:65,dead:0,lastHit:-10,time:10,keys:{KeyE:true},wptHeld:false,wptProgress:0,moving:false,fire:false,reload:0});g.enemies=[];at(g,g.baseStation.x,g.baseStation.z);}
const base=makeGame();
test('Exactly seven distinct maps',()=>{assert.equal(MAPS.length,7);assert.equal(new Set(MAPS.map(m=>m.id)).size,7);});
test('Stats finite over setup grid; larger/heavier configurations trade speed for reload',()=>{
 for(const elements of [16,32,64,128])for(const power of [40,70,100])for(const cooling of [0,50,100])for(const bits of [2,4,6])for(const mode of ['focus','wide','split']){
  const s={...PRESETS[0],elements,power,cooling,bits,mode},st=stats(s);assert.ok(Object.values(st).every(Number.isFinite));assert.ok(st.moveSpeed>=3.6&&st.moveSpeed<=6.4&&st.reloadSeconds>0);near(st.sprintSpeed,st.moveSpeed*1.6);near(st.crouchSpeed,st.moveSpeed*.54);
  for(const key of ['elements','power','cooling','bits']){const next=stats({...s,[key]:s[key]+1});assert.ok(next.moveSpeed<=st.moveSpeed&&next.reloadSeconds>st.reloadSeconds,key);}
 }
});
test('Reload duration snapshots current slot and finishes after switching',()=>{
 quiet(base);base.energy=20;base.slot=0;base.recharge();const duration=stats(PRESETS[0]).reloadSeconds;near(base.reload,duration);base.setSlot(1);near(base.reload,duration);near(base.reloadTotal,duration);for(let t=0;t<duration+.1;t+=.05)base.update(.05);assert.equal(base.energy,100);assert.ok(base.reload<=0);
});
test('Actual walking, sprinting, crouching follow slot stats',()=>{
 quiet(base);for(const slot of [0,1,2])for(const stance of ['walk','sprint','crouch']){at(base,65,60);base.slot=slot;base.keys={KeyW:true,...(stance==='sprint'?{ShiftLeft:true}:stance==='crouch'?{KeyC:true}:{})};const z=base.player.z;base.update(.05);near(z-base.player.z,stats(PRESETS[slot])[stance==='sprint'?'sprintSpeed':stance==='crouch'?'crouchSpeed':'moveSpeed']*.05);}
});
test('No passive HP regeneration over 12 seconds outside WPT',()=>{
 quiet(base);at(base,65,65);base.hp=35;base.keys={};base.lastHit=-100;for(let i=0;i<240;i++)base.update(.05);assert.equal(base.hp,35);
});
test('WPT base requires E and .8 second link; key release resets link',()=>{
 restoreWpt(base);base.keys={};charge(base);assert.equal(base.hp,40);base.keys={KeyE:true};charge(base,.5);assert.equal(base.hp,40);assert.equal(base.wptState.status,'linking');base.keys={};charge(base,.05);assert.equal(base.wptProgress,0);base.keys={KeyE:true};charge(base,1.2);assert.ok(base.hp>40);assert.equal(base.wptState.status,'charging');
});
test('WPT touch hold heals and clamps HP/energy/heat',()=>{restoreWpt(base);base.keys={};base.wptHeld=true;charge(base,8);assert.equal(base.hp,100);assert.equal(base.energy,100);assert.equal(base.heat,0);assert.equal(base.wptState.status,'complete');});
for(const [name,arrange,status] of [
 ['range',g=>at(g,g.baseStation.x+8,g.baseStation.z),'out-of-range'],
 ['recent damage',g=>g.lastHit=g.time,'under-fire'],
 ['movement',g=>g.moving=true,'moving'],
 ['jumping',g=>g.player.y+=1,'moving'],
 ['death',g=>g.dead=4,'inactive'],
 ['shooting',g=>g.fire=true,'busy'],
 ['reloading',g=>g.reload=3,'busy']
])test('WPT cannot heal during '+name,()=>{restoreWpt(base);arrange(base);charge(base,.9);assert.equal(base.hp,40);assert.equal(base.wptState.status,status);assert.equal(base.wptProgress,0);});
test('WPT blue objective heals; neutral/red do not; ground enemy contests; drone does not',()=>{
 const o=base.objectives[0];for(const owner of ['neutral','red']){restoreWpt(base);o.owner=owner;at(base,o.x,o.z);charge(base);assert.equal(base.hp,40);assert.equal(base.wptState.status,'out-of-range');}
 restoreWpt(base);o.owner='blue';at(base,o.x,o.z);charge(base);assert.ok(base.hp>40);assert.equal(base.wptState.label,'拠点 A');
 restoreWpt(base);at(base,o.x,o.z);base.enemies=[base.makeSoldier('enemy',o.x,o.z,0)];charge(base);assert.equal(base.hp,40);assert.equal(base.wptState.status,'contested');
 restoreWpt(base);at(base,o.x,o.z);base.enemies=[base.makeDrone(o.x,o.z,7)];charge(base);assert.ok(base.hp>40);
});
test('WPT line-of-sight blockage stops an established link',()=>{restoreWpt(base);charge(base);assert.ok(base.hp>40);const hp=base.hp,original=base.line;base.line=()=>false;charge(base);assert.equal(base.hp,hp);assert.equal(base.wptState.status,'blocked');base.line=original;});
test('Damage in the same update cancels WPT before any HP recovery',()=>{
 quiet(base);restoreWpt(base);charge(base);const hp=base.hp,enemy=base.makeSoldier('enemy',base.baseStation.x,base.baseStation.z-10,0);base.enemies=[enemy];enemy.shoot=0;const random=Math.random;Math.random=()=>0;try{base.update(.05);}finally{Math.random=random;}near(base.hp,hp-8);assert.equal(base.wptState.status,'under-fire');assert.equal(base.wptProgress,0);
});
test('Small touch input cannot move the player while WPT heals',()=>{
 quiet(base);restoreWpt(base);charge(base);const hp=base.hp,start=base.player.clone();base.touchMove={x:.04,y:0};base.update(.05);base.touchMove={x:0,y:0};assert.ok(base.player.distanceTo(start)<1e-8||base.hp<=hp,'touch movement and HP recovery occurred together');
});
test('Drone actor targeting matches mesh center; player hits elevated drone',()=>{
 quiet(base);at(base,65,60);base.keys={};base.wptHeld=false;base.slot=0;base.reload=0;base.heat=0;base.overheat=false;base.energy=100;base.fire=true;const d=base.makeDrone(65,45,7);base.enemies=[d];const delta=d.g.position.clone().sub(base.player);base.pitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));base.yaw=0;base.camera.rotation.set(base.pitch,0,0,'YXZ');near(base.actorPoint(d).distanceTo(d.g.position),0);base.fireWeapon(.1);assert.ok(d.hp<70);assert.ok(base.hitFlash>0);
});
test('Dead drone returns alive above terrain with drone health',()=>{
 const d=base.enemies[0];base.kill(d,true);assert.equal(d.g.visible,false);d.dead=.02;base.updateAI(d,.05);assert.equal(d.dead,0);assert.equal(d.hp,70);assert.equal(d.g.visible,true);near(d.g.position.y,base.airFloor(d.g.position.x,d.g.position.z)+6);
});
test('Friendly soldier fires at drone center and damages it',()=>{
 quiet(base);const ally=base.makeSoldier('ally',65,60,0),drone=base.makeDrone(65,49,7);base.allies=[ally];base.enemies=[drone];ally.shoot=0;const oldRandom=Math.random,beam=base.beam;let endpoint;Math.random=()=>0;base.beam=(_a,b)=>endpoint=b.clone();try{base.updateAI(ally,.05);}finally{Math.random=oldRandom;base.beam=beam;}assert.equal(drone.hp,48);near(endpoint.distanceTo(drone.g.position),0);
});
test('Drone fires at player and applies damage/lastHit',()=>{
 quiet(base);at(base,65,60);base.hp=100;base.dead=0;const d=base.makeDrone(65,48,7);d.shoot=0;const rand=Math.random,beam=base.beam;let endpoint;Math.random=()=>0;base.beam=(_a,b)=>endpoint=b.clone();try{base.updateDrone(d,.05);}finally{Math.random=rand;base.beam=beam;}assert.equal(base.hp,94);assert.equal(base.lastHit,base.time);near(endpoint.distanceTo(base.player.clone().add(new T.Vector3(0,-.3,0))),0);
});
test('Enemy drone alone never captures objective',()=>{
 quiet(base);base.hp=100;base.fire=false;base.keys={};at(base,65,65);const o=base.objectives[0];o.owner='neutral';o.progress=0;const d=base.makeDrone(o.x,o.z,7);base.enemies=[d];const ai=base.updateAI;base.updateAI=()=>{};try{for(let i=0;i<20;i++)base.update(.05);}finally{base.updateAI=ai;}assert.equal(o.progress,0);assert.equal(o.owner,'neutral');
});
for(const map of MAPS)test('Map '+map.id+' geometry, WPT, and drone clearance',()=>{
 const g=makeGame(map.id);let min=Infinity,max=-Infinity;for(let x=-85;x<=85;x+=2)for(let z=-85;z<=85;z+=2){const h=g.ground(x,z);assert.ok(Number.isFinite(h));min=Math.min(min,h);max=Math.max(max,h);}assert.ok(max-min>5);
 assert.equal(g.objectives.length,3);assert.equal(g.enemies.filter(e=>e.kind==='drone').length,3);let positions=0;g.world.traverse(o=>{if(o.geometry?.attributes.position){assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));positions+=o.geometry.attributes.position.count;}});assert.ok(positions>10000);
 quiet(g);restoreWpt(g);charge(g);assert.ok(g.hp>40,'Spawn WPT link blocked');
 const drones=[g.makeDrone(-30,-62,7),g.makeDrone(0,-62,8),g.makeDrone(30,-62,9)];g.player.set(80,g.ground(80,80)+1.72,80);g.dead=10;let clearance=Infinity;for(let step=0;step<400;step++){g.time+=.05;for(const d of drones){g.updateDrone(d,.05);const margin=d.g.position.y-g.airFloor(d.g.position.x,d.g.position.z);clearance=Math.min(clearance,margin);assert.ok(margin>1.25,`${map.id} clearance ${margin}`);}}console.log('  '+map.id+' relief='+Number(max-min).toFixed(2)+'m; min drone clearance='+clearance.toFixed(2)+'m; vertices='+positions);
 if(map.id==='snow'){assert.equal(g.snowfall.geometry.attributes.position.count,650);assert.equal(g.water,null);}if(map.id==='river'){assert.ok(g.water&&g.waterFlow);assert.ok([...g.water.geometry.attributes.position.array].filter((_,i)=>i%3===1).every(y=>Math.abs(y-WATER_LEVEL)<1e-6));}
 g.clearWorld();assert.equal(g.world.children.length,0);assert.equal(g.snowfall,null);assert.equal(g.water,null);
});
test('River bed away from crossing shoulders is submerged and both crossings stay above water',()=>{
 for(let z=-80;z<=80;z+=.5){if(layoutFor('river').crossings.every(c=>Math.abs(z-c)>(c===26?30:18)))assert.ok(terrain('river',riverCenter(z),z)<WATER_LEVEL-.15);}
 for(const z of layoutFor('river').crossings)for(let x=riverCenter(z)-14;x<=riverCenter(z)+14;x+=.1)assert.ok(terrain('river',x,z)>=.699999);
});
for(const z of layoutFor('river').crossings)test('River crossing z='+z+' walks from bank to bank without slowdown',()=>{
 const g=quiet(makeGame('river'));g.slot=0;g.keys={KeyD:true};const start=riverCenter(z)-24,end=riverCenter(z)+24;at(g,start,z);let steps=0;for(;g.player.x<end&&steps<300;steps++){g.update(.05);assert.equal(g.inWater,false);assert.ok(g.player.y-1.72>WATER_LEVEL);assert.ok(Math.abs(g.player.z-z)<1e-6);}assert.ok(g.player.x>=end,`blocked at ${g.player.x},${z}`);
});
test('Water slows travel, remains below camera, and prevents crouching',()=>{
 const g=quiet(makeGame('river'));
 const z=0;at(g,riverCenter(z),z);g.keys={};g.update(.05);assert.equal(g.inWater,true);near(g.currentSpeed,stats(PRESETS[0]).moveSpeed*.58);assert.ok(g.player.y>WATER_LEVEL);g.keys={KeyC:true};g.update(.05);near(g.eyeHeight,1.72);
});
test('Rendered river surface covers submerged channel',()=>{
 const g=quiet(makeGame('river')),p=g.water.geometry.attributes.position;let uncovered=0,example;for(let z=-80;z<=80;z+=1){const low=Math.floor((z+200)/2.5),t=(z-p.getZ(low*2))/2.5,left=p.getX(low*2)*(1-t)+p.getX(low*2+2)*t,right=p.getX(low*2+1)*(1-t)+p.getX(low*2+3)*t;for(let delta=5;delta<=14;delta+=.1)for(const sign of [-1,1]){const x=riverCenter(z)+sign*delta,h=terrain('river',x,z);if(h<WATER_LEVEL-.15&&(x<left||x>right)){uncovered++;example??={x,z,delta,h,left,right};}}}
 assert.equal(uncovered,0,JSON.stringify({uncovered,example}));
});
console.log(JSON.stringify({passes,failures}));process.exitCode=failures?1:0;
