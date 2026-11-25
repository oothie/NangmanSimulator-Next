#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {sensitivity}=require('./gate_order_sensitivity.cjs');
const {atRoll}=require('./audit_40_table_equipment_effects.cjs');
const s=sensitivity();
assert.equal(s.tableCount,40);
assert.equal(s.staticTableCount,38);
assert.equal(s.dynamicTableCount,2);
assert.equal(s.modeledRolls,3800);
assert.equal(s.gates.length,6);
assert.equal(s.differentiatingRolls+s.stableEffectRolls,3800);
assert.equal(s.stableEffectRolls,1240);
assert.equal(s.futureItemColorPredictionVerified,false);
assert.equal(s.containsPrivateData,false);
for(const t of s.tables){
 if(t.dynamic){
  assert.equal(t.totalRolls,null);
  assert.deepEqual(t.decisiveIntervals,[]);
  continue;
 }
 let num=0;
 for(const x of t.decisiveIntervals){
  assert(x.start<=x.end && x.start>=1 && x.end<=100);
  for(let roll=x.start;roll<=x.end;roll++){
   const out=atRoll(t.gate,t.path,roll);
   assert.equal(out.allModelEffectAgreement,false);
   assert.deepEqual(x.effects,out.effects);
   num++;
  }
 }
 assert.equal(num,t.discriminatingRolls);
 assert.equal(t.stableEffectRolls+t.discriminatingRolls,100);
}
console.log('PASS all 40 low-gate table sensitivity rows; 38 static exhaustive effects and 2 dynamic censored');
