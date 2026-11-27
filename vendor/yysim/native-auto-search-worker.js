/* Original yy-sim native automatic search in a separate browser Worker.
 * The original WASM remains the sole route engine. Moving its blocking call
 * off the iframe UI thread prevents the browser's "page not responding" prompt.
 * Progress events report ONLY observed stages/counters, never invented
 * internal search percentages.
 */
'use strict';
self.window=self;
importScripts('./wasm_data.js?rev=0.10.30','./core_glue.js?rev=0.10.30',
 './data.js?rev=0.10.30','../../engine/yysim-native-search-guard.js?rev=0.10.61',
 '../../engine/yysim-purple-anchor-mixed.js?rev=20261127-multi-color-deferred-v3',
 '../../engine/yysim-color-only-search.js?rev=20261127-cost-first-wash-count');
let initialized=null;
const canonical=()=>self.YYWashNativeSearchGuard;
const send=(id,kind,data)=>self.postMessage({kind,requestId:id,...data});
async function ready(){
 if(!initialized)initialized=(async()=>{
  if(!(await initWasm()))throw Error('원본 WASM 작업자 초기화에 실패했습니다');
  if(!wasmInitEngine(TALENT_DATA,ZZ_DATA))
   throw Error('원본 WASM 재능 데이터 초기화에 실패했습니다');
 })();
 try{await initialized}catch(error){initialized=null;throw error}
}
self.addEventListener('message',async event=>{
 const {kind,requestId,state,request}=event.data||{};
 if(kind!=='nangman-native-auto-search'||!Number.isSafeInteger(requestId))return;
 const progress=data=>send(requestId,'nangman-native-auto-progress',{data});
 try{
  progress({phase:'worker-init',completed:0,total:4,
   stage:'원본 계산 엔진 불러오는 중'});
  await ready();
  progress({phase:'worker-ready',completed:1,total:4,
   stage:'계산 엔진 준비 완료'});
  if(!state||typeof state!=='object')throw Error('세수 인물의 시작 상태가 없습니다');
  if(!wasmSetState(state))throw Error('세수 인물 상태를 원본 엔진에 적용할 수 없습니다');
  const before=canonical().canonicalJson(wasmGetState());
  if(before!==canonical().canonicalJson(state))
   throw Error('원본 세수 상태 전달 검증에 실패했습니다');
  progress({phase:'worker-state',completed:2,total:4,
   stage:'인물 세이브 상태 일치 확인 · 원본 경로 탐색 중'});
  const ids=request?.desired_ids||[];
  const maxPad=Number(request?.max_pad??0);
  const horizon=Number(request?.horizon??2500);
  const topN=Number(request?.top_n??8);
  const anchor=self.YYWashPurpleAnchorMixed?.requestShape(ids,TALENT_DATA);
  let result,diagnostics;
  if(self.YYWashColorOnly?.shape(ids,TALENT_DATA)){
   result=await self.YYWashColorOnly.run({
    desiredIds:ids,horizon,topN,talents:TALENT_DATA,
    getState:wasmGetState,setState:wasmSetState,doWash:wasmDoWash,
    guard:canonical(),progress:data=>progress({...data,completed:2,total:4})
   });
   diagnostics={isMixed:true,returned:result.routes.length,
    complete:result.routes.length,incomplete:0,
    method:'color-only-wasm-cost-first',...result.diagnostics};
  }else if(anchor){
   result=await self.YYWashPurpleAnchorMixed.run({
    desiredIds:ids,maxPad,horizon,topN,talents:TALENT_DATA,
    getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes,
    doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
    guard:canonical(),progress:data=>progress({...data,
     // These are observed mixed-search counters, not an estimated %.
     completed:2,total:4})
   });
   diagnostics={isMixed:true,returned:result.routes.length,
    complete:result.routes.length,incomplete:0,
    method:'purple-anchor-original-wasm',...result.diagnostics};
  }else{
   result=canonical().run({getState:wasmGetState,setState:wasmSetState,
    search:wasmSearchWashRoutes},request);
   const isMixed=ids.some(id=>TALENT_DATA[String(id)]?.pinzhi!==4);
   const completeRoutes=result.routes.filter(route=>{
    const final=new Set((route?.final_slots||[]).map(t=>Number(t?.id)));
    return ids.every(id=>final.has(id));
   });
   diagnostics={isMixed,returned:result.routes.length,
    complete:completeRoutes.length,incomplete:result.routes.length-completeRoutes.length,
    unsupportedNotProven:isMixed&&completeRoutes.length===0};
  }
  progress({phase:'worker-result',completed:3,total:4,
   stage:'원본 탐색 완료 · 최종 슬롯 및 비용 검증 중',
   candidateRoutes:result.routes?.length??0});
  if(canonical().canonicalJson(wasmGetState())!==before)
   throw Error('작업자 세수 계산 상태 복원 검증에 실패했습니다');
  const nameIds=Object.fromEntries(Object.entries(TALENT_DATA)
   .filter(([,v])=>v?.name).map(([id,v])=>[v.name,Number(id)]));
  send(requestId,'nangman-native-auto-result',{ok:true,
   data:{result,desiredIds:ids,maxPad,horizon,topN,nameIds,
    nativeFunction:'wasmSearchWashRoutes',nativeDiagnostics:diagnostics}});
 }catch(error){
  send(requestId,'nangman-native-auto-result',
   {ok:false,error:String(error?.message||error)});
 }
});
