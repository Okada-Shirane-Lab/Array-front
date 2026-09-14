import * as T from '../engine/three.module.js';
import {Game} from '../engine/game.js';
import {PRESETS} from '../engine/model.js';
export {T,Game,PRESETS};
globalThis.document={pointerLockElement:null};
export function makeGame(loadout={...PRESETS[0]},map='base'){
 const g=Object.create(Game.prototype);
 Object.assign(g,{map,mode:'menu',keys:{},enemies:[],allies:[],fx:[],time:0,acc:0,yaw:0,pitch:0,fire:false,aim:false,sensitivity:1,arrowSensitivity:1,volume:.45,lastHit:-10,slot:0,scan:0,scanCooldown:0,velocityY:0,energy:100,heat:0,overheat:false,reload:0,reloadTotal:0,wptHeld:false,wptProgress:0,wptActive:false,currentSpeed:0,touchMove:{x:0,y:0},player:new T.Vector3(0,1.72,49),ray:new T.Raycaster(),scene:new T.Scene(),camera:new T.PerspectiveCamera(72,1,.06,650),weapon:new T.Group(),world:new T.Group(),sharedGeo:{box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)},onState:s=>{g.state=s;},sound:()=>{},initAudio:()=>{},lock:()=>{}});
 g.scene.add(g.world);g.scene.add(g.camera);g.camera.add(g.weapon);g.start(Array.isArray(loadout)?loadout:[loadout]);return g;
}
export function quiet(g){g.enemies=[];g.allies=[];g.beam=()=>{};g.spark=()=>{};g.updateAI=()=>{};return g;}
export function at(g,x=65,z=60){g.player.set(x,g.ground(x,z)+1.72,z);g.eyeHeight=1.72;g.velocityY=0;g.moving=false;g.camera.position.copy(g.player);g.camera.rotation.set(g.pitch,g.yaw,0,'YXZ');return g;}
export function target(g,distance=20){const e=g.makeSoldier('enemy',g.player.x,g.player.z-distance,0);e.hp=1e6;e.dead=0;e.shoot=1e6;g.enemies=[e];return e;}
