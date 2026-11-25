// Offline source-consistency regression only. Does not claim original LuaJIT RNG restoration.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sandbox={window:{}};
vm.runInNewContext(read('vendor/sanbujin/drops/dungeon-data.js'),sandbox);
vm.runInNewContext(read('vendor/sanbujin/drops/dungeon-orange.js'),sandbox);
const native=sandbox.window.SBJDungeonCatalog;
const routes=sandbox.window.SBJDungeonOrange;
const evidence=require('./LOW_GATE_REFERENCE_EVIDENCE_20261125.json');
let bosses=0,special=0,routeFound=0;
const seen=new Set();
for(const gate of evidence.in_scope) for(const b of gate.bosses){
 bosses++;
 assert(!seen.has(b.npc),'duplicate boss '+b.npc);seen.add(b.npc);
 const source=native.find(x=>x.id==='drop_'+b.npc+'_equip');
 assert(source,'source missing '+b.npc);
 assert.deepEqual(JSON.parse(JSON.stringify(source.outer)),b.outer);
 assert.deepEqual(JSON.parse(JSON.stringify(source.color)),b.color);
 assert.deepEqual(source.equip.ids,b.equip.ids);
 assert.deepEqual(source.weapon.ids,b.weapon.ids);
 assert.equal(source.outerSeed,b.outerSeed);
 assert.equal(source.colorSeed,b.colorSeed);
 assert.equal(source.outer.reduce((s,x)=>s+x[1],0),100);
 assert.equal(source.color.reduce((s,x)=>s+x[1],0),100);
 assert.equal(b.equip.max,b.equip.ids.length);
 assert.equal(b.weapon.max,b.weapon.ids.length);
 for(const d of b.special){
  special++;
  assert(source.orange.some(x=>x.id===d.id),'special source discrepancy '+d.id);
  const route=routes[d.flag];
  if(route){routeFound++;assert.equal(typeof route.run,'function');assert.equal(route.seed,b.outerSeed);}
 }
}
assert.equal(bosses,19);
assert.equal(special,15);
assert.equal(routeFound,15);
const missing=evidence.missing_proof;
assert(missing.some(s=>s.includes('10급')));
assert(missing.some(s=>s.includes('TDUP')));
console.log(JSON.stringify({status:'PASS',reference_bosses:bosses,special_flag_records:special,replayed_route_mappings:routeFound,original_native_verified:false,original_future_drop_verified:false}));
