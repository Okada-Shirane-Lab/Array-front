import * as T from './three.module.js';
import {surfaceMaterial,skyDome,waterMaterial,batchSmallDetails} from './visuals.js';
import {buildUrbanDetails} from './urban-scene.js';
import {SURVIVAL_MAPS,survivalLayout} from './survival-maps.js';

export function buildSurvivalScene(g,id){
 g.clearWorld();g.map=id;g.layout=survivalLayout(id);g.mode='menu';g.weapon.visible=false;
 g.loot=[];g.stations=[];g.botMaterials=null;g.survivalNav=null;g.mapOpen=false;g.consume=null;
 const coast=id==='tidal',urban=['urban','metro'].includes(id),meta=SURVIVAL_MAPS.find(m=>m.id===id);
 g.camera.far=2300;g.camera.updateProjectionMatrix();
 g.scene.background=new T.Color(meta.horizon);g.scene.fog=new T.Fog(meta.horizon,170,1050);
 g.sky=skyDome(urban?'works':coast?'river':'ridge');g.sky.scale.setScalar(3.5);g.world.add(g.sky);
 g.world.add(new T.HemisphereLight(coast?'#d3e6ee':'#d6e0ed',coast?'#585e46':'#424c3c',1.25));
 const sun=new T.DirectionalLight(coast?'#ffd7a0':'#ffeac9',3.2);sun.position.set(-260,300,-170);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:1,far:700});sun.shadow.normalBias=.08;sun.shadow.bias=-.00012;g.world.add(sun,sun.target);g.survivalSun=sun;
 const groundGeo=new T.PlaneGeometry(1400,1400,280,280);groundGeo.rotateX(-Math.PI/2);
 const p=groundGeo.attributes.position,colors=[],color=new T.Color(),rockColor=new T.Color(coast?'#8c8770':'#818a87');
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=g.ground(x,z),slope=Math.hypot(g.ground(x+2,z)-y,g.ground(x,z+2)-y)/2;p.setY(i,y);color.set(urban?'#858783':coast?(y<2?'#a6a48a':'#71836a'):'#64765b');color.lerp(rockColor,Math.min(.85,slope*.95));color.multiplyScalar(.9+.1*Math.sin(x*.032+z*.012)*Math.cos(z*.038));colors.push(color.r,color.g,color.b);}
 groundGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));groundGeo.computeVertexNormals();g.groundMesh=new T.Mesh(groundGeo,surfaceMaterial('#ffffff',urban?'road':'ground',{vertexColors:true}));g.groundMesh.receiveShadow=true;g.world.add(g.groundMesh);
 const concrete=surfaceMaterial(coast?'#a1a29b':'#939b98','concrete'),metal=surfaceMaterial('#536669','metal',{metalness:.52}),dark=surfaceMaterial('#303b3b','metal'),trim=surfaceMaterial('#bec2b5','concrete'),orange=surfaceMaterial('#b98049','metal'),glass=new T.MeshStandardMaterial({color:'#446b76',metalness:.5,roughness:.23});
 const addBlock=(x,z,w,d,h,mat=concrete)=>{const y=g.ground(x,z),m=g.box(w,h,d,x,y+h/2,z,mat);g.blocks.push({x,z,w:w/2,d:d/2,bottom:y,top:y+h});g.occluders.push(m);return m;};
 g.layout.buildings.forEach(([x,z,w,d,h])=>{addBlock(x,z,w,d,h);g.box(w+.08,.15,d+.08,x,g.ground(x,z)+h,z,trim);});
 if(urban)buildUrbanDetails(g);
 for(const b of (urban?[]:g.layout.compounds)){const y=g.ground(b.x,b.z);const roof=g.box(b.w+1,.28,b.d+1,b.x,y+b.h+.18,b.z,metal);g.occluders.push(roof);g.blocks.push({x:b.x,z:b.z,w:(b.w+1)/2,d:(b.d+1)/2,bottom:y+b.h+.04,top:y+b.h+.32,overhead:true});for(const side of [-1,1])for(let j=-2;j<=2;j++){g.box(.15,b.h,.18,b.x+side*(b.w/2+.5),y+b.h/2,b.z+j*b.d/5,dark);g.box(.1,.12,b.d,b.x+side*(b.w/2+.6),y+b.h*.65,b.z,trim);}g.box(b.w*.36,.18,b.d*.4,b.x,y+b.h+.5,b.z,glass);for(let j=0;j<4;j++)g.box(1.4,.7,1.1,b.x-b.w*.3+j*2,y+.35,b.z-b.d*.27,j%2?dark:orange);}
 const rockGeo=new T.DodecahedronGeometry(1,1),rockMat=surfaceMaterial(coast?'#7a827b':'#808784','stone');
 for(const [x,z,w,d,h] of g.layout.rocks){const y=g.ground(x,z),m=new T.Mesh(rockGeo,rockMat);m.position.set(x,y+h*.35,z);m.scale.set(w*.6,h*.7,d*.6);m.rotation.y=x*.05;m.receiveShadow=true;m.castShadow=true;g.world.add(m);g.occluders.push(m);g.blocks.push({x,z,w:w/2,d:d/2,bottom:y,top:y+h});}
 // Physical roadside protection uses two instanced draws for all 150 props.
 g.routeCoverMeshes=[];
 for(const kind of ['barrier','equipment']){
  const props=g.layout.routeCover.filter(p=>p[5]===kind),mesh=new T.InstancedMesh(g.sharedGeo.box,kind==='equipment'?metal:concrete,props.length),matrix=new T.Object3D();
  for(const [i,[x,z,w,d,h]] of props.entries()){const y=g.ground(x,z);matrix.position.set(x,y+h/2,z);matrix.scale.set(w,h,d);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);g.blocks.push({x,z,w:w/2,d:d/2,bottom:y,top:y+h,routeCover:true});}
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();g.world.add(mesh);g.occluders.push(mesh);g.routeCoverMeshes.push(mesh);
 }
 // Ground-following roads make the vast landscape readable at human scale.
 for(const road of g.layout.roads){const vertices=[],indices=[];for(let n=1;n<road.length;n++){const [ax,az]=road[n-1],[bx,bz]=road[n],len=Math.hypot(bx-ax,bz-az),steps=Math.ceil(len/3),nx=-(bz-az)/len,nz=(bx-ax)/len;for(let k=0;k<=steps;k++){const x=ax+(bx-ax)*k/steps,z=az+(bz-az)*k/steps,i=vertices.length/3;for(const side of [-6,6])vertices.push(x+nx*side,g.ground(x+nx*side,z+nz*side)+.07,z+nz*side);if(k<steps)indices.push(i,i+2,i+1,i+1,i+2,i+3);if(k%8===0){const line=g.box(.22,.035,3.5,x,g.ground(x,z)+.12,z,trim);line.rotation.y=Math.atan2(bx-ax,bz-az);line.castShadow=false;}}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const m=new T.Mesh(geo,surfaceMaterial(coast?'#68716b':'#5a645e','road'));m.receiveShadow=true;g.world.add(m);}
 for(const [i,poi] of g.layout.pois.entries()){
  const {x,z}=poi,y=g.ground(x,z);const tall=poi.kind==='tower'||poi.kind==='uplink';
  // A physical WPT installation: mast, panel array, receiver rack, and lit pads.
  const pole=g.cylinder(.3,tall?35:14,x,y+(tall?17.5:7),z,metal);g.blocks.push({x,z,w:.5,d:.5,bottom:y,top:y+14});g.occluders.push(pole);
  const panel=new T.Group();panel.position.set(x,y+(tall?29:10),z);panel.rotation.y=i*.7;g.world.add(panel);
  g.box(6,3.6,.35,0,0,0,metal,panel);for(let a=0;a<8;a++)for(let b=0;b<4;b++)g.box(.55,.55,.08,(a-3.5)*.7,(b-1.5)*.75,.23,glass,panel);
  for(const dx of [-1.4,1.4]){const strut=g.box(.1,14,.1,x+dx,y+7,z,metal);strut.rotation.z=dx*.07;}
  const pad=new T.Mesh(new T.RingGeometry(5.6,5.85,48),new T.MeshBasicMaterial({color:'#93e5d8',transparent:true,opacity:.7}));pad.rotation.x=-Math.PI/2;pad.position.set(x,y+.1,z);g.world.add(pad);
  g.stations.push({...g.layout.stations[i],y,emitter:new T.Vector3(x,y+8,z)});
  if(['radar','observatory','lab'].includes(poi.kind)){const px=x+17,pz=z+4,py=g.ground(px,pz);g.cylinder(2,7,px,py+3.5,pz,concrete);const dish=new T.Mesh(new T.SphereGeometry(8,24,14,0,Math.PI*2,0,Math.PI*.5),trim);dish.position.set(px,py+12,pz);dish.rotation.x=.6;dish.castShadow=true;g.world.add(dish);g.cylinder(.12,11,px,py+12,pz,metal);}
  if(coast&&['port','containers','airfield'].includes(poi.kind)){for(let j=0;j<5;j++){const cx=x-20+j*7,cz=z-20;addBlock(cx,cz,5,11,3,j%2?metal:orange);for(let k=-4;k<=4;k++)g.box(5.08,2.85,.1,cx,g.ground(cx,cz)+1.5,cz+k,trim);}if(poi.kind==='airfield')for(let j=0;j<6;j++)g.box(1,.05,16,x-17+j*7,y+.14,z+25,trim);}
  if(!coast&&['dam','mine','fort'].includes(poi.kind)){for(let j=0;j<4;j++)addBlock(x-19+j*9,z+23,6,3,2.4,concrete);for(const dx of [-22,22]){const t=g.cylinder(.15,22,x+dx,g.ground(x+dx,z)+11,z,metal);g.box(4,.2,4,x+dx,g.ground(x+dx,z)+19,z,metal);t.castShadow=true;}}
 }

 // Distinct silhouettes above the tree line; supports provide physical cover.
 for(const poi of g.layout.pois.filter(p=>!urban&&(coast?['port','tower','airfield'].includes(p.kind):['battery','uplink','observatory'].includes(p.kind)))){
  const x=poi.x+48,z=poi.z-42,y=g.ground(x,z);
  if(coast){
   for(const dx of [-9,9]){addBlock(x+dx,z,1.5,2,27,metal);g.box(1.7,1,2.2,x+dx,y+22,z,orange);}
   const face=new T.Group();face.position.set(x,y+31,z);face.rotation.x=-.2;face.rotation.y=.35;g.world.add(face);g.box(24,13,.8,0,0,0,dark,face);
   for(let a=0;a<12;a++)for(let b=0;b<6;b++)g.box(1.55,1.5,.22,(a-5.5)*1.9,(b-2.5)*1.95,.6,glass,face);
   if(poi.kind==='port'){const cx=x+21;addBlock(cx,z,2.8,3,36,orange);g.box(36,1.4,2.2,cx-6,y+36,z,orange);g.cylinder(.06,23,cx-19,y+24.5,z,dark);g.box(2,.5,1.2,cx-19,y+13,z,dark);}
  }else{
   addBlock(x,z,5,5,16,concrete);const dish=new T.Group();dish.position.set(x,y+25,z);dish.rotation.z=.25;dish.rotation.x=.55;g.world.add(dish);
   const geometry=new T.SphereGeometry(13,36,18,0,Math.PI*2,0,Math.PI*.48),material=surfaceMaterial('#c5c7bb','metal',{side:T.DoubleSide});const reflector=new T.Mesh(geometry,material);reflector.rotation.x=Math.PI;reflector.castShadow=true;dish.add(reflector);g.cylinder(.18,18,0,7,0,metal,dish);for(const sign of [-1,1]){const support=g.box(.18,13,.18,sign*5,2,0,metal,dish);support.rotation.z=sign*.75;}
  }
 }
 // Perimeter cover is clustered at installations, leaving entrances and roads open.
 for(const poi of (urban?[]:g.layout.pois)){for(const sign of [-1,1])for(let j=0;j<3;j++){const x=poi.x+sign*(34+j*5),z=poi.z+15,y=g.ground(x,z);if(!g.blocked(x,z,1.8)&&!g.layout.spawns.some(p=>Math.hypot(p[0]-x,p[1]-z)<8))addBlock(x,z,3.4,1.6,j%2?1.8:1.1,j%2?metal:concrete);}}

 if(coast){g.water=new T.Mesh(new T.PlaneGeometry(1800,1800),waterMaterial());g.water.rotation.x=-Math.PI/2;g.water.position.y=0;g.world.add(g.water);g.waterFlow=new T.Group();g.world.add(g.waterFlow);}
 // Instanced vegetation and rubble add scale without a draw call per prop.
 let seed=g.layout.seed;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const trees=[],stones=[];for(let i=0;i<1300;i++){const x=(random()-.5)*1160,z=(random()-.5)*1160,y=g.ground(x,z);if(y<2||g.layout.pois.some(p=>Math.hypot(x-p.x,z-p.z)<62)||urban&&(i%10!==0||g.blocked(x,z,5)||g.layout.compounds.some(b=>Math.abs(x-b.x)<b.w/2+8&&Math.abs(z-b.z)<b.d/2+8)))continue;const nearRoad=g.layout.roads.some(r=>r.slice(1).some(([bx,bz],i)=>{const [ax,az]=r[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-dx*t,z-az-dz*t)<13;}));if(nearRoad)continue;const height=coast?4+random()*4:7+random()*8;trees.push({x,z,y,h:height});if(i%2===0)stones.push({x:x+3,z:z-2,y:g.ground(x+3,z-2),h:.25+random()*.7});}
 const matrix=new T.Object3D();const instance=(geo,mat,list,shape)=>{const m=new T.InstancedMesh(geo,mat,list.length);list.forEach((v,i)=>{shape(matrix,v,i);matrix.updateMatrix();m.setMatrixAt(i,matrix.matrix);});m.receiveShadow=true;m.castShadow=false;g.world.add(m);return m;};
 instance(new T.CylinderGeometry(.18,.35,1,5),surfaceMaterial('#575a48','stone'),trees,(m,v)=>{m.position.set(v.x,v.y+v.h*.5,v.z);m.scale.set(1,v.h,1);});
 const crown=coast?mergeParts([[new T.DodecahedronGeometry(.31,1).scale(1.35,.85,1).translate(0,.8,0),'#617457'],[new T.DodecahedronGeometry(.26,1).translate(-.2,.62,.09),'#4b624b'],[new T.DodecahedronGeometry(.23,1).translate(.22,.68,-.07),'#718062']]):mergeParts([[new T.ConeGeometry(.27,.53,9).translate(0,.46,0),'#405b4b'],[new T.ConeGeometry(.22,.49,9).translate(0,.65,0),'#4c6855'],[new T.ConeGeometry(.15,.39,9).translate(0,.83,0),'#56705c']]);
 instance(crown,surfaceMaterial('#ffffff','fabric',{vertexColors:true}),trees,(m,v)=>{m.position.set(v.x,v.y,v.z);m.scale.set(v.h,v.h,v.h);m.rotation.y=v.x;});
 g.groundDetail=instance(rockGeo,rockMat,stones,(m,v)=>{m.position.set(v.x,v.y+v.h*.25,v.z);m.scale.set(v.h,v.h*.55,v.h);m.rotation.y=v.z;});
 // Electric exclusion wall: depth-aware, sparse, and large enough for the hills.
 g.zoneWall=new T.Mesh(new T.CylinderGeometry(1,1,260,96,1,true),new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{clock:{value:0}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vP;uniform float clock;void main(){float line=pow(.5+.5*sin(vP.y*.16-clock*1.4),18.0);float grid=pow(.5+.5*sin(atan(vP.z,vP.x)*120.0),18.0);float alpha=.055+line*.1+grid*.06;gl_FragColor=vec4(.28,.65,.93,alpha);}' }));g.zoneWall.position.y=80;g.world.add(g.zoneWall);g.zoneWall.visible=false;
 batchSmallDetails(g);g.world.updateMatrixWorld(true);g.player.set(...[g.layout.spawn[0],g.ground(...g.layout.spawn)+1.72,g.layout.spawn[1]]);
}

// Merge immutable rig parts once; fifty competitors use four draw calls each.
function mergeParts(parts){const attrs={position:[],normal:[],uv:[],color:[]};for(const [geometry,color] of parts){const geo=geometry.index?geometry.toNonIndexed():geometry,c=new T.Color(color);for(const k of ['position','normal','uv'])attrs[k].push(...geo.attributes[k].array);for(let i=0;i<geo.attributes.position.count;i++)attrs.color.push(c.r,c.g,c.b);if(geo!==geometry)geo.dispose();geometry.dispose();}const out=new T.BufferGeometry();for(const [k,v] of Object.entries(attrs))out.setAttribute(k,new T.Float32BufferAttribute(v,k==='uv'?2:3));out.computeBoundingSphere();return out;}
export function makeSurvivalSoldier(g,x,z,index){
 if(!g.botMaterials){const box=(w,h,d,x,y,z)=>new T.BoxGeometry(w,h,d).translate(x,y,z);g.botMaterials={body:surfaceMaterial('#ffffff','fabric',{vertexColors:true}),head:surfaceMaterial('#ffffff','metal',{vertexColors:true}),legs:surfaceMaterial('#596153','fabric')};
  g.botGeometry={body:mergeParts([[new T.CapsuleGeometry(.3,.32,4,8).translate(0,1.25,0),'#687164'],[box(.65,.57,.43,0,1.26,.04),'#3d4844'],[box(.17,.22,.13,-.21,1.18,.3),'#879078'],[box(.17,.22,.13,.02,1.18,.3),'#727d6b'],[box(.14,.15,.8,.21,1.15,.53),'#263c40'],[new T.CapsuleGeometry(.115,.46,3,7).rotateX(-.65).translate(-.38,1.2,.16),'#647260'],[new T.CapsuleGeometry(.115,.46,3,7).rotateX(-.7).translate(.37,1.2,.15),'#647260']]),head:mergeParts([[new T.SphereGeometry(.25,10,8).scale(1,1.1,1).translate(0,1.81,0),'#ad9e86'],[new T.SphereGeometry(.29,12,8,0,Math.PI*2,0,Math.PI*.56).translate(0,1.87,0),'#414f49'],[box(.43,.115,.08,0,1.84,.23),'#2b454c']]),leg:new T.CapsuleGeometry(.135,.5,3,7).translate(0,-.27,0)};
 }
 const group=new T.Group(),body=new T.Mesh(g.botGeometry.body,g.botMaterials.body),head=new T.Mesh(g.botGeometry.head,g.botMaterials.head);head.userData.hitZone='head';group.add(body,head);const legs=[];for(const sign of [-1,1]){const leg=new T.Mesh(g.botGeometry.leg,g.botMaterials.legs);leg.position.set(sign*.19,.79,0);group.add(leg);legs.push(leg);}group.position.set(x,g.ground(x,z),z);group.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});g.world.add(group);return {kind:'soldier',maxHp:100,g:group,body,legs,hitMeshes:[body,head,...legs],hp:100,shield:0,team:'enemy',index,seed:index*1.831,dead:0,shoot:2+index*.031,thinkAt:index*.013};
}
