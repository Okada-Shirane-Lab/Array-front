// Renderer-independent mixed-use city: a ring road, staggered central boulevard,
// six neighbourhoods and enterable ground floors share one four-metre terrain grid.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
export const METRO_MAP={id:'metro',name:'METRO RELAY',jp:'新都心のアレイ市街',tag:'複合市街 / 5種類・36棟の屋内戦',desc:'戸建て、高層マンション、コンビニ、デパート、基地局の一階を探索。外周環状路と段違いの大通りを迂回し、店舗の棚や住宅の家具を遮蔽に使おう。',height:'約27 m',size:1040,weather:'晴れ間 / 15:20',color:'#8c9aab',terrainColor:'#818a87',waterLevel:-20,sky:'#92adbb',horizon:'#c1cfd5'};
let cached=null;
const rawTerrain=(x,z)=>8+27*smooth((x*.55-z+810)/1620)+1.2*Math.sin(x*.004)*Math.cos(z*.005);
function prepare(){
 if(cached)return cached;
 const size=1040,half=size/2,seed=931427,rng=seeded(seed);
 const roads=[
  [[-456,-456],[456,-456],[456,456],[-456,456],[-456,-456]],
  [[-144,-456],[-144,-288],[0,-144],[0,144],[144,288],[144,456]],
  [[-456,-144],[456,-144]],[[-456,144],[456,144]],
  [[-456,-288],[-144,-288]],[[144,-288],[456,-288]],
  [[-456,0],[-144,0],[0,0],[144,0],[456,0]],
  [[-456,288],[-144,288]],[[144,288],[456,288]],
  [[-144,-456],[-144,456]],[[144,-456],[144,456]],
 ];
 const segments=roads.flatMap(r=>r.slice(1).map((p,i)=>[r[i],p])),roadDistance=(x,z)=>Math.min(...segments.map(([a,b])=>segmentDistance(x,z,a,b)));
 const districts=[{x:-288,z:-288,name:'北西の住宅街'},{x:288,z:-288,name:'北東の通信街'},{x:-288,z:0,name:'西の生活商店街'},{x:288,z:0,name:'東の高層住宅街'},{x:-288,z:288,name:'南西の整流市場'},{x:288,z:288,name:'南東の駅前商業街'}];
 const pois=[{id:'P1',name:'中央リレーパーク',x:0,z:0,kind:'urban-square'},...districts.map((d,i)=>({id:`P${i+2}`,name:d.name,x:d.x,z:d.z,kind:'urban-station'})),{id:'P8',name:'北の位相交差点',x:-144,z:-144,kind:'urban-station'},{id:'P9',name:'南の給電交差点',x:144,z:144,kind:'urban-station'}];
 const compounds=[],buildings=[],interiorCover=[],foundations=[];
 const definitions={
  house:{w:36,d:24,h:3.6,heights:[6.4,7.8,8.6],jp:'戸建て'},
  apartment:{w:48,d:48,h:4.8,heights:[48,57,66],jp:'高層マンション'},
  convenience:{w:36,d:36,h:3.6,heights:[4.3,4.6,4.9],jp:'コンビニ'},
  department:{w:72,d:60,h:5.4,heights:[18,21,24],jp:'デパート'},
  'base-station':{w:48,d:36,h:4.2,heights:[6.5,7.5,8.5],jp:'基地局'},
 };
 const kinds=['house','apartment','convenience','department','base-station','house'];
 for(const [di,district] of districts.entries())for(let slot=0;slot<6;slot++){
  const i=compounds.length,ix=slot%3,iz=Math.floor(slot/3),x=district.x+(ix-1)*84,z=district.z+(iz?60:-60),kind=kinds[(slot+di)%6],spec=definitions[kind],axis=(slot+di)%2?'ew':'ns';
  const {w,d,h}=spec,front=axis==='ns'?w:d,depth=axis==='ns'?d:w,door=12,wall=1,facadeHeight=spec.heights[di%3];
  const rotate=(px,pz)=>axis==='ns'?[x+px,z+pz]:[x+pz,z+px];
  // Centred 12 m portals provide a straight, nav-aligned ground-floor escape lane.
  const entrances=[rotate(0,-depth/2),rotate(0,depth/2)];
  const b={id:`metro-building-${i+1}`,name:`${district.name}・${spec.jp} ${slot+1}`,x,z,w,d,h,facadeHeight,kind,axis,doorWidth:door,entrances,district:di+2};
  compounds.push(b);foundations.push({x,z,w:w+6,d:d+6,y:rawTerrain(x,z)});
  const wallPiece=(px,pz,pw,pd)=>{const [bx,bz]=rotate(px,pz);buildings.push([bx,bz,axis==='ns'?pw:pd,axis==='ns'?pd:pw,h]);};
  wallPiece(-front/2,0,wall,depth);wallPiece(front/2,0,wall,depth);
  for(const side of [-1,1])for(const end of [-1,1])wallPiece(side*(front+door)/4,end*depth/2,(front-door)/2,wall);
  const furniture=(px,pz,pw,pd,height,furnitureKind)=>{const [fx,fz]=rotate(px,pz);interiorCover.push([fx,fz,axis==='ns'?pw:pd,axis==='ns'?pd:pw,height,furnitureKind]);};
  // Reserve the centre aisle and central cross-route; shelves never span a portal.
  if(kind==='house'){
   furniture(-front/2+3.5,-depth/2+4,3,5,1.15,'sofa');
   furniture(front/2-3.5,depth/2-4,2,5,1.7,'partition');
  }else if(kind==='convenience'){
   for(const zz of [-10,0,10])furniture(-11,zz,2.2,5,1.7,'shelf');
   furniture(11,0,2.2,5,1.15,'counter');
  }else if(kind==='department'){
   for(const side of [-1,1])for(const zz of [-depth*.29,depth*.29])furniture(side*(front/2-8),zz,3,10,1.9,'shelf');
   furniture(-front*.25,0,4,6,1.2,'counter');
   furniture(front*.25,0,4,6,1.2,'counter');
  }else if(kind==='apartment'){
   furniture(-front/2+5,0,3,10,1.3,'reception');
   furniture(front/2-5,-depth*.25,4,6,1.1,'sofa');
  }else{
   for(const side of [-1,1])for(const zz of [-depth*.23,depth*.23])furniture(side*(front/2-5),zz,3,5,2.4,'server-rack');
  }
 }
 const baseTerrain=(x,z)=>{let y=rawTerrain(x,z);for(const f of foundations){const outside=Math.hypot(Math.max(Math.abs(x-f.x)-f.w/2,0),Math.max(Math.abs(z-f.z)-f.d/2,0));if(outside<18)y+=(f.y-y)*(1-smooth(outside/18));}return y;};
 const rocks=[],routeCover=[],spawns=[],loot=[];
 const indoors=(x,z,margin=0)=>compounds.some(b=>Math.abs(x-b.x)<b.w/2+margin&&Math.abs(z-b.z)<b.d/2+margin);
 const intersects=(x,z,r=1)=>[...buildings,...interiorCover,...routeCover].some(([px,pz,w,d])=>Math.abs(x-px)<w/2+r&&Math.abs(z-pz)<d/2+r);
 const clearSegment=(ax,az,bx,bz,r=.75)=>{const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)));for(let n=0;n<=steps;n++)if(intersects(ax+(bx-ax)*n/steps,az+(bz-az)*n/steps,r))return false;return true;};
 for(let tries=0;spawns.length<51&&tries<80000;tries++){
  const p=[(rng()-.5)*920,(rng()-.5)*920];
  if(indoors(...p,8)||intersects(...p,7)||Math.hypot(...p)<42||pois.some(o=>distance(p,[o.x,o.z])<10)||spawns.some(o=>distance(p,o)<79))continue;
  spawns.push(p);
 }
 if(spawns.length!==51)throw new Error('Metro map: cannot place 51 separated outdoor competitors');
 const stations=pois.map((p,i)=>({id:`wpt-${i+1}`,name:p.name,x:p.x,z:p.z,radius:6}));
 function addLoot(x,z,extra={}){
  if(Math.abs(x)>490||Math.abs(z)>490||intersects(x,z,1.3)||stations.some(p=>Math.hypot(x-p.x,z-p.z)<7)||loot.some(p=>Math.hypot(x-p.x,z-p.z)<5))return false;
  loot.push({id:`metro-loot-${loot.length+1}`,x,z,poiId:null,seed:Math.floor(rng()*0x7fffffff),...extra});return true;
 }
 for(const [spawnIndex,[sx,sz]] of spawns.entries())for(const starter of ['module','wpt']){
  let placed=false;for(let attempt=0;attempt<90;attempt++){const a=rng()*Math.PI*2,r=5+attempt*.06,x=sx+Math.cos(a)*r,z=sz+Math.sin(a)*r;if(!indoors(x,z,2)&&clearSegment(sx,sz,x,z)&&addLoot(x,z,{starter,spawnIndex})){placed=true;break;}}
  if(!placed)throw new Error(`Metro map: missing ${starter} cache at spawn ${spawnIndex}`);
 }
 // Three caches fit fully inside even the smallest house, along its clear aisle.
 for(const b of compounds){
  const depth=b.axis==='ns'?b.d:b.w,offset=Math.min(9,depth/2-3);
  let placed=0;for(const along of [0,-offset,offset]){const x=b.x+(b.axis==='ew'?along:0),z=b.z+(b.axis==='ns'?along:0);if(addLoot(x,z,{poiId:`P${b.district}`,buildingId:b.id,interior:true}))placed++;}
  if(placed!==3)throw new Error(`Metro map: missing interior caches in ${b.id}`);
 }
 // Road shoulders, courtyards and service lanes receive physical cover while
 // the 18 m carriageways, building portals and starting supply routes stay open.
 const coverRng=seeded(seed^0x6a09e667);
 for(let tries=0;routeCover.length<150&&tries<80000;tries++){
  const [a,b]=segments[tries%segments.length],t=.035+coverRng()*.93,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),side=coverRng()<.5?-1:1,offset=15+coverRng()*16;
  const x=a[0]+dx*t-dz/len*offset*side,z=a[1]+dz*t+dx/len*offset*side,tall=routeCover.length%3===0,long=4+coverRng(),short=tall?2.3:1.5,w=Math.abs(dx)>Math.abs(dz)?long:short,d=Math.abs(dx)>Math.abs(dz)?short:long,h=tall?2.15:1.25,r=Math.hypot(w,d)/2;
  if(Math.abs(x)>490-r||Math.abs(z)>490-r||Math.hypot(x,z)<42||roadDistance(x,z)<10+r||indoors(x,z,r+3)||intersects(x,z,r+4)||pois.some(p=>Math.hypot(x-p.x,z-p.z)<22+r)||spawns.some(p=>distance(p,[x,z])<17+r)||compounds.some(c=>c.entrances.some(e=>distance(e,[x,z])<18+r))||loot.some(p=>Math.hypot(x-p.x,z-p.z)<5+r))continue;
  routeCover.push([x,z,w,d,h,tall?'equipment':'barrier']);
 }
 if(routeCover.length!==150)throw new Error(`Metro map: only ${routeCover.length} safe outdoor barriers`);
 for(const p of pois){let n=0;for(let tries=0;n<6&&tries<400;tries++){const a=rng()*Math.PI*2,r=10+rng()*19,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!indoors(x,z,2)&&addLoot(x,z,{poiId:p.id}))n++;}if(n<6)throw new Error(`Metro map: missing plaza supply at ${p.id}`);}
 for(let tries=0;loot.length<300&&tries<24000;tries++){const [a,b]=segments[tries%segments.length],t=rng(),dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),offset=(rng()-.5)*48,x=a[0]+dx*t-dz/len*offset,z=a[1]+dz*t+dx/len*offset;if(!indoors(x,z,2))addLoot(x,z);}
 if(loot.length!==300)throw new Error('Metro map: missing street supply');
 const priority=['elements','bits','beamCount','scope',null,null,null];let supplyIndex=0;for(const p of loot)if(!p.starter)p.category=priority[supplyIndex++%priority.length];
 const step=4,side=size/step+1,heights=new Float32Array(side*side);
 for(let iz=0;iz<side;iz++)for(let ix=0;ix<side;ix++)heights[iz*side+ix]=baseTerrain(ix*step-half,iz*step-half);
 const layout={id:'metro',size,halfSize:half,bounds:[[-half,-half],[half,-half],[half,half],[-half,half]],spawn:spawns[0],spawns,pois,roads,roadWidth:18,buildings,compounds,rocks,routeCover,interiorCover,loot,stations,waterLevel:-20,seed};
 cached={layout,heights,step,side,half};return cached;
}
export function metroLayout(){return prepare().layout;}
export function metroTerrain(x,z){const {heights,step,side,half}=prepare(),gx=clamp((x+half)/step,0,side-1),gz=clamp((z+half)/step,0,side-1),ix=Math.min(side-2,Math.floor(gx)),iz=Math.min(side-2,Math.floor(gz)),fx=gx-ix,fz=gz-iz,index=iz*side+ix;return(heights[index]*(1-fx)+heights[index+1]*fx)*(1-fz)+(heights[index+side]*(1-fx)+heights[index+side+1]*fx)*fz;}
