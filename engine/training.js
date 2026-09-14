// Cumulative XP: slower progression, with the balanced configuration ceiling unchanged.
export const TRAINING_THRESHOLDS=Object.freeze([0,300,900,1800,3200,5000,7500,10500,14000,18000]);
export const TRAINING_UNLOCKS=Object.freeze([
 '従来の全設定を使用可能',
 '出力105%',
 '偏向±30°',
 '192素子',
 '出力110%・14発/秒',
 'ビーム幅1.5°・走査±20°',
 '出力115%・ビーム幅45°',
 '偏向±35°・展開角45°',
 '256素子・ビーム幅1°',
 '出力120%・16発/秒・ビーム幅50°・走査±25°'
]);
export function trainingLevel(xp=0){const n=Number.isFinite(xp)?Math.max(0,xp):0;return TRAINING_THRESHOLDS.filter(t=>n>=t).length;}
export function trainingLimits(xp=0){const level=trainingLevel(xp);return {elements:level>=9?[16,32,64,128,192,256]:level>=4?[16,32,64,128,192]:[16,32,64,128],powerMax:level>=10?120:level>=7?115:level>=5?110:level>=2?105:100,widthMin:level>=9?1:level>=6?1.5:2,widthMax:level>=10?50:level>=7?45:40,steeringMax:level>=8?35:level>=3?30:25,fireRateMax:level>=10?16:level>=5?14:12,scanWidthMax:level>=10?25:level>=6?20:15,splitMax:level>=8?45:40};}
// Only a trusted, previously saved setup may retain endpoints after a balance update.
// Never pass the unsaved editor or a submitted payload as `saved` on the server.
export function editingLimits(xp=0,saved){const l=trainingLimits(xp);if(!saved)return l;return {...l,elements:[16,32,64,128,192,256].filter(n=>n<=Math.max(l.elements.at(-1),saved.elements)),powerMax:Math.max(l.powerMax,saved.power),widthMin:Math.min(l.widthMin,saved.width),widthMax:Math.max(l.widthMax,saved.width),steeringMax:Math.max(l.steeringMax,Math.abs(saved.steering??0)),fireRateMax:Math.max(l.fireRateMax,saved.fireRate??6),scanWidthMax:Math.max(l.scanWidthMax,saved.scanWidth??0),splitMax:Math.max(l.splitMax,saved.split)};}
export function trainingStatus(xp=0){xp=Math.max(0,Math.floor(Number.isFinite(xp)?xp:0));const level=trainingLevel(xp),base=TRAINING_THRESHOLDS[level-1],next=TRAINING_THRESHOLDS[level]??null;return {xp,level,next,remaining:next===null?0:next-xp,progress:next===null?1:(xp-base)/(next-base),unlock:TRAINING_UNLOCKS[level-1],nextUnlock:TRAINING_UNLOCKS[level]||''};}
export function withinTraining(s,xp=0,saved){const l=editingLimits(xp,saved);return l.elements.includes(s.elements)&&s.power<=l.powerMax&&s.width>=l.widthMin&&s.width<=l.widthMax&&Math.abs(s.steering??0)<=l.steeringMax&&(s.fireRate??6)<=l.fireRateMax&&(s.scanWidth??0)<=l.scanWidthMax&&s.split<=l.splitMax;}
export function clampToTraining(s,xp=0){const l=trainingLimits(xp);const next={...s,elements:l.elements.includes(s.elements)?s.elements:l.elements.at(-1),power:Math.min(s.power,l.powerMax),width:Math.max(l.widthMin,Math.min(s.width,l.widthMax)),steering:Math.max(-l.steeringMax,Math.min(s.steering??0,l.steeringMax)),fireRate:Math.min(s.fireRate??6,l.fireRateMax),scanWidth:Math.min(s.scanWidth??0,l.scanWidthMax),split:Math.min(s.split,l.splitMax)};if((next.beamCount??(next.mode==='split'?3:1))>1)next.split=Math.min(next.split,85-Math.abs(next.steering)-next.scanWidth);return next;}
// Award actual damage and finishing blows, never trigger presses or overkill.
export function usageXP(u){return Math.min(1200,Math.floor(u.damage/10)+u.kills*12+u.headshotKills*6);}
export function validTrainingReport(p){return p&&p.gameMode!=='survival'&&typeof p.matchId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.matchId)&&Number.isFinite(p.elapsed)&&p.elapsed>=0&&p.elapsed<=301&&Array.isArray(p.weapons)&&p.weapons.length>0&&p.weapons.length<=3&&p.weapons.every(w=>w&&typeof w==='object')&&new Set(p.weapons.map(w=>w.id)).size===p.weapons.length&&p.weapons.every(w=>typeof w.id==='string'&&w.id.length>0&&w.id.length<=80&&Number.isFinite(w.damage)&&w.damage>=0&&w.damage<=60000&&Number.isInteger(w.kills)&&w.kills>=0&&w.kills<=300&&Number.isInteger(w.headshotKills)&&w.headshotKills>=0&&w.headshotKills<=w.kills);}
