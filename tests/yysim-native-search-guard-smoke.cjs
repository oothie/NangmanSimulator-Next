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
const good=fixture(()=>({routes:[{pills:7,final_slots:[{id:271}]}]}));
const result=guard.run(good.api,{desired_ids:[271]});
assert.equal(result.routes[0].pills,7);
assert.equal(JSON.stringify(good.state),good.before);
assert.equal(good.restores(),0,'read-only path must not reset live WASM');

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
console.log('PASS: original WASM search keeps state unchanged or restores it even after native exceptions');
