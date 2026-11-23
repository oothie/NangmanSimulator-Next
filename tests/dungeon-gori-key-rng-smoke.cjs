'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const script of [
 'vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/dungeon-data.js',
 'vendor/sanbujin/drops/dungeon-orange.js',
 'vendor/yysim/daily_data.js',
 'vendor/sanbujin/drops/dungeon-names-ko.js',
 'vendor/sanbujin/drops/dungeon-yysim-adapter.js'
])vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),ctx,{filename:script});
const equipContext={};vm.createContext(equipContext);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/shared/equip_data.js'),'utf8'),equipContext);
ctx.window.EQUIP_DATA=equipContext.EQUIP_DATA;
for(const script of ['vendor/sanbujin/drops/dungeon-unique-ownership.js',
 'vendor/sanbujin/drops/dungeon-v2-audit.js'])
 vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),ctx,{filename:script});
const V=ctx.window.SBJDungeonV2;
const catalog=ctx.window.SBJDungeonYYAdapter.fullCatalog(ctx.window.SBJDungeonCatalog);
const plan=V.planDungeons(['lsby','lsby','lsby']);
const key='고리의 열쇠 추첨 · 8915';
function simulate(keyHeld,roll){
 const flags=new Map([['win_lsby',31],['roll_8915_35264',roll],
  ['roll_8913_35264',0],['roll_8914_35268',0],['roll_8917_35268',0]]);
 if(keyHeld)flags.set('8915',1);
 return V.native({seeds:{seed_lsby:978587497},flags,owned:new Set(),level:100},plan,catalog);
}
const reward=simulate(false,100),miss=simulate(false,-100),alreadyHeld=simulate(true,100);
function keyEvents(output){return output.trace.filter(step=>step.context===key)}
assert.equal(keyEvents(reward).length,3,'not owning key draws on every eligible clear');
assert.equal(keyEvents(miss).length,3,'failure to obtain key still consumes the same RNG draw');
assert.equal(keyEvents(alreadyHeld).length,0,'source path skips key draw if key flag is set');
assert.equal(reward.finalFlags.get('drop_8915_35264'),1,'key success branch');
assert.equal(miss.finalFlags.get('drop_8915_35264'),0,'key failure branch');
assert.equal(JSON.stringify(reward.trace),JSON.stringify(miss.trace),
 'key reward success/failure alone must not consume an extra draw in the recovered native route');
assert.equal(JSON.stringify(reward.rows.map(x=>[x.npcId,x.item,x.color])),
 JSON.stringify(miss.rows.map(x=>[x.npcId,x.item,x.color])),
 'the outcome of the key draw alone does not shift ordinary equipment sequence');
assert.notEqual(reward.finalSeeds.seed_lsby,alreadyHeld.finalSeeds.seed_lsby,
 'having the key before the clear skips draws and changes later equipment RNG');
assert.equal(reward.rows.length,9);
console.log('PASS Gori key branch: draw eligibility versus reward outcome, repeat clears, no fixture-based equipment overrides');
