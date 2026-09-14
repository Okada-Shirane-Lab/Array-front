import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeGame,quiet,at,target,PRESETS} from './combat-harness.mjs';
import {SurvivalGame} from '../engine/survival.js';
import {makeSurvivalShell,at as survivalAt,dispose} from './survival-harness.mjs';
import {DEFAULT_KEY_BINDINGS as D, KEY_ACTIONS, normalizeKeyBindings, resolveControlCode, bindingConflict, validKeyCode} from '../engine/controls.js';
const key=(code,extra={})=>({code,repeat:false,preventDefault(){this.prevented=true;},...extra});
const tap=(g,code)=>{g.keyDown(key(code));g.keyUp(key(code));};
const make=()=>quiet(at(makeGame(PRESETS.slice(0,3))));

test('Each action resolves from a new physical key; defaults, corrupt settings and aliases remain deterministic',()=>{
 assert.equal(KEY_ACTIONS.length,25);
 for(const a of KEY_ACTIONS){const b=normalizeKeyBindings({...D,[a.id]:'KeyI'});assert.equal(resolveControlCode('KeyI',b),a.code,a.id);assert.equal(resolveControlCode(a.code,b),null,a.id+' old key');}
 for(const [alias,id] of [['ControlLeft','crouch'],['NumpadEnter','fire'],['Tab','map']]){
  assert.equal(resolveControlCode(alias),D[id]);assert.equal(resolveControlCode(alias,{...D,[id]:'KeyI'}),null);
  assert.equal(resolveControlCode(alias,{...D,forward:alias}),'KeyW','explicit beats alias');
 }
 assert.equal(resolveControlCode('Escape',{...D,pause:'KeyI'}),'Escape');
 assert.equal(validKeyCode('Escape'),false);assert.equal(validKeyCode('F5'),false);
 assert.equal(bindingConflict(D,'fire','KeyW').id,'forward');
 assert.deepEqual(normalizeKeyBindings({...D,fire:'KeyW'}),D);
 assert.deepEqual(normalizeKeyBindings({fire:'Escape'}),D);
});

test('Remapped actual movement, view, jump, sprint, crouch and WPT hold/release follow canonical actions',()=>{
 const g=make();try{
  const b={...D,forward:'KeyI',backward:'KeyK',left:'KeyU',right:'KeyO',lookRight:'KeyL',jump:'Digit4',sprint:'Digit5',crouch:'Digit6',wpt:'Digit7'};g.setKeyBindings(b);
  const before=g.player.clone();g.keyDown(key('KeyW'));g.update(.05);assert(g.player.distanceTo(before)<1e-7);
  g.keyDown(key('KeyI'));g.keyDown(key('KeyO'));g.update(.05);assert(g.player.x>before.x&&g.player.z<before.z);g.keyUp(key('KeyI'));assert.equal(g.keys.KeyW,false);assert.equal(g.keys.KeyD,true);g.keyUp(key('KeyO'));
  const stopped=g.player.clone();g.update(.05);assert(g.player.distanceTo(stopped)<1e-7);
  const yaw=g.yaw;g.keyDown(key('KeyL'));g.update(.05);assert(g.yaw<yaw);assert(g.player.distanceTo(stopped)<1e-7);g.keyUp(key('KeyL'));
  g.keyDown(key('Digit6'));g.update(.05);assert.equal(g.eyeHeight,1.12);g.keyUp(key('Digit6'));g.update(.05);assert.equal(g.eyeHeight,1.72);
  g.keyDown(key('Digit5'));g.keyDown(key('KeyI'));g.update(.05);const sprint=g.currentSpeed;g.keyUp(key('Digit5'));g.update(.05);assert(sprint>g.currentSpeed);g.keyUp(key('KeyI'));
  g.keyDown(key('Digit4'));g.update(.05);assert(g.velocityY>0);g.keyUp(key('Digit4'));
  g.keyDown(key('Digit7'));assert.equal(g.keys.KeyE,true);g.keyUp(key('Digit7'));assert.equal(g.keys.KeyE,false);
 }finally{dispose(g);}
});

test('Remapped actual fire and combat toggles have correct repeat and release behavior',()=>{
 const g=make();try{
  g.setKeyBindings({...D,fire:'KeyK',aim:'KeyI',reload:'KeyO',scan:'KeyU',slot1:'Digit4',slot2:'Digit5',slot3:'Digit6'});
  const e=target(g),hp=e.hp;g.keyDown(key('KeyK'));assert(g.isFiring());g.fireWeapon(.05);assert(e.hp<hp);g.keyUp(key('KeyK'));assert.equal(g.isFiring(),false);
  tap(g,'KeyI');assert.equal(g.aim,true);g.keyDown(key('KeyI',{repeat:true}));assert.equal(g.aim,true);tap(g,'KeyI');assert.equal(g.aim,false);
  for(const [code,slot] of [['Digit5',1],['Digit6',2],['Digit4',0]]){tap(g,code);assert.equal(g.slot,slot);}
  g.energy=20;tap(g,'KeyO');assert(g.reload>0);tap(g,'KeyU');assert(g.scanCooldown>0);
  g.keyDown(key('KeyK'));g.releaseFire();assert.equal(g.isFiring(),false);g.keyDown(key('KeyK',{repeat:true}));assert.equal(g.isFiring(),false);g.keyUp(key('KeyK'));tap(g,'Enter');assert.equal(g.isFiring(),false);g.keyDown(key('KeyK'));assert(g.isFiring());
 }finally{dispose(g);}
});

test('Default aliases hold independently and explicit reassignment cannot cause an extra action',()=>{
 const g=make();try{
  g.keyDown(key('Enter'));g.keyDown(key('NumpadEnter'));g.keyUp(key('Enter'));assert(g.isFiring());g.keyUp(key('NumpadEnter'));assert.equal(g.isFiring(),false);
  g.keyDown(key('KeyC'));g.keyDown(key('ControlLeft'));g.keyUp(key('KeyC'));assert(g.keys.KeyC);g.keyUp(key('ControlLeft'));assert.equal(g.keys.KeyC,false);
  g.setKeyBindings({...D,forward:'ControlLeft'});g.keyDown(key('ControlLeft'));assert(g.keys.KeyW);assert.equal(!!g.keys.KeyC,false);g.keyUp(key('ControlLeft'));
  g.setKeyBindings({...D,fire:'KeyK'});tap(g,'NumpadEnter');assert.equal(g.isFiring(),false);
 }finally{dispose(g);}
});

test('Pause, restart, settings changes and input fields cannot restore residual movement or fire',()=>{
 const g=make();try{
  g.setKeyBindings({...D,forward:'KeyI',fire:'KeyK',pause:'KeyO'});g.keyDown(key('KeyI'));g.keyDown(key('KeyK'));tap(g,'Escape');assert.equal(g.mode,'paused');assert.equal(g.physicalKeys.size,0);g.resume();g.keyDown(key('KeyI',{repeat:true}));g.keyDown(key('KeyK',{repeat:true}));assert.equal(!!g.keys.KeyW,false);assert.equal(g.isFiring(),false);
  tap(g,'KeyP');assert.equal(g.mode,'playing');tap(g,'KeyO');assert.equal(g.mode,'paused');g.resume();
  for(const target of [{tagName:'INPUT'},{tagName:'TEXTAREA'},{isContentEditable:true},{closest:()=>({})}]){g.keyDown(key('KeyI',{target}));g.keyDown(key('KeyK',{target}));assert.equal(g.physicalKeys.size,0);}
  g.keyDown(key('KeyI',{isComposing:true}));assert.equal(g.physicalKeys.size,0);
  g.keyDown(key('KeyI'));g.keyUp(key('KeyI',{target:{tagName:'INPUT'}}));assert.equal(g.keys.KeyW,false);
  g.keyDown(key('KeyI'));g.keyDown(key('KeyK'));g.autoRun=true;g.wptHeld=true;g.setKeyBindings({...D,forward:'KeyU',fire:'KeyL'});assert.equal(g.physicalKeys.size,0);assert.equal(g.autoRun,false);assert.equal(g.wptHeld,false);assert.equal(g.isFiring(),false);assert.equal(!!g.keys.KeyW,false);g.keyDown(key('KeyI',{repeat:true}));assert.equal(!!g.keys.KeyW,false);
  g.keyDown(key('KeyU'));g.start(PRESETS.slice(0,3));assert.equal(g.physicalKeys.size,0);assert.equal(!!g.keys.KeyW,false);g.keyDown(key('KeyU',{repeat:true}));assert.equal(!!g.keys.KeyW,false);
 }finally{dispose(g);}
});

test('Remapped Survival pickup, heal, armor, map and autorun reach their actual actions',()=>{
 const g=makeSurvivalShell(SurvivalGame,'tidal');g.start(undefined,undefined,{mapId:'tidal'});g.updateAI=()=>{};
 try{
  g.setKeyBindings({...D,pickup:'KeyI',heal:'KeyK',armor:'KeyL',map:'KeyO',autorun:'KeyU',forward:'Digit4',backward:'Digit5',fire:'Digit6'});
  const loot=g.loot.find(l=>l.starter==='module'&&l.spawnIndex===0);survivalAt(g,loot.x,loot.z);tap(g,'KeyI');assert.equal(loot.available,false);assert.equal(g.loadouts[0].elements,64);
  g.hp=30;g.inventory.heal=1;g.moving=false;tap(g,'KeyK');assert.equal(g.consume?.resource,'heal');g.consume=null;g.shield=0;g.inventory.shield=1;tap(g,'KeyL');assert.equal(g.consume?.resource,'shield');g.consume=null;
  tap(g,'KeyO');assert.equal(g.mapOpen,true);g.keyDown(key('KeyO',{repeat:true}));assert.equal(g.mapOpen,true);tap(g,'KeyO');assert.equal(g.mapOpen,false);tap(g,'Tab');assert.equal(g.mapOpen,false);
  tap(g,'KeyU');assert.equal(g.autoRun,true);g.update(.05);tap(g,'Digit5');assert.equal(g.autoRun,false);assert.equal(g.keys.KeyW,false);const before=g.player.clone();g.update(.05);assert(Math.hypot(g.player.x-before.x,g.player.z-before.z)<1e-8);
  tap(g,'KeyU');assert.equal(g.autoRun,true);g.setKeyBindings({...D});assert.equal(g.autoRun,false);assert.equal(g.physicalKeys.size,0);assert.equal(!!g.keys.KeyW,false);
  tap(g,'Tab');assert.equal(g.mapOpen,true);tap(g,'KeyM');assert.equal(g.mapOpen,false);
 }finally{dispose(g);}
});

test('Fire keys pressed while dead cannot become active by releasing an alias after respawn',()=>{
 const g=make();try{
  g.dead=1;g.keyDown(key('Enter'));g.keyDown(key('NumpadEnter'));assert.equal(g.isFiring(),false);g.dead=0;g.keyUp(key('Enter'));assert.equal(g.isFiring(),false);g.keyUp(key('NumpadEnter'));assert.equal(g.isFiring(),false);
 }finally{dispose(g);}
});
