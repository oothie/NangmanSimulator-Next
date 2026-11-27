/* Expanded-only native WASM wash-chain search. Never embeds save examples.
 * All transitions are performed on isolated WASM state; candidate paths are
 * independently replayed before being made available to the UI.
 */
(function(root){
'use strict';
const cp=x=>JSON.parse(JSON.stringify(x)),num=x=>Number(x||0);
const ids=s=>(s.talents||[]).map(t=>Number(t.id));
class Heap{
 constructor(){this.a=[]}get length(){return this.a.length}
 push(v){const a=this.a;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].priority<=v.priority)break;a[i]=a[p];i=p}a[i]=v}
 pop(){const a=this.a,v=a[0],x=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].priority<a[c].priority)c++;if(a[c].priority>=x.priority)break;a[i]=a[c];i=c}a[i]=x}return v}
}
async function run({desiredIds,talents,getState,setState,doWash,exchangeTalent,guard,
 horizon=4500,nodeLimit=3400,topN=8,initialBest=Infinity,
 onVerifiedCandidate=null,progress=()=>{}}={}){
 if(!Array.isArray(desiredIds)||desiredIds.length<1||desiredIds.length>4||
  new Set(desiredIds.map(Number)).size!==desiredIds.length)throw Error('체인 탐색 목표 오류');
 if([getState,setState,doWash,exchangeTalent].some(f=>typeof f!=='function')||
  typeof guard?.canonicalJson!=='function')throw Error('원본 WASM 체인 탐색 연결 실패');
 const original=cp(getState()),canonical=guard.canonicalJson;
 const originalKey=canonical(original),base=cp(original);
 base.has_bag_pills=true;base.bag_pills=Math.max(num(base.bag_pills),100000);
 const washStart=num(base.total_wash),pillStart=num(base.total_pills);
 const limit=Math.min(6500,Math.max(100,Number(horizon)||4500));
 const maxNodes=Math.min(12000,Math.max(200,Number(nodeLimit)||3400));
 const goals=desiredIds.map(Number),goalSet=new Set(goals);
 const name=id=>String(talents[String(id)]?.name||id);
 const grade=id=>Number(talents[String(id)]?.pinzhi||0);
 const key=s=>canonical(s);
 const restore=s=>{
  if(!setState(cp(s))||key(getState())!==key(s))
   throw Error('확장 체인 WASM 상태 복원 실패');
 };
 const checked=s=>setState(cp(s))&&key(getState())===key(s);
 const elapsed=s=>num(s.total_wash)-washStart;
 const cost=s=>num(s.total_pills)-pillStart;
 const complete=s=>goals.every(id=>ids(s).includes(id));
 const locked=s=>(s.talents||[]).filter(t=>t.locked&&goalSet.has(Number(t.id))).length;
 const flush=(actions,s)=>{
  const next=actions.slice(),w=elapsed(s);
  if(w>Number(next.at(-1)?.wash_no||0))
   next.push({kind:'wash_to',wash_no:w,pills_after:cost(s)});
  return next;
 };
 const heap=new Heap(),seen=new Set(),routeKeys=new Set(),routes=[];
 let expanded=0,generated=0,pruned=0,nativeWashes=0,exchangeAttempts=0;
 let proven=Infinity,ceiling=Number.isFinite(initialBest)?Number(initialBest):Infinity;
 function add(s,actions){
  const c=cost(s),w=elapsed(s);
  if(c<0||w<0||w>limit||c>=ceiling){pruned++;return}
  const hash=key(s);
  if(seen.has(hash)){pruned++;return}
  seen.add(hash);generated++;
  const priority=c*1000-locked(s)*30-goals.filter(id=>ids(s).includes(id)).length*10+w/1000;
  heap.push({s:cp(s),actions,c,w,priority});
 }
 function change(node,produce,action){
  const updated=produce(cp(node.s));
  if(!updated||!checked(updated)||key(updated)===key(node.s))return;
  add(cp(getState()),flush(node.actions,node.s).concat(action));
 }
 function replay(route){
  restore(base);let last=0;
  for(const a of route.actions){
   const target=Number(a.wash_no);
   if(!Number.isInteger(target)||target<last||target>limit)return false;
   while(elapsed(getState())<target){
    const before=num(getState().total_wash),ret=doWash();nativeWashes++;
    if(!ret||ret.error||num(getState().total_wash)!==before+1)return false;
   }
   if(elapsed(getState())!==target)return false;
   last=target;
   if(a.kind==='wash_to')continue;
   if(a.kind==='open_slot'){
    const old=cp(getState()),next=num(old.zizhi)+1;
    if(next!==Number(String(a.note||'').match(/15[1-4]/)?.[0]))return false;
    old.zizhi=next;old.str_gift=num(old.str_gift)+100;old.con_gift=num(old.con_gift)+100;
    if(!checked(old))return false;
   }else if(a.kind==='lock'||a.kind==='unlock'){
    const old=cp(getState()),id=Number(a.talent_id);
    if(!old.talents.some(t=>Number(t.id)===id))return false;
    old.talents=old.talents.map(t=>Number(t.id)===id?
     {...t,locked:a.kind==='lock'}:t);
    if(!checked(old))return false;
   }else if(a.kind==='exchange'){
    const old=cp(getState()),i=old.talents.findIndex(t=>Number(t.id)===Number(a.from_id));
    if(i<0)return false;
    const ret=exchangeTalent(i),next=getState();exchangeAttempts++;
    if(!ret||ret.error||key(next)===key(old)||
      Number(next.talents[i]?.id)!==Number(a.to_id))return false;
   }else return false;
  }
  return complete(getState())&&elapsed(getState())===route.washes&&
   cost(getState())===route.pills&&
   key(getState().talents)===key(route.final_slots);
 }
 function accept(node){
  const actions=flush(node.actions,node.s);
  const route={order_ids:goals,final_slots:cp(node.s.talents),
   actions,pills:node.c,washes:node.w,
   exchanges:actions.filter(a=>a.kind==='exchange').length,
   pad:0,optimal:node.c===0,native_verified:false,
   strategy:'확장 WASM 임시 잠금·해제·연쇄 치환 비용순 탐색'};
  const previous=cp(getState());
  let valid=false;
  try{valid=replay(route)}finally{restore(previous)}
  if(!valid||route.pills>proven)return;
  route.native_verified=true;
  if(route.pills<proven){proven=route.pills;routes.length=0;routeKeys.clear()}
  const signature=JSON.stringify([route.actions,route.final_slots]);
  if(routeKeys.has(signature))return;
  routeKeys.add(signature);
  if(routes.length<topN)routes.push(route);
  ceiling=Math.min(ceiling,route.pills);
  if(typeof onVerifiedCandidate==='function')
   try{onVerifiedCandidate(cp(routes))}catch(_){}
 }
 const stats={method:'expanded-native-event-chain',costOptimalityUnproven:true};
 try{
  restore(base);
  if(complete(base))accept({s:base,actions:[],c:0,w:0});
  add(base,[]);
  while(heap.length&&expanded<maxNodes&&ceiling>0){
   const node=heap.pop();expanded++;
   if(node.c>=ceiling)continue;
   restore(node.s);
   if(complete(node.s)){accept(node);continue}
   const s=node.s,w=node.w,locks=(s.talents||[]).filter(t=>t.locked).length;
   if(num(s.zizhi)<154)
    change(node,old=>({...old,zizhi:num(old.zizhi)+1,
     str_gift:num(old.str_gift)+100,con_gift:num(old.con_gift)+100}),
     {kind:'open_slot',note:'자질 '+(num(s.zizhi)+1),wash_no:w,pills_after:node.c});
   const unique=new Set();
   for(const slot of s.talents||[]){
    const id=Number(slot.id);
    if(unique.has(id))continue;
    unique.add(id);
    if(!slot.locked&&locks<3)
     change(node,old=>({...old,talents:old.talents.map(t=>
      Number(t.id)===id?{...t,locked:true}:t)}),
      {kind:'lock',talent_id:id,talent:name(id),wash_no:w,pills_after:node.c});
    else if(slot.locked)
     change(node,old=>({...old,talents:old.talents.map(t=>
      Number(t.id)===id?{...t,locked:false}:t)}),
      {kind:'unlock',talent_id:id,talent:name(id),wash_no:w,pills_after:node.c});
   }
   // Probe every actual native exchange; do not guess any output talent.
   for(let i=0;i<(s.talents||[]).length;i++){
    restore(s);
    const before=cp(getState()),from=Number(before.talents[i].id);
    const ret=exchangeTalent(i);exchangeAttempts++;
    const after=cp(getState()),to=Number(after.talents[i]?.id);
    if(!ret||ret.error||!Number.isInteger(to)||from===to||
       key(before)===key(after)||cost(after)<node.c)continue;
    add(after,flush(node.actions,s).concat({
     kind:'exchange',from_id:from,to_id:to,from:name(from),to:name(to),
     wash_no:w,pills_after:cost(after)}));
   }
   if(w>=limit)continue;
   restore(s);
   let before=num(getState().total_wash),ret=doWash();nativeWashes++;
   if(ret&&!ret.error&&num(getState().total_wash)===before+1)
    add(cp(getState()),node.actions);
   // Jump only by replayable contiguous native washes; retain the one-step
   // successor so no speculative/partial RNG states enter the frontier.
   if(expanded<=Math.min(maxNodes,1000)){
    restore(s);
    const quotas=new Map(),maxScan=Math.min(limit-w,
     expanded<100?1200:expanded<400?360:90);
    for(let k=1;k<=maxScan;k++){
     const previous=num(getState().total_wash),out=doWash();nativeWashes++;
     if(!out||out.error||num(getState().total_wash)!==previous+1)break;
     const next=cp(getState());
     if(cost(next)>=ceiling)break;
     const targets=(next.talents||[]).filter(t=>!t.locked&&
      (goalSet.has(Number(t.id))||grade(t.id)>=4));
     let found=false;
     for(const t of targets){
      const id=Number(t.id),count=quotas.get(id)||0;
      if(count<3){quotas.set(id,count+1);found=true}
     }
     if(found||k===50||k===200||k===600)add(next,node.actions);
    }
   }
   if(expanded%60===0){
    progress({phase:'expanded-chain',stage:'확장 탐색 · 임시 잠금·치환 비용순 경로',
     expandedStates:expanded,nodeBudget:maxNodes,simulatedWashes:nativeWashes,
     candidateRoutes:routes.length,bestPills:Number.isFinite(proven)?proven:null});
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
 }finally{
  restore(original);
  if(key(getState())!==originalKey)
   throw Error('확장 체인 종료 후 원본 WASM 세수 상태 불일치');
 }
 Object.assign(stats,{expandedStates:expanded,nodeBudget:maxNodes,
  generatedStates:generated,prunedStates:pruned,
  simulatedWashes:nativeWashes,exchangeAttempts,
  remainingCandidates:heap.length,verifiedBest:Number.isFinite(proven)?proven:null,
  limited:expanded>=maxNodes||heap.length>0});
 return {routes:routes.sort((a,b)=>a.pills-b.pills||a.washes-b.washes),
  scanned:nativeWashes,diagnostics:stats,error:routes.length?null:'확장 체인 탐색 한도 내 완성 경로 없음'};
}
root.YYWashExpandedChain={run};
})(self);
