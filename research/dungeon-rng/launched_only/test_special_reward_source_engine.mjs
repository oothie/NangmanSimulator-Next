/* Synthetic-only regression: NO user save, seed, character or account data. */
import assert from 'node:assert/strict';
import {
 SPECIAL_CONSUMER_RULES,SPECIAL_KOREAN_NAMES,ORIGINAL_FRAGMENT_MILESTONES,specialScenario,originalConsumerRule,
 restoreOriginalPendingAward,applyOriginalBattleLoss,evaluateSpecialAwards,forecastSpecialAwards,
 forecastSpecialsFromProducer
} from './special_reward_source_engine.mjs';

function scenario(){
 return {Rnds:{Sds:{seed_dcy_40374:101}},globalVariable:{
  get_8295_40374:1,get_2926:10,get_2924:15,get_9072_40372:1,
  num_2601_40372:12
 },Items:[]};
}
let testCount=0;
function test(name,fn){fn();testCount++;console.log('PASS',name);}

test('all 40 original consumer rules and full Korean names',()=>{
 assert.equal(SPECIAL_CONSUMER_RULES.length,40);
 assert.equal(SPECIAL_CONSUMER_RULES.filter(r=>r.rb).length,37);
 assert.equal(SPECIAL_CONSUMER_RULES.filter(r=>r.s==='temp').length,1);
 assert.ok(SPECIAL_CONSUMER_RULES.every(r=>SPECIAL_KOREAN_NAMES[r.i]));
 assert.equal(originalConsumerRule(40374,8295).k,'get_8295_40374');
 assert.equal(SPECIAL_KOREAN_NAMES[8295],'칠색유리 도면');
});
test('claimed one-time blueprint is NOT awarded',()=>{
 const s=scenario(),old=JSON.stringify(s);
 const result=evaluateSpecialAwards(s,[{npc:40374,specialIds:[8295]}]);
 assert.equal(result.events[0].predicted,false);
 assert.equal(result.events[0].quantity,0);
 assert.equal(JSON.stringify(s),old);
});
test('unclaimed blueprint is eligible, future successful grants consume cap',()=>{
 const s=scenario();
 const wins=forecastSpecialAwards(s,[
  [{npc:40374,specialIds:[]}],
  [{npc:40374,specialIds:[]}],
  [{npc:40374,specialIds:[8295]}],
  [{npc:40374,specialIds:[8295]}]
 ],{mode:'unclaimed'});
 assert.deepEqual(wins.clears.map(x=>x.find(r=>r.itemId===8295)?.predicted??false),
  [false,false,true,false]);
 assert.equal(wins.counters.get_8295_40374,1);
});
test('get_ data are separate from material cap and RNG lanes',()=>{
 const s=scenario(),whatif=specialScenario(s,'unclaimed');
 assert.equal(whatif.Rnds.Sds.seed_dcy_40374,s.Rnds.Sds.seed_dcy_40374);
 assert.equal(whatif.globalVariable.num_2601_40372,12);
 assert.equal(whatif.globalVariable.get_8295_40374,0);
 assert.equal(s.globalVariable.get_8295_40374,1);
});
test('per-boss get_9072 counters stay independent',()=>{
 const r=evaluateSpecialAwards({globalVariable:{
  get_9072_40372:1,get_9072_40373:0
 }},[{npc:40372,specialIds:[9072]},{npc:40373,specialIds:[9072]}]);
 assert.deepEqual(r.events.map(x=>x.predicted),[false,true]);
});
test('exact 10-vs-15 fragment caps and cumulative purchases',()=>{
 assert.equal(originalConsumerRule(40373,2926).lim,10);
 assert.equal(originalConsumerRule(40372,2924).lim,15);
 const r=forecastSpecialAwards({globalVariable:{get_2926:9}},
 [[{npc:40373,specialIds:[2926]}],[{npc:40373,specialIds:[2926]}]]);
 assert.deepEqual(r.clears.map(x=>x[0].predicted),[true,false]);
});
test('temporary scope is not guessed from global counters',()=>{
 const unresolved=evaluateSpecialAwards({globalVariable:{get_8801:0}},
  [{npc:35260,specialIds:[8801]}]);
 assert.equal(unresolved.unresolved,1);
 assert.equal(unresolved.events[0].predicted,false);
 const resolved=evaluateSpecialAwards({globalVariable:{}},
  [{npc:35260,specialIds:[8801]}],{tempState:{get_8801:0}});
 assert.equal(resolved.events[0].predicted,true);
});
test('original rollback is explicit and idempotent without a second flag2',()=>{
 const state={get_8295_40374:1,drop_8295_40374:2};
 assert.equal(restoreOriginalPendingAward(state,40374,8295).applied,true);
 assert.equal(state.get_8295_40374,0);
 assert.equal(state.drop_8295_40374,1);
 assert.equal(restoreOriginalPendingAward(state,40374,8295).applied,false);
});
test('does not invent RNG on missing producer input',()=>{
 const r=evaluateSpecialAwards({globalVariable:{}},[{npc:40374,specialIds:[]}]);
 assert.equal(r.events.length,0);
});
test('producer integration returns hypothetical first appearance',()=>{
 const source=scenario(),before=JSON.stringify(source);
 const producer=(copy,count)=>({output:Array.from({length:count},(_,i)=>({
  clear:i+1,results:[{boss:'장정',specialIds:i===2?[8295]:[]}]
 }))});
 const actual=forecastSpecialsFromProducer(source,'창옥',producer,4);
 const hypothetical=forecastSpecialsFromProducer(source,'창옥',producer,4,{mode:'unclaimed'});
 assert.equal(actual.firstPredicted.some(x=>x.itemId===8295),false);
 assert.equal(hypothetical.firstPredicted.find(x=>x.itemId===8295)?.clear,3);
 assert.equal(JSON.stringify(source),before);
});
test('unclaimed ownership scenario uses key-absent branch by default',()=>{
 const s=scenario();
 const modes=[];
 const make=(input,count,keyMode)=>{
  modes.push(keyMode);
  return {output:[{clear:1,results:[{boss:'고리',specialIds:[]}]}]};
 };
 forecastSpecialsFromProducer(s,'유씨별원',make,1);
 forecastSpecialsFromProducer(s,'유씨별원',make,1,{mode:'unclaimed'});
 forecastSpecialsFromProducer(s,'유씨별원',make,1,{mode:'unclaimed',keyMode:'retain'});
 assert.deepEqual(modes,['auto','absent','retain']);
});
test('eight source fragment completion effects exactly follow original guard',()=>{
 assert.equal(ORIGINAL_FRAGMENT_MILESTONES.length,8);
 for(const entry of ORIGINAL_FRAGMENT_MILESTONES){
  const base={globalVariable:{[entry.count]:entry.before,[entry.shop]:0}};
  const done=evaluateSpecialAwards(base,[{npc:entry.npc,specialIds:[entry.item]}]);
  assert.equal(done.events[0].predicted,true);
  assert.equal(done.events[0].effects.length,1);
  assert.equal(done.events[0].effects[0].key,entry.shop);
  assert.equal(done.counters[entry.shop],1);
  // The original input is read-only and no extra milestone runs on a
  // second award after the recorded completion threshold.
  assert.equal(base.globalVariable[entry.shop],0);
  const prior=evaluateSpecialAwards({globalVariable:{[entry.count]:entry.before-1}},
   [{npc:entry.npc,specialIds:[entry.item]}]);
  assert.equal(prior.events[0].effects.length,0);
 }
});
test('completed fragment unlock does not advance for an ineligible reward',()=>{
 const r=evaluateSpecialAwards({globalVariable:{get_2925:15,buyshop_1333:2}},
  [{npc:40374,specialIds:[2925]}]);
 assert.equal(r.events[0].predicted,false);
 assert.equal(r.counters.buyshop_1333,2);
});
test('original numeric GetP(3970) key guard blocks key when ineligible',()=>{
 const producer=[{npc:35221,specialIds:[3970]}];
 const source={globalVariable:{get_3970:7}};
 const unknown=evaluateSpecialAwards(source,producer);
 assert.equal(unknown.unresolved,1);
 assert.equal(unknown.events[0].predicted,false);
 const held=evaluateSpecialAwards(source,producer,{numericState:{3970:1}});
 assert.equal(held.unresolved,0);
 assert.equal(held.events[0].predicted,false);
 const eligible=evaluateSpecialAwards(source,producer,{numericState:{3970:0}});
 assert.equal(eligible.events[0].predicted,true);
 assert.equal(eligible.counters.get_3970,8);
 assert.equal(eligible.counters.drop_3970_35221,2);
 assert.equal(source.globalVariable.get_3970,7);
});
test('one-time source SetP and AddP counter paths are distinct',()=>{
 const once=evaluateSpecialAwards({globalVariable:{get_7265:0}},
  [{npc:35219,specialIds:[7265]}]);
 assert.equal(once.counters.get_7265,1);
 const fragment=evaluateSpecialAwards({globalVariable:{get_2926:3}},
  [{npc:40373,specialIds:[2926]}]);
 assert.equal(fragment.counters.get_2926,4);
});
test('source lost branch restores pending award and its counter only once',()=>{
 const src={globalVariable:{
  drop_8295_40374:2,get_8295_40374:1,
  drop_2925_40374:2,get_2925:10,
  drop_7165_40374:0,get_7165_40374:1
 }};
 const before=JSON.stringify(src);
 const loss=applyOriginalBattleLoss(src,40374);
 assert.equal(loss.lossEvent,true);
 assert.equal(loss.changed,2);
 assert.equal(loss.nextState.globalVariable.drop_8295_40374,1);
 assert.equal(loss.nextState.globalVariable.get_8295_40374,0);
 assert.equal(loss.nextState.globalVariable.get_2925,9);
 assert.equal(loss.nextState.globalVariable.get_7165_40374,1);
 assert.equal(JSON.stringify(src),before);
 const duplicate=applyOriginalBattleLoss(loss.nextState,40374);
 assert.equal(duplicate.changed,0);
});
test('source lost branch is specific to the matching boss',()=>{
 const src={globalVariable:{
  drop_8295_40374:2,get_8295_40374:1
 }};
 const loss=applyOriginalBattleLoss(src,35221);
 assert.equal(loss.changed,0);
 assert.equal(loss.nextState.globalVariable.get_8295_40374,1);
});
test('source lost branch restores temporary-free key receipt count only',()=>{
 const src={globalVariable:{
  drop_3970_35221:2,get_3970:1
 }};
 const loss=applyOriginalBattleLoss(src,35221);
 assert.equal(loss.changed,1);
 assert.equal(loss.nextState.globalVariable.drop_3970_35221,1);
 assert.equal(loss.nextState.globalVariable.get_3970,0);
 assert.equal(src.globalVariable.get_3970,1);
});
test('numeric key ownership becomes unresolved after its first award by default',()=>{
 const s={globalVariable:{get_3970:0}};
 const clears=[
  [{npc:35221,specialIds:[3970]}],
  [{npc:35221,specialIds:[3970]}]
 ];
 const out=forecastSpecialAwards(s,clears,{numericState:{3970:0}});
 assert.equal(out.clears[0][0].predicted,true);
 assert.equal(out.clears[1][0].predicted,false);
 assert.equal(out.clears[1][0].unresolved,true);
 assert.equal(out.numericState[3970],null);
 assert.equal(s.globalVariable.get_3970,0);
 const kept=forecastSpecialAwards(s,clears,{
  numericState:{3970:0},numericAfterGrant:'retained'
 });
 assert.equal(kept.clears[0][0].predicted,true);
 assert.equal(kept.clears[1][0].predicted,false);
 assert.equal(kept.clears[1][0].unresolved,false);
 assert.equal(kept.numericState[3970],1);
});
console.log('PASS',testCount,'synthetic original consumer regressions');
