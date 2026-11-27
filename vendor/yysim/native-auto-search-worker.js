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
 '../../engine/yysim-purple-anchor-mixed.js?rev=20261127-deep-three-lock-v8',
 '../../engine/yysim-color-only-search.js?rev=20261127-deep-verified-cost-v9');
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
  const expanded=request?.search_mode==='expanded';
  const anchor=self.YYWashPurpleAnchorMixed?.requestShape(ids,TALENT_DATA);
  let bestExtendedRoutes=[];
  const publishPartial=(result,diagnostics,stage)=>{
   if(!expanded||!Array.isArray(result?.routes))return;
   const all=[...bestExtendedRoutes,...result.routes]
    .filter(route=>Number.isFinite(Number(route?.pills))&&
     ids.every(id=>(route.final_slots||[]).some(t=>Number(t.id)===id)))
    .sort((a,b)=>Number(a.pills)-Number(b.pills)||
     Number(a.washes)-Number(b.washes));
   const seenRoutes=new Set();
   const visibleRoutes=all.filter(route=>{
    const key=JSON.stringify([route.actions,route.final_slots,Number(route.pills)]);
    if(seenRoutes.has(key))return false;seenRoutes.add(key);return true;
   }).slice(0,topN);
   bestExtendedRoutes=visibleRoutes;
   const nameIds=Object.fromEntries(Object.entries(TALENT_DATA)
    .filter(([,v])=>v?.name).map(([id,v])=>[v.name,Number(id)]));
   progress({phase:'expanded-candidate',stage,
    candidateRoutes:visibleRoutes.length,
    bestPills:visibleRoutes.length?Number(visibleRoutes[0].pills):null,
    partialResult:{result:{...result,routes:visibleRoutes},desiredIds:ids,maxPad,horizon,topN,nameIds,
     nativeFunction:'wasmSearchWashRoutes',nativeDiagnostics:diagnostics}});
  };
  let result,diagnostics,chain=null,chainFailure=null;
  if(expanded){
   // Private source states never leave the browser. The new generic graph
   // is strictly extended-only; the existing fast-search path is untouched.
   try{
    if(!self.YYWashExpandedChain)
     importScripts('../../engine/yysim-expanded-chain-search.js?rev=20261127-chain-exchange-v1');
    chain=await self.YYWashExpandedChain.run({
     desiredIds:ids,talents:TALENT_DATA,
     getState:wasmGetState,setState:wasmSetState,
     doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
     guard:canonical(),horizon:Math.max(horizon,4500),topN,
     nodeLimit:4200,
     onVerifiedCandidate:routes=>publishPartial({routes},
      {method:'expanded-native-event-chain'},
      '확장 탐색 · 임시 잠금·해제·치환으로 더 저렴한 경로 확인'),
     progress:data=>progress({...data,completed:2,total:4})
    });
    publishPartial(chain,{...chain.diagnostics},
     '확장 탐색 · 임시 재능·연쇄 치환 분기 완료');
   }catch(error){
    // State-restoration failures cannot be ignored; other failures must
    // not erase already confirmed native routes.
    if(/복원|restore/i.test(String(error?.message||error)))throw error;
    chainFailure=String(error?.message||error);
   }
  }
  if(self.YYWashColorOnly?.shape(ids,TALENT_DATA)){
   result=await self.YYWashColorOnly.run({
    desiredIds:ids,horizon:expanded?Math.max(horizon,4500):horizon,
    topN,talents:TALENT_DATA,nodeLimit:expanded?48000:18000,
    deepSearch:expanded,
    getState:wasmGetState,setState:wasmSetState,doWash:wasmDoWash,
    guard:canonical(),
    onVerifiedCandidate:expanded?routes=>publishPartial({routes},
     {method:'color-only-wasm-cost-first'},
     '확장 탐색 · 녹·파맥 검증 완료 후보 발견, 추가 경로 비교 중'):null,
    progress:data=>progress({...data,completed:2,total:4,
     stage:expanded?'확장 탐색 · 녹·파맥 비용순 경로 비교':data.stage})
   });
   diagnostics={isMixed:true,returned:result.routes.length,
    complete:result.routes.length,incomplete:0,
    method:'color-only-wasm-cost-first',...result.diagnostics};
  }else if(anchor){
   result=await self.YYWashPurpleAnchorMixed.run({
    desiredIds:ids,maxPad,horizon,topN:expanded?20:topN,
    talents:TALENT_DATA,
    getState:wasmGetState,setState:wasmSetState,search:wasmSearchWashRoutes,
    doWash:wasmDoWash,exchangeTalent:wasmExchangeTalent,
    guard:canonical(),expanded,
    onVerifiedCandidate:expanded?routes=>publishPartial({routes},
     {method:'purple-anchor-nearest-native-wash'},
     '확장 탐색 · 더 적은 세수단 혼합 경로 확인, 추가 분기 계산 중'):null,
    progress:data=>progress({...data,
     // These are observed mixed-search counters, not an estimated %.
     completed:2,total:4})
   });
   diagnostics={isMixed:true,returned:result.routes.length,
    complete:result.routes.length,incomplete:0,
    method:'purple-anchor-original-wasm',...result.diagnostics};
   publishPartial(result,diagnostics,'확장 탐색 · 자맥 중심 경로 검증 완료, 통합 비용순 경로 비교 중');
   // A purple-first backbone may miss the cheapest FINAL mixed path.
   // Also compare two-purple mixed routes using a smaller state budget:
   // the cheapest purple-only prefix need not produce the cheapest final
   // two-purple/two-color completion. Three-purple routes retain the
   // existing fallback-only behavior to avoid excessive WASM work.
   if((expanded||anchor.purple.length<=2||!result.routes.length)&&
      self.YYWashColorOnly?.mixedShape(ids,TALENT_DATA)){
    const baselineCost=result.routes.length?
     Math.min(...result.routes.map(route=>Number(route.pills)).filter(Number.isFinite)):
     Infinity;
    try{
     const supplementary=await self.YYWashColorOnly.run({
      // The heap remains node-bounded; the larger wash horizon allows
      // cost-first lookahead to reach sparse late purple/green events.
      desiredIds:ids,horizon:expanded?Math.max(horizon,4500):
       Math.min(horizon,Number.isFinite(baselineCost)?1800:2500),
      topN,talents:TALENT_DATA,
      getState:wasmGetState,setState:wasmSetState,doWash:wasmDoWash,
      guard:canonical(),allowMixed:true,initialBest:baselineCost,
      deepSearch:expanded,
      nodeLimit:expanded?28000:Number.isFinite(baselineCost)?
       (anchor.purple.length===1?1400:1000):
       (anchor.purple.length===1?3600:1800),
      onVerifiedCandidate:expanded?routes=>{
       const combined=[...result.routes,...routes]
        .filter(route=>ids.every(id=>(route.final_slots||[])
         .some(slot=>Number(slot.id)===Number(id))))
        .sort((a,b)=>Number(a.pills)-Number(b.pills)||
         Number(a.washes)-Number(b.washes));
       publishPartial({routes:combined.slice(0,topN)},diagnostics,
        '확장 탐색 · 더 적은 세수단 후보 검증, 추가 경로 비교 중');
      }:null,
      progress:data=>progress({...data,completed:2,total:4})
     });
     const complete=route=>Array.isArray(route?.final_slots)&&
      ids.every(id=>route.final_slots.some(slot=>Number(slot.id)===Number(id)));
     const combined=[...result.routes,...supplementary.routes].filter(complete)
      .filter(route=>Number.isFinite(Number(route.pills)))
      .sort((a,b)=>Number(a.pills)-Number(b.pills)||
       Number(a.washes)-Number(b.washes));
     const seen=new Set();
     result.routes=combined.filter(route=>{
      const key=JSON.stringify([route.final_slots,route.actions]);
      if(seen.has(key))return false;
      seen.add(key);return true;
     }).slice(0,topN);
     result.error=result.routes.length?null:result.error;
     diagnostics.colorFirstSupplement={
      searched:true,returned:supplementary.routes.length,
      improved:result.routes.length&&Number(result.routes[0].pills)<baselineCost,
      ...supplementary.diagnostics
     };
     diagnostics.returned=result.routes.length;
     diagnostics.complete=result.routes.length;
     publishPartial(result,diagnostics,'확장 탐색 · 더 넓은 비용순 경로 비교 완료');
    }catch(error){
     // Inability to restore the real WASM state must remain fatal.
     if(/복원|restore/i.test(String(error?.message||error)))throw error;
     diagnostics.colorFirstSupplement={
      searched:true,error:String(error?.message||error)};
    }
   }
  }else{
   if(expanded&&ids.every(id=>TALENT_DATA[String(id)]?.pinzhi===4)){
    // Wider native WASM padding is searched in independent verified passes.
    // Keep the cheapest complete routes; a single pad is not monotonic.
    const pads=[0,5,10,20,40,80,120];
    const candidates=[],signatures=new Set();
    for(let i=0;i<pads.length;i++){
     const pad=pads[i];
     progress({phase:'expanded-pad',stage:'확장 탐색 · 자맥 경로 '+(i+1)+' / '+pads.length,
      nativeAttempts:i+1,totalAttempts:pads.length});
     const pass=canonical().run({getState:wasmGetState,setState:wasmSetState,
      search:wasmSearchWashRoutes},{
       desired_ids:ids,max_pad:pad,horizon:Math.max(horizon,4500),top_n:Math.min(20,topN+8)});
     for(const route of pass.routes||[]){
      if(!ids.every(id=>(route.final_slots||[]).some(t=>Number(t.id)===id)))continue;
      const key=JSON.stringify([route.actions,route.final_slots,Number(route.pills)]);
      if(signatures.has(key))continue;
      signatures.add(key);candidates.push(route);
     }
     candidates.sort((a,b)=>Number(a.pills)-Number(b.pills)||
      Number(a.washes)-Number(b.washes));
     result={routes:candidates.slice(0,topN),scanned:(result?.scanned||0)+(pass.scanned||0),
      error:null};
     publishPartial(result,{method:'expanded-purple-pad',examinedPads:i+1},
      '확장 탐색 · 자맥 선행 범위 '+pad+'까지 비교');
     // Zero additional pills is a mathematically proven lower bound.
     // An extended search cannot improve it by testing more native pads.
     if(result.routes.some(route=>Number(route.pills)===0))break;
     await new Promise(resolve=>setTimeout(resolve,0));
    }
    result={...result,error:result.routes.length?null:'확장 자맥 경로 미발견'};
   }else{
    result=canonical().run({getState:wasmGetState,setState:wasmSetState,
     search:wasmSearchWashRoutes},request);
   }
   const isMixed=ids.some(id=>TALENT_DATA[String(id)]?.pinzhi!==4);
   const completeRoutes=result.routes.filter(route=>{
    const final=new Set((route?.final_slots||[]).map(t=>Number(t?.id)));
    return ids.every(id=>final.has(id));
   });
   diagnostics={isMixed,returned:result.routes.length,
    complete:completeRoutes.length,incomplete:result.routes.length-completeRoutes.length,
    unsupportedNotProven:isMixed&&completeRoutes.length===0};
  }
  if(expanded&&Array.isArray(result?.routes)){
   // Merge independently verified chain routes with all native anchor/cost
   // candidates. Best-known cost never worsens as more stages finish.
   const joined=[...bestExtendedRoutes,...result.routes,...(chain?.routes||[])]
    .filter(route=>Number.isFinite(Number(route?.pills))&&
     ids.every(id=>(route.final_slots||[]).some(t=>Number(t.id)===id)))
    .sort((a,b)=>Number(a.pills)-Number(b.pills)||
     Number(a.washes)-Number(b.washes));
   const unique=new Set();
   result.routes=joined.filter(route=>{
    const key=JSON.stringify([route.actions,route.final_slots,Number(route.pills)]);
    if(unique.has(key))return false;unique.add(key);return true;
   }).slice(0,topN);
   result.error=result.routes.length?null:result.error;
   diagnostics={...diagnostics,chainSearch:chain?.diagnostics||null,
    chainSearchError:chainFailure,
    returned:result.routes.length,complete:result.routes.length};
  }
  if(expanded&&Array.isArray(result?.routes)&&result.routes.length>topN){
   result.routes=result.routes.slice().sort((a,b)=>Number(a.pills)-Number(b.pills)||
    Number(a.washes)-Number(b.washes)).slice(0,topN);
   if(diagnostics){diagnostics.returned=result.routes.length;
    diagnostics.complete=result.routes.length}
  }
  progress({phase:expanded?'expanded-final':'worker-result',completed:3,total:4,
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
