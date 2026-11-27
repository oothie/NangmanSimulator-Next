/* Native-WASM color-only wash route search.
 * Uses actual WASM wash/lock/slot operations; all candidates end with every
 * requested goal simultaneously present. Non-exhaustive node budgets are
 * disclosed; do not label a bounded result globally optimal.
 */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const num=x=>Number(x||0);
const present=(s,ids)=>ids.every(id=>(s.talents||[]).some(t=>Number(t.id)===id));
const washNo=s=>num(s.total_wash);
const pills=s=>num(s.total_pills);
const name=(data,id)=>data[String(id)]?.name||String(id);
function shape(ids,data){
 if(!Array.isArray(ids)||ids.length<1||ids.length>4||new Set(ids).size!==ids.length)return false;
 return ids.every(id=>[2,3].includes(Number(data[String(id)]?.pinzhi)));
}
// A supplemental cost-first search may also retain purple goals.
// The original purple WASM solver remains the primary search; this native
// state search independently explores color-first locking as a bounded
// alternative, without inventing wash RNG or a synthetic finished route.
function mixedShape(ids,data){
 if(!Array.isArray(ids)||ids.length<2||ids.length>4||
    new Set(ids).size!==ids.length)return false;
 const grades=ids.map(id=>Number(data[String(id)]?.pinzhi));
 const purples=grades.filter(g=>g===4).length;
 if(purples<1||purples>=grades.length||purples>3||
    !grades.every(g=>[2,3,4].includes(g)))return false;
 const families=ids.map(id=>Number(data[String(id)]?.type));
 return families.every(x=>Number.isInteger(x)&&x>0)&&
  new Set(families).size===ids.length;
}
class Heap{
 constructor(){this.a=[];}
 get length(){return this.a.length}
 better(a,b){return a.cost<b.cost||(a.cost===b.cost&&
  (a.held>b.held||(a.held===b.held&&a.washes<b.washes)));}
 push(v){
  const a=this.a;let i=a.length;a.push(v);
  while(i>0){const p=(i-1)>>1;if(!this.better(v,a[p]))break;a[i]=a[p];i=p;}
  a[i]=v;
 }
 pop(){
  const a=this.a,out=a[0],last=a.pop();
  if(!a.length)return out;
  let i=0;while(true){
   let c=i*2+1;if(c>=a.length)break;
   if(c+1<a.length&&this.better(a[c+1],a[c]))c++;
   if(!this.better(a[c],last))break;
   a[i]=a[c];i=c;
  }a[i]=last;return out;
 }
}
async function run({desiredIds,horizon=2500,topN=8,talents,getState,setState,
 doWash,guard,progress=()=>{},nodeLimit=18000,allowMixed=false,
 initialBest=Infinity,onVerifiedCandidate=null}={}){
 const supplemental=allowMixed&&mixedShape(desiredIds,talents);
 if(!(supplemental||shape(desiredIds,talents)))
  throw Error('원본 WASM 비용순 탐색에서 지원하지 않는 목표 조합입니다');
 if([getState,setState,doWash].some(f=>typeof f!=='function')||!guard?.canonicalJson)
  throw Error('세수 WASM 상태 및 세수 함수가 준비되지 않았습니다');
 const source=clone(getState());
 const before=guard.canonicalJson(source);
 const base=clone(source);
 base.has_bag_pills=true;
 base.bag_pills=Math.max(100000,num(base.bag_pills));
 const startWash=washNo(base),startPills=pills(base);
 const maxWashes=Math.max(20,Math.min(5000,Number(horizon)||2500));
 const maxNodes=Math.max(supplemental?600:2000,
  Math.min(50000,Number(nodeLimit)||18000));
 const queue=new Heap(),seen=new Set(),routes=[];
 let generated=0,explored=0,pruned=0,failures=0,restored=0,nativeWashes=0,
 best=Number.isFinite(initialBest)?Math.max(0,Number(initialBest)):Infinity;
 // Supplemental mixed searches spend a small fixed budget jumping through
 // real WASM washes to the next observable missing goal. These are ADDITIONAL
 // branches, not replacements for the cost-first one-wash transitions.
 let lookaheadNodes=0,lookaheadHits=0;
 // Rare purple events may be hundreds of washes apart. Concentrate the
 // additional scan budget on a handful of low-cost frontier states rather
 // than spreading short scans across many equivalent branches.
 const lookaheadNodeLimit=supplemental?10:0;
 const lookaheadWashLimit=supplemental?Math.min(360,maxWashes):0;
 const diagnostics={method:supplemental?'mixed-color-first-wasm-cost':'color-only-wasm-cost-first',
  isMixed:true,desiredCount:desiredIds.length,
  incumbentUpperBound:Number.isFinite(best)?best:null,
  expandedStates:0,generatedStates:0,prunedStates:0,failedTransitions:0,
  nodeBudget:maxNodes,horizon:maxWashes,costOptimalityUnproven:true};
 const restore=s=>{
  if(!setState(clone(s))||guard.canonicalJson(getState())!==guard.canonicalJson(s))
   throw Error('세수 WASM 분기 상태를 복원하지 못했습니다');
  restored++;
 };
 function add(state,actions){
  const cost=pills(state)-startPills,washes=washNo(state)-startWash;
  if(cost<0||washes<0||washes>maxWashes||cost>best){pruned++;return}
  // Exact-state dedup does not merge merely similar RNG streams.
  const key=guard.canonicalJson(state);
  if(seen.has(key)){pruned++;return}
  seen.add(key);generated++;
  const held=desiredIds.filter(id=>(state.talents||[]).some(t=>Number(t.id)===id&&t.locked)).length;
  queue.push({state,actions,cost,washes,held});
 }
 // Verify completed paths by replaying their displayed operations from the
 // starting WASM state. A correct final slot snapshot alone is not enough:
 // the lock/open-slot sequence must reproduce the same pills and wash count.
 const talentIdsByName=new Map(Object.keys(talents).map(id=>
  [name(talents,id),Number(id)]));
 function verifyRoute(route){
  restore(base);
  const start=washNo(getState());
  const washUntil=target=>{
   if(!Number.isInteger(target)||target<0||target>maxWashes)return false;
   while(washNo(getState())<start+target){
    const at=washNo(getState()),ret=doWash();
    if(!ret||ret.error||washNo(getState())!==at+1)return false;
   }
   return washNo(getState())===start+target;
  };
  for(const action of route.actions||[]){
   if(!washUntil(Number(action.wash_no||0)))return false;
   if(action.kind==='wash_to')continue;
   if(action.kind==='open_slot'){
    const match=String(action.note||'').match(/15[1-4]/);
    const target=match?Number(match[0]):NaN;
    const current=clone(getState());
    if(!Number.isInteger(target)||target!==Number(current.zizhi)+1)return false;
    const next={...current,zizhi:target,
     str_gift:num(current.str_gift)+100,con_gift:num(current.con_gift)+100};
    if(!setState(next)||Number(getState().zizhi)!==target)return false;
   }else if(action.kind==='lock'||action.kind==='unlock'){
    // Numeric identity is recorded internally so duplicate display names
    // cannot replay-lock the wrong talent. The UI still shows Korean names.
    let id=Number.isInteger(Number(action.talent_id))&&
     action.talent_id!=null?Number(action.talent_id):
     talentIdsByName.get(String(action.talent));
    if(id==null&&Number.isInteger(Number(action.talent)))
     id=Number(action.talent);
    const current=clone(getState());
    if(!current.talents.some(t=>Number(t.id)===id))return false;
    const next={...current,talents:current.talents.map(t=>
     Number(t.id)===id?{...t,locked:action.kind==='lock'}:t)};
    if(!setState(next))return false;
   }else return false;
  }
  const final=getState();
  return washNo(final)-start===route.washes&&
   pills(final)-startPills===route.pills&&
   present(final,desiredIds)&&
   guard.canonicalJson(final.talents)===guard.canonicalJson(route.final_slots);
 }
 let lastBroadcast='';
 function notifyCandidate(){
  if(typeof onVerifiedCandidate!=='function'||!routes.length)return;
  // A candidate is not published until its exact native WASM wash/lock
  // actions have been independently replayed from the initial state.
  const current=clone(getState());
  try{
   const verified=[];
   for(const route of routes){
    try{if(verifyRoute(route))verified.push(route)}catch(_){}
   }
   if(!verified.length)return;
   const signature=JSON.stringify(verified.map(r=>[r.pills,r.washes,r.actions]));
   if(signature===lastBroadcast)return;
   lastBroadcast=signature;
   try{onVerifiedCandidate(clone(verified))}catch(_){}
  }finally{restore(current)}
 }
 function greedy(mode){
  // Obtain a completed native-WASM upper bound before spending the
  // cost-ordered search budget. Each mode uses a distinct real slot timing.
  restore(base);
  let current=clone(getState()),actions=[];
  const atStart=washNo(current);
  // Unrelated old locks may leave no replaceable slots; release them in
  // this trial only. The cost search also tests retaining those locks.
  const unlocked=current.talents.map(t=>({...t,locked:
   desiredIds.includes(Number(t.id))&&!!t.locked}));
  if(unlocked.some((t,i)=>t.locked!==current.talents[i].locked)){
   const old=current;
   if(setState({...old,talents:unlocked})){
    current=clone(getState());
    for(const t of old.talents.filter(t=>t.locked&&!desiredIds.includes(Number(t.id))))
     actions.push({kind:'unlock',talent_id:Number(t.id),talent:name(talents,Number(t.id)),
      wash_no:0,pills_after:0});
   }
  }
  for(let offset=0;offset<=maxWashes;offset++){
   current=clone(getState());
   const at=washNo(current);
   for(const id of desiredIds){
    const entry=current.talents.find(t=>Number(t.id)===id);
    if(!entry||entry.locked)continue;
    const next={...current,talents:current.talents.map(t=>
     Number(t.id)===id?{...t,locked:true}:t)};
    if(!setState(next))continue;
    current=clone(getState());
    if(at-startWash>Number(actions.at(-1)?.wash_no??0))
     actions.push({kind:'wash_to',wash_no:at-startWash,
      pills_after:pills(current)-startPills});
    actions.push({kind:'lock',talent_id:id,talent:name(talents,id),wash_no:at-startWash,
     pills_after:pills(current)-startPills});
   }
   if(present(current,desiredIds)){
    const cost=pills(current)-startPills;
    if(cost<best){best=cost;routes.length=0}
    if(cost===best&&routes.length<topN)routes.push({
     order_ids:[...desiredIds],final_slots:clone(current.talents),
     actions:clone(actions),pills:cost,washes:at-startWash,
     exchanges:0,pad:0,optimal:false,native_verified:true,
     strategy:supplemental?'원본 WASM 자맥·녹파맥 통합 비용순 예비 탐색':'원본 WASM 녹·파맥 선행 완성 경로'
    });
    notifyCandidate();
    return true;
   }
   if(offset===maxWashes||pills(current)-startPills>=best)break;
   const needed=mode==='upfront'?desiredIds.length:
    Math.min(desiredIds.length,desiredIds.filter(id=>
     current.talents.some(t=>Number(t.id)===id&&t.locked)).length+1);
   const required=Math.max(151,150+needed);
   while(Number(current.zizhi)<required&&Number(current.zizhi)<154){
    const next={...current,zizhi:Number(current.zizhi)+1,
     str_gift:num(current.str_gift)+100,con_gift:num(current.con_gift)+100};
    if(!setState(next))return false;
    current=clone(getState());
    actions.push({kind:'open_slot',note:'자질 '+next.zizhi,
     wash_no:at-startWash,pills_after:pills(current)-startPills});
   }
   nativeWashes++;
   const washed=doWash(),after=getState();
   if(!washed||washed.error||washNo(after)!==at+1)break;
  }
  return false;
 }
 try{
  for(const mode of ['progressive','upfront']){
   try{greedy(mode)}catch(error){
    diagnostics.greedyErrors=(diagnostics.greedyErrors||0)+1;
   }
  }
  diagnostics.greedyBest=Number.isFinite(best)?best:null;
  restore(base);
  add(clone(getState()),[]);
  while(queue.length&&explored<maxNodes){
   const node=queue.pop();explored++;
   if(node.cost>best)break;
   restore(node.state);
   if(present(node.state,desiredIds)){
    if(node.cost<best){best=node.cost;routes.length=0;}
    if(node.cost===best&&routes.length<topN){
     const actions=node.actions.map(a=>({...a}));
     const finalWash=washNo(node.state);
     // The last color may appear in an unlocked slot during a wash. The
     // final wash is essential even if no explicit lock follows it.
     if(finalWash-startWash>Number(actions[actions.length-1]?.wash_no??0))
      actions.push({kind:'wash_to',wash_no:finalWash-startWash,pills_after:node.cost});
     routes.push({
      order_ids:[...desiredIds],final_slots:clone(node.state.talents),
      actions,pills:node.cost,washes:node.washes,
      exchanges:0,pad:0,optimal:false,native_verified:true,
      strategy:supplemental?'원본 WASM 자맥·녹파맥 통합 비용순 경로':'원본 WASM 비용순 녹·파맥 탐색'
     });
     notifyCandidate();
    }
    // At this cost, no further wash/lock action is needed.
    continue;
   }
   if(node.cost>=best){pruned++;continue}
   const state=node.state,at=washNo(state);
   // Opening a slot is zero-pill and may change future wash costs/stream.
   if(Number(state.zizhi)<154){
    restore(state);
    const next={...state,zizhi:Number(state.zizhi)+1,
     str_gift:num(state.str_gift)+100,con_gift:num(state.con_gift)+100};
    if(setState(clone(next))&&Number(getState().zizhi)===next.zizhi)
     add(clone(getState()),node.actions.concat({
      kind:'open_slot',note:'자질 '+next.zizhi,wash_no:at-startWash,
      pills_after:pills(getState())-startPills
     }));
    else failures++;
   }
   // Lock an observed goal at its actual WASM position, or defer locking
   // and search the next native event at the lower current wash cost.
   for(const talent of state.talents||[]){
    const id=Number(talent.id);
    if(!desiredIds.includes(id)||talent.locked)continue;
    restore(state);
    const next={...state,talents:state.talents.map(t=>Number(t.id)===id?{...t,locked:true}:t)};
    if(setState(clone(next))){
     const current=clone(getState());
     if(current.talents.some(t=>Number(t.id)===id&&t.locked))
      add(current,node.actions.concat({
       kind:'wash_to',wash_no:at-startWash,pills_after:pills(current)-startPills
      },{
       kind:'lock',talent_id:id,talent:name(talents,id),wash_no:at-startWash,
       pills_after:pills(current)-startPills
      }));
     else failures++;
    }else failures++;
   }
   // Existing unrelated locked talents can be released when more free
   // slots are needed; retaining them remains a separately explored path.
   for(const talent of state.talents||[]){
    if(!talent.locked||desiredIds.includes(Number(talent.id)))continue;
    restore(state);
    const id=Number(talent.id);
    const next={...state,talents:state.talents.map(t=>Number(t.id)===id?{...t,locked:false}:t)};
    if(setState(clone(next)))add(clone(getState()),node.actions.concat({
     kind:'unlock',talent_id:id,talent:name(talents,id),wash_no:at-startWash,
     pills_after:pills(getState())-startPills
    }));
    else failures++;
   }
   // Seed the heap with several nearby real WASM goal sightings.
   // A rare purple sighting can otherwise be buried under thousands of
   // cheaper intermediate one-wash nodes in a bounded mixed search.
   // Slot-opening and every ordinary wash step still remain in the heap.
   if(lookaheadNodes<lookaheadNodeLimit&&node.washes<maxWashes&&
      !state.talents.some(t=>desiredIds.includes(Number(t.id))&&!t.locked)){
    lookaheadNodes++;
    restore(state);
    let hits=0;
    for(let step=0;step<lookaheadWashLimit&&
        node.washes+step<maxWashes;step++){
     const beforeWash=washNo(getState());
     nativeWashes++;
     const washed=doWash(),scanState=getState();
     if(!washed||washed.error||washNo(scanState)!==beforeWash+1){
      failures++;break;
     }
     const spent=pills(scanState)-startPills;
     if(spent>=best)break;
     const found=(scanState.talents||[]).some(t=>
      desiredIds.includes(Number(t.id))&&!t.locked);
     if(found){
      add(clone(scanState),node.actions);
      lookaheadHits++;
      if(++hits>=3)break;
     }
    }
   }
   if(node.washes<maxWashes){
    restore(state);
    nativeWashes++;
    const washed=doWash(),next=getState();
    if(washed&&!washed.error&&washNo(next)===at+1)
     add(clone(next),node.actions);
    else failures++;
   }
   if(explored%250===0){
    progress({phase:'color-native-cost',stage:supplemental?'자맥·녹파맥 통합 비용순 후보 비교 중':'녹·파맥 실제 세수 비용순 탐색 중',
     scannedWashes:nativeWashes,candidateRoutes:routes.length,bestPills:Number.isFinite(best)?best:null,
     expandedStates:explored,nodeBudget:maxNodes});
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
  // A result is surfaced only if its claimed wash/lock route can be
  // reproduced independently on the unchanged native WASM state.
  const verified=[];
  let replayRejected=0;
  for(const route of routes){
   let ok=false;
   try{ok=verifyRoute(route)}catch(_){ok=false}
   if(ok)verified.push(route);
   else replayRejected++;
  }
  routes.splice(0,routes.length,...verified);
  diagnostics.replayValidated=verified.length;
  diagnostics.replayRejected=replayRejected;
 }finally{
  if(!setState(clone(source))||guard.canonicalJson(getState())!==before)
   throw Error('녹·파맥 탐색 종료 후 원본 WASM 상태 복원 검증 실패');
 }
 routes.sort((a,b)=>a.pills-b.pills||a.washes-b.washes);
 Object.assign(diagnostics,{expandedStates:explored,generatedStates:generated,
  prunedStates:pruned,failedTransitions:failures,restoreChecks:restored,
  nodeLimitReached:explored>=maxNodes,remainingCandidates:queue.length,
  simulatedWashes:nativeWashes,lookaheadNodes,lookaheadHits,
  lowestObservedPills:Number.isFinite(best)?best:null});
 return {routes,scanned:nativeWashes,diagnostics,
  error:routes.length?null:'원본 WASM 비용순 탐색 범위에서 목표 재능을 모두 보유하는 경로를 찾지 못했습니다. 최솟값은 확정되지 않았습니다.'};
}
root.YYWashColorOnly={shape,mixedShape,run};
})(self);
