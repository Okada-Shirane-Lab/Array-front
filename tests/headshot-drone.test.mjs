import test from 'node:test';
import assert from 'node:assert/strict';
import {T,Game,PRESETS,makeGame} from './combat-harness.mjs';
import {stats,MAPS} from '../engine/model.js';

const dir=(origin,p)=>p.clone().sub(origin).normalize();
function flat(){
 const g=Object.create(Game.prototype);
 Object.assign(g,{mode:'playing',map:'base',keys:{},enemies:[],allies:[],fx:[],time:1,slot:0,loadouts:[{...PRESETS[0],bits:6,width:4,beamCount:1,steering:0,scanWidth:0}],player:new T.Vector3(0,1.72,0),world:new T.Group(),scene:new T.Scene(),camera:new T.PerspectiveCamera(72,1,.06,650),ray:new T.Raycaster(),sharedGeo:{box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)},blocks:[],occluders:[],ground:()=>0,energy:100,heat:0,reload:0,overheat:false,dead:0,fire:true,wptHeld:false,kills:0,headshots:0,headshotKills:0,blue:0,yaw:0,pitch:0,beam:()=>{},spark:()=>{},sound:()=>{},gunshot:()=>{},onState:s=>{g.state=s;},objective:[],objectives:[],scanCooldown:0});
 g.scene.add(g.world);return g;
}
function soldier(g,x=0,z=-20){const e=g.makeSoldier('enemy',x,z,0);e.hp=1e6;g.enemies.push(e);return e;}
function head(g,e){return dir(g.player,e.g.position.clone().add(new T.Vector3(0,1.87,0)));}
function torso(g,e){return dir(g.player,e.g.position.clone().add(new T.Vector3(0,1.25,0)));}
function region(g,e,d,cone=.035){return g.hitRegion(e,g.player,d,100,cone);}
function pulse(g,d,count=1){g.shotDirections=()=>Array.from({length:count},()=>d.clone());g.fire=true;g.energy=100;g.heat=0;g.overheat=false;g.reload=0;g.nextPulseAt=g.time;g.triggerWasHeld=false;g.fireWeapon(1/60);}
function wall(g,height=3,z=-10,x=0,w=10){const b=g.box(w,height,.5,x,height/2,z,g.mat('#777777'));g.occluders.push(b);g.world.updateMatrixWorld(true);return b;}

test('Exact head, helmet and visor rays distinguish head from torso, arms and legs',()=>{
 const g=flat(),e=soldier(g);
 for(const [x,y,expected] of [[0,1.87,true],[.2,2,true],[0,1.83,true],[0,1.25,false],[.46,1.18,false],[.19,.4,false]]){
  const h=region(g,e,dir(g.player,new T.Vector3(x,y,-20)));assert(h,`${x},${y} missed`);assert.equal(h.headshot,expected,`${x},${y}`);
 }
});
test('Rotated actors retain real mesh head discrimination',()=>{for(const angle of [Math.PI/2,Math.PI,Math.PI*1.5]){const g=flat(),e=soldier(g);e.g.rotation.y=angle;assert.equal(region(g,e,head(g,e)).headshot,true);assert.equal(region(g,e,torso(g,e)).headshot,false);}});
test('Head hit applies precisely 1.75 after normal range falloff',()=>{const g=flat(),e=soldier(g),d=head(g,e),h=region(g,e,d),st=stats(g.loadouts[0]);pulse(g,d);const expected=st.shotDamage*(1-.35*h.dist/st.range)*1.75;assert(Math.abs((1e6-e.hp)-expected)<1e-8);assert.equal(g.headshots,1);assert(g.headshotFlash>0);});
test('Torso hit retains ordinary damage and no head counter',()=>{const g=flat(),e=soldier(g),d=torso(g,e),h=region(g,e,d),st=stats(g.loadouts[0]);pulse(g,d);assert(Math.abs((1e6-e.hp)-st.shotDamage*(1-.35*h.dist/st.range))<1e-8);assert.equal(g.headshots,0);});
test('Wide cone and near misses do not expand precision head zone',()=>{const g=flat(),e=soldier(g);for(const p of [new T.Vector3(0,1.25,-20),new T.Vector3(.42,1.87,-20),new T.Vector3(0,2.2,-20)]){const hit=region(g,e,dir(g.player,p),Math.tan(20*Math.PI/180));assert(hit);assert.equal(hit.headshot,false);}});
test('Exposed head over cover is damageable while torso is blocked',()=>{const g=flat(),e=soldier(g);wall(g,1.7);assert.equal(region(g,e,head(g,e)).headshot,true);assert.equal(region(g,e,torso(g,e)),null);const hp=e.hp;pulse(g,head(g,e));assert(e.hp<hp);});
test('Full wall blocks head and body, including wide beam',()=>{const g=flat(),e=soldier(g);wall(g);assert.equal(region(g,e,head(g,e),.4),null);assert.equal(region(g,e,torso(g,e),.4),null);pulse(g,head(g,e));assert.equal(e.hp,1e6);assert.equal(g.headshots,0);});
test('Terrain blocks a head shot',()=>{const g=flat(),e=soldier(g);g.ground=(x,z)=>Math.abs(z+10)<1?3:0;assert.equal(region(g,e,head(g,e)),null);pulse(g,head(g,e));assert.equal(e.hp,1e6);});
test('Drones have no head critical zones, including rotor and body',()=>{const g=flat(),e=g.makeDrone(0,-20,7);g.enemies=[e];e.hp=1e6;for(const dy of [0,.27]){const d=dir(g.player,e.g.position.clone().add(new T.Vector3(0,dy,0))),h=region(g,e,d);assert(h);assert.equal(h.headshot,false);}pulse(g,dir(g.player,e.g.position));assert.equal(g.headshots,0);assert.equal(g.headshotKills,0);});
test('Five coincident beams preserve the shared head and torso damage budgets',()=>{for(const isHead of [false,true]){const one=flat(),e1=soldier(one),d1=isHead?head(one,e1):torso(one,e1);pulse(one,d1,1);const five=flat(),e5=soldier(five),d5=isHead?head(five,e5):torso(five,e5);pulse(five,d5,5);assert(Math.abs(e1.hp-e5.hp)<1e-8);assert.equal(five.headshots,isHead?1:0);}});
test('Wide multi-target shots share each beam budget',()=>{const g=flat();g.loadouts[0]={...g.loadouts[0],mode:'wide',width:40};const a=soldier(g,-2),b=soldier(g,2);pulse(g,new T.Vector3(0,0,-1),5);const total=2e6-a.hp-b.hp;assert(a.hp<1e6&&b.hp<1e6);assert(total<=stats(g.loadouts[0]).shotDamage);assert.equal(g.headshots,0);});
test('Foreground body occludes a rear head for focus mode',()=>{const g=flat(),front=soldier(g,0,-10),rear=soldier(g,0,-20);front.g.position.y=.62;const d=head(g,rear);assert.equal(region(g,front,d).headshot,false);pulse(g,d);assert(front.hp<1e6);assert.equal(rear.hp,1e6);assert.equal(g.headshots,0);});
test('Head kill credits only once across five beams and dead targets stay excluded',()=>{const g=flat(),e=soldier(g);e.hp=.1;pulse(g,head(g,e),5);assert.equal(g.kills,1);assert.equal(g.headshotKills,1);assert.equal(g.blue,3);assert.equal(g.killHeadshot,true);g.time+=1;pulse(g,head(g,e),5);assert.equal(g.kills,1);assert.equal(g.blue,3);});
test('Later ordinary kill changes kill notification without changing headshot tally',()=>{const g=flat(),a=soldier(g);a.hp=.1;pulse(g,head(g,a));const b=soldier(g,3);b.hp=.1;g.time+=1;pulse(g,torso(g,b));assert.equal(g.kills,2);assert.equal(g.headshotKills,1);assert.equal(g.killHeadshot,false);});
test('Reset clears transient head notice but preserves match head counts',()=>{const g=flat(),e=soldier(g);pulse(g,head(g,e));g.resetCombatEffects();assert.equal(g.headshotFlash,0);assert.equal(g.headshots,1);});
test('Targets beyond range and behind firing direction are excluded',()=>{const g=flat(),a=soldier(g,0,-150),b=soldier(g,0,20);assert.equal(region(g,a,head(g,a)),null);assert.equal(region(g,b,new T.Vector3(0,0,-1)),null);});

test('UAV options default safely and off suppresses creation and all respawns on five maps',()=>{
 const g=makeGame();g.beam=()=>{};g.spark=()=>{};
 for(const map of MAPS){
  g.map=map.id;g.start([PRESETS[0]],'master',{dronesEnabled:false});assert.equal(g.enemies.length,7,map.id);assert(g.enemies.every(e=>e.kind==='soldier'));assert.equal(g.allies.length,5);assert.equal(g.state.dronesEnabled,false);assert.equal(g.state.drones,0);
  for(const e of g.enemies){e.dead=.01;e.hp=0;g.updateAI(e,.02);}assert(g.enemies.every(e=>e.kind==='soldier'&&e.dead===0&&e.hp===100),map.id);
  for(let i=0;i<80;i++)g.update(.05);assert.equal(g.enemies.length,7);assert(g.enemies.every(e=>e.kind==='soldier'));assert.equal(g.dronesEnabled,false);
  g.start([PRESETS[0]],'master',{dronesEnabled:true});assert.equal(g.enemies.filter(e=>e.kind==='drone').length,3,map.id);assert.equal(g.state.dronesEnabled,true);
  const drone=g.enemies.find(e=>e.kind==='drone');g.kill(drone,true);drone.dead=.01;g.updateDrone(drone,.02);assert.equal(drone.dead,0);assert.equal(drone.hp,70);
 }
 for(const value of [undefined,null,'false',0]){g.start([PRESETS[0]],'master',{dronesEnabled:value});assert.equal(g.enemies.filter(e=>e.kind==='drone').length,3);}
 g.headshots=8;g.headshotKills=5;g.headshotFlash=.4;g.start([PRESETS[0]],'master',{dronesEnabled:false});assert.equal(g.headshots,0);assert.equal(g.headshotKills,0);assert.equal(g.headshotFlash,0);assert.equal(g.killHeadshot,false);
});
