// One layout source drives terrain, collision, navigation, the lobby map and the radar.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const ring=(rx,rz,n=16)=>Array.from({length:n+1},(_,i)=>[Math.sin(i/n*Math.PI*2)*rx,Math.cos(i/n*Math.PI*2)*rz]);
export const MAPS=[
 {id:'base',name:'RELAY DISTRICT',jp:'段丘の通信市街地',tag:'市街地 / 三本道',desc:'中央の大通り、低い西路地、高い東街区。横道から回り込み、交差点を挟んで通信拠点を奪い合う。',height:'約7 m',weather:'晴れ / 16:40',color:'#b7a283'},
 {id:'canyon',name:'QUARRY LOOP',jp:'環状採掘場',tag:'採掘場 / 段丘',desc:'低い採掘底と高い外周を結ぶ段丘。中央の近道は射線にさらされる。岩陰をつないで外周から挟撃しよう。',height:'約25 m',weather:'薄曇り / 17:20',color:'#af8066'},
 {id:'ridge',name:'SUMMIT SPINE',jp:'山頂の中継要塞',tag:'尾根 / 迂回路',desc:'中央の山頂は広い射線を持つが、両側の谷から攻め込まれる。岩の背後と折り返し道を使い、高所を攻略。',height:'約26 m',weather:'晴れ / 08:10',color:'#799b92'},
 {id:'snow',name:'FROST CALDERA',jp:'雪のカルデラ観測所',tag:'雪 / 環状ルート',desc:'雪の外輪山が低い観測盆地を囲む。外周を回って奇襲するか、遮蔽物のある盆地を横断するかを選べる。',height:'約20 m',weather:'降雪 / 09:10',color:'#d4e4ed'},
 {id:'river',name:'TWIN CROSSING',jp:'二つの渡河拠点',tag:'河川 / 渡河戦',desc:'蛇行する川と高い両岸。北の渡河路と南の中継島が攻防の焦点。浅瀬を使った側面攻撃も可能。',height:'約14 m',weather:'晴れ / 15:20',color:'#579cab'},
 {id:'dam',name:'SPILLWAY HEIGHTS',jp:'堰堤の高台',tag:'堰堤 / 段丘と横断路',desc:'横に長い戦場を東西から攻略。低い北岸の迂回路と高い南側の堰堤を使い分け、三つの防御陣地を横から崩す。',height:'約17 m',weather:'薄曇り / 16:10',color:'#839b9c'},
 {id:'works',name:'FAULTLINE WORKS',jp:'断層の工業地帯',tag:'工場 / 塹壕と高台',desc:'蛇行する低い塹壕と段差のある工場群。塹壕で射線を切り、高所の側道から中央陣地を挟み込む。',height:'約16 m',weather:'晴れ / 18:10',color:'#a89179'}
];
export const LAYOUTS={
 base:{bounds:[[-82,-72],[82,-72],[82,72],[-82,72]],spawn:[0,58],enemySpawn:[0,-58],objectives:[[-42,0],[0,0],[42,0]],roadWidth:7,roads:[[[0,64],[0,-64]],[[-42,64],[-42,-64]],[[42,64],[42,-64]],[[-74,36],[74,36]],[[-74,-36],[74,-36]],[[-74,0],[74,0]]],buildings:[[-21,18,19,19,8],[-21,-18,18,18,10],[21,18,18,18,11],[21,-18,19,18,7],[-64,20,15,20,6],[-64,-23,15,19,8],[64,20,15,18,12],[64,-22,14,18,7],[-22,54,15,15,5],[23,-54,16,14,6]],containers:[[-60,47,0,'#667c76'],[61,-48,1,'#947148'],[-57,-52,1,'#827159'],[57,48,0,'#3d666c']],barriers:[[-31,3,1],[30,-3,1],[3,17,0],[-4,-20,0],[-45,23,0],[45,-24,0]],rocks:[]},
 canyon:{bounds:ring(82,76,20).slice(0,-1),spawn:[-58,34],enemySpawn:[58,-34],objectives:[[-38,-20],[0,0],[36,22]],roadWidth:7,roads:[ring(57,52),[[-58,34],[-38,22],[-20,-2],[0,0],[22,8],[36,22],[55,35]],[[-38,-20],[-18,-33],[22,-32],[58,-34]]],buildings:[[-62,-14,10,14,5],[56,4,11,17,6],[-24,49,14,10,5],[22,-51,15,10,6]],containers:[[-19,-12,1,'#9f6d46'],[14,17,0,'#7f5b43'],[-43,8,0,'#8d7455']],barriers:[[-5,15,0],[8,-17,0],[-29,-30,1],[43,11,1]],rocks:[[-20,16,5,12,7],[19,-16,6,13,9],[-49,-41,8,8,8],[40,43,9,7,9],[-2,-39,10,6,8],[3,40,8,6,8]]},
 ridge:{bounds:[[0,-84],[69,-38],[70,36],[0,82],[-69,38],[-70,-36]],spawn:[-45,45],enemySpawn:[45,-45],objectives:[[-32,-20],[0,5],[30,28]],roadWidth:6,roads:[[[-45,45],[-47,15],[-32,-20],[-23,-55],[16,-62],[45,-45]],[[45,-45],[47,-12],[42,12],[30,28],[12,52],[-20,58],[-45,45]],[[-47,15],[-27,32],[0,28],[0,5],[20,-12],[47,-12]]],buildings:[[-45,-43,11,13,6],[44,42,12,12,5],[0,-16,12,10,5],[-17,51,11,9,4]],containers:[[-52,7,0,'#526963'],[47,8,0,'#667c76'],[13,36,1,'#7c8073']],barriers:[[-12,5,1],[12,7,1],[-22,-15,0],[27,16,0]],rocks:[[-21,3,6,20,7],[23,-2,7,17,8],[-9,-42,12,7,9],[7,46,7,7,7]]},
 snow:{bounds:ring(80,80,24).slice(0,-1),spawn:[0,64],enemySpawn:[0,-64],objectives:[[-40,-4],[0,-8],[40,8]],roadWidth:6,roads:[ring(57,57,24),[[-60,-4],[-40,-4],[0,-8],[40,8],[60,8]],[[0,64],[-15,34],[0,-8],[18,-34],[0,-64]]],buildings:[[-25,24,12,13,5],[22,-28,14,12,6],[-24,-32,10,12,5],[31,36,11,11,4]],containers:[[-14,7,1,'#7c919c'],[15,14,0,'#a7b5be'],[-49,21,0,'#6d8590']],barriers:[[-3,10,0],[11,-13,1],[-31,6,0],[34,-4,0]],rocks:[[-54,-28,8,10,8],[53,30,8,10,8],[-25,-2,5,8,5],[26,3,5,8,5]]},
 river:{bounds:[[-71,-73],[63,-73],[82,-18],[73,70],[-63,73],[-82,17]],spawn:[-56,46],enemySpawn:[56,-46],objectives:[[-40,-20],[10,26],[40,2]],crossings:[-32,26],roadWidth:7,roads:[[[-56,46],[-42,26],[-40,-20],[-40,-54]],[[56,-46],[42,-32],[40,2],[42,52]],[[-45,-32],[40,-32]],[[-44,26],[44,26]]],buildings:[[-57,3,13,18,7],[57,25,13,18,9],[-56,-47,14,14,6],[54,-9,12,12,7],[-25,47,12,10,5]],containers:[[-26,-25,0,'#567773'],[26,-41,0,'#827159'],[28,43,1,'#947148']],barriers:[[-29,14,1],[28,20,1],[-30,-43,0],[31,-16,0]],rocks:[[-64,24,6,8,6],[62,-28,6,8,7]]}
};
LAYOUTS.dam={bounds:[[-83,-38],[-62,-65],[63,-65],[83,-36],[83,42],[56,66],[-62,66],[-83,35]],spawn:[-65,0],enemySpawn:[65,0],objectives:[[-30,29],[0,0],[30,-29]],roadWidth:7,roads:[[[-69,0],[-48,-27],[-20,-38],[30,-29],[53,-22],[69,0]],[[-69,0],[-48,26],[-30,29],[0,43],[40,33],[69,0]],[[-50,4],[-25,0],[0,0],[25,0],[50,-4]],[[0,43],[0,0],[-20,-38]]],buildings:[[-49,-48,13,10,6],[49,48,13,11,7],[-30,-18,15,14,8],[30,18,15,14,9],[-53,45,12,10,5],[54,-47,11,10,5]],containers:[[-14,21,1,'#60777b'],[14,-21,1,'#987951'],[-53,-7,0,'#698278']],barriers:[[-48,18,1],[48,-18,1],[-17,-7,0],[17,7,0]],rocks:[[-13,51,7,5,6],[13,-51,7,5,6]]};
LAYOUTS.works={bounds:[[-76,-72],[40,-78],[79,-43],[67,74],[-41,81],[-81,36]],spawn:[-51,55],enemySpawn:[51,-55],objectives:[[-37,-22],[0,10],[37,35]],roadWidth:6,roads:[[[-51,55],[-57,12],[-37,-22],[-30,-58],[18,-63],[51,-55]],[[51,-55],[57,-19],[52,13],[37,35],[13,59],[-25,65],[-51,55]],[[-57,12],[-32,1],[0,10],[27,18],[52,13]],[[0,10],[2,-19],[18,-63]]],buildings:[[-54,-48,18,12,8],[-26,33,16,12,10],[26,-32,18,15,12],[54,53,14,12,7],[-6,-44,12,10,6]],containers:[[-23,-14,0,'#a16e42'],[23,35,0,'#546d71'],[38,-4,1,'#798276'],[-41,45,1,'#8c6e50']],barriers:[[-12,17,1],[13,0,1],[-45,-4,0],[45,23,0]],rocks:[[-66,31,6,9,6],[65,-35,6,8,6]]};
// Half-height and standing cover sit entirely inside each 6.5 m capture circle.
for(const [id,l] of Object.entries(LAYOUTS)){l.captureCover=l.objectives.flatMap(([x,z],i)=>{const rotated=id==='dam'||i===1;return [-1,1].map(side=>rotated?[x+side*1.5,z+side*3.6,.75,2.6,side<0?1.25:1.95]:[x+side*3.6,z+side*1.5,2.6,.75,side<0?1.25:1.95]);});}
export function layoutFor(id){return LAYOUTS[id]||LAYOUTS.base;}
export function playable(id,x,z,margin=0){const pts=layoutFor(id).bounds;let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [ax,az]=pts[i],[bx,bz]=pts[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;if(margin){const dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);if(Math.hypot(x-ax-t*dx,z-az-t*dz)<margin)return false;}}return inside;}
export const WATER_LEVEL=-.28;
export function riverCenter(z){return 6+8*Math.sin(z*.035);}
function rawTerrain(id,x,z){
 if(id==='base')return 6*smooth((x+24)/65)+.75*Math.sin(z*.028);
 if(id==='canyon'){const r=Math.hypot(x*.92,z*1.05);return -5+8*smooth((r-17)/22)+10*smooth((r-39)/24)+7*smooth((r-66)/24);}
 if(id==='ridge')return 1+26*Math.exp(-(x*x/1050+(z-4)*(z-4)/1700))+2*Math.sin(z*.045)*Math.sin(x*.05);
 if(id==='snow'){const r=Math.hypot(x,z);return -2+18*Math.exp(-(((r-50)/20)**2))+2*Math.sin(x*.037)*Math.cos(z*.047);}
 if(id==='dam')return 2+12*smooth((z+28)/55)+5*Math.exp(-x*x/1400);
 if(id==='works')return 3+9*smooth((x+45)/80)-5*Math.exp(-(((z-10*Math.sin(x*.04))/14)**2))+1.2*Math.sin(z*.035);
 if(id==='river'){const d=Math.abs(x-riverCenter(z)),bank=5+4*Math.sin(x*.023)+3*Math.sin(z*.035)**2,bed=-1.65;let h=bed+(bank-bed)*smooth((d-5)/15);for(const crossing of LAYOUTS.river.crossings){const blend=1-smooth((Math.abs(z-crossing)-3)/6);h+=Math.max(0,2.1-h)*blend;}return h;}
 return 0;
}
export function terrain(id,x,z){const l=layoutFor(id);let h=rawTerrain(id,x,z);
 // Flat capture and supply circles; broad shoulders keep their approaches traversable.
 for(const [px,pz] of [l.spawn,l.enemySpawn,...l.objectives]){const d=Math.hypot(x-px,z-pz),shoulder=id==='river'&&px===10&&pz===26?22:7;if(d<8+shoulder){const flat=rawTerrain(id,px,pz),weight=1-smooth((d-8)/shoulder);h+=(flat-h)*weight;}}
 // Foundations also flatten the collision footprint rather than floating on a slope.
 for(const [px,pz,w,d] of l.buildings){const outside=Math.hypot(Math.max(Math.abs(x-px)-w/2,0),Math.max(Math.abs(z-pz)-d/2,0));if(outside<6){const weight=1-smooth(outside/6);h+=(rawTerrain(id,px,pz)-h)*weight;}}
 return h;
}
