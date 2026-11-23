/* yy-sim purple-anchored green/blue route extension.
 * Original WASM computes purple route anchors, then original WASM do_wash
 * searches the nearest missing green/blue talent after a verified anchor.
 * Never fabricates a completed route or claims exhaustive optimality.
 */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const number=v=>Number(v);
const idsOf=state=>(state?.talents||[]).map(t=>number(t.id));
const hasAll=(state,ids)=>ids.every(id=>idsOf(state).includes(id));
const grade=(talents,id)=>number(talents[String(id)]?.pinzhi);
const count=(state,key)=>number(state?.[key]??0);
function requestShape(ids,talents){
 if(!Array.isArray(ids)||ids.length!==4||new Set(ids).size!==4)return null;
 const purple=ids.filter(id=>grade(talents,id)===4);
 const colors=ids.filter(id=>[2,3].includes(grade(talents,id)));
 if(!((purple.length===3&&colors.length===1)||
   (purple.length===2&&colors.length===2)))return null;
 const families=ids.map(id=>number(talents[String(id)]?.type));
 if(families.some(x=>!Number.isInteger(x)||x<=0)||
    new Set(families).size!==4)return null;
 return {purple,colors};
}
// Bounded native event selection: prefer cheaper early events while retaining
// interior and late alternatives that may follow a different valid WASM path.
// These are candidate priorities, NEVER a claim about final route cost.
function sampleIntervalCandidates(events,cap=8){
 if(!Array.isArray(events)||!events.length||cap<=0)return [];
 if(events.length<=cap)return events.slice();
 const first=Math.min(4,Math.max(1,cap-3));
 const last=Math.min(2,cap-first);
 const indices=new Set();
 for(let i=0;i<first;i++)indices.add(i);
 for(let i=events.length-last;i<events.length;i++)indices.add(i);
 const available=cap-indices.size;
 for(let i=1;i<=available;i++){
  const index=Math.round((first-1)+i*(events.length-last-first+1)/(available+1));
  indices.add(Math.max(first,Math.min(events.length-last-1,index)));
 }
 for(let i=first;indices.size<cap&&i<events.length-last;i++)indices.add(i);
 return [...indices].sort((a,b)=>a-b).slice(0,cap).map(i=>events[i]);
}
// When two lower-grade goals are selected, reserve native replay slots
// for candidates where EACH goal arrives first. Without this, frequent
// appearances of one color can fill the entire eight-candidate budget.
function sampleMixedColorCandidates(events,colors,cap=8){
 if(!Array.isArray(events)||!events.length||cap<=0)return [];
 if(!Array.isArray(colors)||colors.length<2)
  return sampleIntervalCandidates(events,cap);
 const picked=new Map();
 const add=event=>{if(event&&picked.size<cap)picked.set(event.time,event);};
 // Include two earliest native events for each possible first color.
 for(const color of colors){
  let n=0;
  for(const event of events){
   if((event.appearing||[]).includes(color)){
    add(event);
    if(++n>=2)break;
   }
  }
 }
 // Preserve broad coverage even when one color is scarce or absent.
 for(const event of sampleIntervalCandidates(events,cap))add(event);
 for(const event of events){if(picked.size>=cap)break;add(event);}
 // Explore the cheapest partial states first; this creates a verified
 // incumbent sooner, and subsequent native wash costs are nonnegative.
 return [...picked.values()].sort((a,b)=>
  count(a.state,'total_pills')-count(b.state,'total_pills')||
  a.time-b.time);
}
function actionsToRoute(actions,final,base,original,desiredIds,window='last-purple-after'){
 const washes=count(final,'total_wash')-count(base,'total_wash');
 const pills=count(final,'total_pills')-count(base,'total_pills');
 return {
  order_ids:[...desiredIds],final_slots:clone(final.talents),
  actions,pills,washes,exchanges:actions.filter(a=>a.kind==='exchange').length,
  // All remaining operations cost nonnegative pills, so a verified
  // zero-pill complete final state is an actual global minimum.
  // Positive-cost bounded mixed searches remain unproven.
  pad:number(original.pad)||0,optimal:pills===0,
  strategy:'자맥 원본 경로 확정 → 녹·파맥 실측 가까운 맥 탐색',
  anchor_window:window,native_verified:true
 };
}
async function run({desiredIds,maxPad=0,horizon=900,topN=8,
 talents,getState,setState,search,doWash,exchangeTalent,
 guard,progress=()=>{},expanded=false}={}){
 const shape=requestShape(desiredIds,talents);
 if(!shape)throw Error('자맥 3개+녹·파맥 1개 또는 자맥 2개+녹·파맥 2개를 선택하세요');
 if([getState,setState,search,doWash,exchangeTalent].some(x=>typeof x!=='function')||
    !guard?.run||!guard?.statesEqual)
  throw Error('원본 WASM 세수·잠금·치환 함수가 준비되지 않았습니다');
 const originalState=getState();
 if(!originalState)throw Error('세이브 기반 원본 세수 상태가 없습니다');
 // Hypothetical route cost must not be limited by how many pills the
 // character currently carries. This branch is an isolated WASM simulator,
 // not a save mutation; restoring originalState below is mandatory.
 // Original native RNG/pills parity across virtual stocks is regression-tested.
 const initial=clone(originalState);
 initial.has_bag_pills=true;
 initial.bag_pills=Math.max(100000,count(initial,'bag_pills'));
 const names=new Map(Object.entries(talents).filter(([,x])=>x?.name)
  .map(([id,t])=>[String(t.name),Number(id)]));
 const restore=state=>{
  if(!setState(clone(state))||!guard.statesEqual(getState(),state))
   throw Error('원본 WASM 분기 상태를 복구할 수 없습니다');
 };
 const washTo=(target,pillCeiling=Infinity,beforeNativeWash=null)=>{
  const current=count(getState(),'total_wash');
  if(target<current||target-current>6000)
   throw Error('원본 WASM 세수 회차가 역행하거나 탐색 제한을 초과했습니다');
  for(let wash=current;wash<target;wash++){
   if(beforeNativeWash)beforeNativeWash();
   const result=doWash();
   if(!result||result.error||count(getState(),'total_wash')!==wash+1){
    const currentState=getState();
    throw Error('원본 WASM 세수 '+(wash+1)+'회 진행 실패 · 잠금 '+
     currentState.talents.filter(t=>t.locked).length+'/4 · 남은 재능 '+
     currentState.talents.filter(t=>!t.locked).map(t=>t.id).join(','));
   }
   if(count(getState(),'total_pills')-count(initial,'total_pills')>=pillCeiling)
    throw Error('검증된 최저 세수단보다 비싼 재탐색 분기');
  }
 };
 function lockId(id,locked){
  const current=getState(),idx=current.talents.findIndex(t=>number(t.id)===id);
  if(idx<0)throw Error('목표 재능이 현재 슬롯에 없습니다: '+id);
  const list=current.talents.map((t,i)=>i===idx?{...t,locked}:t);
  if(!setState({...current,talents:list}))
   throw Error('원본 WASM 재능 잠금 상태 변경 실패');
 }
 // Original yy-sim open_slot follows upgradeZiZhi: a virtual
 // aptitude increment adds +100 strength and constitution gifts per step.
 // Apply through the original WASM state API, never fabricate a new slot.
 function openNativeSlot(action){
  const note=String(action?.note||'');
  const match=note.match(/15[1-4]/);
  if(!match)throw Error('원본 슬롯 개방의 자질 조건을 확인할 수 없습니다: '+note);
  const required=Number(match[0]);
  let state=getState();
  const z=Number(state?.zizhi);
  if(!Number.isInteger(z)||z<150||z>154)
   throw Error('원본 WASM 슬롯 개방 자질 상태가 올바르지 않습니다');
  while(Number(state.zizhi)<required){
   const next={...state,zizhi:Number(state.zizhi)+1,
    str_gift:count(state,'str_gift')+100,
    con_gift:count(state,'con_gift')+100};
   if(!setState(next))throw Error('원본 WASM 슬롯 개방 실패: 자질 '+next.zizhi);
   state=getState();
   if(Number(state.zizhi)!==next.zizhi||
      count(state,'str_gift')!==next.str_gift||
      count(state,'con_gift')!==next.con_gift)
    throw Error('원본 WASM 슬롯 개방 후 자질 수치 불일치');
  }
 }
 function replay(route,anchorProgress){
  restore(initial);
  const actions=Array.isArray(route.actions)?route.actions:[];
  if(!actions.length)throw Error('원본 자맥 경로의 실행 단계가 없습니다');
  let last=0;
  const verifiedActions=[];
  for(let i=0;i<actions.length;i++){
   const action=actions[i],wash=Number(action.wash_no);
   if(!Number.isInteger(wash)||wash<last)
    throw Error('원본 자맥 경로의 세수 회차 순서가 잘못되었습니다');
   washTo(wash);last=wash;
   switch(action.kind){
    case 'lock':case 'unlock':case 'keep':{
     const id=names.get(String(action.talent));
     if(!id)throw Error('원본 자맥 단계 재능 ID를 찾지 못했습니다');
     lockId(id,action.kind!=='unlock');
     // Purple milestones can be recorded as either keep or lock.
     if(action.kind!=='unlock'&&shape.purple.includes(id))
      anchorProgress?.({id,actionIndex:i,wash,state:clone(getState())});
     break;
    }
    case 'exchange':{
     const id=names.get(String(action.from));
     const to=names.get(String(action.to||action.talent));
     const list=getState().talents,idx=list.findIndex(t=>number(t.id)===id);
     if(idx<0||!id||!to)throw Error('원본 자맥 치환 원맥 ID를 찾지 못했습니다');
     const result=exchangeTalent(idx);
     if(!result||result.error||!idsOf(getState()).includes(to))
      throw Error('원본 자맥 치환 결과가 원본 단계와 일치하지 않습니다');
     break;
    }
    case 'open_slot':openNativeSlot(action);break;
    case 'wash_to':case 'skip':break;
    default:throw Error('미지원 원본 자맥 실행 단계: '+action.kind);
   }
   const {roll_idx:_roll,...measuredStep}=action;
   verifiedActions.push({...measuredStep,
    wash_no:count(getState(),'total_wash'),
    pills_after:count(getState(),'total_pills')-count(initial,'total_pills')});
  }
  const state=getState();
  if(!hasAll(state,shape.purple))
   throw Error('원본 자맥 경로를 실행했으나 최종 자맥을 모두 확보하지 못했습니다');
  // A replayed native final state and its measured pill counter are the
  // source of truth. Search metadata may cost a different set of retained
  // filler locks. Do not discard an otherwise valid purple path solely
  // because native search's estimate differs from the actual WASM replay.
  const actualPills=count(state,'total_pills')-count(initial,'total_pills');
  if(Number.isFinite(number(route.pills))&&actualPills!==number(route.pills)){
   diagnostics.purpleCostAdjusted=(diagnostics.purpleCostAdjusted||0)+1;
   if((diagnostics.purpleCostExamples||[]).length<4){
    diagnostics.purpleCostExamples=diagnostics.purpleCostExamples||[];
    diagnostics.purpleCostExamples.push({
     predicted:number(route.pills),replayed:actualPills,
     wash:count(state,'total_wash')-count(initial,'total_wash')
    });
   }
  }
  return {state:clone(state),actions:verifiedActions};
 }
 // Original WASM minimizes the PURPLE-only prefix, but a slightly
 // different legal lock/open-slot sequence can minimize all four talents.
 // Generate a replay-validated alternative to the native relay route:
 // open the last slot one wash earlier, and exchange A->B->purple without
 // temporarily rearranging unrelated filler locks between those exchanges.
 function alternateNativeTimelines(route){
  if(shape.purple.length!==2||!Array.isArray(route.actions))return [];
  const orig=route.actions;
  const open=orig.findIndex((a,i)=>i>0&&a.kind==='open_slot'&&
   /154/.test(String(a.note||''))&&
   Number(a.wash_no)===Number(orig[i-1].wash_no)+1);
  if(open<0)return [];
  const actions=clone(orig),openWash=Number(actions[open].wash_no);
  actions[open].wash_no=openWash-1;
  for(let i=open+1;i<actions.length;i++){
   const a=actions[i];
   if(['wash_to','exchange'].includes(a.kind))break;
   if(['lock','unlock','keep'].includes(a.kind)&&
      Number(a.wash_no)>openWash-1)a.wash_no--;
  }
  const skip=new Set(),protectedIds=new Set(shape.purple);
  for(let i=0;i<actions.length;i++){
   if(actions[i].kind!=='exchange')continue;
   for(let j=i+1;j<actions.length;j++){
    if(Number(actions[j].wash_no)!==Number(actions[i].wash_no))break;
    if(actions[j].kind!=='exchange')continue;
    if(String(actions[i].to||actions[i].talent)!==String(actions[j].from))continue;
    for(let k=i+1;k<j;k++){
     const a=actions[k],id=names.get(String(a.talent));
     if(['lock','unlock','keep'].includes(a.kind)&&
        !protectedIds.has(id))skip.add(k);
    }
    break;
   }
  }
  if(!skip.size)return [];
  return [{...route,
   actions:actions.filter((_,i)=>!skip.has(i)),
   anchorVariant:'early-slot-direct-relay'}];
 }
 // Reuse the ORIGINAL purple route timeline around the second (or first)
 // confirmed purple. Insert a nearby color talent before the next native
 // action, then validate ALL following purple steps on the actual WASM.
 // A shifted seed/lock order often invalidates the original continuation:
 // reject those branches rather than pretending the saved route still works.
 async function searchBetween(native,marks,diagnostics,routes){
  // A final-purple-only result may reject green/blue insertion between
  // the first and second purple, yet an EARLIER confirmed purple often
  // allows a valid native replan. Try the two most recent distinct anchor
  // depths instead of assuming the last pre-final marker is sufficient.
  const candidates=marks.filter(m=>{
   const locked=shape.purple.filter(id=>m.state.talents.some(t=>
    number(t.id)===id&&t.locked)).length;
   return locked>=1&&locked<shape.purple.length;
  }).reverse();
  const checked=new Set(),selected=[];
  for(const mark of candidates){
   const depth=shape.purple.filter(id=>mark.state.talents.some(t=>
    number(t.id)===id&&t.locked)).length;
   if(checked.has(depth))continue;
   checked.add(depth);selected.push(mark);
   if(selected.length>=2)break;
  }
  async function tryAnchor(mark){
  const originalActions=native.actions||[];
  const apply=action=>{
   const wash=Number(action.wash_no);
   if(!Number.isSafeInteger(wash)||wash<count(getState(),'total_wash'))
    throw Error('자맥 사이 후보로 원본 단계 회차가 역행했습니다');
   washTo(wash);
   if(['lock','unlock','keep'].includes(action.kind)){
    const id=names.get(String(action.talent));
    if(!id)throw Error('원본 자맥 단계 ID 없음');
    if(action.kind==='unlock'&&!idsOf(getState()).includes(id))return;
    lockId(id,action.kind!=='unlock');
   }else if(action.kind==='exchange'){
    const id=names.get(String(action.from));
    const to=names.get(String(action.to||action.talent));
    const index=getState().talents.findIndex(t=>number(t.id)===id);
    if(index<0||!to)throw Error('자맥 사이 삽입 후 원맥이 사라졌습니다');
    const ret=exchangeTalent(index);
    if(!ret||ret.error||!idsOf(getState()).includes(to))
     throw Error('자맥 사이 삽입 후 치환 결과가 달라졌습니다');
   }else if(action.kind==='open_slot')openNativeSlot(action);
   else if(!['wash_to','skip'].includes(action.kind))
    throw Error('원본 단계 미지원: '+action.kind);
  };
  restore(mark.state);
  let next=mark.actionIndex+1;
  // Complete other actions at the same confirmed-purple wash moment.
  while(next<originalActions.length&&
        Number(originalActions[next].wash_no)===mark.wash){
   try{apply(originalActions[next])}catch(_){return}
   next++;
  }
  if(next===originalActions.length)return;
  const nextScheduled=Number(originalActions[next].wash_no);
  const start=clone(getState());
  // Lock previously confirmed purples; free the remaining movable slots.
  const anchored=start.talents.map(t=>({...t,
   locked:shape.purple.includes(number(t.id))}));
  if(!setState({...start,talents:anchored}))return;
  const opened=clone(getState());
  const unlockSteps=start.talents.filter(t=>t.locked&&
   !shape.purple.includes(number(t.id))).map(t=>({
    kind:'unlock',talent:talents[String(t.id)]?.name||String(t.id),
    wash_no:mark.wash
   }));
  const boundary=Math.min(nextScheduled-1,mark.wash+horizon);
  if(boundary<=mark.wash)return;
  // First enumerate the ORIGINAL WASM events only once, leaving the
  // earlier purple locks unchanged. Compare near events at BOTH ends
  // of the purple interval rather than only the first four events.
  const candidatesInWindow=[];
  for(let wash=mark.wash+1;wash<=boundary;wash++){
   const before=count(getState(),'total_wash');
   const washed=doWash();
   if(!washed||washed.error||count(getState(),'total_wash')!==before+1)break;
   diagnostics.scannedWashes++;
   // An earlier full four-slot native route is a strict upper bound:
   // every future wash only increases total consumed pills. Skip later
   // events which cannot improve the best completed route.
   const best=Math.min(Infinity,...routes.map(r=>r.pills));
   if(count(getState(),'total_pills')-count(initial,'total_pills')>=best){
    diagnostics.betweenScanPruned=(diagnostics.betweenScanPruned||0)+1;
    break;
   }
   const state=clone(getState());
   const found=shape.colors.filter(id=>idsOf(state).includes(id));
   if(found.length)candidatesInWindow.push({time:wash,state,appearing:found});
   if((wash-mark.wash)%75===0){
    progress({phase:'anchor-between',scannedWashes:diagnostics.scannedWashes,
     candidateRoutes:routes.length});
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
  // Fixed native replay budget, but include the interior of the interval.
  // An edge-only sample can miss a cheaper completed final four-slot route.
  const chosen=sampleMixedColorCandidates(candidatesInWindow,shape.colors,8);
  diagnostics.betweenCandidates=(diagnostics.betweenCandidates||0)+
   candidatesInWindow.length;
  diagnostics.betweenExamined=(diagnostics.betweenExamined||0)+chosen.length;
  // Diagnostics intentionally expose only wash positions and counts, not
  // raw RNG seeds or intermediate private save contents.
  diagnostics.betweenSampledWashes=diagnostics.betweenSampledWashes||[];
  if(diagnostics.betweenSampledWashes.length<24)
   diagnostics.betweenSampledWashes.push(
    ...chosen.map(x=>x.time).slice(0,24-diagnostics.betweenSampledWashes.length));
  for(const candidate of chosen){
   // Already-spent native pills are a strict lower bound on final cost.
   const best=Math.min(Infinity,...routes.map(r=>r.pills));
   if(count(candidate.state,'total_pills')-count(initial,'total_pills')>=best){
    diagnostics.candidatePruned=(diagnostics.candidatePruned||0)+1;
    continue;
   }
   const {time,appearing}=candidate;
   const originalScan=candidate.state;
   restore(originalScan);
   try{
    const actions=[
     ...clone(originalActions.slice(0,next)),...clone(unlockSteps),
     {kind:'wash_to',wash_no:time,note:'자맥 사이 녹·파맥 근접 탐색'}
    ];
    for(const id of appearing){
     lockId(id,true);
     actions.push({kind:'lock',talent:talents[String(id)]?.name||String(id),
      wash_no:time});
    }
    // Replan the remaining purple using the ORIGINAL native search,
    // starting from the state where the nearest green/blue is already locked.
    // The native solver searches its selected purples only and may request
    // unlocking a purple or color which is already a retained objective.
    // Such actions are not valid in the mixed goal: refuse only that unlock,
    // then replay every subsequent wash/exchange on the ORIGINAL WASM state.
    const branchState=clone(getState());
    const remaining=shape.purple.filter(id=>!idsOf(branchState).includes(id));
    if(remaining.length){
     diagnostics.replanAttempts=(diagnostics.replanAttempts||0)+1;
     try{
      const replanned=guard.run({getState,setState,search},{
       // Include previously fixed purples as native goals, or the purple-only
       // solver may immediately unlock them as supposedly irrelevant.
       desired_ids:shape.purple,max_pad:Math.min(maxPad,20),
       horizon:Math.min(horizon,300),top_n:2});
      diagnostics.replanNativeRoutes=(diagnostics.replanNativeRoutes||0)+
       (replanned?.routes?.length||0);
      const protectedIds=new Set([
       ...shape.purple.filter(id=>idsOf(branchState).includes(id)),
       ...shape.colors.filter(id=>idsOf(branchState).includes(id))
      ]);
      diagnostics.replanExamples=diagnostics.replanExamples||[];
      if(diagnostics.replanExamples.length<4)diagnostics.replanExamples.push({
       atWash:time,targets:shape.purple,remaining,received:replanned?.routes?.length||0,
       error:replanned?.error||null,
       firstAction:replanned?.routes?.[0]?.actions?.[0]||null,
       currentWash:count(branchState,'total_wash'),
       finalIds:replanned?.routes?.[0]?.final_slots?.map(t=>t.id)||[]
      });
      for(const continuation of replanned?.routes||[]){
       const nativeActions=Array.isArray(continuation.actions)?
        continuation.actions:[];
       if(!nativeActions.length)continue;
       restore(branchState);
       const combined=[...actions];
       try{
        let washShift=0;
        // The native purple-only continuation may lock four slots even
        // though one of them is a disposable filler. With a color target
        // protected, that creates a deadlocked WASM wash. Explicitly free
        // ONLY nonselected filler talents, recording every unlock step.
        const freeDisposable=()=>{
         const current=getState();
         if(!current.talents.every(t=>t.locked))return;
         const obsolete=current.talents.filter(t=>
          !desiredIds.includes(number(t.id)));
         if(!obsolete.length)return;
         if(!setState({...current,talents:current.talents.map(t=>({
          ...t,locked:desiredIds.includes(number(t.id))
         }))}))throw Error('원본 WASM 임시 잠금 해제 실패');
         for(const t of obsolete)combined.push({
          kind:'unlock',
          talent:talents[String(t.id)]?.name||String(t.id),
          wash_no:count(current,'total_wash'),
          note:'자맥 사이 원본 재탐색 교체 가능 칸 확보'});
         diagnostics.autoFreedFillers=(diagnostics.autoFreedFillers||0)+
          obsolete.length;
        };
        // Keep the native path's action order. If locking an extra target
        // has shifted the original RNG, re-synchronize only at an exact
        // native talent event, bounded by a small local wash window.
        const resyncTo=(id)=>{
         if(idsOf(getState()).includes(id))return;
         const maxCorrection=Math.min(64,horizon);
         for(let delta=1;delta<=maxCorrection;delta++){
          const at=count(getState(),'total_wash');
          freeDisposable();
          const washed=doWash();
          if(!washed||washed.error||count(getState(),'total_wash')!==at+1)
           throw Error('원본 WASM 보정 세수 실패');
          washShift++;
          diagnostics.scannedWashes++;
          // Every original WASM wash costs nonnegative pills. Once a
          // candidate already costs as much as a complete verified route,
          // further washes cannot improve the minimum found so far.
          const incumbent=Math.min(Infinity,...routes.map(r=>r.pills));
          if(count(getState(),'total_pills')-count(initial,'total_pills')>=incumbent){
           diagnostics.prunedByCost=(diagnostics.prunedByCost||0)+1;
           throw Error('이미 검증된 경로보다 세수단이 더 필요한 후보');
          }
          if(idsOf(getState()).includes(id)){
           diagnostics.adaptiveResync=(diagnostics.adaptiveResync||0)+1;
           combined.push({kind:'wash_to',wash_no:count(getState(),'total_wash'),
            note:'잠금 변경 이후 원본 경로 동기화'});
           return;
          }
         }
         throw Error('보호 목표 잠금 후 원본 경로에 필요한 재능 '+id+
          '을 보정 세수 '+maxCorrection+'회에서 찾지 못했습니다');
        };
        for(const step of nativeActions){
         if(hasAll(getState(),desiredIds)){
          diagnostics.earlyFourGoal=(diagnostics.earlyFourGoal||0)+1;
          break;
         }
         const originalWash=Number(step.wash_no);
         if(!Number.isSafeInteger(originalWash))
          throw Error('재탐색의 세수 회차 정보가 없습니다');
         const washNo=originalWash+washShift;
         if(washNo<count(getState(),'total_wash'))
          throw Error('재탐색의 세수 회차가 이전 회차로 돌아갑니다');
         const incumbent=Math.min(Infinity,...routes.map(r=>r.pills));
         if(count(getState(),'total_pills')-count(initial,'total_pills')>=incumbent)
          throw Error('검증된 최소 비용을 이미 초과한 재탐색 분기');
         washTo(washNo,incumbent,freeDisposable);
         const id=names.get(String(step.talent));
         if(['lock','unlock','keep'].includes(step.kind)){
          // The original purple-only native plan would erase a previously
          // confirmed purple/green objective. That is never allowed.
          if(step.kind==='unlock'&&protectedIds.has(id)){
           diagnostics.protectedUnlocks=(diagnostics.protectedUnlocks||0)+1;
           continue;
          }
          if(step.kind==='unlock'&&!idsOf(getState()).includes(id))continue;
          if(!id)throw Error('원본 재탐색 잠금 단계 ID 누락');
          if(step.kind!=='unlock')resyncTo(id);
          lockId(id,step.kind!=='unlock');
         }else if(step.kind==='exchange'){
          const sourceId=names.get(String(step.from));
          const targetId=names.get(String(step.to||step.talent));
          if(!sourceId||!targetId)throw Error('재탐색 치환 ID 누락');
          if(protectedIds.has(sourceId))
           throw Error('이미 보유한 목표 맥을 치환할 수 없습니다');
          resyncTo(sourceId);
          const slot=getState().talents.findIndex(t=>number(t.id)===sourceId);
          if(slot<0)throw Error('재탐색 치환 원맥이 달라졌습니다');
          const beforeExchange=clone(getState());
          const done=exchangeTalent(slot);
          if(!done||done.error||!idsOf(getState()).includes(targetId)){
           diagnostics.exchangeDivergences=diagnostics.exchangeDivergences||[];
           if(diagnostics.exchangeDivergences.length<8)
            diagnostics.exchangeDivergences.push({
             wash:count(beforeExchange,'total_wash'),
             from:sourceId,to:targetId,
             beforeIds:idsOf(beforeExchange),afterIds:idsOf(getState()),
             result:done,
             protectedHeld:[...protectedIds].every(id=>idsOf(getState()).includes(id))
            });
           throw Error('재탐색 WASM 치환 결과 불일치');
          }
         }else if(step.kind==='open_slot')openNativeSlot(step);
         else if(!['wash_to','skip'].includes(step.kind))
          throw Error('원본 재탐색 미지원 단계: '+step.kind);
         // Once locked targets change native draw consumption, the old
         // roll_idx refers to a different RNG stream and must not be shown
         // as an actual replay offset. Verified wash/pill counters replace it.
         const {roll_idx:_obsoleteRoll,...verifiedStep}=step;
         combined.push({...verifiedStep,
          wash_no:count(getState(),'total_wash'),
          pills_after:count(getState(),'total_pills')-count(initial,'total_pills')});
        }
        if(!hasAll(getState(),shape.purple))
         throw Error('재탐색 후 기존 자맥과 마지막 자맥을 동시에 보유하지 못했습니다');
        const beforeFinalize=getState();
        const retained=new Set([...shape.purple,...shape.colors]);
        if(!setState({...beforeFinalize,talents:beforeFinalize.talents.map(t=>({
         ...t,locked:retained.has(number(t.id))
        }))}))throw Error('원본 WASM 최종 목표 잠금 설정 실패');
        for(const talent of beforeFinalize.talents){
         const id=number(talent.id),want=retained.has(id);
         if(talent.locked!==want)combined.push({
          kind:want?'lock':'unlock',
          talent:talents[String(id)]?.name||String(id),
          wash_no:count(beforeFinalize,'total_wash')
         });
        }
        const held=new Set(shape.colors.filter(id=>idsOf(getState()).includes(id)));
        for(let extra=0;extra<=horizon;extra++){
         if(held.size===shape.colors.length&&hasAll(getState(),desiredIds)){
          const final=getState();
          const verifiedRoute=actionsToRoute(combined,final,initial,native,
           desiredIds,'purple-between-replanned');
          routes.push(verifiedRoute);
          diagnostics.replannedCosts=diagnostics.replannedCosts||[];
          if(diagnostics.replannedCosts.length<8)
           diagnostics.replannedCosts.push({
            anchorWash:time,pills:verifiedRoute.pills,
            washes:verifiedRoute.washes,finalIds:final.talents.map(t=>t.id)
           });
          reportBest('anchor-between');
          diagnostics.replanComplete=(diagnostics.replanComplete||0)+1;
          break;
         }
         if(extra===horizon||reachedIncumbent())break;
         const at=count(getState(),'total_wash');
         const washed=doWash();
         if(!washed||washed.error||count(getState(),'total_wash')!==at+1)break;
         diagnostics.scannedWashes++;
         for(const colorId of shape.colors){
          if(held.has(colorId)||!idsOf(getState()).includes(colorId))continue;
          lockId(colorId,true);held.add(colorId);
          const here=count(getState(),'total_wash');
          combined.push({kind:'wash_to',wash_no:here,
           note:'재탐색 마지막 자맥 이후 녹·파맥 후보'});
          combined.push({kind:'lock',
           talent:talents[String(colorId)]?.name||String(colorId),
           wash_no:here});
         }
         if(extra%50===49){
          progress({phase:'anchor-between',scannedWashes:diagnostics.scannedWashes,
           candidateRoutes:routes.length});
          await new Promise(resolve=>setTimeout(resolve,0));
         }
        }
       }catch(error){
        diagnostics.replanRejected=(diagnostics.replanRejected||0)+1;
        if((diagnostics.replanRejectReasons||[]).length<4){
         diagnostics.replanRejectReasons=diagnostics.replanRejectReasons||[];
         diagnostics.replanRejectReasons.push(String(error?.message||error));
        }
       }
      }
     }catch(e){
      diagnostics.replanErrors=(diagnostics.replanErrors||0)+1;
      if((diagnostics.replanRejectReasons||[]).length<4){
       diagnostics.replanRejectReasons=diagnostics.replanRejectReasons||[];
       diagnostics.replanRejectReasons.push(String(e?.message||e));
      }
     }
     restore(branchState);
    }
    for(let i=next;i<originalActions.length;i++){
     apply(originalActions[i]);
     // Actual next native wash steps; the original route may have diverged
     // and will then fail with an explicit ID/state check.
     const {roll_idx:_obsoleteRoll,...verifiedOriginalStep}=originalActions[i];
     actions.push({...verifiedOriginalStep,
      pills_after:count(getState(),'total_pills')-count(initial,'total_pills')});
    }
    if(!hasAll(getState(),shape.purple))
     throw Error('자맥 사이 삽입 이후 마지막 자맥 유실');
    const afterPurple=getState();
    const allowed=new Set([...shape.purple,...shape.colors]);
    const adjusted=afterPurple.talents.map(t=>({...t,
     locked:allowed.has(number(t.id))}));
    if(!setState({...afterPurple,talents:adjusted}))
     throw Error('자맥 사이 보존 슬롯 설정 실패');
    for(const t of afterPurple.talents){
     const id=number(t.id),shouldLock=allowed.has(id);
     if(t.locked!==shouldLock)actions.push({
      kind:shouldLock?'lock':'unlock',
      talent:talents[String(id)]?.name||String(id),
      wash_no:count(afterPurple,'total_wash')});
    }
    // If one target appeared before the final purple, find the second
    // after it; no target is counted unless it remains in the final state.
    const held=new Set(shape.colors.filter(id=>idsOf(getState()).includes(id)));
    for(let offset=0;offset<=horizon;offset++){
     if(held.size===shape.colors.length&&hasAll(getState(),desiredIds)){
      const final=getState();
      routes.push(actionsToRoute(actions,final,initial,native,
       desiredIds,'purple-between'));
      reportBest('anchor-between');
      break;
     }
     if(offset===horizon||reachedIncumbent())break;
     const before=count(getState(),'total_wash'),ret=doWash();
     if(!ret||ret.error||count(getState(),'total_wash')!==before+1)break;
     diagnostics.scannedWashes++;
     for(const id of shape.colors){
      if(held.has(id)||!idsOf(getState()).includes(id))continue;
      lockId(id,true);held.add(id);
      const washNo=count(getState(),'total_wash');
      actions.push({kind:'wash_to',wash_no:washNo,
       note:'마지막 자맥 이후 나머지 녹·파맥 탐색'});
      actions.push({kind:'lock',talent:talents[String(id)]?.name||String(id),
       wash_no:washNo});
     }
     if(offset%50===0){
      progress({phase:'anchor-between',scannedWashes:diagnostics.scannedWashes,
       candidateRoutes:routes.length});
      await new Promise(resolve=>setTimeout(resolve,0));
     }
    }
   }catch(error){
    diagnostics.betweenRejected=(diagnostics.betweenRejected||0)+1;
   }finally{restore(originalScan)}
  }
  }
  for(const mark of selected){
   try{
    diagnostics.betweenAnchorDepths=diagnostics.betweenAnchorDepths||[];
    diagnostics.betweenAnchorDepths.push(
     shape.purple.filter(id=>mark.state.talents.some(t=>
      number(t.id)===id&&t.locked)).length);
    await tryAnchor(mark);
   }catch(error){
    diagnostics.betweenAnchorErrors=(diagnostics.betweenAnchorErrors||0)+1;
    if((diagnostics.betweenAnchorReasons||[]).length<4){
     diagnostics.betweenAnchorReasons=diagnostics.betweenAnchorReasons||[];
     diagnostics.betweenAnchorReasons.push(String(error?.message||error));
    }
   }
  }
 }
 // A first sighting lock changes the WASM draw sequence. For two
 // lower-grade goals, consider later genuine sightings before locking either.
 async function searchDeferredColorLocks(start,base,native,diagnostics,routes){
  if(shape.purple.length!==2||shape.colors.length!==2||
     shape.colors.some(id=>idsOf(start).includes(id)))return;
  restore(start);
  const events=[];
  for(let offset=1;offset<=horizon;offset++){
   const at=count(getState(),'total_wash'),ret=doWash();
   if(!ret||ret.error||count(getState(),'total_wash')!==at+1)break;
   diagnostics.scannedWashes++;
   const state=clone(getState());
   const colors=shape.colors.filter(id=>idsOf(state).includes(id));
   if(colors.length)events.push({wash:at+1,state,colors});
   const incumbent=Math.min(Infinity,...routes.map(r=>r.pills));
   if(count(state,'total_pills')-count(initial,'total_pills')>=incumbent)break;
   if(offset%75===0){progress({phase:'anchor-color-timing',
    scannedWashes:diagnostics.scannedWashes,candidateRoutes:routes.length});
    await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const candidates=events.length<=32?events:
   [...events.slice(0,20),...sampleIntervalCandidates(events.slice(20),12)];
  diagnostics.deferredColorSightings=(diagnostics.deferredColorSightings||0)+events.length;
  diagnostics.deferredColorExamined=(diagnostics.deferredColorExamined||0)+candidates.length;
  for(const event of candidates){
   if(count(event.state,'total_pills')-count(initial,'total_pills')>=
      Math.min(Infinity,...routes.map(r=>r.pills)))continue;
   try{
    restore(event.state);
    const actions=[...clone(base),{kind:'wash_to',wash_no:event.wash,
     pills_after:count(getState(),'total_pills')-count(initial,'total_pills'),
     note:'녹·파맥 잠금 시점 비교'}];
    const held=new Set();
    for(const id of event.colors){
     lockId(id,true);held.add(id);
     actions.push({kind:'lock',talent:talents[String(id)]?.name||String(id),
      wash_no:event.wash,
      pills_after:count(getState(),'total_pills')-count(initial,'total_pills')});
    }
    for(let extra=0;extra<=horizon;extra++){
     if(held.size===shape.colors.length&&hasAll(getState(),desiredIds)){
      const complete=actionsToRoute(actions,getState(),initial,native,
       desiredIds,'purple-color-delayed-lock');
      routes.push(complete);
      diagnostics.deferredColorCompleted=(diagnostics.deferredColorCompleted||0)+1;
      reportBest('anchor-color-timing');break;
     }
     if(extra===horizon||reachedIncumbent())break;
     const at=count(getState(),'total_wash'),ret=doWash();
     if(!ret||ret.error||count(getState(),'total_wash')!==at+1)break;
     diagnostics.scannedWashes++;
     for(const id of shape.colors){
      if(held.has(id)||!idsOf(getState()).includes(id))continue;
      lockId(id,true);held.add(id);
      const now=count(getState(),'total_wash');
      const pills=count(getState(),'total_pills')-count(initial,'total_pills');
      actions.push({kind:'wash_to',wash_no:now,pills_after:pills,
       note:'나머지 녹·파맥 찾기'});
      actions.push({kind:'lock',talent:talents[String(id)]?.name||String(id),
       wash_no:now,pills_after:pills});
     }
     if(extra%75===74){progress({phase:'anchor-color-timing',
      scannedWashes:diagnostics.scannedWashes,candidateRoutes:routes.length});
      await new Promise(resolve=>setTimeout(resolve,0));}
    }
   }catch(_){diagnostics.deferredColorRejected=(diagnostics.deferredColorRejected||0)+1;}
  }
 }
 const routes=[],diagnostics={method:'purple-anchor-nearest-native-wash',
  purpleTargets:shape.purple,colorTargets:shape.colors,
  purpleRoutes:0,replayed:0,failures:[],scannedWashes:0,
  expandedSearch:expanded,
  windows:['purple-between','last-purple-after']};
 // Never prune without a complete original-WASM four-target result.
 const reachedIncumbent=()=>{
  if(!routes.length)return false;
  const best=Math.min(...routes.map(r=>r.pills));
  if(count(getState(),'total_pills')-count(initial,'total_pills')<best)return false;
  diagnostics.prunedByCost=(diagnostics.prunedByCost||0)+1;
  return true;
 };
 const reportBest=(phase)=>progress({phase,scannedWashes:diagnostics.scannedWashes,
  candidateRoutes:routes.length,bestPills:routes.length?
   Math.min(...routes.map(r=>r.pills)):null});

 let baseline=null;
 try{
  restore(initial);
  if(hasAll(getState(),shape.purple)){
   // When all purple goals are already on the character, the optimal
   // purple backbone is exactly zero additional washes. Retain those
   // existing purple talents through native WASM state operations;
   // do not require a fabricated or empty native purple search route.
   diagnostics.preexistingPurple=true;
   baseline={scanned:0,routes:[{
    actions:shape.purple.map(id=>({
     kind:'keep',talent:talents[String(id)].name,
     wash_no:count(initial,'total_wash')
    })),pills:0,pad:0,order_ids:[...shape.purple]
   }]};
  }else{
   // The original WASM optimizer's pad limit is not monotonic: for the
   // same save max_pad=0 can beat max_pad=20. Preserve BOTH native routes.
   const permutations=values=>{
    if(values.length<=1)return [[...values]];
    return values.flatMap((id,i)=>permutations(values.filter((_,j)=>j!==i))
     .map(tail=>[id,...tail]));
   };
   // With two purple anchors, a more expensive purple-only route may
   // become the cheapest FINAL four-talent path. Preserve diverse native
   // anchor branches instead of stopping at the first purple-only winner.
   const twoPurple=shape.purple.length===2;
   const attempted=new Set(),paddingModes=[...new Set(
    twoPurple?[0,5,10,20,maxPad]:expanded?[0,5,maxPad]:[0,maxPad])];
   const allMatching=[],seenBackbones=new Set();
   diagnostics.purpleAttempts=0;
   diagnostics.purpleNativeCalls=0;
   diagnostics.purpleAttemptResults=[];
   for(const order of permutations(shape.purple)){
    const key=order.join(',');
    if(attempted.has(key))continue;
    attempted.add(key);
    diagnostics.purpleAttempts++;
    const matching=[];
    for(const pad of paddingModes){
     restore(initial);
     const attempt=guard.run({getState,setState,search},
      {desired_ids:order,max_pad:pad,horizon,top_n:topN});
     diagnostics.purpleNativeCalls++;
     diagnostics.purpleAttemptResults.push({
      order,maxPad:pad,returned:attempt?.routes?.length||0,
      scanned:attempt?.scanned??0,error:attempt?.error||null
     });
     diagnostics.purpleNativeScanned=(diagnostics.purpleNativeScanned||0)+
      (Number(attempt?.scanned)||0);
     diagnostics.purpleNativeReturned=(diagnostics.purpleNativeReturned||0)+
      (attempt?.routes?.length||0);
     if(!baseline)baseline={...attempt,routes:[]};
     for(const candidate of attempt?.routes||[]){
      for(const alternative of [candidate,...alternateNativeTimelines(candidate)]){
       const signature=JSON.stringify(alternative.actions||[]);
       if(seenBackbones.has(signature))continue;
       try{
        const verified=replay(alternative);
        const measured=count(verified.state,'total_pills')-
         count(initial,'total_pills');
        seenBackbones.add(signature);
        matching.push({...alternative,purplePad:pad,purpleMeasuredPills:measured});
        if(alternative.anchorVariant)
         diagnostics.earlySlotRelayCandidates=(diagnostics.earlySlotRelayCandidates||0)+1;
       }catch(error){
        diagnostics.purpleReplayRejected=(diagnostics.purpleReplayRejected||0)+1;
        if((diagnostics.purpleReplayErrors||[]).length<6){
         diagnostics.purpleReplayErrors=diagnostics.purpleReplayErrors||[];
         diagnostics.purpleReplayErrors.push({
          order,maxPad:pad,variant:alternative.anchorVariant||'original',
          reason:String(error?.message||error)
         });
        }
       }
      }
     }
     restore(initial);
     progress({phase:'anchor-purple',
      nativeAttempts:diagnostics.purpleNativeCalls,
      purpleRoutes:matching.length,scannedWashes:diagnostics.scannedWashes,
      candidateRoutes:0});
     await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(matching.length){
     // Do not stop after the first valid 3-purple route. A slightly
     // dearer/differently ordered purple backbone can be the ONLY route
     // on which all four goals coexist after green/blue insertion.
     allMatching.push(...matching);
     if(!twoPurple&&!expanded)break;
    }
   }
   if(allMatching.length){
    allMatching.sort((a,b)=>a.purpleMeasuredPills-b.purpleMeasuredPills);
    // Each is independently replayed against the original native WASM;
    // never assume the cheapest purple cost implies cheapest mixed cost.
    const selected=allMatching.slice(0,twoPurple?16:expanded?Math.max(12,topN):topN);
    baseline={...(baseline||{}),routes:selected};
    diagnostics.purpleBackboneCosts=selected.map(x=>({
     pills:x.purpleMeasuredPills,maxPad:x.purplePad,
     washNo:x.actions?.at(-1)?.wash_no??null
    }));
    diagnostics.purpleBackboneAlternatives=allMatching.length;
   }
  }
  diagnostics.purpleRoutes=baseline?.routes?.length||0;
  diagnostics.purpleNoRoute=diagnostics.purpleRoutes===0&&
   !diagnostics.purpleNativeReturned;
  diagnostics.purpleReplayNoRoute=diagnostics.purpleRoutes===0&&
   (diagnostics.purpleNativeReturned||0)>0;
  if(diagnostics.purpleNoRoute)diagnostics.failures.push(
   '원본 WASM 자맥 기준 경로 0개 · 선택 자맥 순서 '+(diagnostics.purpleAttempts||1)+
   '개 검사 · 녹·파맥 탐색 시작 전 중단');
  if(diagnostics.purpleReplayNoRoute)diagnostics.failures.push(
   '원본 자맥 경로 '+diagnostics.purpleNativeReturned+
   '개가 반환됐지만 세이브 기반 원본 WASM 재현이 모두 실패했습니다');
  for(const native of baseline?.routes||[]){
   let replayed;
   const marks=[];
   try{replayed=replay(native,m=>marks.push(m));diagnostics.replayed++}
   catch(e){diagnostics.failures.push(String(e?.message||e));continue}
   diagnostics.purpleAnchorMarks=(diagnostics.purpleAnchorMarks||0)+marks.length;
   const start=replayed.state;
   restore(start);
   // Freeze all purple anchors. Free only nonselected, replaceable slots.
   const fixed=getState();
   const retainedTargets=new Set([...shape.purple,...shape.colors]);
   const slots=fixed.talents.map(t=>({...t,
    locked:retainedTargets.has(number(t.id))}));
   if(!setState({...fixed,talents:slots})){
    diagnostics.failures.push('자맥 확정 후 자유 슬롯 생성 실패');continue;
   }
   const tailActions=[...replayed.actions];
   for(const slot of fixed.talents){
    const id=number(slot.id);
    if(slot.locked&&!retainedTargets.has(id))
     tailActions.push({kind:'unlock',talent:talents[String(id)]?.name||String(id),
      wash_no:count(fixed,'total_wash')});
   }
   for(const id of retainedTargets){
    const existing=fixed.talents.find(t=>number(t.id)===id);
    if(existing&&!existing.locked)
     tailActions.push({kind:'lock',talent:talents[String(id)]?.name||String(id),
      wash_no:count(fixed,'total_wash')});
   }
   const deferredStart=clone(getState());
   const deferredActions=clone(tailActions);
   let seen=new Set(shape.colors.filter(id=>idsOf(getState()).includes(id))),
    stopped=false;
   // All goals can already be held in a real loaded save, or one of the
   // colors may have appeared while following the native purple backbone.
   // Never wash away or re-search an already completed four-slot result.
   if(seen.size===shape.colors.length&&hasAll(getState(),desiredIds)){
    routes.push(actionsToRoute(tailActions,getState(),initial,native,desiredIds));
    reportBest('anchor-wash');
   }else{
   const from=count(getState(),'total_wash');
   // Nearest following green/blue event wins for this purple backbone.
   for(let offset=1;offset<=horizon;offset++){
    if(reachedIncumbent())break;
    const before=getState(),w=doWash();
    if(!w||w.error||count(getState(),'total_wash')<=count(before,'total_wash')){
     diagnostics.failures.push('자맥 이후 실제 세수 후보 탐색 중단');
     stopped=true;break;
    }
    diagnostics.scannedWashes++;
    const now=getState();
    for(const id of shape.colors){
     if(seen.has(id))continue;
     const slot=now.talents.find(t=>number(t.id)===id);
     if(!slot)continue;
     lockId(id,true);seen.add(id);
     tailActions.push({kind:'wash_to',wash_no:count(now,'total_wash'),
      note:'자맥 이후 녹·파맥 후보 '+id});
     tailActions.push({kind:'lock',talent:talents[String(id)]?.name||String(id),
      wash_no:count(now,'total_wash')});
    }
    if(seen.size===shape.colors.length&&hasAll(getState(),desiredIds)){
     const final=getState();
     if(!shape.purple.every(id=>final.talents.some(t=>number(t.id)===id&&t.locked)))
      throw Error('자맥 확정 슬롯이 혼합 결과에서 잠기지 않았습니다');
     routes.push(actionsToRoute(tailActions,final,initial,native,desiredIds));
     reportBest('anchor-wash');
     break;
    }
    if(offset%50===0){
     progress({phase:'anchor-wash',scannedWashes:diagnostics.scannedWashes,
      purpleRoutesCompleted:diagnostics.replayed,
      candidateRoutes:routes.length});
     await new Promise(resolve=>setTimeout(resolve,0));
    }
   }
   }
   if(!stopped&&!routes.length)diagnostics.failures.push(
    '자맥 확정 이후 '+horizon+'회 내 최종 녹·파맥 조합 미발견');
   // First compare locking lower grades at different real WASM sightings.
   try{await searchDeferredColorLocks(deferredStart,deferredActions,
    native,diagnostics,routes)}
   catch(error){diagnostics.failures.push('녹·파맥 시점 비교: '+String(error?.message||error))}
   // Also attempt the user-requested interval immediately after the
   // earlier purple anchors, before the last purple's next locked step.
   try{await searchBetween(native,marks,diagnostics,routes)}
   catch(error){diagnostics.failures.push('자맥 사이 구간: '+String(error?.message||error))}
   restore(initial);
  }
 }finally{restore(originalState)}
 // Keep the original fast purple-only solution when it already yields
 // all four goals. Only broaden permutations/padding/backbones if a real
 // native purple candidate existed but mixed retention failed.
 // This avoids making every working 3+1 search 6–18 times slower.
 if(!expanded&&shape.purple.length===3&&routes.length===0&&
    ((diagnostics.purpleNativeReturned||0)>0||diagnostics.replayed>0)){
  progress({phase:'anchor-expanded',scannedWashes:diagnostics.scannedWashes,
   stage:'기본 자맥 경로에 녹·파맥이 남지 않아 다른 자맥 경로를 재탐색합니다'});
  const retry=await run({desiredIds,maxPad,horizon,topN,talents,getState,setState,
   search,doWash,exchangeTalent,guard,progress,expanded:true});
  retry.diagnostics.initialPass={
   purpleNativeCalls:diagnostics.purpleNativeCalls,
   purpleReturned:diagnostics.purpleNativeReturned||0,
   replayed:diagnostics.replayed,
   scannedWashes:diagnostics.scannedWashes,
   firstFailure:diagnostics.failures[0]||null
  };
  return retry;
 }
 routes.sort((a,b)=>a.pills-b.pills||a.washes-b.washes);
 return {routes:routes.slice(0,topN),scanned:diagnostics.scannedWashes,
  diagnostics,error:routes.length?null:
   diagnostics.purpleNoRoute?
    '선택한 자맥의 원본 WASM 기준 경로가 검색 범위 내 0개입니다. 자맥 순서 '+
    diagnostics.purpleAttempts+'개를 검사했지만 기준 경로가 없어 녹·파맥 분기는 시작되지 않았습니다.':
    diagnostics.purpleReplayNoRoute||diagnostics.replayed===0?
     '원본 자맥 경로 '+(diagnostics.purpleNativeReturned||diagnostics.purpleRoutes||0)+
     '개를 받았으나 실제 세이브 원본 WASM 재현에 실패했습니다. 자맥 순서 '+
     (diagnostics.purpleAttempts||0)+'개를 검사했습니다.':
     '자맥 기준 경로는 재현됐지만 최종 녹·파맥을 모두 보유하는 경로를 찾지 못했습니다 (검색 범위 내)',
  nativePurpleScanned:diagnostics.purpleNativeScanned??baseline?.scanned??0};
}
root.YYWashPurpleAnchorMixed={requestShape,run,sampleIntervalCandidates,sampleMixedColorCandidates};
})(window);
