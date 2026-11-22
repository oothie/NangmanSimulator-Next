'use strict';
// Target purchases (not just a first appearance): remaining limited fragments,
// single limited pills, custom repeat count, and deterministic free rotations.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine/daily-market.js'),'utf8'),ctx);
const {predict}=ctx.window.NangmanMarket;
const now=1795259703;
const catalog=[
 {id:223,item:2992,name:'벽파신공 잔편',count:1,stock:15,
  weight:100,weightGold:100,rare:1,price:50000,money:1}
];
const source={ver:73618,shops:{guishi:catalog}};
const make=(purchased=0,items=[],buyed=0)=>({
 RandShop:{Counts:{223:purchased},Fresh:0,Time:now,Buy:80,Lucky:0,
  Items:items.map(id=>({ID:id,Buyed:buyed}))},
 Rnds:{Sds:{guishishop:978587497}}
});
const fullSave=make(6);
const unchanged=JSON.stringify(fullSave);
const st=predict(fullSave,source,now,{slots:6});
assert.equal(st.available[0].stock,15);
const free=st.searchStrategy([223],{mode:'free',quantity:9,periods:28});
assert.equal(free.found,true,'free-only path completes the remaining 9 pages');
assert.equal(free.required,9);
assert.equal(free.acquired,9);
assert.equal(free.paid,0);
assert.equal(free.cost,0);
assert.equal(free.purchases.length,9);
assert.equal(free.when,st.nextTime+8*43200);
assert.equal(free.steps.filter(x=>x.kind==='paid').length,0);
assert.deepEqual(Array.from(free.purchases,x=>x.totalAcquired),[1,2,3,4,5,6,7,8,9]);
const short=st.searchStrategy([223],{mode:'free',quantity:9,periods:3});
assert.equal(short.found,false);
assert.equal(short.acquired,3);
assert.equal(short.remaining,6);
assert.equal(short.paid,0);
assert.equal(short.limited,true);
const over=st.searchStrategy([223],{mode:'free',quantity:10,periods:28});
assert.equal(over.found,false);
assert.equal(over.unavailable,true);
const single=st.searchStrategy([223],{mode:'free',quantity:1,periods:28});
assert.equal(single.found,true);
assert.equal(single.when,st.nextTime);
const onShelf=predict(make(6,[223],0),source,now);
const current=onShelf.searchStrategy([223],{mode:'free',quantity:2,periods:28});
assert.equal(current.purchases[0].kind,'current');
assert.equal(current.when,onShelf.nextTime);
const soldShelf=predict(make(6,[223],1),source,now);
const avoidDouble=soldShelf.searchStrategy([223],{mode:'free',quantity:2,periods:28});
assert.equal(avoidDouble.purchases[0].kind,'auto');
assert.equal(avoidDouble.when,soldShelf.nextTime+43200);
const instant=predict(make(14),source,now);
const one=instant.searchStrategy([223],{mode:'free',quantity:1,periods:30});
assert.equal(one.found,true);
const best=st.searchStrategy([223],{mode:'cheapest',quantity:2,periods:28,maxStates:5000});
assert.equal(best.found,true);
assert.equal(best.required,2);
assert.equal(best.acquired,2);
assert.equal(best.cost,0);
assert.equal(best.paid,0);
const fastest=st.searchStrategy([223],{mode:'fastest',quantity:2,periods:28,maxStates:5000});
assert.equal(fastest.found,true);
assert.equal(fastest.acquired,2);
assert(fastest.when<=best.when);
assert.equal(JSON.stringify(fullSave),unchanged,'search never changes real save');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes("marketStrategyGoal(target,save)"),'UI calculates saved remaining quantity');
assert(html.includes("plan('free'"),'zero-ingot route is visible');
assert(html.includes('marketStrategyQuantity'),'non-limited products allow entered target quantity');
assert(html.includes('목표 전체 수량'),'all-route UI must show completion goal');
console.log('PASS: 9 remaining pages, deterministic free route, bought shelf isolation, whole-target cheapest/fastest and custom quantity UI');
