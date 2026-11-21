/* v0.8.4: shared equipment detail entry, without modifying native RNG. */
(function(){
'use strict';
const ko=v=>window.SBJ_KOREAN?.translate?.(String(v||''))||String(v||'');
const escapes=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dataFor(item){
 const id=Number(item?.id??item?.equip_id??item?.equipId??item?.ID);
 const cfg=window.EQUIP_DATA?.equipment?.[String(id)]||{};
 return {id,cfg,color:Number(item?.color??item?.Color??0),item};
}
function open(item){
 const {id,cfg,color}=dataFor(item);
 if(!id||!cfg.id)return false;
 // Embedded in the simulator: navigate to the integrated full-page detail,
 // preserving previous search and save state; never open the old modal.
 if(window.parent!==window&&window.NANGMAN_EMBEDDED_EQUIP){
  window.parent.postMessage({kind:'nangman-equip-open-detail',equipment:{
   ID:id,Color:color,OnlyID:item?.OnlyID??item?.only_id??item?.onlyId,
   CZSeed:item?.CZSeed,MJSeed:item?.MJSeed,S:item?.S
  }},location.origin);
  return true;
 }
 const type=Number(cfg.type||0),weapon=type>=1&&type<=4,orange=color===5||Number(cfg.weapon_color)===5;
 const name=String(cfg.koName||ko(cfg.name)||'장비 #'+id);
 document.querySelector('#nangmanEquipmentDialog')?.remove();
 const wrap=document.createElement('div');wrap.id='nangmanEquipmentDialog';wrap.className='nangman-equipment-backdrop';
 wrap.innerHTML='<section class="nangman-equipment-dialog" role="dialog" aria-modal="true" aria-label="장비 상세">'+
  '<header><div><small>장비 상세</small><h2>'+escapes(name)+'</h2><span>ID '+id+' · '+(Number(cfg.lv)||'—')+'레벨 · '+escapes(ko(window.EQUIP_DATA?.typeNames?.[String(type)]||''))+'</span></div><button class="nangman-detail-close" aria-label="닫기" type="button">×</button></header>'+
  '<div class="nangman-detail-content">'+
  '<div class="nangman-detail-status"><b>정련</b><span>'+(orange?'주황 장비는 정련 불가':'정련 시퀀스 계산 가능')+'</span></div>'+
  '<div class="nangman-detail-status"><b>촉련</b><span>'+(weapon?'무기: 촉련 가능':'촉련 불가 · 무기 전용')+'</span></div>'+
  '<div class="nangman-detail-status"><b>망정</b><span>'+(orange?'주황 장비는 일반 망정 예측 대상 제외':'제작 후 장비별 시드로 계산')+'</span></div>'+
  '<div class="nangman-detail-actions">'+
    (orange?'':'<button data-target="manual" type="button">정련 화면</button><button data-target="auto" type="button">망정·정련 탐색</button>')+
    (weapon?'<button data-target="manual" type="button">촉련 화면</button>':'')+
    '<button data-target="region" type="button">지역별 제작</button></div>'+
  '<p class="nangman-detail-note">정확한 옵션·순서를 조회하려면 현재 세이브를 바탕으로 해당 계산 화면에서 장비를 선택하세요. 임의 수치는 표시하지 않습니다.</p>'+
  '</div></section>';
 document.body.append(wrap);
 const close=()=>wrap.remove();
 wrap.querySelector('.nangman-detail-close').onclick=close;
 wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
 wrap.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{
  const target=b.dataset.target;close();
  if(window.parent!==window)window.parent.postMessage({kind:'nangman-equip-navigate',target,id},location.origin);
  else document.dispatchEvent(new CustomEvent('nangman-equip-navigate',{detail:{target,id}}));
 });
 const esc=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',esc)}};
 document.addEventListener('keydown',esc);
 return true;
}

document.addEventListener('click',event=>{
 const btn=event.target.closest?.('[data-nangman-equipment-id]');
 if(btn){
  event.preventDefault();event.stopPropagation();
  open({id:Number(btn.dataset.nangmanEquipmentId),color:Number(btn.dataset.nangmanEquipmentColor||0)});
  return;
 }
 // In native crafting results, the index column opens the produced equipment.
 const cell=event.target.closest?.('tr[data-make-index] > td:first-child');
 if(cell&&typeof currentMakeRequest==='function'){
  const req=currentMakeRequest();
  if(req?.equip_id){open({id:req.equip_id,color:Number(cell.parentElement.querySelector('[class*="color-"]')?.className.match(/color-(\\d+)/)?.[1]||0)});return}
 }
 const bag=event.target.closest?.('.crafted-bag-row .bag-meta');
 if(bag&&typeof findEquipByOnlyId==='function'){
  const eq=findEquipByOnlyId(bag.closest('[data-only-id]')?.dataset.onlyId);
  if(eq)open(eq);
 }
});
window.NangmanEquipmentDetail=Object.freeze({open});
})();