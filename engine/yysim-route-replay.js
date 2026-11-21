/* Conservative yy-sim native search route replay. No simulated RNG guesses.
 * Operates only on a copied WASM state and rolls back all steps on failure.
 * Original simulator aptitude upgrades are replayed in WASM; physical game resource consumption is not simulated.
 */
(function(root){
'use strict';
const integer=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))?Number(v):null;
function plan(route,nameIds={}){
 if(!route?.complete||!route.executable||!Array.isArray(route.actions))
  throw Error('목표가 완성되고 원본 단계가 제공된 경로만 모의 실행할 수 있습니다');
 const ids=route.goalIds||[],actions=route.actions;
 if(!actions.length){
  if(route.estimatedWashes===0&&route.exchanges===0&&route.estimatedPills===0&&route.pad===0)return [];
  throw Error('실행 단계가 누락되어 경로를 재생할 수 없습니다');
 }
 const allowed=new Set(['lock','unlock','wash_to','exchange','keep','skip','open_slot']);
 const planned=[];
 let washes=0,exchanges=0;
 for(const [i,action] of actions.entries()){
  const kind=String(action?.kind||'');
  if(!allowed.has(kind))
   throw Error('원본 경로 단계 '+(i+1)+' ('+(kind||'알 수 없음')+')은 아직 재생할 수 없습니다');
  const resolve=(name)=>{
   if(name==null||name==='')return null;
   const id=integer(nameIds[String(name)]);
   if(id===null||id<1)throw Error('원본 재능 이름과 ID 매핑이 없어 경로를 안전하게 실행할 수 없습니다: '+String(name));
   return id;
  };
  if(kind==='open_slot'){
   const note=String(action.note||'');
   const found=note.match(/15[1-4]/);
   if(!found)throw Error('원본 슬롯 개방 자질 조건을 확인할 수 없습니다');
   planned.push({kind,requiredSlots:Number(found[0])-150});
  }else if(kind==='lock'||kind==='unlock'){
   const id=resolve(action.talent);
   if(id===null)throw Error('잠금·해제의 원본 재능 이름이 없습니다');
   planned.push({kind,id});
  }else if(kind==='wash_to'){
   const target=integer(action.wash_no);
   if(target===null||target<washes||target>5000)
    throw Error('원본 세수 회차가 역행하거나 범위를 벗어났습니다');
   planned.push({kind,count:target-washes,target});
   washes=target;
  }else if(kind==='exchange'){
   if(Array.isArray(action.chain)&&action.chain.length>1)
    throw Error('연쇄 치환의 분기 조건은 아직 1:1 재생되지 않습니다');
   exchanges++;
   const from=resolve(action.from),to=resolve(action.to||action.talent);
   if(from===null||to===null)throw Error('원본 치환 전후 재능을 확인할 수 없습니다');
   planned.push({kind,from,to});
  }else planned.push({kind});
 }
 if(integer(route.estimatedWashes)!==washes)
  throw Error('원본 경로의 총 세수 횟수와 단계별 세수 횟수가 다릅니다');
 if(integer(route.exchanges)!==exchanges)
  throw Error('원본 경로의 총 치환 횟수와 실행 단계가 일치하지 않습니다');
 return planned;
}
async function run({route,nameIds,call,ensureSession=()=>{}}={}){
 if(typeof call!=='function')throw Error('WASM 호출이 없습니다');
 const steps=plan(route,nameIds);
 ensureSession();
 const original=await call('state');
 if(!original||!Array.isArray(original.talents))
  throw Error('실행 전 WASM 상태가 올바르지 않습니다');
 let applied=0;
 const audit=[];
 try{
  for(const [index,step] of steps.entries()){
   ensureSession();
   const state=await call('state');
   if(!state||!Array.isArray(state.talents))throw Error('현재 재능 슬롯을 읽을 수 없습니다');
   if(step.kind==='open_slot'){
    // The original yy-sim upgradeZiZhi changes aptitude and two gift fields.
    // It is a virtual upgrade, not an assertion of consumable materials.
    const requiredZizhi=150+step.requiredSlots;
    let currentZizhi=integer(state.zizhi);
    if(currentZizhi===null||currentZizhi<150||currentZizhi>154)
     throw Error('현재 원본 WASM 자질을 확인할 수 없습니다');
    while(currentZizhi<requiredZizhi){
     const result=await call('upgrade-zizhi');
     ensureSession();
     if(!result?.state||result.source!=='original-upgradeZiZhi'||
        result.inventoryDeducted!==false||
        integer(result.state.zizhi)!==currentZizhi+1)
      throw Error('원본 yy-sim 자질 개방 단계가 재현되지 않았습니다');
     currentZizhi++;
    }
   }else if(step.kind==='lock'||step.kind==='unlock'){
    const at=state.talents.findIndex(t=>Number(t.id)===step.id);
    if(at<0)throw Error('경로 재능이 현재 슬롯에 없습니다');
    const want=step.kind==='lock';
    if(!!state.talents[at].locked!==want){
     const response=await call('toggle-lock',{index:at});
     if(response?.state?.talents?.[at]?.locked!==want)
      throw Error('원본 WASM 잠금 결과가 경로와 다릅니다');
    }
   }else if(step.kind==='wash_to'){
    let remaining=step.count;
    while(remaining>0){
     const count=Math.min(100,remaining);
     const response=await call('wash',{count});
     if(response?.performed!==count||!response?.state)
      throw Error('세수단 부족 또는 원본 실행 회차 불일치');
     remaining-=count;
     ensureSession();
    }
   }else if(step.kind==='exchange'){
    const conflicts=await call('talent-constraints');
    const candidates=Array.isArray(conflicts?.conflicts)?conflicts.conflicts:[];
    const eligible=candidates.filter(row=>row?.can_exchange===true&&
      Number.isInteger(Number(row.index))&&state.talents[Number(row.index)]?.id===step.from);
    if(eligible.length!==1)throw Error('현재 원본 충돌과 치환 재능이 일대일 대응하지 않습니다');
    const at=eligible[0];
    if(!at)throw Error('원본 경로의 치환 가능 슬롯이 현재 WASM 충돌과 다릅니다');
    const response=await call('exchange-matched',{index:Number(at.index)});
    if(!response?.result?.success||!response?.state?.talents?.some(t=>Number(t.id)===step.to))
     throw Error('원본 치환 결과에서 예상 재능을 확인하지 못했습니다');
   }
   const after=await call('state');
   if(!after||!Array.isArray(after.talents))
    throw Error('원본 경로 실행 이후 WASM 상태 검증 실패');
   audit.push({index:index+1,kind:step.kind,
    luckInitializedBefore:state.luck_seed_inited===true,
    luckInitializedAfter:after.luck_seed_inited===true,
    exchangeDelta:Number(after.exchange_count||0)-Number(state.exchange_count||0),
    bagPillsBefore:state.has_bag_pills===true?Number(state.bag_pills):null,
    bagPillsAfter:after.has_bag_pills===true?Number(after.bag_pills):null});
   applied=index+1;
  }
  const state=await call('state');
  const missing=(route.goalIds||[]).filter(id=>!state?.talents?.some(t=>Number(t.id)===Number(id)));
  const finalSlots=Array.isArray(route.finalSlots)?route.finalSlots:[];
  if(finalSlots.length&&
    (finalSlots.length!==state?.talents?.length||
     finalSlots.some((slot,index)=>Number(slot.id)!==Number(state.talents[index]?.id)||
      (!!slot.locked)!==(!!state.talents[index]?.locked))))
   throw Error('원본 경로 최종 슬롯 수·재능 ID·잠금 상태와 실제 WASM 결과가 다릅니다');
  if(missing.length)throw Error('경로 재생 후 목표 자맥 미보유: '+missing.join(','));
  const expectedPills=integer(route.estimatedPills);
  const beforePills=original.has_bag_pills===true?integer(original.bag_pills):null;
  const afterPills=state?.has_bag_pills===true?integer(state.bag_pills):null;
  if(expectedPills!==null&&beforePills!==null&&afterPills!==null&&
     beforePills-afterPills!==expectedPills)
   throw Error('원본 자동 탐색 세수단 예상 소비 '+expectedPills+
    '개와 실제 WASM 모의 소비 '+(beforePills-afterPills)+'개가 다릅니다');
  const luckInitEvents=audit.filter(a=>!a.luckInitializedBefore&&a.luckInitializedAfter);
  ensureSession();
  return {original,state,steps:applied,verified:true,audit,
   luckInitializedDuringReplay:luckInitEvents.length>0,
   luckInitActionKinds:luckInitEvents.map(e=>e.kind),
   pillsConsumed:beforePills!==null&&afterPills!==null?beforePills-afterPills:null};
 }catch(error){
  try{
   ensureSession();
   const restored=await call('set-state',original);
   if(JSON.stringify(restored)!==JSON.stringify(original))
    throw Error('복원 후 WASM 전체 상태가 이전 상태와 다릅니다');
  }catch(e){error.message+=' / 롤백 검증 오류: '+String(e.message||e)}
  throw error;
 }
}
root.YYWashRouteReplay={plan,run};
})(window);
