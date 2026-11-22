/* Off-main-thread, cancelable ghost-market strategy runner. */
'use strict';
self.window=self;
importScripts('./daily-market.js','../vendor/yysim/daily_data.js');
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
   candidate=state.findFeasibleStrategy([m.target],{...options,periods});
   if(candidate.found)break;
   self.postMessage({type:'progress',requestId:m.requestId,expanded:0,
    limit:options.maxStates,stage:'구매 경로 탐색 범위 확대 · '+periods+'회 확인'});
  }
  const expanded={...options,periods:forecastPeriods};
  const free=state.searchStrategy([m.target],{...expanded,mode:'free'});
  self.postMessage({type:'candidate',requestId:m.requestId,
   plans:{free,candidate},forecastPeriods});
  const fastest=state.searchStrategy([m.target],{...expanded,mode:'fastest',
   bestCandidate:candidate.found?candidate:null,
   onProgress:p=>self.postMessage({type:'progress',requestId:m.requestId,...p,
    stage:'최단 기간 증명 탐색 중'})});
  self.postMessage({type:'result',requestId:m.requestId,
   plans:{free,candidate,fastest},forecastPeriods});
 }catch(error){
  self.postMessage({type:'error',requestId:m.requestId,
   message:String(error?.message||error||'계산에 실패했습니다.')});
 }
};
