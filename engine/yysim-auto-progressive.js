/* Bounded multi-pass yy-sim native automatic route search.
 * All candidate routes originate from the real WASM 'search_wash_routes' export.
 * No guessed rolls, no server-save mutation, no false global-optimal claim.
 */
(function(root){
'use strict';
function levels({maxPad=20,horizon=900,topN=10}={}){
 const configs=[
  {maxPad:Math.min(maxPad,3),horizon:Math.min(horizon,300),topN},
  {maxPad:Math.min(maxPad,8),horizon:Math.min(horizon,900),topN},
  {maxPad,horizon,topN}
 ];
 return configs.filter((x,i)=>configs.findIndex(y=>y.maxPad===x.maxPad&&
  y.horizon===x.horizon&&y.topN===x.topN)===i);
}
async function run({call,ensureSession=()=>{},api,desiredIds,maxPad=20,horizon=900,topN=10,
 onProgress=()=>{}}={}){
 if(typeof call!=='function'||!api?.options||!api?.routeOutcome)
  throw Error('yy-sim 원본 자동 탐색 엔진이 준비되지 않았습니다');
 const config=api.options({desiredIds,maxPad,horizon,topN});
 const stages=levels(config),entries=[],history=[],seen=new Set();
 let nameIds={},best=null,totalScanned=0;
 for(let i=0;i<stages.length;i++){
  ensureSession();
  const options={desiredIds:config.desiredIds,...stages[i]};
  const native=await call('auto-search',options);
  ensureSession();
  if(!native||native.nativeFunction!=='wasmSearchWashRoutes'||
    !Array.isArray(native.result?.routes))
   throw Error('원본 WASM 자동 탐색의 단계 '+(i+1)+' 응답을 확인할 수 없습니다');
  const report=api.routeOutcome(native.result,config.desiredIds);
  const scanned=report.stats.scanned||0;
  totalScanned+=scanned;
  nameIds=native.nameIds||nameIds;
  history.push({index:i+1,...stages[i],scanned,
   routes:report.stats.total,complete:report.stats.complete});
  for(const entry of report.routes){
   const key=JSON.stringify({steps:entry.actions,finalIds:entry.finalIds,
    pad:entry.pad,pills:entry.estimatedPills});
   if(seen.has(key))continue;
   seen.add(key);
   entries.push(entry.source);
  }
  const merged=api.routeOutcome({routes:entries,scanned:totalScanned},config.desiredIds);
  if(merged.routes.some(x=>x.complete))best=merged.routes.find(x=>x.complete);
  onProgress({phase:i+1,total:stages.length,history:[...history],bestPills:best?.estimatedPills??null});
 }
 return {nativeFunction:'wasmSearchWashRoutes',desiredIds:config.desiredIds,
  maxPad:config.maxPad,horizon:config.horizon,topN:config.topN,
  nameIds,history,progressive:true,result:{
   routes:entries,scanned:totalScanned,missing:[],
   error:best?null:'설정 범위 내 목표 자맥 경로 없음'},
  bestPills:best?.estimatedPills??null,
  globallyOptimal:best?.globallyOptimal===true};
}
root.YYWashProgressive={levels,run};
})(window);
