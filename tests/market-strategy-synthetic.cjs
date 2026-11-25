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
for(const objective of ['free','cheapest','fastest']){
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
assert.equal(freeResult.plans.cheapest.cost,0);
assert.equal(freeResult.plans.cheapest.verifiedMinimumCost,true,
 'zero-cost audited free route must bypass paid search');
assert.equal(freeResult.plans.cheapest.nativeReplayChecked,true);
assert.equal(freeResult.plans.cheapest.mode,'free',
 'keep free-mode event timeline valid for audit');
// Daily paid allowance is reset at 05:00 KST for every VIP level.
for(let vip=0;vip<api.VIP_REFRESH.length;vip++){
 const allowance=market.paidAllowance(vip);
 assert.equal(allowance.max,api.VIP_REFRESH[vip]);
 assert.equal(allowance.left,api.VIP_REFRESH[vip]);
 // 05:00 KST is 20:00 UTC; reset day must change at that instant.
 const nextReset=(api.resetDay(now)+1)*86400-14400;
 assert.equal(api.resetDay(nextReset-1),api.resetDay(now));
 assert.equal(api.resetDay(nextReset),api.resetDay(now)+1);
}
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
assert.equal(pageRef,workerRef,'page and Worker must use the same RNG revision');
assert.equal(pageRef,entryRef,'Worker entrypoint must share the RNG cache revision');
console.log('PASS synthetic market RNG, stale-save safeguards, and aligned cache keys');
