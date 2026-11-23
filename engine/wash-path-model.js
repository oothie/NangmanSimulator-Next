/* Pure presentation model for source yy-sim preview_exchange_pads.
 * No guessed RNG, no mutation of WASM state or projected paths. */
(function(root){
 'use strict';
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
 const paths=raw=>Array.isArray(raw)?raw:Array.isArray(raw?.paths)?raw.paths:
  Array.isArray(raw?.candidates)?raw.candidates:Array.isArray(raw?.results)?raw.results:
  Array.isArray(raw?.items)?raw.items:[];
 function inspect(raw,targetCount){
  const count=Number(targetCount);
  if(!Number.isInteger(count)||count<1||count>4)throw Error('목표 자맥 쌍 개수가 올바르지 않습니다.');
  return paths(raw).map((entry,index)=>{
   const nodes=Array.isArray(entry?.nodes)?entry.nodes:[];
   const matches=nodes.filter(node=>String(node?.purple_name||'')!==''&&
      node?.final_name===node?.purple_name).length;
   const reason=entry?.error?String(entry.error):'';
   const reasonKo=reason.includes('未洗到紫脉')?
    '목표 자맥이 원본 WASM 탐색 범위에 등장하지 않았습니다':
    reason?'원본 도맥법 경로 조건이 충족되지 않았습니다':'';
   const reliable=Number.isFinite(Number(entry?.pad))&&
     finite(entry?.pills)!==null&&finite(entry?.washes)!==null&&
     finite(entry?.exchanges)!==null;
   const success=!reason&&reliable&&nodes.length===count&&matches===count;
   return {index,pad:finite(entry?.pad),pills:finite(entry?.pills),
     washes:finite(entry?.washes),exchanges:finite(entry?.exchanges),
     nodes,reason,reasonKo,success,matchingNodes:matches,raw:entry};
  });
 }
 function order(records,{sort='pills',filter='success',limit=200}={}){
  if(!['pills','washes','exchanges','pad'].includes(sort))throw Error('경로 정렬 조건이 올바르지 않습니다.');
  if(!['success','all','failed'].includes(filter))throw Error('경로 검색 필터가 올바르지 않습니다.');
  if(!Number.isInteger(limit)||limit<1||limit>5001)throw Error('경로 표시 개수를 확인하세요.');
  const pool=records.filter(row=>filter==='all'||(filter==='success'?row.success:!row.success));
  const fields=[sort,...['pills','washes','exchanges','pad'].filter(x=>x!==sort)];
  return [...pool].sort((a,b)=>{
   for(const key of fields){
    const delta=(a[key]??Infinity)-(b[key]??Infinity);
    if(Number.isFinite(delta)&&delta!==0)return delta;
    if(a[key]==null&&b[key]!=null)return 1;
    if(a[key]!=null&&b[key]==null)return -1;
   }
   return a.index-b.index;
  }).slice(0,limit);
 }
 function lookup(text,nameIds,nameOf){
  const raw=String(text??'').trim();
  const named=Object.entries(nameIds||{}).find(([name])=>name===raw);
  if(named){
   const id=Number(named[1]);
   return (typeof nameOf==='function'?nameOf(id):'재능 #'+id)+' (#'+id+')';
  }
  return /[\u3400-\u9fff]/.test(raw)?'원본 재능 명칭 미연결':raw;
 }
 function describeNode(node,nameIds,nameOf){
  return {target:lookup(node?.purple_name,nameIds,nameOf),
    conflict:lookup(node?.conflict_name,nameIds,nameOf),
    final:lookup(node?.final_name,nameIds,nameOf),
    lastSlot:lookup(node?.last_slot_name,nameIds,nameOf),
    completed:node?.final_name===node?.purple_name,
    chain:Array.isArray(node?.chain)?node.chain.map(s=>{
      let val=String(s);
      for(const [name,id] of Object.entries(nameIds||{}).sort((a,b)=>b[0].length-a[0].length)){
       if(name)val=val.split(name).join((typeof nameOf==='function'?nameOf(Number(id)):'재능 #'+id)+' (#'+id+')');
      }
      return val.replace(/[\u3400-\u9fff]+/g,'원본 경로 지시 미번역');
    }):[],
    forkCount:Array.isArray(node?.shenmai_forks)?node.shenmai_forks.length:0,
    branchCount:Array.isArray(node?.chain_stop_alts)?node.chain_stop_alts.length:0
  };
 }
 const safe=v=>{
  let s=String(v??'');
  if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 function csv(records,nameIds={},nameOf){
  const keys=['선행 교체','세수단','세수 횟수','치환 횟수','목표 달성','목표 일치 수',
   '목표 자맥 및 충돌맥','예상 최종 재능','원본 경로 단계','미달성 원인','미확정 사항'];
  const lines=[keys.map(safe).join(',')];
  for(const r of records){
   const nodes=r.nodes.map(n=>describeNode(n,nameIds,nameOf));
   lines.push([r.pad??'',r.pills??'',r.washes??'',r.exchanges??'',
    r.success?'WASM 후보':'미달성',r.matchingNodes,
    nodes.map(n=>n.target+' / '+n.conflict).join(' | '),
    nodes.map(n=>n.final).join(' | '),
    nodes.flatMap(n=>n.chain).join(' → '),
    r.reasonKo,'yy-sim WASM 가상 경로 · 한국판 미검증'].map(safe).join(','));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
 }
 root.NangmanWashPath={inspect,order,lookup,describeNode,csv};
})(window);
