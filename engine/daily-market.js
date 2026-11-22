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
 for(let rareNext=rare;i<6&&attempts++<8000&&pool.length&&used.size<pool.length;){
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
function resetDay(t){return Math.floor(Math.max(t+10800,0)/86400)}
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
 const historyBlocked=missed>730,forecastOk=hasSeed&&!historyBlocked;
 const original=saved=>draw(rng,available,false,false,slots);
 let today=forecastOk?(stale?null:currentShelf(shop.Items,src)):currentShelf(shop.Items,src);
 if(forecastOk&&stale){for(let i=0;i<missed;i++)today=original()}
 today=today||[];
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
  // Explore actual RNG state after each paid/automatic replacement, not item
  // probabilities. The result is the first optimal solution in the bounded
  // explored horizon for the selected objective. State-cap failures are
  // explicit: never present them as a proved unreachable item.
  searchStrategy(shopIds,options={}){
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
   const nextDaily=t=>(resetDay(t)+1)*86400-10800;
   const nextAuto=nextHalfDay(now),deadline=nextAuto+(periodLimit-1)*43200;
   const initial={seed:n(rng.seeds.guishishop),lucky,time:now,
     nextAuto,nextDaily:nextDaily(now),period:0,used:vipAllowance.used,
     cost:0,paid:0,purchased:initialQty,lastItem:currentAvailable,
     steps:currentAvailable?[{kind:'current',time:now,items:today,
       acquired:1,totalAcquired:1}]:[]};
   let expanded=0;
   const finish=node=>({mode,found:true,when:node.time,cost:node.cost,
     paid:node.paid,item:node.lastItem,required:goal,acquired:node.purchased,
     remaining:goal-node.purchased,
     purchases:node.steps.filter(x=>x.acquired>0).map(x=>({
       kind:x.kind,time:x.time,acquired:x.acquired,totalAcquired:x.totalAcquired,
       index:x.index??null
     })),steps:node.steps,expanded,periods:periodLimit,
     vip:vipAllowance.vip,proven:true,
     purchaseCost:node.purchased*n(chosen.price),
     purchaseMoney:chosen.money});
   if(initial.purchased>=goal)return finish(initial);
   const withShelf=(node,items,step,changes={})=>{
     const match=target(items);
     const acquired=match&&node.purchased<goal?1:0;
     const totalAcquired=node.purchased+acquired;
     return {...node,...changes,purchased:totalAcquired,
       lastItem:acquired?match:node.lastItem,
       steps:node.steps.concat([{...step,items,acquired,totalAcquired}])};
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
   const cmp=(a,b)=>mode==='fastest'?
     a.time-b.time||a.cost-b.cost||a.period-b.period:
     a.cost-b.cost||a.time-b.time||a.period-b.period;
   // Keep the original best-first shortest-path exploration and daily reset.
   const heap=[],seen=new Map();
   const push=node=>{let i=heap.length;heap.push(node);
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
     const key=[node.seed,node.lucky,node.time,node.period,node.used,node.purchased].join('|');
     if(seen.has(key)&&seen.get(key)<=node.cost)continue;
     seen.set(key,node.cost);expanded++;
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
           steps:node.steps.concat([{kind:'reset',time:t,acquired:0,
             totalAcquired:node.purchased}])});
       }
     }
   }
   if(best)return finish(best);
   return {mode,found:false,required:goal,expanded,periods:periodLimit,
     vip:vipAllowance.vip,limited:heap.length>0,
     error:heap.length>0?'탐색 상태 상한에 도달했습니다. 전체 수량 획득 경로를 아직 확정하지 못했습니다.':
       '선택한 기간과 VIP 허용량에서 목표 수량을 전부 획득하는 경로를 찾지 못했습니다.'};

  }
 };
}
root.NangmanMarket={predict,vipLevel,halfDay,nextHalfDay,resetDay,orderPool,countsMap,VIP_REFRESH,
 __test:{nextSeed,KeyRng,draw}};
})(typeof window!=='undefined'?window:globalThis);
