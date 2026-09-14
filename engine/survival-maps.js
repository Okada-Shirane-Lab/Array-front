import {METRO_MAP,metroLayout,metroTerrain} from './metro-maps.js';
import {URBAN_MAP,urbanLayout,urbanTerrain} from './urban-maps.js';
// Deterministic, renderer-independent survival maps. Coordinates and dimensions are metres.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
const square=n=>n*n;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
const definitions={
 tidal:{
  seed:914271,spawn:[-350,365],
  pois:[['P1','干潟の給電港',-345,285,'port'],['P2','南部整流所',-325,-305,'rectifier'],['P3','位相管制塔',-350,-20,'tower'],['P4','中央アレイ滑走路',-15,-35,'airfield'],['P5','北の追尾レーダー',-20,305,'radar'],['P6','南の変調基地',0,-325,'relay'],['P7','東岸アップリンク',345,275,'uplink'],['P8','蓄電コンテナ埠頭',340,-20,'containers'],['P9','偏波観測岬',350,-300,'observatory']],
  roads:[
   [[-455,285],[-345,285],[-190,265],[-20,305],[160,265],[345,275],[460,285]],
   [[-455,-25],[-350,-20],[-190,-30],[-15,-35],[175,-30],[340,-20],[455,-25]],
   [[-445,-305],[-325,-305],[-170,-310],[0,-325],[175,-305],[350,-300],[455,-305]],
   [[-350,435],[-345,285],[-365,130],[-350,-20],[-340,-170],[-325,-305],[-340,-445]],
   [[-10,440],[-20,305],[10,140],[-15,-35],[10,-160],[0,-325],[5,-445]],
   [[345,430],[345,275],[325,125],[340,-20],[365,-165],[350,-300],[345,-435]],
  ],
 },
 uplink:{
  seed:773081,spawn:[-380,360],
  pois:[['P1','山麓の蓄電基地',-365,335,'battery'],['P2','折り返し中継所',-260,135,'relay'],['P3','干渉計測谷',-20,225,'observatory'],['P4','主給電ダム',20,0,'dam'],['P5','西の局発要塞',-315,-200,'fort'],['P6','山頂アップリンク',205,-180,'uplink'],['P7','高地の位相研究所',325,180,'lab'],['P8','南部整流野営地',-60,-345,'rectifier'],['P9','東の受電鉱山',365,-355,'mine']],
  roads:[
   [[-440,410],[-365,335],[-345,230],[-260,135],[-370,40],[-325,-90],[-315,-200],[-190,-290],[-60,-345],[15,-435]],
   [[-260,135],[-170,230],[-20,225],[90,305],[205,265],[325,180],[390,60],[290,-15],[205,-180],[315,-230],[365,-355],[440,-425]],
   [[-20,225],[-65,110],[20,0],[-100,-75],[-315,-200]],
   [[20,0],[135,75],[290,-15]],
   [[20,0],[95,-110],[205,-180]],
   [[-60,-345],[75,-280],[205,-180]],
   [[-60,-345],[165,-385],[365,-355]],
  ],
 },
};
export const SURVIVAL_MAPS=[
 {id:'tidal',name:'TIDAL ARRAY',jp:'潮汐のアレイ群島',tag:'沿岸 / 3つの連絡堤',desc:'三つの陸地を連絡堤がつなぐ広大な干潟。港と滑走路で装備を集め、堤防を渡るタイミングと岬の高台を選ぶ。',height:'約55 m',size:1040,weather:'海霧 / 17:35',color:'#4f8d92',terrainColor:'#829777',waterLevel:0,sky:'#668d9c',horizon:'#c8d8d2'},
 {id:'uplink',name:'UPLINK HIGHLANDS',jp:'高地のアップリンク渓谷',tag:'山岳 / 折り返し峠道',desc:'二本の長い尾根と深い谷を折り返し道が結ぶ。尾根の射線、谷底の遮蔽、峠の給電所を使い分けて最後まで生き残る。',height:'約70 m',size:1040,weather:'山霧 / 07:20',color:'#78877b',terrainColor:'#74826a',waterLevel:-8,sky:'#788c9c',horizon:'#c2cbd0'},
 URBAN_MAP,
 METRO_MAP,
];
function rawTerrain(id,x,z){
 if(id==='tidal'){
  let h=7+40*Math.exp(-square((x+365)/115)-square((z+185)/195))+48*Math.exp(-square((x-360)/120)-square((z-245)/175))+20*Math.exp(-square(x/140)-square((z+325)/110))+1.7*Math.sin(x*.015)*Math.cos(z*.011);
  const d=Math.min(Math.abs(x-(-160+27*Math.sin(z*.005))),Math.abs(x-(168+24*Math.sin(z*.005+1.1))));
  h=-1.5+(h+1.5)*smooth((d-15)/47);
  return h;
 }
 const valleyBend=35*Math.sin(z*.005);
 return .86*(7+69*Math.exp(-square((x+210-valleyBend)/145))*(.78+.22*Math.cos((z+110)*.004))+79*Math.exp(-square((x-230-valleyBend)/155))*(.8+.2*Math.cos((z-30)*.005))+2.6*Math.sin(x*.019)*Math.cos(z*.013));
}
const cache=new Map();
function prepare(id){
 const key=definitions[id]?id:'tidal';if(cache.has(key))return cache.get(key);
 const source=definitions[key],rng=seeded(source.seed),size=1040,half=size/2;
 const roads=source.roads.map(r=>r.map(p=>[...p]));
 const segments=roads.flatMap(r=>r.slice(1).map((b,i)=>[r[i],b]));
 const roadDistance=(x,z)=>Math.min(...segments.map(([a,b])=>segmentDistance(x,z,a,b)));
 const pois=source.pois.map(([id,name,x,z,kind])=>({id,name,x,z,kind}));
 const plateaus=pois.map(p=>({...p,y:Math.max(4,rawTerrain(key,p.x,p.z))}));
 const foundations=[];
 function baseTerrain(x,z){
  let h=rawTerrain(key,x,z);
  // Shores have 18 m wide solid causeways with 20 m sloping shoulders.
  if(key==='tidal'&&h<4){const d=roadDistance(x,z);if(d<29)h+=(4-h)*(1-smooth((d-9)/20));}
  // Large flat POI aprons, broad shoulders: foundations never perch on steep steps.
  for(const p of plateaus){const d=Math.hypot(x-p.x,z-p.z);if(d<100)h+=(p.y-h)*(1-smooth((d-44)/56));}
  for(const f of foundations){const outside=Math.hypot(Math.max(Math.abs(x-f.x)-f.w/2,0),Math.max(Math.abs(z-f.z)-f.d/2,0));if(outside<12)h+=(f.y-h)*(1-smooth(outside/12));}
  return h;
 }
 const compounds=[],buildings=[];
 for(const [i,p] of pois.entries()){
  // Choose a side of the road with enough space for an open, enterable compound.
  const candidates=[[30,30],[-30,30],[30,-30],[-30,-30],[36,0],[-36,0],[0,36],[0,-36]];
  let best=candidates[0],bestDistance=-1;
  for(const offset of candidates){const d=roadDistance(p.x+offset[0],p.z+offset[1]);if(d>bestDistance){bestDistance=d;best=offset;}}
  const x=p.x+best[0],z=p.z+best[1],w=18+(i%3)*2,d=15+(i%2)*3,h=3.8+(i%3)*.75,door=5,wall=.9;
  foundations.push({x,z,w:w+4,d:d+4,y:plateaus[i].y});
  compounds.push({id:`${p.id}-shelter`,x,z,w,d,h,kind:p.kind,entrances:[[x,z-d/2],[x,z+d/2]]});
  // E/W solid walls; N/S split walls leave two 5 m wide entrances.
  buildings.push([x-w/2,z,wall,d,h],[x+w/2,z,wall,d,h]);
  const span=(w-door)/2;
  for(const side of [-1,1])for(const end of [-1,1])buildings.push([x+side*(door/2+span/2),z+end*d/2,span,wall,h]);
 }
 const rocks=[],routeCover=[];
 const intersects=(x,z,r=1)=>buildings.some(([px,pz,w,d])=>Math.abs(x-px)<w/2+r&&Math.abs(z-pz)<d/2+r)||[...rocks,...routeCover].some(([px,pz,w,d])=>Math.abs(x-px)<w/2+r&&Math.abs(z-pz)<d/2+r);
 const slope=(x,z)=>Math.hypot((baseTerrain(x+1,z)-baseTerrain(x-1,z))/2,(baseTerrain(x,z+1)-baseTerrain(x,z-1))/2);
 // Base rocks keep their original seeded distribution; route cover is added after spawns.
 for(let tries=0;rocks.length<42&&tries<12000;tries++){
  const x=(rng()-.5)*930,z=(rng()-.5)*930,w=3+rng()*6,d=3+rng()*6,h=2.3+rng()*5;
  if(baseTerrain(x,z)<2.5||roadDistance(x,z)<12||pois.some(p=>Math.hypot(x-p.x,z-p.z)<57)||distance([x,z],source.spawn)<20||intersects(x,z,8)||slope(x,z)>.66)continue;
  rocks.push([x,z,w,d,h]);
 }
 const spawns=[[...source.spawn]];
 for(let tries=0;spawns.length<51&&tries<60000;tries++){
  const p=[(rng()-.5)*900,(rng()-.5)*900];
  if(baseTerrain(...p)<2.5||slope(...p)>.55||intersects(...p,7)||spawns.some(other=>distance(p,other)<79))continue;
  spawns.push(p);
 }
 if(spawns.length!==51)throw new Error(`Map ${key}: cannot safely place 51 competitors`);
 const stations=pois.map((p,i)=>({id:`wpt-${i+1}`,name:p.name,x:p.x,z:p.z,radius:6}));
 const loot=[];
 function addLoot(x,z,poiId=null){if(baseTerrain(x,z)<2||intersects(x,z,1.2)||stations.some(p=>Math.hypot(x-p.x,z-p.z)<3)||loot.some(p=>Math.hypot(x-p.x,z-p.z)<5))return false;loot.push({id:`${key}-loot-${loot.length+1}`,x,z,poiId,seed:Math.floor(rng()*0x7fffffff)});return true;}
 // Each spawn gets a guaranteed cache close by, avoiding an empty-handed first minute.
 for(const [spawnIndex,[sx,sz]] of spawns.entries())for(const starter of ['module','wpt']){let placed=false;for(let attempt=0;attempt<24;attempt++){const a=rng()*Math.PI*2,r=5+attempt*.3;if(addLoot(sx+Math.cos(a)*r,sz+Math.sin(a)*r)){Object.assign(loot[loot.length-1],{starter,spawnIndex});placed=true;break;}}if(!placed)throw new Error(`Missing ${starter} cache for spawn ${spawnIndex}`);}
 // Higher density around landmarks, including open interiors; remaining caches are on routes.
 for(const p of pois){for(let tries=0,n=0;n<8&&tries<120;tries++){const a=rng()*Math.PI*2,r=7+rng()*42;if(addLoot(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r,p.id))n++;}}
 for(let tries=0;loot.length<190&&tries<10000;tries++){const segment=segments[Math.floor(rng()*segments.length)],t=rng(),x=segment[0][0]+(segment[1][0]-segment[0][0])*t+(rng()-.5)*20,z=segment[0][1]+(segment[1][1]-segment[0][1])*t+(rng()-.5)*20;addLoot(x,z);}
 // Preserve original competitors and caches while breaking up exposed outdoor approaches.
 // A separate RNG keeps these props independent of spawn and starter placement.
 const coverRandom=seeded(source.seed^0x6a09e667);
 for(let tries=0;routeCover.length<150&&tries<24000;tries++){
  const [a,b]=segments[tries%segments.length],t=.08+coverRandom()*.84,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),side=coverRandom()<.5?-1:1,offset=16+coverRandom()*19;
  const x=a[0]+dx*t-dz/len*offset*side,z=a[1]+dz*t+dx/len*offset*side,tall=routeCover.length%3===0,long=3.6+coverRandom()*1.2,short=tall?2.3:1.5,w=Math.abs(dx)>Math.abs(dz)?long:short,d=Math.abs(dx)>Math.abs(dz)?short:long,h=tall?2.15:1.25,r=Math.hypot(w,d)/2;
  if(baseTerrain(x,z)<2.6||slope(x,z)>.42||roadDistance(x,z)<10+r||pois.some(p=>Math.hypot(x-p.x,z-p.z)<100+r)||spawns.some(p=>distance(p,[x,z])<17+r)||intersects(x,z,r+5)||loot.some(p=>Math.hypot(x-p.x,z-p.z)<r+3))continue;
  routeCover.push([x,z,w,d,h,tall?'equipment':'barrier']);
 }
 if(routeCover.length!==150)throw new Error(`Map ${key}: insufficient safe route cover`);
 // New caches use open aprons: narrow compound interiors and container aisles
 // can lack a link on the existing 12 m bot navigation lattice.
 function addSupplyLoot(x,z,poiId=null){
  if(compounds.some(b=>Math.abs(x-b.x)<b.w/2+2&&Math.abs(z-b.z)<b.d/2+2)||key==='tidal'&&pois.some(p=>['port','containers','airfield'].includes(p.kind)&&Math.abs(x-(p.x-6))<20&&Math.abs(z-(p.z-20))<8))return false;
  return addLoot(x,z,poiId);
 }
 // Revisit all landmarks, then seed both road shoulders. Five metres between caches
 // keeps 300 pickups readable without stacking several rewards on one point.
 for(const p of pois){let n=loot.filter(l=>l.poiId===p.id).length;for(let tries=0;n<16&&tries<1000;tries++){const a=rng()*Math.PI*2,r=7+rng()*43;if(addSupplyLoot(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r,p.id))n++;}}
 for(let tries=0;loot.length<300&&tries<24000;tries++){const [a,b]=segments[tries%segments.length],t=rng(),dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),offset=(rng()-.5)*58;addSupplyLoot(a[0]+dx*t-dz/len*offset,a[1]+dz*t+dx/len*offset);}
 if(loot.length!==300)throw new Error(`Map ${key}: insufficient safe loot positions`);
 // Every seven non-starter caches include all four requested part categories.
 // Free slots retain the full weighted catalog, including consumable WPT cells.
 const priority=['elements','bits','beamCount','scope',null,null,null];let supplyIndex=0;
 for(const p of loot)if(!p.starter)p.category=priority[supplyIndex++%priority.length];
 // Terrain is baked to a 4 m lattice once. A ray/AI ground query then costs O(1).
 const step=4,side=size/step+1,heights=new Float32Array(side*side);
 const spawnFlats=spawns.map(([x,z])=>({x,z,y:baseTerrain(x,z)}));
 for(let iz=0;iz<side;iz++)for(let ix=0;ix<side;ix++){
  const x=ix*step-half,z=iz*step-half;let h=baseTerrain(x,z);
  for(const p of spawnFlats){const d=Math.hypot(x-p.x,z-p.z);if(d<15)h+=(p.y-h)*(1-smooth((d-3)/12));}
  heights[iz*side+ix]=h;
 }
 const layout={id:key,size,halfSize:half,bounds:[[-half,-half],[half,-half],[half,half],[-half,half]],spawn:spawns[0],spawns,pois,roads,roadWidth:18,buildings,compounds,rocks,routeCover,loot,stations,waterLevel:key==='tidal'?0:-8,seed:source.seed};
 const result={layout,heights,step,side,half};cache.set(key,result);return result;
}
export function survivalLayout(id){return id==='metro'?metroLayout():id==='urban'?urbanLayout():prepare(id).layout;}
export function survivalTerrain(id,x,z){
 if(id==='metro')return metroTerrain(x,z);
 if(id==='urban')return urbanTerrain(x,z);
 const {heights,step,side,half}=prepare(id),gx=clamp((x+half)/step,0,side-1),gz=clamp((z+half)/step,0,side-1),ix=Math.min(side-2,Math.floor(gx)),iz=Math.min(side-2,Math.floor(gz)),fx=gx-ix,fz=gz-iz,index=iz*side+ix;
 return (heights[index]*(1-fx)+heights[index+1]*fx)*(1-fz)+(heights[index+side]*(1-fx)+heights[index+side+1]*fx)*fz;
}
export function survivalPlayable(id,x,z,margin=0){const h=survivalLayout(id).halfSize-margin;return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<h&&Math.abs(z)<h;}
