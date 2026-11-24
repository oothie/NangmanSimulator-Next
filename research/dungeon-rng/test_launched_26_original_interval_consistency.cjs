'use strict';
/** Independent source 4-released-gate cross-check: bytecode insertion -> JS LuaJIT model -> weighted intervals -> original effects.
 * Does NOT assert game ARM64 `pairs()` observed. */
const fs=require('node:fs'); const assert=require('node:assert/strict');
const {SourceTable}=require('./luajit-beta3-hash-strict.cjs');
const {Table}=require('./luajit-beta3-hash.cjs');
const path=require('node:path');
const dir=process.env.DROP_SOURCE_DIR || __dirname;
const src=JSON.parse(fs.readFileSync(`${dir}/gate-60-source-registry.json`));
const intervals=JSON.parse(fs.readFileSync(`${dir}/ORIGINAL_30_BOSS_CONDITIONAL_INTERVALS.json`));
const lookup=new Map(intervals.bosses.map(b=>[[b.gate,b.mode,b.grantNpc].join('|'),b]));
function key(s){if(s.startsWith('n:')){const n=Number(s.slice(2));assert(Number.isSafeInteger(n));return n;} assert(s.startsWith('s:'));return s.slice(2)}
function lab(k){return (typeof k==='number'?'n:':'s:')+k}
let tables=0, intervalsCount=0, effects=0, expandedRolls=0, independentModels=0;
for(const b of src.consumers){
 if(!['연왕부','창옥','벽유교','유씨별원'].includes(b.gate))continue;
 const row=lookup.get([b.gate,b.mode,b.grantNpc].join('|'));assert(row,'missing boss '+b.grantNpc);
 assert.deepEqual(row.equipmentIds,b.equipmentIds);
 for(const t of b.tables){
  const interval=row[t.kind];assert(interval,'missing interval '+t.kind);
  const table=new SourceTable(1);table.put('key');for(const w of t.typedWrites)table.put(key(w.key));
  const order=table.order().filter(k=>k!=='key').map(lab);
  assert.deepEqual(order,t.modelPairsOrder,'JS/Python candidate order mismatch '+b.grantNpc);
  const legacy=new Table(1);legacy.insert('key');for(const w of t.typedWrites)legacy.insert(key(w.key));
  const independent=legacy.order().filter(k=>k!=='key').map(lab);
  assert.deepEqual(order,independent,'two independent JS table models disagree '+b.grantNpc);independentModels++;
  assert.equal(interval.verifiedTypedKeyOrder,true);assert.equal(interval.gameNativePairsObserved,false);
  assert.deepEqual(interval.intervals.map(v=>v.key),order,'interval order mismatch '+b.grantNpc);
  let cursor=1;
  for(const v of interval.intervals){
   const weight=Number(v.key.slice(2).trim());assert(Number.isInteger(weight)&&weight>0);
   assert.equal(v.weight,weight);assert.equal(v.from,cursor);assert.equal(v.to,cursor+weight-1);
   assert.deepEqual(v.effect,t.originalBytecodeBranchEffects[v.key],`original action mismatch ${b.grantNpc} ${v.key}`);
   for(let dice=v.from;dice<=v.to;dice++){
    const selected=interval.intervals.find(z=>dice>=z.from&&dice<=z.to);
    assert.equal(selected.key,v.key);
    expandedRolls++;
   }
   cursor=v.to+1;intervalsCount++;effects++;
  }
  assert.equal(interval.maxRoll,cursor-1);
  tables++;
 }
}
assert.equal(tables,26);assert.equal(independentModels,26);assert.equal(effects,79);assert.equal(expandedRolls,2610);assert.equal(lookup.size,30);
console.log(JSON.stringify({bosses:13,originalTypedTables:tables,independentOrderModelAgreements:independentModels,originalEffects:effects,weightedIntervals:intervalsCount,individualDicePositions:expandedRolls,independentFutureValidated:false,nativeGamePairsObserved:false}));