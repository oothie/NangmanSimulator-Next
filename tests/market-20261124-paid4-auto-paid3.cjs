/* Regression: Korean 4-server ghost-market path, 2026-11-24.
   Only minimal, non-identifying market state is embedded.
   Run: node tests/market-20261124-paid4-auto-paid3.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
sandbox.self=sandbox.window;
vm.createContext(sandbox);
for(const file of ['vendor/yysim/daily_data.js','engine/daily-market.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
}
const market=sandbox.window.NangmanMarket;
const data=sandbox.window.DAILY_DATA;
const counts=[[224,3],[223,3],[9,3],[231,3],[232,2],[222,5],[227,1],[8,1],[221,1],[228,2]]
 .map(([One,Two])=>({One,Two}));
const before={
 Rnds:{Sds:{guishishop:1349140356}},
 RandShop:{
  Time:1795260046,Fresh:0,Lucky:0,Buy:186,Counts:counts,
  Items:[22,21,101,13,24,19].map(ID=>({ID,Buyed:0}))
 }
};
const events=[
 {kind:'open',at:1795516200},
 ...[1,2,3,4].map((_,i)=>({kind:'paid',at:1795516210+i})),
 {kind:'open',at:1795518093},
 ...[1,2,3].map((_,i)=>({kind:'paid',at:1795518100+i}))
];
const replay=market.replayKoreanClientEvents(before,data,events,{slots:6});
const free=replay.events[5];
assert.equal(free.auto,true,'20:01 shop opening must execute free redraw');
assert.equal(free.seed,1664919952,'free redraw must advance to observed seed');
assert.deepEqual(Array.from(free.items),[19,111,1,104,219,102]);
assert.equal(free.items.includes(223),false,'4 paid + free must not promise 쇄성보 잔편');
assert.equal(replay.seed,170795103);
assert.equal(replay.fresh,7);
assert(Math.abs(replay.lucky-16.66666666666424)<1e-6);
assert.deepEqual(Array.from(replay.items),[22,35,44,13,223,45]);
const current={
 Rnds:{Sds:{guishishop:90574275}},
 RandShop:{
  Time:1795516200,Fresh:0,Lucky:0,Buy:186,Counts:counts,
  Items:[34,10,109,2,13,43].map(ID=>({ID,Buyed:0}))
 }
};
const planner=market.predict(current,data,1795516200,{slots:6});
for(const mode of ['cheapest','fastest']){
 const plan=planner.searchStrategy([223],{mode,vip:1,quantity:1,periods:4,maxStates:10000});
 assert(plan.found,mode+' should have a feasible path');
 const verified=planner.auditStrategy(plan,{target:223,quantity:1,vip:1});
 assert(verified.nativeReplayChecked,mode+' must pass independent native event replay');
}
console.log('PASS Korean market 4 paid → 20:01 free → 3 paid; native strategy audit');
