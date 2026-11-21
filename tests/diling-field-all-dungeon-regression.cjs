'use strict';
// Comprehensive 2026-11-21 regression: Jiling ordinary field vs all registered
// dungeon rewards. Synthetic save: no user/account identifiers.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cwd=path.join(__dirname,'..');
const context={window:{}};
vm.createContext(context);
const run=p=>vm.runInContext(fs.readFileSync(path.join(cwd,p),'utf8'),context,{filename:p});
run('vendor/sanbujin/shared/equip_data.js');
context.window.EQUIP_DATA=context.EQUIP_DATA;
for(const p of [
  'vendor/sanbujin/drops/wild-core.js',
  'vendor/sanbujin/drops/tomb-core.js',
  'vendor/sanbujin/drops/dungeon-core.js',
  'vendor/sanbujin/drops/wild-data.js',
  'vendor/sanbujin/drops/dungeon-data.js'
])run(p);
const {SBJWildDrop:wild,SBJTombDrop:tomb,SBJDungeonDrop:dungeon,
 SBJWildCatalog:wildCatalog,SBJDungeonCatalog:catalog,EQUIP_DATA:eq}=context.window;
const tombTarget=wildCatalog.find(x=>x.npcId===35256);
assert(tombTarget,'NPC35256 exists as an outdoor field target');
assert.equal(tombTarget.kind,'tomb');
assert.equal(tombTarget.dropLevel,90);
assert.equal(tombTarget.lv,100);
assert(!catalog.some(x=>x.dungeon==='제릉'&&x.boss==='NPC35256'),
 'Jiling field NPC must not be conflated with a dungeon boss');
const fieldSave={Rnds:{Sds:{rollenemy_tomb:1456365169,seed_35256:492075794}},
 globalVariable:{eat_2659:9,rollenemy_tomb2:200}};
const opened=tomb.open(fieldSave);
assert(tomb.ready(opened),'field encounter should be ready with seeds and required flags');
const field=tomb.predict(opened,{count:30,pad:0,order:'descending'});
assert.equal(field.length,30);
assert(field.some(x=>x.spawn),'special monster appears some rounds');
for(const x of field.filter(x=>x.color)){
 assert.equal(x.dropLevel,90);
 assert.equal(eq.equipment[x.itemId]?.lv,90);
}
assert.equal(fieldSave.Rnds.Sds.seed_35256,492075794);
assert.equal(fieldSave.Rnds.Sds.rollenemy_tomb,1456365169);
const events=catalog.filter(x=>x.outer);
assert(events.length>=49,'all registered dungeon reward functions remain available');
const seedKeys=new Set();
const eds={};
for(const evt of events){
 for(const k of [evt.outerSeed,evt.colorSeed,evt.equip?.seed,evt.weapon?.seed])if(k)seedKeys.add(k);
 for(const id of [...(evt.equip?.ids||[]),...(evt.weapon?.ids||[])])
  if(eq.equipment[id]?.lv===90)eds[id]=934159786;
}
const seeds=Object.fromEntries([...seedKeys].map(key=>[key,1322310472]));
const save={Rnds:{Sds:seeds,Eds:eds}};
const original=JSON.stringify(save);
const input=dungeon.open(save);
const rows=dungeon.predictSequence(input,events);
assert.equal(rows.length,events.length);
assert(rows.equipmentStream.tracked>0,'per-item Eds streams advanced for 90 equipment');
assert.equal(rows.equipmentStream.missing,0,'all synthetic 90-level Eds are available');
const counters=new Map();
for(const row of rows){
 if(!row.sharedEdsTracked)continue;
 assert.equal(eq.equipment[row.item]?.lv,90);
 const count=(counters.get(row.item)||0)+1;counters.set(row.item,count);
 assert.equal(row.sameItemOrder,count,'same item advances across all dungeon bosses');
}
assert.equal(JSON.stringify(save),original,'game save must remain unchanged');
const first=events.find(e=>e.outer);
const single=dungeon.predict(input,first,10);
assert.equal(single.length,10);
assert(single.equipmentStream,'single-boss preview also tracks shared Eds');
console.log('PASS: 100-level Jiling ordinary field -> 90-level gear; '+events.length+
 ' dungeon reward functions; cross-dungeon per-item Eds; no save mutations');
