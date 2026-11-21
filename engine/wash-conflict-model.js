/* Read-only Korean view over real yy-sim WASM get_conflicts/get_available_talents. */
(function(root){
'use strict';
const number=value=>value!=null&&value!==''&&Number.isInteger(Number(value))&&Number(value)>=0?Number(value):null;
function summarize(result,talents,purpleIds,nameOf){
 const slots=Array.isArray(talents)?talents:[];
 const allowed=Array.isArray(purpleIds)?purpleIds:[];
 const list=Array.isArray(result?.available)?result.available:[];
 const available=new Set(list.map(x=>number(x?.id??x)).filter(x=>x!=null));
 const purple=allowed.map(id=>({id:Number(id),name:typeof nameOf==='function'?nameOf(id):'재능 #'+id,
  available:available.has(Number(id))}));
 const original=Array.isArray(result?.conflicts)?result.conflicts:[];
 const conflicts=original.map((v,i)=>{
  if(!v)return {slot:i+1,known:false};
  const slot=number(v.index)??i;
  const earlier=number(v.earlier_index);
  const active=slots[slot],prior=earlier!=null?slots[earlier]:null;
  const activeId=number(active?.id),priorId=number(prior?.id);
  return {slot:slot+1,known:true,id:activeId,
   name:activeId!=null?(typeof nameOf==='function'?nameOf(activeId):'재능 #'+activeId):'재능 슬롯 미확인',
   earlierSlot:earlier!=null?earlier+1:null,earlierId:priorId,
   earlierName:priorId!=null?(typeof nameOf==='function'?nameOf(priorId):'재능 #'+priorId):'원본 충돌맥 명칭 미연결',
   canExchange:v.can_exchange===true};
 });
 return {purple,conflicts,sourceAvailableCount:list.length,sourceConflictsCount:original.length};
}
root.NangmanWashConflicts={summarize};
})(window);
