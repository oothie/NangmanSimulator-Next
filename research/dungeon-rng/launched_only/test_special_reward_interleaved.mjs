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
test('source material exhaustion returns only verified prefix and no fabricated draw',()=>{
 const save=originalSave();
 const before=JSON.stringify(save);
 const producer=state=>{
  if((state.globalVariable.win_dcy||0)>=102){
   const error=new Error('original material table exhausted');
   error.code='DUNGEON_WEIGHT_EXHAUSTED';
   throw error;
  }
  return statefulProducer(state);
 };
 const r=forecastInterleavedSpecials(save,'창옥',producer,100);
 assert.equal(r.incomplete,true);
 assert.equal(r.searchedClears,2);
 assert.equal(r.requestedClears,100);
 assert.equal(r.stoppedAt,3);
 assert.ok(r.stoppedReason);
 assert.equal(r.nextState.globalVariable.win_dcy,102);
 assert.equal(JSON.stringify(save),before);
});
test('unexpected original RNG failure remains an exception',()=>{
 const errorProducer=()=>{throw Error('source broken');};
 assert.throws(()=>forecastInterleavedSpecials(originalSave(),'창옥',errorProducer,2));
});
test('Liu 35271_1 unconditional rare material flag consumes no extra RNG',()=>{
 const s={Rnds:{Sds:{seed_lsby:11}},
  globalVariable:{win_lsby:30,roll_35268:0,roll_8915_35264:0},
  Items:[]};
 const before=JSON.stringify(s);
 const base=replayLiuManor(s,1,'auto');
 const rare=base.output[0].results[0].specialIds;
 assert.ok(rare.includes(8801));
 assert.equal(base.nextState.globalVariable.drop_35260_rarematerial,1);
 // Two separate pure executions cannot change the external seed.
 const again=replayLiuManor(s,1,'auto');
 assert.deepEqual(base.output[0].results.map(x=>[x.name,x.grade]),
  again.output[0].results.map(x=>[x.name,x.grade]));
 assert.equal(base.nextState.Rnds.Sds.seed_lsby,
  again.nextState.Rnds.Sds.seed_lsby);
 assert.equal(JSON.stringify(s),before);
});
test('Liu rare-material temp GetP is unresolved unless supplied',()=>{
 const s={Rnds:{Sds:{seed_lsby:11}},
  globalVariable:{win_lsby:30,roll_35268:0,roll_8915_35264:0},
  Items:[]};
 const unknown=forecastInterleavedSpecials(s,'유씨별원',replayLiuManor,3);
 assert.equal(unknown.rows.filter(x=>x.grants.some(y=>y.itemId===8801&&y.unresolved)).length,3);
 assert.ok(!unknown.firstPredicted.some(x=>x.itemId===8801));
 const known=forecastInterleavedSpecials(s,'유씨별원',replayLiuManor,3,{
  tempState:{get_8801:0}
 });
 const rare=known.rows.map(x=>x.grants.find(y=>y.itemId===8801));
 // The source does not establish temp lifetime between separate clears:
 // after first resolved award, all later ones remain unresolved by default.
 assert.deepEqual(rare.map(x=>x.predicted),[true,false,false]);
 assert.deepEqual(rare.map(x=>x.unresolved),[false,true,true]);
 assert.equal(known.firstPredicted.find(x=>x.itemId===8801)?.clear,1);
 assert.equal(known.tempState,null);
 const retained=forecastInterleavedSpecials(s,'유씨별원',replayLiuManor,3,{
  tempState:{get_8801:0},tempLifetime:'persist'
 });
 assert.deepEqual(retained.rows.map(row=>
  row.grants.find(x=>x.itemId===8801).predicted),[true,false,false]);
 assert.equal(retained.tempState.get_8801,1);
 const reset=forecastInterleavedSpecials(s,'유씨별원',replayLiuManor,3,{
  tempState:{get_8801:0},tempLifetime:'reset'
 });
 assert.deepEqual(reset.rows.map(row=>
  row.grants.find(x=>x.itemId===8801).predicted),[true,true,true]);
 assert.equal(s.globalVariable.get_8801,undefined);
});
console.log('PASS',passes,'interleaved source-model checks');
