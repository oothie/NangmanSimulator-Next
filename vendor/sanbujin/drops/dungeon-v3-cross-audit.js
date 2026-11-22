/* Independent yy-sim/Sanbujin trace comparison.
 * A trace mismatch is diagnostic evidence, NOT an inferred game rule.
 * No measured drop is inserted into any simulated prediction. */
(function(root){
'use strict';
const n=x=>Number(x?.Value??x?.value??x?.V??x?.v??x);
const S=v=>Number.isSafeInteger(n(v))&&n(v)>0?n(v):null;
function traceFor(trace,key){return (trace||[]).filter(x=>x.key===key)}
function keysOf(source,native){return [...new Set([...(source?.trace||[]),...(native?.trace||[])].map(x=>x.key))]}
function inspect(source,native,before,after){
 const started=before?.seeds||before?.sds||{};
 const finished=after?.seeds||after?.sds||{};
 const rows=[];
 for(const key of keysOf(source,native)){
  const left=traceFor(source.trace,key),right=traceFor(native.trace,key),size=Math.min(left.length,right.length);
  let firstBoundDifference=null,firstStateDifference=null;
  for(let i=0;i<size;i++){
   if(firstBoundDifference===null&&Number(left[i].bound)!==Number(right[i].bound))firstBoundDifference=i;
   if(firstStateDifference===null&&Number(left[i].after)!==Number(right[i].after))firstStateDifference=i;
  }
  const sourceEnd=S(source.finalSeeds?.[key]),nativeEnd=S(native.finalSeeds?.[key]);
  const observedEnd=S(finished[key]);
  rows.push({key,initial:S(started[key]),actualEnd:observedEnd,
   source:{calls:left.length,end:sourceEnd,match:observedEnd===null?null:sourceEnd===observedEnd},
   native:{calls:right.length,end:nativeEnd,match:observedEnd===null?null:nativeEnd===observedEnd},
   firstBoundDifference,firstStateDifference,
   differingBound:firstBoundDifference===null?null:{
    call:firstBoundDifference+1,
    sourceBound:Number(left[firstBoundDifference].bound),
    nativeBound:Number(right[firstBoundDifference].bound)
   },differentCallCounts:left.length!==right.length,
   caveat:firstBoundDifference===null&&left.length===right.length&&firstStateDifference===null?
     '호출 범위와 시드만 동일: 보상 분기 방향·색상 구간이 다른지는 별도 검증 필요':
     '원본 이벤트/보상 분기 표를 대조해야 합니다. 무작위 누락 호출 확정 금지'});
 }
 return {rows,withAfter:!!after,
  sourceSeedMatches:rows.filter(x=>x.source.match===true).length,
  nativeSeedMatches:rows.filter(x=>x.native.match===true).length,
  disclaimer:'서로 다른 계산 경로의 최초 RNG 범위 불일치를 찾는 비교기입니다. 실제 게임의 원본 호출 순서를 증명하지 않습니다.'};
}
root.SBJDungeonV3CrossAudit={inspect,keysOf,traceFor};
})(window);
