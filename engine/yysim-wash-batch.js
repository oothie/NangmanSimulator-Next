/* Original yy-sim custom continuous wash: 1..1000 operations.
 * Calls only real WASM wash in bounded 100-event chunks; all-or-nothing
 * rollback for unexpected failures, while preserving native partial results
 * when the game has insufficient pills.
 */
(function(root){
'use strict';
async function run({call,count,ensureSession=()=>{},initial}={}){
 if(typeof call!=='function'||!Number.isInteger(count)||count<1||count>1000)
  throw Error('지정 세수는 원본과 같이 1~1000회 정수만 가능합니다');
 ensureSession();
 const before=initial||await call('state');
 if(!before||!Array.isArray(before.talents))
  throw Error('연속 세수 전 WASM 상태가 올바르지 않습니다');
 const results=[];let performed=0;
 try{
  while(performed<count){
   ensureSession();
   const chunk=Math.min(100,count-performed);
   const reply=await call('wash',{count:chunk});
   ensureSession();
   const n=Number(reply?.performed);
   if(!reply?.state||!Number.isInteger(n)||n<0||n>chunk||
      !Array.isArray(reply.results)||reply.results.length!==n)
    throw Error('원본 WASM 연속 세수 응답의 횟수 또는 기록이 일치하지 않습니다');
   results.push(...reply.results);
   performed+=n;
   if(n<chunk)break; // native partial because a normal limit was reached
  }
  const state=await call('state');
  ensureSession();
  if(!state||!Array.isArray(state.talents))
   throw Error('원본 연속 세수 후 WASM 상태 검증 실패');
  return {state,results,performed,requested:count,partial:performed<count,
   chunks:Math.ceil(performed/100),nativeFunction:'wasmDoWash/wasmWashMulti'};
 }catch(error){
  try{
   ensureSession();
   const restored=await call('set-state',before);
   if(JSON.stringify(restored)!==JSON.stringify(before))
    throw Error('WASM 세수 원상 복구 비교 실패');
  }catch(rollbackError){
   error.message+=' / 원상 복구 문제: '+String(rollbackError.message||rollbackError);
  }
  throw error;
 }
}
root.YYWashBatch={run};
})(window);
