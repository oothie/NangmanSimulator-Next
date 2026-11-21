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
 for(const item of items||[]){
  const id=n(item?.One??item?.one??item?.ID??item?.id);
  if(id)result[id]=n(item?.Two??item?.two??item?.Count??item?.count);
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
function halfDay(t){return Math.floor(Math.max(t,0)/43200)}
function nextHalfDay(t){return (halfDay(t)+1)*43200}
function resetDay(t){return Math.floor(Math.max(t+10800,0)/86400)}
function currentShelf(saved,catalog){
 return (saved||[]).map(x=>catalog.find(y=>y.id===n(x?.ID??x?.id))||
  {id:n(x?.ID??x?.id),item:0,name:'',price:0,money:0,count:1,unmapped:true,
   buyed:n(x?.Buyed)}).map(x=>({...x,buyed:n(saved?.find(y=>n(y?.ID??y?.id)===x.id)?.Buyed)}));
}
function predict(save,source,now=Math.floor(Date.now()/1000)){
 const src=source?.shops?.guishi||[];
 const shop=save?.RandShop||{},clock=n(shop.Time),hasSeed=
  Object.prototype.hasOwnProperty.call(save?.Rnds?.Sds||{},'guishishop')&&
  Number.isFinite(Number(save.Rnds.Sds.guishishop));
 const rng=new KeyRng(save?.Rnds?.Sds||{});
 const {available,soldOut}=marketPool(src,shop,save,now),vip=vipLevel(save);
 const slots=n(shop.Buy)<10?3:n(shop.Buy)<30?4:n(shop.Buy)<60?5:6;
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
  today,available,soldOut,slots,stale,tooOld:missed>1,missed,lastTime:clock,
  nextTime:nextHalfDay(now),now,paidLeft,paidMax,fresh,lucky,vip,
  getPaid(count=1){
   if(!forecastOk)return [];
   const r=rng.clone();let l=lucky;const out=[];
   for(let i=0;i<Math.min(paidLeft,Math.max(0,Math.floor(count)));i++){
    const chance=16.666666666666668+l,hit=r.chance('guishishop',chance);
    l=hit?chance-100:chance;
    out.push({step:i+1,items:draw(r,available,true,hit,slots),lucky:l});
   }
   return out;
  },
  timed(limit=8){
   if(!forecastOk)return [];
   const r=rng.clone(),out=[];
   for(let i=1;i<=Math.min(90,Math.max(0,Math.floor(limit)));i++){
    const time=(halfDay(now)+i)*43200;
    out.push({step:i,time,items:draw(r,available,false,false,slots)});
   }
   return out;
  },
  findTargets(ids,maxPeriods=30){
   const targets=new Set(ids.map(Number)),seen=new Set,events=[],test=(items,when,label,via)=>{
    for(const item of items)if(targets.has(item.id)&&!seen.has(item.id)){
     seen.add(item.id);events.push({item,when,label,via})
    }
   };
   test(today,stale?now:clock||now,'저장된 현재 판매 목록','current');
   if(!hasSeed)return events;
   const r=rng.clone();let l=lucky;
   const paid=()=>{
    const threshold=16.666666666666668+l,hit=r.chance('guishishop',threshold);
    l=hit?threshold-100:threshold;
    return draw(r,available,true,hit,slots);
   };
   for(let i=0;i<paidLeft;i++)test(paid(),now,'현재 원보 갱신 '+(i+1)+'회','paid');
   let lastDay=resetDay(now),remain=0;
   for(let i=1;i<=Math.min(180,Math.max(0,Math.floor(maxPeriods)))&&seen.size<targets.size;i++){
    const time=(halfDay(now)+i)*43200,day=resetDay(time);
    if(day>lastDay){remain=paidMax;lastDay=day}
    test(draw(r,available,false,false,slots),time,'정시 변경 '+i+'회','timed');
    const allowance=remain;
    for(let j=0;j<allowance&&seen.size<targets.size;j++){
     test(paid(),time,'정시 변경 '+i+'회 후 원보 갱신 '+(j+1)+'회','paid');
     remain--;
    }
   }
   return events;
  }
 };
}
root.NangmanMarket={predict,vipLevel,halfDay,nextHalfDay,resetDay,orderPool,countsMap,
 __test:{nextSeed,KeyRng,draw}};
})(typeof window!=='undefined'?window:globalThis);
