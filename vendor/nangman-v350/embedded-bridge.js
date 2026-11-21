/* Integration bridge for the original NangmanSimulator v3.50 equipment engine.
 * Keep original RNG, multi-condition finder, automatic search, regional crafting,
 * inventory, and shared detail functions untouched.
 */
(function(){
'use strict';
const validViews=new Set(['find','auto','owned','region']);
const origin=location.origin;
let active='find',saveVersion=-1;

/* Presentation adapter: the original simulator remains the RNG engine. */
const themeStyle=document.createElement('style');
themeStyle.id='nangman-host-equipment-theme';
themeStyle.textContent=`
html,body,#rk218{font-family:system-ui,"Malgun Gothic",sans-serif!important;font-size:15px!important;line-height:1.5;color:var(--host-text)!important;background:var(--host-bg)!important}
html{--host-bg:#fffdf7;--host-panel:#f8f4eb;--host-text:#231e17;--host-sub:#776e60;--host-border:#d6caba;--host-accent:#436b9b;--host-hover:#eee6d9}
html[data-nangman-theme="dark"]{color-scheme:dark;--host-bg:#252830;--host-panel:#1d2027;--host-text:#e9e3d9;--host-sub:#aba59c;--host-border:#44454d;--host-accent:#83b0de;--host-hover:#343c47}
#rk218,#rk218 .rb-detail233,#rk218 .rb-card233,#rk218 .box218,#rk218 .bbody,#rk218 .mini,#rk218 .grp218,#rk218 .picker237,#rk218 .rk237-total,#rk218 .detail-controls218,#rk218 .rk240-slot,#rk218 .rk240-allhint,#rk218 .rk218-jianwang-live,#rk218 .rb-card,#rk218 .auto339-box,#rk218 .config-panel{background:var(--host-bg)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}
#rk218 .tabs218,#rk218 .tabs218 button,#rk218 .chip,#rk218 .rinput,#rk218 .rsel,#rk218 .num218,#rk218 input,#rk218 select,#rk218 textarea,#rk218 .tbl218 th,#rk218 .tbl218 td,#rk218 .regionTbl225 th,#rk218 .regionTbl225 td,#rk218 .unique-seq-table227 th,#rk218 .unique-seq-table227 td,#rk218 .regionTbl225 .sticky225,#rk218 .unique-seq-table227 .sticky227{background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}
#rk218 .tabs218 button.on,#rk218 .chip.on,#rk218 button.primary,#rk218 .rbtn.primary{background:var(--host-accent)!important;color:var(--host-bg)!important;border-color:var(--host-accent)!important}
#rk218 .meta,#rk218 .note218,#rk218 .side-text275,#rk218 .side-title275,#rk218 .detail-region277 span{color:var(--host-sub)!important}
#rk218 .tbl218 tr:hover td{background:var(--host-hover)!important}
#rk218 button,#rk218 select,#rk218 input:not([type=checkbox]):not([type=radio]){min-height:36px;font-size:14px!important}
#rk218 .tabs218 button,#rk218 .rbtn,#rk218 .chip{min-height:40px;font-weight:700}
#rk218 .detail-table218 th,#rk218 .detail-table218 td{font-size:14px!important;padding:10px!important}
#rk218 .rb-detail233{padding:14px!important;border-radius:9px}
#rk218 .tabs218 button:nth-child(2){border-left:3px solid #538bc1!important}
#rk218 .tabs218 button:nth-child(3){border-left:3px solid #ab76ca!important}
#rk218 .tabs218 button:nth-child(4){border-left:3px solid #36a18a!important}
html[data-nangman-theme="dark"] #rk218 .back218,html[data-nangman-theme="dark"] #rk218 .tag,html[data-nangman-theme="dark"] #rk218 .detail-region277,html[data-nangman-theme="dark"] #rk218 .unique-pick247{background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}
`;
themeStyle.textContent+="\n\n/* v0.9.0: integrated-site equipment presentation; suppress embedded duplicate header. */\n#rk218>.rk218-top,#rk218>.rhome,body>.app-container.equip-app{display:none!important}\nhtml,body{margin:0!important;padding:0!important;overflow-x:hidden!important;background:var(--host-bg)!important}\nhtml{--host-bg:#fffdf7;--host-panel:#f8f4eb;--host-card:#fffdf7;--host-text:#231e17;--host-sub:#776e60;--host-border:#d6caba;--host-accent:#336f52;--host-active:#dfecdf;--host-hover:#f0e9dd;--host-muted:#f5efe5;--host-shadow:0 2px 7px rgba(65,48,30,.05)}\nhtml[data-nangman-theme=\"dark\"]{--host-bg:#252830;--host-panel:#1d2027;--host-card:#252830;--host-text:#e9e3d9;--host-sub:#b9b1a6;--host-border:#44454d;--host-accent:#76bb8c;--host-active:#284535;--host-hover:#333943;--host-muted:#23262d;--host-shadow:none}\n#rk218{margin:0!important;padding:4px 0 20px!important;border:0!important;max-width:100%!important;min-width:0!important;width:100%!important;font-size:15px!important;line-height:1.6!important}\n#rk218 #rmain{display:grid;gap:14px;min-width:0}\n#rk218 .box218,#rk218 .rb-detail233,#rk218 .rb-card233,#rk218 .mini,#rk218 .grp218,#rk218 .recipe-card,#rk218 .picker237,#rk218 .rk237-total,#rk218 .rb-card,#rk218 .auto339-box,#rk218 .config-panel,#rk218 .rk218-jianwang-live,#rk218 .rk240-slot,#rk218 .rk240-allhint{background:var(--host-card)!important;color:var(--host-text)!important;border:1px solid var(--host-border)!important;box-shadow:var(--host-shadow)!important;border-radius:9px!important}\n#rk218 .box218{margin:0!important;overflow:visible!important}\n#rk218 .box218>summary{padding:15px 18px!important;background:var(--host-panel)!important;color:var(--host-text)!important;font-size:16px!important;font-weight:750!important;border-radius:8px!important;cursor:pointer}\n#rk218 .bbody{padding:15px!important;background:transparent!important;color:var(--host-text)!important}\n#rk218 .mini,#rk218 .grp218,#rk218 .rb-card233{padding:14px!important}\n#rk218 .glab,#rk218 .panel-header h2,#rk218 .rb-detail233 h2{font-size:16px!important;color:var(--host-text)!important}\n#rk218 .meta,#rk218 .note218,#rk218 .side-text275,#rk218 .side-title275,#rk218 .r225reg.none{color:var(--host-sub)!important}\n#rk218 .tabs218{position:static!important;top:auto!important;z-index:auto!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important;overflow-x:visible!important;background:transparent!important;padding:0 0 12px!important;border-bottom:1px solid var(--host-border)!important}\n#rk218 .tabs218 button,#rk218 .chip,#rk218 .back218,#rk218 .rbtn,#rk218 .btn,#rk218 .jh-home-btn{padding:9px 13px!important;min-height:42px!important;border-radius:7px!important;background:var(--host-panel)!important;color:var(--host-text)!important;border:1px solid var(--host-border)!important;font-size:14px!important;font-weight:650!important;box-shadow:none!important}\n#rk218 .tabs218 button.on,#rk218 .chip.on,#rk218 .rbtn.primary,#rk218 .btn.primary{background:var(--host-active)!important;color:var(--host-accent)!important;border-color:var(--host-accent)!important;box-shadow:inset 0 -2px 0 var(--host-accent)!important}\n#rk218 .tabs218 button:nth-child(2){border-left:3px solid #648cb4!important}\n#rk218 .tabs218 button:nth-child(3){border-left:3px solid #a079b9!important}\n#rk218 .tabs218 button:nth-child(4){border-left:3px solid #63a58b!important}\n#rk218 .tabs218 button:disabled,#rk218 button:disabled{opacity:.46!important;cursor:not-allowed!important}\n#rk218 button:hover:not(:disabled){background:var(--host-hover)!important;color:var(--host-text)!important}\n#rk218 .tabs218 button.on:hover,#rk218 .chip.on:hover,#rk218 .rbtn.primary:hover{background:var(--host-active)!important;color:var(--host-accent)!important}\n#rk218 input:not([type=checkbox]):not([type=radio]),#rk218 select,#rk218 textarea,#rk218 .rinput,#rk218 .rsel,#rk218 .num218{background:var(--host-panel)!important;color:var(--host-text)!important;border:1px solid var(--host-border)!important;border-radius:6px!important;min-height:40px!important;font-size:14px!important;padding:8px 10px!important;max-width:100%!important}\n#rk218 input[type=checkbox],#rk218 input[type=radio]{min-width:17px!important;min-height:17px!important;accent-color:var(--host-accent)!important}\n#rk218 table{border-color:var(--host-border)!important;font-size:14px!important}\n#rk218 table th,#rk218 .regionTbl225 th,#rk218 .unique-seq-table227 th{background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important;font-size:13px!important;font-weight:750!important}\n#rk218 table td,#rk218 .regionTbl225 td,#rk218 .unique-seq-table227 td,#rk218 .sticky225,#rk218 .sticky227{background:var(--host-card)!important;color:var(--host-text)!important;border-color:var(--host-border)!important;font-size:13px!important;line-height:1.55!important}\n#rk218 table tr:hover td{background:var(--host-hover)!important}\n#rk218 .tag,#rk218 .detail-region277,#rk218 .unique-pick247,#rk218 .rk-initial-special-value250,#rk218 .rk240-allhint,#rk218 .unique-special247,#rk218 .detail-controls218{background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}\n#rk218 .detail-controls218{display:flex!important;gap:12px!important;flex-wrap:wrap!important;padding:12px!important;margin:12px 0!important}\n#rk218 .scroll218,#rk218 .regionScroll225,#rk218 .unique-seq-scroll227{max-width:100%!important;overflow-x:auto!important;scrollbar-color:var(--host-border) transparent}\n#rk218 .rb-detail233{padding:16px!important}\n#rk218 .detail-table218 th,#rk218 .detail-table218 td{padding:9px 12px!important}\n@media(max-width:700px){#rk218 .box218>summary{padding:12px!important}#rk218 .bbody{padding:10px!important}#rk218 .tabs218 button,#rk218 .chip{min-height:40px!important}#rk218 .rb-detail233{padding:10px!important}}\n";
// This stylesheet must be last in document order: the original page appends
// legacy !important styles after </html>, which override head styles otherwise.
function applyHostPresentation(){
 if(document.body&&themeStyle.parentNode!==document.body)document.body.appendChild(themeStyle);
 const root=document.getElementById('rk218');
 if(!root)return;
 // Do not merely hide the empty top row: remove the legacy navigation node.
 const duplicate=root.querySelector(':scope > .rk218-top');
 if(duplicate)duplicate.remove();
 // The old simulation also renders an empty home/navigation row in some modes.
 root.querySelectorAll(':scope > .rhome').forEach(el=>el.remove());
}
themeStyle.textContent+="\n\n/* Selection states in the original page use hardcoded cobalt-blue and stronger\n * legacy selectors. Rebind every visible selected/primary state to site green. */\n#rk218 .chip.on,\n#rk218 .tabs218 button.on,\n#rk218 .auto345-region-picks button.on,\n#rk218 .auto345-result-filter button.on,\n#rk218 .auto349-sort button.on,\n#rk218 .auto345-region-picks .on,\n#rk218 .auto345-result-filter .on,\n#rk218 .auto349-sort .on,\n#rk218 .auto339-region-picks button.on,\n#rk218 .auto345-filter button.on,\n#rk218 .unique-pick247.on,\n#rk218 .rbtn.primary,\n#rk218 .btn.primary,\n#rk218 button[aria-selected=\"true\"],\n#rk218 button[aria-pressed=\"true\"]{\n background:var(--host-active)!important;\n background-color:var(--host-active)!important;\n border-color:var(--host-accent)!important;\n color:var(--host-accent)!important;\n box-shadow:inset 0 -2px var(--host-accent)!important;\n}\n#rk218 .chip.on::before{color:var(--host-accent)!important}\n#rk218 button:focus-visible,#rk218 select:focus-visible,#rk218 input:focus-visible{\n outline:2px solid var(--host-accent)!important;outline-offset:2px!important\n}\n#rk218 .region-prop226,#rk218 .z-region{color:var(--host-accent)!important}\n#rk218 .search-result-side275,#rk218 .search-result-layout275{border-color:var(--host-border)!important}\n";
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
