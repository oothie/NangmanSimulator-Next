'use strict';
// Sanitized regression from the user's 2026-11-21 second-server VIP0 save.
// Only the ghost-shop state is included, never player/account data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),context={window:{}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'engine/daily-market.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/yysim/daily_data.js'),'utf8'),context);
const {predict}=context.window.NangmanMarket;
const save={GoldStep:0,RandShop:{Counts:{},S:1496692866,Fresh:0,
 Lucky:0,Time:1795259703,Items:[{Buyed:0,S:1575818482,ID:37},
 {Buyed:0,S:1575818482,ID:100},{Buyed:0,S:1575818482,ID:108}],Buy:0},
 Rnds:{Sds:{guishishop:978587497}}};
const frozen=JSON.stringify(save);
const state=predict(save,context.window.DAILY_DATA,save.RandShop.Time);
assert.equal(state.slots,3);
assert.deepEqual([...state.today.map(i=>i.id)],[37,100,108]);
assert.deepEqual([...context.window.NangmanMarket.countsMap({})].length?[]:[],[]);
for(const shopId of [223,224,222,225])
 assert(state.available.some(i=>i.id===shopId),'fresh account must be eligible: '+shopId);
const expected=[
 {id:223,min:1,when:1795431600},
 {id:224,min:1,when:1795345200},
 {id:222,min:2,when:1795302000},
 {id:225,min:5,when:1795431600}
];
for(const item of expected){
 const cheapest=state.searchStrategy([item.id],{vip:0,mode:'cheapest',periods:8,maxStates:18000});
 assert.equal(cheapest.found,true,'cheapest found '+item.id);
 assert.equal(cheapest.paid,item.min,'minimum refreshes '+item.id);
 assert.equal(cheapest.when,item.when,'earliest date at minimum cost '+item.id);
 assert(cheapest.proven);
}
const fast0=state.searchStrategy([225],{vip:0,mode:'fastest',periods:8,maxStates:18000});
const fast5=state.searchStrategy([225],{vip:5,mode:'fastest',periods:8,maxStates:18000});
assert.equal(fast0.when,1795381200);
assert.equal(fast0.paid,8);
assert.equal(fast5.when,1795302000);
assert.equal(fast5.paid,43);
assert(fast5.steps.some(x=>x.kind==='reset'&&x.time===1795294800),
 '06:00 KST daily allowance reset must be a separate event');
assert.equal(state.paidAllowance(0).max,3);
assert.equal(state.paidAllowance(5).max,27);
assert.equal(JSON.stringify(save),frozen,'never mutate imported save');
console.log('PASS second-server VIP0 save: 3 slots, 4 limited goods, VIP0/VIP5 routes, 06:00 reset and immutable save');
