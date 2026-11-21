// Actual yy-sim WASM conflict response: slot references and accessible purple IDs.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine','wash-conflict-model.js'),'utf8'),ctx);
const API=ctx.window.NangmanWashConflicts;
const data={available:[268,186,249,172,250,248,271,272,261,262,263],
 conflicts:[{index:0,earlier_index:1,earlier_name:'玄阳神脉',can_exchange:true},
 {index:1,earlier_index:0,earlier_name:'九阴鬼脉',can_exchange:false},
 {index:2,earlier_index:0,earlier_name:'九阴鬼脉',can_exchange:true},null]};
const talents=[{id:248,locked:true},{id:249,locked:false},{id:250,locked:false},{id:271,locked:false}];
const before=JSON.stringify(data);
const result=API.summarize(data,talents,[248,249,250,261,276],id=>'한글'+id);
assert.equal(result.sourceAvailableCount,11);
assert.equal(result.purple.filter(x=>x.available).length,4);
assert.equal(result.conflicts.length,4);
assert.equal(result.conflicts[0].slot,1);
assert.equal(result.conflicts[0].earlierSlot,2);
assert.equal(result.conflicts[0].earlierId,249);
assert.equal(result.conflicts[0].canExchange,true);
assert.equal(result.conflicts[1].canExchange,false);
assert.equal(result.conflicts[3].known,false);
assert.equal(JSON.stringify(data),before,'read-only native source object must remain unchanged');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('./engine/wash-conflict-model.js'));
assert(html.includes('NangmanWashConflicts.summarize('));
assert(html.includes("const checks=await washEngine.call('talent-constraints')"),'native conflict data auto-load');
assert(html.includes("}catch(checkError){state.constraintsError="),'extra inspection cannot invalidate imported save');
console.log('PASS: native wash conflicts automatically grouped into Korean per-slot view');
