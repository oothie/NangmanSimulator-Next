/* Synthetic-only state feedback and long-horizon special reward regressions. */
import assert from 'node:assert/strict';
import {forecastInterleavedSpecials} from './special_reward_source_engine.mjs';
import {replayLiuManor} from './replay_original_liu.mjs';

let passes=0;
function test(name,fn){fn();console.log('PASS',name);passes++;}
const originalSave=()=>({globalVariable:{get_8295_40374:0,win_dcy:100},
 Rnds:{Sds:{seed_dcy_40374:101}},Items:[]});
const statefulProducer=(state)=>{
 const original=Number(state.globalVariable.win_dcy||0);
 const claimed=Number(state.globalVariable.get_8295_40374||0);
 const success=original>=103;
 return {output:[{clear:1,results:[{boss:'장정',specialIds:success?[8295]:[]}]}],
  nextState:{...state,globalVariable:{...state.globalVariable,win_dcy:original+1},
   Rnds:{Sds:{...state.Rnds.Sds,seed_dcy_40374:state.Rnds.Sds.seed_dcy_40374+1}}}};
};
test('long horizon stops at first real consumer payout',()=>{
 const s=originalSave(),start=JSON.stringify(s);
 const r=forecastInterleavedSpecials(s,'창옥',statefulProducer,2000,{firstItemId:8295});
 assert.equal(r.searchedClears,4);
 assert.equal(r.foundTarget,true);
 assert.equal(r.firstPredicted.find(x=>x.itemId===8295).clear,4);
 assert.equal(r.nextState.globalVariable.get_8295_40374,1);
 assert.equal(JSON.stringify(s),start);
});
test('claimed blueprint finds no payout in long horizon',()=>{
 const s=originalSave();s.globalVariable.get_8295_40374=1;
 const r=forecastInterleavedSpecials(s,'창옥',statefulProducer,12,{firstItemId:8295});
 assert.equal(r.foundTarget,false);
 assert.equal(r.searchedClears,12);
 assert.ok(!r.firstPredicted.some(x=>x.itemId===8295));
});
test('unclaimed counterfactual does not reset material RNG or gate clear state',()=>{
 const s=originalSave();s.globalVariable.get_8295_40374=1;
 const r=forecastInterleavedSpecials(s,'창옥',statefulProducer,20,{mode:'unclaimed',firstItemId:8295});
 assert.equal(r.searchedClears,4);
 assert.equal(r.firstPredicted[0].clear,4);
 assert.equal(r.nextState.Rnds.Sds.seed_dcy_40374,105);
});
test('the next producer sees the consumer award counter',()=>{
 let seen=[];
 const f=state=>{seen.push(state.globalVariable.get_8295_40374||0);
  return {output:[{clear:1,results:[{boss:'장정',specialIds:[8295]}]}],
   nextState:{...state,globalVariable:{...state.globalVariable,win_dcy:(state.globalVariable.win_dcy||0)+1}}};
 };
 const r=forecastInterleavedSpecials(originalSave(),'창옥',f,3);
 assert.deepEqual(seen,[0,1,1]);
 assert.deepEqual(r.rows.map(row=>row.grants[0].predicted),[true,false,false]);
});
test('unknown special reward item is not searched as fabricated gate loot',()=>{
 assert.throws(()=>forecastInterleavedSpecials(originalSave(),'창옥',statefulProducer,1,{firstItemId:3970}));
});
test('original 3523 consumer resets its own flag to zero',()=>{
 const p=state=>({output:[{clear:1,results:[{boss:'무준신',specialIds:[3523]}]}],
  nextState:{...state,globalVariable:{...state.globalVariable}}});
 const result=forecastInterleavedSpecials(originalSave(),'창옥',p,1);
 assert.equal(result.unresolved,0);
 assert.equal(result.rows[0].grants[0].predicted,true);
 assert.equal(result.rows[0].grants[0].postAwardFlag,0);
 assert.equal(result.nextState.globalVariable.drop_3523_40372,0);
});
test('Liu key hold scenario carries key into next source step',()=>{
 const s={Rnds:{Sds:{seed_lsby:11}},globalVariable:{win_lsby:30,
  roll_35268:0,roll_8915_35264:0},Items:[]};
 const snap=JSON.stringify(s);
 const use=forecastInterleavedSpecials(s,'유씨별원',replayLiuManor,4,{keyMode:'auto'});
 const keep=forecastInterleavedSpecials(s,'유씨별원',replayLiuManor,4,{keyMode:'retain'});
 assert.equal(use.rows[2].producer.keyAwarded,true);
 assert.equal(use.rows[3].producer.keyState.heldAtStart,false);
 assert.equal(keep.rows[3].producer.keyState.heldAtStart,true);
 assert.equal(JSON.stringify(s),snap);
});
console.log('PASS',passes,'interleaved source-model checks');
