/* Save-backed hypothetical field/dungeon receipt order, never final refine predictions. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const ko=value=>window.SBJ_KOREAN?.translate?.(String(value??''))||String(value??'');
const fieldCatalog=window.SBJWildCatalog.filter(x=>x.kind==='story'&&Number(x.lv)>=90);
const dungeonCatalog=window.SBJDungeonCatalog.filter(x=>Array.isArray(x.outer)&&x.outer.length&&x.equip?.ids?.length);
let archive=null,projected=null;
const inputs=['sharedWildTarget','sharedDungeonTarget','sharedWildCount','sharedDungeonCount','sharedOrder'];
const gearName=id=>{
 const gear=window.EQUIP_DATA?.equipment?.[id];
 return gear?.koName||ko(gear?.name||'장비 #'+id);
};
const colors={1:'흰색',2:'녹색',3:'청색',4:'자색'};
fieldCatalog.forEach((x,index)=>$('sharedWildTarget').add(new Option(
 ko(x.location)+' · '+ko(x.name)+' (NPC '+x.npcId+')',index)));
dungeonCatalog.forEach((x,index)=>$('sharedDungeonTarget').add(new Option(
 ko(x.dungeon)+' · '+ko(x.boss)+' ('+x.id+')',index)));
const preferredField=fieldCatalog.findIndex(x=>x.npcId===32299);
if(preferredField>=0)$('sharedWildTarget').value=String(preferredField);
function reset(){
 projected=null;
 $('sharedExport').disabled=true;
 $('sharedTable').hidden=true;
 $('sharedRows').replaceChildren();
 $('sharedScenarioTable').hidden=true;
 $('sharedScenarioRows').replaceChildren();
 $('sharedStatus').textContent='';
 $('sharedByItem').textContent='';
}
function ready(){
 reset();
 let source;
 try{source=window.loadShareStore?.()?.data??null}catch(_){source=null}
 archive=source;
 const wild=fieldCatalog[Number($('sharedWildTarget').value)];
 const dungeon=dungeonCatalog[Number($('sharedDungeonTarget').value)];
 if(!archive||!wild||!dungeon){
  $('sharedRun').disabled=true;
  $('sharedStatus').textContent='세이브와 필드·관문 대상을 선택하세요';
  return;
 }
 const field=window.SBJWildDrop.open(archive,wild);
 const d=window.SBJDungeonDrop.open(archive);
 const missing=window.SBJDungeonDrop.missing(d,dungeon);
 $('sharedRun').disabled=!window.SBJWildDrop.usable(field.seed)||missing.length>0;
 if($('sharedRun').disabled)
  $('sharedStatus').textContent='세이브에 해당 보상 원본 시드가 없습니다: '+missing.join(', ');
}
function cell(text){
 const td=document.createElement('td');td.textContent=String(text??'');return td;
}
$('sharedGearForm').onsubmit=evt=>{
 evt.preventDefault();
 reset();
 try{
  if(!archive)throw Error('먼저 한국판 세이브를 불러오세요');
  const wild=fieldCatalog[Number($('sharedWildTarget').value)];
  const dungeon=dungeonCatalog[Number($('sharedDungeonTarget').value)];
  const fieldCount=Number($('sharedWildCount').value),dungeonCount=Number($('sharedDungeonCount').value);
  const output=window.SBJSharedGearCore.project(archive,wild,dungeon,fieldCount,dungeonCount,
   $('sharedOrder').value,window.EQUIP_DATA.equipment);
  projected=output;
  $('sharedStatus').textContent='가상 보상 호출 '+output.events+'회 · 계획 내 90급 장비 '+
   output.total90+'개 · 장비 ID '+output.byItem.length+'종 · 실제 게임 옵션 및 색상 순서는 미검증';
  $('sharedByItem').textContent='장비별 계획 내 등장 횟수 · '+
   output.byItem.map(x=>gearName(x.id)+' (#'+x.id+') '+x.count+'회'+
    (x.hasSharedSeed?' · 원본 Eds 확인':' · 원본 Eds 없음')).join(' / ');
  const rows=output.equipment.slice(0,200);
  $('sharedRows').replaceChildren(...rows.map(row=>{
   const tr=document.createElement('tr');
   tr.append(cell(row.step),cell(row.source==='field'?'필드 특수몹 보상':'관문 우두머리 보상'),
    cell(row.round),cell(row.itemId+' · '+gearName(row.itemId)),
    cell(colors[row.color]||'미확인'),cell('현재 세이브 이후 계획 내 '+row.inPlan+'번째'),
    cell(row.hasSharedSeed?'원본 Eds 확인':'원본 Eds 없음'));
   return tr;
  }));
  $('sharedTable').hidden=rows.length===0;
  const alternatives=Array.isArray(output.alternatives)?output.alternatives:[];
  const formatFirst=order=>{
   if(order?.firstStep==null)return '획득 없음';
   const source=order.firstSource==='field'?'필드':'관문';
   return source+' · 전체 '+order.firstStep+'번째 보상'+
     (order.colorSequence.length?' · '+(colors[order.colorSequence[0]]||'색상 미확인'):'');
  };
  $('sharedScenarioRows').replaceChildren(...alternatives.map(entry=>{
   const tr=document.createElement('tr');
   tr.append(cell(entry.itemId+' · '+gearName(entry.itemId)),cell(entry.count),
    ...entry.orders.map(formatFirst).map(cell));
   return tr;
  }));
  $('sharedScenarioTable').hidden=alternatives.length===0;
  if(rows.length===0)$('sharedStatus').textContent+=' · 이 계획에는 장비 드랍 예상이 없습니다';
  $('sharedExport').disabled=rows.length===0;
 }catch(err){$('sharedStatus').textContent=String(err.message||err)}
};
$('sharedExport').onclick=()=>{
 try{
  if(!projected?.equipment.length)throw Error('먼저 순서 계산을 실행하세요');
  const columns=[
   {title:'가상 보상 순번',key:'step'},
   {title:'보상 출처',value:x=>x.source==='field'?'필드 특수몹 보상':'관문 우두머리 보상'},
   {title:'출처 회차',key:'round'},
   {title:'90급 장비 ID',key:'itemId'},
   {title:'한국판 장비 이름',value:x=>gearName(x.itemId)},
   {title:'가상 예상 색상 미검증',value:x=>colors[x.color]||''},
   {title:'동일 장비의 계획 내 획득 순번',key:'inPlan'},
   {title:'현재 세이브에 장비 ID별 Eds 존재',value:x=>x.hasSharedSeed?'있음':'없음'},
   {title:'한계',value:()=> '현재 세이브 이후 선택한 가상 보상 순서에 한정 · 실게임 품질/정련/망정 미검증'}
  ];
  window.SBJDropExport.save('Nangman_Shared_Equipment_Order',columns,projected.equipment);
 }catch(err){$('sharedStatus').textContent=String(err.message||err)}
};
inputs.forEach(id=>$(id).addEventListener('change',ready));
document.addEventListener('yyjh-save',ready);
ready();
})();