import assert from 'node:assert/strict';
import {Game} from '../engine/game.js';
import * as T from '../engine/three.module.js';
import {PRESETS,MAPS,DIFFICULTIES,BASE_DIFFICULTIES,getDifficulty,clearedDifficulties,isShiraneUnlocked,canPlayDifficulty,validVictory,matchOutcome} from '../engine/model.js';
globalThis.document={pointerLockElement:null};
let passes=0;
function test(name,fn){fn();passes++;console.log('PASS '+name);}
function near(a,b){assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
function fixture(map='base'){
 const g=Object.create(Game.prototype);
 Object.assign(g,{map,mode:'menu',keys:{},enemies:[],allies:[],fx:[],time:0,acc:0,yaw:0,pitch:0,fire:false,aim:false,lastHit:-10,slot:0,scan:0,scanCooldown:0,velocityY:0,energy:100,heat:0,overheat:false,reload:0,reloadTotal:0,wptHeld:false,wptProgress:0,wptActive:false,currentSpeed:0,touchMove:{x:0,y:0},player:new T.Vector3(0,1.72,49),ray:new T.Raycaster(),scene:new T.Scene(),camera:new T.PerspectiveCamera(72,1,.06,650),weapon:new T.Group(),world:new T.Group(),sharedGeo:{box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)},onState:s=>{g.state=s;},sound:()=>{},initAudio:()=>{},lock:()=>{},beam:()=>{},spark:()=>{}});
 g.scene.add(g.world);return g;
}
function actor(team='enemy',kind='soldier'){return {kind,team,g:new T.Group(),legs:[new T.Group(),new T.Group()],rotors:[new T.Group(),new T.Group()],maxHp:100,hp:100,dead:0,target:0,index:0,seed:0,shoot:0};}
function combat(profile,kind='soldier',team='enemy'){
 const g=Object.create(Game.prototype),e=actor(team,kind);
 Object.assign(g,{difficulty:profile,time:10,player:new T.Vector3(0,1.72,10),allies:[],enemies:[],dead:0,deaths:0,hp:100,red:0,shots:0,objectives:[{x:60,y:0,z:60,owner:'neutral'}],ground:()=>0,airFloor:()=>0,line:()=>true,move:(p,x,z)=>{p.x+=x;p.z+=z;},beam:()=>g.shots++});
 e.g.position.set(0,kind==='drone'?6:0,0);
 if(team==='ally'){g.dead=1;const target=actor();target.g.position.set(0,0,10);g.enemies=[target];}
 return {g,e};
}
const realRandom=Math.random;
test('Exact Japanese names, rank order, normal-level compatibility',()=>{
 assert.deepEqual(DIFFICULTIES.map(d=>d.label),['学士','修士','博士','白根']);
 assert.deepEqual(DIFFICULTIES.map(d=>d.rank),[1,2,3,4]);assert.equal(getDifficulty('invalid').id,'master');
 assert.equal(getDifficulty('master').infantryAccuracy,.49);assert(Object.isFrozen(DIFFICULTIES));
});
test('Unlock requires all three distinct base clears in any order; unknown/duplicate/Shirane clears cannot substitute',()=>{
 for(let mask=0;mask<8;mask++){const cleared=BASE_DIFFICULTIES.filter((_,i)=>mask&(1<<i));assert.equal(isShiraneUnlocked(cleared),mask===7);assert.equal(canPlayDifficulty('shirane',cleared),mask===7);}
 assert(isShiraneUnlocked(['doctor','bachelor','master']));assert(!isShiraneUnlocked(['bachelor','bachelor','shirane','unknown']));
 assert.deepEqual(clearedDifficulties(['doctor','doctor','unknown','bachelor']),['bachelor','doctor']);
 for(const id of BASE_DIFFICULTIES)assert(canPlayDifficulty(id));assert(!canPlayDifficulty('invalid',BASE_DIFFICULTIES));
});
const measured=[];
for(const profile of DIFFICULTIES){
 const row={level:profile.id};
 for(const kind of ['soldier','drone']){
  test(`${profile.label} ${kind}: actual hit count matches profile, shot cadence`,()=>{
   const {g,e}=combat(profile,kind);let hits=0;
   for(let i=0;i<1000;i++){Math.random=()=>(i+.5)/1000;g.hp=100;e.shoot=0;g.updateAI(e,0);if(g.hp<100)hits++;}
   const accuracy=kind==='drone'?profile.droneAccuracy:profile.infantryAccuracy;assert.equal(hits,1000*accuracy);assert.equal(g.shots,1000);
   Math.random=()=>.5;g.hp=100;e.shoot=0;g.updateAI(e,0);const interval=e.shoot;near(interval,(kind==='drone'?1.575:1.075)*profile.intervalScale);
   row[kind+'Hits']=hits;row[kind+'Interval']=interval;
  });
  test(`${profile.label} ${kind}: actual detection boundary and terrain/building occlusion`,()=>{
   const {g,e}=combat(profile,kind);const sight=kind==='drone'?profile.droneSight:profile.infantrySight;
   g.player.set(sight-.001,e.g.position.y+(kind==='drone'?.3:0),0);g.updateAI(e,0);assert.equal(g.shots,1);
   e.shoot=0;g.player.x=sight+.001;g.updateAI(e,0);assert.equal(g.shots,1);
   g.player.x=10;g.line=()=>false;e.shoot=0;g.updateAI(e,0);assert.equal(g.shots,1);
  });
  test(`${profile.label} ${kind}: actual travel speed`,()=>{
   const {g,e}=combat(profile,kind);g.dead=1;const before=e.g.position.clone();g.updateAI(e,.1);
   const traveled=Math.hypot(e.g.position.x-before.x,e.g.position.z-before.z);near(traveled,(kind==='drone'?5.1:3.15)*profile.speedScale*.1);row[kind+'Speed']=traveled/.1;
  });
 }
 test(`${profile.label}: allies keep baseline accuracy, interval, movement and sight`,()=>{
  const {g,e}=combat(profile,'soldier','ally');let hits=0;const target=g.enemies[0];
  for(let i=0;i<1000;i++){Math.random=()=>(i+.5)/1000;target.hp=100;e.shoot=0;g.updateAI(e,0);if(target.hp<100)hits++;}assert.equal(hits,650);
  Math.random=()=>.5;e.shoot=0;g.updateAI(e,0);near(e.shoot,1.075);
  g.enemies=[];const before=e.g.position.clone();g.updateAI(e,.1);near(e.g.position.distanceTo(before),.39);
  e.g.position.set(0,0,0);g.enemies=[target];target.g.position.set(43.99,0,0);e.shoot=0;g.shots=0;g.updateAI(e,0);assert.equal(g.shots,1);
  target.g.position.x=44.01;e.shoot=0;g.updateAI(e,0);assert.equal(g.shots,1);
 });
 measured.push(row);
}
Math.random=realRandom;
test('Measured combat values strengthen monotonically',()=>{
 for(let i=1;i<measured.length;i++)for(const kind of ['soldier','drone']){assert(measured[i][kind+'Hits']>measured[i-1][kind+'Hits']);assert(measured[i][kind+'Interval']<measured[i-1][kind+'Interval']);assert(measured[i][kind+'Speed']>measured[i-1][kind+'Speed']);}
});
const g=fixture();
test('Engine enforces locked Shirane and invalid IDs before starting',()=>{
 assert.equal(g.start(PRESETS,'shirane'),false);assert.equal(g.mode,'menu');assert.equal(g.start(PRESETS,'invalid'),false);
 g.setProgress(['bachelor','doctor']);assert.equal(g.start(PRESETS,'shirane'),false);g.setProgress(['doctor','master','bachelor','bachelor']);assert(Object.isFrozen(g.cleared));assert.equal(g.start(PRESETS,'shirane'),true);assert.equal(g.state.difficultyId,'shirane');
});
test('Captured difficulty is unchanged by progress refresh and denied start',()=>{
 const id=g.matchId;g.setProgress([]);assert.equal(g.difficulty.id,'shirane');assert.equal(g.start(PRESETS,'shirane'),false);assert.equal(g.matchId,id);assert.equal(g.mode,'playing');
});
test('Pause and abandoning never produce a clear result or advance the match',()=>{
 g.start(PRESETS,'doctor');const time=g.time;g.pause();g.update(1);assert.equal(g.time,time);assert.equal(g.state.result,null);g.menu();g.update(301);assert.equal(g.mode,'menu');assert.equal(g.state.result,null);
});
function finish(blue,red,remaining=0){g.start(PRESETS,'doctor');g.enemies=[];g.allies=[];g.blue=blue;g.red=red;g.remaining=remaining;g.update(0);return g.state.result;}
test('Time-limit victory is valid and frozen; repeat updates/emit retain same snapshot',()=>{
 const result=finish(140.9,120.1);assert.equal(result.outcome,'victory');assert(validVictory(result));assert(Object.isFrozen(result));
 const before={time:g.time,blue:g.blue,remaining:g.remaining};g.update(1);g.emit();assert.equal(g.state.result,result);assert.deepEqual({time:g.time,blue:g.blue,remaining:g.remaining},before);
});
test('Defeat and draw including fractional ties are not valid clears',()=>{
 for(const [blue,red,outcome] of [[120,140,'defeat'],[125,125,'draw'],[125.9,125.1,'draw'],[250,250,'draw']]){const result=finish(blue,red);assert.equal(result.outcome,outcome);assert(!validVictory(result));assert.equal(result.outcome,matchOutcome(result.blue,result.red));}
});
test('250-point victory and defeat terminate before the time limit',()=>{
 const win=finish(250.5,150,215);assert.equal(win.remaining,215);assert.equal(win.blue,250);assert(validVictory(win));
 const loss=finish(150,250.5,215);assert.equal(loss.outcome,'defeat');assert(!validVictory(loss));
});
test('A high score before match end and invalid payloads cannot be submitted as victory',()=>{
 const valid={difficultyId:'bachelor',mapId:'base',blue:249,red:1,remaining:0};assert(validVictory(valid));
 for(const patch of [{remaining:1},{blue:250.1},{blue:-1},{blue:Infinity},{red:NaN},{remaining:-1},{remaining:301},{mapId:'invalid'},{difficultyId:'invalid'}])assert(!validVictory({...valid,...patch}),JSON.stringify(patch));
});
test('Replay gets new match ID and retains explicitly chosen difficulty, with no stale result',()=>{
 const result=finish(250,100,40);const previous=result.matchId;g.start(PRESETS,result.difficultyId);assert.notEqual(g.matchId,previous);assert.equal(g.difficulty.id,'doctor');assert.equal(g.state.result,null);assert.equal(g.blue,0);assert.equal(g.remaining,300);
});
test('Valid victories on every map count regardless of map and base-level order',()=>{
 let clears=[];for(const [i,id] of ['doctor','bachelor','master'].entries()){const result={difficultyId:id,mapId:MAPS[i+2].id,blue:250,red:10,remaining:32};assert(validVictory(result));clears=clearedDifficulties([...clears,result.difficultyId]);assert.equal(isShiraneUnlocked(clears),i===2);}
 for(const map of MAPS)assert(validVictory({difficultyId:'bachelor',mapId:map.id,blue:250,red:100,remaining:10}));
});
g.clearWorld();
console.log(JSON.stringify({passes,measured},null,2));
