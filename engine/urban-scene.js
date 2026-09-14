import * as T from './three.module.js';
import {surfaceMaterial} from './visuals.js';

// Street-level interiors are physical. Upper stories are closed building volumes.
// Facade windows, floor bands and vehicle details share a small number of draws.
export function buildUrbanDetails(g){
 const stone=surfaceMaterial('#a8a89e','concrete'),roofMat=surfaceMaterial('#515d60','metal');
 const facades=['#a3a99f','#7d8f91','#b2a18b','#9a9690'].map(c=>surfaceMaterial(c,'concrete'));
 const glass=new T.MeshStandardMaterial({color:'#355b65',roughness:.28,metalness:.6});
 const litGlass=new T.MeshStandardMaterial({color:'#a49b78',emissive:'#7a653b',emissiveIntensity:.3,roughness:.4});
 const dark=surfaceMaterial('#344345','metal'),trim=surfaceMaterial('#c4c7b8','concrete');
 const light=new T.MeshStandardMaterial({color:'#d5eee3',emissive:'#89bcaa',emissiveIntensity:.65});
 const brick=surfaceMaterial('#9d6e52','concrete'),tile=surfaceMaterial('#4b5a64','metal'),shop=surfaceMaterial('#4c987f','metal'),gold=surfaceMaterial('#b39862','metal'),fabric=surfaceMaterial('#747e66','fabric');
 const windows=[],warmWindows=[],bands=[],frames=[],lights=[],vehicleGlass=[],vehicleTrim=[],goods=[],storeBands=[],goldBands=[];
 const signMaterials=new Map();
 const add=(list,x,y,z,w,h,d)=>list.push({x,y,z,w,h,d});
 const signage=(b,y,label,color)=>{
  if(typeof document==='undefined'||typeof document.createElement!=='function')return;
  let mat=signMaterials.get(label);if(!mat){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const c=canvas.getContext('2d');if(!c)return;c.fillStyle=color;c.fillRect(0,0,768,128);c.fillStyle='#f3f1d8';c.font='bold 52px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(label,384,66,728);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;mat=new T.MeshStandardMaterial({map:texture,roughness:.7,emissive:'#ffffff',emissiveMap:texture,emissiveIntensity:.12});signMaterials.set(label,mat);}
  for(const [x,z] of b.entrances){const m=new T.Mesh(new T.PlaneGeometry(Math.min(18,b.doorWidth+4),1.9),mat);m.position.set(x,y+b.h+1.3,z);if(b.axis==='ns'){m.position.z+=Math.sign(z-b.z)*.58;m.rotation.y=z>b.z?0:Math.PI;}else{m.position.x+=Math.sign(x-b.x)*.58;m.rotation.y=x>b.x?Math.PI/2:-Math.PI/2;}g.world.add(m);}
 };
 for(const [i,b] of g.layout.compounds.entries()){
  const y=g.ground(b.x,b.z),top=b.facadeHeight||15,upper=top-b.h;
  const roof=g.box(b.w+.5,.25,b.d+.5,b.x,y+b.h+.125,b.z,roofMat);
  g.occluders.push(roof);
  g.blocks.push({x:b.x,z:b.z,w:(b.w+.5)/2,d:(b.d+.5)/2,bottom:y+b.h,top:y+top+.3,overhead:true});
  if(upper>0){const mass=g.box(b.w,upper,b.d,b.x,y+b.h+upper/2+.25,b.z,b.kind==='house'?brick:b.kind==='convenience'?stone:facades[i%facades.length]);g.occluders.push(mass);}
  // Flush floor markings preserve the heightfield used by walking and AI.
  const floor=new T.Mesh(new T.PlaneGeometry(b.w-.5,b.d-.5),stone);floor.rotation.x=-Math.PI/2;floor.position.set(b.x,y+.025,b.z);floor.receiveShadow=true;g.world.add(floor);
  for(let level=b.h+1.8;level<top-.8;level+=3.6){
   for(let x=-b.w/2+3;x<b.w/2-1;x+=4)for(const side of [-1,1])add((Math.round(x)+i+Math.round(level))%7===0?warmWindows:windows,b.x+x,y+level,b.z+side*(b.d/2+.035),2,1.7,.08);
   for(let z=-b.d/2+3;z<b.d/2-1;z+=4)for(const side of [-1,1])add((Math.round(z)+i)%9===0?warmWindows:windows,b.x+side*(b.w/2+.035),y+level,b.z+z,.08,1.7,2);
   for(const side of [-1,1]){add(bands,b.x,y+level+1.2,b.z+side*(b.d/2+.08),b.w+.2,.16,.2);add(bands,b.x+side*(b.w/2+.08),y+level+1.2,b.z,.2,.16,b.d+.2);}
  }
  for(const side of [-1,1]){add(bands,b.x,y+top+.32,b.z+side*b.d/2,b.w+.3,.4,.4);add(bands,b.x+side*b.w/2,y+top+.32,b.z,.4,.4,b.d+.3);}
  // Bright lintels identify actual open entrances; no fake doors on solid walls.
  for(const [x,z] of b.entrances){
   const alongX=b.axis==='ns',width=b.doorWidth||12;
   add(frames,x,y+b.h-.35,z,alongX?width:.35,.45,alongX?.35:width);
   add(lights,x,y+b.h-.59,z,alongX?width*.7:.12,.07,alongX?.12:width*.7);
  }
  // Ceiling strips make ground-floor routes visible even in deep roof shadow.
  for(const side of [-1,1])add(lights,b.x+side*b.w*.22,y+b.h-.035,b.z,b.w*.23,.045,.24);
  if(b.kind==='house'){
   const shape=new T.Shape();shape.moveTo(-b.w/2-1,0);shape.lineTo(b.w/2+1,0);shape.lineTo(0,3.5);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:b.d+2,bevelEnabled:false});const roof=new T.Mesh(geo,tile);roof.position.set(b.x,y+top+.25,b.z-b.d/2-1);roof.castShadow=true;roof.receiveShadow=true;g.world.add(roof);g.occluders.push(roof);
   for(const side of [-1,1]){const ns=b.axis==='ns';add(warmWindows,b.x+(ns?side*(b.w/2+.035):0),y+1.9,b.z+(ns?0:side*(b.d/2+.035)),ns?.08:3,1.4,ns?3:.08);}
  }else if(b.kind==='convenience'||b.kind==='department'){
   const list=b.kind==='convenience'?storeBands:goldBands;
   for(const side of [-1,1]){add(list,b.x,y+b.h+.9,b.z+side*(b.d/2+.2),b.w+.5,.9,.4);add(list,b.x+side*(b.w/2+.2),y+b.h+.9,b.z,.4,.9,b.d+.5);}
   signage(b,y,b.kind==='convenience'?'ARRAY MART':'PHASE DEPARTMENT',b.kind==='convenience'?'#286b57':'#614d39');
  }else if(b.kind==='base-station'){
   const mast=g.cylinder(.32,23,b.x,y+top+11.5,b.z,dark);g.occluders.push(mast);
   for(let level=6;level<=21;level+=5)for(const side of [-1,1]){add(frames,b.x+side*2,y+top+level,b.z,.28,3.8,.28);add(bands,b.x,y+top+level,b.z,5,.18,.25);}
   for(const side of [-1,1]){add(bands,b.x+side*2.3,y+top+18,b.z,1.8,5.5,.5);add(storeBands,b.x+side*2.3,y+top+18,b.z+.3,1.35,4.9,.1);}
   signage(b,y,'WPT BASE STATION','#2f5862');
  }else{
   add(frames,b.x-b.w*.2,y+top+.8,b.z-b.d*.2,3.6,1.3,3);
   add(bands,b.x+b.w*.22,y+top+.65,b.z+b.d*.2,2.4,1.1,2.4);
   if(b.kind==='apartment'){
    signage(b,y,'RELAY RESIDENCE','#3a4b5c');
    for(let level=b.h+4;level<top-2;level+=7.2)for(const side of [-1,1])add(frames,b.x,y+level,b.z+side*(b.d/2+.7),b.w*.8,.24,1.3);
   }
  }
 }
 for(const [x,z,w,d,h,kind] of g.layout.interiorCover||[]){
  const y=g.ground(x,z),m=g.box(w,h,d,x,y+h/2,z,kind==='sofa'?fabric:kind==='partition'?stone:dark);g.occluders.push(m);g.blocks.push({x,z,w:w/2,d:d/2,bottom:y,top:y+h,interior:true});
  add(bands,x,y+h+.035,z,w+.05,.07,d+.05);
  if(kind==='shelf'||kind==='server-rack')for(let level=.35;level<h;level+=.45){
   for(const side of [-1,1]){const longX=w>d;add(kind==='server-rack'?storeBands:goods,x+(longX?0:side*(w/2+.03)),y+level,z+(longX?side*(d/2+.03):0),longX?w*.8:.06,.18,longX?.06:d*.8);}
  }
  if(kind==='sofa')add(frames,x,y+h*.85,z,w*.85,.18,d*.82);
 }
 // The equipment-sized roadside colliders also serve as parked utility vehicles.
 for(const [x,z,w,d,h,kind] of g.layout.routeCover){
  if(kind!=='equipment')continue;const y=g.ground(x,z),longX=w>d;
  for(const side of [-1,1]){
   add(vehicleGlass,x+(longX?side*w*.2:0),y+h*.76,z+(longX?0:side*d*.2),longX?w*.25:w+.025,.62,longX?d+.025:d*.25);
   add(vehicleTrim,x+(longX?side*w*.46:0),y+.48,z+(longX?0:side*d*.46),longX?.2:w*.86,.26,longX?d*.86:.2);
  }
 }
 const instance=(list,mat)=>{if(!list.length)return;const mesh=new T.InstancedMesh(g.sharedGeo.box,mat,list.length),m=new T.Object3D();for(const [i,v] of list.entries()){m.position.set(v.x,v.y,v.z);m.scale.set(v.w,v.h,v.d);m.updateMatrix();mesh.setMatrixAt(i,m.matrix);}mesh.receiveShadow=true;mesh.computeBoundingSphere();g.world.add(mesh);};
 instance(windows,glass);instance(warmWindows,litGlass);instance(bands,trim);instance(frames,dark);instance(lights,light);instance(vehicleGlass,glass);instance(vehicleTrim,dark);instance(goods,gold);instance(storeBands,shop);instance(goldBands,gold);
 // Sidewalks follow every slope. The road center remains open for long rotations.
 const vertices=[],indices=[];
 for(const road of g.layout.roads)for(let j=1;j<road.length;j++){
  const [ax,az]=road[j-1],[bx,bz]=road[j],length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/4),nx=-(bz-az)/length,nz=(bx-ax)/length;
  for(const side of [-1,1])for(let k=0;k<=steps;k++){
   const x=ax+(bx-ax)*k/steps,z=az+(bz-az)*k/steps,index=vertices.length/3;
   for(const offset of [6.3,9]){const px=x+nx*offset*side,pz=z+nz*offset*side;vertices.push(px,g.ground(px,pz)+.1,pz);}
   if(k<steps)indices.push(index,index+2,index+1,index+1,index+2,index+3);
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const sidewalk=new T.Mesh(geo,surfaceMaterial('#b5b5a9','concrete',{side:T.DoubleSide}));sidewalk.receiveShadow=true;g.world.add(sidewalk);
 g.urbanDetails={buildings:g.layout.compounds.length,windowCount:windows.length+warmWindows.length,interiorCover:(g.layout.interiorCover||[]).length};
}
