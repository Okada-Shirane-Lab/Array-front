import * as T from '../engine/three.module.js';
export {T};
globalThis.document={pointerLockElement:null};

// Uses real engine methods and real Three geometry, without a renderer or DOM.
export function makeSurvivalShell(SurvivalGame,map){
 const g=Object.create(SurvivalGame.prototype);
 Object.assign(g,{map,mode:'menu',keys:{},enemies:[],allies:[],fx:[],time:0,acc:0,yaw:0,pitch:0,fire:false,aim:false,quality:'low',sensitivity:1,arrowSensitivity:1,volume:0,lastHit:-10,slot:0,scan:0,scanCooldown:0,velocityY:0,energy:100,heat:0,overheat:false,reload:0,reloadTotal:0,wptHeld:false,wptProgress:0,wptActive:false,currentSpeed:0,touchMove:{x:0,y:0},player:new T.Vector3(),ray:new T.Raycaster(),scene:new T.Scene(),camera:new T.PerspectiveCamera(72,16/9,.06,1800),weapon:new T.Group(),world:new T.Group(),sharedGeo:{box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)},onState:s=>{g.state=s;},sound:()=>{},initAudio:()=>{},lock:()=>{},beam:()=>{},spark:()=>{},impactDust:()=>{},footstep:()=>{},gunshot:()=>{}});
 g.scene.add(g.world);g.scene.add(g.camera);g.camera.add(g.weapon);
 return g;
}

export function seeded(seed=5812){
 let value=seed;
 return ()=>((value=Math.imul(1664525,value)+1013904223|0)>>>0)/4294967296;
}
export function at(g,x,z){
 g.player.set(x,g.ground(x,z)+1.72,z);g.eyeHeight=1.72;g.velocityY=0;
 g.camera.position.copy(g.player);g.camera.rotation.set(g.pitch,g.yaw,0,'YXZ');
 return g;
}
export function advance(g,seconds,dt=1/30){
 const n=Math.floor(seconds/dt);
 for(let i=0;i<n&&g.mode==='playing';i++)g.update(dt);
 return g;
}
export function dispose(g){g.clearWorld();for(const geo of Object.values(g.sharedGeo))geo.dispose();}
