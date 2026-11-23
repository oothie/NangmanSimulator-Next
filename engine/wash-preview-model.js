/* Original yy-sim WASM purple sequence projection: UI-only formatting.
 * wash_no = source event number, wash_times = actual wash cycle count.
 * No prediction or fabricated roll result is calculated here. */
(function(root){
'use strict';
const validInt=value=>Number.isSafeInteger(Number(value))&&value!==null&&value!==''?Number(value):null;
function normalize(preview){
 const list=preview?.purples;
 if(!Array.isArray(list))throw Error('원본 WASM 자맥 시퀀스 형식을 확인할 수 없습니다');
 return list.map((row,index)=>({
  index:index+1,
  event:validInt(row.wash_no),
  washes:validInt(row.wash_times),
  pills:validInt(row.cumulative_pills),
  gapPills:validInt(row.pills_from_previous_purple),
  id:validInt(row.talent_id),
  sourceName:typeof row.talent_name==='string'?row.talent_name:'',
  conflict:typeof row.earlier_conflict_name==='string'?row.earlier_conflict_name:'',
  conflictEvent:validInt(row.earlier_conflict_wash_no),
  conflictWashes:validInt(row.earlier_conflict_wash_times),
  exchangeable:row.can_exchange===true,
  pity:row.was_pity===true,
  landed:row.already_landed===true,
  reason:typeof row.block_reason==='string'?row.block_reason:null,
  original:row
 }));
}
function filter(rows,choice='all'){
 if(!['all','exchange','blocked','pity','landed'].includes(choice))
  throw Error('자맥 필터가 올바르지 않습니다');
 return rows.filter(row=>choice==='all'?true:choice==='exchange'?row.exchangeable:
  choice==='blocked'?!row.exchangeable:choice==='pity'?row.pity:row.landed);
}
function display(sourceName,nameIds,nameOf){
 if(!sourceName)return '—';
 const id=nameIds?.[sourceName];
 if(id!==undefined){
  const label=typeof nameOf==='function'?nameOf(Number(id)):'재능 #'+id;
  return label+' (#'+id+')';
 }
 return /[\u3400-\u9fff]/.test(sourceName)?'재능명 미연결':sourceName;
}
function csv(rows,names={},nameOf){
 const quote=value=>{
  let s=String(value??'');
  if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 const headers=['원본 이벤트 번호','모의 세수 회차','누적 세수단','전 자맥 이후 단약','재능 ID','재능 이름','선행 충돌맥','선행 충돌 회차','치환 가능','천장','이미 획득','결과 상태'];
 const out=[headers.map(quote).join(',')];
 for(const row of rows)out.push([
  row.event,row.washes,row.pills,row.gapPills,row.id,
  display(row.sourceName,names,nameOf),
  display(row.conflict,names,nameOf),row.conflictWashes,
  row.exchangeable?'가능':'불가',row.pity?'천장':'',row.landed?'획득':'',
  'yy-sim WASM 가상 결과 · 한국판 실게임 미검증'
 ].map(quote).join(','));
 return '\uFEFF'+out.join('\r\n')+'\r\n';
}
root.NangmanWashPreview={normalize,filter,display,csv};
})(window);
