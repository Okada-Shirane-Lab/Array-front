import assert from 'node:assert/strict';
import test from 'node:test';
import {SURVIVAL_ITEMS,createSurvivalLoadout,createSurvivalInventory,applySurvivalItem,beginWptUse,completeWptUse,applySurvivalDamage,survivalItemAt} from '../engine/survival-items.js';
import {validSetup,stats,PRESETS} from '../engine/model.js';
test('Catalog covers every combat tuning category and all beam counts',()=>{
 const categories=new Set(SURVIVAL_ITEMS.map(i=>i.category));
 for(const key of ['elements','bits','power','width','beamCount','cooling','steering','fireRate','scanWidth','split','taper','scope','heal','shield'])assert(categories.has(key),key);
 assert.deepEqual(SURVIVAL_ITEMS.filter(i=>i.category==='beamCount').map(i=>i.patch.beamCount),[1,2,3,4,5]);
 assert.equal(new Set(SURVIVAL_ITEMS.map(i=>i.id)).size,SURVIVAL_ITEMS.length);
});
test('Every ordered pair of pickups stays valid and does not mutate caller or catalog',()=>{
 const catalog=JSON.stringify(SURVIVAL_ITEMS),starter=createSurvivalLoadout(),inventory=createSurvivalInventory();
 assert(validSetup(starter));
 for(const first of SURVIVAL_ITEMS)for(const second of SURVIVAL_ITEMS){
  const original=JSON.stringify({starter,inventory});
  const a=applySurvivalItem(starter,inventory,first.id),aSnapshot=JSON.stringify(a);
  const b=applySurvivalItem(a.setup,a.inventory,second.id);
  assert.equal(JSON.stringify({starter,inventory}),original);
  assert.equal(JSON.stringify(a),aSnapshot);
  assert(validSetup(b.setup),`${first.id} + ${second.id}`);
  for(const [key,value] of Object.entries(stats(b.setup)))if(typeof value==='number')assert(Number.isFinite(value),`${first.id} + ${second.id}: ${key}`);
 }
 assert.equal(JSON.stringify(SURVIVAL_ITEMS),catalog);
});
test('Applying match equipment to copy leaves original saved arsenal untouched',()=>{
 const arsenal=structuredClone(PRESETS),before=JSON.stringify(arsenal);
 let local={...arsenal[0]},inventory=createSurvivalInventory();
 for(const item of SURVIVAL_ITEMS){const result=applySurvivalItem(local,inventory,item.id);local=result.setup;inventory=result.inventory;}
 assert.equal(JSON.stringify(arsenal),before);
});
test('WPT start is nonconsuming, completion spends one cell, caps and death prevent use',()=>{
 const v={hp:83,shield:82,energy:27},i={heal:1,shield:1},before=JSON.stringify({v,i});
 assert(beginWptUse(v,i,'heal').ok);assert(beginWptUse(v,i,'shield').ok);
 assert.equal(JSON.stringify({v,i}),before);
 let r=completeWptUse(v,i,'heal');assert.equal(r.vitals.hp,100);assert.equal(r.inventory.heal,0);assert.equal(r.vitals.energy,27);
 assert.equal(completeWptUse(r.vitals,r.inventory,'heal').ok,false);
 r=completeWptUse(v,i,'shield');assert.equal(r.vitals.shield,100);assert.equal(r.inventory.shield,0);
 assert.equal(beginWptUse({...v,hp:0},i,'shield').ok,false);
 assert.equal(beginWptUse(v,i,'__proto__').ok,false);
 assert.equal(JSON.stringify({v,i}),before);
});
test('Armor absorbs fire, zone bypasses armor, no damage yields no injury',()=>{
 const v={hp:100,shield:40,energy:72};
 let r=applySurvivalDamage(v,65);assert.equal(r.hp,75);assert.equal(r.shield,0);
 r=applySurvivalDamage(v,65,{bypassShield:true});assert.equal(r.hp,35);assert.equal(r.shield,40);
 r=applySurvivalDamage(v,100,{bypassShield:true});assert(r.dead);assert.equal(r.hp,0);
 for(const damage of [0,-1,NaN,Infinity]){r=applySurvivalDamage(v,damage);assert.equal(r.hp,100);assert.equal(r.shield,40);}
 assert.deepEqual(v,{hp:100,shield:40,energy:72});
});
test('All generated loot IDs are catalog-backed, deterministic and include WPT',()=>{
 const seen=new Set();
 for(let seed=0;seed<100;seed++)for(let index=0;index<190;index++){
  const a=survivalItemAt(seed,index),b=survivalItemAt(seed,index);assert.equal(a.id,b.id);seen.add(a.id);
 }
 assert.equal(seen.size,SURVIVAL_ITEMS.length);assert(seen.has('wpt-rectenna'));assert(seen.has('wpt-shield'));
});
