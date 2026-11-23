/* yy-sim original wash dashboard projection from a read-only WASM state.
 * Original reference: Cherish90722/yanyu_utils_v1.8_bak app.js
 * ZZ_DATA 150..154: costs [1,1,2,3,5], pity [0,700,800,850,900].
 */
(function(root){
'use strict';
const config=Object.freeze({
 150:{slots:0,cost:1,pity:0,name:'자질평범'},
 151:{slots:1,cost:1,pity:700,name:'자질과인'},
 152:{slots:2,cost:2,pity:800,name:'무림준걸'},
 153:{slots:3,cost:3,pity:850,name:'절세기재'},
 154:{slots:4,cost:5,pity:900,name:'공전절후'}
});
function whole(value,defaultValue=0){
 const n=Number(value);
 return value!=null&&Number.isFinite(n)?Math.max(0,Math.trunc(n)):defaultValue;
}
function model(state){
 if(!state||typeof state!=='object'||!Array.isArray(state.talents))
  return null;
 const zz=Number(state.zizhi),info=config[zz];
 if(!info)return null;
 const talents=state.talents.slice(0,4);
 const locked=talents.filter(x=>x?.locked===true).length;
 // Original yy-sim renderCostInfo: base + (2*locks - 1) for locks > 0.
 const cost=info.cost+(locked?2*locked-1:0);
 const lucky=whole(state.tal_lucky);
 const bag=state.has_bag_pills===true?whole(state.bag_pills):null;
 const total=whole(state.total_wash),pills=whole(state.total_pills);
 const counts=Object.fromEntries([1,2,3,4].map(q=>[q,whole(state.quality_counts?.[q])]));
 return {zizhi:zz,aptitude:info.name,slots:info.slots,locked,cost,
  pity:lucky,pityThreshold:info.pity,pityPercent:info.pity?Math.max(0,Math.min(100,lucky/info.pity*100)):0,
  bag,canWash:info.slots>0&&locked<info.slots&&(bag==null||bag>=cost),
  total,pills,gold:whole(state.gold_count),pityTriggered:whole(state.pity_count),
  exchange:whole(state.exchange_count),counts,talents};
}
root.YYWashDashboard={model,config};
})(window);
