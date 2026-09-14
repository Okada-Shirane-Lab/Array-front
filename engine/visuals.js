import * as T from './three.module.js';

// All materials are generated locally. World-space detail keeps a constant scale
// across differently sized structures and never changes collision geometry.
const noiseGLSL=`
float afHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float afNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(afHash(i),afHash(i+vec3(1,0,0)),f.x),mix(afHash(i+vec3(0,1,0)),afHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(afHash(i+vec3(0,0,1)),afHash(i+vec3(1,0,1)),f.x),mix(afHash(i+vec3(0,1,1)),afHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;

export function surfaceMaterial(color,kind='stone',extra={}){
 const {localCoordinates=kind==='fabric',...parameters}=extra;
 const m=new T.MeshStandardMaterial({color,roughness:kind==='metal'?.48:.94,dithering:true,...parameters});
 m.userData.surface=kind;
 m.customProgramCacheKey=()=>`array-surface-v1-${kind}-${localCoordinates}`;
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 afWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
   vec4 afPosition=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
    afPosition=instanceMatrix*afPosition;
   #endif
   afWorld=${localCoordinates?'afPosition.xyz':'(modelMatrix*afPosition).xyz'};`);
  shader.fragmentShader='varying vec3 afWorld;\n'+noiseGLSL+shader.fragmentShader;
  const scale=kind==='fabric'?30:kind==='metal'?17:kind==='road'?13:7;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float afCoarse=afNoise(afWorld*.7),afFine=afNoise(afWorld*${scale.toFixed(1)});
   float afFade=1.0-smoothstep(30.0,90.0,length(vViewPosition));
   float afHeight=afFine*afFade;
   diffuseColor.rgb*=.79+afCoarse*.25+(afFine-.5)*.22*afFade;
   ${kind==='concrete'?`float afSeam=1.0-smoothstep(.015,.055,abs(fract(afWorld.y*.6)-.5));diffuseColor.rgb*=1.0-afSeam*.23;diffuseColor.rgb*=.8+.2*smoothstep(0.0,2.0,afWorld.y);`:''}
   ${kind==='metal'?`float afWear=smoothstep(.74,.9,afFine);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.24,.15),afWear*.2*afFade);`:''}
   ${kind==='fabric'?`diffuseColor.rgb*=.84+.16*step(.45,afNoise(afWorld*9.0));`:''}
   ${kind==='ground'?`float afPatch=afNoise(afWorld*.17);diffuseColor.rgb*=.8+afPatch*.4;`:''}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+(afFine-.5)*.15,.18,1.0);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 afDx=dFdx(-vViewPosition),afDy=dFdy(-vViewPosition);
   vec3 afR1=cross(afDy,normal),afR2=cross(normal,afDx);
   float afDet=dot(afDx,afR1);
   vec3 afGradient=sign(afDet)*(dFdx(afHeight)*afR1+dFdy(afHeight)*afR2);
   normal=normalize(max(abs(afDet),1e-10)*normal-${kind==='metal'?'.007':kind==='fabric'?'.006':'.022'}*afGradient);
  `);
 };
 return m;
}

export const ATMOSPHERES={
 dam:{sky:'#587c8b',horizon:'#c2d0cf',sun:'#ffe6c5',ground:'#566e69',strength:2.7,ambient:1.3,position:[-58,63,-76],cloud:.45},
 works:{sky:'#6a7786',horizon:'#c6af94',sun:'#ffcd92',ground:'#685d4b',strength:3.2,ambient:1.2,position:[-87,41,-40],cloud:.58},
 base:{sky:'#52778c',horizon:'#c5c5b4',sun:'#ffe2b6',ground:'#716755',strength:3.1,ambient:1.25,position:[-75,68,-45],cloud:.51},
 canyon:{sky:'#526e82',horizon:'#c6a98a',sun:'#ffd19a',ground:'#7c5841',strength:3.4,ambient:1.15,position:[-92,47,-35],cloud:.64},
 ridge:{sky:'#466d89',horizon:'#b4c5ce',sun:'#ffecd1',ground:'#435449',strength:2.8,ambient:1.3,position:[-55,78,-72],cloud:.49},
 snow:{sky:'#798eaa',horizon:'#d1dce4',sun:'#e6f1ff',ground:'#798898',strength:2.05,ambient:1.45,position:[-58,62,-64],cloud:.39},
 river:{sky:'#4c7d90',horizon:'#c1d3ce',sun:'#ffe5bb',ground:'#425d53',strength:2.8,ambient:1.25,position:[-68,59,-70],cloud:.49}
};

export function skyDome(id){
 const a=ATMOSPHERES[id]||ATMOSPHERES.base;
 const m=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{topColor:{value:new T.Color(a.sky)},horizonColor:{value:new T.Color(a.horizon)},sunColor:{value:new T.Color(a.sun)},sunDirection:{value:new T.Vector3(...a.position).normalize()},clock:{value:0},cloudCover:{value:a.cloud}},vertexShader:`varying vec3 skyDir;void main(){skyDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`varying vec3 skyDir;uniform vec3 topColor,horizonColor,sunColor,sunDirection;uniform float clock,cloudCover;${noiseGLSL}
 void main(){vec3 d=normalize(skyDir);float h=max(0.0,d.y);vec3 color=mix(horizonColor,topColor,pow(h,.48));
 vec3 p=d*6.0+vec3(clock*.003,0.0,clock*.001);float cloud=afNoise(p)*.65+afNoise(p*2.7)*.25+afNoise(p*7.0)*.1;
 float mask=smoothstep(cloudCover,cloudCover+.19,cloud)*smoothstep(.015,.22,h);color=mix(color,mix(horizonColor,vec3(.94),.6),mask*.83);
 float sun=max(0.0,dot(d,sunDirection));color+=sunColor*(pow(sun,420.0)*.8+pow(sun,14.0)*.14)*(1.0-mask*.85);
 gl_FragColor=vec4(color,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const mesh=new T.Mesh(new T.SphereGeometry(545,32,16),m);mesh.renderOrder=-100;mesh.userData.sky=true;return mesh;
}

export function waterMaterial(){
 const m=new T.MeshStandardMaterial({color:'#438b91',transparent:true,opacity:.83,roughness:.22,metalness:.25,side:T.DoubleSide,depthWrite:false});
 const clock={value:0};m.userData.clock=clock;m.customProgramCacheKey=()=> 'array-water-v1';
 m.onBeforeCompile=s=>{s.uniforms.afTime=clock;s.vertexShader='varying vec3 afWater;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nafWater=(modelMatrix*vec4(transformed,1.0)).xyz;');s.fragmentShader='varying vec3 afWater;uniform float afTime;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec2 wave=vec2(cos(afWater.x*2.3+afWater.z*.8+afTime*1.8)*.16+cos(afWater.x*.55-afWater.z*1.7-afTime)*.08,sin(afWater.z*2.7-afTime*1.4)*.13);
 normal=normalize(normal+mat3(viewMatrix)*vec3(wave.x,0.0,wave.y));`);};return m;
}

export function dustMaterial(color){return new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{color:{value:new T.Color(color)},opacity:{value:.35},size:{value:22}},vertexShader:`uniform float size;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(size*80.0/max(1.0,-p.z),1.0,80.0);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform vec3 color;uniform float opacity;void main(){vec2 p=gl_PointCoord-.5;float a=(1.0-smoothstep(.12,.5,length(p)))*opacity;gl_FragColor=vec4(color,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});}

export function addGroundDetail(game){
 const g=game,green=g.map==='ridge'||g.map==='river',snow=g.map==='snow';
 const geo=green?new T.ConeGeometry(.13,.58,3):new T.DodecahedronGeometry(.2,0);
 const mat=new T.MeshStandardMaterial({color:snow?'#adbfc9':green?'#6c7950':'#817660',roughness:1});
 const count=green?700:360,mesh=new T.InstancedMesh(geo,mat,count),dummy=new T.Object3D();let actual=0;
 for(let i=0;i<count*2&&actual<count;i++){const x=Math.sin(i*81.31)*83,z=Math.cos(i*43.73)*83,y=g.ground(x,z);if(!g.layout||!Number.isFinite(y)||g.blocked(x,z,.6)||y<-.2)continue;
  // Keep objective circles and movement lanes visually legible.
  if(g.objectives.some(o=>Math.hypot(o.x-x,o.z-z)<9))continue;
  dummy.position.set(x,y+(green?.22:.06),z);dummy.rotation.set(0,i*2.399,.12*Math.sin(i));dummy.scale.setScalar(.6+(i%9)*.12);dummy.updateMatrix();mesh.setMatrixAt(actual++,dummy.matrix);
 }
 mesh.count=actual;mesh.receiveShadow=true;mesh.userData.detail=true;g.world.add(mesh);g.groundDetail=mesh;
}

export function batchSmallDetails(game){
 game.world.updateMatrixWorld(true);const groups=new Map(),exclude=new Set([...game.occluders,...game.objectives.map(o=>o.beacon)]);
 game.world.traverse(o=>{if(!o.isMesh||o.geometry!==game.sharedGeo.box||exclude.has(o)||Math.max(o.scale.x,o.scale.y,o.scale.z)>4||Math.min(o.scale.x,o.scale.y,o.scale.z)>.36)return;let group=groups.get(o.material);if(!group){group=[];groups.set(o.material,group);}group.push(o);});
 for(const [material,items] of groups){if(items.length<3)continue;const mesh=new T.InstancedMesh(game.sharedGeo.box,material,items.length);items.forEach((o,i)=>{mesh.setMatrixAt(i,o.matrixWorld);o.removeFromParent();});mesh.receiveShadow=true;mesh.castShadow=false;game.world.add(mesh);}
}
