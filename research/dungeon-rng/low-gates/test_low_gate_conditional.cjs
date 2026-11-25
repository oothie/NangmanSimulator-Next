'use strict';
const assert=require('node:assert/strict');
const {resolve,weighted,bosses}=require('./low_gate_conditional.cjs');
assert.equal(bosses.size,19);
assert.equal(weighted([['yes',40],['no',60]],40,'x'),'yes');
assert.equal(weighted([['yes',40],['no',60]],41,'x'),'no');
assert.throws(()=>weighted([['yes',40]],41,'x'),RangeError);
let checked=0,colors=0,empty=0;
for(const [npc,b] of bosses){
 for(let roll=1;roll<=100;roll++){
  const lane=weighted(b.outer,roll,'outer');
  const wantsColor=!b.nested||lane!=='none';
  const input={outer:roll};
  if(lane!=='none')input.slot=1;
  if(wantsColor)input.color=1;
  const r=resolve(npc,input);
  assert.equal(r.lane,lane);
  assert.equal(r.colorRollConsumed,wantsColor);
  if(lane==='none'){empty++;assert.equal(r.itemId,0);assert.equal(r.color,0);}
  else {assert.equal(r.itemId,b[lane].ids[0]);assert.equal(r.color,1);}
  if(wantsColor)colors++;
  assert.equal(r.nativeRngPredicted,false);
  checked++;
 }
 for(const lane of ['equip','weapon']){
  const pool=b[lane];
  if(!pool.ids.length)continue;
  const r0=b.outer.reduce((acc,x)=>acc!==null?acc:(x[0]===lane?1+b.outer.slice(0,b.outer.indexOf(x)).reduce((s,y)=>s+y[1],0):null),null);
  if(r0===null)throw Error('missing lane '+npc+' '+lane);
  for(let slot=1;slot<=pool.ids.length;slot++){
   const r=resolve(npc,{outer:r0,slot,color:100});
   assert.equal(r.itemId,pool.ids[slot-1]);assert.equal(r.slot,slot);assert.equal(r.color,b.color[b.color.length-1][0]);
   checked++;
  }
 }
}
assert.throws(()=>resolve(37002,{outer:1,slot:0,color:1}),RangeError);
assert.throws(()=>resolve(37002,{outer:1,slot:1}),RangeError);
assert.throws(()=>resolve(999999,{outer:1}),RangeError);
console.log(JSON.stringify({status:'PASS',bosses:bosses.size,explicit_roll_checks:checked,no_item_cases:empty,color_roll_cases:colors,game_native_roll_inference:false}));
