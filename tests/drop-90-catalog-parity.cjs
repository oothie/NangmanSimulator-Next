// Contract: 100-level outer tomb and all 90+ regular gear sources retain only
// actual Korean game level-90 normal equipment, never 100-level dummy/orange.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const [file,dir] of [
 ['equip_data.js','vendor/sanbujin/shared'],
 ['wild-data.js','vendor/sanbujin/drops'],['wild-core.js','vendor/sanbujin/drops'],
 ['dungeon-data.js','vendor/sanbujin/drops'],['tomb-core.js','vendor/sanbujin/drops'],
 ['shared-gear-core.js','vendor/sanbujin/drops']]){
 vm.runInContext(fs.readFileSync(path.join(root,dir,file),'utf8'),ctx,{filename:file});
}
const equipment=vm.runInContext('EQUIP_DATA.equipment',ctx),gear90=Array.from(ctx.window.SBJSharedGearCore.GEAR90);
assert.equal(gear90.length,14,'exactly fourteen 90-level wild/dungeon normal items');
assert.equal(new Set(gear90).size,14);
for(const id of gear90){
 const item=equipment[id];assert(item,'Korean equipment record for '+id);
 assert.equal(item.lv,90,'never classify 100-level dummy gear as normal drop');
 assert(item.koName&&typeof item.koName==='string','Korean equipment label for '+id);
 assert.equal(Number(item.weapon_color),0,'unique orange weapons excluded');
}
const catalog=Array.from(ctx.window.SBJWildCatalog);
const saibei=catalog.find(x=>x.npcId===32299),shifang=catalog.find(x=>x.npcId===32224);
assert(saibei?.lv>=90&&shifang?.lv>=90);
const pool=x=>x.branches.flatMap(y=>y.equipIds||[]);
assert(!pool(saibei).includes(5009),'5009 Ziwei wrist guard cannot be pushed from Saibei');
assert(pool(shifang).includes(5009),'5009 must be pushed from Shifang');
for(const event of catalog.filter(x=>x.kind==='story'&&x.lv>=90)){
 for(const id of pool(event))assert(gear90.includes(id),'field special-NPC 90-level source ID: '+id);
}
const tomb=ctx.window.SBJTombDrop.source;
assert.equal(tomb.encounterNpc,35255);
assert.equal(tomb.specialNpc,35256);
assert.equal(tomb.level,100);
assert.equal(tomb.dropLevel,90);
assert.deepEqual(Array.from(tomb.pool),[4009,4209,4409,4609,4809,5009,5409,5609]);
for(const id of tomb.pool)assert(gear90.includes(id));
const events=Array.from(ctx.window.SBJDungeonCatalog);
for(const event of events.filter(e=>Array.isArray(e.outer)&&e.equip?.ids?.length)){
 for(const id of event.equip.ids){
  // Low-level original dungeon entries may contain gear below 90; only inspect
  // 90-level+ entries where the pool overlaps our shared 90 set.
  if(gear90.includes(id))assert.equal(equipment[id].lv,90);
 }
}
console.log('PASS: 14 Korean 90-level regular equipment IDs, Saibei/Shifang pool difference and tomb 100→90 loot');
