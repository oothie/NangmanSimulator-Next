// Real Korean-server 2026-10-08 equipment birth receipts:
// 5009 ×2 from Yanwangfu, 4609 ×2 from Biyoujiao, 5420 ×1 from Saebuk.
// Compare both MJ/CZ embedded seeds and Rnds.Eds end state. Never model
// final refinement or mangjeong options as if they were verified.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const file of ['wild-core.js','shared-gear-core.js'])
 vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/drops',file),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/sanbujin/shared/equip_data.js'),'utf8'),ctx);
const api=ctx.window.SBJSharedGearCore;
const historical=[
 {id:5009,source:'연왕부',start:1927007254,final:550584870,
  mj:[4308538,5058610],cz:[4308871,5058943],colors:[3,1]},
 {id:4609,source:'벽유교',start:71971892,final:1731705401,
  mj:[8810103,3170664],cz:[8810436,3170997],colors:[2,1]},
 {id:5420,source:'새북',start:1236830854,final:555373631,
  mj:[5537486],cz:[5537819],colors:[2]}
];
const seeds=Object.fromEntries(historical.map(x=>[x.id,x.start]));
const before=JSON.stringify(seeds);
const ordered=historical.flatMap(x=>x.colors.map((color,i)=>({
  itemId:x.id,color,source:x.source==='새북'?'field':'dungeon',round:i+1
})));
const actual=api.traceEds(ordered,seeds,ctx.EQUIP_DATA.equipment);
assert.equal(actual.equipment.length,5);
for(const sample of historical){
 const rows=actual.equipment.filter(x=>x.itemId===sample.id);
 assert.deepEqual(Array.from(rows,x=>x.mjSeed),sample.mj,'MJ seed '+sample.id);
 assert.deepEqual(Array.from(rows,x=>x.czSeed),sample.cz,'CZ seed '+sample.id);
 assert.deepEqual(Array.from(rows,x=>x.edsDraw),sample.mj.map((_,i)=>i+1),'receipt index '+sample.id);
 assert.equal(actual.finalEds[sample.id],sample.final,'real saved Eds end '+sample.id);
 assert(rows.every(x=>x.edsKnown),'seed exists for '+sample.id);
}
assert.equal(JSON.stringify(seeds),before,'original save per-item Eds is immutable');
const ext5009=actual.equipment.filter(x=>x.itemId===5009).map(x=>x.initialAffixes);
assert.equal(ext5009[0].length,2);
assert.equal(ext5009[0][0].prop,'sword_add');
assert(Math.abs(ext5009[0][0].value-0.054)<1e-10,'actual blue 5009 sword +5.4%');
assert.equal(ext5009[0][1].prop,'atk_add');
assert.equal(ext5009[0][1].value,77);
assert.equal(ext5009[1].length,0,'white 5009 has no random affix');
const ext4609=actual.equipment.filter(x=>x.itemId===4609).map(x=>x.initialAffixes);
assert.equal(ext4609[0][0].prop,'speed_add');
assert.equal(ext4609[0][0].value,65);
assert.equal(ext4609[1].length,0,'white 4609 has no random affix');
const ext5420=actual.equipment.filter(x=>x.itemId===5420)[0].initialAffixes;
assert.equal(ext5420[0].prop,'speed_add');
assert.equal(ext5420[0].value,71);

const switched=api.traceEds([
 {itemId:5009,color:1,source:'field'},{itemId:5009,color:4,source:'dungeon'}
],{5009:1927007254});
assert.equal(switched.equipment[0].mjSeed,4308538);
assert.equal(switched.equipment[1].mjSeed,5058610,
 'white and purple must consume the same ID stream');
const absent=api.traceEds([{itemId:4209,color:4}],{});
assert.equal(absent.equipment[0].edsKnown,false);
assert.equal(absent.equipment[0].mjSeed,undefined,'never invent missing seeds');
const originalTable=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/shared-gear-core.js'),'utf8');
assert(originalTable.includes('traceEds(plan.equipment,eds)'));
console.log('PASS: 5 historical equipment receipts, exact Eds MJ/CZ and affixes (5.4%+77, speed 65, speed 71), no mutation');
