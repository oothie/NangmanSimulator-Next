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
function actionsToRoute(actions,final,base,original,desiredIds,window='last-purple-after'){
 const washes=count(final,'total_wash')-count(base,'total_wash');
 const pills=count(final,'total_pills')-count(base,'total_pills');
 return {
  order_ids:[...desiredIds],final_slots:clone(final.talents),
  actions,pills,washes,exchanges:actions.filter(a=>a.kind==='exchange').length,
  pad:number(original.pad)||0,optimal:false,
  strategy:'자맥 원본 경로 확정 → 녹·파맥 실측 가까운 맥 탐색',
  anchor_window:window,native_verified:true
 };
}
async function run({desiredIds,maxPad=20,horizon=900,topN=8,
 talents,getState,setState,search,doWash,exchangeTalent,
 guard,progress=()=>{}}={}){
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
 const washTo=target=>{
  const current=count(getState(),'total_wash');
  if(target<current||target-current>6000)
   throw Error('원본 WASM 세수 회차가 역행하거나 탐색 제한을 초과했습니다');
  for(let wash=current;wash<target;wash++){
   const result=doWash();
   if(!result||result.error||count(getState(),'total_wash')!==wash+1)
    throw Error('원본 WASM 세수 '+(wash+1)+'회 진행 실패');
  }
 };
 function lockId(id,locked){
  const current=getState(),idx=current.talents.findIndex(t=>number(t.id)===id);
  if(idx<0)throw Error('목표 재능이 현재 슬롯에 없습니다: '+id);
  const list=current.talents.map((t,i)=>i===idx?{...t,locked}:t);
  if(!setState({...current,talents:list}))
   throw Error('원본 WASM 재능 잠금 상태 변경 실패');
 }
 function replay(route,anchorProgress){
  restore(initial);
  const actions=Array.isArray(route.actions)?route.actions:[];
  if(!actions.length)throw Error('원본 자맥 경로의 실행 단계가 없습니다');
  let last=0;
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
     if(action.kind==='keep'&&shape.purple.includes(id))
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
    case 'wash_to':case 'skip':break;
    default:throw Error('미지원 원본 자맥 실행 단계: '+action.kind);
   }
  }
  const state=getState();
  if(!hasAll(state,shape.purple))
   throw Error('원본 자맥 경로를 실행했으나 최종 자맥을 모두 확보하지 못했습니다');
  // A valid state is more important than matching route's optional extra
  // locked fillers, but pills and the selected purple IDs must match.
  if(count(state,'total_pills')-count(initial,'total_pills')!==number(route.pills))
   throw Error('원본 자맥 경로의 세수단 비용과 실제 재현 비용이 다릅니다');
  return {state:clone(state),actions:clone(actions)};
 }
 // Reuse the ORIGINAL purple route timeline around the second (or first)
 // confirmed purple. Insert a nearby color talent before the next native
 // action, then validate ALL following purple steps on the actual WASM.
 // A shifted seed/lock order often invalidates the original continuation:
 // reject those branches rather than pretending the saved route still works.
 async function searchBetween(native,marks,diagnostics,routes){
  const prefixCount=shape.purple.length-1;
  const candidates=marks.filter(m=>
   shape.purple.filter(id=>m.state.talents.some(t=>
    number(t.id)===id&&t.locked)).length===prefixCount);
  const mark=candidates.at(-1);
  if(!mark)return;
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
   }else if(!['wash_to','skip'].includes(action.kind))
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
  let branches=0;
  for(let time=mark.wash+1;time<=boundary;time++){
   const washed=doWash();
   if(!washed||washed.error)break;
   diagnostics.scannedWashes++;
   const originalScan=clone(getState());
   const appearing=shape.colors.filter(id=>
    originalScan.talents.some(t=>number(t.id)===id));
   if(appearing.length===0)continue;
   branches++;
   if(branches>4)break;
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
       desired_ids:remaining,max_pad:Math.min(maxPad,20),
       horizon:Math.min(horizon,300),top_n:2});
      diagnostics.replanNativeRoutes=(diagnostics.replanNativeRoutes||0)+
       (replanned?.routes?.length||0);
      const protectedIds=new Set([
       ...shape.purple.filter(id=>idsOf(branchState).includes(id)),
       ...shape.colors.filter(id=>idsOf(branchState).includes(id))
      ]);
      diagnostics.replanExamples=diagnostics.replanExamples||[];
      if(diagnostics.replanExamples.length<4)diagnostics.replanExamples.push({
       atWash:time,targets:remaining,received:replanned?.routes?.length||0,
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
        // Keep the native path's action order. If locking an extra target
        // has shifted the original RNG, re-synchronize only at an exact
        // native talent event, bounded by a small local wash window.
        const resyncTo=(id)=>{
         if(idsOf(getState()).includes(id))return;
         const maxCorrection=Math.min(64,horizon);
         for(let delta=1;delta<=maxCorrection;delta++){
          const at=count(getState(),'total_wash');
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
         const originalWash=Number(step.wash_no);
         if(!Number.isSafeInteger(originalWash))
          throw Error('재탐색의 세수 회차 정보가 없습니다');
         const washNo=originalWash+washShift;
         if(washNo<count(getState(),'total_wash'))
          throw Error('재탐색의 세수 회차가 이전 회차로 돌아갑니다');
         washTo(washNo);
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
          const done=exchangeTalent(slot);
          if(!done||done.error||!idsOf(getState()).includes(targetId))
           throw Error('재탐색 WASM 치환 결과 불일치');
         }else if(!['wash_to','skip'].includes(step.kind))
          throw Error('원본 재탐색 미지원 단계: '+step.kind);
         combined.push({...step,
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
          routes.push(actionsToRoute(combined,final,initial,native,
           desiredIds,'purple-between-replanned'));
          reportBest('anchor-between');
          diagnostics.replanComplete=(diagnostics.replanComplete||0)+1;
          break;
         }
         if(extra===horizon)break;
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
     actions.push({...originalActions[i],
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
     if(offset===horizon)break;
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
 const routes=[],diagnostics={method:'purple-anchor-nearest-native-wash',
  purpleTargets:shape.purple,colorTargets:shape.colors,
  purpleRoutes:0,replayed:0,failures:[],scannedWashes:0,
  windows:['purple-between','last-purple-after']};
 const reportBest=(phase)=>progress({phase,scannedWashes:diagnostics.scannedWashes,
  candidateRoutes:routes.length,bestPills:routes.length?
   Math.min(...routes.map(r=>r.pills)):null});

 let baseline=null;
 try{
  restore(initial);
  baseline=guard.run({getState,setState,search},
   {desired_ids:shape.purple,max_pad:maxPad,horizon,top_n:topN});
  diagnostics.purpleRoutes=baseline?.routes?.length||0;
  for(const native of baseline?.routes||[]){
   let replayed;
   const marks=[];
   try{replayed=replay(native,m=>marks.push(m));diagnostics.replayed++}
   catch(e){diagnostics.failures.push(String(e?.message||e));continue}
   const start=replayed.state;
   restore(start);
   // Freeze all purple anchors. Free only nonselected, replaceable slots.
   const fixed=getState();
   const slots=fixed.talents.map(t=>({...t,
    locked:shape.purple.includes(number(t.id))}));
   if(!setState({...fixed,talents:slots})){
    diagnostics.failures.push('자맥 확정 후 자유 슬롯 생성 실패');continue;
   }
   const tailActions=[...replayed.actions];
   for(const slot of fixed.talents){
    const id=number(slot.id);
    if(slot.locked&&!shape.purple.includes(id))
     tailActions.push({kind:'unlock',talent:talents[String(id)]?.name||String(id),
      wash_no:count(fixed,'total_wash')});
   }
   for(const id of shape.purple){
    if(!fixed.talents.find(t=>number(t.id)===id)?.locked)
     tailActions.push({kind:'lock',talent:talents[String(id)]?.name||String(id),
      wash_no:count(fixed,'total_wash')});
   }
   let seen=new Set(),stopped=false;
   const from=count(getState(),'total_wash');
   // Nearest following green/blue event wins for this purple backbone.
   for(let offset=1;offset<=horizon;offset++){
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
   if(!stopped&&!routes.length)diagnostics.failures.push(
    '자맥 확정 이후 '+horizon+'회 내 최종 녹·파맥 조합 미발견');
   // Also attempt the user-requested interval immediately after the
   // earlier purple anchors, before the last purple's next locked step.
   try{await searchBetween(native,marks,diagnostics,routes)}
   catch(error){diagnostics.failures.push('자맥 사이 구간: '+String(error?.message||error))}
   restore(initial);
  }
 }finally{restore(originalState)}
 routes.sort((a,b)=>a.pills-b.pills||a.washes-b.washes);
 return {routes:routes.slice(0,topN),scanned:diagnostics.scannedWashes,
  diagnostics,error:routes.length?null:'자맥 확정 후 녹·파맥 최종 보유 경로 미발견 (검색 범위 내)',
  nativePurpleScanned:baseline?.scanned??0};
}
root.YYWashPurpleAnchorMixed={requestShape,run};
})(window);
