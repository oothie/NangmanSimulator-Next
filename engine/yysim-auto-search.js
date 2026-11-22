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
// Use the same original WASM search horizon for purple and mixed-grade goals.
// The four-target 1121 path may need more than 1,770 native washes.
function recommendedHorizon(ids,catalog){return 2500;}
// Native messages are untrusted diagnostics, not user-facing Korean copy.
// Preserve already-localized messages and convert all other languages into
// meaningful Korean statuses without showing raw WASM text.
function koreanError(value,fallback='원본 세수 자동탐색에서 오류가 발생했습니다.'){
 const raw=typeof value==='string'?value:String(value?.message??value??'').trim();
 if(!raw)return fallback;
 const ko=/[가-힣]/.test(raw), han=/[\u3400-\u9fff]/.test(raw);
 const full=raw.toLowerCase();
 if(/global_vars|state restore|restore failed|状态恢复|恢复失败|复原失败/.test(full))
  return '원본 WASM의 세수 상태를 복원하지 못했습니다. 세이브를 다시 연결한 뒤 재시도하세요.';
 if(/timeout|time.?out|超时|시간 초과/.test(full))
  return '원본 세수 자동탐색 시간이 초과되었습니다. 현재 캐릭터와 세이브 상태를 다시 확인하세요.';
 if(/same type|same family|conflict|冲突|同类|동일 계열/.test(full))
  return '선택한 재능끼리 충돌하거나 동일 계열이라 최종 슬롯에 함께 보유할 수 없습니다.';
 if(/not found|no route|not reachable|未找到|找不到|无解|没有找到|无法找到|탐색 범위|경로 없음/.test(full))
  return '선택한 재능을 모두 보유하는 경로를 설정한 세수 범위에서 찾지 못했습니다.';
 if(/unsupported|not supported|不支持|不允许|不合法|invalid request|非法|无效/.test(full))
  return '원본 WASM이 선택한 재능 조합 또는 탐색 요청을 지원하지 않습니다.';
 if(/out of memory|memory allocation|内存不足|메모리 부족/.test(full))
  return '세수 탐색에 필요한 메모리가 부족합니다. 페이지를 새로고침한 뒤 다시 시도하세요.';
 if(/wasm|panic|unreachable|abort|failed|error|exception|错误|失败|异常/.test(full)&&!ko)
  return '원본 WASM 자동탐색 실행 중 오류가 발생했습니다. 세이브와 선택 재능을 확인하세요.';
 if(ko&&!han&&!/[\u0400-\u04ff]/.test(raw))return raw;
 return fallback;
}
function options(raw,allowed){
 const ids=selectedIds(raw.desiredIds||[],allowed);
 const maxPad=int(raw.maxPad??0),horizon=int(raw.horizon??900),topN=int(raw.topN??8);
 if(maxPad==null||maxPad<0||maxPad>200||
    horizon==null||horizon<20||horizon>5000||
    topN==null||topN<1||topN>20)
  throw Error('자동탐색 범위와 결과 개수 제한을 확인하세요');
 return {desiredIds:ids,maxPad,horizon,topN};
}
function routeOutcome(raw,selected){
 const ids=selectedIds(selected);
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.routes))
  throw Error('원본 WASM 자동 탐색 결과 형식을 확인할 수 없습니다');
 const routes=raw.routes.map((route,index)=>{
  const finalSlots=Array.isArray(route?.final_slots)?route.final_slots:[];
  const finalIds=finalSlots.map(s=>int(s?.id)).filter(x=>x!=null);
  // An observed transient goal is NEVER a complete result: all requested
  // talents must coexist in the final WASM slot state.
  const intermediate=false;
  const matchedIds=ids.filter(id=>finalIds.includes(id));
  const pills=nonnegative(route?.pills),washes=nonnegative(route?.washes),exchanges=nonnegative(route?.exchanges),pad=nonnegative(route?.pad);
  const isComplete=matchedIds.length===ids.length;
  const hasCost=pills!==null&&washes!==null&&exchanges!==null&&pad!==null;
  const hasSteps=Array.isArray(route?.actions)&&route.actions.length>0;
  const executable=isComplete&&hasCost&&(hasSteps||(washes===0&&exchanges===0&&pills===0&&pad===0));
  const warnings=[...(!hasCost?['원본 비용 정보 누락 또는 음수']:[]),
    ...(isComplete&&!hasSteps&&(washes!==0||exchanges!==0)?['원본 실행 단계 미제공']:[]),
    ...(route?.error?['원본 경로 오류: '+koreanError(route.error)]:[])];
  return {index,source:route,
   goalIds:ids,finalIds,matchedIds,missingIds:ids.filter(id=>!matchedIds.includes(id)),intermediateGoals:intermediate,
   acquiredEvents:Array.isArray(route?.acquired_events)?route.acquired_events:[],
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
  error:typeof raw.error==='string'?koreanError(raw.error):null,
  missing:Array.isArray(raw.missing)?raw.missing.length:0};
 return {routes,stats,selectedIds:ids};
}
function statusText(result){
 if(result.stats.complete)return '실제 WASM 세수에서 선택한 재능이 최종 슬롯에 모두 남는 경로를 찾았습니다. 세수단 오름차순으로 표시하며, 전체 가능한 치환 경로의 전역 최솟값은 아직 보장하지 않습니다.';
 if(result.stats.error)return '선택한 맥이 최종 슬롯에 모두 남는 경로를 찾지 못했습니다. '+result.stats.error+' · 재능 잠금·치환을 포함한 전체 최적 탐색은 아직 지원 범위가 제한되어 있습니다.';
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
  const koreanMatches=linked==null&&direct==null?
   [...new Set(Object.values(nameIds).map(Number).filter(id=>
    Number.isSafeInteger(id)&&String(nameFor(id)||'')===String(raw)))]:[];
  const id=linked!=null?Number(linked):direct??(koreanMatches.length===1?koreanMatches[0]:null);
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
root.YYWashAutoSearch={selectedIds,options,recommendedHorizon,koreanError,routeOutcome,statusText,readableStep,
 describeAction,previewTarget,previewPadLimit};
})(window);
