'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.resolve(__dirname,'../engine/yysim-native-search-guard.js'),'utf8');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(code,ctx);
const guard=ctx.window.YYWashNativeSearchGuard;
function fixture(search){
 const state={seed:12345,total_wash:3,global_vars:{foo:9},talents:[{id:271}]};
 const before=JSON.stringify(state);
 let restores=0;
 const api={getState:()=>state,
  setState:s=>{restores++;for(const k of Object.keys(state))delete state[k];
   Object.assign(state,JSON.parse(JSON.stringify(s)));},
  search:()=>search(state)};
 return {state,before,restores:()=>restores,api};
}
// Original native search omitted the implicit zero-wash opening needed
// before its first actual wash. 334 × 2 = 668 requires 2 slots (152)
// even if the save starts at 150 / 0 slots. Not character-specific.
for(const [nativeZ,expectedPrefix] of [[150,true],[151,true],[152,false]]){
 const save={zizhi:nativeZ,total_wash:0,total_pills:0,talents:[]};
 let actual={...save};
 const route={pills:2268,actions:[
  {kind:'lock',talent:'생기충만',wash_no:334,pills_after:668},
  {kind:'open_slot',wash_no:334,note:'开槽至 153（3 格）'},
  {kind:'open_slot',wash_no:334,note:'开槽至 154（4 格）'}
 ]};
 const out=guard.run({getState:()=>actual,
  setState:state=>{actual={...state};return true},
  search:()=>({routes:[route]})},{desired_ids:[271,272,249]});
 assert.equal(out.routes[0].pills,2268,'Native total cost unchanged');
 assert.equal(out.routes[0].actions.length,expectedPrefix?4:3);
 if(expectedPrefix){
  assert.equal(out.routes[0].actions[0].kind,'open_slot');
  assert.equal(out.routes[0].actions[0].wash_no,0);
  assert.match(out.routes[0].actions[0].note,/152/);
  assert.equal(out.routes[0].initial_open_slots,2);
 }else assert.equal(out.routes[0].actions[0].kind,'lock');
 assert.equal(guard.canonicalJson(actual),guard.canonicalJson(save),
  'Reconstruction must never mutate the source save');
}
for(const [firstCost,expected] of [[334,151],[1002,153],[1670,154]]){
 const out=guard.restoreImplicitInitialSlots({actions:[
  {kind:'lock',wash_no:334,pills_after:firstCost}
 ]},{zizhi:150,total_wash:0,total_pills:0});
 assert.match(out.actions[0].note,new RegExp(String(expected)));
}
assert.equal(guard.restoreImplicitInitialSlots({
 actions:[{kind:'lock',wash_no:334,pills_after:999}]
},{zizhi:150,total_wash:0}).actions.length,1,
 'Ambiguous native cost cannot invent an opening');

const good=fixture(()=>({routes:[{pills:7,final_slots:[{id:271}]}]}));
const result=guard.run(good.api,{desired_ids:[271]});
assert.equal(result.routes[0].pills,7);
assert.equal(JSON.stringify(good.state),good.before);
assert.equal(good.restores(),0,'read-only path must not reset live WASM');

// Rust serde may reorder HashMap fields without changing the state.
 // Key reordering inside global_vars, nested objects and slot metadata is
 // NOT a real mutation and must not trigger wasmSetState (which can fail).
const reordered=fixture(s=>{
 s.global_vars={foo:s.global_vars.foo};
 s.talents=s.talents.map(t=>({id:t.id}));
 return {routes:[{pills:1}]};
});
assert.equal(guard.run(reordered.api,{}).routes.length,1);
assert.equal(reordered.restores(),0,'equal state must not be restored');
const canonicalA={seed:99,global_vars:{a:1,b:{first:2,second:3}},
 talents:[{id:184,locked:false},{id:271,locked:true}]};
const canonicalB={talents:[{locked:false,id:184},{locked:true,id:271}],
 global_vars:{b:{second:3,first:2},a:1},seed:99};
assert.equal(guard.canonicalJson(canonicalA),guard.canonicalJson(canonicalB));
// Native JSON may carry arbitrary global variable names. Canonicalization
// must not silently discard keys such as __proto__.
const exceptional=JSON.parse('{"global_vars":{"__proto__":19,"constructor":2}}');
const exceptionalChanged=JSON.parse('{"global_vars":{"constructor":2,"__proto__":20}}');
assert(!guard.statesEqual(exceptional,exceptionalChanged),
 'special native JSON keys must still participate in state comparison');

assert(guard.statesEqual(canonicalA,canonicalB));
assert(!guard.statesEqual(canonicalA,{...canonicalB,seed:100}),
 'actual seed changes must never be ignored');
assert(!guard.statesEqual(canonicalA,{...canonicalB,
 talents:[...canonicalB.talents].reverse()}),
 'slot array order is semantically important and must not be normalized');

const changed=fixture(s=>{s.global_vars.foo=11;return {routes:[]}});
assert.throws(()=>guard.run(changed.api,{}),/상태 변경 감지 · 복구 완료/);
assert.equal(JSON.stringify(changed.state),changed.before);
assert.equal(changed.restores(),1);

const throwsAndChanges=fixture(s=>{s.global_vars.foo=13;throw Error('native trap')});
assert.throws(()=>guard.run(throwsAndChanges.api,{}),/검색 오류\(상태 복구 완료\).*native trap/);
assert.equal(JSON.stringify(throwsAndChanges.state),throwsAndChanges.before);
assert.equal(throwsAndChanges.restores(),1,
 'native exception must restore state before bubbling error');

const errorsWithoutChange=fixture(()=>{throw Error('unsupported talent')});
assert.throws(()=>guard.run(errorsWithoutChange.api,{}),/unsupported talent/);
assert.equal(errorsWithoutChange.restores(),0);

const brokenRestore=fixture(s=>{s.seed=0;return {routes:[]}});
brokenRestore.api.setState=()=>false;
assert.throws(()=>guard.run(brokenRestore.api,{}),/상태 복원 실패/);
assert.equal(brokenRestore.state.seed,0,'must not report success after failed restore');

const malformed=fixture(()=>({routes:null}));
assert.throws(()=>guard.run(malformed.api,{}),/결과 형식/);
assert.equal(JSON.stringify(malformed.state),malformed.before);
const host=fs.readFileSync(path.resolve(__dirname,'../vendor/yysim/engine-host.html'),'utf8');
assert(host.includes('yysim-native-search-guard.js'));
assert(host.includes('guard.run({getState:wasmGetState,setState:wasmSetState'));

// Prevent regressions where the original host compares Rust HashMap JSON
// field order directly and falsely reports global_vars state corruption.
assert(!host.includes('JSON.stringify(before)!==JSON.stringify(after)'),
 'Original WASM host contains an order-sensitive state comparison');
assert(host.includes('YYWashNativeSearchGuard.statesEqual(before,after)'),
 'Original WASM native constraints/exchange reads must use semantic state equality');
const nodeHarness=fs.readFileSync(
 path.resolve(__dirname,'../tests/yysim-native-headless-grade.cjs'),'utf8');
assert(nodeHarness.includes("name:'three-purple-plus-green'"),
 'Headless original WASM probe lost the 3 purple + 1 green regression');

console.log('PASS: original WASM search keeps state unchanged or restores it even after native exceptions');
