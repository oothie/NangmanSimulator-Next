'use strict';
/** Consequence of naively using source literal insertion order for 4 released gates.
 * Candidate runtime order is the independently cross-checked JS/Python LuaJIT beta3
 * model; this is NOT an observation of ARM64 game runtime `pairs` order.
 */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const dir=process.env.DROP_SOURCE_DIR || __dirname;
const reg=JSON.parse(fs.readFileSync(path.join(dir,'gate-60-source-registry.json'),'utf8'));
const intervals=JSON.parse(fs.readFileSync(path.join(dir,'ORIGINAL_30_BOSS_CONDITIONAL_INTERVALS.json'),'utf8'));
const byBoss=new Map(intervals.bosses.map(x=>[[x.gate,x.mode,x.grantNpc].join('|'),x]));
const released=new Set(['연왕부','창옥','벽유교','유씨별원']);
const tally={bosses:new Set(),equip:{tables:0,inputPositions:0,different:0},color:{tables:0,inputPositions:0,different:0}};
function selected(keys,dice){for(const k of keys){dice-=Number(k.slice(2).trim());if(dice<=0)return k;}throw new Error('roll exceeds sum')}
for(const b of reg.consumers){
 if(!released.has(b.gate))continue;
 tally.bosses.add(b.gate+'|'+b.grantNpc);
 const row=byBoss.get([b.gate,b.mode,b.grantNpc].join('|'));assert(row);
 for(const t of b.tables){
  assert(t.kind==='equip'||t.kind==='color');
  const insertion=t.typedWrites.map(w=>w.key),model=t.modelPairsOrder;
  const sum=insertion.reduce((n,k)=>n+Number(k.slice(2).trim()),0);
  assert.equal(sum,row[t.kind].maxRoll);
  const v=tally[t.kind];v.tables++;v.inputPositions+=sum;
  for(let dice=1;dice<=sum;dice++){
   const a=selected(insertion,dice),c=selected(model,dice);
   const interval=row[t.kind].intervals.find(i=>i.from<=dice&&dice<=i.to);
   assert.equal(interval.key,c,'interval must agree with candidate model '+b.grantNpc);
   if(a!==c)v.different++;
  }
 }
}
const output={bosses:tally.bosses.size,weightTables:tally.equip.tables+tally.color.tables,
 equip:tally.equip,color:tally.color,
 totalPositions:tally.equip.inputPositions+tally.color.inputPositions,
 differentPositions:tally.equip.different+tally.color.different,
 gameNativePairsObserved:false,independentFutureValidated:false};
assert.equal(output.bosses,13);assert.equal(output.weightTables,26);
assert.deepEqual([output.totalPositions,output.differentPositions],[2610,2262]);
console.log(JSON.stringify(output,null,2));