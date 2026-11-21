// 90-level field/dungeon per-equipment receipt ordinal, independent of color.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),drops=path.join(root,'vendor/sanbujin/drops');
const context={window:{}};vm.createContext(context);
for(const file of ['wild-data.js','wild-core.js','dungeon-data.js','dungeon-core.js','shared-gear-core.js']){
 vm.runInContext(fs.readFileSync(path.join(drops,file),'utf8'),context,{filename:file});
}
const core=context.window.SBJSharedGearCore;
const field=[{itemId:5009,color:1},{itemId:4009,color:3},{itemId:5009,color:2}];
const dungeon=[{item:5009,color:4},{item:5609,color:1},{item:5009,color:3}];
const snapshot=JSON.stringify([field,dungeon]);
let first=core.merge(field,dungeon,'field-first');
let reversed=core.merge(field,dungeon,'dungeon-first');
let alternating=core.merge(field,dungeon,'alternate');
assert.deepEqual(Array.from(first.equipment.filter(x=>x.itemId===5009),x=>x.inPlan),[1,2,3,4]);
assert.deepEqual(Array.from(alternating.equipment.filter(x=>x.itemId===5009),x=>x.source),
 ['field','dungeon','field','dungeon']);
assert.deepEqual(Array.from(reversed.equipment.filter(x=>x.itemId===5009),x=>x.source),
 ['dungeon','dungeon','field','field']);
assert.equal(first.byItem.find(x=>x.id===5009).count,4);
assert.equal(JSON.stringify([field,dungeon]),snapshot,'source field/dungeon results unchanged');
assert.throws(()=>core.merge(field,dungeon,'bogus'),/순서/);
const wild=context.window.SBJWildCatalog.find(x=>x.npcId===32299);
const dungeonBoss=context.window.SBJDungeonCatalog.find(x=>x.id==='drop_33650_equip');
assert(wild&&dungeonBoss);
assert.equal(wild.branches.flatMap(x=>x.equipIds).includes(5009),false,'Saibei pool excludes Shifang 5009');
const sds={seed_32299:28971893};
for(const key of [dungeonBoss.outerSeed,dungeonBoss.colorSeed,dungeonBoss.equip.seed,dungeonBoss.weapon.seed])
 if(key)sds[key]=9918814;
const save={Rnds:{Sds:sds,Eds:{4009:12345,5009:987654}},globalVariable:{}};
const before=JSON.stringify(save);
const output=core.project(save,wild,dungeonBoss,30,15,'alternate',{});
assert.equal(output.events,45);
assert.equal(output.mode,'alternate');
assert(output.equipment.every(x=>core.GEAR90.includes(x.itemId)&&x.inPlan>=1));
assert.equal(JSON.stringify(save),before,'projection never mutates user save');
assert.throws(()=>core.project(save,wild,dungeonBoss,101,15,'alternate',{}),/1~100회/);
const html=fs.readFileSync(path.join(drops,'index.html'),'utf8');
const nav=fs.readFileSync(path.join(drops,'dungeon.js'),'utf8');
const ui=fs.readFileSync(path.join(drops,'shared-gear.js'),'utf8');
for(const x of ['id="sharedGear"','id="sharedGearForm"','id="sharedRun"','id="sharedExport"'])assert(html.includes(x));
assert(html.includes('./shared-gear-core.js')&&html.includes('./shared-gear.js'));
assert(nav.includes("shared: $('sharedGear')"),'shared mode is navigable');
assert(ui.includes('현재 세이브 이후 계획 내'),'no fabricated lifetime sequence ID');
assert(ui.includes('실게임 품질/정련/망정 미검증'),'no invented complete gear stats');
console.log('PASS: common 90-gear per-ID receipt ordinal across field/dungeon, color independent, source RNG untouched');
