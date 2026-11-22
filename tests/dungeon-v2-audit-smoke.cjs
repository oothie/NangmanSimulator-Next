'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const p of ['vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/dungeon-data.js','vendor/sanbujin/drops/dungeon-orange.js',
 'vendor/yysim/daily_data.js','vendor/sanbujin/drops/dungeon-names-ko.js',
 'vendor/sanbujin/drops/dungeon-yysim-adapter.js']){
 vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
}
const equipContext={};vm.createContext(equipContext);
vm.runInContext(fs.readFileSync(path.join(root,
 'vendor/sanbujin/shared/equip_data.js'),'utf8'),equipContext);
ctx.window.EQUIP_DATA=equipContext.EQUIP_DATA;
for(const p of ['vendor/sanbujin/drops/dungeon-unique-ownership.js',
 'vendor/sanbujin/drops/dungeon-v2-audit.js']){
 vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
}
const w=ctx.window,V=w.SBJDungeonV2;
const seeds={seed_byj:978587497,seed_dcy_40372:978587497,
 seed_dcy_40373:978587497,seed_dcy_40374:978587497,seed_lsby:978587497};
const data={seeds,flags:new Map([['byj_bz',2],['win_byj',24],['win_dcy',13],
 ['win_lsby',31],['roll_2922_35214',15],['roll_2923_35221',0],
 ['roll_8913_35264',0],['roll_8914_35268',0],
 ['roll_8917_35268',0]]),owned:new Set(),level:100};
const inputSnapshot=JSON.stringify([data.seeds,[...data.flags],[...data.owned]]);
const catalog=w.SBJDungeonYYAdapter.fullCatalog(w.SBJDungeonCatalog);
const plan=V.planDungeons(['byj','dcy','lsby']);
assert.equal(plan.length,9);
assert.equal(V.fixture.lsby[2].item,4209,'Korean Jisugeom is item 4209');
for(const model of ['source','native']){
 const result=V[model](data,plan,catalog,{throughLiuCompleted:true});
 assert.equal(result.rows.length,9);
 assert(result.trace.length>0);
 assert(result.rows.every(row=>Number.isInteger(row.item) &&
  [0,1,2,3,4].includes(row.color)));
 assert(result.trace.every(t=>t.after>0&&t.bound>0&&t.context));
 assert.equal(JSON.stringify([data.seeds,[...data.flags],[...data.owned]]),inputSnapshot);
 const first=[...result.trace];
 const second=V[model](data,plan,catalog,{throughLiuCompleted:true});
 assert.deepEqual(JSON.stringify(first),JSON.stringify(second.trace),
  're-running the same save must be deterministic');
 const checks=V.compareMeasured(result.rows,[...V.fixture.byj,...V.fixture.dcy,...V.fixture.lsby]);
 assert.equal(checks.length,9);
 assert(checks.every(x=>typeof x.exact==='boolean'));
 assert(checks.some(x=>!x.exact),
  'engine is experimental, 1122 measured mismatches must not be disguised as success');
}
for(const model of ['source','native']){
 const single=V[model](data,V.planDungeons(['lsby']),catalog);
 const repeat=V[model](data,V.planDungeons(['lsby','lsby','lsby']),catalog);
 assert.equal(single.rows.length,3);
 assert.equal(repeat.rows.length,9);
 assert.equal(repeat.finalFlags.get('win_lsby'),data.flags.get('win_lsby')+3);
 assert.notEqual(repeat.finalSeeds.seed_lsby,single.finalSeeds.seed_lsby,
  'second and third dungeon must consume sequential RNG');
}
console.log('PASS experimental v2 independent source/native RNG traces, 1122 mismatch visibility, repeat counters, private-save isolation');
