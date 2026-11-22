/* Reverse reconstruction of dungeon RNG seed consumption.
 * Measured drops are constraints, never output overrides.
 * Requires before AND after saves to determine hidden RNG calls.
 * No private saves or seed values are sent to a server. */
(function(root){
'use strict';
const isSeed=x=>Number.isSafeInteger(Number(x))&&Number(x)>0;
const number=x=>Number(x?.Value??x?.value??x?.V??x?.v??x);
const DEFAULT_LIMITS=Object.freeze({maxHidden:4,maxStates:20000,maxResults:12});
function advance(seed,bound){
 if(!isSeed(seed)||!Number.isSafeInteger(bound)||bound<1)return null;
 return root.SBJWildDrop.draw(Number(seed),bound).seed;
}
function seedMap(input){
 return input?.seeds||input?.sds||{};
}
function checkStep(start,step){
 const next=advance(start,Number(step.bound));
 // The current v2 before/after values are hypotheses, NOT constraints.
 // Only the recovered draw bound is trusted during inverse alignment.
 return next!==null;
}
function candidateBounds(trace,extra=[]){
 const values=[...new Set([...(trace||[]).map(t=>Number(t.bound)),
  ...extra.map(number)].filter(x=>Number.isSafeInteger(x)&&x>0))];
 return values.sort((a,b)=>a-b);
}
function reverseKey(start,end,trace,options={}){
 const limits={...DEFAULT_LIMITS,...options};
 if(!isSeed(start)||!isSeed(end))return {status:'missing-seed',solutions:[],states:0};
 const bounds=candidateBounds(trace,options.extraBounds||[]);
 if(!bounds.length&&Number(start)!==Number(end))
  return {status:'missing-bounds',solutions:[],states:0};
 const steps=(trace||[]).map(t=>({...t,bound:Number(t.bound)}));
 if(steps.some(t=>!Number.isSafeInteger(t.bound)||t.bound<1))
  return {status:'invalid-trace',solutions:[],states:0};
 // Deterministic shortest-path search. A hidden draw may be inserted before
 // any recorded call, or after the last call. We never alter recorded bounds.
 const queue=[{seed:Number(start),index:0,hidden:0,path:[]}];
 const visited=new Set(),solutions=[];let states=0,truncated=false;
 for(let head=0;head<queue.length;head++){
  const node=queue[head];
  const identity=node.seed+':'+node.index+':'+node.hidden;
  if(visited.has(identity))continue;
  visited.add(identity);states++;
  if(states>limits.maxStates){truncated=true;break}
  if(node.index===steps.length&&node.seed===Number(end)){
   solutions.push({hiddenCalls:node.hidden,steps:node.path});
   if(solutions.length>=limits.maxResults)break;
   continue;
  }
  if(node.index<steps.length&&checkStep(node.seed,steps[node.index])){
   const step=steps[node.index],after=advance(node.seed,step.bound);
   queue.push({seed:after,index:node.index+1,hidden:node.hidden,
    path:node.path.concat({type:'known',bound:step.bound,before:node.seed,after,
      context:step.context||''})});
  }
  if(node.hidden<limits.maxHidden){
   for(const bound of bounds){
    const after=advance(node.seed,bound);
    if(after!==null)queue.push({seed:after,index:node.index,hidden:node.hidden+1,
     path:node.path.concat({type:'unknown',bound,before:node.seed,after})});
   }
  }
 }
 solutions.sort((a,b)=>a.hiddenCalls-b.hiddenCalls);
 return {status:solutions.length?'candidates':truncated?'search-limit':'unexplained',
  solutions,states,truncated,bounds};
}
function inspect(before,after,prediction,options={}){
 const starting=seedMap(before),ending=seedMap(after);
 const trace=prediction?.trace||[];
 const keys=[...new Set([...Object.keys(starting),...Object.keys(ending),
  ...trace.map(t=>t.key)])].filter(k=>trace.some(t=>t.key===k));
 const results={};
 for(const key of keys){
  const scoped=trace.filter(t=>t.key===key);
  results[key]=reverseKey(number(starting[key]),number(ending[key]),scoped,options);
 }
 return {status:!keys.length?'no-trace':'analyzed',
  keys:results,unresolved:keys.filter(k=>results[k].status!=='candidates'),
  disclaimer:'누락 호출의 횟수/범위 후보만 제시합니다. 후보가 맞더라도 실제 원본 실행 분기 검증 전에는 확정 예측이 아닙니다.'};
}
function rebuild(before,after,plan,catalog,measured,options={}){
 const v2=root.SBJDungeonV2;
 if(!v2)throw Error('기존 두 엔진의 비교 추적이 필요합니다');
 const report={};
 for(const model of ['source','native']){
  const output=model==='source'?v2.source(before,plan,options):
   v2.native(before,plan,catalog,options);
  const observed=measurement(output.rows,measured);
  const reconciled=after?inspect(before,after,output,options):
   {status:'post-save-required',unresolved:[],
    disclaimer:'실측 이후 세이브의 Sds 시드가 없어 RNG 호출 횟수를 확정할 수 없습니다'};
  report[model]={observed,reconciled,trace:output.trace,
   rows:output.rows,finalSeeds:output.finalSeeds};
 }
 return {models:report,measuredCount:(measured||[]).length,
  calibrated:false,verified:false,
  next:'실측 이후 세이브의 Sds 변화와 원본 분기 호출 검증 전에는 두 모델을 확정 예측으로 사용하지 않습니다'};
}
function measurement(rows,fixture){
 const byId=new Map((fixture||[]).map(x=>[Number(x.npc),x]));
 const checks=(rows||[]).filter(x=>byId.has(Number(x.npcId))).map(row=>{
  const expected=byId.get(Number(row.npcId));
  const pass=!!row.supported&&Number(row.item)===Number(expected.item)&&
   Number(row.color)===Number(expected.color);
  return {npc:Number(row.npcId),pass,expected:{item:expected.item,color:expected.color},
   predicted:{item:row.item,color:row.color},supported:!!row.supported};
 });
 return {checked:checks.length,matched:checks.filter(x=>x.pass).length,
  mismatches:checks.filter(x=>!x.pass),checks};
}
root.SBJDungeonInverse={advance,candidateBounds,reverseKey,inspect,measurement,rebuild};
})(window);
