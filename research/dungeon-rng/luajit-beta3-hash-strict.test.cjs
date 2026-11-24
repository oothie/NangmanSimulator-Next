'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SourceTable,selectWeighted}=require('./luajit-beta3-hash-strict.cjs');
const typed=s=>s.startsWith('n:')?Number(s.slice(2)):s.slice(2);
const label=k=>(typeof k==='number'?'n:':'s:')+k;
const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'NATIVE_16_TABLE_ORDER_MODELS_20261124.json'),'utf8')).rows;
assert.equal(rows.length,16);
for(const row of rows){
 const t=new SourceTable(1);t.put('key');row.source_insertion_order.forEach(s=>t.put(typed(s)));
 assert.deepEqual(t.order().filter(x=>x!=='key').map(label),row.model_pairs_order,row.gate+' '+row.path);
}
const fixtures=[
 {keys:[1,2,3,4,5],asize:5,order:[1,2,3,4,'key',5]},
 {keys:[1,2,3,4,5,6,7,8],asize:9,order:[1,2,3,4,5,6,7,8,'key']},
 {keys:[50,30,15,5],asize:0,order:[30,5,50,15,'key']},
 {keys:[201,'200  ','200   ','200    ','200     '],asize:0,order:['200    ','200     ',201,'200  ','key','200   ']}
];
for(const f of fixtures){
 const t=new SourceTable(1);t.put('key');f.keys.forEach(k=>t.put(k));
 assert.equal(t.asize,f.asize);assert.deepEqual(t.order(),f.order);
}
assert.equal(selectWeighted([[201,201],['200  ',200],['200   ',200],['200    ',200],['200     ',200]],820).key,'200   ');
assert.throws(()=>selectWeighted([[50,50],['50 ',50]],101),/roll/);
console.log('PASS: 16 original source tables, 4 numeric-array/hash fixtures, weighted interval');
