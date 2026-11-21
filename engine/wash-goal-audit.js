/* Goal coverage of the current copied yy-sim WASM talent slots.
 * This does not claim to reproduce actual Korean-server completed Domakbeop. */
(function(root){
'use strict';
function parsePairs(text,allowed){
 const lines=String(text||'').trim().split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length||lines.length>4)throw Error('목표 자맥과 충돌맥은 1~4쌍 입력하세요');
 const ids=new Set(Array.isArray(allowed)?allowed.map(Number):[]);
 const result=lines.map(line=>{
  const m=/^(\d+)\s*:\s*(\d+)$/.exec(line);
  if(!m)throw Error('목표는 자맥ID:충돌맥ID 형식이어야 합니다');
  const purpleId=Number(m[1]),conflictId=Number(m[2]);
  if(!Number.isSafeInteger(purpleId)||!Number.isSafeInteger(conflictId)||
     purpleId<1||conflictId<1||(ids.size&&(!ids.has(purpleId)||!ids.has(conflictId))))
   throw Error('목표 자맥·충돌맥 ID가 원본 자색 재능 목록에 없습니다');
  return {purpleId,conflictId};
 });
 if(new Set(result.map(x=>x.purpleId)).size!==result.length)
  throw Error('같은 목표 자맥을 중복 입력할 수 없습니다');
 return result;
}
function evaluate(talents,pairs){
 if(!Array.isArray(talents))throw Error('원본 WASM 재능 슬롯을 확인할 수 없습니다');
 if(!Array.isArray(pairs)||pairs.length<1||pairs.length>4)
  throw Error('확인할 목표 자맥 목록이 없습니다');
 const source=talents.map((slot,i)=>({slot:i+1,id:Number(slot?.id),locked:slot?.locked===true}));
 const goals=pairs.map(pair=>{
  const hits=source.filter(x=>x.id===Number(pair.purpleId));
  return {purpleId:Number(pair.purpleId),conflictId:Number(pair.conflictId),
   present:hits.length>0,locked:hits.some(x=>x.locked),
   slots:hits.map(x=>x.slot)};
 });
 const found=goals.filter(g=>g.present).length,locked=goals.filter(g=>g.locked).length;
 return {goals,found,locked,missing:goals.filter(g=>!g.present).map(g=>g.purpleId),
  complete:found===pairs.length,distinctSlots:new Set(goals.flatMap(g=>g.slots)).size};
}
function progression(before,after,pairs){
 const first=evaluate(before,pairs),last=evaluate(after,pairs);
 const lost=first.goals.filter(g=>g.present&&!last.goals.some(x=>x.purpleId===g.purpleId&&x.present))
  .map(g=>g.purpleId);
 const gained=last.goals.filter(g=>g.present&&!first.goals.some(x=>x.purpleId===g.purpleId&&x.present))
  .map(g=>g.purpleId);
 return {before:first,after:last,lost,gained,preserved:lost.length===0};
}
root.NangmanWashGoal={parsePairs,evaluate,progression};
})(window);
