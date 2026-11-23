/* v0.8.2 - hide all CSV export actions without disabling calculation controls. */
(function(){
'use strict';
const ids=['washHistoryExport','washPreviewExport','washPathExport','downloadAccountCultivation',
 'questBranchExport','questExportCsv','tombForecastCsv','wildExport','dungeonExport',
 'dungeonAllExport','dungeonSequenceExport','sharedExport','btnExportTable','btnExportFavorites'];
const needle=/\.csv\b|CSV|표 내보내기|전체 진행 기록 내보내기/i;
function clean(){
 for(const id of ids){const e=document.getElementById(id);if(e){e.hidden=true;e.disabled=true;e.setAttribute('aria-hidden','true')}}
 for(const e of document.querySelectorAll('button,a[download],input[type="button"]')){
  const text=(e.textContent||'')+' '+(e.getAttribute('download')||'');
  if(needle.test(text)){e.hidden=true;e.disabled=true;e.setAttribute('aria-hidden','true')}
 }
}
const style=document.createElement('style');style.textContent=ids.map(x=>'#'+x).join(',')+'{display:none!important} [hidden][aria-hidden="true"]{display:none!important}';
(document.head||document.documentElement).append(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clean,{once:true});else clean();
let scheduled=false;
new MutationObserver(()=>{
 if(scheduled)return;scheduled=true;
 Promise.resolve().then(()=>{scheduled=false;clean()});
}).observe(document.documentElement,{childList:true,subtree:true});
})();
