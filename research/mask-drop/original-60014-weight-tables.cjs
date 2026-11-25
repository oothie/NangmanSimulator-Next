#!/usr/bin/env node
'use strict';
/*
 * Non-private original Korean 60014 source evidence only.
 * JHAIClient_60014.sb3: sha256 35edeb7424bb023a1281e0ac62ae831e414a3efab80366a4eb32e3b987403b2d
 * getDropByID proto9 215 words. Original LuaJIT serialized table slots
 * include slot zero. For GC17: slot0=nil; slots1..4=1000,100,10,1.
 * Requires runtime verification before predicting a real drop.
 */
const FIRST=Object.freeze({callPc:74,tableRegister:9,tableSource:'dynamic getEncryptByNpc.drop; PC41-55',
  trailingComplementSource:'PC54 uses numeric constant 100 and accumulated weight register 8',
  upperBoundIfComplete:100,encryptedRowsVerified:false});
const SECOND=Object.freeze({callPc:96,constantRegister:18,constantId:17,
  rawSlots:Object.freeze([null,1000,100,10,1]),
  positiveLuaSlots:Object.freeze([1000,100,10,1]),
  totalWeight:1111,method:'literal KGC table, Lua slots 1..4'});
const SOURCE_NPCS=Object.freeze({
  30681:Object.freeze({name:'만호강',level:70,drop:Object.freeze([7209,1])}),
  32950:Object.freeze({name:'산적',level:70,drop:Object.freeze([3031,1])})
});
function dynamicFirstWeights(encryptedWeightRows) {
 if(!Array.isArray(encryptedWeightRows)||encryptedWeightRows.length===0||
   encryptedWeightRows.some(n=>!Number.isSafeInteger(n)||n<0||n>100))
  throw RangeError('Explicit source-supplied encrypted weight rows required');
 const sum=encryptedWeightRows.reduce((a,b)=>a+b,0);
 if(sum>100)throw RangeError('Cannot create negative source complement');
 return [...encryptedWeightRows,100-sum];
}
function conditionalNpcStages(npc,{encryptedDropMatchesSource=false}={}){
 if(!Object.hasOwn(SOURCE_NPCS,String(npc)))throw RangeError('Unsupported original 70-level NPC');
 if(!encryptedDropMatchesSource)return {
  npc,first:{verified:false,bound:null},
  second:{verifiedLiteral:true,bound:1111,weights:[...SECOND.positiveLuaSlots]},
  firstAndSecondSamePool:false,
  firstDropPredictionVerified:false
 };
 const source=SOURCE_NPCS[npc];
 const first=dynamicFirstWeights([source.drop[1]]);
 return {npc,first:{verified:false,conditionalOnEncryptedDropEquivalence:true,bound:100,weights:first},
  second:{verifiedLiteral:true,bound:1111,weights:[...SECOND.positiveLuaSlots]},
  firstAndSecondSamePool:false,firstDropPredictionVerified:false};
}
module.exports={FIRST,SECOND,SOURCE_NPCS,dynamicFirstWeights,conditionalNpcStages};
if(require.main===module){
 console.log(JSON.stringify(conditionalNpcStages(30681),null,2));
 console.log('No user save, native branch outcome or exact drop forecast is embedded.');
}
