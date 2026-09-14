import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGame,quiet,at,target,PRESETS,T} from './combat-harness.mjs';
function key(code,repeat=false){return {code,repeat,preventDefault(){this.prevented=true;}};}
test('Enter and numpad Enter hold and release shooting independently',()=>{
 const g=quiet(at(makeGame()));
 for(const code of ['Enter','NumpadEnter']){const ev=key(code);g.keyDown(ev);assert.equal(ev.prevented,true);assert.equal(g.isFiring(),true);g.keyUp(ev);assert.equal(g.isFiring(),false);}
 g.keyDown(key('Enter'));g.keyDown(key('NumpadEnter'));g.keyUp(key('Enter'));assert.equal(g.isFiring(),true);g.releaseFire();assert.equal(g.isFiring(),false);
});
test('Pause clears held shot and residual Enter repeat cannot restart fire',()=>{
 const g=quiet(at(makeGame()));g.keyDown(key('Enter'));g.pause();assert.equal(g.isFiring(),false);const time=g.time;g.update(.05);assert.equal(g.time,time);g.keyDown(key('Enter',true));assert.equal(g.isFiring(),false);g.resume();g.keyDown(key('Enter',true));assert.equal(g.isFiring(),false);g.keyDown(key('Enter'));assert.equal(g.isFiring(),true);
});
test('Arrows rotate view without moving player, at independent sensitivity',()=>{
 const g=quiet(at(makeGame()));const p=g.player.clone();g.arrowSensitivity=.5;g.sensitivity=2.5;g.keys={ArrowRight:true};g.update(.04);const first=g.yaw;assert(first<0);assert(g.player.distanceTo(p)<1e-8);g.yaw=0;g.arrowSensitivity=1;g.sensitivity=.3;g.update(.04);assert(Math.abs(g.yaw-first*2)<1e-9);
});
test('Pointer fallback keeps rotating at the edge and stops in center',()=>{
 const g=quiet(at(makeGame()));g.canvas={ownerDocument:document,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})};g.dragLook=true;g.mouseMove({clientX:999,clientY:300,movementX:0,movementY:0});const yaw=g.yaw;g.updateMouseLook(.05);assert(g.yaw<yaw);g.mouseMove({clientX:500,clientY:300,movementX:0,movementY:0});const centered=g.yaw;g.updateMouseLook(.05);assert.equal(g.yaw,centered);
});
test('WPT blocks damage from all fire input sources',()=>{
 const g=quiet(at(makeGame()));const e=target(g);g.keys={KeyE:true,Enter:true};g.fire=true;const hp=e.hp,energy=g.energy;for(let i=0;i<10;i++){g.time+=.05;g.fireWeapon(.05);}assert.equal(e.hp,hp);assert.equal(g.energy,energy);g.keys={};g.wptHeld=true;for(let i=0;i<10;i++){g.time+=.05;g.fireWeapon(.05);}assert.equal(e.hp,hp);
});
test('Dead and reloading states block damage and resource spend',()=>{
 for(const status of [{dead:4},{reload:2},{overheat:true}]){const g=quiet(at(makeGame()));const e=target(g);Object.assign(g,status,{fire:true});const hp=e.hp,energy=g.energy;g.fireWeapon(.05);assert.equal(e.hp,hp);assert.equal(g.energy,energy);}
});
test('Actual ADS aim reduces mouse and arrow angular speed equally',()=>{
 const g=quiet(at(makeGame()));g.aim=false;g.look(20,-10,1);const hip={yaw:g.yaw,pitch:g.pitch};g.yaw=0;g.pitch=0;g.aim=true;g.look(20,-10,1);assert(g.yaw<0&&g.pitch>0);assert(Math.abs(g.yaw)<Math.abs(hip.yaw));assert(Math.abs(g.pitch)<Math.abs(hip.pitch));
});
