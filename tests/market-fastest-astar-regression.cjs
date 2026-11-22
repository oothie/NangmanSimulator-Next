'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
for(const file of ['engine/daily-market.js','vendor/yysim/daily_data.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
const now=1795259703;
const sourceSave={GoldStep:0,RandShop:{Counts:{},S:1496692866,Fresh:0,Lucky:0,
 Time:now,Items:[{Buyed:0,S:1575818482,ID:37},{Buyed:0,S:1575818482,ID:100},
 {Buyed:0,S:1575818482,ID:108}],Buy:0},Rnds:{Sds:{guishishop:978587497}}};
const frozen=JSON.stringify(sourceSave);
const m=ctx.window.NangmanMarket.predict(sourceSave,ctx.window.DAILY_DATA,now);
for(const [id,qty,when] of [[223,1,1795302000],[223,2,1795388400],
 [224,1,1795345200],[224,2,1795345200],[222,1,1795302000],
 [222,2,1795431600],[225,1,1795381200]]){
 const got=m.searchStrategy([id],{vip:0,mode:'fastest',quantity:qty,
  periods:10,maxStates:15000});
 assert(got.found,'whole-target route must be found: '+id+' x'+qty);
 assert.equal(got.when,when,'shortest date regression '+id+' x'+qty);
 assert.equal(got.proven,true);
 assert.equal(got.purchases.length,qty);
 assert.equal(got.steps.filter(x=>x.acquired).length,qty);
}
const high=m.searchStrategy([225],{vip:5,mode:'fastest',quantity:1,
 periods:8,maxStates:18000});
assert.equal(high.when,1795302000);
assert.equal(high.paid,43);
assert(high.steps.some(x=>x.kind==='reset'&&x.time===1795294800));
const progress=[];
const st=ctx.window.NangmanMarket.predict(
 {RandShop:{Counts:{223:0},Fresh:0,Time:now,Buy:80,Lucky:0,Items:[]},
  Rnds:{Sds:{guishishop:978587497}}},ctx.window.DAILY_DATA,now,{slots:6});
const five=st.searchStrategy([223],{vip:0,mode:'fastest',
 quantity:5,periods:120,maxStates:30000,onProgress:p=>progress.push(p)});
assert.equal(five.found,true);
assert.equal(five.when,1795554000);
assert(progress.some(x=>x.expanded===5000&&x.limit===30000));
// Full 15-page path must be found by actual RNG replays at a longer horizon.
const fifteen=st.findFeasibleStrategy([223],{vip:0,quantity:15,periods:240});
assert.equal(fifteen.found,true,'15 pages obtain a concrete route');
assert.equal(fifteen.proven,false,'a feasible route is not an optimality proof');
assert.equal(fifteen.purchases.length,15);
assert.equal(fifteen.purchases.at(-1).totalAcquired,15);
assert.equal(fifteen.when,1801609200);
const candidate5=st.findFeasibleStrategy([223],{vip:0,quantity:5,periods:120});
const shortestWithBound=st.searchStrategy([223],{vip:0,mode:'fastest',
 quantity:5,periods:120,maxStates:30000,bestCandidate:candidate5});
assert.equal(shortestWithBound.found,true);
assert.equal(shortestWithBound.when,1795554000);
assert.equal(shortestWithBound.proven,true);
const limited=st.searchStrategy([223],{vip:0,mode:'fastest',
 quantity:15,periods:120,maxStates:1000});
assert.equal(limited.found,false,'state-cap must not claim an exact result');
assert(limited.error.includes('탐색 상한'));
assert.equal(JSON.stringify(sourceSave),frozen,'no save mutation');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'engine/market-strategy-worker.js'),'utf8');
assert(html.includes('market-strategy-worker.js'));
assert(html.includes('marketStrategyCancel'));
assert(worker.includes('importScripts'));
assert(worker.includes("type:'candidate'"));
assert(worker.includes('forecastPeriods'));
assert(html.includes("const productText=x=>"));
console.log('PASS: A* shortest-time, 15-item concrete route, bounds, UI, progress and unchanged save');
