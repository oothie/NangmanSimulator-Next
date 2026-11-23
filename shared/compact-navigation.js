/* v0.8.3 — remove repeated horizontal secondary tab bars without
 * removing their actions: use one compact accessible selector per section. */
(function(){
'use strict';
const selector='nav.simple-tabs,nav.role-subtabs,.layout>.work>nav.tabs';
function upgrade(nav){
 if(!(nav instanceof HTMLElement)||nav.dataset.nangmanCollapsed==='1')return;
 const buttons=[...nav.querySelectorAll(':scope > button')].filter(b=>!b.disabled);
 if(buttons.length<2)return;
 const id='nangman-section-picker-'+Math.random().toString(36).slice(2,9);
 const wrap=document.createElement('div');wrap.className='nangman-section-control';
 const lab=document.createElement('label');lab.htmlFor=id;lab.textContent='화면 선택';
 const select=document.createElement('select');select.id=id;select.setAttribute('aria-label','화면 선택');
 buttons.forEach((b,index)=>{
  const label=(b.textContent||'').replace(/\s+/g,' ').trim()||('화면 '+(index+1));
  const option=new Option(label,String(index));select.add(option);
  if(b.classList.contains('active')||b.getAttribute('aria-selected')==='true')select.value=String(index);
 });
 select.addEventListener('change',()=>buttons[Number(select.value)]?.click());
 wrap.append(lab,select);
 nav.dataset.nangmanCollapsed='1';nav.hidden=true;
 nav.after(wrap);
}
function scan(root){
 if(root instanceof Element&&root.matches(selector))upgrade(root);
 if(root instanceof Element)root.querySelectorAll(selector).forEach(upgrade);
}
function start(){
 scan(document.body);
 new MutationObserver(entries=>{for(const entry of entries)for(const node of entry.addedNodes)scan(node)})
 .observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();