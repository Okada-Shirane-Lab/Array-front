import assert from 'node:assert/strict';
import test from 'node:test';
import {SurvivalGame} from '../engine/survival.js';
import {SURVIVAL_MAPS,survivalLayout} from '../engine/survival-maps.js';
import {PRESETS,stats,getDifficulty,validVictory} from '../engine/model.js';
import {getSurvivalDifficulty} from '../engine/survival-rules.js';
import {updateSurvivalAI} from '../engine/survival-ai.js';
import {makeSurvivalShell,dispose,T} from './survival-harness.mjs';

const ids=['bachelor','master','doctor','shirane'];
const key=p=>`${p.x},${p.z}`;
function random(value,fn){const previous=Math.random;Math.random=()=>value;try{return fn();}finally{Math.random=previous;}}

test('Every map rerolls safe, unique competitors while preserving cached maps and local starter caches',()=>{
 for(const {id:map} of SURVIVAL_MAPS){
  const layout=survivalLayout(map),snapshot=JSON.stringify(layout),g=makeSurvivalShell(SurvivalGame,map),seen=[];
  try {
   for(let i=0;i<3;i++){
    random(.35,()=>assert.equal(g.start(undefined,undefined,{mapId:map}),true));
    const positions=[g.player,...g.enemies.map(e=>e.g.position)],allowed=new Set(layout.spawns.map(([x,z])=>`${x},${z}`));
    assert.equal(positions.length,51);assert.equal(new Set(positions.map(key)).size,51,map+' unique assignments');
    for(const p of positions){assert(allowed.has(key(p)),map+' approved spawn');assert(!g.blocked(p.x,p.z,.6),map+' safe spawn');assert(Math.hypot(p.x-g.zone.x,p.z-g.zone.z)<g.zone.radius,map+' inside initial zone');}
    const playerIndex=layout.spawns.findIndex(([x,z])=>x===g.player.x&&z===g.player.z);assert(playerIndex>=0);
    if(seen.length)assert.notEqual(playerIndex,seen.at(-1),map+' reroll avoids same spot even with same RNG sample');seen.push(playerIndex);
    const caches=g.loot.filter(l=>l.spawnIndex===playerIndex);assert.equal(caches.length,2);
    for(const l of caches){assert(Math.hypot(l.x-g.player.x,l.z-g.player.z)<14);assert(g.walkableSegment(g.player.x,g.player.z,l.x,l.z,.6),map+' usable starter');}
    const module=caches.find(l=>l.starter==='module'),yaw=Math.atan2(g.player.x-module.x,g.player.z-module.z);assert(Math.abs(g.yaw-yaw)<1e-9,map+' looks toward own starter');
    assert.equal(g.loot.length,300);assert.equal(g.state.enemyMarkers.length,0);assert.equal(JSON.stringify(layout),snapshot,map+' cached layout unchanged');
   }
   console.log(map+' random start indices: '+seen.join(', '));
  }finally{dispose(g);}
 }
});

test('Actual survival start enforces the four-level gate, passes the selected level, and records a non-conquest result',()=>{
 const g=makeSurvivalShell(SurvivalGame,'tidal');
 try {
  assert.equal(g.start(undefined,'shirane'),false);assert.equal(g.mode,'menu');
  assert.equal(g.start(undefined,'invalid'),false);assert.equal(g.mode,'menu');
  assert.equal(g.start(),true);assert.equal(g.difficulty.id,'bachelor');
  const match=g.matchId;assert.equal(g.start(undefined,'shirane'),false);assert.equal(g.matchId,match);assert.equal(g.mode,'playing');
  g.setProgress(['bachelor','master']);assert.equal(g.start(undefined,'shirane'),false);
  g.setProgress(['bachelor','master','doctor']);
  let loadout;
  for(const id of ids){
   assert.equal(g.start(PRESETS,id,{mapId:'tidal'}),true);assert.equal(g.difficulty.id,id);assert.equal(g.state.difficultyId,id);
   const weapon=JSON.stringify(g.loadouts[0]);if(loadout)assert.equal(weapon,loadout,'difficulty preserves starter equipment');loadout=weapon;
   assert.equal(g.hp,100);assert.equal(g.shield,0);assert(g.enemies.every(e=>e.hp===100&&e.shield===0));
   g.finish('victory',1);assert.equal(g.result.difficultyId,id);assert.equal(g.result.gameMode,'survival');assert.equal(validVictory(g.result),false);assert.equal(g.trainingReport(),null);
  }
 }finally{dispose(g);}
});

const setup={...PRESETS[0],elements:256,power:110,bits:6,width:1};
function scenario(id,distance=40,shotReady=false){
 const g={time:1,mode:'playing',dead:0,hp:100,player:new T.Vector3(0,1.72,-distance),enemies:[],zone:{x:0,z:0,radius:720},difficulty:getSurvivalDifficulty(id),ground:()=>0,move:()=>{},line:()=>true,actorPoint:e=>e.g.position.clone().add(new T.Vector3(0,1.25,0)),seekLoot:()=>null,beam:()=>{},gunshot:()=>{},damageLog:[],damageSurvivor(target,amount,source){this.damageLog.push({target,amount,source});}};
 const e={index:0,seed:0,dead:0,hp:100,shield:0,setup:{...setup},g:{position:new T.Vector3(),rotation:{y:0}},legs:[],shoot:0};g.enemies=[e];
 if(shotReady)Object.assign(e,{aiInitialized:true,aiHasTarget:true,aiTarget:null,aiSeenUntil:Infinity,thinkAt:Infinity,aiWeapon:stats(e.setup),aiRoamAt:Infinity,energy:100,heat:0,aiReload:0,aiOverheat:false,aiCoolAt:0});
 return {g,e};
}
function decreasing(values,label){for(let i=1;i<values.length;i++)assert(values[i]<values[i-1],label+': '+values.join(', '));}
function increasing(values,label){for(let i=1;i<values.length;i++)assert(values[i]>values[i-1],label+': '+values.join(', '));}

test('Actual AI reaction, acquisition, burst cadence and accuracy change monotonically without per-hit damage or cost cheats',()=>{
 const reactions=[],thinks=[],sights=[],intervals=[],hits=[],damages=[],energy=[],heat=[];
 for(const id of ids){
  const a=scenario(id,40,true);a.e.aiHasTarget=false;a.e.thinkAt=0;random(.5,()=>updateSurvivalAI(a.g,a.e,.001));assert(a.e.aiHasTarget);reactions.push(a.e.shoot);thinks.push(a.e.thinkAt-a.g.time);
  let last=0;for(let distance=100;distance<=165;distance++){const s=scenario(id,distance);random(.5,()=>updateSurvivalAI(s.g,s.e,.001));if(s.e.aiHasTarget)last=distance;}sights.push(last);
  const fire=scenario(id,40,true);random(0,()=>updateSurvivalAI(fire.g,fire.e,.001));assert.equal(fire.g.damageLog.length,1);intervals.push(fire.e.shoot);damages.push(fire.g.damageLog[0].amount);energy.push(fire.e.energy);heat.push(fire.e.heat);
  let count=0;for(let n=0;n<200;n++){const s=scenario(id,40,true);random(n/200,()=>updateSurvivalAI(s.g,s.e,.001));count+=s.g.damageLog.length;}hits.push(count);
  const wall=scenario(id,40,true);wall.g.line=()=>false;random(0,()=>updateSurvivalAI(wall.g,wall.e,.001));assert.equal(wall.g.damageLog.length,0,id+' fresh occlusion retained');
 }
 decreasing(reactions,'reaction');decreasing(thinks,'think');increasing(sights,'sight');decreasing(intervals,'burst interval');increasing(hits,'hit probability');
 for(const values of [damages,energy,heat])for(const value of values)assert(Math.abs(value-values[0])<1e-9,'difficulty cannot change damage or resource cost: '+values.join(', '));
 assert(Math.abs(reactions[0]-.4)<1e-9,'bachelor original reaction');assert(Math.abs(thinks[0]-.4)<1e-9,'bachelor original think');assert(sights[0]>=124&&sights[0]<=125,'bachelor original range');
 console.log(JSON.stringify({ids,reactions,thinks,sights,intervals,hitsOf200:hits,damages,energy,heat}));
});
