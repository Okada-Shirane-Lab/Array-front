import {Vector3} from './three.module.js';

// Modes can disable identification entirely. Never retain lost enemy positions.
export function enemyMarkers(game,width=1280,height=720){
 if(game.showEnemyMarkers===false||game.mode!=='playing'||game.dead>0||game.hp<=0)return [];
 const camera=game.camera;
 camera.updateMatrixWorld(true);
 const eye=camera.getWorldPosition(new Vector3());
 const project=p=>{const v=p.clone().project(camera);return {x:(v.x+1)*width/2,y:(1-v.y)*height/2,z:v.z};};
 const onscreen=p=>p.z>=-1&&p.z<1&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height;
 const candidates=[];
 for(const [index,e] of game.enemies.entries()){
  if(e.dead>0||e.hp<=0||e.g.visible===false||e.team&&e.team!=='enemy')continue;
  const base=e.g.getWorldPosition(new Vector3()),drone=e.kind==='drone';
  const head=base.clone().add(new Vector3(0,drone?.12:1.82,0));
  const body=base.clone().add(new Vector3(0,drone?0:1.18,0));
  const distance=eye.distanceTo(body);
  // Do not identify specks beyond the visually useful range. Magnified optics
  // extend this naturally through the apparent screen size below.
  if(distance>240)continue;
  const points=[head,body].map(p=>({world:p,screen:project(p)})).filter(p=>onscreen(p.screen));
  if(!points.length)continue;
  const bottom=project(base.clone().add(new Vector3(0,drone?-.4:.15,0))),top=project(drone?base.clone().add(new Vector3(0,.35,0)):head);
  const apparent=Math.abs(bottom.y-top.y);
  if(apparent<4)continue;
  const center=project(body),score=Math.hypot(center.x-width/2,center.y-height/2);
  candidates.push({e,index,head,body,points,distance,center,top,bottom,apparent,score,drone});
 }
 candidates.sort((a,b)=>a.score-b.score||a.distance-b.distance);
 const markers=[];
 // Up to 50 candidates, two occlusion rays each, only on the normal HUD tick.
 // Do not truncate before testing cover: hidden foreground enemies must not
 // prevent visible enemies farther along the list from being marked.
 for(const c of candidates){
  if(!c.points.some(p=>game.line(eye,p.world)))continue;
  const h=Math.min(220,Math.max(20,c.apparent+10));
  const w=Math.min(120,Math.max(18,h*(c.drone?1.55:.55)));
  const aimNear=Math.abs(c.center.x-width/2)<w/2+6&&Math.abs((c.top.y+c.bottom.y)/2-height/2)<h/2+6;
  markers.push({id:c.e.g.uuid||`enemy-${c.index}`,kind:c.drone?'drone':'soldier',distance:Math.round(c.distance),x:c.center.x/width*100,y:c.center.y/height*100,labelY:Math.max(22,Math.min(c.top.y,c.bottom.y)-12)/height*100,boxY:(c.top.y+c.bottom.y)/2/height*100,boxWidth:w,boxHeight:h,focused:aimNear&&!markers.some(m=>m.focused)});
  if(markers.length===8)break;
 }
 // Preserve each physical anchor; suppress overlapping text, not the marker.
 const labels=[];
 for(const m of markers){m.compact=!m.focused&&labels.some(p=>Math.abs(p.x-m.x)*width/100<94&&Math.abs(p.labelY-m.labelY)*height/100<28);if(!m.compact)labels.push(m);}
 return markers;
}
