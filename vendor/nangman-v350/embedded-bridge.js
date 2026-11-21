/* Integration bridge for the original NangmanSimulator v3.50 equipment engine.
 * Keep original RNG, multi-condition finder, automatic search, regional crafting,
 * inventory, and shared detail functions untouched.
 */
(function(){
'use strict';
const validViews=new Set(['find','auto','owned','region']);
const origin=location.origin;
let active='find',saveVersion=-1;

/* Unified paper/ink presentation. Only the original engine performs calculations. */
const themeStyle=document.createElement('style');
themeStyle.id='nangman-host-equipment-theme';
themeStyle.textContent="\n:root{--host-bg:#f8f4eb;--host-panel:#fffdf7;--host-card:#fffdf7;--host-text:#231e17;--host-sub:#776e60;--host-border:#d6caba;--host-gold:#9c7941;--host-active:#ad8b4c22;--host-hover:#ad8b4c18;--host-shadow:none;--rbg:#f8f4eb;--rc:#fffdf7;--rl:#d6caba;--rt:#231e17;--rm:#776e60;--ra:#9c7941;--ra2:#e9dfcf;color-scheme:light}\nhtml[data-nangman-theme=\"dark\"]{--host-bg:#1d2027;--host-panel:#252830;--host-card:#252830;--host-text:#e9e3d9;--host-sub:#aba59c;--host-border:#44454d;--host-gold:#cca76b;--host-active:#cca76b24;--host-hover:#cca76b14;--host-shadow:none;--rbg:#1d2027;--rc:#252830;--rl:#44454d;--rt:#e9e3d9;--rm:#aba59c;--ra:#cca76b;--ra2:#3e382e;color-scheme:dark}\nhtml,body{margin:0!important;padding:0!important;min-height:0!important;overflow-x:hidden!important;background:var(--host-bg)!important;color:var(--host-text)!important;font-family:system-ui,\"Malgun Gothic\",sans-serif!important}\nbody>.app-container.equip-app,#rk218>.rk218-top,#rk218>.rhome{display:none!important}\nbody #rk218{max-width:100%!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:0!important;padding:0 0 24px!important;background:transparent!important;color:var(--host-text)!important;font-family:inherit!important;font-size:14px!important;line-height:1.55!important}\nbody #rk218 #rmain{display:grid;gap:13px;min-width:0}\nbody #rk218 :is(.box218,.rb-detail233,.rb-card233,.mini,.grp218,.picker237,.rk237-total,.recipe-card,.auto339-box,.config-panel,.rk218-jianwang-live,.rk240-slot,.rk240-allhint,.unique-special247,.rb-card,.detail-controls218){background:var(--host-card)!important;color:var(--host-text)!important;border-color:var(--host-border)!important;box-shadow:none!important;border-radius:6px!important}\nbody #rk218 .box218{margin:0!important;overflow:visible!important;border:1px solid var(--host-border)!important}\nbody #rk218 .box218>summary{padding:12px 15px!important;background:var(--host-bg)!important;color:var(--host-text)!important;border-radius:5px!important;font-size:15px!important;font-weight:700!important;cursor:pointer}\nbody #rk218 .bbody{padding:13px!important;background:transparent!important;color:var(--host-text)!important}\nbody #rk218 :is(.mini,.grp218,.rb-card233){padding:12px!important}\nbody #rk218 :is(.glab,.panel-header h2,.rb-detail233 h2,.rk-detail-head233 b,.rk237-total b){color:var(--host-text)!important}\nbody #rk218 :is(.meta,.note218,.side-text275,.side-title275,.cost-hint,.rsel,.rk240-allhint,.rk240-slot small){color:var(--host-sub)!important}\nbody #rk218 :is(.tabs218,.chips){background:transparent!important;color:var(--host-text)!important}\nbody #rk218 .tabs218{position:static!important;top:auto!important;display:flex!important;flex-wrap:wrap!important;overflow:visible!important;gap:4px!important;padding:0 0 7px!important;margin:12px 0!important;border-bottom:1px solid var(--host-border)!important}\nbody #rk218 :is(.tabs218 button,.chip,.rbtn,.btn,.back218,.jh-home-btn,.auto345-region-picks button,.auto345-result-filter button,.auto349-sort button){appearance:none!important;background:transparent!important;color:var(--host-sub)!important;border:1px solid var(--host-border)!important;box-shadow:none!important;border-radius:5px!important;font-size:14px!important;font-weight:600!important;min-height:38px!important;padding:8px 11px!important}\nbody #rk218 :is(.tabs218 button.on,.chip.on,.rbtn.primary,.btn.primary,.auto345-region-picks button.on,.auto345-result-filter button.on,.auto349-sort button.on,button[aria-selected=\"true\"],button[aria-pressed=\"true\"]){background:var(--host-active)!important;background-color:var(--host-active)!important;color:var(--host-text)!important;border-color:var(--host-gold)!important;border-bottom:2px solid var(--host-gold)!important;box-shadow:none!important}\nbody #rk218 :is(.tabs218 button,.chip,.rbtn,.btn,.back218):hover:not(:disabled){background:var(--host-hover)!important;color:var(--host-text)!important}\nbody #rk218 button:disabled{opacity:.42!important;cursor:not-allowed!important}\nbody #rk218 :is(input:not([type=\"checkbox\"]):not([type=\"radio\"]),select,textarea,.rinput,.num218,.rsel){background:var(--host-panel)!important;color:var(--host-text)!important;border:1px solid var(--host-border)!important;border-radius:5px!important;min-height:38px!important;padding:7px 9px!important;font-size:14px!important;max-width:100%!important;opacity:1!important}\nbody #rk218 :is(input,select,textarea):focus-visible{outline:2px solid var(--host-gold)!important;outline-offset:2px!important}\nbody #rk218 :is(input[type=\"checkbox\"],input[type=\"radio\"]){min-height:16px!important;min-width:16px!important;width:16px!important;accent-color:var(--host-gold)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227){border-color:var(--host-border)!important;color:var(--host-text)!important;font-size:13px!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) :is(th,td){border-color:var(--host-border)!important;padding:9px 10px!important;line-height:1.5!important;color:var(--host-text)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) th{background:var(--host-bg)!important;font-weight:650!important;color:var(--host-sub)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) td{background:var(--host-card)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) tr:hover td{background:var(--host-hover)!important}\nbody #rk218 :is(.regionTbl225 .sticky225,.unique-seq-table227 .sticky227,.tag,.detail-region277,.unique-pick247,.rk-initial-special-value250,.rk240-allhint,.detail-controls218,.search-result-side275,.search-result-layout275){background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}\nbody #rk218 :is(.scroll218,.regionScroll225,.unique-seq-scroll227){max-width:100%!important;overflow-x:auto!important;scrollbar-color:var(--host-border) transparent}\nbody #rk218 .detail-controls218{display:flex!important;flex-wrap:wrap!important;align-items:flex-end!important;gap:12px!important;padding:12px!important;margin:12px 0!important}\nbody #rk218 .rb-detail233{padding:14px!important}\nbody #rk218 .region-prop226{color:var(--host-gold)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.preview-table,.result-table,.history-table-wrap,.table-wrap,.scroll,.history-table,.preview-card,.config-row,.config-group,.rk237-groups,.search-result-layout275,.search-result-side275,.rb-detail233,.r225q,.regionbar225,.rk-detail-head233){background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.r225ext,.r225reg,.r225spec,.rk240-slot,.rk240-slot b,.meta-text,.help-text,.glab,.props,.route,.bbody,.label,.hint,.config-group label,.picker237 b,.rk237-groups b,.search-result-side275 p){color:var(--host-text)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(table,thead,tbody,tr,th,td,pre,code,.sticky225,.sticky227){border-color:var(--host-border)!important;color:var(--host-text)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(pre,code){background:var(--host-bg)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 option{background:#252830!important;color:#e9e3d9!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.back218,.tag,.rk237-total,.picker237,.rb-detail233,.mini,.grp218){background:var(--host-panel)!important;color:var(--host-text)!important}\n@media(max-width:700px){body #rk218 .bbody{padding:9px!important}body #rk218 .rb-detail233{padding:9px!important}body #rk218 .tabs218 button{padding:7px 9px!important}body #rk218 .detail-controls218{padding:8px!important}}\n";
function setHostTheme(theme){
 document.documentElement.dataset.nangmanTheme=theme==='dark'?'dark':'light';
}
function syncHostTheme(){
 try{
  if(window.parent!==window){
   setHostTheme(window.parent.document.documentElement.dataset.theme==='ink'?'dark':'light');
  }
 }catch(_){}
}
function applyHostPresentation(){
 if(document.body&&themeStyle.parentNode!==document.body)document.body.appendChild(themeStyle);
 const root=document.getElementById('rk218');
 if(!root)return;
 const duplicate=root.querySelector(':scope > .rk218-top');
 if(duplicate)duplicate.remove();
 root.querySelectorAll(':scope > .rhome').forEach(el=>el.remove());
}
syncHostTheme();
document.head.appendChild(themeStyle);
function capMangjing(){
 const field=document.getElementById('specialAttachCount');
 if(field){field.max='200';if(Number(field.value)>200)field.value='200'}
 const detailField=document.getElementById('dsearchmj264');
 if(detailField){detailField.max='200';if(Number(detailField.value)>200)detailField.value='200'}
}

function reply(status,message,version){
 if(window.parent!==window)window.parent.postMessage({
  kind:'nangman-native-equipment',status,module:'nangman-v350',
  message:message||'',version
 },origin);
}
function go(view){
 if(!validViews.has(view))return;
 active=view;
 try{
  if(typeof window.rk218Open!=='function')throw Error('원본 장비 화면이 준비되지 않았습니다');
  window.rk218Open(view);
  reply('navigated',view+' 화면 선택됨');
  requestAnimationFrame(()=>{applyHostPresentation();capMangjing();syncHeight()});
 }catch(e){reply('error','장비 화면 전환 오류: '+String(e.message||e))}
}
window.addEventListener('message',e=>{
 if(e.source!==window.parent||e.origin!==origin||!e.data)return;
 const d=e.data;
 if(d.kind==='nangman-equipment-target'){
  go(String(d.view||'find'));return;
 }
 if(d.kind==='nangman-equipment-focus'){
  try{
   const selected=window.nangman350FocusEquipment?.(d.equipment,d.tab||'route');
   if(!selected?.ok)throw Error(selected?.message||'저장된 장비를 찾지 못했습니다.');
   reply('focused',selected.message||(selected.source==='snapshot'?'전달된 개별 시드로 정련·망정·촉련 상세를 표시했습니다':'선택한 보유 장비의 상세를 표시했습니다'));
  }catch(error){reply('error',String(error.message||error))}
  return;
 }
 if(d.kind==='nangman-equip-save'){
  try{
   if(!d.save){reply('applied','세이브가 연결되지 않았습니다',d.version);return}
   if(typeof window.applySharedSaveJson!=='function')throw Error('원본 세이브 적용 함수 없음');
   window.applySharedSaveJson(d.save);
   saveVersion=d.version;
   go(active);
   reply('applied','가져온 계정의 제작 시드와 보유 장비가 적용되었습니다',d.version);
  }catch(error){reply('error',String(error.message||error),d.version)}
 }
 if(d.kind==='nangman-equipment-theme'){
  document.documentElement.dataset.nangmanTheme=d.theme==='dark'?'dark':'light';
  applyHostPresentation();capMangjing();
 }
});
let previousHeight=0;
function syncHeight(){
 const height=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0);
 if(height>0&&Math.abs(height-previousHeight)>12&&window.parent!==window){
  previousHeight=height;
  window.parent.postMessage({kind:'nangman-equipment-height',height},origin);
 }
}
window.addEventListener('load',()=>{
 reply('ready','v3.50 장비 계산 엔진 로드 완료');
 go(active);
 applyHostPresentation();syncHeight();
 if(typeof ResizeObserver==='function'){
  const resize=new ResizeObserver(()=>syncHeight());
  resize.observe(document.documentElement);
  if(document.getElementById('rk218'))resize.observe(document.getElementById('rk218'));
  const mutation=new MutationObserver(()=>{applyHostPresentation();capMangjing();syncHeight()});
  if(document.getElementById('rk218'))mutation.observe(document.getElementById('rk218'),{childList:true,subtree:true});
 }
});

})();
