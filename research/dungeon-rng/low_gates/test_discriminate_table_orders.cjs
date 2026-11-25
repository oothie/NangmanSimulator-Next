'use strict';
const assert=require('node:assert/strict');
const {discriminate,informativeIntervals,MODELS}=require('./discriminate_table_orders.cjs');
const gate='천일교',path='3/5/2';
assert.deepEqual(MODELS,['first','last','absent']);
const intervals=informativeIntervals(gate,path);
assert.equal(intervals.dynamic,false);
assert.equal(intervals.intervals[0].start,1);
assert.equal(intervals.intervals.at(-1).end,100);
assert(intervals.discriminatingRollCount>0);
for(let roll=1;roll<=100;roll++){
 const candidates=intervals.intervals.filter(i=>i.start<=roll&&i.end>=roll);
 assert.equal(candidates.length,1);
}
const first=discriminate([{gate,path,roll:1,effect:'color:2'}]);
assert.deepEqual(first.remainingModels,['first']);
assert.equal(first.nativePairsVerified,false);
assert.equal(first.exactFutureEquipmentPredictionAllowed,false);
const absent=discriminate([{gate,path,roll:1,effect:'color:4'},
 {gate,path,roll:6,effect:'color:3'}]);
assert.deepEqual(absent.remainingModels,['absent']);
const impossible=discriminate([{gate,path,roll:1,effect:'no-drop'}]);
assert.equal(impossible.internallyConsistent,false);
const contradiction=discriminate([{gate,path,roll:1,effect:'color:2'},
 {gate,path,roll:1,effect:'color:4'}]);
assert.equal(contradiction.internallyConsistent,false);
assert.throws(()=>discriminate([{gate:'취선채',path:'3/11/2/imp_no/2/2',roll:1,effect:'equipment'}]),/Dynamic/);
assert.throws(()=>discriminate([{gate,path,roll:101,effect:'color:2'}]),/1..100/);
assert.deepEqual(discriminate([]).remainingModels,MODELS);
assert.equal(informativeIntervals('취선채','3/11/2/imp_no/2/2').dynamic,true);
assert(!JSON.stringify(first).includes('OnlyID'));
console.log('PASS weighted table intervals, observational elimination and native evidence guards');
