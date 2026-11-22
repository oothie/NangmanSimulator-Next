/* Original yy-sim WASM-only route search.
 * Execute EXACTLY ONE native search_wash_routes call with the selected bounds.
 * Previous three preliminary passes plus two silent 4000/5000 extensions
 * repeated expensive native work and could search beyond the user's limit.
 * Green/blue requests are experimental native probes; reject incomplete final slots.
 */
(function(root){
'use strict';
async function run({call,ensureSession=()=>{},api,desiredIds,maxPad=0,horizon=2500,topN=10,
 onProgress=()=>{}}={}){
 if(typeof call!=='function'||!api?.options||!api?.routeOutcome)
  throw Error('자동탐색 엔진이 준비되지 않았습니다');
 const config=api.options({desiredIds,maxPad,horizon,topN});
 ensureSession();
 // The native yy-sim search is ONE opaque WASM call. Neither inspected
 // branches nor an estimated percentage is available until it completes.
 // Report only genuinely observed elapsed time, never an invented percent.
 const started=Date.now();
 let latestStage=null;
 const active=()=>onProgress({...(
  latestStage||{phase:'native',total:null,indeterminate:true,
   history:[],bestPills:null,stage:'자동탐색 경로 계산 중'}),
  elapsedSeconds:Math.floor((Date.now()-started)/1000)});
 active();
 // Let the browser paint before issuing the CPU-heavy iframe request.
 await new Promise(resolve=>setTimeout(resolve,0));
 ensureSession();
 const ticker=setInterval(()=>{try{ensureSession();active()}catch(_){/* invalidated session */}},1000);
 let native;
 try{native=await call('auto-search',config,detail=>{
  if(!detail||!detail.phase)return;
  const done=Number.isFinite(Number(detail.completed))?Number(detail.completed):null;
  const total=Number.isFinite(Number(detail.total))?Number(detail.total):null;
  const isObserved=done!==null&&total>0&&done>=0&&done<=total;
  const mixed=/^anchor-/.test(String(detail.phase));
  latestStage={phase:detail.phase,total:isObserved?total:null,
   completed:isObserved?done:null,indeterminate:!isObserved,
   percentage:isObserved?Math.round(done/total*100):null,
   elapsedSeconds:Math.floor((Date.now()-started)/1000),
   checked:detail.scannedWashes??null,found:detail.candidateRoutes??0,
   nativeAttempts:detail.nativeAttempts??null,
   history:[],bestPills:detail.bestPills??null,
   stage:mixed?(detail.phase==='anchor-purple'?
     '자맥 원본 경로 탐색 · '+(detail.nativeAttempts??0)+'번째 호출':
     detail.phase==='anchor-between'?
      '녹·파맥 실제 세수 탐색 · '+(detail.scannedWashes??0)+'회 검사':
      '원본 재능 치환 경로 검증 · '+(detail.scannedWashes??0)+'회 검사'):
    detail.stage||'원본 탐색 작업 단계 확인 중'};

  active();
 })}
 finally{clearInterval(ticker)}
 ensureSession();
 if(!native||native.nativeFunction!=='wasmSearchWashRoutes'||
    !Array.isArray(native.result?.routes))
  throw Error('yy-sim 원본 WASM 자동 탐색 응답을 확인하지 못했습니다');
 const parsed=api.routeOutcome(native.result,config.desiredIds);
 // A final-state-complete, costed native route remains a valid search
 // candidate even if its optional replay-action array is missing. Dropping
 // it would falsely inflate the best observed pill count. Replay eligibility
 // is a separate property checked by the UI before applying any actions.
 const verified=parsed.routes.filter(route=>route.complete&&
  route.estimatedPills!==null&&route.estimatedWashes!==null&&
  route.exchanges!==null&&route.pad!==null&&!route.source?.error);
 const history=[{index:1,maxPad:config.maxPad,horizon:config.horizon,topN:config.topN,
  scanned:parsed.stats.scanned||0,routes:parsed.stats.total,complete:verified.length,
  replayReady:verified.filter(route=>route.executable).length}];
 const best=verified[0]||null;
 const diagnostic=native.nativeDiagnostics||null;
 const mixedFailure=!best&&diagnostic?.isMixed===true;
 const mixedFailureMessage=mixedFailure&&diagnostic.returned>0?
  '원본 WASM이 경로 '+diagnostic.returned+'개를 반환했지만 녹·파맥 포함 목표가 최종 슬롯에 모두 남지 않아 제외했습니다. 최저 세수단 미확정':
  mixedFailure?'원본 WASM 탐색 범위 안에서 녹·파맥 포함 최종 완성 경로를 찾지 못했습니다. 최저 세수단 미확정':null;
 onProgress({phase:'verified',completed:4,total:4,percentage:100,indeterminate:false,elapsedSeconds:Math.floor((Date.now()-started)/1000),history,bestPills:best?.estimatedPills??null,
  stage:'자동탐색 결과 확인 완료'});
 return {nativeFunction:'wasmSearchWashRoutes',desiredIds:config.desiredIds,
  maxPad:config.maxPad,horizon:config.horizon,topN:config.topN,
  nameIds:native.nameIds||{},history,progressive:true,nativeDiagnostics:diagnostic,
  result:{...native.result,routes:verified.map(x=>x.source),
   // The original native error may be Chinese (purple-only request guard).
   // The user-facing mixed-grade failure must use the confirmed Korean
   // final-slot diagnosis, without implying that any minimum was found.
   error:best?null:(mixedFailureMessage||(native.result.error?
    api.koreanError?.(native.result.error):null)||
    '설정한 2,500회 탐색 범위에서 목표 재능의 최종 경로를 찾지 못했습니다.')},
  bestPills:best?.estimatedPills??null,
  globallyOptimal:best?.globallyOptimal===true};
}
root.YYWashProgressive={run};
})(window);
