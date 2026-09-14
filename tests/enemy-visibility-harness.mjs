import * as T from '../engine/three.module.js';
import {Game} from '../engine/game.js';
import {PRESETS} from '../engine/model.js';
import {SurvivalGame} from '../engine/survival.js';
import {makeSurvivalSoldier} from '../engine/survival-scene.js';
export {T,Game,SurvivalGame};
export function flat({survival=false,width=1280,height=720}={}){
 const g=Object.create((survival?SurvivalGame:Game).prototype);
 Object.assign(g,{map:survival?'tidal':'base',mode:'playing',keys:{},enemies:[],allies:[],fx:[],time:1,slot:0,loadouts:[{...PRESETS[0]}],player:new T.Vector3(0,1.72,0),world:new T.Group(),scene:new T.Scene(),camera:new T.PerspectiveCamera(72,width/height,.06,survival?1800:650),ray:new T.Raycaster(),sharedGeo:{box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)},blocks:[],occluders:[],ground:()=>0,energy:100,heat:0,reload:0,overheat:false,dead:0,aim:false,fire:false,wptHeld:false,kills:0,headshots:0,headshotKills:0,blue:0,yaw:0,pitch:0,beam:()=>{},spark:()=>{},sound:()=>{},gunshot:()=>{},onState:s=>{g.state=s;},objectives:[],scanCooldown:0});
 if(survival)g.hudExtras=()=>({gameMode:'survival'});
 g.scene.add(g.world);g.scene.add(g.camera);g.camera.position.copy(g.player);g.camera.rotation.order='YXZ';
 return g;
}
export function soldier(g,x=0,z=-20,index=g.enemies.length,team='enemy'){
 const e=g instanceof SurvivalGame?makeSurvivalSoldier(g,x,z,index):g.makeSoldier(team,x,z,index);
 e.team=team;g.enemies.push(e);return e;
}
export function drone(g,x=0,z=-20,index=g.enemies.length){const e=g.makeDrone(x,z,index);g.enemies.push(e);return e;}
export function wall(g,{x=0,z=-10,width=10,height=3,bottom=0,depth=.5}={}){
 const b=g.box(width,height,depth,x,bottom+height/2,z,g.mat('#777777'));g.occluders.push(b);g.world.updateMatrixWorld(true);return b;
}
export function point(e,dy){return e.g.position.clone().add(new T.Vector3(0,dy,0));}
export function hud(g){g.emit();return g.state.enemyMarkers;}
