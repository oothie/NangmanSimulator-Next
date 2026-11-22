/* Bounded native WASM branch search for mixed three-purple + green/blue goals.
 * Unlike the native purple-only search, this never treats a missing color as
 * satisfied. It works exclusively on disposable WASM state snapshots.
 * Does not claim an exhaustive global minimum.
 */
(function(root){
'use strict';
const deepClone=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>Array.isArray(x)?x.map(canonical):
 x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const sameState=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
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
 // Exact canonical native state: RNG metadata outside the old hand-picked
 // fields must not be accidentally merged with another live search branch.
 return JSON.stringify(canonical(s));
}
function selectBeam(pool,ids,base,beamWidth){
 const buckets=new Map(),used=new Set();
 for(const node of pool){
  const key=idsIn(node.state,ids).sort((a,b)=>a-b).join(',');
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(node);
 }
 const diverse=[],representatives=[];
 // De-duplicate BEFORE applying the per-goal-mask quota, and preserve one
 // representative for every attained-goal mask before filling the beam.
 for(const rows of buckets.values()){
  rows.sort((a,b)=>rank(b.state,ids,base)-rank(a.state,ids,base));
  const unique=[];
  for(const n of rows){
   const key=signature(n.state);
   if(used.has(key))continue;
   used.add(key);unique.push(n);
  }
  if(unique.length){
   representatives.push(unique[0]);
   diverse.push(...unique.slice(1,Math.max(2,Math.floor(beamWidth/6))));
  }
 }
 const score=(a,b)=>rank(b.state,ids,base)-rank(a.state,ids,base);
 representatives.sort(score);diverse.sort(score);
 const selected=representatives.slice(0,beamWidth);
 const chosen=new Set(selected.map(n=>signature(n.state)));
 for(const n of diverse){
  if(selected.length>=beamWidth)break;
  const key=signature(n.state);
  if(!chosen.has(key)){chosen.add(key);selected.push(n)}
 }
 return selected.sort(score);
}
async function run({ids,horizon,topN,getState,setState,doWash,getConflicts,
 doExchange,freshBranch,qualityFor,yieldControl=async()=>{},onProgress=()=>{},
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
 // The original native yy-sim route search opens missing slots virtually.
 // Preserve its rule in this isolated fallback; never deduct game materials.
 let prepared=getState(),aptitude=Number(prepared.zizhi);
 const prepareActions=[];
 if(!Number.isInteger(aptitude)||aptitude<150||aptitude>154)
  throw Error('원본 WASM 자질 정보를 확인할 수 없습니다');
 const required=Math.min(4,Math.max(ids.length,initialLock+ids.filter(id=>
  !prepared.talents.some(t=>t.locked&&Number(t.id)===id)).length));
 while(aptitude-150<required){
  if(aptitude>=154)throw Error('목표 맥을 보유할 재능 슬롯이 부족합니다');
  const next={...prepared,zizhi:aptitude+1,
   str_gift:Number(prepared.str_gift||0)+100,
   con_gift:Number(prepared.con_gift||0)+100};
  if(!setState(next))throw Error('가상 자질 개방 WASM 적용 실패');
  prepared=getState();
  if(Number(prepared.zizhi)!==aptitude+1)throw Error('가상 자질 개방 WASM 검증 실패');
  aptitude++;
  prepareActions.push({kind:'open_slot',note:'가상 자질 '+aptitude+' ('+(aptitude-150)+'칸)',wash_no:0});
 }
 let current=[{state:deepClone(prepared),actions:prepareActions,washes:0,exchanges:0}];
 const completed=[],warnings=[];
 let visited=0,expanded=0,stopReason=null,maxGoals=idsIn(original,ids).length,
  maxGoalsAt=0,maxActive=1,exchangeSuccesses=0,possibleConflicts=0,exchangeAttempts=0,exchangeErrors={},temporaryBranches=0,probeSlots=[];
 for(let washNo=1;washNo<=horizon;washNo++){
  const pool=[];
  for(const node of current){
   // Re-entering WASM through set_state on EVERY single wash erases
   // transient native exchange context. Keep the live instance untouched
   // while following the same branch and restore only when switching.
   if(!sameState(getState(),node.state)&&!setState(node.state)){
    stopReason='WASM 분기 상태 적용 실패';break
   }
   let previous=getState(),branchActions=node.actions,temporary=node.temporary||null;
   if(!previous||previous.talents.length!==node.state.talents.length){
    stopReason='WASM 분기 재진입 검증 실패';break
   }
   // A lower-grade "car" is sometimes locked temporarily in original
   // yy-sim before a purple arrives. Release it before it blocks a third
   // target or after a bounded hold period.
   if(temporary&&(washNo-temporary.since>=30||idsIn(previous,ids).length>=2)){
    const at=previous.talents.findIndex(t=>t.locked&&Number(t.id)===temporary.id);
    if(at>=0){
     const copy=deepClone(previous);copy.talents[at].locked=false;
     if(!setState(copy))throw Error('임시 잠금 해제 WASM 적용 실패');
     previous=getState();
     branchActions=actionsUntil(branchActions,washNo-1).concat({
      kind:'unlock',talent:temporary.id,wash_no:washNo-1,
      note:'원본 임시 충돌맥 잠금 해제'});
    }
    temporary=null;
   }
   const wash=doWash(),after=getState();
   visited++;
   if(wash?.error||!after||!after.talents||Number(after.total_wash)===Number(previous.total_wash)){
    if(warnings.length<5)warnings.push('원본 WASM 세수 진행 불가: '+washNo+'회');
    continue;
   }
   const variants=[{state:after,actions:branchActions,exchanges:node.exchanges,temporary}];
   if(after.talents.some(t=>!t.locked&&Number(qualityFor(Number(t.id)))===4)){
    const conflicts=getConflicts();
    if(Array.isArray(conflicts)){
     const possible=conflicts.filter(c=>c?.can_exchange===true&&
      Number.isInteger(Number(c.index))&&after.talents[Number(c.index)]&&
      !after.talents[Number(c.index)].locked&&
      !ids.includes(Number(after.talents[Number(c.index)].id)));
     possibleConflicts+=possible.length;
     for(const conflict of possible.slice(0,2)){
      const slot=Number(conflict.index);
      if(!sameState(getState(),after)&&!setState(after))continue;
      const beforeX=getState();
      const exchange=doExchange(slot),afterX=getState();
      exchangeAttempts++;
      if(!exchange?.success||!afterX?.talents){
       const key=String(exchange?.error||'결과 없음').slice(0,80);
       exchangeErrors[key]=(exchangeErrors[key]||0)+1;
       continue;
      }
      const from=Number(beforeX.talents[slot].id);
      const diff=afterX.talents.map(t=>Number(t.id)).filter(id=>
       !beforeX.talents.some(p=>Number(p.id)===id));
      if(diff.length!==1)continue;
      exchangeSuccesses++;
      variants.push({state:afterX,exchanges:node.exchanges+1,temporary,
       actions:actionsUntil(branchActions,washNo).concat({
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
    if(washNo===4&&!probeSlots.length)probeSlots=[{step:washNo,goals:idsIn(variant.state,ids),locked:locked(variant.state),talents:variant.state.talents.map(t=>[t.id,t.locked,qualityFor(Number(t.id))])}];
    if(!sameState(getState(),variant.state)&&!setState(variant.state))continue;
    let forLock=getState(),nextActions=variant.actions,nextTemp=variant.temporary;
    if(nextTemp&&idsIn(forLock,ids).length>=2){
     const at=forLock.talents.findIndex(t=>t.locked&&Number(t.id)===nextTemp.id);
     if(at>=0){
      const changed=deepClone(forLock);changed.talents[at].locked=false;
      if(!setState(changed))throw Error('목표 잠금 전 임시 잠금 해제 실패');
      forLock=getState();
      nextActions=actionsUntil(nextActions,washNo).concat({
       kind:'unlock',talent:nextTemp.id,wash_no:washNo});
     }
     nextTemp=null;
    }
    const saved=lockGoals(forLock,ids,setState,getState,nextActions,washNo);
    pool.push({state:deepClone(saved.state),actions:saved.actions,
     washes:washNo,exchanges:variant.exchanges,temporary:nextTemp});
    // Branch on holding an earlier lower-grade car (non-target) so the
    // next same-type purple may be exchangeable. Keep this temporary and
    // verifiable; never force-lock all remaining slots.
    if(!nextTemp&&washNo%10===4&&idsIn(saved.state,ids).length<=1&&locked(saved.state)<3){
     const tickets=saved.state.talents.map((t,i)=>({t,i})).filter(({t,i})=>
      i<3&&!t.locked&&!ids.includes(Number(t.id))&&
      [1,2,3].includes(Number(qualityFor(Number(t.id)))));
     if(washNo===4)probeSlots=saved.state.talents.map((t,i)=>[i,t.id,qualityFor(Number(t.id)),t.locked]);
     for(const {t,i} of tickets.slice(0,2)){
      const holding=deepClone(saved.state);holding.talents[i].locked=true;
      if(!setState(holding))continue;
      const actual=getState();
      if(!actual?.talents[i]?.locked)continue;
      temporaryBranches++;
      pool.push({state:deepClone(actual),actions:actionsUntil(saved.actions,washNo).concat({
       kind:'lock',talent:Number(t.id),wash_no:washNo,
       note:'원본 임시 하위맥 잠금·치환 분기'}),
       washes:washNo,exchanges:variant.exchanges,
       temporary:{id:Number(t.id),since:washNo}});
     }
    }
   }
   expanded++;
  }
  if(stopReason)break;
  if(!pool.length)break;
  // Maintain several RNG trajectories per held-goal mask. Otherwise an
  // early single-purple goal would evict all luck-pool exchange alternatives.
  current=selectBeam(pool,ids,original,beamWidth);
  maxActive=Math.max(maxActive,current.length);
  if(washNo%25===0||completed.length){
   onProgress({stage:'WASM 치환·임시 잠금 확장 탐색',phase:'exchange',
    completed:washNo,total:horizon,percentage:Math.min(99,Math.round(100*washNo/horizon)),
    wash:washNo,horizon,checked:visited,found:completed.length,
    bestPills:completed.length?Math.min(...completed.map(x=>x.pills)):null,
    maxGoals,goalCount:ids.length,exchangeSuccesses,active:current.length});
  }
  if(washNo%25===0)await yieldControl();
 }
 completed.sort((a,b)=>a.pills-b.pills||a.washes-b.washes||a.exchanges-b.exchanges);
 return {routes:completed.slice(0,topN),scanned:expanded,trajectories:visited,
  partial:!!stopReason,beamWidth,washesExecuted:visited,
  maxGoals,maxGoalsAt,maxActive,exchangeSuccesses,possibleConflicts,exchangeAttempts,exchangeErrors,temporaryBranches,probeSlots,
  warnings:stopReason?[stopReason,...warnings]:warnings,
  error:completed.length?null:'WASM 치환 분기를 포함한 제한 탐색에서 목표 4맥을 최종 슬롯에 모두 보유한 경로가 발견되지 않았습니다'};
}
root.YYWashExchangeBeamSearch={run,selectBeam};
})(window);
