/* v0.8.4 finder UI facade over the native, save-backed optimizer */
(function(){
'use strict';
function start(){
 const title=document.getElementById('aiPredictionTitle');
 if(title)title.textContent='장비 찾기';
 const intro=document.querySelector('.ai-prediction-intro');
 if(intro)intro.textContent='원하는 장비의 지역·도면·옵션과 제작·정련·망정 범위를 선택해 찾습니다.';
 const button=document.getElementById('btnAutoEquipPredict');
 if(button)button.textContent='장비 찾기';
 const mode=document.getElementById('autoEquipModePanel');
 if(!mode)return;
 const sections=[...mode.querySelectorAll(':scope > .equip-auto-section')];
 for(const [i,el] of sections.entries()){
  if(i<3)el.open=true;
  const name=el.querySelector('summary strong');
  if(name&&i===0)name.textContent='조건 1 · 제작 지역';
  if(name&&i===1)name.textContent='조건 2 · 장비 도면';
  if(name&&i===2)name.textContent='조건 3 · 제작·정련·망정 범위';
  if(name&&i===3)name.textContent='검색 결과 · 장비 상세';
 }
 const legacy=document.getElementById('equipAutoSweepBody');
 if(legacy)legacy.closest('details')?.setAttribute('hidden','');
 if(button){
  button.addEventListener('click',()=>{
   const result=mode.querySelector('.equip-auto-results-section');
   if(result)result.open=true;
  });
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();