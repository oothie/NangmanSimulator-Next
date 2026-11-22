'use strict';
// Save-based native WASM diagnosis must never fall back to a fabricated seed
// or hand-picked fixed target. This test does not claim mixed WASM correctness.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'tests/yysim-native-live-probe.html'),'utf8');
const source=fs.readFileSync(path.join(root,'tests/yysim-native-save-probe.js'),'utf8');
const mapping=fs.readFileSync(path.join(root,'engine/yysim-save-state.js'),'utf8');
new vm.Script(source,{filename:'yysim-native-save-probe.js'});
new vm.Script(mapping,{filename:'yysim-save-state.js'});
for(const script of ['../vendor/yysim/wasm_data.js','../vendor/yysim/core_glue.js',
 '../vendor/yysim/data.js','../engine/yysim-native-search-guard.js',
 '../engine/yysim-target-catalog.js','../engine/yysim-save-state.js',
 './yysim-native-save-probe.js']){
 assert(html.includes(script),'Missing source '+script);
}
for(const id of ['file','role','previewLimit','scan','preview','conflicts','filter',
 'goals','run','output','useWorker']){
 assert(html.includes('id="'+id+'"'),'Missing real-save native UI: '+id);
}
assert(source.includes('source.build(save,selectedRole,wasmGetState())'),
 'Selected role must be loaded through original save-state builder');
assert(source.includes('wasmPreviewSequence(count)'),
 'Raw purple sequence must come from original WASM');
assert(source.includes('earlier_conflict_name'),
 'Exchange references must come from original WASM preview');
assert(source.includes('search:wasmSearchWashRoutes'),
 'Selected goals must call original native WASM, never local solver');
assert(source.includes('final_slots'),
 'Native route must be verified against final talents');
assert(source.includes('new Worker('),
 'Real-time diagnostic must offer isolated native WASM Worker');
assert(!source.includes('447882174'),
 'Previous fabricated seed is forbidden in real character diagnosis');
assert(!source.includes('ids:[271,268,272]'),
 'Previous fixed purple targets must not be the new diagnostic controls');
assert(!html.includes('globallyOptimal:true'));
console.log('PASS: original WASM save/role, raw sequence/conflicts, selectable goals, real final slots');
