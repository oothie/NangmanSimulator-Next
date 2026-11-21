'use strict';
// Verify arbitrary uploaded saves drive ghost-market prediction, not any
// particular test fixture/server. This test contains synthetic market-only data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={window:{}},root=path.resolve(__dirname,'..');
vm.createContext(context);
for(const p of ['engine/daily-market.js','vendor/yysim/daily_data.js']){
 vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),context,{filename:p});
}
const market=context.window.NangmanMarket,data=context.window.DAILY_DATA;
const initialTime=1795260046;
const make=(seed,slots,counts,fresh=0)=>({
 RandShop:{Time:initialTime,Buy:slots===3?0:slots===4?10:slots===5?30:186,
  Counts:counts,Fresh:fresh,Lucky:0,
  Items:[22,21,101,13,24,19].slice(0,slots).map(ID=>({ID,Buyed:0}))},
 Rnds:{Sds:{guishishop:seed}}
});
const a=make(1349140356,6,[{One:223,Two:3},{One:224,Two:3},{One:222,Two:5}]);
const b=make(978587497,3,{223:0,224:0,222:0});
const c=make(111222333,5,{223:{Two:10},224:{Two:9},222:{Two:5}},1);
const raw=[a,b,c].map(x=>JSON.stringify(x));
const A=market.predict(a,data,initialTime,{slots:6});
const B=market.predict(b,data,initialTime,{slots:6});
const C=market.predict(c,data,initialTime,{slots:5});
assert.equal(A.slots,6);
assert.equal(A.saveSlots,6);
assert.equal(B.slots,6);
assert.equal(B.saveSlots,3);
assert.equal(C.slots,5);
assert.equal(C.saveSlots,5);
assert.equal(market.countsMap(c.RandShop.Counts)[223],10);
assert(A.soldOut.some(x=>x.id===222));
assert(B.available.some(x=>x.id===222));
assert(C.soldOut.some(x=>x.id===222));
const aDraw=A.getPaid(1,{vip:0})[0].items.map(x=>x.id);
const bDraw=B.getPaid(1,{vip:0})[0].items.map(x=>x.id);
const cDraw=C.getPaid(1,{vip:0})[0].items.map(x=>x.id);
assert.notDeepEqual(aDraw,bDraw,'two unrelated uploaded seeds must produce their own draws');
assert.notDeepEqual(bDraw,cDraw,'a third synthetic save must produce its own draws');
assert.equal(aDraw.length,6);
assert.equal(bDraw.length,6);
assert.equal(cDraw.length,5);
for(const s of [A,B,C]){
 for(let vip=0;vip<=5;vip++){
   assert.equal(s.paidAllowance(vip).max,market.VIP_REFRESH[vip]);
   assert.equal(s.getPaid(1,{vip}).length,1);
 }
}
const blocked=A.searchStrategy([222],{vip:5,periods:4,maxStates:500});
assert.equal(blocked.unavailable,true);
const eligible=B.searchStrategy([222],{vip:0,periods:8,maxStates:18000,mode:'cheapest'});
assert.equal(eligible.found,true);
assert(eligible.paid>=0);
const baseline=B.timed(2),shifted=B.timed(2,{vip:0,paidSteps:1});
assert.notDeepEqual([...baseline[0].items.map(x=>x.id)],[...shifted[0].items.map(x=>x.id)]);
assert.equal(JSON.stringify(a),raw[0]);
assert.equal(JSON.stringify(b),raw[1]);
assert.equal(JSON.stringify(c),raw[2]);
// Important UI gate: production must never refer to the bundled test fixture.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(!html.includes('market-reference-saves.js'));
assert(!html.includes('NANGMAN_MARKET_REFERENCES'));
assert(html.includes('window.NangmanMarket.predict(save,window.DAILY_DATA'));
console.log('PASS: arbitrary input save seeds, mixed Counts forms, 3/5/6 slots, all VIP caps, exhausted goods, no fixed fixture in UI');
