#!/usr/bin/env node
'use strict';
/* Source-table contract audit. All values describe generic game weight tables.
 * This is NOT an observation of native LuaJIT pairs() execution or a save fixture.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const unwrap=s=>s.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
const native=JSON.parse(read('research/dungeon-lab/source-26-tables.json'));
assert.equal(native.nativePairsIndependentlyVerified,false);
const yan=new Function(unwrap(read('engine/dungeon-replay-yan.js'))+
 ';return {EQUIP,GRADE_ORDER,KING_GRADE};')();
const dcy=new Function(unwrap(read('engine/dungeon-replay-dcy.js'))+
 ';return {POOLS,COLOR};')();
const byj=new Function(unwrap(read('engine/dungeon-replay-byj.js'))+
 ';return {POOLS,COLOR};')();
const liu=new Function(unwrap(read('engine/dungeon-replay-liu.js'))+
 ';return {POOLS,Y_COLOR,OTHER_COLOR};')();
const yBoss={33654:'이총관',33653:'하상',33652:'엽내관',33650:'연왕'};
const lBoss={35260:'윤무',35264:'고리',35268:'이뢰운'};
const eTargets={
 33654:[[50,'equipment'],[50,'miss']],
 33653:[[50,'equipment'],[50,'miss']],
 33652:[[50,'equipment'],[10,'miss'],[40,'miss']],
 33650:[[50,'equipment'],[50,'miss']]
};
function expected(npc){
 if(npc in yBoss)return {items:yan.EQUIP[yBoss[npc]],maxSlot:yan.EQUIP[yBoss[npc]].length,
  equipment:eTargets[npc],color:npc===33650?yan.KING_GRADE:yan.GRADE_ORDER};
 if(npc in dcy.POOLS)return {items:dcy.POOLS[npc],maxSlot:5,
  equipment:[[50,'equipment'],[50,'miss']],color:dcy.COLOR};
 if(npc in byj.POOLS)return {items:byj.POOLS[npc],maxSlot:4,
  equipment:[[50,'equipment'],[50,'miss']],color:byj.COLOR};
 if(npc in lBoss)return {items:liu.POOLS[lBoss[npc]],maxSlot:liu.POOLS[lBoss[npc]].length,
  equipment:[[50,'equipment'],[50,'miss']],
  color:npc===35260?liu.Y_COLOR:liu.OTHER_COLOR};
 throw Error('Unknown released boss '+npc);
}
function choose(entries,dice){
 for(const [weight,output] of entries){
  dice-=weight;
  if(dice<=0)return output;
 }
 throw Error('Exhausted weighted table');
}
let tables=0,positions=0;
const bosses=new Set();
for(const row of native.records){
 assert(!bosses.has(row.npc),'duplicate source NPC');bosses.add(row.npc);
 const model=expected(row.npc);
 assert.deepEqual(model.items,row.items,'equipment pool mismatch '+row.npc);
 assert.equal(model.maxSlot,row.maxSlot,'slot roll maximum mismatch '+row.npc);
 assert.deepEqual(model.equipment,row.equipment,'equipment table order '+row.npc);
 assert.deepEqual(model.color,row.color,'color table order '+row.npc);
 for(const kind of ['equipment','color']){
  const expectedEntries=model[kind],sourceEntries=row[kind];
  const total=sourceEntries.reduce((sum,entry)=>sum+entry[0],0);
  assert(total>0);
  for(let roll=1;roll<=total;roll++)
   assert.equal(choose(expectedEntries,roll),choose(sourceEntries,roll),
    'RNG roll '+roll+' mismatched in '+row.gate+' NPC '+row.npc+' '+kind);
  positions+=total;tables++;
 }
}
assert.equal(bosses.size,13);
assert.equal(tables,26);
assert.equal(positions,2610);
assert.equal(native.records.find(x=>x.npc===35221).maxSlot,4,
 'Byeokyu Immortal nine-item array must not override four-slot RNG');
console.log('PASS: 13 source boss pools, 26 weighted tables, 2610 integer rolls, conditional slot cap');
