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
 const initial=getState();
 if(!initial)throw Error('세이브 기반 원본 세수 상태가 없습니다');
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
 const routes=[],diagnostics={method:'purple-anchor-nearest-native-wash',
  purpleTargets:shape.purple,colorTargets:shape.colors,
  purpleRoutes:0,replayed:0,failures:[],scannedWashes:0,
  windows:['purple-between','last-purple-after']};
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
   restore(initial);
  }
 }finally{restore(initial)}
 routes.sort((a,b)=>a.pills-b.pills||a.washes-b.washes);
 return {routes:routes.slice(0,topN),scanned:diagnostics.scannedWashes,
  diagnostics,error:routes.length?null:'자맥 확정 후 녹·파맥 최종 보유 경로 미발견 (검색 범위 내)',
  nativePurpleScanned:baseline?.scanned??0};
}
root.YYWashPurpleAnchorMixed={requestShape,run};
})(window);
