'use strict';
/**
 * Source-pattern audit of 40 Korean 60014 low-gate weighted tables.
 * Compare two HYPOTHETICAL LuaJIT SourceTable construction orders:
 * table.put('key') before typed weight keys vs only typed weight keys.
 *
 * The original 7-gate research engine inserted 'key' as an extra hash key.
 * Whether the original Lua table really contains that key is NOT proven.
 * These precomputed candidate orders follow the saved source-guided
 * SourceTable beta3 MODEL, not an independently executed native LuaJIT.
 * No user seed, account state, source bytecode or future loot is included.
 */
const TYPES=Object.freeze({
  three:Object.freeze({keys:[50,10,40],ghost:[40,10,50],clean:[40,50,10]}),
  color:Object.freeze({keys:[50,30,15,5],ghost:[30,5,50,15],clean:[5,15,50,30]}),
  mixed:Object.freeze({keys:[50,'50 '],ghost:['50 ',50],clean:[50,'50 ']})
});
const GROUPS=Object.freeze([
  {gate:'취선채',three:['3/4/2','3/6/2','3/8/2'],color:['3/5/2','3/7/2','3/9/2'],dynamic:['3/11/2/imp_no/2/2']},
  {gate:'추가성',three:['3/8/2','3/11/2','3/13/2'],color:['3/9/2','3/12/2','3/14/2'],dynamic:['3/16/2/imp_no/1/2']},
  {gate:'혈의루',mixed:['3/7/2','3/12/2','3/17/2'],color:['3/8/2','3/13/2','3/18/2']},
  {gate:'천일교',three:['3/4/2','3/8/2','3/12/2','3/16/2'],color:['3/5/2','3/9/2','3/13/2','3/17/2']},
  {gate:'고골문',mixed:['3/10/2','3/14/2','3/18/2'],color:['3/11/2','3/15/2','3/19/2']},
  {gate:'철인문',mixed:['4/5/2','4/10/2','4/15/2'],color:['4/6/2','4/11/2','4/16/2']}
]);
const sameKey=(a,b)=>typeof a===typeof b&&a===b;
function choose(order,value){
 let sum=0;
 for(const key of order){sum+=Number(key);if(value<=sum)return key}
 throw new RangeError('Roll exceeds source table weight total');
}
function audit(){
 const rows=[];
 for(const group of GROUPS)for(const [kind,paths] of Object.entries(group)){
  if(kind==='gate')continue;
  for(const path of paths){
   if(kind==='dynamic'){rows.push({gate:group.gate,path,kind,modelUnresolved:true});continue}
   const def=TYPES[kind],total=def.keys.reduce((s,x)=>s+Number(x),0);
   let differingRolls=0;
   for(let n=1;n<=total;n++)
    if(!sameKey(choose(def.ghost,n),choose(def.clean,n)))differingRolls++;
   rows.push({gate:group.gate,path,kind,modelUnresolved:false,
     sourceTypedKeys:def.keys.map(x=>({type:typeof x,value:x})),
     withSyntheticKeyOrder:def.ghost,withoutSyntheticKeyOrder:def.clean,
     total,differingRolls});
  }
 }
 const comparable=rows.filter(r=>!r.modelUnresolved);
 return {
  scope:'source-derived 60014 static weighted intervals, hypothetical LuaJIT beta3 hash layouts',
  originalTableCount:rows.length,staticTableCount:comparable.length,
  dynamicallyEvaluatedTableCount:rows.length-comparable.length,
  affectedStaticTables:comparable.filter(r=>r.differingRolls>0).length,
  totalStaticRolls:comparable.reduce((n,r)=>n+r.total,0),
  affectedStaticRolls:comparable.reduce((n,r)=>n+r.differingRolls,0),
  rows,
  originalNativeHashOrderVerified:false,
  literalSyntheticKeyPresentInOriginalVerified:false,
  safeToClaimExactFutureEquipment:false,
  noPrivateInputUsed:true
 };
}
module.exports={TYPES,GROUPS,choose,audit};
