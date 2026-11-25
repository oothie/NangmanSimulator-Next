'use strict';
/**
 * Cross-model weighted-EFFECT sensitivity inventory for the original Korean
 * 60014 low-gate source tables. No RNG progression, save, or native proof.
 */
const {GROUPS}=require('./audit_40_table_synthetic_key.cjs');
const {informativeIntervals}=require('./discriminate_table_orders.cjs');
function sensitivity(){
 const tables=[],gates=[];
 for(const group of GROUPS){
  const all=[];
  for(const [kind,paths] of Object.entries(group)){
   if(kind==='gate')continue;
   for(const path of paths){
    const result=informativeIntervals(group.gate,path);
    const stable=result.intervals.filter(x=>!x.discriminating)
      .reduce((n,x)=>n+x.end-x.start+1,0);
    all.push({gate:group.gate,path,kind,totalRolls:result.dynamic?null:100,
     discriminatingRolls:result.dynamic?null:result.discriminatingRollCount,
     stableEffectRolls:result.dynamic?null:stable,
     dynamic:result.dynamic,
     decisiveIntervals:result.intervals.filter(x=>x.discriminating)
      .map(x=>({start:x.start,end:x.end,effects:x.effects}))});
   }
  }
  tables.push(...all);
  const staticRows=all.filter(x=>!x.dynamic);
  gates.push({gate:group.gate,staticTableCount:staticRows.length,
   dynamicTableCount:all.length-staticRows.length,
   modeledRolls:staticRows.reduce((n,x)=>n+x.totalRolls,0),
   differentiatingRolls:staticRows.reduce((n,x)=>n+x.discriminatingRolls,0),
   stableEffectRolls:staticRows.reduce((n,x)=>n+x.stableEffectRolls,0)});
 }
 const sum=(k)=>gates.reduce((n,g)=>n+g[k],0);
 return {schema:'korean-60014-20-80-gate-order-sensitivity-v1',
  tableCount:tables.length,staticTableCount:sum('staticTableCount'),
  dynamicTableCount:sum('dynamicTableCount'),
  modeledRolls:sum('modeledRolls'),
  differentiatingRolls:sum('differentiatingRolls'),
  stableEffectRolls:sum('stableEffectRolls'),gates,tables,
  assumption:'Original static typed weighted branches + three unverified LuaJIT table construction models',
  nativeBranchOrderVerified:false,originalRollObservableFromSave:false,
  originalRngConsumptionVerified:false,futureItemColorPredictionVerified:false,
  containsPrivateData:false};
}
module.exports={sensitivity};
