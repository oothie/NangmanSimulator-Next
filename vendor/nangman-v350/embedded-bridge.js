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
#rk218 button,#rk218 select,#rk218 input{min-height:36px;font-size:14px!important}
#rk218 .tabs218 button,#rk218 .rbtn,#rk218 .chip{min-height:40px;font-weight:700}
#rk218 .detail-table218 th,#rk218 .detail-table218 td{font-size:14px!important;padding:10px!important}
#rk218 .rb-detail233{padding:14px!important;border-radius:9px}
#rk218 .tabs218 button:nth-child(2){border-left:3px solid #538bc1!important}
#rk218 .tabs218 button:nth-child(3){border-left:3px solid #ab76ca!important}
#rk218 .tabs218 button:nth-child(4){border-left:3px solid #36a18a!important}
html[data-nangman-theme="dark"] #rk218 .back218,html[data-nangman-theme="dark"] #rk218 .tag,html[data-nangman-theme="dark"] #rk218 .detail-region277,html[data-nangman-theme="dark"] #rk218 .unique-pick247{background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}
`;
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
  requestAnimationFrame(()=>{capMangjing();syncHeight()});
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
   reply('focused','선택한 보유 장비의 정련·망정·촉련 상세를 표시했습니다');
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
  capMangjing();
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
 syncHeight();
 if(typeof ResizeObserver==='function'){
  const resize=new ResizeObserver(()=>syncHeight());
  resize.observe(document.documentElement);
  if(document.getElementById('rk218'))resize.observe(document.getElementById('rk218'));
  const mutation=new MutationObserver(()=>{capMangjing();syncHeight()});
  if(document.getElementById('rk218'))mutation.observe(document.getElementById('rk218'),{childList:true,subtree:true});
 }
});

})();
