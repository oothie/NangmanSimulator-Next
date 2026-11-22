'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
const files=[
 'vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/dungeon-data.js',
 'vendor/sanbujin/drops/dungeon-orange.js',
 'vendor/yysim/daily_data.js',
 'vendor/sanbujin/drops/dungeon-names-ko.js',
 'vendor/sanbujin/drops/dungeon-yysim-adapter.js',
 'vendor/sanbujin/drops/dungeon-core.js',
 'vendor/sanbujin/drops/dungeon-dual-core.js'
];
for(const p of files)vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx,{filename:p});
const w=ctx.window;
const catalog=w.SBJDungeonYYAdapter.fullCatalog(w.SBJDungeonCatalog);
const seeds={};
for(const e of catalog.filter(e=>e.outer)){if(e.outerSeed)seeds[e.outerSeed]=978587497;if(e.colorSeed)seeds[e.colorSeed]=978587497}
const save={Rnds:{Sds:seeds,Eds:{}},globalVariable:{win_ywf:20,win_dcy:10,win_byj:9,win_byjzt:12}};
const frozen=JSON.stringify(save),input=w.SBJDungeonDrop.open(save);
const results=w.DAILY_DATA.dungeons.map(d=>w.SBJDungeonDual.compare(input,d,catalog,w.SBJDungeonCatalog));
assert.equal(results.length,18);
for(let i=0;i<results.length;i++){
 const d=w.DAILY_DATA.dungeons[i],r=results[i];
 assert.equal(r.bosses.length,d.npcs.length);
 assert.equal(r.yy.rows.length,d.npcs.length);
 assert.equal(r.san.rows.length,d.npcs.length);
 assert.equal(r.yy.source,'yy-sim');
 assert.equal(r.san.source,'sanbujin');
 for(const row of [...r.yy.rows,...r.san.rows]){
  assert(Number.isInteger(row.item));
  assert(row.color===0||[1,2,3,4].includes(row.color));
  if(row.item)assert(w.NangmanDungeonKoreanNames[row.item],
   'missing Korean gear name '+row.item);
 }
}
const yan=results.find(x=>x.dungeonId==='ywf');
assert.deepEqual(Array.from(yan.bosses,x=>x.id),[33654,33653,33652,33650]);
assert(yan.yy.rows.some((x,i)=>x.item!==yan.san.rows[i].item||
 x.color!==yan.san.rows[i].color),'both engines must be independently computed');
const nextYan=w.SBJDungeonDual.compare(input,
 w.DAILY_DATA.dungeons.find(x=>x.id==='ywf'),catalog,w.SBJDungeonCatalog);
assert.deepEqual(JSON.stringify(yan),JSON.stringify(nextYan));
assert.equal(JSON.stringify(save),frozen);
const noSeeds=w.SBJDungeonDrop.open({Rnds:{Sds:{}}});
const empty=w.SBJDungeonDual.compare(noSeeds,w.DAILY_DATA.dungeons.find(x=>x.id==='ywf'),catalog,w.SBJDungeonCatalog);
assert(empty.yy.rows.some(x=>x.missing));
assert(empty.san.rows.some(x=>x.missing));
const html=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/index.html'),'utf8');
assert(html.includes('id="dungeonDualArea"'));
assert(html.includes('id="dungeonDualBody"'));
assert(html.includes('id="dungeonLegacy" hidden'));
assert(html.includes('dungeon-dual-core.js'));
assert(html.includes('dungeon-dual.js'));
const ui=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/dungeon-dual.js'),'utf8');
new vm.Script(ui);
console.log('PASS: 18 dungeon full-boss yy-sim/Sanbujin forecasts, IDs, grades, Korean names, missing seeds and read-only replays');
