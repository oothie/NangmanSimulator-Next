/* yy-sim native intermediate-talent search.
 * Samples genuine wasmDoWash() states. Goals may be encountered at different
 * washes; no requirement that all persist in the final talent slots.
 * Evaluates the baseline and every legal lock subset of starting slots.
 * Cheapest route is only optimal among these evaluated native trajectories.
 */
(function(root){
'use strict';
const own=(s,id)=>Array.isArray(s?.talents)&&s.talents.some(t=>Number(t.id)===id);
const snapshot=s=>JSON.stringify(s);
const subsets=(initial)=>{
 const existing=initial.talents||[];
 const unlocked=existing.map((t,i)=>t.locked?null:i).filter(i=>i!==null);
 const locked=existing.length-unlocked.length;
 const result=[];
 for(let bits=0;bits<(1<<unlocked.length);bits++){
  const indices=unlocked.filter((_,i)=>bits&(1<<i));
  if(indices.length+locked<=3)result.push(indices);
 }
 return result.sort((a,b)=>a.length-b.length);
};
async function run({ids,horizon=3000,topN=12,getState,setState,doWash,yieldControl=async()=>{}}){
 if(!Array.isArray(ids)||!ids.length||ids.length>4||new Set(ids).size!==ids.length||
  ids.some(id=>!Number.isInteger(id)))throw Error('목표 재능은 서로 다른 ID 1~4개여야 합니다');
 if(!Number.isInteger(horizon)||horizon<1||horizon>5000)throw Error('탐색 범위는 1~5000회입니다');
 if(!Number.isInteger(topN)||topN<1||topN>20)throw Error('결과 개수는 1~20개입니다');
 const initial=getState();
 if(!initial||!Array.isArray(initial.talents))throw Error('WASM 세수 원본 상태가 없습니다');
 const initialText=snapshot(initial),routes=[],warnings=[];
 const masks=subsets(initial);
 let scanned=0,executed=0,stoppedEarly=0,rollbackFailure=null;
 // Native set_state may normalize save-specific fields. Validate all engine
 // state keys after restoring; if a copy cannot be restored, STOP exploring
 // that WASM instance rather than continuing with a contaminated trajectory.
 const restore=()=>{
  if(!setState(initial)){
   rollbackFailure='원본 WASM이 상태 복원 요청을 거절했습니다';
   return false;
  }
  const restored=getState();
  if(snapshot(restored)!==initialText){
   const keys=[...new Set([...Object.keys(initial),...Object.keys(restored||{})])];
   const diffs=keys.filter(k=>snapshot(initial[k])!==snapshot(restored?.[k]));
   rollbackFailure='원본 WASM 복원값 불일치 ('+(diffs.slice(0,6).join(', ')||'상태 구조')+')';
   return false;
  }
  return true;
 };
 try{
  for(const [branch,indices] of masks.entries()){
   // The original snapshot is already in memory for the first trajectory;
   // avoid an unnecessary, possibly lossy set_state roundtrip here.
   if(branch>0&&!restore()){
    if(warnings.length<8)warnings.push(rollbackFailure);
    break;
   }
   const start=getState(),next={...start,talents:start.talents.map(t=>({...t}))};
   for(const i of indices)next.talents[i].locked=true;
   if(indices.length){
    if(!setState(next))throw Error('WASM 탐색 잠금 설정 실패');
    const confirmed=getState();
    if(indices.some(i=>confirmed.talents[i]?.locked!==true))
     throw Error('WASM 탐색 잠금 상태가 일치하지 않습니다');
   }
   const found=new Set(ids.filter(id=>own(getState(),id)));
   const acquired=ids.filter(id=>found.has(id)).map(id=>({id,wash_no:0}));
   const actions=indices.map(i=>({kind:'lock',talent:next.talents[i].id,
    wash_no:0,note:'초기 재능 슬롯 잠금'}));
   let washes=0;
   while(found.size<ids.length&&washes<horizon){
    const before=getState(),result=doWash(),after=getState();
    if(result?.error||!after||!Array.isArray(after.talents)||
      snapshot(before)===snapshot(after)){
     if(warnings.length<8)warnings.push('원본 세수 진행 불가: 잠금 '+indices.length+'칸, '+washes+'회차');
     break;
    }
    washes++;executed++;
    for(const id of ids)if(!found.has(id)&&own(after,id)){
     found.add(id);acquired.push({id,wash_no:washes});
    }
    if(washes%50===0)await yieldControl();
   }
   scanned++;
   if(found.size===ids.length){
    const final=getState();
    const initialCost=initial.has_bag_pills===true?Number(initial.bag_pills):Number(initial.total_pills);
    const finalCost=initial.has_bag_pills===true?Number(final.bag_pills):Number(final.total_pills);
    const pills=initial.has_bag_pills===true?initialCost-finalCost:finalCost-initialCost;
    if(!Number.isFinite(pills)||pills<0)throw Error('WASM 세수단 소비 기록이 올바르지 않습니다');
    if(washes)actions.push({kind:'wash_to',wash_no:washes,
     note:'중간 맥 포함 실제 WASM 세수 회차'});
    if(washes<horizon)stoppedEarly++;
    routes.push({order_ids:acquired.map(x=>x.id),reached_ids:[...found],
     acquired_events:acquired,pad:0,pills,washes,exchanges:0,
     final_slots:final.talents,actions,intermediate_goals:true,optimal:false,
     source:'wasm_native_intermediate_trace',lock_indices:indices});
   }
   await yieldControl();
  }
 }finally{
  // Searches run in a separate disposable WASM engine. Restoration is still
  // checked for diagnostics, but a non-roundtrippable save must not discard
  // verified results from earlier branches or damage the user's live engine.
  if(!restore()&&warnings.length<8)warnings.push(rollbackFailure);
 }
 routes.sort((a,b)=>a.pills-b.pills||a.washes-b.washes||a.lock_indices.length-b.lock_indices.length);
 return {routes:routes.slice(0,topN),scanned,
  trajectories:masks.length,washesExecuted:executed,stoppedEarly,
  partial:!!rollbackFailure,
  error:routes.length?null:(rollbackFailure?
   '원본 WASM의 상태 복원값이 달라 이후 잠금 분기를 안전하게 검사하지 않았습니다: '+rollbackFailure:
   '탐색한 잠금 조합과 세수 범위에서 목표 맥의 중간 획득 경로를 찾지 못했습니다'),
  warnings};
}
root.YYWashIntermediateSearch={run,subsets};
})(window);
