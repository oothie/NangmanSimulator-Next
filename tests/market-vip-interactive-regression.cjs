'use strict';
// Interactive ghost-market VIP simulation regression; no game save mutation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine/daily-market.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/yysim/daily_data.js'),'utf8'),ctx);
const engine=ctx.window.NangmanMarket,data=ctx.window.DAILY_DATA;
const save={RandShop:{Time:1795228289,Buy:1892,Fresh:0,Lucky:0,Counts:[],Items:[]},
  Rnds:{Sds:{guishishop:1310442850}},GoldSum:0};
const original=JSON.stringify(save);
const state=engine.predict(save,data,1795258400);
assert.equal(state.seedOk,true);
assert.equal(state.slots,6);
assert.equal(state.paidAllowance(0).left,3);
assert.equal(state.paidAllowance(5).left,27);
const results=state.getPaid(2,{vip:5});
assert.equal(results.length,2);
assert.equal(results[0].items.length,6);
assert.equal(results[1].items.length,6);
assert.equal(results[0].used,1);
assert.equal(results[1].used,2);
assert.deepEqual(JSON.parse(JSON.stringify(results[0].items)),
 JSON.parse(JSON.stringify(state.getPaid(1,{vip:5})[0].items)));
assert.equal(JSON.stringify(save),original);
assert.equal(state.nextTime,1795258800,
 'the next automatic rotation for 2026-11-21 19:53 KST is 20:00 KST');
const late=engine.predict(save,data,1795258900);
assert.equal(late.nextTime,1795302000,'20:01 KST -> next 08:00 KST');
const usedSave={...save,RandShop:{...save.RandShop,Fresh:7}};
const usedState=engine.predict(usedSave,data,1795258400);
assert.equal(usedState.paidAllowance(0).left,0);
assert.equal(usedState.paidAllowance(1).left,2);
assert.equal(usedState.getPaid(3,{vip:1}).length,2);
console.log('PASS: VIP0/VIP5, sequential rerolls, repeatability, 08/20 KST, save isolation');
