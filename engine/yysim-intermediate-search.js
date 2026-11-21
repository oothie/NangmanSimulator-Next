/* Original yy-sim WASM final-slot multi-color goal search.
 * Search each acquisition order with a genuinely new native engine instance.
 * Goals must coexist in the FINAL slots; merely seen-and-lost talents never
 * count. Every candidate's cost comes from real wasmDoWash calls.
 * Cheapest candidate is only minimum of explored native orders, not a proof
 * of global minimum over exchanges, arbitrary unlocks and all opening plans.
 */
(function(root){
'use strict';
const copy=value=>JSON.parse(JSON.stringify(value));
const own=(state,id)=>Array.isArray(state?.talents)&&state.talents.some(t=>Number(t.id)===id);
const finalMatches=(state,ids)=>ids.every(id=>own(state,id));
// Native WASM global_vars is a hash map; after re-instantiation the same
// values can serialize in a different property order. Object order is NOT
// part of RNG state. Compare keys/values recursively without discarding any.
const normalize=value=>{
 if(Array.isArray(value))return value.map(normalize);
 if(value!==null&&typeof value==='object')
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])]));
 return value;
};
const equals=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
const countLocked=state=>(state?.talents||[]).filter(t=>t.locked===true).length;
const permute=ids=>ids.length<2?[ids.slice()]:ids.flatMap((v,i)=>permute(ids.filter((_,j)=>j!==i)).map(t=>[v,...t]));
function subsets(initial){
 const all=initial?.talents||[],unlocked=all.map((t,i)=>t.locked?null:i).filter(v=>v!==null);
 const results=[];
 for(let mask=0;mask<(1<<unlocked.length);mask++){
  const ids=unlocked.filter((_,i)=>mask&(1<<i));
  if(ids.length+countLocked(initial)<4)results.push(ids);
 }
 return results;
}
function costOf(initial,final){
 const total=Number(final.total_pills)-Number(initial.total_pills);
 const fromBag=Number(initial.bag_pills)-Number(final.bag_pills);
 if(Number.isFinite(total)&&total>=0&&(total>0||!Number.isFinite(fromBag)))return total;
 return Number.isFinite(fromBag)&&fromBag>=0?fromBag:total;
}
async function run({ids,horizon=900,topN=8,getState,setState,doWash,
 getConflicts=null,doExchange=null,qualityFor=()=>0,
 freshBranch=null,isolated=false,yieldControl=async()=>{}}){
 if(!Array.isArray(ids)||ids.length<1||ids.length>4||new Set(ids).size!==ids.length||
    ids.some(id=>!Number.isSafeInteger(id)||id<=0))
  throw Error('자동탐색 목표는 서로 다른 녹맥·파맥·자맥 1~4개여야 합니다');
 if(!Number.isInteger(horizon)||horizon<1||horizon>5000)throw Error('탐색 범위는 1~5000회입니다');
 if(!Number.isInteger(topN)||topN<1||topN>20)throw Error('결과 개수는 1~20개입니다');
 const initial=getState();
 if(!initial||!Array.isArray(initial.talents))throw Error('WASM 세수 원본 상태를 불러올 수 없습니다');
 const orders=permute(ids),routes=[],warnings=[];
 // Native exchange may change the luck pool and purple RNG sequence. Compare
 // both no-exchange and verified exchange variants on independent WASM copies.
 const policies=typeof getConflicts==='function'&&typeof doExchange==='function'?
  ['none','unwanted','all']:['none'];
 const plans=policies.flatMap(policy=>orders.map(order=>({order,policy})));
 let scanned=0,executed=0,early=0,partial=false;
 const restore=()=>{
  if(!setState(initial)||!equals(getState(),initial))throw Error('WASM 별도 탐색 상태 초기화 불일치');
 };
 const warning=msg=>{if(warnings.length<8&&!warnings.includes(msg))warnings.push(msg)};
 try{
  for(let branch=0;branch<plans.length;branch++){
   if(branch){
    if(typeof freshBranch==='function'){
     let loaded;
     try{loaded=await freshBranch(initial)}catch(error){
      warning('새 WASM 분기 생성 오류: '+String(error?.message||error));partial=true;break;
     }
     if(!equals(loaded,initial)){
      const changed=Object.keys(initial).filter(k=>!equals(initial[k],loaded?.[k]));
      warning('WASM 새 분기 상태 불일치: '+changed.slice(0,6).join(', '));partial=true;break;
     }
    }else restore();
   }
   scanned++;
   const {order,policy}=plans[branch],actions=[];
   let exchanges=0;
   const hasOtherLocks=initial.talents.some(t=>t.locked&&!ids.includes(Number(t.id)));
   const requiredSlots=Math.min(4,Math.max(ids.length+Number(hasOtherLocks),
     countLocked(initial)+ids.filter(id=>!initial.talents.some(t=>t.locked&&Number(t.id)===id)).length));
   let state=getState(),zizhi=Number(state.zizhi);
   if(!Number.isInteger(zizhi)||zizhi<150||zizhi>154){
    warning('원본 자질 정보가 올바르지 않아 탐색하지 못했습니다');partial=true;break;
   }
   if(requiredSlots>4||countLocked(initial)+ids.filter(id=>!initial.talents.some(t=>t.locked&&Number(t.id)===id)).length>4){
    warning('기존 잠금과 목표를 모두 보유할 슬롯이 부족합니다');continue;
   }
   while(zizhi-150<requiredSlots){
    if(zizhi>=154)break;
    const next={...state,zizhi:zizhi+1,
      str_gift:Number(state.str_gift||0)+100,con_gift:Number(state.con_gift||0)+100};
    if(!setState(next))throw Error('원본 WASM 가상 재능 슬롯 개방 실패');
    state=getState();zizhi=Number(state?.zizhi);
    if(zizhi!==Number(next.zizhi))throw Error('가상 자질 개방 검증 실패');
    actions.push({kind:'open_slot',note:'가상 자질 '+zizhi+' ('+(zizhi-150)+'칸)',wash_no:0});
   }
   let washes=0,found=finalMatches(state,ids),blocked=false;
   // Only the next desired goal in this acquisition order is pinned.
   // This is deliberate: the exact last goal must be in the live final
   // slots, not a transient talent that disappeared earlier.
   let index=0;
   while(!found&&!blocked&&washes<=horizon){
    state=getState();
    if(finalMatches(state,ids)){found=true;break;}
    while(index<order.length-1&&own(state,order[index])){
     const slot=state.talents.findIndex(t=>Number(t.id)===order[index]);
     if(slot<0)break;
     if(!state.talents[slot].locked){
      if(countLocked(state)>=3){blocked=true;break;}
      const next={...state,talents:state.talents.map((t,i)=>i===slot?{...t,locked:true}:{...t})};
      if(!setState(next))throw Error('원본 WASM 재능 잠금 실패');
      const confirmed=getState();
      if(!confirmed?.talents?.[slot]?.locked)throw Error('원본 WASM 재능 잠금 검증 실패');
      state=confirmed;
      actions.push({kind:'lock',talent:order[index],wash_no:washes});
     }
     index++;
    }
    if(blocked||washes>=horizon)break;
    const before=getState(),result=doWash(),after=getState();
    if(result?.error||!after||!Array.isArray(after.talents)||equals(before,after)){
     warning('세수 결과가 없는 분기: 순서 '+(branch+1)+' · '+washes+'회');
     break;
    }
    washes++;executed++;
    if(finalMatches(after,ids)){found=true;break;}
    if(policy!=='none'&&after.talents.some(t=>Number(qualityFor(Number(t.id)))===4&&!t.locked)){
     // Exchange only genuine WASM-conflict-qualified purple slots, and never
     // assume a predicted purple outcome. Record the native observed target.
     // Limit repeated same-wash exchanges to avoid cycling indefinitely.
     const seen=new Set();
     for(let turn=0;turn<3;turn++){
      const candidateState=getState();
      if(finalMatches(candidateState,ids)){found=true;break}
      const candidates=getConflicts();
      if(!Array.isArray(candidates))break;
      const candidate=candidates.find(row=>{
       const i=Number(row?.index),talent=candidateState.talents[i];
       return row?.can_exchange===true&&Number.isInteger(i)&&i>=0&&i<4&&
        talent&&!talent.locked&&Number(qualityFor(Number(talent.id)))===4&&
        (policy==='all'||!ids.includes(Number(talent.id)))&&
        !seen.has(i+':'+talent.id);
      });
      if(!candidate)break;
      const index=Number(candidate.index),beforeExchange=getState();
      seen.add(index+':'+beforeExchange.talents[index].id);
      const result=doExchange(index);
      const afterExchange=getState();
      if(!result?.success||!afterExchange?.talents||
       equals(afterExchange,beforeExchange)){
       // A denied native exchange cannot be treated as a valid route.
       if(!equals(afterExchange,beforeExchange))
        throw Error('WASM 치환 거절 후 상태 변경: 분기 '+(branch+1));
       break;
      }
      exchanges++;
      const from=Number(beforeExchange.talents[index]?.id);
      const incoming=afterExchange.talents.map(t=>Number(t.id));
      const nextId=incoming.find(id=>!beforeExchange.talents.some(t=>Number(t.id)===id));
      // When a native exchange shifts multiple slots, track observed delta
      // and restrict replay to unambiguous one-to-one final transitions.
      if(!Number.isInteger(nextId)){
       warning('치환 결과가 단일 재능으로 확인되지 않아 경로를 건너뜁니다');
       blocked=true;break;
      }
      actions.push({kind:'exchange',talent:nextId,from,to:nextId,
       wash_no:washes,note:'실제 WASM 충돌 치환 · 슬롯 '+(index+1)});
      if(finalMatches(afterExchange,ids)){found=true;break}
     }
    }
    if(blocked)break;
    if(washes%50===0)await yieldControl();
    if(finalMatches(getState(),ids)){found=true;break;}
    // Only mark goals that continue to exist at the end. Past encounters
    // never satisfy the final combination.
   }
   if(found){
    const final=getState(),pills=costOf(initial,final);
    if(!Number.isFinite(pills)||pills<0)throw Error('WASM 최종 세수단 소모를 확인할 수 없습니다');
    // Insert wash commands between locks in chronological action order.
    // The raw loop stores locks with their exact wash index.
    const steps=[],lockActions=actions;
    let lastWash=0;
    for(const act of lockActions){
     if(act.wash_no>lastWash){steps.push({kind:'wash_to',wash_no:act.wash_no});lastWash=act.wash_no}
     steps.push(act);
    }
    if(washes>lastWash)steps.push({kind:'wash_to',wash_no:washes});
    if(washes<horizon)early++;
    routes.push({order_ids:order,pad:0,pills,washes,exchanges,
     final_slots:copy(final.talents),actions:steps,
     intermediate_goals:false,optimal:false,
     source:'wasm_native_final_slots',lock_order:order.slice(),
     exchange_policy:policy});
   }
   await yieldControl();
  }
 }finally{
  if(!isolated){
   try{restore()}catch(error){warning('탐색 원본 복원 오류: '+String(error.message||error));partial=true}
  }
 }
 routes.sort((a,b)=>a.pills-b.pills||a.washes-b.washes||a.actions.length-b.actions.length);
 return {routes:routes.slice(0,topN),scanned,trajectories:plans.length,
  washesExecuted:executed,stoppedEarly:early,partial,
  error:routes.length?null:'탐색한 모든 획득 순서에서 목표 맥이 최종 슬롯에 함께 남는 경로를 찾지 못했습니다',
  warnings};
}
root.YYWashIntermediateSearch={run,subsets,permute,finalMatches};
})(window);
