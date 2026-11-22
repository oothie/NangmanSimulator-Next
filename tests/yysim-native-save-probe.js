/* Save-based original yy-sim WASM diagnosis, no alternate search. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const source=window.YYWashSaveState,guard=window.YYWashNativeSearchGuard;
const catalog=window.YYWashTargetCatalog||[];
const targetItems=catalog.flatMap(g=>g.items.map(t=>({...t,quality:g.quality})));
const byId=new Map(targetItems.map(t=>[Number(t.id),t]));
const ko=id=>byId.get(Number(id))?.ko||TALENT_DATA[String(id)]?.name||'#'+id;
let save=null,roles=[],role=null,current=null,preview=null,ready=false,busy=false,report=null;
let chosen=new Set();
const setStatus=(message,error=false)=>{$('status').textContent=message;$('status').className=error?'error':''};
const cell=(tr,value)=>{const el=document.createElement('td');el.textContent=String(value);tr.append(el)};
function resetResult(){report=null;$('result').replaceChildren();$('output').textContent='';$('copy').disabled=true}
function showState(){
 $('selectedRole').textContent=role?role.type+' · '+role.name+' (#'+role.id+')':'캐릭터 미선택';
 $('seedInfo').textContent=current?'세수 원시 시드 '+current.seed+' · 자질 '+current.zizhi:'세이브 연결 전';
 $('slots').replaceChildren();
 for(const [i,t] of (current?.talents||[]).entries()){
  const item=document.createElement('div');item.className='slot';
  item.textContent=(i+1)+'번 · '+ko(t.id)+' (#'+t.id+')'+(t.locked?' · 잠금':' · 해제');
  $('slots').append(item);
 }
}
function goals(){
 $('file').disabled=busy;$('role').disabled=busy;$('clear').disabled=busy;
 const filter=$('filter').value.trim().toLocaleLowerCase();
 $('goals').replaceChildren();
 for(const grade of [4,3,2]){
  const group=catalog.find(g=>Number(g.quality)===grade);if(!group)continue;
  const section=document.createElement('details');section.open=grade===4||Boolean(filter);
  const title=document.createElement('summary');
  title.textContent=({4:'자맥',3:'파맥',2:'녹맥'})[grade]+' · '+group.items.length+'개';
  section.append(title);
  const list=document.createElement('div');list.className='choices';
  for(const talent of group.items){
   if(filter&&!((talent.ko+' '+talent.name+' '+talent.id).toLowerCase().includes(filter)))continue;
   const label=document.createElement('label');label.className='choice'+(chosen.has(talent.id)?' chosen':'');
   const check=document.createElement('input');check.type='checkbox';check.checked=chosen.has(talent.id);
   check.disabled=busy;
   check.addEventListener('change',()=>{
    if(busy){check.checked=!check.checked;return}
    if(check.checked&&chosen.size===4){setStatus('재능은 최대 4개까지 선택 가능합니다',true);check.checked=false;return}
    if(check.checked)chosen.add(talent.id);else chosen.delete(talent.id);
    resetResult();goals();
   });
   label.append(check,document.createTextNode(' '+talent.ko+' (#'+talent.id+')'));list.append(label);
  }
  section.append(list);$('goals').append(section);
 }
 $('goalInfo').textContent='목표 '+chosen.size+'/4 · '+[...chosen].map(ko).join(' / ');
 $('run').disabled=busy||!current||chosen.size===0;
}
function selectFromPreview(id){
 if(busy){setStatus('현재 원본 WASM 작업이 끝난 다음 목표를 선택해 주세요',true);return}
 const item=byId.get(Number(id));
 if(!item){setStatus('해당 원시맥은 목표 선택 목록에서 제외된 재능입니다',true);return}
 if(chosen.has(item.id))return;
 if(chosen.size>=4){setStatus('목표는 최대 4개까지 선택할 수 있습니다',true);return}
 chosen.add(item.id);resetResult();goals();
 setStatus('원시맥 '+item.ko+' (#'+item.id+')을 목표 재능에 추가했습니다');
}
function showPreview(){
 $('preview').replaceChildren();$('conflicts').replaceChildren();
 const purples=Array.isArray(preview?.purples)?preview.purples:[];
 $('previewInfo').textContent=preview?'현재 캐릭터의 원시 자맥 '+purples.length+'개':'원시맥을 조회하면 회차별 목록 표시';
 const exchange=purples.filter(x=>x.earlier_conflict_name||x.can_exchange===true);
 $('conflictInfo').textContent=preview?'선행 충돌맥·치환 후보 '+exchange.length+'개':'원시 자맥의 치환 관계 표시';
 for(const p of purples.slice(0,500)){
  const tr=document.createElement('tr');
  for(const v of [p.wash_no??'-',p.talent_id?ko(p.talent_id):String(p.talent_name||'-'),
   p.can_exchange===true?'가능':p.can_exchange===false?'불가':'미확인',
   p.earlier_conflict_name||'-',p.earlier_conflict_wash_times??'-'])cell(tr,v);
  const action=document.createElement('td');
  if(byId.has(Number(p.talent_id))){
   const button=document.createElement('button');
   button.type='button';button.textContent='목표 추가';
   button.addEventListener('click',()=>selectFromPreview(p.talent_id));
   action.append(button);
  }else action.textContent='—';
  tr.append(action);$('preview').append(tr);
 }
 for(const p of exchange.slice(0,350)){
  const tr=document.createElement('tr');
  for(const v of [p.wash_no??'-',p.talent_id?ko(p.talent_id):String(p.talent_name||'-'),
   p.earlier_conflict_name||'없음',p.earlier_conflict_wash_times??'-',
   p.can_exchange===true?'가능':'미확인'])cell(tr,v);
  $('conflicts').append(tr);
 }
}
async function init(){
 if(ready)return;
 setStatus('원본 yy-sim WASM 초기화 중…');
 if(!(await initWasm())||!wasmInitEngine(TALENT_DATA,ZZ_DATA))
  throw Error('원본 WASM 초기화 실패: '+String(window.__yyWasmInitError||''));
 ready=true;
}
async function attach(){
 const selectedRole=roles[Number($('role').value)];
 role=null;current=null;preview=null;chosen.clear();
 resetResult();showState();showPreview();goals();
 if(!selectedRole)throw Error('캐릭터를 선택하세요');
 await init();
 const mapped=source.build(save,selectedRole,wasmGetState());
 if(!wasmSetState(mapped))throw Error('원본 WASM 캐릭터 상태 적용 실패');
 const applied=wasmGetState();
 if(!applied||Number(applied.role_id)!==selectedRole.id||Number(applied.seed)!==Number(mapped.seed))
  throw Error('원본 WASM 캐릭터 ID 또는 원시 시드 일치 실패');
 role=selectedRole;current=applied;preview=null;chosen.clear();
 resetResult();showState();showPreview();goals();
 setStatus(role.name+' · 원본 WASM 연결 완료 (세이브 변경 없음)');
}
async function load(file){
 if(!file)return;
 if(file.size>50000000)throw Error('세이브 용량은 최대 50MB');
 save=source.unwrap(JSON.parse(await file.text()));
 roles=source.roles(save);
 if(!roles.length)throw Error('세이브의 캐릭터 목록 없음');
 $('role').replaceChildren();
 roles.forEach((r,i)=>{
  const option=document.createElement('option');option.value=String(i);
  option.textContent=r.type+' · '+r.name+' (#'+r.id+')';$('role').append(option);
 });
 await attach();
}
async function scan(){
 if(!current)throw Error('세이브 캐릭터를 먼저 연결하세요');
 const count=Number($('previewLimit').value);
 if(!Number.isInteger(count)||count<1||count>5000)throw Error('원시맥 조회 1~5000회');
 busy=true;goals();$('scan').disabled=true;
 try{
  if(!wasmSetState(current))throw Error('원본 세수 상태 복원 실패');
  setStatus('선택 캐릭터 원시 자맥·치환맥 조회 중…');
  await new Promise(r=>setTimeout(r,30));
  const before=wasmGetState();
  let data=null,previewError=null;
  try{data=wasmPreviewSequence(count)}
  catch(e){previewError=e}
  if(!guard.statesEqual(wasmGetState(),before)){
   const restored=wasmSetState(before);
   if(!restored||!guard.statesEqual(wasmGetState(),before))
    throw Error('원본 미리보기 세수 상태 복원 실패');
   throw Error('원본 미리보기 실행 중 상태 변경 감지 · 복원 완료');
  }
  if(previewError)throw previewError;
  if(!data||!Array.isArray(data.purples))throw Error('원본 미리보기 결과 형식 오류');
  preview=data;showPreview();setStatus(role.name+' · '+count+'회차 원시 자맥 '+data.purples.length+'개 확인');
 }finally{busy=false;goals();$('scan').disabled=false}
}
async function workerCall(worker,id,request){
 return new Promise((resolve,reject)=>{
  let timer;
  const dispose=()=>{clearTimeout(timer);worker.removeEventListener('message',message);worker.removeEventListener('error',failure)};
  function message(e){
   const d=e.data||{};if(d.kind!=='yy-native-search-probe-result'||d.requestId!==id)return;
   dispose();resolve(d);
  }
  function failure(e){dispose();reject(Error(e?.message||'원본 Worker 실행 실패'))}
  worker.addEventListener('message',message);worker.addEventListener('error',failure);
  timer=setTimeout(()=>{dispose();reject(Error('원본 Worker 180초 응답 시간 초과'))},180000);
  worker.postMessage({kind:'yy-native-search-probe',requestId:id,state:current,request});
 });
}
function summarize(target,raw,error,elapsed){
 const paths=Array.isArray(raw?.routes)?raw.routes:[];
 const complete=paths.filter(p=>target.ids.every(id=>(p.final_slots||[]).some(t=>Number(t.id)===id)));
 const costs=complete.map(p=>Number(p.pills)).filter(n=>Number.isSafeInteger(n)&&n>=0);
 return {name:target.name,ids:target.ids,goals:target.ids.map(ko),elapsedMs:elapsed,
  classification:error?'원본 예외':raw?.error?'원본 오류':!Array.isArray(raw?.routes)?'응답 오류':
   complete.length?'최종 목표 확인':paths.length?'불완전 경로':'범위 내 미발견',
  candidates:paths.length,complete:complete.length,best:costs.length?Math.min(...costs):null,
  nativeError:error||raw?.error||null,
  examples:paths.slice(0,5).map(p=>({pills:p.pills??null,
   finalSlots:(p.final_slots||[]).map(t=>({id:Number(t.id),name:ko(t.id),locked:!!t.locked})),
   missing:target.ids.filter(id=>!(p.final_slots||[]).some(t=>Number(t.id)===id)).map(ko),
   washes:p.washes??null,exchanges:p.exchanges??null,pad:p.pad??null}))};
}
async function run(){
 if(!current)throw Error('세이브 캐릭터를 먼저 선택하세요');
 const ids=[...chosen];
 if(!ids.length||ids.length>4)throw Error('목표 재능 1~4개를 선택하세요');
 const horizon=Number($('windowSize').value),maxPad=Number($('maxPad').value);
 if(!Number.isInteger(horizon)||horizon<20||horizon>5000||
   !Number.isInteger(maxPad)||maxPad<0||maxPad>200)throw Error('범위 값 오류');
 const purple=ids.filter(id=>Number(TALENT_DATA[String(id)]?.pinzhi)===4);
 const cases=[];
 if(purple.length&&purple.length<ids.length)cases.push({name:'선택 자맥만 비교',ids:purple});
 cases.push({name:'선택한 최종 재능 전체',ids});
 resetResult();busy=true;goals();$('scan').disabled=true;
 const original=guard.canonicalJson(current);
 const worker=$('useWorker').checked?new Worker('../vendor/yysim/native-search-worker.js?rev=0.10.30'):null;
 report={version:'v0.10.30',source:'selected-save-native-wasm',roleId:role.id,roleName:role.name,
  seed:current.seed,horizon,maxPad,desiredIds:ids,desiredNames:ids.map(ko),
  previewCount:preview?.purples?.length??null,results:[]};
 try{
  let seq=0;
  for(const test of cases){
   const start=performance.now();let raw=null,error=null;
   const timer=setInterval(()=>setStatus('원본 WASM · '+test.name+' · '+Math.floor((performance.now()-start)/1000)+'초 경과'),500);
   try{
    const req={desired_ids:test.ids,max_pad:maxPad,horizon,top_n:8};
    if(worker){
     const reply=await workerCall(worker,++seq,req);
     if(!reply.ok||reply.stateUnchanged!==true)throw Error(reply.error||'Worker 상태 검증 실패');
     raw=reply.result;
    }else{
     raw=guard.run({getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes},req);
    }
   }catch(e){error=String(e?.message||e)}
   finally{clearInterval(timer)}
   if(guard.canonicalJson(wasmGetState())!==original)throw Error('원본 상태 변경: 결과 폐기');
   const row=summarize(test,raw,error,+(performance.now()-start).toFixed(2));report.results.push(row);
   const tr=document.createElement('tr');
   for(const v of [row.name,row.classification,row.candidates,row.complete,row.best??'미확인',row.elapsedMs+'ms'])cell(tr,v);
   $('result').append(tr);
   await new Promise(r=>setTimeout(r,20));
  }
  $('output').textContent=JSON.stringify(report,null,2);$('copy').disabled=false;
  const result=report.results.at(-1);
  setStatus(result.classification==='최종 목표 확인'?'최종 목표 충족 경로 확인 · 전역 최솟값은 미확정':
   '선택 재능을 모두 보유한 최종 경로를 확인하지 못했습니다. 아래 결과 JSON의 누락 재능과 원본 경로를 확인하세요.');
 }finally{worker?.terminate();busy=false;goals();$('scan').disabled=false}
}
function wrap(fn){return async()=>{
 if(busy){setStatus('원본 WASM 작업이 끝난 뒤 다시 실행해 주세요',true);return}
 try{await fn()}catch(e){busy=false;goals();setStatus(String(e?.message||e),true)}
}}
$('file').addEventListener('change',wrap(async()=>{
 const file=$('file').files?.[0];if(!file)return;
 save=null;roles=[];role=null;current=null;preview=null;chosen.clear();
 showState();goals();showPreview();resetResult();
 await load(file);
}));
$('role').addEventListener('change',wrap(attach));
$('scan').addEventListener('click',wrap(scan));
$('run').addEventListener('click',wrap(run));
$('filter').addEventListener('input',goals);
$('clear').addEventListener('click',()=>{chosen.clear();resetResult();goals()});
$('copy').addEventListener('click',wrap(async()=>{
 if(!report)throw Error('복사할 결과 없음');
 await navigator.clipboard.writeText(JSON.stringify(report,null,2));
 setStatus('검사 결과 JSON 복사 완료');
}));
showState();goals();showPreview();
})();