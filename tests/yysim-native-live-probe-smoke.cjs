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
assert(!html.includes('globallyOptimal:true'),'Never claim original native proof of global optimality');
console.log('PASS: original WASM browser diagnostic source, syntax and final goals');
