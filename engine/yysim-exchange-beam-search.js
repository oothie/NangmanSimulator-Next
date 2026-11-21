/* Bounded native WASM branch search for mixed three-purple + green/blue goals.
 * Unlike the native purple-only search, this never treats a missing color as
 * satisfied. It works exclusively on disposable WASM state snapshots.
 * Does not claim an exhaustive global minimum.
 */
(function(root){
'use strict';
const deepClone=x=>JSON.parse(JSON.stringify(x));
const has=(s,id)=>s?.talents?.some(t=>Number(t.id)===id);
const idsIn=(s,ids)=>ids.filter(id=>has(s,id));
const locked=s=>(s?.talents||[]).filter(t=>t.locked).length;
const cost=(a,b)=>Number(b.total_pills)-Number(a.total_pills);
const actionsUntil=(actions,wash)=>{
 const out=actions.slice();
 const last=out.reduce((n,a)=>Math.max(n,Number(a.wash_no)||0),0);
 if(last<wash)out.push({kind:'wash_to',wash_no:wash});
 return out;
};
function lockGoals(state,goals,wasmSet,wasmGet,actions,washNo){
 const all=state.talents.map(t=>({...t}));
 if(goals.every(id=>has(state,id)))return {state,actions};
 let lockCount=locked(state);
 const newActions=[];
 for(const [index,slot] of all.entries()){
  if(goals.includes(Number(slot.id))&&!slot.locked&&lockCount<3){
   slot.locked=true;lockCount++;
   newActions.push({kind:'lock',talent:Number(slot.id),wash_no:washNo});
  }
 }
 if(!newActions.length)return {state,actions};
 const next={...state,talents:all};
 if(!wasmSet(next))throw Error('탐색 목표 잠금 WASM 거부');
 const read=wasmGet();
 if(!read||newActions.some(a=>!read.talents.find(t=>Number(t.id)===a.talent)?.locked))
  throw Error('탐색 목표 잠금 WASM 결과 검증 실패');
 return {state:read,actions:actionsUntil(actions,washNo).concat(newActions)};
}
function rank(state,ids,base){
 const matched=idsIn(state,ids);
 const costValue=cost(base,state);
 return matched.length*100000-(Number.isFinite(costValue)?costValue:999999)
   -(state.exchange_count||0)*6-(locked(state)-matched.length)*100;
}
function signature(s){
 return [s.seed,s.luck_seed,s.luck_seed_inited,s.tal_lucky,s.pity_count,s.exchange_count,
  s.talents.map(t=>t.id+(t.locked?'L':'')).join(':'),
  JSON.stringify(s.global_vars||{})].join('|');
}
async function run({ids,horizon,topN,getState,setState,doWash,getConflicts,
 doExchange,freshBranch,qualityFor,yieldControl=async()=>{},
 beamWidth=24}){
 if(typeof getConflicts!=='function'||typeof doExchange!=='function')
  throw Error('WASM 치환 탐색 함수가 없습니다');
 if(!Array.isArray(ids)||ids.length<3||ids.length>4)
  throw Error('혼합 자맥 치환 탐색 대상은 3~4개입니다');
 const original=getState();
 if(!original?.talents)throw Error('WASM 출발 상태가 없습니다');
 const verified=typeof freshBranch==='function'?await freshBranch(original):original;
 if(!verified?.talents||verified.talents.length!==original.talents.length)
  throw Error('WASM 분기 초기 상태를 검증하지 못했습니다');
 const initialLock=locked(original);
 if(initialLock>=4)return {routes:[],scanned:0,error:'잠금 슬롯이 가득 찼습니다'};
 const matched=idsIn(original,ids);
 let current=[{state:deepClone(original),actions:[],washes:0,exchanges:0}];
 const completed=[],warnings=[];
 let visited=0,expanded=0,stopReason=null,maxGoals=idsIn(original,ids).length,
  maxGoalsAt=0,maxActive=1,exchangeSuccesses=0;
 for(let washNo=1;washNo<=horizon;washNo++){
  const pool=[];
  for(const node of current){
   if(!setState(node.state)){stopReason='WASM 분기 상태 적용 실패';break}
   const previous=getState();
   if(!previous||previous.talents.length!==node.state.talents.length){
    stopReason='WASM 분기 재진입 검증 실패';break
   }
   const wash=doWash(),after=getState();
   visited++;
   if(wash?.error||!after||!after.talents||Number(after.total_wash)===Number(previous.total_wash)){
    if(warnings.length<5)warnings.push('원본 WASM 세수 진행 불가: '+washNo+'회');
    continue;
   }
   const variants=[{state:after,actions:node.actions,exchanges:node.exchanges}];
   if(after.talents.some(t=>!t.locked&&Number(qualityFor(Number(t.id)))===4)){
    const conflicts=getConflicts();
    if(Array.isArray(conflicts)){
     const possible=conflicts.filter(c=>c?.can_exchange===true&&
      Number.isInteger(Number(c.index))&&after.talents[Number(c.index)]&&
      !after.talents[Number(c.index)].locked&&
      !ids.includes(Number(after.talents[Number(c.index)].id)));
     for(const conflict of possible.slice(0,2)){
      const slot=Number(conflict.index);
      if(!setState(after))continue;
      const beforeX=getState();
      const exchange=doExchange(slot),afterX=getState();
      if(!exchange?.success||!afterX?.talents)continue;
      const from=Number(beforeX.talents[slot].id);
      const diff=afterX.talents.map(t=>Number(t.id)).filter(id=>
       !beforeX.talents.some(p=>Number(p.id)===id));
      if(diff.length!==1)continue;
      exchangeSuccesses++;
      variants.push({state:afterX,exchanges:node.exchanges+1,
       actions:actionsUntil(node.actions,washNo).concat({
        kind:'exchange',from,to:diff[0],talent:diff[0],
        wash_no:washNo,note:'원본 WASM 치환 분기'
       })});
     }
    }
   }
   for(const variant of variants){
    const have=idsIn(variant.state,ids).length;
    if(have>maxGoals){maxGoals=have;maxGoalsAt=washNo}
    if(ids.every(id=>has(variant.state,id))){
     const amount=cost(original,variant.state);
     if(Number.isFinite(amount)&&amount>=0){
      completed.push({order_ids:ids,pad:0,pills:amount,washes:washNo,
       exchanges:variant.exchanges,final_slots:deepClone(variant.state.talents),
       actions:actionsUntil(variant.actions,washNo),optimal:false,
       intermediate_goals:false,source:'wasm_native_exchange_beam'});
     }
     continue;
    }
    if(washNo===horizon)continue;
    if(!setState(variant.state))continue;
    const saved=lockGoals(getState(),ids,setState,getState,
     variant.actions,washNo);
    pool.push({state:deepClone(saved.state),actions:saved.actions,
     washes:washNo,exchanges:variant.exchanges});
   }
   expanded++;
  }
  if(stopReason)break;
  if(!pool.length)break;
  // Maintain several RNG trajectories per held-goal mask. Otherwise an
  // early single-purple goal would evict all luck-pool exchange alternatives.
  const buckets=new Map();
  const used=new Set();
  for(const node of pool){
   const key=idsIn(node.state,ids).sort((a,b)=>a-b).join(',');
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(node);
  }
  const diverse=[];
  for(const rows of buckets.values()){
   rows.sort((a,b)=>rank(b.state,ids,original)-rank(a.state,ids,original));
   for(const n of rows.slice(0,Math.max(2,Math.floor(beamWidth/6)))){
    const id=signature(n.state);
    if(!used.has(id)){used.add(id);diverse.push(n)}
   }
  }
  diverse.sort((a,b)=>rank(b.state,ids,original)-rank(a.state,ids,original));
  current=diverse.slice(0,beamWidth);maxActive=Math.max(maxActive,current.length);
  if(washNo%40===0)await yieldControl();
 }
 completed.sort((a,b)=>a.pills-b.pills||a.washes-b.washes||a.exchanges-b.exchanges);
 return {routes:completed.slice(0,topN),scanned:expanded,trajectories:visited,
  partial:!!stopReason,beamWidth,washesExecuted:visited,
  maxGoals,maxGoalsAt,maxActive,exchangeSuccesses,
  warnings:stopReason?[stopReason,...warnings]:warnings,
  error:completed.length?null:'WASM 치환 분기를 포함한 제한 탐색에서 목표 4맥을 최종 슬롯에 모두 보유한 경로가 발견되지 않았습니다'};
}
root.YYWashExchangeBeamSearch={run};
})(window);
