/* Synthetic regression: user-requested assumption that every 08:00/20:00
 * free redraw after a saved time was observed in-game.
 * No real account, save, historical seed or personal state is included.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};vm.createContext(sandbox);
for(const f of ['vendor/yysim/daily_data.js','engine/daily-market.js'])
 vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox,{filename:f});
const api=sandbox.window.NangmanMarket,catalog=sandbox.window.DAILY_DATA;
const epoch=1700000000;
const fake={RandShop:{Time:epoch,Fresh:2,Lucky:17,Buy:60,
 Counts:[],Items:[{ID:4,Buyed:1}]},Rnds:{Sds:{guishishop:12345}}};
const before=JSON.stringify(fake);
const at=epoch+5*43200;
const reforecast=api.assumeAllFreeVisits(fake,catalog,at,{slots:6});
assert.equal(reforecast.applied,true);
assert.equal(reforecast.count,5);
assert.equal(reforecast.events.length,5);
const events=[];
for(let t=api.nextHalfDay(epoch);t<=at;t+=43200)
 events.push({kind:'open',at:t});
const native=api.replayKoreanClientEvents(fake,catalog,events,{slots:6});
assert.deepEqual(Array.from(reforecast.save.RandShop.Items,x=>x.ID),
 Array.from(native.items));
assert.equal(reforecast.save.Rnds.Sds.guishishop,native.seed);
assert.equal(reforecast.save.RandShop.Lucky,native.lucky);
assert.equal(reforecast.save.RandShop.Fresh,0,'05:00 KST paid quota reset');
assert.equal(reforecast.save.RandShop.Time,at);
assert.equal(JSON.stringify(fake),before,'never edit visitor save');
const now=api.predict(reforecast.save,catalog,at,{slots:6});
assert.equal(now.stale,false);
assert.equal(now.seedOk,true);
assert.equal(now.today.length,6);
assert.equal(api.predict(fake,catalog,at,{slots:6}).seedOk,false,
 'the source save stays stale; only the optional assumed scenario advances');
const noBoundary=api.assumeAllFreeVisits(fake,catalog,epoch+60,{slots:6});
assert.equal(noBoundary.applied,false);
assert.equal(noBoundary.count,0);
const first=api.nextHalfDay(epoch);
assert.equal(api.assumeAllFreeVisits(fake,catalog,first,{slots:6}).count,1,
 '08:00/20:00 KST exact boundary counts as first scheduled check');
const missing=api.assumeAllFreeVisits({RandShop:{Time:epoch}},catalog,at);
assert.equal(missing.applied,false);
assert(missing.reason);
const older=epoch+3*365*86400;
const long=api.assumeAllFreeVisits(fake,catalog,older,{slots:6});
assert(long.count>2000);
assert.equal(api.predict(long.save,catalog,older,{slots:6}).stale,false);
assert.equal(JSON.stringify(fake),before);
console.log('PASS: assumed-all-free 08/20 present-day stock, native RNG parity, quota, non-mutation');
