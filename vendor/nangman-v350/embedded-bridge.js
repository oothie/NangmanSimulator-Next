/* Integration bridge for the original NangmanSimulator v3.50 equipment engine.
 * Keep original RNG, multi-condition finder, automatic search, regional crafting,
 * inventory, and shared detail functions untouched.
 */
(function(){
'use strict';
const validViews=new Set(['find','auto','owned','region']);
const origin=location.origin;
let active='find',saveVersion=-1;
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
 }catch(e){reply('error','장비 화면 전환 오류: '+String(e.message||e))}
}
window.addEventListener('message',e=>{
 if(e.source!==window.parent||e.origin!==origin||!e.data)return;
 const d=e.data;
 if(d.kind==='nangman-equipment-target'){
  go(String(d.view||'find'));return;
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
 }
});
window.addEventListener('load',()=>{
 reply('ready','v3.50 장비 계산 엔진 로드 완료');
 go(active);
});
})();
