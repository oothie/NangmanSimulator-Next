/* yy-sim daily source mechanics, adapted for Korean save. Prediction is NOT yet verified
   against live Korean-server market rotations. No game-save mutation. */
(function(root){
'use strict';
const GUISHI_ORDER=[4,40,10,5,41,22,32,118,12,7,33,100,13,14,8,45,9,6,16,35,25,26,36,27,107,207,37,216,116,38,28,18,106,117,206,217,232,205,231,30,214,224,229,227,228,211,225,223,105,222,104,204,11,114,215,115,220,219,218,19,43,226,210,209,208,201,31,103,203,200,122,119,212,112,121,221,1,23,230,24,29,102,21,17,110,15,202,113,34,39,213,42,120,44,101,3,109,2,111,108,20];
const VIP_REFRESH=[3,9,12,16,21,27],VIP_GOLD=[0,200,1000,5000,20000,50000];
const VIP_BAG=[200,250,300,350,400,500],VIP_DUNGEON=[0,0,1,1,2,3];
const MOD48=(1n<<48n)-1n,RNG_MULT=0x5deece66dn,RNG_ADD=0xbn;
function n(value,fallback=0){const x=Number(value);return value!=null&&Number.isFinite(x)?x:fallback}
function decoded(value,depth=0){
 if(value==null||depth>5)return 0;
 if(typeof value==='object')return decoded(value.val??value.Val??value.n??value.N??value.Two??value.two??value[1]??value[0],depth+1);
 return n(value);
}
function nextSeed(seed,range){
 const input=(BigInt(Math.trunc(seed+range))&0xffffffffn);
 let current=(0x330en|((input&0xffffn)<<16n)|(((input>>16n)&0xffffn)<<32n))&MOD48;
 current=(current*RNG_MULT+RNG_ADD)&MOD48;
 const a=Number(current>>17n),p=range|0;
 return {seed:a%(2047483645)+1,roll:p>0?((a%2047483645+1)%p+1):1};
}
function weightedIndex(roll,weights){
 let total=0;
 for(let i=0;i<weights.length;i++){total+=weights[i];if(roll<=total)return i}
 return weights.length-1;
}
class KeyRng{
 constructor(seeds){this.seeds={...seeds}}
 clone(){return new KeyRng(this.seeds)}
 weighted(key,weights){
  const total=weights.reduce((v,x)=>v+x,0);
  if(!(total>0))return 1;
  const next=nextSeed(n(this.seeds[key]),total);
  this.seeds[key]=next.seed;
  return weightedIndex(next.roll,weights)+1;
 }
 chance(key,pct){
  const next=nextSeed(n(this.seeds[key]),pct);
  this.seeds[key]=next.seed;
  return pct>=next.seed%100+1;
 }
}
function orderPool(pool,ids){
 const byId=new Map(pool.map(x=>[x.id,x])),output=[],seen=new Set;
 for(const id of ids){const item=byId.get(id);if(item){output.push(item);seen.add(id)}}
 for(const item of pool)if(!seen.has(item.id))output.push(item);
 return output;
}
function countsMap(items){
 const result={};
 // New Korean-server accounts can store RandShop.Counts as {} rather
 // than the older array of {One,Two}. An empty object must not throw.
 if(Array.isArray(items)){
  for(const item of items){
   const id=n(item?.One??item?.one??item?.ID??item?.id);
   if(id)result[id]=n(item?.Two??item?.two??item?.Count??item?.count);
  }
 }else if(items&&typeof items==='object'){
  for(const [key,value] of Object.entries(items)){
   const id=Number(key);
   if(Number.isSafeInteger(id)&&id>0)result[id]=decoded(value);
  }
 }
 return result;
}
function enabled(item,save,now){
 if(!item.serverP)return true;
 const vars=save?.ServerVar||save?._server?.ServerVar;
 if(Array.isArray(vars)&&vars.length){
  const found=vars.find(x=>x?.name===item.serverP);
  return !!found&&(found.beginAt==null||now>=n(found.beginAt))&&
   (found.endAt==null||now<=n(found.endAt))&&n(found.val)===1;
 }
 return item.serverP==='fn_jiayuan';
}
function marketPool(source,shop,save,now){
 const count=countsMap(shop.Counts);
 const ordered=orderPool(source,GUISHI_ORDER);
 const available=[],soldOut=[];
 for(const item of ordered){
  if(!enabled(item,save,now))continue;
  if(item.stock!=null&&(count[item.id]||0)>=item.stock)soldOut.push(item);
  else available.push(item);
 }
 return {available,soldOut};
}
function draw(rng,pool,gold,rare,slots){
 const used=new Set,result=[];let attempts=0,i=0;
 for(let rareNext=rare;i<slots&&attempts++<8000&&pool.length&&used.size<pool.length;){
  if(rareNext){
   const rarePool=pool.filter(x=>x.rare===1);
   if(!rarePool.length){rareNext=false;continue}
   const weights=rarePool.map(x=>n(x.weightGold));
   const found=rarePool[rng.weighted('guishishop',weights)-1];
   if(!found||used.has(found.id))continue;
   rareNext=false;
   if(i<slots){used.add(found.id);result.push(found)}
   i++;
  }else{
   const weights=pool.map(x=>n(gold?x.weightGold:x.weight));
   if(weights.every(x=>!(x>0)))break;
   const found=pool[rng.weighted('guishishop',weights)-1];
   if(!found||used.has(found.id))continue;
   if(i<slots){used.add(found.id);result.push(found)}
   i++;
  }
 }
 return result;
}
function vipLevel(save){
 // GoldStep is unrelated to the user's confirmed VIP level. Never infer VIP from it.
 // This helper is indicative only; the market UI uses explicit manual selection.
 const candidates=[
  ['VIP',save?.VIP],['Vip',save?.Vip],['vip',save?.vip],
  ['VipLevel',save?.VipLevel],['VIPLevel',save?.VIPLevel],
  // GoldStep is NOT confirmed to be a VIP level; do not use it.
 ];
 const explicit=candidates.find(([key,value])=>value!=null&&value!==''&&
  Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<VIP_REFRESH.length);
 if(explicit)return {vip:Number(explicit[1]),via:'세이브 '+explicit[0],gold:null,exact:true};
 const gold=decoded(save?.GoldSum??save?.goldsum??save?.goldSum??save?._server?.goldsum??save?._server?.GoldSum);
 let vip=0,via=gold>0?'누적 충전':'';
 for(let i=1;i<VIP_GOLD.length;i++)if(gold>=VIP_GOLD[i])vip=i;
 const fresh=decoded(save?.RandShop?.Fresh);
 for(let i=1;i<VIP_REFRESH.length;i++)if(fresh>VIP_REFRESH[i-1]&&i>vip){vip=i;via||='갱신 횟수 추정'}
 const bag=n(save?.BagMore),items=Array.isArray(save?.Items)?save.Items.filter(x=>!x?.ForTop).length:0;
 for(let i=1;i<VIP_BAG.length;i++)if(Math.max(0,items-bag)>VIP_BAG[i-1]&&i>vip){vip=i;via||='가방 슬롯 추정'}
 const dungeon=decoded(save?.globalVariable?.num_fuben??save?.GlobalVariable?.num_fuben);
 for(let i=1;i<VIP_DUNGEON.length;i++)if(dungeon>=VIP_DUNGEON[i]&&VIP_DUNGEON[i]>0&&i>vip){vip=i;via||='관문 횟수 추정'}
 return {vip,via:via||(vip?'세이브 추정':'미확인'),gold};
}
// Korean server ghost market resets at 08:00 and 20:00 KST
// (UTC 23:00 and 11:00). The former UTC 00/12 calculation was one hour late.
// The shift must apply to both the bucket index and its returned Unix timestamp.
const GUISHI_ROTATION_SHIFT=3600;
function halfDay(t){return Math.floor(Math.max(t+GUISHI_ROTATION_SHIFT,0)/43200)}
function nextHalfDay(t){return (halfDay(t)+1)*43200-GUISHI_ROTATION_SHIFT}
// Korean server paid-refresh allowance resets at 05:00 KST (20:00 UTC prior day).
 function resetDay(t){return Math.floor(Math.max(t+14400,0)/86400)}
function currentShelf(saved,catalog){
 return (saved||[]).map(x=>catalog.find(y=>y.id===n(x?.ID??x?.id))||
  {id:n(x?.ID??x?.id),item:0,name:'',price:0,money:0,count:1,unmapped:true,
   buyed:n(x?.Buyed)}).map(x=>({...x,buyed:n(saved?.find(y=>n(y?.ID??y?.id)===x.id)?.Buyed)}));
}
function predict(save,source,now=Math.floor(Date.now()/1000),options={}){
 const src=source?.shops?.guishi||[];
 const shop=save?.RandShop||{},clock=n(shop.Time),rawSeed=save?.Rnds?.Sds?.guishishop;
 const numericSeed=Number(rawSeed);
 const hasSeed=rawSeed!==null&&rawSeed!==undefined&&rawSeed!==''&&
  Number.isSafeInteger(numericSeed)&&numericSeed>0;
 const rng=new KeyRng(save?.Rnds?.Sds||{});
 const {available,soldOut}=marketPool(src,shop,save,now),vip=vipLevel(save);
 // Preserve the imported account's actual slot count separately from a
 // hypothetical 3..6 slot planning configuration. The 6-slot planner
 // makes no claim that an account with 3 unlocked slots can buy all 6.
 const saveSlots=n(shop.Buy)<10?3:n(shop.Buy)<30?4:n(shop.Buy)<60?5:6;
 const requestedSlots=Number(options?.slots);
 const slots=Number.isInteger(requestedSlots)&&requestedSlots>=3&&requestedSlots<=6?
   requestedSlots:saveSlots;
 const missed=clock>0?Math.max(0,halfDay(now)-halfDay(clock)):0,stale=missed>=1;
 // A years-old save can require thousands of 12h rerolls; never silently truncate a RNG chain.
 // Historical saves cannot account for intervening paid refreshes.
 // Keep their observed shelf, never silently derive a "current" future shelf.
 const historyBlocked=missed>730,forecastOk=hasSeed&&!historyBlocked&&!stale;
 let today=currentShelf(shop.Items,src);
 const fresh=clock>0&&resetDay(clock)<resetDay(now)?0:n(shop.Fresh);
 const paidMax=VIP_REFRESH[vip.vip]??3,paidLeft=Math.max(0,paidMax-fresh),lucky=n(shop.Lucky);
 return {sourceVersion:source?.ver??null,seedOk:forecastOk,seedPresent:hasSeed,historyBlocked,seed:hasSeed?n(save.Rnds.Sds.guishishop):null,
  today,available,soldOut,slots,saveSlots,stale,tooOld:missed>1,missed,lastTime:clock,
  nextTime:nextHalfDay(now),now,paidLeft,paidMax,fresh,lucky,vip,
  // VIP override is a local-only scenario; never alter the imported save.
  paidAllowance(vipOverride=vip.vip){
   const level=Math.max(0,Math.min(5,Math.trunc(n(vipOverride,vip.vip))));
   const max=VIP_REFRESH[level]??VIP_REFRESH[0];
   return {vip:level,max,used:fresh,left:Math.max(0,max-fresh)};
  },
  getPaid(count=1,options={}){
   if(!forecastOk)return [];
   const allowance=this.paidAllowance(options.vip);
   const r=rng.clone();let l=lucky;const out=[];
   for(let i=0;i<Math.min(allowance.left,Math.max(0,Math.floor(count)));i++){
    const chance=16.666666666666668+l,hit=r.chance('guishishop',chance);
    l=hit?chance-100:chance;
    out.push({step:i+1,used:allowance.used+i+1,items:draw(r,available,true,hit,slots),
      rareHit:hit,lucky:l});
   }
   return out;
  },
  timed(limit=8,options={}){
   if(!forecastOk)return [];
   const r=rng.clone(),out=[];
   // Optional simulated paid refreshes consume the SAME guishishop stream.
   // With no options this preserves the original zero-paid baseline forecast.
   let l=lucky;
   const paidSteps=Math.min(this.paidAllowance(options.vip).left,
     Math.max(0,Math.floor(n(options.paidSteps))));
   for(let i=0;i<paidSteps;i++){
     const chance=16.666666666666668+l,hit=r.chance('guishishop',chance);
     l=hit?chance-100:chance;
     draw(r,available,true,hit,slots);
   }
   for(let i=1;i<=Math.min(90,Math.max(0,Math.floor(limit)));i++){
    const time=nextHalfDay(now)+(i-1)*43200;
    out.push({step:i,time,items:draw(r,available,false,false,slots)});
   }
   return out;
  },
  findTargets(ids,maxPeriods=30,options={}){
   const mode=options?.mode??'mixed';
   const paidAllowance=this.paidAllowance(options?.vip);
   if(!['mixed','timed-only','paid-now'].includes(mode))
    throw Error('암시장 탐색 시나리오를 확인할 수 없습니다');
   const targets=new Set(ids.map(Number)),seen=new Set,events=[],test=(items,when,label,via)=>{
    for(const item of items)if(targets.has(item.id)&&!seen.has(item.id)){
     seen.add(item.id);events.push({item,when,label,via})
    }
   };
   test(today,stale?now:clock||now,'저장된 현재 판매 목록','current');
   if(!forecastOk)return events;
   const r=rng.clone();let l=lucky;
   const paid=()=>{
    const threshold=16.666666666666668+l,hit=r.chance('guishishop',threshold);
    l=hit?threshold-100:threshold;
    return draw(r,available,true,hit,slots);
   };
   if(mode!=='timed-only')
    for(let i=0;i<paidAllowance.left;i++)test(paid(),now,'현재 원보 갱신 '+(i+1)+'회','paid');
   if(mode==='paid-now')return events;
   let lastDay=resetDay(now),remain=0;
   for(let i=1;i<=Math.min(180,Math.max(0,Math.floor(maxPeriods)))&&seen.size<targets.size;i++){
    const time=nextHalfDay(now)+(i-1)*43200,day=resetDay(time);
    if(day>lastDay){remain=paidAllowance.max;lastDay=day}
    test(draw(r,available,false,false,slots),time,'정시 변경 '+i+'회','timed');
    if(mode==='mixed'){
     const allowance=remain;
     for(let j=0;j<allowance&&seen.size<targets.size;j++){
      test(paid(),time,'정시 변경 '+i+'회 후 원보 갱신 '+(j+1)+'회','paid');
      remain--;
     }
    }
   }
   return events;
  },
  // Validate strategy paths by replaying every refresh independently from
  // the imported seed. This checks model consistency, not live-server accuracy.
  auditStrategy(plan,options={}){
   if(stale)return {mode:plan?.mode||'audit',found:false,proven:false,
    modelReplayChecked:false,error:'세이브 이후의 자동 교체 및 원보 갱신 이력 미확인 · 최신 세이브로 다시 계산하세요.'};
   if(!plan?.found)return plan;
   const id=Number(options.target),goal=Math.trunc(n(options.quantity,1));
   const allowance=this.paidAllowance(options.vip),rr=rng.clone();
   let luck=lucky,used=allowance.used,paid=0,got=0;
   let t=now,auto=nextHalfDay(now),daily=(resetDay(now)+1)*86400-14400;
   const fail=reason=>({mode:plan.mode,found:false,proven:false,modelReplayChecked:false,
    required:goal,error:'암시장 경로 재검증 실패: '+reason+' · 제시된 갱신 경로를 사용하지 마세요.'});
   if(!Number.isSafeInteger(id)||goal<1||!Array.isArray(plan.steps))return fail('목표·경로 누락');
   const current=(today||[]).find(x=>x.id===id&&n(x.buyed)!==1);
   for(const step of plan.steps){
    if(!step||!['current','paid','auto','reset'].includes(step.kind)||
       !Number.isFinite(step.time)||step.time<t)return fail('시각·실행 순서');
    let items=null,rare=null;
    if(step.kind==='current'){
     if(step.time!==now||got!==0)return fail('현재 진열 목록 중복');
     items=today;
     if(step.acquired!==(current?1:0))return fail('이미 구매한 현재 상품 재구매');
    }else if(step.kind==='reset'){
     if(step.time!==daily||step.time>=auto)return fail('05시 한도 초기화 시점');
     used=0;daily=(resetDay(step.time)+1)*86400-14400;
     if(step.acquired!==0)return fail('한도 초기화 구매 수량');
    }else if(step.kind==='paid'){
     if(step.time>=daily||step.time>=auto)return fail('05시 또는 무료 교체 선행 누락');
     if(used>=allowance.max)return fail('VIP 일일 갱신 한도');
     const threshold=16.666666666666668+luck;
     rare=rr.chance('guishishop',threshold);
     luck=rare?threshold-100:threshold;
     items=draw(rr,available,true,rare,slots);
     used++;paid++;
     if(step.index!=null&&step.index!==used)return fail('원보 갱신 번호');
     if(step.rareHit!=null&&step.rareHit!==rare)return fail('특별상품 추첨');
    }else{
     if(step.time!==auto||(plan.mode!=='free'&&step.time>=daily))
      return fail('08시·20시 자동 교체 누락');
     items=draw(rr,available,false,false,slots);
     auto+=43200;
    }
    let acquired=0;
    if(items){
     if(!Array.isArray(step.items)||step.items.map(x=>x?.id).join(',')!==items.map(x=>x.id).join(','))
      return fail('시드 기반 판매 상품 순서');
     acquired=items.some(x=>x.id===id)&&got<goal?1:0;
     got+=acquired;
    }
    if(step.acquired!==acquired||step.totalAcquired!==got)
     return fail('목표 구매 수량');
    t=step.time;
   }
   if(got!==goal||plan.acquired!==goal||plan.when!==t||
      plan.paid!==paid||plan.cost!==paid*20)return fail('최종 구매 수량·일시·갱신비');
   return {...plan,modelReplayChecked:true};
  },
  // Find feasible purchase routes before attempting shortest-time proof.
  // These are deterministic policy replays of the SAME guishishop stream.
  // A candidate is never labelled as globally optimal.
  findFeasibleStrategy(shopIds,options={}){
    if(stale)return {mode:'candidate',found:false,proven:false,
     error:'세이브 이후 자동 교체·원보 갱신 내역 미확인 · 최신 세이브가 필요합니다.'};
   if(!forecastOk)return {mode:'candidate',found:false,proven:false,
    error:'암시장 시드를 복원할 수 없습니다.'};
   const ids=new Set((shopIds||[]).map(Number));
   const chosen=available.find(x=>ids.has(x.id));
   if(!chosen)return {mode:'candidate',found:false,proven:false,
    error:'구매 가능한 목표 상품이 없습니다.'};
   const goal=Math.max(1,Math.min(1000,Math.trunc(n(options.quantity,1))));
   const allowance=this.paidAllowance(options.vip);
   const horizon=Math.max(1,Math.min(720,Math.trunc(n(options.periods,120))));
   const nextDaily=t=>(resetDay(t)+1)*86400-14400;
   const deadline=nextHalfDay(now)+(horizon-1)*43200;
   const current=(today||[]).find(x=>ids.has(x.id)&&n(x.buyed)!==1);
   const candidates=[],policies=[];
   for(const first of [0,.25,.5,1])
    for(const after of [0,.25,.5,1])
     for(const gap of [1,2,3,4,6,8])
      policies.push({first,after,gap});
   let completed=0,best=null,checked=0;
   const progress=typeof options.onProgress==='function'?options.onProgress:null;
   for(const policy of policies){
    const r=rng.clone(),steps=[],purchases=[];
    let luck=lucky,used=allowance.used,paid=0,got=current?1:0,
      time=now,auto=nextHalfDay(now),daily=nextDaily(now),tick=0;
    if(current){const e={kind:'current',time,items:today,acquired:1,totalAcquired:1};
      steps.push(e);purchases.push(e)}
    const paidOnce=()=>{
     const chance=16.666666666666668+luck,rare=r.chance('guishishop',chance);
     luck=rare?chance-100:chance;
     const items=draw(r,available,true,rare,slots);
     const acquired=items.some(x=>ids.has(x.id))?1:0;
     got+=acquired;used++;paid++;
     const e={kind:'paid',time,index:used,rareHit:rare,items,acquired,totalAcquired:got};
     steps.push(e);if(acquired)purchases.push(e);
    };
    const spend=fraction=>{
     const left=Math.max(0,allowance.max-used);
     const count=Math.min(left,Math.max(0,Math.ceil(left*fraction)));
     for(let i=0;i<count&&got<goal;i++)paidOnce();
    };
    spend(policy.first);
    while(got<goal&&auto<=deadline){
     if(daily<auto){
      time=daily;used=0;daily=nextDaily(time);
      steps.push({kind:'reset',time,acquired:0,totalAcquired:got});
      if(tick%policy.gap===0)spend(policy.first);
      if(got>=goal)break;
     }
     time=auto;tick++;
     const items=draw(r,available,false,false,slots);
     const acquired=items.some(x=>ids.has(x.id))?1:0;
     got+=acquired;
     const e={kind:'auto',time,items,acquired,totalAcquired:got};
     steps.push(e);if(acquired)purchases.push(e);
     auto+=43200;
     if(got>=goal)break;
     if(tick%policy.gap===0)spend(policy.after);
    }
    checked++;
    if(got>=goal){
     completed++;
     if(!best||time<best.when||(time===best.when&&paid<best.paid)){
      best={mode:'candidate',found:true,proven:false,when:time,
       cost:paid*20,paid,required:goal,acquired:goal,remaining:0,
       steps,purchases,policiesChecked:checked,vip:allowance.vip,
       periods:horizon,purchaseCost:goal*n(chosen.price),
       purchaseMoney:chosen.money};
      if(progress)progress({checked,total:policies.length,found:true,
       when:time,paid,stage:'구매 가능 경로 발견'});
     }
    }
   }
   return best||{mode:'candidate',found:false,proven:false,
     required:goal,acquired:0,policiesChecked:checked,
     error:'검사한 갱신 방식에서는 예측 기간 내 목표 수량 전체를 구매하는 경로가 발견되지 않았습니다.'};
  },
  // Explore actual RNG state after each paid/automatic replacement, not item
  // probabilities. The result is the first optimal solution in the bounded
  // explored horizon for the selected objective. State-cap failures are
  // explicit: never present them as a proved unreachable item.
  searchStrategy(shopIds,options={}){
    if(stale)return {found:false,proven:false,
     error:'저장 시각 이후 자동 교체·원보 갱신 기록이 확인되지 않아 최단 구매 경로를 확정할 수 없습니다. 최신 세이브를 불러오세요.'};
   if(!forecastOk)return {found:false,error:historyBlocked?'기록이 오래되어 시드를 복원할 수 없습니다.':'암시장 시드가 없습니다.'};
   const ids=new Set((shopIds||[]).map(Number).filter(Number.isFinite));
   if(!ids.size)return {found:false,error:'목표 상품을 선택하세요.'};
   const chosen=available.find(x=>ids.has(x.id));
   if(!chosen){
     const exhausted=soldOut.find(x=>ids.has(x.id));
     return {found:false,unavailable:true,expanded:0,
       error:exhausted?'이 세이브에서 목표 상품의 구매 상한에 도달했습니다.':
         '현재 판매 후보에 포함되지 않은 상품입니다.'};
   }
   // A goal is the number of future PURCHASES, not the first appearance.
   // Limited goods: the caller uses stock minus save.RandShop.Counts.
   const goal=Math.max(1,Math.min(1000,Math.trunc(n(options.quantity,1))));
   const bought=countsMap(shop.Counts)[chosen.id]||0;
   const availableCount=chosen.stock==null?null:Math.max(0,chosen.stock-bought);
   if(availableCount!=null&&goal>availableCount)
    return {found:false,unavailable:true,required:goal,remaining:availableCount,
     error:'남은 구매 상한보다 많은 수량을 요청했습니다.'};
   const vipAllowance=this.paidAllowance(options.vip);
   const mode=options.mode==='free'?'free':options.mode==='fastest'?'fastest':'cheapest';
   const periodLimit=Math.max(1,Math.min(720,Math.trunc(n(options.periods,12))));
   const cap=Math.max(500,Math.min(500000,Math.trunc(n(options.maxStates,300000))));
   const costPerRefresh=20;
   const target=items=>(items||[]).find(x=>ids.has(x.id))||null;
   const current=target(today);
   const currentAvailable=current&&Number(current.buyed||0)!==1?current:null;
   // Current-shelf purchase needs no new RNG roll. Never count a previously
   // purchased entry twice or count a mere appearance as an acquisition.
   const initialQty=currentAvailable?1:0;
   const nextDaily=t=>(resetDay(t)+1)*86400-14400;
   const nextAuto=nextHalfDay(now),deadline=nextAuto+(periodLimit-1)*43200;
   const initial={seed:n(rng.seeds.guishishop),lucky,time:now,
     nextAuto,nextDaily:nextDaily(now),period:0,used:vipAllowance.used,
     cost:0,paid:0,purchased:initialQty,lastItem:currentAvailable,
     steps:currentAvailable?[{kind:'current',time:now,items:today,
       acquired:1,totalAcquired:1}]:[],
     trail:currentAvailable?{prev:null,event:{kind:'current',time:now,acquired:1,totalAcquired:1}}:null};
   let expanded=0;
   // Paths share immutable predecessors instead of copying their full history.
   const history=node=>{const events=[];for(let t=node.trail;t;t=t.prev)events.push(t.event);return events.reverse()};
   const finish=node=>{
     const steps=mode==='free'?node.steps:history(node);
     return {mode,found:true,when:node.time,cost:node.cost,
     paid:node.paid,item:node.lastItem,required:goal,acquired:node.purchased,
     remaining:goal-node.purchased,
     purchases:steps.filter(x=>x.acquired>0).map(x=>({
       kind:x.kind,time:x.time,acquired:x.acquired,totalAcquired:x.totalAcquired,
       index:x.index??null
     })),steps,expanded,periods:periodLimit,
     vip:vipAllowance.vip,proven:true,
     purchaseCost:node.purchased*n(chosen.price),
     purchaseMoney:chosen.money};
   };
   if(initial.purchased>=goal)return finish(initial);
   const withShelf=(node,items,step,changes={})=>{
     const match=target(items);
     const acquired=match&&node.purchased<goal?1:0;
     const totalAcquired=node.purchased+acquired;
     return {...node,...changes,purchased:totalAcquired,
       lastItem:acquired?match:node.lastItem,
       trail:{prev:node.trail,event:{...step,items,acquired,totalAcquired}}};
   };
   if(mode==='free'){
     // The deterministic free-only route consumes exactly one scheduled
     // shelf RNG stream every 12 hours. It has no VIP or paid refreshes.
     const rr=rng.clone(),steps=initial.steps.slice(),purchases=initialQty;
     let got=purchases,found=initial.lastItem;
     for(let i=1;i<=periodLimit&&got<goal;i++){
       const when=nextAuto+(i-1)*43200;
       const items=draw(rr,available,false,false,slots);
       const match=target(items),acquired=match?1:0;
       got+=acquired;
       if(match)found=match;
       steps.push({kind:'auto',time:when,items,acquired,totalAcquired:got});
     }
     expanded=steps.length;
     const node={...initial,purchased:got,lastItem:found,
       time:steps.at(-1)?.time??now,steps};
     if(got>=goal)return finish(node);
     return {mode,found:false,required:goal,acquired:got,remaining:goal-got,
       expanded,periods:periodLimit,vip:vipAllowance.vip,paid:0,cost:0,
       purchases:steps.filter(x=>x.acquired>0).map(x=>({
         kind:x.kind,time:x.time,acquired:x.acquired,totalAcquired:x.totalAcquired
       })),steps,limited:true,
       error:'선택한 무료 자동 교체 기간 안에서는 남은 목표 수량을 모두 획득하지 못했습니다.'};
   }
   // Admissible A*: every future refresh can buy at most one target.
   // This is an optimistic LOWER bound on the completion timestamp.
   const optimisticTime=node=>{
     let missing=goal-node.purchased;
     if(missing<=0)return node.time;
     const left=Math.max(0,vipAllowance.max-node.used);
     if(left>=missing)return node.time;
     missing-=left;
     let auto=node.nextAuto,daily=node.nextDaily,t=node.time;
     while(missing>0){
       t=Math.min(auto,daily);
       if(t>deadline)return Infinity;
       if(auto<=daily){missing--;auto+=43200}
       else{missing-=vipAllowance.max;daily=nextDaily(t)}
     }
     return t;
   };
   const cmp=(a,b)=>mode==='fastest'?
     a.bound-b.bound||a.time-b.time||b.purchased-a.purchased||a.cost-b.cost:
     a.cost-b.cost||a.time-b.time||a.period-b.period;
   // Prioritize by admissible completion date, retaining exact RNG-state branches.
   const heap=[],seen=new Map();
   const progress=typeof options.onProgress==='function'?options.onProgress:null;
   const candidate=mode==='fastest'&&options.bestCandidate?.found?options.bestCandidate:null;
   const candidateWhen=candidate?Number(candidate.when):Infinity;
   const push=node=>{
     if(mode==='fastest'){
       node.bound=optimisticTime(node);
       if(!Number.isFinite(node.bound)||node.bound>=candidateWhen)return;
     }
     let i=heap.length;heap.push(node);
     while(i>0){const p=(i-1)>>1;if(cmp(heap[p],node)<=0)break;heap[i]=heap[p];i=p}
     heap[i]=node};
   const pop=()=>{const head=heap[0],tail=heap.pop();
     if(heap.length){let i=0;
       while(true){let c=i*2+1;if(c>=heap.length)break;
         if(c+1<heap.length&&cmp(heap[c+1],heap[c])<0)c++;
         if(cmp(tail,heap[c])<=0)break;
         heap[i]=heap[c];i=c}heap[i]=tail}return head};
   push(initial);
   let best=null;
   while(heap.length&&expanded<cap){
     const node=pop();
     // Distinct acquired quantities must NOT merge into the same RNG state.
     // Pareto dominance: at identical RNG/time/lucky/allowance state,
     // no fewer acquired items and no greater cost dominates the route.
     const key=[node.seed,node.lucky,node.time,node.used].join('|');
     const frontier=seen.get(key)||[];
     if(frontier.some(x=>x.qty>=node.purchased&&x.cost<=node.cost))continue;
     seen.set(key,frontier.filter(x=>x.qty>node.purchased||x.cost<node.cost)
       .concat([{qty:node.purchased,cost:node.cost}]));
     expanded++;
     if(progress&&expanded%5000===0)progress({expanded,limit:cap,
       acquired:node.purchased,required:goal,at:node.time,queued:heap.length});
     if(node.purchased>=goal){best=node;break}
     if(node.used<vipAllowance.max){
       const rr=new KeyRng({guishishop:node.seed});
       const threshold=16.666666666666668+node.lucky;
       const rareHit=rr.chance('guishishop',threshold);
       const nextLucky=rareHit?threshold-100:threshold;
       const items=draw(rr,available,true,rareHit,slots);
       push(withShelf(node,items,{kind:'paid',time:node.time,index:node.used+1,
         rareHit},{seed:rr.seeds.guishishop,lucky:nextLucky,
         used:node.used+1,cost:node.cost+costPerRefresh,paid:node.paid+1}));
     }
     const autoFirst=node.nextAuto<=node.nextDaily;
     const t=autoFirst?node.nextAuto:node.nextDaily;
     if(t<=deadline){
       if(autoFirst){
         const rr=new KeyRng({guishishop:node.seed});
         const items=draw(rr,available,false,false,slots);
         push(withShelf(node,items,{kind:'auto',time:t},{
           seed:rr.seeds.guishishop,time:t,nextAuto:t+43200,
           nextDaily:node.nextDaily,period:node.period+1}));
       }else{
         push({...node,time:t,nextDaily:nextDaily(t),used:0,
           trail:{prev:node.trail,event:{kind:'reset',time:t,acquired:0,
             totalAcquired:node.purchased}}});
       }
     }
   }
   if(best)return finish(best);
   if(!heap.length&&candidate)return {...candidate,mode:'fastest',proven:true,expanded,
     verifiedShorterRoutes:true};
   return {mode,found:false,required:goal,expanded,periods:periodLimit,
     vip:vipAllowance.vip,limited:heap.length>0,
     error:heap.length>0?'갱신·자동 교체 조합이 탐색 상한을 초과했습니다. 시드 읽기 오류가 아니라 동일 기간의 분기 수가 과도하게 증가한 상태이며, 정확한 최단 기간은 아직 미확정입니다.':
       '선택한 기간과 VIP 허용량에서 목표 수량을 전부 획득하는 경로를 찾지 못했습니다.'};

  }
 };
}

/**
 * Korean client 60014 native event-order reconstruction.
 * Verified source functions: JHDataCenter.getRandShop/freshRandShop,
 * JHCheckShopClock, JHRandShopData, JHRandShopUtils.
 * Events MUST reflect actual client calls. Never turn elapsed 12h buckets
 * into unconditional draws; missing client-session history is unknowable.
 * Does not mutate the supplied save or production forecasts.
 */
function replayKoreanClientEvents(save,source,events,options={}){
 const shop=save?.RandShop||{};
 const rawSeed=save?.Rnds?.Sds?.guishishop;
 if(!Number.isSafeInteger(Number(rawSeed))||Number(rawSeed)<=0)
  throw Error('암시장 RNG 시드가 없습니다.');
 const slotsOverride=options?.slots;
 const slots=Number.isInteger(slotsOverride)&&slotsOverride>=3&&slotsOverride<=6?
  slotsOverride:n(shop.Buy)<10?3:n(shop.Buy)<30?4:n(shop.Buy)<60?5:6;
 const rng=new KeyRng({guishishop:Number(rawSeed)});
 const state={time:n(shop.Time),fresh:n(shop.Fresh),lucky:n(shop.Lucky),
  items:currentShelf(shop.Items,source?.shops?.guishi||[]),seed:Number(rawSeed)};
 const out=[];let lastEventTime=state.time;
 const poolAt=when=>marketPool(source?.shops?.guishi||[],shop,save,when).available;
 const newShelf=(paid,rare,when)=>{
  const pool=poolAt(when),used=new Set,result=[];
  let pendingRare=rare,attempts=0;
  while(result.length<slots&&attempts++<8000){
   const eligible=pendingRare?pool.filter(x=>x.rare===1):pool;
   if(!eligible.length)throw Error('암시장 후보 상품이 비어 있습니다.');
   const weights=eligible.map(x=>n(pendingRare?x.weightGold:(paid?x.weightGold:x.weight)));
   if(weights.reduce((a,b)=>a+b,0)<=0)throw Error('암시장 추첨 가중치가 없습니다.');
   const item=eligible[rng.weighted('guishishop',weights)-1];
   if(!item||used.has(item.id))continue;
   used.add(item.id);result.push(item);pendingRare=false;
  }
  if(result.length!==slots)throw Error('암시장 상품 슬롯 구성에 실패했습니다.');
  return result;
 };
 const checkAuto=when=>{
  if(when>state.time&&halfDay(when)!==halfDay(state.time)){
   // JHDataCenter.getRandShop invokes one freshRandShop(false), not N overdue calls.
   state.items=newShelf(false,false,when);
   state.time=when;
   return true;
  }
  return false;
 };
 for(const entry of events||[]){
  const at=Number(entry?.at),kind=entry?.kind;
  if(!Number.isSafeInteger(at)||at<lastEventTime)throw Error('암시장 이벤트 시각 순서가 잘못되었습니다.');
  lastEventTime=at;
  if(!['open','daily-reset','paid'].includes(kind))throw Error('알 수 없는 암시장 이벤트 종류입니다.');
  const auto=checkAuto(at);let rare=false;
  if(kind==='daily-reset'){state.fresh=0;}
  if(kind==='paid'){
   state.fresh++;
   const chance=100/6+state.lucky;
   rare=rng.chance('guishishop',chance);
   state.lucky=rare?chance-100:chance;
   state.items=newShelf(true,rare,at);
   // Paid refresh deliberately does not overwrite RandShop.Time in 60014.
  }
  state.seed=rng.seeds.guishishop;
  out.push({kind,at,auto,rare,seed:state.seed,lucky:state.lucky,
    fresh:state.fresh,shopTime:state.time,items:state.items.map(x=>x.id)});
 }
 return {seed:state.seed,lucky:state.lucky,fresh:state.fresh,
  shopTime:state.time,items:state.items.map(x=>x.id),events:out};
}


/**
 * Evidence-based comparison of observed Korean ghost-market endpoints.
 * The saved RandShop.Time is the last FREE redraw, not the number of missed
 * 08:00/20:00 boundaries. An endpoint alone cannot reveal intermediate visits.
 * Try each feasible count using the unmodified native event replayer.
 * No guesses are treated as confirmed matches; no save data is persisted.
 */
function verifyKoreanMarketContinuity(before,after,config,options={}){
 const first=Number(before?.RandShop?.Time||0),last=Number(after?.RandShop?.Time||0);
 const actualSeed=Number(after?.Rnds?.Sds?.guishishop);
 const actualLucky=Number(after?.RandShop?.Lucky);
 const actualItems=(after?.RandShop?.Items||[]).map(x=>Number(x?.ID??x?.id));
 const paid=Number(options?.paidCount??0);
 if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<=0||last<first)
  throw Error('암시장 세이브 시각이 올바르지 않습니다.');
 if(!Number.isSafeInteger(paid)||paid<0||paid>50)
  throw Error('암시장 원보 갱신 횟수를 확인할 수 없습니다.');
 const boundaries=[];for(let t=nextHalfDay(first);t<=last&&boundaries.length<48;t+=43200)
  boundaries.push(t);
 const total=boundaries.length;
 const maxCount=Math.min(total,Math.max(0,Number(options.maxAutomatic??total)));
 const results=[];
 for(let n=total===0?0:1;n<=maxCount;n++){
  const times=n?boundaries.slice(-n).map((t,i,a)=>i===a.length-1?last:t+1):[];
  // Auto execution requires the actual shop entry, not merely wall-clock time.
  const events=times.map(at=>({kind:'open',at}));
  for(let j=0;j<paid;j++)events.push({kind:'paid',at:last+1+j});
  const replay=replayKoreanClientEvents(before,config,events,{slots:options.slots});
  const seedMatch=replay.seed===actualSeed;
  const shelfMatch=replay.items.length===actualItems.length&&
   replay.items.every((id,i)=>id===actualItems[i]);
  const luckyMatch=Number.isFinite(actualLucky)&&
   Math.abs(replay.lucky-actualLucky)<1e-6;
  results.push({automatic:n,paid,seedMatch,shelfMatch,luckyMatch,
   exact:seedMatch&&shelfMatch&&luckyMatch,
   predictedSeed:replay.seed,predictedItems:replay.items,predictedLucky:replay.lucky});
 }
 return {boundaries:total,paid,exact:results.filter(x=>x.exact),
  tested:results.length,results,
  assumptions:'구매·기타 암시장 RNG 호출 없음, 동일 상품 후보와 가중치, 각 시각 구간당 무료 갱신 최대 1회'};
}

root.NangmanMarket={predict,replayKoreanClientEvents,verifyKoreanMarketContinuity,vipLevel,halfDay,nextHalfDay,resetDay,orderPool,countsMap,VIP_REFRESH,
 __test:{nextSeed,KeyRng,draw}};
})(typeof window!=='undefined'?window:globalThis);
