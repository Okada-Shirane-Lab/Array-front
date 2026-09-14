import assert from 'node:assert/strict';
import {Game} from '../engine/game.js';
import * as T from '../engine/three.module.js';
import {PRESETS,defaultData,validateData} from '../engine/model.js';
globalThis.document={pointerLockElement:null};
let seed=5812;
Math.random=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
function headless(map='base'){
 const g=Object.create(Game.prototype);
 Object.assign(g,{scene:new T.Scene(),world:new T.Group(),weapon:new T.Group(),sharedGeo:{box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)},player:new T.Vector3(),ray:new T.Raycaster(),camera:new T.PerspectiveCamera(),map,mode:'menu',time:0,keys:{},touchMove:{x:0,y:0},fire:false,aim:false,emit:()=>{},initAudio:()=>{},lock:()=>{},sound:()=>{},beam:()=>{},spark:()=>{}});
 g.scene.add(g.world);g.start(PRESETS);return g;
}
assert(validateData(defaultData()));
const deathGame=headless();const e=deathGame.enemies[0];deathGame.enemies=[e];deathGame.allies=[];e.g.position.set(deathGame.baseStation.x,deathGame.ground(deathGame.baseStation.x,deathGame.baseStation.z-5),deathGame.baseStation.z-5);e.shoot=0;deathGame.hp=8;
const rand=Math.random;Math.random=()=>0;deathGame.updateAI(e,1/60);Math.random=rand;
assert.equal(deathGame.hp,0);assert.equal(deathGame.dead,4);assert.equal(deathGame.deaths,1);
e.dead=20;for(let i=0;i<81;i++)deathGame.update(.05);
assert.equal(deathGame.dead,0);assert.equal(deathGame.hp,100);
e.dead=.01;deathGame.updateAI(e,.02);assert.equal(e.dead,0);assert.equal(e.hp,100);assert(e.g.visible);
e.g.position.set(deathGame.baseStation.x,deathGame.ground(deathGame.baseStation.x,deathGame.baseStation.z-7),deathGame.baseStation.z-7);deathGame.fire=true;assert(deathGame.fireWeapon(.02));assert(e.hp<100);
deathGame.energy=50;deathGame.recharge();assert(deathGame.reload>0);deathGame.pulse();assert(deathGame.scan>0);
console.log('death-respawn-fire-recharge-scan: PASS', {enemyHp:e.hp,playerDead:deathGame.dead,enemyDead:e.dead});
deathGame.clearWorld();
for(const map of ['base','canyon','ridge','snow','river']){
 const g=headless(map);const occluders=g.occluders;g.occluders=[];let blocked=0,clear=0,mismatches=0,maxHitError=0;
 const verticalStart=new T.Vector3(0,g.ground(0,0)+1.6,0),verticalEnd=new T.Vector3(0,g.ground(0,0)-2,0);
 assert(!g.line(verticalStart,verticalEnd));const verticalHit=g.trace(verticalStart,verticalEnd);assert(Math.abs(verticalHit.y-g.ground(0,0))<.01);
 for(let i=0;i<300;i++){
  const x1=(Math.random()-.5)*160,z1=(Math.random()-.5)*160,x2=(Math.random()-.5)*160,z2=(Math.random()-.5)*160;
  const a=new T.Vector3(x1,g.ground(x1,z1)+1.5,z1),b=new T.Vector3(x2,g.ground(x2,z2)+1.5,z2),d=b.clone().sub(a),len=d.length();
  let dense=false;for(let j=1,n=Math.ceil(len/.1);j<=n;j++){const t=j/n;if(a.y+d.y*t<g.ground(a.x+d.x*t,a.z+d.z*t)){dense=true;break;}}
  const hit=g.groundIntersection(a,b);if(!!hit!==dense)mismatches++;if(hit){blocked++;assert(!g.line(a,b));maxHitError=Math.max(maxHitError,Math.abs(hit.y-g.ground(hit.x,hit.z)));}else clear++;
 }
 g.occluders=occluders;
 let maxRingError=0;for(const o of g.objectives){const p=o.ring.geometry.attributes.position;for(let i=0;i<p.count;i++)maxRingError=Math.max(maxRingError,Math.abs(o.y+p.getY(i)-g.ground(o.x+p.getX(i),o.z+p.getZ(i))-.08));}
 let maxRoadError=0;assert(g.roads.length>1);for(const road of g.roads){const rp=road.geometry.attributes.position;for(let i=0;i<rp.count;i++)maxRoadError=Math.max(maxRoadError,Math.abs(rp.getY(i)-g.ground(rp.getX(i),rp.getZ(i))-.055));}
 assert(maxRingError<1e-5);assert(maxRoadError<1e-5);
 g.player.set(0,g.ground(0,3)+1.72,3);g.enemies.forEach((e,i)=>e.g.position.set(i%5-2,g.ground(i%5-2,-8-Math.floor(i/5)),-8-Math.floor(i/5)));g.allies.forEach((e,i)=>e.g.position.set(i-2,g.ground(i-2,4),4));
 for(let i=0;i<5;i++)g.update(1/60);let t=performance.now();for(let i=0;i<120;i++)g.update(1/60);const ms=(performance.now()-t)/120;
 console.log('terrain and performance', {map,blocked,clear,mismatches,maxHitError,maxRingError,maxRoadError,combatMsPerFrame:ms});
 g.start(PRESETS);for(let i=0;i<6010&&g.mode==='playing';i++)g.update(.05);assert.equal(g.mode,'result');assert(g.remaining<=0||g.red>=250||g.blue>=250);assert(g.enemies.every(e=>e.dead>=0));assert(g.dead>=0);
 console.log('match completion', {map,seconds:g.time,blue:g.blue,red:g.red,mode:g.mode});g.clearWorld();
}
const jump=headless();jump.enemies=[];jump.allies=[];jump.player.set(3,jump.ground(3,20)+1.72,20);jump.keys={KeyW:true,Space:true};let maxFeet=0;
for(let i=0;i<90;i++){jump.update(1/60);maxFeet=Math.max(maxFeet,jump.player.y-jump.eyeHeight);}
assert(jump.player.z<16);
console.log('barrier jump actual outcome',{maxFeet,finalZ:jump.player.z,crossed:jump.player.z<16});
jump.player.set(3,jump.ground(3,17)+3.72,17);jump.keys={};jump.velocityY=-1;for(let i=0;i<60;i++)jump.update(1/60);
console.log('landing on barrier',{feet:jump.player.y-jump.eyeHeight,expected:jump.ground(3,17)+1.2});assert(Math.abs(jump.player.y-jump.eyeHeight-jump.ground(3,17)-1.2)<1e-6);
