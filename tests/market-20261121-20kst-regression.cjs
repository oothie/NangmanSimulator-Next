'use strict';
// 2026-11-21 20:00 KST precommitted forecast from a redacted save snapshot.
// Regression tests the site's actual engine and yy-sim vendor data together.
// This is a model snapshot, NOT a verified post-reset market receipt.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),context={window:{}};vm.createContext(context);
for(const file of ['vendor/yysim/daily_data.js','engine/daily-market.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const source=context.window.DAILY_DATA,market=context.window.NangmanMarket;
const save={Rnds:{Sds:{guishishop:1310442850}},RandShop:{
 Time:1795228289,Buy:1892,Fresh:0,Lucky:0,
 Items:[105,1,106,5,102,26].map(ID=>({ID,Buyed:0})),
 Counts:Object.entries({9:70,224:15,222:5,231:8,232:10,226:4,221:1,228:5,227:27,223:15,229:1,122:11,225:1,8:1}).map(([One,Two])=>({One:Number(One),Two}))
},globalVariable:{num_fuben:0},BagMore:95,Items:Array(273).fill(null)};
const at1959=1795258740,at2001=1795258860;
const before=market.predict(save,source,at1959);
assert.equal(before.nextTime,1795258800,'20:00 KST next automatic rotation');
assert.equal(before.missed,0);
const expected=[16,220,22,32,203,11];
assert.deepEqual(Array.from(before.timed(1)[0].items,item=>item.id),expected,
  'precommitted 20:00 item list must not silently drift');
const after=market.predict(save,source,at2001);
assert.equal(after.nextTime,1795302000,'08:00 KST tomorrow is next');
assert.equal(after.missed,1);
assert.deepEqual(Array.from(after.today,item=>item.id),expected,
  'post-reset replay of exactly one timed rotation');
assert.deepEqual(save.RandShop.Items.map(item=>item.ID),[105,1,106,5,102,26],
  'source save is not modified');
console.log('PASS: 08:00/20:00 KST rotation and 20:00 product forecast regression');
