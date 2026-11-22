/* Read-only boundary around the ORIGINAL yy-sim native search.
 * No path generation, grade extension or simulated locking happens here.
 * Native WASM state must survive both success and thrown native errors.
 */
(function(root){
'use strict';
// Rust's serde HashMap serialization can reorder object keys (especially
// global_vars) without changing any game data. JSON.stringify(a)===
// JSON.stringify(b) is not a valid state-equality test in that case.
// Preserve array/slot order, but normalize object key order recursively.
function canonicalJson(value){
 const normalize=input=>{
  if(Array.isArray(input))return input.map(normalize);
  if(input&&typeof input==='object'){
   const normalized={};
   for(const key of Object.keys(input).sort())normalized[key]=normalize(input[key]);
   return normalized;
  }
  return input;
 };
 return JSON.stringify(normalize(value));
}
function statesEqual(a,b){return canonicalJson(a)===canonicalJson(b)}
function run({getState,setState,search},request){
 if(typeof getState!=='function'||typeof setState!=='function'||
    typeof search!=='function')throw Error('원본 WASM 상태 보호 함수가 준비되지 않았습니다');
 const original=getState();
 if(!original||typeof original!=='object')
  throw Error('원본 자동 탐색 시작 상태를 확인할 수 없습니다');
 // Never retain an object that might share a reference with WASM's live state.
 const before=JSON.stringify(original);
 if(!before)throw Error('원본 세수 상태 직렬화에 실패했습니다');
 const saved=JSON.parse(before);
 const beforeIdentity=canonicalJson(saved);
 let result,searchError=null,after=null,stateError=null;
 try{result=search(request)}
 catch(error){searchError=error}
 try{after=canonicalJson(getState())}
 catch(error){stateError=error}
 if(after!==beforeIdentity){
  // An error is not proof that the native module stayed read-only.
  // Restore even when search() itself threw; do not expose partial results.
  try{
   const restored=setState(saved);
   const verified=canonicalJson(getState());
   if(restored===false||verified!==beforeIdentity)
    throw Error('복원 후 WASM 세수 상태가 원본과 일치하지 않습니다');
  }catch(error){
   throw Error('원본 WASM 자동 탐색 상태 복원 실패: '+
    String(error?.message||error));
  }
  if(searchError)
   throw Error('원본 WASM 검색 오류(상태 복구 완료): '+
    String(searchError?.message||searchError));
  throw Error('원본 WASM 자동 탐색 중 상태 변경 감지 · 복구 완료');
 }
 if(stateError)
  throw Error('원본 WASM 탐색 후 상태 조회 실패: '+String(stateError?.message||stateError));
 if(searchError)throw searchError;
 if(!result||typeof result!=='object'||!Array.isArray(result.routes))
  throw Error('원본 WASM 자동 경로 탐색 결과 형식을 확인할 수 없습니다');
 return result;
}
root.YYWashNativeSearchGuard={run,canonicalJson,statesEqual};
})(window);
