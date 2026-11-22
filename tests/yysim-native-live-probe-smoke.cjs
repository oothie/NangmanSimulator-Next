'use strict';
// Static guardrail: public browser diagnosis must invoke the original native
// search only. It is not a new solver and must never claim a global optimum.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'tests/yysim-native-live-probe.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(x=>x[1]).filter(Boolean);
assert.equal(scripts.length,1,'One inline native probe expected');
new vm.Script(scripts[0],{filename:'native-live-probe.js'});
for(const src of ['../vendor/yysim/wasm_data.js','../vendor/yysim/core_glue.js',
 '../vendor/yysim/data.js','../engine/yysim-native-search-guard.js']){
 assert(html.includes(src),'Missing original WASM script '+src);
}
assert(html.includes('search:wasmSearchWashRoutes'),
 'Browser native diagnosis must run the original WASM search');
assert(html.includes('guard.statesEqual(stable,wasmGetState())'),
 'Native state must be checked after each diagnostic call');
assert(html.includes('ids:[271,268,272]'));
assert(html.includes('ids:[271,268,272,184]'));
assert(html.includes('final_slots'));
assert(html.includes("new Worker('../vendor/yysim/native-search-worker.js?rev=0.10.29')"),
 'Browser diagnosis should provide nonblocking original WASM Worker mode');
assert(html.includes('reply.stateUnchanged!==true'),
 'Worker must confirm state unchanged after native route query');
assert(html.includes("clearInterval(ticker)"),
 'Native diagnostic must clean up real elapsed-time ticker');
assert(html.includes('원본 WASM Worker 180초 응답 시간 초과'),
 'Worker deadline must be a reported execution error, not a missing route');

assert(!html.includes('globallyOptimal:true'),'Never claim original native proof of global optimality');
console.log('PASS: original WASM browser diagnostic source, syntax and final goals');
