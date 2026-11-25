/* Off-main-thread, cancelable ghost-market strategy runner. */
'use strict';
self.window=self;
importScripts('./daily-market.js?rev=market-engine-20261125f','../vendor/yysim/daily_data.js');
self.onmessage=event=>{
 const m=event.data||{};
 if(m.type!=='calculate')return;
 try{
  const state=self.NangmanMarket.predict(m.save,self.DAILY_DATA,m.anchor,{slots:m.slots});
  const options={vip:m.vip,quantity:m.quantity,periods:m.periods,maxStates:m.maxStates||300000};
  self.postMessage({type:'progress',requestId:m.requestId,expanded:0,
   limit:options.maxStates,stage:'전체 수량 구매 경로 탐색 중'});
  let candidate,forecastPeriods=options.periods;
  // Expand the forecast horizon only if the requested horizon cannot
  // produce a feasible purchase route. Tell the UI when this happens.
  for(const periods of [...new Set([options.periods,240,360,720])].sort((a,b)=>a-b)){
   if(periods<options.periods)continue;
   forecastPeriods=periods;
   candidate=state.auditStrategy(state.findFeasibleStrategy([m.target],{...options,periods}),{target:m.target,quantity:m.quantity,vip:m.vip});
   if(candidate.found)break;
   self.postMessage({type:'progress',requestId:m.requestId,expanded:0,
    limit:options.maxStates,stage:'구매 경로 탐색 범위 확대 · '+periods+'회 확인'});
  }
  const expanded={...options,periods:forecastPeriods};
  const free=state.auditStrategy(state.searchStrategy([m.target],{...expanded,mode:'free'}),{target:m.target,quantity:m.quantity,vip:m.vip});
  self.postMessage({type:'candidate',requestId:m.requestId,
   plans:{free,candidate},forecastPeriods});
  self.postMessage({type:'progress',requestId:m.requestId,expanded:0,
   limit:options.maxStates,stage:'최소 원보 소비 경로 탐색 중'});
  const cheapest=state.auditStrategy(state.searchStrategy([m.target],{...expanded,mode:'cheapest',
   onProgress:p=>self.postMessage({type:'progress',requestId:m.requestId,...p,
    stage:'최소 원보 경로 검증 중'})}),{target:m.target,quantity:m.quantity,vip:m.vip});
  const fastest=state.auditStrategy(state.searchStrategy([m.target],{...expanded,mode:'fastest',
   bestCandidate:candidate.found?candidate:null,
   onProgress:p=>self.postMessage({type:'progress',requestId:m.requestId,...p,
    stage:'최단 기간 증명 탐색 중'})}),{target:m.target,quantity:m.quantity,vip:m.vip});
  self.postMessage({type:'result',requestId:m.requestId,
   plans:{free,candidate,cheapest,fastest},forecastPeriods});
 }catch(error){
  self.postMessage({type:'error',requestId:m.requestId,
   message:String(error?.message||error||'계산에 실패했습니다.')});
 }
};
