// Market first appearances must not mix timed-only and discretionary paid refresh scenarios.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine/daily-market.js'),'utf8'),ctx);
const market=ctx.window.NangmanMarket;
const ids=[4,40,10,5,41,22,32,118,12,7,33,100];
const catalog=ids.map((id,i)=>({id,item:10000+i,name:'품목 '+id,
 price:1000+i,money:1,count:1,weight:15+i*3,weightGold:12+i*4,
 ...id===100?{rare:1}:{}}));
const now=1791631121+3*43200;
const archive={Rnds:{Sds:{guishishop:1406943639}},RandShop:{
 Counts:[{One:100,Two:0}],Buy:1713,Time:1791631121,Fresh:0,Lucky:0,
 Items:[{ID:4},{ID:40},{ID:10}]
},Items:[],globalVariable:{}};
const source={ver:73618,shops:{guishi:catalog}};
const original=JSON.stringify(archive),state=market.predict(archive,source,now);
const onlyTimes=state.findTargets(ids,8,{mode:'timed-only'});
const onlyPaid=state.findTargets(ids,8,{mode:'paid-now'});
const hybrid=state.findTargets(ids,8,{mode:'mixed'});
assert(onlyTimes.every(x=>x.via==='timed'||x.via==='current'));
assert(onlyPaid.every(x=>x.via==='paid'||x.via==='current'));
assert(onlyTimes.some(x=>x.via==='timed'),'scheduled future draws remain accessible');
assert(onlyPaid.some(x=>x.via==='paid'),'optional paid now draws remain accessible');
assert(hybrid.some(x=>x.via==='paid'),'legacy mixed scenario kept internal');
assert.deepEqual(Array.from(state.findTargets(ids,8,{mode:'timed-only'}),x=>x.item.id),
 Array.from(onlyTimes,x=>x.item.id),'same save/plan deterministic');
assert.throws(()=>state.findTargets(ids,8,{mode:'unknown'}),/시나리오/);
for(const invalid of [0,-1,1.5,'',null,'abc']){
 const broken=market.predict({...archive,Rnds:{Sds:{guishishop:invalid}}},source,now);
 assert.equal(broken.seedOk,false,'invalid RNG seed must block forecasts: '+invalid);
 assert.equal(broken.timed(2).length,0);
 assert.equal(broken.getPaid(2).length,0);
}
assert.equal(JSON.stringify(archive),original,'no actual save changes');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes("mode:'timed-only'"));
assert(html.includes("mode:'paid-now'"));
assert(html.includes('정시 교체만'));
assert(html.includes('지금 원보 갱신:'));
console.log('PASS: clock-only and paid-now market RNG forecasts independent, deterministic and no-save-mutation');
