'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Table}=require('./luajit-beta3-hash.cjs');
function typedValue(s){
 if(s.startsWith('n:'))return Number(s.slice(2));
 if(s.startsWith('s:'))return s.slice(2);
 throw new TypeError('Missing type prefix: '+s);
}
function typedLabel(k){return (typeof k==='number'?'n:':'s:')+String(k)}
const f=path.join(__dirname,'NATIVE_16_TABLE_ORDER_MODELS_20261124.json');
const rows=JSON.parse(fs.readFileSync(f,'utf8')).rows;
assert.equal(rows.length,16);
for(const row of rows){
 const t=new Table(1);t.insert('key');
 for(const entry of row.source_insertion_order)t.insert(typedValue(entry));
 const actual=t.order().filter(k=>k!=='key').map(typedLabel);
 assert.deepEqual(actual,row.model_pairs_order,`${row.gate} ${row.path}`);
}
console.log('PASS 16/16 independent Python/JS source-grounded table candidate orders');
