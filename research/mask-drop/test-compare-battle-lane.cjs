#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {compareBattleStates}=require('./compare-battle-lane.cjs');
const {draw}=require('../dungeon-lab/mask-7209-conditional.cjs');
// Only artificial numbered values. No account-derived inputs.
const start=173827,other=19;
const fake=(s,otherValue=other)=>({Rnds:{Sds:{aidrop70:s,guishishop:otherValue}}});
const noChange=compareBattleStates(fake(start),fake(start));
assert.equal(noChange.changed,false);
assert(noChange.matches.some(x=>x.calls===0));
for(const bound of [100,101,1000]){
 let state=start;
 for(let i=1;i<=3;i++){
  state=draw(state,bound).seed;
  const result=compareBattleStates(fake(start),fake(state),{npc:32950,bounds:[100,101,1000]});
  assert(result.matches.some(x=>x.calls===i&&x.bound===bound));
  assert.equal(result.sharedLaneConfirmed,false);
  assert.equal(result.privateInputsReported,false);
  assert(!JSON.stringify(result).includes(String(start)));
  assert(!JSON.stringify(result).includes(String(state)));
 }
}
const mixed=compareBattleStates(fake(start),fake(draw(start,100).seed,22));
assert.equal(mixed.changedOtherLanes,1);
assert.match(mixed.warning,/다른 RNG/);
assert.equal(compareBattleStates(fake(start),fake(start),{bounds:[100]}).usable,true);
assert.equal(compareBattleStates({Rnds:{Sds:{}}},fake(start)).usable,false);
assert.throws(()=>compareBattleStates(fake(start),fake(start),{npc:34461}),/NPC/);
assert.throws(()=>compareBattleStates(fake(start),fake(start),{bounds:[0]}),/bounds/);
console.log('PASS level-70 private-free before/after numeric-state observer (0,1,2,3 calls)');
