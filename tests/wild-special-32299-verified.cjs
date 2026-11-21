// Actual 2026-10-08 Korean server 32299 six-call reward trace.
// 24 wild battles resulted in six special-NPC reward calls; they are NOT
// interchangeable with 24 special-NPC rewards.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const file of ['wild-core.js','wild-data.js'])
 vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/drops',file),'utf8'),ctx);
const wild=ctx.window.SBJWildDrop,target=ctx.window.SBJWildCatalog.find(x=>x.npcId===32299);
assert(target&&target.lv===95&&target.seedKey==='seed_32299');
const archive={Rnds:{Sds:{seed_32299:1270932620},Eds:{}}};
const original=JSON.stringify(archive);
const opts={pad:0,count:6,time:0,interval:30,bait:'normal'};
const state=wild.open(archive,target),result=wild.predictWithState(state,target,opts,{});
assert.deepEqual(Array.from(result.rows,x=>[x.itemId||0,x.color||0]),
 [[0,0],[5420,2],[0,0],[0,0],[0,0],[0,0]]);
assert.equal(result.final.seed,142147230,'post battle saved seed matches exactly');
assert.equal(state.seed,1270932620,'input independent state unchanged');
assert.equal(JSON.stringify(archive),original,'real archive never mutated');
const withEds={Rnds:{Sds:{seed_32299:1270932620},Eds:{5420:1236830854}}};
const seeded=wild.open(withEds,target),cfg={5420:{type:1,lv:90,base:{},exts:{}}};
const detail=wild.predictWithState(seeded,target,opts,cfg);
assert.equal(detail.final.seed,142147230);
assert.equal(detail.final.eds['5420'],555373631,
 'actual created green 5420 advances shared Eds exactly once');
assert.equal(withEds.Rnds.Eds['5420'],1236830854,'archive Eds untouched');
const repeated={kind:'story',seedKey:'seed_32299',
 branches:[{weight:100,equipIds:[5420],colors:[[1,10000]]}]};
const twice=wild.predictWithState(wild.open(withEds,repeated),repeated,
 {pad:0,count:2,time:0,interval:30,bait:'normal'},cfg);
assert.deepEqual(Array.from(twice.rows,x=>x.itemId),[5420,5420]);
assert.equal(twice.final.eds['5420'],458219810,
 'same-ID second receipt continues Eds rather than discarding its stream');
assert.deepEqual(Array.from(wild.predict(state,target,opts,{}),x=>[x.itemId||0,x.color||0]),
 Array.from(result.rows,x=>[x.itemId||0,x.color||0]),'backward compatible field UI API');
console.log('PASS: actual Saebuk 32299 six special-NPC reward calls, green 5420 on #2, exact 142147230 end RNG');
