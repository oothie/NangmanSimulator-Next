/* Native yy-sim WASM: repeat bounded, source-verified next-conflict+exchange.
 * This is NOT automatic four-purple optimal Domakbeop; it follows only native
 * can_exchange events and retains one original-state rollback boundary. */
(function(root){
'use strict';
async function run({call,ensureSession=()=>{},steps=2,maxWashes=500,targetId=null}={}){
 if(typeof call!=='function'||typeof ensureSession!=='function')
  throw Error('원본 WASM 연결 상태가 없습니다');
 if(!Number.isInteger(steps)||steps<1||steps>4||
    !Number.isInteger(maxWashes)||maxWashes<1||maxWashes>1000)
  throw Error('자동 치환은 최대 4단계, 단계별 세수는 1~1000회입니다');
 if(targetId!=null&&(!Number.isInteger(targetId)||targetId<1))
  throw Error('원본 자맥 ID를 확인하세요');
 ensureSession();
 const initial=await call('state');
 ensureSession();
 if(!initial||!Number.isFinite(Number(initial.seed))||
    !Number.isInteger(Number(initial.role_id)))
  throw Error('원본 WASM 실행 전 상태를 확인할 수 없습니다');
 const actions=[];
 let totalWashes=0,exchanges=0,stop='limit';
 try{
  for(let index=0;index<steps;index++){
   ensureSession();
   const result=await call('until-exchange-and-replace',{
    count:maxWashes,talentId:targetId
   });
   ensureSession();
   if(!result?.state||!Array.isArray(result.results)||
     !Number.isInteger(result.performed)||result.performed<0||
     result.performed>maxWashes)
    throw Error('원본 WASM 자동 치환 계산 결과가 잘못되었습니다');
   if(result.autoExchanged===true&&(!result.found||result.exchange?.success!==true||
     result.conflict?.can_exchange!==true))
    throw Error('실제 치환 성공 상태와 충돌 판정이 일치하지 않습니다');
   if(result.found===true&&result.autoExchanged!==true)
    throw Error('원본 WASM이 치환 가능이라고 표시했으나 치환하지 못했습니다');
   actions.push({step:index+1,performed:result.performed,
     found:result.found===true,autoExchanged:result.autoExchanged===true,
     stopReason:result.stopReason,conflict:result.conflict,
     remainingPills:result.state.bag_pills??null,
     finalTalents:result.state.talents||[]});
   totalWashes+=result.performed;
   if(result.autoExchanged===true)exchanges++;
   if(!result.found){stop=result.stopReason||'not-found';break}
   if(index===steps-1)stop='completed';
  }
  ensureSession();
  const state=await call('state');
  ensureSession();
  if(!state||!Number.isFinite(Number(state.seed))||
     Number(state.role_id)!==Number(initial.role_id))
   throw Error('자동 치환 종료 상태를 확인할 수 없습니다');
  return {initial,state,actions,totalWashes,exchanges,requestedSteps:steps,
   stopReason:stop,changed:JSON.stringify(initial)!==JSON.stringify(state)};
 }catch(error){
  // If the session has changed, do not restore the old role over a newly
  // imported character. Its generation invalidator owns that transition.
  try{
   ensureSession();
   const restored=await call('set-state',initial);
   ensureSession();
   if(!restored||String(restored.seed)!==String(initial.seed)||
      String(restored.role_id)!==String(initial.role_id))
    throw Error('WASM 시작 시드·인물 ID가 복원되지 않았습니다');
  }catch(rollbackError){
   error.message+=' / 자동 치환 복구 확인 실패: '+String(rollbackError.message||rollbackError);
  }
  throw error;
 }
}
root.NangmanWashChain={run};
})(window);
