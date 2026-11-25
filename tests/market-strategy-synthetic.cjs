/* Synthetic ghost-market test: no real accounts, timestamps, or game-save fixtures.
 * Run: node tests/market-strategy-synthetic.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};
vm.createContext(sandbox);
for(const file of ['vendor/yysim/daily_data.js','engine/daily-market.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
}
const {NangmanMarket:api,DAILY_DATA:catalog}=sandbox.window;
const now=1700000000; // Fixed synthetic test timestamp
const fixture={
 RandShop:{Time:now,Fresh:0,Lucky:0,Buy:60,Counts:[],Items:[]},
 Rnds:{Sds:{guishishop:12345}} // Artificial seed, not derived from a player save
};
const market=api.predict(fixture,catalog,now,{slots:6});
assert.equal(market.seedOk,true);
const paid=market.getPaid(1,{vip:0})[0];
const nativePaid=api.replayKoreanClientEvents(fixture,catalog,[{kind:'paid',at:now}],{slots:6});
assert.deepEqual(Array.from(nativePaid.items),Array.from(paid.items,x=>x.id));
assert.equal(nativePaid.lucky,paid.lucky);
const firstAuto=api.nextHalfDay(now)+1;
const timed=market.timed(1)[0];
const nativeAuto=api.replayKoreanClientEvents(fixture,catalog,[{kind:'open',at:firstAuto}],{slots:6});
assert.deepEqual(Array.from(nativeAuto.items),Array.from(timed.items,x=>x.id));
assert.equal(nativeAuto.events[0].auto,true);
console.log('PASS synthetic paid and automatic refresh against Korean event replay');
