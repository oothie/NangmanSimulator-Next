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
const key='고리의 열쇠 추첨 · 8915';
function simulate(keyHeld,roll,clears=3,viaInventory=false){
 const flags=new Map([['win_lsby',31],['roll_8915_35264',roll],
  ['roll_8913_35264',0],['roll_8914_35268',0],['roll_8917_35268',0]]);
 if(keyHeld&&!viaInventory)flags.set('8915',1);
 const owned=new Set(keyHeld&&viaInventory?[8915]:[]);
 return V.native({seeds:{seed_lsby:978587497},flags,owned,level:100},
  V.planDungeons(Array.from({length:clears},()=> 'lsby')),catalog);
}
const keyEvents=output=>output.trace.filter(step=>step.context===key);
const success=simulate(false,100,1),failed=simulate(false,-100,1);
assert.equal(keyEvents(success).length,1);
assert.equal(keyEvents(failed).length,1);
assert.equal(success.finalFlags.get('drop_8915_35264'),1,'key reward success');
assert.equal(failed.finalFlags.get('drop_8915_35264'),0,'key reward failure');
assert.equal(success.finalFlags.get('8915'),1,'successful key transfers into simulation inventory');
assert.equal(JSON.stringify(success.trace),JSON.stringify(failed.trace),
 'success/failure on the same key roll does not add another RNG draw');
assert.equal(JSON.stringify(success.rows.map(x=>[x.item,x.color])),
 JSON.stringify(failed.rows.map(x=>[x.item,x.color])),
 'the same clear must not change ordinary equipment if key result alone changes');
const success3=simulate(false,100),failed3=simulate(false,-100);
assert.equal(keyEvents(success3).length,1,'once acquired, the key suppresses later eligible rolls');
assert.equal(keyEvents(failed3).length,3,'if never acquired, every eligible clear rolls');
assert.notEqual(success3.finalSeeds.seed_lsby,failed3.finalSeeds.seed_lsby,
 'later clears must reflect the key acquisition branch');
const heldFlag=simulate(true,100),heldInventory=simulate(true,100,3,true);
assert.equal(keyEvents(heldFlag).length,0,'saved key flag skips all key RNG');
assert.equal(keyEvents(heldInventory).length,0,'saved key inventory skips all key RNG');
assert.equal(JSON.stringify(heldFlag.trace),JSON.stringify(heldInventory.trace),
 'direct flag and actual owned inventory must agree');
assert.equal(success3.rows.length,9);
console.log('PASS Gori key: same-clear reward outcome, later key ownership, stored inventory, 3 clears');
