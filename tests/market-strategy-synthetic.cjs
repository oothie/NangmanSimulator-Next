/* Synthetic ghost-market test: no real accounts, timestamps, or game-save fixtures.
 * Run: node tests/market-strategy-synthetic.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
vm.createContext(sandbox);
for(const file of ['vendor/yysim/daily_data.js','engine/daily-market.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
}
const {NangmanMarket:api,DAILY_DATA:catalog}=sandbox.window;
const now=1700000000; // Fixed synthetic test timestamp
const fixture={
 RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Counts:[],Items:[]},
 Rnds:{Sds:{guishishop:12345}} // Artificial seed, not derived from a player save
};
const market=api.predict(fixture,catalog,now,{slots:6});
assert.equal(market.seedOk,true);
const paid=market.getPaid(1,{vip:0})[0];
const nativePaid=api.replayKoreanClientEvents(fixture,catalog,[{kind:'paid',at:now}],{slots:6});
assert.deepEqual(Array.from(nativePaid.items),Array.from(paid.items,x=>x.id));
assert.equal(nativePaid.lucky,paid.lucky);
const firstAuto=api.nextHalfDay(now)+1;
const timed=market.timed(1)[0];
const nativeAuto=api.replayKoreanClientEvents(fixture,catalog,[{kind:'open',at:firstAuto}],{slots:6});
assert.deepEqual(Array.from(nativeAuto.items),Array.from(timed.items,x=>x.id));
assert.equal(nativeAuto.events[0].auto,true);
// Reopening within one automatic-refresh bucket must not consume RNG.
const sameBucket=api.replayKoreanClientEvents(fixture,catalog,[{kind:'open',at:now+1}],{slots:6});
assert.equal(sameBucket.events[0].auto,false);
assert.equal(sameBucket.seed,fixture.Rnds.Sds.guishishop);
// Strategy verification must use native events and reject altered product claims.
const target=paid.items[0].id;
const plan=market.searchStrategy([target],{mode:'fastest',vip:0,quantity:1,periods:2,maxStates:5000});
assert.equal(plan.found,true,'synthetic short-horizon target should be reachable');
const verified=market.auditStrategy(plan,{target,quantity:1,vip:0});
assert.equal(verified.nativeReplayChecked,true);
const tampered={...plan,steps:plan.steps.map((step,index)=>index===0?{
 ...step,items:step.items.map((item,j)=>j===0?{...item,id:-999}:item)
}:step)};
const blocked=market.auditStrategy(tampered,{target,quantity:1,vip:0});
assert.equal(blocked.found,false,'altered strategy must not be marked verified');
// A saved RNG state is not a valid present-day RNG state after unobserved
// 08:00/20:00 buckets. Old planner builds wrongly predicted actual purchases.
const staleMarket=api.predict(fixture,catalog,now+3*43200,{slots:6});
assert.equal(staleMarket.stale,true);
assert.equal(staleMarket.seedOk,false,'unobserved rotations must block forecasts');
const stalePlan=staleMarket.searchStrategy([target],{mode:'fastest',vip:0,quantity:1,periods:2});
assert.equal(stalePlan.found,false,'stale save must not produce an actionable route');
// The native game does not replay every elapsed automatic bucket upon return.
const lateOpen=api.replayKoreanClientEvents(fixture,catalog,
 [{kind:'open',at:now+3*43200}],{slots:6});
assert.equal(lateOpen.events.length,1);
assert.equal(lateOpen.events[0].auto,true);
assert.deepEqual(Array.from(lateOpen.items),Array.from(nativeAuto.items));
// Regression for the exact *shape* of the historical stale-save failure:
// five elapsed 08:00/20:00 boundaries are not five native draws. This uses
// only an invented seed and invented event times, never account fixtures.
const fiveSlotsLater=now+5*43200;
const fiveStale=api.predict(fixture,catalog,fiveSlotsLater,{slots:6});
assert.equal(fiveStale.missed,5);
assert.equal(fiveStale.seedOk,false);
assert.equal(fiveStale.searchStrategy([target],{
 mode:'fastest',vip:1,quantity:1,periods:12
}).found,false);
const oneEntry=[{kind:'open',at:fiveSlotsLater}];
const fiveEntries=[];
for(let t=api.nextHalfDay(now)+1;t<=fiveSlotsLater;t+=43200)
 fiveEntries.push({kind:'open',at:t});
assert.equal(fiveEntries.length,5);
const onePaid=[...oneEntry];
const fivePaid=[...fiveEntries];
for(let index=0;index<4;index++){
 onePaid.push({kind:'paid',at:fiveSlotsLater+index});
 fivePaid.push({kind:'paid',at:fiveSlotsLater+index});
}
const nextAfterPaid=api.nextHalfDay(fiveSlotsLater)+1;
onePaid.push({kind:'open',at:nextAfterPaid});
fivePaid.push({kind:'open',at:nextAfterPaid});
const actualMissed=api.replayKoreanClientEvents(fixture,catalog,onePaid,{slots:6});
const imaginaryAlwaysOnline=api.replayKoreanClientEvents(fixture,catalog,fivePaid,{slots:6});
assert.equal(actualMissed.events.filter(x=>x.auto).length,2);
assert.equal(imaginaryAlwaysOnline.events.filter(x=>x.auto).length,6);
assert.notEqual(actualMissed.seed,imaginaryAlwaysOnline.seed,
 'always-online assumption must not replace a real missed-session history');
const pageSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(pageSource.includes('저장 시점 기준 모의실행')&&
 pageSource.includes('지금의 실제 판매 목록이 아닌'),
 'archived saves must be labeled historical, never current-day predictions');
// Multiple generated (never player-derived) seeds exercise consecutive paid
// refreshes followed by the scheduled free replacement on one shared RNG.
for(let i=1;i<=24;i++){
 const generated={...fixture,Rnds:{Sds:{guishishop:1000+i*7919}}};
 const strategy=api.predict(generated,catalog,now,{slots:6});
 const twoPaid=strategy.getPaid(2,{vip:0});
 const autoAfterPaid=strategy.timed(1,{vip:0,paidSteps:2})[0];
 const events=api.replayKoreanClientEvents(generated,catalog,[
  {kind:'paid',at:now},{kind:'paid',at:now+1},
  {kind:'open',at:api.nextHalfDay(now)+1}
 ],{slots:6});
 for(let j=0;j<2;j++){
  assert.deepEqual(Array.from(events.events[j].items),
   Array.from(twoPaid[j].items,item=>item.id));
  assert(Math.abs(events.events[j].lucky-twoPaid[j].lucky)<1e-8);
 }
 assert.equal(events.events[2].auto,true);
 assert.deepEqual(Array.from(events.items),Array.from(autoAfterPaid.items,item=>item.id));
}
// All three planning objectives are tested on an artificial seed only.
const cheapest=market.searchStrategy([target],{
 mode:'cheapest',vip:0,quantity:1,periods:2,maxStates:25000
});
assert.equal(cheapest.found,true,'synthetic minimum-jade strategy should be reachable');
const checkedCheapest=market.auditStrategy(cheapest,{target,quantity:1,vip:0});
assert.equal(checkedCheapest.nativeReplayChecked,true);
assert(cheapest.cost<=plan.cost,'minimum-jade cost must not exceed fastest cost');
const freeOnly=market.searchStrategy([target],{
 mode:'free',vip:0,quantity:1,periods:2
});
assert.equal(freeOnly.paid||0,0,'free route must spend no jade');
if(freeOnly.found)assert.equal(cheapest.cost,0,'minimum-jade must use a free route when available');
// Execute the real strategy Worker on synthetic input to verify it returns
// all independent route objectives and their native event audit results.
const workerMessages=[];
const workerSandbox={
 postMessage:msg=>workerMessages.push(msg),
 importScripts:(...scripts)=>{
  for(const ref of scripts){
   const file=ref.split('?')[0].startsWith('./')?
    'engine/'+ref.split('?')[0].slice(2):
    ref.split('?')[0].replace(/^\.\.\//,'');
   vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),workerContext,{filename:file});
  }
 }
};
workerSandbox.self=workerSandbox;
const workerContext=vm.createContext(workerSandbox);
vm.runInContext(fs.readFileSync(path.join(root,'engine/market-strategy-worker.js'),'utf8'),
 workerContext,{filename:'engine/market-strategy-worker.js'});
workerContext.self.onmessage({data:{type:'calculate',requestId:'synthetic',
 save:fixture,anchor:now,slots:6,vip:0,target,quantity:1,periods:2,maxStates:15000}});
const workerError=workerMessages.find(x=>x.type==='error');
assert.equal(workerError,undefined,workerError?.message);
const workerResult=workerMessages.find(x=>x.type==='result');
assert(workerResult,'strategy Worker must emit a completed result');
for(const objective of ['free','fastest']){
 assert(workerResult.plans[objective],objective+' route must be present');
 if(workerResult.plans[objective].found)
  assert.equal(workerResult.plans[objective].nativeReplayChecked,true,
   objective+' route must pass native replay');
}
// If a synthetic free route exists, minimum paid-refresh cost is provably zero.
// The Worker must reuse the audited route instead of searching a second time.
workerMessages.length=0;
const freeTarget=market.timed(1)[0].items[0].id;
workerContext.self.onmessage({data:{type:'calculate',requestId:'free-shortcut',
 save:fixture,anchor:now,slots:6,vip:0,target:freeTarget,quantity:1,
 periods:2,maxStates:15000}});
const freeError=workerMessages.find(x=>x.type==='error');
assert.equal(freeError,undefined,freeError?.message);
const freeResult=workerMessages.find(x=>x.type==='result');
assert(freeResult,'free-target Worker must return all strategy objectives');
assert.equal(freeResult.plans.free.found,true);
assert.equal(freeResult.plans.cheapest,undefined,
 'redundant minimum-jade plan must not be calculated or shown');
assert.equal(freeResult.plans.free.nativeReplayChecked,true,
 'free-only plan must remain verified');
// Daily paid allowance is reset at 05:00 KST for every VIP level.
for(let vip=0;vip<api.VIP_REFRESH.length;vip++){
 const allowance=market.paidAllowance(vip);
 assert.equal(allowance.max,api.VIP_REFRESH[vip]);
 assert.equal(allowance.left,api.VIP_REFRESH[vip]);
 // 05:00 KST is 20:00 UTC; reset day must change at that instant.
 const nextReset=(api.resetDay(now)+1)*86400-14400;
 assert.equal(api.resetDay(nextReset-1),api.resetDay(now));
 assert.equal(api.resetDay(nextReset),api.resetDay(now)+1);
 const nearlyFull={...fixture,RandShop:{...fixture.RandShop,Fresh:allowance.max-1}};
 const pre=api.predict(nearlyFull,catalog,now,{slots:6});
 assert.equal(pre.paidAllowance(vip).left,1,
  'only one paid refresh remains before daily reset');
 assert.equal(pre.getPaid(2,{vip}).length,1,
  'paid prediction must respect remaining VIP allowance');
 const afterReset=api.replayKoreanClientEvents(nearlyFull,catalog,[
  {kind:'daily-reset',at:nextReset}
 ],{slots:6});
 assert.equal(afterReset.fresh,0,'05:00 KST must reset the paid counter');
 const postSave={RandShop:{...nearlyFull.RandShop,Fresh:afterReset.fresh,
  Time:afterReset.shopTime,Lucky:afterReset.lucky,Items:[]},
  Rnds:{Sds:{guishishop:afterReset.seed}}};
 const post=api.predict(postSave,catalog,nextReset,{slots:6});
 assert.equal(post.paidAllowance(vip).left,allowance.max,
  'the full VIP allowance must become available after reset');
 assert.equal(post.getPaid(allowance.max+1,{vip}).length,allowance.max);
}
// 720-period search must keep a real, native-verified candidate even when
// a bounded fastest proof cannot finish. A free route also proves zero jade.
workerMessages.length=0;
const longHorizonSave={RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,
 Items:[],Counts:[]},Rnds:{Sds:{guishishop:12345}}};
workerContext.self.onmessage({data:{type:'calculate',requestId:'long-synthetic',
 save:longHorizonSave,anchor:now,slots:6,vip:1,target:223,
 quantity:3,periods:720,maxStates:1500}});
const longError=workerMessages.find(x=>x.type==='error');
assert.equal(longError,undefined,longError?.message);
const longResponse=workerMessages.find(x=>x.type==='result');
assert(longResponse,'720-period calculation must return a response');
assert(longResponse.plans.free.found);
assert.equal(longResponse.plans.cheapest,undefined,
 '720-period Worker must not run redundant cheapest search');
assert.equal(longResponse.plans.fastest.found,true,
 'an audited feasible route must survive a capped optimality search');
assert.equal(longResponse.plans.fastest.proven,false,
 'bounded fastest candidate must not be labeled globally optimal');
assert.equal(longResponse.plans.fastest.limited,true);
assert.equal(longResponse.plans.fastest.nativeReplayChecked,true);
// v1.2.7: the paid-refresh simulator is read-only. Running it cannot change
// the uploaded save or alter independent Worker purchase-route exploration.
const untouched=JSON.stringify(fixture);
market.getPaid(1,{vip:1});
market.getPaid(3,{vip:1});
assert.equal(JSON.stringify(fixture),untouched,
 'paid-refresh preview must not mutate the uploaded save');
workerMessages.length=0;
workerContext.self.onmessage({data:{type:'calculate',requestId:'independent',
 save:fixture,anchor:now,slots:6,vip:1,target,quantity:1,
 periods:2,maxStates:15000}});
const independentResult=workerMessages.find(msg=>msg.type==='result');
assert(independentResult,'strategy must execute without a preview prefix');
assert.equal(independentResult.plans.fastest.nativeReplayChecked,true);
assert.equal(JSON.stringify(fixture),untouched,
 'strategy calculations must leave the uploaded save unchanged');
assert(!fs.readFileSync(path.join(root,'engine/market-strategy-worker.js'),'utf8').includes('prefixPaid')&&
 !fs.readFileSync(path.join(root,'engine/market-strategy-worker.js'),'utf8').includes('afterPaidRefreshes'),
 'the strategy Worker must not chain from simulated paid refreshes');
// Synthetic stock-cap regression. No account values or player-derived seeds.
const targetTemplate=catalog.shops.guishi.find(x=>x.rare===1&&x.weight>0)
 ||catalog.shops.guishi[0];
const stockTarget={...targetTemplate,stock:2,weight:80,weightGold:80};
const fillers=catalog.shops.guishi.filter(x=>x.id!==stockTarget.id).slice(0,15)
 .map(item=>({...item,stock:null,weight:1,weightGold:1}));
const stockCatalog={...catalog,shops:{...catalog.shops,
 guishi:[stockTarget,...fillers]}};
const stockSave={RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Counts:[],
 Items:[{ID:stockTarget.id,Buyed:0}]},
 Rnds:{Sds:{guishishop:12345}}};
const stockPlanner=api.predict(stockSave,stockCatalog,now,{slots:6});
for(const quantity of [1,2,3]){
 for(const mode of ['free','cheapest','fastest']){
  const route=stockPlanner.searchStrategy([stockTarget.id],{
   mode,vip:3,quantity,periods:3,maxStates:5500
  });
  if(quantity<=2){
   assert(route.found,'the synthetic stock target must be reachable');
   const audited=stockPlanner.auditStrategy(route,{
    target:stockTarget.id,quantity,vip:3
   });
   assert(audited.nativeReplayChecked,
    'limited stock must be verified against native purchase events');
  }else assert.equal(route.found,false,'stock cap must reject 3rd purchase');
 }
}
// A three-copy limited product must support 1/2/3-copy goals, then vanish.
const tripleCatalog={...stockCatalog,shops:{...stockCatalog.shops,
 guishi:stockCatalog.shops.guishi.map(item=>item.id===stockTarget.id?
  {...item,stock:3}:item)}};
const triplePlanner=api.predict(stockSave,tripleCatalog,now,{slots:6});
for(const quantity of [1,2,3]){
 const policy=triplePlanner.findFeasibleStrategy([stockTarget.id],{
  quantity,vip:3,periods:3
 });
 assert.equal(policy.found,true,'synthetic three-copy goal should be reachable');
 const audited=triplePlanner.auditStrategy(policy,{
  target:stockTarget.id,quantity,vip:3
 });
 assert.equal(audited.nativeReplayChecked,true,
  'every multiple-copy purchase must pass native replay');
}
const four=triplePlanner.searchStrategy([stockTarget.id],{
 mode:'cheapest',quantity:4,vip:3,periods:3,maxStates:2000
});
assert.equal(four.found,false,'fourth copy must exceed three-copy stock cap');
const catalogSnapshot=JSON.stringify(stockCatalog.shops.guishi);
const stockEvents=api.replayKoreanClientEvents(stockSave,stockCatalog,[
 {kind:'purchase',at:now,item:stockTarget.id},
 {kind:'paid',at:now+1},
 {kind:'purchase',at:now+1,item:stockTarget.id},
 {kind:'paid',at:now+2}
],{slots:6});
assert(!stockEvents.items.includes(stockTarget.id),
 'purchased-out item must leave next rotation pool');
assert.equal(JSON.stringify(stockCatalog.shops.guishi),catalogSnapshot,
 'native replay must not mutate shared catalog data');
// Independent exhaustive reference for two automatic rotations and up to
// three paid refreshes; not an invocation of the strategy search algorithm.
const oracleItems=catalog.shops.guishi.slice(0,25).map((item,i)=>({
 ...item,stock:null,weight:10,weightGold:10,rare:i===1?1:0
}));
const oracleTarget=oracleItems[1].id;
const oracleCatalog={...catalog,shops:{...catalog.shops,guishi:oracleItems}};
const firstRotation=api.nextHalfDay(now),secondRotation=firstRotation+43200;
function referenceMinimums(save,goal){
 let minimumCost=null,minimumTime=null;
 for(let before=0;before<=3;before++)
 for(let middle=0;middle<=3-before;middle++)
 for(let after=0;after<=3-before-middle;after++){
  const events=[];
  let purchased=0,paidCount=0,finished=false;
  function advance(kind,at){
   if(finished)return;
   events.push({kind,at});
   const actual=api.replayKoreanClientEvents(save,oracleCatalog,events,{slots:6});
   if(actual.items.includes(oracleTarget)){
    events.push({kind:'purchase',at,item:oracleTarget});
    purchased++;
    if(purchased===goal){
     finished=true;
     const cost=paidCount*20;
     minimumCost=minimumCost===null?cost:Math.min(minimumCost,cost);
     minimumTime=minimumTime===null?at:Math.min(minimumTime,at);
    }
   }
  }
  for(let i=0;i<before;i++){paidCount++;advance('paid',now)}
  advance('open',firstRotation);
  for(let i=0;i<middle;i++){paidCount++;advance('paid',firstRotation)}
  advance('open',secondRotation);
  for(let i=0;i<after;i++){paidCount++;advance('paid',secondRotation)}
 }
 return {minimumCost,minimumTime};
}
for(let n=0;n<16;n++){
 const testSave={RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Counts:[],Items:[]},
  Rnds:{Sds:{guishishop:13579+n*2}}};
 const search=api.predict(testSave,oracleCatalog,now,{slots:6});
 for(const goal of [1,2]){
  const expected=referenceMinimums(testSave,goal);
  const cheapest=search.searchStrategy([oracleTarget],{
   mode:'cheapest',quantity:goal,vip:0,periods:2,maxStates:100000
  });
  const fastest=search.searchStrategy([oracleTarget],{
   mode:'fastest',quantity:goal,vip:0,periods:2,maxStates:100000
  });
  assert.equal(cheapest.found?cheapest.cost:null,expected.minimumCost,
   'minimum-jade outcome must match exhaustive event reference');
  assert.equal(fastest.found?fastest.when:null,expected.minimumTime,
   'earliest finish time must match exhaustive event reference');
 }
}
// Independent reference across the 05:00 allowance reset, including
// three-copy stock and the lowest jade cost among equally early completions.
const resetItems=catalog.shops.guishi.slice(0,18).map((item,i)=>({
 ...item,stock:i===1?3:null,weight:10,weightGold:10,rare:i===1?1:0
}));
const resetTarget=resetItems[1].id;
const resetCatalog={...catalog,shops:{...catalog.shops,guishi:resetItems}};
const resetFirst=api.nextHalfDay(now),resetSecond=resetFirst+43200,
 resetThird=resetSecond+43200;
const resetAt=(api.resetDay(now)+1)*86400-14400;
function exhaustiveWithDailyReset(save,quantity){
 let lowestCost=null,earliest=null;
 for(let before=0;before<=3;before++)
 for(let early=0;early<=3-before;early++)
 for(let late=0;late<=3-before-early;late++)
 for(let afterReset=0;afterReset<=3;afterReset++)
 for(let afterThird=0;afterThird<=3-afterReset;afterThird++){
  const events=[];let paidCount=0,obtained=0,complete=false;
  function advance(kind,at){
   if(complete)return;
   events.push({kind,at});
   const draw=api.replayKoreanClientEvents(save,resetCatalog,events,{slots:6});
   if(kind!=='daily-reset'&&draw.items.includes(resetTarget)){
    events.push({kind:'purchase',at,item:resetTarget});
    if(++obtained===quantity){
     complete=true;const entry={time:at,cost:paidCount*20};
     if(!lowestCost||entry.cost<lowestCost.cost||
        entry.cost===lowestCost.cost&&entry.time<lowestCost.time)lowestCost=entry;
     if(!earliest||entry.time<earliest.time||
        entry.time===earliest.time&&entry.cost<earliest.cost)earliest=entry;
    }
   }
  }
  for(let j=0;j<before;j++){paidCount++;advance('paid',now)}
  advance('open',resetFirst);
  for(let j=0;j<early;j++){paidCount++;advance('paid',resetFirst)}
  advance('open',resetSecond);
  for(let j=0;j<late;j++){paidCount++;advance('paid',resetSecond)}
  advance('daily-reset',resetAt);
  for(let j=0;j<afterReset;j++){paidCount++;advance('paid',resetAt)}
  advance('open',resetThird);
  for(let j=0;j<afterThird;j++){paidCount++;advance('paid',resetThird)}
 }
 return {lowestCost,earliest};
}
for(const syntheticSeed of [13579,13581,13583,13585]){
 const input={RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Counts:[],Items:[]},
  Rnds:{Sds:{guishishop:syntheticSeed}}};
 const predict=api.predict(input,resetCatalog,now,{slots:6});
 for(const count of [1,2,3]){
  const optimal=exhaustiveWithDailyReset(input,count);
  const cheapest=predict.searchStrategy([resetTarget],{
   mode:'cheapest',quantity:count,vip:0,periods:3,maxStates:120000
  });
  const fastest=predict.searchStrategy([resetTarget],{
   mode:'fastest',quantity:count,vip:0,periods:3,maxStates:120000
  });
  assert.equal(cheapest.found?cheapest.cost:null,optimal.lowestCost?.cost??null,
   'daily-reset minimum jade must match exhaustive reference');
  assert.equal(fastest.found?fastest.when:null,optimal.earliest?.time??null,
   'daily-reset earliest finish must match exhaustive reference');
  if(optimal.earliest)
   assert.equal(fastest.cost,optimal.earliest.cost,
    'equally fast plans must choose the lowest jade cost');
  if(fastest.found)assert(predict.auditStrategy(fastest,{
   target:resetTarget,quantity:count,vip:0
  }).nativeReplayChecked);
 }
}
// A small search-state budget can find a real route without proving that it
// is globally earliest. Such a route must remain explicitly unproven.
const boundedSave={
 RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Counts:[],Items:[]},
 Rnds:{Sds:{guishishop:13579}}
};
const boundedState=api.predict(boundedSave,catalog,now,{slots:6});
const candidateBounded=boundedState.findFeasibleStrategy([222],{
 quantity:2,vip:1,periods:12
});
assert(candidateBounded.found,'synthetic route should exist for capped search');
const limitedBounded=boundedState.searchStrategy([222],{
 mode:'fastest',quantity:2,vip:1,periods:12,maxStates:2000,
 bestCandidate:candidateBounded
});
assert(limitedBounded.found,'bounded search should preserve a feasible route');
assert.equal(limitedBounded.proven,false,
 'a capped search must never falsely certify global optimality');
assert.equal(limitedBounded.limited,true,
 'a capped search must indicate that states remain unexplored');
const boundedAudit=boundedState.auditStrategy(limitedBounded,{
 target:222,quantity:2,vip:1
});
assert(boundedAudit.nativeReplayChecked,
 'unproved earliest route must still pass exact native replay');
const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(markup.includes('최단 미확정')&&markup.includes('최단 경로임은 증명되지'),
 'the UI must explain the difference between valid and optimal');
// Cross-check bounded fastest-search pruning on 30 artificial cases.
// A completed native-replay route is required even when optimality is unproved.
let proofCount=0,checkedCount=0;
for(const syntheticSeed of [12345,13579,97531,24680,44444]){
 const caseSave={
  RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Items:[],Counts:[]},
  Rnds:{Sds:{guishishop:syntheticSeed}}
 };
 const state=api.predict(caseSave,catalog,now,{slots:6});
 for(const id of [223,224,222])for(const quantity of [1,2]){
  const candidate=state.auditStrategy(state.findFeasibleStrategy([id],{
   quantity,vip:1,periods:12
  }),{target:id,quantity,vip:1});
  const answer=state.searchStrategy([id],{
   quantity,vip:1,mode:'fastest',periods:12,maxStates:2000,
   bestCandidate:candidate.found?candidate:null
  });
  assert(answer.found,'bounded search must retain feasible native route');
  const checked=state.auditStrategy(answer,{target:id,quantity,vip:1});
  assert(checked.nativeReplayChecked,'every returned route must match native events');
  proofCount+=Number(answer.proven===true);
  checkedCount++;
 }
}
assert.equal(checkedCount,30);
assert(proofCount>=29,'dominance pruning should prove at least 29 / 30 routes');
// Memoized search shelves must remain identical to the independently replayed
// client for both optimization goals across different synthetic streams.
for(const memoSeed of [12345,13579,97531,24680,44444]){
 const memoSave={RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Items:[],Counts:[]},
  Rnds:{Sds:{guishishop:memoSeed}}};
 const memoState=api.predict(memoSave,catalog,now,{slots:6});
 for(const memoTarget of [223,224,222])
 for(const memoQuantity of [1,2])
 for(const memoMode of ['fastest','cheapest']){
  const route=memoState.searchStrategy([memoTarget],{
   mode:memoMode,quantity:memoQuantity,vip:1,periods:12,maxStates:2000
  });
  if(route.found)assert(memoState.auditStrategy(route,{
   target:memoTarget,quantity:memoQuantity,vip:1
  }).nativeReplayChecked,'cached shelf must match independent native event replay');
 }
}
// Weight-array reuse must preserve all visible paid items and Lucky in 3–6
// slot layouts; streams are artificial, never taken from real save files.
for(const stocklessSeed of [12345,13579,97531,24680,44444,78945,24681]){
 const input={RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Items:[],Counts:[]},
  Rnds:{Sds:{guishishop:stocklessSeed}}};
 for(const slots of [3,4,5,6]){
  const predicted=api.predict(input,catalog,now,{slots}).getPaid(4,{vip:5});
  const events=[];
  for(let index=0;index<4;index++){
   events.push({kind:'paid',at:now+index});
   const actual=api.replayKoreanClientEvents(input,catalog,events,{slots});
   assert.deepEqual(Array.from(predicted[index].items,item=>item.id),
    Array.from(actual.items),'weighted draw must match native stream');
   assert(Math.abs(predicted[index].lucky-actual.lucky)<1e-8);
  }
 }
}
// Browser-facing recovery: stale but valid saves must simulate from their
// actual saved shop timestamp, never by guessing missed client sessions.
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const forecastStart=indexSource.indexOf('function marketForecastContext(){');
const forecastEnd=indexSource.indexOf('function dailyMarketView(){',forecastStart);
assert(forecastStart>=0&&forecastEnd>forecastStart,'site forecast context must exist');
const contextSource=indexSource.slice(forecastStart,forecastEnd);
function marketContextAt(save,at){
 const FakeDate=class extends Date{static now(){return at*1000;}};
 const factory=new Function('save','window','marketSlotsOverride','Date',
  contextSource+'\nreturn marketForecastContext();');
 return factory(save,{NangmanMarket:api,DAILY_DATA:catalog},6,FakeDate);
}
const presentContext=marketContextAt(fixture,now+60);
assert.equal(presentContext.archived,false);
assert.equal(presentContext.anchor,now+60);
assert.equal(presentContext.state.seedOk,true);
const pastContext=marketContextAt(fixture,now+5*43200);
assert.equal(pastContext.archived,true);
assert.equal(pastContext.anchor,now);
assert.equal(pastContext.state.seedOk,true,
 'buttons must remain usable at the archived shop timestamp');
const stillStale=api.predict(fixture,catalog,now+5*43200,{slots:6});
assert.equal(stillStale.seedOk,false,
 'historic replay must not claim present-day RNG certainty');
const archivedPaid=pastContext.state.getPaid(1,{vip:0})[0];
assert(archivedPaid?.items?.length>0,
 'archived refresh preview should produce concrete items');
const archivedStrategy=pastContext.state.searchStrategy([target],{
 mode:'fastest',vip:0,quantity:1,periods:2,maxStates:10000
});
assert(archivedStrategy.found,'archived purchase strategy should run');
assert(pastContext.state.auditStrategy(archivedStrategy,{
 target,quantity:1,vip:0
}).nativeReplayChecked,'archived strategy must match native RNG');
assert(indexSource.includes("if($('marketSimNext'))$('marketSimNext').onclick"));
assert(indexSource.includes("if($('marketAutoNext'))$('marketAutoNext').onclick"));
assert(indexSource.includes("if($('marketStrategyRun'))$('marketStrategyRun').onclick"));
// Historic strategy separates the new daily paid allowance (05:00 KST)
// from its first 08:00 free shop draw. Both paid orderings are independent RNG
// paths, not two labels for the same shelf.
const morningTime=hhmm=>Math.floor(Date.parse('2026-11-25T'+hhmm+':00+09:00')/1000);
const beforeMorning=morningTime('04:45');
const resetMorning=morningTime('05:00');
const freeMorning=morningTime('08:00');
const morningSave={RandShop:{Time:beforeMorning,Fresh:3,Lucky:0,Buy:60,
 Counts:[],Items:[]},Rnds:{Sds:{guishishop:12345}}};
const paidBeforeFree=api.replayKoreanClientEvents(morningSave,catalog,[
 {kind:'daily-reset',at:resetMorning},
 {kind:'paid',at:resetMorning},
 {kind:'open',at:freeMorning}
],{slots:6});
const paidAfterFree=api.replayKoreanClientEvents(morningSave,catalog,[
 {kind:'daily-reset',at:resetMorning},
 {kind:'open',at:freeMorning},
 {kind:'paid',at:freeMorning}
],{slots:6});
assert.equal(paidBeforeFree.events[1].fresh,1,
 '05:00-08:00 paid refresh uses the new daily allowance');
assert.equal(paidBeforeFree.events[1].auto,false,
 '05:00 paid refresh must not trigger the 08:00 free draw early');
assert.equal(paidBeforeFree.events[2].auto,true,
 '08:00 shop entry must draw after a 05:00 paid refresh');
assert.notDeepEqual(paidBeforeFree.items,paidAfterFree.items,
 '05:00-before-08:00 and after-08:00 paid orders must stay distinct');
const pageForPhases=fs.readFileSync(path.join(root,'index.html'),'utf8');
const phaseStart=pageForPhases.indexOf('function marketBeforeMorningFree(at){');
const phaseEnd=pageForPhases.indexOf('function marketStrategyMarkup',phaseStart);
assert(phaseStart>0&&phaseEnd>phaseStart,'morning paid phase classifier is required');
const classifyMorning=new Function(pageForPhases.slice(phaseStart,phaseEnd)+
 '\nreturn marketBeforeMorningFree;')();
assert.equal(classifyMorning(morningTime('04:59')),false);
assert.equal(classifyMorning(resetMorning),true);
assert.equal(classifyMorning(morningTime('07:59')),true);
assert.equal(classifyMorning(freeMorning),false);
assert(pageForPhases.includes('05~08시 무료 갱신 전')&&
 pageForPhases.includes('08시 이후'),'paid phase labels should be visible');
assert(!pageForPhases.includes("plan('cheapest'"),
 'the limited-item strategy UI must not show minimum-jade strategy');
// The page and strategy Worker must load the same revision of the RNG module.
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const workerSource=fs.readFileSync(path.join(root,'engine/market-strategy-worker.js'),'utf8');
function revision(content,prefix){
 const start=content.indexOf(prefix);
 return start<0?null:content.slice(start+prefix.length).match(/^[a-zA-Z0-9_.-]+/)?.[0]||null;
}
const pageRef=revision(page,'engine/daily-market.js?rev=');
const workerRef=revision(workerSource,'./daily-market.js?rev=');
const entryRef=revision(page,'new Worker(\'engine/market-strategy-worker.js?rev=');
assert(pageRef&&workerRef&&entryRef,'market modules must use explicit cache revisions');
assert(page.includes('낭만강호 통합 시뮬레이터 v1.2.8'),
 'website version must advance to v1.2.8');
assert.equal(pageRef,workerRef,'page and Worker must use the same RNG revision');
assert.equal(pageRef,entryRef,'Worker entrypoint must share the RNG cache revision');
console.log('PASS synthetic market RNG, stale-save safeguards, and aligned cache keys');
