import * as T from './three.module.js';
import {clamp,terrain,stats,riverCenter,WATER_LEVEL,getDifficulty,canPlayDifficulty,clearedDifficulties,matchOutcome,beamOffsets,normalizeSetup,getScope,layoutFor,playable,usageXP} from './model.js';
import {surfaceMaterial,ATMOSPHERES,skyDome,waterMaterial,dustMaterial,addGroundDetail,batchSmallDetails} from './visuals.js';
import {objectiveMarkers} from './objective-markers.js';
import {enemyMarkers} from './enemy-markers.js';
import {normalizeKeyBindings,resolveControlCode,editableKeyTarget} from './controls.js';
const UP=new T.Vector3(0,1,0);
export class Game {
 constructor(canvas,onState){
  this.canvas=canvas;this.onState=onState;this.disposed=false;this.map='base';this.difficulty=getDifficulty('master');this.mode='menu';this.resetKeys();this.enemies=[];this.allies=[];this.fx=[];this.time=0;this.acc=0;this.yaw=0;this.pitch=0;this.fire=false;this.aim=false;this.quality='high';this.sensitivity=1;this.arrowSensitivity=1;this.volume=.45;this.audio=null;this.lastHit=0;this.slot=0;this.scan=0;this.scanCooldown=0;this.velocityY=0;this.energy=100;this.heat=0;this.overheat=false;this.reload=0;this.reloadTotal=0;this.wptHeld=false;this.wptProgress=0;this.wptActive=false;this.currentSpeed=0;this.touchMove={x:0,y:0};this.listeners=[];this.pointerLocked=false;this.pointerLockPending=false;this.lockRequestId=0;this.dragLook=false;this.resetMouseLook();
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(72,innerWidth/innerHeight,.06,650);this.camera.rotation.order='YXZ';this.scene.add(this.camera);this.player=new T.Vector3(0,1.7,43);this.ray=new T.Raycaster();this.weapon=this.makeWeapon();this.camera.add(this.weapon);this.weapon.visible=false;this.world=new T.Group();this.scene.add(this.world);this.sharedGeo={box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)};
  this.screenShake=.7;this.nextPulseAt=0;this.shotCount=0;this.resetCombatEffects();
  this.buildMap('base');
  this.listen(window,'resize',()=>this.resize());
  this.listen(document,'keydown',e=>this.keyDown(e));
  this.listen(document,'keyup',e=>this.keyUp(e));
  this.listen(document,'mousemove',e=>this.mouseMove(e));
  this.listen(document,'mouseleave',()=>this.resetMouseLook());
  this.listen(canvas,'mousedown',e=>{if(this.mode!=='playing'||this.dead)return;this.initAudio();if(e.button===0){this.fire=true;this.lock();}if(e.button===2){this.aimHeld=true;this.syncAim();}});
  this.listen(document,'mouseup',e=>{if(e.button===0)this.fire=false;if(e.button===2){this.aimHeld=false;this.syncAim();}});
  this.listen(canvas,'contextmenu',e=>e.preventDefault());
  this.listen(document,'pointerlockchange',()=>this.pointerLockChanged());
  this.listen(document,'pointerlockerror',()=>this.pointerLockFailed());
  this.listen(document,'visibilitychange',()=>{if(document.hidden)this.pause();});
  this.listen(window,'blur',()=>this.pause());
  this.prev=performance.now();this.animate=this.animate.bind(this);this.frame=requestAnimationFrame(this.animate);
 }
 resetKeys(){this.keys={};this.physicalKeys=new Map();this.autoRun=false;this.fire=false;this.wptHeld=false;}
 setKeyBindings(value){const next=normalizeKeyBindings(value);if(JSON.stringify(this.keyBindings)!==JSON.stringify(next)){this.keyBindings=next;this.resetKeys();}}
 keyDown(e){
  const code=resolveControlCode(e.code,this.keyBindings);
  if(!code||editableKeyTarget(e.target)||e.isComposing)return;
  if(this.mode!=='playing'){if(code==='Enter'&&e.repeat)e.preventDefault();return;}
  e.preventDefault();
  if(e.repeat)return;
  if(!this.physicalKeys)this.physicalKeys=new Map();
  if(this.physicalKeys.has(e.code))return;
  this.physicalKeys.set(e.code,{code,active:!(code==='Enter'&&this.dead>0)});
  this.handleKeyDown({code,repeat:false,preventDefault:()=>e.preventDefault()});
 }
 handleKeyDown(e){
  const fireKey=e.code==='Enter'||e.code==='NumpadEnter';
  if(this.mode!=='playing'){if(fireKey&&e.repeat)e.preventDefault();return;}
  if(fireKey||['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(fireKey){if(this.dead||(e.repeat&&!this.keys[e.code]))return;if(!this.keys[e.code])this.initAudio();}
  this.keys[e.code]=true;
  if(/^Digit[123]$/.test(e.code))this.setSlot(Number(e.code.slice(-1))-1);
  if(e.code==='KeyV'&&!e.repeat)this.toggleAim();if(e.code==='KeyR')this.recharge();if(e.code==='KeyQ')this.pulse();if(e.code==='KeyP'||e.code==='Escape')this.pause();
 }
 keyUp(e){const held=this.physicalKeys?.get(e.code);if(!held)return;this.physicalKeys.delete(e.code);this.keys[held.code]=[...this.physicalKeys.values()].some(v=>v.code===held.code&&v.active);}
 isFiring(){return !!(this.fire||this.keys.Enter||this.keys.NumpadEnter);}
 releaseFire(){this.fire=false;this.keys.Enter=false;this.keys.NumpadEnter=false;for(const held of this.physicalKeys?.values()||[])if(held.code==='Enter')held.active=false;}
 listen(el,n,fn){el.addEventListener(n,fn);this.listeners.push([el,n,fn]);}
 resize(){this.resetMouseLook();this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
 setPreferences(p){this.setKeyBindings(p.keyBindings);this.sensitivity=p.sensitivity;this.arrowSensitivity=Number.isFinite(p.arrowSensitivity)?clamp(p.arrowSensitivity,.1,3):1;this.screenShake=Number.isFinite(p.screenShake)?clamp(p.screenShake/100,0,1):.7;this.volume=p.volume/100;this.quality=p.quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,p.quality==='low'?1:1.65));this.renderer.shadowMap.enabled=p.quality!=='low';if(this.groundDetail)this.groundDetail.visible=p.quality!=='low';}
 mat(color,extra={}){return new T.MeshStandardMaterial({color,roughness:.84,...extra});}
 box(w,h,d,x,y,z,mat,parent=this.world){const m=new T.Mesh(this.sharedGeo?.box||new T.BoxGeometry(1,1,1),mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=Math.min(w,h,d)>.16&&Math.max(w,h,d)>.6;m.receiveShadow=true;parent.add(m);return m;}
 cylinder(r,h,x,y,z,mat,parent=this.world){const m=new T.Mesh(this.sharedGeo?.cyl||new T.CylinderGeometry(1,1,1,12),mat);m.scale.set(r,h,r);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 makeWeapon(){
  const g=new T.Group(),metal=surfaceMaterial('#333c3e','metal',{metalness:.65,roughness:.4,localCoordinates:true}),rail=this.mat('#535d5d',{metalness:.65}),black=this.mat('#11191c'),light=this.mat('#92f3d7',{emissive:'#65efc0',emissiveIntensity:2});
  this.box(.21,.23,.65,0,0,0,metal,g);this.box(.16,.13,.32,0,.12,.26,black,g);this.box(.25,.3,.11,0,.015,-.37,rail,g);this.box(.17,.12,.12,0,.19,-.1,black,g);this.box(.065,.033,.012,0,.21,-.17,light,g);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)this.box(.032,.033,.015,(i-1.5)*.049,(j-1.5)*.047+.02,-.438,light,g);
  for(let i=0;i<6;i++)this.box(.25,.025,.024,0,.16,.12-i*.055,rail,g);
  this.box(.1,.23,.14,0,-.2,.14,black,g).rotation.x=-.23;this.box(.15,.19,.24,0,-.15,-.08,metal,g);
  for(const side of [-1,1]){this.box(.014,.09,.3,side*.112,-.025,.015,rail,g);for(let k=0;k<4;k++)this.box(.02,.018,.09,side*.126,.018-k*.025,.01,black,g);for(const z of [-.22,.2])this.cylinder(.018,.022,side*.12,.115,z,rail,g).rotation.z=Math.PI/2;}
  const glove=surfaceMaterial('#454c40','fabric');this.box(.14,.15,.2,.03,-.25,.13,glove,g);this.box(.14,.15,.31,-.15,-.15,-.2,glove,g).rotation.z=.4;
  // Physical optic and an emissive muzzle make every pulse readable between HUD updates.
  const optic=new T.Mesh(new T.CylinderGeometry(.09,.09,.24,16),metal);optic.rotation.x=Math.PI/2;optic.position.set(0,.25,-.03);g.add(optic);
  const lens=new T.Mesh(new T.CircleGeometry(.073,20),new T.MeshBasicMaterial({color:'#61cbbd',transparent:true,opacity:.65}));lens.position.set(0,.25,.095);g.add(lens);
  this.muzzleFlash=new T.Mesh(new T.SphereGeometry(.1,8,6),new T.MeshBasicMaterial({color:'#fff1b7',transparent:true,opacity:0,depthWrite:false}));this.muzzleFlash.position.set(0,.02,-.49);this.muzzleFlash.scale.set(1.8,1.8,.4);g.add(this.muzzleFlash);
  this.muzzleLight=new T.PointLight('#ffe8b6',0,4,2);this.muzzleLight.position.set(0,0,-.5);g.add(this.muzzleLight);
  g.position.set(.31,-.32,-.65);g.rotation.y=-.025;return g;
 }
 clearWorld(){const mats=new Set(),geos=new Set(),textures=new Set();this.world.traverse(o=>{if(o.isLight)o.shadow?.dispose();if(o.geometry&&o.material){if(!Object.values(this.sharedGeo).includes(o.geometry))geos.add(o.geometry);if(Array.isArray(o.material))o.material.forEach(m=>mats.add(m));else mats.add(o.material);}if(o.isInstancedMesh)o.dispose();});for(const m of mats){for(const key of ['map','bumpMap','roughnessMap','normalMap','alphaMap'])if(m[key])textures.add(m[key]);m.dispose();}for(const t of textures)t.dispose();for(const g of geos)g.dispose();this.environmentTarget?.dispose();this.environmentTarget=null;this.scene.environment=null;this.world.clear();this.fx=[];this.enemies=[];this.allies=[];this.blocks=[];this.occluders=[];this.objectives=[];this.snowfall=null;this.water=null;this.waterFlow=null;this.wptEmitter=null;this.sky=null;this.groundDetail=null;}

 ground(x,z){return terrain(this.map,x,z);}
 buildMap(id){
  this.clearWorld();this.map=id;this.layout=layoutFor(id);this.mode='menu';this.weapon.visible=false;
  const ridge=id==='ridge',canyon=id==='canyon',snow=id==='snow',river=id==='river',atmosphere=ATMOSPHERES[id]||ATMOSPHERES.base;
  this.scene.background=new T.Color(atmosphere.horizon);this.scene.fog=new T.Fog(this.scene.background,snow?85:100,snow?290:360);
  this.sky=skyDome(id);this.world.add(this.sky);
  this.world.add(new T.HemisphereLight(atmosphere.horizon,atmosphere.ground,atmosphere.ambient));
  const sun=new T.DirectionalLight(atmosphere.sun,atmosphere.strength);sun.position.set(...atmosphere.position);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-95;sun.shadow.camera.right=95;sun.shadow.camera.top=95;sun.shadow.camera.bottom=-95;sun.shadow.camera.near=.5;sun.shadow.camera.far=300;sun.shadow.normalBias=.06;sun.shadow.bias=-.00012;this.world.add(sun);this.world.add(sun.target);
  if(this.renderer?.isWebGLRenderer){const skyScene=new T.Scene(),environmentSky=this.sky.clone();skyScene.add(environmentSky);const generator=new T.PMREMGenerator(this.renderer);try{this.environmentTarget=generator.fromScene(skyScene,.04,.1,650);this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=.35;}finally{generator.dispose();}}
  const geo=new T.PlaneGeometry(500,500,400,400);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;const colors=[];const c=new T.Color();
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,this.ground(x,z));const y=this.ground(x,z),slope=Math.hypot(this.ground(x+.7,z)-y,this.ground(x,z+.7)-y)/.7,v=.91+.06*Math.sin(x*.34+z*.2)*Math.cos(z*.31);c.set(snow?'#dce7ed':river?(y<.8?'#778779':'#667957'):ridge?'#68745e':canyon?'#ac8461':'#a49b7f');c.lerp(new T.Color(snow?'#81949f':ridge||river?'#777c72':'#817568'),clamp((slope-.3)*.6,0,.7)).multiplyScalar(v);colors.push(c.r,c.g,c.b);}
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const ground=new T.Mesh(geo,surfaceMaterial('#ffffff','ground',{vertexColors:true}));ground.receiveShadow=true;this.world.add(ground);this.groundMesh=ground;
  const concrete=surfaceMaterial(snow?'#8397a8':ridge||river?'#6d7979':'#8f938b','concrete'),edge=this.mat(snow?'#f0f6f9':'#c1bdae'),dark=this.mat('#28373a'),steel=surfaceMaterial('#58676a','metal',{metalness:.4,roughness:.6}),orange=this.mat('#b36e41');
  this.roads=[];
  for(const points of this.layout.roads){const vertices=[],indices=[],half=this.layout.roadWidth/2,crossSteps=Math.ceil(this.layout.roadWidth/1.25),stride=crossSteps+1;for(let k=1;k<points.length;k++){const [ax,az]=points[k-1],[bx,bz]=points[k],len=Math.hypot(bx-ax,bz-az),steps=Math.ceil(len/1.25),nx=-(bz-az)/len,nz=(bx-ax)/len;for(let i=0;i<=steps;i++){const x=ax+(bx-ax)*i/steps,z=az+(bz-az)*i/steps,n=vertices.length/3;for(let j=0;j<=crossSteps;j++){const side=half-j*this.layout.roadWidth/crossSteps,px=x+nx*side,pz=z+nz*side;vertices.push(px,this.ground(px,pz)+.055,pz);if(i<steps&&j<crossSteps)indices.push(n+j,n+j+stride,n+j+1,n+j+1,n+j+stride,n+j+stride+1);}}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const road=new T.Mesh(geo,surfaceMaterial(snow?'#a5b8c1':canyon?'#8c725d':'#555d59','road'));road.receiveShadow=true;this.world.add(road);this.roads.push(road);}
  const building=(x,z,w,d,h)=>{const y=this.ground(x,z);const b=this.box(w,h,d,x,y+h/2,z,concrete);this.blocks.push({x,z,w:w/2,d:d/2,bottom:y,top:y+h});this.occluders.push(b);this.box(w+.3,.28,d+.3,x,y+h,z,edge);for(let dx=-w/2+1;dx<w/2;dx+=2)this.box(1.1,.7,.06,x+dx,y+h*.63,z+d/2+.04,dark);for(let dx=-w/2+1;dx<w/2;dx+=2)this.box(1.1,.7,.06,x+dx,y+h*.63,z-d/2-.04,dark);this.box(1.6,2.2,.08,x,y+1.1,z+d/2+.06,dark);this.box(1.8,.18,1.1,x,y+2.35,z+d/2+.5,steel);this.box(2,.7,1.6,x+w/4,y+h+.48,z,steel);
   // Coping, service pipes, window frames and damage stay attached to existing cover.
   this.box(w,.25,.12,x,y+.2,z+d/2+.03,dark);this.cylinder(.075,h+.1,x+w/2-.2,y+h/2,z+d/2+.12,steel);
   for(let dx=-w/2+1;dx<w/2;dx+=2){for(const zz of [-1,1]){this.box(1.2,.08,.1,x+dx,y+h*.63+.39,z+zz*(d/2+.08),edge);this.box(.065,.7,.1,x+dx,y+h*.63,z+zz*(d/2+.08),steel);}}
   for(let j=0;j<3;j++){const panel=this.box(.6+j*.15,.18,.05,x-w*.28+j*.48,y+.5+j*.31,z+d/2+.05,dark);panel.rotation.z=.15*j;}
  };
  this.layout.buildings.forEach(v=>building(...v));
  const container=(x,z,rotation,color)=>{const g=new T.Group(),y=this.ground(x,z),m=surfaceMaterial(color,'metal');const body=this.box(3,2.7,7.8,0,1.35,0,m,g);for(let zz=-3.6;zz<3.8;zz+=.42){this.box(.07,2.5,.075,-1.52,1.35,zz,steel,g);this.box(.07,2.5,.075,1.52,1.35,zz,steel,g);}this.box(2.8,2.5,.08,0,1.35,3.94,dark,g);for(const xx of [-.85,.85])this.box(.045,2.2,.08,xx,1.4,4.02,steel,g);g.position.set(x,y,z);g.rotation.y=rotation;this.world.add(g);const w=rotation?4.05:1.65,d=rotation?1.65:4.05;this.blocks.push({x,z,w,d,bottom:y,top:y+2.7});this.occluders.push(body);};
  this.layout.containers.forEach(([x,z,rot,color])=>container(x,z,rot*Math.PI/2,color));
  for(const [x,z,rot] of this.layout.barriers){const w=rot?1.1:5,d=rot?5:1.1,y=this.ground(x,z);const b=this.box(w,1.1,d,x,y+.55,z,concrete);this.box(w+.08,.12,d+.08,x,y+1.08,z,edge);this.blocks.push({x,z,w:w/2,d:d/2,bottom:y,top:y+1.2});this.occluders.push(b);for(let i=-1;i<=1;i++)this.box(.22,.3,d+.1,x+i,y+.65,z,orange);}
  this.captureCover=[];
  for(const [x,z,w,d,h] of this.layout.captureCover){const y=this.ground(x,z),cover=this.box(w,h,d,x,y+h/2,z,concrete);this.box(w+.04,.1,d+.04,x,y+h+.015,z,edge);this.blocks.push({x,z,w:w/2,d:d/2,bottom:y,top:y+h});this.occluders.push(cover);this.captureCover.push(cover);}
  // Communication arrays are physical landmarks at the capture points.
  for(const [i,[x,z]] of this.layout.objectives.entries()){const y=this.ground(x,z),g=new T.Group();this.cylinder(.12,8,x,y+4,z,steel);for(const dx of [-1.8,1.8]){const beam=this.box(.12,7,.12,x+dx/2,y+3.2,z,steel);beam.rotation.z=-dx*.14;}
   this.box(4,2.3,.24,x,y+7,z,steel);for(let a=0;a<8;a++)for(let b=0;b<4;b++)this.box(.35,.35,.08,x-1.63+a*.46,y+6.3+b*.46,z+.17,dark);
   const ring=new T.Mesh(new T.RingGeometry(6.4,6.58,64),new T.MeshBasicMaterial({color:'#e8b06a',side:T.DoubleSide,transparent:true,opacity:.8}));ring.geometry.rotateX(-Math.PI/2);const rp=ring.geometry.attributes.position;for(let ri=0;ri<rp.count;ri++)rp.setY(ri,this.ground(x+rp.getX(ri),z+rp.getZ(ri))-y+.08);ring.geometry.computeVertexNormals();ring.position.set(x,y,z);this.world.add(ring);
   const beacon=this.cylinder(.16,24,x,y+12,z,new T.MeshBasicMaterial({color:'#efc98c',transparent:true,opacity:.62,depthWrite:false}));beacon.castShadow=false;this.objectives.push({id:'ABC'[i],x,z,y,progress:0,owner:'neutral',ring,beacon});}
  // Perimeter, rock formations, and vegetation provide depth without blocking routes.
  for(let i=0;i<70;i++){const a=i*2.39996,r=93+(i%7)*13,x=Math.cos(a)*r,z=Math.sin(a)*r,y=this.ground(x,z);if(ridge||snow||river){const trunk=this.cylinder(.35,7,x,y+3.5,z,dark);for(let j=0;j<3;j++){const tree=new T.Mesh(new T.ConeGeometry(2.8-j*.6,5.5,7),this.mat(snow?'#bdcfd6':river?'#45694d':'#314c43'));tree.position.set(x,y+5+j*1.9,z);tree.castShadow=true;this.world.add(tree);}}else{const rock=new T.Mesh(new T.DodecahedronGeometry(1,0),this.mat(canyon?'#86604c':'#a19a87'));rock.position.set(x,y+3,z);rock.scale.set(5+i%8,4+i%10,5+i%9);rock.rotation.set(i,.2*i,.15);rock.castShadow=true;this.world.add(rock);}}
  for(let i=0;i<130;i++){const x=Math.sin(i*128.43)*84,z=Math.cos(i*73.7)*87;if(Math.abs(x)<8)continue;const rock=new T.Mesh(this.sharedGeo.sphere,this.mat(snow?'#cfdee7':ridge||river?'#607369':'#928e7c'));rock.position.set(x,this.ground(x,z)+.12,z);rock.scale.set(.25+(i%3)*.16,.18,.3);this.world.add(rock);}
  // A broken mountain skyline, with eroded ridgelines instead of repeated cones.
  const mountainMat=surfaceMaterial(snow?'#b7c7d0':ridge||river?'#667877':'#938575','stone');
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,x=Math.cos(a)*235,z=Math.sin(a)*235,height=35+i%5*12,geo=new T.ConeGeometry(37,height,13,5),p=geo.attributes.position;for(let n=0;n<p.count;n++){const vx=p.getX(n),vy=p.getY(n),vz=p.getZ(n),f=1+.13*Math.sin(vx*.21+vz*.23+i);p.setXYZ(n,vx*f,vy+Math.sin(vx*.2+vz*.15+i)*4,vz*f);}geo.computeVertexNormals();const rock=new T.Mesh(geo,mountainMat);rock.position.set(x,height*.25-5,z);rock.rotation.y=i*.7;this.world.add(rock);}
  // Supply hardware and every respawn share the selected map's own safe base.
  const [sx,sz]=this.layout.spawn;this.baseStation={id:'BASE',label:'初期基地',x:sx,z:sz,y:this.ground(sx,sz)};
  const baseY=this.ground(sx-3.5,sz),wptMat=this.mat('#8aeed6',{emissive:'#62e9c4',emissiveIntensity:1.6});
  this.cylinder(.18,4.4,sx-3.5,baseY+2.2,sz,steel);this.box(1.4,.9,.15,sx-3.5,baseY+4.4,sz,steel);
  for(let i=0;i<4;i++)this.box(.22,.55,.07,sx-4+i*.33,baseY+4.4,sz+.12,wptMat);
  this.baseStation.emitter=new T.Vector3(sx-3.5,baseY+4.4,sz);
  const pad=new T.RingGeometry(6.9,7.08,64);pad.rotateX(-Math.PI/2);const pp=pad.attributes.position;for(let i=0;i<pp.count;i++)pp.setY(i,this.ground(sx+pp.getX(i),sz+pp.getZ(i))+.09);const padMesh=new T.Mesh(pad,new T.MeshBasicMaterial({color:'#7de6c9',side:T.DoubleSide}));padMesh.position.set(sx,0,sz);this.world.add(padMesh);
  for(const [x,z,w,d,h] of this.layout.rocks){const y=this.ground(x,z),rock=new T.Mesh(new T.DodecahedronGeometry(1,0),this.mat(snow?'#b5c9d6':ridge?'#657773':'#9f7358'));rock.scale.set(w*.65,h*.65,d*.65);rock.position.set(x,y+h*.4,z);rock.castShadow=true;rock.receiveShadow=true;this.world.add(rock);this.blocks.push({x,z,w:w*.55,d:d*.55,bottom:y-2,top:y+h});this.occluders.push(rock);}
  // Readable limits follow each battlefield's silhouette.
  this.boundary=[];for(let k=0;k<this.layout.bounds.length;k++){const [ax,az]=this.layout.bounds[k],[bx,bz]=this.layout.bounds[(k+1)%this.layout.bounds.length],steps=Math.ceil(Math.hypot(bx-ax,bz-az)/7);for(let j=0;j<steps;j++){const x=ax+(bx-ax)*j/steps,z=az+(bz-az)*j/steps,y=this.ground(x,z);this.cylinder(.075,2.3,x,y+1.15,z,steel);this.box(.15,.17,.15,x,y+2.23,z,orange);this.boundary.push([x,z]);}}
  // Map-specific landmarks make routes recognizable at ground level.
  if(id==='base'){for(const x of [-25,-17])this.cylinder(2.5,4,x,this.ground(x,18)+10,18,steel);}
  if(canyon){this.box(19,.8,3,22,this.ground(22,-51)+9,-51,steel);for(const x of [14,30])this.box(.5,9,.5,x,this.ground(x,-51)+4.5,-51,orange);}
  if(ridge){const dish=new T.Mesh(new T.SphereGeometry(5,24,12,0,Math.PI*2,0,Math.PI/2),this.mat('#c3cdc8',{side:T.DoubleSide}));dish.rotation.x=-.7;dish.position.set(0,this.ground(0,-16)+9,-16);this.world.add(dish);this.cylinder(.3,4,0,this.ground(0,-16)+7,-16,steel);}
  if(snow){const dome=new T.Mesh(new T.SphereGeometry(6,20,12,0,Math.PI*2,0,Math.PI/2),this.mat('#e9f3f5'));dome.position.set(-25,this.ground(-25,24)+5,24);this.world.add(dome);this.occluders.push(dome);}
  if(id==='dam'){const y=this.ground(0,62);this.box(92,5,3,0,y+2.5,73,concrete);for(const x of [-36,-18,0,18,36])this.box(2,8,5,x,y+4,73,steel);const reservoir=new T.Mesh(new T.PlaneGeometry(200,90),waterMaterial());reservoir.rotation.x=-Math.PI/2;reservoir.position.set(0,y+1.2,126);this.world.add(reservoir);}
  if(id==='works'){for(const [x,z] of [[-26,33],[26,-32]]){const y=this.ground(x,z);this.cylinder(1.2,15,x,y+17,z,concrete);this.cylinder(1.3,.7,x,y+24,z,orange);this.box(7,.5,2,x,y+12,z,steel);}}
  if(river){const y=this.ground(57,25);this.box(.7,18,.7,57,y+9,25,orange);this.box(22,.7,.7,49,y+18,25,orange);this.cylinder(.04,8,39,y+14,25,steel);}
  if(snow){
   const points=[];for(let i=0;i<650;i++)points.push(Math.sin(i*92.13)*110,8+(i*1.738%38),Math.cos(i*81.47)*110);
   const flakes=new T.BufferGeometry();flakes.setAttribute('position',new T.Float32BufferAttribute(points,3));this.snowfall=new T.Points(flakes,new T.PointsMaterial({color:'#ffffff',size:.13,transparent:true,opacity:.7,depthWrite:false}));this.world.add(this.snowfall);
   for(const b of this.blocks){if(b.top-b.bottom>2)this.box(b.w*2+.25,.18,b.d*2+.25,b.x,b.top+.15,b.z,edge);}
  }
  if(river){
   const vertices=[],indices=[],flow=[];for(let i=0;i<=160;i++){const z=-200+i*2.5,c=riverCenter(z);vertices.push(c-14,WATER_LEVEL,z,c+14,WATER_LEVEL,z);if(i<160){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}if(i%3===0&&this.layout.crossings.every(crossing=>Math.abs(z-crossing)>8))flow.push(c-3,WATER_LEVEL+.075,z,c+2,WATER_LEVEL+.075,z+.6);}
   const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(vertices,3));wg.setIndex(indices);wg.computeVertexNormals();this.water=new T.Mesh(wg,waterMaterial());this.world.add(this.water);
   const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(flow,3));this.waterFlow=new T.LineSegments(fg,new T.LineBasicMaterial({color:'#b8ede6',transparent:true,opacity:.5}));this.world.add(this.waterFlow);
   for(const z of this.layout.crossings){const x=riverCenter(z),dg=new T.PlaneGeometry(28,6,28,6);dg.rotateX(-Math.PI/2);const dp=dg.attributes.position;for(let i=0;i<dp.count;i++)dp.setY(i,this.ground(x+dp.getX(i),z+dp.getZ(i))+.07);dg.computeVertexNormals();const deck=new T.Mesh(dg,this.mat('#84928b'));deck.position.set(x,0,z);deck.receiveShadow=true;this.world.add(deck);for(const xx of [-5,5])this.cylinder(.3,2.3,x+xx,-.4,z,concrete);}
  }
  addGroundDetail(this);this.groundDetail.visible=this.quality!=='low';batchSmallDetails(this);this.world.updateMatrixWorld(true);this.buildNavigation();this.emit();
 }
 makeSoldier(team,x,z,index){const g=new T.Group(),m=surfaceMaterial(team==='enemy'?'#625c49':'#526a61','fabric'),vest=this.mat('#303b39'),skin=this.mat('#898176'),marker=this.mat(team==='enemy'?'#f18b6b':'#78e2d0',{emissive:team==='enemy'?'#e66b44':'#49c7b6',emissiveIntensity:1.1});
  const body=new T.Mesh(new T.CapsuleGeometry(.29,.28,4,10),m);body.scale.z=.72;body.position.set(0,1.22,0);body.castShadow=true;body.receiveShadow=true;g.add(body);this.box(.64,.52,.15,0,1.28,.21,vest,g);this.box(.5,.5,.22,0,1.25,-.24,vest,g);for(const px of [-.2,0,.2])this.box(.16,.2,.12,px,1.16,.34,vest,g);this.box(.27,.07,.04,0,1.52,.31,marker,g);const head=this.cylinder(.23,.34,0,1.82,0,skin,g),helmet=new T.Mesh(new T.SphereGeometry(.3,14,8,0,Math.PI*2,0,Math.PI/2),vest),visor=this.box(.42,.1,.035,0,1.83,.235,vest,g);helmet.position.set(0,1.9,0);helmet.scale.y=.58;helmet.castShadow=true;helmet.receiveShadow=true;g.add(helmet);for(const part of [head,helmet,visor])part.userData.hitZone='head';
  const legs=[];for(const s of [-1,1]){const leg=new T.Mesh(new T.CapsuleGeometry(.12,.5,3,8),m);leg.position.set(s*.19,.48,0);leg.castShadow=true;g.add(leg);legs.push(leg);this.box(.26,.18,.43,s*.19,.1,.06,vest,g);const arm=new T.Mesh(new T.CapsuleGeometry(.105,.38,3,8),m);arm.position.set(s*.4,1.18,.15);arm.rotation.x=-.7;arm.castShadow=true;g.add(arm);this.box(.15,.15,.18,s*.36,1,.3,vest,g);}
  const hitMeshes=[...g.children];this.box(.12,.14,.8,.15,1.15,.58,vest,g);g.position.set(x,this.ground(x,z),z);this.world.add(g);return {kind:'soldier',maxHp:100,g,legs,hp:100,team,index,shoot:(1+(index%4)*.45)*(team==='enemy'?(this.difficulty?.intervalScale??1):1),dead:0,target:index%3,seed:index*1.8,body,hitMeshes};
 }
 actorPoint(actor){return actor.g.position.clone().add(new T.Vector3(0,actor.kind==='drone'?0:1.25,0));}
 airFloor(x,z){let height=this.ground(x,z);for(const b of this.blocks)if(Math.abs(x-b.x)<b.w+3&&Math.abs(z-b.z)<b.d+3)height=Math.max(height,b.top);return height;}
 makeDrone(x,z,index){
  const g=new T.Group(),bodyMat=this.mat('#303e48',{metalness:.65,roughness:.4}),armMat=this.mat('#8a999f',{metalness:.5}),red=this.mat('#ff957a',{emissive:'#f86344',emissiveIntensity:2});
  const body=this.box(.92,.35,.68,0,0,0,bodyMat,g);this.box(.4,.2,.34,0,-.23,.12,armMat,g);this.box(.22,.14,.08,0,-.22,.32,red,g);
  const rotors=[];for(const x of [-.87,.87])for(const z of [-.78,.78]){const arm=this.box(1.25,.09,.1,x/2,.02,z/2,armMat,g);arm.rotation.y=-Math.atan2(z,x);this.cylinder(.13,.22,x,.13,z,bodyMat,g);const rotor=new T.Group();rotor.position.set(x,.27,z);this.box(.96,.025,.095,0,0,0,bodyMat,rotor);this.box(.095,.025,.96,0,0,0,bodyMat,rotor);g.add(rotor);rotors.push(rotor);const guard=new T.Mesh(new T.TorusGeometry(.5,.025,5,16),armMat);guard.rotation.x=Math.PI/2;guard.position.set(x,.2,z);g.add(guard);}
  this.box(.13,.11,.5,-.4,.02,-.14,red,g);this.box(.13,.11,.5,.4,.02,-.14,red,g);g.position.set(x,this.airFloor(x,z)+6,z);this.world.add(g);
  return {kind:'drone',maxHp:70,g,body,rotors,legs:[],hp:70,team:'enemy',index,shoot:(2+(index%3)*.5)*(this.difficulty?.intervalScale??1),dead:0,target:index%3,seed:index*1.8};
 }
 updateDrone(e,dt){
  const difficulty=this.difficulty||getDifficulty('master');
  if(e.dead>0){e.dead=Math.max(0,e.dead-dt);if(e.dead===0){const {x,z}=this.spawnPoint('enemy',e.index);e.hp=e.maxHp;e.g.visible=true;e.g.position.set(x,this.airFloor(x,z)+6,z);e.shoot=2*difficulty.intervalScale;}return;}
  for(let i=0;i<e.rotors.length;i++)e.rotors[i].rotation.y+=dt*65*(i%2?-1:1);
  const targets=this.allies.filter(a=>a.dead===0).map(a=>({p:this.actorPoint(a),v:a}));if(!this.dead)targets.push({p:this.player.clone().add(new T.Vector3(0,-.3,0)),v:null});
  let target=null,near=difficulty.droneSight;for(const candidate of targets){const distance=e.g.position.distanceTo(candidate.p);if(distance<near&&this.line(e.g.position,candidate.p)){target=candidate;near=distance;}}
  const obj=this.objectives[e.target],angle=this.time*.2+e.seed,center=target?target.p:new T.Vector3(obj.x,obj.y,obj.z),radius=target?13:10;
  const tx=center.x+Math.cos(angle)*radius,tz=center.z+Math.sin(angle)*radius,dx=tx-e.g.position.x,dz=tz-e.g.position.z,distance=Math.hypot(dx,dz),step=Math.min(distance,5.1*difficulty.speedScale*dt);
  const nx=clamp(e.g.position.x+(distance>0?dx/distance*step:0),-80,80),nz=clamp(e.g.position.z+(distance>0?dz/distance*step:0),-80,80),surface=this.airFloor(nx,nz),height=surface+5.4+Math.sin(this.time*1.2+e.seed)*.65;
  e.g.position.y+=clamp(height-e.g.position.y,-4*dt,8*dt);if(e.g.position.y>surface+1.3){e.g.position.x=nx;e.g.position.z=nz;}
  e.g.rotation.y=Math.atan2(center.x-e.g.position.x,center.z-e.g.position.z);e.g.rotation.z=Math.sin(this.time*.7+e.seed)*.08;e.g.rotation.x=Math.cos(this.time*.9+e.seed)*.05;
  e.shoot-=dt;if(target&&e.shoot<=0&&this.line(e.g.position,target.p)){e.shoot=(1.25+Math.random()*.65)*difficulty.intervalScale;this.beam(e.g.position.clone(),target.p,'#ffc099',.025);this.gunshot(null,e.g.position,true);if(Math.random()<difficulty.droneAccuracy){if(target.v){target.v.hp-=14;if(target.v.hp<=0)this.kill(target.v,false);}else{this.hp=Math.max(0,this.hp-6);this.lastHit=this.time;this.damageFlash=.3;this.shake=1;if(this.hp===0){this.dead=4;this.deaths++;this.releaseFire();this.resetCombatEffects();this.resetMouseLook();this.red+=8;}}}}
 }
 updateWPT(dt){
  this.wptActive=false;const stations=[this.baseStation,...this.objectives.filter(o=>o.owner==='blue')].filter(Boolean),station=stations.sort((a,b)=>Math.hypot(this.player.x-a.x,this.player.z-a.z)-Math.hypot(this.player.x-b.x,this.player.z-b.z))[0];
  if(!station||this.dead>0){this.wptProgress=0;this.wptState={status:'inactive',label:'',distance:0,progress:0};return;}
  const distance=Math.hypot(this.player.x-station.x,this.player.z-station.z),label=station.label||'拠点 '+station.id;let status='ready';const radius=station.id==='BASE'?7:6.5;
  const contested=station.id!=='BASE'&&this.enemies.some(e=>e.kind!=='drone'&&e.dead===0&&Math.hypot(e.g.position.x-station.x,e.g.position.z-station.z)<6.5);
  const source=station.emitter||new T.Vector3(station.x,station.y+6.8,station.z),receiver=this.player.clone().add(new T.Vector3(0,-.35,0));
  if(distance>radius)status='out-of-range';else if(contested)status='contested';else if(this.time-this.lastHit<2)status='under-fire';else if(this.moving||Math.abs(this.player.y-(this.eyeHeight||1.72)-this.ground(this.player.x,this.player.z))>.2)status='moving';else if(this.isFiring()||this.reload>0)status='busy';else if(!this.line(source,receiver))status='blocked';else if(this.hp>=99.99&&this.energy>=99.99&&this.heat<.1)status='complete';
  if(status==='ready'&&(this.keys.KeyE||this.wptHeld)){
   this.wptProgress=Math.min(.8,(this.wptProgress||0)+dt);status=this.wptProgress<.8?'linking':'charging';
   if(status==='charging'){this.wptActive=true;this.hp=Math.min(100,this.hp+18*dt);this.energy=Math.min(100,this.energy+28*dt);this.heat=Math.max(0,this.heat-24*dt);if(this.heat<25)this.overheat=false;}
   if(this.time-(this.wptBeamAt||-100)>.11){this.wptBeamAt=this.time;this.beam(source,receiver,status==='charging'?'#82f7d6':'#accbc8',status==='charging'?.055:.02);if(status==='charging')this.sound(530,.1,.025);}
  }else this.wptProgress=0;
  this.wptState={status,label,distance:Math.round(distance),progress:(this.wptProgress||0)/.8};
 }
 setProgress(cleared){this.cleared=Object.freeze(clearedDifficulties(cleared));}
 start(loadouts,difficultyId='master',options={}){if(!canPlayDifficulty(difficultyId,this.cleared))return false;this.difficulty=getDifficulty(difficultyId);this.loadouts=loadouts.slice(0,3).map(normalizeSetup);if(!this.loadouts.length)return false;this.trainingUsage=Object.create(null);this.trainingMap=this.map;this.dronesEnabled=options.dronesEnabled!==false;this.result=null;this.matchId=crypto.randomUUID();this.buildMap(this.map);this.time=0;this.nextPulseAt=0;this.stepAt=0;this.shotCount=0;this.resetCombatEffects();this.placePlayerAtBase();this.hp=100;this.kills=0;this.headshots=0;this.headshotKills=0;this.headshotFlash=0;this.killHeadshot=false;this.deaths=0;this.blue=0;this.red=0;this.remaining=300;this.slot=0;this.energy=100;this.heat=0;this.reload=0;this.scanCooldown=0;this.scan=0;this.lastHit=-10;this.dead=0;this.velocityY=0;this.overheat=false;this.eyeHeight=1.72;this.touchMove={x:0,y:0};this.resetKeys();this.fire=false;this.aim=false;this.hitFlash=0;this.damageFlash=0;this.killNotice=0;this.beamAt=-100;this.sparkAt=-100;this.dustAt=-100;this.wptBeamAt=-100;this.reloadTotal=0;this.wptHeld=false;this.wptProgress=0;this.wptActive=false;this.currentSpeed=0;this.wptState={status:'ready',label:'初期基地',distance:0,progress:0};
  for(let i=0;i<(this.dronesEnabled?10:7);i++){const p=this.spawnPoint('enemy',i);this.enemies.push(i<7?this.makeSoldier('enemy',p.x,p.z,i):this.makeDrone(p.x,p.z,i));}for(let i=0;i<5;i++){const p=this.spawnPoint('ally',i);this.allies.push(this.makeSoldier('ally',p.x,p.z,i));}
  this.mode='playing';this.resetMouseInput();this.weapon.visible=true;this.initAudio();this.lock();this.emit();return true;}
 resetMouseLook(){this.mousePosition=null;this.mouseEdge={x:0,y:0};}
 resetMouseInput(){this.resetMouseLook();this.dragLook=false;this.pointerLockPending=false;this.lockRequestId=(this.lockRequestId||0)+1;}
 pointerLockFailed(){
  const doc=this.canvas?.ownerDocument||document;
  if(this.disposed||this.mode!=='playing'||this.touchActive||doc.pointerLockElement===this.canvas)return;
  this.pointerLockPending=false;this.dragLook=true;this.lockRequestId=(this.lockRequestId||0)+1;this.emit();
 }
 pointerLockChanged(){
  const doc=this.canvas?.ownerDocument||document,wasLocked=!!this.pointerLocked;
  this.pointerLocked=doc.pointerLockElement===this.canvas;
  if(this.pointerLocked){this.resetMouseInput();if(this.mode!=='playing'||this.disposed){doc.exitPointerLock();return;}this.emit();}
  else if(wasLocked&&this.mode==='playing'&&!this.touchActive)this.pause();
  else if(this.mode==='playing')this.pointerLockFailed();
  else this.resetMouseInput();
 }
 lock(){
  if(this.touchActive||this.disposed||this.mode!=='playing')return;
  const doc=this.canvas?.ownerDocument||document;
  if(doc.pointerLockElement===this.canvas){this.pointerLocked=true;this.resetMouseInput();return;}
  if(this.pointerLockPending&&performance.now()-this.lockRequestedAt<800)return;
  this.pointerLockPending=true;this.lockRequestedAt=performance.now();this.dragLook=true;
  const requestId=this.lockRequestId=(this.lockRequestId||0)+1;
  try{const result=this.canvas.requestPointerLock();result?.catch(()=>{if(requestId===this.lockRequestId)this.pointerLockFailed();});}
  catch{if(requestId===this.lockRequestId)this.pointerLockFailed();}
 }
 mouseMove(e){
  if(this.mode!=='playing'||this.touchActive||this.dead)return;
  const doc=this.canvas?.ownerDocument||document;
  if(doc.pointerLockElement===this.canvas){this.look(e.movementX||0,e.movementY||0);return;}
  if(!this.dragLook)return;
  const rect=this.canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
  if(!rect.width||!rect.height||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>rect.width||y>rect.height){this.resetMouseLook();return;}
  if(this.mousePosition){const dx=Number.isFinite(e.movementX)?e.movementX:e.clientX-this.mousePosition.x,dy=Number.isFinite(e.movementY)?e.movementY:e.clientY-this.mousePosition.y;this.look(dx,dy);}
  this.mousePosition={x:e.clientX,y:e.clientY};
  const edge=(position,size)=>{const band=Math.min(56,size*.08);return position<band?(position-band)/band:position>size-band?(position-size+band)/band:0;};
  this.mouseEdge={x:edge(x,rect.width),y:edge(y,rect.height)};
 }
 updateMouseLook(dt){
  if(!this.dragLook||this.touchActive||this.dead||this.mode!=='playing'||!this.mouseEdge)return;
  const doc=this.canvas?.ownerDocument||document;if(doc.pointerLockElement===this.canvas)return;
  this.look(this.mouseEdge.x*900*dt,this.mouseEdge.y*900*dt);
 }

 pause(){if(this.mode!=='playing')return;this.mode='paused';this.resetCombatEffects();this.resetMouseInput();this.resetKeys();this.fire=false;this.aim=false;this.touchMove={x:0,y:0};this.wptHeld=false;this.wptProgress=0;this.wptActive=false;if(document.pointerLockElement)this.canvas.ownerDocument.exitPointerLock();this.emit();}
 resume(){if(this.mode!=='paused')return;this.resetKeys();this.fire=false;this.mode='playing';this.resetMouseInput();this.lock();this.emit();}
 menu(){this.resetCombatEffects();this.mode='menu';this.resetMouseInput();this.fire=false;this.aim=false;this.resetKeys();this.wptHeld=false;this.wptProgress=0;this.wptActive=false;this.weapon.visible=false;if(document.pointerLockElement)document.exitPointerLock();this.buildMap(this.map);this.emit();}
 look(dx,dy,sensitivity=this.sensitivity){const factor=this.aim?1.25/getScope(this.loadouts?.[this.slot]?.scope).zoom:1;this.yaw-=dx*.002*sensitivity*factor;this.pitch=clamp(this.pitch-dy*.002*sensitivity*factor,-1.42,1.42);}
 setSlot(i){if(!this.loadouts?.[i]||this.mode!=='playing')return;this.slot=i;this.fire=false;this.sound(250+i*120,.06,.08);this.emit();}
 recharge(){if(this.reload>0||this.energy>99||this.dead)return;this.reloadTotal=stats(this.loadouts[this.slot]).reloadSeconds;this.reload=this.reloadTotal;this.fire=false;this.wptProgress=0;this.wptActive=false;this.sound(280,.15,.12);this.emit();}
 pulse(){if(this.scanCooldown>0||this.dead)return;this.scan=4;this.scanCooldown=16;this.sound(900,.4,.12);this.emit();}
 blocked(x,z,r=.42,feet=null){if(!playable(this.map,x,z,r))return true;for(const b of this.blocks){if(Math.abs(x-b.x)<b.w+r&&Math.abs(z-b.z)<b.d+r&&(feet===null?this.ground(x,z)+.2:feet)<b.top-.04)return true;}return false;}
 move(p,dx,dz,r=.42){const nx=clamp(p.x+dx,-85,85),nz=clamp(p.z+dz,-85,85),feet=p===this.player?p.y-(this.eyeHeight||1.72):null;const rise=(x,z,d)=>this.ground(x,z)-Math.max(this.ground(p.x,p.z),feet??-Infinity)<=Math.abs(d)*1.05+.015;if(!this.blocked(nx,nz,r,feet)&&rise(nx,nz,Math.hypot(dx,dz))){p.x=nx;p.z=nz;return;}if(!this.blocked(nx,p.z,r,feet)&&rise(nx,p.z,dx))p.x=nx;if(!this.blocked(p.x,nz,r,feet)&&rise(p.x,nz,dz))p.z=nz;}
 spawnPoint(team,index=-1){const center=(this.layout||layoutFor(this.map))[team==='enemy'?'enemySpawn':'spawn'];if(index<0)return {x:center[0],z:center[1]};const offsets=[[(index%3-1)*2.6,(Math.floor(index/3)%3-1)*2.6],[0,0],[-5,0],[5,0],[0,-5],[0,5]];for(const [dx,dz] of offsets){const x=center[0]+dx,z=center[1]+dz;if(!this.blocked(x,z,.7))return {x,z};}return {x:center[0],z:center[1]};}
 placePlayerAtBase(){const p=this.spawnPoint('ally'),e=(this.layout||layoutFor(this.map)).enemySpawn;this.player.set(p.x,this.ground(p.x,p.z)+1.72,p.z);this.yaw=Math.atan2(p.x-e[0],p.z-e[1]);this.pitch=0;}
 walkableSegment(ax,az,bx,bz,r=.65){const len=Math.hypot(bx-ax,bz-az),steps=Math.max(1,Math.ceil(len/1.5));let last=this.ground(ax,az);for(let i=1;i<=steps;i++){const x=ax+(bx-ax)*i/steps,z=az+(bz-az)*i/steps,h=this.ground(x,z);if(this.blocked(x,z,r)||Math.abs(h-last)>len/steps*.9+.03)return false;last=h;}return true;}
 buildNavigation(){const size=43,step=4,origin=-84,nodes=Array.from({length:size*size},(_,i)=>({x:origin+(i%size)*step,z:origin+Math.floor(i/size)*step,links:[]}));for(let i=0;i<nodes.length;i++){const n=nodes[i];n.open=!this.blocked(n.x,n.z,.75);if(!n.open)continue;for(const [dx,dz] of [[1,0],[0,1],[1,1],[-1,1]]){const ix=i%size+dx,iz=Math.floor(i/size)+dz;if(ix<0||iz<0||ix>=size||iz>=size)continue;const j=iz*size+ix,m=nodes[j];if(this.walkableSegment(n.x,n.z,m.x,m.z,.75)){n.links.push(j);m.links.push(i);}}}this.navigation={nodes,size,step,origin};this.navigation.fields=this.objectives.map(o=>{const start=this.nearestNav(o.x,o.z),dist=new Int16Array(nodes.length).fill(-1),queue=[start];dist[start]=0;for(let k=0;k<queue.length;k++){const i=queue[k];for(const j of nodes[i].links)if(dist[j]<0){dist[j]=dist[i]+1;queue.push(j);}}return dist;});}
 nearestNav(x,z){const {nodes}=this.navigation;let best=-1,distance=Infinity;for(let i=0;i<nodes.length;i++){const n=nodes[i],d=(n.x-x)**2+(n.z-z)**2;if(n.open&&d<distance&&this.walkableSegment(x,z,n.x,n.z,.6)){best=i;distance=d;}}return best;}
 navigationTarget(e,target){const p=e.g.position;if(!this.navigation)return target;if(!e.route||e.routeGoal!==e.target||this.time>(e.routeUntil||0)){e.route=[];e.routeGoal=e.target;e.routeUntil=this.time+3;const {nodes,fields}=this.navigation,field=fields[e.target];let i=this.nearestNav(p.x,p.z);if(i>=0&&field[i]>=0){let guard=nodes.length;while(field[i]>0&&guard-->0){const choices=nodes[i].links.filter(j=>field[j]>=0&&field[j]<field[i]);if(!choices.length)break;choices.sort((a,b)=>field[a]-field[b]||((nodes[a].x-target.x)**2+(nodes[a].z-target.z)**2)-((nodes[b].x-target.x)**2+(nodes[b].z-target.z)**2));i=choices[0];e.route.push(nodes[i]);}e.route.push(target);}}
  while(e.route.length&&Math.hypot(e.route[0].x-p.x,e.route[0].z-p.z)<2.4)e.route.shift();return e.route[0]||target;
 }
 floorAt(x,z,feet){let floor=this.ground(x,z);for(const b of this.blocks){if(Math.abs(x-b.x)<b.w+.25&&Math.abs(z-b.z)<b.d+.25&&feet>=b.top-.23)floor=Math.max(floor,b.top);}return floor;}
 groundIntersection(a,b){const d=b.clone().sub(a),len=d.length();const steps=Math.ceil(len/.4);let previous=0;for(let i=1;i<=steps;i++){const t=i/steps,p=a.clone().addScaledVector(d,t);if(p.y<this.ground(p.x,p.z)){let lo=previous,hi=t;for(let n=0;n<7;n++){const m=(lo+hi)/2,q=a.clone().addScaledVector(d,m);if(q.y<this.ground(q.x,q.z))hi=m;else lo=m;}return a.clone().addScaledVector(d,hi);}previous=t;}return null;}
 line(a,b){const d=b.clone().sub(a),len=d.length();if(len<.02)return true;if(this.groundIntersection(a,b))return false;this.ray.set(a,d.normalize());this.ray.far=len-.15;return this.ray.intersectObjects(this.occluders,false).length===0;}
 trace(a,b){const d=b.clone().sub(a),len=d.length();this.ray.set(a,d.normalize());this.ray.far=len;const hit=this.ray.intersectObjects(this.occluders,false)[0];const g=this.groundIntersection(a,b);return hit&&(!g||hit.distance<a.distanceTo(g))?hit.point:g||b;}
 beam(a,b,color,width=.03){const d=b.clone().sub(a),m=new T.Mesh(new T.CylinderGeometry(width,width,d.length(),5),new T.MeshBasicMaterial({color,transparent:true,opacity:.8}));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(UP,d.normalize());this.world.add(m);this.fx.push({m,life:.07,max:.07});}
 spark(p,color){if(this.fx.length>=220)return;for(let i=0;i<5;i++){const m=new T.Mesh(this.sharedGeo.sphere,new T.MeshBasicMaterial({color,transparent:true,depthWrite:false}));m.scale.setScalar(.055);m.position.copy(p);this.world.add(m);this.fx.push({m,life:.22,max:.22,gravity:8,v:new T.Vector3((Math.random()-.5)*5,Math.random()*3,(Math.random()-.5)*5)});}}
 impactDust(point,drone=false){
  if(this.fx.length>180||this.time-(this.dustAt??-100)<.065)return;this.dustAt=this.time;
  const count=this.quality==='low'?3:7,positions=[];for(let i=0;i<count;i++)positions.push((Math.random()-.5)*.5,Math.random()*.4,(Math.random()-.5)*.5);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  const m=new T.Points(geo,dustMaterial(drone?'#4d5050':this.map==='snow'?'#d3e0e5':'#9b907c'));m.position.copy(point);this.world.add(m);this.fx.push({m,life:drone?1.5:.75,max:drone?1.5:.75,dust:true,v:new T.Vector3(.25,.7,.15)});
 }
 updateEffects(dt){
  for(let i=this.fx.length-1;i>=0;i--){const f=this.fx[i];if(this.mode!=='paused'){f.life-=dt;if(f.v){if(f.gravity)f.v.y-=f.gravity*dt;f.m.position.addScaledVector(f.v,dt);}}
   const fade=Math.max(0,f.life/f.max);if(f.dust){f.m.material.uniforms.opacity.value=fade*.3;f.m.material.uniforms.size.value=14+(1-fade)*32;f.m.scale.setScalar(1+(1-fade)*2);}else f.m.material.opacity=fade;
   if(f.life<=0){this.world.remove(f.m);if(!Object.values(this.sharedGeo).includes(f.m.geometry))f.m.geometry.dispose();f.m.material.dispose();this.fx.splice(i,1);}
  }
 }
 resetCombatEffects(){this.headshotFlash=0;this.aimHeld=false;this.aimToggled=false;this.aim=false;this.adsBlend=0;this.recoilPitch=0;this.recoilYaw=0;this.gunKick=0;this.shotFlash=0;this.triggerWasHeld=false;this.shake=0;if(this.camera){this.camera.fov=72;this.camera.updateProjectionMatrix();}if(this.muzzleFlash)this.muzzleFlash.material.opacity=0;if(this.muzzleLight)this.muzzleLight.intensity=0;}
 syncAim(){this.aim=this.mode==='playing'&&!this.dead&&!!(this.aimHeld||this.aimToggled);}
 toggleAim(){if(this.mode!=='playing'||this.dead)return;this.aimToggled=!this.aimToggled;this.syncAim();this.emit();}
 viewAngles(){return {pitch:clamp(this.pitch+(this.recoilPitch||0),-1.45,1.45),yaw:this.yaw+(this.recoilYaw||0)};}
 shotDirections(s,jitter=true,time=this.time){
  const st=stats(s),a=this.viewAngles(),spread=jitter?st.spread*(this.aim?.4:1):0;
  const rotation=new T.Euler(a.pitch+Math.cos(time*16.7)*spread*.4,a.yaw+Math.sin(time*19.3)*spread,0,'YXZ');
  const dir=new T.Vector3(0,0,-1).applyEuler(rotation),axis=UP.clone().applyEuler(rotation);
  return beamOffsets(s,time).map(v=>dir.clone().applyAxisAngle(axis,-v*Math.PI/180));
 }
 aimMarkers(){if(!this.loadouts?.[this.slot]||this.dead||this.mode!=='playing')return [];this.camera.updateMatrixWorld(true);return this.shotDirections(this.loadouts[this.slot],false).map(d=>{const p=this.player.clone().addScaledVector(d,20).project(this.camera);return {x:(p.x+1)*50,y:(1-p.y)*50,visible:p.z<1&&Math.abs(p.x)<.94&&Math.abs(p.y)<.9};});}
 hitRegion(e,origin,direction,range,cone){
  // Only the central ray earns precision damage; a broad beam may still hit the body.
  e.g.updateWorldMatrix(true,true);this.ray.set(origin,direction);this.ray.near=0;this.ray.far=range;
  const exact=this.ray.intersectObjects(e.hitMeshes||e.g.children,true)[0];
  if(exact&&this.line(origin,exact.point))return {e,center:exact.point,dist:exact.distance,headshot:e.kind==='soldier'&&exact.object.userData.hitZone==='head'};
  const points=e.kind==='drone'?[[0,.8]]:[[1.25,.38],[.6,.28],[1.5,.3]];
  for(const [height,radius] of points){const center=e.g.position.clone().add(new T.Vector3(0,height,0)),v=center.clone().sub(origin),dist=v.length(),along=v.dot(direction),perpSq=Math.max(0,v.lengthSq()-along*along);if(dist<=range&&along>.2&&perpSq<(radius+along*cone)**2&&this.line(origin,center))return {e,center,dist,headshot:false};}
  return null;
 }
 fireWeapon(dt){
  const s=this.loadouts[this.slot],st=stats(s),active=this.mode==='playing'&&this.isFiring()&&!this.dead&&this.reload<=0&&!this.overheat&&!this.keys.KeyE&&!this.wptHeld;
  if(!active){this.triggerWasHeld=false;return false;}
  // Keep a global cooldown across clicks and slots. Waiting for a pulse is still firing, not free cooling.
  if(!this.triggerWasHeld)this.nextPulseAt=Math.max(this.nextPulseAt??0,this.time);
  this.triggerWasHeld=true;
  if(this.time+1e-8<(this.nextPulseAt??0))return true;
  if(this.energy+1e-8<st.energyPerShot){this.triggerWasHeld=false;this.recharge();return false;}
  this.nextPulseAt=(this.nextPulseAt??this.time)+st.shotInterval;
  this.energy=Math.max(0,this.energy-st.energyPerShot);this.heat=Math.min(100,this.heat+st.heatPerShot);
  if(this.heat>=100){this.overheat=true;this.sound(130,.3,.1);}
  const origin=this.player.clone(),cones=this.shotDirections(s),hits=[],cone=Math.max(.009,Math.tan(st.width*Math.PI/360));
  const candidates=this.enemies.filter(e=>!e.dead&&e.g.position.distanceTo(origin)<st.range+3);
  for(let k=0;k<cones.length;k++){let targets=candidates.map(e=>this.hitRegion(e,origin,cones[k],st.range,cone)).filter(Boolean);if(s.mode==='focus'&&targets.length>1)targets=[targets.reduce((a,b)=>a.dist<=b.dist?a:b)];hits.push(...targets.map(h=>({...h,k})));}
  let headHit=false;
  for(const h of hits){if(h.e.dead)continue;const same=hits.filter(v=>v.k===h.k).length;const damage=st.shotDamage/(cones.length*Math.max(1,same))*(1-.35*h.dist/st.range)*(h.headshot?1.75:1);const applied=this.applyWeaponDamage?this.applyWeaponDamage(h.e,damage):Math.min(h.e.hp,damage);if(!this.applyWeaponDamage)h.e.hp-=damage;this.recordWeaponUse(s.id,applied,h.e.hp<=0,h.headshot);this.hitFlash=.15;if(h.headshot)headHit=true;if(this.time-(this.sparkAt??-100)>.1){this.spark(h.center,h.headshot?'#ffd58c':s.color);this.sparkAt=this.time;}if(h.e.hp<=0)this.kill(h.e,true,h.headshot);}
  if(headHit){this.headshots=(this.headshots||0)+1;this.headshotFlash=.65;this.sound(1150,.045,.055);}
  const a=this.viewAngles(),muzzle=new T.Vector3(this.aim?0:.25,this.aim?-.08:-.24,-1.05).applyEuler(new T.Euler(a.pitch,a.yaw,0,'YXZ')).add(origin);
  for(let k=0;k<cones.length;k++){const distance=hits.filter(h=>h.k===k).reduce((nearest,h)=>Math.min(nearest,h.dist),st.range),target=origin.clone().addScaledVector(cones[k],distance),end=this.trace(origin,target);this.beam(muzzle,end,s.color,s.mode==='wide'?.055:.025);if(end.distanceTo(target)>.05){this.spark(end,'#ffd7a0');this.impactDust(end);}}
  this.shotCount=(this.shotCount||0)+1;this.shotFlash=.055;this.gunKick=1;this.shake=Math.min(1,(this.shake||0)+.6);
  this.recoilPitch=clamp((this.recoilPitch||0)+st.recoil*(this.aim?.65:1),0,.12);this.recoilYaw=clamp((this.recoilYaw||0)+Math.sin(this.shotCount*2.4)*st.recoil*.28,-.035,.035);
  this.gunshot(s);return true;
 }
 recordWeaponUse(id,damage,killed,headshot){if(!Number.isFinite(damage)||damage<=0)return;this.trainingUsage??=Object.create(null);const u=this.trainingUsage[id]??={id,damage:0,kills:0,headshotKills:0};u.damage+=damage;if(killed){u.kills++;if(headshot)u.headshotKills++;}}
 trainingReport(){const weapons=Object.values(this.trainingUsage||{}).map(u=>({...u,damage:Math.floor(u.damage*1000)/1000}));return this.matchId&&weapons.length?{matchId:this.matchId,mapId:this.trainingMap||this.map,elapsed:Math.min(300,this.time),weapons}:null;}
 kill(e,player,headshot=false){if(e.kind==='drone'){this.spark(e.g.position,'#ffb96e');this.impactDust(e.g.position,true);}e.dead=7+Math.random()*3;e.hp=0;e.g.visible=false;if(player){this.kills++;this.blue+=3;this.killNotice=2.2;this.killHeadshot=headshot;if(headshot)this.headshotKills=(this.headshotKills||0)+1;this.sound(750,.07,.09);}}
 updateAI(e,dt){if(e.kind==='drone'){this.updateDrone(e,dt);return;}if(e.dead>0){e.dead-=dt;if(e.dead<=0){e.dead=0;e.hp=100;e.g.visible=true;const p=this.spawnPoint(e.team,e.index);e.g.position.set(p.x,this.ground(p.x,p.z),p.z);e.route=null;}return;}
  const difficulty=this.difficulty||getDifficulty('master'),ally=e.team==='ally',targets=(ally?this.enemies:this.allies).filter(v=>v.dead<=0).map(v=>({p:v.g.position,v}));if(!ally&&!this.dead)targets.push({p:this.player,v:null});const eye=e.g.position.clone().add(new T.Vector3(0,1.55,0));let enemy=null,nearest=ally?44:difficulty.infantrySight;
  for(const t of targets){const dist=e.g.position.distanceTo(t.p);if(dist<nearest&&this.line(eye,t.v?this.actorPoint(t.v):t.p.clone().add(new T.Vector3(0,-.3,0)))){nearest=dist;enemy=t;}}
  let target=this.objectives[e.target];if(target.owner===(ally?'blue':'red')&&this.time%6<dt)e.target=(e.target+1)%3;target=this.objectives[e.target];
  const waypoint=this.navigationTarget(e,target);let dx=waypoint.x-e.g.position.x,dz=waypoint.z-e.g.position.z,dist=Math.hypot(dx,dz);if(enemy&&nearest<16){dx=enemy.p.x-e.g.position.x;dz=enemy.p.z-e.g.position.z;dist=Math.hypot(dx,dz);}
  const moving=dist>(e.route?.length>1?1.5:4)&&!(enemy&&nearest<12);if(moving){const wading=this.map==='river'&&this.ground(e.g.position.x,e.g.position.z)<WATER_LEVEL-.15;const speed=(ally?3.9:3.15*difficulty.speedScale)*dt*(wading?.58:1);const old=e.g.position.clone();this.move(e.g.position,dx/dist*speed,dz/dist*speed,.5);if(e.g.position.distanceToSquared(old)<speed*speed*.15){this.move(e.g.position,Math.cos(e.seed+this.time*.45)*speed*1.7,Math.sin(e.seed+this.time*.45)*speed*1.7,.5);}}e.g.position.y=this.ground(e.g.position.x,e.g.position.z);
  const look=enemy?enemy.p:new T.Vector3(target.x,0,target.z);e.g.rotation.y=Math.atan2(look.x-e.g.position.x,look.z-e.g.position.z);e.legs[0].rotation.x=moving?Math.sin(this.time*9+e.seed)*.35:0;e.legs[1].rotation.x=-e.legs[0].rotation.x;
  e.shoot-=dt;if(enemy&&e.shoot<=0){e.shoot=(.8+Math.random()*.55)*(ally?1:difficulty.intervalScale);const end=enemy.v?this.actorPoint(enemy.v):enemy.p.clone().add(new T.Vector3(0,-.3,0));this.beam(eye,end,ally?'#81cabd':'#ec9e77',.018);this.gunshot(null,eye);if(Math.random()<(ally?.65:difficulty.infantryAccuracy)){if(enemy.v){enemy.v.hp-=ally?22:17;if(enemy.v.hp<=0)this.kill(enemy.v,false);}else{this.hp-=8;this.lastHit=this.time;this.damageFlash=.3;this.shake=1;if(this.hp<=0){this.hp=0;this.dead=4;this.deaths++;this.releaseFire();this.resetCombatEffects();this.resetMouseLook();this.red+=8;}}}}
 }
 update(dt){if(this.mode!=='playing')return;this.time+=dt;this.remaining-=dt;this.headshotFlash=Math.max(0,(this.headshotFlash||0)-dt);this.recoilPitch=(this.recoilPitch||0)*Math.exp(-9*dt);this.recoilYaw=(this.recoilYaw||0)*Math.exp(-12*dt);this.gunKick=(this.gunKick||0)*Math.exp(-18*dt);this.shake=(this.shake||0)*Math.exp(-12*dt);this.shotFlash=Math.max(0,(this.shotFlash||0)-dt);this.hitFlash=Math.max(0,(this.hitFlash||0)-dt);this.damageFlash=Math.max(0,(this.damageFlash||0)-dt);this.killNotice=Math.max(0,(this.killNotice||0)-dt);this.scan=Math.max(0,this.scan-dt);this.scanCooldown=Math.max(0,this.scanCooldown-dt);if(this.dead>0){this.dead-=dt;if(this.dead<=0){this.dead=0;this.resetCombatEffects();this.eyeHeight=1.72;this.hp=100;this.placePlayerAtBase();this.velocityY=0;this.energy=100;this.heat=0;this.overheat=false;this.reload=0;this.lastHit=this.time;}}else{
  this.updateMouseLook(dt);
  const lookX=(this.keys.ArrowRight?1:0)-(this.keys.ArrowLeft?1:0),lookY=(this.keys.ArrowDown?1:0)-(this.keys.ArrowUp?1:0);
  if(lookX||lookY)this.look(lookX*750*dt,lookY*750*dt,this.arrowSensitivity??1);
  let forward=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0)-this.touchMove.y;let side=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0)+this.touchMove.x;let len=Math.hypot(forward,side);if(len<=.05){forward=0;side=0;len=0;}if(len>1){forward/=len;side/=len;}
  const inWater=this.map==='river'&&this.ground(this.player.x,this.player.z)<WATER_LEVEL-.15;this.inWater=inWater;const crouch=!inWater&&(this.keys.ControlLeft||this.keys.KeyC),sprint=this.keys.ShiftLeft&&!this.isFiring()&&!this.aim;const mobility=stats(this.loadouts[this.slot]);this.currentSpeed=(crouch?mobility.crouchSpeed:sprint?mobility.sprintSpeed:mobility.moveSpeed)*(inWater?.58:1);this.moving=len>.05;const speed=this.currentSpeed*dt;this.move(this.player,(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)*speed,(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)*speed);
  const eye=crouch?1.12:1.72;const floor=this.floorAt(this.player.x,this.player.z,this.player.y-(this.eyeHeight||1.72))+eye;this.eyeHeight=eye;if(this.keys.Space&&this.player.y<=floor+.04&&!crouch){this.velocityY=7.2;this.keys.Space=false;}this.velocityY-=18*dt;this.player.y+=this.velocityY*dt;if(this.player.y<floor){this.player.y=floor;this.velocityY=0;}
  const firing=this.fireWeapon(dt);if(!firing&&this.time>=(this.nextPulseAt??0))this.heat=Math.max(0,this.heat-stats(this.loadouts[this.slot]).cooling*dt);if(this.overheat&&this.heat<25)this.overheat=false;
  if(this.reload>0){this.reload-=dt;if(this.reload<=0){this.energy=100;this.sound(520,.09,.08);}}
  const bob=len>0?Math.sin(this.time*(sprint?15:10))*.018:Math.sin(this.time*1.5)*.003;
  const optic=getScope(this.loadouts[this.slot].scope);this.adsBlend+=(Number(this.aim)-this.adsBlend)*(1-Math.exp(-optic.acquire*dt));
  const scopeFov=2*Math.atan(Math.tan(72*Math.PI/360)/optic.zoom)*180/Math.PI;
  const desiredFov=72+(scopeFov-72)*this.adsBlend;this.camera.fov+=(desiredFov-this.camera.fov)*(1-Math.exp(-optic.acquire*dt));this.camera.updateProjectionMatrix();
  this.weapon.position.set(.31*(1-this.adsBlend),-.32+bob*(1-this.adsBlend)-((this.reload>0||this.wptActive)?.22:0),-.65+this.gunKick*.085);
  this.weapon.rotation.set(this.gunKick*.06, -.025, this.reload>0?-.4:-side*.035*(1-this.adsBlend));
  if(len>.05&&this.player.y<=floor+.04&&this.time>=(this.stepAt||0)){this.stepAt=this.time+(sprint?.31:crouch?.62:.46);this.footstep(inWater,crouch);}
  }
  const view=this.viewAngles();this.camera.position.copy(this.player);this.camera.rotation.set(view.pitch,view.yaw,Math.sin(this.time*51)*(this.shake||0)*.009*(this.screenShake??.7),'YXZ');this.weapon.visible=this.dead<=0&&(this.adsBlend||0)<.65;
  if(this.muzzleFlash){this.muzzleFlash.material.opacity=this.shotFlash>0?.9:0;this.muzzleFlash.rotation.z=this.shotCount;this.muzzleLight.intensity=this.shotFlash>0?3:0;}
  this.world.updateMatrixWorld(true);for(const e of [...this.enemies,...this.allies])this.updateAI(e,dt);
  for(const o of this.objectives){const pd=!this.dead&&Math.hypot(this.player.x-o.x,this.player.z-o.z)<6.5&&Math.abs(this.player.y-o.y)<5?1:0;const blue=this.allies.filter(e=>e.dead<=0&&Math.hypot(e.g.position.x-o.x,e.g.position.z-o.z)<6.5).length+pd;const red=this.enemies.filter(e=>e.kind!=='drone'&&e.dead<=0&&Math.hypot(e.g.position.x-o.x,e.g.position.z-o.z)<6.5).length;const diff=blue-red;if(diff!==0)o.progress=clamp(o.progress+Math.sign(diff)*dt*(9+Math.min(2,Math.abs(diff))*3),-100,100);if(o.progress>=100)o.owner='blue';if(o.progress<=-100)o.owner='red';if(o.owner==='blue'&&o.progress<=0)o.owner='neutral';if(o.owner==='red'&&o.progress>=0)o.owner='neutral';const color=o.owner==='blue'?'#7bead2':o.owner==='red'?'#ee9177':'#efc98c';o.ring.material.color.set(color);o.beacon.material.color.set(color);if(o.owner==='blue')this.blue+=dt*.85;else if(o.owner==='red')this.red+=dt*.85;}
  this.updateWPT(dt);
  if(this.remaining<=0||this.blue>=250||this.red>=250){this.result=Object.freeze({matchId:this.matchId,difficultyId:this.difficulty.id,mapId:this.map,blue:Math.min(250,Math.floor(this.blue)),red:Math.min(250,Math.floor(this.red)),remaining:Math.max(0,this.remaining),outcome:matchOutcome(this.blue,this.red)});this.mode='result';this.resetCombatEffects();this.resetMouseInput();this.releaseFire();this.wptHeld=false;this.wptActive=false;if(document.pointerLockElement)document.exitPointerLock();this.emit();}
 }
 emit(){this.onState({gameMode:'conquest',mode:this.mode,trainingReport:this.trainingReport(),weaponXP:usageXP(this.trainingUsage?.[this.loadouts?.[this.slot]?.id]||{damage:0,kills:0,headshotKills:0}),dronesEnabled:this.dronesEnabled!==false,headshot:this.headshotFlash>0,headshots:this.headshots||0,headshotKills:this.headshotKills||0,killHeadshot:!!this.killHeadshot,aiming:!!this.aim&&!this.dead,scopeId:getScope(this.loadouts?.[this.slot]?.scope).id,aimMarkers:this.aimMarkers(),enemyMarkers:enemyMarkers(this,typeof innerWidth==='number'?innerWidth:1280,typeof innerHeight==='number'?innerHeight:720),objectiveMarkers:objectiveMarkers(this.camera,this.player,this.objectives,typeof innerWidth==='number'?innerWidth:1280,typeof innerHeight==='number'?innerHeight:720),mouseFallback:!!this.dragLook&&!this.touchActive,result:this.mode==='result'?this.result:null,difficultyId:(this.difficulty||getDifficulty('master')).id,hp:Math.ceil(this.hp??100),energy:Math.ceil(this.energy),heat:Math.ceil(this.heat),overheat:this.overheat,reload:this.reload,reloadTotal:this.reloadTotal||0,movementSpeed:this.currentSpeed||stats(this.loadouts?.[this.slot]||{elements:64,cooling:55,power:80,bits:5,mode:'focus',taper:'taylor',width:4}).moveSpeed,reloadSeconds:this.loadouts?.[this.slot]?stats(this.loadouts[this.slot]).reloadSeconds:0,wpt:this.wptState||{status:'ready',label:'初期基地',distance:0,progress:0},inWater:!!this.inWater,drones:this.enemies.filter(e=>e.kind==='drone'&&e.dead===0).length,slot:this.slot,blue:Math.min(250,Math.floor(this.blue||0)),red:Math.min(250,Math.floor(this.red||0)),remaining:Math.max(0,Math.ceil(this.remaining??300)),kills:this.kills||0,deaths:this.deaths||0,objectives:this.objectives.map(o=>({id:o.id,progress:o.progress,owner:o.owner,distance:Math.round(Math.hypot(this.player.x-o.x,this.player.z-o.z))})),dead:this.dead||0,scanCooldown:this.scanCooldown,scanning:this.scan>0,hit:this.hitFlash>0,damage:this.damageFlash>0,killNotice:this.killNotice>0,yaw:this.yaw,player:{x:this.player.x,z:this.player.z},enemies:this.enemies.filter(e=>!e.dead).map(e=>({x:e.g.position.x,z:e.g.position.z,kind:e.kind})),allies:this.allies.filter(e=>!e.dead).map(e=>({x:e.g.position.x,z:e.g.position.z,kind:e.kind})),...this.hudExtras?.()});}
 animate(now){if(this.disposed)return;const dt=Math.min(.05,(now-this.prev)/1000);this.prev=now;
  if(this.mode==='playing')this.update(dt);else if(this.mode==='menu'&&this.menuCamera)this.menuCamera(now);else if(this.mode==='menu'){const t=now*.000018;this.camera.position.set(58+Math.sin(t)*7,31+this.ground(58,58)*.4,59+Math.cos(t)*6);this.camera.lookAt(-2,2,-10);}
  if(this.mode==='playing'||this.mode==='menu'){const t=now/1000;if(this.sky)this.sky.material.uniforms.clock.value=t;if(this.snowfall){this.snowfall.position.y=-(t*1.6%34);this.snowfall.position.x=Math.sin(t*.3)*2;}if(this.water){this.water.material.userData.clock.value=t;this.waterFlow.position.z=(t*.7)%2;}}
  this.updateEffects(dt);
  this.acc+=dt;if(this.acc>.075&&this.mode==='playing'){this.acc=0;this.emit();}this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.animate);
 }
 initAudio(){if(this.audio){this.audio.resume().catch(()=>{});return;}try{this.audio=new (window.AudioContext||window.webkitAudioContext)();this.audio.resume().catch(()=>{});}catch{}}
 sound(freq,duration,gain){if(!this.audio||this.volume===0||this.audio.state==='suspended')return;try{const osc=this.audio.createOscillator(),g=this.audio.createGain(),t=this.audio.currentTime;osc.type='triangle';osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(freq*.35,t+duration);g.gain.setValueAtTime(gain*this.volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(g);g.connect(this.audio.destination);osc.onended=()=>{osc.disconnect();g.disconnect();};osc.start(t);osc.stop(t+duration);}catch{}}
 noiseBuffer(){if(!this.shotNoise){const a=this.audio,b=a.createBuffer(1,Math.ceil(a.sampleRate*.5),a.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.shotNoise=b;}return this.shotNoise;}
 gunshot(setup,position=null,drone=false){
  if(!this.audio||!this.volume||this.audio.state==='suspended'||(this.audioVoices||0)>=24)return;
  const distance=position?position.distanceTo(this.player):0;if(distance>130)return;
  const a=this.audio,t=a.currentTime,far=!!position,volume=this.volume*(far?.21:.48)/(1+distance*.035),nodes=[];let counted=false;
  try{
   const noise=a.createBufferSource(),filter=a.createBiquadFilter(),envelope=a.createGain(),body=a.createOscillator(),thump=a.createGain(),tail=a.createDelay(.3),echo=a.createGain(),pan=a.createStereoPanner();nodes.push(noise,filter,envelope,body,thump,tail,echo,pan);
   noise.buffer=this.noiseBuffer();filter.type='lowpass';filter.frequency.value=(drone?3600:2400)/(1+distance*.02);
   envelope.gain.setValueAtTime(volume,t);envelope.gain.exponentialRampToValueAtTime(.0001,t+.18);noise.connect(filter);filter.connect(envelope);envelope.connect(pan);
   body.type='triangle';body.frequency.setValueAtTime(drone?210:95+(setup?.power||70)*.45,t);body.frequency.exponentialRampToValueAtTime(38,t+.12);thump.gain.setValueAtTime(volume*.7,t);thump.gain.exponentialRampToValueAtTime(.0001,t+.15);body.connect(thump);thump.connect(pan);
   tail.delayTime.value=.09;echo.gain.value=.2;envelope.connect(tail);tail.connect(echo);echo.connect(pan);
   if(position){const dx=position.x-this.player.x,dz=position.z-this.player.z;pan.pan.value=clamp((dx*Math.cos(this.yaw)-dz*Math.sin(this.yaw))/Math.max(1,distance),-1,1);}pan.connect(a.destination);
   this.audioVoices=(this.audioVoices||0)+1;counted=true;
   body.onended=()=>{for(const node of nodes)node.disconnect();this.audioVoices=Math.max(0,this.audioVoices-1);};
   noise.start(t);noise.stop(t+.2);body.start(t);body.stop(t+.32);
  }catch{for(const node of nodes)try{node.disconnect();}catch{}if(counted)this.audioVoices=Math.max(0,this.audioVoices-1);}
 }
 footstep(water,crouch){if(!this.audio||!this.volume||this.audio.state==='suspended')return;const a=this.audio,nodes=[];try{const noise=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),t=a.currentTime;nodes.push(noise,filter,gain);noise.buffer=this.noiseBuffer();filter.type='lowpass';filter.frequency.value=water?1200:480;gain.gain.setValueAtTime(this.volume*(crouch?.035:water?.11:.065),t);gain.gain.exponentialRampToValueAtTime(.0001,t+.11);noise.connect(filter);filter.connect(gain);gain.connect(a.destination);noise.onended=()=>nodes.forEach(n=>n.disconnect());noise.start(t);noise.stop(t+.12);}catch{nodes.forEach(n=>n.disconnect());}}
 dispose(){this.disposed=true;cancelAnimationFrame(this.frame);for(const [el,n,f]of this.listeners)el.removeEventListener(n,f);this.clearWorld();this.weapon.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});Object.values(this.sharedGeo).forEach(g=>g.dispose());this.renderer.dispose();this.audio?.close();}
}
