'use strict';
// Privacy-safe second/fourth-server market fixtures; no character metadata.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.createContext(context);
for(const file of ['engine/daily-market.js','vendor/yysim/daily_data.js','data/market-reference-saves.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const {NangmanMarket:market,DAILY_DATA:data,NANGMAN_MARKET_REFERENCES:refs}=context.window;
const snapshot=JSON.stringify(refs);
const main=market.predict(refs.server4,data,refs.server4.RandShop.Time,{slots:6});
assert.equal(main.saveSlots,6);
assert.equal(main.slots,6);
assert.deepEqual([...main.today.map(x=>x.id)],[22,21,101,13,24,19]);
const fourCount=market.countsMap(refs.server4.RandShop.Counts);
assert.equal(fourCount[223],3); // 벽파신공
assert.equal(fourCount[224],3); // 쇄성보
assert.equal(fourCount[222],5); // 독벽도객 completed
assert(main.available.some(x=>x.id===223));
assert(main.available.some(x=>x.id===224));
assert(main.soldOut.some(x=>x.id===222));
assert.equal(main.getPaid(1,{vip:0})[0].items.length,6);
const second3=market.predict(refs.server2,data,refs.server2.RandShop.Time);
const second6=market.predict(refs.server2,data,refs.server2.RandShop.Time,{slots:6});
assert.equal(second3.saveSlots,3);
assert.equal(second3.slots,3);
assert.equal(second6.saveSlots,3);
assert.equal(second6.slots,6);
assert.equal(second3.getPaid(1,{vip:0})[0].items.length,3);
assert.equal(second6.getPaid(1,{vip:0})[0].items.length,6);
assert(second6.available.some(x=>x.id===222),'second-server du-bi must be eligible');
const cases=[
 [main,223,0,'cheapest',2,1795431600],
 [main,224,0,'cheapest',0,1795345200],
 [main,225,0,'fastest',3,1795260046],
 [second6,222,0,'cheapest',1,1795734000],
 [second6,222,5,'fastest',16,1795259703]
];
for(const [state,id,vip,mode,paid,when] of cases){
 const got=state.searchStrategy([id],{vip,mode,periods:12,maxStates:18000});
 assert.equal(got.found,true,'found '+id+' vip '+vip+' '+mode);
 assert.equal(got.paid,paid,'paid count '+id+' vip '+vip+' '+mode);
 assert.equal(got.when,when,'found time '+id+' vip '+vip+' '+mode);
}
assert.equal(JSON.stringify(refs),snapshot,'no mutations to reference states');
console.log('PASS: 4-server six slots, three owned fragments, du-bi second-server fallback, slot override, VIP0/VIP5 strategies');
