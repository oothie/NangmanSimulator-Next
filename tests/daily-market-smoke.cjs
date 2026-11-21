// yy-sim guishi shop-source parity and Korean daily UI regressions.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const moduleSrc=fs.readFileSync(path.join(root,'engine','daily-market.js'),'utf8');
const dailySrc=fs.readFileSync(path.join(root,'vendor','yysim','daily_data.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(moduleSrc,ctx);
vm.runInContext(dailySrc,ctx);
const api=ctx.window.NangmanMarket;
assert(api&&typeof api.predict==='function','real market predictor exposed');
assert(Array.isArray(ctx.window.DAILY_DATA.shops.guishi),'original shop records included');
assert.equal(ctx.window.DAILY_DATA.shops.guishi.length,101,'full original 101 products');
assert.equal(ctx.window.DAILY_DATA.ver,73618,'source version retained');
const ids=[4,40,10,5,41,22,32,118,12,7,33,100];
const catalog=ids.map((id,i)=>({id,item:10000+i,name:'Item '+id,price:1000+i,
 money:1,count:1,weight:15+i*3,weightGold:12+i*4,...id===100?{rare:1}:{}}));
const shopData={ver:73618,shops:{guishi:catalog,hengshan:[]}};
const save={Rnds:{Sds:{guishishop:1406943639}},RandShop:{
 Counts:[{One:100,Two:0}],Buy:1713,Time:1791631121,Fresh:0,Lucky:0,
 Items:[{ID:4},{ID:40},{ID:10}]
},Items:[],globalVariable:{}};
const before=JSON.stringify(save);
const now=1791631121+3*43200;
const result=api.predict(save,shopData,now);
assert.equal(result.seedOk,true,'actual guishishop seed field recognized');
assert.equal(result.missed,3,'source 12h rotation lag');
assert.deepEqual(Array.from(result.today,x=>x.id),[10,118,12,7,32,41],
 'matches yy-sim source Mc() regular weighted-RNG sequence');
const paid=result.getPaid(2).map(x=>Array.from(x.items,it=>it.id));
assert.deepEqual(paid,[[118,100,33,7,41,32],[100,33,32,22,12,118]],
 'matches original weighted paid refresh including rare item');
const times=result.findTargets([4,40,10],5);
assert.deepEqual(Array.from(times,x=>x.item.id),[10,40,4],
 'original shop target first-occurrence ordering');
assert.deepEqual(Array.from(times,x=>x.via),['current','paid','timed']);
assert.equal(result.paidLeft,3,'forecast methods must not spend actual save refresh');
assert.equal(JSON.stringify(save),before,'no save mutation after forecast');
assert.equal(api.nextHalfDay(43200),86400,'time boundary 12-hour change');
assert.equal(api.resetDay(86400-10801),0,'original daily reset before boundary');
assert.equal(api.resetDay(86400-10800),1,'original daily reset at boundary');
const real=api.predict(save,ctx.window.DAILY_DATA,now);
assert(real.available.length>70,'real original market selection loaded');
assert(real.today.length>0,'real table has a projected shelf');
const noSeed=api.predict({RandShop:{Items:[{ID:4,Buyed:1}],Time:now,Buy:0},
 Rnds:{Sds:{}}},shopData,now);
assert.equal(noSeed.seedOk,false,'missing guishishop seed blocks forecast');
assert.equal(noSeed.getPaid().length,0,'no hallucinated future stock without seed');
assert.equal(noSeed.today[0].buyed,1,'saved purchase status survives');
const sold=api.predict({Rnds:save.Rnds,RandShop:{
 ...save.RandShop,Counts:[{One:100,Two:100}]
}}, {ver:1,shops:{guishi:catalog.map(x=>x.id===100?{...x,stock:1}:x)}},now);
assert(!sold.available.some(x=>x.id===100),'sold out limited item removed from forecast');
assert(html.includes('./vendor/yysim/daily_data.js'),'site loads original daily source');
assert(html.includes('./engine/daily-market.js'),'site loads market predictor');
assert(html.includes('function dailyMarketView(){'),'market panel rendered');
assert(html.includes("id=\"marketQuery\""),'item target search bound');
assert(html.includes("id=\"marketPeriods\""),'forecast horizon dropdown bound');
assert(html.includes("dailyTab==='ghost'?dailyMarketView()"),'daily ghost tab enabled');
assert(html.includes("한국판 상품 구성·버전 차이"),'unverified Korean parity disclosed');
console.log('PASS: yy-sim source market RNG parity, weights, seed safety, Korean UI and sold-out handling');
