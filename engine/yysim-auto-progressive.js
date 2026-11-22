/* Original yy-sim WASM-only route search.
 * Execute EXACTLY ONE native search_wash_routes call with the selected bounds.
 * Previous three preliminary passes plus two silent 4000/5000 extensions
 * repeated expensive native work and could search beyond the user's limit.
 * Mixed colors stay disabled until the native algorithm itself is extended.
 */
(function(root){
'use strict';
async function run({call,ensureSession=()=>{},api,desiredIds,maxPad=20,horizon=900,topN=10,
 onProgress=()=>{}}={}){
 if(typeof call!=='function'||!api?.options||!api?.routeOutcome)
  throw Error('yy-sim 원본 자동 탐색 엔진이 준비되지 않았습니다');
 const config=api.options({desiredIds,maxPad,horizon,topN});
 ensureSession();
 // The native yy-sim search is ONE opaque WASM call. Neither inspected
 // branches nor an estimated percentage is available until it completes.
 // Report only genuinely observed elapsed time, never an invented percent.
 const started=Date.now();
 const active=()=>onProgress({phase:'native',total:null,indeterminate:true,
  elapsedSeconds:Math.floor((Date.now()-started)/1000),
  history:[],bestPills:null,stage:'원본 yy-sim WASM 경로 탐색 실행 중'});
 active();
 // Let the browser paint before issuing the CPU-heavy iframe request.
 await new Promise(resolve=>setTimeout(resolve,0));
 ensureSession();
 const ticker=setInterval(()=>{try{ensureSession();active()}catch(_){/* invalidated session */}},1000);
 let native;
 try{native=await call('auto-search',config)}
 finally{clearInterval(ticker)}
 ensureSession();
 if(!native||native.nativeFunction!=='wasmSearchWashRoutes'||
    !Array.isArray(native.result?.routes))
  throw Error('yy-sim 원본 WASM 자동 탐색 응답을 확인하지 못했습니다');
 const parsed=api.routeOutcome(native.result,config.desiredIds);
 const verified=parsed.routes.filter(route=>route.complete&&route.executable);
 const history=[{index:1,maxPad:config.maxPad,horizon:config.horizon,topN:config.topN,
  scanned:parsed.stats.scanned||0,routes:parsed.stats.total,complete:verified.length}];
 const best=verified[0]||null;
 onProgress({phase:'verified',total:1,indeterminate:false,elapsedSeconds:Math.floor((Date.now()-started)/1000),history,bestPills:best?.estimatedPills??null,
  stage:'원본 yy-sim WASM 탐색 결과 검증 완료'});
 return {nativeFunction:'wasmSearchWashRoutes',desiredIds:config.desiredIds,
  maxPad:config.maxPad,horizon:config.horizon,topN:config.topN,
  nameIds:native.nameIds||{},history,progressive:true,
  result:{...native.result,routes:verified.map(x=>x.source),
   error:best?null:native.result.error||'설정한 원본 탐색 범위 내 최종 경로 없음'},
  bestPills:best?.estimatedPills??null,
  globallyOptimal:best?.globallyOptimal===true};
}
root.YYWashProgressive={run};
})(window);
