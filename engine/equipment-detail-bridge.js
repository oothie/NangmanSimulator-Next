/* Native equipment calculation bridge: same-origin, read-only predictions.
 * All RNG, refinement, quenching and special-attach computations remain native.
 * Refuse ambiguous save instances instead of silently choosing the first item.
 */
(function(){
'use strict';
let pending=null,lastSignature='';
const origin=location.origin;
const emit=(status,message,extra={})=>{
 if(window.parent!==window)window.parent.postMessage({
  kind:'nangman-equip-detail-status',status,message,...extra
 },origin);
};
const number=(x,defaultValue)=>Number.isFinite(Number(x))?Number(x):defaultValue;
function uniqueInstance(snapshot){
 if(typeof saveEquips==='undefined'||!Array.isArray(saveEquips)||typeof saveLoaded==='undefined'||!saveLoaded)
  return {error:'세이브 장비 계산 엔진이 아직 준비되지 않았습니다.'};
 const id=number(snapshot?.ID??snapshot?.id,0);
 if(!id)return {error:'장비 ID가 없습니다.'};
 let matches=saveEquips.filter(eq=>Number(eq.id)===id);
 if(!matches.length)return {error:'세이브에 해당 장비가 없습니다. 먼저 보유 장비에서 선택하거나 모의 제작을 진행하세요.'};
 const onlyId=number(snapshot?.OnlyID??snapshot?.only_id??snapshot?.onlyId,0);
 if(onlyId){
  const exact=matches.filter(eq=>Number(eq.only_id)===onlyId);
  if(exact.length===1)return {equip:exact[0]};
  if(!exact.length)return {error:'선택한 장비의 고유 ID가 세이브에 없습니다. 다른 장비를 임의 선택하지 않습니다.'};
 }
 const seedFields=[['CZSeed','CZSeed'],['MJSeed','MJSeed'],['S','S']];
 const present=seedFields.filter(([raw])=>snapshot?.[raw]!=null);
 if(present.length){
  const exact=matches.filter(eq=>present.every(([raw,normal])=>Number(eq[normal])===Number(snapshot[raw])));
  if(exact.length===1)return {equip:exact[0]};
  if(exact.length===0)return {error:'장비의 시드가 현재 세이브와 일치하지 않습니다.'};
  matches=exact;
 }
 if(matches.length===1)return {equip:matches[0]};
 return {error:'동일한 장비가 '+matches.length+'개 있어 구분할 수 없습니다. 보유 장비에서 고유 ID가 있는 항목을 선택하세요.'};
}
function selectByRuntime(id,key){
 const el=document.getElementById(id);
 if(!el)return false;
 const option=[...el.options].find(o=>o.value===key);
 if(!option)return false;
 el.value=key;
 el.dispatchEvent(new Event('change',{bubbles:true}));
 return true;
}
function resetFilters(){
 for(const id of ['xilianSourceFilter','strongSourceFilter','shenglianSourceFilter']){
  const field=document.getElementById(id);
  if(field&&[...field.options].some(o=>o.value==='all'))field.value='all';
 }
 for(const id of ['xilianTextFilter','strongTextFilter','shenglianTextFilter']){
  const field=document.getElementById(id);if(field)field.value='';
 }
}
function preview(snapshot,mode,count){
 const found=uniqueInstance(snapshot);
 if(!found.equip){emit('unavailable',found.error||'세이브 장비를 확인할 수 없습니다.');return false}
 const eq=found.equip,key=runtimeKey(eq);
 const n=Math.max(1,Math.min(5000,Math.floor(number(count,20))));
 resetFilters();
 if(typeof fillEquipSelects==='function')fillEquipSelects(true);
 const orange=Number(eq.color)===5||Number(eq.color)===6;
 const isWeapon=Number(eq.typ)>=1&&Number(eq.typ)<=4;
 let tab='',selectId='',countId='',buttonId='';
 if(mode==='refine'){
  if(orange){emit('unavailable','이 장비는 주황·적색 등급으로 일반 정련 대상이 아닙니다.');return false}
  if(typeof canShengLian==='function'&&canShengLian(eq)){
   tab='shenglian';selectId='shenglianEquipSelect';
   switchTab(tab);if(typeof fillEquipSelects==='function')fillEquipSelects(true);
   selectByRuntime(selectId,key);
   emit('needs-ascend','90레벨 장비입니다. 100레벨 승련 후 정련할 수 있습니다. 승련은 별도 모의 조작이므로 자동 실행하지 않았습니다.');
   return true;
  }
  tab='xilian';selectId='xilianEquipSelect';countId='xilianCount';buttonId='btnXilianPreview';
 }else if(mode==='strong'){
  if(!isWeapon){emit('unavailable','촉련은 무기에만 적용됩니다.');return false}
  tab='strong';selectId='strongEquipSelect';countId='strongCount';buttonId='btnStrongPreview';
 }else if(mode==='mangjing'){
  if(typeof canPredictSpecialAttach!=='function'||!canPredictSpecialAttach(eq)){
   emit('unavailable','이 장비의 망정 시드 또는 호환 재료가 없어 예측할 수 없습니다.');return false;
  }
  tab='make';selectId='specialAttachEquipSelect';countId='specialAttachCount';buttonId='btnSpecialAttachPreview';
 }else{emit('error','지원하지 않는 계산 모드입니다.');return false}
 if(typeof switchTab==='function')switchTab(tab);
 if(typeof fillEquipSelects==='function')fillEquipSelects(true);
 if(!selectByRuntime(selectId,key)){
  emit('unavailable','해당 장비가 '+({refine:'정련',strong:'촉련',mangjing:'망정'}[mode]||'')+' 가능 목록에 없습니다.');
  return false;
 }
 const countField=document.getElementById(countId);
 if(countField)countField.value=String(Math.max(number(countField.min,1),n));
 if(mode==='mangjing'&&typeof fillSpecialAttachMaterialSelect==='function')fillSpecialAttachMaterialSelect(true);
 const button=document.getElementById(buttonId);
 if(!button){emit('error','예측 실행 버튼을 찾을 수 없습니다.');return false}
 try{
  button.click();
  emit('preview','선택 장비의 '+({refine:'정련',strong:'촉련',mangjing:'망정'}[mode])+
    ' 예측 '+n+'회 계산을 요청했습니다. 아래 결과에서 단계별 옵션과 소모를 확인하세요.',{
    equipmentId:eq.id,onlyId:eq.only_id,mode,count:n
   });
  document.getElementById(tab==='make'?'specialAttachMaterialSelect':'tabBar')?.scrollIntoView({block:'nearest'});
  return true;
 }catch(error){emit('error','계산 오류: '+String(error.message||error));return false}
}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==origin||event.data?.kind!=='nangman-equip-focus')return;
 const d=event.data;
 const token=JSON.stringify([d.equipment?.ID??d.equipment?.id,d.equipment?.OnlyID,d.equipment?.CZSeed,d.equipment?.MJSeed,d.mode,d.count,d.version]);
 if(token===lastSignature&&d.force!==true)return;
 pending={equipment:d.equipment,mode:d.mode,count:d.count,token};
 attempt();
});
function attempt(){
 if(!pending)return;
 if(typeof saveLoaded==='undefined'||!saveLoaded||typeof fillEquipSelects!=='function'){
  emit('waiting','장비 세이브 로딩을 확인하고 있습니다.');return;
 }
 const current=pending;pending=null;
 if(preview(current.equipment,current.mode,current.count))lastSignature=current.token;
}
window.addEventListener('nangman-equipment-save-applied',()=>{lastSignature='';attempt()});
})();
