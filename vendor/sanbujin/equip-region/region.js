/* Region crafting browser: port of the preserved Roboking v2.18 selection hierarchy.
 * Uses the current Sanbujin equipment configuration and the current save's native MakeRnd preview.
 * Never mutates the loaded save or stored native RNG state. */
(function(){
'use strict';
const byId=id=>document.getElementById(id);
const catalog=()=>window.EQUIP_DATA||{};
const n=x=>Number(x)||0;
const tr=s=>window.SBJ_KOREAN?.translate?.(String(s??''))||String(s??'');
const state={level:'',method:'',part:'',equip:''};
let routes=[];
const sel=(id,label)=>'<label>'+label+'<select id="'+id+'"></select></label>';
const body=document.createElement('main');body.id='regionBrowser';
body.innerHTML='<header><h2>지역별 제작 목록</h2></header><section class="region-controls">'+
sel('regionLevel','레벨')+sel('regionMethod','제작 방식')+
sel('regionPart','부위')+sel('regionEquip','장비')+
'</section><div class="region-actions"><button type="button" id="regionRun">제작 순서 조회</button><span id="regionStatus" role="status"></span></div>'+
'<div id="regionList" class="region-result"></div>';
document.body.append(body);
const $=id=>byId(id);
function option(el,value,name){const x=new Option(name,String(value));el.add(x)}
function setOptions(id,entries,selected,placeholder){
 const el=$(id);el.replaceChildren();option(el,'',placeholder);
 for(const x of entries)option(el,x.id,x.label);
 el.value=String(selected||'');if(el.selectedIndex<0)el.selectedIndex=0;
}
function configName(eq){return String(eq?.koName||tr(eq?.name)||('장비 #'+eq?.id))}
function typeName(type){return tr(catalog().typeNames?.[String(type)]||'부위 '+type)}
function loadRoutes(){
 const data=catalog(),seen=new Set(),all=[];
 if(typeof papersForNpc!=='function'||typeof sortedCraftsmen!=='function')return;
 for(const npc of sortedCraftsmen()){
  for(const pick of papersForNpc(npc.id)){
   const equip=data.equipment?.[String(pick.equipId)];
   if(!equip||Number(equip.weapon_color)===5||Number(pick.paper?.min_color)===5)continue;
   const key=String(npc.id)+':'+String(pick.selectId)+':'+String(equip.id);
   if(seen.has(key))continue;seen.add(key);
   const method=[5,6,7].includes(n(equip.type))?'sew':'forge';
   all.push({npc,pick,equip,method});
  }
 }
 routes=all;
}
function candidates(){return routes.filter(x=>(!state.level||n(x.equip.lv)===n(state.level))&&(!state.method||x.method===state.method)&&(!state.part||n(x.equip.type)===n(state.part))&&(!state.equip||n(x.equip.id)===n(state.equip)))}
function render(){
 // Roboking's cascading selection: never show every paper/equipment at once.
 const lvs=[...new Set(routes.map(x=>n(x.equip.lv)).filter(v=>v>=1))].sort((a,b)=>b-a);
 setOptions('regionLevel',lvs.map(id=>({id,label:id+'급'})),state.level,'레벨 선택');
 const show=(id,on)=>{const el=$(id).closest('label');el.hidden=!on;el.style.display=on?'grid':'none'};
 const a=state.level?routes.filter(x=>n(x.equip.lv)===n(state.level)):[];
 show('regionMethod',!!state.level);
 setOptions('regionMethod',[{id:'forge',label:'단조 재료'},{id:'sew',label:'봉제 재료'}].filter(o=>a.some(x=>x.method===o.id)),state.method,'제작 재료 선택');
 const b=state.method?a.filter(x=>x.method===state.method):[];
 show('regionPart',!!state.method);
 const parts=[...new Set(b.map(x=>n(x.equip.type)))].sort((x,y)=>x-y);
 setOptions('regionPart',parts.map(id=>({id,label:typeName(id)})),state.part,'부위 선택');
 const c=state.part?b.filter(x=>n(x.equip.type)===n(state.part)):[];
 show('regionEquip',!!state.part);
 const eqs=[...new Map(c.map(x=>[n(x.equip.id),x.equip])).values()].filter(x=>!(Number(x.weapon_color)===5)).sort((x,y)=>configName(x).localeCompare(configName(y),'ko'));
 setOptions('regionEquip',eqs.map(e=>({id:e.id,label:configName(e)+' (#'+e.id+')'})),state.equip,'장비 선택');
 const list=candidates();
 $('regionStatus').textContent=state.equip?list.length+'개 지역 제작 경로':state.part?eqs.length+'종 장비':'레벨 · 재료 · 부위 · 장비 순서로 선택하세요';
 $('regionRun').disabled=!state.equip||!list.length;
 const display=state.equip?list:[];
 $('regionList').innerHTML=display.length?'<div class="region-scroll"><table><thead><tr><th>지역</th><th>장인</th><th>장비</th><th>제작 방식</th><th>상세</th></tr></thead><tbody>'+
 display.map(x=>'<tr><td>'+escapeHtml(tr(x.npc.place||''))+'</td><td>'+escapeHtml(tr(x.npc.name||''))+'</td><td>'+escapeHtml(configName(x.equip))+'</td><td>'+(x.method==='sew'?'봉제':'단조')+'</td><td><button type="button" class="region-detail" data-region-detail="'+n(x.equip.id)+'">장비 상세</button></td></tr>').join('')+'</tbody></table></div>':'';
 $('regionList').querySelectorAll('[data-region-detail]').forEach(btn=>btn.onclick=()=>window.NangmanEquipmentDetail?.open({id:Number(btn.dataset.regionDetail)}));
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function setState(field,val){
 state[field]=val;
 if(field==='level'){state.method='';state.part='';state.equip=''}
 if(field==='method'){state.part='';state.equip=''}
 if(field==='part')state.equip='';
 render();
}
[['regionLevel','level'],['regionMethod','method'],['regionPart','part'],['regionEquip','equip']].forEach(([id,key])=>{$(id).onchange=()=>setState(key,$(id).value)});
function preview(){
 const selected=candidates().filter(x=>n(x.equip.id)===n(state.equip));
 if(!selected.length)return;
 if(typeof saveLoaded==='undefined'||!saveLoaded){$('regionStatus').textContent='제작 순서 조회를 위해 세이브를 먼저 불러오세요.';return}
 if(typeof wasmMakeGetState!=='function'||typeof wasmMakeSetState!=='function'||typeof wasmMakePreview!=='function'){$('regionStatus').textContent='장비 계산 엔진이 준비되지 않았습니다.';return}
 const before=wasmMakeGetState();if(!before){$('regionStatus').textContent='제작 시드가 없습니다.';return}
 const copy=JSON.parse(JSON.stringify(before));
 const outputs=[];
 try{
  for(const rt of selected){
   if(!wasmMakeSetState(JSON.parse(JSON.stringify(copy))) )throw Error('제작 시드 설정 실패');
   const req={npc_id:n(rt.npc.id),select_id:n(rt.pick.selectId),equip_id:n(rt.equip.id),special_id:0,
     min_color:n(rt.pick.paper?.min_color)||1,max_color:n(rt.pick.paper?.max_color)||4};
   const response=wasmMakePreview(req,20);
   if(response?.error)throw Error(String(response.error));
   outputs.push({rt,items:response?.items||[]});
  }
 }catch(err){$('regionStatus').textContent='제작 예측 오류: '+String(err?.message||err);return}
 finally{wasmMakeSetState(copy)}
 const colors=catalog().colorNames||{};
 const props=catalog().propNames||{};
 function cell(row){
  if(!row)return '—';
  const color=tr(colors[String(row.color)]||String(row.color||''));
  const ext=(row.exts||[]).map(x=>tr(props[x.prop]||x.prop)+' '+(typeof formatPropValue==='function'?formatPropValue(x.prop,x.value):String(x.value))).join(' · ');
  return '<span class="region-quality region-quality-'+Number(row.color||0)+'">'+escapeHtml(color)+'</span>'+(ext?'<small>'+escapeHtml(ext)+'</small>':'');
 }
 $('regionStatus').textContent='현재 세이브 기준 · 장인별 20회 제작 결과';
 $('regionList').innerHTML='<div class="region-scroll"><table><thead><tr><th>회차</th>'+
 outputs.map(x=>'<th>'+escapeHtml(tr(x.rt.npc.place||''))+' · '+escapeHtml(tr(x.rt.npc.name||''))+'</th>').join('')+
 '</tr></thead><tbody>'+Array.from({length:20},(_,i)=>'<tr><td>'+(i+1)+'</td>'+
 outputs.map(x=>'<td>'+cell(x.items[i])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
$('regionRun').onclick=preview;
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.kind==='nangman-equip-save'){$('regionStatus').textContent='세이브 적용 중';$('regionList').replaceChildren()}});
loadRoutes();render();
})();