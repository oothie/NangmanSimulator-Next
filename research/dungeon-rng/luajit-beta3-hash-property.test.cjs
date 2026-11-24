'use strict';
// Deterministic 300-case Python SourceTable reference fingerprint; no user saves or real RNG seeds.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {SourceTable}=require('./luajit-beta3-hash-strict.cjs');
const pool=[...Array.from({length:50},(_,i)=>i-5),201,301,302,303,304,200,
 '200  ','200   ','50 ','40 ','key2','num1','A','B','1','5','301','200','a a'];
let state=1299709;
function next(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state}
const lines=[];
for(let i=0;i<300;i++){
 const n=1+next()%20,keys=[],seen=new Set();
 while(keys.length<n){
  const k=pool[next()%pool.length],tag=(typeof k==='number'?'n:':'s:')+k;
  if(!seen.has(tag)){keys.push(k);seen.add(tag)}
 }
 const t=new SourceTable(1);t.put('key');keys.forEach(k=>t.put(k));
 lines.push(i+'|'+t.asize+'|'+t.resizes.length+'|'+t.order().map(k=>(typeof k==='number'?'n:':'s:')+k).join(','));
}
const actual=crypto.createHash('sha256').update(lines.join('\n')+'\n').digest('hex');
assert.equal(actual,'b57d3e3cc46936dc3c420e80138aaf22ef6797be1e62eb3872ba610e5a355724');
console.log('PASS 300/300 cross-language seeded fixtures');
