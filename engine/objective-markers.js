import {Vector3} from './three.module.js';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

// Navigation remains visible through cover. Distances use the objective center,
// while the label's anchor sits above its antenna, separate from capture logic.
export function objectiveMarkers(camera,player,objectives,width=1280,height=720){
 camera.updateMatrixWorld(true);
 const cx=width/2,cy=height/2;
 const left=width<=650?Math.min(110,width*.32):76,right=width-Math.min(76,width*.22);
 const top=Math.min(190,height*.31),bottom=height-Math.min(205,height*.3);
 const markers=objectives.map(o=>{
  const local=new Vector3(o.x,o.y+6,o.z).applyMatrix4(camera.matrixWorldInverse);
  const projected=new Vector3(o.x,o.y+6,o.z).project(camera);
  const behind=local.z>=0;
  const px=(projected.x+1)*cx,py=(1-projected.y)*cy;
  const onscreen=!behind&&local.z<-.06&&Number.isFinite(px)&&Number.isFinite(py)&&px>=left&&px<=right&&py>=top&&py<=bottom;
  let x=px,y=py,angle=0;
  if(!onscreen){
   // Rear targets indicate the shortest horizontal turn, never a mirrored
   // perspective projection. At exactly 180 degrees either turn is valid.
   let dx=behind?(local.x<-.001?-1:1):local.x*camera.projectionMatrix.elements[0]*cx;
   let dy=behind?0:-local.y*camera.projectionMatrix.elements[5]*cy;
   if(Math.abs(dx)+Math.abs(dy)<.00001){dx=1;dy=0;}
   const scale=Math.min(dx>0?(right-cx)/dx:dx<0?(left-cx)/dx:Infinity,dy>0?(bottom-cy)/dy:dy<0?(top-cy)/dy:Infinity);
   x=cx+dx*scale;y=cy+dy*scale;
   angle=Math.atan2(dy,dx)*180/Math.PI;
  }
  const distance=Math.round(Math.hypot(player.x-o.x,player.z-o.z));
  return {id:o.id,owner:o.owner,progress:o.progress,distance,inside:Math.hypot(player.x-o.x,player.z-o.z)<6.5&&Math.abs(player.y-o.y)<5,behind,offscreen:!onscreen,angle,x:clamp(x,left,right),y:clamp(y,top,bottom)};
 });
 // Reflow a whole column together so a center label cannot block two others
 // from fitting above/below it on a short viewport.
 const groups=[];
 for(const marker of markers){
  const touching=groups.filter(g=>g.some(p=>Math.abs(p.x-marker.x)<132));
  const group=[marker,...touching.flat()];
  for(const g of touching)groups.splice(groups.indexOf(g),1);
  groups.push(group);
 }
 for(const group of groups){
  group.sort((a,b)=>a.y-b.y);
  const gap=group.length>1?Math.min(62,(bottom-top)/(group.length-1)):0;
  const crowded=group.some((m,i)=>i>0&&m.y-group[i-1].y<gap);
  const middle=group.reduce((sum,m)=>sum+m.y,0)/group.length;
  const start=clamp(middle-gap*(group.length-1)/2,top,bottom-gap*(group.length-1));
  for(const [i,m] of group.entries()){
   const y=crowded?start+i*gap:m.y;
   m.anchorOffset=m.y-y;m.x=m.x/width*100;m.y=y/height*100;
  }
 }
 return markers;
}
