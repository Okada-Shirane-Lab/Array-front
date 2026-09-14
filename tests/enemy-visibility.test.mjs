import test from 'node:test';
import assert from 'node:assert/strict';
import {flat,soldier,drone,wall,point,hud,T} from './enemy-visibility-harness.mjs';
import {enemyMarkers} from '../engine/enemy-markers.js';

for(const survival of [false]){
 const mode=survival?'survival':'conquest';
 test(`${mode}: live exposed infantry produce finite projected coordinates and distance`,()=>{
  const g=flat({survival});soldier(g,3,-20);const ms=hud(g);
  assert.equal(ms.length,1);const m=ms[0];
  assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y));assert.ok(m.x>50&&m.x<100);assert.ok(m.labelY>0&&m.labelY<50);assert.equal(m.distance,20);
 });
 test(`${mode}: low wall reveals head while full wall and terrain hide the enemy`,()=>{
  const g=flat({survival}),e=soldier(g);wall(g,{height:1.7});
  assert.equal(g.line(g.player,point(e,1.82)),true);assert.equal(g.line(g.player,point(e,1.25)),false);assert.equal(hud(g).length,1);
  g.occluders=[];wall(g,{height:3});assert.equal(hud(g).length,0);
  g.occluders=[];g.ground=(x,z)=>Math.abs(z+10)<2?3:0;assert.equal(hud(g).length,0);
 });
 test(`${mode}: head obstruction leaves visible torso eligible`,()=>{
  const g=flat({survival}),e=soldier(g);wall(g,{bottom:1.7,height:1.3});
  assert.equal(g.line(g.player,point(e,1.82)),false);assert.equal(g.line(g.player,point(e,1.25)),true);assert.equal(hud(g).length,1);
 });
 test(`${mode}: LOS to the floating label never reveals a fully hidden actor`,()=>{
  const g=flat({survival}),e=soldier(g);wall(g,{height:1.93});
  assert.equal(g.line(g.player,point(e,1.82)),false);assert.equal(g.line(g.player,point(e,1.25)),false);assert.equal(g.line(g.player,point(e,2.4)),true);assert.equal(hud(g).length,0);
 });
 test(`${mode}: dead, zero-health, hidden and allied actors stay excluded`,()=>{
  for(const change of [e=>{e.dead=1;},e=>{e.hp=0;},e=>{e.g.visible=false;},e=>{e.team='ally';}]){
   const g=flat({survival}),e=soldier(g);assert.equal(hud(g).length,1);change(e);assert.equal(hud(g).length,0);
  }
 });
 test(`${mode}: actors behind, beyond the frustum, near plane and far plane stay excluded`,()=>{
  for(const [x,z] of [[0,20],[100,-10],[-100,-10],[0,-.01],[0,-2000]]){
   const g=flat({survival});soldier(g,x,z);assert.equal(hud(g).length,0,`${x},${z}`);
  }
 });
 test(`${mode}: only gameplay while alive exposes markers`,()=>{
  const g=flat({survival});soldier(g);
  for(const mode of ['menu','paused','result']){g.mode=mode;assert.equal(hud(g).length,0,mode);}
  g.mode='playing';g.dead=1;assert.equal(hud(g).length,0);g.dead=0;assert.equal(hud(g).length,1);
 });
 test(`${mode}: scope narrowing uses the updated projection matrix`,()=>{
  const g=flat({survival});soldier(g,10,-20);assert.ok(hud(g)[0]);
  g.camera.fov=12;g.camera.updateProjectionMatrix();assert.equal(hud(g).length,0);
 });
 test(`${mode}: stale camera matrices are refreshed after yaw changes`,()=>{
  const g=flat({survival});soldier(g);assert.equal(hud(g).length,1);g.camera.rotation.y=Math.PI;assert.equal(hud(g).length,0);g.camera.rotation.y=0;assert.equal(hud(g).length,1);
 });
 test(`${mode}: eight occluded candidates cannot starve a visible off-axis target`,()=>{
  const g=flat({survival});for(let i=0;i<8;i++)soldier(g,0,-15-i);wall(g,{width:2,height:3});const visible=soldier(g,8,-20);assert.equal(g.line(g.player,point(visible,1.82)),true);
  assert.equal(hud(g).length,1);assert.ok(hud(g)[0].x>50);
 });
 test(`${mode}: many visible enemies are limited to eight without duplicate identifiers`,()=>{
  const g=flat({survival});for(let i=0;i<30;i++)soldier(g,-5+i/3,-30);
  const ms=hud(g);assert.equal(ms.length,8);assert.equal(new Set(ms.map(m=>m.id)).size,8);assert.equal(ms.filter(m=>m.focused).length,1);
 });
}

test('drone body is visible at its elevated world center and excluded through walls',()=>{
 const g=flat(),e=drone(g);const ms=hud(g);assert.equal(ms.length,1);assert.equal(ms[0].kind,'drone');assert.ok(ms[0].y<50);wall(g,{height:12});assert.equal(hud(g).length,0);
});

test('frustum rejection happens before expensive terrain and occluder checks',()=>{
 const g=flat();let calls=0;g.line=()=>{calls++;return true;};for(let i=0;i<50;i++)soldier(g,0,10+i);assert.equal(hud(g).length,0);assert.equal(calls,0);
});

test('near plane clipping works when body is aligned to camera height',()=>{
 const g=flat();const e=soldier(g,0,-.01);g.camera.position.y=1.18;assert.equal(enemyMarkers(g).length,0);e.g.position.z=-1;assert.equal(enemyMarkers(g).length,1);
});

test('off-screen head with LOS cannot combine with on-screen occluded torso',()=>{
 const g=flat();g.camera.fov=10;g.camera.position.y=1.18;g.camera.updateProjectionMatrix();const e=soldier(g,0,-5);wall(g,{z:-2.5,height:1.4});
 assert.equal(g.line(g.camera.position,point(e,1.82)),true);assert.equal(g.line(g.camera.position,point(e,1.18)),false);assert.equal(enemyMarkers(g).length,0);
});

test('a fully hidden drone is not identified from a sample floating above its mesh',()=>{
 const g=flat();const e=drone(g);g.camera.position.y=6.32;wall(g,{height:6.315});
 const bounds=new T.Box3().setFromObject(e.g);assert.ok(bounds.max.y<6.3);
 assert.equal(g.line(g.camera.position,new T.Vector3(0,bounds.max.y,bounds.max.z)),false);
 assert.equal(g.line(g.camera.position,point(e,0)),false);
 assert.equal(enemyMarkers(g).length,0);
});


test('started conquest retains markers and survival omits them through the complete HUD emit',async()=>{
 const {makeGame}=await import('./combat-harness.mjs');
 const {makeSurvivalShell,dispose}=await import('./survival-harness.mjs');
 const {SurvivalGame}=await import('../engine/survival.js');
 for(const mode of ['conquest','survival']){
  const g=mode==='conquest'?makeGame():makeSurvivalShell(SurvivalGame,'tidal');
  if(mode==='survival')g.start();
  g.ground=()=>0;g.occluders=[];g.player.set(0,1.72,0);g.camera.position.copy(g.player);g.camera.rotation.set(0,0,0);g.enemies=g.enemies.slice(0,1);g.enemies[0].g.position.set(0,0,-20);g.emit();
  assert.equal(g.state.gameMode,mode);assert.equal(g.state.enemyMarkers.length,mode==='survival'?0:1);if(mode==='conquest')assert.equal(g.state.enemyMarkers[0].kind,'soldier');
  if(mode==='survival'){assert.ok(g.state.activeSetup);assert.deepEqual(g.state.objectiveMarkers,[]);}
  g.enemies[0].dead=1;g.emit();assert.equal(g.state.enemyMarkers.length,0);
  dispose(g);
 }
});


test('survival never exposes enemy markers or distance in any play, scope, scan, map or lifecycle state',()=>{
 const g=flat({survival:true});soldier(g,0,-20);drone(g,3,-30);
 for(const state of [
  {mode:'playing',aim:false,scan:0,mapOpen:false,dead:0,hp:100},
  {mode:'playing',aim:true,scan:0,mapOpen:false,dead:0,hp:100},
  {mode:'playing',aim:false,scan:5,mapOpen:false,dead:0,hp:100},
  {mode:'playing',aim:true,scan:5,mapOpen:true,dead:0,hp:100},
  {mode:'playing',aim:false,scan:5,mapOpen:false,dead:1,hp:0},
  {mode:'menu',aim:false,scan:0,mapOpen:false,dead:0,hp:100},
  {mode:'paused',aim:true,scan:5,mapOpen:false,dead:0,hp:100},
  {mode:'result',aim:false,scan:0,mapOpen:false,dead:1,hp:0},
  {mode:'playing',aim:false,scan:0,mapOpen:false,dead:0,hp:100},
 ]){
  Object.assign(g,state);
  assert.deepEqual(enemyMarkers(g),[],JSON.stringify(state));
  assert.deepEqual(hud(g),[],JSON.stringify(state));
 }
});

test('survival marker suppression skips camera projection and occlusion work entirely',()=>{
 const g=flat({survival:true});soldier(g);
 g.camera.updateMatrixWorld=()=>{throw new Error('marker projection should not run');};
 g.line=()=>{throw new Error('marker visibility rays should not run');};
 assert.deepEqual(enemyMarkers(g),[]);
});
