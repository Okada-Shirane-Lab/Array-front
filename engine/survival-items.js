/** Match-local survival equipment. This module never reads arsenal, training or storage.
 * Pickup is explicit: F applies one selected item. Healing/shielding are channelled
 * actions; the caller cancels on movement, shooting, damage or death, and calls
 * completeWptUse only after the uninterrupted duration. Items are spent on success.
 */
export const SURVIVAL_RULES=Object.freeze({combatants:51,maxHp:100,maxShield:100,maxEnergy:100,healCapacity:3,shieldCapacity:3});
export const SURVIVAL_STARTER=Object.freeze({id:'survival-starter',name:'FIELD ARRAY / 現地構築',mode:'focus',beamCount:1,elements:32,bits:3,power:55,width:9,split:18,taper:'uniform',cooling:50,scope:'reflex',steering:0,fireRate:6,scanWidth:0,color:'#85f3d2'});
export const createSurvivalLoadout=(id='player')=>({...SURVIVAL_STARTER,id:`survival-${String(id).slice(0,65)}`});
export const createSurvivalInventory=()=>({heal:0,shield:0});
export const createSurvivalVitals=()=>({hp:100,shield:0,energy:100});
const COLORS={common:'#acd8ce',uncommon:'#74d9ad',rare:'#8cbfff',epic:'#d7a6ff',wpt:'#ffe09f'};
const moduleItem=(id,name,category,patch,description,tradeoff,rarity='common',weight=3)=>Object.freeze({id,name,category,kind:'module',patch:Object.freeze(patch),description,tradeoff,rarity,color:COLORS[rarity],weight});
const M=moduleItem;
export const SURVIVAL_ITEMS=Object.freeze([
 M('array-16','16素子・軽量サブアレイ','elements',{elements:16},'16素子の軽量送受信パネル。','射程が短くなる代わりに移動・再充電が速くなる。'),
 M('array-32','32素子・標準サブアレイ','elements',{elements:32},'標準開口の現地交換パネル。','大型アレイから換装すると射程を失うが機動性を取り戻す。'),
 M('array-64','64素子・開口拡張パネル','elements',{elements:64},'開口を拡大して中距離に対応。','重量・消費電力・再充電時間が増える。','uncommon'),
 M('array-128','128素子・大開口アレイ','elements',{elements:128},'遠距離用の大型アンテナパネル。','移動が遅くなり、熱とエネルギー管理が難しくなる。','rare',2),
 M('array-256','256素子・観測級開口','elements',{elements:256},'最大開口の長距離射撃モジュール。','非常に重く、追従速度と再充電時間が不利。','epic',.5),
 M('phase-2','2 bit・高速位相器','bits',{bits:2},'小型で低負荷な位相制御回路。','熱負荷と重量を抑えるが照準のばらつきが増える。'),
 M('phase-4','4 bit・整相チップ','bits',{bits:4},'中精度の位相量子化。','照準が安定する代わりに回路の熱・重量が増える。','uncommon'),
 M('phase-6','6 bit・精密移相器','bits',{bits:6},'高分解能の位相制御回路。','ばらつきは小さいが発熱・再充電時間が増える。','rare',1.5),
 M('pa-45','低電力PA・45%','power',{power:45},'長時間運用を狙う省電力増幅器。','一発の威力を抑え、熱と電池消費を軽減。'),
 M('pa-80','GaN PA・80%','power',{power:80},'中出力のRF電力増幅モジュール。','威力とともに熱・電力消費も増える。','uncommon'),
 M('pa-110','高出力PA・110%','power',{power:110},'瞬間火力を重視した増幅モジュール。','連射すると急速に過熱。重く、再充電も遅い。','epic',1),
 M('width-pencil','ペンシルビーム合成器','width',{width:2.5},'2.5°の細いビームで遠距離を狙う。','狙いを外すと当たらない。広い制圧範囲を失う。','rare',2),
 M('width-sector','セクタービーム合成器','width',{width:12},'12°の中間ビーム幅。','精密射撃と広角制圧の中間の射程・威力。'),
 M('width-fan','ファンビーム合成器','width',{width:30},'30°の広角ビームで近距離を制圧。','広角化により利得と有効射程が下がる。'),
 ...[1,2,3,4,5].map(count=>M(`beams-${count}`,`${count}ビーム・給電分配網`,'beamCount',{beamCount:count},`${count}方向の同時ビームを形成。`,count===1?'全電力を1方向に集中。左右のカバー範囲は狭い。':'出力を各方向に分配。1方向あたりの威力が下がる。',count>=4?'rare':count===3?'uncommon':'common',count>=4?1.5:3)),
 M('cooling-25','軽量熱拡散シート','cooling',{cooling:25},'冷却配分25%の軽量放熱部品。','機動性と瞬間火力を得るが過熱しやすい。'),
 M('cooling-75','液冷ヒートスプレッダ','cooling',{cooling:75},'冷却配分75%で連射時の復帰を助ける。','重くなり、瞬間火力と電力効率が下がる。','uncommon'),
 M('cooling-100','最大冷却・液循環ループ','cooling',{cooling:100},'冷却配分100%の持続射撃構成。','最大限の冷却と引き換えに重量・消費電力が増える。','rare',1.5),
 M('steer-left','位相傾斜・左20°','steering',{steering:-20},'照準から左へビームを偏向。','偏向損失が生じる。表示されたビーム位置で照準する。'),
 M('steer-zero','正面位相校正器','steering',{steering:0},'ビーム中心を照準の正面に校正。','斜め方向への照射を解除して正面射撃に集中する。'),
 M('steer-right','位相傾斜・右20°','steering',{steering:20},'照準から右へビームを偏向。','偏向損失が生じる。表示されたビーム位置で照準する。'),
 M('cadence-4','4 Hz・省電力パルサ','fireRate',{fireRate:4},'一発ずつ狙う低速RFパルス制御器。','瞬間火力を抑える代わりに熱・電力負荷を軽減。'),
 M('cadence-8','8 Hz・連射パルサ','fireRate',{fireRate:8},'取り回しやすい中速RFパルス制御器。','連射数が増えるが一発の威力は下がり、熱負荷が上がる。','uncommon'),
 M('cadence-12','12 Hz・高速パルサ','fireRate',{fireRate:12},'至近距離で弾幕を形成する高速制御器。','熱・電池消費が大きく、1発の威力は低い。','rare',1.5),
 M('scan-hold','ビームホールドPLL','scanWidth',{scanWidth:0},'走査を止めてビーム方向を固定。','走査による広い探索範囲を失う。'),
 M('scan-10','±10°・電子走査PLL','scanWidth',{scanWidth:10},'ビームを左右10°に往復走査。','狙った位置から動くうえ、利得と効率が下がる。'),
 M('scan-20','±20°・広域走査PLL','scanWidth',{scanWidth:20},'ビームを左右20°に往復走査。','広域を覆うが一点への命中と利得・効率が不利。','uncommon'),
 M('fan-10','±10°・集中分岐線路','split',{split:10},'複数ビームを狭い角度にまとめる。','左右のカバー範囲が狭い。単ビームでは効果なし。'),
 M('fan-28','±28°・広角分岐線路','split',{split:28},'複数ビームを広い角度に展開。','ビーム間の隙間が大きい。単ビームでは効果なし。'),
 M('taper-uniform','均一振幅・給電係数ROM','taper',{taper:'uniform'},'均一な振幅重みで利得を確保。','利得が高い代わりに反動・ばらつきが大きい。'),
 M('taper-taylor','Taylor・振幅係数ROM','taper',{taper:'taylor'},'利得と照準安定を両立する振幅重み。','利得を少し抑え、ビームをやや広げる。','uncommon'),
 M('taper-hann','Hann・低サイドローブROM','taper',{taper:'hann'},'安定を重視した振幅重み。','反動を抑える一方、主ビームが広がり利得と射程が下がる。','uncommon'),
 M('scope-reflex','1.25×・RFリフレックス','scope',{scope:'reflex'},'近距離向けの素早い照準器。','拡大率が低く遠距離の細かい照準は難しい。'),
 M('scope-holo','1.6×・ホログラフィック','scope',{scope:'holo'},'周辺を見渡しやすい円形照準器。','高倍率スコープほど遠方は拡大しない。'),
 M('scope-combat','2.5×・アレイ照準スコープ','scope',{scope:'combat'},'中距離の精密照準を支援。','視野が狭くなり、構えるまでの時間が増える。','uncommon'),
 M('scope-marksman','4×・位相追尾スコープ','scope',{scope:'marksman'},'遠距離目標を拡大する目盛り付きスコープ。','周辺視野が狭く、照準への移行が最も遅い。','rare',1.5),
 Object.freeze({id:'wpt-rectenna',name:'WPTレクテナ救急セル',category:'heal',kind:'consumable',resource:'heal',amount:45,channelSeconds:3.2,capacity:3,description:'整流アンテナで受電し、装甲内の修復装置へ給電。HPを45回復。',tradeoff:'救急セルの操作で使用開始。移動・射撃・被弾で給電が中断する。',rarity:'wpt',color:COLORS.wpt,weight:20}),
 Object.freeze({id:'wpt-shield',name:'WPT共振アーマーセル',category:'shield',kind:'consumable',resource:'shield',amount:50,channelSeconds:2.6,capacity:3,description:'共振結合で防護層に給電。アーマーを50補充（上限100）。',tradeoff:'アーマーセルの操作で使用開始。移動・射撃・被弾で給電が中断する。',rarity:'wpt',color:'#8cc9ff',weight:18})
]);
const ITEM_INDEX=Object.freeze(Object.fromEntries(SURVIVAL_ITEMS.map(item=>[item.id,item])));
export const getSurvivalItem=id=>typeof id==='string'&&Object.hasOwn(ITEM_INDEX,id)?ITEM_INDEX[id]:null;
const boundedInventory=inventory=>({heal:Math.max(0,Math.min(3,Math.floor(Number(inventory?.heal)||0))),shield:Math.max(0,Math.min(3,Math.floor(Number(inventory?.shield)||0)))});
function tuning(setup,patch){const next={...setup,...patch};next.mode=next.beamCount>1?'split':next.width>=20?'wide':'focus';return next;}
/** Return a new setup/inventory; leave caller objects untouched even on failure. */
export function applySurvivalItem(setup,inventory,itemId){
 const item=getSurvivalItem(itemId),nextInventory=boundedInventory(inventory),base={...setup};
 if(!item)return {ok:false,reason:'不明なアイテム',setup:base,inventory:nextInventory,item:null,changes:[]};
 if(item.kind==='consumable'){
  if(nextInventory[item.resource]>=item.capacity)return {ok:false,reason:'所持上限です',setup:base,inventory:nextInventory,item,changes:[]};
  nextInventory[item.resource]++;return {ok:true,reason:'セルを収納',setup:base,inventory:nextInventory,item,changes:[{key:item.resource,from:nextInventory[item.resource]-1,to:nextInventory[item.resource]}]};
 }
 const next=tuning(base,item.patch),changes=Object.keys(next).filter(key=>next[key]!==base[key]).map(key=>({key,from:base[key],to:next[key]}));
 if(!changes.length)return {ok:false,reason:'同じ構成を装着済み',setup:base,inventory:nextInventory,item,changes};
 // Catalog fan+scan+steer is <=68 degrees. This protects future catalog expansion.
 if(Math.abs(next.steering)+next.scanWidth+(next.beamCount>1?next.split:0)>85)return {ok:false,reason:'偏向・走査・分岐角の合計が上限を超えます',setup:base,inventory:nextInventory,item,changes:[]};
 return {ok:true,reason:'モジュールを換装',setup:next,inventory:nextInventory,item,changes};
}
/** Optional stats callback is the existing model.stats, avoiding a model import cycle. */
export function previewSurvivalItem(setup,inventory,itemId,calculateStats){
 const result=applySurvivalItem(setup,inventory,itemId);
 if(typeof calculateStats==='function')return {...result,before:calculateStats(setup),after:calculateStats(result.setup)};
 return result;
}
const WPT_ITEM_IDS=Object.freeze({heal:'wpt-rectenna',shield:'wpt-shield'});
/** Validation for H/J. Do not consume inventory at action start. */
export function beginWptUse(vitals,inventory,resource){
 const item=getSurvivalItem(WPT_ITEM_IDS[resource]);
 if(!item)return {ok:false,reason:'無効なWPTセル'};
 if((vitals?.hp??0)<=0)return {ok:false,reason:'戦闘不能です'};
 if(boundedInventory(inventory)[resource]<1)return {ok:false,reason:'セルがありません'};
 const key=resource==='heal'?'hp':'shield',current=Math.max(0,Number(vitals?.[key])||0);
 if(current>=100)return {ok:false,reason:resource==='heal'?'HPは最大です':'アーマーは最大です'};
 return {ok:true,item,resource,key,duration:item.channelSeconds,amount:Math.min(item.amount,100-current)};
}
/** Call exactly once at channel completion. Cancellation keeps the cell. */
export function completeWptUse(vitals,inventory,resource){
 const action=beginWptUse(vitals,inventory,resource),nextInventory=boundedInventory(inventory),nextVitals={...vitals};
 if(!action.ok)return {...action,vitals:nextVitals,inventory:nextInventory};
 nextInventory[resource]--;nextVitals[action.key]=Math.min(100,Math.max(0,Number(nextVitals[action.key])||0)+action.amount);
 return {...action,vitals:nextVitals,inventory:nextInventory};
}
/** Pure damage rule shared by player and bots. Zone damage bypasses armor. */
export function applySurvivalDamage(vitals,amount,{bypassShield=false}={}){
 const damage=Number.isFinite(amount)?Math.max(0,amount):0,hp=Math.max(0,Math.min(100,Number(vitals?.hp)||0)),shield=Math.max(0,Math.min(100,Number(vitals?.shield)||0));
 const armorDamage=bypassShield?0:Math.min(shield,damage),healthDamage=Math.min(hp,damage-armorDamage);
 return {...vitals,hp:hp-healthDamage,shield:shield-armorDamage,armorDamage,healthDamage,dead:hp-healthDamage<=0};
}
/** Reproducible item placement for a match seed and spawn index. No hidden RNG. */
export function survivalItemAt(seed,index=0,category=null){
 let value=(Number(seed)>>>0)^Math.imul((Number(index)>>>0)+1,0x9e3779b9);
 value=Math.imul(value^(value>>>16),0x21f0aaad);value=Math.imul(value^(value>>>15),0x735a2d97);value=(value^(value>>>15))>>>0;
 const candidates=category?SURVIVAL_ITEMS.filter(item=>item.category===category):SURVIVAL_ITEMS,pool=candidates.length?candidates:SURVIVAL_ITEMS;
 const total=pool.reduce((sum,item)=>sum+item.weight,0);let roll=(value/4294967296)*total;
 for(const item of pool){roll-=item.weight;if(roll<0)return item;}
 return pool[pool.length-1];
}
