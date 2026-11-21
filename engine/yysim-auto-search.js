/* yy-sim automatic wash search result adapter.
 * Native search_wash_routes is the algorithm. This module formats actual
 * SearchReq/Route output, NEVER predicts steps or marks incomplete goals solved.
 */
(function(root){
'use strict';
const int=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))?Number(v):null;
const nonnegative=v=>{const n=int(v);return n!==null&&n>=0?n:null;};
function selectedIds(raw,allowed){
 const list=Array.isArray(raw)?raw:String(raw||'').split(/[\s,;]+/).filter(Boolean);
 const ids=list.map(int);
 const valid=new Set((allowed||[]).map(Number));
 if(ids.length<1||ids.length>4||ids.some(id=>id==null||id<1||
    (valid.size&&!valid.has(id)))||new Set(ids).size!==ids.length)
  throw Error('자동 탐색은 서로 다른 녹맥·파맥·자맥 재능을 1~4개 선택해야 합니다');
 return ids;
}
function options(raw,allowed){
 const ids=selectedIds(raw.desiredIds||[],allowed);
 const maxPad=int(raw.maxPad??20),horizon=int(raw.horizon??900),topN=int(raw.topN??8);
 if(maxPad==null||maxPad<0||maxPad>200||
    horizon==null||horizon<20||horizon>5000||
    topN==null||topN<1||topN>20)
  throw Error('원본 탐색의 선행 세수/탐색 범위/결과 개수 제한을 확인하세요');
 return {desiredIds:ids,maxPad,horizon,topN};
}
function routeOutcome(raw,selected){
 const ids=selectedIds(selected);
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.routes))
  throw Error('원본 WASM 자동 탐색 결과 형식을 확인할 수 없습니다');
 const routes=raw.routes.map((route,index)=>{
  const finalSlots=Array.isArray(route?.final_slots)?route.final_slots:[];
  const finalIds=finalSlots.map(s=>int(s?.id)).filter(x=>x!=null);
  const matchedIds=ids.filter(id=>finalIds.includes(id));
  const pills=nonnegative(route?.pills),washes=nonnegative(route?.washes),exchanges=nonnegative(route?.exchanges),pad=nonnegative(route?.pad);
  const isComplete=matchedIds.length===ids.length;
  const hasCost=pills!==null&&washes!==null&&exchanges!==null&&pad!==null;
  const hasSteps=Array.isArray(route?.actions)&&route.actions.length>0;
  const executable=isComplete&&hasCost&&(hasSteps||(washes===0&&exchanges===0&&pills===0&&pad===0));
  const warnings=[...(!hasCost?['원본 비용 정보 누락 또는 음수']:[]),
    ...(isComplete&&!hasSteps&&(washes!==0||exchanges!==0)?['원본 실행 단계 미제공']:[]),
    ...(route?.error?['원본 경로 오류: '+String(route.error)]:[])];
  return {index,source:route,
   goalIds:ids,finalIds,matchedIds,missingIds:ids.filter(id=>!finalIds.includes(id)),
   complete:isComplete,executable:executable&&!route?.error,warnings,estimatedPills:pills,estimatedWashes:washes,
   exchanges,pad,lockedSlots:finalSlots.filter(s=>s?.locked===true).length,
   finalSlots,actions:Array.isArray(route?.actions)?route.actions:[],
   steps:Array.isArray(route?.steps)?route.steps:[],
   stream:Array.isArray(route?.stream)?route.stream:[],
   orderIds:Array.isArray(route?.order_ids)?route.order_ids.map(Number):[],
   globallyOptimal:route?.optimal===true};
 });
 routes.sort((a,b)=>{
  if(a.complete!==b.complete)return a.complete?-1:1;
  // A cheap valid native path must never be outranked by a more expensive
  // path merely because our separate replay bridge supports its actions.
  for(const key of ['estimatedPills','estimatedWashes','exchanges','pad']){
   const av=a[key],bv=b[key];
   if(av==null&&bv!=null)return 1;
   if(bv==null&&av!=null)return -1;
   if(av!=null&&bv!=null&&av!==bv)return av-bv;
  }
  if(a.executable!==b.executable)return a.executable?-1:1;
  return a.index-b.index;
 });
 const stats={scanned:int(raw.scanned)??0,total:routes.length,
  complete:routes.filter(r=>r.complete).length,
  actionable:routes.filter(r=>r.executable).length,
  error:typeof raw.error==='string'?raw.error:null,
  missing:Array.isArray(raw.missing)?raw.missing.length:0};
 return {routes,stats,selectedIds:ids};
}
function statusText(result){
 if(result.stats.complete)return '원본 WASM에서 모든 선택 목표가 최종 재능 슬롯에 존재하는 경로 후보를 찾았습니다. 전역 최적 경로라는 뜻은 아닙니다.';
 if(result.stats.error)return '설정한 탐색 범위에서 목표 재능을 모두 확보하는 경로가 발견되지 않았습니다. 자동 탐색 범위 안에서 찾지 못한 결과이며, 목표 선택을 변경해 다시 확인할 수 있습니다.';
 return '현재 검색 조건의 원본 WASM 경로 후보가 없습니다.';
}
function readableStep(value,known={},nameFor=()=>null){
 if(value==null)return '단계 정보 없음';
 if(typeof value==='number'||typeof value==='boolean')return String(value);
 const source=typeof value==='string'?value:JSON.stringify(value);
 if(!source)return '원본 단계 정보 없음';
 let text=source;
 for(const [ch,id] of Object.entries(known).sort((a,b)=>b[0].length-a[0].length)){
  if(ch)text=text.split(ch).join(String(nameFor(Number(id))||'재능 #'+id)+' (#'+id+')');
 }
 // Avoid presenting untranslated Chinese as verified Korean instructions.
 return text.replace(/[\u3400-\u9fff]+/g,'원본 지시 미번역');
}
function describeAction(action,nameIds={},nameFor=()=>null){
 const number=int(action?.pills_after),wash=int(action?.wash_no),roll=int(action?.roll_idx);
 const talent=(raw)=>{
  if(!raw)return '재능 미확인';
  const linked=nameIds?.[String(raw)];
  const direct=/^\d+$/.test(String(raw))?Number(raw):null;
  const id=linked!=null?Number(linked):direct;
  if(!Number.isSafeInteger(id)||id<=0)return '원본 재능 ID 미연결';
  const localized=String(nameFor(id)||'').trim();
  return (localized&&localized!=='재능 #'+id?localized:'재능 #'+id)+' (#'+id+')';
 };
 let label='원본 경로 단계',detail='';
 switch(String(action?.kind||'')){
  case 'lock':label='잠금';detail=talent(action.talent);break;
  case 'unlock':label='잠금 해제';detail=talent(action.talent);break;
  case 'open_slot':{
   label='재능 슬롯 개방';
   const hint=String(action?.note||'').match(/15[0-4]/);
   detail=hint?'자질 '+hint[0]+' · 슬롯 '+(Number(hint[0])-150)+'칸':'자질·재료 조건을 게임에서 확인';
   break;
  }
  case 'wash_to':label='모의 세수';detail=wash==null?'원본 지정 회차':wash+'회차까지';break;
  case 'wash_until':label='목표 재능까지 모의 세수';detail=talent(action.talent)+' · '+String(action.note||'원본 WASM 단계');break;
  case 'exchange':{
   const chain=Array.isArray(action.chain)?action.chain.map(talent):[];
   label=chain.length>1?'연쇄 치환':'치환';
   detail=talent(action.from)+' → '+talent(action.to||action.talent)+
    (chain.length>1?' · 원본 연쇄 '+chain.join(' → '):'');
   break;
  }
  case 'keep':label='재능 보존';detail=talent(action.talent);break;
  case 'skip':label='건너뛰기';detail=talent(action.talent);break;
 }
 return {label,detail,pills:number,wash,roll,kind:String(action?.kind||'')};
}
const quality={248:true,249:true,250:true};
function previewTarget(preview,selectedWashNos){
 const source=Array.isArray(preview?.purples)?preview.purples:[];
 const selected=[...new Set(selectedWashNos.map(Number))].sort((a,b)=>a-b);
 if(selected.length<1||selected.length>4)
  throw Error('원본 자맥 시퀀스에서 1~4개 회차를 선택하세요');
 return selected.map((washNo,index)=>{
  const purple=source.find(p=>Number(p.wash_no)===washNo);
  if(!purple||!purple.talent_name)
   throw Error('선택한 자맥 회차가 현재 미리보기에 없습니다');
  const shenmai=!!quality[Number(purple.talent_id)];
  if(!purple.can_exchange&&!shenmai)
   throw Error('원본에서 치환 불가능한 자맥은 연동 치환 시퀀스 대상이 아닙니다');
  if(!purple.earlier_conflict_name&&!shenmai)
   throw Error('선행 충돌맥이 없는 일반 자맥은 연동 치환을 계산할 수 없습니다');
  const lockOnly=shenmai&&!purple.earlier_conflict_name;
  return {purple_name:purple.talent_name,
   conflict_name:purple.earlier_conflict_name||'',
   conflict_wash_no:!lockOnly&&index===0?(int(purple.earlier_conflict_wash_times)??0):0,
   lock_only:lockOnly,wash_no:washNo};
 });
}
function previewPadLimit(washNos){
 const ids=[...washNos].map(Number).sort((a,b)=>a-b);
 if(ids.length<2)return 30;
 return Math.max(0,Math.min(200,ids[1]-ids[0]-1));
}
root.YYWashAutoSearch={selectedIds,options,routeOutcome,statusText,readableStep,
 describeAction,previewTarget,previewPadLimit};
})(window);
