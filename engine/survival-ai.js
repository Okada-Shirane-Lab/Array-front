// Copy alongside model.js. No rendering/browser dependencies beyond the supplied Game.
import {stats} from './model.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const pointOf=value=>value?.g?.position||value?.position||value;
const live=(game,target)=>target?(!target.dead&&target.hp>0):(!game.dead&&game.hp!==0);
const targetPoint=(game,target)=>target?game.actorPoint(target):game.player.clone().add({x:0,y:-.35,z:0});
const distance2=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;

function budgetFor(game){
 if(!game.survivalAIBudget||game.survivalAIBudget.time!==game.time)game.survivalAIBudget={time:game.time,left:12};
 return game.survivalAIBudget;
}
function sight(game,a,b,reserve=0){
 const budget=budgetFor(game);if(budget.left<=reserve)return null;
 budget.left--;return game.line(a,b);
}
function safeGoal(game,e){
 const z=game.zone;if(!z)return null;
 const p=e.g.position,r=Math.max(0,z.radius),d=Math.hypot(p.x-z.x,p.z-z.z);
 const nx=Number.isFinite(z.nextX)?z.nextX:z.x,nz=Number.isFinite(z.nextZ)?z.nextZ:z.z;
 const nr=Number.isFinite(z.nextRadius)?Math.max(0,z.nextRadius):r;
 const remaining=Number.isFinite(z.endsAt)?z.endsAt-game.time:Number.isFinite(z.remaining)?z.remaining:Infinity;
 const urgent=d>Math.max(0,r-9)||(r<45&&d>r*.62)||(remaining<14&&Math.hypot(p.x-nx,p.z-nz)>nr*.72);
 if(!urgent)return null;
 // Spread entrants around the safe interior instead of stacking every bot at its center.
 const useNext=remaining<14&&nr<r;
 const gx=useNext?nx:z.x,gz=useNext?nz:z.z,gr=useNext?nr:r;
 const angle=(e.index??0)*2.3999632297,offset=Math.min(22,gr*.25);
 return {x:gx+Math.cos(angle)*offset,z:gz+Math.sin(angle)*offset};
}
function acquire(game,e,range){
 const p=e.g.position,shortlist=[];
 for(const other of game.enemies){
  if(other===e||other.dead||other.hp<=0)continue;
  const d=distance2(p,other.g.position);if(d<range*range)shortlist.push({target:other,d});
 }
 if(live(game,null)){const d=distance2(p,game.player);if(d<range*range)shortlist.push({target:null,d});}
 shortlist.sort((a,b)=>a.d-b.d);
 const eye=game.actorPoint(e);eye.y+=.3;
 let tried=false;
 for(const candidate of shortlist.slice(0,3)){
  const visible=sight(game,eye,targetPoint(game,candidate.target),4);
  if(visible===null)break;
  tried=true;
  if(visible){
   const changed=!e.aiHasTarget||e.aiTarget!==candidate.target;
   e.aiTarget=candidate.target;e.aiHasTarget=true;e.aiSeenUntil=game.time+.85;
   if(changed)e.shoot=Math.max(e.shoot||0,(.4+((e.index??0)%5)*.07)*(game.difficulty?.reactionScale||1));
   return;
  }
 }
 if(tried||!shortlist.length){e.aiHasTarget=false;e.aiTarget=null;}
}

/**
 * Each bot is a separate contestant. All 50 must live in game.enemies; allies stays empty.
 * game.seekLoot(e) may apply a nearby pickup and returns its next destination {x,z}|null.
 * game.damageSurvivor(target, amount, e): target===null is the player; e is attacker.
 * Optional game.survivalNavigationTarget(e,goal) supplies a terrain-safe path waypoint.
 */
export function updateSurvivalAI(game,e,dt){
 if(game.mode!=='playing'||e.dead||e.hp<=0||!(dt>0))return;
 const p=e.g.position,index=e.index??0;
 if(!e.aiInitialized){
  e.aiInitialized=true;e.aiHasTarget=false;
  e.thinkAt=Math.max(e.thinkAt||0,game.time+(index%17)*.027);
  e.aiWeapon=stats(e.setup);e.aiRoamAt=0;e.shoot=Math.max(.4,e.shoot||0);
  e.energy=100;e.heat=0;e.aiReload=0;e.aiOverheat=false;e.aiCoolAt=0;
 }
 e.shoot=Math.max(0,e.shoot-dt);
 // Bots pay the same heat, battery and recharge costs as the player's field array.
 const wasReloading=e.aiReload>0;e.aiReload=Math.max(0,e.aiReload-dt);
 if(wasReloading&&e.aiReload===0)e.energy=100;
 if(game.time>=e.aiCoolAt)e.heat=Math.max(0,e.heat-e.aiWeapon.cooling*dt);
 if(e.aiOverheat&&e.heat<25)e.aiOverheat=false;
 if(e.aiHasTarget&&(!live(game,e.aiTarget)||game.time>(e.aiSeenUntil||0))){e.aiHasTarget=false;e.aiTarget=null;}
 const urgent=safeGoal(game,e);
 if(game.time>=e.thinkAt){
  e.thinkAt=game.time+(.4+(index%7)*.045)*(game.difficulty?.thinkScale||1);
  e.aiWeapon=stats(e.setup);
  const range=Math.min(game.difficulty?.sightCap||125,e.aiWeapon.range);
  acquire(game,e,range);
  if(!urgent&&typeof game.seekLoot==='function'){
   const destination=pointOf(game.seekLoot(e));
   e.aiLoot=destination&&Number.isFinite(destination.x)&&Number.isFinite(destination.z)?{x:destination.x,z:destination.z}:null;
  }
  if(game.time>=e.aiRoamAt){
   const z=game.zone||{x:0,z:0,radius:100},angle=index*2.39996+Math.floor(game.time/9)*.7;
   // Explore the current sector. Only the safe-zone priority should pull every bot inward.
   const hop=40+(index%8)*7,limit=Number.isFinite(game.layout?.halfSize)?game.layout.halfSize-8:Infinity;
   let x=clamp(p.x+Math.cos(angle)*hop,-limit,limit),zz=clamp(p.z+Math.sin(angle)*hop,-limit,limit);
   const radius=Math.max(0,z.radius-12),d=Math.hypot(x-z.x,zz-z.z);
   if(d>radius&&d>0){x=z.x+(x-z.x)*radius/d;zz=z.z+(zz-z.z)*radius/d;}
   e.aiRoam={x,z:zz};e.aiRoamAt=game.time+7+(index%5);
  }
 }
 const weapon=e.aiWeapon,enemy=e.aiHasTarget?pointOf(e.aiTarget)||game.player:null;
 let goal=urgent||e.aiLoot||e.aiRoam||p;
 const enemyDistance=enemy?Math.hypot(enemy.x-p.x,enemy.z-p.z):Infinity;
 let dx=0,dz=0;
 if(enemy&&!urgent){
  const preferred=clamp(weapon.range*.32,14,32),ax=(enemy.x-p.x)/Math.max(.01,enemyDistance),az=(enemy.z-p.z)/Math.max(.01,enemyDistance);
  const toward=enemyDistance>preferred?1:enemyDistance<9?-.7:0;
  const strafe=Math.sin(game.time*.8+index*.9)>.15?.4:-.4;
  dx=ax*toward-az*strafe;dz=az*toward+ax*strafe;
 }else{
  if(typeof game.survivalNavigationTarget==='function')goal=game.survivalNavigationTarget(e,goal)||goal;
  dx=goal.x-p.x;dz=goal.z-p.z;
 }
 const length=Math.hypot(dx,dz),moving=length>.3;
 if(moving){
  dx/=length;dz/=length;
  const difficulty=game.difficulty||{},speed=weapon.moveSpeed*(urgent?1.12:.77)*clamp(difficulty.speedScale||1,.8,1.2)*dt;
  const ox=p.x,oz=p.z;
  if((e.aiAvoidUntil||0)>game.time){const a=e.aiAvoidAngle||0,c=Math.cos(a),s=Math.sin(a),x=dx;dx=x*c-dz*s;dz=x*s+dz*c;}
  game.move(p,dx*speed,dz*speed,.5);
  if(Math.hypot(p.x-ox,p.z-oz)<speed*.15){
   const sign=index%2?1:-1,a=sign*(Math.PI/2),c=Math.cos(a),s=Math.sin(a);
   game.move(p,(dx*c-dz*s)*speed,(dx*s+dz*c)*speed,.5);
   e.aiAvoidAngle=sign*Math.PI*.32;e.aiAvoidUntil=game.time+.55;
   e.aiStuck=(e.aiStuck||0)+dt;
   if(e.aiStuck>1.5){e.aiLoot=null;e.aiRoamAt=0;e.aiStuck=0;}
  }else e.aiStuck=0;
 }
 p.y=game.ground(p.x,p.z);
 const look=enemy||goal;
 if(look&&distance2(p,look)>.01)e.g.rotation.y=Math.atan2(look.x-p.x,look.z-p.z);
 if(e.legs?.length>=2&&distance2(p,game.player)<170*170){e.legs[0].rotation.x=moving?Math.sin(game.time*8.5+(e.seed||index))*.35:0;e.legs[1].rotation.x=-e.legs[0].rotation.x;}
 if(!e.aiHasTarget||e.shoot>0||e.aiReload>0||e.aiOverheat||!live(game,e.aiTarget))return;
 const burst=Math.min(3,Math.floor((e.energy+1e-8)/weapon.energyPerShot),Math.max(1,Math.ceil((100-e.heat)/weapon.heatPerShot)));
 if(burst<1){e.aiReload=weapon.reloadSeconds;return;}
 const end=targetPoint(game,e.aiTarget),eye=game.actorPoint(e);eye.y+=.3;
 const distance=eye.distanceTo(end),range=Math.min(game.difficulty?.sightCap||125,weapon.range);
 if(distance>range){e.aiHasTarget=false;return;}
 const visible=sight(game,eye,end);
 if(visible===null){e.shoot=.04;return;}
 if(!visible){e.aiHasTarget=false;e.shoot=.15;return;}
 const difficulty=game.difficulty||{};
 e.shoot=(weapon.shotInterval*burst+.24)*clamp(difficulty.intervalScale||1,.65,1.5)*(.92+Math.random()*.2);
 e.energy=Math.max(0,e.energy-weapon.energyPerShot*burst);e.heat=Math.min(100,e.heat+weapon.heatPerShot*burst);
 e.aiCoolAt=game.time+weapon.shotInterval*burst;if(e.heat>=100)e.aiOverheat=true;
 const stability=clamp(1.1-weapon.spread*4,.85,1.1);
 const chance=clamp((.61-.36*distance/Math.max(1,range))*(.8+clamp(difficulty.infantryAccuracy??.49,.28,.84)*.4)*stability,.17,.64);
 // Identical hit chance and damage apply to human and AI contestants at equal range.
 const beams=Math.max(1,e.setup.beamCount||1);
 const damage=weapon.shotDamage*burst/beams*(1-.2*distance/Math.max(1,Math.min(125,weapon.range)));
 if(distance2(eye,game.player)<140*140||distance2(end,game.player)<140*140){
  game.beam(eye,end,e.setup.color||'#ffc38a',.019);game.gunshot(null,eye);
 }
 if(Math.random()<chance)game.damageSurvivor(e.aiTarget,damage,e);
}
