'use strict';
/** Source-only deterministic mapping. Does not synthesize RNG draws or infer missing LuaJIT TDUP types. */
const fs=require('node:fs');
const path=require('node:path');
const {SourceTable}=require('./luajit-beta3-hash-strict.cjs');
function parseKey(s){
 if(/^n:-?\d+$/.test(s))return Number(s.slice(2));
 if(s.startsWith('s:'))return s.slice(2);
 throw TypeError('Bad original key identifier: '+s);
}
function checkRegister(db){
 const entries=db.consumers||[];
 if(entries.length!==30)throw Error('Expected 30 source-granted consumers');
 const ids=new Set();let total=0,verified=0;
 for(const c of entries){
  const key=`${c.gate}/${c.mode}/${c.grantNpc}`;
  if(ids.has(key))throw Error('Duplicate consumer: '+key);ids.add(key);
  if(!Array.isArray(c.equipmentIds)||!c.equipmentIds.length)throw Error('Missing original award pool: '+key);
  if(c.tables.length!==2 || !c.tables.some(t=>t.kind==='equip')||!c.tables.some(t=>t.kind==='color'))throw Error('Bad producer: '+key);
  for(const t of c.tables){
   total++;
   if(t.keyTypesVerified){
    verified++;
    const k=t.typedWrites.map(w=>w.key);
    if(t.sourceTdupPc===null || k.length!==t.modelPairsOrder.length || new Set(k).size!==k.length ||k.some(x=>!t.modelPairsOrder.includes(x)))throw Error('Malformed typed source: '+key);
   }else if(t.typedWrites.length||t.modelPairsOrder.length||t.sourceTdupPc!==null)throw Error('Unverified source promoted to runtime table: '+key);
  }
 }
 if(total!==60||verified!==60)throw Error('Source count mismatch: '+total+'/'+verified);
 return {consumers:entries.length,totalTables:total,sourceTyped:verified,awaitingOriginalBytecode:total-verified};
}
function tableOrder(t){
 if(!t.keyTypesVerified)return {status:'blocked',reason:'original TDUP/TSET key types and insertion order not available'};
 const table=new SourceTable(1);table.put('key');
 for(const w of t.typedWrites)table.put(parseKey(w.key));
 const actual=table.order().filter(k=>k!=='key').map(k=>(typeof k==='number'?'n:':'s:')+k);
 if(JSON.stringify(actual)!==JSON.stringify(t.modelPairsOrder))throw Error('LuaJIT source-model order mismatch: '+t.sourcePath);
 return {status:'conditional-model',order:actual};
}
function resolveAtRoll(t, weightsByTypedKey,roll){
 const order=tableOrder(t);
 if(order.status==='blocked')return order;
 let sum=0,full=0;
 for(const key of order.order){
  if(!Object.hasOwn(weightsByTypedKey,key))throw Error('Weight not supplied: '+key);
  const w=weightsByTypedKey[key];
  if(!Number.isSafeInteger(w)||w<0)throw RangeError('Bad weight '+key);
  full+=w;
 }
 if(!Number.isSafeInteger(roll)||roll<1||roll>full)throw RangeError('Roll out of range');
 for(const key of order.order){sum+=weightsByTypedKey[key];if(roll<=sum)return {status:'conditional-model',key,roll,total:full,order:order.order,branchActions:t.sourceBranches[key]||[]}}
 throw Error('Roll selection failed');
}
function selectVerifiedEffect(t,weightsByTypedKey,roll){
 const result=resolveAtRoll(t,weightsByTypedKey,roll);
 if(result.status==='blocked')return result;
 const effect=t.originalBytecodeBranchEffects?.[result.key];
 if(!effect)throw Error('Selected branch does not have a verified original bytecode effect');
 return {...result,effect};
}
function staticWeights(t){
 const w={};
 for(const ent of t.typedWrites){
  const k=ent.key.slice(2);
  if(!/^\d+\s*$/.test(k))return {status:'requires-dynamic-weights',unresolvedKey:ent.key};
  w[ent.key]=Number(k.trim());
 }
 return {status:'known-static-weights',weights:w};
}
function evaluateBossWithRolls(db,gate,mode,grantNpc,{equipRoll,slotRoll,colorRoll}){
 const c=db.consumers.find(x=>x.gate===gate&&x.mode===mode&&x.grantNpc===grantNpc);
 if(!c)throw Error('Missing source consumer');
 const eq=c.tables.find(t=>t.kind==='equip'),col=c.tables.find(t=>t.kind==='color');
 if(!eq.keyTypesVerified||!col.keyTypesVerified)return {status:'blocked',reason:'original TDUP/TSET not verified for both branches',gate,mode,grantNpc};
 const ew=staticWeights(eq),cw=staticWeights(col);
 if(ew.status!=='known-static-weights'||cw.status!=='known-static-weights')return {status:'requires-dynamic-weights',gate,mode,grantNpc};
 const selected=selectVerifiedEffect(eq,ew.weights,equipRoll);
 if(selected.effect.effect==='no-drop')return {status:'conditional-no-drop',gate,mode,grantNpc,seed:eq.seed,branchKey:selected.key};
 if(selected.effect.effect!=='equip-slot')throw Error('Unexpected verified equip branch');
 const max=selected.effect.maxSlot;
 if(!Number.isInteger(slotRoll)||slotRoll<1||slotRoll>max)throw RangeError('Slot draw outside actual Source SeedRandom range: '+max);
 if(max>c.equipmentIds.length)throw Error('Original slot range exceeds source consumer pool');
 const color=selectVerifiedEffect(col,cw.weights,colorRoll);
 if(color.effect.effect!=='color')throw Error('Unexpected verified color branch');
 if(selected.effect.stateNpc!==c.rngNpc||color.effect.stateNpc!==c.rngNpc)throw Error('RNG NPC mismatch');
 return {...lookupAward(db,gate,mode,grantNpc,slotRoll,color.effect.grade),status:'conditional-original-branch-model',modelOnly:true,
  seed: eq.seed,slotSeed:selected.effect.slotSeed,colorSeed:col.seed,originalBranchKey:selected.key,colorBranchKey:color.key,originalSlotUpperBound:max};
}
function lookupAward(db,gate,mode,grantNpc,slot,grade){
 const row=db.consumers.find(x=>x.gate===gate&&x.mode===mode&&x.grantNpc===grantNpc);
 if(!row)throw Error('Unrecognized grant NPC');
 if(slot===null)return {status:'no-drop',gate,mode,grantNpc};
 if(!Number.isInteger(slot)||slot<1||slot>row.equipmentIds.length)throw RangeError('Invalid source slot');
 if(![1,2,3,4].includes(grade))throw RangeError('Invalid grade code');
 const itemId=row.equipmentIds[slot-1];
 return {status:'source-slot-mapped-not-predicted',gate,mode,grantNpc,rngNpc:row.rngNpc,itemId,name:db.equipmentNames[String(itemId)],grade,gradeName:['','백색','녹색','청색','자색'][grade],sourceTier:row.sourceTier};
}
function loadDefault(){const x=JSON.parse(fs.readFileSync(path.join(__dirname,'gate-60-source-registry.json'),'utf8'));checkRegister(x);return x}
module.exports={parseKey,checkRegister,tableOrder,resolveAtRoll,selectVerifiedEffect,staticWeights,evaluateBossWithRolls,lookupAward,loadDefault};