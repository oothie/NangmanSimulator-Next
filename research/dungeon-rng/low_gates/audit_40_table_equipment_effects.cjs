'use strict';
/**
 * Effect-level assessment for source-derived 60014 Korean 20–80 gate static
 * weighted tables under THREE unverified LuaJIT hash construction models.
 *
 * This separates differing keys from differing ACTUAL original branch
 * effects (some 80-tier branches share a clear/no-item outcome). Per-boss
 * probabilities and later RNG calls are NOT inferred from this inspection.
 */
const {GROUPS}=require('./audit_40_table_synthetic_key.cjs');
const {PATTERNS,winner}=require('./audit_40_table_metadata_positions.cjs');
const byPath=new Map();
for(const g of GROUPS)for(const [kind,paths] of Object.entries(g)){
 if(kind==='gate')continue;
 for(let i=0;i<paths.length;i++){
  const path=paths[i],id=g.gate+'|'+path;
  if(byPath.has(id))throw Error('Duplicate original weighted table '+id);
  byPath.set(id,{gate:g.gate,path,kind,index:i});
 }
}
function effect(gate,path,key){
 const t=byPath.get(gate+'|'+path);
 if(!t)throw RangeError('Unknown 60014 source weighted table');
 if(t.kind==='dynamic')return null;
 if(typeof key!=='string'||!/^(number|string):/.test(key))throw TypeError('Typed branch key required');
 const v=key;
 if(t.kind==='color'){
  const code={'number:50':1,'number:30':2,'number:15':3,'number:5':4}[v];
  if(!code)throw RangeError('Unknown source color branch');
  return 'color:'+code;
 }
 if(t.kind==='mixed'){
  if(v==='number:50')return 'no-drop';
  if(v==='string:50 ')return 'equipment';
  throw RangeError('Unexpected source mixed string vs number key');
 }
 if(t.kind==='three'){
  if(v==='number:50')return 'no-drop';
  if(v==='number:40')return 'equipment';
  if(v==='number:10'){
   // The first three Tianyi bosses contain two different numeric branches
   // that BOTH represent no equipment; the fourth boss has a weapon slot.
   if(gate==='천일교'&&t.index<3)return 'no-drop';
   return 'weapon';
  }
  throw RangeError('Unknown source three-branch key');
 }
 throw RangeError('Non-static source effect not supported');
}
function atRoll(gate,path,roll){
 const t=byPath.get(gate+'|'+path);
 if(!t)throw RangeError('Unknown gate/table source');
 if(t.kind==='dynamic')return {gate,path,status:'dynamic-counter-unverified',allModelEffectAgreement:false};
 const p=PATTERNS[t.kind];
 const total=p.keys.reduce((sum,v)=>sum+Number(v),0);
 if(!Number.isSafeInteger(roll)||roll<1||roll>total)
  throw RangeError('Roll outside original table total');
 const keys={
  first:winner(p.first,roll),
  last:winner(p.last,roll),
  absent:winner(p.absent,roll)
 };
 const effects=Object.fromEntries(Object.entries(keys).map(([m,k])=>[m,effect(gate,path,k)]));
 return {gate,path,roll,typedKeys:keys,effects,
  allModelEffectAgreement:new Set(Object.values(effects)).size===1,
  // AGREEMENT here means three source-model outcomes, not original native.
  sourceModelsOnly:true,gameNativeVerified:false};
}
function audit(){
 const byGate={};let tables=0,rolls=0,stable=0;
 const effectMismatch={firstVsLast:0,firstVsAbsent:0,lastVsAbsent:0};
 for(const g of GROUPS){
  const summary=byGate[g.gate]={staticTables:0,stableEffectsAcrossAll:0,allRolls:0,
   effectMismatch:{firstVsLast:0,firstVsAbsent:0,lastVsAbsent:0}};
  for(const [kind,paths] of Object.entries(g)){
   if(kind==='gate'||kind==='dynamic')continue;
   for(const path of paths){
    const p=PATTERNS[kind],total=p.keys.reduce((n,k)=>n+Number(k),0);
    tables++;summary.staticTables++;summary.allRolls+=total;rolls+=total;
    for(let r=1;r<=total;r++){
     const e=atRoll(g.gate,path,r);
     if(e.allModelEffectAgreement){stable++;summary.stableEffectsAcrossAll++}
     for(const [label,a,b] of [
       ['firstVsLast','first','last'],
       ['firstVsAbsent','first','absent'],
       ['lastVsAbsent','last','absent']
     ])if(e.effects[a]!==e.effects[b]){
       effectMismatch[label]++;summary.effectMismatch[label]++;
     }
    }
   }
  }
 }
 return {tables,rolls,stableEffectRolls:stable,effectMismatch,byGate,
  sourceModeledOnly:true,nativeLuaJITPairsVerified:false,
  futureItemDropGuaranteed:false,individualSaveOrSeedUsed:false};
}
module.exports={effect,atRoll,audit};
