'use strict';
// The user-facing native replay and inverse-audit native replay must agree
// on repeated Liu mansion equipment, key reward, and clear counters.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
const scripts=['vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/dungeon-data.js',
 'vendor/sanbujin/drops/dungeon-orange.js',
 'vendor/yysim/daily_data.js',
 'vendor/sanbujin/drops/dungeon-names-ko.js',
 'vendor/sanbujin/drops/dungeon-yysim-adapter.js'];
for(const s of scripts)vm.runInContext(fs.readFileSync(path.join(root,s),'utf8'),ctx,{filename:s});
const equipCtx={};vm.createContext(equipCtx);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/shared/equip_data.js'),'utf8'),equipCtx);
ctx.window.EQUIP_DATA=equipCtx.EQUIP_DATA;
for(const s of ['vendor/sanbujin/drops/dungeon-unique-ownership.js',
 'vendor/sanbujin/drops/dungeon-v2-audit.js',
 'vendor/sanbujin/drops/dungeon-core.js'])
 vm.runInContext(fs.readFileSync(path.join(root,s),'utf8'),ctx,{filename:s});
const w=ctx.window,V=w.SBJDungeonV2,D=w.SBJDungeonDrop;
const catalog=w.SBJDungeonYYAdapter.fullCatalog(w.SBJDungeonCatalog);
const npcs=[35260,35264,35268];
const events=npcs.map(id=>catalog.find(e=>e.id==='drop_'+id+'_equip'));
assert(events.every(Boolean));
const plan=V.planDungeons(['lsby','lsby','lsby']);
const cases=[
 {name:'key acquired in first clear',keyFlag:0,ownsKey:false,roll:100},
 {name:'key remains unacquired',keyFlag:0,ownsKey:false,roll:-100},
 {name:'key already in globalVariable',keyFlag:1,ownsKey:false,roll:100},
 {name:'key already in inventory',keyFlag:0,ownsKey:true,roll:100}
];
for(const sample of cases){
 const flags=new Map([['win_lsby',31],['roll_8915_35264',sample.roll],
  ['roll_8913_35264',0],['roll_8914_35268',0],['roll_8917_35268',0]]);
 if(sample.keyFlag)flags.set('8915',1);
 const input={seeds:{seed_lsby:978587497},eds:{},flags,
  owned:new Set(sample.ownsKey?[8915]:[]),level:100};
 const original=JSON.stringify([input.seeds,[...input.flags],[...input.owned]]);
 const actual=D.predictSequence(input,[...events,...events,...events]);
 const expected=V.native(input,plan,catalog);
 assert(actual.every(row=>row.nativeReplay),sample.name+': native route exists for every boss');
 assert.equal(actual.length,9);
 const core=actual.map(row=>[row.item,row.color]);
 const audit=expected.rows.map(row=>[row.item,row.color]);
 assert.deepEqual(JSON.stringify(core),JSON.stringify(audit),sample.name+': same RNG outcome in both engines');
 assert.equal(JSON.stringify([input.seeds,[...input.flags],[...input.owned]]),original,
  sample.name+': imported save must be immutable');
}
console.log('PASS core/native parity: all 9 boss drops across 3 clears with acquired, missing or held Gori key');
