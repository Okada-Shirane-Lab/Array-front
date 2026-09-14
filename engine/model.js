export {trainingLevel,trainingLimits,editingLimits,trainingStatus,TRAINING_THRESHOLDS,TRAINING_UNLOCKS,withinTraining,clampToTraining,usageXP,validTrainingReport} from './training.js';
export const SCOPES=Object.freeze([
 {id:'reflex',label:'リフレックス',zoom:1.25,acquire:20,description:'1.25×。広い周辺視野と素早い照準。近距離向け。'},
 {id:'holo',label:'ホログラフィック',zoom:1.6,acquire:17,description:'1.6×。円形レティクルで動く敵を追いやすい。'},
 {id:'combat',label:'コンバット',zoom:2.5,acquire:14,description:'2.5×。中距離向けの十字線。従来のスコープ。'},
 {id:'marksman',label:'マークスマン',zoom:4,acquire:9,description:'4×。遠距離向けの目盛り。視野が狭く、構えるまでが遅い。'}
].map(profile=>Object.freeze(profile)));
export function getScope(id){return SCOPES.find(s=>s.id===id)||SCOPES[2];}
export function completionLabel(id){return id==='shirane'?'撃破':'修了';}
export const PRESETS=[
 {id:'precision',name:'LANCER / 精密射撃',mode:'focus',beamCount:1,elements:64,bits:5,power:80,width:4,split:18,taper:'taylor',cooling:55,scope:'combat',steering:0,fireRate:6,scanWidth:0,color:'#85f3d2'},
 {id:'sweep',name:'HALO / 広角制圧',mode:'wide',beamCount:1,elements:32,bits:3,power:70,width:24,split:18,taper:'uniform',cooling:70,scope:'combat',steering:0,fireRate:8,scanWidth:0,color:'#ffd28b'},
 {id:'trident',name:'TRIDENT / 3方向分割',mode:'split',beamCount:3,elements:64,bits:4,power:90,width:7,split:16,taper:'hann',cooling:45,scope:'combat',steering:0,fireRate:5,scanWidth:0,color:'#90c4ff'}
];
import {MAPS} from './maps.js';
export {MAPS,LAYOUTS,layoutFor,playable,terrain,riverCenter,WATER_LEVEL} from './maps.js';
// Master reproduces the original enemy AI. Profiles alter enemies only.
export const DIFFICULTIES=Object.freeze([
 {id:'bachelor',label:'学士',rank:1,description:'敵の攻撃がゆっくり。射撃・拠点制圧・WPT回復の基本を身につけよう。',infantryAccuracy:.28,droneAccuracy:.26,intervalScale:1.45,infantrySight:36,droneSight:40,speedScale:.86},
 {id:'master',label:'修士',rank:2,description:'これまでと同じ強さ。武器を切り替え、遮蔽物を活かして進軍しよう。',infantryAccuracy:.49,droneAccuracy:.48,intervalScale:1,infantrySight:44,droneSight:48,speedScale:1},
 {id:'doctor',label:'博士',rank:3,description:'通常の最高難易度。的確な攻撃に備え、拠点と給電地点を確保しよう。',infantryAccuracy:.60,droneAccuracy:.56,intervalScale:.90,infantrySight:51,droneSight:55,speedScale:1.1},
 {id:'shirane',label:'白根',rank:4,description:'解放後の最高難易度。さらに鋭い索敵と猛攻。歩兵とドローンの包囲を突破せよ。',infantryAccuracy:.84,droneAccuracy:.80,intervalScale:.56,infantrySight:62,droneSight:66,speedScale:1.25}
].map(profile=>Object.freeze(profile)));
export function getDifficulty(id){return DIFFICULTIES.find(profile=>profile.id===id)||DIFFICULTIES[1];}
export const BASE_DIFFICULTIES=Object.freeze(['bachelor','master','doctor']);
export function clearedDifficulties(ids){return DIFFICULTIES.filter(d=>Array.isArray(ids)&&ids.includes(d.id)).map(d=>d.id);}
export function isShiraneUnlocked(ids){const cleared=clearedDifficulties(ids);return BASE_DIFFICULTIES.every(id=>cleared.includes(id));}
export function canPlayDifficulty(id,cleared=[]){return DIFFICULTIES.some(d=>d.id===id)&&(id!=='shirane'||isShiraneUnlocked(cleared));}
// Integer points are displayed throughout the match and decide its result.
export function matchOutcome(blue,red){const b=Math.min(250,Math.floor(blue)),r=Math.min(250,Math.floor(red));return b===r?'draw':b>r?'victory':'defeat';}
export function validVictory(result){return !!result&&result.gameMode!=='survival'&&DIFFICULTIES.some(d=>d.id===result.difficultyId)&&MAPS.some(m=>m.id===result.mapId)&&['blue','red'].every(k=>Number.isInteger(result[k])&&result[k]>=0&&result[k]<=250)&&Number.isFinite(result.remaining)&&result.remaining>=0&&result.remaining<=300&&(result.remaining===0||result.blue===250||result.red===250)&&matchOutcome(result.blue,result.red)==='victory';}
export function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
export function beamCount(s){return Number.isInteger(s.beamCount)&&s.beamCount>=1&&s.beamCount<=5?s.beamCount:s.mode==='split'?3:1;}
// split remains a half-fan angle so existing saved layouts retain their directions.
export function beamSpacing(s){return beamCount(s)>1?2*s.split/(beamCount(s)-1):0;}
export function beamCenter(s,time=0){return (s.steering??0)+(s.scanWidth??0)*Math.sin(time*1.6);}
export function beamOffsets(s,time=0){const count=beamCount(s),center=beamCenter(s,time);return count===1?[center]:Array.from({length:count},(_,i)=>center-s.split+2*s.split*i/(count-1));}
// Only missing legacy values are migrated. Invalid submitted values stay invalid.
export function normalizeSetup(s){return {scope:'combat',steering:0,fireRate:6,scanWidth:0,...s,beamCount:s.beamCount===undefined?(s.mode==='split'?3:1):s.beamCount};}
export function normalizeData(d){return {...d,setups:d.setups.map(normalizeSetup)};}
export function stats(s){
 const aperture=Math.sqrt(s.elements/32), taper=s.taper==='hann'?1.3:s.taper==='taylor'?1.12:1;
 const requestedWidth=clamp(s.width,1,50),width=requestedWidth*taper*(s.mode==='wide'?1:1/Math.sqrt(aperture));
 const fireRate=s.fireRate??6,rate=fireRate/6,steering=s.steering??0,scanWidth=s.scanWidth??0;
 // Coverage costs gain even within a mode. Cadence boosts burst damage faster than efficiency.
 const gain=(4/requestedWidth)**.32,scanGain=Math.cos(steering*Math.PI/180)**1.2*(1-scanWidth*.006);
 const range=(40+32*aperture)*(s.mode==='wide'?.65:1)*(s.taper==='hann'?.9:1)*Math.sqrt(gain*scanGain);
 const cooling=12+s.cooling*.17;
 const heat=(12+32*(s.power/100)**2)*(1+s.elements/512)*(1+(s.bits-2)*.035)*(s.mode==='split'?1.12:1)*rate**.85*(1+scanWidth*.005);
 const dps=(66*s.power/100)*(s.taper==='hann'?.91:s.taper==='taylor'?.96:1)*(1-s.cooling*.0016)*gain*scanGain*rate**.4;
 const load=s.elements*.016+s.cooling*.009+s.power*.004+s.bits*.055;
 const moveSpeed=clamp(6.65-load*.65,3.6,6.4),reloadSeconds=1.05+s.elements*.008+s.power*.006+s.bits*.045+s.cooling*.002+(s.mode==='split'?.15:0);
 const drain=(8+s.power*.15+s.elements*.045+s.cooling*.035)*rate**.65*(1+scanWidth*.004);
 const stability=s.taper==='hann'?.48:s.taper==='taylor'?.72:1;
 const recoil=(.007+s.power*.00011)*(1.2/(.8+aperture*.3))*Math.sqrt(6/fireRate)*stability;
 return {moveSpeed,sprintSpeed:moveSpeed*1.6,crouchSpeed:moveSpeed*.54,reloadSeconds,range,width,dps,heat,cooling,duration:Math.min(100/heat,100/drain),drain,spread:.011*(7-s.bits)*stability,follow:1/(1+s.elements/180),fireRate,shotInterval:1/fireRate,shotDamage:dps/fireRate,heatPerShot:heat/fireRate,energyPerShot:drain/fireRate,recoil,sustainedDps:dps*cooling/(heat+cooling)};
}
export function validSetup(s){
 return s&&typeof s.id==='string'&&s.id.length>0&&s.id.length<=80&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=48&&['focus','wide','split'].includes(s.mode)&&(s.beamCount===undefined||(Number.isInteger(s.beamCount)&&s.beamCount>=1&&s.beamCount<=5))&&[16,32,64,128,192,256].includes(s.elements)&&Number.isInteger(s.bits)&&s.bits>=2&&s.bits<=6&&['uniform','taylor','hann'].includes(s.taper)&&[['power',40,120],['width',1,50],['split',5,45],['cooling',0,100]].every(([k,a,b])=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=a&&s[k]<=b)&&[['steering',-35,35],['fireRate',2,16],['scanWidth',0,25]].every(([k,a,b])=>s[k]===undefined||(typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=a&&s[k]<=b))&&(s.fireRate===undefined||Number.isInteger(s.fireRate))&&(s.scope===undefined||SCOPES.some(o=>o.id===s.scope))&&Math.abs(s.steering??0)+(s.scanWidth??0)+(beamCount(s)>1?s.split:0)<=85&&/^#[0-9a-f]{6}$/i.test(s.color);
}
export function defaultData(){return {setups:PRESETS.map(x=>({...x})),slots:PRESETS.map(x=>x.id)};}
export function validateData(d){return d&&Array.isArray(d.setups)&&d.setups.length>=1&&d.setups.length<=24&&d.setups.every(validSetup)&&new Set(d.setups.map(s=>s.id)).size===d.setups.length&&Array.isArray(d.slots)&&d.slots.length>=1&&d.slots.length<=3&&new Set(d.slots).size===d.slots.length&&d.slots.every(id=>d.setups.some(s=>s.id===id));}
