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
  const free=state.searchStrategy([m.target],{...options,mode:'free'});
  self.postMessage({type:'progress',requestId:m.requestId,expanded:0,
   limit:options.maxStates,stage:'전체 수량 구매 경로 탐색 중'});
  const candidate=state.findFeasibleStrategy([m.target],{...options,
   onProgress:p=>self.postMessage({type:'progress',requestId:m.requestId,
    expanded:0,limit:options.maxStates,
    stage:'구매 경로 확인 · '+p.checked+'/'+p.total+'방식'})});
  self.postMessage({type:'candidate',requestId:m.requestId,
   plans:{free,candidate}});
  const fastest=state.searchStrategy([m.target],{...options,mode:'fastest',
   onProgress:p=>self.postMessage({type:'progress',requestId:m.requestId,...p,
    stage:'최단 기간 증명 탐색 중'})});
  self.postMessage({type:'result',requestId:m.requestId,plans:{free,candidate,fastest}});
 }catch(error){
  self.postMessage({type:'error',requestId:m.requestId,
   message:String(error?.message||error||'계산에 실패했습니다.')});
 }
};
