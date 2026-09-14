import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGame,quiet,at,target,PRESETS,T,Game} from './combat-harness.mjs';
import {AudioContextMock} from './combat-audio-mock.mjs';
function key(code,repeat=false){return {code,repeat,preventDefault(){}};}
const near=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<eps,`${a} != ${b}`);
test('ADS V toggle ignores repeat and coexists with held right mouse aim',()=>{
 const g=quiet(at(makeGame()));g.keyDown(key('KeyV'));assert.equal(g.aim,true);assert.equal(g.aimToggled,true);g.keyDown(key('KeyV',true));assert.equal(g.aim,true);g.keyUp(key('KeyV'));g.aimHeld=true;g.syncAim();g.keyDown(key('KeyV'));assert.equal(g.aim,true);assert.equal(g.aimToggled,false);g.aimHeld=false;g.syncAim();assert.equal(g.aim,false);
});
test('Dead, paused and result states cannot activate ADS or shoot',()=>{
 for(const state of [{dead:4},{mode:'paused'},{mode:'result'}]){const g=quiet(at(makeGame()));Object.assign(g,state);g.toggleAim();assert.equal(g.aim,false);g.fire=true;const energy=g.energy;g.fireWeapon(.05);assert.equal(g.energy,energy);}
});
test('ADS transitions to exact 2.5x optical magnification and hides weapon',()=>{
 const g=quiet(at(makeGame()));g.toggleAim();for(let i=0;i<180;i++)g.update(1/60);
 const zoom=Math.tan(72*Math.PI/360)/Math.tan(g.camera.fov*Math.PI/360);near(zoom,2.5);assert.equal(g.weapon.visible,false);g.toggleAim();for(let i=0;i<180;i++)g.update(1/60);near(g.camera.fov,72);assert.equal(g.weapon.visible,true);
});
test('Recoil returns smoothly, obeys upper bounds and shares camera direction',()=>{
 const g=quiet(at(makeGame()));g.fire=true;for(let i=0;i<30;i++){g.time=i*.2;g.energy=1e6;g.heat=0;g.fireWeapon(.05);}assert(g.recoilPitch>0&&g.recoilPitch<=.12);assert(Math.abs(g.recoilYaw)<=.035);g.fire=false;const initial=g.recoilPitch;g.update(.05);assert(g.recoilPitch<initial&&g.recoilPitch>0);near(g.camera.rotation.x,g.viewAngles().pitch);near(g.camera.rotation.y,g.viewAngles().yaw);
 for(let i=0;i<120;i++)g.update(1/60);assert(g.recoilPitch<1e-8);assert(Math.abs(g.recoilYaw)<1e-8);
});
test('Muzzle flash activates per pulse and fades, without being tied to HUD update',()=>{
 const g=quiet(at(makeGame()));g.camera.remove(g.weapon);g.weapon=g.makeWeapon();g.camera.add(g.weapon);g.fire=true;g.update(.01);assert.equal(g.shotCount,1);assert(g.muzzleFlash.material.opacity>0);assert(g.muzzleLight.intensity>0);g.fire=false;for(let i=0;i<10;i++)g.update(.01);assert.equal(g.muzzleFlash.material.opacity,0);assert.equal(g.muzzleLight.intensity,0);
});
test('Zero visual shake keeps gameplay recoil and removes camera roll',()=>{
 const g=quiet(at(makeGame()));g.screenShake=0;g.fire=true;g.update(.02);assert(g.recoilPitch>0);assert.equal(g.camera.rotation.z,0);g.screenShake=1;g.update(.02);assert(Math.abs(g.camera.rotation.z)>0);
});
test('Pause and respawn clear ADS, recoil, muzzle flash, camera zoom',()=>{
 const g=quiet(at(makeGame()));g.toggleAim();g.fire=true;g.update(.05);g.pause();assert.equal(g.aim,false);assert.equal(g.recoilPitch,0);assert.equal(g.shotFlash,0);assert.equal(g.camera.fov,72);g.resume();g.dead=.01;g.recoilPitch=.1;g.aim=true;g.shotFlash=.05;g.camera.fov=30;g.update(.05);assert.equal(g.dead,0);assert.equal(g.aim,false);assert.equal(g.recoilPitch,0);assert.equal(g.shotFlash,0);assert.equal(g.camera.fov,72);
});
test('Camera crosshair center and single-beam non-jitter direction coincide with recoil',()=>{
 const g=quiet(at(makeGame({...PRESETS[0],beamCount:1,steering:0,scanWidth:0})));g.pitch=.45;g.yaw=-.6;g.recoilPitch=.08;g.recoilYaw=.02;g.update(.01);const marker=g.aimMarkers()[0];near(marker.x,50);near(marker.y,50);assert.equal(marker.visible,true);
});
test('All beam markers project actual pitch-aware directions for fan and scanning',()=>{
 const g=quiet(at(makeGame({...PRESETS[0],beamCount:5,steering:10,scanWidth:15,split:24})));g.pitch=.8;g.yaw=.3;g.time=1.2;g.update(.01);const directions=g.shotDirections(g.loadouts[0],false),markers=g.aimMarkers();assert.equal(markers.length,5);for(let i=0;i<5;i++){near(directions[i].length(),1);const p=g.player.clone().addScaledVector(directions[i],20).project(g.camera);near(markers[i].x,(p.x+1)*50);near(markers[i].y,(1-p.y)*50);}assert(new Set(markers.map(m=>m.x)).size===5);
});
test('Gunshot synthesis creates transient, body, echo and disconnects after completion',()=>{
 const g=quiet(at(makeGame()));g.audio=new AudioContextMock();g.gunshot(PRESETS[0]);assert.equal(g.audioVoices,1);assert.equal(g.audio.nodes.length,8);const nodes=g.audio.nodes;for(const type of ['buffer-source','oscillator','filter','gain','delay','panner'])assert(nodes.some(n=>n.nodeType===type));assert(nodes.filter(n=>n.nodeType==='buffer-source'||n.nodeType==='oscillator').every(n=>n.startedAt!==null&&n.stoppedAt>n.startedAt));g.audio.flush();assert.equal(g.audioVoices,0);assert(nodes.every(n=>n.disconnectCount===1));
});
test('Gunshot stereo panning follows listener facing and loudness decreases with range',()=>{
 const g=quiet(at(makeGame()));g.audio=new AudioContextMock();const shot=(dx,dz)=>{g.audio.nodes=[];g.gunshot(null,g.player.clone().add(new T.Vector3(dx,0,dz)));const pan=g.audio.nodes.find(n=>n.nodeType==='panner').pan.value,gain=g.audio.nodes.find(n=>n.nodeType==='gain').gain.calls[0][1];g.audio.flush();return {pan,gain};};const right=shot(15,0),left=shot(-15,0),far=shot(50,0);assert(right.pan>.9);assert(left.pan<-.9);assert(far.gain<right.gain);g.yaw=Math.PI;assert(shot(15,0).pan<-.9);
});
test('Gunshot is silent when volume is zero, suspended, out of range or voice cap reached',()=>{
 const g=quiet(at(makeGame()));g.audio=new AudioContextMock();g.volume=0;g.gunshot(PRESETS[0]);assert.equal(g.audio.nodes.length,0);g.volume=.45;g.audio.state='suspended';g.gunshot(PRESETS[0]);assert.equal(g.audio.nodes.length,0);g.audio.state='running';g.gunshot(null,g.player.clone().add(new T.Vector3(150,0,0)));assert.equal(g.audio.nodes.length,0);
 for(let i=0;i<100;i++)g.gunshot(PRESETS[0]);assert.equal(g.audioVoices,24);assert.equal(g.audio.nodes.length,24*8);g.audio.flush();assert.equal(g.audioVoices,0);g.gunshot(PRESETS[0]);assert.equal(g.audioVoices,1);
});
test('Short UI sound and footstep audio nodes disconnect after ending',()=>{
 const g=quiet(at(makeGame()));g.audio=new AudioContextMock();Game.prototype.sound.call(g,300,.1,.1);g.footstep(false,false);assert.equal(g.audio.nodes.length,5);g.audio.flush();assert(g.audio.nodes.every(n=>n.disconnectCount===1));
});
test('Suspended context does not accumulate delayed footsteps or UI tones',()=>{
 const g=quiet(at(makeGame()));g.audio=new AudioContextMock();g.audio.state='suspended';for(let i=0;i<120;i++)g.footstep(false,false);for(let i=0;i<10;i++)Game.prototype.sound.call(g,300,.1,.1);assert.equal(g.audio.nodes.length,0,'audio queued while suspended');
});
