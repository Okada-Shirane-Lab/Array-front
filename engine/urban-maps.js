// Renderer-independent city layout. A shared four-metre height lattice keeps
// floors, collision, first-person motion, and bot navigation on one surface.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
export const URBAN_MAP={id:'urban',name:'BLOCK NINE',jp:'九街区の通信市街',tag:'市街地 / 36棟の屋内戦',desc:'丘に広がる九つの街区。36棟の一階を通り抜け、商店のカウンター、路地と中庭で射線を切る。交差点のWPT給電所を確保し、屋内で部品を集めよう。',height:'約30 m',size:1040,weather:'薄曇り / 16:40',color:'#a38b73',terrainColor:'#77776f',waterLevel:-20,sky:'#87969d',horizon:'#bdc6c8'};
let cached=null;
const rawTerrain=(x,z)=>7+30*smooth((x-z+920)/1840)+1.6*Math.sin(x*.004)*Math.cos(z*.004);
function prepare(){
 if(cached)return cached;
 const size=1040,half=size/2,seed=652193,rng=seeded(seed),roadLines=[-432,-288,-144,0,144,288,432];
 const roads=roadLines.flatMap(v=>[[[v,-480],[v,480]],[[-480,v],[480,v]]]);
 const segments=roads.map(r=>[r[0],r[1]]),roadDistance=(x,z)=>Math.min(...segments.map(([a,b])=>segmentDistance(x,z,a,b)));
 const districtNames=['南西の市場広場','西の交換局前','西高地の旧市庁舎','南のバスターミナル','中央の無線広場','北の受電病院前','南東の整流商店街','東のアンテナ工房前','丘上の位相研究街'];
 const pois=[];for(const x of [-288,0,288])for(const z of [288,0,-288]){const i=pois.length;pois.push({id:`P${i+1}`,name:districtNames[i],x,z,kind:i===4?'urban-square':'urban-station'});}
 const compounds=[],buildings=[],interiorCover=[],foundations=[];
 const centers=[-360,-216,-72,72,216,360];
 for(let iz=0;iz<6;iz++)for(let ix=0;ix<6;ix++){
  const i=compounds.length,x=centers[ix],z=centers[iz],w=(ix+2*iz)%3===0?84:60,d=(2*ix+iz)%3===0?60:84,h=4.8,door=12,wall=1.0,axis=(ix+iz)%2?'ew':'ns';
  const facadeHeight=[12,20,16,24,9,18][(ix+2*iz)%6],kind=['market','apartments','office','workshop'][(ix+iz*3)%4];
  const rotate=(px,pz)=>axis==='ns'?[x+px,z+pz]:[x+pz,z+px];
  // Two diagonal corner portals avoid a long, unbroken street-to-street sightline.
  // Door centres are exact multiples of 12 m, matching the bot navigation grid.
  const front=axis==='ns'?w:d,depth=axis==='ns'?d:w;
  const entrances=[rotate((front-door)/2,-depth/2),rotate(-(front-door)/2,depth/2)];
  const b={id:`urban-building-${i+1}`,x,z,w,d,h,facadeHeight,kind,axis,doorWidth:door,entrances,district:Math.floor(ix/2)*3+(2-Math.floor(iz/2))+1};
  compounds.push(b);foundations.push({x,z,w:w+6,d:d+6,y:rawTerrain(x,z)});
  const wallPiece=(px,pz,pw,pd)=>{const [bx,bz]=rotate(px,pz);buildings.push([bx,bz,axis==='ns'?pw:pd,axis==='ns'?pd:pw,h]);};
  wallPiece(-front/2,0,wall,depth);wallPiece(front/2,0,wall,depth);
  wallPiece(-door/2,-depth/2,front-door,wall);wallPiece(door/2,depth/2,front-door,wall);
  const [fx,fz]=rotate(-front/2+8,0);interiorCover.push([fx,fz,axis==='ns'?3:12,axis==='ns'?12:3,1.25,'counter']);
 }
 const baseTerrain=(x,z)=>{let y=rawTerrain(x,z);for(const f of foundations){const outside=Math.hypot(Math.max(Math.abs(x-f.x)-f.w/2,0),Math.max(Math.abs(z-f.z)-f.d/2,0));if(outside<22)y+=(f.y-y)*(1-smooth(outside/22));}return y;};
 const rocks=[],routeCover=[],spawns=[[-420,420]],loot=[];
 const indoors=(x,z,margin=0)=>compounds.some(b=>Math.abs(x-b.x)<b.w/2+margin&&Math.abs(z-b.z)<b.d/2+margin);
 const intersects=(x,z,r=1)=>[...buildings,...interiorCover,...routeCover].some(([px,pz,w,d])=>Math.abs(x-px)<w/2+r&&Math.abs(z-pz)<d/2+r);
 const clearSegment=(ax,az,bx,bz,r=.75)=>{const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)));for(let n=0;n<=steps;n++)if(intersects(ax+(bx-ax)*n/steps,az+(bz-az)*n/steps,r))return false;return true;};
 for(let tries=0;spawns.length<51&&tries<80000;tries++){
  const p=[(rng()-.5)*920,(rng()-.5)*920];
  if(indoors(...p,8)||intersects(...p,7)||pois.some(o=>distance(p,[o.x,o.z])<10)||spawns.some(o=>distance(p,o)<79))continue;
  spawns.push(p);
 }
 if(spawns.length!==51)throw new Error('Urban map: cannot place 51 separated outdoor competitors');
 const stations=pois.map((p,i)=>({id:`wpt-${i+1}`,name:p.name,x:p.x,z:p.z,radius:6}));
 function addLoot(x,z,extra={}){
  if(Math.abs(x)>490||Math.abs(z)>490||intersects(x,z,1.3)||stations.some(p=>Math.hypot(x-p.x,z-p.z)<7)||loot.some(p=>Math.hypot(x-p.x,z-p.z)<5))return false;
  loot.push({id:`urban-loot-${loot.length+1}`,x,z,poiId:null,seed:Math.floor(rng()*0x7fffffff),...extra});return true;
 }
 for(const [spawnIndex,[sx,sz]] of spawns.entries())for(const starter of ['module','wpt']){
  let placed=false;for(let attempt=0;attempt<90;attempt++){const a=rng()*Math.PI*2,r=5+attempt*.06,x=sx+Math.cos(a)*r,z=sz+Math.sin(a)*r;if(!indoors(x,z,2)&&clearSegment(sx,sz,x,z)&&addLoot(x,z,{starter,spawnIndex})){placed=true;break;}}
  if(!placed)throw new Error(`Urban map: missing ${starter} cache at spawn ${spawnIndex}`);
 }
 // Every enterable building has three visible, reachable caches on the ground floor.
 for(const b of compounds){let placed=0;for(const [dx,dz] of [[0,0],[12,12],[-12,-12],[12,-12],[-12,12],[0,12],[0,-12]])if(placed<3&&addLoot(b.x+dx,b.z+dz,{poiId:`P${b.district}`,buildingId:b.id,interior:true}))placed++;if(placed!==3)throw new Error(`Urban map: missing interior caches in ${b.id}`);}
 // Roadside barriers and equipment break up street approaches without blocking portals.
 const coverRng=seeded(seed^0x6a09e667);
 for(let tries=0;routeCover.length<150&&tries<50000;tries++){
  const [a,b]=segments[tries%segments.length],t=.035+coverRng()*.93,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),side=coverRng()<.5?-1:1,offset=15+coverRng()*12;
  const x=a[0]+dx*t-dz/len*offset*side,z=a[1]+dz*t+dx/len*offset*side,tall=routeCover.length%3===0,long=4+coverRng(),short=tall?2.3:1.5,w=Math.abs(dx)>Math.abs(dz)?long:short,d=Math.abs(dx)>Math.abs(dz)?short:long,h=tall?2.15:1.25,r=Math.hypot(w,d)/2;
  if(roadDistance(x,z)<10+r||indoors(x,z,r+3)||intersects(x,z,r+4)||pois.some(p=>Math.hypot(x-p.x,z-p.z)<22+r)||spawns.some(p=>distance(p,[x,z])<17+r)||compounds.some(c=>c.entrances.some(e=>distance(e,[x,z])<18+r))||loot.some(p=>Math.hypot(x-p.x,z-p.z)<5+r))continue;
  routeCover.push([x,z,w,d,h,tall?'equipment':'barrier']);
 }
 if(routeCover.length!==150)throw new Error(`Urban map: only ${routeCover.length} safe outdoor barriers`);
 for(const p of pois){let n=0;for(let tries=0;n<6&&tries<400;tries++){const a=rng()*Math.PI*2,r=10+rng()*19,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!indoors(x,z,2)&&addLoot(x,z,{poiId:p.id}))n++;}if(n<6)throw new Error(`Urban map: missing plaza supply at ${p.id}`);}
 for(let tries=0;loot.length<300&&tries<24000;tries++){const [a,b]=segments[tries%segments.length],t=rng(),dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),offset=(rng()-.5)*48,x=a[0]+dx*t-dz/len*offset,z=a[1]+dz*t+dx/len*offset;if(!indoors(x,z,2))addLoot(x,z);}
 if(loot.length!==300)throw new Error('Urban map: missing street supply');
 const priority=['elements','bits','beamCount','scope',null,null,null];let supplyIndex=0;for(const p of loot)if(!p.starter)p.category=priority[supplyIndex++%priority.length];
 const step=4,side=size/step+1,heights=new Float32Array(side*side);
 for(let iz=0;iz<side;iz++)for(let ix=0;ix<side;ix++)heights[iz*side+ix]=baseTerrain(ix*step-half,iz*step-half);
 const layout={id:'urban',size,halfSize:half,bounds:[[-half,-half],[half,-half],[half,half],[-half,half]],spawn:spawns[0],spawns,pois,roads,roadWidth:18,buildings,compounds,rocks,routeCover,interiorCover,loot,stations,waterLevel:-20,seed};
 cached={layout,heights,step,side,half};return cached;
}
export function urbanLayout(){return prepare().layout;}
export function urbanTerrain(x,z){const {heights,step,side,half}=prepare(),gx=clamp((x+half)/step,0,side-1),gz=clamp((z+half)/step,0,side-1),ix=Math.min(side-2,Math.floor(gx)),iz=Math.min(side-2,Math.floor(gz)),fx=gx-ix,fz=gz-iz,index=iz*side+ix;return(heights[index]*(1-fx)+heights[index+1]*fx)*(1-fz)+(heights[index+side]*(1-fx)+heights[index+side+1]*fx)*fz;}
