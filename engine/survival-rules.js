import {DIFFICULTIES} from './model.js';

const descriptions=[
 '反応と射撃がゆっくり。部品集めと屋内戦に慣れるための難易度。',
 '敵の判断と攻撃が速くなる。遮蔽物とWPTを活かして生き残ろう。',
 '修士より反応と追撃が鋭い。射線を切り、早めに安全地帯へ移動しよう。',
 '最速の判断と猛攻。装備集め・射線管理・退路の選択が重要。'
];
export const SURVIVAL_DIFFICULTIES=Object.freeze(DIFFICULTIES.map((d,i)=>Object.freeze({...d,description:descriptions[i],reactionScale:[1,.85,.78,.6][i],thinkScale:[1,.85,.78,.65][i],sightCap:[125,140,150,160][i]})));
export function getSurvivalDifficulty(id){return SURVIVAL_DIFFICULTIES.find(d=>d.id===id)||SURVIVAL_DIFFICULTIES[0];}

// Assign existing verified spawn positions; never mutate the cached map layout.
export function shuffledSpawnIndices(count,previous=-1,random=Math.random){
 const order=Array.from({length:count},(_,i)=>i);
 for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 if(count>1&&order[0]===previous)[order[0],order[1]]=[order[1],order[0]];
 return order;
}
