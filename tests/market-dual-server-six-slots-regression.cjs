'use strict';
// Synthetic-only 3/6-slot regression. Historical real-user server snapshots
// must never be committed, bundled, or required for release verification.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const file of ['engine/daily-market.js','vendor/yysim/daily_data.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const {NangmanMarket:m,DAILY_DATA:d}=ctx.window,ts=1795260046;
function fake(seed,slots,counts){return {RandShop:{
 Time:ts,Buy:slots===6?186:0,Counts:counts,Fresh:0,Lucky:0,
 Items:[22,21,101,13,24,19].slice(0,slots).map(ID=>({ID,Buyed:0}))
 },Rnds:{Sds:{guishishop:seed}}}}
const a=fake(1349140356,6,[{One:223,Two:3},{One:224,Two:3},{One:222,Two:5}]);
const b=fake(978587497,3,{223:0,224:0,222:0});
const originals=[JSON.stringify(a),JSON.stringify(b)];
const A=m.predict(a,d,ts,{slots:6}),B=m.predict(b,d,ts);
assert.equal(A.slots,6);assert.equal(A.saveSlots,6);
assert.equal(B.slots,3);assert.equal(B.saveSlots,3);
assert(A.soldOut.some(x=>x.id===222),'exhausted special goods are not offered');
assert(B.available.some(x=>x.id===222),'unbought special goods remain available');
const rowA=A.getPaid(1,{vip:0})[0].items.map(x=>x.id);
const rowB=B.getPaid(1,{vip:0})[0].items.map(x=>x.id);
assert.equal(rowA.length,6);assert.equal(rowB.length,3);
assert.notDeepEqual(rowA,rowB,'independent synthetic seeds produce independent market draws');
assert.equal(m.countsMap(a.RandShop.Counts)[223],3);
assert.equal(m.countsMap(a.RandShop.Counts)[224],3);
assert.equal(m.countsMap(a.RandShop.Counts)[222],5);
for(let vip=0;vip<=5;vip++){
 assert.equal(A.paidAllowance(vip).max,m.VIP_REFRESH[vip]);
 assert.equal(B.paidAllowance(vip).max,m.VIP_REFRESH[vip]);
}
assert.equal(A.searchStrategy([222],{vip:0,mode:'cheapest',periods:4,maxStates:300}).unavailable,true);
const found=B.searchStrategy([222],{vip:0,mode:'cheapest',periods:9,maxStates:18000});
assert.equal(found.found,true);
assert.equal(JSON.stringify(a),originals[0]);assert.equal(JSON.stringify(b),originals[1]);
console.log('PASS: private-save-free synthetic 3/6-slot market states, sold-out fragments, strategies and VIP limits');
