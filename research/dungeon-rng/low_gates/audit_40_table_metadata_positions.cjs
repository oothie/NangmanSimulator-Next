'use strict';
/**
 * Three-way original-source-guided LuaJIT 2.1-beta3 table constructor audit:
 * synthetic metadata key ('key') inserted FIRST, LAST, or ABSENT.
 *
 * Inputs: immutable Korean 60014 source table shapes in
 * audit_40_table_synthetic_key.cjs, and TWO DYNAMIC TABLES with explicitly
 * synthetic counters roll_1216=0 and roll_1049=0.
 *
 * No live save, native pairs observation or original RNG is involved.
 * Candidate model orders have been independently compared against the
 * preserved 2026-11-25 SourceTable 2.1-beta3 reconstruction.
 */
const {GROUPS,TYPES}=require('./audit_40_table_synthetic_key.cjs');
const PATTERNS=Object.freeze({
 three:Object.freeze({keys:TYPES.three.keys,first:TYPES.three.ghost,last:[40,50,10],absent:TYPES.three.clean}),
 color:Object.freeze({keys:TYPES.color.keys,first:TYPES.color.ghost,last:[5,30,15,50],absent:TYPES.color.clean}),
 mixed:Object.freeze({keys:TYPES.mixed.keys,first:TYPES.mixed.ghost,last:['50 ',50],absent:TYPES.mixed.clean}),
 dynamic60:Object.freeze({keys:[60,40],first:[40,60],last:[60,40],absent:[60,40]}),
 dynamic80:Object.freeze({keys:[80,20],first:[20,80],last:[80,20],absent:[80,20]})
});
function winner(order,roll){
 if(!Number.isSafeInteger(roll)||roll<1)throw RangeError('Positive synthetic integer roll required');
 let cumulative=0;
 for(const key of order){
  cumulative+=Number(key);
  if(roll<=cumulative)return typeof key+':'+String(key);
 }
 throw new RangeError('Synthetic roll exceeds total original weights');
}
function audit(){
 let records=[],counts={firstVsLast:0,firstVsAbsent:0,lastVsAbsent:0,allModelAgree:0};
 for(const group of GROUPS){
  for(const [kind,paths] of Object.entries(group)){
   if(kind==='gate')continue;
   for(const path of paths){
    const type=kind==='dynamic'?(group.gate==='취선채'?'dynamic60':'dynamic80'):kind;
    const table=PATTERNS[type];
    if(!table)throw Error('Unknown 60014 original table pattern');
    const total=table.keys.reduce((n,k)=>n+Number(k),0);
    const diff={firstVsLast:0,firstVsAbsent:0,lastVsAbsent:0,allModelAgree:0};
    for(let roll=1;roll<=total;roll++){
     const a=winner(table.first,roll),b=winner(table.last,roll),c=winner(table.absent,roll);
     if(a!==b)diff.firstVsLast++;
     if(a!==c)diff.firstVsAbsent++;
     if(b!==c)diff.lastVsAbsent++;
     if(a===b&&b===c)diff.allModelAgree++;
    }
    for(const k of Object.keys(counts))counts[k]+=diff[k];
    records.push({gate:group.gate,path,pattern:type,originalTypedKeys:table.keys.map(k=>({type:typeof k,value:k})),
     total,...diff,strictNativeOrderProven:false,
     dynamicCounterValues:type.startsWith('dynamic')?{roll_1216:0,roll_1049:0}:null});
   }
  }
 }
 const total=records.reduce((sum,x)=>sum+x.total,0);
 return {
  scope:'40 Korean 60014 low-gate weighted original tables; 3 hypothetical hash constructor orders',
  staticTables:records.filter(x=>!x.pattern.startsWith('dynamic')).length,
  dynamicallyWeightedTables:records.filter(x=>x.pattern.startsWith('dynamic')).length,
  tableCount:records.length,totalSyntheticRolls:total,counts,records,
  dynamicCounterAssumption:'both roll_1216 and roll_1049 are ZERO, synthetic only',
  originalTableContainsSyntheticKeyVerified:false,
  originalNativePairsOrderVerified:false,
  directlyRunnableNativeFuturePrediction:false,
  userSaveOrSeedUsed:false
 };
}
module.exports={PATTERNS,winner,audit};
