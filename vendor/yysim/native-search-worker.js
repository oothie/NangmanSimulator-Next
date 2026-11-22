/* Experimental original yy-sim WASM native route worker.
 * DIAGNOSTIC ONLY. The live UI remains on the proven original iframe path
 * until the browser comparison verifies byte-for-byte native routes and
 * preservation of original WASM state. No JS alternative search is used.
 */
'use strict';
self.window=self;
importScripts('./wasm_data.js?rev=0.10.29','./core_glue.js?rev=0.10.29',
 './data.js?rev=0.10.29','../../engine/yysim-native-search-guard.js?rev=0.10.29');
let nativeReady=null;
async function ensureReady(){
 if(!nativeReady){
  nativeReady=(async()=>{
   if(!(await initWasm()))throw Error('원본 WASM Worker 초기화 실패');
   if(!wasmInitEngine(TALENT_DATA,ZZ_DATA))
    throw Error('원본 WASM Worker 재능 데이터 초기화 실패');
  })();
 }
 try{return await nativeReady}
 catch(error){nativeReady=null;throw error}
}
self.addEventListener('message',async event=>{
 const {kind,requestId,state,request}=event.data||{};
 if(kind!=='yy-native-search-probe'||!Number.isSafeInteger(requestId))return;
 try{
  await ensureReady();
  if(!state||typeof state!=='object')throw Error('Worker에 전달된 세수 상태가 없습니다');
  // A separate WASM instance gets a copy. Never send game saves, secrets or
  // raw data elsewhere; this is an entirely local Worker.
  if(!wasmSetState(state))throw Error('Worker 원본 세수 상태 설정 실패');
  const normalized=self.YYWashNativeSearchGuard.canonicalJson(wasmGetState());
  if(normalized!==self.YYWashNativeSearchGuard.canonicalJson(state))
   throw Error('Worker 세수 상태 불일치: 입력 상태를 정확히 이식할 수 없습니다');
  const result=self.YYWashNativeSearchGuard.run({
   getState:wasmGetState,setState:wasmSetState,
   search:wasmSearchWashRoutes
  },request);
  self.postMessage({kind:'yy-native-search-probe-result',requestId,ok:true,
   result,stateUnchanged:self.YYWashNativeSearchGuard.canonicalJson(wasmGetState())===normalized});
 }catch(error){
  self.postMessage({kind:'yy-native-search-probe-result',requestId,ok:false,
   error:String(error?.message||error)});
 }
});
